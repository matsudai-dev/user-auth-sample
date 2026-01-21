import { eq } from "drizzle-orm";
import {
	DELETED_USER_EXPIRATION_MS,
	DELETED_USER_REREGISTRATION_ALLOWED_MS,
	OK,
	UNAUTHORIZED,
} from "@/consts";
import { getDBClient } from "@/db/client";
import {
	deletedUsersTable,
	emailChangeSessionsTable,
	loginSessionsTable,
	mfaEmailOtpBackupCodesTable,
	mfaEmailOtpDisableSessionsTable,
	mfaEmailOtpEnableSessionsTable,
	mfaEmailOtpLoginSessionsTable,
	mfaTotpBackupCodesTable,
	mfaTotpEnableSessionsTable,
	mfaTotpLoginSessionsTable,
	passwordResetSessionsTable,
	signupSessionsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import { offsetMilliSeconds } from "@/utils/date";
import { createHonoApp } from "@/utils/factory/hono";

export const route = createHonoApp()
	.get("/", loginRequired, injectExternalErrors, async (c) => {
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

		return c.json(
			{
				id: userId,
				email: user.email,
				createdAt: user.createdAt,
				mfaTotpEnabled: !!user.mfaTotpSecret,
				mfaEmailOtpEnabled: user.mfaEmailOtpEnabled,
			},
			200,
		);
	})
	.delete("/", loginRequired, injectExternalErrors, async (c) => {
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

		const now = new Date();

		const reregistrationAllowedAt = offsetMilliSeconds(
			now,
			DELETED_USER_REREGISTRATION_ALLOWED_MS,
		);

		const expireAt = offsetMilliSeconds(now, DELETED_USER_EXPIRATION_MS);

		await db.transaction(async (tx) => {
			await tx.insert(deletedUsersTable).values({
				userId,
				email: user.email,
				reregistrationAllowedAt,
				expireAt,
			});

			await tx
				.delete(signupSessionsTable)
				.where(eq(signupSessionsTable.email, user.email));

			await tx
				.delete(loginSessionsTable)
				.where(eq(loginSessionsTable.userId, userId));

			await tx
				.delete(passwordResetSessionsTable)
				.where(eq(passwordResetSessionsTable.userId, userId));

			await tx
				.delete(emailChangeSessionsTable)
				.where(eq(emailChangeSessionsTable.userId, userId));

			await tx
				.delete(mfaTotpLoginSessionsTable)
				.where(eq(mfaTotpLoginSessionsTable.userId, userId));

			await tx
				.delete(mfaTotpEnableSessionsTable)
				.where(eq(mfaTotpEnableSessionsTable.userId, userId));

			await tx
				.delete(mfaEmailOtpLoginSessionsTable)
				.where(eq(mfaEmailOtpLoginSessionsTable.userId, userId));

			await tx
				.delete(mfaEmailOtpEnableSessionsTable)
				.where(eq(mfaEmailOtpEnableSessionsTable.userId, userId));

			await tx
				.delete(mfaEmailOtpDisableSessionsTable)
				.where(eq(mfaEmailOtpDisableSessionsTable.userId, userId));

			await tx
				.delete(mfaTotpBackupCodesTable)
				.where(eq(mfaTotpBackupCodesTable.userId, userId));

			await tx
				.delete(mfaEmailOtpBackupCodesTable)
				.where(eq(mfaEmailOtpBackupCodesTable.userId, userId));

			await tx.delete(usersTable).where(eq(usersTable.id, userId));
		});

		return c.text(OK, 200);
	});

export default route;
