import { sValidator } from "@hono/standard-validator";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import { loginSessionsTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import {
	deleteAccessTokenCookie,
	deleteRefreshTokenCookie,
	getRefreshTokenFromCookie,
} from "@/utils/auth";
import { hashToken } from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		scope: z.enum(["current", "others", "all"]),
	}),
	async (result, c) => {
		if (!result.success) {
			return c.text(BAD_REQUEST, 400);
		}
	},
);

export const route = createHonoApp().post(
	"/",
	jsonValidator,
	injectExternalErrors,
	async (c) => {
		const { scope } = c.req.valid("json");

		const refreshToken = await getRefreshTokenFromCookie(c);

		if (!refreshToken) {
			return c.text(UNAUTHORIZED, 401);
		}

		const db = getDBClient(c.env.DB);

		const refreshTokenHash = hashToken(refreshToken);

		const currentSession = await db
			.select()
			.from(loginSessionsTable)
			.where(eq(loginSessionsTable.refreshTokenHash, refreshTokenHash))
			.get();

		if (!currentSession) {
			return c.text(UNAUTHORIZED, 401);
		}

		if (scope === "current") {
			await db
				.delete(loginSessionsTable)
				.where(eq(loginSessionsTable.id, currentSession.id));
		} else if (scope === "others") {
			await db
				.delete(loginSessionsTable)
				.where(
					and(
						eq(loginSessionsTable.userId, currentSession.userId),
						ne(loginSessionsTable.id, currentSession.id),
					),
				);
		} else {
			await db
				.delete(loginSessionsTable)
				.where(eq(loginSessionsTable.userId, currentSession.userId));
		}

		deleteAccessTokenCookie(c);
		deleteRefreshTokenCookie(c);

		return c.text(OK, 200);
	},
);

export default route;
