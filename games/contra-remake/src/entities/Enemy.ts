export class Enemy {
  hp: number; maxHp: number; x: number; y: number; alive = true;
  constructor(x: number, y: number, hp: number) { this.x = x; this.y = y; this.hp = hp; this.maxHp = hp; }
  takeDamage(n: number) { this.hp -= n; if (this.hp <= 0) this.alive = false; }
}
