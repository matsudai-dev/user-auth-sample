import { sValidator } from "@hono/standard-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, GONE, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import {
	mfaEmailOtpBackupCodesTable,
	mfaEmailOtpEnableSessionsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import {
	generateBackupCodes,
	generateUuidv7,
	hashToken,
} from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		mfaEmailOtpEnableSessionToken: z.string().min(1),
		otpCode: z.string().min(1),
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
		const { mfaEmailOtpEnableSessionToken, otpCode } = c.req.valid("json");

		const userId = c.get("userId");

		if (!userId) {
			return c.text(UNAUTHORIZED, 401);
		}

		const db = getDBClient(c.env.DB);

		const mfaEmailOtpEnableTokenHash = hashToken(mfaEmailOtpEnableSessionToken);

		const now = new Date();

		const mfaEmailOtpEnableSession = await db
			.select()
			.from(mfaEmailOtpEnableSessionsTable)
			.where(
				and(
					eq(mfaEmailOtpEnableSessionsTable.userId, userId),
					eq(
						mfaEmailOtpEnableSessionsTable.mfaEmailOtpEnableSessionTokenHash,
						mfaEmailOtpEnableTokenHash,
					),
				),
			)
			.get();

		if (!mfaEmailOtpEnableSession) {
			return c.text(UNAUTHORIZED, 401);
		}

		if (mfaEmailOtpEnableSession.expireAt <= now) {
			return c.text(GONE, 410);
		}

		const otpCodeHash = hashToken(otpCode);

		if (mfaEmailOtpEnableSession.otpCodeHash !== otpCodeHash) {
			return c.text(UNAUTHORIZED, 401);
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

			await tx
				.update(usersTable)
				.set({ mfaEmailOtpEnabled: true })
				.where(eq(usersTable.id, userId));
		});

		return c.json({ backupCodes }, 200);
	},
);

export default route;
