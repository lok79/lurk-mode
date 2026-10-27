#!/usr/bin/env node
/**
 * 发版验收清单 · 机器项自动化（docs/acceptance.md 的可机判子集）
 *
 * 用法：
 *   npm run build
 *   "Google Chrome for Testing" --headless=new --user-data-dir=/tmp/lurk-acc \
 *     --no-first-run --disable-sync \
 *     --disable-extensions-except=dist --load-extension=dist \
 *     --remote-debugging-port=9222 about:blank &
 *   node scripts/acceptance-run.mjs http://127.0.0.1:9222 /tmp/lurk-acceptance
 *
 * 注意：品牌版 Chrome（stable/beta）自 137 起静默忽略 --load-extension，
 * 必须用 Chrome for Testing / Chromium / Canary，否则全站假阴性（2026-10-22 首跑教训）。
 *
 * 产出：结果 JSON（stdout 与 <outDir>/results.json）+ 各站截图 jpg。
 * 全新 profile 即默认开启，全程不碰 popup——跑通本身就覆盖 T3。
 * 人工项（老板测试、登录场景、SaaS 双站、T1/T2、灰度终审）仍需按清单手跑。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:9222";
const OUT = process.argv[3] ?? "/tmp/lurk-acceptance";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const list = await (await fetch(`${BASE}/json/list`)).json();
  let page = list.find((t) => t.type === "page");
  if (!page) {
    page = await (
      await fetch(`${BASE}/json/new?about:blank`, { method: "PUT" })
    ).json();
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let nextId = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++nextId;
      pending.set(id, (m) =>
        m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result),
      );
      ws.send(JSON.stringify({ id, method, params }));
    });
  const waitForEvent = async (name, timeout = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const i = events.findIndex((e) => e.method === name);
      if (i >= 0) return events.splice(i, 1)[0];
      await sleep(100);
    }
    return null;
  };
  return { send, waitForEvent, events };
}

const { send, waitForEvent, events } = await connect();
await send("Page.enable");
await send("Runtime.enable");
// 视口必须在首个截图前设置，且每个 CDP 会话都要重设（会话断开即失效）
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});

// 验收清单的机器可判表达式：暗色层在、早期样式无残留、根画布中性黑、正文灰、媒体零暴露、占位块计数
const CHECK = `(() => {
  const media = [...document.querySelectorAll('img,video,iframe,canvas')];
  const visibleMedia = media.filter(el => {
    if (getComputedStyle(el).display === 'none') return false;
    const r = el.getBoundingClientRect();
    return Math.max(r.width, r.height) > 32;
  }).length;
  return {
    dark: !!document.querySelector('style#lurk-dark'),
    earlyStyle: !!document.querySelector('style#lurk-early'),
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    placeholders: document.querySelectorAll('.lurk-ph').length,
    mediaTotal: media.length,
    visibleMedia,
    title: document.title.slice(0, 60),
  };
})()`;

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  }
  return r.result.value;
}

async function visit(url, settleMs = 4500) {
  events.length = 0;
  await send("Page.navigate", { url });
  await waitForEvent("Page.loadEventFired", 25000);
  await sleep(settleMs);
  return evalJs(CHECK);
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
  writeFileSync(join(OUT, `${name}.jpg`), Buffer.from(r.data, "base64"));
}

const results = {};

// ── #10 阮一峰博客：纯文字基线（无头环境常被反爬墙拦，拦住就转人工）
results.ruanyifeng = await visit("https://www.ruanyifeng.com/blog/");
await shot("10-ruanyifeng");

// ── #8 掘金：Q1 三屏滚动，新增媒体必须即时占位、零闪现；随后 Peek 生命周期
results.juejin = await visit("https://juejin.cn/");
await shot("08-juejin-top");
results.juejinScroll = [];
for (let i = 0; i < 3; i++) {
  await evalJs("window.scrollBy(0, window.innerHeight * 2)");
  await sleep(1800);
  results.juejinScroll.push(await evalJs(CHECK));
}
await shot("08-juejin-bottom");
// Peek：点最大占位块 → 原图恢复（data-lurk-od 且 display≠none），filter 必须是 none
// （防 0.2.3 早期样式压黑 Peek 媒体的回归）。注意 _lurkTarget 在隔离世界，主世界读不到，
// 一律从 DOM 侧（data-lurk-od 属性）判定。
results.juejinPeek = await evalJs(`(() => {
  const phs = [...document.querySelectorAll(".lurk-ph")];
  const ph = phs.map(p => ({ p, r: p.getBoundingClientRect() }))
    .filter(x => x.r.width >= 110 && x.r.height >= 56)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0];
  if (!ph) return { found: false, total: phs.length };
  ph.p.click();
  return { found: true, total: phs.length };
})()`);
await sleep(900);
results.juejinPeekShown = await evalJs(`(() => {
  const img = [...document.querySelectorAll("img")].find(el =>
    el.hasAttribute("data-lurk-od") && getComputedStyle(el).display !== "none");
  if (!img) return { shown: false };
  img.scrollIntoView({ block: "center", behavior: "instant" });
  return { shown: true, filter: getComputedStyle(img).filter,
           w: Math.round(img.getBoundingClientRect().width) };
})()`);
await sleep(1000);
await shot("08-juejin-peek");
results.juejinPeekCollapse = await evalJs(`(async () => {
  document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
  await new Promise(r => setTimeout(r, 500));
  const stillShown = [...document.querySelectorAll("img")].filter(el =>
    el.hasAttribute("data-lurk-od") && getComputedStyle(el).display !== "none").length;
  return { stillShown, earlyStyleBack: !!document.querySelector("style#lurk-early") };
})()`);

// ── #3 GitHub：先 PR 列表页，再进第一个 PR 详情页（URL 从页面事实取，不猜）
results.githubList = await visit("https://github.com/facebook/react/pulls", 4000);
const prHref = await evalJs(
  `[...document.querySelectorAll('a[href*="/pull/"]')].map(a => a.href).find(h => /\\/pull\\/\\d+$/.test(h))`,
);
if (prHref) {
  results.githubPr = await visit(prHref, 4500);
  await shot("03-github-pr");
}

// ── #2 Pinterest：图墙
results.pinterest = await visit("https://www.pinterest.com/", 6000);
await shot("02-pinterest");

// ── #4 ScienceDirect
results.sciencedirect = await visit("https://www.sciencedirect.com/", 5000);
await shot("04-sciencedirect");

// ── #9 B站（未登录）：播放器占位
results.bilibili = await visit("https://www.bilibili.com/", 6000);
await shot("09-bilibili");

// ── Q3 色相：纯白底 google 首页
results.google = await visit("https://www.google.com/?igu=1", 4000);
await shot("q3-google");

// ── #7 Chrome Web Store：平台限制预期——不注入、无残留、页面原样
results.cws = await visit("https://chromewebstore.google.com/", 5000);
await shot("07-cws");

writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
