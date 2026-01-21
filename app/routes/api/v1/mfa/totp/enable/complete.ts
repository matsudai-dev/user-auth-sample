import { sValidator } from "@hono/standard-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, GONE, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import {
	mfaTotpBackupCodesTable,
	mfaTotpEnableSessionsTable,
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
import { verifyTotpCode } from "@/utils/totp";

const jsonValidator = sValidator(
	"json",
	z.object({
		mfaTotpEnableSessionToken: z.string().min(1),
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
		const { mfaTotpEnableSessionToken, totpCode } = c.req.valid("json");

		const userId = c.get("userId");

		if (!userId) {
			return c.text(UNAUTHORIZED, 401);
		}

		const db = getDBClient(c.env.DB);

		const mfaTotpEnableTokenHash = hashToken(mfaTotpEnableSessionToken);

		const now = new Date();

		const mfaTotpEnableSession = await db
			.select()
			.from(mfaTotpEnableSessionsTable)
			.where(
				and(
					eq(mfaTotpEnableSessionsTable.userId, userId),
					eq(
						mfaTotpEnableSessionsTable.mfaTotpEnableSessionTokenHash,
						mfaTotpEnableTokenHash,
					),
				),
			)
			.get();

		if (!mfaTotpEnableSession) {
			return c.text(UNAUTHORIZED, 401);
		}

		if (mfaTotpEnableSession.expireAt <= now) {
			return c.text(GONE, 410);
		}

		const isTotpCodeValid = verifyTotpCode(
			totpCode,
			mfaTotpEnableSession.totpSecret,
		);

		if (!isTotpCodeValid) {
			return c.text(UNAUTHORIZED, 401);
		}

		const backupCodes = generateBackupCodes();

		await db.transaction(async (tx) => {
			await tx
				.delete(mfaTotpEnableSessionsTable)
				.where(eq(mfaTotpEnableSessionsTable.userId, userId));

			await tx.insert(mfaTotpBackupCodesTable).values(
				backupCodes.map((code) => ({
					id: generateUuidv7(),
					userId,
					backupCodeHash: hashToken(code),
					lastFourChars: code.slice(-4),
				})),
			);

			await tx
				.update(usersTable)
				.set({ mfaTotpSecret: mfaTotpEnableSession.totpSecret })
				.where(eq(usersTable.id, userId));
		});

		return c.json({ backupCodes }, 200);
	},
);

export default route;
