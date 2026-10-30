window.__ModuleLoader__.load({
	id: "dsh-gpt-image",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		// Optional dependency: if the runtime store helper is not in this profile's
		// module table, the settings row is skipped but the image card still works.
		let defineStore = null;
		try {
			defineStore = require("@deepseek-ai/dsh-client-runtime/client").defineStore;
		} catch (_missingStoreHelper) {
			defineStore = null;
		}

		// Provider options must stay in sync with the host's PROVIDER_PRESETS.
		const PROVIDER_OPTIONS = [
			{ id: "openai", label: "OpenAI gpt-image-1" },
			{ id: "volcengine", label: "火山方舟 Seedream (豆包)" },
			{ id: "siliconflow", label: "硅基流动 SiliconFlow" },
			{ id: "zhipu", label: "智谱 GLM (CogView)" }
		];
		const providerLabelOf = (id) => {
			for (const option of PROVIDER_OPTIONS) if (option.id === id) return option.label;
			return id;
		};

		// ── plugin-owned styles (claimed per the client-modules convention) ──
		const STYLE_ID = "dsh-gpt-image/styles.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-gpt-image";
			tag.dataset.pluginCss = STYLE_ID;
			tag.textContent = [
				".gpi-card{display:flex;flex-direction:column;gap:8px;padding:8px 4px 4px 4px;min-width:0}",
				".gpi-meta{display:flex;align-items:baseline;gap:8px;color:var(--dsw-alias-label-caption);font-size:12px;line-height:16px;flex-wrap:wrap}",
				".gpi-stage{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);min-width:0}",
				".gpi-stage img{display:block;max-width:100%;height:auto;max-height:560px;object-fit:contain;border-radius:11px;-webkit-user-drag:none}",
				".gpi-actions{display:flex;gap:8px;flex-wrap:wrap}",
				".gpi-btn{all:unset;cursor:pointer;font:inherit;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:3px 10px;display:inline-flex;align-items:center;gap:4px}",
				".gpi-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}",
				".gpi-btn:disabled{opacity:.45;cursor:default}",
				".gpi-error{color:var(--dsw-alias-state-error-primary);font-size:12px;white-space:pre-wrap;word-break:break-word}",
				".gpi-fallback{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:32px 24px;text-align:center;min-height:120px}",
				".gpi-fallback-title{font-size:13px;color:var(--dsw-alias-label-secondary)}",
				".gpi-fallback-hint{font-size:12px;color:var(--dsw-alias-label-caption)}",
				".gpi-running{color:var(--dsw-alias-label-caption);font-size:12px;padding:8px 4px}",
				".gpi-prompt{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);border-radius:12px;padding:12px 16px;max-height:160px;overflow:auto;margin:0;white-space:pre-wrap;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary)}",
				".gpi-setting-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%}",
				".gpi-setting-title{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}",
				".gpi-setting-select{font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:4px 8px;min-width:200px}"
			].join("\n");
			document.head.appendChild(tag);
		}

		// ── result parsing ──
		const IMAGE_PATH_PATTERN = /IMAGE:\s*(\/plugins\/dsh-gpt-image\/img\/[A-Za-z0-9]+\.(?:png|jpe?g|webp))/;
		// Rendered meta: Generated image · provider "id" · <label> · <size> · <format> · <bytes>
		const SUMMARY_PATTERN = /Generated image · provider "([^"]+)" · [^·]+ · ([^·]+) · (png|jpe?g|webp) · ([^\s]+)/;

		function textOf(content) {
			if (!Array.isArray(content)) return "";
			let out = "";
			for (const block of content) {
				if (block !== null && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
					if (out.length > 0) out += "\n";
					out += block.text;
				}
			}
			return out;
		}

		function imagePathOf(content) {
			const text = textOf(content);
			const match = IMAGE_PATH_PATTERN.exec(text);
			return match === null ? null : match[1];
		}

		function summaryOf(content) {
			const text = textOf(content);
			const match = SUMMARY_PATTERN.exec(text);
			if (match === null) return null;
			return { provider: match[1], size: match[2].trim(), format: match[3], bytes: match[4] };
		}

		function argsOf(block) {
			let raw = null;
			if (block !== null && typeof block === "object") {
				if (block.kind === "tool-result") raw = block.call !== null && typeof block.call === "object" ? block.call.argsRaw : null;
				else raw = block.argsRaw;
			}
			if (typeof raw !== "string" || raw.length === 0) return null;
			try {
				return JSON.parse(raw);
			} catch {
				return { raw };
			}
		}

		function promptOf(block) {
			const args = argsOf(block);
			if (args === null) return "";
			if (typeof args === "object" && args !== null && typeof args.prompt === "string") return args.prompt;
			if (typeof args === "object" && args !== null && typeof args.raw === "string") return args.raw;
			return "";
		}

		// ── image card UI ──
		function ImageCard(props) {
			const block = props.block;
			const settled = block !== null && typeof block === "object" && block.kind === "tool-result";
			const showPromptState = react.useState(false);
			const showPrompt = showPromptState[0];
			const setShowPrompt = showPromptState[1];

			if (!settled) {
				const prompt = promptOf(block);
				return react.createElement("div", { className: "gpi-card" },
					react.createElement("div", { className: "gpi-running" }, "Generating image…"),
					prompt.length > 0 ? react.createElement("pre", { className: "gpi-prompt" }, prompt) : null,
				);
			}

			const content = block.content;
			const imagePath = imagePathOf(content);
			const summary = summaryOf(content);
			const prompt = promptOf(block);

			if (block.isError === true) {
				return react.createElement("div", { className: "gpi-card" },
					react.createElement("div", { className: "gpi-error" }, textOf(content)),
				);
			}

			if (imagePath === null) {
				return react.createElement("div", { className: "gpi-card" },
					react.createElement("div", { className: "gpi-prompt" }, textOf(content)),
				);
			}

			return react.createElement(ImageStage, {
				imageUrl: imagePath,
				summary,
				prompt,
				showPrompt,
				setShowPrompt
			});
		}

		function ImageStage(props) {
			const { imageUrl, summary, prompt, showPrompt, setShowPrompt } = props;
			const imgErrorState = react.useState(false);
			const imgError = imgErrorState[0];
			const setImgError = imgErrorState[1];

			react.useEffect(() => {
				setImgError(false);
			}, [imageUrl]);

			const metaBits = [];
			if (summary !== null && summary.provider !== "") metaBits.push(providerLabelOf(summary.provider));
			if (summary !== null && summary.size !== "") metaBits.push(summary.size);
			if (summary !== null) metaBits.push(summary.format.toUpperCase());
			if (summary !== null) metaBits.push(summary.bytes);

			const onDownload = () => {
				fetch(imageUrl)
					.then((res) => {
						if (!res.ok) throw new Error("HTTP " + res.status);
						return res.blob();
					})
					.then((blob) => {
						const url = URL.createObjectURL(blob);
						const a = document.createElement("a");
						a.href = url;
						a.download = "gpt-image-" + (summary !== null ? summary.size.replace("×", "x") : "generated") + "." + (summary !== null ? summary.format : "png");
						document.body.appendChild(a);
						a.click();
						a.remove();
						setTimeout(() => URL.revokeObjectURL(url), 1000);
					})
					.catch(() => {});
			};

			// Images are persisted on disk by the host; a missing file (manual
			// cleanup) degrades to a notice instead of a silent blank card.
			const stageContent = imgError
				? react.createElement("div", { className: "gpi-fallback" },
					react.createElement("div", { className: "gpi-fallback-title" }, "无法加载图片"),
					react.createElement("div", { className: "gpi-fallback-hint" },
						"该图片文件已不存在（可能在磁盘上被手动清理）。重新调用 gpt_image 生成即可恢复。"))
				: react.createElement("img", {
					src: imageUrl,
					alt: "Generated image",
					draggable: false,
					onError: () => setImgError(true)
				});

			return react.createElement("div", { className: "gpi-card" },
				react.createElement("div", { className: "gpi-meta" }, "Generated image", metaBits.join(" · ")),
				react.createElement("div", { className: "gpi-stage" }, stageContent),
				react.createElement("div", { className: "gpi-actions" },
					prompt.length > 0 ? react.createElement("button", { className: "gpi-btn", type: "button", onClick: () => setShowPrompt(!showPrompt) },
						showPrompt ? "Hide prompt" : "Show prompt") : null,
					react.createElement("button", { className: "gpi-btn", type: "button", onClick: onDownload }, "Download"),
					react.createElement("a", { className: "gpi-btn", href: imageUrl, target: "_blank", rel: "noreferrer" }, "Open in new tab")),
				showPrompt && prompt.length > 0 ? react.createElement("pre", { className: "gpi-prompt" }, prompt) : null,
			);
		}

		// ── provider settings row (Settings → General → Image provider) ──
		function createProviderRowStore() {
			return defineStore({
				init: () => ({ provider: "openai", revision: -1 }),
				actions: {
					sync: (d, provider, revision) => {
						if (revision <= d.revision) return;
						d.provider = provider;
						d.revision = revision;
					}
				}
			});
		}

		function ProviderRow(props) {
			const useStore = props.useStore;
			const setProvider = props.setProvider;
			const provider = useStore((s) => s.provider);
			return react.createElement("div", { className: "gpi-setting-row" },
				react.createElement("span", { className: "gpi-setting-title" }, "Image provider"),
				react.createElement("select", {
					className: "gpi-setting-select",
					value: provider,
					onChange: (e) => setProvider(e.target.value)
				}, PROVIDER_OPTIONS.map((option) =>
					react.createElement("option", { key: option.id, value: option.id }, option.label)
				))
			);
		}

		// ── registration ──
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "gpt_image"
			}, ImageCard));

			// Additive Settings → General row; skipped when the settings feature or
			// the runtime store helper is absent from the profile.
			const settingsScope = ctx.get("settingsScope");
			if (settingsScope !== undefined && defineStore !== null) {
				const scope = settingsScope.bind({ namespace: "gpt-image" });
				const store = createProviderRowStore();
				let bound = null;
				const sync = (snapshot) => {
					if (bound === null) return;
					let provider = "openai";
					let revision = -1;
					if (snapshot !== null && typeof snapshot === "object") {
						if (typeof snapshot.revision === "number") revision = snapshot.revision;
						if (snapshot.value !== null && typeof snapshot.value === "object" && typeof snapshot.value.provider === "string") {
							provider = snapshot.value.provider;
						}
					}
					bound.sync(provider, revision);
				};
				ctx.effect(() => scope.subscribe(sync), "gpt-image: provider settings subscription");
				const injected = (actions) => {
					bound = actions;
					sync(scope.getSnapshot());
					return { setProvider: (id) => {
						scope.set("provider", id);
					} };
				};
				ctx.slots.inject("settings.general.item", () => ctx.slots.register({
					name: "settings.general.item",
					id: "gpt-image-provider",
					order: 30,
					store,
					inject: injected
				}, ProviderRow));
			}
		}
		exports.apply = apply;
		exports.inject = inject;
		exports.ImageCard = ImageCard;
		exports.ProviderRow = ProviderRow;
		return module.exports;
	}
});
