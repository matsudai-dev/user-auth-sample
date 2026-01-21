import { eq } from "drizzle-orm";
import { UNAUTHORIZED } from "@/consts";
import { getDBClient } from "@/db/client";
import { usersTable } from "@/db/schemas";
import { injectExternalErrors } from "@/middleware/external-errors";
import { loginRequired } from "@/middleware/login-required";
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

		const db = getDBClient(c.env.DB);

		const user = await db
			.select()
			.from(usersTable)
			.where(eq(usersTable.id, userId))
			.get();

		if (!user) {
			return c.text(UNAUTHORIZED, 401);
		}

		return c.json(
			{
				id: userId,
				email: user.email,
				createdAt: user.createdAt,
				mfaTotpEnabled: !!user.mfaTotpSecret,
				mfaEmailOtpEnabled: user.mfaEmailOtpEnabled,
			},
			200,
		);
	},
);

export default route;
