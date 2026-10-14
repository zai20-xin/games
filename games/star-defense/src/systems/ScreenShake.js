// ================================================================
// 屏幕震动系统 - 管理游戏画面的位移抖动（Game Feel 核心）
// 支持多重震动叠加、方向性震动、自定义衰减曲线
// 升级：方向性震动（dx/dy 方向向量）、缓动衰减曲线（ease-out / 弹簧感）
// ================================================================

/**
 * 衰减曲线类型
 * - linear:    线性衰减（原有行为，干净利落）
 * - easeOut:   二次缓出（前期强、后期快速减弱，更自然）
 * - easeInOut: 缓入缓出（中段最强，适合爆炸/冲击）
 * - spring:    弹簧衰减（带微回弹，有重量感）
 */
const DECAY_CURVES = {
  linear:    (t) => 1 - t,
  easeOut:   (t) => 1 - t * t,
  easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  spring:    (t) => {
    // 弹簧衰减：主衰减 + 微幅回弹震荡
    const decay = 1 - t;
    const bounce = Math.sin(t * Math.PI * 4) * 0.15 * decay;
    return Math.max(0, decay + bounce);
  },
};

export class ScreenShake {
  constructor() {
    /** @type {Array<{intensity:number, time:number, maxTime:number, dirX:number, dirY:number, curve:string, priority:number}>} 活跃震动列表 */
    this.shakes = [];
    /** 当前 X 偏移（像素） */
    this.x = 0;
    /** 当前 Y 偏移（像素） */
    this.y = 0;
    /** 每帧随机相位种子（让方向性震动更连贯，不随机乱跳） */
    this._phase = 0;
  }

  /**
   * 触发一次屏幕震动
   * @param {number} intensity - 强度 1-10
   * @param {number} duration  - 持续秒数
   * @param {Object} [opts]    - 可选参数
   * @param {number} [opts.dirX=0]   - 方向 X 分量（会自动归一化，0 = 全方向随机）
   * @param {number} [opts.dirY=0]   - 方向 Y 分量
   * @param {string} [opts.curve='easeOut'] - 衰减曲线：linear / easeOut / easeInOut / spring
   * @param {number} [opts.priority=0] - 优先级（高优先级震动不被低强度震动覆盖）
   */
  shake(intensity, duration, opts = {}) {
    if (intensity <= 0 || duration <= 0) return;

    const dirX = opts.dirX || 0;
    const dirY = opts.dirY || 0;
    const curve = opts.curve || 'easeOut';
    const priority = opts.priority || 0;

    // 归一化方向向量
    let nx = 0, ny = 0;
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dirLen > 0.001) {
      nx = dirX / dirLen;
      ny = dirY / dirLen;
    }

    // 多重震动去重：当前若有同方向、相近强度的震动，则增强它
    const existing = this.shakes.find(s => {
      // 高优先级震动不可被覆盖
      if (s.priority > priority) return false;
      // 强度阈值
      if (s.intensity < intensity * 0.7) return false;
      // 方向相似性（点积 > 0.5 视为同方向，或两者都是无方向）
      if (nx === 0 && ny === 0 && s.dirX === 0 && s.dirY === 0) return true;
      const dot = s.dirX * nx + s.dirY * ny;
      return dot > 0.5;
    });

