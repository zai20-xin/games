import type { Mod } from "../types/dictionaries";

export interface CollectionEntry {
  formId: string;
  skillId: string;
  discovered: boolean;
  count: number;
}

export class Collection {
  private entries: Map<string, CollectionEntry> = new Map();
  private fragments = 0;

  constructor() {
    this.load();
  }

  /** Record a fusion result; returns true if newly discovered */
  record(mod: Mod): boolean {
    const key = `${mod.form.id}:${mod.skill.id}`;
    const existing = this.entries.get(key);
    if (existing) {
      existing.count++;
      this.save();
      return false;
    }
    this.entries.set(key, {
      formId: mod.form.id,
      skillId: mod.skill.id,
      discovered: true,
      count: 1,
    });
    this.save();
    return true;
  }

  addFragments(count: number): void {
    this.fragments += count;
    this.save();
  }

  spendFragments(count: number): boolean {
    if (this.fragments < count) return false;
    this.fragments -= count;
    this.save();
    return true;
  }

  getFragments(): number {
    return this.fragments;
  }

  getEntries(): CollectionEntry[] {
    return Array.from(this.entries.values());
  }

  getDiscoveredCount(): number {
    return Array.from(this.entries.values()).filter((e) => e.discovered).length;
  }

  getTotalCombinations(): number {
    return 6 * 8;
  }

  private load(): void {
    try {
      const data = localStorage.getItem("pvz_collection");
      if (data) {
        const parsed = JSON.parse(data);
        this.entries = new Map(parsed.entries ?? []);
        this.fragments = parsed.fragments ?? 0;
      }
    } catch {
      /* ignore */
    }
  }

  private save(): void {
    try {
      localStorage.setItem(
        "pvz_collection",
        JSON.stringify({
          entries: Array.from(this.entries.entries()),
          fragments: this.fragments,
        })
      );
    } catch {
      /* ignore */
    }
  }
}
