import { sValidator } from "@hono/standard-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { BAD_REQUEST, GONE, NOT_FOUND, OK, UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import {
	loginSessionsTable,
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
		otpCode: z.string().regex(/^\d{6}$/),
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
		const { mfaEmailOtpLoginSessionToken, otpCode } = c.req.valid("json");

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

		const otpCodeHash = hashToken(otpCode);

		if (session.otpCodeHash !== otpCodeHash) {
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
			.delete(mfaEmailOtpLoginSessionsTable)
			.where(eq(mfaEmailOtpLoginSessionsTable.userId, session.userId));

		return c.text(OK, 200);
	},
);

export default route;
