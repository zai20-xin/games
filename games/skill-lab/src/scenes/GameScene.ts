import {
  Container,
  Graphics,
  Text,
  TextStyle,
  FederatedPointerEvent,
} from "pixi.js";
import { Character, CharacterRole } from "../character/Character";
import { SkillEffect } from "../data/effect-dimensions";
import { generateRandomEffect, describeEffect } from "../core/effect-generator";
import { renderForm, createTrailParticle, renderImpact } from "../fx/effect-renderer";
import { PALETTE_COLORS } from "../data/effect-dimensions";

const W = 960;
const H = 640;
const GROUND_Y = 500;
const PLAYER_X = 120;

interface Projectile {
  gfx: Container;
  body: Graphics;
  glow: Graphics;
  trail: Graphics[];
  effect: SkillEffect;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  pierced: Set<number>;
  chainCount: number;
}

interface Enemy {
  id: number;
  gfx: Container;
  hp: number;
  maxHp: number;
  hpBar: Graphics;
  alive: boolean;
  vx: number;
  movePattern: "linear" | "sine" | "zigzag";
  sineOffset: number;
  baseY: number;
  phase: number;
}

interface DamageNumber {
  text: Text;
  age: number;
  maxAge: number;
}

interface SavedSkill {
  id: string;
  name: string;
  effect: SkillEffect;
  createdAt: string;
}

let enemyIdCounter = 0;

export class GameScene extends Container {
  private character!: Character;
  private projectiles: Projectile[] = [];
  private enemies: Enemy[] = [];
  private damageNumbers: DamageNumber[] = [];
  private onExit: () => void;

  private currentEffect: SkillEffect | null = null;
  private fireTimer = 0;
  private fireInterval = 0.8;

  private waveNumber = 0;
  private enemiesPerWave = 3;
  private spawnTimer = 0;
  private spawnInterval = 1.2;
  private enemiesSpawnedThisWave = 0;
  private kills = 0;

  private savedSkills: SavedSkill[] = [];
  private dotAreas: { gfx: Graphics; effect: SkillEffect; age: number; maxAge: number }[] = [];

  // UI
  private skillNameText!: Text;
  private skillDetailText!: Text;
  private waveText!: Text;
  private msgText!: Text;
  private savedPanel!: Container;
  private savedItems: Container[] = [];

  constructor(role: CharacterRole, onExit: () => void) {
    super();
    this.label = "gameScene";
    this.onExit = onExit;

    this.buildArena();
    this.buildCharacter(role);
    this.buildUI();
    this.setupInput();
    this.loadSavedSkills();
    this.startWave();
  }

  // ─── 生成技能 ───────────────────────────────────────

  private generateSkill(): void {
    this.currentEffect = generateRandomEffect();
    this.updateSkillDisplay();
  }

  // ─── 场地 ───────────────────────────────────────────

  private buildArena(): void {
    const sky = new Graphics();
    sky.rect(0, 0, W, GROUND_Y);
    sky.fill({ color: 0x0f1923 });
    this.addChild(sky);

    for (let i = 0; i < 40; i++) {
      const star = new Graphics();
      star.circle(Math.random() * W, Math.random() * (GROUND_Y - 60), Math.random() * 2 + 0.5);
      star.fill({ color: 0xffffff, alpha: Math.random() * 0.5 + 0.2 });
      this.addChild(star);
    }

    const ground = new Graphics();
    ground.rect(0, GROUND_Y, W, H - GROUND_Y);
    ground.fill({ color: 0x1a1f2e });
    this.addChild(ground);

    const groundLine = new Graphics();
    groundLine.moveTo(0, GROUND_Y);
    groundLine.lineTo(W, GROUND_Y);
    groundLine.stroke({ width: 2, color: 0x2a3548 });
    this.addChild(groundLine);
  }

  private buildCharacter(role: CharacterRole): void {
    this.character = new Character(role, PLAYER_X, GROUND_Y);
    this.character.pivot.set(0, 0);
    this.addChild(this.character);
  }

  // ─── UI ─────────────────────────────────────────────

