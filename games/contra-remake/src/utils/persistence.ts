const KEY = 'contra:highScore';
export function readHighScore(): number { return Number(localStorage.getItem(KEY) ?? 0); }
export function writeHighScore(v: number): void { localStorage.setItem(KEY, String(v)); }
