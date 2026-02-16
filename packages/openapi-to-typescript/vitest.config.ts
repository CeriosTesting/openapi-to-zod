import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@cerios/openapi-core": path.resolve(__dirname, "../openapi-core/src"),
			"@fixtures": path.resolve(__dirname, "../../fixtures"),
		},
	},
	test: {
		globals: false,
		environment: "node",
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
		},
		testTimeout: 30000,
	},
});
