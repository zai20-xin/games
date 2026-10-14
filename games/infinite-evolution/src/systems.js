// ============================================
//  无限进化 V1.1 — 业务逻辑层
//  游戏系统逻辑，不直接操作Canvas
// ============================================

// ==================== 玩家重置 ====================
function resetPlayer(game) {
  const { player } = game;
  const { talentBonuses } = game.state;

  player.hp = player.maxHp = 100;
  player.shield = player.maxShield = 100;
  player.shieldRegen = 6;
  player.weapons = ['stone'];
  player.maxSlots = 1;
  player.attackTimers = { stone: 0 };
  player.fruit = null;
  player.fruitEnergy = 0;
  player.form = 'primitive';

  talentBonuses.dmgMult = 1.0;
  talentBonuses.intervalMult = 1.0;
  talentBonuses.energyGain = 1.0;
  talentBonuses.pierce = false;
  talentBonuses.explosionMult = 1.0;
  talentBonuses.killHeal = 0;
  talentBonuses.multiShot = false;
  talentBonuses.ghostBlade = false;

  game.state.acquiredTalents = [];
}

// ==================== 游戏重置（V1.2：初始化新系统） ====================
function resetGame(game) {
  const { objs, state } = game;
  const { resetPlayer } = game.systems;
  const { initBgStars, initBgLayers, initNebula, initMeteors } = game.systems;

  resetPlayer(game);

  objs.bullets = [];
  objs.monsters = [];
  objs.particles = [];
  objs.floatingTexts = [];
  objs.lightnings = [];
  objs.ghostBlades = [];
  objs.shockwaves = [];

  state.kills = 0;
  state.survivalTime = 0;
  state.spawnTimer = 0;
  state.spawnInterval = 1.2;
  state.difficultyTimer = 0;
  state.difficultyMult = 1.0;
  state.eliteTimer = 0;
  state.bossTimer = 0;
  state.damageFlash = 0;
  state.ultimateFlash = 0;
  state.evolveFlash = 0;
  state.screenShake = 0;
  state.pendingWeapon = null;
  state.pendingFruit = null;
  state.hasPendingSelect = false;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.nextMilestone = 0;
  state.levelUpTimer = 0;
  state.levelCount = 0;
  state.pendingTalents = [];
  state.bossDeadTimer = 0;
  state.bossDeadCount = 0;
  state.isNewRecord = false;

  // P0新增：新手引导
  state.tutorialActive = true;
  state.tutorialTimer = 0;

  // P1新增：BOSS战背景
  state.bossBgActive = false;

  initBgStars(game);
  initBgLayers(game);
  initNebula(game);
  initMeteors(game);
}

// ==================== 震屏 ====================
function addShake(game, intensity) {
  game.state.screenShake = Math.max(game.state.screenShake, intensity);
}

// ==================== 连击系统 ====================
function addCombo(game) {
  const { comboCount, comboTimer, comboMultiplier } = game.state;
  const { talentBonuses, kills } = game.state;
  const { fireGhostBlade } = game.entities;
  const { addShake } = game.systems;
  const { addFloatingText } = game.entities;
  const { CX, CY, COMBO_TIMEOUT, SHAKE_LEVELS } = game.config;
  const { getShakeConfig } = game.utils;
  const { saveBestRecord } = game.utils;

  game.state.comboCount++;
  game.state.comboTimer = COMBO_TIMEOUT;
  game.state.comboMultiplier = 1.0 + Math.floor(game.state.comboCount / 5) * 0.1;

  if (game.state.comboCount >= 5 && game.state.comboCount % 5 === 0) {
    addFloatingText(game, CX, CY - 70, `${game.state.comboCount} 连击! ×${game.state.comboMultiplier.toFixed(1)}`, '#ff6600', 2.0);

    // P1优化：连击震动分级
    const shakeConfig = getShakeConfig(game.state.comboCount, SHAKE_LEVELS);
    if (shakeConfig) {
      addShake(game, shakeConfig.intensity);
    }
  }

  // 幽灵剑气天赋
  if (talentBonuses.ghostBlade && game.state.comboCount % 5 === 0) {
    fireGhostBlade(game);
  }
}

