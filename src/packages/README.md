# src/packages · 深模块约定

每个子目录是一个**深模块（deep module）**：小接口，大实现。包的**公共面 = 包根目录的文件（入口）**；子文件夹一律私有（约定 `lib/` 放实现、`tests/` 放测试，但任何子目录都是私有的，加新目录不用改配置）。

## 新建包

复制 `example/` 改名即可，形态固定为：

```
src/packages/<name>/
  index.ts        ← 入口（公共）。外部只能 import 这个。
  lib/            ← 实现：私有，包内文件互相 import 随意。
  tests/          ← 同包测试 + fixtures（子目录，所以私有）。
```

包可以暴露**多个小入口**（`index.ts`、`client.ts`…），但**不要用 barrel 文件**（把整个子树 re-export 一遍的巨型 index）——需要新公共面时加一个根文件，而不是往 index 里堆 export。

## 四条规则（dependency-cruiser 强制，违规 `npm run lint:boundaries` 直接红）

1. **入口边界**：包外代码（装配层或其他包）只能 import 包的根文件，永远不许碰子目录内部。
2. **包内自由**：包自己的文件互相 import 不受限。
3. **测试走入口**：`tests/` 可以 import 任何包的入口和自己的 fixtures，但不许 import 任何包的内部实现（自己包的也不行）。
4. **无循环**：禁止依赖环。

## 怎么跑检查

```bash
npm run lint:boundaries   # 只跑架构边界
npm run check             # typecheck + 边界，一起跑
```

设计词汇（module / interface / seam / depth）见 ZCode 的 `codebase-design` skill；给 AI 的项目级指南见本产品目录 [AGENTS.md](../AGENTS.md)（公司级在仓库根）。
