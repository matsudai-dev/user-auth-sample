import build from "@hono/vite-build/cloudflare-workers";
import adapter from "@hono/vite-dev-server/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import { defineConfig } from "vite";

export default defineConfig(() => {
	return {
		plugins: [
			honox({
				devServer: { adapter },
				client: { input: ["./app/client.ts", "./app/style.css"] },
			}),
			tailwindcss(),
			build(),
		],
		ssr: {
			external: ["resend"],
		},
		resolve: {
			alias: {
				"@": `${process.cwd()}/app`,
			},
		},
		server: {
			host: true,
			watch: {
				usePolling: true,
				interval: 1000,
				ignored: ["**/node_modules/**", "**/.git/**"],
			},
		},
	};
});
