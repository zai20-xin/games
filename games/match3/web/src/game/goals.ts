export interface GoalSnapshot {
  type: "score" | "collect" | "frost";
  target: number;
  progress: number;
  done: boolean;
  color: number;
}

interface InternalGoal {
  type: "score" | "collect" | "frost";
  target: number;
  progress: number;
  done: boolean;
  color: number;
}

export class GoalTracker {
  goals: InternalGoal[] = [];
  totalScore = 0;

  setup(goalDefs: Record<string, unknown>[]): void {
    this.goals = [];
    this.totalScore = 0;
    for (const def of goalDefs) {
      const kind = String(def["type"]);
      const targetValue =
        def["target"] !== undefined ? Number(def["target"]) : Number(def["count"] ?? 0);
      const goal: InternalGoal = { type: kind as InternalGoal["type"], target: targetValue, progress: 0, done: false, color: -1 };
      if (kind === "collect") goal.color = Number(def["color"]);
      this.goals.push(goal);
    }
  }

  addScore(points: number): void {
    this.totalScore += points;
    for (const goal of this.goals) {
      if (goal.type === "score") this.updateProgress(goal);
    }
  }

  addCleared(color: number, amount: number): void {
    for (const goal of this.goals) {
      if (goal.type === "collect" && goal.color === color) {
        goal.progress += amount;
        this.updateProgress(goal);
      }
    }
  }

  addFrost(amount: number): void {
    for (const goal of this.goals) {
      if (goal.type === "frost") {
        goal.progress += amount;
        this.updateProgress(goal);
      }
    }
  }

  allDone(): boolean {
    if (this.goals.length === 0) return false;
    return this.goals.every((g) => g.done);
  }

  private updateProgress(goal: InternalGoal): void {
    if (goal.type === "score") goal.progress = this.totalScore;
    goal.done = goal.progress >= goal.target;
  }

  snapshot(): GoalSnapshot[] {
    return this.goals.map((g) => ({
      type: g.type,
      target: g.target,
      progress: Math.min(g.progress, g.target),
      done: g.done,
      color: g.color,
    }));
  }
}
