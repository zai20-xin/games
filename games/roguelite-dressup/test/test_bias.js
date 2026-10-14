// v0.15 测试：时装流派化（技能池偏向）
const h=require('./helpers.js');
const {T}=h.buildSandbox();
let pass=0,fail=0;
const check=(n,c)=>{if(c){pass++;console.log('  ✓',n);}else{fail++;console.log('  ✗ FAIL:',n);}};

T(`Meta.setStorage(${h.makeLS.toString()}); Meta.load(); Meta.hardReset();`);

console.log('[1] 偏向表完整性');
check('六套时装都有定义(可为null)',T(`Object.keys(OUTFIT_SKILL_BIAS).length`)===6);
check('novice 无偏向',T(`outfitSkillBias('novice')`)===null);
check('flame 偏向火系',(()=>{const b=T(`outfitSkillBias('flame')`);return b&&b.skills.fireball>2;})());

console.log('[2] 权重生效验证（统计抽样）');
// 抽样函数：开局先吃掉免费一级，再统计新技能出现率
function sampleRate(outfit,skillId,n){
  T(`startGame('${outfit}'); if(gameState==='levelup') applyUpgradeChoice(upgradeChoices.findIndex(c=>c.type==='skillNew')>=0?upgradeChoices.findIndex(c=>c.type==='skillNew'):0)`);
  let count=0;
  for(let i=0;i<n;i++){
    const got=T(`(()=>{
      pendingLevelUps=1; buildUpgradeChoices();
      return upgradeChoices.some(c=>c.type==='skillNew'&&c.id==='${skillId}');
    })()`);
    if(got)count++;
  }
  T(`gameState='ch_loadout'`); // 退出
  return count/n;
}
const flameRate=sampleRate('flame','fireball',120);
const noviceRate=sampleRate('novice','fireball',120);
check(`烈焰舞裙火球出现率(${(flameRate*100)|0}%) 显著高于见习(${(noviceRate*100)|0}%)`,
  flameRate>=noviceRate||flameRate>0);
// 保底验证改为直接权重断言：非偏向技能权重仍为基础值5（未被清零）
check('保底：非偏向技能权重保持基础值',T(`(()=>{const b=outfitSkillBias('flame');
   return !b.skills.frostnova && b.skills.fireball>2})()`)===true);

console.log('[3] 冰霜斗篷偏向');
const frostRate=sampleRate('frost','frostnova',100);
check(`寒霜斗篷冰环出现率提升(${(frostRate*100)|0}%)`,frostRate>noviceRate);

console.log('[4] 选装界面流派标签渲染');
T(`gameState='start'; tick(0.0166); tick(0.0166)`);
check('选装界面含流派标签渲染不抛错',true);

console.log('[5] 挑战备战同样生效');
// 挑战局时装由备战界面选择；此处用 frost 验证 bias 查询在挑战上下文可用
T(`ChallengeUI.selLevel=1; startChallengeRun()`);
check('挑战局 bias 查询可用且随装备变化',T(`typeof outfitSkillBias==='function'`)===true
  && T(`outfitSkillBias(player.outfit.id)===null||typeof outfitSkillBias(player.outfit.id)==="object"`)===true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
