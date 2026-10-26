# Edge 加载项 · 商店提交清单（Microsoft Partner Center）

材料就绪（2026-10-26）。提交地址：Partner Center → Edge Add-ons 新建扩展。
依据：[调研](../../../research/edge-addons提审要求调研-2026-10-26.md)（官方一手来源，2026-10 时点）。表单字段名以 Partner Center 实际界面为准。

## 已完成的包检查

- [x] manifest 无 `update_url` 字段（Edge 迁移硬要求）
- [x] name/description 无 "Chrome" 字样（官方明说含 Chrome 字样不过审）
- [x] 无远程代码、零网络请求（src 全文 grep 核实）
- [x] MV3、图标 16/48/128 在包内、版本 0.2.3
- [x] 打包脚本 `store/pack.sh`（构建 + update_url 校验 + zip，manifest 在包根）

## A. 账号注册（只有仓库主人能做，一次性）

1. 用 Microsoft 账户（Outlook/Live/Hotmail）或 **GitHub 账号登录** [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview)
2. Account settings → Programs → **Microsoft Edge** 卡片 → Get started
3. 账户类型选 **Individual**（个人验证只查发布者显示名，很快）
4. **Account country/region 选"中国"——注册后只读，一次选对**
5. 等验证通过（微软邮件注意垃圾箱）

## B. 提交表单逐字段

### Properties

| 字段 | 内容 |
|---|---|
| 显示名称 | 潜水模式 Lurk Mode - 摸鱼暗色浏览器插件（来自 manifest，不可改） |
| 短描述 | 来自 manifest description，不可改 |
| 类别 Category（必填） | 生产工具（Productivity）；备选辅助工具（Accessibility） |
| 网站 Website（可选） | https://github.com/lok79/lurk-mode |
| 支持联系方式（可选，建议填） | 2401789207@qq.com（⚠ 仓库主人确认后用） |

### Privacy 页（五项，官方警告：披露不实可致拒审）

| 项目 | 填写 |
|---|---|
| **Single Purpose（必填）** | 为用户浏览的任意网页提供保持原布局的暗色化呈现，降低强光页面刺激与旁人窥屏干扰；属本地样式呈现功能，不改变、不上传任何页面内容。 |
| **Permission justification（必填，逐权限）** | 见下 |
| Remote code？ | **No**（MV3 禁止远程代码，选 No 即可） |
| Data usage | 勾选"不收集任何数据"类目 + 勾选认证声明 |
| Privacy policy URL | https://github.com/lok79/lurk-mode/blob/main/PRIVACY.md （虽是条件必填，建议提供） |

**Permission justification 逐条：**

- **storage**：仅在本地保存用户的两个偏好——全局开关状态与不打扰名单域名列表，存于 `storage.sync` 随浏览器账号同步；开发者无任何途径读取，不上传任何数据。
- **tabs**：仅在用户点击扩展弹窗时读取当前活动标签页的域名，用于展示"本站开关"（将当前站点加入/移出不打扰名单）；不读取、不存储、不上传浏览历史或页面内容。
- **内容脚本 `<all_urls>`**：产品核心承诺是"任意网页打开即暗、无需逐站配置"，暗色化与媒体占位必须在所有网页即时注入本地样式才能实现；不收集、不传输任何站点数据。

### Store listing

| 字段 | 内容 |
|---|---|
| 描述 Description（必填，**≥250 字符**，现稿 498 ✓） | 见下 |
| 商店 logo（每语言必填，300x300） | `store/icon-300.png` |
| 截图（可选，**最多 6 张，精确 1280x800**） | `store/screenshots/` 5 张，建议顺序：07（对比主图）→ 05（弹窗）→ 02（GitHub）→ 03（文字站）→ 04（滚动流） |
| 搜索词（可选，≤7 条、合计≤21 词、每条≤30 字符） | 潜水模式；摸鱼；暗色模式；深色模式；护眼；防偷看；老板键 |
| 可见性 | **Public**；Markets 默认全部 |

**详细描述（复制粘贴）：**

```text
工位摸鱼暗色插件：页面照常用，路过的人什么都认不出。

刷资讯刷到一半，老板从背后路过——
没开潜水：屏幕上是熟悉的白底信息流，配图、头像、标题一览无余。
开了潜水：整页保持原布局压平为纯黑，图片视频全是灰色占位块。他只看到一个"暗色模式的奇怪网页"，说不出你在看什么。

想看某张图？点一下占位块，它出现；点别处，它收回。

■ 功能

🖤 布局保持暗色化：不改排版、不重排元素，所有内容压平为纯黑底 + 浅灰字
🙈 媒体占位块：图片/视频/嵌入默认变占位块，点击临时查看
📋 不打扰名单：重要网站一键恢复原样，名单随浏览器账号同步
⚡ 双向热切换：开=即时生效，关=即时还原，无需刷新页面
🚫 广告 iframe 同样被占位——顺便眼不见为净

■ 特点

· 装上即用：默认全局开启，任何网页打开即暗，无需逐站配置
· 零网络请求：全部处理在本地完成，没有服务器，不上传任何数据
· 极致轻量：不足 20KB，无后台常驻，不拖慢浏览器

隐私政策：https://github.com/lok79/lurk-mode/blob/main/PRIVACY.md

千万不要让老板知道。
```

### Notes for certification（给审核员的备注，降低来回）

```text
测试步骤：安装后打开任意普通网页（如 juejin.cn、github.com），页面立即呈现保持原布局的暗色化（纯黑底、媒体为占位块）；点击工具栏弹窗可全局开关或按站点开关，切换即时生效、无需刷新；点击占位块可临时查看原图。

权限说明：storage 仅存本地偏好；tabs 仅用于弹窗识别当前站点域名；<all_urls> 注入为实现"任意网页打开即暗"的核心功能。

本扩展无后台脚本、零网络请求、无远程代码、无账号体系，纯本地运行。
```

## C. 提交后

- 状态跟踪：Partner Center Overview（In review → In the store）
- 时效预期：官方上限 7 个工作日；2026-09 官方承认积压，**按 1–2 周做预期**
- 超 7 个工作日催办：ext_dev_support@microsoft.com（附扩展名与提交号）
- 被拒（Review failed）：按反馈修正重提；若被标恶意（官方不公布触发规则），先按政策 1.2.2 自查披露一致性再联系支持
- 上架后：把 listing URL 回填 README.md 徽章与"安装"节（当前是"链接待补"占位），并回写本工单
