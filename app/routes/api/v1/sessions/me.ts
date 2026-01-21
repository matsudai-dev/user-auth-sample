import { eq } from "drizzle-orm";
import { UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import { loginSessionsTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
import { getRefreshTokenFromCookie } from "@/utils/auth";
import { hashToken } from "@/utils/crypto/server";
import { createHonoApp } from "@/utils/factory/hono";

export const route = createHonoApp().get(
	"/",
	loginRequired,
	injectExternalErrors,
	async (c) => {
		const userId = c.get("userId");

		if (!userId) {
			return c.text(UNAUTHORIZED, 401);
		}

		const refreshToken = await getRefreshTokenFromCookie(c);

		const refreshTokenHash = refreshToken ? hashToken(refreshToken) : null;

		const db = getDBClient(c.env.DB);

		const rawSessions = await db
			.select()
			.from(loginSessionsTable)
			.where(eq(loginSessionsTable.userId, userId));

		const sessions = rawSessions.map((session) => ({
			id: session.id,
			userAgent: session.userAgent,
			createdAt: session.createdAt,
			lastAccessedAt: session.lastAccessedAt,
			isCurrent: session.refreshTokenHash === refreshTokenHash,
		}));

		return c.json({ sessions }, 200);
	},
);

export default route;