  private buildUI(): void {
    this.skillNameText = new Text({
      text: "点击【生成技能】开始",
      style: new TextStyle({
        fontSize: 20, fill: 0xe8ebf2, fontFamily: "Arial, sans-serif", fontWeight: "bold",
      }),
    });
    this.skillNameText.anchor.set(0.5, 0);
    this.skillNameText.x = W / 2;
    this.skillNameText.y = 10;
    this.addChild(this.skillNameText);

    this.skillDetailText = new Text({
      text: "",
      style: new TextStyle({
        fontSize: 12, fill: 0x8b93a7, fontFamily: "Arial, sans-serif",
        wordWrap: true, wordWrapWidth: 600,
      }),
    });
    this.skillDetailText.anchor.set(0.5, 0);
    this.skillDetailText.x = W / 2;
    this.skillDetailText.y = 36;
    this.addChild(this.skillDetailText);

    this.waveText = new Text({
      text: "",
      style: new TextStyle({ fontSize: 12, fill: 0xffca28, fontFamily: "Arial, sans-serif" }),
    });
    this.waveText.x = W - 120;
    this.waveText.y = 10;
    this.addChild(this.waveText);

    this.msgText = new Text({
      text: "",
      style: new TextStyle({ fontSize: 12, fill: 0x66bb6a, fontFamily: "Arial, sans-serif" }),
    });
    this.msgText.anchor.set(0.5, 0);
    this.msgText.x = W / 2;
    this.msgText.y = 56;
    this.addChild(this.msgText);

    // 底部按钮
    const btnY = H - 56;
    const makeBtn = (label: string, x: number, color: number, stroke: number, cb: () => void) => {
      const btn = new Container();
      btn.x = x; btn.y = btnY;
      btn.eventMode = "static"; btn.cursor = "pointer";
      const bg = new Graphics();
      bg.roundRect(0, 0, 120, 38, 8);
      bg.fill({ color }); bg.stroke({ width: 2, color: stroke });
      btn.addChild(bg);
      const t = new Text({
        text: label,
        style: new TextStyle({ fontSize: 15, fill: stroke, fontFamily: "Arial, sans-serif", fontWeight: "bold" }),
      });
      t.anchor.set(0.5, 0.5); t.x = 60; t.y = 19;
      btn.addChild(t);
      btn.on("pointerover", () => { bg.tint = 0xd0d0d0; });
      btn.on("pointerout", () => { bg.tint = 0xffffff; });
      btn.on("pointerdown", cb);
      this.addChild(btn);
    };

    makeBtn("生成技能", W / 2 - 180, 0x1e3a5f, 0x42a5f5, () => this.generateSkill());
    makeBtn("保存技能", W / 2 - 40, 0x1b5e20, 0x66bb6a, () => this.saveCurrentSkill());
    makeBtn("返回", W / 2 + 100, 0x3e2723, 0x8d6e63, () => { this.cleanup(); this.onExit(); });

    const hint = new Text({
      text: "ESC 返回  |  空格手动发射",
      style: new TextStyle({ fontSize: 11, fill: 0x555b6e, fontFamily: "Arial, sans-serif" }),
    });
    hint.anchor.set(0.5, 0);
    hint.x = W / 2;
    hint.y = H - 16;
    this.addChild(hint);

    this.buildSavedPanel();
  }

  private buildSavedPanel(): void {
    this.savedPanel = new Container();
    this.savedPanel.x = 10;
    this.savedPanel.y = 10;
    this.addChild(this.savedPanel);

    const bg = new Graphics();
    bg.roundRect(0, 0, 190, 380, 8);
    bg.fill({ color: 0x0f1320, alpha: 0.85 });
    this.savedPanel.addChild(bg);

    const title = new Text({
      text: "已保存技能",
      style: new TextStyle({ fontSize: 11, fill: 0x8b93a7, fontFamily: "Arial, sans-serif" }),
    });
    title.x = 8; title.y = 6;
    this.savedPanel.addChild(title);
  }

