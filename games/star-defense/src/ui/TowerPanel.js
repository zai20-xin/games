// ================================================================
// 塔信息面板
// 包含：升级、觉醒（P2-1）、专精选择（P2-8）、换肤（P4-8）
// ================================================================
import { TOWER_LEVEL_MULT, ECONOMY, MAX_TOWER_LEVEL } from '../core/Constants.js';
import { getSkinsForTower, isSkinUnlocked, getSkinById } from '../data/TowerSkins.js';

export class TowerPanel {
  constructor() {
    this.panel = document.getElementById('towerPanel');
    this.panelTitle = document.getElementById('panelTitle');
    this.panelLevel = document.getElementById('panelLevel');
    this.panelStats = document.getElementById('panelStats');
    this.panelUpgrade = document.getElementById('panelUpgrade');
    this.panelSell = document.getElementById('panelSell');
    this.panelBranches = document.getElementById('panelBranches');

    /** 当前选中的塔 */
    this.selectedTower = null;

    // 绑定按钮事件（带点击反馈）
    this._addClickFeedback(this.panelUpgrade);
    this.panelUpgrade.addEventListener('click', () => {
      if (this.onUpgrade) this.onUpgrade(this.selectedTower, null);
    });
    this._addClickFeedback(this.panelSell);
    this.panelSell.addEventListener('click', () => {
      if (this.onSell) this.onSell(this.selectedTower);
    });
    const closeBtn = document.querySelector('.btn-close-panel');
    this._addClickFeedback(closeBtn);
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    /** 回调函数 */
    this.onUpgrade = null;
    this.onSell = null;
    this.onAwaken = null;        // P2-1：觉醒
    this.onChooseSpec = null;    // P2-8：选专精
    this.onChangeSkin = null;    // P4-8：换肤

    // 动态创建分支选择容器（如HTML中不存在）
    if (!this.panelBranches) {
      this.panelBranches = document.createElement('div');
      this.panelBranches.id = 'panelBranches';
      this.panelBranches.style.marginTop = '8px';
      // 插入到按钮容器的父级（towerPanel）中，在按钮容器之前
      const panelButtons = this.panel.querySelector('.panel-buttons');
      if (panelButtons) {
        this.panel.insertBefore(this.panelBranches, panelButtons);
      } else {
        this.panel.appendChild(this.panelBranches);
      }
    }

    // P4-8：换肤弹层容器
    this._skinOverlay = null;
  }

  /**
   * 设置回调
   */
  setUpgradeCallback(cb) { this.onUpgrade = cb; }
  setSellCallback(cb) { this.onSell = cb; }
  setAwakenCallback(cb) { this.onAwaken = cb; }            // P2-1
  setChooseSpecCallback(cb) { this.onChooseSpec = cb; }    // P2-8
  setChangeSkinCallback(cb) { this.onChangeSkin = cb; }    // P4-8

  /**
   * 打开面板
   */
  open(tower, canvasRect, containerRect, gridW, gridH) {
    this.selectedTower = tower;
    this._updateContent();
    this.panel.classList.add('visible');

    // 计算面板位置（tower.x/y 是逻辑坐标，需转换为CSS像素）
    const scaleX = canvasRect.width / (gridW || canvasRect.width);
    const scaleY = canvasRect.height / (gridH || canvasRect.height);

    let px = tower.x * scaleX + canvasRect.left - containerRect.left + 30;
    let py = tower.y * scaleY + canvasRect.top - containerRect.top - 60;

    // 防止超出右边界
    if (px + 220 > canvasRect.width) {
      px = tower.x * scaleX + canvasRect.left - containerRect.left - 230;
    }
    // 防止超出上边界
    if (py < 0) py = 10;
    // 防止超出下边界（面板高度约320px，底栏约100px）
    const maxBottom = canvasRect.height - 330;
    if (py > maxBottom) py = maxBottom;

    this.panel.style.left = px + 'px';
    this.panel.style.top = py + 'px';
  }

  /**
   * 关闭面板
   */
  close() {
    this.selectedTower = null;
    this.panel.classList.remove('visible');
    this._closeSkinOverlay();
  }

