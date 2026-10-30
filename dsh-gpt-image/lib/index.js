// Host half of dsh-gpt-image: registers the `gpt_image` model tool, the
// embedded `dsh-gpt-image` skill, a durable settings namespace for the image
// provider preference, and serves generated images at
// /plugins/dsh-gpt-image/img/<id>.<ext>.
//
// Images are persisted on disk under $DSH_HOME/plugins/dsh-gpt-image/images
// (override with GPT_IMAGE_OUTPUT_DIR) so they survive restarts.
//
// Provider selection (highest wins): the tool's `provider` argument → the
// Settings → General → "Image provider" preference (persisted via the settings
// namespace below) → the GPT_IMAGE_PROVIDER environment variable → "openai".
// Each preset carries its own base URL and default model; GPT_IMAGE_BASE_URL /
// GPT_IMAGE_MODEL / GPT_IMAGE_API_KEY override them for any provider.
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const name = "gpt-image";
const inject = ["webServer", "tools", "skills"];

const here = dirname(fileURLToPath(import.meta.url));
const SKILL_BODY = readFileSync(join(here, "skill.md"), "utf8");

const IMG_ROUTE = /^\/plugins\/dsh-gpt-image\/img\/([A-Za-z0-9]+)\.(png|jpe?g|webp)$/;
const MIME_BY_EXT = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const SIZES = ["auto", "1024x1024", "1536x1024", "1024x1536"];
const QUALITIES = ["auto", "low", "medium", "high"];
const FORMATS = ["png", "jpeg", "webp"];
const BACKGROUNDS = ["auto", "transparent", "opaque"];
const FETCH_TIMEOUT_MS = 180000;
const TOOL_TIMEOUT_MS = FETCH_TIMEOUT_MS + 10000;

/** Durable settings namespace owned by this plugin (Settings → General → Image provider). */
const SETTINGS_NS = settingsNamespace("gpt-image");
const SETTINGS_SCHEMA = z.object({ provider: z.string() });

/**
 * Preset providers that natively expose the OpenAI-compatible
 * POST /images/generations endpoint. Selection defaults are documented in the
 * README; users can switch in the GUI (Settings → General) or via GPT_IMAGE_PROVIDER.
 */
const PROVIDER_PRESETS = {
	openai: {
		label: "OpenAI gpt-image-1",
		baseURL: "https://api.openai.com/v1",
		defaultModel: "gpt-image-1",
		apiKeyEnv: "OPENAI_API_KEY",
	},
	volcengine: {
		label: "火山方舟 Seedream (豆包)",
		baseURL: "https://ark.cn-beijing.volces.com/api/v3",
		defaultModel: "doubao-seedream-3-0-t2i-250415",
		apiKeyEnv: "ARK_API_KEY",
	},
	siliconflow: {
		label: "硅基流动 SiliconFlow",
		baseURL: "https://api.siliconflow.cn/v1",
		defaultModel: "black-forest-labs/FLUX.1-schnell",
		apiKeyEnv: "SILICONFLOW_API_KEY",
	},
	zhipu: {
		label: "智谱 GLM (CogView)",
		baseURL: "https://open.bigmodel.cn/api/paas/v4",
		defaultModel: "cogview-4",
		apiKeyEnv: "ZHIPU_API_KEY",
	},
};
const PROVIDER_IDS = Object.keys(PROVIDER_PRESETS);

/** Directory that stores generated images (env override wins). */
function imageRootDir() {
	if (typeof process.env.GPT_IMAGE_OUTPUT_DIR === "string" && process.env.GPT_IMAGE_OUTPUT_DIR.length > 0) {
		return process.env.GPT_IMAGE_OUTPUT_DIR;
	}
	const home = typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.length > 0
		? process.env.DSH_HOME
		: join(homedir(), ".dsh");
	return join(home, "plugins", "dsh-gpt-image", "images");
}

/** Human-readable byte size, e.g. "1.2 MB". */
function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Resolve the active provider for one call: explicit tool argument → persisted
 * settings preference → GPT_IMAGE_PROVIDER env → "openai". Env overrides for
 * base URL / model / API key apply on top of the preset.
 */