  private updateSavedPanel(): void {
    this.savedItems.forEach((item) => { this.savedPanel.removeChild(item); item.destroy(); });
    this.savedItems = [];

    this.savedSkills.forEach((saved, i) => {
      const item = new Container();
      item.x = 8; item.y = 24 + i * 38;
      item.eventMode = "static"; item.cursor = "pointer";

      // 背景高亮
      const itemBg = new Graphics();
      itemBg.roundRect(0, 0, 174, 32, 4);
      itemBg.fill({ color: 0x1a1f2e, alpha: 0.4 });
      item.addChild(itemBg);

      // 色点
      const c = PALETTE_COLORS[saved.effect.palette];
      const dot = new Graphics();
      dot.circle(8, 12, 4);
      dot.fill({ color: c.primary });
      item.addChild(dot);

      // 名称
      const name = new Text({
        text: saved.name.length > 11 ? saved.name.slice(0, 11) + ".." : saved.name,
        style: new TextStyle({ fontSize: 10, fill: 0xe8ebf2, fontFamily: "Arial, sans-serif" }),
      });
      name.x = 18; name.y = 2;
      item.addChild(name);

      // 伤害
      const detail = new Text({
        text: `DMG${Math.round(saved.effect.params.damage)} | ${saved.effect.params.size.toFixed(1)}x`,
        style: new TextStyle({ fontSize: 8, fill: 0x8b93a7, fontFamily: "Arial, sans-serif" }),
      });
      detail.x = 18; detail.y = 16;
      item.addChild(detail);

      // 重命名按钮 ✏️
      const renameBtn = new Container();
      renameBtn.x = 130; renameBtn.y = 8;
      renameBtn.eventMode = "static"; renameBtn.cursor = "pointer";
      const rBg = new Graphics();
      rBg.roundRect(0, 0, 18, 16, 3);
      rBg.fill({ color: 0x1e3a5f });
      renameBtn.addChild(rBg);
      const rText = new Text({
        text: "✎",
        style: new TextStyle({ fontSize: 10, fill: 0x90caf9, fontFamily: "Arial, sans-serif" }),
      });
      rText.anchor.set(0.5, 0.5); rText.x = 9; rText.y = 8;
      renameBtn.addChild(rText);
      renameBtn.on("pointerover", () => { rBg.tint = 0xd0d0d0; });
      renameBtn.on("pointerout", () => { rBg.tint = 0xffffff; });
      renameBtn.on("pointerdown", (e) => {
        e.stopPropagation();
        this.renameSkill(saved);
      });
      item.addChild(renameBtn);

      // 删除按钮 ✕
      const delBtn = new Container();
      delBtn.x = 152; delBtn.y = 8;
      delBtn.eventMode = "static"; delBtn.cursor = "pointer";
      const dBg = new Graphics();
      dBg.roundRect(0, 0, 18, 16, 3);
      dBg.fill({ color: 0x5d1f1f });
      delBtn.addChild(dBg);
      const dText = new Text({
        text: "×",
        style: new TextStyle({ fontSize: 12, fill: 0xff8a80, fontFamily: "Arial, sans-serif" }),
      });
      dText.anchor.set(0.5, 0.5); dText.x = 9; dText.y = 8;
      delBtn.addChild(dText);
      delBtn.on("pointerover", () => { dBg.tint = 0xd0d0d0; });
      delBtn.on("pointerout", () => { dBg.tint = 0xffffff; });
      delBtn.on("pointerdown", (e) => {
        e.stopPropagation();
        this.deleteSkill(saved);
      });
      item.addChild(delBtn);

      // 主体点击加载
      itemBg.eventMode = "static"; itemBg.cursor = "pointer";
      itemBg.on("pointerdown", () => {
        this.currentEffect = { ...saved.effect, params: { ...saved.effect.params } };
        this.updateSkillDisplay();
        this.showMsg(`已加载: ${saved.name}`);
      });

      this.savedItems.push(item);
      this.savedPanel.addChild(item);
    });
  }