  /**
   * 给按钮添加点击弹性反馈
   * @param {HTMLElement} btn
   */
  _addClickFeedback(btn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.style.transform = 'scale(0.92)';
      btn.style.transition = 'transform 0.1s cubic-bezier(0.34,1.56,0.64,1)';
      setTimeout(() => {
        btn.style.transform = '';
        btn.style.transition = '';
      }, 150);
    });
  }

  /**
   * 更新面板内容（含分支选择 / 觉醒 / 专精 / 换肤）
   */
  _updateContent() {
    if (!this.selectedTower) return;
    const tower = this.selectedTower;
    const t = tower.type;
    const level = tower.level;
    const awakened = tower.awakenedTier || 0;

    // 等级星星（含觉醒档位）
    const stars = '★'.repeat(level) + '☆'.repeat(3 - level);
    let levelText = `<span style="color:#ffdd44;">${stars}</span> <span style="font-size:12px;color:#aa8877;">Lv.${level}`;
    if (awakened > 0) {
      levelText += ` <span style="color:#ff88ff;font-weight:bold;">+${awakened}</span>`;
    }
    levelText += `</span>`;

    this.panelTitle.textContent = t.name;
    this.panelTitle.style.color = t.color;
    this.panelLevel.innerHTML = levelText;

    // 计算实际属性
    let statsHtml = '';
    if (t.type === 'attack') {
      const actualDamage = tower.getDamage ? tower.getDamage() : (t.damage * TOWER_LEVEL_MULT.DAMAGE(level));
      const actualRange = tower.getRangeCells ? tower.getRangeCells() : (t.range * TOWER_LEVEL_MULT.RANGE(level));
      const actualFireRate = tower.getFireRate ? tower.getFireRate() : (t.fireRate * TOWER_LEVEL_MULT.FIRE_RATE(level));
      statsHtml += `伤害: <span>${actualDamage.toFixed(1)}</span><br>`;
      statsHtml += `射程: <span>${actualRange.toFixed(1)}</span><br>`;
      statsHtml += `攻速: <span>${actualFireRate.toFixed(2)}s</span><br>`;
    } else if (t.supportType === 'shield') {
      const shieldRange = tower.getShieldRange ? tower.getShieldRange() : (t.range * TOWER_LEVEL_MULT.SHIELD_RANGE(level));
      statsHtml += `护盾射程: <span>${shieldRange.toFixed(1)}</span><br>`;
    } else if (t.supportType === 'energy') {
      const energyOutput = tower.getEnergyOutput ? tower.getEnergyOutput() : TOWER_LEVEL_MULT.ENERGY_OUTPUT(level);
      statsHtml += `能量产出: <span>${energyOutput}/5s</span><br>`;
    } else if (t.supportType === 'summon') {
      const cnt = (t.summonCount || 2) + (tower.specLevel || 0);
      const hp = (t.summonHp || 50) * (1 + (tower.specLevel || 0) * 0.3);
      statsHtml += `召唤数: <span>${cnt}</span><br>`;
      statsHtml += `小虫HP: <span>${hp.toFixed(0)}</span><br>`;
    } else if (t.supportType === 'curse') {
      statsHtml += `诅咒范围: <span>${(tower.getRangeCells ? tower.getRangeCells() : t.range).toFixed(1)}</span><br>`;
    }
    statsHtml += `总投入: <span style="color:#ffdd44;">${tower.totalInvested} ★</span>`;
    this.panelStats.innerHTML = statsHtml;

    // 清空动态容器
    this.panelBranches.innerHTML = '';

    // ===========================================================
    // 1) P2-8 专精选择（level===3 且未选专精时优先弹）
    // ===========================================================
    if (tower.needsSpecChoice && tower.needsSpecChoice() && t.specializations) {
      this._renderSpecChoice(tower, t);
      // 升级/觉醒按钮在选专精期间隐藏
      this.panelUpgrade.style.display = 'none';
      this._removeAwakenButton();
      this.panelSell.style.display = '';
      const refund = tower.getSellValue();
      this.panelSell.textContent = `出售 (+${refund}★)`;
      this._appendSkinButton();
      return;
    }

    // ===========================================================
    // 2) 升级按钮 + P2-1 觉醒按钮
    // ===========================================================
    this.panelUpgrade.style.display = '';
    this.panelSell.style.display = '';

    if (level < MAX_TOWER_LEVEL) {
      // 正常升级路径
      const cost = tower.getUpgradeCost();
      this.panelUpgrade.textContent = `升级 (${cost}★)`;
      this.panelUpgrade.classList.remove('maxed');
      this.panelUpgrade.disabled = false;
      this._removeAwakenButton();
    } else {
      // 已满 3 级 → 升级按钮变"已满级"
      this.panelUpgrade.textContent = '已满级';
      this.panelUpgrade.classList.add('maxed');
      this.panelUpgrade.disabled = true;
      // P2-1：觉醒按钮（独立按钮，叠加在按钮容器里）
      this._renderAwakenButton(tower, t);
    }

    // ===========================================================
    // 3) 专精/分支信息展示（已选后）
    // ===========================================================
    if (tower.chosenSpec && t.specializations && t.specializations[tower.chosenSpec]) {
      this._renderSpecInfo(tower, t);
    } else if (tower.branch && t.upgradeBranches && t.upgradeBranches[tower.branch]) {
      // 兼容老分支字段
      this._renderBranchInfo(tower, t);
    }

    // 出售按钮
    const refund = tower.getSellValue();
    this.panelSell.textContent = `出售 (+${refund}★)`;

    // P4-8：换肤按钮（始终显示）
    this._appendSkinButton();
  }

  // ================================================================
  // P2-1 觉醒按钮渲染
  // ================================================================
  _renderAwakenButton(tower, t) {
    this._removeAwakenButton();
    if (!tower.canAwaken || !tower.canAwaken()) return;
    const cfg = t.awakening;
    if (!cfg || !cfg.tiers) return;
    const next = tower.awakenedTier + 1;
    const tierData = cfg.tiers.find(x => x.tier === next);
    if (!tierData) return;

    const btn = document.createElement('button');
    btn.id = 'panelAwaken';
    btn.className = 'panel-btn awaken-btn';
    btn.style.cssText = 'display:block;width:100%;margin:4px 0;padding:6px;font-size:12px;cursor:pointer;background:linear-gradient(90deg,#3a1a4a,#5a2a6a);color:#ffddff;border:1px solid #ff88ff;border-radius:4px;box-shadow:0 0 6px rgba(255,136,255,0.4);';
    const effSummary = this._summarizeEffect(tierData.effect);
    btn.innerHTML = `<div style="font-weight:bold;">🌟 觉醒至 Tier ${next}：${tierData.name} <span style="color:#ffdd44;">(${tierData.cost}✦)</span></div><div style="font-size:10px;opacity:0.85;">${effSummary}</div>`;
    btn.addEventListener('click', () => {
      if (this.onAwaken) this.onAwaken(tower);
    });
    // 插入到按钮容器前
    const panelButtons = this.panel.querySelector('.panel-buttons');
    if (panelButtons) {
      this.panel.insertBefore(btn, panelButtons);
    } else {
      this.panel.appendChild(btn);
    }
  }

  _removeAwakenButton() {
    const old = this.panel.querySelector('#panelAwaken');
    if (old) old.remove();
  }

  _summarizeEffect(eff) {
    if (!eff) return '';
    const parts = [];
    if (eff.damageMult) parts.push(`伤害×${eff.damageMult}`);
    if (eff.fireRateMult) parts.push(`攻速×${eff.fireRateMult}`);
    if (eff.rangeMult) parts.push(`射程×${eff.rangeMult}`);
    if (eff.pierce) parts.push(`穿透+${eff.pierce}`);
    if (eff.splashMult) parts.push(`溅射×${eff.splashMult}`);
    if (eff.chainBonus) parts.push(`链式+${eff.chainBonus}`);
    if (eff.shieldReduction) parts.push(`减伤+${Math.round(eff.shieldReduction * 100)}%`);
    if (eff.shieldRangeMult) parts.push(`护盾范围×${eff.shieldRangeMult}`);
    if (eff.energyMult) parts.push(`能量×${eff.energyMult}`);
    if (eff.healMult) parts.push(`治疗×${eff.healMult}`);
    if (eff.slowMult) parts.push(`减速×${eff.slowMult}`);
    if (eff.freezeChance) parts.push(`冻结+${Math.round(eff.freezeChance * 100)}%`);
    if (eff.pullChance) parts.push(`牵引+${Math.round(eff.pullChance * 100)}%`);
    if (eff.executeThreshold) parts.push(`斩杀<${Math.round(eff.executeThreshold * 100)}%`);
    if (eff.summonCount) parts.push(`召唤+${eff.summonCount}`);
    if (eff.summonHp) parts.push(`小虫HP×${eff.summonHp}`);
    if (eff.curseDpsMult) parts.push(`诅咒×${eff.curseDpsMult}`);
    if (eff.splashRadius) parts.push(`溅射半径+${eff.splashRadius}`);
    if (eff.dmgCap) parts.push(`伤害无上限`);
    if (eff.armorPen) parts.push(`穿甲+${Math.round(eff.armorPen * 100)}%`);
    return parts.join(' / ') || '属性强化';
  }

  // ================================================================
  // P2-8 专精选择（满 3 级首次弹）
  // ================================================================
  _renderSpecChoice(tower, t) {
    this.panelBranches.innerHTML = '';
    const header = document.createElement('div');
    header.style.cssText = 'font-size:12px;color:#ffdd44;margin:4px 0;text-align:center;';
    header.textContent = '⚔️ 满级！请选择专精路线：';
    this.panelBranches.appendChild(header);

    Object.entries(t.specializations).forEach(([key, spec]) => {
      const btn = document.createElement('button');
      btn.className = 'panel-btn spec-btn';
      btn.style.cssText = `display:block;width:100%;margin:4px 0;padding:8px;font-size:12px;cursor:pointer;background:#1a1a3a;color:#aaccff;border:1px solid #6688ff;border-radius:4px;`;
      btn.innerHTML = `<div style="font-weight:bold;">${spec.icon || '✦'} ${key}：${spec.name}</div><div style="font-size:10px;opacity:0.85;">${spec.desc}</div>`;
      btn.addEventListener('click', () => {
        if (this.onChooseSpec) this.onChooseSpec(tower, key);
        // 立即重绘：选完专精后展示 specInfo
        this._updateContent();
      });
      this.panelBranches.appendChild(btn);
    });
  }

  _renderSpecInfo(tower, t) {
    const spec = t.specializations[tower.chosenSpec];
    if (!spec) return;
    const info = document.createElement('div');
    info.style.cssText = 'font-size:11px;color:#aaccff;margin:4px 0;padding:4px;background:rgba(102,136,255,0.08);border-left:2px solid #6688ff;';
    info.innerHTML = `${spec.icon || '✦'} <b>专精 ${tower.chosenSpec}：${spec.name}</b> Lv.${tower.specLevel || 1}/${spec.maxLvl}<br><span style="opacity:0.8;">${spec.desc}</span>`;
    this.panelBranches.appendChild(info);
  }

  _renderBranchInfo(tower, t) {
    const b = t.upgradeBranches[tower.branch];
    if (!b) return;
    const info = document.createElement('div');
    info.style.cssText = 'font-size:11px;color:#aa8877;margin:4px 0;';
    info.textContent = `分支 ${tower.branch}：${b.name} (Lv.${tower.branchUpgrades})`;
    this.panelBranches.appendChild(info);
  }

  // ================================================================
  // P4-8 换肤按钮 + 弹层
  // ================================================================
  _appendSkinButton() {
    this._removeSkinButton();
    if (!this.selectedTower) return;
    const skins = getSkinsForTower(this.selectedTower.type.id);
    if (!skins || skins.length <= 1) return; // 只有 1 个皮肤就不显示按钮

    const btn = document.createElement('button');
    btn.id = 'panelSkin';
    btn.className = 'panel-btn skin-btn';
    btn.style.cssText = 'display:block;width:100%;margin:4px 0;padding:5px;font-size:11px;cursor:pointer;background:rgba(60,40,80,0.5);color:#ffcc55;border:1px solid #aa88cc;border-radius:4px;';
    const current = getSkinById(this.selectedTower.skin);
    btn.textContent = `🎨 换肤（当前：${current ? current.name : '默认'}）`;
    btn.addEventListener('click', () => {
      this._toggleSkinOverlay();
    });
    this.panelBranches.appendChild(btn);
  }

  _removeSkinButton() {
    const old = this.panel.querySelector('#panelSkin');
    if (old) old.remove();
  }

  _toggleSkinOverlay() {
    if (this._skinOverlay) {
      this._closeSkinOverlay();
    } else {
      this._openSkinOverlay();
    }
  }

  _openSkinOverlay() {
    if (!this.selectedTower) return;
    const t = this.selectedTower.type;
    const profile = (this.onGetProfile && this.onGetProfile()) || null;
    const skins = getSkinsForTower(t.id);

    // 先关闭已有的
    this._closeSkinOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'skinOverlay';
    
    // 智能判断展开方向：如果面板在屏幕下半部分，向上展开；否则向下展开
    const panelRect = this.panel.getBoundingClientRect();
    const spaceBelow = window.innerHeight - panelRect.bottom;
    const spaceAbove = panelRect.top;
    const expandUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    
    const baseStyle = 'position:absolute;left:0;width:100%;max-height:160px;overflow-y:auto;background:rgba(20,10,30,0.98);backdrop-filter:blur(10px);border:1px solid #aa88cc;border-radius:6px;padding:6px;z-index:1000;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    
    if (expandUp) {
      overlay.style.cssText = baseStyle + 'bottom:100%;margin-bottom:4px;';
    } else {
      overlay.style.cssText = baseStyle + 'top:100%;margin-top:4px;';
    }

    skins.forEach(skin => {
      const unlocked = isSkinUnlocked(skin.id, profile);
      const isCurrent = this.selectedTower.skin === skin.id;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px 8px;margin:3px 0;border-radius:4px;cursor:${unlocked ? 'pointer' : 'not-allowed'};background:${isCurrent ? 'rgba(255,204,85,0.2)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isCurrent ? '#ffcc55' : 'transparent'};opacity:${unlocked ? '1' : '0.5'};transition:all 0.15s ease;`;
      
      // hover效果
      if (unlocked) {
        row.addEventListener('mouseenter', () => {
          if (!isCurrent) row.style.background = 'rgba(255,255,255,0.08)';
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = isCurrent ? 'rgba(255,204,85,0.2)' : 'rgba(255,255,255,0.03)';
        });
      }
      
      // 色块
      const sw = document.createElement('span');
      sw.style.cssText = `display:inline-block;width:16px;height:16px;border-radius:50%;background:${skin.color};box-shadow:0 0 8px ${skin.glowColor};flex-shrink:0;`;
      // 文本
      const txt = document.createElement('span');
      txt.style.cssText = 'flex:1;font-size:12px;color:#eee;';
      txt.innerHTML = `<b>${skin.name}</b> <span style="color:#aa88cc;font-size:10px;">${unlocked ? (isCurrent ? '✓ 当前' : '点击使用') : '🔒 ' + skin.unlock}</span>`;
      row.appendChild(sw);
      row.appendChild(txt);
      if (unlocked) {
        row.addEventListener('click', () => {
          if (this.onChangeSkin) this.onChangeSkin(this.selectedTower, skin.id);
          this._updateContent();
          this._closeSkinOverlay();
        });
      }
      overlay.appendChild(row);
    });

    this.panel.appendChild(overlay);
    this._skinOverlay = overlay;
  }

  _closeSkinOverlay() {
    if (this._skinOverlay && this._skinOverlay.parentNode) {
      this._skinOverlay.parentNode.removeChild(this._skinOverlay);
    }
    this._skinOverlay = null;
  }

  /**
   * 更新面板（能量变化时）
   */
  update(energy) {
    if (!this.selectedTower) return;
    this._updateContent();
  }

  /**
   * 是否打开
   */
  isOpen() {
    return this.panel.classList.contains('visible');
  }
}
