// ─── 6 维正交技能效果模型 ────────────────────────────

export type Trajectory =
  | "straight"   // 直线
  | "homing"     // 追踪
  | "wave"       // 波浪路径
  | "bounce"     // 反弹
  | "spiral"     // 螺旋
  | "ground"     // 贴地爬行
  | "rain"       // 抛物线雨
  | "return";    // 回旋

export type Form =
  | "arrow"      // 三角箭头
  | "orb"        // 圆形法球
  | "bolt"       // 之字闪电
  | "beam"       // 持续射线
  | "waveform"   // 扇形冲击波
  | "spray"      // 散射粒子
  | "nova"       // 环形脉冲
  | "column";    // 垂直光柱

export type OnHit =
  | "pierce"     // 穿透
  | "chain"      // 连锁
  | "split"      // 分裂
  | "explode"    // 爆炸AOE
  | "dot"        // 持续伤害区域
  | "slow"       // 减速
  | "knockback"  // 击退
  | "none";      // 无特殊

export type TrailType =
  | "glow"       // 光晕尾迹
  | "smoke"      // 烟雾尾迹
  | "spark"      // 火花尾迹
  | "ribbon"     // 彩带尾迹
  | "none";      // 无尾迹

export type ImpactType =
  | "burst"      // 冲击波+碎片
  | "shatter"    // 碎裂
  | "melt"       // 融化下沉
  | "arc"        // 电弧
  | "ripple"     // 波纹
  | "none";      // 无

export type Palette =
  | "fire"       // 火焰
  | "ice"        // 冰霜
  | "lightning"  // 闪电
  | "poison"     // 毒液
  | "physical"   // 物理
  | "arcane"     // 奥术
  | "blood"      // 血腥
  | "shadow";    // 暗影

// ─── 颜色表 ──────────────────────────────────────────

export interface PaletteColors {
  primary: number;
  secondary: number;
  highlight: number;
  glow: number;
  trail: number;
}

export const PALETTE_COLORS: Record<Palette, PaletteColors> = {
  fire:      { primary: 0xff5722, secondary: 0xff9800, highlight: 0xffcc02, glow: 0xff5722, trail: 0xff9800 },
  ice:       { primary: 0x4fc3f7, secondary: 0x81d4fa, highlight: 0xe1f5fe, glow: 0x4fc3f7, trail: 0x81d4fa },
  lightning: { primary: 0x42a5f5, secondary: 0x90caf9, highlight: 0xffffff, glow: 0x42a5f5, trail: 0x90caf9 },
  poison:    { primary: 0x66bb6a, secondary: 0xa5d6a7, highlight: 0xc8e6c9, glow: 0x66bb6a, trail: 0xa5d6a7 },
  physical:  { primary: 0x8d6e63, secondary: 0xbcaaa4, highlight: 0xd7ccc8, glow: 0x8d6e63, trail: 0xbcaaa4 },
  arcane:    { primary: 0xab47bc, secondary: 0xce93d8, highlight: 0xe1bee7, glow: 0xab47bc, trail: 0xce93d8 },
  blood:     { primary: 0xc62828, secondary: 0xef5350, highlight: 0xffcdd2, glow: 0xc62828, trail: 0xef5350 },
  shadow:    { primary: 0x37474f, secondary: 0x546e7a, highlight: 0x78909c, glow: 0x37474f, trail: 0x546e7a },
};

// ─── 数值参数 ────────────────────────────────────────

export interface EffectParams {
  damage: number;
  speed: number;
  size: number;         // 0.5 ~ 2.0
  pierceCount: number;  // 穿透次数 0-5
  chainCount: number;   // 连锁次数 0-5
  splitCount: number;   // 分裂数 0-4
  aoeRadius: number;    // AOE 半径 0-120
  duration: number;     // 持续时间(秒) 0.5-4
  trailLength: number;  // 尾迹长度 0-15
  burstCount: number;   // 爆炸碎片数 0-20
  rotationSpeed: number; // 自转速度
  waveFreq: number;     // 波浪频率
  waveAmp: number;      // 波浪振幅
}

