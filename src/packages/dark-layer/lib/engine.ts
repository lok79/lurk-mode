/**
 * 暗色层引擎（私有实现，外部经 ../index 使用）
 * 职责：暗色层注入 + 暴露物（img/video/iframe/canvas）占位 + 点击展示（Peek）+ 动态内容监听
 * 0.2.0：账本搬到 DOM（data-lurk 标记），开关双向热切换、清理不依赖内存状态
 * 0.2.3：首帧即最终效果——乐观早期样式 + 同源缓存（首开闪）、新增内容立即摄取（追加闪）
 * 术语见 GLOSSARY.md；规格见 .scratch/dark-browser/spec.md 与 .scratch/lurk-extension/no-flash/spec.md
 */

/** 引擎每次扫描/切换前询问装配层：当前站是否应保持适配 */
export interface DarkLayerOptions {
  /** false = 全局关闭或站点在不打扰名单，引擎即时还原页面 */
  shouldRun(): boolean;
}

export interface DarkLayer {
  /** 启动时调用一次：清扫异常残留 + 按同源缓存乐观注入首帧样式（设置未读回） */
  prime(): void;
  /** 双向热切换入口：shouldRun() 为真即盖章，为假即还原；同时回写同源缓存 */
  apply(): void;
  /** 无条件全部还原并停止监听（storage 读取失败等兜底） */
  teardown(): void;
}

type MediaElement =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLIFrameElement
  | HTMLCanvasElement;

/** 占位块元素上挂的私有字段：Peek 目标与"广告位不可 Peek"标记 */
interface LurkPlaceholder extends HTMLDivElement {
  _lurkAd?: boolean;
  _lurkTarget: MediaElement;
}

/** 媒体元素上回指占位块（收回 Peek 后重新插入用） */
type LurkMediaElement = MediaElement & { _lurkPh?: LurkPlaceholder };

// 清理时只撤这六个——display/padding/border-radius 绝不进这个清单：
// display 可能是站点自己用来隐藏菜单/弹窗的，动了就会"全都弹出来"
const STAMP_PROPS = [
  "background-color", "background-image", "border-color", "box-shadow",
  "text-shadow", "color",
];

// 注：站点自带 !important 规则可能压过这里，真正的兜底是 enforce() 的内联样式
const CSS = `
html{background:#000!important}
::-webkit-scrollbar{width:10px;height:10px;background:#0a0a0c}
::-webkit-scrollbar-thumb{background:#2f2f35;border-radius:5px}
/* 占位块 */
.lurk-ph{position:relative;display:block;background:#26262b!important;border-radius:8px;
  cursor:pointer;overflow:hidden;box-sizing:border-box;
  outline:1px solid #2f2f36!important;outline-offset:-1px}
.lurk-ph-fix{display:inline-block!important;vertical-align:middle;max-width:100%}
.lurk-ph:hover{background:#2d2d33!important}
/* 居中胶囊按钮：👁 点击查看（大占位块） */
.lurk-chip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:999px;
  background:rgba(8,8,10,.55)!important;border:1px solid #3f3f46;
  font:12px/1 -apple-system,"PingFang SC",sans-serif;color:#b9b9c2!important;
  pointer-events:none;white-space:nowrap;transition:border-color .15s,color .15s}
.lurk-chip svg{width:14px;height:14px;flex:none}
.lurk-ph:hover .lurk-chip{border-color:#5f9fdc;color:#ffffff!important}
/* 小占位块：仅图标，不显示文字 */
.lurk-ic{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:16px;height:16px;color:#8a8a94;pointer-events:none}
.lurk-ic svg{width:16px;height:16px}
.lurk-ph:hover .lurk-ic{color:#c9c9c9}
/* 图标描边渲染：白名单化，绕过盖章的颜色规则 */
.lurk-ph svg .lurk-st{fill:none!important;stroke:currentColor!important;
  stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.lurk-ph svg .lurk-fill{fill:currentColor!important}
`;

