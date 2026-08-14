# dsh-plugins

DeepSeek Harness Web 插件集合。每个插件一个目录，通过 profile 的
`dsh.profile.bundles` 挂载到 `dsh` 进程。

## 插件列表

| 插件 | 说明 | 文档 |
| --- | --- | --- |
| [`dsh-d2-diagram`](./dsh-d2-diagram) | 把 `d2_render` 工具生成的 D2 图表内联显示在对话中，支持缩放、平移、源码查看与下载 | [中文](./dsh-d2-diagram/README.md) · [English](./dsh-d2-diagram/README.en.md) |

## 目录约定

- 每个插件一个目录，例如 `dsh-d2-diagram/`；
- `package.json` 声明 `dsh.client`（Web 客户端入口，`exports["./client"]` 指向 bundle）
  与 `dsh.bundle.patch`（profile bundle 的 patch 层）；
- `cordis.patch.yml` 是 bundle 的 patch 层：纯显示插件通常为空数组，需要宿主行时
  在其中插入；
- `lib/client.js` 由 harness 的 client-modules 服务直接以
  `/plugins/<id>/client.js` 提供，无需构建步骤；
- 每个插件提供 `README.md`（默认中文）与 `README.en.md`（英文）两份文档。

## 挂载方式

在目标 profile（如 `~/.dsh/profiles/web`）中声明 link 依赖并把插件加入
`dsh.profile.bundles`：

```jsonc
// ~/.dsh/profiles/web/package.json
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

## 开发与验证

- 修改 `lib/client.js` 后刷新页面即可生效（bundle 以 `no-cache` 提供）；
- 重启 `dsh` 进程后，boot 清单中的 rev 会重新哈希；
- 运行中的进程按启动时记录的路径读取 bundle，文件重建后无需重启即可被服务。
