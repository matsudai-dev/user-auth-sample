import type { D1Database } from "@cloudflare/workers-types";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schemas from "@/db/schemas";

export type DBClient = DrizzleD1Database<typeof schemas>;

const clientCache = new WeakMap<D1Database, DBClient>();

export function getDBClient(d1: D1Database): DBClient {
	const cachedClient = clientCache.get(d1);

	if (cachedClient) {
		return cachedClient;
	}

	const client = drizzle(d1, { schema: schemas });

	clientCache.set(d1, client);

	return client;
}
