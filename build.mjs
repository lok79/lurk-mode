// Lurk Mode 构建脚本：esbuild 打包 TS 入口 → dist/，再拷贝静态资源。
// 产物 dist/ 即 Chrome 开发者模式加载的目录；不要手改 dist 内文件。
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

await build({
  entryPoints: ["src/content.ts", "src/popup.ts"],
  outdir: "dist",
  // content script 不能是 ES module，统一打成立即执行函数
  bundle: true,
  format: "iife",
  target: ["chrome120"],
  sourcemap: false,
  logLevel: "info",
});

mkdirSync("dist", { recursive: true });
cpSync("manifest.json", "dist/manifest.json");
cpSync("popup.html", "dist/popup.html");
cpSync("icons", "dist/icons", { recursive: true });
