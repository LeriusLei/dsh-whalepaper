# 交给 DeepSeek Harness 的接入说明 · 0.6.1

0.6.1 修复异步设置旧快照导致的回弹/反跳，新增单请求合并保存与失败重试；三头虎鲸均参与约十分钟一次的鲸群明显活动。详情与验证范围见 [CONTROLS-FIX-0.6.1.md](CONTROLS-FIX-0.6.1.md)。以下保留此前的适配记录。

这版海洋画面已由用户确认，默认数值保留。0.5.3 已把设置接入 DSH 原生插件设置页（「设置 → 插件 → 配置 dsh-whalepaper」），0.6.0 起左侧导航栏也随壁纸变化（原生侧栏 token 透明，并对 codex-ui 等自带侧栏表面的插件启用玻璃态），已在用户的 DSH 桌面 0.2.0-rc.2 本地 profile 实装验证：`/ascii-orca/index.html` 返回 200、客户端 bundle 进入宿主 boot 组合、`harness.log` 无本插件报错。安装会修改真实 profile 的 `cordis.patch.yml` 与 `package.json`（dsh.profile.bundles），测试前已备份为 `.bak-*` 文件。

## 0.6.0 变更

1. 包名、插件 id、仓库名统一为 `dsh-whalepaper`（0.5.x 曾用 `dsh-whale-paper`）；内部 DOM id 与资源路由 `/ascii-orca` 保持不变。
2. 删除「阅读方案 preset」与「正文保护 glass」两个旧设置：正文直显无遮罩不再是可调项，旧配置里的这两个字段会被忽略。`Config`、`default-settings.json`、原生设置卡片、`≈` 快速面板同步移除。
3. 修复「改一个控件会顺带改另一个」：面板保存改为每个控件只写自己那个字段；处于防抖中的滑杆值会与紧随其后的开关/下拉写入合并，不会被旧快照覆盖。

## 已确认的默认参数

可直接读取包内 `default-settings.json`（源码路径 `dsh-plugin/default-settings.json`）。格式与预览页“导出配置”一致：`{ version: 2, wallpaper: { ... } }`。

| 设置 | 默认值 | 字段与单位 |
| --- | --- | --- |
| 水上比例 | 33% | `composition: "balanced"`，其余选项 `immersive` 28%、`golden` 38.2% |
| 壁纸亮度 | 97% | `brightness: 0.97` |
| 壁纸饱和度 | 111% | `saturation: 1.11` |
| 壁纸柔化 | 0.3px | `blur: 0.3`，CSS像素 |
| 安静游动 | 开 | `quiet: true`，游动模拟按0.72倍速度推进；明显活动使用独立观看时钟 |
| 暂停动画 | 关 | `paused: false` |
| 显示壁纸 | 开 | `enabled: true` |
| 海洋时刻 | 随当地时间 | `theme: "auto"`，保留八时段手动选择 |

0.6.0 只保留以上 8 项：正文始终直接显示在海洋上（无遮罩开关），预设也只保留这一套默认参数。

截图没有指定固定时段，所以默认仍随设备时间。用户后来手动选择的时段和参数优先于默认值。界面只保留现有单一配色，不增加深浅色切换。

## 设置页接入（0.5.3 已实现）

实现依据：DSH 0.2.0-rc.2 的插件设置服务从插件 `Config` schema 派生设置，表单只展示 `.volatile()` 字段，改动经当前 profile 的 Cordis patch 持久化并热应用。`client.js` 控件、自动保存及“恢复默认参数”按钮保留；预览页和插件使用同一实现，并通过 `ctx.configForms` 读写原生设置。

1. `index.js` 导出 `Config`（8 个 volatile 字段）：`enabled`、`theme`、`composition`、`brightness`、`saturation`、`blur`、`quiet`、`paused`，默认值与 `default-settings.json` 完全一致（brightness 0.97、saturation 1.11、blur 0.3、theme auto）；`apply()` 内以 `ctx.inject(['settings'], …)` 调 `settings.configure({ auto: false }, ctx.fiber)` 声明使用自绘设置页。
2. `client.js` 注册 `plugins.bundle.config`（key=`dsh-whalepaper`）与 `plugins.row.config`（key=`dsh-whalepaper#dsh-whalepaper`）两个设置卡片；卡片为 React 组件，经 `react` / 平台组件 `require` 拿到，含时段、构图、滑杆、开关和恢复默认。宿主角色的 `plugins.bundle.config` 卡片出现在插件详情页，行内“配置…”按钮出现在插件行。
3. 持久化：宿主表单可用时（`mode === 'host'`）`form.mutate([{ op: 'set', path: [key], value }])` 写 profile 设置；恢复默认逐字段 `{ op: 'unset' }`。无宿主表单的环境（`wallpaper/harness.html` 预览）回退 localStorage，真实键 `dsh-whalepaper:v1`、预览键额外带 `:preview-v2`，两者隔离。范围与 `normalize` 对齐：亮度0.60–1.00、饱和度0.30–1.15、柔化0–4px。
4. 滤镜只作用于 `#ascii-orca-background`；不对聊天根节点设置 opacity、filter 或 backdrop-filter。背景 `pointer-events:none`、`tabIndex=-1`，不拦截输入、选字、滚动和快捷键。
5. 右下角 `≈` 面板保留为快速入口，两处共用同一 store 状态，任一处修改即时双向同步；`enabled` 仍负责附加/移除背景以及恢复宿主主题层。

