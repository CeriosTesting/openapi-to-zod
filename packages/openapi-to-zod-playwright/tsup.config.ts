import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["src/index.ts"],
		format: ["cjs", "esm"],
		dts: true,
		sourcemap: true,
		clean: true,
		shims: true,
	},
	{
		entry: ["src/cli.ts"],
		format: ["cjs"],
		dts: false,
		sourcemap: true,
		shims: true,
	},
]);
