import { Container, Graphics } from "pixi.js";
import { SkillEffect, PALETTE_COLORS } from "../data/effect-dimensions";

// ─── 渲染弹体形态 ────────────────────────────────────

export function renderForm(effect: SkillEffect): { body: Graphics; glow: Graphics } {
  const body = new Graphics();
  const glow = new Graphics();
  const c = PALETTE_COLORS[effect.palette];
  const s = effect.params.size;

  switch (effect.form) {
    case "arrow": {
      const w = 18 * s, h = 5 * s;
      body.moveTo(w + 2, 0); body.lineTo(0, -h); body.lineTo(-w, 0); body.lineTo(0, h); body.closePath();
      body.fill({ color: c.primary });
      body.moveTo(w + 4, 0); body.lineTo(w - 2, -h * 0.4); body.lineTo(w - 2, h * 0.4); body.closePath();
      body.fill({ color: c.highlight });
      glow.circle(0, 0, 14 * s); glow.fill({ color: c.glow, alpha: 0.25 });
      break;
    }
    case "orb": {
      const r = 8 * s;
      body.circle(0, 0, r); body.fill({ color: c.primary });
      body.circle(0, 0, r * 0.6); body.fill({ color: c.secondary });
      body.circle(0, 0, r * 0.3); body.fill({ color: c.highlight, alpha: 0.7 });
      glow.circle(0, 0, r * 2); glow.fill({ color: c.glow, alpha: 0.3 });
      break;
    }
    case "bolt": {
      const segs = 3 + Math.floor(Math.random() * 3);
      body.moveTo(-8 * s, 0);
      for (let j = 0; j < segs; j++) {
        const t = (j + 1) / (segs + 1);
        body.lineTo(-8 * s + 16 * s * t + (Math.random() - 0.5) * 8 * s, (Math.random() - 0.5) * 8 * s);
      }
      body.lineTo(8 * s, 0);
      body.stroke({ width: 2 + Math.random() * 2, color: c.primary });
      // 内核
      body.moveTo(-4 * s, 0); body.lineTo(4 * s, 0);
      body.stroke({ width: 1, color: c.highlight, alpha: 0.8 });
      glow.circle(0, 0, 10 * s); glow.fill({ color: c.glow, alpha: 0.35 });
      break;
    }
    case "beam": {
      const len = 40 * s;
      body.moveTo(0, -3 * s); body.lineTo(len, -1 * s); body.lineTo(len, 1 * s); body.lineTo(0, 3 * s); body.closePath();
      body.fill({ color: c.primary, alpha: 0.8 });
      body.moveTo(0, -1 * s); body.lineTo(len, 0); body.lineTo(0, 1 * s); body.closePath();
      body.fill({ color: c.highlight, alpha: 0.5 });
      glow.rect(-2, -6 * s, len + 4, 12 * s);
      glow.fill({ color: c.glow, alpha: 0.15 });
      break;
    }
    case "waveform": {
      // 扇形冲击波
      const r = 20 * s;
      body.arc(0, 0, r, -0.4, 0.4); body.lineTo(0, 0); body.closePath();
      body.fill({ color: c.primary, alpha: 0.6 });
      body.arc(0, 0, r * 0.7, -0.3, 0.3); body.lineTo(0, 0); body.closePath();
      body.fill({ color: c.secondary, alpha: 0.4 });
      glow.arc(0, 0, r * 1.3, -0.5, 0.5); glow.lineTo(0, 0); glow.closePath();
      glow.fill({ color: c.glow, alpha: 0.15 });
      break;
    }
    case "spray": {
      const count = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const a = (Math.random() - 0.5) * 1.2;
        const d = 6 + Math.random() * 12;
        const pr = 1 + Math.random() * 2;
        body.circle(Math.cos(a) * d * s, Math.sin(a) * d * s, pr * s);
        body.fill({ color: i % 2 === 0 ? c.primary : c.secondary, alpha: 0.7 + Math.random() * 0.3 });
      }
      glow.circle(0, 0, 12 * s); glow.fill({ color: c.glow, alpha: 0.2 });
      break;
    }
    case "nova": {
      const r = 12 * s;
      body.circle(0, 0, r); body.stroke({ width: 2, color: c.primary });
      body.circle(0, 0, r * 0.7); body.stroke({ width: 1.5, color: c.secondary, alpha: 0.6 });
      body.circle(0, 0, r * 0.4); body.fill({ color: c.highlight, alpha: 0.4 });
      glow.circle(0, 0, r * 1.5); glow.fill({ color: c.glow, alpha: 0.2 });
      break;
    }
    case "column": {
      const w = 8 * s, h = 30 * s;
      body.rect(-w / 2, -h, w, h); body.fill({ color: c.primary, alpha: 0.6 });
      body.rect(-w / 4, -h, w / 2, h); body.fill({ color: c.secondary, alpha: 0.4 });
      body.rect(-w / 8, -h, w / 4, h); body.fill({ color: c.highlight, alpha: 0.3 });
      glow.rect(-w, -h - 4, w * 2, h + 8);
      glow.fill({ color: c.glow, alpha: 0.1 });
      break;
    }
    default: {
      body.circle(0, 0, 6 * s); body.fill({ color: c.primary });
      glow.circle(0, 0, 10 * s); glow.fill({ color: c.glow, alpha: 0.3 });
    }
  }

  return { body, glow };
}

// ─── 渲染尾迹粒子 ────────────────────────────────────

