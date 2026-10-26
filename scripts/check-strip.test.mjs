// Self-test for check-strip.mjs: a clean fixture passes, and each planted regression fails.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { checkStrip } from "./check-strip.mjs";

const roots = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "check-strip-"));
	roots.push(root);
	mkdirSync(join(root, "scripts"));
	writeFileSync(join(root, "scripts", "outbound-hosts.txt"), "# allow-list\napi.example.com\n");
	for (const pkg of ["ai", "agent"]) {
		const dir = join(root, "packages", pkg);
		mkdirSync(join(dir, "dist", "providers", "data"), { recursive: true });
		writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { typebox: "1.0.0" } }));
		writeFileSync(join(dir, "dist", "index.js"), 'export const url = "https://api.example.com/v1";\n');
	}
	return root;
}

test("a clean fixture passes", () => {
	assert.deepEqual(checkStrip(fixture()).errors, []);
});

test("a new host in a JSON data file fails", () => {
	const root = fixture();
	writeFileSync(join(root, "packages/ai/dist/providers/data/new.json"), '{"baseUrl":"https://new.example.net/v1"}');
	assert.match(checkStrip(root).errors.join("\n"), /new host in built code: new\.example\.net/);
});

test("a new host in .mjs and .cjs files fails", () => {
	const root = fixture();
	writeFileSync(join(root, "packages/agent/dist/a.mjs"), 'fetch("https://one.example.org")');
	writeFileSync(join(root, "packages/agent/dist/b.cjs"), 'fetch("https://two.example.org")');
	const errors = checkStrip(root).errors.join("\n");
	assert.match(errors, /one\.example\.org/);
	assert.match(errors, /two\.example\.org/);
});

test("a removed provider id in built code or data fails", () => {
	const root = fixture();
	writeFileSync(join(root, "packages/ai/dist/providers/data/x.json"), '{"provider":"github-copilot"}');
	writeFileSync(join(root, "packages/ai/dist/x.js"), "if (p === 'openai-codex') {}");
	const errors = checkStrip(root).errors.join("\n");
	assert.match(errors, /removed provider id "github-copilot"/);
	assert.match(errors, /removed provider id "openai-codex"/);
});

test("a catalogue entry for a removed api fails", () => {
	const root = fixture();
	writeFileSync(
		join(root, "packages/ai/dist/providers/data/gw.json"),
		'{"typesafe-system-one":{"classifier:jev":{"api":"typesafe-system-one","provider":"gw"}}}',
	);
	assert.match(checkStrip(root).errors.join("\n"), /removed api "typesafe-system-one"/);
});

test("a restored removed path fails", () => {
	const root = fixture();
	mkdirSync(join(root, "packages/telemetry"));
	assert.match(checkStrip(root).errors.join("\n"), /removed path is back: packages\/telemetry/);
});

test("a telemetry dependency fails", () => {
	const root = fixture();
	writeFileSync(
		join(root, "packages/ai/package.json"),
		JSON.stringify({ dependencies: { "@earendil-works/pi-telemetry": "1.1.0" } }),
	);
	assert.match(checkStrip(root).errors.join("\n"), /ai depends on @earendil-works\/pi-telemetry/);
});
