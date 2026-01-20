import { sValidator } from "@hono/standard-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
	BAD_REQUEST,
	MFA_LOGIN_SESSION_EXPIRATION_MS,
	TOO_MANY_REQUESTS,
	UNAUTHORIZED,
} from "@/consts";
import { getDBClient } from "@/db/client";
import {
	loginSessionsTable,
	mfaEmailOtpLoginSessionsTable,
	mfaTotpLoginSessionsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import {
	generateAccessToken,
	generateRefreshToken,
	incrementLoginAttempts,
	setAccessTokenInCookie,
	setRefreshTokenInCookie,
	validateLoginRateLimit,
} from "@/utils/auth";
import {
	generateOtpCode,
	generateSecureToken,
	generateUuidv7,
	hashPassword,
	hashToken,
} from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";
import { getResendClient } from "@/utils/email";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		email: z.email(),
		password: z.string().min(8),
		rememberMe: z.boolean().optional(),
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
		const { email, password, rememberMe = false } = c.req.valid("json");

		const db = getDBClient(c.env.DB);

		const now = new Date();

		const loginRateLimit = await validateLoginRateLimit(c, email);

		if (loginRateLimit.isLocked) {
			return c.text(TOO_MANY_REQUESTS, 429);
		}

		const user = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.email, email))
			.get();

		if (!user) {
			return c.text(UNAUTHORIZED, 401);
		}

		const passwordHash = hashPassword(password, user.salt);

		if (passwordHash !== user.passwordHash) {
			const { locked } = await incrementLoginAttempts(
				c,
				email,
				loginRateLimit.currentFailedAttempts,
			);

			if (locked) {
				return c.text(TOO_MANY_REQUESTS, 429);
			}

			return c.text(UNAUTHORIZED, 401);
		}

		const response: {
			mfaTotpLoginSessionToken?: string;
			mfaEmailOtpLoginSessionToken?: string;
		} = {};

		if (user.mfaTotpEnabled || user.mfaEmailOtpEnabled) {
			const expireAt = offsetMilliSeconds(now, MFA_LOGIN_SESSION_EXPIRATION_MS);

			if (user.mfaTotpEnabled) {
				const mfaTotpLoginSessionToken = generateSecureToken();

				const mfaTotpLoginSessionTokenHash = hashToken(
					mfaTotpLoginSessionToken,
				);

				await db.insert(mfaTotpLoginSessionsTable).values({
					userId: user.id,
					mfaTotpLoginSessionTokenHash,
					rememberMe,
					expireAt,
				});

				response.mfaTotpLoginSessionToken = mfaTotpLoginSessionToken;
			}

			if (user.mfaEmailOtpEnabled) {
				const mfaEmailOtpLoginSessionToken = generateSecureToken();

				const mfaEmailOtpLoginSessionTokenHash = hashToken(
					mfaEmailOtpLoginSessionToken,
				);

				const otpCode = generateOtpCode();

				const otpCodeHash = hashToken(otpCode);

				await db.insert(mfaEmailOtpLoginSessionsTable).values({
					userId: user.id,
					mfaEmailOtpLoginSessionTokenHash,
					otpCodeHash,
					rememberMe,
					expireAt,
				});

				const resend = getResendClient(c.env.RESEND_API_KEY);

				await resend.emails.send({
					from: c.env.RESEND_EMAIL_FROM,
					to: user.email,
					subject: "Login Verification Code",
					html: `
						<h1>Login Verification</h1>
						<p>Your verification code is:</p>
						<h2>${otpCode}</h2>
						<p>This code will expire in 5 minutes.</p>
					`,
				});

				response.mfaEmailOtpLoginSessionToken = mfaEmailOtpLoginSessionToken;
			}
		}

		const accessToken = await generateAccessToken(
			user.id,
			c.env.ACCESS_TOKEN_SECRET_KEY,
		);

		await setAccessTokenInCookie(c, accessToken);

		if (rememberMe) {
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

		return c.json(response, 200);
	},
);

export default route;
