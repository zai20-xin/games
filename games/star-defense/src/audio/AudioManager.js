// ================================================================
// 音效管理 - Web Audio API 程序化音效
// 静音状态持久化：localStorage 键 `star-defense:settings`（JSON：{ muted }）
// ================================================================

/** 用户设置存储键（工作区约定：`<game-id>:settings`） */
export const SETTINGS_KEY = 'star-defense:settings';

export class AudioManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.isMuted = this._loadMuted();
    /** 音效节流：同一类型至少间隔50ms */
    this.lastSoundTime = {};
  }

  /**
   * 从 localStorage 读取静音状态（损坏/缺失时回退 false）
   * @returns {boolean}
   */
  _loadMuted() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return false;
      const settings = JSON.parse(raw);
      return settings === true || (settings && typeof settings === 'object' && settings.muted === true);
    } catch (e) {
      return false;
    }
  }

  /**
   * 持久化静音状态到 localStorage（写入失败静默忽略，如隐私模式）
   */
  _persistMuted() {
    try {
      let settings = {};
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') settings = parsed;
      }
      settings.muted = this.isMuted;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { /* ignore */ }
  }

  /**
   * 初始化音频上下文
   */
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * 播放音效
   * @param {string} type - 音效类型
   * @param {Object} [opts] - 可选项
   * @param {number} [opts.pitch=1] - 音调倍率（塔开火时随等级提升）
   * @param {number} [opts.volume=1] - 音量倍率
   */
  play(type, opts = {}) {
    if (this.isMuted || !this.ctx) return;

    const { pitch = 1, volume = 1 } = opts;
    const now = this.ctx.currentTime;
    // 音效节流
    if (this.lastSoundTime[type] && now - this.lastSoundTime[type] < 0.05) return;
    this.lastSoundTime[type] = now;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      // pitch wrapper：所有频率值在写入前乘以 pitch
      // 用于塔开火音调随等级变化（P2-5）
      const _f = (f) => f * pitch;
      const _v = (a) => a * volume;

      switch (type) {
        case 'laser':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(_f(800), now);
          osc.frequency.exponentialRampToValueAtTime(_f(200), now + 0.1);
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(); osc.stop(now + 0.1);
          break;
        case 'tesla':
          osc.type = 'square';
          osc.frequency.setValueAtTime(_f(1200), now);
          osc.frequency.exponentialRampToValueAtTime(_f(100), now + 0.15);
          gain.gain.setValueAtTime(_v(0.08), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(); osc.stop(now + 0.15);
          break;
        case 'missile':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(_f(150), now);
          osc.frequency.exponentialRampToValueAtTime(_f(50), now + 0.3);
          gain.gain.setValueAtTime(_v(0.15), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(); osc.stop(now + 0.3);
          break;
        case 'cryo':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(_f(2000), now);
          osc.frequency.exponentialRampToValueAtTime(_f(500), now + 0.2);
          gain.gain.setValueAtTime(_v(0.06), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(); osc.stop(now + 0.2);
          break;
        case 'kill':
          osc.type = 'square';
          osc.frequency.setValueAtTime(_f(600), now);
          osc.frequency.exponentialRampToValueAtTime(_f(100), now + 0.15);
          gain.gain.setValueAtTime(_v(0.08), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(); osc.stop(now + 0.15);
          break;
        case 'place':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(_f(400), now);
          osc.frequency.exponentialRampToValueAtTime(_f(800), now + 0.1);
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(); osc.stop(now + 0.15);
          break;
        case 'hit':
          // 受击音效：短促高频爆点，命中确认
          osc.type = 'square';
          osc.frequency.setValueAtTime(_f(900), now);
          osc.frequency.exponentialRampToValueAtTime(_f(300), now + 0.08);
          gain.gain.setValueAtTime(_v(0.07), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(); osc.stop(now + 0.08);
          break;
        case 'upgrade':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(_f(500), now);
          osc.frequency.setValueAtTime(_f(700), now + 0.1);
          osc.frequency.setValueAtTime(_f(1000), now + 0.2);
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(); osc.stop(now + 0.3);
          break;
        case 'sell':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(_f(800), now);
          osc.frequency.exponentialRampToValueAtTime(_f(400), now + 0.2);
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(); osc.stop(now + 0.2);
          break;
        case 'waveStart':
          osc.type = 'square';
          osc.frequency.setValueAtTime(_f(300), now);
          osc.frequency.setValueAtTime(_f(400), now + 0.15);
          osc.frequency.setValueAtTime(_f(500), now + 0.3);
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(); osc.stop(now + 0.5);
          break;
        case 'explosion':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(_f(100), now);
          osc.frequency.exponentialRampToValueAtTime(_f(30), now + 0.3);
          gain.gain.setValueAtTime(_v(0.12), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(); osc.stop(now + 0.3);
          break;
        case 'loseLife':
          // 基地被击中 - 低频震荡
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(_f(120), now);
          osc.frequency.exponentialRampToValueAtTime(_f(40), now + 0.35);
          gain.gain.setValueAtTime(_v(0.12), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(); osc.stop(now + 0.4);
          break;
        case 'victory':
          // 胜利号角 - 上行大三和弦 C-E-G
          osc.type = 'sine';
          osc.frequency.setValueAtTime(_f(523), now); // C5
          osc.frequency.setValueAtTime(_f(659), now + 0.15); // E5
          osc.frequency.setValueAtTime(_f(784), now + 0.3); // G5
          osc.frequency.setValueAtTime(_f(1047), now + 0.45); // C6
          gain.gain.setValueAtTime(_v(0.12), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.start(); osc.stop(now + 0.6);
          break;
        case 'defeat':
          // 失败音 - 下行小三和弦
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(_f(440), now); // A4
          osc.frequency.setValueAtTime(_f(415), now + 0.2); // Ab4
          osc.frequency.setValueAtTime(_f(392), now + 0.4); // G4
          osc.frequency.setValueAtTime(_f(349), now + 0.6); // F4
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          osc.start(); osc.stop(now + 0.8);
          break;
        case 'click':
          // UI 点击确认 - 短促亮音
          osc.type = 'sine';
          osc.frequency.setValueAtTime(_f(1200), now);
          osc.frequency.exponentialRampToValueAtTime(_f(800), now + 0.04);
          gain.gain.setValueAtTime(_v(0.06), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(); osc.stop(now + 0.05);
          break;
        case 'spawn':
          // 敌人从传送门出现 - 诡异的低频冒泡
          osc.type = 'sine';
          osc.frequency.setValueAtTime(_f(80), now);
          osc.frequency.exponentialRampToValueAtTime(_f(160), now + 0.15);
          gain.gain.setValueAtTime(_v(0.05), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(); osc.stop(now + 0.2);
          break;
        case 'reachBase':
          // 敌人到达基地 - 沉重的轰鸣（不同于 loseLife，更重）
          osc.type = 'square';
          osc.frequency.setValueAtTime(_f(60), now);
          osc.frequency.exponentialRampToValueAtTime(_f(20), now + 0.5);
          gain.gain.setValueAtTime(_v(0.15), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.start(); osc.stop(now + 0.6);
          break;
        case 'towerSelect':  // 选中塔卡
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(_f(700), now);
          osc.frequency.setValueAtTime(_f(900), now + 0.05);
          gain.gain.setValueAtTime(_v(0.08), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(); osc.stop(now + 0.1);
          break;
        case 'towerDeny':    // 钱不够放塔
          osc.type = 'square';
          osc.frequency.setValueAtTime(_f(200), now);
          osc.frequency.setValueAtTime(_f(150), now + 0.08);
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(); osc.stop(now + 0.15);
          break;
        case 'synergy':      // 触发组合效果
          osc.type = 'sine';
          osc.frequency.setValueAtTime(_f(880), now);
          osc.frequency.setValueAtTime(_f(1100), now + 0.06);
          osc.frequency.setValueAtTime(_f(1320), now + 0.12);
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(); osc.stop(now + 0.3);
          break;
        case 'cardPick':     // 选卡（卡牌三选一）
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(_f(523), now);  // C5
          osc.frequency.setValueAtTime(_f(659), now + 0.08);  // E5
          osc.frequency.setValueAtTime(_f(784), now + 0.16);  // G5
          gain.gain.setValueAtTime(_v(0.1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.start(); osc.stop(now + 0.25);
          break;
        case 'ultimate':     // R 键大招
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(_f(200), now);
          osc.frequency.exponentialRampToValueAtTime(_f(800), now + 0.2);
          osc.frequency.exponentialRampToValueAtTime(_f(100), now + 0.5);
          gain.gain.setValueAtTime(_v(0.12), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.start(); osc.stop(now + 0.6);
          break;
        case 'towerEvolve':  // 塔升满级进化
          osc.type = 'square';
          osc.frequency.setValueAtTime(_f(400), now);
          osc.frequency.setValueAtTime(_f(600), now + 0.1);
          osc.frequency.setValueAtTime(_f(900), now + 0.2);
          osc.frequency.setValueAtTime(_f(1200), now + 0.3);
          gain.gain.setValueAtTime(_v(0.12), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(); osc.stop(now + 0.5);
          break;
      }
    } catch (e) {
      // 忽略音频错误
    }
  }

  /**
   * 塔开火音效包装：音调随等级递增 15%/级
   * Lv1 → pitch=1.0；Lv2 → pitch=1.15；Lv3 → pitch=1.30
   * @param {string} towerType - 塔的开火音效类型（laser/tesla/missile/cryo/plasma）
   * @param {number} [level=1] - 塔等级
   */
  playTowerFire(towerType, level = 1) {
    const pitch = 1 + (level - 1) * 0.15;
    this.play(towerType, { pitch });
  }

  /**
   * 切换静音（并持久化）
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    this._persistMuted();
    return this.isMuted;
  }

  /**
   * 直接设置静音状态（并持久化）
   * @param {boolean} muted
   */
  setMuted(muted) {
    this.isMuted = !!muted;
    this._persistMuted();
    return this.isMuted;
  }
}
