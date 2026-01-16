import type {} from "hono";

declare module "process" {
	global {
		namespace NodeJS {
			interface ProcessEnv {
				NODE_ENV?: string;
			}
		}
	}
}

declare module "hono" {
	interface Env {
		Variables: {
			userId?: string;
		};
		Bindings: {
			DB: D1Database;
			RESEND_API_KEY: string;
			RESEND_EMAIL_FROM: string;
			ACCESS_TOKEN_SECRET_KEY: string;
			REFRESH_TOKEN_SECRET_KEY: string;
		} & NodeJS.ProcessEnv;
	}
}
