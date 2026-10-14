// ============================================
//  无限进化 V1.1 — 实体工厂层
//  实体生命周期管理，不持有状态
// ============================================

// ==================== 怪物生成 ====================
function spawnMonster(game, typeName) {
  const { MONSTER_TYPES, CX, CY, W, H } = game.config;
  const { randInt, rand } = game.utils;

  const side = randInt(0, 3);
  let x, y;
  if (side === 0)      { x = rand(0, W); y = -20; }
  else if (side === 1) { x = W + 20; y = rand(0, H); }
  else if (side === 2) { x = rand(0, W); y = H + 20; }
  else                 { x = -20; y = rand(0, H); }

  if (!typeName) {
    // 普通怪物生成表（增加冲锋型和爆炸型）
    const t = ['red', 'red', 'red', 'green', 'green', 'purple', 'orange', 'yellow'];
    typeName = t[randInt(0, t.length - 1)];
  }

  const type = MONSTER_TYPES[typeName];
  const monster = {
    x, y,
    hp: type.hp * game.state.difficultyMult,
    maxHp: type.hp * game.state.difficultyMult,
    dmg: type.dmg * game.state.difficultyMult,
    speed: type.speed,
    size: type.size,
    color: type.color,
    name: type.name,
    dropRate: type.dropRate,
    ranged: type.ranged || false,
    elite: type.elite || false,
    boss: type.boss || false,
    // P0新增：冲锋型属性
    dash: type.dash || false,
    dashTimer: type.dash ? rand(2, 4) : 0,
    isDashing: false,
    // P0新增：爆炸型属性
    explosive: type.explosive || false,
    explosiveDmg: type.explosiveDmg || 0,
    explosiveRadius: type.explosiveRadius || 0,
    // 通用状态
    shootTimer: rand(0, 1),
    animFrame: 0,
    animTimer: 0,
    burnTimer: 0,
    burnDmg: 0,
    slowTimer: 0,
    frozen: false,
    frozenTimer: 0,
    hitFlash: 0,
  };

  // P0优化：新手引导期怪物减速
  if (game.state.tutorialActive) {
    monster.speed *= game.config.TUTORIAL_MONSTER_SPEED_MULT;
    monster.dmg *= 0.3; // 伤害降低70%
  }

  game.objs.monsters.push(monster);
  return monster;
}

// ==================== 粒子生成（V1.2：支持更多类型） ====================
function spawnParticles(game, x, y, color, count, opts) {
  const { MAX_PARTICLES } = game.config;
  const { rand } = game.utils;
  const { particles } = game.objs;
  const options = opts || {};

  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    const angle = options.angleMin !== undefined
      ? rand(options.angleMin, options.angleMax)
      : rand(0, Math.PI * 2);
    const speed = rand(options.speedMin || 1, options.speedMax || 4);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(options.lifeMin || 0.25, options.lifeMax || 0.7),
      maxLife: options.lifeMax || 0.7,
      size: rand(options.sizeMin || 1.5, options.sizeMax || 3.5),
      color,
      shrink: options.shrink !== false,
    });
  }
}

// ==================== 浮动文字 ====================
function addFloatingText(game, x, y, text, color, dur) {
  const { MAX_FLOATING } = game.config;
  const { floatingTexts } = game.objs;

  if (floatingTexts.length >= MAX_FLOATING) floatingTexts.shift();
  floatingTexts.push({
    x, y, text, color,
    life: dur || 1.0,
    maxLife: dur || 1.0
  });
}

