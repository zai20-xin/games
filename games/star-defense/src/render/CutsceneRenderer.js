// ================================================================
// 剧情幕间插画 - 简单 Canvas 程序绘制 + 文字 overlay
// 触发场景：通关 #3 / #6 / #9 / #12 / #15 / #17
// ================================================================

const SCENES = {
  fleet_approach: {
    title: '母舰出现在视野',
    subtitle: '敌方第七舰队正在集结',
    draw: (ctx, w, h, t) => drawFleetApproach(ctx, w, h, t),
  },
  base_surrounded: {
    title: '新威胁从另一方向逼近',
    subtitle: '星际海盗正从侧翼包抄',
    draw: (ctx, w, h, t) => drawBaseSurrounded(ctx, w, h, t),
  },
  zodiac_portal: {
    title: '星座门开启',
    subtitle: '十二星座的力量正在苏醒',
    draw: (ctx, w, h, t) => drawZodiacPortal(ctx, w, h, t),
  },
  final_stand: {
    title: '终局之战',
    subtitle: '所有英雄齐聚一堂',
    draw: (ctx, w, h, t) => drawFinalStand(ctx, w, h, t),
  },
};

// === 场景 1：舰队逼近 ===
function drawFleetApproach(ctx, w, h, t) {
  // 星空背景
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(0, 0, w, h);
  // 远景星
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 60; i++) {
    const x = (i * 137 + Math.floor(t * 30)) % w;
    const y = (i * 53) % h;
    const a = 0.3 + 0.4 * Math.sin(t * 2 + i);
    ctx.globalAlpha = a * 0.6;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  // 推进中的舰队（从远处逼近）
  for (let i = 0; i < 5; i++) {
    const progress = (t * 0.5 + i * 0.18) % 1;
    const x = w * 0.5 + Math.sin(t + i) * 40;
    const y = h * 0.5 - 60 + progress * 220;
    const scale = 0.4 + progress * 0.8;
    const alpha = Math.max(0.1, 1 - progress * 0.7);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff5577';
    ctx.beginPath();
    ctx.ellipse(x, y, 30 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // 推进光
    ctx.fillStyle = '#ffaa66';
    ctx.beginPath();
    ctx.ellipse(x, y - 5 * scale, 8 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 远景的母舰
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5 + 60);
  ctx.fillStyle = '#442244';
  ctx.beginPath();
  ctx.moveTo(-100, 0);
  ctx.lineTo(-60, -20);
  ctx.lineTo(60, -20);
  ctx.lineTo(100, 0);
  ctx.lineTo(60, 15);
  ctx.lineTo(-60, 15);
  ctx.closePath();
  ctx.fill();
  // 发光核心
  const glow = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.fillStyle = `rgba(255, 85, 119, ${0.5 + glow * 0.5})`;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// === 场景 2：基地被包围 ===
function drawBaseSurrounded(ctx, w, h, t) {
  ctx.fillStyle = '#1a0a14';
  ctx.fillRect(0, 0, w, h);

  // 中心基地
  const cx = w * 0.5, cy = h * 0.55;
  ctx.save();
  ctx.translate(cx, cy);
  // 基地轮廓
  ctx.fillStyle = '#3a3a4a';
  ctx.beginPath();
  ctx.moveTo(-40, 10);
  ctx.lineTo(-40, -20);
  ctx.lineTo(40, -20);
  ctx.lineTo(40, 10);
  ctx.closePath();
  ctx.fill();
  // 能量罩
  const shield = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.strokeStyle = `rgba(102, 255, 204, ${0.4 + shield * 0.4})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 50 + shield * 3, 0, Math.PI * 2);
  ctx.stroke();
  // 灯光
  ctx.fillStyle = '#ffdd44';
  ctx.beginPath();
  ctx.arc(-20, -5, 2, 0, Math.PI * 2);
  ctx.arc(0, -5, 2, 0, Math.PI * 2);
  ctx.arc(20, -5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 周围逼近的敌人（8 个方向）
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + t * 0.2;
    const r = 120 + Math.sin(t * 2 + i) * 15;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    ctx.fillStyle = i % 2 === 0 ? '#aa3344' : '#664488';
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 7, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

// === 场景 3：星座门 ===
function drawZodiacPortal(ctx, w, h, t) {
  ctx.fillStyle = '#0a0520';
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5, cy = h * 0.5;
  // 旋转的星座环
  ctx.save();
  ctx.translate(cx, cy);
  for (let layer = 0; layer < 3; layer++) {
    const r = 40 + layer * 30;
    const rot = t * (1 + layer * 0.5) * (layer % 2 === 0 ? 1 : -1);
    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = `rgba(204, 136, 255, ${0.6 - layer * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    // 星座符号
    ctx.setLineDash([]);
    const symbols = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      ctx.fillStyle = `rgba(255, 220, 100, ${0.5 + 0.5 * Math.sin(t * 2 + i)})`;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbols[i], sx, sy);
    }
    ctx.restore();
  }
  ctx.restore();

  // 中心发光
  const glow = 0.4 + 0.6 * Math.abs(Math.sin(t * 2));
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
  grad.addColorStop(0, `rgba(255, 220, 255, ${glow})`);
  grad.addColorStop(1, 'rgba(255, 220, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.fill();
}

// === 场景 4：终局 ===
function drawFinalStand(ctx, w, h, t) {
  ctx.fillStyle = '#1a0a1a';
  ctx.fillRect(0, 0, w, h);

  // 地面
  ctx.fillStyle = '#2a1a2a';
  ctx.fillRect(0, h * 0.7, w, h * 0.3);

  // 8 个英雄剪影
  const heroes = ['#ff6644', '#ffdd55', '#aa66ff', '#74b9ff', '#27ae60', '#3a68aa', '#6a288a', '#ff2244', '#cc2233'];
  for (let i = 0; i < 9; i++) {
    const x = (i / 9) * w + 20;
    const baseY = h * 0.7;
    // 头
    ctx.fillStyle = heroes[i % heroes.length];
    ctx.beginPath();
    ctx.arc(x, baseY - 50, 12, 0, Math.PI * 2);
    ctx.fill();
    // 身体
    ctx.fillRect(x - 10, baseY - 38, 20, 35);
    // 武器/手势 - 一道光
    const beamLen = 30 + 20 * Math.sin(t * 3 + i);
    ctx.strokeStyle = heroes[i % heroes.length];
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4 + i);
    ctx.beginPath();
    ctx.moveTo(x, baseY - 20);
    ctx.lineTo(x, baseY - 20 - beamLen);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 远景母舰
  ctx.fillStyle = '#332233';
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - 80, h * 0.4);
  ctx.lineTo(w * 0.5, h * 0.3);
  ctx.lineTo(w * 0.5 + 80, h * 0.4);
  ctx.lineTo(w * 0.5 + 50, h * 0.45);
  ctx.lineTo(w * 0.5 - 50, h * 0.45);
  ctx.closePath();
  ctx.fill();
}

/**
 * 幕间插画管理器
 *  - 提供 play(container, sceneId, durationMs) 返回 Promise
 *  - 在容器中创建一个全屏 canvas + 标题/副标题
 */
export class CutsceneRenderer {
  /**
   * 播放幕间插画
   * @param {HTMLElement} container
   * @param {string} sceneId - 场景 key（fleet_approach / base_surrounded / zodiac_portal / final_stand）
   * @param {number} durationMs - 持续时间（毫秒）
   * @returns {Promise<void>}
   */
  static play(container, sceneId, durationMs = 5000) {
    const scene = SCENES[sceneId];
    if (!scene) return Promise.resolve();
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'cutscene-overlay';
      overlay.style.cssText = `
        position: absolute; inset: 0; z-index: 6000;
        background: #000; display: flex; align-items: center; justify-content: center;
        animation: cutscene-fade-in 0.4s ease-out;
      `;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(640, container.clientWidth || 800);
      canvas.height = Math.max(360, container.clientHeight || 450);
      canvas.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;';
      overlay.appendChild(canvas);

      const textLayer = document.createElement('div');
      textLayer.style.cssText = `
        position: absolute; left: 50%; bottom: 14%; transform: translateX(-50%);
        text-align: center; color: #f0e8ff; pointer-events: none; width: 90%;
      `;
      textLayer.innerHTML = `
        <div style="font-size:11px;color:#ff8855;letter-spacing:4px;margin-bottom:8px;">— INTERLUDE —</div>
        <div style="font-size:28px;font-weight:bold;letter-spacing:2px;
          text-shadow: 0 0 18px rgba(255,85,119,0.6);">${scene.title}</div>
        <div style="font-size:14px;color:#d0c0d8;margin-top:8px;font-style:italic;">${scene.subtitle}</div>
      `;
      overlay.appendChild(textLayer);

      container.appendChild(overlay);
      const ctx = canvas.getContext('2d');
      const start = performance.now();
      let raf;

      const tick = () => {
        const now = performance.now();
        const elapsed = now - start;
        const t = elapsed / 1000;
        if (elapsed >= durationMs) {
          cancelAnimationFrame(raf);
          overlay.style.opacity = '0';
          overlay.style.transition = 'opacity 0.35s ease';
          setTimeout(() => {
            overlay.remove();
            resolve();
          }, 360);
          return;
        }
        scene.draw(ctx, canvas.width, canvas.height, t);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  }

  /**
   * 根据刚刚通关的关卡决定是否播放幕间插画
   * @param {number} lastCompletedLevel - 刚刚通关的关卡 ID
   * @returns {string|null} 场景 ID 或 null
   */
  static pickSceneForLevel(lastCompletedLevel) {
    if (lastCompletedLevel === 3) return 'fleet_approach';
    if (lastCompletedLevel === 5) return 'base_surrounded';
    if (lastCompletedLevel === 6 || lastCompletedLevel === 9 || lastCompletedLevel === 12 || lastCompletedLevel === 15) {
      return 'zodiac_portal';
    }
    if (lastCompletedLevel === 17) return 'final_stand';
    return null;
  }
}
