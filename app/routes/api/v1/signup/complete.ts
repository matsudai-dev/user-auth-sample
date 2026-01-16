import { sValidator } from "@hono/standard-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, GONE, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import {
	loginSessionsTable,
	signupSessionsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import {
	generateAccessToken,
	generateRefreshToken,
	setAccessTokenInCookie,
	setRefreshTokenInCookie,
} from "@/utils/auth";
import {
	generateSalt,
	generateUuidv7,
	hashPassword,
	hashToken,
} from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		signupSessionToken: z.string().min(1),
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
		const { signupSessionToken, password, rememberMe } = c.req.valid("json");

		const db = getDBClient(c.env.DB);

		const tokenHash = hashToken(signupSessionToken);

		const signupSession = await db
			.select()
			.from(signupSessionsTable)
			.where(eq(signupSessionsTable.signupSessionTokenHash, tokenHash))
			.get();

		if (!signupSession) {
			return c.text(UNAUTHORIZED, 401);
		}

		const now = new Date();

		if (signupSession.expireAt <= now) {
			return c.text(GONE, 410);
		}

		const salt = generateSalt();

		const passwordHash = hashPassword(password, salt);

		const userId = generateUuidv7();

		await db.insert(usersTable).values({
			id: userId,
			email: signupSession.email,
			salt,
			passwordHash,
		});

		await db
			.delete(signupSessionsTable)
			.where(eq(signupSessionsTable.id, signupSession.id));

		const accessToken = await generateAccessToken(
			userId,
			c.env.ACCESS_TOKEN_SECRET_KEY,
		);

		if (rememberMe) {
			const { refreshToken, refreshTokenHash, expireAt } =
				generateRefreshToken();

			await db.insert(loginSessionsTable).values({
				id: generateUuidv7(),
				userId,
				refreshTokenHash,
				userAgent: c.req.header("user-agent") ?? "Unknown",
				expireAt,
			});

			await setAccessTokenInCookie(c, accessToken);
			await setRefreshTokenInCookie(c, refreshToken);
		} else {
			await setAccessTokenInCookie(c, accessToken);
		}

		return c.text(OK, 200);
	},
);

export default route;
