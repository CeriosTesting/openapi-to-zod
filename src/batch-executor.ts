/** biome-ignore-all lint/suspicious/noConsole: openapi-to-zod CLI uses console for logging */
import { ZodSchemaGenerator } from "./generator";
import type { ExecutionMode, SpecConfig } from "./types";

/**
 * Result of processing a single spec
 */
interface SpecResult {
	spec: SpecConfig;
	success: boolean;
	error?: string;
}

/**
 * Summary of batch execution results
 */
interface BatchExecutionSummary {
	total: number;
	successful: number;
	failed: number;
	results: SpecResult[];
}

/**
 * Process a single spec and return result with error handling
 */
async function processSpec(spec: SpecConfig, index: number, total: number): Promise<SpecResult> {
	const specName = spec.name || spec.input;

	// Live progress to stdout
	console.log(`Processing [${index + 1}/${total}] ${specName}...`);

	try {
		const generator = new ZodSchemaGenerator(spec);
		generator.generate();

		console.log(`✓ Successfully generated ${spec.output}`);

		return {
			spec,
			success: true,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`✗ Failed to generate ${spec.output}: ${errorMessage}`);

		return {
			spec,
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Execute specs in parallel using Promise.allSettled
 * Continues processing all specs even if some fail
 */
async function executeParallel(specs: SpecConfig[]): Promise<SpecResult[]> {
	console.log(`\nExecuting ${specs.length} spec(s) in parallel...\n`);

	const promises = specs.map((spec, index) => processSpec(spec, index, specs.length));

	const results = await Promise.allSettled(promises);

	return results.map((result, index) => {
		if (result.status === "fulfilled") {
			return result.value;
		}

		// Handle unexpected promise rejection (shouldn't happen as processSpec catches errors)
		return {
			spec: specs[index],
			success: false,
			error: result.reason instanceof Error ? result.reason.message : String(result.reason),
		};
	});
}

/**
 * Execute specs sequentially one at a time
 * Continues processing all specs even if some fail
 */
async function executeSequential(specs: SpecConfig[]): Promise<SpecResult[]> {
	console.log(`\nExecuting ${specs.length} spec(s) sequentially...\n`);

	const results: SpecResult[] = [];

	for (let i = 0; i < specs.length; i++) {
		const result = await processSpec(specs[i], i, specs.length);
		results.push(result);
	}

	return results;
}

/**
 * Print final summary of batch execution
 */
function printSummary(summary: BatchExecutionSummary): void {
	console.log(`\n${"=".repeat(50)}`);
	console.log("Batch Execution Summary");
	console.log("=".repeat(50));
	console.log(`Total specs: ${summary.total}`);
	console.log(`Successful: ${summary.successful}`);
	console.log(`Failed: ${summary.failed}`);

	if (summary.failed > 0) {
		console.log("\nFailed specs:");
		for (const result of summary.results) {
			if (!result.success) {
				const specName = result.spec.name || result.spec.input;
				console.error(`  ✗ ${specName}`);
				console.error(`    Error: ${result.error}`);
			}
		}
	}

	console.log(`${"=".repeat(50)}\n`);
}

/**
 * Execute batch processing of multiple OpenAPI specs
 *
 * @param specs - Array of spec configurations to process
 * @param executionMode - Execution mode: "parallel" (default) or "sequential"
 * @returns BatchExecutionSummary with results
 * @throws Never throws - collects all errors and reports them
 */
export async function executeBatch(
	specs: SpecConfig[],
	executionMode: ExecutionMode = "parallel"
): Promise<BatchExecutionSummary> {
	if (specs.length === 0) {
		throw new Error("No specs provided for batch execution");
	}

	// Execute based on mode
	const results = executionMode === "parallel" ? await executeParallel(specs) : await executeSequential(specs);

	// Calculate summary
	const summary: BatchExecutionSummary = {
		total: results.length,
		successful: results.filter(r => r.success).length,
		failed: results.filter(r => !r.success).length,
		results,
	};

	// Print summary
	printSummary(summary);

	return summary;
}

/**
 * Determine exit code based on batch execution results
 * Returns 1 if any spec failed, 0 if all succeeded
 */
export function getBatchExitCode(summary: BatchExecutionSummary): number {
	return summary.failed > 0 ? 1 : 0;
}
