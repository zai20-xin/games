export interface ObstacleDef {
  pos: [number, number];
  layers: number;
}

/**
 * 目标字段规范（关卡数据格式统一，2026-08-26 收敛）：
 * - score  → target（分数阈值）
 * - collect→ count（收集数量）+ color（棋子颜色索引）
 * - frost  → target（剩余冰霜层数）
 * 加载器对旧数据保持兼容（frost 的 count 会回退读取），但新关卡一律按本规范。
 */
export interface GoalDef {
  type: "score" | "collect" | "frost";
  target?: number;
  count?: number;
  color?: number;
}

export interface RawLevel {
  id: number;
  name: string;
  width: number;
  height: number;
  colors: number;
  moves: number;
  obstacles: ObstacleDef[];
  goals: GoalDef[];
  stars: number[];
  features?: string[];
}

export class LevelData {
  id = 0;
  levelName = "";
  width = 7;
  height = 8;
  moves = 20;
  colors = 5;
  obstacles: ObstacleDef[] = [];
  goals: GoalDef[] = [];
  stars: number[] = [1000, 2000, 3000];
  features: string[] = [];
  sourcePath = "";
  name = "";

  /** JSON 字段名与文件保持一致（id/name/moves/...），运行时以本类字段为准 */
  static fromDict(dict: Record<string, unknown>, path: string): LevelData {
    const d = new LevelData();
    d.id = Number(dict["id"] ?? 0);
    d.name = d.levelName = String(dict["name"] ?? `Level ${d.id}`);
    d.width = Number(dict["width"] ?? 7);
    d.height = Number(dict["height"] ?? 8);
    d.moves = Number(dict["moves"] ?? 20);
    d.colors = Number(dict["colors"] ?? 5);
    d.obstacles = (dict["obstacles"] as ObstacleDef[]) ?? [];
    d.goals = (dict["goals"] as GoalDef[]) ?? [];
    d.stars = (dict["stars"] as number[]) ?? [1000, 2000, 3000];
    d.features = (dict["features"] as string[]) ?? [];
    d.sourcePath = path;
    return d;
  }

  totalFrostLayers(): number {
    return this.obstacles.reduce((sum, o) => sum + o.layers, 0);
  }

  validate(): string[] {
    const errors: string[] = [];
    if (this.id <= 0) errors.push("id 必须为正整数");
    if (this.width < 3 || this.height < 3) errors.push("棋盘尺寸过小");
    if (this.moves <= 0) errors.push("步数必须为正");
    if (this.colors < 3 || this.colors > 6) errors.push("颜色数需在 3~6");
    if (this.goals.length === 0) errors.push("至少需要一个目标");
    if (this.stars.length !== 3) errors.push("星级阈值必须为 3 个");
    const hasObstacles = this.obstacles.length > 0;
    for (const goal of this.goals) {
      if (!["score", "collect", "frost"].includes(goal.type)) {
        errors.push(`未知目标类型: ${goal.type}`);
      }
      if (goal.type === "collect" && (goal.color ?? -1) >= this.colors) {
        errors.push("收集目标颜色超出棋盘颜色范围");
      }
      if (goal.type === "frost" && !hasObstacles) {
        errors.push("无冰关卡不可配置清冰目标");
      }
      if (goal.type === "frost" && !goal.target) {
        errors.push("清冰目标缺少数量（规范字段为 target）");
      }
    }
    return errors;
  }
}
