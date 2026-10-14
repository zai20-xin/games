import { Match3Board, BoardEvent } from "./board";
import { GoalTracker, GoalSnapshot } from "./goals";
import { LevelData } from "./levels";
import { Pos, Special, hasTile } from "./cells";

export class GameSession {
  board = new Match3Board();
  level: LevelData;
  goals = new GoalTracker();
  movesLeft = 0;
  score = 0;
  finished = false;
  won = false;

  constructor(level: LevelData) {
    this.level = level;
  }

  start(seed = -1): void {
    this.board.setup(this.level.width, this.level.height, this.level.colors, seed);
    this.board.fillFromLayout(this.level.obstacles);
    this.goals.setup(this.level.goals as unknown as Record<string, unknown>[]);
    this.movesLeft = this.level.moves;
    this.score = 0;
    this.finished = false;
    this.won = false;
  }

  playerSwap(a: Pos, b: Pos): { legal: boolean; events: BoardEvent[] } {
    if (this.finished) return { legal: false, events: [] };
    const result = this.board.trySwap(a, b);
    if (!result.legal) return result;
    this.movesLeft -= 1;
    const events = result.events;
    this.digestEvents(events);
    this.evaluateOutcome();
    if (this.won && this.finished && this.movesLeft > 0) {
      const before = events.length;
      this.celebrate(events);
      this.digestEvents(events.slice(before));
    }
    events.push({ type: "outcome", won: this.won, finished: this.finished });
    return result;
  }

  /** 规格要求：胜利后剩余步数逐个转化为条纹棋子统一引爆，庆祝分计入星级 */
  private celebrate(events: BoardEvent[]): void {
    const converted: Pos[] = [];
    while (this.movesLeft > 0) {
      this.movesLeft -= 1;
      const pos = this.board.randomNormalTilePos();
      if (pos.x < 0) break;
      const kind =
        this.board.rng.randiRange(0, 1) === 0 ? Special.STRIPE_H : Special.STRIPE_V;
      this.board.cellAt(pos).special = kind;
      converted.push(pos);
      events.push({ type: "convert", pos, special: kind });
    }
    if (converted.length === 0) return;
    const clearSet = new Map<string, Pos>();
    for (const pos of converted) clearSet.set(`${pos.x},${pos.y}`, pos);
    this.board.expandSpecialEffects(clearSet);
    this.board.applyClearBatch(clearSet, [], 1, events);
    this.board.gravityAndRefill(events);
    this.board.runResolution({ x: -9, y: -9 }, events);
    this.board.ensurePlayable(events);
  }

  private digestEvents(events: BoardEvent[]): void {
    for (const event of events) {
      if (event.type !== "cleared") continue;
      const points = event.points;
      this.score += points;
      this.goals.addScore(points);
      const byColor = new Map<number, number>();
      for (const cell of event.cells) {
        byColor.set(cell.color, (byColor.get(cell.color) ?? 0) + 1);
      }
      for (const [color, n] of byColor.entries()) {
        this.goals.addCleared(color, n);
      }
      const frost = event.frost;
      if (frost > 0) this.goals.addFrost(frost);
    }
  }

  private evaluateOutcome(): void {
    if (this.goals.allDone()) {
      this.finished = true;
      this.won = true;
    } else if (this.movesLeft <= 0) {
      this.finished = true;
      this.won = false;
    }
  }

  useHammer(pos: Pos): { ok: boolean; events: BoardEvent[] } {
    if (this.finished || !this.board.inBounds(pos)) return { ok: false, events: [] };
    const cell = this.board.cellAt(pos);
    if (cell.obstacleLayers <= 0 && !hasTile(cell)) return { ok: false, events: [] };
    const events: BoardEvent[] = [];
    const clearSet = new Map<string, Pos>([[`${pos.x},${pos.y}`, pos]]);
    this.board.expandSpecialEffects(clearSet);
    this.board.applyClearBatch(clearSet, [], 1, events);
    this.board.gravityAndRefill(events);
    this.board.runResolution({ x: -9, y: -9 }, events);
    this.board.ensurePlayable(events);
    this.digestEvents(events);
    this.evaluateOutcome();
    events.push({ type: "outcome", won: this.won, finished: this.finished });
    return { ok: true, events };
  }

  useFreeSwap(a: Pos, b: Pos): { ok: boolean; events: BoardEvent[] } {
    if (this.finished || !this.board.isSwappable(a) || !this.board.isSwappable(b)) {
      return { ok: false, events: [] };
    }
    const events: BoardEvent[] = [{ type: "swap", a, b }];
    this.board.swapData(a, b);
    let involves = false;
    for (const group of this.board.findMatches()) {
      const hitA = group.cells.some((p) => p.x === a.x && p.y === a.y);
      const hitB = group.cells.some((p) => p.x === b.x && p.y === b.y);
      if (hitA || hitB) {
        involves = true;
        break;
      }
    }
    if (involves) {
      this.board.runResolution(b, events);
      this.board.ensurePlayable(events);
      this.digestEvents(events);
      this.evaluateOutcome();
    }
    events.push({ type: "outcome", won: this.won, finished: this.finished });
    return { ok: true, events };
  }

  useShuffleHand(): { ok: boolean; events: BoardEvent[] } {
    if (this.finished) return { ok: false, events: [] };
    const placements = this.board.shuffleBoard();
    return { ok: true, events: [{ type: "shuffle", placements }] };
  }

  starsEarned(): number {
    if (!(this.won && this.finished)) return 0;
    const t = this.level.stars;
    if (this.score >= t[2]) return 3;
    if (this.score >= t[1]) return 2;
    return 1;
  }

  goalSnapshots(): GoalSnapshot[] {
    return this.goals.snapshot();
  }
}
