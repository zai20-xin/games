import { BELT_POOL, type PlantKind } from "../config";
import type { EvolvedPlant } from "../types/dictionaries";
import { PLANTS, FORMS, SKILLS } from "../data/dictionaries";
import { generateMod } from "../engine/modGenerator";

// 传送带出卡系统：随机轮班刷出植物，点点即得（免费），种植后从带上扣一张
// 纯逻辑无场景依赖，可单测

/** 带上的卡槽容量（同时可见可点的植物上限） */
export const BELT_CAPACITY = 8;
/** 刷卡间隔（每张卡入带的时间） */
export const BELT_SPAWN_MS = 4200;

export interface BeltSlot {
  id: number;
  kind: PlantKind;
  evolved?: EvolvedPlant;
}

/** 从池中等概率抽一张卡（rand 可注入以便单测） */
export function pickBeltPlant(pool: PlantKind[], rand: () => number = Math.random): PlantKind {
  return pool[Math.floor(rand() * pool.length)]!;
}

export class Conveyor {
  readonly capacity: number;
  private pool: PlantKind[];
  private slots: BeltSlot[] = [];
  private nextId = 1;

  constructor(capacity: number = BELT_CAPACITY, pool: PlantKind[] = BELT_POOL) {
    this.capacity = capacity;
    this.pool = pool;
  }

  /** 当前带上的卡（队头=最旧，队尾=最新） */
  get list(): readonly BeltSlot[] {
    return this.slots;
  }

  get isFull(): boolean {
    return this.slots.length >= this.capacity;
  }

  /** 入队一张新卡（追加到队尾）。容量已满时挤掉最旧的队头，保持满带。 */
  spawn(rand: () => number = Math.random): BeltSlot {
    if (this.slots.length >= this.capacity) this.slots.shift();
    const kind = pickBeltPlant(this.pool, rand);
    const slot: BeltSlot = { id: this.nextId++, kind };
    // 20% 概率生成进化植物卡（1 个随机形态 + 1 个随机技能）
    if (rand() < 0.2) {
      const form = FORMS[Math.floor(rand() * FORMS.length)];
      const skill = SKILLS[Math.floor(rand() * SKILLS.length)];
      if (form && skill) {
        const basePlant = PLANTS.find((p) => p.id === kind) ?? {
          id: kind,
          name: kind,
          family: "shooter" as const,
          baseStats: { attack: 20, health: 300, speed: 1 },
          cost: 100,
          texture: "pea",
        };
        slot.evolved = {
          base: basePlant,
          mods: [generateMod(form, skill)],
          level: 0,
        };
      }
    }
    this.slots.push(slot);
    return slot;
  }

  /** 拿出 id 对应的一张卡（种植成功后调用），返回拿走的卡，未找到则 undefined */
  take(id: number): BeltSlot | undefined {
    const i = this.slots.findIndex((s) => s.id === id);
    if (i < 0) return undefined;
    return this.slots.splice(i, 1)[0];
  }

  /** 复核状态：确保输出的是同一份列表引用，方便 UI 判等 */
  snapshot(): readonly BeltSlot[] {
    return this.slots;
  }
}