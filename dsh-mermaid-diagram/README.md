# dsh-mermaid-diagram

DeepSeek Harness Web 插件：为对话提供 Mermaid 图表能力——注册 `mermaid_render`
模型工具，把 Mermaid 源码渲染为 SVG，并在工具卡片内显示。

## 工作原理

- **宿主半边**（`lib/index.js`）：
  - 注册 `mermaid_render` 工具：接收 Mermaid 源码与主题，调用
    `lib/render.mjs` 在 headless Chromium 中渲染（Mermaid 依赖浏览器 DOM
    布局），把 SVG 存入内存并发布到
    `/plugins/dsh-mermaid-diagram/svg/<id>`（LRU 上限 64 条，重启或淘汰后
    旧地址失效）。
  - 渲染失败时抛出带行号信息的错误，模型可据此修正源码后重试。
- **客户端半边**（`lib/client.js`）：注册 `tool.call.toolview` 的
  `mermaid_render` 键，解析工具结果里的 `SVG:` 引用，把图表绘制在卡片内：
  - 缩放：滚轮（以光标为中心）、+ / − 按钮（100%–400%）、双击复位。
    缩放通过改变 `<img>` 的布局宽度实现，浏览器在每个新尺寸重新矢量渲染
    SVG，任意缩放级别都保持清晰。
  - 平移：按住拖动（缩放超过 100% 时），自动限制在图面范围内
  - 查看 / 隐藏 Mermaid 源码
  - 复制 Mermaid 代码
  - 下载 SVG / 新标签页打开 SVG
  - SVG 地址失效时显示原因与恢复提示，而非空白

## 依赖

- `mermaid`（npm，渲染引擎，随包安装）
- `puppeteer-core`（npm，驱动 headless Chromium，随包安装）
- Chromium 可执行文件：默认在 `~/Library/Caches/ms-playwright/` 的
  `chromium_headless_shell-*` 中查找（playwright 安装的浏览器可直接复用），
  也可用环境变量 `MERMAID_CHROMIUM_PATH` 指定。

## 目录结构

```
dsh-mermaid-diagram/
├── package.json        # dsh.client 元数据 + dsh.bundle.patch 声明 + 依赖
├── cordis.patch.yml    # 插入宿主行（工具注册 + SVG 路由）
├── README.md           # 文档（中文）
├── README.en.md        # 文档（英文）
└── lib/
    ├── index.js        # 宿主半边
    ├── render.mjs      # 渲染脚本（mermaid → SVG）
    └── client.js       # __ModuleLoader__ 格式的浏览器 bundle（手写产物）
```

## 挂载方式

在 profile（如 `~/.dsh/profiles/web`）中声明 link 依赖并把插件加入
`dsh.profile.bundles`：

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

修改组成（bundle 列表）需要重启 `dsh`；`lib/client.js` 与 `lib/index.js` 的
代码修改在重启后自然生效。

## 显示契约

`mermaid_render` 工具结果文本中包含：

```
Rendered mermaid diagram to 638×548px (theme "default"). …
SVG: /plugins/dsh-mermaid-diagram/svg/<id>
```

卡片从中提取尺寸 / 主题信息与 SVG 路径并渲染。
