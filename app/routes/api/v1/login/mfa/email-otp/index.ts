import { sValidator } from "@hono/standard-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
	BAD_REQUEST,
	GONE,
	MFA_LOGIN_SESSION_EXPIRATION_MS,
	NOT_FOUND,
	OK,
	UNAUTHORIZED,
} from "@/consts";
import { getDBClient } from "@/db/client";
import { mfaEmailOtpLoginSessionsTable, usersTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { generateOtpCode, hashToken } from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";
import { getResendClient } from "@/utils/email";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		mfaEmailOtpLoginSessionToken: z.string().min(1),
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
		const { mfaEmailOtpLoginSessionToken } = c.req.valid("json");

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

		const otpCode = generateOtpCode();

		await db
			.update(mfaEmailOtpLoginSessionsTable)
			.set({
				otpCodeHash: hashToken(otpCode),
				expireAt: offsetMilliSeconds(now, MFA_LOGIN_SESSION_EXPIRATION_MS),
			})
			.where(eq(mfaEmailOtpLoginSessionsTable.userId, session.userId));

		const resend = getResendClient(c.env.RESEND_API_KEY);

		await resend.emails.send({
			from: c.env.RESEND_EMAIL_FROM,
			to: user.email,
			subject: "Email OTP Code",
			text: `Your email OTP code is: ${otpCode}\n\nThis code will expire in 5 minutes.`,
		});

		return c.text(OK, 200);
	},
);

export default route;