// ==================== 形态检查 ====================
function checkForm(game) {
  const { FORM_DEFS, WEAPON_FORM_MAP, CX, CY } = game.config;
  const { evolveFlash } = game.state;
  const player = game.player;
  const { spawnParticles } = game.entities;
  const { addShake } = game.systems;
  const { addFloatingText } = game.entities;
  const { playSound, rand } = game.utils;

  let maxTier = 0;
  let bestFormId = 'primitive';

  for (const wid of player.weapons) {
    const fid = WEAPON_FORM_MAP[wid];
    if (!fid) continue;
    const tier = FORM_DEFS[fid].tier;
    if (tier > maxTier) {
      maxTier = tier;
      bestFormId = fid;
    }
  }

  const gunC = player.weapons.filter(w => ['pistol', 'shotgun', 'machinegun'].includes(w)).length;
  const heavyC = player.weapons.filter(w => ['rocket', 'laser'].includes(w)).length;
  if (gunC >= 3 && heavyC >= 1 && FORM_DEFS['vehicle'].tier > maxTier) {
    bestFormId = 'vehicle';
    maxTier = FORM_DEFS['vehicle'].tier;
  }
  if (player.weapons.length >= 5 && FORM_DEFS['aircraft'].tier > maxTier) {
    bestFormId = 'aircraft';
  }

  if (bestFormId !== player.form) {
    const old = player.form;
    player.form = bestFormId;

    game.state.evolveFlash = 2.0;
    addShake(game, 0.6);
    addFloatingText(game, CX, CY - 60, `✨ 进化! ${FORM_DEFS[old].name} → ${FORM_DEFS[bestFormId].name}!`, '#ffd740', 3.5);
    playSound('evolve');

    // 进化粒子爆发
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(2, 6);
      if (game.objs.particles.length < game.config.MAX_PARTICLES) {
        game.objs.particles.push({
          x: CX, y: CY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: rand(0.5, 1.2),
          maxLife: 1.2,
          size: rand(2, 5),
          color: FORM_DEFS[bestFormId].color
        });
      }
    }
  }
}

// ==================== 武器槽解锁检查 ====================
function checkSlotUnlock(game) {
  const { SLOT_UNLOCKS, CX, CY } = game.config;
  const { kills } = game.state;
  const player = game.player;
  const { addFloatingText } = game.entities;
  const { playSound } = game.utils;

  for (let i = 0; i < SLOT_UNLOCKS.length; i++) {
    if (kills >= SLOT_UNLOCKS[i] && player.maxSlots < i + 1) {
      player.maxSlots = i + 1;
      addFloatingText(game, CX, CY - 40, `🔓 武器槽解锁! (${player.maxSlots}/${SLOT_UNLOCKS.length})`, '#f1c40f', 2.5);
      playSound('pickup');
    }
  }
}

// ==================== 击杀里程碑检查 ====================
function checkMilestone(game) {
  const { MILESTONES, CX, CY } = game.config;
  const { kills, nextMilestone } = game.state;
  const { addShake } = game.systems;
  const { addFloatingText } = game.entities;

  if (nextMilestone < MILESTONES.length && kills >= MILESTONES[nextMilestone]) {
    addFloatingText(game, CX, CY - 80, `🏆 ${MILESTONES[nextMilestone]} 击杀里程碑!`, '#ffd740', 3.5);
    addShake(game, 0.4);
    game.state.nextMilestone++;
  }
}

