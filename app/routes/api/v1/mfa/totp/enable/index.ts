import { eq } from "drizzle-orm";
import {
	BAD_REQUEST,
	MFA_TOTP_ENABLE_SESSION_EXPIRATION_MS,
	NOT_FOUND,
	UNAUTHORIZED,
} from "@/consts";
import { getDBClient } from "@/db/client";
import { mfaTotpEnableSessionsTable, usersTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import { generateSecureToken, hashToken } from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";
import { createHonoApp } from "@/utils/factory/hono";
import { generateTotpSecret } from "@/utils/totp";

export const route = createHonoApp().post(
	"/",
	loginRequired,
	injectExternalErrors,
	async (c) => {
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

		if (user.mfaTotpSecret) {
			return c.text(BAD_REQUEST, 400);
		}

		const totpSecret = generateTotpSecret();

		const mfaTotpEnableSessionToken = generateSecureToken();

		const mfaTotpEnableSessionTokenHash = hashToken(mfaTotpEnableSessionToken);

		const now = new Date();

		const expireAt = offsetMilliSeconds(
			now,
			MFA_TOTP_ENABLE_SESSION_EXPIRATION_MS,
		);

		await db.insert(mfaTotpEnableSessionsTable).values({
			userId: user.id,
			mfaTotpEnableSessionTokenHash,
			totpSecret,
			expireAt,
		});

		const issuer = encodeURIComponent(c.env.TOTP_ISSUER);
		const email = encodeURIComponent(user.email);
		const otpauthUri = `otpauth://totp/${issuer}:${email}?secret=${totpSecret}&issuer=${issuer}`;

		return c.json(
			{
				mfaTotpEnableSessionToken,
				otpauthUri,
				totpSecret,
			},
			200,
		);
	},
);

export default route;
