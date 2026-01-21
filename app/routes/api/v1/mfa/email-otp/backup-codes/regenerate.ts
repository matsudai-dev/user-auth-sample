import { eq } from "drizzle-orm";
import { BAD_REQUEST, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import { mfaEmailOtpBackupCodesTable, usersTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import {
	generateBackupCodes,
	generateUuidv7,
	hashToken,
} from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";

export const route = createHonoApp().post(
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

		const backupCodes = generateBackupCodes();

		await db.transaction(async (tx) => {
			await tx
				.delete(mfaEmailOtpBackupCodesTable)
				.where(eq(mfaEmailOtpBackupCodesTable.userId, userId));

			await tx.insert(mfaEmailOtpBackupCodesTable).values(
				backupCodes.map((code) => ({
					id: generateUuidv7(),
					userId,
					backupCodeHash: hashToken(code),
					lastFourChars: code.slice(-4),
				})),
			);
		});

		return c.json({ backupCodes }, 200);
	},
);

export default route;
