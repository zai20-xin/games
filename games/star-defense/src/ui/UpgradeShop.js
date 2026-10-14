// ================================================================
// 升级商店 UI — 消费星尘结晶购买永久升级
// 在主菜单「升级商店」按钮处打开
// ================================================================
import { loadProfile, saveProfile, canUpgrade, purchaseUpgrade, UPGRADE_TREES } from '../data/PlayerProfile.js';

export class UpgradeShop {
  constructor() {
    this.onClose = null;   // 关闭回调
    this.meta = null;      // MetaProgression 实例（由外部注入，保证数据同步）
    this._buildDOM();
  }

  /**
   * 注入 MetaProgression 实例（必须在 open 前调用）
   * @param {import('../systems/MetaProgression.js').MetaProgression} meta
   */
  setMeta(meta) {
    this.meta = meta;
  }

  /** 构建 DOM（只执行一次）*/
  _buildDOM() {
    // 创建全屏遮罩
    this.el = document.createElement('div');
    this.el.id = 'upgradeShop';
    this.el.className = 'overlay-style';
    this.el.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(5,5,20,0.92); z-index:1000;
      display:none; flex-direction:column; align-items:center;
      overflow-y:auto; padding:20px; box-sizing:border-box;
    `;

    this.el.innerHTML = `
      <div class="us-inner">
        <div class="us-header">
          <h2 class="us-title">⬡ 升级商店</h2>
          <div class="us-header-right">
            <div id="usStardust" class="us-stardust">✦ 0</div>
            <button id="usCloseBtn" class="us-close-btn">关闭</button>
          </div>
        </div>
        <div id="usTrees" class="us-trees"></div>
      </div>
    `;

    document.body.appendChild(this.el);

    document.getElementById('usCloseBtn').addEventListener('click', () => this.close());
  }

  /** 打开商店（刷新数据）*/
  open() {
    this._refresh();
    this.el.style.display = 'flex';
  }

  /** 关闭商店 */
  close() {
    this.el.style.display = 'none';
    if (this.onClose) this.onClose();
  }

  /** 刷新显示 */
  _refresh() {
    // 优先使用注入的meta实例，保证数据同步；否则独立加载
    const profile = this.meta ? this.meta.getProfile() : loadProfile();
    document.getElementById('usStardust').textContent = `✦ ${profile.stardust}`;

    const container = document.getElementById('usTrees');
    container.innerHTML = '';

    for (const [treeKey, tree] of Object.entries(UPGRADE_TREES)) {
      const treeEl = this._renderTree(treeKey, tree, profile);
      container.appendChild(treeEl);
    }
  }

  /** 渲染单棵升级树 */
  _renderTree(treeKey, tree, profile) {
    const wrap = document.createElement('div');
    wrap.className = 'us-tree';
    wrap.style.borderColor = `${tree.color}88`;

    // 标题
    const title = document.createElement('div');
    title.className = 'us-tree-title';
    title.style.color = tree.color;
    title.textContent = `${tree.icon} ${tree.label}`;
    wrap.appendChild(title);

    // 升级节点网格
    const grid = document.createElement('div');
    grid.className = 'us-grid';

    for (const node of tree.nodes) {
      const card = this._renderNode(treeKey, tree, node, profile);
      grid.appendChild(card);
    }

    wrap.appendChild(grid);
    return wrap;
  }

  /** 渲染单个升级节点 */
  _renderNode(treeKey, tree, node, profile) {
    const currentLvl = profile.upgradeLevels[node.id] || 0;
    const maxed = currentLvl >= node.maxLvl;
    const affordable = profile.stardust >= node.cost;
    const prereqMet = !node.req || (profile.upgradeLevels[node.req] >= 1);
    const canBuy = !maxed && affordable && prereqMet;

    const card = document.createElement('div');
    card.className = 'us-node' + (prereqMet ? '' : ' us-node--locked');

    // 等级标签
    const lvlBadge = document.createElement('div');
    lvlBadge.className = 'us-lvl-badge ' + (maxed ? 'us-lvl-badge--maxed' : 'us-lvl-badge--normal');
    lvlBadge.textContent = maxed ? 'MAX' : `${currentLvl}/${node.maxLvl}`;
    card.appendChild(lvlBadge);

    // 名称
    const name = document.createElement('div');
    name.className = 'us-node-name';
    name.textContent = node.label;
    card.appendChild(name);

    // 描述
    const desc = document.createElement('div');
    desc.className = 'us-node-desc';
    desc.textContent = node.desc;
    card.appendChild(desc);

    // 费用 + 按钮
    const footer = document.createElement('div');
    footer.className = 'us-node-footer';

    const cost = document.createElement('span');
    cost.className = 'us-cost ' + (affordable ? 'us-cost--affordable' : 'us-cost--expensive');
    cost.textContent = `✦ ${node.cost}`;
    footer.appendChild(cost);

    const btn = document.createElement('button');
    btn.textContent = maxed ? '已满级' : '升级';
    btn.disabled = !canBuy;
    btn.className = 'us-buy-btn';
    if (canBuy) {
      btn.style.background = tree.color;
      btn.style.color = '#000';
    } else {
      btn.style.background = '#444';
      btn.style.color = '#777';
    }

    if (canBuy) {
      btn.addEventListener('click', () => {
        let ok;
        if (this.meta) {
          // 使用meta实例购买，确保效果刷新和数据同步
          const result = this.meta.buyUpgrade(node.id);
          ok = result.success;
        } else {
          ok = purchaseUpgrade(profile, node.id);
          if (ok) {
            saveProfile(profile);
          }
        }
        if (ok) {
          // 播放购买成功反馈
          btn.style.transform = 'scale(0.95)';
          setTimeout(() => { btn.style.transform = ''; }, 150);
          this._refresh();
        }
      });
    }

    footer.appendChild(btn);
    card.appendChild(footer);

    // 前置条件提示
    if (!prereqMet) {
      const prereqNode = this._findNode(treeKey, node.req);
      const hint = document.createElement('div');
      hint.className = 'us-prereq-hint';
      hint.textContent = `需要先升级：${prereqNode ? prereqNode.label : node.req}`;
      card.appendChild(hint);
    }

    return card;
  }

  /** 在全部升级树中按 ID 查找节点（用于显示前置名称）*/
  _findNode(nodeId) {
    for (const tree of Object.values(UPGRADE_TREES)) {
      const found = tree.nodes.find(n => n.id === nodeId);
      if (found) return found;
    }
    return null;
  }
}
