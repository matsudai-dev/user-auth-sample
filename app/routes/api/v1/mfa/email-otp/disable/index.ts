import { sValidator } from "@hono/standard-validator";
import { and, eq, gt } from "drizzle-orm";
import z from "zod";
import {
	BAD_REQUEST,
	MFA_EMAIL_OTP_DISABLE_SESSION_EXPIRATION_MS,
	NOT_FOUND,
	TOO_MANY_REQUESTS,
	UNAUTHORIZED,
} from "@/consts";
import { getDBClient } from "@/db/client";
import { mfaEmailOtpDisableSessionsTable, usersTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import {
	generateOtpCode,
	generateSecureToken,
	hashPassword,
	hashToken,
} from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";
import { getResendClient } from "@/utils/email";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		password: z.string().min(8),
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
		const { password } = c.req.valid("json");

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
			return c.text(NOT_FOUND, 404);
		}

		if (user.mfaEmailOtpEnabled) {
			return c.text(BAD_REQUEST, 400);
		}

		const passwordHash = hashPassword(password, user.salt);

		if (passwordHash !== user.passwordHash) {
			return c.text(UNAUTHORIZED, 401);
		}

		const now = new Date();

		const existingSession = await db
			.select()
			.from(mfaEmailOtpDisableSessionsTable)
			.where(
				and(
					eq(mfaEmailOtpDisableSessionsTable.userId, user.id),
					gt(mfaEmailOtpDisableSessionsTable.expireAt, now),
				),
			)
			.get();

		if (existingSession) {
			return c.text(TOO_MANY_REQUESTS, 429);
		}

		const mfaEmailOtpDisableSessionToken = generateSecureToken();

		const mfaEmailOtpDisableSessionTokenHash = hashToken(
			mfaEmailOtpDisableSessionToken,
		);

		const otpCode = generateOtpCode();

		const otpCodeHash = hashToken(otpCode);

		const expireAt = offsetMilliSeconds(
			now,
			MFA_EMAIL_OTP_DISABLE_SESSION_EXPIRATION_MS,
		);

		await db.insert(mfaEmailOtpDisableSessionsTable).values({
			userId: user.id,
			mfaEmailOtpDisableSessionTokenHash,
			otpCodeHash,
			expireAt,
		});

		const resend = getResendClient(c.env.RESEND_API_KEY);

		await resend.emails.send({
			from: c.env.RESEND_EMAIL_FROM,
			to: user.email,
			subject: "Disable Email OTP - Verification Code",
			html: `
				<h1>Disable Email OTP Authentication</h1>
				<p>Your verification code is:</p>
				<h2>${otpCode}</h2>
				<p>This code will expire in 15 minutes.</p>
				<p>If you did not request this, please secure your account immediately.</p>
			`,
		});

		return c.json({ mfaEmailOtpDisableSessionToken }, 200);
	},
);

export default route;
