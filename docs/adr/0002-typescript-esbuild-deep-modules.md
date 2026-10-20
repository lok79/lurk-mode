# 迁 TypeScript(strict) + esbuild 构建 + 深模块结构，不再零构建纯 JS

0.2.1 前的插件是零构建纯 JS（manifest/popup.html/content.js 直接加载）。为让 AI 迭代有机械质量门、代码结构对 AI 可导航，迁到 TypeScript strict + esbuild 打包 + dependency-cruiser 强制的深模块（deep module）结构。

## Considered Options

- **保持纯 JS + JSDoc 类型（checkJs）**：无构建步骤是优点，但注释啰嗦、插件生态工具链 TS 优先、深模块边界工具（dependency-cruiser 的 TS 解析）收益打折。放弃。
- **TS + 完整插件框架（WXT / vite+crxjs）**：开发体验好（HMR 等），但引入框架约定与魔法，对当前规模过重，且与"深模块包结构"自选形态冲突。放弃。
- **TS strict + esbuild 极简构建（选定）**：esbuild 一个脚本打包 content/popup 两个入口（IIFE，content script 不能是 ES module）+ 拷贝静态资源；`tsc --noEmit` 管类型；dependency-cruiser 四条规则（入口边界/包内自由/测试走入口/无循环）把"只能从包入口 import"变成 `npm run check` 里的机械门禁。代价：开发时多一步 build，Chrome 需改为加载 `dist/`，可接受。

## 后果

- Chrome 开发者模式加载目录从仓库根改为 `lurk-extension/dist/`。
- 门禁命令：`npm run check`（typecheck + 边界），CI 与 pre-commit 后续接入。
- TypeScript 需 pin 在 <7（dependency-cruiser 18 暂不支持 TS7 原生编译器）；TS 未使用的 import 会被编译擦除，故 depcruise 开 `tsPreCompilationDeps`，类型层深 import 同样被拦。
- 已知工具行为：dependency-cruiser 对"从未被使用的 import"不建边（编译后视角）——属预期，真实违规 import 必然被使用。
