import { sValidator } from "@hono/standard-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, GONE, NOT_FOUND, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import {
	loginSessionsTable,
	mfaEmailOtpBackupCodesTable,
	mfaEmailOtpLoginSessionsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import {
	generateAccessToken,
	generateRefreshToken,
	setAccessTokenInCookie,
	setRefreshTokenInCookie,
} from "@/utils/auth";
import { generateUuidv7, hashToken } from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		mfaEmailOtpLoginSessionToken: z.string().min(1),
		code: z.string().min(1),
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
		const { mfaEmailOtpLoginSessionToken, code } = c.req.valid("json");

		const db = getDBClient(c.env.DB);

		const tokenHash = hashToken(mfaEmailOtpLoginSessionToken);

		const session = await db
			.select()
			.from(mfaEmailOtpLoginSessionsTable)
			.where(
				eq(
					mfaEmailOtpLoginSessionsTable.mfaEmailOtpLoginSessionTokenHash,
					tokenHash,
				),
			)
			.get();

		if (!session) {
			return c.text(UNAUTHORIZED, 401);
		}

		const now = new Date();

		if (session.expireAt <= now) {
			return c.text(GONE, 410);
		}

		const user = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.id, session.userId))
			.get();

		if (!user) {
			return c.text(NOT_FOUND, 404);
		}

		const codeHash = hashToken(code);

		const backupCode = await db
			.select()
			.from(mfaEmailOtpBackupCodesTable)
			.where(
				and(
					eq(mfaEmailOtpBackupCodesTable.userId, user.id),
					eq(mfaEmailOtpBackupCodesTable.backupCodeHash, codeHash),
				),
			)
			.get();

		if (!backupCode || backupCode.usedAt) {
			return c.text(UNAUTHORIZED, 401);
		}

		await db
			.update(mfaEmailOtpBackupCodesTable)
			.set({
				usedAt: now,
			})
			.where(eq(mfaEmailOtpBackupCodesTable.id, backupCode.id));

		const accessToken = await generateAccessToken(
			user.id,
			c.env.ACCESS_TOKEN_SECRET_KEY,
		);

		await setAccessTokenInCookie(c, accessToken);

		if (session.rememberMe) {
			const { refreshToken, refreshTokenHash, expireAt } =
				generateRefreshToken();

			await db.insert(loginSessionsTable).values({
				id: generateUuidv7(),
				userId: user.id,
				refreshTokenHash,
				userAgent: c.req.header("user-agent") ?? "",
				expireAt,
			});

			await setRefreshTokenInCookie(c, refreshToken);
		}

		await db
			.delete(mfaEmailOtpLoginSessionsTable)
			.where(eq(mfaEmailOtpLoginSessionsTable.userId, session.userId));

		return c.text(OK, 200);
	},
);

export default route;
