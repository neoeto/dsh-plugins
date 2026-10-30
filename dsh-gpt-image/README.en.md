# dsh-gpt-image

Generate images directly from the conversation through an **OpenAI-compatible images API**,
and show the result as an inline image card. Ships several provider presets switchable in the GUI.

## Features

- **`gpt_image` model tool**: calls `POST /images/generations` (OpenAI-compatible) with
  `prompt` / `provider` / `size` / `quality` / `output_format` / `background` parameters;
- **Embedded skill (`dsh-gpt-image`)**: loadable generation guidance (prompt writing, parameter
  and provider choices, failure handling) that the model loads when an image is requested;
- **Provider presets + user selection**: OpenAI / Volcengine Seedream / SiliconFlow / Zhipu,
  switchable in **Settings → General → Image provider** (persisted), or via the
  `GPT_IMAGE_PROVIDER` env var, or per call with the `provider` tool argument;
- **Inline chat image card**: generated images are persisted to disk and served at
  `/plugins/dsh-gpt-image/img/<id>.<ext>`; the browser half renders an inline card (with the
  provider label) plus download / open-in-new-tab actions, and degrades gracefully when a file
  was cleaned up.

## Provider presets

| id | Provider / model | Default endpoint | Default model | Key env var |
| --- | --- | --- | --- | --- |
| `openai` | OpenAI gpt-image-1 | `https://api.openai.com/v1` | `gpt-image-1` | `OPENAI_API_KEY` |
| `volcengine` | Volcengine Ark Seedream | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seedream-3-0-t2i-250415` | `ARK_API_KEY` |
| `siliconflow` | SiliconFlow | `https://api.siliconflow.cn/v1` | `black-forest-labs/FLUX.1-schnell` | `SILICONFLOW_API_KEY` |
| `zhipu` | Zhipu GLM (CogView) | `https://open.bigmodel.cn/api/paas/v4` | `cogview-4` | `ZHIPU_API_KEY` |

> Alibaba DashScope (Qwen-Image) is **not** OpenAI-compatible out of the box and needs an
> adapter (e.g. [dashscope-image-proxy](https://github.com/pop8234333/dashscope-image-proxy)),
> so it is not a preset; connect any compatible gateway via `GPT_IMAGE_BASE_URL` +
> `GPT_IMAGE_MODEL` + `GPT_IMAGE_API_KEY`.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `GPT_IMAGE_PROVIDER` | `openai` | Default provider (the GUI setting wins over it; the `provider` tool argument wins over both). |
| `GPT_IMAGE_BASE_URL` | the preset's endpoint | Override the endpoint (e.g. self-hosted compatible gateway). |
| `GPT_IMAGE_MODEL` | the preset's model | Override the model (e.g. `gpt-image-1-mini`). |
| `GPT_IMAGE_API_KEY` | the preset's key env var | Override the API key. |
| `OPENAI_API_KEY` / `ARK_API_KEY` / `SILICONFLOW_API_KEY` / `ZHIPU_API_KEY` | — | Per-provider keys (export in the shell that launches `dsh web`, then restart). |
| `GPT_IMAGE_OUTPUT_DIR` | `$DSH_HOME/plugins/dsh-gpt-image/images` | Where generated images are stored (persistent across restarts). |

**Provider resolution order**: `provider` tool argument → Settings → General → Image provider
(persisted) → `GPT_IMAGE_PROVIDER` → `openai`.

## Install

Declare a link dependency in the target profile (e.g. `~/.dsh/profiles/web`) and add the
bundle to `dsh.profile.bundles`:

```jsonc
// ~/.dsh/profiles/web/package.json
{
  "dependencies": {
    "dsh-gpt-image": "link:/path/to/dsh-plugins/dsh-gpt-image"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-gpt-image"]
    }
  }
}
```

Then run `pnpm install` in the profile directory and **restart the `dsh web` process** (a new
bundle only enters the boot manifest after a restart).

## Usage

1. Pick the provider in **Settings → General → Image provider** and set its key in the environment;
2. The user asks for an image (draw / icon / logo / cover …);
3. The model loads the `dsh-gpt-image` skill for guidance, then calls the `gpt_image` tool;
4. The generated image appears as an inline card with the provider and metadata
   (dimensions / format / size) plus download / open-in-new-tab actions;
5. If the result is off, ask the model to adjust the prompt and regenerate; to switch provider,
   say "use X" in the request or change the GUI setting.

## Storage & cleanup

- Images persist under `GPT_IMAGE_OUTPUT_DIR` (default `~/.dsh/plugins/dsh-gpt-image/images/`);
- Old images are never auto-deleted; to clean up, remove files from that directory (cards for
  deleted files degrade to a notice).

## Development & verification

- Editing `lib/index.js` / `lib/client.js` / `lib/skill.md` takes effect on the next page
  refresh (bundles are served with `no-cache`);
- Adding/removing a bundle, changing `cordis.patch.yml`, or changing profile dependencies
  requires restarting `dsh web`;
- The running process reads bundles by the path recorded at startup; rebuilt files are served
  without a restart.

## Limitations

- Depends on outbound network access to the selected provider and a valid key; failures surface
  with explicit reasons in the tool result;
- Provider capabilities differ slightly (e.g. `background` is only supported by some);
- Images live on the host machine's disk; migration/cleanup across machines is your call.
