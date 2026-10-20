/**
 * Lurk Mode · 内容脚本（装配层）
 * 职责：从 chrome.storage 读设置 → 驱动暗色层引擎；监听设置变化实现双向热切换。
 * 业务逻辑都在 packages/ 里（dark-layer = 引擎，settings = 名单）；本文件只做装配。
 * 术语见 GLOSSARY.md；规格见 .scratch/dark-browser/spec.md
 */
import { createDarkLayer, type DarkLayer } from "./packages/dark-layer/index";
import {
  DEFAULT_SETTINGS,
  applyChanges,
  inOptOutList,
  type LurkSettings,
} from "./packages/settings/index";

let settings: LurkSettings | null = null;
const host = location.hostname;

/** 开 = 全局启用且当前站不在不打扰名单 */
function isOn(): boolean {
  return !!settings && settings.enabled && !inOptOutList(settings.optOut, host);
}

const layer: DarkLayer = createDarkLayer({ shouldRun: isOn });

// 启动：先防白闪，storage 回来后再决定生效或还原（名单内则拆掉）
layer.prime();
chrome.storage.sync
  .get<LurkSettings>(DEFAULT_SETTINGS)
  .then((s) => {
    settings = { ...DEFAULT_SETTINGS, ...s };
    layer.apply();
  })
  .catch(() => {
    // storage 读取失败（极端环境）：撤掉防白闪的样式，保持页面原样
    layer.teardown();
  });

// 开关双向热切换：开 = 即时盖章；关 = 即时还原。清理基于 DOM 标记（data-lurk），
// 不依赖内存状态，任何实例盖的章都能撤干净（机制见 dark-layer/lib/engine.ts）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  const wasOff = !isOn();
  settings = applyChanges(settings ?? DEFAULT_SETTINGS, changes);
  if (!isOn() !== wasOff) layer.apply();
});
