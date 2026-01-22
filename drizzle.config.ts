import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./app/db/drizzle",
	schema: "./app/db/schemas.ts",
	dialect: "sqlite",
});
