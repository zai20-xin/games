// ===== 手感打磨包：精英/BOSS 顿帧、连杀横幅、受击红晕、低血量脉冲、BOSS 血条 =====
// 加载期自动链式包装 dealDamage（接在 resonance 之后）与 Player.prototype.hurt。
// 主循环接入方式：
//   const dtScale = Juice.update(rawDt);   // 顿帧时返回 0，世界暂停
//   Juice.drawOverlays(ctx);               // 渲染层最后调用
//   Juice.drawBossBar(ctx);
// 新的一局请调用 Juice.reset()。

const Juice = {
  killCount: 0,          // 当前连杀数
  banner: null,          // {text,t,maxT} 连杀横幅
  hitStopT: 0,           // 顿帧剩余时间
  vignetteT: 0,          // 受击红晕剩余时间
  _clock: 0,             // 内部时钟（吃原始 dt，不受顿帧暂停影响）
  _lastKillClock: -1e9,
  _lastHitStopAt: -1e9,
  _origHurt: null,

  // 安装期包装（文件加载即执行）
  _install(){
    const J = this;
    // —— 全局伤害入口：函数绑定重写一次（仿 resonance 的 __orig 链式包装）——
    const __orig = dealDamage;
    dealDamage = function(e, dmg, opt){
      opt = opt || {};
      const wasAlive = e && e.hp > 0;
      let d = __orig(e, dmg, opt);
      if(e){
        // 精英/BOSS 被命中 → 请求顿帧（距上次生效 ≥0.35s 才触发）
        if((e.isElite || e.isBoss) && J._clock - J._lastHitStopAt >= 0.35){
          J.hitStopT = 0.045;
          J._lastHitStopAt = J._clock;
        }
        // 本次伤害完成击杀 → 计入连杀
        if(wasAlive && e.hp <= 0) J._registerKill();
      }
      return d;
    };
    // —— 玩家受伤入口：原型链包装一次（仿 resonance 包 gainXp）——
    if(typeof Player !== "undefined" && Player.prototype.hurt){
      J._origHurt = Player.prototype.hurt;
      Player.prototype.hurt = function(){
        J.vignetteT = 0.5;   // 受击红晕
        return J._origHurt.apply(this, arguments);
      };
    }
  },

  // 击杀间隔 <2s 视为连续连杀；跨过 30/60/100/200 门槛弹横幅
  _registerKill(){
    if(this._clock - this._lastKillClock < 2) this.killCount++;
    else this.killCount = 1;
    this._lastKillClock = this._clock;
    if([30, 60, 100, 200].indexOf(this.killCount) >= 0){
      this.banner = { text:"连杀 ×" + this.killCount + "！", t:1.6, maxT:1.6 };
    }
  },

  // 每帧最先调用；返回 dtScale（0=世界暂停）。横幅/红晕用原始 dt 递减
  update(dt){
    this._clock += dt;
    if(this.banner && this.banner.t > 0) this.banner.t -= dt;
    if(this.vignetteT > 0) this.vignetteT -= dt;
    if(this.hitStopT > 0){ this.hitStopT -= dt; return 0; }
    return 1;
  },

  // 屏幕叠加层：连杀横幅 / 受击红晕 / 低血量脉冲
  drawOverlays(ctx){
    // ① 连杀横幅：屏幕上方中央大字，描边+金色，淡出+轻微放大
    if(this.banner && this.banner.t > 0){
      const b = this.banner;
      const pop = 1 + 0.22 * Math.max(0, b.t - b.maxT * 0.75) / (b.maxT * 0.25);
      const alpha = Math.min(1, b.t / 0.5);
      ctx.save();
      ctx.translate(VIEW_W / 2, 150);
      ctx.scale(pop, pop);
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.font = "bold 44px sans-serif";
      ctx.lineWidth = 6; ctx.strokeStyle = "#3a2000";
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = "#ffd93d";
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }
    // ② 受击红晕：四周红色径向渐晕，alpha ∝ vignetteT*0.4
    if(this.vignetteT > 0){
      const a = Math.min(0.8, Math.max(0, this.vignetteT) * 0.4);
      const g = ctx.createRadialGradient(VIEW_W/2, VIEW_H/2, VIEW_H*0.32,
                                         VIEW_W/2, VIEW_H/2, VIEW_H*0.72);
      g.addColorStop(0, "rgba(255,0,0,0)");
      g.addColorStop(1, "rgba(255,0,0," + a + ")");
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
    }
    // ③ 低血量持续脉冲暗红渐晕
    if(player && player.maxHp > 0 && player.hp > 0 && player.hp / player.maxHp < 0.25){
      const a = Math.max(0, 0.12 + 0.08 * Math.sin(gameTime * 6));
      const g = ctx.createRadialGradient(VIEW_W/2, VIEW_H/2, VIEW_H*0.34,
                                         VIEW_W/2, VIEW_H/2, VIEW_H*0.72);
      g.addColorStop(0, "rgba(160,0,0,0)");
      g.addColorStop(1, "rgba(160,0,0," + a + ")");
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
    }
  },

  // BOSS 血条：顶部中央宽520高22，深底+红色填充+白色描边+名字+百分比
  drawBossBar(ctx){
    const boss = enemies.find(e => e.isBoss);
    if(!boss) return;
    const w = 520, h = 22, x = (VIEW_W - w) / 2, y = 64;
    const pct = clamp(boss.maxHp > 0 ? boss.hp / boss.maxHp : 0, 0, 1);
    ctx.save();
    ctx.fillStyle = "#1a1026"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#e23b3b"; ctx.fillRect(x, y, w * pct, h);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.font = "bold 14px sans-serif"; ctx.fillStyle = "#ffdddd";
    ctx.textAlign = "left";  ctx.fillText("深渊魔王", x, y - 8);
    ctx.textAlign = "right"; ctx.fillText(Math.round(pct * 100) + "%", x + w, y - 8);
    ctx.restore();
  },

  // 调试/测试用状态快照
  snapshot(){
    return {
      killCount: this.killCount,
      banner: this.banner ? { text:this.banner.text, t:this.banner.t } : null,
      hitStopT: this.hitStopT,
      vignetteT: this.vignetteT,
      clock: this._clock,
    };
  },

  reset(){
    this.killCount = 0;
    this._lastKillClock = -1e9;
    this.banner = null;
    this.hitStopT = 0;
    this.vignetteT = 0;
    this._clock = 0;
    this._lastHitStopAt = -1e9;
  },
};

Juice._install();

// v0.14 系统注册
if(typeof SysReg!=="undefined")SysReg.add("juice",Juice);
