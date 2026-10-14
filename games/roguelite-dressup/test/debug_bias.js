// 调试：frost 偏向为何统计不到冰环
const h=require(require('path').join(__dirname,'helpers.js'));
const {T}=h.buildSandbox();
T(`Meta.hardReset(); startGame('frost'); if(gameState==='levelup')applyUpgradeChoice(0)`);
console.log('outfit:',T('player.outfit.id'));
console.log('bias:',T('JSON.stringify(outfitSkillBias(player.outfit.id)||null)'));
console.log('skills:',T('player.skills.map(s=>s.id+":"+s.lv).join()'));
// 抽一次看选项
T(`pendingLevelUps=1; buildUpgradeChoices()`);
console.log('choices:',T('JSON.stringify(upgradeChoices)'));
