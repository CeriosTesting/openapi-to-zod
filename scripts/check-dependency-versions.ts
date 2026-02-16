#!/usr/bin/env tsx

/**
 * Check that shared dependencies have consistent versions across packages
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const PACKAGES_DIR = join(__dirname, "..", "packages");
const SHARED_DEPS = [
	"commander",
	"cosmiconfig",
	"esbuild",
	"minimatch",
	"yaml",
	"@arethetypeswrong/cli",
	"@types/node",
	"tsup",
	"typescript",
	"vitest",
	"zod",
];

interface PackageJson {
	name: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

interface Package {
	name: string;
	json: PackageJson;
}

function getPackageJson(packageName: string): PackageJson {
	const pkgPath = join(PACKAGES_DIR, packageName, "package.json");
	return JSON.parse(readFileSync(pkgPath, "utf-8"));
}

function getVersion(pkg: PackageJson, depName: string): string | undefined {
	return pkg.dependencies?.[depName] || pkg.devDependencies?.[depName] || pkg.peerDependencies?.[depName];
}

function main(): void {
	const packages = readdirSync(PACKAGES_DIR).filter(name => {
		const stat = statSync(join(PACKAGES_DIR, name));
		return stat.isDirectory();
	});

	const pkgs: Package[] = packages.map(name => ({
		name,
		json: getPackageJson(name),
	}));

	let hasErrors = false;

	console.log("🔍 Checking dependency version consistency...\n");

	for (const depName of SHARED_DEPS) {
		const versions = new Map<string, string[]>();

		for (const pkg of pkgs) {
			const version = getVersion(pkg.json, depName);
			if (version) {
				if (!versions.has(version)) {
					versions.set(version, []);
				}
				versions.get(version)?.push(pkg.name);
			}
		}

		if (versions.size > 1) {
			hasErrors = true;
			console.log(`❌ ${depName} has inconsistent versions:`);
			for (const [version, packageNames] of versions.entries()) {
				console.log(`   ${version} in: ${packageNames.join(", ")}`);
			}
			console.log();
		}
	}

	if (!hasErrors) {
		console.log("✅ All shared dependencies have consistent versions!\n");
	} else {
		console.log('💡 Run "npm install" to sync versions after fixing package.json files\n');
		process.exit(1);
	}
}

main();
