// config.js —— 全局常量与平衡数值表
// 所有可调参数集中于此（balance 数据单一来源），多 agent 调参只改本文件。

// ---- 相机 / 世界 ----
export const CAM_D = 4.3;          // 相机距离（越大透视越平缓、前方更远更开阔；拉远以扩大预判视野，需同步缩小 PLAYER_SCALE 防近景放大）
export const CAM_D_BOOST = 1.70;   // 仅加速/火箭态相机拉近（透视增强，冲刺冲击）；Fever 不拉镜防眩晕
export const CAM_D_LERP = 4;       // 相机距离平滑过渡速率（1/秒）
export const CAM_ROLL_GAIN = 0.35; // 过弯相机 roll 增益（弧度/单位曲率）
export const CAM_ROLL_MAX = 0.055; // 过弯相机 roll 上限（弧度，≈3.1°）
export const CAM_ROLL_LERP = 5;    // 相机 roll 平滑过渡速率（1/秒）
export const LANE_SPACING = 2.15;   // 车道间距（越大滑道越宽）
export const Z_FAR = 24;
export const PLAYER_Z = 1.9;       // 玩家 z 前移（越靠前越靠屏幕中上方，身后雪痕可见窗口越长）
export const PLAYER_SCALE = 0.82;  // 玩家世界尺寸放大系数（镜头推远+人物缩小，整体观感拉开、前景不挡路）
export const COLLIDE_Z = 0.55;
export const HORIZON_SLOPE_K = 26; // 地平线随坡度偏移系数（px/单位坡度）：上坡地平线上抬、下坡下压，坡度感"活"起来

// ---- 雪痕（carving trail）----
export const TRAIL_MAX = 90;             // 轨迹点上限（约 1.5s 历史）
export const TRAIL_SKI_OFF = 0.16;       // 双板两痕的世界横向间距
export const TRAIL_SKI_W = 0.06;         // 双板单痕宽度（世界）
export const TRAIL_BOARD_W = 0.18;       // 单板痕宽度（世界）

// ---- 纵向动作 ----
export const JUMP_DUR = 0.62;
export const CROUCH_DUR = 0.6;
export const MAX_JUMPS = 5;
export const JUMP_DURS = [0.62, 0.56, 0.50, 0.45, 0.40];   // 各段空中时长
export const JUMP_ARCS = [0.95, 0.62, 0.50, 0.42, 0.35];   // 各段弧线高度

// ---- 火车 ----
export const TRAIN_CARS = 5;
export const TRAIN_CAR_SPACING = 0.32;
export const TRAIN_LEN = TRAIN_CARS * TRAIN_CAR_SPACING;

// ---- 雪崩 v2（节日式周期事件：平时隐身，冲击波逼近制造心跳，摔倒磨蹭才危险）----
export const AVALANCHE_WARN_GAP = 2.2;       // 危险红框警告阈值
export const AVALANCHE_MAX_GAP = 18;         // 平时距离（画面外，不绘制不逼近）
export const AVALANCHE_SURGE_MIN_GAP = 4;    // 冲击波期间安全地板（正常滑行绝不死）
export const AVALANCHE_SURGE_IN = 3.5;       // 冲击波逼近速率（gap/秒）
export const AVALANCHE_SURGE_OUT = 6;        // 冲击波退场回满速率
export const AVALANCHE_SURGE_SCORE = 300;    // 零摔倒扛过冲击波的奖励
export const FALL_CATCH_RATE = 2.2;          // 摔倒时雪崩追近速率（唯一真危险）
export const FALL_RECOVER_GAP = 2.5;         // 起身后保底 gap
export const SURGE_DUR = 8;                  // 冲击波时长（秒）
export const SURGE_MIN = 30;                 // 冲击波间隔（秒，随机区间）
export const SURGE_MAX = 45;
// 偶发小雪崩：间歇逼近到安全地板之上一点，制造"真实会被追"的紧张（平时不乱杀，摔倒才致命）
export const MINI_SURGE_MIN = 22;
export const MINI_SURGE_MAX = 38;
export const MINI_SURGE_GAP = 5.5;           // 小雪崩逼近到的 gap（>安全地板 4，需认真应对）

