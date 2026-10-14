export const ACHIEVEMENTS = [
  // 击杀类
  { id: 'kill_100', name: '初级猎手', desc: '累计消灭100个敌人', icon: '🎯', category: 'kill', target: 100, field: 'totalKills' },
  { id: 'kill_500', name: '精英猎手', desc: '累计消灭500个敌人', icon: '🏆', category: 'kill', target: 500, field: 'totalKills' },
  { id: 'kill_1000', name: '传奇猎手', desc: '累计消灭1000个敌人', icon: '👑', category: 'kill', target: 1000, field: 'totalKills' },
  { id: 'kill_5000', name: '银河征服者', desc: '累计消灭5000个敌人', icon: '🌌', category: 'kill', target: 5000, field: 'totalKills' },
  // 策略类
  { id: 'combo_10', name: '连击大师', desc: '单局触发10连击', icon: '⚡', category: 'combo', target: 10, field: 'maxCombo' },
  { id: 'combo_20', name: '连击之王', desc: '单局触发20连击', icon: '🔥', category: 'combo', target: 20, field: 'maxCombo' },
  { id: 'synergy_5', name: '组合专家', desc: '单局触发5次组合效果', icon: '🔗', category: 'synergy', target: 5, field: 'synergiesTriggered' },
  // 挑战类
  { id: 'no_damage_1', name: '完美防御', desc: '无伤通关任意关卡', icon: '🛡️', category: 'challenge', target: 0, field: 'perfectClears' },
  { id: 'speed_clear', name: '速通达人', desc: '3分钟内通关任意关卡', icon: '⏱️', category: 'challenge', target: 0, field: 'speedClears' },
  { id: 'boss_kill_10', name: 'Boss终结者', desc: '累计击杀10个Boss', icon: '💀', category: 'kill', target: 10, field: 'bossKills' },
  // 收集类
  { id: 'play_10', name: '老练指挥官', desc: '完成10局游戏', icon: '🎮', category: 'collect', target: 10, field: 'totalGames' },
  { id: 'play_50', name: '资深指挥官', desc: '完成50局游戏', icon: '⭐', category: 'collect', target: 50, field: 'totalGames' },
  { id: 'stardust_1000', name: '星尘收藏家', desc: '累计获得1000星尘结晶', icon: '💎', category: 'collect', target: 1000, field: 'totalStardust' },
  { id: 'tower_place_100', name: '建筑大师', desc: '累计放置100座防御塔', icon: '🏗️', category: 'collect', target: 100, field: 'totalTowersPlaced' },
  // 经济类
  { id: 'interest_500', name: '利息大亨', desc: '单局累计获得500利息', icon: '💰', category: 'economy', target: 500, field: 'totalInterest' },
  { id: 'energy_1000', name: '能量管理师', desc: '单局累计获得1000能量', icon: '⚡', category: 'economy', target: 1000, field: 'totalEnergy' },

  // ============================================================
  // P4-9：新增 15 条成就
  //   - 击杀类: kill_10000, kill_50000
  //   - 模式类: endless_50, endless_100, daily_streak_7
  //   - 收藏类: skin_collector_5, skin_collector_11
  //   - 挑战类: all_chapter_perfect, no_missile_run, only_one_tower_type
  //   - 速度类: speed_clear_under_60s
  //   - 剧情类: complete_story, all_3_stars
  //   - 塔使用: tower_place_500, awaken_5_towers
  // ============================================================
  // 击杀类
  { id: 'kill_10000', name: '宇宙征服者', desc: '累计消灭10000个敌人', icon: '🌟', category: 'kill', target: 10000, field: 'totalKills' },
  { id: 'kill_50000', name: '星海清道夫', desc: '累计消灭50000个敌人', icon: '🛸', category: 'kill', target: 50000, field: 'totalKills' },
  // 模式类
  { id: 'endless_50', name: '无尽 50', desc: '无尽模式坚持到第 50 波', icon: '♾️', category: 'mode', target: 50, field: 'endlessBestWave' },
  { id: 'endless_100', name: '无尽 100', desc: '无尽模式坚持到第 100 波', icon: '🏅', category: 'mode', target: 100, field: 'endlessBestWave' },
  { id: 'daily_streak_7', name: '七日战神', desc: '连续 7 天完成每日挑战', icon: '📅', category: 'mode', target: 7, field: 'dailyStreak' },
  // 收藏类
  { id: 'skin_collector_5', name: '皮肤收藏家', desc: '解锁 5 个塔皮肤', icon: '🎨', category: 'collect', target: 5, field: 'unlockedSkins' },
  { id: 'skin_collector_11', name: '完美收藏', desc: '解锁全部 11 个塔皮肤', icon: '🏆', category: 'collect', target: 11, field: 'unlockedSkins' },
  // 挑战类
  { id: 'all_chapter_perfect', name: '章节大师', desc: '每个章节至少三星通关', icon: '🌠', category: 'challenge', target: 1, field: 'allChapterPerfect' },
  { id: 'no_missile_run', name: '不依赖导弹', desc: '单局未放置任何导弹塔通关', icon: '🎯', category: 'challenge', target: 1, field: 'noMissileRun' },
  { id: 'only_one_tower_type', name: '专精流派', desc: '单局只使用 1 种塔通关', icon: '🗡️', category: 'challenge', target: 1, field: 'onlyOneTowerType' },
  // 速度类
  { id: 'speed_clear_under_60s', name: '闪电战', desc: '60 秒内通关任意关卡', icon: '⚡', category: 'speed', target: 60, field: 'speedClearBest', isTime: true },
  // 剧情类
  { id: 'complete_story', name: '剧情完结', desc: '通关所有 17 关主线剧情', icon: '📖', category: 'story', target: 17, field: 'levelsCompleted' },
  { id: 'all_3_stars', name: '三星指挥官', desc: '所有关卡均达 3 星', icon: '👑', category: 'story', target: 1, field: 'allThreeStars' },
  // 塔使用类
  { id: 'tower_place_500', name: '建筑宗师', desc: '累计放置 500 座防御塔', icon: '🏗️', category: 'usage', target: 500, field: 'totalTowersPlaced' },
  { id: 'awaken_5_towers', name: '觉醒者', desc: '觉醒 5 座塔到 4 级以上', icon: '✨', category: 'usage', target: 5, field: 'awakenCount' },
];