// 首帧乐观样式：enforce() 内联章的 CSS 版 + 媒体块化，覆盖"设置读回前"的窗口。
// 只盖 enforce 管的六样 + html/body 回填黑；不含伪元素——enforce 也只管元素，
// 保证首帧与最终效果一致，样式移除后不会有伪元素内容二次弹入。
// brightness(0) 让媒体变成保留布局的纯黑块，内容零泄露；sweep 后必须整体移除，
// 否则 Peek 恢复出来的媒体会被压黑（见 sweep 尾部的 removeEarlyStyle）。
const EARLY_CSS = `
html,body{background-color:#000!important}
*{background-color:transparent!important;background-image:none!important;
  border-color:#2a2a2a!important;box-shadow:none!important;text-shadow:none!important;
  color:#c9c9c9!important}
img,video,iframe,canvas{filter:brightness(0)!important}
`;

const EYE_MARK =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path class="lurk-st" d="M12 5C7.2 5 3.3 8.6 1.6 12 3.3 15.4 7.2 19 12 19s8.7-3.6 10.4-7C20.7 8.6 16.8 5 12 5z"/>' +
  '<circle class="lurk-fill" cx="12" cy="12" r="2.6"/></svg>';
const CHIP_SVG = EYE_MARK + "<span>点击查看</span>";
const ICON_SVG = EYE_MARK;

const AD_SRC =
  /doubleclick|googlesyndic|adservice|adsystem|adnxs|adsrvr|\/ad\/|\/ads\/|\/banner/i;

const MEDIA_TAGS = /^(IMG|VIDEO|IFRAME|CANVAS)$/;

