// ================================================================
// 特效系统 - 粒子、视觉特效、屏幕震动
// 升级：新特效类型(hitSpark/towerCharge/deathExplosion/screenFlash)、
//       拖尾粒子、螺旋粒子、爆炸碎片粒子、粒子颜色渐变、方向性震动
// ================================================================
import { SHAKE } from '../core/Constants.js';

/** 最大同时存活粒子数量（超过时强制回收最老粒子，防止粒子爆炸导致卡顿） */
const MAX_PARTICLES = 800;

/** 敌人类型对应死亡爆炸颜色映射 */
const DEATH_EXPLOSION_COLORS = {
  bug:      { core: '#ff9944', edge: '#ffcc66', glow: '#ffdd88' },  // 暖橙（小虫）
  fast:     { core: '#66ddff', edge: '#88eeff', glow: '#aaf0ff' },  // 青蓝（快速）
  tank:     { core: '#aa7755', edge: '#cc9966', glow: '#ddbb88' },  // 褐棕（坦克）
  swarm:    { core: '#99ff66', edge: '#bbff88', glow: '#ccffaa' },  // 嫩绿（蜂群）
  armored:  { core: '#aaaaaa', edge: '#cccccc', glow: '#eeeeee' },  // 银白（装甲）
  healer:   { core: '#ff88cc', edge: '#ffaadd', glow: '#ffccee' },  // 粉紫（治疗）
  shielded: { core: '#77aaff', edge: '#99ccff', glow: '#bbeeff' },  // 天蓝（护盾）
  splitter: { core: '#dd66ff', edge: '#ee88ff', glow: '#ffaaff' },  // 紫罗兰（分裂）
  boss:     { core: '#ff4444', edge: '#ff6644', glow: '#ffaa44' },  // 红橙（Boss）
  minibug:  { core: '#ffbb55', edge: '#ffcc77', glow: '#ffdd99' },  // 浅橙（小虫）
  frost:    { core: '#88ddff', edge: '#aaeeff', glow: '#ccf5ff' },  // 冰蓝（冰冻）
  fire:     { core: '#ff5533', edge: '#ff7744', glow: '#ffaa55' },  // 火红（火焰）
};

