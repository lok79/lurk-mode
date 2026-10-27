# lurk-extension · Agent 指南

暗色摸鱼浏览器插件（Chrome MV3）。术语见 [GLOSSARY.md](./GLOSSARY.md)；规格见 [../.scratch/dark-browser/spec.md](../.scratch/dark-browser/spec.md)；决策见 [docs/adr/](./docs/adr/)；发版（版本号变更）前过一遍手工验收清单 [docs/acceptance.md](./docs/acceptance.md)。

## 命令

- `npm run build`：esbuild 打包 + 拷静态资源 → `dist/`。**Chrome 加载的是 `dist/`**，勿手改 dist 内文件。
- `npm run check`：typecheck（tsc strict）+ lint:boundaries（架构边界）。**每轮改动后必跑，失败修到通过为止。**
- `npm run lint:boundaries`：单独跑边界检查。

## 结构

- `src/content.ts`、`src/popup.ts`：装配层——只写 chrome.* 胶水（storage 读写、事件绑定），不写业务逻辑。
- `src/packages/`：业务包，全部是深模块——加包或 import 前先读 [src/packages/README.md](./src/packages/README.md)。
  - `dark-layer/`：暗色层引擎（注入/占位块/Peek/清理）。
  - `settings/`：开关设置 + 不打扰名单纯逻辑（content 与 popup 共用）。
  - `example/`：复制模板，可删。
- `manifest.json`、`popup.html`、`icons/`：静态源文件，构建时原样拷进 `dist/`（manifest 里的路径相对 dist 根）。

## 红线（改前先读）

- 占位块 / Peek / 清理的 DOM 账本语义（`data-lurk` 标记、清理只认查询结果、不依赖内存状态）是双向热切换可靠性的根基，见 `src/packages/dark-layer/lib/engine.ts` 顶部与 cleanupAll 注释。
- 外部只能 import 包的入口文件（包根目录的文件），子目录一律私有——违反会被 `npm run check` 拦下。
- TypeScript strict；不加 path alias；风格类规则交给工具，不写进文档。
