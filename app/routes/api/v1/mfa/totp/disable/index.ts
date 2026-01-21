import { sValidator } from "@hono/standard-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import { mfaTotpBackupCodesTable, usersTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import { hashPassword } from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";
import { verifyTotpCode } from "@/utils/totp";

const jsonValidator = sValidator(
	"json",
	z.object({
		password: z.string().min(1),
		totpCode: z.string().min(1),
	}),
	async (result, c) => {
		if (!result.success) {
			return c.text(BAD_REQUEST, 400);
		}
	},
);

export const route = createHonoApp().post(
	"/",
	loginRequired,
	jsonValidator,
	injectExternalErrors,
	async (c) => {
		const { password, totpCode } = c.req.valid("json");

		const userId = c.get("userId");

		if (!userId) {
			return c.text(UNAUTHORIZED, 401);
		}

		const db = getDBClient(c.env.DB);

		const user = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.id, userId))
			.get();

		if (!user) {
			return c.text(UNAUTHORIZED, 401);
		}

		if (!user.mfaTotpSecret) {
			return c.text(BAD_REQUEST, 400);
		}

		const passwordHash = hashPassword(password, user.salt);

		if (passwordHash !== user.passwordHash) {
			return c.text(UNAUTHORIZED, 401);
		}

		const isTotpCodeValid = verifyTotpCode(user.mfaTotpSecret, totpCode);

		if (!isTotpCodeValid) {
			return c.text(UNAUTHORIZED, 401);
		}

		await db.transaction(async (tx) => {
			await tx
				.update(usersTable)
				.set({ mfaTotpSecret: null })
				.where(eq(usersTable.id, user.id));

			await tx
				.delete(mfaTotpBackupCodesTable)
				.where(and(eq(mfaTotpBackupCodesTable.userId, user.id)));
		});

		return c.text(OK, 200);
	},
);

export default route;
