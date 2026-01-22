import { sValidator } from "@hono/standard-validator";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import {
	BAD_REQUEST,
	CONFLICT,
	INTERNAL_SERVER_ERROR,
	OK,
	SIGNUP_SESSION_EXPIRATION_MS,
	TOO_MANY_REQUESTS,
} from "@/consts";
import { getDBClient } from "@/db/client";
import {
	deletedUsersTable,
	signupSessionsTable,
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

		const db = getDBClient(c.env.DB);

		const existingUser = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.email, email))
			.get();

		if (existingUser) {
			return c.text(CONFLICT, 409);
		}

		const deletedUser = await db
			.select()
			.from(deletedUsersTable)
			.where(eq(deletedUsersTable.email, email))
			.get();

		const now = new Date();

		if (deletedUser && deletedUser.reregistrationAllowedAt > now) {
			return c.text(CONFLICT, 409);
		}

		const existingSession = await db
			.select()
			.from(signupSessionsTable)
			.where(
				and(
					eq(signupSessionsTable.email, email),
					gte(signupSessionsTable.expireAt, now),
				),
			)
			.get();

		if (existingSession) {
			return c.text(TOO_MANY_REQUESTS, 429);
		}

		const signupSessionToken = generateSecureToken();

		await db.insert(signupSessionsTable).values({
			id: generateUuidv7(),
			email,
			signupSessionTokenHash: hashToken(signupSessionToken),
			expireAt: offsetMilliSeconds(now, SIGNUP_SESSION_EXPIRATION_MS),
		});

		const url = new URL(c.req.url);
		const signupUrl = `${url.origin}/signup/complete?token=${signupSessionToken}`;

		const resend = getResendClient(c.env.RESEND_API_KEY);

		const result = await resend.emails.send({
			from: c.env.RESEND_EMAIL_FROM,
			to: email,
			subject: "Complete Your Account Registration",
			html: `
				<h1>Welcome!</h1>
				<p>Click the link below to complete your account registration:</p>
				<a href="${signupUrl}">${signupUrl}</a>
				<p>This link will expire in 24 hours.</p>
			`,
		});

		if (result.error) {
			console.log("Resend error details:", result.error);
			return c.text(INTERNAL_SERVER_ERROR, 500);
		}

		return c.text(OK, 200);
	},
);

export default route;
