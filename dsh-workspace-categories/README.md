# dsh-workspace-categories

给 Web 端左侧工作区的**文件夹列表**加上"归类"能力：自定义一棵分类树，把某个工作区文件夹
归到某个分类下，侧边栏就不再是一条很长的工作区列表，而是一棵可控的树。

入口在现有**工作区 header 右侧三颗按钮中间那颗「视图选项」**里：

```
视图选项
├─ 分组方式
│  ├─ 按工作区
│  ├─ 按工作区树
│  ├─ 单列表
│  └─ 按分类          ← 新增
├─ 排序方式
├─ 筛选会话
└─ 管理工作区分类…     ← 新增
```

## 功能

- **按分类浏览**：「视图选项 → 分组方式 → 按分类」后，侧边栏按你定义的分类树显示，
  每个分类下是归入该分类的工作区（工作区行、会话行、菜单、搜索、归档筛选等行为与原来一致）。
- **分类树**：分类可以嵌套；分类行悬停时「+」新建子分类、「…」里可以重命名 / 新建子分类 / 删除，
  新建后直接进入行内命名输入（回车保存、Esc 取消）。分类可以折叠，展开状态按浏览器记住。
- **归类**：把工作区行**直接拖到某个分类行上**即可归入该分类；拖到「未分类」行则取消归类。
  也可以在「管理工作区分类…」对话框里用下拉框逐个指定。
- **未分类**：没有归类的工作区收在「未分类」里，始终排在最后；删除分类时其子分类上移一级、
  其中的工作区回到「未分类」。
- **持久化**：分类树与归属关系由宿主半保存到
  `$DSH_HOME/plugins/workspace-categories/categories.json`（默认 `~/.dsh/plugins/...`，
  可用环境变量 `DSH_WORKSPACE_CATEGORIES_DIR` 改目录），所以换浏览器 / 清缓存都不会丢；
  只有"展开/折叠"状态是浏览器本地的。

## 实现说明（重要）

内置的工作区浏览器 `@deepseek-ai/dsh-client-ui-workspace` 独占 `sidebar.workspaces` 这个
single 槽位，并且自己声明了会话行菜单等子槽位，没有任何可以"在它旁边加一棵树"的扩展点。
因此本插件采取**接管**的方式：

- `cordis.patch.yml` 里 `disabled: true` 掉内置的 `ui-workspace` 行；
- 本插件的 client bundle 是内置 bundle 的 **fork**（`lib/client.js` 头部有来源与改动清单），
  保留搜索、拖拽排序、对话框、快捷键、悬停卡片等全部行为，只叠加分类相关的：
  视图状态里新增 `categoryExpansion`、视图选项里新增两个菜单项、`SessionTree` 里插入分类行与拖放归类、
  以及独立的分类模块（durable store / 分类行 / 归类对话框）；
- 宿主半（`lib/index.js`）只做一件事：把分类树以一个同源 JSON 接口
  `/plugins/dsh-workspace-categories/api`（GET/POST）读写到上面的文件。

**升级 DSH 之后**，如果内置 bundle 有变化，需要按新版
`@deepseek-ai/dsh-client-ui-workspace/lib/client.js` 重新 fork 一遍（改动点见文件头注释，
共 6 处搜索锚点）。卸载本插件后 patch 消失，侧边栏立即回到内置实现。

## 目录结构

```
dsh-workspace-categories/
├── package.json          # dsh.client（web / inject）+ dsh.bundle.patch + locale/icon 导出
├── cordis.patch.yml      # 禁用内置 ui-workspace 行 + 插入本包宿主行
├── lib/index.js          # 宿主半：分类 JSON 接口 + 文件持久化
├── lib/client.js         # 浏览器半：内置工作区浏览器 fork + 分类功能
├── locale/{zh,en}.json   # 插件管理器里的标题/描述
└── icon.svg
```

## 挂载方式

推荐直接用插件管理器安装本地目录（会写 profile 的 `package.json` 与 bundle 列表）：

```
plugin_manager install_bundle  target=/绝对路径/dsh-workspace-categories
```

手动方式（目标 profile，例如 `~/.dsh/profiles/desktop`）：

```jsonc
{
  "dependencies": { "dsh-workspace-categories": "link:/path/to/dsh-plugins/dsh-workspace-categories" },
  "dsh": { "profile": { "bundles": [
    "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-workspace-categories"
  ] } }
}
```

## 已知限制

- 分类视图是"分组方式"的一种，需要先在视图选项里切过去；默认仍是内置的「按工作区」。
- 分类顺序 = 创建顺序（同层按创建先后），暂不支持拖动排序分类本身。
- 归类只接受已注册的工作区；宿主侧会对 JSON 做清洗（悬空父级、环、指向不存在分类的归属会被修正）。
- 本插件目前只提供 UI 操作，没有给 agent 暴露工具（分类是纯视图组织，不改变会话/工作区归属）。