// ==================== 天赋升级检查 ====================
function checkLevelUp(game) {
  const { LEVEL_UP_INTERVAL, TALENT_POOL, CX, CY } = game.config;
  const st = game.state;
  const { addShake } = game.systems;
  const { addFloatingText } = game.entities;
  const { playSound } = game.utils;

  if (st.state !== 'PLAYING') return;

  st.levelUpTimer += game._dt || 0;
  if (st.levelUpTimer >= LEVEL_UP_INTERVAL) {
    st.levelUpTimer -= LEVEL_UP_INTERVAL;
    st.levelCount++;

    // 选择3个随机天赋
    const available = TALENT_POOL.filter(t => {
      if (['dmg_up', 'speed_up', 'hp_up', 'shield_up'].includes(t.id)) return true;
      return !st.acquiredTalents.includes(t.id);
    });

    const shuffled = available.sort(() => Math.random() - 0.5);
    st.pendingTalents = shuffled.slice(0, 3);

    st.state = 'LEVEL_UP';
    addShake(game, 0.2);
    playSound('pickup');
  }
}

// ==================== 天赋选择 ====================
function selectTalent(game, talentIndex) {
  const { pendingTalents } = game.state;
  const { TALENT_POOL, CX, CY } = game.config;
  const { addFloatingText } = game.entities;
  const { playSound } = game.utils;

  if (talentIndex < 0 || talentIndex >= pendingTalents.length) return;

  const talent = pendingTalents[talentIndex];
  talent.apply(game); // 传入game对象，天赋函数自行修改

  if (!game.state.acquiredTalents.includes(talent.id)) {
    game.state.acquiredTalents.push(talent.id);
  }

  addFloatingText(game, CX, CY - 60, `${talent.name} 获取！`, talent.color, 2.5);
  playSound('evolve');
  game.state.pendingTalents = [];
  game.state.state = 'PLAYING';
}

// ==================== 初始化背景星粒（V1.2：加入彩色变体） ====================
function initBgStars(game) {
  const { rand } = game.utils;
  const starColors = ['#ffffff', '#ffe8cc', '#cce8ff', '#e8ccff', '#ccffee'];

  game.objs.bgStars = [];
  for (let i = 0; i < 60; i++) {
    game.objs.bgStars.push({
      x: rand(0, game.config.W),
      y: rand(0, game.config.H),
      size: rand(0.5, 2),
      alpha: rand(0.1, 0.5),
      speed: rand(0.05, 0.35),
      color: starColors[Math.floor(Math.random() * starColors.length)],
    });
  }
}

// ==================== P1：初始化视差背景层（V1.2：加彩色星） ====================
function initBgLayers(game) {
  const { BG_LAYERS } = game.config;
  const { rand } = game.utils;
  const starColors = ['#ffffff', '#ffe0cc', '#ccddff', '#eeccff', '#ccffee'];
  const bossStarColors = ['#ffcccc', '#ff8888', '#ffaaaa', '#ffdddd', '#ff6666'];

  game.objs.bgLayers = [];
  for (const layer of BG_LAYERS) {
    const stars = [];
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x: rand(0, game.config.W),
        y: rand(0, game.config.H),
        size: layer.size,
        alpha: layer.alpha,
        speed: layer.speed,
        twinkle: rand(0, Math.PI * 2),
        color: starColors[Math.floor(Math.random() * starColors.length)],
        bossColor: bossStarColors[Math.floor(Math.random() * bossStarColors.length)],
      });
    }
    game.objs.bgLayers.push({ ...layer, stars });
  }
}