export function createTrailParticle(effect: SkillEffect, x: number, y: number): Graphics {
  const c = PALETTE_COLORS[effect.palette];
  const g = new Graphics();
  const s = effect.params.size;

  switch (effect.trail) {
    case "glow": {
      const r = (2 + Math.random() * 3) * s;
      g.circle(0, 0, r);
      g.fill({ color: c.trail, alpha: 0.3 + Math.random() * 0.3 });
      break;
    }
    case "smoke": {
      const r = (3 + Math.random() * 4) * s;
      g.circle(0, 0, r);
      g.fill({ color: 0x555555, alpha: 0.2 + Math.random() * 0.2 });
      break;
    }
    case "spark": {
      const r = (1 + Math.random() * 2) * s;
      g.circle(0, 0, r);
      g.fill({ color: Math.random() > 0.3 ? c.highlight : c.primary, alpha: 0.6 + Math.random() * 0.4 });
      break;
    }
    case "ribbon": {
      const w = (3 + Math.random() * 3) * s;
      const h = (1 + Math.random()) * s;
      g.rect(-w / 2, -h / 2, w, h);
      g.fill({ color: c.trail, alpha: 0.3 + Math.random() * 0.2 });
      break;
    }
    default: {
      g.circle(0, 0, 2);
      g.fill({ color: c.trail, alpha: 0.1 });
    }
  }

  g.x = x;
  g.y = y;
  return g;
}

// ─── 渲染命中特效 ────────────────────────────────────

export function renderImpact(effect: SkillEffect, x: number, y: number): Container {
  const container = new Container();
  container.x = x;
  container.y = y;
  const c = PALETTE_COLORS[effect.palette];
  const s = effect.params.size;

  switch (effect.impact) {
    case "burst": {
      // 冲击波环
      const ring = new Graphics();
      ring.circle(0, 0, 10);
      ring.stroke({ width: 3, color: c.primary });
      container.addChild(ring);
      // 碎片
      const count = effect.params.burstCount;
      for (let i = 0; i < count; i++) {
        const frag = new Graphics();
        const sz = (2 + Math.random() * 4) * s;
        frag.rect(-sz / 2, -sz / 2, sz, sz);
        frag.fill({ color: i % 3 === 0 ? c.primary : i % 3 === 1 ? c.secondary : c.highlight });
        container.addChild(frag);
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 200;
        animateFrag(frag, Math.cos(angle) * speed, Math.sin(angle) * speed - 40);
      }
      animateRing(ring);
      break;
    }
    case "shatter": {
      const count = effect.params.burstCount;
      for (let i = 0; i < count; i++) {
        const shard = new Graphics();
        const sz = (3 + Math.random() * 5) * s;
        shard.moveTo(0, -sz);
        shard.lineTo(sz * 0.6, sz * 0.3);
        shard.lineTo(-sz * 0.6, sz * 0.3);
        shard.closePath();
        shard.fill({ color: i % 2 === 0 ? c.primary : c.highlight, alpha: 0.8 });
        container.addChild(shard);
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 150;
        animateFrag(shard, Math.cos(angle) * speed, Math.sin(angle) * speed - 30);
      }
      break;
    }
    case "melt": {
      const drop = new Graphics();
      drop.circle(0, 0, 8 * s);
      drop.fill({ color: c.primary, alpha: 0.7 });
      container.addChild(drop);
      let age = 0;
      const tick = () => {
        age++;
        drop.y += 2;
        drop.scale.y = 1 + age * 0.05;
        drop.alpha -= 0.03;
        if (drop.alpha > 0) requestAnimationFrame(tick);
        else container.destroy();
      };
      requestAnimationFrame(tick);
      break;
    }
    case "arc": {
      const bolt = new Graphics();
      const segs = 5 + Math.floor(Math.random() * 4);
      bolt.moveTo(0, 0);
      for (let j = 1; j < segs; j++) {
        const t = j / segs;
        bolt.lineTo((Math.random() - 0.5) * 40 * s, (Math.random() - 0.5) * 40 * s);
      }
      bolt.stroke({ width: 2, color: c.primary });
      bolt.moveTo(0, 0);
      for (let j = 1; j < segs; j++) {
        bolt.lineTo((Math.random() - 0.5) * 20 * s, (Math.random() - 0.5) * 20 * s);
      }
      bolt.stroke({ width: 1, color: c.highlight, alpha: 0.7 });
      container.addChild(bolt);
      let age = 0;
      const tick = () => {
        age++;
        bolt.alpha = 1 - age / 15;
        if (bolt.alpha > 0) requestAnimationFrame(tick);
        else container.destroy();
      };
      requestAnimationFrame(tick);
      break;
    }
    case "ripple": {
      const ring = new Graphics();
      ring.circle(0, 0, 5);
      ring.stroke({ width: 2, color: c.primary });
      container.addChild(ring);
      let age = 0;
      const tick = () => {
        age++;
        ring.scale.set(1 + age * 0.15);
        ring.alpha -= 0.04;
        if (ring.alpha > 0) requestAnimationFrame(tick);
        else container.destroy();
      };
      requestAnimationFrame(tick);
      break;
    }
    default:
      break;
  }

  return container;
}

// ─── 动画辅助 ────────────────────────────────────────

function animateRing(ring: Graphics): void {
  let age = 0;
  const tick = () => {
    age++;
    ring.scale.set(1 + age * 0.12);
    ring.alpha -= 0.035;
    if (ring.alpha > 0) requestAnimationFrame(tick);
    else ring.destroy();
  };
  requestAnimationFrame(tick);
}

function animateFrag(frag: Graphics, vx: number, vy: number): void {
  let age = 0;
  const tick = () => {
    age++;
    frag.x += vx * 0.016;
    frag.y += vy * 0.016 + age * 0.5;
    frag.rotation += 0.1;
    frag.alpha -= 0.025;
    if (frag.alpha > 0) requestAnimationFrame(tick);
    else frag.destroy();
  };
  requestAnimationFrame(tick);
}