// ==================== 掉落处理 ====================
function applyDrop(game, x, y, monster) {
  const { WEAPON_DROP_TABLE, FRUIT_DEFS, RARITY_COLORS } = game.config;
  const { pendingWeapon, pendingFruit } = game.state;
  const player = game.player;
  const { pickWeighted } = game.utils;
  const { checkForm } = game.systems;

  const roll = Math.random();
  let dropType;

  if (monster.elite || monster.boss) {
    dropType = roll < 0.5 ? 'weapon' : 'fruit';
  } else {
    if (roll < 0.35) dropType = 'heal';
    else if (roll < 0.65) dropType = 'shield';
    else if (roll < 0.85) dropType = 'weapon';
    else dropType = 'fruit';
  }

  if (dropType === 'heal') {
    const amt = Math.min(25, player.maxHp - player.hp);
    if (amt > 0) {
      player.hp += amt;
      addFloatingText(game, x, y, `+${amt} HP`, '#e74c3c', 1.2);
      game.utils.playSound('pickup');
    }
  } else if (dropType === 'shield') {
    const amt = Math.min(35, player.maxShield - player.shield);
    if (amt > 0) {
      player.shield += amt;
      addFloatingText(game, x, y, `+${amt} 护盾`, '#3498db', 1.2);
      game.utils.playSound('pickup');
    }
  } else if (dropType === 'weapon') {
    if (game.state.hasPendingSelect) return;
    const wid = pickWeighted(WEAPON_DROP_TABLE);
    const def = game.config.WEAPON_DEFS[wid];

    if (player.weapons.length < player.maxSlots) {
      player.weapons.push(wid);
      player.attackTimers[wid] = 0;
      addFloatingText(game, x, y, `${def.icon} ${def.name}!`, RARITY_COLORS[def.rarity], 2.0);
      game.utils.playSound('pickup');
      checkForm(game);
    } else {
      game.state.pendingWeapon = wid;
      game.state.state = 'WEAPON_SELECT';
      game.state.hasPendingSelect = true;
    }
  } else if (dropType === 'fruit') {
    if (game.state.hasPendingSelect) return;
    const fid = pickWeighted(game.config.FRUIT_DROP_TABLE);
    if (!player.fruit) {
      player.fruit = fid;
      player.fruitEnergy = 0;
      const fruitDef = FRUIT_DEFS[fid];
      addFloatingText(game, x, y, `${fruitDef.icon} ${fruitDef.name}!`, fruitDef.color, 2.5);
      game.utils.playSound('pickup');
    } else {
      game.state.pendingFruit = fid;
      game.state.state = 'FRUIT_SELECT';
      game.state.hasPendingSelect = true;
    }
  }
}

// ==================== 武器攻击 ====================
function fireWeapon(game, wid) {
  const { WEAPON_DEFS, CX, CY, MAX_BULLETS, RARITY_COLORS } = game.config;
  const { monsters, bullets } = game.objs;
  const { talentBonuses } = game.state;
  const player = game.player;
  const { dist } = game.utils;

  const def = WEAPON_DEFS[wid];
  if (!def || monsters.length === 0 || bullets.length >= MAX_BULLETS) return;

  // 找到最近的怪物
  let nearest = null, minD = Infinity;
  for (const m of monsters) {
    const d = dist({ x: CX, y: CY }, m);
    if (d < minD) { minD = d; nearest = m; }
  }
  if (!nearest) return;

  const dx = nearest.x - CX;
  const dy = nearest.y - CY;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const nx = dx / len;
  const ny = dy / len;

  game.utils.playSound('shoot');

  const dmg = def.dmg * talentBonuses.dmgMult;
  const pierce = def.type === 'pierce' || talentBonuses.pierce;

  if (def.type === 'single') {
    bullets.push({
      x: CX, y: CY,
      vx: nx * def.speed, vy: ny * def.speed,
      dmg, size: def.size, color: def.color,
      life: 2.0, weaponId: wid, pierce
    });
    if (talentBonuses.multiShot) {
      const a2 = Math.atan2(ny, nx) + 0.2;
      bullets.push({
        x: CX, y: CY,
        vx: Math.cos(a2) * def.speed,
        vy: Math.sin(a2) * def.speed,
        dmg: dmg * 0.6, size: def.size, color: def.color,
        life: 2.0, weaponId: wid, pierce
      });
    }
  } else if (def.type === 'spread') {
    for (let i = -1; i <= 1; i++) {
      const a = Math.atan2(ny, nx) + i * 0.25;
      bullets.push({
        x: CX, y: CY,
        vx: Math.cos(a) * def.speed,
        vy: Math.sin(a) * def.speed,
        dmg, size: def.size, color: def.color,
        life: 1.5, weaponId: wid, pierce
      });
    }
    if (talentBonuses.multiShot) {
      const a = Math.atan2(ny, nx) + 0.5;
      bullets.push({
        x: CX, y: CY,
        vx: Math.cos(a) * def.speed,
        vy: Math.sin(a) * def.speed,
        dmg: dmg * 0.5, size: def.size, color: def.color,
        life: 1.5, weaponId: wid, pierce
      });
    }
  } else if (def.type === 'explosive') {
    const er = 45 * talentBonuses.explosionMult;
    bullets.push({
      x: CX, y: CY,
      vx: nx * def.speed, vy: ny * def.speed,
      dmg, size: def.size, color: def.color,
      life: 3.0, weaponId: wid, explosive: true, explosionRadius: er
    });
  } else if (def.type === 'pierce') {
    bullets.push({
      x: CX, y: CY,
      vx: nx * def.speed, vy: ny * def.speed,
      dmg, size: def.size, color: def.color,
      life: 2.0, weaponId: wid, pierce: true
    });
    if (talentBonuses.multiShot) {
      const a2 = Math.atan2(ny, nx) - 0.15;
      bullets.push({
        x: CX, y: CY,
        vx: Math.cos(a2) * def.speed,
        vy: Math.sin(a2) * def.speed,
        dmg: dmg * 0.7, size: def.size, color: def.color,
        life: 2.0, weaponId: wid, pierce: true
      });
    }
  }
}

