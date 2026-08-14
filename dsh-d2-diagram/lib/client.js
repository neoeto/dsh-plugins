window.__ModuleLoader__.load({
	id: "dsh-d2-diagram",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		// ── plugin-owned styles (claimed per the client-modules convention) ──
		const STYLE_ID = "dsh-d2-diagram/styles.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-d2-diagram";
			tag.dataset.pluginCss = STYLE_ID;
			tag.textContent = [
				".d2d-card{display:flex;flex-direction:column;gap:8px;padding:8px 4px 4px 4px;min-width:0}",
				".d2d-stage{position:relative;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);touch-action:none;user-select:none;min-width:0}",
				".d2d-pan{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform}",
				".d2d-pan img{display:block;height:auto;pointer-events:none;-webkit-user-drag:none}",
				".d2d-zoombar{position:absolute;top:8px;right:8px;display:flex;gap:2px;align-items:center;padding:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent)}",
				".d2d-zoom-label{min-width:42px;text-align:center;font-size:11px;line-height:22px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums}",
				".d2d-meta{display:flex;align-items:baseline;gap:8px;color:var(--dsw-alias-label-caption);font-size:12px;line-height:16px;flex-wrap:wrap}",
				".d2d-actions{display:flex;gap:8px;flex-wrap:wrap}",
				".d2d-btn{all:unset;cursor:pointer;font:inherit;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:3px 10px;display:inline-flex;align-items:center;gap:4px}",
				".d2d-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}",
				".d2d-btn:disabled{opacity:.45;cursor:default}",
				".d2d-btn.d2d-icon{padding:1px 8px;font-size:14px;line-height:20px;border:none;border-radius:7px}",
				".d2d-btn.d2d-icon:hover{background:var(--dsw-alias-border-l1)}",
				".d2d-source{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);border-radius:12px;padding:12px 16px;max-height:280px;overflow:auto;margin:0}",
				".d2d-source pre{margin:0;white-space:pre;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary)}",
				".d2d-error{color:var(--dsw-alias-state-error-primary);font-size:12px;white-space:pre-wrap;word-break:break-word}",
				".d2d-running{color:var(--dsw-alias-label-caption);font-size:12px;padding:8px 4px}"
			].join("\n");
			document.head.appendChild(tag);
		}

		// ── result parsing ──
		const SVG_PATH_PATTERN = /SVG:\s*(\/plugins\/dsh-d2-diagram\/svg\/[A-Za-z0-9]+)/;
		const SUMMARY_PATTERN = /Rendered d2 diagram to (\S+) \(theme "([^"]+)", layout "([^"]+)"\)/;

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

		function svgPathOf(content) {
			const text = textOf(content);
			const match = SVG_PATH_PATTERN.exec(text);
			return match === null ? null : match[1];
		}

		function summaryOf(content) {
			const text = textOf(content);
			const match = SUMMARY_PATTERN.exec(text);
			if (match === null) return null;
			return { size: match[1], theme: match[2], layout: match[3] };
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

		function sourceCodeOf(block) {
			const args = argsOf(block);
			if (args === null) return "";
			if (typeof args === "object" && args !== null && typeof args.code === "string") return args.code;
			if (typeof args === "object" && args !== null && typeof args.raw === "string") return args.raw;
			return "";
		}

		// ── card UI ──
		function DiagramCard(props) {
			const block = props.block;
			const settled = block !== null && typeof block === "object" && block.kind === "tool-result";
			const showSourceState = react.useState(false);
			const showSource = showSourceState[0];
			const setShowSource = showSourceState[1];

			if (!settled) {
				const code = sourceCodeOf(block);
				return react.createElement("div", { className: "d2d-card" },
					react.createElement("div", { className: "d2d-running" }, "Rendering D2 diagram…"),
					code.length > 0 ? react.createElement("pre", { className: "d2d-source" },
						react.createElement("code", null, code)) : null,
				);
			}

			const content = block.content;
			const svgPath = svgPathOf(content);
			const summary = summaryOf(content);
			const code = sourceCodeOf(block);

			if (block.isError === true) {
				return react.createElement("div", { className: "d2d-card" },
					react.createElement("div", { className: "d2d-error" }, textOf(content)),
				);
			}

			if (svgPath === null) {
				return react.createElement("div", { className: "d2d-card" },
					react.createElement("div", { className: "d2d-source" },
						react.createElement("pre", null, textOf(content))),
				);
			}

			return react.createElement(ZoomableDiagram, {
				svgUrl: svgPath,
				summary,
				code,
				showSource,
				setShowSource
			});
		}

		// ── zoom / pan geometry ──
		//
		// Zoom is implemented by changing the image's LAYOUT width, never by a
		// CSS transform scale: browsers rasterize an <img>-embedded SVG at its
		// layout size, so a transform scale would magnify a stale bitmap (blur).
		// A layout-width change re-rasterizes the SVG at the new size — crisp.
		const MIN_SCALE = 1;
		const MAX_SCALE = 4;
		const MAX_BASE_WIDTH = 900;
		const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

		function ZoomableDiagram(props) {
			const { svgUrl, summary, code, showSource, setShowSource } = props;

			const scaleState = react.useState(1);
			const scale = scaleState[0];
			const setScale = scaleState[1];
			const posState = react.useState({ x: 0, y: 0 });
			const pos = posState[0];
			const setPos = posState[1];
			const draggingState = react.useState(false);
			const dragging = draggingState[0];
			const setDragging = draggingState[1];
			const aspectState = react.useState(0.6);
			const aspect = aspectState[0];
			const setAspect = aspectState[1];
			const viewState = react.useState({ w: 0, h: 0 });
			const view = viewState[0];
			const setView = viewState[1];

			const stageRef = react.useRef(null);
			const imgRef = react.useRef(null);
			const dragRef = react.useRef(null);
			const aspectRef = react.useRef(aspect);
			aspectRef.current = aspect;

			const baseW = Math.min(view.w, MAX_BASE_WIDTH) || MAX_BASE_WIDTH;

			/** Layout geometry at a given scale. */
			const geomFor = (s) => {
				const W = baseW * s;
				const H = W * aspect;
				return {
					W,
					H,
					cx: Math.max(0, (view.w - W) / 2),
					cy: Math.max(0, (view.h - H) / 2)
				};
			};

			/** Clamp a pan translation so the image keeps covering the viewport. */
			const clampT = (s, t) => {
				const g = geomFor(s);
				let x = g.W <= view.w ? 0 : Math.min(-g.cx, Math.max(view.w - (g.cx + g.W), t.x));
				let y = g.H <= view.h ? 0 : Math.min(-g.cy, Math.max(view.h - (g.cy + g.H), t.y));
				return { x, y };
			};

			const runMeasure = () => {
				const stage = stageRef.current;
				if (stage === null) return;
				const vw = stage.getBoundingClientRect().width;
				if (vw <= 0) return;
				const bw = Math.min(vw, MAX_BASE_WIDTH);
				const fitH = bw * aspectRef.current;
				const maxH = Math.min(window.innerHeight * 0.6, 560);
				const vh = Math.max(160, Math.min(maxH, fitH + 44));
				setView((prev) => (prev.w === vw && prev.h === vh ? prev : { w: vw, h: vh }));
			};

			// Reset and re-measure whenever a new diagram arrives.
			react.useEffect(() => {
				setScale(1);
				setPos({ x: 0, y: 0 });
				runMeasure();
				const onResize = () => runMeasure();
				window.addEventListener("resize", onResize);
				let observer = null;
				if (typeof ResizeObserver !== "undefined" && stageRef.current !== null) {
					observer = new ResizeObserver(onResize);
					observer.observe(stageRef.current);
				}
				return () => {
					window.removeEventListener("resize", onResize);
					if (observer !== null) observer.disconnect();
				};
			}, [svgUrl]);

			// Re-clamp the pan when the viewport changes (resize / aspect known).
			react.useEffect(() => {
				if (view.w === 0) return;
				setPos((p) => clampT(scale, p));
			}, [view.w, view.h]);

			// Latest state for the native wheel listener.
			const stateRef = react.useRef({});
			stateRef.current = { scale, pos, view, aspect, baseW, geomFor, clampT, setScale, setPos };

			react.useEffect(() => {
				const stage = stageRef.current;
				if (stage === null) return;
				const applyZoomAt = (px, py, factor) => {
					const st = stateRef.current;
					if (st.view.w === 0) return;
					const s0 = st.scale;
					const s2 = clampScale(s0 * factor);
					if (s2 === s0) return;
					const g0 = st.geomFor(s0);
					const g2 = st.geomFor(s2);
					const cxu = (px - g0.cx - st.pos.x) / s0;
					const cyu = (py - g0.cy - st.pos.y) / s0;
					const raw = { x: px - cxu * s2 - g2.cx, y: py - cyu * s2 - g2.cy };
					st.setScale(s2);
					st.setPos(st.clampT(s2, raw));
				};
				const onWheel = (e) => {
					const factor = Math.exp(-e.deltaY * 0.0018);
					const st = stateRef.current;
					const nextS = clampScale(st.scale * factor);
					if (nextS === st.scale) return; // at the bound: let the page scroll
					e.preventDefault();
					const rect = stage.getBoundingClientRect();
					applyZoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
				};
				stage.addEventListener("wheel", onWheel, { passive: false });
				return () => stage.removeEventListener("wheel", onWheel);
			}, [svgUrl]);

			const zoomAt = (factor) => {
				const st = stateRef.current;
				const px = st.view.w / 2;
				const py = st.view.h / 2;
				const s0 = st.scale;
				const s2 = clampScale(s0 * factor);
				if (s2 === s0) return;
				const g0 = st.geomFor(s0);
				const g2 = st.geomFor(s2);
				const cxu = (px - g0.cx - st.pos.x) / s0;
				const cyu = (py - g0.cy - st.pos.y) / s0;
				const raw = { x: px - cxu * s2 - g2.cx, y: py - cyu * s2 - g2.cy };
				st.setScale(s2);
				st.setPos(st.clampT(s2, raw));
			};

			const resetZoom = () => {
				setScale(1);
				setPos({ x: 0, y: 0 });
			};

			const onPointerDown = (e) => {
				if (e.button !== 0) return;
				// Keep the zoom bar interactive: a pointerdown on a control must
				// not start a drag or capture the pointer (capture would swallow
				// the matching pointerup and suppress the button's click).
				if (typeof Element !== "undefined" && e.target instanceof Element && e.target.closest(".d2d-zoombar") !== null) return;
				setDragging(true);
				dragRef.current = { startX: e.clientX, startY: e.clientY, tx: pos.x, ty: pos.y };
				if (e.currentTarget.setPointerCapture !== undefined) e.currentTarget.setPointerCapture(e.pointerId);
			};
			const onPointerMove = (e) => {
				if (dragRef.current === null) return;
				const d = dragRef.current;
				setPos(clampT(scale, { x: d.tx + e.clientX - d.startX, y: d.ty + e.clientY - d.startY }));
			};
			const onPointerUp = () => {
				dragRef.current = null;
				setDragging(false);
			};

			const onImgLoad = (e) => {
				const img = e.currentTarget;
				if (img.naturalWidth > 0 && img.naturalHeight > 0) {
					const a = img.naturalHeight / img.naturalWidth;
					aspectRef.current = a;
					setAspect(a);
					runMeasure();
				}
			};

			const metaBits = [];
			if (summary !== null) metaBits.push(summary.size);
			if (summary !== null) metaBits.push("theme \u201C" + summary.theme + "\u201D");
			if (summary !== null) metaBits.push("layout \u201C" + summary.layout + "\u201D");

			const onDownload = () => {
				fetch(svgUrl)
					.then((res) => res.text())
					.then((svg) => {
						const blob = new Blob([svg], { type: "image/svg+xml" });
						const url = URL.createObjectURL(blob);
						const a = document.createElement("a");
						a.href = url;
						a.download = "diagram.svg";
						document.body.appendChild(a);
						a.click();
						a.remove();
						setTimeout(() => URL.revokeObjectURL(url), 1000);
					})
					.catch(() => {});
			};
			const onCopy = () => {
				if (navigator.clipboard === undefined || code.length === 0) return;
				navigator.clipboard.writeText(code).catch(() => {});
			};

			const g = geomFor(scale);
			const tx = g.cx + pos.x;
			const ty = g.cy + pos.y;

			return react.createElement("div", { className: "d2d-card" },
				react.createElement("div", { className: "d2d-meta" }, "D2 diagram", metaBits.join(" · ")),
				react.createElement("div", {
					className: "d2d-stage",
					ref: stageRef,
					style: { height: view.h || 420, cursor: dragging ? "grabbing" : (scale > 1 ? "grab" : "default") },
					"data-dragging": dragging ? "true" : "false",
					onPointerDown,
					onPointerMove,
					onPointerUp,
					onPointerCancel: onPointerUp,
					onDoubleClick: (e) => {
						if (typeof Element !== "undefined" && e.target instanceof Element && e.target.closest(".d2d-zoombar") !== null) return;
						resetZoom();
					}
				},
					react.createElement("div", { className: "d2d-pan", style: { transform: "translate(" + tx + "px, " + ty + "px)" } },
						react.createElement("img", {
							ref: imgRef,
							src: svgUrl,
							alt: "D2 diagram",
							draggable: false,
							onLoad: onImgLoad,
							style: { width: g.W, height: "auto" }
						})),
					react.createElement("div", { className: "d2d-zoombar" },
						react.createElement("button", { className: "d2d-btn d2d-icon", type: "button", title: "Zoom out", disabled: scale <= MIN_SCALE, onClick: () => zoomAt(1 / 1.25) }, "\u2212"),
						react.createElement("span", { className: "d2d-zoom-label" }, Math.round(scale * 100) + "%"),
						react.createElement("button", { className: "d2d-btn d2d-icon", type: "button", title: "Zoom in", disabled: scale >= MAX_SCALE, onClick: () => zoomAt(1.25) }, "+"),
						react.createElement("button", { className: "d2d-btn d2d-icon", type: "button", title: "Reset zoom", onClick: resetZoom }, "\u27F2"))),
				react.createElement("div", { className: "d2d-actions" },
					react.createElement("button", { className: "d2d-btn", type: "button", onClick: () => setShowSource(!showSource) },
						showSource ? "Hide source" : "Show source"),
					code.length > 0 ? react.createElement("button", { className: "d2d-btn", type: "button", onClick: onCopy }, "Copy D2 code") : null,
					react.createElement("button", { className: "d2d-btn", type: "button", onClick: onDownload }, "Download SVG"),
					react.createElement("a", { className: "d2d-btn", href: svgUrl, target: "_blank", rel: "noreferrer" }, "Open SVG")),
				showSource ? react.createElement("div", { className: "d2d-source" },
					react.createElement("pre", null, code)) : null,
			);
		}

		// ── registration ──
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "d2_render"
			}, DiagramCard));
		}
		exports.apply = apply;
		exports.inject = inject;
		exports.DiagramCard = DiagramCard;
		return module.exports;
	}
});
