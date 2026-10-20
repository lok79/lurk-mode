/**
 * dark-layer · 深模块入口（公共接口）
 * 职责：暗色层（Dark Layer）注入 + 暴露物（Exposure）占位块 + 点击展示（Peek）
 * + 动态内容监听 + 确定性清理。整个引擎收在小接口后面：装配层只见到
 * prime / apply / teardown 三个动作。
 * 外部只许 import 本文件（包根 = 入口）；实现规则见 src/packages/README.md。
 */
export {
  createDarkLayer,
  type DarkLayer,
  type DarkLayerOptions,
} from "./lib/engine";