// ---- 连击 / Fever ----
export const FEVER_MAX = 100;
export const FEVER_DUR = 8;
export const COMBO_TTL = 5;                  // 连击有效期（秒）
export const COMBO_SHAKE_GAP = 10;           // 每满 N 连击甩开雪崩
export const COMBO_GAP_BONUS = 2;            // 甩开雪崩奖励 gap
// ---- 空中特技 ----
export const AIR_SPIN_RATE = 7.0;            // 空中按方向键的旋转速度（弧度/秒）
export const AIR_CUT_RATE = 2.4;             // 松手提前落地的削减速率
export const JUMP_BUFFER = 0.16;             // 跳跃缓冲窗口（秒）
export const SCORE_TRICK = 120;              // 每完成一圈翻转的基础分
export const FEVER_END_GAP_BONUS = 3;        // Fever 完整结束奖励 gap
export const LANE_SWITCH_NEAR_WINDOW = 0.5;  // 换道 Near Miss 判定窗口（秒）
export const LANE_SWITCH_NEAR_RANGE = 1.0;   // 换道 Near Miss 判定 z 范围

// ---- 局内道具 ----
export const MAGNET_DUR = 8;
export const DOUBLE_DUR = 30;
export const ROCKET_DUR = 3;
export const MAGNET_RANGE = 7;               // 磁铁吸附 z 范围
export const MAGNET_SNAP = 0.15;             // 磁铁车道吸附到位阈值
// ---- 无敌收敛（避免"无敌太容易获得"）----
export const STAR_INVINC = 2.5;             // 星星给的无敌时长（原 5s，过久）
export const ROCKET_INVINC_GRACE = 0.3;      // 火箭仅给极短入场缓冲（原每帧刷新=全程无敌）

// ---- 分数 / 距离（分离）----
export const DIST_SCALE = 2.2;               // 世界 z → 米
export const SCORE_PER_M = 2.2;              // 每米基础分（与距离同速，Fever 时 ×2）
export const SCORE_COIN = 10;                // 金币基础分（双倍时 ×2）
export const SCORE_NEAR_MISS = 25;           // 擦身每次基础分（× 连击）
export const SCORE_CLEAR = 30;               // 跳过/钻过障碍的专属反馈分（× 连击，强化跳跃/蹲伏操作感）
export const SCORE_TRAIN_JUMP = 150;         // 飞身下车奖励

// ---- 速度 ----
export const SPEED_START = 8.5;              // 开局即有速度感（原 7.5 太拖沓）
export const SPEED_MAX = 12.5;
export const SPEED_ACCEL = 0.55;            // 加快到极速（原 0.32 要 23s）
export const SPEED_RAMP_PER_100M = 0.30;     // 每 100m 速度上限额外提升（难度渐进）
export const SPEED_MAX_CAP = 17.5;             // 速度实际上限
export const BOOST_MULT = 1.32;
export const SLOW_MULT = 0.55;
export const ROCKET_MULT = 1.25;

// ---- 滑道弯道 / 坡度 / 起伏（重构）----
export const CURVE_AMP = 2.4;        // 弯道总幅度（世界横向单位）
export const CURVE_FREQ1 = 0.035;    // 主弯频率
export const CURVE_FREQ2 = 0.061;    // 次级弯
export const CURVE_FREQ3 = 0.11;     // 微调弯
export const CAM_LOOK_AHEAD = 7;     // 相机前瞻距离（越大转向越平滑/滞后）
export const SLOPE_AMP = 0.9;        // 纵坡幅度
export const SLOPE_FREQ1 = 0.02;     // 主坡频率
export const SLOPE_FREQ2 = 0.052;    // 次坡频率
export const BUMP_AMP = 0.7;         // 跳台隆起幅度
export const SLOPE_SPEED_GAIN = 1.4; // 坡度对速度的影响系数（下坡加速/上坡减速）
export const CARVE_RATE = 2.2;       // 压弯需求强度（弯道曲率→所需压弯量）
export const CARVE_PENALTY = 1.8;    // 压弯不足时每帧减速量
export const CARVE_DRIFT = 0.35;     // 压弯不足时横向甩出速度
export const SNOWBOARD_SIDE_ROT = 0.45; // 单板侧身角度（约 26°，3/4 侧背影）

