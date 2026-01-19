import { sValidator } from "@hono/standard-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, GONE, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import {
	loginSessionsTable,
	passwordResetRateLimitsTable,
	passwordResetSessionsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { generateSalt, hashPassword, hashToken } from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		passwordResetToken: z.string().min(1),
		newPassword: z.string().min(8),
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
		const { passwordResetToken, newPassword } = c.req.valid("json");

		const passwordResetTokenHash = hashToken(passwordResetToken);

		const db = getDBClient(c.env.DB);

		const result = await db
			.select({
				userId: usersTable.id,
				email: usersTable.email,
				expireAt: passwordResetSessionsTable.expireAt,
			})
			.from(passwordResetSessionsTable)
			.leftJoin(
				usersTable,
				eq(passwordResetSessionsTable.userId, usersTable.id),
			)
			.where(
				eq(
					passwordResetSessionsTable.passwordResetTokenHash,
					passwordResetTokenHash,
				),
			)
			.get();

		if (!result || !result.userId || !result.email) {
			return c.text(UNAUTHORIZED, 401);
		}

		const now = new Date();

		if (result.expireAt <= now) {
			return c.text(GONE, 410);
		}

		const salt = generateSalt();

		const passwordHash = hashPassword(newPassword, salt);

		await db
			.update(usersTable)
			.set({
				salt,
				passwordHash,
			})
			.where(eq(usersTable.id, result.userId));

		await db
			.delete(passwordResetSessionsTable)
			.where(eq(passwordResetSessionsTable.userId, result.userId));

		await db
			.delete(passwordResetRateLimitsTable)
			.where(eq(passwordResetRateLimitsTable.email, result.email));

		await db
			.delete(loginSessionsTable)
			.where(eq(loginSessionsTable.userId, result.userId));

		return c.text(OK, 200);
	},
);

export default route;
