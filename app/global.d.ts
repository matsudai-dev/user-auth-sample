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
		} & NodeJS.ProcessEnv;
	}
}