// ==================== 冲击波生成（新增） ====================
function spawnShockwave(game, x, y, maxRadius, color, maxLife) {
  if (!game.objs.shockwaves) game.objs.shockwaves = [];
  game.objs.shockwaves.push({
    x, y,
    maxRadius: maxRadius || 60,
    color: color || '#ffffff',
    life: maxLife || 0.4,
    maxLife: maxLife || 0.4,
  });
}

// ==================== 爆炸处理（V1.2：加入冲击波和多层粒子） ====================
function explodeAt(game, x, y, radius, dmg) {
  const { rand, dist } = game.utils;
  const { monsters, particles } = game.objs;

  // 多层粒子（火焰层）
  spawnParticles(game, x, y, '#ff4400', 18, { speedMin: 2, speedMax: 6, sizeMin: 3, sizeMax: 8, lifeMin: 0.3, lifeMax: 0.8 });
  spawnParticles(game, x, y, '#ff8800', 12, { speedMin: 1, speedMax: 4, sizeMin: 2, sizeMax: 6, lifeMin: 0.2, lifeMax: 0.6 });
  spawnParticles(game, x, y, '#ffcc00', 8, { speedMin: 0.5, speedMax: 3, sizeMin: 2, sizeMax: 4 });
  spawnParticles(game, x, y, '#fff', 5, { speedMin: 3, speedMax: 8, sizeMin: 1, sizeMax: 3, lifeMin: 0.1, lifeMax: 0.3 });
  // 冲击波
  spawnShockwave(game, x, y, radius * 1.2, '#ff8844', 0.4);
  spawnShockwave(game, x, y, radius * 0.7, '#ffcc44', 0.25);

  game.systems.addShake(game, 0.3);
  game.utils.playSound('hit');

  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    if (m._dead) continue;
    if (game.utils.dist({ x, y }, m) < radius + m.size) {
      m.hp -= dmg;
      m.hitFlash = 0.15;
      if (m.hp <= 0) {
        m._dead = true;
        onMonsterKill(game, m, i);
      }
    }
  }
}

// ==================== 怪物击杀 ====================
function onMonsterKill(game, monster, index) {
  const { rand, randInt } = game.utils;
  const { monsters, particles, bullets } = game.objs;
  const { talentBonuses } = game.state;
  const player = game.player;
  const st = game.state;
  const { addShake, checkSlotUnlock, checkMilestone, addCombo } = game.systems;

  // 爆炸粒子
  const particleCount = monster.boss ? 30 : (monster.elite ? 15 : 8);
  spawnParticles(game, monster.x, monster.y, monster.color, particleCount);

  // P0新增：爆炸型怪物死亡时自爆
  if (monster.explosive) {
    explodeAt(game, monster.x, monster.y, monster.explosiveRadius, monster.explosiveDmg);
    addFloatingText(game, monster.x, monster.y - 20, '💥 自爆！', '#f1c40f', 1.5);
  }

  if (monster.boss) {
    addShake(game, 0.8);
    game.utils.playSound('boss');
    game.state.bossDeadTimer = 2.5;
    game.state.bossDeadCount++;
    addFloatingText(game, game.config.CX, game.config.CY - 100, `💀 BOSS 击杀！`, '#e74c3c', 3.5);

    // Boss击杀爆炸
    for (let j = 0; j < 5; j++) {
      setTimeout(() => {
        const bx = monster.x + rand(-30, 30);
        const by = monster.y + rand(-30, 30);
        spawnParticles(game, bx, by, '#f80', 15);
        spawnParticles(game, bx, by, '#ff0', 8);
      }, j * 120);
    }
  } else {
    game.utils.playSound('kill');
  }

  // 掉落判定
  if (monster.dropRate >= Math.random()) {
    applyDrop(game, monster.x, monster.y, monster);
  }

  monsters.splice(index, 1);
  st.kills++;

  addCombo(game);
  checkMilestone(game);

  // 能量获取（分层）
  const energyGain = (monster.boss ? 15 : monster.elite ? 8 : 3) * talentBonuses.energyGain;
  if (player.fruit) {
    player.fruitEnergy = Math.min(player.fruitMaxEnergy, player.fruitEnergy + energyGain);
  }

  checkSlotUnlock(game);

  // 天赋：击杀回血
  if (talentBonuses.killHeal > 0) {
    player.hp = Math.min(player.maxHp, player.hp + talentBonuses.killHeal);
  }
}

