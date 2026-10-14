// ================================================================
// 弹道类 - 导弹追踪（性能优化版：尾迹对象池、方向缓存）
// ================================================================

/** 尾迹点对象池（类级别共享） */
const _trailPool = [];
/** 尾迹对象池最大大小 */
const TRAIL_POOL_MAX = 200;

/**
 * 从池获取或创建尾迹点
 */
function _acquireTrail() {
  if (_trailPool.length > 0) {
    return _trailPool.pop();
  }
  return { x: 0, y: 0, life: 0 };
}

/**
 * 回收尾迹点到池
 */
function _releaseTrail(t) {
  if (_trailPool.length < TRAIL_POOL_MAX) {
    _trailPool.push(t);
  }
}

export class Projectile {
  /**
   * @param {string} type - 弹道类型
   * @param {number} x - 起始X
   * @param {number} y - 起始Y
   * @param {Enemy} target - 目标敌人
   * @param {number} damage - 伤害
   * @param {number} splashRadius - 溅射半径
   * @param {string} color - 颜色
   */
  constructor(type, x, y, target, damage, splashRadius, color) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = 200;
    this.damage = damage;
    this.splashRadius = splashRadius;
    this.color = color;
    this.alive = true;
    /** 尾迹数组（使用对象池复用） */
    this.trail = [];
    /** 缓存的方向向量（避免每帧重复计算 atan2/sin/cos） */
    this._dirX = 0;
    this._dirY = 0;
    this._angle = 0;
    /** 塔引用（由CombatSystem设置） */
    this.tower = null;
  }

  /**
   * 更新弹道位置
   * @param {number} dt - 时间增量
   * @returns {boolean} 是否命中目标
   */
  update(dt) {
    if (!this.alive) return false;

    if (this.type === 'missile') {
      if (this.target && this.target.alive) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distSq = dx * dx + dy * dy;

        // 命中判定（使用平方距离避免sqrt）
        if (distSq < 100) { // 10^2 = 100
          this.alive = false;
          return true; // 命中
        }

        // 追踪移动（使用快速逆平方根近似，或直接用dist计算）
        const dist = Math.sqrt(distSq);
        this._dirX = dx / dist;
        this._dirY = dy / dist;
        this._angle = Math.atan2(dy, dx); // 缓存角度供渲染使用
        const moveDist = this.speed * dt;
        this.x += this._dirX * moveDist;
        this.y += this._dirY * moveDist;
      } else {
        // 目标已死亡，弹道消失
        this.alive = false;
        return false;
      }

      // 更新尾迹（复用尾迹点对象）
      const t = _acquireTrail();
      t.x = this.x;
      t.y = this.y;
      t.life = 0.3;
      this.trail.push(t);
      // 限制尾迹长度，超出的回收
      while (this.trail.length > 15) {
        _releaseTrail(this.trail[0]);
        this.trail.shift();
      }
    }

    return false;
  }

  /**
   * 更新尾迹生命周期（原地更新+swap-pop回收）
   * @param {number} dt - 时间增量
   */
  updateTrail(dt) {
    const trail = this.trail;
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].life -= dt;
      if (trail[i].life <= 0) {
        _releaseTrail(trail[i]);
        trail[i] = trail[trail.length - 1];
        trail.pop();
      }
    }
  }

  /**
   * 获取缓存的角度（供渲染使用，避免重复计算 atan2）
   * @returns {number}
   */
  getAngle() {
    return this._angle;
  }

  /**
   * 重置弹道状态（对象池复用）
   */
  reset(type, x, y, target, damage, splashRadius, color) {
    // 回收所有尾迹点
    for (let i = 0; i < this.trail.length; i++) {
      _releaseTrail(this.trail[i]);
    }
    this.trail.length = 0;

    this.type = type;
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = 200;
    this.damage = damage;
    this.splashRadius = splashRadius;
    this.color = color;
    this.alive = true;
    this._dirX = 0;
    this._dirY = 0;
    this._angle = 0;
    this.tower = null;
  }

  /**
   * 销毁弹道（回收尾迹）
   */
  dispose() {
    for (let i = 0; i < this.trail.length; i++) {
      _releaseTrail(this.trail[i]);
    }
    this.trail.length = 0;
  }
}
