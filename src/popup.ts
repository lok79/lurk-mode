/** Lurk Mode · 弹窗（装配层）：全局开关 + 当前站点开关（不打扰名单） */
import {
  DEFAULT_SETTINGS,
  addToList,
  hostOf,
  inOptOutList,
  removeFromList,
  type LurkSettings,
} from "./packages/settings/index";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

async function currentHost(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return hostOf(tab?.url);
}

async function render(): Promise<void> {
  const s = await chrome.storage.sync.get<LurkSettings>(DEFAULT_SETTINGS);
  const host = await currentHost();

  $<HTMLInputElement>("global").checked = !!s.enabled;
  $<HTMLDivElement>("globalRow").classList.toggle("off", !s.enabled);

  if (!host) {
    $("siteName").textContent = "此页面不可用";
    $<HTMLInputElement>("site").disabled = true;
    $<HTMLDivElement>("siteRow").classList.add("off");
    return;
  }
  $("siteName").textContent = host;
  // 站点开关语义：开 = 启用适配；关 = 在不打扰名单里
  const adapted = s.enabled && !inOptOutList(s.optOut, host);
  $<HTMLInputElement>("site").checked = adapted;
}

$<HTMLInputElement>("global").addEventListener("change", async (e) => {
  await chrome.storage.sync.set({ enabled: (e.target as HTMLInputElement).checked });
  await render();
});

$<HTMLInputElement>("site").addEventListener("change", async (e) => {
  const host = await currentHost();
  if (!host) return;
  const checked = (e.target as HTMLInputElement).checked;
  const s = await chrome.storage.sync.get<LurkSettings>(DEFAULT_SETTINGS);
  if (checked) {
    await chrome.storage.sync.set({ optOut: removeFromList(s.optOut, host) });
  } else {
    await chrome.storage.sync.set({ optOut: addToList(s.optOut, host) });
  }
  await render();
});

render();
