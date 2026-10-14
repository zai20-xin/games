import { BELT_POOL, type PlantKind, type ZombieKind } from "./config";

export type Terrain = "day" | "night" | "pool";

export interface LevelDef {
  id: string;
  name: string;
  terrain: Terrain;
  totalWaves: number;
  /** 选卡可用池（从中挑选 selectSlots 株） */
  selectable: PlantKind[];
  /** 选卡槽位数量 */
  selectSlots: number;
  /** 关卡专属出怪池（缺省用默认波次演进） */
  zombiePool?: ZombieKind[];
  /** 僵尸速度倍率（夜间提速等） */
  zombieSpeedMul?: number;
  /** 泳池地形的水行（0 起，行内僵尸减速） */
  waterRows?: number[];
}

export const LEVELS: LevelDef[] = [
  {
    id: "day",
    name: "白天草坪",
    terrain: "day",
    totalWaves: 10,
    selectable: [...BELT_POOL],
    selectSlots: 6,
  },
  {
    id: "night",
    name: "幽暗之夜",
    terrain: "night",
    totalWaves: 10,
    selectable: [...BELT_POOL],
    selectSlots: 6,
    zombiePool: ["basic", "cone", "bucket", "runner", "runner"],
    zombieSpeedMul: 1.1,
  },
  {
    id: "pool",
    name: "泳池派对",
    terrain: "pool",
    totalWaves: 10,
    selectable: [...BELT_POOL],
    selectSlots: 6,
    waterRows: [2, 3],
  },
];

export function getLevel(id: string): LevelDef {
  const l = LEVELS.find((l) => l.id === id);
  if (!l) throw new Error(`unknown level: ${id}`);
  return l;
}

/** 泳池水行内僵尸减速倍率 */
export const WATER_SLOW_MUL = 0.55;
