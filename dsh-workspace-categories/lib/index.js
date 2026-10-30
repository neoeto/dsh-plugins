// Host half of dsh-workspace-categories.
//
// The category tree is user data, not a view preference: it is shared by every
// browser that points at this Host and must survive clearing browser storage,
// so it lives in a JSON file next to the profile's plugin data and is served
// to the client half over one same-origin route:
//
//   GET  /plugins/dsh-workspace-categories/api  -> { version, categories, assignments }
//   POST /plugins/dsh-workspace-categories/api  -> same shape, written atomically
//
// `categories` is an ordered array of { id, name, parentId }; sibling order is
// array order and `parentId: null` marks a root category. `assignments` maps a
// Workspace id to a category id. Dangling parents, cycles and assignments to
// unknown categories are repaired on write, so a hand-edited file still loads.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PACKAGE = "dsh-workspace-categories";
const ROUTE = `/plugins/${PACKAGE}/api`;
/** On-disk folder for the tree; a plain name so it survives a package rename. */
const DATA_DIR = "workspace-categories";
const STATE_VERSION = 1;
const MAX_CATEGORIES = 500;
const MAX_NAME_LENGTH = 80;
const MAX_BODY_BYTES = 256 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const inject = ["webServer"];

/** Directory that stores the category tree (env override wins, as in other local plugins). */
function dataRootDir() {
	if (typeof process.env.DSH_WORKSPACE_CATEGORIES_DIR === "string" && process.env.DSH_WORKSPACE_CATEGORIES_DIR.length > 0) {
		return process.env.DSH_WORKSPACE_CATEGORIES_DIR;
	}
	const home = typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.length > 0
		? process.env.DSH_HOME
		: join(homedir(), ".dsh");
	return join(home, "plugins", DATA_DIR);
}

/** Keep only well-formed categories, then break dangling parents and cycles. */
function sanitizeCategories(raw) {
	const categories = [];
	const seen = new Set();
	for (const item of Array.isArray(raw) ? raw.slice(0, MAX_CATEGORIES) : []) {
		if (item === null || typeof item !== "object") continue;
		const id = typeof item.id === "string" ? item.id : "";
		if (!ID_PATTERN.test(id) || seen.has(id)) continue;
		const name = typeof item.name === "string" ? item.name.trim().slice(0, MAX_NAME_LENGTH) : "";
		if (name.length === 0) continue;
		const parentId = typeof item.parentId === "string" && ID_PATTERN.test(item.parentId) ? item.parentId : null;
		seen.add(id);
		categories.push({ id, name, parentId });
	}
	const byId = new Map(categories.map((category) => [category.id, category]));
	for (const category of categories) {
		let parentId = category.parentId;
		if (parentId !== null && !byId.has(parentId)) {
			category.parentId = null;
			continue;
		}
		// A cycle would make the client's tree walk unbounded; cut it at the
		// first ancestor that closes the loop.
		const walked = new Set([category.id]);
		let cursor = parentId;
		while (cursor !== null) {
			if (walked.has(cursor)) {
				category.parentId = null;
				break;
			}
			walked.add(cursor);
			cursor = byId.get(cursor)?.parentId ?? null;
		}
	}
	return categories;
}

/** Keep only assignments that point at a category that exists. */
function sanitizeAssignments(raw, categories) {
	const assignments = {};
	const known = new Set(categories.map((category) => category.id));
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return assignments;
	for (const [workspaceId, categoryId] of Object.entries(raw)) {
		if (typeof workspaceId !== "string" || workspaceId.length === 0 || workspaceId.length > 256) continue;
		if (typeof categoryId !== "string" || !known.has(categoryId)) continue;
		assignments[workspaceId] = categoryId;
	}
	return assignments;
}

/** Validate one posted or persisted document into the served shape. */
function sanitizeState(raw) {
	const categories = sanitizeCategories(raw?.categories);
	return {
		version: STATE_VERSION,
		categories,
		assignments: sanitizeAssignments(raw?.assignments, categories),
	};
}

export function apply(ctx) {
	const rootDir = dataRootDir();
	const file = join(rootDir, "categories.json");
	const empty = { version: STATE_VERSION, categories: [], assignments: {} };

	const readState = () => {
		if (!existsSync(file)) return empty;
		try {
			return sanitizeState(JSON.parse(readFileSync(file, "utf8")));
		} catch (error) {
			// A corrupt file must not take the sidebar down; report and serve an
			// empty tree so the user can rebuild it.
			console.error(`[${PACKAGE}] could not read ${file}:`, error);
			return empty;
		}
	};

	const writeState = (state) => {
		mkdirSync(rootDir, { recursive: true });
		const temporary = `${file}.${process.pid}.tmp`;
		writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
		renameSync(temporary, file);
	};

	const readBody = (req) => new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				reject(new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});

	const json = (res, status, body, method = "GET") => {
		const payload = JSON.stringify(body);
		res.writeHead(status, {
			"content-type": "application/json; charset=utf-8",
			"content-length": String(Buffer.byteLength(payload)),
			"cache-control": "no-store",
		});
		// A HEAD response carries the headers only.
		res.end(method === "HEAD" ? void 0 : payload);
	};

	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: ROUTE,
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://x");
			if (url.pathname !== ROUTE) {
				res.writeHead(404);
				res.end();
				return;
			}
			try {
				if (req.method === "GET" || req.method === "HEAD") {
					json(res, 200, readState(), req.method);
					return;
				}
				if (req.method !== "POST") {
					res.writeHead(405, { allow: "GET, HEAD, POST" });
					res.end();
					return;
				}
				const text = await readBody(req);
				let parsed;
				try {
					parsed = JSON.parse(text);
				} catch {
					json(res, 400, { error: "invalid-json" });
					return;
				}
				const state = sanitizeState(parsed);
				writeState(state);
				json(res, 200, { ok: true, ...state });
			} catch (error) {
				console.error(`[${PACKAGE}] route failure:`, error);
				if (!res.headersSent) json(res, 500, { error: "store-failure", message: String(error?.message ?? error) });
				else res.end();
			}
		},
	}), `${PACKAGE}: category store route`);

	console.log(`[${PACKAGE}] category tree: ${file}`);
}

export { inject, PACKAGE as name };