export class EffectSystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    /** @type {Array} 粒子数组 */
    this.particles = [];
    /** @type {Array} 视觉特效数组 */
    this.effects = [];
    /** 屏幕震动状态（增强：支持方向和衰减曲线） */
    this.screenShake = {
      intensity: 0,
      timer: 0,
      maxTimer: 0,
      dirX: 0,
      dirY: 0,
      curve: 'easeOut',
    };
    /** 震动偏移复用对象 */
    this._shakeOffset = { x: 0, y: 0 };
    /** 屏幕闪光状态 */
    this.screenFlash = { alpha: 0, color: '#ffffff', timer: 0, maxTimer: 0 };

    /** 粒子对象池 */
    this._pool = [];
    /** 对象池初始大小（增加以支持更多粒子类型） */
    this._poolInitSize = 400;
    /** hex 解析缓存（#rrggbb -> 打包整数），供 _lerpColor 热路径零分配 */
    this._hexParseCache = new Map();
    /** 插值结果缓存（量化步进 key -> rgb 字符串） */
    this._lerpCache = new Map();
    this._initPool();
  }

  /**
   * 初始化粒子对象池（扩展粒子属性）
   */
  _initPool() {
    for (let i = 0; i < this._poolInitSize; i++) {
      this._pool.push(this._createEmptyParticle());
    }
  }

  /**
   * 创建一个空粒子（包含所有可能属性）
   */
  _createEmptyParticle() {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0, size: 0, color: '#ffffff',
      // === 升级属性 ===
      gravity: 0,           // 重力
      drag: 0.96,           // 阻力
      particleType: 'dot',  // 粒子类型：dot / trail / spiral / shrapnel / spark / glow
      startColor: null,     // 起始颜色（用于渐变）
      endColor: null,       // 结束颜色（用于渐变）
      currentColor: null,   // 当前计算后的颜色（渲染用）
      rotation: 0,          // 旋转角度（碎片类）
      rotationSpeed: 0,     // 旋转速度
      trailTarget: null,    // 拖尾目标（追踪目标的 {x,y} 引用）
      trailLength: 0,       // 拖尾长度
      spiralRadius: 0,      // 螺旋半径
      spiralSpeed: 0,       // 螺旋角速度
      spiralAngle: 0,       // 当前螺旋角度
      shrapnelShape: 0,     // 碎片形状（0=方块 1=三角 2=短线）
      glowSize: 0,          // 辉光大小倍率
      fadeIn: 0,            // 淡入时间（秒）
    };
  }

  /**
   * 从对象池获取粒子
   * 当存活粒子达到上限时，强制回收最老的粒子（队首），避免粒子爆炸导致性能问题
   * @returns {Object} 粒子对象
   */
  acquireParticle() {
    // 达到最大粒子数量时，强制回收最老的粒子
    if (this.particles.length >= MAX_PARTICLES) {
      const oldest = this.particles.shift();
      if (oldest) {
        this._pool.push(oldest);
      }
    }

    if (this._pool.length > 0) {
      const p = this._pool.pop();
      // 重置扩展属性
      p.gravity = 0;
      p.drag = 0.96;
      p.particleType = 'dot';
      p.startColor = null;
      p.endColor = null;
      p.currentColor = null;
      p.rotation = 0;
      p.rotationSpeed = 0;
      p.trailTarget = null;
      p.trailLength = 0;
      p.spiralRadius = 0;
      p.spiralSpeed = 0;
      p.spiralAngle = 0;
      p.shrapnelShape = 0;
      p.glowSize = 0;
      p.fadeIn = 0;
      p.life = 0;
      p.maxLife = 0;
      p.x = 0; p.y = 0;
      p.vx = 0; p.vy = 0;
      p.size = 0;
      p.color = '#ffffff';
      return p;
    }
    // 池空时自动创建新粒子
    return this._createEmptyParticle();
  }

  /**
   * 回收粒子到对象池
   * @param {Object} particle - 粒子对象
   */
  releaseParticle(particle) {
    this._pool.push(particle);
  }

  /**
   * 更新所有特效
   * @param {number} dt - 时间增量
   */
  update(dt) {
    // 更新粒子
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // 螺旋粒子：围绕目标旋转
      if (p.particleType === 'spiral' && p.trailTarget) {
        p.spiralAngle += p.spiralSpeed * dt;
        const targetX = p.trailTarget.x || p.trailTarget.x || 0;
        const targetY = p.trailTarget.y || p.trailTarget.y || 0;
        // 向目标收缩
        p.spiralRadius *= 0.98;
        p.x = targetX + Math.cos(p.spiralAngle) * p.spiralRadius;
        p.y = targetY + Math.sin(p.spiralAngle) * p.spiralRadius;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      // 重力
      if (p.gravity && p.gravity > 0) {
        p.vy += p.gravity * dt;
      }

      // 阻力
      const drag = p.drag !== undefined ? p.drag : 0.96;
      p.vx *= drag;
      p.vy *= drag;

      // 旋转
      if (p.rotationSpeed !== 0) {
        p.rotation += p.rotationSpeed * dt;
      }

      // 颜色渐变插值
      if (p.startColor && p.endColor && p.maxLife > 0) {
        const t = 1 - p.life / p.maxLife;
        p.currentColor = this._lerpColor(p.startColor, p.endColor, t);
      }

      p.life -= dt;
    }
    // in-place 回收（避免每帧filter创建新数组）
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i].life <= 0) {
        this._pool.push(this.particles[i]);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }

    // 更新特效 + in-place swap-and-pop 清理（避免每帧 filter 创建新数组）
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.timer -= dt;
      // 冲击波使用 life 属性
      if (e.type === 'shockwave' && e.life !== undefined) {
        e.life -= dt;
      }
      // towerCharge 更新充能进度
      if (e.type === 'towerCharge') {
        e.chargeProgress = Math.min(1, 1 - e.timer / e.maxTimer);
      }
      if (e.timer <= 0 || (e.life !== undefined && e.life <= 0)) {
        this.effects[i] = this.effects[this.effects.length - 1];
        this.effects.pop();
      }
    }

    // 更新屏幕震动（不受游戏速度影响，使用增强衰减）
    if (this.screenShake.timer > 0) {
      this.screenShake.timer -= dt;
      if (this.screenShake.timer <= 0) {
        this.screenShake.intensity = 0;
        this.screenShake.maxTimer = 0;
        this.screenShake.dirX = 0;
        this.screenShake.dirY = 0;
      }
    }

    // 更新屏幕闪光
    if (this.screenFlash.timer > 0) {
      this.screenFlash.timer -= dt;
      this.screenFlash.alpha = this.screenFlash.timer / this.screenFlash.maxTimer;
    } else {
      this.screenFlash.alpha = 0;
    }
  }

  /**
   * 颜色插值（hex -> rgb 字符串）
   * 性能：解析结果与插值结果均按 1/32 步进量化缓存，热路径（每粒子每帧）零分配。
   * 量化在视觉上不可分辨（每条渐变至多 33 档）。
   * @param {string} c1 - 起始颜色 #rrggbb
   * @param {string} c2 - 结束颜色 #rrggbb
   * @param {number} t - 插值因子 0~1
   * @returns {string} rgb 字符串
   */
  _lerpColor(c1, c2, t) {
    const p1 = this._hexCache(c1);
    const p2 = this._hexCache(c2);
    // 量化到 32 档，让结果字符串可被缓存复用
    const step = Math.round(Math.min(1, Math.max(0, t)) * 32);
    // 数字缓存键：p1(24bit) | p2(24bit) | step(6bit) 拼接，合计 ≤53bit 安全整数
    const key = p1 * 0x20000000 + p2 * 64 + step;
    let cached = this._lerpCache.get(key);
    if (cached === undefined) {
      const f = step / 32;
      const r = Math.round(((p1 >> 16) & 255) + (((p2 >> 16) & 255) - ((p1 >> 16) & 255)) * f);
      const g = Math.round(((p1 >> 8) & 255) + (((p2 >> 8) & 255) - ((p1 >> 8) & 255)) * f);
      const b = Math.round((p1 & 255) + ((p2 & 255) - (p1 & 255)) * f);
      cached = `rgb(${r},${g},${b})`;
      if (this._lerpCache.size < 4096) {
        this._lerpCache.set(key, cached);
      }
    }
    return cached;
  }

  /**
   * hex 颜色解析缓存（#rrggbb -> 打包整数 0xRRGGBB）
   * @param {string} hex
   * @returns {number}
   */
  _hexCache(hex) {
    let packed = this._hexParseCache.get(hex);
    if (packed === undefined) {
      const h = hex.replace('#', '');
      packed = (parseInt(h.substring(0, 2), 16) << 16) |
               (parseInt(h.substring(2, 4), 16) << 8) |
               parseInt(h.substring(4, 6), 16);
      this._hexParseCache.set(hex, packed);
    }
    return packed;
  }

  /**
   * 触发屏幕震动（增强版：支持方向和曲线）
   * @param {number} intensity - 震动强度
   * @param {number} timer - 震动持续时间
   * @param {Object} [opts] - 可选参数
   * @param {number} [opts.dirX=0] - X方向
   * @param {number} [opts.dirY=0] - Y方向
   * @param {string} [opts.curve='easeOut'] - 衰减曲线
   */
  shake(intensity, timer, opts = {}) {
    if (intensity <= 0 || timer <= 0) return;
    // 使用 Math.max 实现叠加（取较大值），保持向后兼容
    this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
    this.screenShake.timer = Math.max(this.screenShake.timer, timer);
    this.screenShake.maxTimer = Math.max(this.screenShake.maxTimer, timer);
    if (opts.dirX !== undefined || opts.dirY !== undefined) {
      this.screenShake.dirX = opts.dirX || 0;
      this.screenShake.dirY = opts.dirY || 0;
    }
    if (opts.curve) {
      this.screenShake.curve = opts.curve;
    }
  }

  /**
   * Agent A2 P1-3: 通过 SHAKE preset 触发屏幕震动
   * @param {{intensity:number, timer:number}|null|undefined} preset - SHAKE 字典中的 preset
   */
  shakePreset(preset) {
    if (!preset) return;
    this.shake(preset.intensity, preset.timer);
  }

  /**
   * 获取当前震动偏移（增强：支持方向性震动 + easeOut 衰减）
   * @returns {{x: number, y: number}}
   */
  getShakeOffset() {
    if (this.screenShake.timer > 0 && this.screenShake.maxTimer > 0) {
      // easeOut 二次衰减：前期强、后期快速减弱（更自然的冲击感）
      const t = 1 - this.screenShake.timer / this.screenShake.maxTimer;
      const decay = 1 - t * t; // easeOut quad
      const currentIntensity = this.screenShake.intensity * decay;

      if (this.screenShake.dirX === 0 && this.screenShake.dirY === 0) {
        // 全方向随机（原有行为）
        this._shakeOffset.x = (Math.random() - 0.5) * currentIntensity * 2;
        this._shakeOffset.y = (Math.random() - 0.5) * currentIntensity * 2;
      } else {
        // 方向性震动：主方向大幅 + 垂直方向小幅
        const len = Math.sqrt(this.screenShake.dirX * this.screenShake.dirX + this.screenShake.dirY * this.screenShake.dirY) || 1;
        const nx = this.screenShake.dirX / len;
        const ny = this.screenShake.dirY / len;
        // 主方向正弦波震荡 + 随机扰动（避免完全规律）
        const phase = Math.sin(t * Math.PI * 12) * currentIntensity;
        const mainAmp = phase + (Math.random() - 0.5) * currentIntensity * 0.6;
        const perpAmp = (Math.random() - 0.5) * currentIntensity * 0.4;
        this._shakeOffset.x = nx * mainAmp + (-ny) * perpAmp;
        this._shakeOffset.y = ny * mainAmp + nx * perpAmp;
      }
    } else {
      this._shakeOffset.x = 0;
      this._shakeOffset.y = 0;
    }
    return this._shakeOffset;
  }

  /**
   * 是否正在震动
   */
  isShaking() {
    return this.screenShake.timer > 0;
  }

  /**
   * 触发屏幕闪光
   * @param {string} color - 闪光颜色
   * @param {number} duration - 持续时间(秒)
   * @param {number} alpha - 初始透明度
   */
  addScreenFlash(color = '#ffffff', duration = 0.15, alpha = 0.6) {
    this.screenFlash = {
      alpha,
      color,
      timer: duration,
      maxTimer: duration,
    };
  }

  // === 特效创建方法 ===

  /**
   * 放置特效
   */
  addPlaceEffect(x, y, color) {
    this.effects.push({
      type: 'place',
      x, y,
      timer: 0.6,
      maxTimer: 0.6,
      color
    });
  }

  /**
   * 升级特效
   */
  addUpgradeEffect(x, y) {
    this.effects.push({
      type: 'upgrade',
      x, y,
      timer: 0.9,
      maxTimer: 0.9,
      color: '#ffdd44'
    });
  }

  /**
   * 出售特效
   */
  addSellEffect(x, y, value) {
    // 金币粒子
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 60 + 30;
      const p = this.acquireParticle();
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 40;
      p.life = 0.8;
      p.maxLife = 0.8;
      p.size = 4;
      p.color = '#ffdd44';
      p.startColor = '#fff5cc';
      p.endColor = '#ffaa22';
      p.particleType = 'glow';
      p.glowSize = 1.5;
      p.gravity = 80;
      this.particles.push(p);
    }
    this.effects.push({
      type: 'sellText',
      x, y,
      timer: 1.0,
      maxTimer: 1.0,
      value
    });
  }

  /**
   * 能量获得特效
   */
  addEnergyGainEffect(x, y, value) {
    this.effects.push({
      type: 'energyGain',
      x, y,
      timer: 0.8,
      maxTimer: 0.8,
      color: '#ffdd44',
      value
    });
  }

  /**
   * 利息特效
   */
  addInterestEffect(x, y, value) {
    this.effects.push({
      type: 'interestText',
      x, y,
      timer: 2.0,
      maxTimer: 2.0,
      value
    });
  }

  /**
   * 伤害数字特效
   * @param {number} x,y      位置
   * @param {number} value    伤害值
   * @param {string} color    主色（可选）
   * @param {boolean} big     是否暴击（大字号 + 星爆 + 弹跳）
   * @param {boolean} mega    是否核弹级（最大字号 + 旋转 + !!）
   */
  addDamageNumber(x, y, value, color, big = false, mega = false) {
    // mega 自动 = 大伤害值时也升级
    if (!mega && !big && value >= 100) mega = true;
    if (!big && value >= 30) big = true;

    this.effects.push({
      type: 'damageNumber',
      x: x + (Math.random() - 0.5) * 24,
      y: y - 10,
      value: Math.round(value),
      timer: big ? 1.0 : 0.8,
      maxTimer: big ? 1.0 : 0.8,
      color,
      big,
      mega
    });
  }

  /**
   * 击中火花特效（增强版：多层火花 + 方向性 + 颜色渐变）
   * @param {number} x - 命中X
   * @param {number} y - 命中Y
   * @param {string} [color] - 火花颜色
   * @param {number} [intensity=1] - 强度
   * @param {number} [dirX=0] - 击中来向X（用于方向性火花）
   * @param {number} [dirY=0] - 击中来向Y
   */
  addHitSpark(x, y, color, intensity = 1, dirX = 0, dirY = 0) {
    const baseColor = color || '#ffcc88';
    const hasDirection = (dirX !== 0 || dirY !== 0);
    let nAngle = 0, nLen = 1;
    if (hasDirection) {
      nLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      nAngle = Math.atan2(dirY / nLen, dirX / nLen);
    }

    // 中心闪光
    this.effects.push({
      type: 'hitSpark',
      x, y,
      timer: 0.22,
      maxTimer: 0.22,
      color: baseColor,
      size: 8 * intensity,
    });

    // 主火花粒子（有方向时集中在命中方向的反射方向）
    const count = Math.floor(8 + 6 * intensity);
    for (let i = 0; i < count; i++) {
      let angle;
      if (hasDirection) {
        // 反射方向 ±60度扇形
        angle = nAngle + Math.PI + (Math.random() - 0.5) * (Math.PI * 0.7);
      } else {
        angle = Math.random() * Math.PI * 2;
      }
      const speed = 100 + Math.random() * 140 * intensity;
      const p = this.acquireParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.2 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.size = 1.5 + Math.random() * 2;
      p.color = baseColor;
      p.startColor = '#fff8e8';
      p.endColor = baseColor;
      p.particleType = 'spark';
      p.glowSize = 2;
      p.gravity = 40;
      this.particles.push(p);
    }

    // 中心高亮粒子
    for (let i = 0; i < 4; i++) {
      const angle = hasDirection
        ? nAngle + Math.PI + (Math.random() - 0.5) * 0.8
        : Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 50;
      const p = this.acquireParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.15 + Math.random() * 0.15;
      p.maxLife = p.life;
      p.size = 2.5;
      p.color = '#ffffff';
      p.particleType = 'glow';
      p.glowSize = 3;
      this.particles.push(p);
    }
  }

  /**
   * 塔攻击充能特效（塔开火前的蓄能光环 + 螺旋粒子）
   * @param {number} x - 塔中心X
   * @param {number} y - 塔中心Y
   * @param {string} color - 充能颜色
   * @param {number} duration - 充能时间(秒)
   * @param {number} [chargeLevel=1] - 充能等级(1~3)，影响光环大小和粒子数
   * @param {{x:number,y:number}} [target] - 目标位置（螺旋粒子朝目标吸入）
   */
  addTowerCharge(x, y, color, duration, chargeLevel = 1, target = null) {
    // 充能光环特效
    this.effects.push({
      type: 'towerCharge',
      x, y,
      timer: duration,
      maxTimer: duration,
      color: color || '#ffcc44',
      chargeProgress: 0,
      chargeLevel,
      targetX: target ? target.x : x,
      targetY: target ? target.y : y,
    });

    // 螺旋吸入粒子（朝目标/中心收缩）
    const spiralCount = 6 + chargeLevel * 3;
    const targetRef = target || { x, y };
    for (let i = 0; i < spiralCount; i++) {
      const startAngle = (Math.PI * 2 / spiralCount) * i;
      const p = this.acquireParticle();
      p.x = x + Math.cos(startAngle) * 25;
      p.y = y + Math.sin(startAngle) * 25;
      p.vx = 0;
      p.vy = 0;
      p.life = duration;
      p.maxLife = duration;
      p.size = 2.5 + chargeLevel * 0.5;
      p.color = color || '#ffcc44';
      p.startColor = color || '#ffcc44';
      p.endColor = '#ffffff';
      p.particleType = 'spiral';
      p.trailTarget = targetRef;
      p.spiralRadius = 20 + Math.random() * 10;
      p.spiralSpeed = 8 + Math.random() * 4;
      p.spiralAngle = startAngle;
      p.glowSize = 2;
      this.particles.push(p);
    }
  }

  /**
   * 敌人死亡爆炸特效（不同敌人类型不同颜色，含碎片粒子）
   * @param {number} x - 死亡位置X
   * @param {number} y - 死亡位置Y
   * @param {string} enemyType - 敌人类型ID（用于颜色映射）
   * @param {number} [sizeScale=1] - 尺寸缩放
   * @param {boolean} [isBoss=false] - 是否Boss
   */
  addDeathExplosion(x, y, enemyType, sizeScale = 1, isBoss = false) {
    const colors = DEATH_EXPLOSION_COLORS[enemyType] || DEATH_EXPLOSION_COLORS.bug;
    const scale = isBoss ? sizeScale * 2 : sizeScale;

    // 1) 爆炸核心特效（死亡爆炸类型，含多层光环）
    this.effects.push({
      type: 'deathExplosion',
      x, y,
      timer: isBoss ? 0.6 : 0.4,
      maxTimer: isBoss ? 0.6 : 0.4,
      coreColor: colors.core,
      edgeColor: colors.edge,
      glowColor: colors.glow,
      radius: 20 * scale,
      isBoss,
    });

    // 2) 冲击波
    this.effects.push({
      type: 'shockwave',
      x, y,
      radius: 5,
      maxRadius: (isBoss ? 100 : 50) * scale,
      life: isBoss ? 0.5 : 0.35,
      maxLife: isBoss ? 0.5 : 0.35,
      color: colors.edge,
    });

    // 3) 闪光
    this.effects.push({
      type: 'flash',
      x, y,
      timer: isBoss ? 0.3 : 0.2,
      maxTimer: isBoss ? 0.3 : 0.2,
      size: (isBoss ? 80 : 45) * scale,
      color: colors.glow,
    });

    // 4) 放射火花粒子（颜色渐变）
    const sparkCount = Math.floor((isBoss ? 30 : 14) * scale);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * (isBoss ? 220 : 140);
      const p = this.acquireParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.4 + Math.random() * (isBoss ? 0.5 : 0.3);
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 2.5;
      p.color = colors.edge;
      p.startColor = colors.glow;
      p.endColor = colors.core;
      p.particleType = 'spark';
      p.glowSize = 1.8;
      p.gravity = 60;
      this.particles.push(p);
    }

    // 5) 爆炸碎片粒子（带旋转，shrapnel 类型）
    const fragCount = Math.floor((isBoss ? 16 : 6) * scale);
    for (let i = 0; i < fragCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * (isBoss ? 180 : 100);
      const p = this.acquireParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 30;
      p.life = 0.5 + Math.random() * (isBoss ? 0.5 : 0.3);
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 4;
      p.color = colors.core;
      p.startColor = colors.edge;
      p.endColor = '#332211';
      p.particleType = 'shrapnel';
      p.shrapnelShape = Math.floor(Math.random() * 3);
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 15;
      p.gravity = 120;
      p.drag = 0.94;
      this.particles.push(p);
    }

    // 6) Boss额外：上升烟雾余烬
    if (isBoss) {
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 30;
        const p = this.acquireParticle();
        p.x = x + Math.cos(angle) * dist;
        p.y = y + Math.sin(angle) * dist;
        p.vx = (Math.random() - 0.5) * 40;
        p.vy = -40 - Math.random() * 60;
        p.life = 0.8 + Math.random() * 0.6;
        p.maxLife = p.life;
        p.size = 4 + Math.random() * 4;
        p.color = '#553322';
        p.startColor = colors.core;
        p.endColor = '#221100';
        p.particleType = 'glow';
        p.glowSize = 1;
        p.gravity = -20; // 向上飘
        p.drag = 0.98;
        this.particles.push(p);
      }
      // Boss 屏幕闪光
      this.addScreenFlash(colors.glow, 0.2, isBoss ? 0.5 : 0.3);
    }
  }

  /**
   * 添加轨迹拖尾粒子（用于投射物/移动目标）
   * @param {{x:number,y:number}} target - 生成拖尾的目标（带 x/y 属性，会每帧更新位置）
   * @param {string} color - 拖尾颜色
   * @param {number} [rate=0.02] - 生成间隔(秒)
   * @param {number} [size=3] - 粒子大小
   * @param {number} [life=0.3] - 每个拖尾粒子生命周期
   */
  addTrailEmitter(target, color, rate = 0.02, size = 3, life = 0.3) {
    // 直接立即生成一个拖尾粒子（不是持续的，由调用方在更新循环中按rate控制）
    const p = this.acquireParticle();
    p.x = target.x;
    p.y = target.y;
    p.vx = (Math.random() - 0.5) * 20;
    p.vy = (Math.random() - 0.5) * 20;
    p.life = life + Math.random() * 0.1;
    p.maxLife = p.life;
    p.size = size * (0.7 + Math.random() * 0.6);
    p.color = color;
    p.startColor = color;
    p.endColor = '#000000';
    p.particleType = 'trail';
    p.glowSize = 1.5;
    p.drag = 0.9;
    p.gravity = 0;
    this.particles.push(p);
  }

  /**
   * 爆炸特效
   */
  addExplosion(x, y, color, size) {
    const count = Math.floor(12 + size * 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 80 + 30;
      const p = this.acquireParticle();
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = Math.random() * 0.5 + 0.3;
      p.maxLife = p.life;
      p.size = Math.random() * 4 + 2;
      p.color = color;
      p.startColor = '#fff5e6';
      p.endColor = color;
      p.particleType = 'spark';
      p.glowSize = 1.5;
      p.gravity = 50;
      this.particles.push(p);
    }
    this.effects.push({
      type: 'flash',
      x, y,
      timer: 0.2,
      maxTimer: 0.2,
      size: size * 20,
      color
    });
    // 冲击波环
    const cell = 56;
    this.effects.push({
      type: 'shockwave',
      x, y,
      radius: 5,
      maxRadius: cell * 1.2,
      life: 0.3,
      maxLife: 0.3,
      color: color || '#ff8833'
    });
  }

  // ================================================================
  // Boss 大型死亡爆炸（30+ 粒子 + 冲击波 + 中央闪光）
  // ================================================================
  /**
   * Boss 级大型爆炸：放射粒子 + 冲击波 + 中心闪光 + 二次小爆炸
   * @param {number} x - 中心X
   * @param {number} y - 中心Y
   * @param {string} color - 主色（默认 #ffaa44）
   * @param {number} intensity - 强度倍数（默认 1）
   */
  addBigExplosion(x, y, color = '#ffaa44', intensity = 1) {
    // === 1) 30+ 放射粒子（重力下落，颜色更丰富） ===
    const particleCount = Math.floor(30 * intensity);
    const colors = ['#ff5544', '#ff9944', '#ffdd44', '#fff5cc', color, '#ff7733', '#ffaaff'];
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.3;
      const speed = 100 + Math.random() * 250;
      const p = this.acquireParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.6 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 3;
      const c = colors[Math.floor(Math.random() * colors.length)];
      p.color = c;
      p.startColor = '#fff5cc';
      p.endColor = c;
      p.particleType = 'spark';
      p.glowSize = 2;
      p.gravity = 100;
      this.particles.push(p);
    }

    // === 2) 碎片粒子 ===
    for (let i = 0; i < Math.floor(12 * intensity); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      const p = this.acquireParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 50;
      p.life = 0.6 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 4;
      p.color = '#aa5533';
      p.startColor = color;
      p.endColor = '#332211';
      p.particleType = 'shrapnel';
      p.shrapnelShape = Math.floor(Math.random() * 3);
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 12;
      p.gravity = 150;
      p.drag = 0.95;
      this.particles.push(p);
    }

    // === 3) 二次小爆炸粒子（延迟） ===
    for (let i = 0; i < 3; i++) {
      const offX = (Math.random() - 0.5) * 30 * intensity;
      const offY = (Math.random() - 0.5) * 30 * intensity;
      const count2 = Math.floor(8 * intensity);
      for (let j = 0; j < count2; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 100;
        const p = this.acquireParticle();
        p.x = x + offX;
        p.y = y + offY;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.4 + Math.random() * 0.3;
        p.maxLife = p.life;
        p.size = 2 + Math.random() * 2;
        p.color = Math.random() < 0.5 ? '#ffaa44' : '#ff5544';
        p.startColor = '#ffdd88';
        p.endColor = '#ff5522';
        p.particleType = 'spark';
        p.glowSize = 1.5;
        p.gravity = 80;
        this.particles.push(p);
      }
    }

    // === 4) 冲击波环 ===
    this.effects.push({
      type: 'shockwave',
      x, y,
      timer: 0.7,
      maxTimer: 0.7,
      radius: 0,
      maxRadius: 90 * intensity,
      life: 0.7,
      maxLife: 0.7,
      color: color || '#ffaa44'
    });

    // === 5) 中央闪光 ===
    this.effects.push({
      type: 'flash',
      x, y,
      timer: 0.35,
      maxTimer: 0.35,
      size: 70 * intensity,
      color: '#fff5cc'
    });

    // === 6) 屏幕闪光 ===
    this.addScreenFlash('#fff0cc', 0.18, 0.4);

    // === 7) 二次小冲击波（0.1s 延迟后） ===
    setTimeout(() => {
      if (this._disposed) return;
      this.effects.push({
        type: 'shockwave',
        x, y,
        timer: 0.4,
        maxTimer: 0.4,
        radius: 0,
        maxRadius: 50 * intensity,
        life: 0.4,
        maxLife: 0.4,
        color: '#ff7733'
      });
    }, 100);
  }

  // ================================================================
  // 主动技能特效（中心放射 + 闪光）
  // ================================================================
  /**
   * 主动技能触发时的视觉反馈：中心放射粒子 + 闪光
   * @param {number} x - 中心X
   * @param {number} y - 中心Y
   * @param {string} color - 主色（默认 #ffdd44）
   */
  addAbilityEffect(x, y, color = '#ffdd44') {
    // === 1) 中心放射粒子 ===
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const speed = 200;
      const p = this.acquireParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.5;
      p.maxLife = 0.5;
      p.size = 2;
      p.color = color;
      p.startColor = '#ffffff';
      p.endColor = color;
      p.particleType = 'spark';
      p.glowSize = 2;
      this.particles.push(p);
    }
    // === 2) 中心闪光 ===
    this.effects.push({
      type: 'flash',
      x, y,
      timer: 0.3,
      maxTimer: 0.3,
      color,
      size: 80
    });
    // === 3) 屏幕闪光 ===
    this.addScreenFlash(color, 0.12, 0.3);
  }

  /**
   * 导弹爆炸特效
   */
  addMissileExplosion(x, y, radius) {
    this.effects.push({
      type: 'explosion',
      x, y,
      timer: 0.4,
      maxTimer: 0.4,
      radius,
      color: '#ff8833'
    });
    this.addExplosion(x, y, '#ff8833', 1.0);
    this.addScreenFlash('#ffcc88', 0.1, 0.25);
  }

  /**
   * 激光特效
   */
  addLaserEffect(x1, y1, x2, y2, color) {
    this.effects.push({
      type: 'laser',
      x1, y1, x2, y2,
      timer: 0.15,
      maxTimer: 0.15,
      color
    });
  }

  /**
   * 电磁塔特效
   */
  addTeslaEffect(points, color) {
    this.effects.push({
      type: 'tesla',
      points,
      timer: 0.25,
      maxTimer: 0.25,
      color
    });
  }

  /**
   * 像素 bolt 命中特效（FreeGameSprites 风格 32x32 雷电 sprite）
   * @param {number} x - 中心 x
   * @param {number} y - 中心 y
   * @param {number} scale - 缩放
   * @param {boolean} isMain - 是否主目标
   */
  addPixelBoltEffect(x, y, scale = 1.0, isMain = false) {
    this.effects.push({
      type: 'pixelBolt',
      x, y,
      scale,
      isMain,
      timer: 0.32,
      maxTimer: 0.32,
    });
    if (isMain) {
      this.effects.push({
        type: 'pixelSpark',
        x, y,
        scale: scale * 1.4,
        timer: 0.4,
        maxTimer: 0.4,
      });
    }
  }

  /**
   * 冷冻射线特效
   */
  addCryoBeamEffect(x1, y1, x2, y2) {
    this.effects.push({
      type: 'cryoBeam',
      x1, y1, x2, y2,
      timer: 0.2,
      maxTimer: 0.2,
      color: '#77ccdd'
    });
    // 冰霜粒子
    for (let i = 0; i < 5; i++) {
      const p = this.acquireParticle();
      p.x = x2 + (Math.random() - 0.5) * 20;
      p.y = y2 + (Math.random() - 0.5) * 20;
      p.vx = (Math.random() - 0.5) * 30;
      p.vy = (Math.random() - 0.5) * 30 - 20;
      p.life = 0.6;
      p.maxLife = 0.6;
      p.size = 3;
      p.color = '#aaddcc';
      p.startColor = '#eeffff';
      p.endColor = '#88bbcc';
      p.particleType = 'glow';
      p.glowSize = 1.5;
      this.particles.push(p);
    }
  }

  /**
   * 等离子束特效
   */
  addPlasmaEffect(x1, y1, x2, y2) {
    this.effects.push({
      type: 'plasmaBeam',
      x1, y1, x2, y2,
      timer: 0.15,
      maxTimer: 0.15,
      color: '#ff88aa'
    });
    // 等离子粒子
    for (let i = 0; i < 4; i++) {
      const p = this.acquireParticle();
      p.x = x2 + (Math.random() - 0.5) * 15;
      p.y = y2 + (Math.random() - 0.5) * 15;
      p.vx = (Math.random() - 0.5) * 40;
      p.vy = (Math.random() - 0.5) * 40;
      p.life = 0.4;
      p.maxLife = 0.4;
      p.size = 3;
      p.color = '#ff88ff';
      p.startColor = '#ffccff';
      p.endColor = '#cc44cc';
      p.particleType = 'glow';
      p.glowSize = 2;
      this.particles.push(p);
    }
  }

  /**
   * 护甲碎片特效
   */
  addArmorFragmentEffect(x, y) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 80;
      const p = this.acquireParticle();
      p.x = x + (Math.random() - 0.5) * 15;
      p.y = y + (Math.random() - 0.5) * 15;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 40;
      p.life = 0.5;
      p.maxLife = 0.5;
      p.size = 2 + Math.random() * 3;
      p.color = '#aaaaaa';
      p.startColor = '#dddddd';
      p.endColor = '#555555';
      p.particleType = 'shrapnel';
      p.shrapnelShape = Math.floor(Math.random() * 3);
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 12;
      p.gravity = 150;
      this.particles.push(p);
    }
  }

  /**
   * 清除所有特效
   */
  clear() {
    // 回收所有粒子到池中
    this.particles.forEach(p => this._pool.push(p));
    this.particles = [];
    this.effects = [];
    this.screenShake = { intensity: 0, timer: 0, maxTimer: 0, dirX: 0, dirY: 0, curve: 'easeOut' };
    this.screenFlash = { alpha: 0, color: '#ffffff', timer: 0, maxTimer: 0 };
  }

  /**
   * 销毁系统（用于关卡切换时清理延迟回调）
   */
  dispose() {
    this._disposed = true;
    this.clear();
  }
}
