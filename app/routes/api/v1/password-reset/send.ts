import { sValidator } from "@hono/standard-validator";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import {
	BAD_REQUEST,
	OK,
	PASSWORD_RESET_SESSION_EXPIRATION_MS,
	TOO_MANY_REQUESTS,
} from "@/consts";
import { getDBClient } from "@/db/client";
import {
	passwordResetRateLimitsTable,
	passwordResetSessionsTable,
	usersTable,
} from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import {
	generateSecureToken,
	generateUuidv7,
	hashToken,
} from "@/utils/crypto/server";
import { offsetMilliSeconds } from "@/utils/date";
import { getResendClient } from "@/utils/email";
import { createHonoApp } from "@/utils/factory/hono";

const jsonValidator = sValidator(
	"json",
	z.object({
		email: z.email(),
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
		const { email } = c.req.valid("json");

		const now = new Date();

		const db = getDBClient(c.env.DB);

		const rateLimit = await db
			.select()
			.from(passwordResetRateLimitsTable)
			.where(
				and(
					eq(passwordResetRateLimitsTable.email, email),
					gt(passwordResetRateLimitsTable.expireAt, now),
				),
			)
			.get();

		if (rateLimit) {
			return c.text(TOO_MANY_REQUESTS, 429);
		}

		await db
			.insert(passwordResetRateLimitsTable)
			.values({
				email,
				lastRequestAt: now,
				expireAt: offsetMilliSeconds(now, PASSWORD_RESET_SESSION_EXPIRATION_MS),
			})
			.onConflictDoUpdate({
				target: passwordResetRateLimitsTable.email,
				set: {
					lastRequestAt: now,
					expireAt: offsetMilliSeconds(
						now,
						PASSWORD_RESET_SESSION_EXPIRATION_MS,
					),
				},
			});

		const user = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.email, email))
			.get();

		if (!user) {
			return c.text(OK, 200);
		}

		await db
			.delete(passwordResetSessionsTable)
			.where(eq(passwordResetSessionsTable.userId, user.id));

		const passwordResetToken = generateSecureToken();

		const passwordResetTokenHash = hashToken(passwordResetToken);

		await db.insert(passwordResetSessionsTable).values({
			id: generateUuidv7(),
			userId: user.id,
			passwordResetTokenHash,
			createdAt: now,
			expireAt: offsetMilliSeconds(now, PASSWORD_RESET_SESSION_EXPIRATION_MS),
		});

		const url = new URL(c.req.url);
		const passwordResetUrl = `${url.origin}/password-reset/complete?token=${passwordResetToken}`;

		const resend = getResendClient(c.env.RESEND_API_KEY);

		await resend.emails.send({
			from: c.env.RESEND_EMAIL_FROM,
			to: email,
			subject: "Password Reset Request",
			html: `
				<p>Click the link below to reset your password:</p>
				<p><a href="${passwordResetUrl}">${passwordResetUrl}</a></p>
				<p>This link will expire in 1 hour.</p>
			`,
		});

		return c.text(OK, 200);
	},
);

export default route;
