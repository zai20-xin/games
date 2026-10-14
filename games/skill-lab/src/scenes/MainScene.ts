import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { CharacterManager } from "../character/CharacterManager";
import { CharacterRole } from "../character/Character";

const W = 960;
const H = 640;
const BG_COLOR = 0x0a0e1a;
const TEXT_COLOR = 0xe8ebf2;
const PANEL_COLOR = 0x141824;

export class MainScene extends Container {
  private characterManager!: CharacterManager;
  private currentRole: CharacterRole = "scientist";
  private onEnterArena: (() => void) | null = null;

  setOnEnterArena(cb: () => void): void {
    this.onEnterArena = cb;
  }

  getCurrentRole(): CharacterRole {
    return this.currentRole;
  }

  constructor() {
    super();
    this.label = "mainScene";
    this.buildLayout();
    this.buildCharacterPreview();
    this.buildRoleSelector();
    this.buildEnterButton();
  }

  private buildLayout(): void {
    const bg = new Graphics();
    bg.rect(0, 0, W, H);
    bg.fill({ color: BG_COLOR });
    this.addChild(bg);

    const title = new Text({
      text: "技能实验室",
      style: new TextStyle({
        fontSize: 32, fill: TEXT_COLOR, fontFamily: "Arial, sans-serif", fontWeight: "bold",
      }),
    });
    title.anchor.set(0.5, 0);
    title.x = W / 2;
    title.y = 30;
    this.addChild(title);

    const subtitle = new Text({
      text: "选择实验员，进入试验场测试技能组合",
      style: new TextStyle({ fontSize: 14, fill: 0x8b93a7, fontFamily: "Arial, sans-serif" }),
    });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = W / 2;
    subtitle.y = 70;
    this.addChild(subtitle);
  }

  private buildCharacterPreview(): void {
    const previewArea = new Container();
    previewArea.x = W / 2;
    previewArea.y = 260;
    this.addChild(previewArea);

    this.characterManager = new CharacterManager(previewArea, 0, 60);
  }

  private buildRoleSelector(): void {
    const roles: { role: CharacterRole; label: string; color: number; desc: string }[] = [
      { role: "scientist", label: "实验员", color: 0xf5f5f5, desc: "均衡型" },
      { role: "warrior", label: "战士", color: 0x9e9e9e, desc: "高血量" },
      { role: "mage", label: "法师", color: 0x42a5f5, desc: "高伤害" },
      { role: "assassin", label: "刺客", color: 0x212121, desc: "高暴击" },
    ];

    const selector = new Container();
    selector.x = W / 2 - 200;
    selector.y = 380;
    this.addChild(selector);

    const label = new Text({
      text: "选择形象",
      style: new TextStyle({ fontSize: 13, fill: 0x8b93a7, fontFamily: "Arial, sans-serif" }),
    });
    label.anchor.set(0.5, 0);
    label.x = 200;
    selector.addChild(label);

    roles.forEach((r, i) => {
      const btn = new Container();
      btn.x = i * 105;
      btn.y = 28;
      btn.eventMode = "static";
      btn.cursor = "pointer";

      const bg = new Graphics();
      bg.roundRect(0, 0, 95, 70, 8);
      bg.fill({ color: PANEL_COLOR });
      bg.stroke({ width: 1, color: 0x2a3548 });
      btn.addChild(bg);

      const dot = new Graphics();
      dot.circle(47, 22, 12);
      dot.fill({ color: r.color });
      btn.addChild(dot);

      const name = new Text({
        text: r.label,
        style: new TextStyle({ fontSize: 13, fill: TEXT_COLOR, fontFamily: "Arial, sans-serif", fontWeight: "bold" }),
      });
      name.anchor.set(0.5, 0);
      name.x = 47;
      name.y = 40;
      btn.addChild(name);

      const desc = new Text({
        text: r.desc,
        style: new TextStyle({ fontSize: 10, fill: 0x8b93a7, fontFamily: "Arial, sans-serif" }),
      });
      desc.anchor.set(0.5, 0);
      desc.x = 47;
      desc.y = 55;
      btn.addChild(desc);

      btn.on("pointerdown", () => {
        this.currentRole = r.role;
        this.characterManager.switchTo(r.role);
        this.highlightRole(selector, i, roles.length);
      });

      btn.on("pointerover", () => {
        bg.tint = 0xd0d0d0;
      });
      btn.on("pointerout", () => {
        bg.tint = 0xffffff;
      });

      selector.addChild(btn);
    });
  }

  private highlightRole(parent: Container, selected: number, total: number): void {
    for (let i = 0; i < total; i++) {
      const btn = parent.children[i + 1];
      if (!btn) continue;
      const bg = btn.children[0] as Graphics;
      if (!bg) continue;
      bg.clear();
      bg.roundRect(0, 0, 95, 70, 8);
      if (i === selected) {
        bg.fill({ color: 0x1e3a5f });
        bg.stroke({ width: 2, color: 0x42a5f5 });
      } else {
        bg.fill({ color: PANEL_COLOR });
        bg.stroke({ width: 1, color: 0x2a3548 });
      }
    }
  }

  private buildEnterButton(): void {
    const btn = new Container();
    btn.x = W / 2 - 90;
    btn.y = H - 80;
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    bg.roundRect(0, 0, 180, 44, 10);
    bg.fill({ color: 0x1e3a5f });
    bg.stroke({ width: 2, color: 0x42a5f5 });
    btn.addChild(bg);

    const text = new Text({
      text: "进入试验场",
      style: new TextStyle({ fontSize: 18, fill: 0x42a5f5, fontFamily: "Arial, sans-serif", fontWeight: "bold" }),
    });
    text.anchor.set(0.5, 0.5);
    text.x = 90;
    text.y = 22;
    btn.addChild(text);

    btn.on("pointerover", () => {
      bg.clear();
      bg.roundRect(0, 0, 180, 44, 10);
      bg.fill({ color: 0x2a5080 });
      bg.stroke({ width: 2, color: 0x64b5f6 });
    });
    btn.on("pointerout", () => {
      bg.clear();
      bg.roundRect(0, 0, 180, 44, 10);
      bg.fill({ color: 0x1e3a5f });
      bg.stroke({ width: 2, color: 0x42a5f5 });
    });
    btn.on("pointerdown", () => {
      this.onEnterArena?.();
    });

    this.addChild(btn);
  }

  update(dt: number): void {
    this.characterManager.update(dt);
  }
}
