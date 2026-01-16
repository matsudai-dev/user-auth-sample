import { hc } from "hono/client";
import apiV1Signup from "@/routes/api/v1/signup";
import apiV1SignupComplete from "@/routes/api/v1/signup/complete";
import { createHonoApp } from "@/utils/factory/hono";

export const apiRoutes = createHonoApp()
	.route("/api/v1/signup", apiV1Signup)
	.route("/api/v1/signup/complete", apiV1SignupComplete);

export const api = hc<typeof apiRoutes>("/", {
	init: {
		credentials: "include",
	},
});
