import {
  SkillEffect, EffectParams,
  TRAJECTORIES, FORMS, ON_HITS, TRAILS, IMPACTS, PALETTES,
  TRAJECTORY_NAMES, FORM_NAMES, ON_HIT_NAMES, PALETTE_NAMES,
  TRAIL_NAMES, IMPACT_NAMES,
  isConflict,
} from "../data/effect-dimensions";

let idCounter = 0;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pickCompatible<T>(options: T[], avoid: string[], maxTries = 20): T | null {
  for (let i = 0; i < maxTries; i++) {
    const candidate = pick(options) as T;
    let ok = true;
    for (const a of avoid) {
      if (isConflict(a, String(candidate))) { ok = false; break; }
    }
    if (ok) return candidate;
  }
  return pick(options);
}

// ─── 技能名生成 ──────────────────────────────────────

function generateName(effect: SkillEffect): string {
  const palette = PALETTE_NAMES[effect.palette];
  const form = FORM_NAMES[effect.form];
  const trajectory = TRAJECTORY_NAMES[effect.trajectory];

  // 简短好记的组合名
  const patterns = [
    `${palette}${form}`,
    `${trajectory}${form}`,
    `${palette}之${form}`,
    `${form}·${palette}`,
  ];

  return pick(patterns);
}

// ─── 参数生成 ────────────────────────────────────────

function generateParams(effect: SkillEffect): EffectParams {
  const isAOE = effect.onHit === "explode" || effect.form === "nova" || effect.form === "waveform";
  const isDoT = effect.onHit === "dot";
  const isStationary = effect.form === "beam" || effect.form === "column" || effect.form === "nova";

  return {
    damage: isAOE ? rand(10, 25) : rand(15, 40),
    speed: isStationary ? 0 : rand(6, 14),
    size: rand(0.5, 2.0),
    pierceCount: effect.onHit === "pierce" ? randInt(2, 5) : 0,
    chainCount: effect.onHit === "chain" ? randInt(2, 5) : 0,
    splitCount: effect.onHit === "split" ? randInt(2, 4) : 0,
    aoeRadius: isAOE ? rand(40, 120) : isDoT ? rand(30, 80) : 0,
    duration: isDoT ? rand(2, 4) : effect.form === "beam" ? rand(0.5, 1.5) : 3,
    trailLength: effect.trail === "none" ? 0 : randInt(4, 15),
    burstCount: effect.impact === "burst" ? randInt(8, 20) : effect.impact === "shatter" ? randInt(6, 12) : randInt(2, 8),
    rotationSpeed: effect.form === "bolt" ? rand(0.1, 0.3) : effect.trajectory === "spiral" ? rand(0.2, 0.5) : 0,
    waveFreq: effect.trajectory === "wave" ? rand(2, 5) : effect.form === "waveform" ? rand(1, 3) : 0,
    waveAmp: effect.trajectory === "wave" ? rand(20, 60) : 0,
  };
}

// ─── 主生成器 ────────────────────────────────────────

export function generateRandomEffect(): SkillEffect {
  const used = new Set<string>();

  const trajectory = pickCompatible(TRAJECTORIES, [...used]) ?? pick(TRAJECTORIES);
  used.add(trajectory);

  const form = pickCompatible(FORMS, [...used]) ?? pick(FORMS);
  used.add(form);

  const onHit = pickCompatible(ON_HITS, [...used]) ?? pick(ON_HITS);
  used.add(onHit);

  const trail = pick(TRAILS);
  const impact = pick(IMPACTS);
  const palette = pick(PALETTES);

  const effect: SkillEffect = {
    id: `fx_${Date.now()}_${idCounter++}`,
    name: "",
    trajectory,
    form,
    onHit,
    trail,
    impact,
    palette,
    params: { damage: 0, speed: 0, size: 1, pierceCount: 0, chainCount: 0, splitCount: 0, aoeRadius: 0, duration: 3, trailLength: 8, burstCount: 10, rotationSpeed: 0, waveFreq: 0, waveAmp: 0 },
  };

  effect.params = generateParams(effect);
  effect.name = generateName(effect);

  return effect;
}

export function describeEffect(e: SkillEffect): string {
  const parts = [
    PALETTE_NAMES[e.palette],
    FORM_NAMES[e.form],
    TRAJECTORY_NAMES[e.trajectory],
  ];
  if (e.onHit !== "none") parts.push(ON_HIT_NAMES[e.onHit]);
  if (e.trail !== "none") parts.push(TRAIL_NAMES[e.trail] + "尾");
  if (e.impact !== "none") parts.push(IMPACT_NAMES[e.impact] + "效");
  return parts.join(" · ");
}
