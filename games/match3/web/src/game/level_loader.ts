import { LevelData, RawLevel } from "./levels";

/** Node/Vitest：直接读盘 */
export async function loadAllFromDisk(levelsDir: string): Promise<LevelData[]> {
  const { readdir, readFile } = await import("fs/promises");
  const path = (await import("node:path")) as typeof import("node:path");
  const names = (await readdir(levelsDir)).filter((f) => f.endsWith(".json") && f !== "index.json");
  const result: LevelData[] = [];
  for (const name of names) {
    const text = await readFile(path.join(levelsDir, name), "utf-8");
    const raw = JSON.parse(text) as RawLevel;
    const data = LevelData.fromDict(raw as unknown as Record<string, unknown>, name);
    if (data !== null) result.push(data);
  }
  result.sort((a, b) => a.id - b.id);
  return result;
}

/** 浏览器：vite 内联关卡（零网络请求，file:// 与沙箱兼容） */
export async function loadAllFromWeb(): Promise<LevelData[]> {
  // 注意：不用 ?raw——vite5 对 .json + ?raw 在 dev 下返回 application/json，浏览器按 module 解析报 MIME 错。
  // 用 vite 原生 JSON import（glob eager + import:"default"），dev 下 MIME 为 JS 模块，build 同样内联。
  const raw = import.meta.glob("./levels-data/*.json", {
    import: "default",
    eager: true,
  }) as Record<string, Record<string, unknown>>;
  const levels: LevelData[] = [];
  for (const [path, dict] of Object.entries(raw)) {
    if (path.endsWith("index.json")) continue;
    const d = LevelData.fromDict(dict, path);
    if (d) levels.push(d);
  }
  levels.sort((a, b) => a.id - b.id);
  return levels;
}
