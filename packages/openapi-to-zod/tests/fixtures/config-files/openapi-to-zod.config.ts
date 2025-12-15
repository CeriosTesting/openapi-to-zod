// TypeScript config for testing
// Note: In real projects, you would import from '@cerios/openapi-to-zod'
// For testing, we define the config inline without importing defineConfig

export default {
	defaults: {
		mode: "strict",
		includeDescriptions: true,
		showStats: false,
	},
	specs: [
		{
			name: "simple-api",
			input: "tests/fixtures/simple.yaml",
			output: "tests/output/simple-from-ts-config.ts",
		},
		{
			name: "complex-api",
			input: "tests/fixtures/complex.yaml",
			output: "tests/output/complex-from-ts-config.ts",
			mode: "normal",
			prefix: "api",
		},
	],
	executionMode: "parallel",
};
