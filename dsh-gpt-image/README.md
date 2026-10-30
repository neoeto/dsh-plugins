# dsh-gpt-image

在 DSH 对话里用 **OpenAI 兼容的生图 API** 直接生成图片，并把结果以内联图片卡片展示给用户。
支持多个预置 provider，可在 GUI 设置里切换。

## 功能

- **`gpt_image` 模型工具**：调用 `POST /images/generations`（OpenAI 兼容协议），支持
  `prompt` / `provider` / `size` / `quality` / `output_format` / `background` 参数；
- **自带 skill（`dsh-gpt-image`）**：一段可加载的生图指导（prompt 写法、参数与 provider
  选择、失败处理），模型判断需要生图时自动加载；
- **多 provider 预置 + 用户可选**：预置 OpenAI / 火山方舟 Seedream / 硅基流动 / 智谱，
  在 **设置 → 通用 → Image provider** 里下拉选择（持久化），也可用环境变量 `GPT_IMAGE_PROVIDER` 或工具参数 `provider` 覆盖；
- **聊天内图片卡片**：生成的图片保存到磁盘，通过 `/plugins/dsh-gpt-image/img/<id>.<ext>`
  提供，浏览器半边在对话流中渲染内联大图卡片（标明 provider），支持下载与在新窗口打开；
  图片文件被清理时卡片优雅降级为提示。

## Provider 预置

| id | 提供商 / 模型 | 默认端点 | 默认模型 | Key 环境变量 |
| --- | --- | --- | --- | --- |
| `openai` | OpenAI gpt-image-1 | `https://api.openai.com/v1` | `gpt-image-1` | `OPENAI_API_KEY` |
| `volcengine` | 火山方舟 Seedream（豆包） | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seedream-3-0-t2i-250415` | `ARK_API_KEY` |
| `siliconflow` | 硅基流动 SiliconFlow | `https://api.siliconflow.cn/v1` | `black-forest-labs/FLUX.1-schnell` | `SILICONFLOW_API_KEY` |
| `zhipu` | 智谱 GLM（CogView） | `https://open.bigmodel.cn/api/paas/v4` | `cogview-4` | `ZHIPU_API_KEY` |

> 阿里云百炼（通义万相/Qwen-Image）**不是** OpenAI 兼容格式，需要适配代理
> （如 [dashscope-image-proxy](https://github.com/pop8234333/dashscope-image-proxy)），
> 因此未作为预置项；可通过 `GPT_IMAGE_BASE_URL` + `GPT_IMAGE_MODEL` + `GPT_IMAGE_API_KEY` 接入任意兼容网关。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `GPT_IMAGE_PROVIDER` | `openai` | 默认 provider（GUI 设置优先于它；工具参数 `provider` 优先于 GUI 设置）。 |
| `GPT_IMAGE_BASE_URL` | 所选 provider 的默认端点 | 覆盖端点（如自建兼容网关）。 |
| `GPT_IMAGE_MODEL` | 所选 provider 的默认模型 | 覆盖模型（如 `gpt-image-1-mini`）。 |
| `GPT_IMAGE_API_KEY` | 所选 provider 的 key 环境变量 | 覆盖 API Key。 |
| `OPENAI_API_KEY` / `ARK_API_KEY` / `SILICONFLOW_API_KEY` / `ZHIPU_API_KEY` | — | 各 provider 的 Key（在启动 `dsh web` 的终端环境里 export 后重启）。 |
| `GPT_IMAGE_OUTPUT_DIR` | `$DSH_HOME/plugins/dsh-gpt-image/images` | 图片存储目录（磁盘持久化，重启不丢）。 |

**Provider 解析优先级**：工具参数 `provider` → 设置 → 通用 → Image provider（GUI 持久化）→ `GPT_IMAGE_PROVIDER` → `openai`。

## 安装

在目标 profile（如 `~/.dsh/profiles/web`）中声明 link 依赖并加入 `dsh.profile.bundles`：

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

然后在 profile 目录执行 `pnpm install`，并**重启 `dsh web` 进程**（新 bundle 需要重启后才会被 boot 清单加载）。

## 使用

1. 在 **设置 → 通用 → Image provider** 选择 provider（并在环境里配好对应 Key）；
2. 用户提出生图需求（画一张 / 生成图标 / 设计 logo / 做封面……）；
3. 模型加载 `dsh-gpt-image` skill 获得生图指导，调用 `gpt_image` 工具；
4. 图片生成后自动以内联卡片显示在对话中，卡片带 provider 与尺寸/格式/大小元信息，支持下载、新窗口打开；
5. 效果不理想时，让模型根据反馈调整 prompt 重新生成；想换提供商时，直接说"用 XX 生成"或改 GUI 设置。

## 存储与清理

- 图片持久化在 `GPT_IMAGE_OUTPUT_DIR`（默认 `~/.dsh/plugins/dsh-gpt-image/images/`）；
- 旧图不会自动删除；如需清理，直接删除该目录下的文件即可（已删除图片的卡片会降级提示）。

## 开发与验证

- 修改 `lib/index.js` / `lib/client.js` / `lib/skill.md` 后刷新页面即可生效（bundle 以 `no-cache` 提供）；
- 新增/移除 bundle、修改 `cordis.patch.yml` 或 profile 依赖后需要重启 `dsh web`；
- 运行中的进程按启动时记录的路径读取 bundle，文件重建后无需重启即可被服务。

## 局限

- 依赖外部生图服务（各 provider）的网络连通与有效 Key；失败会在工具结果里给出明确原因；
- 各 provider 的模型能力/参数支持略有差异（如 `background` 仅部分支持）；
- 图片保存在宿主机磁盘，跨机迁移/清理需自行处理。
