// ================================================================
// 剧情对话浮层 - 关卡前/后的对话展示
// 支持打字机效果、点击/空格推进
// ================================================================

export class DialogueOverlay {
  constructor(container) {
    this.container = container || document.getElementById('gameContainer') || document.body;
    this.root = null;
    this._lines = [];
    this._index = 0;
    this._typing = false;
    this._fullText = '';
    this._typedText = '';
    this._typeTimer = null;
    this._advanceHandler = null;
    this._resolve = null;
    this._cleanup = null;
  }

  /**
   * 播放剧情对话
   * @param {Array<{speaker: string, text: string}>} lines
   * @returns {Promise<void>} 全部播完后 resolve
   */
  play(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return Promise.resolve();
    this._lines = lines;
    this._index = 0;
    return new Promise(resolve => {
      this._resolve = resolve;
      this._renderShell();
      this._showCurrent();
    });
  }

  _renderShell() {
    if (this.root) this.root.remove();
    const root = document.createElement('div');
    root.className = 'dialogue-overlay';
    root.innerHTML = `
      <div class="dialogue-box">
        <div class="dialogue-speaker"></div>
        <div class="dialogue-text"></div>
        <div class="dialogue-hint">点击或按空格继续 ▶</div>
      </div>
    `;
    root.style.cssText = `
      position: absolute; inset: 0; z-index: 5000;
      display: flex; align-items: flex-end; justify-content: center;
      padding: 0 0 80px 0; background: rgba(0,0,0,0.35);
      animation: dialogue-fade-in 0.3s ease-out;
    `;
    const box = root.querySelector('.dialogue-box');
    box.style.cssText = `
      max-width: 640px; width: 80%;
      background: linear-gradient(135deg, rgba(40, 24, 48, 0.92), rgba(20, 10, 30, 0.92));
      border: 1px solid rgba(255, 85, 119, 0.5);
      border-radius: 12px; padding: 16px 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      color: #f0e8ff; font-family: inherit;
    `;
    const speaker = root.querySelector('.dialogue-speaker');
    speaker.style.cssText = `
      font-size: 13px; font-weight: bold; color: #ffdd44;
      margin-bottom: 6px; letter-spacing: 1px;
    `;
    const text = root.querySelector('.dialogue-text');
    text.style.cssText = `
      font-size: 15px; line-height: 1.6; min-height: 48px;
      color: #f0e8ff; white-space: pre-wrap;
    `;
    const hint = root.querySelector('.dialogue-hint');
    hint.style.cssText = `
      text-align: right; font-size: 11px; color: #aa99bb; margin-top: 8px;
      opacity: 0.7;
    `;

    this.container.appendChild(root);
    this.root = root;
    this._textEl = text;
    this._speakerEl = speaker;

    // 绑定推进事件
    this._advanceHandler = (e) => {
      if (e) {
        if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Spacebar' && e.key !== 'Enter') return;
        e.preventDefault();
      }
      this._advance();
    };
    root.addEventListener('click', this._advanceHandler);
    document.addEventListener('keydown', this._advanceHandler);
  }

  _showCurrent() {
    if (this._index >= this._lines.length) {
      this._complete();
      return;
    }
    const line = this._lines[this._index];
    this._speakerEl.textContent = line.speaker || '';
    this._fullText = line.text || '';
    this._typedText = '';
    this._typing = true;
    this._typeTimer = setInterval(() => {
      if (this._typedText.length < this._fullText.length) {
        this._typedText += this._fullText[this._typedText.length];
        this._textEl.textContent = this._typedText;
      } else {
        this._finishTyping();
      }
    }, 40);
  }

  _finishTyping() {
    this._typing = false;
    if (this._typeTimer) {
      clearInterval(this._typeTimer);
      this._typeTimer = null;
    }
    this._textEl.textContent = this._fullText;
  }

  _advance() {
    if (this._typing) {
      // 跳过打字机效果
      this._finishTyping();
      return;
    }
    this._index++;
    this._showCurrent();
  }

  _complete() {
    if (this._advanceHandler) {
      document.removeEventListener('keydown', this._advanceHandler);
    }
    if (this.root) {
      this.root.style.opacity = '0';
      this.root.style.transition = 'opacity 0.25s ease';
      setTimeout(() => {
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
        this.root = null;
      }, 260);
    }
    if (this._resolve) {
      const r = this._resolve;
      this._resolve = null;
      r();
    }
  }
}
