import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["src/index.ts"],
		format: ["cjs", "esm"],
		dts: true,
		sourcemap: true,
		clean: true,
		shims: true,
		external: ["esbuild"],
	},
	{
		entry: ["src/cli.ts"],
		format: ["cjs"],
		dts: false,
		sourcemap: true,
		shims: true,
		external: ["esbuild"],
	},
	{
		// Separate runtime entry point for k6 (no Node.js dependencies)
		entry: { runtime: "src/runtime/index.ts" },
		format: ["cjs", "esm"],
		dts: true,
		sourcemap: true,
		shims: false,
		external: ["k6", "k6/http"],
	},
]);
