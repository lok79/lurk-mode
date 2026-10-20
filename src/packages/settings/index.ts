/**
 * settings · 深模块入口（公共接口）
 * 开关设置 + 不打扰名单的判定与增删。content script 与 popup 两处的同名逻辑收拢于此。
 * 外部只许 import 本文件（包根 = 入口）；实现在 lib/，规则见 src/packages/README.md。
 */
export {
  DEFAULT_SETTINGS,
  hostOf,
  inOptOutList,
  addToList,
  removeFromList,
  applyChanges,
} from "./lib/list";
export type { LurkSettings } from "./lib/list";