  private async renameSkill(saved: SavedSkill): Promise<void> {
    const newName = window.prompt("重命名技能", saved.name);
    if (!newName || newName === saved.name) return;
    const trimmed = newName.trim().slice(0, 20);
    if (!trimmed) return;

    try {
      const resp = await fetch("/api/games/skill-lab/combos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saved.id, name: trimmed }),
      });
      if (resp.ok) {
        saved.name = trimmed;
        this.updateSavedPanel();
        this.showMsg(`已重命名: ${trimmed}`);
      } else {
        this.showMsg("重命名失败");
      }
    } catch {
      this.showMsg("重命名失败");
    }
  }

  private async deleteSkill(saved: SavedSkill): Promise<void> {
    if (!window.confirm(`删除技能「${saved.name}」？`)) return;

    try {
      const resp = await fetch("/api/games/skill-lab/combos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saved.id }),
      });
      if (resp.ok) {
        this.savedSkills = this.savedSkills.filter((s) => s.id !== saved.id);
        this.updateSavedPanel();
        this.showMsg(`已删除: ${saved.name}`);
      } else {
        this.showMsg("删除失败");
      }
    } catch {
      this.showMsg("删除失败");
    }
  }

  private updateSkillDisplay(): void {
    if (!this.currentEffect) {
      this.skillNameText.text = "点击【生成技能】开始";
      this.skillDetailText.text = "";
      return;
    }
    const e = this.currentEffect;
    const c = PALETTE_COLORS[e.palette];

    this.skillNameText.text = e.name;
    this.skillNameText.style.fill = c.primary;

    this.skillDetailText.text = describeEffect(e) +
      `  |  DMG ${Math.round(e.params.damage)}  速度 ${e.params.speed.toFixed(1)}  大小 ${e.params.size.toFixed(1)}`;
    this.skillDetailText.style.fill = c.secondary;

    this.waveText.text = `波次 ${this.waveNumber} | 击杀 ${this.kills}`;
  }

  private showMsg(text: string): void {
    this.msgText.text = text;
    setTimeout(() => { this.msgText.text = ""; }, 2000);
  }

  // ─── 保存/加载 ──────────────────────────────────────

  private async loadSavedSkills(): Promise<void> {
    try {
      const resp = await fetch("/api/games/skill-lab/combos");
      if (resp.ok) {
        const data = await resp.json();
        this.savedSkills = data.map((d: Record<string, unknown>) => {
          const effect = d.effect as SkillEffect | undefined;
          const skills = d.skills as SkillEffect[] | undefined;
          return {
            id: d.id as string,
            name: d.name as string,
            effect: effect ?? skills?.[0] ?? d,
            createdAt: d.createdAt as string,
          };
        });
        this.updateSavedPanel();
      }
    } catch { /* silent */ }
  }

  private async saveCurrentSkill(): Promise<void> {
    if (!this.currentEffect) { this.showMsg("先生成一个技能"); return; }
    if (this.savedSkills.length >= 8) { this.showMsg("最多保存 8 个，先删旧的"); return; }

    const saved: SavedSkill = {
      id: `skill_${Date.now()}`,
      name: this.currentEffect.name,
      effect: { ...this.currentEffect, params: { ...this.currentEffect.params } },
      createdAt: new Date().toISOString(),
    };

    try {
      const resp = await fetch("/api/games/skill-lab/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saved.id, name: saved.name, effect: saved.effect, createdAt: saved.createdAt }),
      });
      if (resp.ok) {
        this.savedSkills.push(saved);
        this.updateSavedPanel();
        this.showMsg(`已保存: ${saved.name}`);
      }
    } catch {
      this.showMsg("保存失败");
    }
  }

  // ─── 输入 ───────────────────────────────────────────

  private setupInput(): void {
    window.addEventListener("keydown", this.onKeyDown);
    this.on("pointerdown", this.onPointerDown);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Escape") { this.cleanup(); this.onExit(); return; }
    if (e.code === "Space") { e.preventDefault(); this.fire(); }
  };

  private onPointerDown = (e: FederatedPointerEvent): void => {
    if (e.global.y > H - 60) return;
    this.fire();
  };

  // ─── 敌人 ───────────────────────────────────────────

  private startWave(): void {
    this.waveNumber++;
    this.enemiesSpawnedThisWave = 0;
    this.enemiesPerWave = 3 + this.waveNumber * 2;
    this.spawnInterval = Math.max(0.4, 1.2 - this.waveNumber * 0.08);
    this.spawnTimer = 0;
    this.updateSkillDisplay();
  }

  private spawnEnemy(): void {
    const id = enemyIdCounter++;
    const y = 100 + Math.random() * (GROUND_Y - 140);
    const patterns: Enemy["movePattern"][] = ["linear", "sine", "zigzag"];
    const movePattern = patterns[Math.floor(Math.random() * patterns.length)] ?? "linear";
    const baseSpeed = 30 + this.waveNumber * 3 + Math.random() * 20;

    const gfx = new Container();
    gfx.x = W + 40; gfx.y = y;

    const tier = Math.min(Math.floor(this.waveNumber / 3), 2);
    const bodyColors = [0x5d4037, 0x4a148c, 0xb71c1c];
    const headColors = [0x6d4c41, 0x7b1fa2, 0xc62828];

    const body = new Graphics();
    body.roundRect(-14, -48, 28, 48, 4);
    body.fill({ color: bodyColors[tier] ?? 0x5d4037 });
    gfx.addChild(body);

    const head = new Graphics();
    head.circle(0, -56, 14);
    head.fill({ color: headColors[tier] ?? 0x6d4c41 });
    gfx.addChild(head);

    const eyeL = new Graphics();
    eyeL.circle(-5, -58, 3); eyeL.fill({ color: 0xff5252 });
    gfx.addChild(eyeL);

    const eyeR = new Graphics();
    eyeR.circle(5, -58, 3); eyeR.fill({ color: 0xff5252 });
    gfx.addChild(eyeR);

    const hpBg = new Graphics();
    hpBg.roundRect(-20, -76, 40, 6, 2); hpBg.fill({ color: 0x1a1a1a });
    gfx.addChild(hpBg);

    const hpBar = new Graphics();
    hpBar.roundRect(-19, -75, 38, 4, 2); hpBar.fill({ color: 0x66bb6a });
    gfx.addChild(hpBar);

    const maxHp = 40 + this.waveNumber * 10 + Math.floor(Math.random() * 20);

    this.enemies.push({
      id, gfx, hp: maxHp, maxHp, hpBar, alive: true,
      vx: -baseSpeed, movePattern, sineOffset: Math.random() * Math.PI * 2,
      baseY: y, phase: 0,
    });
    this.addChild(gfx);
  }

  private updateEnemies(dt: number): void {
    const sec = dt / 60;

    this.spawnTimer += sec;
    if (this.spawnTimer >= this.spawnInterval && this.enemiesSpawnedThisWave < this.enemiesPerWave) {
      this.spawnEnemy();
      this.enemiesSpawnedThisWave++;
      this.spawnTimer = 0;
    }

    if (this.enemiesSpawnedThisWave >= this.enemiesPerWave && this.enemies.every((e) => !e.alive)) {
      this.startWave();
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.phase += sec;

      switch (enemy.movePattern) {
        case "linear":
          enemy.gfx.x += enemy.vx * sec;
          break;
        case "sine":
          enemy.gfx.x += enemy.vx * sec;
          enemy.gfx.y = enemy.baseY + Math.sin(enemy.phase * 2 + enemy.sineOffset) * 40;
          break;
        case "zigzag":
          enemy.gfx.x += enemy.vx * sec;
          if (Math.floor(enemy.phase * 1.5) % 2 === 0) enemy.gfx.y += 30 * sec;
          else enemy.gfx.y -= 30 * sec;
          enemy.gfx.y = Math.max(80, Math.min(GROUND_Y - 20, enemy.gfx.y));
          break;
      }

      if (enemy.gfx.x < -30) {
        enemy.alive = false;
        this.removeChild(enemy.gfx);
        enemy.gfx.destroy();
      }
    }

    this.enemies = this.enemies.filter((e) => e.alive || e.gfx.parent);
  }

  // ─── 发射 ───────────────────────────────────────────

  private findNearestEnemy(): Enemy | null {
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.gfx.x - PLAYER_X, e.gfx.y - GROUND_Y);
      if (d < closestDist) { closestDist = d; closest = e; }
    }
    return closest;
  }

  private fire(): void {
    if (!this.currentEffect) return;
    const target = this.findNearestEnemy();
    const aimAngle = target
      ? Math.atan2(target.gfx.y - (GROUND_Y - 30), target.gfx.x - (PLAYER_X + 30))
      : 0;
    this.fireProjectile(this.currentEffect, aimAngle);
  }

  private fireProjectile(effect: SkillEffect, aimAngle: number): void {
    this.character.playShoot();

    const startX = PLAYER_X + 30;
    const startY = GROUND_Y - 30;
    const c = PALETTE_COLORS[effect.palette];

    // 用 renderer 渲染弹体
    const { body, glow } = renderForm(effect);

    const projectileGfx = new Container();
    projectileGfx.x = startX;
    projectileGfx.y = startY;
    projectileGfx.addChild(glow);
    projectileGfx.addChild(body);
    this.addChild(projectileGfx);

    // 速度
    const baseSpeed = effect.params.speed * 40;
    let vx = Math.cos(aimAngle) * baseSpeed;
    let vy = Math.sin(aimAngle) * baseSpeed;

    // 弹道特殊处理
    if (effect.trajectory === "homing" || effect.trajectory === "wave") {
      const jitter = 0.3;
      vx = Math.cos(aimAngle + (Math.random() - 0.5) * jitter) * baseSpeed;
      vy = Math.sin(aimAngle + (Math.random() - 0.5) * jitter) * baseSpeed;
    }
    if (effect.trajectory === "bounce") {
      vx = baseSpeed * 0.8;
      vy = (Math.random() - 0.5) * 80;
    }
    if (effect.trajectory === "return") {
      vx = baseSpeed * 0.7;
      vy = (Math.random() - 0.5) * 60;
    }
    if (effect.trajectory === "rain") {
      vx = baseSpeed * 0.5;
      vy = -200 - Math.random() * 100;
    }
    if (effect.trajectory === "ground") {
      vx = baseSpeed * 0.6;
      vy = 0;
    }
    if (effect.trajectory === "spiral") {
      vx = baseSpeed * 0.7;
      vy = 0;
    }
    if (effect.form === "beam") {
      vx = baseSpeed * 2;
      vy = 0;
    }
    if (effect.form === "column") {
      vx = 0;
      vy = 0;
      projectileGfx.x = startX + 100 + Math.random() * 200;
      projectileGfx.y = -30;
    }
    if (effect.form === "nova") {
      vx = 0; vy = 0;
    }

    this.projectiles.push({
      gfx: projectileGfx, body, glow, trail: [],
      effect, vx, vy, age: 0, maxAge: effect.params.duration,
      pierced: new Set(), chainCount: 0,
    });
  }

  // ─── 碰撞 ───────────────────────────────────────────

  private checkCollisions(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj) continue;

      const onHit = proj.effect.onHit;
      const isPierce = onHit === "pierce";
      const isChain = onHit === "chain";
      const isAOE = onHit === "explode";
      const isSlow = onHit === "slow";
      const isKnockback = onHit === "knockback";
      const isSplit = onHit === "split";
      const isDot = onHit === "dot";

      for (const enemy of this.enemies) {
        if (!enemy.alive || proj.pierced.has(enemy.id)) continue;

        const dx = proj.gfx.x - enemy.gfx.x;
        const dy = proj.gfx.y - (enemy.gfx.y - 30);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 30 * proj.effect.params.size) {
          const isCrit = Math.random() < 0.2;
          const damage = Math.round(proj.effect.params.damage * (isCrit ? 2 : 1));

          this.damageEnemy(enemy, damage, isCrit);

          // 命中特效
          if (proj.effect.impact !== "none") {
            const impactFx = renderImpact(proj.effect, enemy.gfx.x, enemy.gfx.y - 30);
            this.addChild(impactFx);
          }

          // AOE 范围伤害
          if (isAOE) {
            const aoeR = proj.effect.params.aoeRadius;
            for (const other of this.enemies) {
              if (!other.alive || other.id === enemy.id) continue;
              const od = Math.hypot(other.gfx.x - enemy.gfx.x, other.gfx.y - enemy.gfx.y);
              if (od < aoeR) {
                const aoeDmg = Math.round(damage * (1 - od / aoeR) * 0.6);
                if (aoeDmg > 0) this.damageEnemy(other, aoeDmg, false);
              }
            }
          }

          // 连锁
          if (isChain && proj.chainCount < proj.effect.params.chainCount) {
            this.chainToNearby(enemy, proj.effect, proj.chainCount);
            proj.chainCount++;
          }

          // 分裂
          if (isSplit) {
            const splits = proj.effect.params.splitCount;
            for (let s = 0; s < splits; s++) {
              const splitAngle = aimAtEnemy(enemy) + (Math.random() - 0.5) * 1.5;
              this.fireProjectile(proj.effect, splitAngle);
            }
          }

          // 持续伤害区域
          if (isDot) {
            this.spawnDotArea(enemy.gfx.x, enemy.gfx.y, proj.effect);
          }

          // 减速
          if (isSlow) {
            enemy.vx *= 0.3;
            setTimeout(() => { enemy.vx *= 3.3; }, 2000);
          }

          // 击退
          if (isKnockback) {
            enemy.gfx.x += 60;
          }

          if (isPierce) {
            proj.pierced.add(enemy.id);
            proj.body.alpha = 0.5;
            setTimeout(() => { proj.body.alpha = 1; }, 100);
          } else if (!isAOE) {
            this.removeProjectile(i);
            break;
          }
        }
      }
    }
  }

  private chainToNearby(source: Enemy, effect: SkillEffect, depth: number): void {
    if (depth >= effect.params.chainCount) return;
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.gfx.x - source.gfx.x, e.gfx.y - source.gfx.y);
      if (d < closestDist && d < 200) { closestDist = d; closest = e; }
    }
    if (closest) {
      this.damageEnemy(closest, Math.round(effect.params.damage * 0.7), false);
      // 电弧特效
      if (effect.impact !== "none") {
        const arcFx = renderImpact(effect, closest.gfx.x, closest.gfx.y - 30);
        this.addChild(arcFx);
      }
      this.chainToNearby(closest, effect, depth + 1);
    }
  }

  private spawnDotArea(x: number, y: number, effect: SkillEffect): void {
    const c = PALETTE_COLORS[effect.palette];
    const r = effect.params.aoeRadius;
    const area = new Graphics();
    area.circle(0, 0, r);
    area.fill({ color: c.primary, alpha: 0.2 });
    area.x = x; area.y = y - 30;
    this.addChild(area);
    this.dotAreas.push({ gfx: area, effect, age: 0, maxAge: effect.params.duration });

    // 每0.5秒伤害一次
    const tickDmg = () => {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(enemy.gfx.x - x, enemy.gfx.y - y);
        if (d < r) this.damageEnemy(enemy, Math.round(effect.params.damage * 0.15), false);
      }
    };
    const interval = setInterval(tickDmg, 500);
    setTimeout(() => clearInterval(interval), effect.params.duration * 1000);
  }

  private damageEnemy(enemy: Enemy, damage: number, isCrit: boolean): void {
    enemy.hp -= damage;
    this.spawnDamageNumber(enemy.gfx.x, enemy.gfx.y - 80, damage, isCrit);

    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.hpBar.clear();
    enemy.hpBar.roundRect(-19, -75, 38 * hpRatio, 4, 2);
    enemy.hpBar.fill({ color: hpRatio > 0.5 ? 0x66bb6a : hpRatio > 0.25 ? 0xffca28 : 0xff5252 });

    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.kills++;
      this.waveText.text = `波次 ${this.waveNumber} | 击杀 ${this.kills}`;
      let fadeAge = 0;
      const tickFade = () => {
        fadeAge++;
        enemy.gfx.alpha -= 0.05;
        enemy.gfx.scale.set(1 + fadeAge * 0.02);
        if (enemy.gfx.alpha > 0) requestAnimationFrame(tickFade);
        else { this.removeChild(enemy.gfx); enemy.gfx.destroy(); }
      };
      requestAnimationFrame(tickFade);
    }
  }

  private spawnDamageNumber(x: number, y: number, damage: number, critical: boolean): void {
    const text = new Text({
      text: `-${damage}`,
      style: new TextStyle({
        fontSize: critical ? 22 : 16,
        fill: critical ? 0xffca28 : 0xff5252,
        fontFamily: "Arial, sans-serif",
        fontWeight: "bold",
      }),
    });
    text.anchor.set(0.5, 0.5);
    text.x = x; text.y = y;
    this.addChild(text);
    this.damageNumbers.push({ text, age: 0, maxAge: 1 });
  }

  private removeProjectile(index: number): void {
    const proj = this.projectiles[index];
    if (!proj) return;
    this.removeChild(proj.gfx);
    proj.gfx.destroy();
    proj.trail.forEach((t) => { this.removeChild(t); t.destroy(); });
    this.projectiles.splice(index, 1);
  }

  private cleanup(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.projectiles.forEach((p) => { this.removeChild(p.gfx); p.gfx.destroy(); });
    this.projectiles = [];
    this.enemies.forEach((e) => { if (e.gfx.parent) this.removeChild(e.gfx); e.gfx.destroy(); });
    this.enemies = [];
    this.dotAreas.forEach((a) => { this.removeChild(a.gfx); a.gfx.destroy(); });
    this.dotAreas = [];
  }

  // ─── 主循环 ─────────────────────────────────────────

  update(dt: number): void {
    this.character?.update(dt);
    this.updateEnemies(dt);

    // 自动发射
    if (this.currentEffect) {
      this.fireTimer += dt / 60;
      if (this.fireTimer >= this.fireInterval) {
        this.fireTimer = 0;
        this.fire();
      }
    }

    const sec = dt / 60;

    // 弹体
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj || !proj.gfx.parent) { this.projectiles.splice(i, 1); continue; }
      const fx = proj.effect;
      proj.age += sec;

      // 弹道更新
      switch (fx.trajectory) {
        case "straight":
          proj.gfx.x += proj.vx * sec;
          proj.gfx.y += proj.vy * sec;
          break;
        case "homing": {
          let closest: Enemy | null = null;
          let closestDist = Infinity;
          for (const e of this.enemies) {
            if (!e.alive || proj.pierced.has(e.id)) continue;
            const d = Math.hypot(e.gfx.x - proj.gfx.x, e.gfx.y - proj.gfx.y);
            if (d < closestDist) { closestDist = d; closest = e; }
          }
          if (closest && closestDist < 600) {
            const angle = Math.atan2(closest.gfx.y - proj.gfx.y, closest.gfx.x - proj.gfx.x);
            proj.vx += Math.cos(angle) * 200 * sec;
            proj.vy += Math.sin(angle) * 200 * sec;
          }
          proj.gfx.x += proj.vx * sec;
          proj.gfx.y += proj.vy * sec;
          break;
        }
        case "wave":
          proj.gfx.x += proj.vx * sec;
          proj.gfx.y += Math.sin(proj.age * fx.params.waveFreq * 6) * fx.params.waveAmp * sec;
          break;
        case "bounce":
          proj.gfx.x += proj.vx * sec;
          proj.gfx.y += proj.vy * sec;
          if (proj.gfx.y < 60 || proj.gfx.y > GROUND_Y - 20) proj.vy *= -1;
          break;
        case "spiral":
          proj.gfx.x += proj.vx * sec;
          proj.gfx.y = GROUND_Y - 30 + Math.sin(proj.age * 4) * 60;
          proj.body.rotation += fx.params.rotationSpeed;
          break;
        case "ground":
          proj.gfx.x += proj.vx * sec;
          proj.gfx.y = GROUND_Y - 30;
          break;
        case "rain":
          proj.gfx.x += proj.vx * sec;
          proj.gfx.y += proj.vy * sec;
          proj.vy += 400 * sec;
          break;
        case "return": {
          const dist = proj.age < fx.params.duration / 2
            ? proj.vx * sec
            : -proj.vx * sec;
          proj.gfx.x += dist;
          proj.gfx.y += Math.sin(proj.age * 3) * 30 * sec;
          break;
        }
      }

      // 碰撞检测（非固定形态的弹道才做碰撞）
      const isStationary = fx.form === "beam" || fx.form === "column" || fx.form === "nova";
      if (!isStationary) {
        this.checkCollisions();
      }

      // checkCollisions 可能已销毁该弹体
      if (!proj.gfx.parent) continue;

      // 形态自转
      if (fx.form === "bolt") proj.body.rotation += 0.05;

      // 尾迹
      if (fx.trail !== "none" && proj.age > 0.03 && proj.trail.length < fx.params.trailLength) {
        const t = createTrailParticle(fx, proj.gfx.x, proj.gfx.y);
        this.addChild(t);
        proj.trail.push(t);
      }
      proj.trail.forEach((t, ti) => {
        t.alpha -= 0.04;
        if (t.alpha <= 0) { this.removeChild(t); t.destroy(); proj.trail.splice(ti, 1); }
      });

      // 超时 / 越界
      if (proj.gfx.x > W + 50 || proj.gfx.x < -50 || proj.age > proj.maxAge)
        this.removeProjectile(i);
    }

    // DOT 区域
    for (let i = this.dotAreas.length - 1; i >= 0; i--) {
      const a = this.dotAreas[i];
      if (!a) continue;
      a.age += sec;
      a.gfx.alpha = 0.2 * (1 - a.age / a.maxAge);
      if (a.age >= a.maxAge) {
        this.removeChild(a.gfx);
        a.gfx.destroy();
        this.dotAreas.splice(i, 1);
      }
    }

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      if (!dn) continue;
      dn.age += sec;
      dn.text.y -= 1.5;
      dn.text.alpha = 1 - dn.age / dn.maxAge;
      if (dn.age >= dn.maxAge) { this.removeChild(dn.text); dn.text.destroy(); this.damageNumbers.splice(i, 1); }
    }
  }
}

function aimAtEnemy(enemy: Enemy): number {
  return Math.atan2(enemy.gfx.y - (GROUND_Y - 30), enemy.gfx.x - (PLAYER_X + 30));
}
