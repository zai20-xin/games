# 热血足球·射门挑战

热血风格足球射门挑战网页小游戏（index.html + js/ ES 模块静态实现）。

## 操作

- W/S：调整射门高低；A/D：左右瞄准
- 空格：按住蓄力，满槽放必杀射门（超必杀阈值变橙）
- C：局内切换必杀技（13 队各不同）；P：暂停；R：重开

## 存档

- 历史最佳连击/等级存 `localStorage` 的 `football-shootout:save`
- 上次选择的射手队伍存 `football-shootout:settings`

## 结构

- `js/config.js` 球场与数值配置 · `js/fx.js` 特效系统（粒子/屏震/屏闪）· `js/save.js` 本地存档 · `js/main.js` 主逻辑
