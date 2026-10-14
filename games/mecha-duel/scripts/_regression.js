"use strict";
console.log('=== 回合制回归测试 ===\n');

const CONFIG={W:960,H:540,GROUND:452,MAX_HP:100,ROUNDS_TO_WIN:3,ENERGY_MAX:100,DEF_REDUCE:0.60};

const CHARACTERS=[
  {id:'iron_fist',name:'铁拳',type:'平衡',stats:{hp:100,speed:3.4,damage:1.0,defense:1.0},
    moves:{normal:{name:'铁拳',dmg:14,energy:12},special1:{name:'铁山靠',dmg:22,energy:8,stun:true},special2:{name:'升龙拳',dmg:24,energy:20},super:{name:'真·铁拳',dmg:48,energy:0,unblockable:true}}},
  {id:'lightning',name:'闪电',type:'速度',stats:{hp:85,speed:4.2,damage:0.95,defense:0.9},
    moves:{normal:{name:'电光拳',dmg:12,energy:10},special1:{name:'雷光拳',dmg:18,energy:8,drain:12},special2:{name:'闪电踢',dmg:24,energy:18,ignoreDef:true},super:{name:'闪电风暴',dmg:50,energy:0,unblockable:true}}}
];

class Mecha{
  constructor(x,charData){
    this.x=x;this.charData=charData;const s=charData.stats;
    this.maxHp=s.hp;this.hp=s.hp;this.energy=0;this.damageMul=s.damage;this.defenseMul=s.defense;
    this.sp1Used=false;this.sp2Used=false;this.stunTimer=0;this._defending=false;this._moveType=null;
  }
  get dead(){return this.hp<=0}
  reset(){this.hp=this.maxHp;this.energy=0;this.sp1Used=false;this.sp2Used=false;this.stunTimer=0;this._defending=false;this._moveType=null}
  hurt(n,game=null,defended=false){
    const mult=defended?(1-CONFIG.DEF_REDUCE*this.defenseMul):1;
    const dmg=Math.round(n*mult);
    this.hp=Math.max(0,this.hp-dmg);
    return dmg;
  }
  executeMove(mt,enemy,game){
    const mv=this.charData.moves[mt];if(!mv)return 0;
    this._moveType=mt;
    const def=enemy._defending&&!mv.unblockable&&!mv.ignoreDef;
    const dmg=enemy.hurt(mv.dmg*this.damageMul,game,def);
    this.energy=Math.min(CONFIG.ENERGY_MAX,this.energy+mv.energy);
    if(mv.drain){enemy.energy=Math.max(0,enemy.energy-mv.drain);this.energy=Math.min(CONFIG.ENERGY_MAX,this.energy+mv.drain)}
    if(mv.stun)enemy.stunTimer=1;
    if(mt==='special1')this.sp1Used=true;if(mt==='special2')this.sp2Used=true;
    game.lastDamage=dmg;game.lastMoveName=mv.name;game.lastDefended=def;
    return dmg;
  }
}

class EnemyAI{
  act(me){
    if(me.stunTimer>0){me.stunTimer=0;return{move:null,defend:false}}
    const c=['normal'];if(!me.sp1Used)c.push('special1');if(!me.sp2Used)c.push('special2');
    if(me.energy>=CONFIG.ENERGY_MAX)c.push('super');
    let pick='normal';if(c.includes('super')&&Math.random()<0.5)pick='super';
    else if(c.includes('special1')&&Math.random()<0.4)pick='special1';
    return{move:pick,defend:me.hp<me.maxHp*0.35&&Math.random()<0.65};
  }
}

const mkG=()=>({shakeIntensity:0,shakeX:0,shakeY:0,hitFlash:0,lastDamage:0,lastMoveName:'',lastDefended:false});
let F=0;
const ok=(l,c)=>{console.log(`  ${c?'✅':'❌'} ${l}`);if(!c)F++};

