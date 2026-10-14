#!/bin/bash
# ============================================
#  无限进化 V2.0 — 重构验证脚本
#  检查文件结构、wx 调用清理、HTTP 启动
# ============================================
set -e
cd "$(dirname "$0")"

PASS=0
FAIL=0

check() {
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "✅ $desc"
    PASS=$((PASS+1))
  else
    echo "❌ $desc"
    FAIL=$((FAIL+1))
  fi
}

echo "=== 1. 文件结构 ==="
check "index.html 存在" "test -f index.html"
check "style.css 存在"  "test -f style.css"
check "src/main.js 存在" "test -f src/main.js"
check "src/config.js 存在" "test -f src/config.js"
check "src/utils.js 存在" "test -f src/utils.js"
check "src/entities.js 存在" "test -f src/entities.js"
check "src/systems.js 存在" "test -f src/systems.js"
check "src/renderer.js 存在" "test -f src/renderer.js"
check "src/screen.js 存在" "test -f src/screen.js"
check "audio/ 目录存在" "test -d audio"

echo ""
echo "=== 2. 旧文件已清理 ==="
check "minigame/ 已删除" "test ! -d minigame"
check "open-data/ 已删除" "test ! -d minigame/open-data"
check "game.json 已删除" "test ! -f minigame/game.json"
check "project.config.json 已删除" "test ! -f minigame/project.config.json"

echo ""
echo "=== 3. 入口层无 wx 调用 ==="
WX_ENTRIES=$(grep -rE "wx\." src/config.js src/utils.js src/main.js src/screen.js 2>/dev/null | wc -l)
if [ "$WX_ENTRIES" -eq 0 ]; then
  echo "✅ 入口层零 wx 调用"
  PASS=$((PASS+1))
else
  echo "❌ 入口层发现 $WX_ENTRIES 个 wx 调用"
  grep -rE "wx\." src/config.js src/utils.js src/main.js src/screen.js
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== 4. 业务层无 wx 调用 ==="
WX_BIZ=$(grep -rE "wx\." src/entities.js src/systems.js src/renderer.js 2>/dev/null | wc -l)
if [ "$WX_BIZ" -eq 0 ]; then
  echo "✅ 业务层零 wx 调用"
  PASS=$((PASS+1))
else
  echo "❌ 业务层发现 $WX_BIZ 个 wx 调用"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== 5. 画布尺寸 ==="
DIM=$(grep "const W = " src/config.js | head -1)
if echo "$DIM" | grep -q "1280, H = 720"; then
  echo "✅ 画布 1280x720"
  PASS=$((PASS+1))
else
  echo "❌ 画布尺寸错误: $DIM"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== 6. HTTP server 启动 ==="
python3 -m http.server 8765 --directory . >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8765/ 2>/dev/null || echo "000")
kill $SERVER_PID 2>/dev/null
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ HTTP server 启动正常 ($HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ HTTP server 启动失败 ($HTTP_CODE)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "============================================"
echo "通过: $PASS / 失败: $FAIL"
echo "============================================"

[ $FAIL -eq 0 ] && exit 0 || exit 1
