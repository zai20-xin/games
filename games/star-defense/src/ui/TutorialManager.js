export class TutorialManager {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.active = false;
    this.step = 0;
    this.overlay = null;
    this.tooltip = null;
    this.highlight = null;
    this.arrow = null;

    // 教学步骤
    this.steps = [
      {
        text: '欢迎来到星际防线！点击底部的防御塔卡片选择要建造的塔',
        target: '#bottomBar', arrow: 'up'
      },
      {
        text: '点击地图上的高亮格子放置防御塔',
        target: '#gameCanvas', arrow: 'center', waitFor: 'tower:placed'
      },
      {
        text: '很好！点击「下一波」按钮开始战斗',
        target: '#nextWaveBtn', arrow: 'down', waitFor: 'wave:started'
      },
      {
        text: '观察战斗！点击塔可以查看详情和升级',
        target: '#gameCanvas', arrow: 'center', waitFor: 'tower:upgraded'
      },
      { text: '组合不同类型的塔可以触发组合效果，获得额外加成！', target: null, arrow: null },
      { text: '教学完成！祝你好运，指挥官！', target: null, arrow: null },
    ];
  }

  start() {
    if (localStorage.getItem('star-defense-tutorial-done')) return;
    this.active = true;
    this.step = 0;
    this._createOverlay();
    this._showStep(0);
  }

  _createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'tutorialOverlay';
    this.overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:200;pointer-events:none;';
    this.container.appendChild(this.overlay);

    // 目标高亮框
    this.highlight = document.createElement('div');
    this.highlight.className = 'tutorial-highlight';
    this.overlay.appendChild(this.highlight);

    // 指示箭头
    this.arrow = document.createElement('div');
    this.arrow.className = 'tutorial-arrow';
    this.overlay.appendChild(this.arrow);

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'tutorialTooltip';
    this.overlay.appendChild(this.tooltip);
  }

  _showStep(idx) {
    if (idx >= this.steps.length) {
      this.end();
      return;
    }
    this.step = idx;
    const step = this.steps[idx];

    this.tooltip.innerHTML = `
      <div class="tutorial-step">${idx + 1}/${this.steps.length}</div>
      <div class="tutorial-text">${step.text}</div>
      <button class="tutorial-next">${step.waitFor ? '知道了' : '下一步'}</button>
    `;
    this.tooltip.querySelector('.tutorial-next').addEventListener('click', () => {
      if (step.waitFor) {
        const handler = () => {
          this.eventBus.off(step.waitFor, handler);
          this._showStep(idx + 1);
        };
        this.eventBus.on(step.waitFor, handler);
        this.tooltip.querySelector('.tutorial-next').textContent = '等待中...';
        this.tooltip.querySelector('.tutorial-next').disabled = true;
      } else {
        this._showStep(idx + 1);
      }
    });

    // 定位（让 tooltip 贴着目标元素）
    this._positionStep(step);
  }

  _positionStep(step) {
    const tooltip = this.tooltip;
    const highlight = this.highlight;
    const arrow = this.arrow;

    // 重置默认位置
    tooltip.classList.remove('tip-anchor-bottom', 'tip-anchor-top', 'tip-anchor-center');
    highlight.style.display = 'none';
    arrow.style.display = 'none';

    if (!step.target) {
      // 居中显示
      tooltip.classList.add('tip-anchor-center');
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      // 找不到目标时退回到居中
      tooltip.classList.add('tip-anchor-center');
      return;
    }

    // 算出目标元素在 overlay 内的位置
    const containerRect = this.container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const x = rect.left - containerRect.left;
    const y = rect.top - containerRect.top;
    const w = rect.width;
    const h = rect.height;

    // 1) 高亮框
    highlight.style.display = 'block';
    const pad = 6;
    highlight.style.left = (x - pad) + 'px';
    highlight.style.top = (y - pad) + 'px';
    highlight.style.width = (w + pad * 2) + 'px';
    highlight.style.height = (h + pad * 2) + 'px';

    // 2) 决定 tooltip 放哪
    if (step.arrow === 'up') {
      // tooltip 在目标下方
      tooltip.classList.add('tip-anchor-bottom');
      tooltip.style.left = Math.max(20, Math.min(containerRect.width - 420, x + w / 2 - 200)) + 'px';
      tooltip.style.top = (y + h + 18) + 'px';
      // 箭头指上
      this._showArrow(x + w / 2, y - 2, 'up');
    } else if (step.arrow === 'down') {
      // tooltip 在目标上方
      tooltip.classList.add('tip-anchor-top');
      tooltip.style.left = Math.max(20, Math.min(containerRect.width - 420, x + w / 2 - 200)) + 'px';
      tooltip.style.top = (y - 18) + 'px';
      tooltip.style.transform = 'translateY(-100%)';
      this._showArrow(x + w / 2, y + h + 2, 'down');
    } else {
      // canvas 中心：tooltip 贴底部
      tooltip.classList.add('tip-anchor-center');
    }
  }

  _showArrow(x, y, dir) {
    const arrow = this.arrow;
    arrow.style.display = 'block';
    arrow.style.left = x + 'px';
    arrow.style.top = y + 'px';
    arrow.classList.remove('arrow-up', 'arrow-down', 'arrow-left', 'arrow-right');
    arrow.classList.add('arrow-' + dir);
  }

  end() {
    this.active = false;
    localStorage.setItem('star-defense-tutorial-done', '1');
    if (this.overlay) this.overlay.remove();
  }

  destroy() {
    this.end();
  }
}