背景iframe接收同源父窗口消息：

```js
frame.contentWindow.postMessage({
  type: 'ascii-orca:configure',
  theme: settings.theme,
  composition: settings.composition,
  motionScale: settings.quiet ? 0.72 : 1,
  paused: settings.paused || !settings.enabled || document.hidden,
}, new URL(frame.src).origin);
```

亮度、饱和度、柔化在父窗口应用；不要把这些数值当成海洋渲染消息字段。`enabled` 还负责附加/移除背景以及恢复宿主主题层，沿用现有 `project()` 和停用清理逻辑。上述消息只更新海洋，不重建聊天。

## 侧栏玻璃态（0.6.0 已实现）

原生左侧栏与标题行由主题 token `--dsw-specific-sidebar-fill` 控制，`overrideTokens` 在壁纸可见时把它设为透明。实测发现第三方插件 `@michengai/dsh-codex-ui` 会接管左侧栏并绘制自己的不透明 `.dcu-root` 表面（dark 为 `#1d2120`），主题 token 影响不到它，这是“壁纸有了但左栏没变”的原因。该插件自带玻璃模式：`body[data-we-sidebar-glass] .dcu-root{background:transparent}` 并用 `.dcu-root::before` 做 `backdrop-filter` 模糊与罩层。

`mount()` 因此记录 `document.body` 上 `data-we-sidebar-glass` 的原值，壁纸启用时设置该属性并注入 `--we-sidebar-blur:10px`、`--we-sidebar-saturate:1.25`、`--we-sidebar-alpha:1`、`--we-sidebar-sheen:.55`、`--we-sidebar-color`（dark `#0b1622` / light `#f8fafc`，light 另给 alpha `.55`），同时补 `html[data-ascii-orca-wallpaper] .dcu-root{background:transparent!important}`。关闭壁纸或停用插件时恢复该属性的原值。不要设置 `data-we-appwindow`，它会让这个玻璃模式的 `backdrop-filter` 失效。

无头浏览器 DOM 探针（Edge headless + CDP，模拟桌面属性）复核结果：`body[data-we-sidebar-glass]` 存在，`.dcu-root` 背景为 `rgba(0,0,0,0)`，`.dcu-root::before` 为 33% 深蓝罩层 + `blur(10px) saturate(1.25)`，左侧 340px 内已无不透明 painter。

## 月亮顶部裁切的修复

原因是预览工具栏占据52px，但iframe内联的 `inset:0;height:100%` 覆盖了样式表原本的顶部留位。月亮已经画出，只是落在实色工具栏后面。

现在iframe使用 `--orca-top-inset` 作为布局钩子：顶部位移为该值，高度减去同一个值。预览设置 `--orca-top-inset:var(--bar)`，工具栏以下才是海洋画布；月亮完整可见，33%水上比例也按可见海洋区域计算。

DSH接入时，如果顶部存在不透明标题栏/工具栏，将这个变量设置为实际占用高度（CSS像素，随布局或缩放更新）；若背景容器本身已避开标题栏，保持默认0px。不要再通过放大图片、`object-fit:cover` 或只移动月亮补偿。iframe内部的ResizeObserver会按实际尺寸重算海天构图，海面反射继续跟随同一片天空。

## 文件与验收

- `client.js`：宿主适配、原生设置卡片、`≈` 快速面板、保存/回退、过滤与清理。
- `index.js` / `cordis.patch.yml`：`Config` schema、原生设置页声明、离线资源路由与插件注册。
- `wallpaper/`：完整构建；`harness.html` 是本地示例，真实接入使用 `index.html`。
- `default-settings.json`：可导入的默认配置；自动测试核对运行时默认值与本文件一致。
- `docs/HARNESS.md`：已核对的宿主契约、验证范围。

本机实装已验证：插件被宿主 loader 启用、`/ascii-orca/index.html` 200、客户端 bundle 进入 `__DSH_BOOT__` 组合、`harness.log` 无本插件错误，测试与构建通过。仍需在用户界面确认：新建会话、长对话滚动、输入草稿、代码复制、设置持久化、暂停/隐藏恢复、插件停用恢复、窄窗口下的月亮，以及「设置 → 插件 → 配置」卡片可见且写入后即时生效。
