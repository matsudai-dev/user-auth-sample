import { sValidator } from "@hono/standard-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, GONE, NOT_FOUND, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import {
	loginSessionsTable,
	mfaTotpLoginSessionsTable,
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
import { verifyTotpCode } from "@/utils/totp";

const jsonValidator = sValidator(
	"json",
	z.object({
		mfaTotpLoginSessionToken: z.string().min(1),
		code: z.string().regex(/^\d{6}$/),
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
		const { mfaTotpLoginSessionToken, code } = c.req.valid("json");

		const db = getDBClient(c.env.DB);

		const tokenHash = hashToken(mfaTotpLoginSessionToken);

		const session = await db
			.select()
			.from(mfaTotpLoginSessionsTable)
			.where(
				eq(mfaTotpLoginSessionsTable.mfaTotpLoginSessionTokenHash, tokenHash),
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

		if (!user.mfaTotpSecret) {
			return c.text(UNAUTHORIZED, 401);
		}

		const isValid = verifyTotpCode(code, user.mfaTotpSecret);

		if (!isValid) {
			return c.text(UNAUTHORIZED, 401);
		}

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
			.delete(mfaTotpLoginSessionsTable)
			.where(eq(mfaTotpLoginSessionsTable.userId, session.userId));

		return c.text(OK, 200);
	},
);

export default route;
