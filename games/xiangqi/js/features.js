'use strict';
/* ============ 特色功能：模式 / 残局 / 教学 / 成就 / 战绩 ============ */
/* 依赖全局：Levels（levels.js） */

const Features = (function () {
  const LEVELS = Levels.LEVELS;
  const TUTORIAL = Levels.TUTORIAL;

  // ---------- 当前对局模式 ----------
  let mode = 'pvp';        // pvp 双人 | ai 人机 | level 残局 | tutorial 教学
  let aiLevel = 1;         // 1 初级 | 2 中级
  let levelIdx = -1;       // 当前残局关（LEVELS 下标）
  let tutIdx = -1;         // 当前教学关（TUTORIAL 下标）

  // ---------- 战绩持久化 ----------
  const LS_KEY = 'chess_stats_v2';
  const SAVE_V = 2;

  const defaults = () => ({
    games: 0, redWins: 0, blackWins: 0, draws: 0,   // 双人对战
    aiWins: 0, aiLosses: 0,                          // 人机
    totalEat: 0, eatMax: 0,                          // 吃子
    levelsCleared: [], levelStars: {},               // 残局
    tutorialCleared: [],                             // 教学
    achievements: {},                                // 成就
  });

  let stats = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (raw.v !== SAVE_V) return defaults();
      return Object.assign(defaults(), raw);
    } catch (e) { return defaults(); }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(Object.assign({ v: SAVE_V }, stats))); } catch (e) {}
  }

  // ---------- 成就定义 ----------
  const ACHS = [
    { id: 'first_win',    icon: '🥇', name: '初战告捷', desc: '赢下第一局棋' },
    { id: 'three_win',    icon: '🏆', name: '三连胜',   desc: '累计赢下 3 局' },
    { id: 'ten_win',      icon: '🎖️', name: '常胜将军', desc: '累计赢下 10 局' },
    { id: 'eat_five',     icon: '🍖', name: '收割者',   desc: '单局吃掉 5 颗子' },
    { id: 'ai_win',       icon: '🤖', name: '智斗机器', desc: '人机对局赢下 1 局' },
    { id: 'ai_three',     icon: '🦾', name: '电脑克星', desc: '人机对局赢下 3 局' },
    { id: 'level_1',      icon: '🧩', name: '残局新秀', desc: '通过第 1 关残局' },
    { id: 'level_10',     icon: '🧠', name: '残局达人', desc: '通过 10 关残局' },
    { id: 'level_all',    icon: '👑', name: '残局大师', desc: '通过全部 30 关残局' },
    { id: 'star_five',    icon: '⭐', name: '星光闪耀', desc: '拿到 5 个三星残局' },
    { id: 'tutorial_all', icon: '📖', name: '棋艺入门', desc: '完成全部教学关卡' },
  ];

  // 颁发单个成就，返回成就对象（重复不发）
  function award(id) {
    if (stats.achievements[id]) return null;
    stats.achievements[id] = true;
    save();
    return ACHS.find(a => a.id === id) || null;
  }

  // 扫描全部成就条件，返回本次新解锁的成就列表
  function checkAch() {
    const unlocked = [];
    const wins = stats.redWins + stats.blackWins + stats.aiWins;
    if (wins >= 1) unlocked.push(award('first_win'));
    if (wins >= 3) unlocked.push(award('three_win'));
    if (wins >= 10) unlocked.push(award('ten_win'));
    if (stats.eatMax >= 5) unlocked.push(award('eat_five'));
    if (stats.aiWins >= 1) unlocked.push(award('ai_win'));
    if (stats.aiWins >= 3) unlocked.push(award('ai_three'));
    if (stats.levelsCleared.length >= 1) unlocked.push(award('level_1'));
    if (stats.levelsCleared.length >= 10) unlocked.push(award('level_10'));
    if (stats.levelsCleared.length >= LEVELS.length) unlocked.push(award('level_all'));
    if (Object.values(stats.levelStars).filter(s => s >= 3).length >= 5) unlocked.push(award('star_five'));
    if (stats.tutorialCleared.length >= TUTORIAL.length) unlocked.push(award('tutorial_all'));
    return unlocked.filter(Boolean);
  }

  // ---------- 模式 ----------
  function setMode(m, lv) {
    mode = m;
    if (m === 'ai') aiLevel = lv || aiLevel;
    if (m !== 'level') levelIdx = -1;
    if (m !== 'tutorial') tutIdx = -1;
  }
  const isAI = () => mode === 'ai';
  const isLevel = () => mode === 'level';
  const isTutorial = () => mode === 'tutorial';

  // ---------- 战绩记录 ----------
  function recordGame(winner, eatTotal) {
    stats.games++;
    if (winner === 'red') stats.redWins++;
    else if (winner === 'black') stats.blackWins++;
    else stats.draws++;
    stats.eatMax = Math.max(stats.eatMax, eatTotal);
    save();
    return checkAch();
  }
  function recordAI(winner, eatTotal) {
    stats.games++;
    if (winner === 'red') stats.aiWins++;
    else if (winner === 'black') stats.aiLosses++;
    stats.eatMax = Math.max(stats.eatMax, eatTotal);
    save();
    return checkAch();
  }

  // ---------- 残局 / 教学 ----------
  // 星级：按红方步数（steps 为总半回合数，红方步数 = ceil(steps/2)）
  function starFor(diff, steps) {
    const redSteps = Math.ceil(steps / 2);
    if (diff <= 1) return redSteps <= 2 ? 3 : redSteps <= 4 ? 2 : 1;
    if (diff === 2) return redSteps <= 3 ? 3 : redSteps <= 6 ? 2 : 1;
    return redSteps <= 4 ? 3 : redSteps <= 8 ? 2 : 1;
  }
  function recordLevelClear(idx, steps) {
    const lv = LEVELS[idx];
    const s = lv ? starFor(lv.diff, steps) : 1;
    if (!stats.levelsCleared.includes(idx)) stats.levelsCleared.push(idx);
    stats.levelStars[idx] = Math.max(stats.levelStars[idx] || 0, s);
    save();
    return { stars: s, achievements: checkAch() };
  }
  function recordTutorialClear(i) {
    const t = TUTORIAL[i];
    if (t && !stats.tutorialCleared.includes(t.id)) stats.tutorialCleared.push(t.id);
    save();
    return checkAch();
  }

  return {
    LEVELS, TUTORIAL, ACHS,
    get mode() { return mode; },
    setMode,
    get aiLevel() { return aiLevel; },
    get levelIdx() { return levelIdx; },
    set levelIdx(v) { levelIdx = v; },
    get tutIdx() { return tutIdx; },
    set tutIdx(v) { tutIdx = v; },
    isAI, isLevel, isTutorial,
    getStats() { return stats; },
    recordGame, recordAI, recordLevelClear, recordTutorialClear,
    starFor, checkAch, award,
  };
})();
