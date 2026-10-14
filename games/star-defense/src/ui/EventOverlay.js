// ================================================================
// 事件覆盖层（P2-7） - 波次间随机事件的简单接受/拒绝 UI
// 接受：调用 onAccept(event)，等待回调后隐藏
// 拒绝：调用 onDecline(event)，等待回调后隐藏
// 调用方（BattleMode）需负责触发时机与 game 状态应用
// ================================================================

/**
 * 单例模式：每个 battle 一份，避免重复弹窗
 */
export class EventOverlay {
  constructor() {
    this.container = null;
    this.onAccept = null;
    this.onDecline = null;
    this._currentEvent = null;
    this._showing = false;
  }

  /**
   * 显示事件弹窗
   * @param {Object} event 来自 WAVE_EVENTS 的事件对象
   * @param {Function} onAccept 接受回调
   * @param {Function} onDecline 拒绝回调
   */
  show(event, onAccept, onDecline) {
    if (this._showing) return false;
    this._currentEvent = event;
    this.onAccept = onAccept || (() => {});
    this.onDecline = onDecline || (() => {});
    this._ensureContainer();
    this._render();
    this.container.classList.remove('hidden');
    this._showing = true;
    return true;
  }

  /**
   * 隐藏
   */
  hide() {
    if (this.container) this.container.classList.add('hidden');
    this._showing = false;
    this._currentEvent = null;
  }

  /**
   * 是否正在显示
   */
  isVisible() {
    return this._showing;
  }

  /**
   * 创建/复用弹窗容器
   */
  _ensureContainer() {
    if (this.container && document.body.contains(this.container)) return;
    const div = document.createElement('div');
    div.id = 'waveEventOverlay';
    div.className = 'hidden';
    div.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      display: flex; align-items: center; justify-content: center;
      z-index: 9000;
      background: rgba(10, 6, 18, 0.65);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(div);
    this.container = div;
  }

  /**
   * 渲染弹窗内容
   */
  _render() {
    if (!this._currentEvent || !this.container) return;
    const e = this._currentEvent;
    const typeColor = {
      positive: '#44ddff',
      negative: '#ff8866',
      neutral: '#ffcc55',
    }[e.type] || '#aaaacc';
    const typeLabel = {
      positive: '增益',
      negative: '挑战',
      neutral: '情报',
    }[e.type] || '事件';

    this.container.innerHTML = `
      <div style="
        max-width: 420px; width: calc(100% - 40px);
        background: linear-gradient(180deg, rgba(30,15,40,0.96) 0%, rgba(20,10,30,0.94) 100%);
        border: 1px solid ${typeColor}44;
        border-radius: 18px;
        padding: 28px 26px 22px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px ${typeColor}22, inset 0 1px 0 rgba(255,255,255,0.05);
        text-align: center;
      ">
        <div style="
          font-size: 9px; color: ${typeColor}; letter-spacing: 2px;
          font-weight: 800; text-transform: uppercase; margin-bottom: 10px;
        ">${typeLabel} · WAVE EVENT</div>
        <div style="font-size: 56px; line-height: 1; margin-bottom: 8px; filter: drop-shadow(0 4px 12px ${typeColor}55);">${e.icon || '✨'}</div>
        <div style="font-size: 22px; font-weight: 800; color: #f0e8ff; margin-bottom: 12px; letter-spacing: 1px;">${e.name}</div>
        <div style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 22px;">${e.desc}</div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="waveEventAccept" style="
            flex: 1; max-width: 160px; padding: 12px 16px; border-radius: 10px;
            background: linear-gradient(135deg, ${typeColor}cc, ${typeColor}88);
            border: 1px solid ${typeColor}cc; color: #fff;
            font-size: 13px; font-weight: 700; letter-spacing: 0.5px;
            cursor: pointer; box-shadow: 0 4px 16px ${typeColor}33;
            transition: all 0.2s ease;
          " onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px ${typeColor}55'"
             onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 16px ${typeColor}33'"
          >接受</button>
          <button id="waveEventDecline" style="
            flex: 1; max-width: 160px; padding: 12px 16px; border-radius: 10px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.55); font-size: 13px; font-weight: 600;
            cursor: pointer; transition: all 0.2s ease;
          " onmouseenter="this.style.background='rgba(255,255,255,0.08)';this.style.color='rgba(255,255,255,0.8)'"
             onmouseleave="this.style.background='rgba(255,255,255,0.04)';this.style.color='rgba(255,255,255,0.55)'"
          >${e.declineDesc || '拒绝'}</button>
        </div>
      </div>
    `;

    const acceptBtn = this.container.querySelector('#waveEventAccept');
    const declineBtn = this.container.querySelector('#waveEventDecline');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cb = this.onAccept;
        const evt = this._currentEvent;
        this.hide();
        if (cb) cb(evt);
      });
    }
    if (declineBtn) {
      declineBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cb = this.onDecline;
        const evt = this._currentEvent;
        this.hide();
        if (cb) cb(evt);
      });
    }
  }
}
