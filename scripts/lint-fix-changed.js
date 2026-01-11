#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process');

const parseTargets = (input) =>
	input
		.split(/[\s,]+/)
		.map((entry) => entry.trim())
		.filter(Boolean);

const collectChangedFiles = () => {
	const cliTargets = process.argv.slice(2);
	if (cliTargets.length > 0) {
		return cliTargets;
	}

	const envTargets = process.env.LINT_TARGETS;
	if (envTargets) {
		return parseTargets(envTargets);
	}

	const stagedOutput = execSync('git diff --name-only --diff-filter=ACMRTUXB --cached', {
		encoding: 'utf8',
	}).trim();

	if (!stagedOutput) {
		return [];
	}

	return stagedOutput
		.split('\n')
		.map((entry) => entry.trim())
		.filter(Boolean);
};

const runCommand = (command, args) => {
	const result = spawnSync(command, args, { stdio: 'inherit' });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
};

const files = collectChangedFiles().filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
if (files.length === 0) {
	console.log('No files to lint. Pass file paths or stage changes first.');
	process.exit(0);
}

runCommand('npx', ['biome', 'check', '--write', ...files]);
runCommand('npx', ['eslint', '--fix', ...files]);
