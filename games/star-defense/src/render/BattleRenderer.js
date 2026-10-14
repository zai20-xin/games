// ================================================================
// 对战模式渲染器
// ================================================================
import { BARRACK_TYPES, ENEMY_BARRACK_TYPES } from '../modes/BattleMode.js';
import { EnemyRenderer } from './EnemyRenderer.js';

export class BattleRenderer {
  constructor(ctx, battleMap) {
    this.ctx = ctx;
    this.map = battleMap;
    this.enemyRenderer = new EnemyRenderer(ctx);
  }

  renderMap(time) {
    const ctx = this.ctx;
    const map = this.map;
    const s = map.scale;
    const cell = map.cell * s;
    const rect = map.getMapRect();

    // 清屏
    ctx.fillStyle = '#040408';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 背景渐变
    const bgGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    bgGrad.addColorStop(0, '#06060f');
    bgGrad.addColorStop(0.5, '#08081a');
    bgGrad.addColorStop(1, '#06060f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // 微妙的环境光效
    const glow1 = ctx.createRadialGradient(rect.x + rect.w * 0.15, rect.y + rect.h * 0.3, 0, rect.x + rect.w * 0.15, rect.y + rect.h * 0.3, rect.w * 0.4);
    glow1.addColorStop(0, 'rgba(120,50,40,0.06)');
    glow1.addColorStop(1, 'rgba(120,50,40,0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const glow2 = ctx.createRadialGradient(rect.x + rect.w * 0.85, rect.y + rect.h * 0.7, 0, rect.x + rect.w * 0.85, rect.y + rect.h * 0.7, rect.w * 0.4);
    glow2.addColorStop(0, 'rgba(120,30,30,0.05)');
    glow2.addColorStop(1, 'rgba(120,30,30,0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // 4条甬道
    const channels = map.getChannels();
    channels.forEach((ch, i) => {
      const y = rect.y + ch.row * cell;
      const h = cell;

      // 甬道底色（交替深色）
      const laneGrad = ctx.createLinearGradient(rect.x, y, rect.x + rect.w, y);
      if (i % 2 === 0) {
        laneGrad.addColorStop(0, 'rgba(40,20,25,0.85)');
        laneGrad.addColorStop(0.5, 'rgba(35,18,22,0.9)');
        laneGrad.addColorStop(1, 'rgba(50,15,15,0.85)');
      } else {
        laneGrad.addColorStop(0, 'rgba(45,22,28,0.85)');
        laneGrad.addColorStop(0.5, 'rgba(40,20,25,0.9)');
        laneGrad.addColorStop(1, 'rgba(45,12,12,0.85)');
      }
      ctx.fillStyle = laneGrad;
      ctx.fillRect(rect.x, y, rect.w, h);

      // 甬道边界线（更柔和）
      ctx.strokeStyle = 'rgba(100,60,50,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.stroke();
    });

    // 网格线（更微妙）
    ctx.strokeStyle = 'rgba(80,50,40,0.08)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= map.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(rect.x + c * cell, rect.y);
      ctx.lineTo(rect.x + c * cell, rect.y + rect.h);
      ctx.stroke();
    }
    for (let r = 0; r <= map.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + r * cell);
      ctx.lineTo(rect.x + rect.w, rect.y + r * cell);
      ctx.stroke();
    }

    // 兵营槽位标记（更精致）
    const slots = map.getBarrackSlots();
    slots.forEach(slot => {
      const cx = rect.x + (slot.col + 0.5) * cell;
      const cy = rect.y + (slot.row + 0.5) * cell;

      // 槽位发光背景
      const slotGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.5);
      slotGlow.addColorStop(0, 'rgba(255,136,102,0.06)');
      slotGlow.addColorStop(1, 'rgba(255,136,102,0)');
      ctx.fillStyle = slotGlow;
      ctx.fillRect(cx - cell * 0.5, cy - cell * 0.5, cell, cell);

      // 虚线边框
      ctx.strokeStyle = 'rgba(200,130,100,0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -time * 20;
      ctx.strokeRect(cx - cell * 0.38, cy - cell * 0.38, cell * 0.76, cell * 0.76);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // + 号
      ctx.fillStyle = 'rgba(200,130,100,0.12)';
      ctx.font = `bold ${cell * 0.35}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', cx, cy);
    });

    // 中线（更精致的分隔效果）
    const centerGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    centerGrad.addColorStop(0, 'rgba(255,255,255,0)');
    centerGrad.addColorStop(0.3, 'rgba(255,255,255,0.04)');
    centerGrad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    centerGrad.addColorStop(0.7, 'rgba(255,255,255,0.04)');
    centerGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = centerGrad;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -time * 15;
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w / 2, rect.y);
    ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // 甬道标签
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = `500 ${cell * 0.22}px sans-serif`;
    ctx.letterSpacing = '2px';
    channels.forEach(ch => {
      ctx.fillText(ch.name, rect.x + rect.w / 2, rect.y + (ch.row + 0.5) * cell);
    });
  }

  renderBarracks(barracks, time) {
    const ctx = this.ctx;
    const map = this.map;
    const cell = map.cell * map.scale;

    barracks.forEach(b => {
      const type = BARRACK_TYPES[b.typeIndex];
      const center = map.getCellCenter(b.row, b.col);
      const cx = center.x;
      const cy = center.y;
      const sz = cell * 0.38;

      // 兵营底座发光
      const baseGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 1.5);
      baseGlow.addColorStop(0, type.color + '15');
      baseGlow.addColorStop(1, type.color + '00');
      ctx.fillStyle = baseGlow;
      ctx.fillRect(cx - sz * 1.5, cy - sz * 1.5, sz * 3, sz * 3);

      // 兵营底座
      const baseGrad = ctx.createLinearGradient(cx - sz, cy - sz, cx + sz, cy + sz);
      baseGrad.addColorStop(0, 'rgba(50,25,30,0.9)');
      baseGrad.addColorStop(1, 'rgba(45,22,28,0.95)');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.roundRect(cx - sz, cy - sz, sz * 2, sz * 2, 4);
      ctx.fill();
      ctx.strokeStyle = type.color + '80';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 出兵进度环（更精致）
      const progress = b.spawnTimer / type.spawnInterval;
      ctx.strokeStyle = type.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // 兵营图标
      ctx.fillStyle = type.color;
      ctx.font = `700 ${cell * 0.28}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(type.name.charAt(0), cx, cy);

      // 脉冲发光
      const pulse = 0.15 + Math.sin(time * 2.5) * 0.08;
      ctx.shadowColor = type.color;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = type.color;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(cx - sz - 2, cy - sz - 2, sz * 2 + 4, sz * 2 + 4, 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });
  }

  renderUnits(playerUnits, enemyUnits, time) {
    const ctx = this.ctx;

    // 先渲染死亡动画
    [...playerUnits, ...enemyUnits].forEach(u => {
      if (u.alive) return;
      if (u.deathAnim <= 0) return;
      const progress = 1 - u.deathAnim / 0.3;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      const scale = 1 + progress * 0.5;
      ctx.translate(u.x, u.y);
      ctx.scale(scale, scale);
      if (u.side === 'enemy' && u.enemyType) {
        this._drawEnemyUnit(ctx, u, time);
      } else {
        this._drawUnit(ctx, u, time);
      }
      ctx.restore();
    });

    // 渲染己方单位
    playerUnits.forEach(u => {
      if (!u.alive) return;
      this._drawUnit(ctx, u, time);
    });

    // 渲染敌方单位（使用EnemyRenderer）
    enemyUnits.forEach(u => {
      if (!u.alive) return;
      this._drawEnemyUnit(ctx, u, time);
    });
  }

  /**
   * 使用EnemyRenderer渲染敌方单位
   */
  _drawEnemyUnit(ctx, unit, time) {
    const s = this.map.cell * this.map.scale * 0.3 * unit.size;

    // 构造兼容EnemyRenderer的enemy对象
    const fakeEnemy = {
      type: unit.enemyType || 'bug',
      x: 0, y: 0,
      color: unit.color,
      hp: unit.hp,
      maxHp: unit.maxHp,
      size: unit.size,
      alive: unit.alive,
      hitFlash: unit.hitFlash,
      slowTimer: 0,
      flying: false,
      cellSize: this.map.cell * this.map.scale / 0.3,
      deathAnim: unit.deathAnim
    };

    ctx.save();
    ctx.translate(unit.x, unit.y);
    this.enemyRenderer._drawEnemySprite(ctx, fakeEnemy, s, unit.hitFlash > 0, false, time);
    ctx.restore();

    // 血条
    if (unit.hp < unit.maxHp) {
      const barW = s * 2;
      const barH = 3;
      const barX = unit.x - barW / 2;
      const barY = unit.y - s - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      const ratio = unit.hp / unit.maxHp;
      ctx.fillStyle = ratio > 0.5 ? '#ff4444' : ratio > 0.25 ? '#ffaa22' : '#ff3333';
      ctx.fillRect(barX, barY, barW * ratio, barH);
    }

    // 攻击线
    if (unit.target && unit.attackTimer < 0.1) {
      ctx.strokeStyle = 'rgba(255,100,100,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(unit.x, unit.y);
      ctx.lineTo(unit.target.x, unit.target.y);
      ctx.stroke();
    }
  }

  _drawUnit(ctx, unit, time) {
    const s = this.map.cell * this.map.scale * 0.25 * unit.size;
    const flash = unit.hitFlash > 0;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y + s * 0.8, s * 0.7, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // 根据兵种类型绘制不同模型
    const typeId = unit.enemyType || unit.typeId || 'marine';
    switch (typeId) {
      case 'marine': this._drawMarine(ctx, unit, s, flash, time); break;
      case 'heavy': this._drawHeavy(ctx, unit, s, flash, time); break;
      case 'sniper': this._drawSniper(ctx, unit, s, flash, time); break;
      case 'medic': this._drawMedic(ctx, unit, s, flash, time); break;
      case 'berserker': this._drawBerserker(ctx, unit, s, flash, time); break;
      case 'shield': this._drawShield(ctx, unit, s, flash, time); break;
      default:
        ctx.fillStyle = flash ? '#fff' : unit.color;
        ctx.beginPath(); ctx.arc(unit.x, unit.y, s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#cc8866'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // 血条
    if (unit.hp < unit.maxHp) {
      const barW = s * 2;
      const barH = 3;
      const barX = unit.x - barW / 2;
      const barY = unit.y - s - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      const ratio = unit.hp / unit.maxHp;
      ctx.fillStyle = ratio > 0.5 ? '#ff8866' : ratio > 0.25 ? '#ffaa22' : '#ff3333';
      ctx.fillRect(barX, barY, barW * ratio, barH);
    }

    // 攻击线
    if (unit.target && unit.attackTimer < 0.1) {
      ctx.strokeStyle = 'rgba(255,150,100,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(unit.x, unit.y);
      ctx.lineTo(unit.target.x, unit.target.y);
      ctx.stroke();
    }
  }

  // === 己方兵种模型 ===

  /** 1. 星际陆战队 - 蓝色动力甲+步枪+面罩 */
  _drawMarine(ctx, unit, s, flash, time) {
    const x = unit.x, y = unit.y;
    const c = flash ? '#ffffff' : unit.color;
    const dc = flash ? '#cccccc' : '#885533';

    // 身体（梯形动力甲）
    ctx.fillStyle = dc;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y + s * 0.5);
    ctx.lineTo(x - s * 0.4, y - s * 0.3);
    ctx.lineTo(x + s * 0.4, y - s * 0.3);
    ctx.lineTo(x + s * 0.6, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();

    // 肩甲
    ctx.fillStyle = dc;
    ctx.fillRect(x - s * 0.75, y - s * 0.2, s * 0.3, s * 0.4);
    ctx.fillRect(x + s * 0.45, y - s * 0.2, s * 0.3, s * 0.4);
    ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.strokeRect(x - s * 0.75, y - s * 0.2, s * 0.3, s * 0.4);
    ctx.strokeRect(x + s * 0.45, y - s * 0.2, s * 0.3, s * 0.4);

    // 头盔
    ctx.fillStyle = dc;
    ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();

    // 面罩（发光T形）
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x - s * 0.2, y - s * 0.55, s * 0.4, s * 0.1);
    ctx.fillRect(x - s * 0.04, y - s * 0.65, s * 0.08, s * 0.2);
    ctx.globalAlpha = 1;

    // 步枪
    ctx.strokeStyle = '#aabbcc';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.5, y);
    ctx.lineTo(x + s * 1.1, y - s * 0.2);
    ctx.stroke();
    // 枪口发光
    ctx.fillStyle = '#ffaa88';
    ctx.globalAlpha = 0.4 + Math.sin(time * 8) * 0.2;
    ctx.beginPath(); ctx.arc(x + s * 1.1, y - s * 0.2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';

    // 腿部
    ctx.strokeStyle = dc; ctx.lineWidth = 2.5;
    const legPhase = time * 6;
    ctx.beginPath(); ctx.moveTo(x - s * 0.2, y + s * 0.5); ctx.lineTo(x - s * 0.3 + Math.sin(legPhase) * 3, y + s * 1.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s * 0.5); ctx.lineTo(x + s * 0.3 + Math.sin(legPhase + Math.PI) * 3, y + s * 1.0); ctx.stroke();
  }

  /** 2. 重装战士 - 橙色厚甲+盾牌+重锤 */
  _drawHeavy(ctx, unit, s, flash, time) {
    const x = unit.x, y = unit.y;
    const c = flash ? '#ffffff' : unit.color;
    const dc = flash ? '#cccccc' : '#663311';

    // 大型方形厚甲身体
    ctx.fillStyle = dc;
    const bw = s * 0.9, bh = s * 1.0;
    ctx.fillRect(x - bw, y - bh * 0.3, bw * 2, bh * 1.3);
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.strokeRect(x - bw, y - bh * 0.3, bw * 2, bh * 1.3);

    // 装甲纹理（十字线）
    ctx.strokeStyle = c; ctx.globalAlpha = 0.2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - bh * 0.3); ctx.lineTo(x, y + bh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - bw, y + bh * 0.3); ctx.lineTo(x + bw, y + bh * 0.3); ctx.stroke();
    ctx.globalAlpha = 1;

    // 头盔（方形带护面）
    ctx.fillStyle = dc;
    ctx.fillRect(x - s * 0.35, y - s * 0.8, s * 0.7, s * 0.55);
    ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - s * 0.35, y - s * 0.8, s * 0.7, s * 0.55);
    // 护面缝隙（红色发光）
    ctx.fillStyle = '#ff6622';
    ctx.globalAlpha = 0.6 + Math.sin(time * 3) * 0.2;
    ctx.fillRect(x - s * 0.25, y - s * 0.65, s * 0.5, s * 0.08);
    ctx.globalAlpha = 1;

    // 左手盾牌
    ctx.fillStyle = '#443322';
    ctx.beginPath();
    ctx.moveTo(x - s * 1.0, y - s * 0.4);
    ctx.lineTo(x - s * 1.3, y - s * 0.2);
    ctx.lineTo(x - s * 1.3, y + s * 0.6);
    ctx.lineTo(x - s * 1.0, y + s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();
    // 盾牌纹章
    ctx.strokeStyle = '#ff8844'; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(x - s * 1.15, y + s * 0.2, s * 0.15, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    // 右手重锤
    const swing = Math.sin(time * 3) * 0.15;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.8, y);
    ctx.lineTo(x + s * 1.2 + swing * s, y - s * 0.5);
    ctx.stroke();
    // 锤头
    ctx.fillStyle = '#aaa';
    ctx.fillRect(x + s * 1.1 + swing * s - s * 0.15, y - s * 0.7, s * 0.3, s * 0.25);
    ctx.lineCap = 'butt';

    // 短腿
    ctx.strokeStyle = dc; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 1.0); ctx.lineTo(x - s * 0.4, y + s * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.3, y + s * 1.0); ctx.lineTo(x + s * 0.4, y + s * 1.4); ctx.stroke();
  }

