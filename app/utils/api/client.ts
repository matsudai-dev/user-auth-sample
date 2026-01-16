import { hc } from "hono/client";
import apiV1Signup from "@/routes/api/v1/signup";
import { createHonoApp } from "@/utils/factory/hono";

export const apiRoutes = createHonoApp().route("/api/v1/signup", apiV1Signup);

export const api = hc<typeof apiRoutes>("/", {
	init: {
		credentials: "include",
	},
});
