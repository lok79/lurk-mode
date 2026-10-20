/**
 * 开关设置与不打扰名单的纯逻辑（无 DOM、无 chrome.*，content 与 popup 共用）。
 * 术语见 GLOSSARY.md：不打扰名单（Opt-out List）= 用户关闭适配的站点集合。
 */

export interface LurkSettings {
  enabled: boolean;
  optOut: string[];
}

export const DEFAULT_SETTINGS: LurkSettings = { enabled: true, optOut: [] };

/** 从 URL 提取主机名；空 URL 或解析失败（chrome:// 等内部页）返回空串 */
export function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** host 是否在名单内：host === d，或 host 是 d 的子域（news.example.com 命中 example.com） */
export function inOptOutList(optOut: string[], host: string): boolean {
  return (optOut || []).some((d) => host === d || host.endsWith("." + d));
}

/** 加入名单（保持既有语义：直接追加，不查重） */
export function addToList(optOut: string[], host: string): string[] {
  return [...optOut, host];
}

/** 移出名单时连同父域条目一起移除：d === host 或 host 是 d 的子域 */
export function removeFromList(optOut: string[], host: string): string[] {
  return optOut.filter((d) => d !== host && !host.endsWith("." + d));
}

/**
 * storage.onChanged 的增量合并，语义同 { ...DEFAULTS, ...current, ...各 key 的 newValue }。
 * 只取 newValue、忽略 oldValue，与 content.js 0.2.x 的合并行为一致。
 */
export function applyChanges(
  current: LurkSettings,
  changes: Record<string, { newValue?: unknown }>
): LurkSettings {
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(changes)) patch[k] = changes[k].newValue;
  return { ...DEFAULT_SETTINGS, ...current, ...patch } as LurkSettings;
}
