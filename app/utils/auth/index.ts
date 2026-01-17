import type { Context, Env } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import {
	ACCESS_TOKEN_EXPIRATION_MS,
	REFRESH_TOKEN_EXPIRATION_MS,
} from "@/consts";
import { generateSecureToken, hashToken } from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";

/** JWT signature algorithm */
const SIGNATURE_ALGORITHM = "HS256";

/** Access token cookie name */
const ACCESS_TOKEN_NAME = "access_token";

/** Refresh token cookie name */
const REFRESH_TOKEN_NAME = "refresh_token";

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
		SIGNATURE_ALGORITHM,
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
		ACCESS_TOKEN_NAME,
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
		REFRESH_TOKEN_NAME,
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

export async function getUserIdFromAccessTokenCookie(
	c: Context<Env>,
): Promise<string | undefined> {
	const accessToken = await getSignedCookie(
		c,
		c.env.ACCESS_TOKEN_SECRET_KEY,
		ACCESS_TOKEN_NAME,
	);

	if (!accessToken) {
		return undefined;
	}

	let jwt: JWTPayload | undefined;

	try {
		jwt = await verify(
			accessToken,
			c.env.ACCESS_TOKEN_SECRET_KEY,
			SIGNATURE_ALGORITHM,
		);
	} catch {
		return undefined;
	}

	const userId = jwt.sub;

	if (typeof userId !== "string") {
		return undefined;
	}

	return userId;
}

export async function getRefreshTokenFromCookie(
	c: Context<Env>,
): Promise<string | undefined> {
	const refreshToken = await getSignedCookie(
		c,
		c.env.REFRESH_TOKEN_SECRET_KEY,
		REFRESH_TOKEN_NAME,
	);

	if (!refreshToken) {
		return undefined;
	}

	return refreshToken;
}

/**
 * Deletes access token cookie.
 *
 * @param c - Hono context
 */
export function deleteAccessTokenCookie(c: Context<Env>): void {
	deleteCookie(c, ACCESS_TOKEN_NAME);
}

/**
 * Deletes refresh token cookie.
 *
 * @param c - Hono context
 */
export function deleteRefreshTokenCookie(c: Context<Env>): void {
	deleteCookie(c, REFRESH_TOKEN_NAME);
}
