# dsh-mermaid-diagram

A DeepSeek Harness web plugin that brings Mermaid diagrams to the
conversation: it registers the `mermaid_render` model tool, renders Mermaid
source to SVG, and displays it inside the tool card.

## How it works

- **Host half** (`lib/index.js`):
  - Registers the `mermaid_render` tool: it takes Mermaid source plus a
    theme, runs `lib/render.mjs` in a headless Chromium (Mermaid needs the
    browser DOM for layout), keeps the SVG in memory and publishes it at
    `/plugins/dsh-mermaid-diagram/svg/<id>` (LRU cap of 64; old ids expire
    after eviction or a process restart).
  - Render failures throw the parser error (with line numbers), so the
    model can fix the source and retry.
- **Client half** (`lib/client.js`): registers the `mermaid_render` key of
  `tool.call.toolview`, parses the `SVG:` reference out of the tool result,
  and draws the diagram inside the card:
  - Zoom: mouse wheel (anchored at the cursor), + / − buttons (100%–400%),
    double-click to reset. Zoom changes the `<img>` layout width, so the
    browser re-rasterizes the SVG vector at every new size — crisp at any
    zoom level.
  - Pan: press and drag (when zoomed past 100%), clamped to the diagram
    bounds.
  - Show / hide the Mermaid source.
  - Copy the Mermaid code.
  - Download / open the SVG in a new tab.
  - When the SVG URL has expired, the card explains why and how to recover
    instead of going blank.

## Dependencies

- `mermaid` (npm, the rendering engine; installed with the package)
- `puppeteer-core` (npm, drives the headless Chromium; installed with the
  package)
- A Chromium executable: by default discovered under
  `~/Library/Caches/ms-playwright/` in `chromium_headless_shell-*`
  (playwright-installed browsers can be reused), or override with the
  `MERMAID_CHROMIUM_PATH` environment variable.

## Directory layout

```
dsh-mermaid-diagram/
├── package.json        # dsh.client metadata + dsh.bundle.patch + deps
├── cordis.patch.yml    # inserts the host row (tool + svg route)
├── README.md           # docs (Chinese)
├── README.en.md        # docs (English)
└── lib/
    ├── index.js        # host half
    ├── render.mjs      # render script (mermaid → SVG)
    └── client.js       # __ModuleLoader__-format browser bundle (hand-written)
```

## Mounting

Declare a link dependency and add the plugin to `dsh.profile.bundles` in
the target profile (e.g. `~/.dsh/profiles/web`):

```jsonc
// package.json
{
  "dependencies": {
    "dsh-mermaid-diagram": "link:/path/to/dsh-plugins/dsh-mermaid-diagram"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-mermaid-diagram"
      ]
    }
  }
}
```

Composition changes (the bundle list) require a `dsh` restart; edits to
`lib/client.js` and `lib/index.js` take effect after the restart.

## Display contract

The `mermaid_render` tool result text contains:

```
Rendered mermaid diagram to 638×548px (theme "default"). …
SVG: /plugins/dsh-mermaid-diagram/svg/<id>
```

The card extracts the size / theme information and the SVG path from it,
then renders the diagram.
