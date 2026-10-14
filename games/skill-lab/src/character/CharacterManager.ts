import { Container } from "pixi.js";
import { Character, CharacterRole } from "./Character";

const ALL_ROLES: CharacterRole[] = ["scientist", "warrior", "mage", "assassin"];
const FADE_SPEED = 0.05;

export class CharacterManager {
  private container: Container;
  private characters: Map<CharacterRole, Character> = new Map();
  private currentRole: CharacterRole = "scientist";
  private fadeTarget: number = 1;
  private fadeCurrent: number = 1;
  private pendingRole: CharacterRole | null = null;

  constructor(parent: Container, x: number, y: number) {
    this.container = new Container();
    this.container.x = x;
    this.container.y = y;
    this.container.label = "characterManager";
    parent.addChild(this.container);

    for (const role of ALL_ROLES) {
      const char = new Character(role);
      char.alpha = role === "scientist" ? 1 : 0;
      char.visible = role === "scientist";
      this.characters.set(role, char);
      this.container.addChild(char);
    }
  }

  getCurrentRole(): CharacterRole {
    return this.currentRole;
  }

  getCurrentCharacter(): Character {
    return this.characters.get(this.currentRole)!;
  }

  switchTo(role: CharacterRole): void {
    if (role === this.currentRole) return;
    if (this.pendingRole !== null) return;
    this.pendingRole = role;
    this.fadeTarget = 0;
  }

  update(dt: number): void {
    this.fadeCurrent += (this.fadeTarget - this.fadeCurrent) * FADE_SPEED * dt;
    if (this.fadeCurrent < 0.01 && this.fadeTarget === 0 && this.pendingRole !== null) {
      this.characters.get(this.currentRole)!.visible = false;
      this.currentRole = this.pendingRole;
      this.characters.get(this.currentRole)!.visible = true;
      this.pendingRole = null;
      this.fadeTarget = 1;
    }
    for (const [role, char] of this.characters) {
      if (role === this.currentRole) {
        char.alpha = this.fadeTarget === 1 ? this.fadeCurrent : 1 - this.fadeCurrent;
        char.update(dt);
      }
    }
  }
}
