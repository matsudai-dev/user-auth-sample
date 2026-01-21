import { and, eq } from "drizzle-orm";
import { BAD_REQUEST, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import { mfaEmailOtpBackupCodesTable, usersTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import { createHonoApp } from "@/utils/factory/hono";

export const route = createHonoApp().get(
	"/",
	loginRequired,
	injectExternalErrors,
	async (c) => {
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

		if (!user.mfaEmailOtpEnabled) {
			return c.text(BAD_REQUEST, 400);
		}

		const rawBackupCodes = await db
			.select({
				lastFourChars: mfaEmailOtpBackupCodesTable.lastFourChars,
				usedAt: mfaEmailOtpBackupCodesTable.usedAt,
			})
			.from(mfaEmailOtpBackupCodesTable)
			.where(and(eq(mfaEmailOtpBackupCodesTable.userId, user.id)));

		const backupCodes = rawBackupCodes.map((code) => {
			const v: { lastFourChars: string; usedAt?: string } = {
				lastFourChars: code.lastFourChars,
			};

			if (code.usedAt) {
				v.usedAt = code.usedAt.toISOString();
			}

			return v;
		});

		return c.json({ backupCodes }, 200);
	},
);

export default route;
