import { Container, Graphics } from "pixi.js";

export type CharacterRole = "scientist" | "warrior" | "mage" | "assassin";
export type CharacterState = "idle" | "shoot" | "throw";

interface RoleVisual {
  headColor: number;
  bodyColor: number;
  bodyShape: "triangle" | "square";
  accessory: "none" | "shield" | "staff" | "blades";
}

const ROLE_VISUALS: Record<CharacterRole, RoleVisual> = {
  scientist: {
    headColor: 0xf5f5f5,
    bodyColor: 0xf5f5f5,
    bodyShape: "triangle",
    accessory: "none",
  },
  warrior: {
    headColor: 0x9e9e9e,
    bodyColor: 0x795548,
    bodyShape: "square",
    accessory: "shield",
  },
  mage: {
    headColor: 0x42a5f5,
    bodyColor: 0x7e57c2,
    bodyShape: "triangle",
    accessory: "staff",
  },
  assassin: {
    headColor: 0x212121,
    bodyColor: 0xc62828,
    bodyShape: "triangle",
    accessory: "blades",
  },
};

const ROLE_NAMES: Record<CharacterRole, string> = {
  scientist: "实验员",
  warrior: "战士",
  mage: "法师",
  assassin: "刺客",
};

export class Character extends Container {
  readonly role: CharacterRole;
  private state: CharacterState = "idle";
  private graphics!: Container;
  private head!: Graphics;
  private body!: Graphics;
  private accessory!: Graphics;
  private leftArm!: Graphics;
  private rightArm!: Graphics;
  private baseY: number = 0;
  private animTime: number = 0;
  private animDuration: number = 0;
  private animCallback: (() => void) | null = null;
  private idleAmplitude: number = 3;
  private idleSpeed: number = 2;

  constructor(role: CharacterRole, x: number = 0, y: number = 0) {
    super();
    this.role = role;
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.label = `char_${role}`;
    this.buildVisual();
    this.pivot.set(0, 40);
  }

  private buildVisual(): void {
    const visual = ROLE_VISUALS[this.role];

    this.graphics = new Container();
    this.addChild(this.graphics);

    this.body = new Graphics();
    this.head = new Graphics();
    this.accessory = new Graphics();
    this.leftArm = new Graphics();
    this.rightArm = new Graphics();

    this.graphics.addChild(this.body);
    this.graphics.addChild(this.leftArm);
    this.graphics.addChild(this.rightArm);
    this.graphics.addChild(this.head);
    this.graphics.addChild(this.accessory);

    this.drawHead(visual);
    this.drawBody(visual);
    this.drawAccessory(visual);
    this.drawArms(visual);
  }

  private drawHead(v: RoleVisual): void {
    this.head.clear();
    this.head.circle(0, -20, 14);
    this.head.fill({ color: v.headColor });
  }

  private drawBody(v: RoleVisual): void {
    this.body.clear();
    if (v.bodyShape === "triangle") {
      this.body.moveTo(0, -6);
      this.body.lineTo(-16, 22);
      this.body.lineTo(16, 22);
      this.body.closePath();
      this.body.fill({ color: v.bodyColor });
    } else {
      this.body.roundRect(-14, -6, 28, 28, 4);
      this.body.fill({ color: v.bodyColor });
    }
  }

  private drawAccessory(v: RoleVisual): void {
    this.accessory.clear();
    switch (v.accessory) {
      case "shield":
        this.accessory.roundRect(-22, -2, 10, 14, 2);
        this.accessory.fill({ color: 0xbdbdbd });
        this.accessory.stroke({ width: 1, color: 0x90a4ae });
        break;
      case "staff":
        this.accessory.rect(16, -28, 3, 40);
        this.accessory.fill({ color: 0x8d6e63 });
        this.accessory.circle(17.5, -30, 5);
        this.accessory.fill({ color: 0x42a5f5 });
        break;
      case "blades":
        this.accessory.moveTo(-20, 8);
        this.accessory.lineTo(-26, -10);
        this.accessory.lineTo(-24, -12);
        this.accessory.lineTo(-18, 6);
        this.accessory.closePath();
        this.accessory.fill({ color: 0xcfd8dc });
        this.accessory.moveTo(20, 8);
        this.accessory.lineTo(26, -10);
        this.accessory.lineTo(24, -12);
        this.accessory.lineTo(18, 6);
        this.accessory.closePath();
        this.accessory.fill({ color: 0xcfd8dc });
        break;
      default:
        break;
    }
  }

  private drawArms(v: RoleVisual): void {
    const armColor = v.bodyShape === "square" ? 0x795548 : 0xe0e0e0;
    this.leftArm.clear();
    this.leftArm.rect(-18, 0, 6, 16);
    this.leftArm.fill({ color: armColor });
    this.rightArm.clear();
    this.rightArm.rect(12, 0, 6, 16);
    this.rightArm.fill({ color: armColor });
  }

  getState(): CharacterState {
    return this.state;
  }

  playShoot(callback?: () => void): void {
    if (this.state !== "idle") return;
    this.state = "shoot";
    this.animTime = 0;
    this.animDuration = 0.5;
    this.animCallback = callback ?? null;
  }

  playThrow(callback?: () => void): void {
    if (this.state !== "idle") return;
    this.state = "throw";
    this.animTime = 0;
    this.animDuration = 0.8;
    this.animCallback = callback ?? null;
  }

  update(dt: number): void {
    this.animTime += dt;

    if (this.state === "idle") {
      this.updateIdle(dt);
    } else if (this.state === "shoot") {
      this.updateShoot();
    } else if (this.state === "throw") {
      this.updateThrow();
    }
  }

  private updateIdle(_dt: number): void {
    const t = performance.now() / 1000;
    this.y = this.baseY + Math.sin(t * this.idleSpeed) * this.idleAmplitude;
    this.graphics.rotation = 0;
    this.leftArm.rotation = 0;
    this.rightArm.rotation = 0;
  }

  private updateShoot(): void {
    const progress = Math.min(this.animTime / this.animDuration, 1);
    const ease = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;

    this.graphics.rotation = -0.15 * ease * (1 - progress);
    this.rightArm.rotation = -1.2 * ease * (1 - progress);

    if (progress >= 1) {
      this.state = "idle";
      this.graphics.rotation = 0;
      this.leftArm.rotation = 0;
      this.rightArm.rotation = 0;
      this.animCallback?.();
      this.animCallback = null;
    }
  }

  private updateThrow(): void {
    const progress = Math.min(this.animTime / this.animDuration, 1);
    let ease: number;

    if (progress < 0.4) {
      ease = progress / 0.4;
      this.graphics.rotation = 0.2 * ease;
      this.rightArm.rotation = -1.5 * ease;
    } else if (progress < 0.6) {
      ease = (progress - 0.4) / 0.2;
      this.graphics.rotation = 0.2 - 0.4 * ease;
      this.rightArm.rotation = -1.5 + 3.0 * ease;
    } else {
      ease = (progress - 0.6) / 0.4;
      this.graphics.rotation = -0.2 + 0.2 * ease;
      this.rightArm.rotation = 1.5 - 1.5 * ease;
    }

    if (progress >= 1) {
      this.state = "idle";
      this.graphics.rotation = 0;
      this.leftArm.rotation = 0;
      this.rightArm.rotation = 0;
      this.animCallback?.();
      this.animCallback = null;
    }
  }

  getRoleName(): string {
    return ROLE_NAMES[this.role];
  }
}
