import type { PlaywrightConfigFile } from "@cerios/openapi-to-zod-playwright";

const config: PlaywrightConfigFile = {
	defaults: {
		mode: "strict",
		includeDescriptions: true,
		validateServiceRequest: false,
		showStats: false,
	},
	specs: [
		{
			input: "tests/fixtures/simple.yaml",
			output: "tests/output/simple-from-config.ts",
			outputClient: "tests/output/simple-client.ts",
		},
		{
			input: "tests/fixtures/complex.yaml",
			output: "tests/output/complex-from-config.ts",
			outputClient: "tests/output/complex-client.ts",
			outputService: "tests/output/complex-service.ts",
			mode: "normal",
			prefix: "api",
		},
	],
	executionMode: "parallel",
};

export default config;
