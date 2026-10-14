// ================================================================
// 单位系统 - 管理所有对战单位的移动和战斗
// ================================================================

export class BattleUnitSystem {
  constructor(battleMap) {
    this.battleMap = battleMap;
    this.playerUnits = [];
    this.enemyUnits = [];
  }

  /**
   * 生成己方单位
   */
  spawnPlayerUnit(type, row, col, channel) {
    this.playerUnits.push(this._createUnit(type, row, col, channel, 'player'));
  }

  /**
   * 生成敌方单位（从指定位置）
   */
  spawnEnemyUnit(type, channel, col) {
    const row = channel;
    const c = col !== undefined ? col : this.battleMap.cols - 1.5;
    this.enemyUnits.push(this._createUnit(type, row, c, channel, 'enemy'));
  }

  _createUnit(type, row, col, channel, side) {
    const center = this.battleMap.getCellCenter(
      Math.floor(row), Math.min(Math.floor(col), this.battleMap.cols - 1)
    );
    return {
      x: center.x,
      y: center.y,
      row: row,
      col: col,
      channel: channel,
      side: side,
      hp: type.hp,
      maxHp: type.hp,
      damage: type.damage,
      speed: type.speed,
      attackRate: type.attackRate || 1.0,
      range: type.range || 1.0,
      color: type.color,
      size: type.size || 0.7,
      alive: true,
      attackTimer: 0,
      target: null,
      special: type.special || null,
      enemyType: type.id || null, // 敌方类型ID（用于EnemyRenderer）
      hitFlash: 0,
      deathAnim: 0
    };
  }

  /**
   * 更新所有单位
   */
  update(dt) {
    this._updateSide(this.playerUnits, this.enemyUnits, dt, 1);  // 己方向右
    this._updateSide(this.enemyUnits, this.playerUnits, dt, -1); // 敌方向左

    // 清理死亡单位
    this.playerUnits = this.playerUnits.filter(u => u.alive || u.deathAnim > 0);
    this.enemyUnits = this.enemyUnits.filter(u => u.alive || u.deathAnim > 0);

    // 更新死亡动画
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      if (!u.alive && u.deathAnim > 0) {
        u.deathAnim -= dt;
      }
      if (u.hitFlash > 0) u.hitFlash -= dt;
    });
  }

  _updateSide(units, enemies, dt, direction) {
    const cell = this.battleMap.cell * this.battleMap.scale;
    const mapRect = this.battleMap.getMapRect();

    for (const unit of units) {
      if (!unit.alive) continue;

      // 寻找目标（最近的敌方单位）
      let closestEnemy = null;
      let closestDist = Infinity;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dx = enemy.x - unit.x;
        const dy = enemy.y - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestEnemy = enemy;
        }
      }

      const attackRange = unit.range * cell;

      if (closestEnemy && closestDist <= attackRange) {
        // 在攻击范围内 → 停下战斗
        unit.target = closestEnemy;
        unit.attackTimer += dt;

        if (unit.attackTimer >= unit.attackRate) {
          unit.attackTimer = 0;
          this._dealDamage(unit, closestEnemy);
        }
      } else {
        // 没有目标或目标太远 → 继续前进
        unit.target = null;
        unit.attackTimer = 0;
        unit.x += direction * unit.speed * cell * dt;

        // 限制在地图范围内
        unit.x = Math.max(mapRect.x + cell, Math.min(mapRect.x + mapRect.w - cell, unit.x));

        // 检查是否到达敌方基地
        if (direction === 1 && unit.x >= mapRect.x + mapRect.w - cell * 0.5) {
          // 己方单位到达敌方基地 → 对基地造成伤害
          return { unit, reached: true, side: 'player' };
        }
        if (direction === -1 && unit.x <= mapRect.x + cell * 0.5) {
          return { unit, reached: true, side: 'enemy' };
        }
      }

      // 严格沿甬道直线前进，Y坐标锁定在甬道中心
      const channelCenter = this.battleMap.getCellCenter(unit.channel, 0);
      unit.y += (channelCenter.y - unit.y) * 0.1;
    }
    return null;
  }

  _dealDamage(attacker, target) {
    if (!target.alive) return;

    let dmg = attacker.damage;
    // 护盾减伤
    if (target.special === 'shield') {
      dmg *= 0.7;
    }

    target.hp -= dmg;
    target.hitFlash = 0.15;

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      target.deathAnim = 0.3;
    }
  }

  /**
   * 检查是否有单位到达基地
   */
  checkBaseDamage() {
    const cell = this.battleMap.cell * this.battleMap.scale;
    const mapRect = this.battleMap.getMapRect();
    let playerDamage = 0;
    let enemyDamage = 0;

    for (const unit of this.enemyUnits) {
      if (!unit.alive) continue;
      if (unit.x <= mapRect.x + cell * 1.5) {
        enemyDamage += unit.damage * 0.5;
        unit.alive = false;
        unit.deathAnim = 0.3;
      }
    }

    for (const unit of this.playerUnits) {
      if (!unit.alive) continue;
      if (unit.x >= mapRect.x + mapRect.w - cell * 1.5) {
        playerDamage += unit.damage * 0.5;
        unit.alive = false;
        unit.deathAnim = 0.3;
      }
    }

    return { playerDamage, enemyDamage };
  }
}
