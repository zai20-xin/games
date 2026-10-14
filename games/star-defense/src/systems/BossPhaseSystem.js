// ================================================================
// BossPhaseSystem - 多阶段 Boss 抽象
// 当 boss 血量跌入阈值时，切换阶段：变速、加伤、播放阶段特效
// ================================================================
import { SHAKE } from '../core/Constants.js';

export class BossPhaseSystem {
  /**
   * @param {import('../core/EventBus.js').EventBus} [eventBus]
   * @param {import('./EffectSystem.js').EffectSystem} [effectSystem]
   * @param {import('../audio/AudioManager.js').AudioManager} [audio]
   */
  constructor(eventBus = null, effectSystem = null, audio = null) {
    this.eventBus = eventBus;
    this.effectSystem = effectSystem;
    this.audio = audio;
    /** @type {Map<Enemy, {phases:Array, currentPhase:number, auraColor:string}>} */
    this.bindings = new Map();
  }

  /**
   * 设置音频引用（Game 主循环中初始化时注入）
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   */
  setAudio(audio) {
    this.audio = audio;
  }

  /**
   * 注册一个 boss 的多阶段配置
   * @param {Enemy} enemy
   * @param {Array<{hpThreshold:number, speedMult?:number, dmgMult?:number, desc?:string}>} phases
   * @param {string} auraColor - 阶段切换特效颜色 (CSS color)
   */
  register(enemy, phases, auraColor = '#ff5577') {
    if (!enemy) return;
    this.bindings.set(enemy, {
      phases: phases || [],
      currentPhase: 0,
      auraColor,
    });
  }

  /**
   * 取消注册
   * @param {Enemy} enemy
   */
  unregister(enemy) {
    if (!enemy) return;
    this.bindings.delete(enemy);
  }

  /**
   * 每帧调用：检查 boss 是否需要切换阶段
   * @param {Enemy} enemy
   */
  check(enemy) {
    if (!enemy) return;
    const b = this.bindings.get(enemy);
    if (!b) return;
    if (b.currentPhase >= b.phases.length) return;
    if (!enemy.maxHp || enemy.maxHp <= 0) return;
    const hpPct = enemy.hp / enemy.maxHp;
    const nextPhase = b.phases[b.currentPhase];
    if (!nextPhase) return;
    if (hpPct <= nextPhase.hpThreshold) {
      this._enterPhase(enemy, b);
      b.currentPhase++;
    }
  }

  _enterPhase(enemy, b) {
    const p = b.phases[b.currentPhase];
    if (!p) return;

    // 1) 应用阶段参数（变速 / 加伤）
    if (p.speedMult) {
      const base = enemy.baseSpeed || enemy.speed || 1;
      enemy.speed = base * p.speedMult;
    }
    if (p.dmgMult) {
      const baseDmg = enemy.baseDamage != null ? enemy.baseDamage : (enemy.damage != null ? enemy.damage : 1);
      enemy.baseDamage = baseDmg;  // 记住初始值，避免累乘
      enemy.damage = baseDmg * p.dmgMult;
    }

    // 2) 屏幕震动（用 preset 触发）
    if (this.effectSystem && typeof this.effectSystem.shakePreset === 'function') {
      this.effectSystem.shakePreset(SHAKE.BOSS_PHASE);
    }

    // 3) 阶段文字（若 EffectSystem 提供 addBigText）
    if (this.effectSystem && typeof this.effectSystem.addBigText === 'function') {
      try {
        this.effectSystem.addBigText(enemy.x, enemy.y, `阶段 ${b.currentPhase + 1}`, b.auraColor);
      } catch (e) { /* ignore */ }
    } else if (this.effectSystem && Array.isArray(this.effectSystem.effects)) {
      // 后备方案：直接推入一个 flash 效果作为视觉提示
      this.effectSystem.effects.push({
        type: 'flash',
        x: enemy.x,
        y: enemy.y,
        timer: 0.4,
        maxTimer: 0.4,
        size: 60,
        color: b.auraColor,
      });
    }

    // 4) 音频（ultimate 音效：低位 R 大招音）
    if (this.audio && typeof this.audio.play === 'function') {
      try { this.audio.play('ultimate'); } catch (e) { /* ignore */ }
    }

    // 5) 事件总线
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('boss:phase', { enemy, phase: p, phaseIndex: b.currentPhase });
    }
  }

  /**
   * 提供默认阶段配置（按 enemy.type 分配）
   * @param {Enemy} enemy
   * @returns {Array|null} phases 数组，若 enemy 不是 boss 则返回 null
   */
  getDefaultPhases(enemy) {
    if (!enemy || !enemy.isBoss) return null;

    const t = enemy.type;
    if (t === 'virusking') {
      return [
        { hpThreshold: 0.5, speedMult: 1.5, dmgMult: 1.2, desc: '狂暴' },
        { hpThreshold: 0.2, speedMult: 1.3, dmgMult: 1.5, desc: '绝望' },
      ];
    }
    // 默认（boss_brute / 其他 boss）：两阶段
    return [
      { hpThreshold: 0.5, speedMult: 1.5, dmgMult: 1.2, desc: '狂暴' },
      { hpThreshold: 0.25, speedMult: 1.3, dmgMult: 1.5, desc: '绝望' },
    ];
  }

  /**
   * 按类型返回 aura 颜色
   * @param {Enemy} enemy
   * @returns {string}
   */
  getAuraColor(enemy) {
    if (!enemy) return '#ff5577';
    const map = {
      boss_brute: '#ff5544',
      virusking: '#cc44ff',
      mothership: '#44ddff',
    };
    return map[enemy.type] || (enemy.auraColor || '#ff5577');
  }
}
