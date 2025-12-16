import { ConfigurationError } from "./errors";
import type { ExecutionMode } from "./types";

/**
 * @shared Generator interface for batch execution
 * @since 1.0.0
 * Interface that both OpenApiGenerator and OpenApiPlaywrightGenerator must implement
 */
export interface Generator {
	generate(): void;
}

/**
 * Result of processing a single spec
 */
interface SpecResult<T> {
	spec: T;
	success: boolean;
	error?: string;
}

/**
 * Summary of batch execution results
 */
interface BatchExecutionSummary<T> {
	total: number;
	successful: number;
	failed: number;
	results: SpecResult<T>[];
}

/**
 * Process a single spec and return result with error handling
 */
async function processSpec<T>(
	spec: T,
	index: number,
	total: number,
	createGenerator: (spec: T) => Generator
): Promise<SpecResult<T>> {
	// Live progress to stdout
	const specInput = (spec as any).input || "spec";
	const specOutput = (spec as any).output || "output";
	console.log(`Processing [${index + 1}/${total}] ${specInput}...`);

	try {
		const generator = createGenerator(spec);
		generator.generate();

		return {
			spec,
			success: true,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`✗ Failed to generate ${specOutput}: ${errorMessage}`);

		return {
			spec,
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Execute specs in parallel using Promise.allSettled with configurable batch size
 * Processes specifications in batches to control memory usage and concurrency
 * Continues processing all specs even if some fail
 */
async function executeParallel<T>(
	specs: T[],
	createGenerator: (spec: T) => Generator,
	batchSize: number
): Promise<SpecResult<T>[]> {
	console.log(`\nExecuting ${specs.length} specification(s) in parallel (batch size: ${batchSize})...\n`);

	const results: SpecResult<T>[] = [];

	// Process in batches to control memory usage
	for (let i = 0; i < specs.length; i += batchSize) {
		const batch = specs.slice(i, Math.min(i + batchSize, specs.length));
		const batchPromises = batch.map((spec, batchIndex) =>
			processSpec(spec, i + batchIndex, specs.length, createGenerator)
		);

		const batchResults = await Promise.allSettled(batchPromises);

		// Convert settled results to SpecResult
		for (let j = 0; j < batchResults.length; j++) {
			const result = batchResults[j];
			if (result.status === "fulfilled") {
				results.push(result.value);
			} else {
				// Handle unexpected promise rejection
				results.push({
					spec: batch[j],
					success: false,
					error: result.reason instanceof Error ? result.reason.message : String(result.reason),
				});
			}
		}
	}

	return results;
}

/**
 * Execute specs sequentially one at a time
 * Continues processing all specs even if some fail
 */
async function executeSequential<T>(specs: T[], createGenerator: (spec: T) => Generator): Promise<SpecResult<T>[]> {
	console.log(`\nExecuting ${specs.length} spec(s) sequentially...\n`);

	const results: SpecResult<T>[] = [];

	for (let i = 0; i < specs.length; i++) {
		const result = await processSpec(specs[i], i, specs.length, createGenerator);
		results.push(result);
	}

	return results;
}

/**
 * Print final summary of batch execution
 */
function printSummary<T>(summary: BatchExecutionSummary<T>): void {
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
				const specInput = (result.spec as any).input || "spec";
				console.error(`  ✗ ${specInput}`);
				console.error(`    Error: ${result.error}`);
			}
		}
	}

	console.log(`${"=".repeat(50)}\n`);
}

/**
 * @shared Execute batch processing of multiple specs with custom generator
 * @since 1.0.0
 * Utility used by core and playwright packages
 *
 * @param specs - Array of spec configurations to process
 * @param executionMode - Execution mode: "parallel" (default) or "sequential"
 * @param createGenerator - Factory function to create generator from spec
 * @param batchSize - Number of specifications to process concurrently in parallel mode
 * @returns BatchExecutionSummary with results
 * @throws Never throws - collects all errors and reports them
 */
export async function executeBatch<T>(
	specs: T[],
	executionMode: ExecutionMode = "parallel",
	createGenerator: (spec: T) => Generator,
	batchSize: number
): Promise<BatchExecutionSummary<T>> {
	if (specs.length === 0) {
		throw new ConfigurationError("No specs provided for batch execution", { specsCount: 0, executionMode });
	}

	let results: SpecResult<T>[] = [];

	try {
		// Execute based on mode
		results =
			executionMode === "parallel"
				? await executeParallel(specs, createGenerator, batchSize)
				: await executeSequential(specs, createGenerator);

		// Calculate summary
		const summary: BatchExecutionSummary<T> = {
			total: results.length,
			successful: results.filter(r => r.success).length,
			failed: results.filter(r => !r.success).length,
			results,
		};

		// Print summary
		printSummary(summary);

		return summary;
	} finally {
		// Memory leak prevention: Clear large result objects and hint GC for large batches
		if (results.length > batchSize) {
			// Clear spec references to allow GC
			for (const result of results) {
				// Keep only essential info, clear large objects
				if (result.spec) {
					(result.spec as any) = null;
				}
			}

			// Hint to V8 garbage collector for large batches (if available)
			if (global.gc) {
				global.gc();
			}
		}
	}
}

/**
 * Determine exit code based on batch execution results
 * Returns 1 if any spec failed, 0 if all succeeded
 */
export function getBatchExitCode<T>(summary: BatchExecutionSummary<T>): number {
	return summary.failed > 0 ? 1 : 0;
}