async function resolveProvider(ctx, requested) {
	let id;
	if (typeof requested === "string" && Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, requested)) {
		id = requested;
	}
	if (id === undefined) {
		const settings = ctx.get("settings");
		if (settings !== undefined) {
			try {
				const value = await settings.get(SETTINGS_NS);
				if (value !== null && typeof value === "object" && typeof value.provider === "string"
					&& Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, value.provider)) {
					id = value.provider;
				}
			} catch {
				// settings unavailable or namespace not registered yet — fall through
			}
		}
	}
	if (id === undefined && typeof process.env.GPT_IMAGE_PROVIDER === "string"
		&& Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, process.env.GPT_IMAGE_PROVIDER)) {
		id = process.env.GPT_IMAGE_PROVIDER;
	}
	id = id ?? "openai";
	const preset = PROVIDER_PRESETS[id];
	const baseURL = (process.env.GPT_IMAGE_BASE_URL ?? preset.baseURL).replace(/\/+$/, "");
	const model = process.env.GPT_IMAGE_MODEL ?? preset.defaultModel;
	const apiKey = process.env.GPT_IMAGE_API_KEY ?? process.env[preset.apiKeyEnv] ?? "";
	return { id, label: preset.label, baseURL, model, apiKey, keyEnv: preset.apiKeyEnv };
}

