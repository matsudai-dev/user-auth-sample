import { sValidator } from "@hono/standard-validator";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import {
	BAD_REQUEST,
	CONFLICT,
	OK,
	PASSWORD_RESET_SESSION_EXPIRATION_MS,
	TOO_MANY_REQUESTS,
	UNAUTHORIZED,
} from "@/consts";
import { getDBClient } from "@/db/client";
import { emailChangeSessionsTable, usersTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import { generateSecureToken, hashToken } from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";
import { getResendClient } from "@/utils/email";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		newEmail: z.email(),
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
		const { newEmail } = c.req.valid("json");

		const userId = c.get("userId");

		if (!userId) {
			return c.text(UNAUTHORIZED, 401);
		}

		const db = getDBClient(c.env.DB);

		const targetUser = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.id, userId))
			.get();

		if (!targetUser) {
			return c.text(UNAUTHORIZED, 401);
		}

		if (targetUser.email === newEmail) {
			return c.text(BAD_REQUEST, 400);
		}

		const conflictingUser = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.email, newEmail))
			.get();

		if (conflictingUser) {
			return c.text(CONFLICT, 409);
		}

		const now = new Date();

		const existingSession = await db
			.select()
			.from(emailChangeSessionsTable)
			.where(
				and(
					eq(emailChangeSessionsTable.userId, userId),
					eq(emailChangeSessionsTable.newEmail, newEmail),
					gt(emailChangeSessionsTable.expireAt, now),
				),
			)
			.get();

		if (existingSession) {
			return c.text(TOO_MANY_REQUESTS, 429);
		}

		const emailChangeToken = generateSecureToken();

		const emailChangeTokenHash = hashToken(emailChangeToken);

		await db.insert(emailChangeSessionsTable).values({
			userId,
			newEmail,
			emailChangeTokenHash,
			expireAt: offsetMilliSeconds(now, PASSWORD_RESET_SESSION_EXPIRATION_MS),
		});

		const url = new URL(c.req.url);
		const emailChangeUrl = `${url.origin}/email-change/complete?token=${emailChangeToken}`;

		const resend = getResendClient(c.env.RESEND_API_KEY);

		await resend.emails.send({
			from: c.env.RESEND_EMAIL_FROM,
			to: newEmail,
			subject: "Confirm your email change",
			html: `
				<p>Click the link below to confirm your email change:</p>
				<p><a href="${emailChangeUrl}">${emailChangeUrl}</a></p>
				<p>This link will expire in 1 hour.</p>
			`,
		});

		return c.text(OK, 200);
	},
);

export default route;
