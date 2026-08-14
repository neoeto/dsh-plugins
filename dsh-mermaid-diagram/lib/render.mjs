// render.mjs — renders Mermaid source to SVG using headless Chromium.
//
// Usage: node render.mjs <srcPath> <outPath> <theme> <chromiumPath>
//
// Reads the Mermaid source from <srcPath>, renders it in a headless
// Chromium (the browser owns the DOM layout), writes the resulting SVG to
// <outPath>, and prints a small JSON summary on stdout. Parse errors are
// printed to stderr and exit with status 1.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const [srcPath, outPath, theme = "default", chromiumPath] = process.argv.slice(2);
const source = readFileSync(srcPath, "utf8");

const browser = await puppeteer.launch({
	executablePath: chromiumPath,
	headless: true,
	args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

try {
	const page = await browser.newPage();
	await page.goto("about:blank");
	await page.addScriptTag({ path: join(root, "node_modules", "mermaid", "dist", "mermaid.min.js") });
	const result = await page.evaluate(async (src, th) => {
		globalThis.mermaid.initialize({
			startOnLoad: false,
			theme: th,
			securityLevel: "strict",
			flowchart: { useMaxWidth: true },
			sequence: { useMaxWidth: true },
		});
		try {
			const { svg } = await globalThis.mermaid.render("mmd-diagram", src);
			return { svg, err: null };
		} catch (error) {
			return { svg: null, err: String(error && error.message ? error.message : error) };
		}
	}, source, theme);
	if (result.err !== null) {
		console.error(result.err);
		process.exit(1);
	}
	writeFileSync(outPath, result.svg, "utf8");
	const viewBox = /viewBox="[-\d. ]*?([\d.]+) ([\d.]+)"/.exec(result.svg);
	console.log(JSON.stringify({
		ok: true,
		bytes: Buffer.byteLength(result.svg, "utf8"),
		width: viewBox !== null ? Math.round(parseFloat(viewBox[1])) : 0,
		height: viewBox !== null ? Math.round(parseFloat(viewBox[2])) : 0,
	}));
} finally {
	await browser.close();
}
