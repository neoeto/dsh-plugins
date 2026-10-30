# dsh-workspace-categories

Category tree for the Web sidebar's **workspace folder list**: define your own nested categories, file a
workspace folder under one, and the sidebar stops being one long workspace column.

The entry point is the **middle of the three buttons at the right of the workspace header — View options**:

```
View options
├─ Group by
│  ├─ WorkSpace
│  ├─ Workspace Tree
│  ├─ In one list
│  └─ By category             ← new
├─ Order by
├─ Filter sessions
└─ Manage workspace categories...   ← new
```

## What it does

- **Browse by category**: choosing "By category" renders the sidebar as your category tree; each category
  holds the workspaces filed under it, and workspace rows, session rows, menus, search, and the archive
  filter behave exactly as before.
- **Category tree**: categories nest. Hover a category row for "+" (new subcategory) and a "…" menu
  (rename / new subcategory / delete); a new category opens an inline name field (Enter saves, Escape cancels).
  Categories collapse, and the expansion state is remembered per browser.
- **Filing**: drag a workspace row **onto a category row** to file it there; drag it onto "Uncategorized"
  to clear the filing. The "Manage workspace categories..." dialog offers the same assignment as a dropdown.
- **Uncategorized**: workspaces you have not filed stay under a trailing "Uncategorized" row. Deleting a
  category moves its children up one level and returns its workspaces to "Uncategorized".
- **Persistence**: the tree and the assignments live in
  `$DSH_HOME/plugins/workspace-categories/categories.json` (`~/.dsh/plugins/...` by default; override the
  directory with `DSH_WORKSPACE_CATEGORIES_DIR`), so they survive a cleared browser cache and reach every
  browser pointed at this Host. Only expansion state is browser-local.

## Implementation note

The shipped workspace browser (`@deepseek-ai/dsh-client-ui-workspace`) owns the `single` slot
`sidebar.workspaces` and declares its own session-row child seats, so there is no extension point to add a
tree beside it. This plugin therefore takes that seat over:

- `cordis.patch.yml` sets `disabled: true` on the shipped `ui-workspace` row;
- this package's client bundle is a **fork** of that shipped bundle (provenance and the full change list are
  in the header of `lib/client.js`). Search, drag reordering, dialogs, shortcuts, and hover cards are the
  shipped implementation; the category feature adds `categoryExpansion` to the viewing store, two entries to
  the view-options menu, category rows plus drop-to-file inside `SessionTree`, and a separate category module
  (durable store, category row, assignment dialog);
- the host half only stores the tree: `GET`/`POST /plugins/dsh-workspace-categories/api` over that JSON file.

**After a DSH upgrade**, re-fork from the new
`@deepseek-ai/dsh-client-ui-workspace/lib/client.js` if it changed (the header of `lib/client.js` lists the
search anchors). Removing the plugin removes the patch, and the sidebar returns to the shipped browser.

## Layout

```
dsh-workspace-categories/
├── package.json          # dsh.client (web / inject) + dsh.bundle.patch + locale/icon exports
├── cordis.patch.yml      # disable the shipped ui-workspace row, insert this package's host row
├── lib/index.js          # host half: category JSON API + file persistence
├── lib/client.js         # browser half: forked workspace browser + categories
├── locale/{zh,en}.json   # plugin-manager title/description
└── icon.svg
```

## Installing

Install the local directory through the plugin manager (it writes the profile's `package.json` and bundle
list):

```
plugin_manager install_bundle  target=/absolute/path/dsh-workspace-categories
```

By hand, in the target profile (for example `~/.dsh/profiles/desktop`):

```jsonc
{
  "dependencies": { "dsh-workspace-categories": "link:/path/to/dsh-plugins/dsh-workspace-categories" },
  "dsh": { "profile": { "bundles": [
    "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-workspace-categories"
  ] } }
}
```

## Known limits

- The category view is one of the grouping modes; switch to it from View options (the default stays the
  shipped "WorkSpace" grouping).
- Sibling order is creation order; categories themselves cannot be reordered by dragging yet.
- Only registered workspaces can be filed. The Host sanitizes the JSON on write: dangling parents, cycles,
  and assignments to missing categories are repaired.
- UI only: no agent tool is exposed, because categories are a view organization and change no session or
  workspace ownership.
