// ================================================================
// 兵营系统 - 管理兵营放置和出兵
// ================================================================
import { BARRACK_TYPES } from '../modes/BattleMode.js';

export class BarrackSystem {
  constructor(battleMap) {
    this.battleMap = battleMap;
    this.barracks = [];
  }

  /**
   * 放置兵营
   */
  placeBarrack(row, col, typeIndex, currentEnergy) {
    const type = BARRACK_TYPES[typeIndex];

    if (currentEnergy < type.cost) return false;
    if (!this.battleMap.isBarrackSlot(row, col)) return false;
    if (this.barracks.some(b => b.row === row && b.col === col)) return false;
    if (this.barracks.length >= 4) return false;

    // 获取对应的甬道行
    const slot = this.battleMap.getBarrackSlots().find(s => s.row === row && s.col === col);
    const channel = slot ? slot.channel : row;

    this.barracks.push({
      row, col, typeIndex,
      spawnTimer: 0,
      level: 1,
      channel: channel
    });

    return true;
  }

  /**
   * 更新兵营（出兵逻辑）
   */
  update(dt, unitSystem) {
    for (const barrack of this.barracks) {
      const type = BARRACK_TYPES[barrack.typeIndex];
      barrack.spawnTimer += dt;

      if (barrack.spawnTimer >= type.spawnInterval) {
        barrack.spawnTimer = 0;
        // 在兵营右侧一格生成己方单位，沿甬道直线前进
        const spawnCol = barrack.col + 1;
        unitSystem.spawnPlayerUnit(type, barrack.channel, spawnCol, barrack.channel);
      }
    }
  }
}
