import { hc } from "hono/client";
import type { ApiRoutes } from "./routes";

export const apiClient = hc<ApiRoutes>("/", {
	init: {
		credentials: "include",
	},
}).api;
