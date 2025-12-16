import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		internal: "src/internal.ts",
		cli: "src/cli.ts",
	},
	format: ["cjs", "esm"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
	outDir: "dist",
	shims: true,
	external: ["esbuild"],
});
