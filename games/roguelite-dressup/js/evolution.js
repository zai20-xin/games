// ===== 技能进化配方系统：技能满级 + 专属遗物 → 触发进化词条 =====
// 每帧由主循环调用 EVOLUTION.check()；满足条件时应用属性修正、
// 记录到 active 并播放大特效。幂等：已触发的配方不会重复触发。
// 新的一局请调用 EVOLUTION.reset() 清空状态。
// 右上角徽章渲染仿 resonance.drawHUD，位于共鸣徽章下方。

const EVOLUTION = {
  // 进化配方表：req.skill 技能满级 + req.relic 专属遗物
  RECIPES: [
    { id:"meteorcodex", name:"陨星法典", icon:"陨", color:"#ff6b35",
      req:{ skill:"fireball", lv:5, relic:"bracer" },
      mods:{ atkMul:+0.30 },
      desc:"烈焰火球Lv5 + 力量护腕" },
    { id:"absolutezero", name:"绝对零度", icon:"零", color:"#a5e3f7",
      req:{ skill:"frostnova", lv:5, relic:"hourglass" },
      mods:{ haste:+0.10, maxHpFlat:+20 },
      desc:"冰霜新星Lv5 + 时之沙漏" },
    { id:"bladestorm", name:"万刃风暴", icon:"风", color:"#b06ad4",
      req:{ skill:"knives", lv:5, relic:"boots" },
      mods:{ spdMul:+0.12, atkMul:+0.15 },
      desc:"暗影飞刀Lv5 + 疾风之靴" },
    { id:"earthwrath", name:"大地震怒", icon:"怒", color:"#c49a6c",
      req:{ skill:"quake", lv:5, relic:"amulet" },
      mods:{ maxHpFlat:+40, atkMul:+0.20 },
      desc:"大地震击Lv5 + 生命坠饰" },
  ],

  active: [],   // 已触发的配方 [{id,name,icon,color}]

  // 每帧检查：遍历未达成配方，技能等级与遗物都满足即触发
  check(){
    if(typeof gameState !== "undefined" && gameState !== "playing") return;
    if(!player || !player.skills) return;
    for(const r of this.RECIPES){
      if(this.has(r.id)) continue;
      const sk = player.skills.find(s => s.id === r.req.skill);
      if(!sk || sk.lv < r.req.lv) continue;
      if(!hasRelic(r.req.relic)) continue;
      this._trigger(r);
    }
  },

  _trigger(r){
    // 应用属性修正：atkMul/spdMul/haste 直接加减；maxHpFlat 加上限并回同量血
    const m = r.mods;
    for(const k in m){
      if(k === "maxHpFlat"){
        player.maxHp += m[k];
        player.hp = Math.min(player.maxHp, player.hp + m[k]);
      } else {
        player[k] += m[k];
      }
    }
    this.active.push({ id:r.id, name:r.name, icon:r.icon, color:r.color });
    burst(player.x, player.y, 36,
      { color:r.color, glow:true, spdMin:120, spdMax:340, r0:3, r1:8, life:0.9 });
    Shake.add(9);
    spawnDmgText(player.x, player.y - 46, "进化！" + r.name, r.color);
    if(typeof SFX!=="undefined") SFX.play("evolution");
  },

  has(id){ return this.active.some(a => a.id === id); },
  activeCount(){ return this.active.length; },

  // 屏幕右上角进化徽章：y 从 130 + 共鸣徽章数量*36 开始（仿共鸣徽章圆角矩形）
  drawHUD(){
    if(!this.active.length) return;
    const resN = (typeof RESONANCE !== "undefined" && RESONANCE.activeList)
      ? RESONANCE.activeList.length : 0;
    ctx.save();
    ctx.textAlign = "right";
    let y = 130 + resN * 36;
    for(const a of this.active){
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath(); ctx.roundRect(VIEW_W - 140, y, 120, 30, 8); ctx.fill();
      ctx.strokeStyle = a.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(VIEW_W - 140, y, 120, 30, 8); ctx.stroke();
      ctx.fillStyle = a.color; ctx.font = "bold 14px sans-serif";
      ctx.fillText(a.icon + "·" + a.name, VIEW_W - 28, y + 20);
      y += 36;
    }
    ctx.restore();
  },

  // 新局清空状态（已应用的属性随新玩家对象自然重置）
  reset(){ this.active = []; },
};

// v0.14 系统注册：统一生命周期
if(typeof SysReg!=="undefined")SysReg.add("evolution",EVOLUTION);