    if (existing) {
      existing.intensity = Math.max(existing.intensity, intensity);
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.time = 0; // 重置剩余时间
      existing.curve = curve; // 更新为最新的曲线
      if (nx !== 0 || ny !== 0) {
        existing.dirX = nx;
        existing.dirY = ny;
      }
    } else {
      this.shakes.push({
        intensity,
        time: 0,
        maxTime: duration,
        dirX: nx,
        dirY: ny,
        curve: DECAY_CURVES[curve] ? curve : 'easeOut',
        priority,
      });
    }
  }

  /**
   * 兼容旧 API：无方向震动
   * @param {number} intensity
   * @param {number} duration
   */
  shakeOmni(intensity, duration) {
    this.shake(intensity, duration, { curve: 'easeOut' });
  }

  /**
   * 水平方向震动（如被击退、横向冲击）
   * @param {number} intensity
   * @param {number} duration
   * @param {number} [dir=1] - 方向：1 = 从左来，-1 = 从右来
   */
  shakeHorizontal(intensity, duration, dir = 1) {
    this.shake(intensity, duration, { dirX: dir, dirY: 0, curve: 'spring' });
  }

  /**
   * 垂直方向震动（如落地、砸击）
   * @param {number} intensity
   * @param {number} duration
   * @param {number} [dir=1] - 方向：1 = 从上来，-1 = 从下来
   */
  shakeVertical(intensity, duration, dir = 1) {
    this.shake(intensity, duration, { dirX: 0, dirY: dir, curve: 'easeOut' });
  }

  /**
   * 冲击方向震动（爆炸源位置 -> 屏幕中心方向感）
   * @param {number} intensity
   * @param {number} duration
   * @param {number} fromX - 震源 X（屏幕坐标）
   * @param {number} fromY - 震源 Y（屏幕坐标）
   * @param {number} centerX - 屏幕中心 X
   * @param {number} centerY - 屏幕中心 Y
   */
  shakeFrom(intensity, duration, fromX, fromY, centerX, centerY) {
    // 从震源推向中心 = 方向为 center - from（爆炸推离震源）
    const dx = centerX - fromX;
    const dy = centerY - fromY;
    this.shake(intensity, duration, { dirX: dx, dirY: dy, curve: 'spring' });
  }

  /**
   * 更新所有震动状态
   * @param {number} dt - 时间增量（秒，使用真实帧间隔，不受游戏速度影响）
   */
  update(dt) {
    this.x = 0;
    this.y = 0;
    this._phase += dt * 30; // 相位推进（约每帧 0.5 弧度，保持连贯性）

    this.shakes = this.shakes.filter(s => {
      s.time += dt;
      const progress = s.time / s.maxTime;
      if (progress >= 1) return false;

      // 选择衰减曲线
      const curveFn = DECAY_CURVES[s.curve] || DECAY_CURVES.easeOut;
      const currentIntensity = s.intensity * curveFn(progress);

      if (s.dirX === 0 && s.dirY === 0) {
        // 无方向：全方向随机（原有行为，但加入相位保持连贯性）
        const angle = this._phase * 1.3 + Math.random() * 0.8;
        const r = currentIntensity;
        this.x += Math.cos(angle) * r * (Math.random() * 0.6 + 0.4);
        this.y += Math.sin(angle) * r * (Math.random() * 0.6 + 0.4);
      } else {
        // 方向性震动：主方向大幅抖动 + 垂直方向微抖动（模拟真实冲击）
        // 主方向：使用正弦波保证来回震荡，而不是随机跳
        const mainPhase = Math.sin(this._phase * 2.5) * currentIntensity;
        const mainRand = (Math.random() - 0.5) * currentIntensity * 0.4;
        const mainOffset = mainPhase + mainRand;

        // 垂直方向（垂直于主方向）：幅度为主方向的 25%
        const perpPhase = Math.cos(this._phase * 2.2) * currentIntensity * 0.25;
        const perpRand = (Math.random() - 0.5) * currentIntensity * 0.2;
        const perpOffset = perpPhase + perpRand;

        // 垂直方向向量（旋转 90 度）
        const px = -s.dirY;
        const py = s.dirX;

        this.x += s.dirX * mainOffset + px * perpOffset;
        this.y += s.dirY * mainOffset + py * perpOffset;
      }
      return true;
    });
  }

  /** @returns {number} 当前 X 偏移 */
  getOffsetX() { return this.x; }

  /** @returns {number} 当前 Y 偏移 */
  getOffsetY() { return this.y; }

  /**
   * 获取当前震动偏移（对象形式，兼容旧 EffectSystem._shakeOffset 用法）
   * @returns {{x: number, y: number}}
   */
  getOffset() {
    return { x: this.x, y: this.y };
  }

  /** 清空所有震动（关卡切换时调用） */
  clear() {
    this.shakes = [];
    this.x = 0;
    this.y = 0;
    this._phase = 0;
  }
}