// ==================== 初始化星云（新增） ====================
function initNebula(game) {
  const { rand } = game.utils;
  const { W, H } = game.config;

  const nebulaColors = [
    { color: 'rgba(100,0,200,', bossColor: 'rgba(200,0,50,' },
    { color: 'rgba(0,100,180,', bossColor: 'rgba(180,50,0,' },
    { color: 'rgba(0,150,80,', bossColor: 'rgba(150,0,30,' },
  ];

  game.objs.nebula = [];
  for (let i = 0; i < 4; i++) {
    const nc = nebulaColors[i % nebulaColors.length];
    game.objs.nebula.push({
      x: rand(W * 0.1, W * 0.9),
      y: rand(H * 0.1, H * 0.9),
      r: rand(80, 180),
      alpha: rand(0.04, 0.1),
      phase: rand(0, Math.PI * 2),
      color: nc.color + '1)',
      bossColor: nc.bossColor + '1)',
    });
  }
}

// ==================== 初始化流星（新增） ====================
function initMeteors(game) {
  game.objs.meteors = [];
  game.state.meteorTimer = 2 + Math.random() * 6;
}

// ==================== 主更新循环 ====================
function update(game, dt) {
  if (game.state.state !== 'PLAYING') return;

  game._dt = dt; // 供 checkLevelUp 使用
  const {
    W, H, CX, CY, MAX_BULLETS, MAX_PARTICLES, MAX_FLOATING,
    TUTORIAL_DURATION, TUTORIAL_SPAWN_MULT
  } = game.config;
  const st = game.state;
  const { talentBonuses } = st;
  const player = game.player;
  const { monsters, bullets, particles, floatingTexts, lightnings, ghostBlades } = game.objs;
  const { addFloatingText, spawnMonster, spawnParticles, fireWeapon, applyFruitPassive, onMonsterKill } = game.entities;
  const {
    checkForm, checkSlotUnlock, checkMilestone, checkLevelUp, addShake
  } = game.systems;
  const { dist, rand, randInt, playSound, saveBestRecord, getShakeConfig } = game.utils;

  game.state.survivalTime += dt;

  // P0新增：新手引导计时
  if (game.state.tutorialActive) {
    game.state.tutorialTimer += dt;
    if (game.state.tutorialTimer >= TUTORIAL_DURATION) {
      game.state.tutorialActive = false;
      addFloatingText(game, CX, CY - 80, '💪 引导结束! 战斗开始!', '#2ecc71', 2.5);
    }
  }

  // 难度提升（每60秒）
  game.state.difficultyTimer += dt;
  if (game.state.difficultyTimer >= 60) {
    game.state.difficultyTimer -= 60;
    game.state.difficultyMult += 0.12;
    game.state.spawnInterval = Math.max(0.12, game.state.spawnInterval * 0.88);
    addFloatingText(game, CX, CY - 65, `⚠️ 难度提升! ×${game.state.difficultyMult.toFixed(1)}`, '#e74c3c', 2.5);
  }

  // 护盾恢复
  player.shield = Math.min(player.maxShield, player.shield + player.shieldRegen * dt);

  // 精英怪生成（每28秒）
  game.state.eliteTimer += dt;
  if (game.state.eliteTimer >= 28) {
    game.state.eliteTimer -= 28;
    spawnMonster(game, 'elite');
    addFloatingText(game, CX, CY - 55, '⚠️ 精英怪出现!', '#f1c40f', 2.5);
    playSound('elite');
  }

  // BOSS生成（每120秒）
  game.state.bossTimer += dt;
  if (game.state.bossTimer >= 120) {
    game.state.bossTimer -= 120;
    spawnMonster(game, 'boss');
    addFloatingText(game, CX, CY - 55, '💀 BOSS 降临!', '#e74c3c', 3.5);
    playSound('boss');
    addShake(game, 0.5);

    // P1优化：BOSS战背景变色
    game.state.bossBgActive = true;
    game.state.bossBgTimer = 0;
  }

  // BOSS战背景持续时间
  if (game.state.bossBgActive) {
    game.state.bossBgTimer += dt;
    if (game.state.bossBgTimer >= 30) {
      game.state.bossBgActive = false;
    }
  }

  // 天赋升级检查
  checkLevelUp(game);

  // 武器开火
  for (const wid of player.weapons) {
    if (!player.attackTimers[wid]) player.attackTimers[wid] = 0;
    player.attackTimers[wid] += dt;
    const def = game.config.WEAPON_DEFS[wid];
    const interval = def ? def.interval * talentBonuses.intervalMult : 1;
    if (def && player.attackTimers[wid] >= interval) {
      player.attackTimers[wid] -= interval;
      fireWeapon(game, wid);
    }
  }

  // P0优化：怪物生成（新手引导期降低速度）
  game.state.spawnTimer += dt;
  const effectiveSpawnInterval = game.state.tutorialActive
    ? game.state.spawnInterval / TUTORIAL_SPAWN_MULT
    : game.state.spawnInterval;

  if (game.state.spawnTimer >= effectiveSpawnInterval && monsters.length < 220) {
    game.state.spawnTimer -= effectiveSpawnInterval;
    spawnMonster(game);
  }

  // 更新子弹
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life -= dt;

    if (b.life <= 0 || b.x < -60 || b.x > W + 60 || b.y < -60 || b.y > H + 60) {
      if (b.explosive) {
        game.entities.explodeAt(game, b.x, b.y, b.explosionRadius, b.dmg * 0.5);
      }
      bullets.splice(i, 1);
      continue;
    }

    // 敌方子弹只伤玩家，不与怪物碰撞（否则会被己方怪物吞掉并误报命中音效）
    if (!b.enemy) {
      for (let j = monsters.length - 1; j >= 0; j--) {
        const m = monsters[j];
        if (dist(b, m) < m.size + b.size) {
          m.hp -= b.dmg;
          m.hitFlash = 0.12;
          spawnParticles(game, b.x, b.y, '#ff0', 3);
          applyFruitPassive(game, m, b.x, b.y);
          playSound('hit');

          if (b.explosive) {
            game.entities.explodeAt(game, b.x, b.y, b.explosionRadius, b.dmg * 0.5);
            bullets.splice(i, 1);
            if (m.hp <= 0) onMonsterKill(game, m, j);
            break;
          }

          if (!b.pierce) bullets.splice(i, 1);
          if (m.hp <= 0) onMonsterKill(game, m, j);
          if (!b.pierce) break;
        }
      }
    }
  }

  // 更新幽灵剑气
  for (let i = ghostBlades.length - 1; i >= 0; i--) {
    const gb = ghostBlades[i];
    gb.x += gb.vx;
    gb.y += gb.vy;
    gb.life -= dt;

    if (gb.life <= 0 || gb.x < -30 || gb.x > W + 30 || gb.y < -30 || gb.y > H + 30) {
      ghostBlades.splice(i, 1);
      continue;
    }

    for (let j = monsters.length - 1; j >= 0; j--) {
      const m = monsters[j];
      if (dist(gb, m) < m.size + 5) {
        m.hp -= gb.dmg;
        m.hitFlash = 0.15;
        spawnParticles(game, gb.x, gb.y, '#1abc9c', 4);
        if (m.hp <= 0) onMonsterKill(game, m, j);
        ghostBlades.splice(i, 1);
        break;
      }
    }
  }

  // 更新怪物
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    if (m.hitFlash > 0) m.hitFlash -= dt;

    // 冰冻状态
    if (m.frozen && m.frozenTimer > 0) {
      m.frozenTimer -= dt;
      if (m.frozenTimer <= 0) m.frozen = false;
      m.animTimer += dt;
      if (m.animTimer >= 0.3) {
        m.animTimer = 0;
        m.animFrame = 1 - m.animFrame;
      }
      continue;
    }

    // 灼烧状态
    if (m.burnTimer > 0) {
      m.burnTimer -= dt;
      m.hp -= m.burnDmg * dt;
      if (Math.random() < dt * 10) {
        spawnParticles(game, m.x + rand(-4, 4), m.y + rand(-6, 0), '#f80', 1);
      }
      if (m.hp <= 0) {
        onMonsterKill(game, m, i);
        continue;
      }
    }

    const sm = m.slowTimer > 0 ? 0.5 : 1.0;
    if (m.slowTimer > 0) m.slowTimer -= dt;

    // P0新增：冲锋型怪物AI
    if (m.dash && !m.isDashing) {
      m.dashTimer -= dt;
      if (m.dashTimer <= 0) {
        m.isDashing = true;
        m.dashTimer = 0.8; // 冲锋持续时间
        m.dashVx = (CX - m.x) / dist(m, { x: CX, y: CY }) * m.speed * 3;
        m.dashVy = (CY - m.y) / dist(m, { x: CX, y: CY }) * m.speed * 3;
      }
    }

    if (m.isDashing) {
      m.dashTimer -= dt;
      m.x += m.dashVx * 60 * dt;
      m.y += m.dashVy * 60 * dt;
      spawnParticles(game, m.x, m.y, '#e67e22', 2);
      if (m.dashTimer <= 0) {
        m.isDashing = false;
        m.dashTimer = rand(2, 4);
      }
    } else {
      // 正常移动
      const dx = CX - m.x;
      const dy = CY - m.y;
      const len = Math.hypot(dx, dy);
      if (len > 14) {
        m.x += (dx / len) * m.speed * sm * 60 * dt;
        m.y += (dy / len) * m.speed * sm * 60 * dt;
      }
    }

    // 怪物碰撞玩家
    const dx = CX - m.x;
    const dy = CY - m.y;
    const len = Math.hypot(dx, dy);
    if (len <= 14 + m.size) {
      let dmg = m.dmg;
      if (player.shield > 0) {
        const sd = Math.min(player.shield, dmg);
        player.shield -= sd;
        dmg -= sd;
      }
      player.hp -= dmg;
      game.state.damageFlash = 1.0;
      addShake(game, 0.3);
      playSound('hurt');
      monsters.splice(i, 1);
      spawnParticles(game, CX, CY, '#f00', 6);

      if (player.hp <= 0) {
        player.hp = 0;
        game.state.state = 'DEAD';
        game.state.isNewRecord = saveBestRecord(st.kills, st.survivalTime, player.form);
        playSound('death');
      }
      continue; // 已移除的怪物不再参与本轮远程攻击/动画
    }

    // 远程攻击
    if (m.ranged && len < 300) {
      m.shootTimer += dt;
      const si = m.boss ? 0.5 : 2.0;
      if (m.shootTimer >= si) {
        m.shootTimer = 0;
        if (m.boss) {
          for (let a = -2; a <= 2; a++) {
            const angle = Math.atan2(dy, dx) + a * 0.3;
            bullets.push({
              x: m.x, y: m.y,
              vx: Math.cos(angle) * 3,
              vy: Math.sin(angle) * 3,
              dmg: 0, size: 5, color: '#ff4444',
              life: 3.0, enemy: true
            });
          }
        } else {
          bullets.push({
            x: m.x, y: m.y,
            vx: (dx / len) * 3,
            vy: (dy / len) * 3,
            dmg: 0, size: 3, color: '#a0f',
            life: 3.0, enemy: true
          });
        }
      }
    }

    m.animTimer += dt;
    if (m.animTimer >= 0.3) {
      m.animTimer = 0;
      m.animFrame = 1 - m.animFrame;
    }
  }

  // 敌方子弹命中玩家
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b.enemy) continue;
    if (dist(b, { x: CX, y: CY }) < 14 + b.size) {
      let dmg = (b.size > 4 ? 13 : 5) * st.difficultyMult;
      if (player.shield > 0) {
        const sd = Math.min(player.shield, dmg);
        player.shield -= sd;
        dmg -= sd;
      }
      player.hp -= dmg;
      game.state.damageFlash = 1.0;
      addShake(game, 0.2);
      playSound('hurt');
      bullets.splice(i, 1);
      spawnParticles(game, CX, CY, '#f00', 4);

      if (player.hp <= 0) {
        player.hp = 0;
        game.state.state = 'DEAD';
        game.state.isNewRecord = saveBestRecord(st.kills, st.survivalTime, player.form);
        playSound('death');
      }
    }
  }

  // 更新冲击波（新增）
  if (game.objs.shockwaves) {
    for (let i = game.objs.shockwaves.length - 1; i >= 0; i--) {
      game.objs.shockwaves[i].life -= dt;
      if (game.objs.shockwaves[i].life <= 0) game.objs.shockwaves.splice(i, 1);
    }
  }

  // 更新流星（新增）
  if (game.objs.meteors) {
    game.state.meteorTimer -= dt;
    if (game.state.meteorTimer <= 0) {
      game.state.meteorTimer = rand(2, 10);
      // 从屏幕上方/左方进入
      const fromTop = Math.random() > 0.5;
      const sx = fromTop ? rand(-20, W + 20) : -20;
      const sy = fromTop ? -20 : rand(-20, H * 0.4);
      const angle = fromTop ? (Math.PI / 4 + rand(-0.2, 0.2)) : (rand(-0.2, 0.2));
      game.objs.meteors.push({
        x: sx, y: sy,
        vx: Math.cos(angle) * rand(6, 12),
        vy: Math.sin(angle) * rand(4, 8),
        life: rand(0.4, 1.0),
        maxLife: 1.0,
        size: rand(0.5, 1.5),
      });
    }
    for (let i = game.objs.meteors.length - 1; i >= 0; i--) {
      const mt = game.objs.meteors[i];
      mt.x += mt.vx;
      mt.y += mt.vy;
      mt.life -= dt;
      if (mt.life <= 0 || mt.x > W + 30 || mt.y > H + 30) game.objs.meteors.splice(i, 1);
    }
  }

  // 更新粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // 更新闪电
  for (let i = lightnings.length - 1; i >= 0; i--) {
    lightnings[i].life -= dt;
    if (lightnings[i].life <= 0) lightnings.splice(i, 1);
  }

  // 更新浮动文字
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y -= 32 * dt;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  // 更新震屏
  game.state.damageFlash = Math.max(0, game.state.damageFlash - dt * 3);
  game.state.ultimateFlash = Math.max(0, game.state.ultimateFlash - dt * 1.5);
  game.state.evolveFlash = Math.max(0, game.state.evolveFlash - dt * 1.2);
  game.state.screenShake = Math.max(0, game.state.screenShake - dt * 3);

  if (game.state.screenShake > 0) {
    game.state.screenShakeX = rand(-1, 1) * game.state.screenShake * 5;
    game.state.screenShakeY = rand(-1, 1) * game.state.screenShake * 5;
  } else {
    game.state.screenShakeX = 0;
    game.state.screenShakeY = 0;
  }

  // 连击超时
  game.state.comboTimer = Math.max(0, game.state.comboTimer - dt);
  if (game.state.comboTimer <= 0 && game.state.comboCount > 0) {
    game.state.comboCount = 0;
    game.state.comboMultiplier = 1.0;
  }

  // 触摸反馈
  if (game.config.touchFeedback.timer > 0) {
    game.config.touchFeedback.timer -= dt;
    if (game.config.touchFeedback.timer <= 0) {
      game.config.touchFeedback.active = false;
    }
  }

  // BOSS死亡计时
  if (game.state.bossDeadTimer > 0) game.state.bossDeadTimer -= dt;
}

// ==================== 导出 ====================
export {
  resetPlayer,
  resetGame,
  addShake,
  addCombo,
  checkForm,
  checkSlotUnlock,
  checkMilestone,
  checkLevelUp,
  selectTalent,
  initBgStars,
  initBgLayers,
  initNebula,
  initMeteors,
  update,
};
