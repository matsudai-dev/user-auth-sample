import { sValidator } from "@hono/standard-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
	BAD_REQUEST,
	OK,
	PASSWORD_RESET_SESSION_EXPIRATION_MS,
	TOO_MANY_REQUESTS,
	UNAUTHORIZED,
} from "@/consts";
import { getDBClient } from "@/db/client";
import {
	loginSessionsTable,
	passwordChangeRateLimitsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import {
	generateAccessToken,
	generateRefreshToken,
	getRefreshTokenFromCookie,
	incrementLoginAttempts,
	setAccessTokenInCookie,
	setRefreshTokenInCookie,
	validateLoginRateLimit,
} from "@/utils/auth";
import { generateSalt, hashPassword, hashToken } from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		currentPassword: z.string().min(8),
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
	loginRequired,
	jsonValidator,
	injectExternalErrors,
	async (c) => {
		const { currentPassword, newPassword } = c.req.valid("json");

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

		const loginRateLimit = await validateLoginRateLimit(c, user.email);

		if (loginRateLimit.isLocked) {
			return c.text(TOO_MANY_REQUESTS, 429);
		}

		const currentPasswordHash = hashPassword(currentPassword, user.salt);

		if (currentPasswordHash !== user.passwordHash) {
			const { locked } = await incrementLoginAttempts(
				c,
				user.email,
				loginRateLimit.currentFailedAttempts,
			);

			if (locked) {
				return c.text(TOO_MANY_REQUESTS, 429);
			}

			return c.text(UNAUTHORIZED, 401);
		}

		const newSalt = generateSalt();

		const newPasswordHash = hashPassword(newPassword, newSalt);

		const now = new Date();

		await db
			.update(usersTable)
			.set({
				salt: newSalt,
				passwordHash: newPasswordHash,
			})
			.where(eq(usersTable.id, userId));

		await db
			.delete(loginSessionsTable)
			.where(eq(loginSessionsTable.userId, userId));

		await db.insert(passwordChangeRateLimitsTable).values({
			userId: userId,
			lastRequestAt: now,
			expireAt: offsetMilliSeconds(now, PASSWORD_RESET_SESSION_EXPIRATION_MS),
		});

		const accessToken = await generateAccessToken(
			user.id,
			c.env.ACCESS_TOKEN_SECRET_KEY,
		);

		await setAccessTokenInCookie(c, accessToken);

		const refreshToken = await getRefreshTokenFromCookie(c);

		if (!refreshToken) {
			return c.text(UNAUTHORIZED, 401);
		}

		const refreshTokenHash = hashToken(refreshToken);

		const currentSession = await db
			.select()
			.from(loginSessionsTable)
			.where(eq(loginSessionsTable.refreshTokenHash, refreshTokenHash))
			.get();

		if (!currentSession) {
			return c.text(UNAUTHORIZED, 401);
		}

		const {
			refreshToken: newRefreshToken,
			refreshTokenHash: newRefreshTokenHash,
			expireAt,
		} = generateRefreshToken();

		await db
			.update(loginSessionsTable)
			.set({
				refreshTokenHash: newRefreshTokenHash,
				expireAt: expireAt,
			})
			.where(eq(loginSessionsTable.id, currentSession.id));

		await setRefreshTokenInCookie(c, newRefreshToken);

		return c.text(OK, 200);
	},
);

export default route;
