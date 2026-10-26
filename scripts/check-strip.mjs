// ClawBridge fork check: the strip-down stays stripped.
// 1. Paths and dependencies the fork removed must not come back (an upstream rebase can restore them).
// 2. The removed provider IDs and API names must not appear in the built packages, so a rebase that
//    restores a catalogue, a catalogue entry for a removed API, or a provider branch fails even when no
//    removed path comes back.
// 3. Every http(s) host named in the built packages (.js, .mjs, .cjs and .json, so provider data
//    counts) must be in scripts/outbound-hosts.txt: a new endpoint shows up in review.
// 4. The package copies of LICENSE and NOTICE.md match the root files.
// Run after `npm run build`. `--write-hosts` regenerates the allow-list; commit it only as a reviewed diff.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const REMOVED_PATHS = [
	"packages/chord", "packages/client", "packages/codemode", "packages/coding-agent", "packages/durable",
	"packages/env", "packages/evals", "packages/mcp", "packages/protocol", "packages/server", "packages/telemetry",
	"packages/tui", "packages/agent/src/proxy.ts", "packages/ai/src/cli.ts", "packages/ai/src/oauth.ts",
	"packages/ai/src/bun-oauth.ts", "packages/ai/src/auth/oauth", "packages/ai/src/utils/oauth-page.ts",
	"packages/ai/src/providers/github-copilot.ts", "packages/ai/src/providers/openai-codex.ts",
	"packages/ai/src/providers/radius.ts", "packages/ai/src/providers/radius-config.ts",
	"packages/ai/src/providers/github-copilot.models.ts", "packages/ai/src/providers/openai-codex.models.ts",
	"packages/ai/src/providers/radius.models.ts", "packages/ai/src/providers/data/github-copilot.json",
	"packages/ai/src/providers/data/openai-codex.json", "packages/ai/src/providers/data/radius.json",
	"packages/ai/src/api/github-copilot-headers.ts", "packages/ai/src/api/pi-messages.ts",
	"packages/ai/src/api/openai-codex-responses.ts", "packages/ai/src/api/openrouter-images.ts",
	"packages/ai/src/providers/images", "packages/ai/scripts/generate-models.ts",
	"packages/ai/src/providers/typesafe.ts", "packages/ai/src/providers/typesafe.models.ts",
	"packages/ai/src/providers/data/typesafe.json", "packages/ai/src/api/typesafe-system-one.ts",
	"packages/ai/src/api/cloudflare-workers-ai-system-one.ts", "packages/ai/src/api/system-one-shared.ts",
	"packages/ai/src/api/classifier-shared.ts", "packages/ai/src/api/llama-cpp-classify.ts",
	"packages/ai/src/api/openai-decisions.ts",
];
export const REMOVED_PROVIDER_IDS = ["github-copilot", "openai-codex", "radius", "typesafe"];
export const REMOVED_APIS = [
	"pi-messages", "openai-codex-responses", "typesafe-system-one", "cloudflare-workers-ai-system-one",
	"llama-cpp-classify", "openai-decisions",
];
const PACKAGES = ["ai", "agent"];
const SCANNED = /\.(js|mjs|cjs|json)$/;

function* builtFiles(dir) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) yield* builtFiles(p);
		else if (SCANNED.test(name)) yield p;
	}
}

/** Returns { errors, hosts } for a repo root. */
export function checkStrip(root) {
	const errors = [];
	for (const p of REMOVED_PATHS) if (existsSync(join(root, p))) errors.push(`removed path is back: ${p}`);
	for (const pkg of PACKAGES) {
		const manifest = join(root, "packages", pkg, "package.json");
		const deps = existsSync(manifest) ? (JSON.parse(readFileSync(manifest, "utf8")).dependencies ?? {}) : {};
		for (const name of Object.keys(deps)) {
			if (/telemetry|pi-coding-agent|pi-tui|pi-mcp/.test(name)) errors.push(`${pkg} depends on ${name}`);
		}
		for (const f of ["LICENSE", "NOTICE.md"]) {
			const copy = join(root, "packages", pkg, f);
			if (!existsSync(copy) || readFileSync(copy, "utf8") !== readFileSync(join(root, f), "utf8")) {
				errors.push(`packages/${pkg}/${f} must be an exact copy of the root ${f}`);
			}
		}
	}
	const idPattern = new RegExp(`["'\`](${REMOVED_PROVIDER_IDS.join("|")})["'\`]`, "g");
	const apiPattern = new RegExp(`["'\`](${REMOVED_APIS.join("|")})["'\`]`, "g");
	const hosts = new Set();
	for (const pkg of PACKAGES) {
		const dist = join(root, "packages", pkg, "dist");
		if (!existsSync(dist)) {
			errors.push(`packages/${pkg}/dist is missing: run npm run build first`);
			continue;
		}
		for (const f of builtFiles(dist)) {
			const text = readFileSync(f, "utf8");
			for (const m of text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) hosts.add(m[1].toLowerCase());
			const ids = new Set(Array.from(text.matchAll(idPattern), (m) => m[1]));
			for (const id of ids) errors.push(`removed provider id "${id}" in ${f.slice(root.length + 1)}`);
			const apis = new Set(Array.from(text.matchAll(apiPattern), (m) => m[1]));
			for (const api of apis) errors.push(`removed api "${api}" in ${f.slice(root.length + 1)}`);
		}
	}
	const listPath = join(root, "scripts", "outbound-hosts.txt");
	const allowed = existsSync(listPath)
		? new Set(readFileSync(listPath, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")))
		: new Set();
	for (const h of [...hosts].sort()) {
		if (!allowed.has(h)) errors.push(`new host in built code: ${h} (add it to scripts/outbound-hosts.txt only after review)`);
	}
	return { errors, hosts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
	const { errors, hosts } = checkStrip(root);
	if (process.argv.includes("--write-hosts")) {
		const header =
			"# Hosts named anywhere in the built ai and agent packages (.js, .mjs, .cjs, .json): provider API endpoints,\n" +
			"# and docs links in comments and messages. A review aid, not the network boundary (that is the agent's egress proxy).\n";
		writeFileSync(join(root, "scripts", "outbound-hosts.txt"), `${header}${[...hosts].sort().join("\n")}\n`);
		console.log(`wrote ${hosts.size} hosts to scripts/outbound-hosts.txt`);
	} else if (errors.length) {
		console.error(errors.join("\n"));
		process.exit(1);
	} else {
		console.log(
			`strip check passed: ${REMOVED_PATHS.length} removed paths absent, ${REMOVED_PROVIDER_IDS.length} removed provider ids and ${REMOVED_APIS.length} removed apis absent, ${hosts.size} hosts all allow-listed`,
		);
	}
}