// ---- 障碍/生成（数值收敛：生成间隔与速度曲线全部集中本表，调参只改这里）----
export const SPAWN_GAP_START = 0.55;        // 开局障碍间隔（秒，越小越密）
export const SPAWN_GAP_MIN = 0.4;           // 间隔下限（防后期无解）
export const SPAWN_GAP_PER_M = 0.00006;     // 每米线性加密量
export const SPAWN_GAP_PER_100M = 0.12;     // 每 100m 额外加密量（与速度曲线同步渐进）
export const GAP_LEN = 1.8;                  // 冰裂缝长度（z）
export const GAP_MIN_DISTANCE = 500;         // 冰裂缝出现所需最低距离

// ---- 难度段落化（张弛节奏：喘息→普通→高潮 循环）----
// 一段用"距离"切分，避免随距离线性变难的单调感，制造"高潮时刻"。
export const PHASE = {
  startDist: 300,        // 正式段落化起始距离（教学/开局不分段）
  calmLen: 160,          // 喘息段长度（米）：障碍稀疏，给恢复
  normalLen: 220,        // 普通段长度
  surgeLen: 180,         // 高潮段长度：加速带 + 雪崩猛追 + 障碍密集
  calmSpawnMul: 0.45,    // 喘息段生成密度乘数（更稀疏）
  surgeSpawnMul: 1.5,    // 高潮段生成密度乘数（更密集）
  surgeAvaIn: 7.5,       // 高潮段雪崩逼近速率（比常态 3.5 猛）
  surgeSpeedMul: 1.08,   // 高潮段目标速度乘数（加速带感，原1.18过快）
  surgeBoostDur: 1.4,    // 进入高潮段给的自动加速带时长
};

// ---- 里程碑（即时小目标反馈）----
export const MILESTONE_STEP = 250;           // 每 250m 弹成就并提示提速

// ---- 旗门（滑雪竞速核心元素：穿过旗门得分，红蓝交替）----
export const GATE_DIST = 55;                 // 旗门间隔（米）
export const GATE_SCORE = 30;                // 过门基础分
export const GATE_COMBO_BONUS = 5;           // 连续过门每门递增奖励
export const GATE_HALF_W = 0.85;             // 旗门半宽（世界单位）

// ---- 地形 ----
export const ELEV_PX = 82;
// 雪堤（滑道两侧立体边界，随车道间距缩放）
export const TRACK_EDGE = LANE_SPACING + 0.28;      // 雪堤内边界 worldX
export const TRACK_BANK_FAR = LANE_SPACING + 0.55;  // 雪堤远端 worldX（透视收窄）
export const SCENERY_SPACING = 6;                   // 两侧松树间距（世界 z）

// ---- 倒计时 / 教学 ----
export const COUNTDOWN_TOTAL = 2.4;          // 3-2-1 总时长（0.8s/拍）
export const COUNTDOWN_STEP = 0.8;
export const GO_FLASH = 0.5;                 // "GO!" 闪烁时长
export const TUTORIAL_SPAWNS = 2;            // 教学期受控生成次数（压缩，别拖节奏）

// ---- 装备属性（每套皮肤可在 skins.js 用乘数覆盖）----
export const EQUIP = {
  baseMagnet: 70,     // 基础磁吸半径（世界单位）
  baseCoinX: 1,       // 基础金币倍率
  baseGlide: 0,       // 落地缓冲（0~0.5，减小落地抖动/判定风险）
  baseDodge: 0,       // 闪避加成（0~0.3，换道更快/容错更高）
};

// ---- 单局任务（每局随机抽 3 个）----
export const QUESTS = [
  { id: 'coins',   text: (n) => '收集 ' + n + ' 枚金币',        stat: 'coins',   pool: [60, 90, 120] },
  { id: 'distance',text: (n) => '滑行 ' + n + ' 米',            stat: 'distance',pool: [600, 900, 1200] },
  { id: 'gates',   text: (n) => '穿过 ' + n + ' 个旗门',        stat: 'gates',   pool: [8, 12, 16] },
  { id: 'nearmiss',text: (n) => '擦身 ' + n + ' 次障碍',         stat: 'nearmiss',pool: [10, 16, 22] },
  { id: 'longrun', text: (n) => '连续 ' + n + ' 秒不摔倒',       stat: 'survive', pool: [30, 45, 60] },
  { id: 'fever',   text: (n) => '累计 ' + n + ' 秒疯狂模式',     stat: 'fever',   pool: [8, 12, 16] },
];
export const QUEST_COUNT = 3;
export const QUEST_REWARD = [120, 180, 260];   // 完成 1/2/3 个任务的金币奖励