export function apply(ctx) {
	const rootDir = imageRootDir();
	mkdirSync(rootDir, { recursive: true });

	// Durable provider preference (Settings → General → Image provider).
	ctx.inject(["settings"], (settingsCtx) => {
		const settingsDisposer = settingsCtx.settings.register(SETTINGS_NS, SETTINGS_SCHEMA);
		ctx.effect(() => settingsDisposer, "gpt-image: settings namespace");
	});

	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/plugins/dsh-gpt-image/img",
		handler: async (req, res) => {
			if (req.method !== "GET" && req.method !== "HEAD") {
				res.writeHead(405);
				res.end();
				return;
			}
			const url = new URL(req.url ?? "/", "http://x");
			const match = IMG_ROUTE.exec(url.pathname);
			if (match === null) {
				res.writeHead(404);
				res.end();
				return;
			}
			const file = join(rootDir, `${match[1]}.${match[2]}`);
			if (!existsSync(file)) {
				res.writeHead(404);
				res.end();
				return;
			}
			const body = readFileSync(file);
			res.writeHead(200, {
				"content-type": `${MIME_BY_EXT[match[2]] ?? "application/octet-stream"}; charset=binary`,
				"content-length": String(body.length),
				// ids are random hex; a served image never changes for a given id.
				"cache-control": "public, max-age=31536000, immutable",
			});
			if (req.method === "HEAD") {
				res.end();
				return;
			}
			res.end(body);
		},
	}), "gpt-image: image route");

	/** Call the OpenAI-compatible Images API and return raw image bytes. */
	async function callImagesApi(provider, body) {
		if (provider.apiKey.length === 0) {
			throw new Error(
				`gpt_image: no API key for provider "${provider.id}" (${provider.label}). ` +
				`Set ${provider.keyEnv} in the environment that launches \`dsh web\` and restart, ` +
				"or set GPT_IMAGE_API_KEY / GPT_IMAGE_BASE_URL for a compatible gateway.",
			);
		}
		const endpoint = `${provider.baseURL}/images/generations`;
		let response;
		try {
			response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${provider.apiKey}`,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
		} catch (error) {
			const detail = error !== null && typeof error === "object" && "name" in error && error.name === "TimeoutError"
				? `request timed out after ${Math.round(FETCH_TIMEOUT_MS / 1000)}s`
				: error instanceof Error ? error.message : String(error);
			throw new Error(`gpt_image: failed to reach ${endpoint}: ${detail}`);
		}
		if (!response.ok) {
			let detail = `HTTP ${response.status}`;
			try {
				const payload = await response.json();
				if (payload !== null && typeof payload === "object" && typeof payload.error?.message === "string") {
					detail = `${payload.error.message} (HTTP ${response.status})`;
				}
			} catch {
				// keep the status-only detail
			}
			throw new Error(`gpt_image: generation failed (provider "${provider.id}") — ${detail}`);
		}
		const json = await response.json();
		const item = Array.isArray(json.data) ? json.data[0] : undefined;
		if (item === undefined) {
			throw new Error("gpt_image: generation returned no image data");
		}
		if (typeof item.b64_json === "string" && item.b64_json.length > 0) {
			return { bytes: Buffer.from(item.b64_json, "base64"), revisedPrompt: item.revised_prompt };
		}
		// Defensive fallback for gateways that return a URL instead of base64.
		if (typeof item.url === "string" && item.url.length > 0) {
			const imageResponse = await fetch(item.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
			if (!imageResponse.ok) {
				throw new Error(`gpt_image: failed to download generated image (HTTP ${imageResponse.status})`);
			}
			return { bytes: new Uint8Array(await imageResponse.arrayBuffer()), revisedPrompt: item.revised_prompt };
		}
		throw new Error("gpt_image: generation returned neither b64_json nor url");
	}

	const disposer = ctx.tools.register({
		name: "gpt_image",
		description:
			"Generate an image through an OpenAI-compatible images API. Use it when the user asks to create, draw, " +
			"or generate an image, picture, illustration, icon, sticker, poster, or logo — including when a " +
			"visual asset would materially help the current work. Write a detailed prompt describing subject, " +
			"scene, style, composition and lighting; for prompt-writing guidance load the \"dsh-gpt-image\" skill. " +
			"The generated image is saved to disk and displayed inline in the conversation UI automatically; " +
			"the call result reports its provider, URL, dimensions, format and size. If the result is unsatisfactory, " +
			"call again with an adjusted prompt.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description: "Complete, detailed description of the image to generate (subject, scene, style, composition, lighting).",
				},
				provider: {
					type: "string",
					description: `Image provider. Omit to use the configured default (Settings → General → Image provider, or the GPT_IMAGE_PROVIDER env). Pass it only when the user asks for a specific provider. Options: ${PROVIDER_IDS.map((id) => `"${id}" (${PROVIDER_PRESETS[id].label})`).join("; ")}.`,
					enum: PROVIDER_IDS,
				},
				size: {
					type: "string",
					description: "Output aspect. \"auto\" (default) lets the model pick; \"1536x1024\" is landscape, \"1024x1536\" is portrait.",
					enum: SIZES,
				},
				quality: {
					type: "string",
					description: "Quality/speed tradeoff. \"auto\" (default), \"low\" for quick drafts, \"high\" for fine detail (slower, pricier).",
					enum: QUALITIES,
				},
				output_format: {
					type: "string",
					description: "Image format. Defaults to \"png\".",
					enum: FORMATS,
				},
				background: {
					type: "string",
					description: "Background handling (gpt-image-1 only). \"transparent\" requires output_format \"png\"; use it for logos, stickers and icons.",
					enum: BACKGROUNDS,
				},
			},
			required: ["prompt"],
			additionalProperties: false,
		},
		output: {
			schema: { type: "object", additionalProperties: true },
			render(_args, value) {
				const meta = `${value.providerLabel} · ${value.size} · ${value.format} · ${formatBytes(value.bytes)}`;
				let text =
					`Generated image · provider "${value.provider}" · ${meta}\n` +
					`IMAGE: ${value.url}\n` +
					"The image is displayed inline in the conversation UI. To change it, call gpt_image again with an updated prompt.";
				if (typeof value.revisedPrompt === "string" && value.revisedPrompt.length > 0) {
					text += `\n(provider refined your prompt to: ${value.revisedPrompt})`;
				}
				return [{ type: "text", text }];
			},
		},
		timeoutMs: TOOL_TIMEOUT_MS,
		async execute(args) {
			const provider = await resolveProvider(ctx, args.provider);
			const size = SIZES.includes(args.size) ? args.size : "auto";
			const quality = QUALITIES.includes(args.quality) ? args.quality : "auto";
			const format = FORMATS.includes(args.output_format) ? args.output_format : "png";
			const background = BACKGROUNDS.includes(args.background) ? args.background : "auto";
			const body = {
				model: provider.model,
				prompt: args.prompt,
				n: 1,
				size,
				quality,
				output_format: format,
				background,
			};
			const { bytes, revisedPrompt } = await callImagesApi(provider, body);
			if (bytes.length === 0) {
				throw new Error("gpt_image: generation returned an empty image");
			}
			const id = randomBytes(8).toString("hex");
			const ext = format === "jpeg" ? "jpg" : format;
			writeFileSync(join(rootDir, `${id}.${ext}`), bytes);
			return {
				id,
				url: `/plugins/dsh-gpt-image/img/${id}.${ext}`,
				provider: provider.id,
				providerLabel: provider.label,
				model: provider.model,
				size,
				format: ext,
				bytes: bytes.length,
				revisedPrompt,
			};
		},
	});
	ctx.effect(() => disposer, "gpt-image: tool registration");

	const skillDisposer = ctx.skills.register({
		name: "dsh-gpt-image",
		description:
			"Generate images through OpenAI-compatible providers from the conversation. Use when the user asks you to " +
			"create, draw, or generate an image, picture, illustration, icon, sticker, poster, or logo — or when a " +
			"visual asset would materially help. It teaches prompt-writing, parameter choices, and provider selection, " +
			"then you call the gpt_image tool.",
		content: SKILL_BODY,
		source: "runtime",
		whenToUse: "User asks to generate, draw, or create any image; or a visual asset would materially help the task.",
	});
	ctx.effect(() => skillDisposer, "gpt-image: skill registration");
}

export { inject, name };