// ─── 完整技能效果 ────────────────────────────────────

export interface SkillEffect {
  id: string;
  name: string;
  trajectory: Trajectory;
  form: Form;
  onHit: OnHit;
  trail: TrailType;
  impact: ImpactType;
  palette: Palette;
  params: EffectParams;
}

// ─── 维度选项列表 ────────────────────────────────────

export const TRAJECTORIES: Trajectory[] = [
  "straight", "homing", "wave", "bounce", "spiral", "ground", "rain", "return",
];

export const FORMS: Form[] = [
  "arrow", "orb", "bolt", "beam", "waveform", "spray", "nova", "column",
];

export const ON_HITS: OnHit[] = [
  "pierce", "chain", "split", "explode", "dot", "slow", "knockback", "none",
];

export const TRAILS: TrailType[] = ["glow", "smoke", "spark", "ribbon", "none"];

export const IMPACTS: ImpactType[] = ["burst", "shatter", "melt", "arc", "ripple", "none"];

export const PALETTES: Palette[] = [
  "fire", "ice", "lightning", "poison", "physical", "arcane", "blood", "shadow",
];

// ─── 中文名映射 ──────────────────────────────────────

export const TRAJECTORY_NAMES: Record<Trajectory, string> = {
  straight: "直线", homing: "追踪", wave: "波浪", bounce: "反弹",
  spiral: "螺旋", ground: "贴地", rain: "雨落", return: "回旋",
};

export const FORM_NAMES: Record<Form, string> = {
  arrow: "箭矢", orb: "法球", bolt: "闪电", beam: "射线",
  waveform: "冲击波", spray: "散射", nova: "脉冲", column: "光柱",
};

export const ON_HIT_NAMES: Record<OnHit, string> = {
  pierce: "穿透", chain: "连锁", split: "分裂", explode: "爆炸",
  dot: "灼烧", slow: "冰冻", knockback: "击退", none: "贯穿",
};

export const TRAIL_NAMES: Record<TrailType, string> = {
  glow: "光晕", smoke: "烟雾", spark: "火花", ribbon: "彩带", none: "无",
};

export const IMPACT_NAMES: Record<ImpactType, string> = {
  burst: "爆裂", shatter: "碎裂", melt: "融化", arc: "电弧", ripple: "波纹", none: "无",
};

export const PALETTE_NAMES: Record<Palette, string> = {
  fire: "烈焰", ice: "冰霜", lightning: "雷电", poison: "剧毒",
  physical: "物理", arcane: "奥术", blood: "血腥", shadow: "暗影",
};

// ─── 冲突规则 ────────────────────────────────────────

export interface ConflictRule {
  a: string;
  b: string;
  reason: string;
}

export const CONFLICTS: ConflictRule[] = [
  { a: "beam", b: "spiral", reason: "射线无法螺旋" },
  { a: "beam", b: "wave", reason: "射线无法走波浪路径" },
  { a: "column", b: "spiral", reason: "光柱无法螺旋" },
  { a: "column", b: "wave", reason: "光柱无法走波浪路径" },
  { a: "ground", b: "rain", reason: "贴地弹无法从天而降" },
  { a: "ground", b: "homing", reason: "贴地弹无法追踪" },
  { a: "nova", b: "straight", reason: "脉冲无直线弹道" },
  { a: "nova", b: "homing", reason: "脉冲无追踪弹道" },
  { a: "spray", b: "homing", reason: "散射弹无法追踪" },
  { a: "spray", b: "return", reason: "散射弹无法回旋" },
];

export function isConflict(dim1: string, dim2: string): ConflictRule | null {
  for (const c of CONFLICTS) {
    if ((c.a === dim1 && c.b === dim2) || (c.a === dim2 && c.b === dim1)) return c;
  }
  return null;
}