export function createDarkLayer(options: DarkLayerOptions): DarkLayer {
  let styleEl: HTMLStyleElement | null = null;
  let earlyEl: HTMLStyleElement | null = null; // 首帧乐观样式，首个 sweep 后移除
  let observer: MutationObserver | null = null;
  const processed = new Set<MediaElement>(); // 已占位的媒体元素（增量扫描用）
  const enforced = new Set<Element>(); // 已盖章元素（增量补章用）
  const shown = new Set<MediaElement>(); // 当前处于 Peek 状态的元素
  let sweepTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------- DOM 账本
  // 盖章必打标记；清理只认 DOM 查询，与内存 Set、脚本实例无关——这是热切换可靠性的根基
  function stamp(el: Element): void {
    el.setAttribute("data-lurk", "1");
  }

  // ---------------------------------------------------------------- 暗色层注入
  function injectStyle(): void {
    if (styleEl && styleEl.isConnected) return;
    document.querySelectorAll("style#lurk-dark").forEach((s) => s.remove());
    styleEl = document.createElement("style");
    styleEl.id = "lurk-dark";
    styleEl.textContent = CSS;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function moveStyleToEndOfHead(): void {
    if (!document.head) return;
    if (styleEl) document.head.appendChild(styleEl);
    if (earlyEl && earlyEl.isConnected) document.head.appendChild(earlyEl);
  }

  function injectEarly(): void {
    if (earlyEl && earlyEl.isConnected) return;
    document.querySelectorAll("style#lurk-early").forEach((s) => s.remove());
    earlyEl = document.createElement("style");
    earlyEl.id = "lurk-early";
    earlyEl.textContent = EARLY_CSS;
    (document.head || document.documentElement).appendChild(earlyEl);
  }

  function removeEarlyStyle(): void {
    document.querySelectorAll("style#lurk-early").forEach((s) => s.remove());
    earlyEl = null;
  }

  // ---------------------------------------------------------------- 同源状态缓存
  // document_start 能同步读到的唯一持久状态；storage.sync 永远是事实源，缓存只决定
  // "设置读回前要不要乐观上首帧样式"。localStorage 与页面共享，键对站点 JS 可见——
  // 插件可被站点探测是产品既定非目标。读写都 try/catch：localStorage 被禁用等异常
  // 环境降级为无缓存，行为同 0.2.2。
  const STATE_KEY = "lurk:state";

  /** 缓存"关"返回 false（不注入任何样式）；无缓存/读失败视为"开"，乐观注入 */
  function readStateCache(): boolean {
    try {
      return localStorage.getItem(STATE_KEY) !== "off";
    } catch {
      return true;
    }
  }

  function writeStateCache(on: boolean): void {
    try {
      localStorage.setItem(STATE_KEY, on ? "on" : "off");
    } catch { /* 降级无缓存 */ }
  }

  // ---------------------------------------------------------------- 内联盖章
  // 内联 !important 优先级高于一切站点样式——暗色层真正的执行者，样式表只管首帧防白闪
  function enforce(root: Element | Document = document): void {
    const els = root.querySelectorAll("*");
    for (const el of els) {
      if (enforced.has(el)) continue;
      enforced.add(el);
      if (shown.has(el as MediaElement)) continue; // Peek 状态：托盘和原始内容不动
      if (el.closest(".lurk-ph")) continue;
      const s = (el as HTMLElement | SVGElement).style;
      s.setProperty("background-color", "transparent", "important");
      s.setProperty("background-image", "none", "important");
      s.setProperty("border-color", "#2a2a2a", "important");
      s.setProperty("box-shadow", "none", "important");
      s.setProperty("text-shadow", "none", "important");
      // 潜水配色：全站文字统一柔和灰，链接不特殊化（悬停时由 JS 临时亮蓝）
      s.setProperty("color", "#c9c9c9", "important");
      stamp(el);
    }
    // 关键回填：上面的循环把 html/body 也打成了内联透明，而内联 !important 会压掉
    // 样式表里的 html{background:#000}——根画布必须显式回填纯黑，否则回落成默认白色
    document.documentElement.style.setProperty("background-color", "#000000", "important");
    if (document.body) document.body.style.setProperty("background-color", "#000000", "important");
  }

  // ---------------------------------------------------------------- 占位块
  function isAdIframe(el: HTMLIFrameElement): boolean {
    const s = (el.src || "") + " " + (el.className || "") + " " + (el.id || "");
    return AD_SRC.test(s);
  }

  function measure(el: MediaElement): { w: number; h: number } {
    const r = el.getBoundingClientRect();
    if (el.tagName === "CANVAS") {
      // canvas 的 width/height 属性是位图尺寸，不是 CSS 尺寸，只信 rect
      const cw = r.width > 2 ? Math.round(r.width) : 0;
      const ch = r.height > 2 ? Math.round(r.height) : 140;
      return { w: cw, h: ch };
    }
    // getAttribute 可能返回 null：parseFloat(null) 与 parseFloat("") 同为 NaN，行为不变
    let w = r.width > 2 ? r.width : parseFloat(el.getAttribute("width") ?? "") || 0;
    let h = r.height > 2 ? r.height : parseFloat(el.getAttribute("height") ?? "") || 0;
    // naturalWidth/Height 只有 img 有（video 是 videoWidth），canvas/iframe 没有：
    // 运行时对它们取到 undefined，走不进这个分支——与 0.2.x 行为一致
    const img = el as HTMLImageElement;
    if ((!w || !h) && img.naturalWidth && img.naturalHeight) {
      const ar = img.naturalWidth / img.naturalHeight;
      if (w && !h) h = w / ar;
      if (!w && h) w = h * ar;
    }
    if (!w || w < 4) {
      const p = el.parentElement ? el.parentElement.clientWidth : 0;
      w = p > 2 ? Math.min(p, 640) : 0;
    }
    if (!h || h < 4) h = el.tagName === "IFRAME" ? 200 : 140;
    return { w: Math.round(w), h: Math.round(h) };
  }

  function skip(el: MediaElement): boolean {
    if (processed.has(el)) return true;
    if (el.closest(".lurk-ph")) return true;
    if (el.tagName === "CANVAS") {
      // canvas 的白色在位图里，是 CSS 查不到的"法外之地"；只处理可见的
      const rc = el.getBoundingClientRect();
      return !(rc.width > 4 && rc.height > 4);
    }
    const nw =
      (el as HTMLImageElement).naturalWidth || (el as HTMLVideoElement).videoWidth || 0;
    const attrW = parseFloat(el.getAttribute("width") ?? "") || 0;
    const attrH = parseFloat(el.getAttribute("height") ?? "") || 0;
    const r = el.getBoundingClientRect();
    const cw = Math.max(nw, attrW, r.width);
    const ch = Math.max(
      (el as HTMLImageElement).naturalHeight || (el as HTMLVideoElement).videoHeight || 0,
      attrH,
      r.height
    );
    // 小图标（≤32px）不处理，保住页面基本功能
    if (cw > 0 && ch > 0 && Math.max(cw, ch) <= 32) return true;
    return false;
  }

  /** 建占位块并接管原元素（纯写入；量尺已在 processBatch 的读阶段完成） */
  function insertPlaceholder(el: MediaElement, size: { w: number; h: number }): void {
    processed.add(el);
    const { w, h } = size;
    const ph = document.createElement("div") as LurkPlaceholder;
    ph.className = "lurk-ph" + (w ? " lurk-ph-fix" : "");
    ph.style.width = w ? w + "px" : "100%";
    ph.style.height = h + "px";
    // canvas 一律只遮不看：位图由站点 JS 任意绘制，Peek 恢复它等于把站点画的
    // 东西（如全页背景动画）原样放回来。图表类站点走不打扰名单。
    const noPeek =
      (el.tagName === "IFRAME" && isAdIframe(el as HTMLIFrameElement)) ||
      el.tagName === "CANVAS";
    if (!noPeek) {
      // 足够大显示胶囊按钮；小占位块只显示图标（文字会溢出），但可点击的暗示不能少
      if (w >= 110 && h >= 56) {
        ph.innerHTML = '<span class="lurk-chip">' + CHIP_SVG + "</span>";
      } else {
        ph.innerHTML = '<span class="lurk-ic">' + ICON_SVG + "</span>";
      }
      ph.addEventListener("click", onPeekClick);
    } else {
      ph._lurkAd = true;
      ph.style.cursor = "default";
    }
    ph._lurkTarget = el;
    (el as LurkMediaElement)._lurkPh = ph;
    // 藏起来前记住站点自己的内联 display（如有）；没有就打空标记，
    // 表示这个元素的 display 归我们管，清理时清掉即可
    if (el.style.display) el.setAttribute("data-lurk-od", el.style.display);
    else el.setAttribute("data-lurk-od", "");
    el.style.display = "none";
    stamp(el);
    if (el.parentNode) el.parentNode.insertBefore(ph, el.nextSibling);
  }

  // ---------------------------------------------------------------- 批量处理：先读后写
  // 过滤与量尺寸是读、补章与插占位是写；先读完所有尺寸再统一写入，把强制回流
  // 压到一次。首次 sweep 与滚动增量（ingest）共用这条路径。

  function processBatch(media: MediaElement[], roots: Element[]): void {
    const fits = media.filter((el) => !skip(el));
    const sizes = fits.map(measure);
    for (const root of roots) enforce(root);
    fits.forEach((el, i) => insertPlaceholder(el, sizes[i]));
  }

  /** 新增内容立即摄取（消灭追加闪）：收集新增媒体交给 processBatch，不等 120ms 去抖 */
  function ingest(added: Element[]): void {
    const media: MediaElement[] = [];
    const seen = new Set<Element>(); // 同批重复报告的节点只处理一次，防双占位块
    for (const root of added) {
      if (MEDIA_TAGS.test(root.tagName) && !seen.has(root)) {
        seen.add(root);
        media.push(root as MediaElement);
      }
      root.querySelectorAll("img,video,iframe,canvas").forEach((el) => {
        if (!seen.has(el)) {
          seen.add(el);
          media.push(el as MediaElement);
        }
      });
    }
    if (media.length) processBatch(media, added);
  }

  function plateFor(el: HTMLImageElement): string | null {
    try {
      const w = el.naturalWidth, h = el.naturalHeight;
      if (!w || !h || w * h > 4e6) return "#8b8b92";
      const k = Math.min(1, 64 / Math.max(w, h));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(w * k));
      cv.height = Math.max(1, Math.round(h * k));
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) return "#8b8b92"; // 拿不到 2D 上下文（极端环境）：按跨域灰处理
      ctx.drawImage(el, 0, 0, cv.width, cv.height);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let aSum = 0, lSum = 0;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255;
        aSum += a;
        lSum += ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255) * a;
      }
      const avgA = aSum / n;
      if (avgA >= 0.92) return null; // 不透明：不需要托盘
      const avgL = lSum / n / Math.max(avgA, 0.02);
      return avgL < 0.5 ? "#ffffff" : "#1c1c22";
    } catch {
      return "#8b8b92"; // 跨域画布被污染等：中性灰，深浅内容都可见
    }
  }

  function onPeekClick(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    const ph = e.currentTarget as LurkPlaceholder;
    if (ph._lurkAd) return;
    const el = ph._lurkTarget;
    collapseAll(); // 同一时刻至多一张处于 Peek 状态
    ph.remove();
    el.style.display = "";
    // 托盘：按图片实际内容选对比色。透明底深色内容→白托盘；浅色内容→暗托盘；
    // 不透明图不需要；跨域无法取色→中性灰（深浅内容都可见）
    if (el.tagName === "IMG") {
      const plate = plateFor(el as HTMLImageElement);
      if (plate) {
        el.style.setProperty("background-color", plate, "important");
        el.style.setProperty("border-radius", "6px", "important");
      }
    } else {
      el.style.setProperty("background-color", "#ffffff", "important");
      el.style.setProperty("padding", "6px", "important");
      el.style.setProperty("border-radius", "6px", "important");
    }
    shown.add(el);
  }

  function collapse(el: MediaElement): void {
    if (!shown.has(el)) return;
    shown.delete(el);
    el.style.display = "none";
    el.style.removeProperty("background-color");
    el.style.removeProperty("padding");
    el.style.removeProperty("border-radius");
    const ph = (el as LurkMediaElement)._lurkPh;
    if (ph && !ph.isConnected) {
      const p = el.parentNode || el.parentElement;
      if (p) p.insertBefore(ph, el.nextSibling);
    }
    if (el.tagName === "VIDEO") {
      try { (el as HTMLVideoElement).pause(); } catch { /* 已断开等：忽略 */ }
    }
  }

  function collapseAll(): void {
    Array.from(shown).forEach(collapse);
  }

  // 点击页面其他位置 → 收回所有 Peek；Esc 同理（常驻监听，无 Peek 时被 size 守卫短路）
  document.addEventListener(
    "click",
    (e) => {
      if (!shown.size) return;
      const target = e.target as Node | null;
      let inside = false;
      shown.forEach((el) => {
        if (target === el || el.contains(target)) inside = true;
      });
      if (!inside) collapseAll();
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") collapseAll();
  });

  // ---------------------------------------------------------------- 链接悬停亮蓝
  // 内联章优先级压过样式表 :hover，所以悬停高亮用事件委托实现；
  // hoverLink 去重：同一链接内部移动鼠标不重复处理
  let hoverLink: HTMLAnchorElement | null = null;

  function applyLinkColor(a: HTMLAnchorElement, color: string): void {
    a.style.setProperty("color", color, "important");
    a.querySelectorAll("*").forEach((el) => {
      if (el.closest(".lurk-ph")) return;
      if (enforced.has(el)) {
        (el as HTMLElement | SVGElement).style.setProperty("color", color, "important");
      }
    });
  }

  document.addEventListener("mouseover", (e) => {
    if (!options.shouldRun()) {
      if (hoverLink) { applyLinkColor(hoverLink, "#c9c9c9"); hoverLink = null; }
      return;
    }
    const a = e.target instanceof Element ? e.target.closest("a") : null;
    if (a === hoverLink) return;
    if (hoverLink) applyLinkColor(hoverLink, "#c9c9c9");
    hoverLink = a;
    if (a) applyLinkColor(a, "#5f9fdc");
  });
  document.documentElement.addEventListener("mouseleave", () => {
    if (hoverLink) { applyLinkColor(hoverLink, "#c9c9c9"); hoverLink = null; }
  });

  // ---------------------------------------------------------------- 扫描与动态监听
  function sweep(): void {
    if (!options.shouldRun()) return;
    enforce(document);
    processBatch(
      Array.from(document.querySelectorAll("img,video,iframe,canvas")) as MediaElement[],
      []
    );
    enforce(document); // 媒体处理可能插入占位块，再把新增节点补一遍
    removeEarlyStyle(); // 首帧窗口结束：占位块已接管，不移除会压黑 Peek 恢复的媒体
  }

  function scheduleSweep(): void {
    if (sweepTimer) return;
    sweepTimer = setTimeout(() => {
      sweepTimer = null;
      sweep();
    }, 120);
  }

  function startObserver(): void {
    if (observer) return;
    observer = new MutationObserver((muts) => {
      // 站点框架（React 等）重渲染时会重写内联样式，把我们的透明盖回白色。
      // 谁 style/class 被改且计算背景色不再透明，就标记为需要重新盖章。
      const added: Element[] = [];
      for (const m of muts) {
        if (m.type === "attributes") {
          const t = m.target;
          if (!(t instanceof Element)) continue;
          if (t.closest(".lurk-ph")) continue;
          if (shown.has(t as MediaElement)) continue; // Peek 托盘不被覆盖
          const bg = getComputedStyle(t).backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)") enforced.delete(t);
        } else if (m.type === "childList") {
          // 自己插的占位块也会触发 childList：closest 守卫挡掉，防止反馈循环
          for (const n of m.addedNodes) {
            if (n instanceof Element && !n.closest(".lurk-ph")) added.push(n);
          }
        }
      }
      if (added.length) ingest(added); // 新增内容立即处理，不等去抖（消灭追加闪）
      scheduleSweep(); // 去抖后统一扫描：补盖被改写的元素 + 全页兜底
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  }

  // ---------------------------------------------------------------- 确定性清理
  // 账本在 DOM：只认查询结果，不认内存 Set，与哪个实例盖的章无关
  function cleanupAll(): void {
    document.querySelectorAll("video[data-lurk]").forEach((v) => {
      const video = v as HTMLVideoElement;
      try { if (!video.paused) video.pause(); } catch { /* 忽略 */ }
    });
    document.querySelectorAll(".lurk-ph").forEach((ph) => ph.remove());
    document.querySelectorAll("style#lurk-dark").forEach((s) => s.remove());
    removeEarlyStyle();
    document.querySelectorAll("[data-lurk]").forEach((el) => {
      STAMP_PROPS.forEach((p) => (el as HTMLElement | SVGElement).style.removeProperty(p));
      // 站点原有的内联 display 原样奉还
      const od = el.getAttribute("data-lurk-od");
      if (od !== null) {
        (el as HTMLElement | SVGElement).style.display = od;
        el.removeAttribute("data-lurk-od");
      }
      el.removeAttribute("data-lurk");
    });
    shown.clear();
    enforced.clear();
    processed.clear();
    if (sweepTimer) { clearTimeout(sweepTimer); sweepTimer = null; }
    if (observer) { observer.disconnect(); observer = null; }
    styleEl = null;
  }

  // ---------------------------------------------------------------- 开关治理
  function setup(): void {
    injectStyle();
    startObserver();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        moveStyleToEndOfHead();
        sweep();
      });
    } else {
      moveStyleToEndOfHead();
      sweep();
    }
  }

  return {
    prime() {
      // 防御性清扫：若页面上有历史残留（异常状态），先扫干净再开工
      if (
        document.querySelector("[data-lurk], .lurk-ph, style#lurk-dark, style#lurk-early")
      )
        cleanupAll();
      // 同源缓存为"关"（上次访问记下的全局关闭/名单内）：完全不上样式，零闪暗；
      // 无缓存/为"开"：乐观注入首帧样式，storage 回来后 apply 纠正并回写缓存
      if (!readStateCache()) return;
      injectEarly();
      injectStyle();
    },
    apply() {
      const run = options.shouldRun();
      writeStateCache(run);
      if (!run) cleanupAll();
      else setup();
    },
    teardown() {
      cleanupAll(); // storage 读取失败：撤样式保页面原样；缓存保留上次值
    },
  };
}