// ==================== 幽灵剑气 ====================
function fireGhostBlade(game) {
  const { CX, CY } = game.config;
  const { ghostBlades } = game.objs;
  const { talentBonuses } = game.state;

  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    ghostBlades.push({
      x: CX, y: CY,
      vx: Math.cos(angle) * 10,
      vy: Math.sin(angle) * 10,
      life: 1.0,
      dmg: 30 * talentBonuses.dmgMult
    });
  }
  addFloatingText(game, CX, CY - 50, '👻 剑气！', '#1abc9c', 1.2);
}

// ==================== 果实被动效果 ====================
function applyFruitPassive(game, monster, bx, by) {
  const { FRUIT_DEFS, CX, CY } = game.config;
  const { talentBonuses } = game.state;
  const { monsters, lightnings, particles } = game.objs;
  const player = game.player;

  if (!player.fruit) return;
  const def = FRUIT_DEFS[player.fruit];
  const { dist, rand } = game.utils;

  if (def.passive === 'burn') {
    monster.burnTimer = def.burnDur;
    monster.burnDmg = def.burnDmg;
    spawnParticles(game, monster.x, monster.y, '#e74c3c', 4);
    spawnParticles(game, monster.x, monster.y, '#f39c12', 3);
  } else if (def.passive === 'slow') {
    monster.slowTimer = def.slowDur;
    spawnParticles(game, monster.x, monster.y, '#85c1e9', 5);
    spawnParticles(game, monster.x, monster.y, '#fff', 2);
  } else if (def.passive === 'chain') {
    let targets = [];
    let lx = monster.x;
    let ly = monster.y;

    for (let c = 0; c < def.chainCount; c++) {
      let nearest = null;
      let minD = Infinity;

      for (const mon of monsters) {
        if (mon === monster || targets.includes(mon)) continue;
        const d = dist({ x: lx, y: ly }, mon);
        if (d < def.chainRange && d < minD) {
          minD = d;
          nearest = mon;
        }
      }

      if (nearest) {
        targets.push(nearest);
        lightnings.push({ x1: lx, y1: ly, x2: nearest.x, y2: nearest.y, life: 0.4, color: def.color, width: 3 });
        lightnings.push({ x1: lx, y1: ly, x2: nearest.x, y2: nearest.y, life: 0.3, color: '#fff', width: 1 });
        spawnParticles(game, nearest.x, nearest.y, '#f1c40f', 4);
        nearest.hp -= def.chainDmg * talentBonuses.dmgMult;
        nearest.hitFlash = 0.15;
        if (nearest.hp <= 0) {
          const idx = monsters.indexOf(nearest);
          if (idx >= 0) onMonsterKill(game, nearest, idx);
        }
        lx = nearest.x;
        ly = nearest.y;
      }
    }

    if (targets.length > 0) {
      lightnings.push({ x1: bx, y1: by, x2: monster.x, y2: monster.y, life: 0.4, color: def.color, width: 3 });
    }
  }
}

