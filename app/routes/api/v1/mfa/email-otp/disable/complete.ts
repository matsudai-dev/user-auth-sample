import { sValidator } from "@hono/standard-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, GONE, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import {
	mfaEmailOtpBackupCodesTable,
	mfaEmailOtpDisableSessionsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import { hashToken } from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		mfaEmailOtpDisableSessionToken: z.string().min(1),
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
		const { mfaEmailOtpDisableSessionToken, otpCode } = c.req.valid("json");

		const userId = c.get("userId");

		if (!userId) {
			return c.text(UNAUTHORIZED, 401);
		}

		const db = getDBClient(c.env.DB);

		const mfaEmailOtpDisableSessionTokenHash = hashToken(
			mfaEmailOtpDisableSessionToken,
		);

		const now = new Date();

		const mfaEmailOtpDisableSession = await db
			.select()
			.from(mfaEmailOtpDisableSessionsTable)
			.where(
				and(
					eq(mfaEmailOtpDisableSessionsTable.userId, userId),
					eq(
						mfaEmailOtpDisableSessionsTable.mfaEmailOtpDisableSessionTokenHash,
						mfaEmailOtpDisableSessionTokenHash,
					),
				),
			)
			.get();

		if (!mfaEmailOtpDisableSession) {
			return c.text(UNAUTHORIZED, 401);
		}

		if (mfaEmailOtpDisableSession.expireAt <= now) {
			return c.text(GONE, 410);
		}

		const otpCodeHash = hashToken(otpCode);

		if (mfaEmailOtpDisableSession.otpCodeHash !== otpCodeHash) {
			return c.text(UNAUTHORIZED, 401);
		}

		await db.transaction(async (tx) => {
			await tx
				.delete(mfaEmailOtpDisableSessionsTable)
				.where(eq(mfaEmailOtpDisableSessionsTable.userId, userId));

			await tx
				.delete(mfaEmailOtpBackupCodesTable)
				.where(eq(mfaEmailOtpBackupCodesTable.userId, userId));

			await tx
				.update(usersTable)
				.set({ mfaEmailOtpEnabled: false })
				.where(eq(usersTable.id, userId));
		});

		return c.text(OK, 200);
	},
);

export default route;
