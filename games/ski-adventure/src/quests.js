// quests.js —— 单局任务（每局随机抽 3 个，完成给金币奖励）
// 任务进度分两类：
//   实时型（每帧统计）：distance / survive(连续不摔) / fever(累计疯狂秒)
//   事件型（收集/过门/擦身时调用 questEvent）：coins / gates / nearmiss
import * as C from './config.js';
import { game, popupAt } from './state.js';
import * as storage from './storage.js';
import * as audio from './audio.js';

// 随机抽取不重复任务模板
function pickTemplates() {
  const pool = C.QUESTS.slice();
  const out = [];
  while (out.length < C.QUEST_COUNT && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function initQuests() {
  const tmpl = pickTemplates();
  game.quests = tmpl.map(t => {
    const target = t.pool[Math.floor(Math.random() * t.pool.length)];
    return { id: t.id, stat: t.stat, text: t.text(target), target, progress: 0, done: false };
  });
  game.surviveT = 0;   // 连续不摔倒计时
  game.feverAccum = 0; // 累计疯狂秒
}

// 事件型进度增量
export function questEvent(stat, amount = 1) {
  if (!game.quests) return;
  for (const q of game.quests) {
    if (q.stat === stat && !q.done) {
      q.progress = Math.min(q.target, q.progress + amount);
      if (q.progress >= q.target) completeQuest(q);
    }
  }
}

// 每帧推进实时型任务
export function updateQuests(dt) {
  if (!game.quests) return;
  // 距离
  for (const q of game.quests) {
    if (q.stat === 'distance' && !q.done) {
      q.progress = Math.min(q.target, Math.floor(game.distance));
      if (q.progress >= q.target) completeQuest(q);
    }
  }
  // 连续不摔倒
  if (game.state === 'playing') {
    const fell = game.fallT > 0;
    game.surviveT = fell ? 0 : game.surviveT + dt;
    for (const q of game.quests) {
      if (q.stat === 'survive' && !q.done) {
        q.progress = Math.min(q.target, Math.floor(game.surviveT));
        if (q.progress >= q.target) completeQuest(q);
      }
    }
    // 疯狂累计
    if (game.feverT > 0) game.feverAccum += dt;
    for (const q of game.quests) {
      if (q.stat === 'fever' && !q.done) {
        q.progress = Math.min(q.target, Math.floor(game.feverAccum));
        if (q.progress >= q.target) completeQuest(q);
      }
    }
  }
}

function completeQuest(q) {
  q.done = true;
  q.progress = q.target;
  audio.sfxQuestDone();
  popupAt('任务完成! ' + q.text, 0, C.PLAYER_Z, 90, 1.4);
}

// 结算奖励：完成 1/2/3 个对应阶梯奖励
export function questReward() {
  const done = game.quests ? game.quests.filter(q => q.done).length : 0;
  return done > 0 ? C.QUEST_REWARD[Math.min(done, C.QUEST_REWARD.length) - 1] : 0;
}

export function questSummary() {
  return {
    quests: game.quests ? game.quests.map(q => ({ text: q.text, progress: q.progress, target: q.target, done: q.done })) : [],
    done: game.quests ? game.quests.filter(q => q.done).length : 0,
    reward: questReward(),
  };
}
