// ============================================
//  无限进化 V1.2 — 渲染层（美术全面升级）
//  纯渲染函数，不修改任何状态
// ============================================

// ==================== 辅助：绘制发光圆 ====================
function _drawGlowCircle(ctx, x, y, r, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ==================== 辅助：绘制多边形 ====================
function _drawPolygon(ctx, x, y, r, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (rotation || 0);
    i === 0 ? ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
            : ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// ==================== 辅助：绘制星形 ====================
function _drawStar(ctx, x, y, outerR, innerR, points, rotation) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2 + (rotation || -Math.PI / 2);
    i === 0 ? ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
            : ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// ==================== 渲染背景（V1.2：深空星云升级） ====================
function drawBackground(game) {
  const { ctx, W, H } = game.config;
  const { bgStars, bgLayers, nebula } = game.objs;
  const { bossBgActive } = game.state;
  const BOSS_BG_COLORS = game.config.BOSS_BG_COLORS;
  const now = Date.now();

  // 选择背景颜色（BOSS战时变红）
  const bgColors = bossBgActive ? BOSS_BG_COLORS.boss : BOSS_BG_COLORS.normal;

  // 深空渐变背景
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, bgColors.top);
  grad.addColorStop(0.4, bgColors.mid);
  grad.addColorStop(1, bgColors.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 星云光晕（静态大圆斑，营造深空感）
  if (nebula) {
    const bossBlend = bossBgActive ? 0.6 : 0;
    for (const n of nebula) {
      const pulse = 0.5 + Math.sin(now / 3000 + n.phase) * 0.15;
      ctx.globalAlpha = n.alpha * pulse * (1 - bossBlend * 0.5);
      ctx.fillStyle = bossBgActive ? n.bossColor : n.color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 视差背景层（多层星星，带颜色变化）
  if (bgLayers && bgLayers.length > 0) {
    for (const layer of bgLayers) {
      for (const star of layer.stars) {
        star.y += star.speed;
        if (star.y > H + 4) {
          star.y = -4;
          star.x = Math.random() * W;
        }
        const twinkle = 0.6 + Math.sin(now / 700 + star.twinkle) * 0.4;
        ctx.globalAlpha = star.alpha * twinkle;
        const starColor = bossBgActive ? (star.bossColor || '#ffaaaa') : (star.color || '#ffffff');
        ctx.fillStyle = starColor;
        // 大星用圆形，小星用矩形（性能）
        if (star.size >= 2) {
          ctx.beginPath();
          ctx.arc(Math.round(star.x), Math.round(star.y), star.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
        }
      }
    }
  }
  ctx.globalAlpha = 1;

  // 流星（偶尔的快速光线）
  if (game.objs.meteors) {
    for (const m of game.objs.meteors) {
      const a = m.life / m.maxLife;
      ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = m.size;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12);
      ctx.stroke();
      // 头部亮点
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffee';
      ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // 细腻网格线（仅在正常模式下）
  if (!bossBgActive) {
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // BOSS战：红色脉冲扫描线
  if (bossBgActive) {
    const scanY = (now / 25) % (H * 1.5) - H * 0.25;
    ctx.fillStyle = 'rgba(255,50,50,0.06)';
    ctx.fillRect(0, scanY, W, 3);
    ctx.fillStyle = 'rgba(255,100,100,0.03)';
    ctx.fillRect(0, scanY - 8, W, 16);
  }

  // 背景星粒（保留，加入颜色变体）
  for (const s of bgStars) {
    s.y += s.speed;
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    ctx.globalAlpha = s.alpha * (0.6 + Math.sin(now / 900 + s.x) * 0.4);
    ctx.fillStyle = s.color || '#ffffff';
    ctx.fillRect(s.x | 0, s.y | 0, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

// ==================== 渲染子弹（V1.2：全武器特效升级） ====================
function drawBullet(game, b) {
  const { ctx } = game.config;
  const bx = Math.round(b.x);
  const by = Math.round(b.y);
  const now = Date.now();

  if (b.enemy) {
    // 敌方子弹：带发光核心
    const pulse = 0.85 + Math.sin(now / 120 + b.x * 0.1) * 0.15;
    // 外层发光
    ctx.globalAlpha = 0.25 * pulse;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(bx, by, b.size + 5, 0, Math.PI * 2);
    ctx.fill();
    // 中层
    ctx.globalAlpha = 0.5 * pulse;
    ctx.beginPath();
    ctx.arc(bx, by, b.size + 2, 0, Math.PI * 2);
    ctx.fill();
    // 核心
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx, by, b.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(bx, by, b.size, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const wid = b.weaponId;

  if (wid === 'stone') {
    // 石块：翻滚效果（通过计时模拟旋转）
    const rot = (now / 150 + b.x * 0.05) % (Math.PI * 2);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(-3, -2, 6, 5);
    ctx.fillStyle = '#c4b09a';
    ctx.fillRect(-2, -3, 4, 2);
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(-3, 1, 2, 2);
    ctx.restore();
    // 细小碎屑拖尾
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#9a8a7a';
    ctx.fillRect(bx - b.vx * 2 - 1, by - b.vy * 2 - 1, 2, 2);
    ctx.globalAlpha = 1;

  } else if (wid === 'pistol') {
    // 手枪：黄铜弹头，带拖尾和弹壳光晕
    const angle = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    // 拖尾
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#c8961e';
    ctx.fillRect(-7, -1, 5, 2);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(-12, -1, 4, 2);
    ctx.globalAlpha = 1;
    // 弹头主体
    ctx.fillStyle = '#daa520';
    ctx.fillRect(-2, -2, 7, 4);
    // 弹头尖
    ctx.fillStyle = '#ffe080';
    ctx.beginPath();
    ctx.moveTo(5, -2);
    ctx.lineTo(9, 0);
    ctx.lineTo(5, 2);
    ctx.fill();
    // 弹壳
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(-4, -1, 4, 2);
    ctx.restore();

  } else if (wid === 'shotgun') {
    // 霰弹：小粒子+火药烟雾感
    const angle = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    // 烟雾拖尾
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(-4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 弹丸主体
    ctx.fillStyle = '#c87137';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = '#f0a060';
    ctx.beginPath();
    ctx.arc(-0.5, -0.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (wid === 'machinegun') {
    // 机枪：曳光弹效果，亮黄白核心
    const angle = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    // 长拖尾（3段渐隐）
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-10, -1, 8, 2);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(-18, -0.5, 8, 1);
    ctx.globalAlpha = 0.1;
    ctx.fillRect(-26, -0.5, 7, 1);
    ctx.globalAlpha = 1;
    // 弹头
    ctx.fillStyle = '#ffe040';
    ctx.fillRect(-2, -1.5, 8, 3);
    // 核心亮点
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, -0.5, 4, 1);
    ctx.restore();

  } else if (wid === 'rocket') {
    // 火箭：复杂尾焰系统
    const angle = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    // 尾焰（多层）
    const flame = (now / 60) % 1;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(-16, -3, 10, 6);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(-12, -2, 8, 4);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-9, -1.5, 6, 3);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -0.5, 3, 1);
    ctx.globalAlpha = 1;
    // 火箭弹体
    ctx.fillStyle = '#cc3020';
    ctx.fillRect(-4, -4, 14, 8);
    // 弹头锥形
    ctx.fillStyle = '#e05040';
    ctx.beginPath();
    ctx.moveTo(10, -4);
    ctx.lineTo(18, 0);
    ctx.lineTo(10, 4);
    ctx.fill();
    // 窗口
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(1, -2, 4, 4);
    // 尾翼
    ctx.fillStyle = '#991010';
    ctx.fillRect(-4, -7, 4, 3);
    ctx.fillRect(-4, 4, 4, 3);
    ctx.restore();

  } else if (wid === 'laser') {
    // 激光：多层发光描边效果
    const angle = Math.atan2(b.vy, b.vx);
    const pulse = 0.8 + Math.sin(now / 80) * 0.2;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    // 外层光晕
    ctx.globalAlpha = 0.15 * pulse;
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(-18, -7, 36, 14);
    // 中层
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillRect(-16, -5, 32, 10);
    // 发光层
    ctx.globalAlpha = 0.65 * pulse;
    ctx.fillRect(-14, -3, 28, 6);
    // 主体
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(-12, -2, 24, 4);
    // 高亮核心
    ctx.fillStyle = '#aaffff';
    ctx.fillRect(-10, -0.5, 20, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, -0.25, 16, 0.5);
    ctx.restore();

  } else {
    // 默认
    ctx.fillStyle = b.color;
    ctx.fillRect(bx - b.size / 2, by - b.size / 2, b.size, b.size);
  }
  ctx.globalAlpha = 1;
}

// ==================== 渲染幽灵剑气（V1.2：加强特效） ====================
function drawGhostBlade(game, gb) {
  const { ctx } = game.config;
  const angle = Math.atan2(gb.vy, gb.vx);
  const now = Date.now();

  ctx.save();
  ctx.translate(gb.x, gb.y);
  ctx.rotate(angle);
  ctx.globalAlpha = gb.life;

  // 外层光晕
  ctx.fillStyle = 'rgba(26,188,156,0.25)';
  ctx.fillRect(-14, -6, 28, 12);
  // 剑气主体
  ctx.fillStyle = '#1abc9c';
  ctx.fillRect(-10, -3, 20, 6);
  // 高光线
  ctx.fillStyle = '#80ffe8';
  ctx.fillRect(-8, -1, 16, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-6, -0.5, 12, 1);
  // 拖尾渐隐
  ctx.globalAlpha = gb.life * 0.4;
  ctx.fillStyle = '#1abc9c';
  ctx.fillRect(-20, -5, 10, 10);
  ctx.globalAlpha = gb.life * 0.2;
  ctx.fillRect(-30, -4, 10, 8);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ==================== 渲染玩家（V1.2：精细像素艺术风格） ====================
function drawPlayer(game) {
  const { ctx, CX, CY, FORM_DEFS, FRUIT_DEFS } = game.config;
  const { monsters } = game.objs;
  const { dist } = game.utils;
  const { player } = game;
  const now = Date.now();
  const form = FORM_DEFS[player.form];

  // ---- 外圈光环（多层脉冲，按形态变色）----
  const glowAlpha = 0.35 + Math.sin(now / 180) * 0.18;
  // 最外层淡光
  ctx.strokeStyle = form.color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = glowAlpha * 0.3;
  ctx.beginPath();
  ctx.arc(CX, CY, 32, 0, Math.PI * 2);
  ctx.stroke();
  // 中层
  ctx.globalAlpha = glowAlpha * 0.55;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(CX, CY, 24, 0, Math.PI * 2);
  ctx.stroke();
  // 内层
  ctx.globalAlpha = glowAlpha;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CX, CY, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ---- 果实光环 ----
  if (player.fruit) {
    const fc = FRUIT_DEFS[player.fruit];
    const fa = 0.2 + Math.sin(now / 140) * 0.12;

    // 果实外圈
    ctx.strokeStyle = fc.color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = fa * 0.8;
    ctx.beginPath();
    ctx.arc(CX, CY, 36, 0, Math.PI * 2);
    ctx.stroke();

    // 旋转能量弧
    if (player.fruitEnergy > 0) {
      const arc = (player.fruitEnergy / player.fruitMaxEnergy) * Math.PI * 2;
      const startAngle = now / 400;
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = fc.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CX, CY, 27, startAngle, startAngle + arc);
      ctx.stroke();

      // 能量满时放射小粒子光点
      if (player.fruitEnergy >= player.fruitMaxEnergy) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + now / 300;
          const px = CX + Math.cos(a) * 27;
          const py = CY + Math.sin(a) * 27;
          const dotA = 0.5 + Math.sin(now / 100 + i) * 0.5;
          ctx.globalAlpha = dotA;
          ctx.fillStyle = fc.color;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // 新手引导护盾
  if (game.state.tutorialActive) {
    const shieldPulse = 0.2 + Math.sin(now / 180) * 0.15;
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = shieldPulse;
    ctx.beginPath();
    ctx.arc(CX, CY, 30, 0, Math.PI * 2);
    ctx.stroke();
    // 护盾闪光点
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + now / 600;
      const px = CX + Math.cos(a) * 30;
      const py = CY + Math.sin(a) * 30;
      ctx.globalAlpha = shieldPulse * 1.5;
      ctx.fillStyle = '#88ccff';
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  // ---- 形态渲染（精细像素艺术） ----
  if (player.form === 'primitive') {
    // 原始人：粗犷石器时代风格
    // 腿
    ctx.fillStyle = '#d4a870';
    ctx.fillRect(CX - 5, CY + 5, 4, 7);
    ctx.fillRect(CX + 1, CY + 5, 4, 7);
    // 草裙腰带
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(CX - 5, CY + 3, 10, 4);
    // 身体
    ctx.fillStyle = '#d4a870';
    ctx.fillRect(CX - 5, CY - 3, 10, 8);
    // 手
    ctx.fillRect(CX - 8, CY - 1, 3, 3);
    ctx.fillRect(CX + 5, CY - 1, 3, 3);
    // 头
    ctx.fillStyle = '#d4a870';
    ctx.fillRect(CX - 5, CY - 13, 10, 10);
    // 头发（草制）
    ctx.fillStyle = '#3a2a10';
    ctx.fillRect(CX - 5, CY - 13, 10, 3);
    ctx.fillRect(CX - 6, CY - 12, 2, 5);
    ctx.fillRect(CX + 4, CY - 12, 2, 5);
    // 眼睛
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(CX - 3, CY - 9, 2, 2);
    ctx.fillRect(CX + 1, CY - 9, 2, 2);
    // 嘴巴（龅牙）
    ctx.fillStyle = '#fff';
    ctx.fillRect(CX - 1, CY - 6, 2, 2);
    // 武器（石块）
    ctx.fillStyle = '#888';
    ctx.fillRect(CX + 5, CY - 4, 6, 5);
    ctx.fillStyle = '#aaa';
    ctx.fillRect(CX + 6, CY - 5, 4, 2);

  } else if (player.form === 'warrior') {
    // 战士：铠甲+剑
    // 腿（护腿）
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(CX - 5, CY + 4, 4, 8);
    ctx.fillRect(CX + 1, CY + 4, 4, 8);
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(CX - 5, CY + 10, 4, 2);
    ctx.fillRect(CX + 1, CY + 10, 4, 2);
    // 盔甲躯体
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(CX - 6, CY - 3, 12, 9);
    // 红色胸甲
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(CX - 4, CY - 2, 8, 6);
    // 手（护臂）
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(CX - 9, CY - 2, 3, 4);
    ctx.fillRect(CX + 6, CY - 2, 3, 4);
    // 头
    ctx.fillStyle = '#f5d6a8';
    ctx.fillRect(CX - 4, CY - 11, 8, 8);
    // 头盔
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(CX - 5, CY - 13, 10, 5);
    ctx.fillRect(CX - 6, CY - 11, 2, 4);
    ctx.fillRect(CX + 4, CY - 11, 2, 4);
    // 眼睛（锐利）
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(CX - 3, CY - 8, 2, 2);
    ctx.fillRect(CX + 1, CY - 8, 2, 2);
    // 剑（右手，闪光）
    ctx.fillStyle = '#bdc3c7';
    ctx.fillRect(CX + 7, CY - 10, 2, 16);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(CX + 5, CY - 2, 6, 2);
    // 剑光
    const swordGlow = 0.4 + Math.sin(now / 200) * 0.3;
    ctx.globalAlpha = swordGlow;
    ctx.fillStyle = '#fff';
    ctx.fillRect(CX + 7, CY - 10, 2, 4);
    ctx.globalAlpha = 1;
    // 盾（左手）
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(CX - 13, CY - 4, 6, 8);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(CX - 11, CY - 1, 2, 2);

  } else if (player.form === 'gunner') {
    // 枪手：风衣+枪管
    // 腿
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(CX - 5, CY + 4, 4, 8);
    ctx.fillRect(CX + 1, CY + 4, 4, 8);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(CX - 5, CY + 10, 4, 2);
    ctx.fillRect(CX + 1, CY + 10, 4, 2);
    // 风衣身体
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(CX - 6, CY - 3, 12, 9);
    // 腰带
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(CX - 6, CY + 2, 12, 2);
    // 手
    ctx.fillStyle = '#f5d6a8';
    ctx.fillRect(CX - 8, CY - 1, 2, 3);
    ctx.fillRect(CX + 6, CY - 1, 5, 2); // 右手持枪
    // 头
    ctx.fillStyle = '#f5d6a8';
    ctx.fillRect(CX - 4, CY - 11, 8, 8);
    // 帽子
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(CX - 5, CY - 13, 10, 4);
    ctx.fillRect(CX - 6, CY - 11, 12, 2); // 帽沿
    // 眼睛（墨镜）
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(CX - 4, CY - 8, 8, 3);
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(CX - 3, CY - 7, 3, 2);
    ctx.fillRect(CX + 0, CY - 7, 3, 2);
    // 枪管
    ctx.fillStyle = '#555';
    ctx.fillRect(CX + 8, CY - 2, 12, 3);
    ctx.fillStyle = '#333';
    ctx.fillRect(CX + 18, CY - 1, 3, 2);
    // 枪口火焰
    const gunFlash = (now / 80 | 0) % 3;
    if (gunFlash === 0) {
      ctx.fillStyle = '#f80';
      ctx.fillRect(CX + 19, CY - 2, 5, 4);
      ctx.fillStyle = '#ff0';
      ctx.fillRect(CX + 20, CY - 1, 4, 2);
    }

  } else if (player.form === 'mech') {
    // 机甲：厚重金属外骨骼
    // 腿（机甲脚）
    ctx.fillStyle = '#606a70';
    ctx.fillRect(CX - 7, CY + 5, 6, 8);
    ctx.fillRect(CX + 1, CY + 5, 6, 8);
    ctx.fillStyle = '#485055';
    ctx.fillRect(CX - 9, CY + 11, 8, 3);
    ctx.fillRect(CX + 1, CY + 11, 8, 3);
    // 躯体（宽大）
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(CX - 8, CY - 5, 16, 12);
    // 机甲胸甲纹理
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(CX - 6, CY - 3, 12, 8);
    ctx.fillStyle = '#606a70';
    ctx.fillRect(CX - 2, CY - 2, 4, 6);
    // 肩甲
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(CX - 12, CY - 5, 5, 7);
    ctx.fillRect(CX + 7, CY - 5, 5, 7);
    // 手臂
    ctx.fillStyle = '#606a70';
    ctx.fillRect(CX - 12, CY, 4, 4);
    ctx.fillRect(CX + 8, CY, 4, 4);
    // 头部（方形）
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(CX - 5, CY - 12, 10, 8);
    // 眼睛（红色扫描线）
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(CX - 4, CY - 9, 8, 2);
    const scanX = (now / 100 | 0) % 7 - 3;
    ctx.fillStyle = '#ff6666';
    ctx.fillRect(CX + scanX - 1, CY - 9, 2, 2);
    // 核心能量方块
    const coreAlpha = 0.7 + Math.sin(now / 80) * 0.3;
    ctx.fillStyle = `rgba(52,152,219,${coreAlpha})`;
    ctx.fillRect(CX - 2, CY - 2, 4, 6);
    ctx.fillStyle = `rgba(160,220,255,${coreAlpha * 0.8})`;
    ctx.fillRect(CX - 1, CY - 1, 2, 4);
    // 肩部炮管
    ctx.fillStyle = '#555';
    ctx.fillRect(CX - 12, CY - 8, 2, 12);
    ctx.fillRect(CX + 10, CY - 8, 2, 12);
    // 炮管光点
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(CX - 13, CY - 7, 1, 2);
    ctx.fillRect(CX + 12, CY - 7, 1, 2);

  } else if (player.form === 'vehicle') {
    // 载具：坦克装甲车
    // 履带
    ctx.fillStyle = '#333';
    ctx.fillRect(CX - 14, CY + 3, 28, 5);
    ctx.fillStyle = '#555';
    for (let i = -13; i < 14; i += 4) {
      ctx.fillRect(CX + i, CY + 3, 2, 5);
    }
    // 车体底盘
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(CX - 12, CY - 4, 24, 9);
    // 车体上层
    ctx.fillStyle = '#1e8449';
    ctx.fillRect(CX - 7, CY - 9, 14, 7);
    // 涂装条纹
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(CX - 11, CY - 2, 22, 2);
    // 炮塔
    ctx.fillStyle = '#1e8449';
    ctx.fillRect(CX - 5, CY - 12, 10, 6);
    // 炮管（朝向最近敌人）
    const nearM = monsters.length > 0
      ? monsters.reduce((a, b) => dist(a, { x: CX, y: CY }) < dist(b, { x: CX, y: CY }) ? a : b)
      : null;
    if (nearM) {
      const ga = Math.atan2(nearM.y - CY, nearM.x - CX);
      ctx.save();
      ctx.translate(CX, CY - 8);
      ctx.rotate(ga);
      ctx.fillStyle = '#1a5c33';
      ctx.fillRect(0, -2, 18, 4);
      ctx.fillStyle = '#145a28';
      ctx.fillRect(15, -3, 5, 6);
      ctx.restore();
    } else {
      ctx.fillStyle = '#1a5c33';
      ctx.fillRect(CX - 2, CY - 18, 4, 10);
    }
    // 天线
    ctx.fillStyle = '#555';
    ctx.fillRect(CX - 3, CY - 16, 1, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(CX - 3, CY - 16, 1, 1);
    // 铆钉
    ctx.fillStyle = '#3a5a4a';
    ctx.fillRect(CX - 10, CY - 1, 3, 3);
    ctx.fillRect(CX + 7, CY - 1, 3, 3);

  } else if (player.form === 'aircraft') {
    // 飞行器：空天战机
    // 主翼
    ctx.fillStyle = '#7d3c98';
    ctx.fillRect(CX - 18, CY - 1, 36, 5);
    // 机身
    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(CX - 7, CY - 5, 14, 11);
    // 机头
    ctx.fillStyle = '#9b59b6';
    ctx.fillRect(CX - 4, CY - 9, 8, 5);
    ctx.fillStyle = '#8e44ad';
    ctx.beginPath();
    ctx.moveTo(CX - 2, CY - 9);
    ctx.lineTo(CX, CY - 14);
    ctx.lineTo(CX + 2, CY - 9);
    ctx.fill();
    // 座舱盖（蓝色）
    ctx.fillStyle = '#5dade2';
    ctx.fillRect(CX - 2, CY - 8, 4, 4);
    ctx.fillStyle = '#85c1e9';
    ctx.fillRect(CX - 1, CY - 7, 2, 2);
    // 尾翼
    ctx.fillStyle = '#6c3483';
    ctx.fillRect(CX - 5, CY + 4, 4, 5);
    ctx.fillRect(CX + 1, CY + 4, 4, 5);
    // 引擎喷口
    ctx.fillStyle = '#333';
    ctx.fillRect(CX - 3, CY + 5, 6, 4);
    // 引擎火焰（动态）
    const flameH = 3 + (Math.sin(now / 60) * 2 | 0);
    const flameR = Math.random() * 0.4;
    ctx.fillStyle = `rgba(241,196,15,${0.7 + flameR})`;
    ctx.fillRect(CX - 3, CY + 9, 6, flameH);
    ctx.fillStyle = `rgba(231,76,60,${0.6 + flameR})`;
    ctx.fillRect(CX - 2, CY + 9, 4, flameH - 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(CX - 1, CY + 9, 2, 2);
    // 翼下武器挂点
    ctx.fillStyle = '#5d2980';
    ctx.fillRect(CX - 14, CY + 1, 3, 3);
    ctx.fillRect(CX + 11, CY + 1, 3, 3);
    // 导弹
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(CX - 15, CY, 1, 5);
    ctx.fillRect(CX + 14, CY, 1, 5);
  }
}

// ==================== 渲染怪物（V1.2：差异化外形+丰富特效） ====================
function drawMonster(game, m) {
  const { ctx } = game.config;
  const now = Date.now();
  const x = Math.round(m.x);
  const y = Math.round(m.y);
  const s = m.size;
  const bob = m.animFrame === 0 ? 0 : -1;

  // ---- BOSS/精英光晕（多层） ----
  if (m.boss) {
    // 外层宽光晕
    const pulsA1 = 0.08 + Math.sin(now / 300) * 0.05;
    ctx.globalAlpha = pulsA1;
    ctx.fillStyle = '#ff2200';
    ctx.beginPath();
    ctx.arc(x, y + bob, s + 18, 0, Math.PI * 2);
    ctx.fill();
    // 中层
    const pulsA2 = 0.15 + Math.sin(now / 200) * 0.1;
    ctx.globalAlpha = pulsA2;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(x, y + bob, s + 10, 0, Math.PI * 2);
    ctx.fill();
    // 旋转光环
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    const bossRot = now / 400;
    for (let i = 0; i < 3; i++) {
      const a = bossRot + (i / 3) * Math.PI * 2;
      const px = x + Math.cos(a) * (s + 12);
      const py = y + bob + Math.sin(a) * (s + 12);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  } else if (m.elite) {
    const pulsA = 0.1 + Math.sin(now / 250) * 0.07;
    ctx.globalAlpha = pulsA;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(x, y + bob, s + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    const eliteRot = now / 600;
    _drawStar(ctx, x, y + bob, s + 8, s + 4, 5, eliteRot);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // ---- 冲锋型特效（橙色圆环） ----
  if (m.dash && m.isDashing) {
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y + bob, s + 5, 0, Math.PI * 2);
    ctx.stroke();
    // 冲锋拖影粒子
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(x - m.dashVx * 8 - s, y + bob - m.dashVy * 8 - s, s * 2, s * 2);
    ctx.globalAlpha = 0.15;
    ctx.fillRect(x - m.dashVx * 16 - s * 0.8, y + bob - m.dashVy * 16 - s * 0.8, s * 1.6, s * 1.6);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // ---- 爆炸型特效（黄色脉冲） ----
  if (m.explosive) {
    const pulse = 0.25 + Math.sin(now / 90) * 0.2;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(x, y + bob, s + 3, 0, Math.PI * 2);
    ctx.fill();
    // 危险警告符号（X）
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + bob - 4);
    ctx.lineTo(x + 4, y + bob + 4);
    ctx.moveTo(x + 4, y + bob - 4);
    ctx.lineTo(x - 4, y + bob + 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // ---- 冰冻状态 ----
  if (m.frozen) {
    // 冰晶效果
    ctx.fillStyle = 'rgba(80,160,255,0.7)';
    ctx.fillRect(x - s - 2, y - s - 2 + bob, s * 2 + 4, s * 2 + 4);
    ctx.fillStyle = 'rgba(200,235,255,0.5)';
    ctx.fillRect(x - s, y - s + bob, s * 2, s * 2);
    // 冰晶粒子
    ctx.fillStyle = '#c8e6ff';
    const iceRot = now / 1000;
    for (let i = 0; i < 4; i++) {
      const a = iceRot + (i / 4) * Math.PI * 2;
      ctx.fillRect(x + Math.cos(a) * (s - 1) - 1, y + bob + Math.sin(a) * (s - 1) - 1, 3, 3);
    }
    // 雪花图案
    ctx.strokeStyle = '#aaddff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - s + 2, y + bob); ctx.lineTo(x + s - 2, y + bob);
    ctx.moveTo(x, y - s + 2 + bob); ctx.lineTo(x, y + s - 2 + bob);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    return;
  }

  // ---- 受击闪白 ----
  if (m.hitFlash > 0) {
    const hf = Math.min(1, m.hitFlash / 0.12);
    ctx.fillStyle = `rgba(255,255,255,${hf * 0.8})`;
    ctx.fillRect(x - s - 2, y - s - 2 + bob, s * 2 + 4, s * 2 + 4);
  }

  // ---- 主体外形（按怪物类型差异化） ----
  if (m.boss) {
    // BOSS：五角星形态
    ctx.fillStyle = m.color;
    _drawStar(ctx, x, y + bob, s * 1.2, s * 0.6, 5, now / 800);
    ctx.fill();
    // 内核
    ctx.fillStyle = '#ff6666';
    ctx.beginPath();
    ctx.arc(x, y + bob, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛（单目）
    const eyeRot = now / 300;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y + bob, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(x + Math.cos(eyeRot) * s * 0.1, y + bob + Math.sin(eyeRot) * s * 0.1, s * 0.15, 0, Math.PI * 2);
    ctx.fill();

  } else if (m.elite) {
    // 精英：六角形
    ctx.fillStyle = m.color;
    _drawPolygon(ctx, x, y + bob, s * 1.1, 6, now / 1200);
    ctx.fill();
    // 内部图案
    ctx.fillStyle = '#fff8c0';
    _drawPolygon(ctx, x, y + bob, s * 0.6, 6, now / 1200 + Math.PI / 6);
    ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(x, y + bob, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛
    const es = 4;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - s * 0.4, y - s * 0.2 + bob, es, es);
    ctx.fillRect(x + s * 0.1, y - s * 0.2 + bob, es, es);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - s * 0.4 + 1, y - s * 0.2 + 1 + bob, 2, 2);
    ctx.fillRect(x + s * 0.1 + 1, y - s * 0.2 + 1 + bob, 2, 2);

  } else if (m.name === '冲锋兵') {
    // 冲锋兵：菱形锐利外形
    ctx.fillStyle = m.color;
    _drawPolygon(ctx, x, y + bob, s, 4, Math.PI / 4);
    ctx.fill();
    // 棱角装饰
    ctx.fillStyle = '#ff9944';
    _drawPolygon(ctx, x, y + bob, s * 0.55, 4, now / 400);
    ctx.fill();
    // 眼睛（细长）
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - s * 0.5 + 1, y - 2 + bob, s - 2, 2);
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(x - s * 0.5 + 2, y - 2 + bob, (s - 4) * 0.5, 2);

  } else if (m.name === '自爆兵') {
    // 自爆兵：圆形+危险条纹
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(x, y + bob, s, 0, Math.PI * 2);
    ctx.fill();
    // 黑色警告条纹
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(now / 2000);
    ctx.fillStyle = '#111';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(a + 0.35) * s, Math.sin(a + 0.35) * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // 核心
    ctx.fillStyle = '#fff200';
    ctx.beginPath();
    ctx.arc(x, y + bob, s * 0.4, 0, Math.PI * 2);
    ctx.fill();

  } else if (m.name === '速攻兵') {
    // 速攻兵：三角形（快速感）
    ctx.fillStyle = m.color;
    _drawPolygon(ctx, x, y + bob, s, 3, -Math.PI / 2);
    ctx.fill();
    // 内三角
    ctx.fillStyle = '#5ff060';
    _drawPolygon(ctx, x, y + bob, s * 0.5, 3, -Math.PI / 2 + Math.PI);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 2, y - 2 + bob, 2, 2);
    ctx.fillRect(x + 1, y - 2 + bob, 2, 2);

  } else if (m.name === '法师兵') {
    // 法师兵：菱形+魔法光球
    ctx.fillStyle = m.color;
    _drawPolygon(ctx, x, y + bob, s, 4, 0);
    ctx.fill();
    ctx.fillStyle = '#c39bd3';
    ctx.beginPath();
    ctx.arc(x, y + bob, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // 魔法粒子
    const mageRot = now / 500;
    ctx.fillStyle = '#e8daef';
    for (let i = 0; i < 4; i++) {
      const a = mageRot + (i / 4) * Math.PI * 2;
      ctx.fillRect(x + Math.cos(a) * s - 1, y + bob + Math.sin(a) * s - 1, 2, 2);
    }
    // 眼睛
    ctx.fillStyle = '#9b59b6';
    ctx.fillRect(x - 3, y - 2 + bob, 2, 3);
    ctx.fillRect(x + 1, y - 2 + bob, 2, 3);

  } else {
    // 近战兵（默认方形，加棱角）
    ctx.fillStyle = m.color;
    ctx.fillRect(x - s, y - s + bob, s * 2, s * 2);
    // 装饰角
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x - s, y - s + bob, s, s);
    // 眼睛
    const es = m.boss ? 5 : (m.elite ? 4 : 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - s + 2, y - s / 2 + bob, es, es);
    ctx.fillRect(x + s - 2 - es, y - s / 2 + bob, es, es);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - s + 3, y - s / 2 + 1 + bob, 2, 2);
    ctx.fillRect(x + s - 1 - es, y - s / 2 + 1 + bob, 2, 2);
  }

  // ---- 血条（更精细） ----
  if (m.hp < m.maxHp) {
    const bw = Math.max(s * 2, 24);
    // 背景
    ctx.fillStyle = '#111';
    ctx.fillRect(x - bw / 2, y - s - 10 + bob, bw, 5);
    const hpRatio = Math.max(0, m.hp / m.maxHp);
    // 血条颜色
    const barColor = m.boss ? '#e74c3c' : m.elite ? '#f1c40f'
      : hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = barColor;
    ctx.fillRect(x - bw / 2, y - s - 10 + bob, bw * hpRatio, 5);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x - bw / 2, y - s - 10 + bob, bw * hpRatio, 2);
    // 边框
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - bw / 2, y - s - 10 + bob, bw, 5);
    ctx.lineWidth = 1;
  }

  // ---- 灼烧效果（升级版）----
  if (m.burnTimer > 0) {
    const flicker = 0.5 + Math.sin(now / 70) * 0.35;
    // 火焰外框
    ctx.fillStyle = `rgba(255,80,0,${flicker * 0.5})`;
    ctx.fillRect(x - s - 3, y - s - 3 + bob, s * 2 + 6, s * 2 + 6);
    // 内层
    ctx.fillStyle = `rgba(255,160,0,${flicker * 0.4})`;
    ctx.fillRect(x - s - 1, y - s - 1 + bob, s * 2 + 2, s * 2 + 2);
    // 火焰粒子（随机小火星）
    ctx.fillStyle = '#ff0';
    ctx.fillRect(x - 1, y - s - 6 + bob, 2, 5);
    ctx.fillStyle = '#f80';
    ctx.fillRect(x + s - 3, y - s - 5 + bob, 2, 4);
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(x - s + 1, y - s - 4 + bob, 2, 3);
  }

  // ---- 减速效果（冰蓝闪光）----
  if (m.slowTimer > 0) {
    ctx.fillStyle = 'rgba(100,200,255,0.3)';
    ctx.fillRect(x - s - 1, y - s - 1 + bob, s * 2 + 2, s * 2 + 2);
    // 雪花点
    ctx.fillStyle = '#aaeeff';
    const slowPhase = (now / 300) % (Math.PI * 2);
    ctx.fillRect(x - 1, y - s + bob, 2, s * 2);
    ctx.fillRect(x - s + bob, y - 1, s * 2, 2);
    ctx.globalAlpha = 0.5 + Math.sin(slowPhase) * 0.3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 1, y - 1 + bob, 2, 2);
    ctx.globalAlpha = 1;
  }
}

// ==================== HUD（V1.2：质感大升级） ====================
function drawHUD(game) {
  const { ctx, W, H, CX, CY, FORM_DEFS, FRUIT_DEFS, WEAPON_DEFS, RARITY_COLORS, SLOT_UNLOCKS, HUD_SCALE } = game.config;
  const st = game.state;
  const { player } = game;
  const now = Date.now();

  const fSmall = Math.round(11 * HUD_SCALE);
  const fNormal = Math.round(13 * HUD_SCALE);
  const fLarge = Math.round(15 * HUD_SCALE);

  const bx = 12, by = 12, bw = 180, bh = 16;

  // ---- HP 条（渐变+内发光） ----
  // 背景槽（深色+轻微纹路）
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(bx, by, bw, bh);

  const hpR = player.hp / player.maxHp;
  const hpW = bw * hpR;
  // 主血条（分段渐变）
  if (hpW > 0) {
    const hpGrad = ctx.createLinearGradient(bx, by, bx + hpW, by);
    if (hpR > 0.5) {
      hpGrad.addColorStop(0, '#c0392b');
      hpGrad.addColorStop(1, '#e74c3c');
    } else if (hpR > 0.25) {
      hpGrad.addColorStop(0, '#d35400');
      hpGrad.addColorStop(1, '#e67e22');
    } else {
      // 低血量：闪烁
      const flicker = 0.85 + Math.sin(now / 150) * 0.15;
      hpGrad.addColorStop(0, `rgba(192,57,43,${flicker})`);
      hpGrad.addColorStop(1, `rgba(231,76,60,${flicker})`);
    }
    ctx.fillStyle = hpGrad;
    ctx.fillRect(bx, by, hpW, bh);
    // 高光条
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(bx, by, hpW, 3);
    // 低血量发光
    if (hpR <= 0.25) {
      ctx.globalAlpha = 0.3 + Math.sin(now / 150) * 0.2;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(bx - 1, by - 1, hpW + 2, bh + 2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = hpR > 0.25 ? '#fff' : '#ffcccc';
  ctx.font = `bold ${fSmall}px monospace`;
  ctx.fillText(`❤️ ${Math.ceil(player.hp)}/${player.maxHp}`, bx + 4, by + 12);

  // ---- 护盾条（蓝色，带流动效果） ----
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(bx - 1, by + 19, bw + 2, bh + 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(bx, by + 20, bw, bh);
  const shR = player.shield / player.maxShield;
  const shW = bw * shR;
  if (shW > 0) {
    const shGrad = ctx.createLinearGradient(bx, by + 20, bx + shW, by + 20);
    shGrad.addColorStop(0, '#1565c0');
    shGrad.addColorStop(0.5, '#1976d2');
    shGrad.addColorStop(1, '#42a5f5');
    ctx.fillStyle = shGrad;
    ctx.fillRect(bx, by + 20, shW, bh);
    // 护盾流光（波纹）
    const flowX = (now / 600) % 1;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#90caf9';
    ctx.fillRect(bx + shW * flowX - 4, by + 20, 8, bh);
    ctx.globalAlpha = 1;
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(bx, by + 20, shW, 3);
  }
  ctx.strokeStyle = '#3a3a3a';
  ctx.strokeRect(bx, by + 20, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${fSmall}px monospace`;
  ctx.fillText(`🛡️ ${Math.ceil(player.shield)}/${player.maxShield}`, bx + 4, by + 32);

  // ---- 形态名（带颜色光晕） ----
  const form = FORM_DEFS[player.form];
  ctx.fillStyle = form.color;
  ctx.font = `bold ${fNormal}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(`${form.name}`, bx, by + 52);
  ctx.fillStyle = '#666';
  ctx.font = `${fSmall}px monospace`;
  ctx.fillText(form.desc, bx, by + 65);

  // ---- 新手引导提示 ----
  if (st.tutorialActive) {
    const tutorialAlpha = 0.7 + Math.sin(now / 280) * 0.3;
    ctx.globalAlpha = tutorialAlpha;
    ctx.fillStyle = '#3498db';
    ctx.font = `bold ${fSmall}px monospace`;
    ctx.fillText('🛡️ 护盾保护中...', bx, by + 82);
    ctx.fillStyle = '#777';
    ctx.font = `${Math.round(9 * HUD_SCALE)}px monospace`;
    ctx.fillText(`剩余 ${Math.ceil(game.config.TUTORIAL_DURATION - st.tutorialTimer)} 秒`, bx, by + 96);
    ctx.globalAlpha = 1;
  }

  // ---- 果实 + 能量条（升级版）----
  if (player.fruit) {
    const fc = FRUIT_DEFS[player.fruit];
    const fy = by + (st.tutorialActive ? 108 : 75);
    ctx.fillStyle = fc.color;
    ctx.font = `${fNormal}px monospace`;
    ctx.fillText(`${fc.icon} ${fc.name}`, bx, fy);
    ctx.fillStyle = '#666';
    ctx.font = `${fSmall}px monospace`;
    ctx.fillText(fc.desc, bx, fy + 14);

    const ew = 170, eh = 14, ex = bx, ey = fy + 20;
    // 背景
    ctx.fillStyle = '#111';
    ctx.fillRect(ex - 1, ey - 1, ew + 2, eh + 2);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(ex, ey, ew, eh);

    const r = player.fruitEnergy / player.fruitMaxEnergy;
    if (r > 0) {
      const eGrad = ctx.createLinearGradient(ex, ey, ex + ew * r, ey);
      if (r >= 1) {
        eGrad.addColorStop(0, fc.color);
        eGrad.addColorStop(0.5, fc.colorLight || fc.color);
        eGrad.addColorStop(1, fc.color);
      } else {
        eGrad.addColorStop(0, '#333');
        eGrad.addColorStop(1, '#555');
      }
      ctx.fillStyle = eGrad;
      ctx.fillRect(ex, ey, ew * r, eh);
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(ex, ey, ew * r, 3);
    }

    ctx.strokeStyle = r >= 1 ? fc.color : '#2a2a2a';
    ctx.lineWidth = r >= 1 ? 2 : 1;
    ctx.strokeRect(ex, ey, ew, eh);

    // 能量满时脉冲外光
    if (r >= 1) {
      const glowA = 0.25 + Math.sin(now / 120) * 0.2;
      ctx.strokeStyle = fc.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = glowA;
      ctx.strokeRect(ex - 3, ey - 3, ew + 6, eh + 6);
      ctx.globalAlpha = 1;
      // 流动高亮
      const ftFlow = (now / 400) % 1;
      ctx.globalAlpha = 0.4 + Math.sin(now / 120) * 0.3;
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex + ew * ftFlow - 3, ey, 6, eh);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = r >= 1 ? '#fff' : '#666';
    ctx.font = `${fSmall}px monospace`;
    ctx.fillText(r >= 1 ? `✨ ${fc.ultName} [右下]` : `${Math.floor(player.fruitEnergy)}/${player.fruitMaxEnergy}`, ex + 4, ey + 10);
    ctx.lineWidth = 1;
  }

  // ---- 连击显示（炫酷版）----
  if (st.comboCount >= 3) {
    const cs = Math.min(30, 16 + st.comboCount / 2);
    const comboAlpha = 0.9 + Math.sin(now / 100) * 0.1;
    const comboX = CX;
    const comboY = H - 22;

    ctx.globalAlpha = comboAlpha;
    // 半透明背景板
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(CX - 100, H - 50, 200, 38);
    // 顶部边框线
    const comboColor = st.comboCount >= 50 ? '#ff2200' :
      st.comboCount >= 20 ? '#ff0' : st.comboCount >= 10 ? '#f80' : '#ff6600';
    ctx.fillStyle = comboColor;
    ctx.fillRect(CX - 100, H - 50, 200, 2);

    ctx.font = `bold ${cs}px monospace`;
    ctx.textAlign = 'center';
    // 描边
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(`${st.comboCount} COMBO ×${st.comboMultiplier.toFixed(1)}`, comboX, comboY);
    ctx.fillStyle = comboColor;
    ctx.fillText(`${st.comboCount} COMBO ×${st.comboMultiplier.toFixed(1)}`, comboX, comboY);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.lineWidth = 1;
  }

  // ---- 中上信息栏（升级版）----
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(CX - 190, 2, 380, 26);
  // 顶部细线
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(CX - 190, 2, 380, 1);
  ctx.fillStyle = '#ddd';
  ctx.font = `${fNormal}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`⚔️ ${st.kills}  ⏱ ${game.utils.formatTime(st.survivalTime)}  🔥×${st.difficultyMult.toFixed(1)}`, CX, 20);

  if (st.levelCount > 0) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = `${fSmall}px monospace`;
    ctx.fillText(`Lv.${st.levelCount} ▲`, CX + 130, 20);
  }

  // ---- 右上角武器 ----
  ctx.textAlign = 'right';
  ctx.font = `${fNormal}px monospace`;
  ctx.fillStyle = '#aaa';
  ctx.fillText(`武器 ${player.weapons.length}/${player.maxSlots}`, W - 12, 20);
  for (let i = 0; i < player.weapons.length; i++) {
    const def = WEAPON_DEFS[player.weapons[i]];
    ctx.fillStyle = RARITY_COLORS[def.rarity];
    ctx.fillText(`${def.icon} ${def.name}`, W - 12, 37 + i * 17);
  }
  if (player.maxSlots < SLOT_UNLOCKS.length) {
    ctx.fillStyle = '#444';
    ctx.fillText(`下一槽: ${st.kills}/${SLOT_UNLOCKS[player.maxSlots]}`, W - 12, 37 + player.weapons.length * 17);
  }

  // ---- 底部提示 ----
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = `${Math.round(10 * HUD_SCALE)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('右下:大招  右上:暂停  |  P暂停  R重开  M静音', CX, H - 6);
  if (game.utils.isMuted && game.utils.isMuted()) {
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('🔇', CX - 196, 20);
  }
  ctx.textAlign = 'left';
}

// ==================== 虚拟按钮（V1.2：质感升级） ====================
function drawVirtualButtons(game) {
  const { ctx, W, H, FRUIT_DEFS } = game.config;
  const st = game.state;
  const { player } = game;
  const now = Date.now();

  // ---- 大招按钮 ----
  if (player.fruit) {
    const fc = FRUIT_DEFS[player.fruit];
    const ux = W - 65, uy = H - 65, ur = 45;
    const energyFull = player.fruitEnergy >= player.fruitMaxEnergy;

    // 最外发光（仅满能量时）
    if (energyFull) {
      const outerGlow = 0.12 + Math.sin(now / 120) * 0.1;
      ctx.globalAlpha = outerGlow;
      ctx.fillStyle = fc.color;
      ctx.beginPath();
      ctx.arc(ux, uy, ur + 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 背景圆
    ctx.beginPath();
    ctx.arc(ux, uy, ur, 0, Math.PI * 2);
    ctx.fillStyle = energyFull ? `rgba(30,30,30,0.9)` : 'rgba(0,0,0,0.5)';
    ctx.fill();

    // 能量进度弧（粗）
    if (player.fruitEnergy > 0) {
      const arc = (player.fruitEnergy / player.fruitMaxEnergy) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(ux, uy, ur - 4, -Math.PI / 2, -Math.PI / 2 + arc);
      ctx.strokeStyle = fc.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      // 进度弧高光
      ctx.beginPath();
      ctx.arc(ux, uy, ur - 4, -Math.PI / 2, -Math.PI / 2 + Math.min(arc, 0.4));
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 边框圆
    ctx.beginPath();
    ctx.arc(ux, uy, ur, 0, Math.PI * 2);
    ctx.strokeStyle = energyFull ? fc.color : '#444';
    ctx.lineWidth = energyFull ? 3 : 1.5;
    ctx.stroke();

    // 满能量：外圈脉冲
    if (energyFull) {
      const glow = 0.4 + Math.sin(now / 130) * 0.25;
      ctx.beginPath();
      ctx.arc(ux, uy, ur + 10, 0, Math.PI * 2);
      ctx.strokeStyle = fc.color;
      ctx.lineWidth = 5;
      ctx.globalAlpha = glow;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 旋转光点
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + now / 500;
        const px = ux + Math.cos(a) * (ur + 10);
        const py = uy + Math.sin(a) * (ur + 10);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = fc.color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 图标
    ctx.font = '28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fc.icon, ux, uy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 1;
  }

  // ---- 暂停按钮（精致版）----
  const px = W - 32, py = 45;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(px - 18, py - 16, 36, 30);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#999';
  ctx.fillRect(px - 7, py - 9, 5, 16);
  ctx.fillRect(px + 2, py - 9, 5, 16);
}

// ==================== 触摸涟漪 ====================
function drawTouchRipple(game) {
  const { ctx, screenToGame } = game.config;
  const { touchFeedback } = game.config;

  if (!touchFeedback.active) return;

  const gp = screenToGame(touchFeedback.x, touchFeedback.y);
  const alpha = touchFeedback.timer / 0.3 * 0.25;
  const radius = (0.3 - touchFeedback.timer) / 0.3 * 32 + 5;

  ctx.beginPath();
  ctx.arc(gp.x, gp.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ==================== 关闭按钮 ====================
function drawCloseButton(game) {
  const { ctx, W } = game.config;
  const bx = W - 32, by = 15, bs = 24;

  ctx.fillStyle = 'rgba(180,30,30,0.75)';
  ctx.fillRect(bx - bs / 2, by, bs, bs);
  ctx.strokeStyle = '#f55';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx - bs / 2, by, bs, bs);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('✕', bx, by + 17);
  ctx.textAlign = 'left';
}

// ==================== 天赋升级界面 ====================
function drawLevelUpScreen(game) {
  const { ctx, W, H, CX, CY } = game.config;
  const st = game.state;
  const { pendingTalents } = st;
  const now = Date.now();

  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, W, H);

  // 标题
  ctx.fillStyle = '#ffd740';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`✨ 升级 Lv.${st.levelCount}！选择天赋`, CX, CY - 110);
  ctx.fillStyle = '#aaa';
  ctx.font = '12px monospace';
  ctx.fillText('点击选择一项天赋加成', CX, CY - 82);

  // 天赋卡片
  const cardW = 210, cardH = 95, gap = 18;
  const totalW = pendingTalents.length * cardW + (pendingTalents.length - 1) * gap;
  const startX = CX - totalW / 2;

  for (let i = 0; i < pendingTalents.length; i++) {
    const t = pendingTalents[i];
    const cx = startX + i * (cardW + gap);
    const cy = CY - 55;

    // 卡片背景
    ctx.fillStyle = '#111';
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx, cy, cardW, cardH);

    // 发光边框
    const glowA = 0.18 + Math.sin(now / 200 + i) * 0.12;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 8;
    ctx.globalAlpha = glowA;
    ctx.strokeRect(cx, cy, cardW, cardH);
    ctx.globalAlpha = 1;

    ctx.fillStyle = t.color;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(t.name, cx + 12, cy + 28);
    ctx.fillStyle = '#bbb';
    ctx.font = '11px monospace';
    ctx.fillText(t.desc, cx + 12, cy + 52);
    ctx.fillStyle = t.color;
    ctx.font = '10px monospace';
    ctx.globalAlpha = 0.6;
    ctx.fillText('点击选择', cx + cardW / 2 - 24, cy + 80);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

// ==================== 武器选择界面 ====================
function drawWeaponSelect(game) {
  const { ctx, W, H, CX, CY, WEAPON_DEFS, RARITY_NAMES, RARITY_COLORS } = game.config;
  const st = game.state;
  const { pendingWeapon } = st;
  const player = game.player;

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);

  const nd = WEAPON_DEFS[pendingWeapon];
  ctx.fillStyle = RARITY_COLORS[nd.rarity];
  ctx.font = 'bold 19px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`[${RARITY_NAMES[nd.rarity]}] ${nd.icon} ${nd.name}`, CX, CY - 90);
  ctx.fillStyle = '#ccc';
  ctx.font = '13px monospace';
  ctx.fillText(`伤害: ${nd.dmg}  射速: ${nd.interval}s  ${nd.desc}`, CX, CY - 65);
  ctx.fillText('武器槽已满！选择替换：', CX, CY - 40);

  for (let i = 0; i < player.weapons.length; i++) {
    const def = WEAPON_DEFS[player.weapons[i]];
    const y = CY - 12 + i * 32;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(CX - 180, y - 13, 360, 28);
    ctx.strokeStyle = RARITY_COLORS[def.rarity];
    ctx.lineWidth = 1.5;
    ctx.strokeRect(CX - 180, y - 13, 360, 28);
    ctx.fillStyle = RARITY_COLORS[def.rarity];
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${def.icon} ${def.name}`, CX - 168, y + 6);
    ctx.fillStyle = '#888';
    ctx.textAlign = 'right';
    ctx.fillText(`dmg:${def.dmg}  ${RARITY_NAMES[def.rarity]}`, CX + 172, y + 6);
  }

  const escY = CY - 12 + player.weapons.length * 32 + 8;
  ctx.fillStyle = '#222';
  ctx.fillRect(CX - 48, escY - 12, 96, 28);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(CX - 48, escY - 12, 96, 28);
  ctx.fillStyle = '#888';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('放弃', CX, escY + 8);

  drawCloseButton(game);
  ctx.textAlign = 'left';
}

// ==================== 果实选择界面 ====================
function drawFruitSelect(game) {
  const { ctx, W, H, CX, CY, FRUIT_DEFS } = game.config;
  const st = game.state;
  const { pendingFruit } = st;
  const player = game.player;

  const nd = FRUIT_DEFS[pendingFruit];
  const od = FRUIT_DEFS[player.fruit];

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = nd.color;
  ctx.font = 'bold 21px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${nd.icon} ${nd.name}`, CX, CY - 95);
  ctx.fillStyle = '#ccc';
  ctx.font = '13px monospace';
  ctx.fillText(`效果: ${nd.desc}`, CX, CY - 70);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('每人只能拥有1个果实！', CX, CY - 44);

  // 当前果实
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(CX - 200, CY - 28, 400, 34);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(CX - 200, CY - 28, 400, 34);
  ctx.fillStyle = od.color;
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`当前: ${od.icon} ${od.name} — ${od.desc}`, CX - 188, CY - 5);

  // 新果实
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(CX - 200, CY + 16, 400, 34);
  ctx.strokeStyle = nd.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(CX - 200, CY + 16, 400, 34);
  ctx.fillStyle = nd.color;
  ctx.fillText(`新的: ${nd.icon} ${nd.name} — ${nd.desc}`, CX - 188, CY + 39);

  // 替换 / 放弃 按钮
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(CX - 115, CY + 65, 105, 34);
  ctx.strokeStyle = nd.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(CX - 115, CY + 65, 105, 34);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('替换', CX - 62, CY + 88);

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(CX + 10, CY + 65, 105, 34);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(CX + 10, CY + 65, 105, 34);
  ctx.fillStyle = '#888';
  ctx.fillText('放弃', CX + 62, CY + 88);

  drawCloseButton(game);
  ctx.textAlign = 'left';
}

// ==================== 暂停界面 ====================
function drawPauseScreen(game) {
  const { ctx, W, H, CX, CY } = game.config;
  const st = game.state;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('⏸  暂  停', CX, CY - 30);
  ctx.fillStyle = '#bbb';
  ctx.font = '15px monospace';
  ctx.fillText('触摸屏幕或按 P 继续 | R 重开 | M 静音', CX, CY + 18);
  ctx.fillStyle = '#555';
  ctx.font = '12px monospace';
  ctx.fillText(`当前击杀: ${st.kills}  存活: ${game.utils.formatTime(st.survivalTime)}`, CX, CY + 50);
  ctx.textAlign = 'left';
}

// ==================== 开始菜单 ====================
function drawMenu(game) {
  const { ctx, W, H, CX, CY, FORM_DEFS } = game.config;
  const { getBestRecord } = game.utils;
  const { bestKills, bestTime, bestForm } = getBestRecord();
  const now = Date.now();

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  // 标题
  const titleY = CY - 125 + Math.sin(now / 600) * 7;
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(241,196,15,0.28)';
  ctx.fillText('无 限 进 化', CX, titleY + 4);
  ctx.fillStyle = '#ffd740';
  ctx.fillText('无 限 进 化', CX, titleY);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText('Infinite Evolution', CX, titleY + 26);

  // 简介
  ctx.fillStyle = '#bbb';
  ctx.font = '13px monospace';
  ctx.fillText('击杀怪物 → 获取装备 → 形态进化 → 更强！', CX, CY - 55);
  ctx.fillText('🧑原始人 ⚔️战士 🔫枪手 🤖机甲 🚗载具 ✈️飞行器', CX, CY - 32);
  ctx.fillText('🔥烧烧  ❄️冰冰  ⚡雷雷 — 积攒能量释放大招！', CX, CY - 10);

  // 天赋系统说明
  ctx.fillStyle = '#f1c40f';
  ctx.font = '12px monospace';
  ctx.fillText('✨ 每30秒可选择天赋升级，强化你的战斗风格！', CX, CY + 18);

  // 最高记录展示
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(CX - 190, CY + 36, 380, 45);
  ctx.strokeStyle = '#ffd740';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(CX - 190, CY + 36, 380, 45);
  ctx.fillStyle = '#ffd740';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('🏆 最高记录', CX, CY + 54);
  ctx.fillStyle = '#ccc';
  ctx.font = '11px monospace';
  if (bestKills > 0) {
    const formName = bestForm && FORM_DEFS[bestForm] ? FORM_DEFS[bestForm].name : bestForm;
    ctx.fillText(`击杀: ${bestKills}  存活: ${game.utils.formatTime(bestTime)}  形态: ${formName}`, CX, CY + 72);
  } else {
    ctx.fillText('暂无记录，快来创造第一个！', CX, CY + 72);
  }

  // P0新增：新手引导提示
  ctx.fillStyle = '#3498db';
  ctx.font = '11px monospace';
  ctx.fillText('🛡️ 首10秒有护盾保护，新手友好！', CX, CY + 95);

  // 开始提示（闪烁）
  if (Math.sin(now / 350) > 0) {
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('▶ 触摸屏幕开始游戏', CX, CY + 125);
  }

  // 操作提示
  ctx.fillStyle = '#555';
  ctx.font = '11px monospace';
  ctx.fillText('自动攻击 | 右下:大招 | 右上:暂停 | 键盘 P暂停 R重开 M静音', CX, CY + 150);

  ctx.textAlign = 'left';
}

// ==================== 死亡界面 ====================
function drawDeathScreen(game) {
  const { ctx, W, H, CX, CY, FORM_DEFS, FRUIT_DEFS, WEAPON_DEFS } = game.config;
  const st = game.state;
  const { isNewRecord } = st;
  const { player } = game;
  const now = Date.now();

  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, W, H);

  // 标题
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('☠  你  倒  下  了', CX, CY - 100);

  // 新纪录特效
  if (isNewRecord) {
    const glow = 0.7 + Math.sin(now / 200) * 0.3;
    ctx.fillStyle = `rgba(255,215,0,${glow})`;
    ctx.font = 'bold 22px monospace';
    ctx.fillText('🎉 新纪录！', CX, CY - 68);
  }

  // 最终形态
  const form = FORM_DEFS[player.form];
  ctx.fillStyle = form.color;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`最终形态：${form.name}`, CX, CY - 40);

  // 本局数据
  ctx.fillStyle = '#ecf0f1';
  ctx.font = '16px monospace';
  ctx.fillText(`存活: ${game.utils.formatTime(st.survivalTime)}  |  击杀: ${st.kills}  |  难度: ×${st.difficultyMult.toFixed(1)}`, CX, CY - 10);

  // 武器列表
  ctx.fillStyle = '#bbb';
  ctx.font = '13px monospace';
  ctx.fillText(player.weapons.map(w => `${WEAPON_DEFS[w].icon}${WEAPON_DEFS[w].name}`).join(' + '), CX, CY + 20);
  if (player.fruit) {
    ctx.fillStyle = FRUIT_DEFS[player.fruit].color;
    ctx.fillText(`果实: ${FRUIT_DEFS[player.fruit].icon} ${FRUIT_DEFS[player.fruit].name}`, CX, CY + 44);
  }

  // 天赋数量
  if (st.levelCount > 0) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = '12px monospace';
    ctx.fillText(`获得天赋: ${st.levelCount} 个`, CX, CY + 65);
  }

  // 最高记录对比
  const { getBestRecord } = game.utils;
  const { bestKills, bestTime } = getBestRecord();
  ctx.fillStyle = '#555';
  ctx.font = '12px monospace';
  ctx.fillText(`最高击杀: ${bestKills}  最长存活: ${game.utils.formatTime(bestTime)}`, CX, CY + 88);

  // 重开提示（闪烁）
  if (Math.sin(now / 350) > 0) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('▶ 按 R 或触摸屏幕重新开始', CX, CY + 125);
  }

  ctx.textAlign = 'left';
}

// ==================== 渲染冲击波（新增） ====================
function drawShockwaves(game) {
  const { ctx } = game.config;
  const { shockwaves } = game.objs;
  if (!shockwaves) return;

  for (const sw of shockwaves) {
    const alpha = sw.life / sw.maxLife;
    const radius = sw.maxRadius * (1 - alpha);
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = sw.color || '#ffffff';
    ctx.lineWidth = 3 * alpha;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    // 内圈
    ctx.globalAlpha = alpha * 0.3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

// ==================== 主渲染函数（V1.2：全面升级） ====================
function draw(game) {
  const { ctx, canvas, dpr, scale, offsetX, offsetY, W, H, CX, CY } = game.config;
  const st = game.state;
  const { monsters, bullets, particles, floatingTexts, lightnings, ghostBlades } = game.objs;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);

  // 震屏
  if (st.screenShake > 0) {
    ctx.translate(st.screenShakeX || 0, st.screenShakeY || 0);
  }

  drawBackground(game);

  if (st.state === 'MENU') {
    drawMenu(game);
    ctx.restore();
    return;
  }

  // 渲染怪物
  for (const m of monsters) {
    drawMonster(game, m);
  }

  // 渲染冲击波
  drawShockwaves(game);

  // 渲染闪电（升级：折线锯齿感增强）
  for (const l of lightnings) {
    const alpha = Math.min(1, l.life / 0.3);
    // 外层光晕
    ctx.globalAlpha = alpha * 0.3;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = (l.width || 2) + 8;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    // 主闪电（折线）
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = l.width || 2;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
    const segs = 8;
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const jitter = s < segs ? game.utils.rand(-12, 12) : 0;
      ctx.lineTo(l.x1 + dx * t + jitter, l.y1 + dy * t + jitter);
    }
    ctx.stroke();
    // 核心白线
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 渲染子弹
  for (const b of bullets) {
    drawBullet(game, b);
  }

  // 渲染幽灵剑气
  for (const gb of ghostBlades) {
    drawGhostBlade(game, gb);
  }

  // 渲染粒子（按类型差异化）
  for (const p of particles) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const ps = p.size * (p.shrink ? a : 1);
    if (ps > 0) {
      ctx.fillRect(Math.round(p.x - ps / 2), Math.round(p.y - ps / 2), ps, ps);
    }
  }
  ctx.globalAlpha = 1;

  // 渲染浮动文字（升级：更清晰的描边+缩放）
  for (const ft of floatingTexts) {
    const alpha = Math.min(1, ft.life / (ft.maxLife * 0.5));
    const sc = 1.0 + (1 - ft.life / ft.maxLife) * 0.25;
    ctx.save();
    ctx.translate(ft.x, ft.y);
    ctx.scale(sc, sc);
    ctx.globalAlpha = alpha;
    ctx.font = `bold 14px monospace`;
    ctx.textAlign = 'center';
    // 多层描边
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 4;
    ctx.strokeText(ft.text, 0, 0);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.strokeText(ft.text, 0, 0);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.lineWidth = 1;

  // 渲染玩家
  drawPlayer(game);

  // ---- 全屏效果叠加 ----
  // 受伤红闪
  if (st.damageFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${st.damageFlash * 0.3})`;
    ctx.fillRect(0, 0, W, H);
    // 四角红晕
    const vigAlpha = st.damageFlash * 0.5;
    ctx.fillStyle = `rgba(180,0,0,${vigAlpha * 0.6})`;
    ctx.fillRect(0, 0, W, 60);
    ctx.fillRect(0, H - 60, W, 60);
    ctx.fillRect(0, 0, 60, H);
    ctx.fillRect(W - 60, 0, 60, H);
  }

  // 大招闪光（颜色扩散）
  if (st.ultimateFlash > 0) {
    const uf = st.ultimateFlash;
    const ufColor = st.ultimateFlashColor || '#fff';
    // 中心向外扩散感
    ctx.fillStyle = ufColor;
    ctx.globalAlpha = Math.min(1, uf) * 0.45;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.min(1, uf) * 0.2;
    ctx.fillRect(CX - 80, CY - 80, 160, 160);
    ctx.globalAlpha = 1;
  }

  // 进化闪光（白色爆闪）
  if (st.evolveFlash > 0) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = Math.min(1, st.evolveFlash) * 0.55;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // 边缘危险警告（渐变晕边）
  if (monsters.length > 0) {
    let closestDist = Infinity;
    for (const m of monsters) {
      const d = game.utils.dist(m, { x: CX, y: CY });
      if (d < closestDist) closestDist = d;
    }
    if (closestDist < 80) {
      const dangerRatio = (1 - closestDist / 80);
      const dangerAlpha = dangerRatio * 0.35 * (0.5 + Math.sin(Date.now() / 100) * 0.5);
      ctx.fillStyle = `rgba(255,0,0,${dangerAlpha})`;
      // 四边渐变警告条
      ctx.fillRect(0, 0, W, 10);
      ctx.fillRect(0, H - 10, W, 10);
      ctx.fillRect(0, 0, 10, H);
      ctx.fillRect(W - 10, 0, 10, H);
    }
  }

  // HUD
  drawHUD(game);

  // 虚拟按钮
  if (st.state === 'PLAYING') {
    drawVirtualButtons(game);
  }
  drawTouchRipple(game);

  // 界面
  if (st.state === 'WEAPON_SELECT') drawWeaponSelect(game);
  if (st.state === 'FRUIT_SELECT') drawFruitSelect(game);
  if (st.state === 'LEVEL_UP') drawLevelUpScreen(game);
  if (st.state === 'PAUSED') drawPauseScreen(game);
  if (st.state === 'DEAD') drawDeathScreen(game);

  ctx.restore();
}

// ==================== 导出 ====================
export {
  drawBackground,
  drawBullet,
  drawGhostBlade,
  drawPlayer,
  drawMonster,
  drawHUD,
  drawVirtualButtons,
  drawTouchRipple,
  drawCloseButton,
  drawLevelUpScreen,
  drawWeaponSelect,
  drawFruitSelect,
  drawPauseScreen,
  drawMenu,
  drawDeathScreen,
  drawShockwaves,
  draw,
};
