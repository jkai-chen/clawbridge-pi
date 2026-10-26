// ClawBridge fork check: every registry package in package-lock.json was published
// at least MIN_DAYS before now (the pinning rule; .npmrc min-release-age covers new resolutions).
import { readFileSync } from "node:fs";

const MIN_DAYS = Number(process.env.MIN_RELEASE_AGE_DAYS ?? 14);
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const wanted = new Map();
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
	if (!path.includes("node_modules/") || entry.link || !entry.resolved?.startsWith("https://registry.npmjs.org/")) continue;
	const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
	wanted.set(`${name}@${entry.version}`, { name, version: entry.version });
}
const cutoff = Date.now() - MIN_DAYS * 86_400_000;
const errors = [];
const queue = [...wanted.values()];
async function worker() {
	for (let item = queue.shift(); item; item = queue.shift()) {
		const res = await fetch(`https://registry.npmjs.org/${item.name.replace("/", "%2f")}`, { headers: { accept: "application/json" } });
		if (!res.ok) { errors.push(`${item.name}@${item.version}: registry ${res.status}`); continue; }
		const published = (await res.json()).time?.[item.version];
		if (!published) errors.push(`${item.name}@${item.version}: no publish time`);
		else if (Date.parse(published) > cutoff) errors.push(`${item.name}@${item.version}: published ${published}, younger than ${MIN_DAYS} days`);
	}
}
await Promise.all(Array.from({ length: 8 }, worker));
if (errors.length) { console.error(errors.sort().join("\n")); process.exit(1); }
console.log(`lock age check passed: ${wanted.size} packages, all at least ${MIN_DAYS} days old`);
