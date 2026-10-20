<div align="center">

# 🤿 潜水模式 Lurk Mode

**工位摸鱼暗色插件：页面照常用，路过的人什么都认不出**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-下载-green)](<!-- 商店链接待补 -->) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<!-- GIF 占位：docs/assets/lurk-demo.gif（掘金信息流 开/关对比，≤5MB） -->

</div>

## 老板测试

刷掘金刷到一半，老板从背后路过——

- 没开潜水：屏幕上是熟悉的白底红标信息流，配图、头像、标题一览无余。
- 开了潜水：整页保持原布局压平为**纯黑**，图片视频全是灰色占位块。他只看到一个"暗色模式的奇怪网页"，**说不出你在看什么**。

想看某张架构图？点一下占位块，它出现；点别处，它收回。

## 功能

- 🖤 **布局保持暗色化**：不改排版、不重排元素，所有内容压平为纯黑底 + 浅灰字
- 🙈 **媒体占位块**：图片/视频/嵌入默认变占位块，点击临时查看（Peek）
- 📋 **不打扰名单**：重要网站一键恢复原样，名单随 Chrome 账号同步
- ⚡ **双向热切换**：开=即时生效，关=即时还原，无需刷新页面
- 🚫 广告 iframe 同样被占位——顺便眼不见为净

## 安装

**Chrome 商店**：[链接待补]

**手动安装（开发者模式）**：

```bash
git clone https://github.com/lok79/lurk-mode.git
cd lurk-mode && npm install && npm run build
```

Chrome → `chrome://extensions` → 开启"开发者模式" → "加载已解压的扩展程序" → 选 `dist/` 目录。

## 隐私

不收集、不上传任何数据，无服务器。详见 [隐私政策](<!-- 待补 -->)。

---

**千万不要让老板知道。**
