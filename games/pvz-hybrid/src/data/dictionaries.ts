// 字典数据加载器
// 统一管理所有字典数据的导入

import type { PlantDef, FormDef, SkillDef, ComboDef } from "../types/dictionaries";

import plantsJson from "../data/plants.json";
import formsJson from "../data/forms.json";
import skillsJson from "../data/skills.json";
import combosJson from "../data/combos.json";

export const PLANTS: PlantDef[] = plantsJson as PlantDef[];
export const FORMS: FormDef[] = formsJson as FormDef[];
export const SKILLS: SkillDef[] = skillsJson as SkillDef[];
export const COMBOS: ComboDef[] = combosJson as ComboDef[];

// ─── 辅助查询函数 ───

export function getPlantDef(id: string): PlantDef | undefined {
  return PLANTS.find((p) => p.id === id);
}

export function getFormDef(id: string): FormDef | undefined {
  return FORMS.find((f) => f.id === id);
}

export function getSkillDef(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function getComboDef(id: string): ComboDef | undefined {
  return COMBOS.find((c) => c.id === id);
}
