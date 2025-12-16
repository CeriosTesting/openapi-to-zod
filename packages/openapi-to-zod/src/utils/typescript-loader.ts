import type { Loader } from "cosmiconfig";

/**
 * @shared Create a TypeScript loader for cosmiconfig using esbuild
 * @since 1.0.0
 * Utility used by core and playwright packages
 *
 * Creates a loader that transpiles TypeScript config files to JavaScript
 * using esbuild, then executes them to load the configuration.
 *
 * @returns A cosmiconfig Loader function
 */
export function createTypeScriptLoader(): Loader {
	return async (filepath: string) => {
		try {
			// Use esbuild to transpile TypeScript to JavaScript
			const esbuild = await import("esbuild");
			const fs = await import("node:fs");
			const path = await import("node:path");

			const tsCode = fs.readFileSync(filepath, "utf-8");
			const result = await esbuild.build({
				stdin: {
					contents: tsCode,
					loader: "ts",
					resolveDir: path.dirname(filepath),
					sourcefile: filepath,
				},
				format: "cjs",
				platform: "node",
				target: "node18",
				bundle: false,
				write: false,
			});

			const jsCode = result.outputFiles[0].text;

			// Create a module and execute it
			const module = { exports: {} } as any;
			const func = new Function("exports", "module", "require", "__filename", "__dirname", jsCode);
			func(module.exports, module, require, filepath, path.dirname(filepath));

			return module.exports.default || module.exports;
		} catch (error) {
			throw new Error(
				`Failed to load TypeScript config from ${filepath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	};
}
