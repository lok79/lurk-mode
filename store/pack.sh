#!/bin/sh
# 打商店提交包：构建 + 校验 + zip（manifest 必须在包根目录）
# 用法：./store/pack.sh   （在仓库根执行）
# 产物：dist/ 同级的 lurk-mode-<版本>.zip
set -eu
cd "$(dirname "$0")/.."

npm run build

VERSION=$(node -e 'console.log(require("./manifest.json").version)')
grep -q '"update_url"' dist/manifest.json && { echo "错误：dist/manifest.json 含 update_url，Edge 拒审字段，先删除"; exit 1; }

ZIP="lurk-mode-$VERSION.zip"
rm -f "$ZIP"
( cd dist && zip -r "../$ZIP" . -x '.DS_Store' ) >/dev/null
echo "打包完成：$ZIP"
unzip -l "$ZIP"
