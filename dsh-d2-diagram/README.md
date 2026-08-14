# dsh-d2-diagram

DeepSeek Harness Web 插件：把 `d2_render` 工具生成的 D2 图表内联显示在对话页面上。

## 工作原理

- 宿主机侧的 `d2_render` 工具负责生成：把 D2 源码渲染为 SVG，并发布到
  `/plugins/dsh-d2-diagram/svg/<id>`（宿主原生能力，本插件不重复实现）。
- 本包提供客户端半边：注册 `tool.call.toolview` 的 `d2_render` 键，解析工具
  结果里的 `SVG:` 引用，把图表绘制在工具卡片内，并提供：
  - 缩放：滚轮（以光标为中心）、+ / − 按钮（100%–400%）、双击复位。
    缩放通过改变 `<img>` 的布局宽度实现，浏览器会在每个新尺寸重新矢量
    渲染 SVG，任意缩放级别都保持清晰。
  - 平移：按住拖动（缩放超过 100% 时），自动限制在图面范围内
  - 查看 / 隐藏 D2 源码
  - 复制 D2 代码
  - 下载 SVG
  - 新标签页打开 SVG

## 目录结构

```
dsh-d2-diagram/
├── package.json        # dsh.client 元数据 + dsh.bundle.patch 声明
├── cordis.patch.yml    # 空 bundle patch（纯显示插件，无宿主行）
├── README.md           # 文档（中文）
├── README.en.md        # 文档（英文）
└── lib/
    └── client.js       # __ModuleLoader__ 格式的浏览器 bundle（手写产物）
```

## 挂载方式

`dsh-d2-diagram` 在 profile（如 `~/.dsh/profiles/web`）中作为 bundle 声明：

```jsonc
// package.json
{
  "dependencies": {
    "dsh-d2-diagram": "link:/path/to/dsh-plugins/dsh-d2-diagram"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-d2-diagram"]
    }
  }
}
```

`lib/client.js` 由 harness 的 client-modules 服务直接以
`/plugins/dsh-d2-diagram/client.js` 提供，无需构建步骤；修改后刷新页面即可生效。

## 显示契约

`d2_render` 工具结果文本中包含：

```
Rendered d2 diagram to 242×375px (theme "default", layout "dagre"). …
SVG: /plugins/dsh-d2-diagram/svg/<id>
```

卡片从中提取尺寸 / 主题 / 布局信息与 SVG 路径并渲染。
