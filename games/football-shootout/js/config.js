// =====================================================================
//  热血足球 · 配置与数据（纯常量，无副作用）
// =====================================================================

// ---------- 画布 / 像素渲染 ----------
export const VW = 320, VH = 240;            // 内部分辨率（NES 风）

// ---------- 球场世界（横版）----------
export const FW = 480, FH = 240;            // 横版球场（全高可见）
export const GOAL_LINE = 10;                // 球门线距边缘
export const RIGHT_GOAL_X = FW - GOAL_LINE; // 球门（右侧，挑战方向）
export const GOAL_CY = FH / 2;              // 球门口中心 y
export const KICK_SPOT_X = 165;             // 罚球点 x（中圈外偏右）

// ---------- 13 支国家队（原名 + 必杀射门）----------
export const TEAMS = {
  brazil:    { name:'巴西',   color:'#FFD400', dark:'#1A6E1A', shot:'火球射门',   fx:'fire' },
  usa:       { name:'美国',   color:'#3C6EFF', dark:'#16235E', shot:'龙卷风射门', fx:'tornado' },
  england:   { name:'英格兰', color:'#F2F2F2', dark:'#C8102E', shot:'闪电射门',   fx:'thunder' },
  germany:   { name:'德国',   color:'#DD2222', dark:'#111111', shot:'铁球射门',   fx:'iron' },
  japan:     { name:'日本',   color:'#F2F2F2', dark:'#BC002D', shot:'台风射门',   fx:'typhoon' },
  france:    { name:'法国',   color:'#0055A4', dark:'#FFFFFF', shot:'幻影射门',   fx:'phantom' },
  italy:     { name:'意大利', color:'#0066CC', dark:'#FFFFFF', shot:'黄金射门',   fx:'gold' },
  russia:    { name:'苏联',   color:'#CC0000', dark:'#FFD200', shot:'冰封射门',   fx:'ice' },
  argentina: { name:'阿根廷', color:'#75AADB', dark:'#FFFFFF', shot:'恶魔射门',   fx:'demon' },
  spain:     { name:'西班牙', color:'#E60012', dark:'#FFCC00', shot:'斗牛射门',   fx:'bull' },
  korea:     { name:'韩国',   color:'#003478', dark:'#FFFFFF', shot:'白虎射门',   fx:'tiger' },
  cameroon:  { name:'喀麦隆', color:'#00843D', dark:'#D21034', shot:'丛林射门',   fx:'jungle' },
  mexico:    { name:'墨西哥', color:'#006847', dark:'#FFFFFF', shot:'烈日射门',   fx:'sun' }
};
export const TEAM_KEYS = Object.keys(TEAMS);

// ---------- 参数 ----------
export const CFG = {
  PLAYER_SPEED: 1.15,
  BALL_FRICTION: 0.985,
  BALL_CONTROL_DIST: 11,
  KICK_POWER: 4.0,
  SUPER_POWER: 5.6,
  SUPER_THRESHOLD: 0.62,
  CHARGE_RATE: 1.35,
  GRAVITY: 0.11,
  BALL_BOUNCE: 0.38,
  KICK_HEIGHT: 1.5,
  SUPER_HEIGHT: 2.6,
  PASS_HEIGHT: 1.6,
  PLAYER_R: 8,
  GOAL_HALF_BASE: 28,          // 初始球门半高
  GOAL_HALF_MIN: 14,           // 最小球门半高
  SAVE_CHANCE_BASE: 0.42,      // 基础扑救率，每级 +0.05，封顶 0.85
  GK_REACH_BASE: 8,            // 守门员伸手范围，每级 +1.5
  GK_REACT_BASE: 0.42,         // 守门员跟球反应系数
  SUPER_SAVE_BASE: 0.02,       // 必杀被扑基础率（Lv1 几乎必进）
  SUPER_SAVE_PER_LV: 0.06      // 每级必杀被扑率 +6%（Lv9 约 50%）
};
