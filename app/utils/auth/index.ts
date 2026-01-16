import type { Context, Env } from "hono";
import { setSignedCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import {
	ACCESS_TOKEN_EXPIRATION_MS,
	REFRESH_TOKEN_EXPIRATION_MS,
} from "@/consts";
import { generateSecureToken, hashToken } from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";

/**
 * Generates a JWT access token.
 *
 * @param userId - The user ID to include in the token
 * @param jwtSecret - The JWT secret key
 * @returns JWT access token string
 */
export async function generateAccessToken(
	userId: string,
	jwtSecret: string,
): Promise<string> {
	const now = new Date();

	const expireAt = offsetMilliSeconds(now, ACCESS_TOKEN_EXPIRATION_MS);

	return await sign(
		{
			sub: userId,
			iat: Math.floor(now.getTime() / 1000),
			exp: Math.floor(expireAt.getTime() / 1000),
		},
		jwtSecret,
	);
}

/**
 * Generates a refresh token with its hash and expiration.
 *
 * @returns Object containing refresh token, its hash, and expiration date
 */
export function generateRefreshToken(): {
	refreshToken: string;
	refreshTokenHash: string;
	expireAt: Date;
} {
	const refreshToken = generateSecureToken();
	const refreshTokenHash = hashToken(refreshToken);

	const now = new Date();
	const expireAt = offsetMilliSeconds(now, REFRESH_TOKEN_EXPIRATION_MS);

	return { refreshToken, refreshTokenHash, expireAt };
}

/**
 * Sets access token in cookie.
 *
 * @param c - Hono context
 * @param token - JWT access token
 */
export async function setAccessTokenInCookie(
	c: Context<Env>,
	token: string,
): Promise<void> {
	const isDevelopment = process.env.NODE_ENV === "development";

	const expires = offsetMilliSeconds(new Date(), ACCESS_TOKEN_EXPIRATION_MS);

	await setSignedCookie(
		c,
		"access_token",
		token,
		c.env.ACCESS_TOKEN_SECRET_KEY,
		{
			httpOnly: true,
			secure: !isDevelopment,
			sameSite: "Strict",
			expires,
			path: "/",
		},
	);
}

/**
 * Sets refresh token in cookie.
 *
 * @param c - Hono context
 * @param token - refresh token
 */
export async function setRefreshTokenInCookie(
	c: Context<Env>,
	token: string,
): Promise<void> {
	const isDevelopment = process.env.NODE_ENV === "development";

	const expires = offsetMilliSeconds(new Date(), REFRESH_TOKEN_EXPIRATION_MS);

	await setSignedCookie(
		c,
		"refresh_token",
		token,
		c.env.REFRESH_TOKEN_SECRET_KEY,
		{
			httpOnly: true,
			secure: !isDevelopment,
			sameSite: "Strict",
			expires,
			path: "/",
		},
	);
}
