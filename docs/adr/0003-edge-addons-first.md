# 首发渠道选 Edge 加载项先行，Chrome Web Store 后续

首个对外分发渠道选 Microsoft Edge 加载项（Edge Add-ons），Chrome Web Store 作为第二站随后提交。决定时间：2026-10-26，仓库主人选定。

## 理由

- **注册免费**：Partner Center 开发者账号注册不收费；Chrome Web Store 有 $5 一次性注册费。首发零成本。
- **审核更快**：Edge 审核通常数天内完成，Chrome 审核周期更长且首次提交常见数周。首发尽快拿到"已上架"的真实里程碑。
- **包零改动**：Edge 是 Chromium 内核，本产品 MV3 包（manifest + content script，无 chrome.* 专属 API 依赖问题）原样可交，理论上传同一份 zip。
- **材料复用**：商店文案、截图、隐私政策、权限说明两个商店通用，先做的投入不浪费。
- **真机已验证**：本机 Edge 对 `--load-extension` 无 Chrome 137+ 那样的静默忽略限制，开发与验收链路（无头截图、验收脚本）在 Edge 上直接可用。

## Considered Options

- **Chrome Web Store 先行**：用户量最大，但有注册费、审核慢，首次上架周期不可控。后补。
- **Edge 先行（选定）**：免费、快、包兼容，先成一次真实上架。
- **双店同时提**：材料相同但账号注册与表单填写并行成本高，且首店审核反馈（若有拒审意见）可直接指导第二店提交。串行。
