# Harness 适配预览 · 0.6.0

打开 [无遮盖聊天预览](http://127.0.0.1:5174/harness.html)。这是一页独立的本地布局/交互预览，不是用户真实的 DSH 会话；不连接模型，不读写真实聊天。

## 当前版本

按用户确认的效果保存默认值：水上33%、亮度97%、饱和度111%、柔化0.3px、安静游动开启、动画播放、壁纸显示；正文始终直显无遮罩。固定一套深海色界面，保留无遮盖的正文、侧栏、标题、输入与代码区域。小型设置弹窗仍有自身表面，便于操作。

之前调低透明度却仍看不到海洋，是保护性CSS规则在当前浏览器环境下把阅读底色强制变成了实色。该规则已经移除，浏览器实查正文背景为 `none / rgba(0,0,0,0)`。

聊天内容在自己的滚动区域内，输入框置于其外，因此透明输入区也不会让旧回复文字与草稿叠在一起。默认保持用户确认的无遮挡效果。

壁纸设置可调整八个时刻、28%/33%/38.2%构图、亮度、饱和度、柔化、安静游动和暂停。滤镜只作用于背景iframe，文字与控件不参与滤镜。背景不接收鼠标、滚轮或键盘焦点。安静游动将整套模拟放慢为0.72倍，体态和推进仍保持同一时间尺度。

调整会自动保存在当前浏览器，刷新后保留；“恢复默认参数”可回到这组数值。移除了预览页每次挂载时强制重置滤镜的逻辑。首次启用的海洋时刻随当地时间，用户手动选择后保留其选择。

月亮顶部曾落在52px的预览工具栏后面。现在通过 `--orca-top-inset` 让海洋画布避开工具栏，月亮完整显示；没有改变虎鲸运动或单独挪动月亮。原生接入时用同一变量对应真实标题栏高度。

完整默认配置见 `dsh-plugin/default-settings.json`；交给DSH的文件映射、设置持久化、画布留位及验收要点见 [DSH-HANDOFF.md](DSH-HANDOFF.md)。

## 接入依据

已查看外层 `research/dsh-code-study-2026-11-02/`，并重新读取官方的：

- [AppFrame与布局属性](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-layout/src/client/AppFrame.tsx)：背景使用独立底层，保留现有列、拖动和窗口操作。
- [ConversationContent](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx)：使用实际的 `data-conversation-content`、`data-composer-seat` 等属性，不依赖CSS哈希。
- [ThemeRuntime](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-theme/src/client/index.ts)：侧栏颜色通过拥有独立disposer的token层管理，停用恢复原值。

预览页直接加载同一份 `dsh-plugin/client.js`，为它提供最小主题服务及本地示例布局，避免另画一张与插件无关的假效果图。

## 验证与边界

已在浏览器中查看透明背景，检查过草稿跨壁纸设置保留、文字滤镜为none、文字不透明度为1、背景点击穿透。0.5.1/0.5.3 生产构建实测恢复默认后为33%/97%/111%/0.3px，亮度改为96%后刷新仍保留；恢复默认可回到97%。月亮完整可见，控制台无错误。截图保存在 `docs/review-frames/harness-defaults-0.5.1.png`。

十一组自动验收通过，包含20分钟生态、默认JSON与运行时一致性、原生/预览设置持久化及恢复默认、单字段写入（不会串改其它设置）、重复挂载、旧实例清理、第三方主题层保留和静态资源类型。类型检查及生产构建通过。

预览界面用于构图和可读性判断，实际宿主仍保留其原有聊天业务、字体和交互。0.6.0 已在用户的真实 DSH 桌面 0.2.0-rc.2 本地 profile 实装：插件被宿主 loader 启用、静态资源路由 200、客户端 bundle 进入宿主 boot 组合、`harness.log` 无本插件错误。原生设置页（`Config` schema + `plugins.bundle.config` / `plugins.row.config` 卡片）已接入，界面级验收（设置卡可见、写入即时生效、持久化）以用户目视确认为准；更高宿主版本或其他主题插件仍可能需要微调表面透明度。

0.6.0 针对左侧导航栏不透明的问题：实测左栏由第三方 @michengai/dsh-codex-ui 的 `.dcu-root` 绘制（dark `#1d2120`），主题 token 无法覆盖。现在壁纸启用时给 `body` 设置 `data-we-sidebar-glass` 并注入 `--we-sidebar-*` 参数，启用该插件自带的玻璃模式（33% 深蓝罩层 + `blur(10px) saturate(1.25)`），停用时恢复原值。无头浏览器 DOM 探针复核：`data-we-sidebar-glass` 生效、`.dcu-root` 背景透明、`.dcu-root::before` 模糊层存在、左侧 340px 内无不透明 painter。

## 动画是否循环

这是实时计算的Canvas场景，不是循环播放视频。鱼群、巡游和事件持续演进，没有固定视频片段首尾拼接。部分节奏和路线会再次出现，不能保证每一帧数学意义上永不重复；重新打开页面也会从初始状态开始。
