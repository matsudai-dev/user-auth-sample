import { eq } from "drizzle-orm";
import type { Env } from "hono";
import { createMiddleware } from "hono/factory";
import { UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import { loginSessionsTable } from "@/db/schemas";
import {
	generateAccessToken,
	generateRefreshToken,
	getRefreshTokenFromCookie,
	getUserIdFromAccessTokenCookie,
	setAccessTokenInCookie,
	setRefreshTokenInCookie,
} from "@/utils/auth";
import { hashToken } from "@/utils/crypto/server";

export const loginRequired = createMiddleware<Env>(async (c, next) => {
	const userId = await getUserIdFromAccessTokenCookie(c);

	if (userId) {
		c.set("userId", userId);
	} else {
		const refreshToken = await getRefreshTokenFromCookie(c);

		if (!refreshToken) {
			return c.text(UNAUTHORIZED, 401);
		}

		const refreshTokenHash = hashToken(refreshToken);

		const db = getDBClient(c.env.DB);

		const currentSession = await db
			.select()
			.from(loginSessionsTable)
			.where(eq(loginSessionsTable.refreshTokenHash, refreshTokenHash))
			.get();

		if (!currentSession) {
			return c.text(UNAUTHORIZED, 401);
		}

		const accessToken = await generateAccessToken(
			currentSession.userId,
			c.env.ACCESS_TOKEN_SECRET_KEY,
		);

		await setAccessTokenInCookie(c, accessToken);

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

		c.set("userId", currentSession.userId);
	}

	await next();
});