// === 铁拳(攻1.0) vs 闪电(防0.9) ===
console.log('--- 铁拳 vs 闪电 ---');
{const p=new Mecha(230,CHARACTERS[0]),e=new Mecha(730,CHARACTERS[1]);const g=mkG();
 const d=p.executeMove('normal',e,g);
 ok(`普通: dmg=${d}(应14) hp=${e.hp}(应71)`,d===14&&e.hp===71)}
{const p=new Mecha(230,CHARACTERS[0]),e=new Mecha(730,CHARACTERS[1]);const g=mkG();
 const d=p.executeMove('special1',e,g);
 ok(`铁山靠: dmg=${d}(应22) 眩晕=${e.stunTimer>0}`,d===22&&e.stunTimer>0)}
{const p=new Mecha(230,CHARACTERS[0]),e=new Mecha(730,CHARACTERS[1]);const g=mkG();
 const d=p.executeMove('special2',e,g);
 ok(`升龙拳: dmg=${d}(应24) 能量=${p.energy}(应20)`,d===24&&p.energy===20)}
{const p=new Mecha(230,CHARACTERS[0]),e=new Mecha(730,CHARACTERS[1]);const g=mkG();
 p.energy=100;const d=p.executeMove('super',e,g);
 ok(`真·铁拳: dmg=${d}(应48) 能量=${p.energy}(应100)`,d===48&&p.energy===100)}
{const p=new Mecha(230,CHARACTERS[0]),e=new Mecha(730,CHARACTERS[1]);const g=mkG();
 e._defending=true;const d=p.executeMove('normal',e,g);
 // 防御: 14 * 1.0 * (1 - 0.6*0.9) = 14 * 0.46 = 6.44 -> 6
 ok(`防御普通: dmg=${d}(应6)`,d===6)}
{const p=new Mecha(230,CHARACTERS[0]),e=new Mecha(730,CHARACTERS[1]);const g=mkG();
 e._defending=true;const d=p.executeMove('super',e,g);
 ok(`超必杀不可防: defended=${g.lastDefended}(应false) dmg=${d}(应48)`,!g.lastDefended&&d===48)}

// === 闪电(攻0.95) vs 铁拳(防1.0) ===
console.log('\n--- 闪电 vs 铁拳 ---');
{const p=new Mecha(230,CHARACTERS[1]),e=new Mecha(730,CHARACTERS[0]);const g=mkG();
 const d=p.executeMove('normal',e,g);
 // 12 * 0.95 = 11.4 -> 11
 ok(`普通: dmg=${d}(应11) hp=${e.hp}(应89)`,d===11&&e.hp===89)}
{const p=new Mecha(230,CHARACTERS[1]),e=new Mecha(730,CHARACTERS[0]);const g=mkG();
 const d=p.executeMove('special1',e,g);
 // 18 * 0.95 = 17.1 -> 17, drain 12
 ok(`雷光拳: dmg=${d}(应17) 能量=${p.energy}(应20)`,d===17&&p.energy===20)}
{const p=new Mecha(230,CHARACTERS[1]),e=new Mecha(730,CHARACTERS[0]);const g=mkG();
 e._defending=true;const d=p.executeMove('special2',e,g);
 // 24 * 0.95 = 22.8 -> 23, ignoreDef
 ok(`闪电踢无视防御: dmg=${d}(应23) defended=${g.lastDefended}(应false)`,d===23&&!g.lastDefended)}
{const p=new Mecha(230,CHARACTERS[1]),e=new Mecha(730,CHARACTERS[0]);const g=mkG();
 p.energy=100;const d=p.executeMove('super',e,g);
 // 50 * 0.95 = 47.5 -> 48
 ok(`闪电风暴: dmg=${d}(应48) 能量=${p.energy}(应100)`,d===48&&p.energy===100)}
{const p=new Mecha(230,CHARACTERS[1]),e=new Mecha(730,CHARACTERS[0]);const g=mkG();
 e._defending=true;const d=p.executeMove('normal',e,g);
 // 12 * 0.95 * (1-0.6*1.0) = 11.4 * 0.4 = 4.56 -> 5
 ok(`防御普通: dmg=${d}(应5)`,d===5)}

// === 吸能 ===
console.log('\n--- 吸能测试 ---');
{const p=new Mecha(230,CHARACTERS[1]),e=new Mecha(730,CHARACTERS[0]);const g=mkG();
 e.energy=20;p.executeMove('special1',e,g);
 ok(`雷光拳吸能: 敌方能量=${e.energy}(应8) 玩家能量=${p.energy}(应20)`,e.energy===8&&p.energy===20)}

// === 眩晕 ===
console.log('\n--- 眩晕测试 ---');
{const p=new Mecha(230,CHARACTERS[0]),e=new Mecha(730,CHARACTERS[1]);const g=mkG();
 p.executeMove('special1',e,g);
 ok(`铁山靠眩晕: stun=${e.stunTimer>0}`,e.stunTimer>0)}

// === Reset ===
console.log('\n--- Reset ---');
{const p=new Mecha(230,CHARACTERS[0]);p.sp1Used=true;p.energy=50;p.hp=60;p.reset();
 ok(`hp=${p.hp}(100) energy=${p.energy}(0) sp1=${p.sp1Used}(false)`,p.hp===100&&p.energy===0&&!p.sp1Used)}

// === AI ===
console.log('\n--- AI ---');
{const ai=new EnemyAI();const m=new Mecha(230,CHARACTERS[0]);
 m.stunTimer=1;const r=ai.act(m);ok(`眩晕跳过: move=${r.move}(null)`,r.move===null);
 m.stunTimer=0;m.hp=20;const r2=ai.act(m);ok(`低血防御: type=${typeof r2.defend}`,typeof r2.defend==='boolean')}

if(F===0)console.log('\n✅ 所有测试通过');
else{console.log(`\n❌ ${F} 项失败`);process.exit(1)}
