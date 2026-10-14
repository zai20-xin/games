// achievements.js —— 成就系统（元游戏留存钩子）
// 定义成就、检测解锁、持久化。游戏结束时由 ui 调用 checkGame / checkSnowfight。
import * as storage from './storage.js';

// 分组：ski=滑雪主体  sf=打雪仗
export const ACH = [
  // —— 滑雪主体 ——
  { id: 'ski_dist_1k',  group: 'ski', name: '初露锋芒',   desc: '单局滑行 1000 m' },
  { id: 'ski_dist_3k',  group: 'ski', name: '风驰电掣',   desc: '单局滑行 3000 m' },
  { id: 'ski_score_5k', group: 'ski', name: '积分新手',   desc: '单局得分 5000' },
  { id: 'ski_score_15k',group: 'ski', name: '计分高手',   desc: '单局得分 15000' },
  { id: 'ski_coin_1k',  group: 'ski', name: '雪道富户',   desc: '单局收集 1000 金币' },
  { id: 'ski_best_5k',  group: 'ski', name: '纪录在望',   desc: '最佳距离突破 5000 m' },
  // —— 欢乐打雪仗 ——
  { id: 'sf_wave_5',    group: 'sf',  name: '雪仗新兵',   desc: '打雪仗到达第 5 波' },
  { id: 'sf_lv_max',    group: 'sf',  name: '雪球大师',   desc: '雪球升到满级 Lv.8' },
  { id: 'sf_boss',      group: 'sf',  name: '屠龙勇士',   desc: '击败 1 个雪怪首领' },
  { id: 'sf_kills_50',  group: 'sf',  name: '雪怪克星',   desc: '单局击杀 50 只怪兽' },
];

const byId = Object.fromEntries(ACH.map(a => [a.id, a]));

export function getUnlocked() { return new Set(storage.getAch()); }

export function getList() {
  const un = getUnlocked();
  return ACH.map(a => ({ ...a, unlocked: un.has(a.id) }));
}

// 返回本次新解锁的成就定义数组（用于 toast）
function apply(ids) {
  if (!ids.length) return [];
  const un = getUnlocked();
  const fresh = [];
  for (const id of ids) {
    if (byId[id] && !un.has(id)) { un.add(id); fresh.push(byId[id]); }
  }
  if (fresh.length) storage.setAch([...un]);
  return fresh;
}

export function checkGame(game) {
  const ids = [];
  if (game.distance >= 1000) ids.push('ski_dist_1k');
  if (game.distance >= 3000) ids.push('ski_dist_3k');
  if (game.score >= 5000) ids.push('ski_score_5k');
  if (game.score >= 15000) ids.push('ski_score_15k');
  if (game.coins >= 1000) ids.push('ski_coin_1k');
  if (game.best >= 5000) ids.push('ski_best_5k');
  return apply(ids);
}

export function checkSnowfight(sf) {
  const ids = [];
  if (sf.wave >= 5) ids.push('sf_wave_5');
  if (sf.lv >= 8) ids.push('sf_lv_max');
  if ((sf.bossKills || 0) >= 1) ids.push('sf_boss');
  if (sf.kills >= 50) ids.push('sf_kills_50');
  return apply(ids);
}
