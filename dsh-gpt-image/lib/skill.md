# dsh-gpt-image — 用 gpt-image-1 生成图片

## 何时使用

当用户要求**生成/创作一张图片**（画一张图、生成一个图标/贴纸/封面、设计一个 logo、做一张海报、配一张插图等），或需要视觉素材时，使用 `gpt_image` 工具实际生成，而不是只用文字描述代替。

## 调用方式

调用 `gpt_image` 工具，参数如下：

| 参数 | 取值 | 说明 |
| --- | --- | --- |
| `prompt`（必填） | 字符串 | 完整描述想要的图片 |
| `provider` | `openai` · `volcengine` · `siliconflow` · `zhipu`（默认按设置） | 图片提供商；**默认用用户已配置的 provider，只有用户明确要求某个提供商时才传** |
| `size` | `auto`（默认）· `1024x1024` · `1536x1024`（横版）· `1024x1536`（竖版） | 画面比例；`auto` 让模型按内容选最合适的比例 |
| `quality` | `auto`（默认）· `low` · `medium` · `high` | `high` 更精细但更慢更贵；草稿/快速预览用 `low` |
| `output_format` | `png`（默认）· `jpeg` · `webp` | 输出格式 |
| `background` | `auto`（默认）· `transparent` · `opaque` | 透明背景必须配合 `output_format: "png"`；仅部分提供商支持 |

生成完成后，图片会自动以内联卡片显示在对话流中，卡片会标明使用的 provider，并支持下载与在新窗口打开。

## Provider 选择

- **不要随意指定 provider**：默认使用用户在 设置 → 通用 → Image provider 中选好的提供商（或 `GPT_IMAGE_PROVIDER` 环境变量）；这是持久化配置，模型不应擅自覆盖。
- **只有当用户明确说"用 XX 生成"时才传 `provider` 参数**，例如"用火山方舟/seedream 生成" → `provider: "volcengine"`，"用智谱生成" → `provider: "zhipu"`。
- 预置 provider：`openai`（gpt-image-1）、`volcengine`（豆包 Seedream）、`siliconflow`（FLUX 等）、`zhipu`（CogView）。
- 如果当前 provider 报鉴权/额度错误，先按错误信息提示用户配置 key；不要静默换 provider。

## 写 prompt 的要点

- 用自然语言完整描述**主体、场景、风格、构图、光线、氛围**；越具体越好。
- 需要风格时明确点出：如 `cinematic lighting`、`flat vector illustration`、`photorealistic`、`watercolor`、`minimalist logo`、`isometric 3d`、`anime style` 等。
- 画面里需要文字时，把文字内容写进 prompt 并保持简短（如 `a neon sign reading "COFFEE"`）；**不需要文字时明确写 `no text`**，避免模型乱加文字。
- 不需要“负面提示词”；想避免的内容用正面描述绕开（如 `clean white background`、`soft natural light`）。
- 比例需求用 `size` 控制：手机壁纸/海报用 `1024x1536`，横幅/宽幅封面用 `1536x1024`。
- 透明背景素材（logo、贴纸、图标）：`output_format: "png"` + `background: "transparent"`。
- 单次调用生成一张即可；不要用同一 prompt 重复调用，除非用户要求多张。

## 生成后

- 在回复里告诉用户生成了什么，以及尺寸、格式等元信息（卡片上也会显示）。
- 如果效果不理想（构图、风格、内容有偏差），根据用户反馈调整 prompt 后重新调用 `gpt_image`，不要只解释不重试。
- 生成失败时（内容安全拦截、鉴权失败、网络错误等），工具会返回具体原因；据此向用户说明并给出调整建议，不要静默放弃。
