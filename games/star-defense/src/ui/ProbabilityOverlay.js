// ================================================================
// 概率公示浮层（Phase 5 #7 - 国内合规要求）
//
// 设计目标：实现"打开/关闭"的简单浮层，渲染 PROBABILITY 中的所有类目。
// 不依赖 UIManager（Agent A1 持有）；通过 ID 约定与全局 overlay 协调显隐。
//
// 自动实例化：本模块在文件末尾通过 side-effect 自行 new 一个全局单例。
// 这样 Vite/Webpack 等打包器在 index.html 引入此模块时，会自动挂载到 window。
//
// DOM 约定：
//   - #probabilityOverlay   浮层根元素（由本类动态创建）
//   - #probabilityMenuBtn   入口按钮（由 index.html 静态提供）
//   - #overlay              主菜单/胜利/失败的总容器（用于控制入口按钮的显隐）
// ================================================================

import { PROBABILITY, validateProbabilities } from '../data/ProbabilityConfig.js';

export class ProbabilityOverlay {
  constructor() {
    /** @type {HTMLElement|null} */
    this.overlay = null;
    /** @type {HTMLElement|null} */
    this.menuBtn = null;

    this._build();
    this._initListeners();
    this._initMenuButtonVisibility();

    // 配置自检（开发期警告，不阻塞 UI）
    try {
      validateProbabilities();
    } catch (e) {
      console.warn(e.message);
    }
  }

  // ─────────────────────────────────────────────
  // DOM 构建
  // ─────────────────────────────────────────────
  _build() {
    if (document.getElementById('probabilityOverlay')) {
      this.overlay = document.getElementById('probabilityOverlay');
      return;
    }

    const root = document.getElementById('gameContainer') || document.body;
    const overlay = document.createElement('div');
    overlay.id = 'probabilityOverlay';
    overlay.className = 'probability-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '概率公示');

    overlay.innerHTML = this._renderModal();
    root.appendChild(overlay);
    this.overlay = overlay;
  }

  _renderModal() {
    const cardsHtml = Object.entries(PROBABILITY).map(([, cat]) => {
      const rows = cat.tiers.map((t) => `
        <div class="probability-row">
          <div class="probability-tier-label" style="color:${t.color}">${t.label}</div>
          <div class="probability-tier-weight">${t.weight}%</div>
          <div class="probability-tier-example">${t.example}</div>
        </div>
      `).join('');
      return `
        <div class="probability-card">
          <div class="probability-card-head">
            <span class="probability-card-icon">${cat.icon}</span>
            <div>
              <div class="probability-card-title">${cat.title}</div>
              <div class="probability-card-desc">${cat.desc}</div>
            </div>
          </div>
          <div class="probability-rows">${rows}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="probability-modal glass-panel" id="probabilityModal">
        <div class="probability-modal-head">
          <h2 class="probability-modal-title">概率公示</h2>
          <button class="probability-close-btn" id="probabilityCloseBtn" aria-label="关闭">✕</button>
        </div>
        <div class="probability-disclaimer">
          本游戏所有随机奖励均按下方概率公开抽取，符合国内合规要求。数据长期不变，公示即生效。
        </div>
        <div class="probability-list">${cardsHtml}</div>
        <div class="probability-footer">具体奖励以游戏内实际获得为准</div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  // 事件绑定
  // ─────────────────────────────────────────────
  _initListeners() {
    // 关闭按钮
    const closeBtn = document.getElementById('probabilityCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
      });
    }

    // 点击遮罩（浮层背景）关闭
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.hide();
      });
    }

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });

    // 入口按钮（index.html 静态提供）
    this.menuBtn = document.getElementById('probabilityMenuBtn');
    if (this.menuBtn) {
      this.menuBtn.addEventListener('click', () => this.show());
    }
  }

  // ─────────────────────────────────────────────
  // 入口按钮显隐：仅在主菜单/胜利/失败/科技树等 overlay 页面可见
  // （通过观察 #overlay 的 .hidden class 变化）
  // ─────────────────────────────────────────────
  _initMenuButtonVisibility() {
    if (!this.menuBtn) return;
    const overlay = document.getElementById('overlay');
    if (!overlay) {
      // 没有 #overlay 时，保持按钮可见（兜底）
      this.menuBtn.classList.remove('hidden');
      return;
    }

    const sync = () => {
      const overlayVisible = !overlay.classList.contains('hidden');
      // 当 #probabilityOverlay 自身打开时也隐藏入口按钮（避免重复入口）
      const selfVisible = this.isVisible();
      this.menuBtn.classList.toggle('hidden', !overlayVisible || selfVisible);
    };
    sync();

    // 同步观察 #overlay 与自身显隐
    const observer = new MutationObserver(sync);
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    if (this.overlay) {
      observer.observe(this.overlay, { attributes: true, attributeFilter: ['class'] });
    }
    this._observer = observer;
  }

  // ─────────────────────────────────────────────
  // 公共 API
  // ─────────────────────────────────────────────
  show() {
    if (!this.overlay) this._build();
    if (!this.overlay) return;
    this.overlay.classList.remove('hidden');
    // 重新绑定关闭按钮（_build 重建了 DOM）
    const closeBtn = document.getElementById('probabilityCloseBtn');
    if (closeBtn && !closeBtn._probBound) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
      });
      closeBtn._probBound = true;
    }
  }

  hide() {
    if (!this.overlay) return;
    this.overlay.classList.add('hidden');
  }

  toggle() {
    if (!this.overlay) return;
    this.overlay.classList.toggle('hidden');
  }

  isVisible() {
    return !!this.overlay && !this.overlay.classList.contains('hidden');
  }
}

// ─────────────────────────────────────────────
// 自动实例化：DOM 就绪后挂载全局单例
// 这样 index.html 通过 `<script type="module" src="...">` 引入即可生效，
// 避免被 Vite 之类的打包器 tree-shake 掉。
// ─────────────────────────────────────────────
if (typeof window !== 'undefined') {
  const mount = () => {
    if (!window.__probabilityOverlay__) {
      window.__probabilityOverlay__ = new ProbabilityOverlay();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
}
