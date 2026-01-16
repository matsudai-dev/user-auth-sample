import { type Env, Hono } from "hono";

export function createHonoApp(): Hono<Env> {
	return new Hono<Env>();
}
