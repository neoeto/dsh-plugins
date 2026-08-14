// Host half of dsh-mermaid-diagram: registers the `mermaid_render` model
// tool and serves rendered SVGs at /plugins/dsh-mermaid-diagram/svg/<id>.
//
// Rendering happens in a headless Chromium (Mermaid owns the DOM layout);
// this module spawns lib/render.mjs per call and keeps the SVG in memory.
// Like the native d2 renderer, rendered SVGs are in-memory only: old ids
// expire (LRU cap) and old cards degrade gracefully in the client half.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const name = "mermaid-diagram";
const inject = ["webServer", "tools"];

const here = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(dirname(here), ".tmp");
const SVG_ROUTE = /^\/plugins\/dsh-mermaid-diagram\/svg\/([A-Za-z0-9]+)$/;
const MAX_STORED = 64;
const RENDER_TIMEOUT_MS = 60000;
const THEMES = ["default", "dark", "neutral", "forest"];

/** Find a usable Chromium executable (env override → playwright cache). */
function findChromium() {
	if (process.env.MERMAID_CHROMIUM_PATH !== undefined && existsSync(process.env.MERMAID_CHROMIUM_PATH)) {
		return process.env.MERMAID_CHROMIUM_PATH;
	}
	const base = join(homedir(), "Library", "Caches", "ms-playwright");
	if (!existsSync(base)) return undefined;
	const dirs = readdirSync(base).filter((d) => d.startsWith("chromium_headless_shell-")).sort();
	for (let i = dirs.length - 1; i >= 0; i -= 1) {
		const candidate = join(base, dirs[i], "chrome-headless-shell-mac-arm64", "chrome-headless-shell");
		if (existsSync(candidate)) return candidate;
	}
	return undefined;
}

export function apply(ctx) {
	const chromiumPath = findChromium();
	const store = new Map(); // id -> svg string

	const storeSvg = (svg) => {
		const id = randomBytes(8).toString("hex");
		store.set(id, svg);
		while (store.size > MAX_STORED) {
			const oldest = store.keys().next().value;
			store.delete(oldest);
		}
		return id;
	};

	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/plugins/dsh-mermaid-diagram/svg",
		handler: async (req, res) => {
			if (req.method !== "GET" && req.method !== "HEAD") {
				res.writeHead(405);
				res.end();
				return;
			}
			const url = new URL(req.url ?? "/", "http://x");
			const match = SVG_ROUTE.exec(url.pathname);
			if (match === null) {
				res.writeHead(404);
				res.end();
				return;
			}
			const svg = store.get(match[1]);
			if (svg === undefined) {
				res.writeHead(404);
				res.end();
				return;
			}
			res.writeHead(200, {
				"content-type": "image/svg+xml; charset=utf-8",
				"cache-control": "no-store",
			});
			res.end(svg);
		},
	}), "mermaid-diagram: svg route");

	const renderMermaid = (source, theme) => new Promise((resolve, reject) => {
		if (chromiumPath === undefined) {
			reject(new Error(
				"mermaid_render: no Chromium executable found. " +
				"Install one (e.g. via playwright) or set MERMAID_CHROMIUM_PATH.",
			));
			return;
		}
		mkdirSync(tmpDir, { recursive: true });
		const token = randomBytes(6).toString("hex");
		const srcPath = join(tmpDir, `source-${token}.mmd`);
		const outPath = join(tmpDir, `out-${token}.svg`);
		writeFileSync(srcPath, source, "utf8");
		const child = spawn(
			process.execPath,
			[join(here, "render.mjs"), srcPath, outPath, theme, chromiumPath],
			{ cwd: dirname(here), stdio: ["ignore", "pipe", "pipe"] },
		);
		let out = "";
		let errOut = "";
		child.stdout.on("data", (chunk) => { out += chunk; });
		child.stderr.on("data", (chunk) => { errOut += chunk; });
		const timer = setTimeout(() => child.kill("SIGKILL"), RENDER_TIMEOUT_MS);
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(new Error(`mermaid_render: failed to start renderer: ${error.message}`));
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code !== 0) {
				const detail = errOut.trim();
				reject(new Error(
					detail.length > 0
						? `Mermaid rendering failed: ${detail}`
						: `Mermaid rendering failed with exit code ${code}`,
				));
				return;
			}
			let svg;
			try {
				svg = readFileSync(outPath, "utf8");
			} catch (error) {
				reject(new Error(`mermaid_render: renderer produced no output: ${errOut.trim()}`));
				return;
			}
			resolve(svg);
		});
	});

	const disposer = ctx.tools.register({
		name: "mermaid_render",
		description: "Render a Mermaid diagram source to an inline SVG in the conversation UI. " +
			"Use it when the user asks for a sequence diagram, flow chart, state machine, class diagram, ER diagram, Gantt chart, or pie chart. " +
			"Write the complete diagram in the \"source\" argument using Mermaid syntax, e.g. sequenceDiagram: participants with ->, -->>, ->> and Note over; flowchart TD with A[Label] -->|text| B{Choice}; stateDiagram-v2 with [*] --> State and State --> [*]. " +
			"\"theme\" controls colors (\"dark\" suits dark UI backgrounds). " +
			"If rendering fails, the error tells you what to fix — correct the source and call mermaid_render again.",
		parameters: {
			type: "object",
			properties: {
				source: {
					type: "string",
					description: "Complete Mermaid diagram source code.",
				},
				theme: {
					type: "string",
					description: "Color theme. Defaults to \"default\"; \"dark\" suits dark UI backgrounds.",
					enum: THEMES,
				},
			},
			required: ["source"],
			additionalProperties: false,
		},
		output: {
			schema: { type: "object", additionalProperties: true },
			render(_args, value) {
				return [{
					type: "text",
					text: `Rendered mermaid diagram to ${value.size} (theme "${value.theme}"). ` +
						"The diagram is displayed inline in the conversation UI. To change it, call mermaid_render again with updated source.\n" +
						`SVG: /plugins/dsh-mermaid-diagram/svg/${value.id}`,
				}];
			},
		},
		timeoutMs: RENDER_TIMEOUT_MS + 10000,
		async execute(args) {
			const theme = THEMES.includes(args.theme) ? args.theme : "default";
			const svg = await renderMermaid(args.source, theme);
			const id = storeSvg(svg);
			const viewBox = /viewBox="[-\d. ]*?([\d.]+) ([\d.]+)"/.exec(svg);
			const size = viewBox !== null
				? `${Math.round(parseFloat(viewBox[1]))}×${Math.round(parseFloat(viewBox[2]))}px`
				: "unknown";
			return { id, size, theme };
		},
	});
	ctx.effect(() => disposer, "mermaid-diagram: tool registration");
}

export { inject, name };
