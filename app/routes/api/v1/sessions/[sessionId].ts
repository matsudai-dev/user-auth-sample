import { sValidator } from "@hono/standard-validator";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { BAD_REQUEST, NOT_FOUND, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import { loginSessionsTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import { createHonoApp } from "@/utils/factory/hono";

const paramValidator = sValidator(
	"param",
	z.object({
		sessionId: z.string().min(1),
	}),
	async (result, c) => {
		if (!result.success) {
			return c.text(BAD_REQUEST, 400);
		}
	},
);

export const route = createHonoApp().delete(
	"/",
	loginRequired,
	paramValidator,
	injectExternalErrors,
	async (c) => {
		const { sessionId } = c.req.valid("param");

		const userId = c.get("userId");

		if (!userId) {
			return c.text(UNAUTHORIZED, 401);
		}

		const db = getDBClient(c.env.DB);

		const deletedSessions = await db
			.delete(loginSessionsTable)
			.where(
				and(
					eq(loginSessionsTable.id, sessionId),
					eq(loginSessionsTable.userId, userId),
				),
			)
			.returning()
			.get();

		if (!deletedSessions) {
			return c.text(NOT_FOUND, 404);
		}

		return c.text(OK, 200);
	},
);

export default route;