// ============================================================
//  成瘾机制（可变奖励 / 段位 / 每日挑战 / 连胜）
//  设计：结晶 = 稀缺元货币，与 100 万金币解耦（保住用户设定），
//        靠「慢 + 随机」获取 → 真正的进度门槛与开箱货币。
// ============================================================

// ---- 结晶可变掉落（Skinner 箱核心：概率 + 数量区间）----
// 滑雪：过门 / 擦身触发；打雪仗：击杀触发。r 列 = 稀有度权重。
export const CRYSTAL_DROP = {
  // 基础掉率：大部分时候不掉，偶尔掉 —— 制造「惊喜」而非「应得」
  noneChance: 0.68,
  // 掉到时的稀有度分布与数量
  tiers: [
    { r: '普通', w: 70, min: 1, max: 2 },
    { r: '稀有', w: 24, min: 4, max: 7 },
    { r: '传说', w: 6,  min: 14, max: 26 },
  ],
  // 传说掉落时，有概率直接掉「限定皮肤」（而非纯结晶）—— 额外惊喜层
  legendSkinChance: 0.18,
  legendSkins: ['c_magma', 'c_aurora', 'b_aurora', 'b_galaxy', 'b_ember'],
};

// ---- 宝箱（每局 +1，里程额外给；开箱内容随机）----
export const BOX_GAIN_PER_RUN = 1;            // 每局结束保底 1 箱
export const BOX_GAIN_PER_500M = 1;           // 每滑 500m 额外 1 箱
export const BOX_TABLE = [
  { kind: 'crystal', r: '普通', w: 50, min: 3,  max: 6 },
  { kind: 'crystal', r: '稀有', w: 30, min: 10, max: 18 },
  { kind: 'crystal', r: '传说', w: 10, min: 30, max: 50 },
  { kind: 'skin',    r: '传说', w: 10, skins: ['c_thunder', 'c_dragon', 'c_phoenix', 'c_baihu', 'b_kunlun', 'b_huntian', 'b_jiuxiao'] },
];

// ---- 段位（元成长：累计距离 + 击杀 + 成就点 推导）----
// need = 综合分阈值；reward = 到达即解锁（皮肤/拖尾/称号）
export const TIER_TABLE = [
  { need: 0,     name: '雪场萌新', reward: null },
  { need: 800,   name: '初级滑手', reward: { type: 'crystal', amt: 30 } },
  { need: 2000,  name: '进阶滑手', reward: { type: 'skin', id: 'c_gold' } },
  { need: 4000,  name: '雪道好手', reward: { type: 'crystal', amt: 60 } },
  { need: 7000,  name: '滑行高手', reward: { type: 'skin', id: 'b_gold' } },
  { need: 11000, name: '雪域精英', reward: { type: 'crystal', amt: 100 } },
  { need: 16000, name: '极地王者', reward: { type: 'skin', id: 'c_shadow' } },
  { need: 22000, name: '冰雪传说', reward: { type: 'crystal', amt: 160 } },
  { need: 30000, name: '永恒之巅', reward: { type: 'skin', id: 'b_rainbow' } },
];
// 综合分 = 累计距离*1 + 累计击杀*8 + 成就解锁数*200
export const TIER_W_DIST = 1;
export const TIER_W_KILL = 8;
export const TIER_W_ACH = 200;

// ---- 连胜（损失厌恶：断签清零、奖励递增）----
export const STREAK_BONUS = [0, 20, 35, 55, 80, 120, 170, 240]; // index=连胜天数，封顶
export const STREAK_MAX = 7;

// ---- 每日挑战（社会比较：按日期旋转目标 + 本地 Top10 榜）----
export const DAILY_BOARD_SIZE = 10;
export const DAILY_OBJECTIVES = [
  { id: 'd_gate',  text: '今日目标：单局穿过 12 个旗门',   stat: 'gates',   target: 12, reward: 40 },
  { id: 'd_near',  text: '今日目标：单局擦身 18 次障碍',   stat: 'nearmiss', target: 18, reward: 40 },
  { id: 'd_dist',  text: '今日目标：单局滑行 1000 米',     stat: 'distance', target: 1000, reward: 50 },
  { id: 'd_fever', text: '今日目标：单局累计 12 秒疯狂',   stat: 'fever',   target: 12, reward: 45 },
  { id: 'd_kill',  text: '今日目标：单局击杀 25 只怪兽',   stat: 'kills',   target: 25, reward: 60 },
];