// ==================== 大招释放（V1.2：特效升级） ====================
function releaseUltimate(game) {
  const { FRUIT_DEFS, CX, CY, W, H, MAX_PARTICLES } = game.config;
  const { rand, randInt } = game.utils;
  const { talentBonuses } = game.state;
  const { monsters, particles, lightnings } = game.objs;
  const player = game.player;
  const { addShake } = game.systems;

  if (!player.fruit || player.fruitEnergy < player.fruitMaxEnergy) return;

  player.fruitEnergy = 0;
  const def = FRUIT_DEFS[player.fruit];

  game.state.ultimateFlash = 1.8;
  game.state.ultimateFlashColor = def.ultColor;
  addShake(game, 0.8);
  game.utils.playSound('ultimate');

  // 共同：中心冲击波
  spawnShockwave(game, CX, CY, 200, def.ultColor, 0.6);
  spawnShockwave(game, CX, CY, 140, '#fff', 0.4);
  spawnShockwave(game, CX, CY, 80, def.ultColor, 0.3);

  if (player.fruit === 'fire') {
    // 终焉火海：全屏火焰柱
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.hp -= def.ultDmg * talentBonuses.dmgMult;
      m.burnTimer = 5;
      m.burnDmg = 8;
      m.hitFlash = 0.4;
      spawnParticles(game, m.x, m.y, '#e74c3c', 12, { speedMin: 2, speedMax: 7, sizeMin: 3, sizeMax: 8 });
      spawnParticles(game, m.x, m.y, '#ff8800', 8, { speedMin: 1, speedMax: 5 });
      if (m.hp <= 0) onMonsterKill(game, m, i);
    }
    addFloatingText(game, CX, CY - 70, '🔥 终焉火海！', '#e74c3c', 2.8);
    // 大量火焰粒子从底部升起
    for (let i = 0; i < 80; i++) {
      if (particles.length < MAX_PARTICLES) {
        const col = ['#e74c3c', '#f80', '#ff4', '#ff6600'][randInt(0, 3)];
        particles.push({
          x: rand(0, W), y: rand(H * 0.3, H),
          vx: rand(-2, 2), vy: rand(-5, -1.5),
          life: rand(0.4, 1.8), maxLife: 1.8,
          size: rand(3, 10),
          color: col,
          shrink: true,
        });
      }
    }

  } else if (player.fruit === 'ice') {
    // 极寒冰暴：冰晶扩散圈
    for (const m of monsters) {
      m.frozen = true;
      m.frozenTimer = def.ultFreezeDur;
      spawnParticles(game, m.x, m.y, '#85c1e9', 8, { speedMin: 1, speedMax: 4 });
      spawnParticles(game, m.x, m.y, '#fff', 4, { speedMin: 2, speedMax: 6 });
    }
    addFloatingText(game, CX, CY - 70, '❄️ 极寒冰暴！', '#3498db', 2.8);
    // 冰晶向外扩散
    for (let i = 0; i < 60; i++) {
      if (particles.length < MAX_PARTICLES) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(2, 8);
        const col = ['#85c1e9', '#b3daff', '#fff', '#c8e6ff'][randInt(0, 3)];
        particles.push({
          x: CX + Math.cos(angle) * rand(10, 50),
          y: CY + Math.sin(angle) * rand(10, 50),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: rand(0.5, 1.5), maxLife: 1.5,
          size: rand(2, 7),
          color: col,
          shrink: true,
        });
      }
    }
    // 额外冲击波（蓝色）
    spawnShockwave(game, CX, CY, 280, '#3498db', 0.7);

  } else if (player.fruit === 'thunder') {
    // 天降雷霆：天柱+多目标闪电
    const targets = [...monsters].sort(() => Math.random() - 0.5).slice(0, def.ultTargets);
    for (const m of targets) {
      m.hp -= def.ultDmg * talentBonuses.dmgMult;
      m.hitFlash = 0.4;
      // 多段闪电（从天空打下）
      for (let j = 0; j < 3; j++) {
        lightnings.push({
          x1: m.x + rand(-15, 15), y1: -10,
          x2: m.x, y2: m.y,
          life: rand(0.3, 0.7), color: j === 0 ? '#f1c40f' : '#fff', width: j === 0 ? 4 : 1
        });
      }
      spawnParticles(game, m.x, m.y, '#f1c40f', 14, { speedMin: 2, speedMax: 8, sizeMin: 2, sizeMax: 6 });
      spawnParticles(game, m.x, m.y, '#fff', 5, { speedMin: 3, speedMax: 10 });
      if (m.hp <= 0) {
        const idx = monsters.indexOf(m);
        if (idx >= 0) onMonsterKill(game, m, idx);
      }
    }
    addFloatingText(game, CX, CY - 70, '⚡ 天降雷霆！', '#f1c40f', 2.8);
    // 全屏闪电粒子
    for (let i = 0; i < 50; i++) {
      if (particles.length < MAX_PARTICLES) {
        particles.push({
          x: rand(0, W), y: rand(0, H * 0.5),
          vx: rand(-1, 1), vy: rand(3, 8),
          life: rand(0.2, 0.5), maxLife: 0.5,
          size: rand(1, 4),
          color: ['#f1c40f', '#fff', '#ffe066'][randInt(0, 2)],
          shrink: true,
        });
      }
    }
  }
}

// ==================== 导出 ====================
export {
  spawnMonster,
  spawnParticles,
  spawnShockwave,
  addFloatingText,
  applyDrop,
  fireWeapon,
  explodeAt,
  onMonsterKill,
  fireGhostBlade,
  applyFruitPassive,
  releaseUltimate,
};