  /** 3. 能量狙击手 - 紫色修身甲+长枪+瞄准镜 */
  _drawSniper(ctx, unit, s, flash, time) {
    const x = unit.x, y = unit.y;
    const c = flash ? '#ffffff' : unit.color;
    const dc = flash ? '#cccccc' : '#442266';

    // 修身身体（倒三角）
    ctx.fillStyle = dc;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.35, y - s * 0.4);
    ctx.lineTo(x + s * 0.35, y - s * 0.4);
    ctx.lineTo(x + s * 0.55, y + s * 0.6);
    ctx.lineTo(x - s * 0.55, y + s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();

    // 披风/斗篷
    ctx.fillStyle = 'rgba(100,40,150,0.3)';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.2);
    ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.3, x - s * 0.6 + Math.sin(time * 2) * 3, y + s * 0.9);
    ctx.lineTo(x + s * 0.6 + Math.sin(time * 2 + 1) * 3, y + s * 0.9);
    ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.3, x + s * 0.4, y - s * 0.2);
    ctx.closePath();
    ctx.fill();

    // 头部（尖帽）
    ctx.fillStyle = dc;
    ctx.beginPath(); ctx.arc(x, y - s * 0.55, s * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.stroke();
    // 尖帽
    ctx.fillStyle = dc;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.2, y - s * 0.7);
    ctx.lineTo(x, y - s * 1.1);
    ctx.lineTo(x + s * 0.2, y - s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c; ctx.stroke();

    // 瞄准镜（单眼发光）
    ctx.fillStyle = '#cc66ff';
    ctx.globalAlpha = 0.7 + Math.sin(time * 5) * 0.3;
    ctx.beginPath(); ctx.arc(x + s * 0.15, y - s * 0.55, s * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // 长枪（狙击步枪）
    ctx.strokeStyle = '#886699'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y);
    ctx.lineTo(x + s * 1.4, y - s * 0.3);
    ctx.stroke();
    // 瞄准镜
    ctx.strokeStyle = '#cc9977'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.8, y - s * 0.15);
    ctx.lineTo(x + s * 0.8, y - s * 0.4);
    ctx.stroke();
    // 枪口能量
    const chargePulse = Math.sin(time * 4) * 0.3 + 0.5;
    ctx.fillStyle = `rgba(170,68,255,${chargePulse})`;
    ctx.beginPath(); ctx.arc(x + s * 1.4, y - s * 0.3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'butt';

    // 腿
    ctx.strokeStyle = dc; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - s * 0.15, y + s * 0.6); ctx.lineTo(x - s * 0.2, y + s * 1.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.15, y + s * 0.6); ctx.lineTo(x + s * 0.2, y + s * 1.0); ctx.stroke();
  }

  /** 4. 纳米医疗兵 - 绿色轻型甲+医疗背包+十字光环 */
  _drawMedic(ctx, unit, s, flash, time) {
    const x = unit.x, y = unit.y;
    const c = flash ? '#ffffff' : unit.color;
    const dc = flash ? '#cccccc' : '#115533';

    // 治疗光环
    const healPulse = Math.sin(time * 3) * 0.15 + 0.2;
    ctx.strokeStyle = `rgba(68,255,136,${healPulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, s * 1.2, 0, Math.PI * 2); ctx.stroke();
    // 旋转十字粒子
    for (let i = 0; i < 4; i++) {
      const a = time * 2 + (Math.PI / 2) * i;
      const pr = s * 1.1;
      ctx.fillStyle = `rgba(68,255,136,${0.3 + Math.sin(time * 4 + i) * 0.2})`;
      ctx.fillRect(x + Math.cos(a) * pr - 1.5, y + Math.sin(a) * pr - 1.5, 3, 3);
    }

    // 轻型身体
    ctx.fillStyle = dc;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.5, s * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();

    // 医疗背包（背后方形）
    ctx.fillStyle = '#226644';
    ctx.fillRect(x - s * 0.7, y - s * 0.3, s * 0.25, s * 0.5);
    ctx.strokeStyle = c; ctx.lineWidth = 1;
    ctx.strokeRect(x - s * 0.7, y - s * 0.3, s * 0.25, s * 0.5);
    // 背包指示灯
    ctx.fillStyle = '#44ff88';
    ctx.globalAlpha = 0.5 + Math.sin(time * 4) * 0.3;
    ctx.beginPath(); ctx.arc(x - s * 0.575, y - s * 0.15, 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // 头盔
    ctx.fillStyle = dc;
    ctx.beginPath(); ctx.arc(x, y - s * 0.6, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.stroke();

    // 面罩（绿色V形）
    ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.15, y - s * 0.65);
    ctx.lineTo(x, y - s * 0.5);
    ctx.lineTo(x + s * 0.15, y - s * 0.65);
    ctx.stroke();

    // 胸前医疗十字
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    const cw = s * 0.08, cl = s * 0.2;
    ctx.fillRect(x - cw, y - cl, cw * 2, cl * 2);
    ctx.fillRect(x - cl, y - cw, cl * 2, cw * 2);
    ctx.globalAlpha = 1;

    // 腿
    ctx.strokeStyle = dc; ctx.lineWidth = 2;
    const lp = time * 5;
    ctx.beginPath(); ctx.moveTo(x - s * 0.15, y + s * 0.6); ctx.lineTo(x - s * 0.2 + Math.sin(lp) * 2, y + s * 1.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.15, y + s * 0.6); ctx.lineTo(x + s * 0.2 + Math.sin(lp + Math.PI) * 2, y + s * 1.0); ctx.stroke();
  }

  /** 5. 狂暴突击兵 - 红色轻型甲+双刀+速度线 */
  _drawBerserker(ctx, unit, s, flash, time) {
    const x = unit.x, y = unit.y;
    const c = flash ? '#ffffff' : unit.color;
    const dc = flash ? '#cccccc' : '#661111';

    // 速度线（残影效果）
    ctx.strokeStyle = 'rgba(255,68,68,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const ly = y - s * 0.4 + i * s * 0.4;
      const offset = (i + 1) * s * 0.3;
      ctx.beginPath();
      ctx.moveTo(x - offset - s * 0.5, ly);
      ctx.lineTo(x - offset, ly);
      ctx.stroke();
    }

    // 纤细身体（前倾姿态）
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 6) * 0.05);
    ctx.fillStyle = dc;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(s * 0.35, s * 0.1);
    ctx.lineTo(s * 0.25, s * 0.6);
    ctx.lineTo(-s * 0.25, s * 0.6);
    ctx.lineTo(-s * 0.35, s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();

    // 头部
    ctx.fillStyle = dc;
    ctx.beginPath(); ctx.arc(0, -s * 0.65, s * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.stroke();

    // 狂暴红眼
    ctx.fillStyle = '#ff2222';
    ctx.globalAlpha = 0.7 + Math.sin(time * 8) * 0.3;
    ctx.beginPath(); ctx.arc(-s * 0.08, -s * 0.68, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.08, -s * 0.68, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // 双刀（交叉挥舞）
    const bladeSwing = Math.sin(time * 8) * 0.3;
    ctx.strokeStyle = '#ffcccc'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    // 左刀
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 0.1);
    ctx.lineTo(-s * 0.9, -s * 0.3 + bladeSwing * s);
    ctx.stroke();
    // 右刀
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 0.1);
    ctx.lineTo(s * 0.9, -s * 0.3 - bladeSwing * s);
    ctx.stroke();
    // 刀刃发光
    ctx.fillStyle = '#ff4444';
    ctx.globalAlpha = 0.4 + Math.sin(time * 8) * 0.3;
    ctx.beginPath(); ctx.arc(-s * 0.9, -s * 0.3 + bladeSwing * s, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.9, -s * 0.3 - bladeSwing * s, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';

    ctx.restore();

    // 奔跑腿
    ctx.strokeStyle = dc; ctx.lineWidth = 2;
    const lp = time * 10;
    ctx.beginPath(); ctx.moveTo(x - s * 0.15, y + s * 0.6); ctx.lineTo(x - s * 0.3 + Math.sin(lp) * 5, y + s * 1.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.15, y + s * 0.6); ctx.lineTo(x + s * 0.3 + Math.sin(lp + Math.PI) * 5, y + s * 1.1); ctx.stroke();
  }

  /** 6. 能量盾卫 - 青色六角甲+能量盾+护盾光环 */
  _drawShield(ctx, unit, s, flash, time) {
    const x = unit.x, y = unit.y;
    const c = flash ? '#ffffff' : unit.color;
    const dc = flash ? '#cccccc' : '#114455';

    // 护盾光环
    const shieldPulse = Math.sin(time * 2) * 0.1 + 0.2;
    ctx.strokeStyle = `rgba(119,204,221,${shieldPulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, s * 1.1, 0, Math.PI * 2); ctx.stroke();
    // 六角护盾碎片
    ctx.strokeStyle = `rgba(119,204,221,${shieldPulse * 0.5})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + time * 0.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9);
      ctx.lineTo(x + Math.cos(a) * s * 1.2, y + Math.sin(a) * s * 1.2);
      ctx.stroke();
    }

    // 六角形身体
    ctx.fillStyle = dc;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = x + Math.cos(a) * s * 0.7;
      const py = y + Math.sin(a) * s * 0.7;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();

    // 内部纹理
    ctx.strokeStyle = c; ctx.globalAlpha = 0.15; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 头盔
    ctx.fillStyle = dc;
    ctx.beginPath(); ctx.arc(x, y - s * 0.55, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();

    // 面罩（一字形发光）
    ctx.fillStyle = '#aaddcc';
    ctx.globalAlpha = 0.6 + Math.sin(time * 3) * 0.2;
    ctx.fillRect(x - s * 0.18, y - s * 0.57, s * 0.36, s * 0.06);
    ctx.globalAlpha = 1;

    // 左手能量盾
    ctx.fillStyle = 'rgba(119,204,221,0.15)';
    ctx.strokeStyle = '#77ccdd'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x - s * 0.9, y, s * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 盾内十字
    ctx.strokeStyle = 'rgba(119,204,221,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - s * 0.9, y - s * 0.35); ctx.lineTo(x - s * 0.9, y + s * 0.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 1.1, y); ctx.lineTo(x - s * 0.7, y); ctx.stroke();

    // 右手短剑
    ctx.strokeStyle = '#aaddff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.6, y);
    ctx.lineTo(x + s * 1.0, y - s * 0.3);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 腿
    ctx.strokeStyle = dc; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - s * 0.2, y + s * 0.6); ctx.lineTo(x - s * 0.3, y + s * 1.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s * 0.6); ctx.lineTo(x + s * 0.3, y + s * 1.1); ctx.stroke();
  }

  renderEnemySlots(enemySlots, time) {
    const ctx = this.ctx;
    const map = this.map;
    const cell = map.cell * map.scale;
    const rect = map.getMapRect();

    if (!enemySlots || enemySlots.length === 0) return;

    enemySlots.forEach(slot => {
      const cx = rect.x + (slot.col + 0.5) * cell;
      const cy = rect.y + (slot.row + 0.5) * cell;
      const sz = cell * 0.38;

      // 槽位发光
      const slotGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 1.3);
      slotGlow.addColorStop(0, 'rgba(255,50,50,0.05)');
      slotGlow.addColorStop(1, 'rgba(255,50,50,0)');
      ctx.fillStyle = slotGlow;
      ctx.fillRect(cx - sz * 1.3, cy - sz * 1.3, sz * 2.6, sz * 2.6);

      // 槽位底色
      const slotGrad = ctx.createLinearGradient(cx - sz, cy - sz, cx + sz, cy + sz);
      slotGrad.addColorStop(0, 'rgba(50,15,15,0.7)');
      slotGrad.addColorStop(1, 'rgba(40,10,10,0.8)');
      ctx.fillStyle = slotGrad;
      ctx.beginPath();
      ctx.roundRect(cx - sz, cy - sz, sz * 2, sz * 2, 4);
      ctx.fill();

      // 槽位边框（动态虚线）
      ctx.strokeStyle = 'rgba(255,60,60,0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = time * 20;
      ctx.strokeRect(cx - sz, cy - sz, sz * 2, sz * 2);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // 渲染敌方兵种
      const type = ENEMY_BARRACK_TYPES[slot.typeIndex];
      if (type) {
        const progress = slot.spawnTimer / type.spawnInterval;

        // 出兵进度环
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, sz * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
        ctx.lineCap = 'butt';

        // 敌方兵种图标（用EnemyRenderer渲染小精灵）
        const fakeEnemy = {
          type: type.id,
          x: 0, y: 0,
          color: type.color,
          hp: type.hp, maxHp: type.hp,
          size: type.size * 0.8,
          alive: true, hitFlash: 0, slowTimer: 0, flying: false,
          cellSize: cell / 0.3
        };
        ctx.save();
        ctx.translate(cx, cy);
        const spriteSize = cell * 0.25 * type.size * 0.8;
        this.enemyRenderer._drawEnemySprite(ctx, fakeEnemy, spriteSize, false, false, time);
        ctx.restore();

        // 脉冲发光
        const pulse = 0.12 + Math.sin(time * 2.5) * 0.06;
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(cx - sz - 2, cy - sz - 2, sz * 2 + 4, sz * 2 + 4, 5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
    });
  }

  renderPlacementPreview(hoverX, hoverY, battleMap, barrackIndex) {
    const ctx = this.ctx;
    const grid = battleMap.pixelToGrid(hoverX, hoverY);
    const cell = battleMap.cell * battleMap.scale;
    const rect = battleMap.getMapRect();

    if (grid.col < 0 || grid.col >= battleMap.cols || grid.row < 0 || grid.row >= battleMap.rows) return;

    const cx = rect.x + (grid.col + 0.5) * cell;
    const cy = rect.y + (grid.row + 0.5) * cell;
    const isValid = battleMap.isBarrackSlot(grid.row, grid.col);

    ctx.fillStyle = isValid ? 'rgba(100,255,100,0.2)' : 'rgba(255,100,100,0.2)';
    ctx.fillRect(cx - cell / 2, cy - cell / 2, cell, cell);
    ctx.strokeStyle = isValid ? 'rgba(100,255,100,0.5)' : 'rgba(255,100,100,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - cell / 2, cy - cell / 2, cell, cell);
  }
}
