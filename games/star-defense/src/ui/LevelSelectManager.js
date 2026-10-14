// ================================================================
// 关卡选择界面管理 - 支持17关（5基础 + 12星座）
// ================================================================
import { ALL_LEVELS, getDifficultyName } from '../data/LevelConfig.js';
import { LEVEL_CONFIG } from '../core/Constants.js';
import { getElementName } from '../data/ZodiacLevelConfig.js';
import { UiAnimator, EASE } from './UiAnimator.js';
import { DialogueOverlay } from './DialogueOverlay.js';
import { getStory } from '../data/StoryScript.js';
import { CHAPTERS } from '../data/ChapterConfig.js';
import { CutsceneRenderer } from '../render/CutsceneRenderer.js';
import { getEndlessBestWave } from '../modes/EndlessMode.js';

export class LevelSelectManager {
  constructor() {
    this.container = document.getElementById('levelSelect');
    this.onSelectLevel = null;
    this.onBack = null;
    /** 无尽模式入口回调（P4-4） */
    this.onSelectEndless = null;
    this.unlockedLevels = 17; // 解锁全部关卡
    this.levelStars = {};
    this.uiAnimator = null;
  }

  /**
   * 设置回调
   */
  setSelectLevelCallback(cb) { this.onSelectLevel = cb; }
  setBackCallback(cb) { this.onBack = cb; }
  /** 设置无尽模式入口回调（P4-4） */
  setSelectEndlessCallback(cb) { this.onSelectEndless = cb; }

  // === Agent A1: 注入 UI 动画管理工具 ===
  setUiAnimator(uiAnimator) {
    this.uiAnimator = uiAnimator;
  }

  /**
   * 加载存档进度
   */
  loadProgress() {
    // 全部关卡已解锁
    this.unlockedLevels = LEVEL_CONFIG.TOTAL_LEVELS;

    // 加载每关最佳星级
    const starsSaved = localStorage.getItem(LEVEL_CONFIG.STARS_KEY);
    if (starsSaved) {
      try {
        this.levelStars = JSON.parse(starsSaved);
      } catch (e) {
        this.levelStars = {};
      }
    }
  }

  /**
   * 显示关卡选择界面
   */
  show() {
    this.loadProgress();
    this.container.classList.remove('hidden');
    this._render();
    // === Agent A1: 幕间插画（通关 3/5/6/9/12/15/17 时自动播放） ===
    this._maybePlayCutscene();
  }

  // === Agent A1: 检查是否需要播幕间插画 ===
  _maybePlayCutscene() {
    try {
      const SEEN_KEY = 'star-defense-cutscene-seen';
      const seenRaw = localStorage.getItem(SEEN_KEY);
      const seen = seenRaw ? JSON.parse(seenRaw) : [];
      // 找出已通关但还没播过插画的关卡（按 ID 升序，取最近一个）
      const candidates = [];
      for (const level of ALL_LEVELS) {
        const key = `${level.id}_easy`;
        const stars = this.levelStars[key] || 0;
        if (stars > 0 && !seen.includes(level.id)) {
          candidates.push(level.id);
        }
      }
      if (candidates.length === 0) return;
      // 找最高 ID 的关卡（最近完成的）
      const lastCompleted = candidates.sort((a, b) => b - a)[0];
      const sceneId = CutsceneRenderer.pickSceneForLevel(lastCompleted);
      if (!sceneId) return;
      // 标记为已播过
      seen.push(lastCompleted);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
      // 播放
      CutsceneRenderer.play(this.container, sceneId, 5000).catch(() => {});
    } catch (e) {
      // 静默失败，不影响关卡选择
    }
  }

  /**
   * 隐藏关卡选择界面
   */
  hide() {
    this.container.classList.add('hidden');
  }

  /**
   * 渲染关卡卡片
   */
  _render() {
    this.container.innerHTML = '';

    // 标题
    const title = document.createElement('div');
    title.className = 'level-select-title';
    title.textContent = '选择关卡';
    this.container.appendChild(title);

    let animIndex = 0;

    // === Agent A1: 按章节分组渲染（5 基础关） ===
    for (const chapter of CHAPTERS) {
      const section = document.createElement('div');
      section.className = 'chapter-section';
      section.style.cssText = `
        background: linear-gradient(135deg, ${chapter.gradient[0]}, ${chapter.gradient[1]});
        border-radius: 10px; padding: 12px 16px; margin: 8px 0;
        border: 1px solid rgba(255,255,255,0.06);
      `;
      const header = document.createElement('div');
      header.className = 'chapter-header';
      header.style.cssText = `
        display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px;
      `;
      header.innerHTML = `
        <div style="font-size:16px;font-weight:bold;color:#f0e8ff;letter-spacing:1px;">${chapter.name}</div>
        <div style="font-size:11px;color:#aa99bb;font-style:italic;">${chapter.subtitle}</div>
      `;
      section.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'level-grid';
      const levelsInChapter = ALL_LEVELS.filter(l => chapter.levels.includes(l.id));
      for (const level of levelsInChapter) {
        const card = this._buildLevelCard(level, animIndex);
        animIndex++;
        grid.appendChild(card);
      }
      section.appendChild(grid);
      this.container.appendChild(section);
    }

    // === Agent A1: 12 星座关卡单独成组 ===
    const zodiacLevels = ALL_LEVELS.filter(l => l.id >= 6);
    if (zodiacLevels.length > 0) {
      const zodiacSection = document.createElement('div');
      zodiacSection.className = 'chapter-section zodiac-section';
      zodiacSection.style.cssText = `
        background: linear-gradient(135deg, #14102a, #1a1530);
        border-radius: 10px; padding: 12px 16px; margin: 8px 0;
        border: 1px solid rgba(180, 140, 255, 0.18);
      `;
      const header = document.createElement('div');
      header.className = 'chapter-header';
      header.style.cssText = `
        display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px;
      `;
      header.innerHTML = `
        <div style="font-size:16px;font-weight:bold;color:#cc99ff;letter-spacing:1px;">星座挑战</div>
        <div style="font-size:11px;color:#aa99bb;font-style:italic;">12 星座高阶关卡</div>
      `;
      zodiacSection.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'level-grid';
      for (const level of zodiacLevels) {
        const card = this._buildLevelCard(level, animIndex);
        animIndex++;
        grid.appendChild(card);
      }
      zodiacSection.appendChild(grid);
      this.container.appendChild(zodiacSection);
    }

    // 返回按钮
    const backBtn = document.createElement('button');
    backBtn.className = 'overlay-btn btn-back';
    backBtn.textContent = '返回';
    backBtn.addEventListener('click', () => {
      if (this.onBack) this.onBack();
    });
    this.container.appendChild(backBtn);

    // === Agent A10: 无尽模式入口（P4-4）===
    const endlessBtn = document.createElement('div');
    endlessBtn.className = 'endless-mode-entry';
    endlessBtn.style.cssText = `
      margin: 20px auto 0; padding: 18px 28px; max-width: 480px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      background: linear-gradient(135deg, rgba(120,40,160,0.45), rgba(60,20,120,0.35));
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(180,120,255,0.35);
      border-radius: 14px; cursor: pointer; user-select: none;
      box-shadow: 0 6px 24px rgba(120,40,200,0.25), 0 0 0 1px rgba(180,120,255,0.08) inset;
      transition: all 0.2s ease;
    `;
    const best = getEndlessBestWave();
    endlessBtn.innerHTML = `
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="font-size:32px; line-height:1;">∞</div>
        <div>
          <div style="font-size:16px; font-weight:800; color:#e8c8ff; letter-spacing:1px;">无尽模式</div>
          <div style="font-size:11px; color:rgba(220,180,255,0.7); margin-top:3px;">
            每 10 波难度 ×1.3 · 每 50 波无尽 Boss
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px; color:rgba(220,180,255,0.55); letter-spacing:1px;">最高纪录</div>
        <div style="font-size:18px; font-weight:800; color:#ffcc44; font-variant-numeric:tabular-nums;">${best} 波</div>
      </div>
    `;
    endlessBtn.addEventListener('mouseenter', () => {
      endlessBtn.style.transform = 'translateY(-2px)';
      endlessBtn.style.boxShadow = '0 10px 32px rgba(120,40,200,0.4), 0 0 0 1px rgba(220,160,255,0.18) inset';
    });
    endlessBtn.addEventListener('mouseleave', () => {
      endlessBtn.style.transform = 'translateY(0)';
      endlessBtn.style.boxShadow = '0 6px 24px rgba(120,40,200,0.25), 0 0 0 1px rgba(180,120,255,0.08) inset';
    });
    endlessBtn.addEventListener('click', () => {
      if (this.onSelectEndless) this.onSelectEndless();
    });
    this.container.appendChild(endlessBtn);
  }

  // === Agent A1: 构造单个关卡卡片（提取出来便于章节分组复用） ===
  _buildLevelCard(level, animIndex) {
    const card = document.createElement('div');
    const isUnlocked = level.id <= this.unlockedLevels;

    // 自动选择难度：简单3星→困难，困难3星→终极
    const easyStars = this.levelStars[level.id + '_easy'] || 0;
    const hardStars = this.levelStars[level.id + '_hard'] || 0;
    let autoDifficulty = 'easy';
    if (easyStars >= 3 && hardStars >= 3) autoDifficulty = 'ultimate';
    else if (easyStars >= 3) autoDifficulty = 'hard';

    const diffLabels = { easy: '简单', hard: '困难', ultimate: '终极' };
    const diffColors = { easy: '#44dd44', hard: '#ddaa22', ultimate: '#dd3333' };

    // 显示当前自动难度的星级（而非所有难度最高）
    const currentStars = this.levelStars[level.id + '_' + autoDifficulty] || 0;
    const isZodiac = level.id >= 6;

    card.className = 'level-card';
    if (isZodiac) card.classList.add('zodiac-card');
    if (!isUnlocked) card.classList.add('locked');
    if (currentStars > 0) card.classList.add('cleared');

    // 关卡编号
    const numEl = document.createElement('div');
    numEl.className = 'level-num';
    if (isZodiac && level.symbol) {
      numEl.textContent = level.symbol;
      numEl.style.fontSize = '18px';
    } else {
      numEl.textContent = `${level.id}`;
    }
    card.appendChild(numEl);

    // 关卡名称
    const nameEl = document.createElement('div');
    nameEl.className = 'level-name';
    nameEl.textContent = level.name;
    card.appendChild(nameEl);

    // 当前难度标签
    const diffTag = document.createElement('div');
    diffTag.className = 'level-diff-tag';
    diffTag.textContent = diffLabels[autoDifficulty];
    diffTag.style.color = diffColors[autoDifficulty];
    diffTag.style.fontSize = '11px';
    diffTag.style.fontWeight = 'bold';
    diffTag.style.marginTop = '2px';
    card.appendChild(diffTag);

    // 星座关卡：显示元素标签
    if (isZodiac && level.element) {
      const elemEl = document.createElement('div');
      elemEl.className = 'level-element ' + level.element;
      elemEl.textContent = getElementName(level.element);
      card.appendChild(elemEl);
    }

    // 最佳星级
    const starsEl = document.createElement('div');
    starsEl.className = 'level-stars';
    if (currentStars > 0) {
      starsEl.innerHTML = '<span class="star-filled">' + '\u2605'.repeat(currentStars) + '</span>' +
                          '<span class="star-empty">' + '\u2606'.repeat(3 - currentStars) + '</span>';
    } else if (isUnlocked) {
      starsEl.innerHTML = '<span class="star-empty">\u2606\u2606\u2606</span>';
    }
    card.appendChild(starsEl);

    // 缩略图Canvas
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 100;
    thumbCanvas.height = 70;
    card.appendChild(thumbCanvas);

    // 绘制缩略图
    this._drawThumbnail(thumbCanvas, level);

    // 点击卡片直接进入游戏（自动选择难度）
    if (isUnlocked) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        // === Agent A1: 先播放剧情对话，再进战斗 ===
        this._playIntroThenStart(level.id, autoDifficulty);
      });
    }

    // 未解锁锁定图标
    if (!isUnlocked) {
      const lockEl = document.createElement('div');
      lockEl.className = 'lock-icon';
      lockEl.textContent = '\ud83d\udd12';
      card.appendChild(lockEl);
    }

    // === Agent A1: 关卡卡片入场动画（弹性 + 错位） ===
    if (this.uiAnimator) {
      this.uiAnimator.play({
        duration: 0.6,
        delay: animIndex * 0.06,
        ease: EASE.outElastic,
        onUpdate: (s) => {
          card.style.opacity = Math.min(1, s);
          card.style.transform = `scale(${0.5 + Math.min(1, s) * 0.5})`;
        },
      });
    }

    return card;
  }

  // === Agent A1: 播放开场剧情后再进入关卡 ===
  _playIntroThenStart(levelId, difficulty) {
    const story = getStory(levelId);
    if (!story || !story.intro || story.intro.length === 0) {
      if (this.onSelectLevel) this.onSelectLevel(levelId, difficulty);
      return;
    }
    if (!this._dialogue) {
      this._dialogue = new DialogueOverlay(this.container);
    }
    this._dialogue.play(story.intro).then(() => {
      if (this.onSelectLevel) this.onSelectLevel(levelId, difficulty);
    });
  }

  /**
   * 绘制关卡缩略图
   */
  _drawThumbnail(canvas, level) {
    const ctx = canvas.getContext('2d');
    const cols = level.cols;
    const rows = level.rows;
    const cell = level.cell;

    // 计算缩放比例
    const scaleX = canvas.width / (cols * cell);
    const scaleY = canvas.height / (rows * cell);
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (canvas.width - cols * cell * scale) / 2;
    const offsetY = (canvas.height - rows * cell * scale) / 2;

    // 背景（使用主题色或默认色）
    const bgColor = level.theme?.bg?.[1] || '#1a0f1e';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 网格
    ctx.strokeStyle = 'rgba(60, 60, 150, 0.15)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cell);
      ctx.lineTo(cols * cell, r * cell);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cell, 0);
      ctx.lineTo(c * cell, rows * cell);
      ctx.stroke();
    }

    // 路径
    const paths = Array.isArray(level.path[0]) ? level.path : [level.path];
    const pathColor = level.theme?.pathColor || null;
    const pathColors = pathColor
      ? [pathColor + '66', pathColor + '44', pathColor + '22']
      : ['rgba(120, 80, 255, 0.4)', 'rgba(255, 100, 80, 0.4)', 'rgba(80, 255, 120, 0.4)'];
    paths.forEach((path, idx) => {
      const color = pathColors[idx % pathColors.length];
      path.forEach(p => {
        ctx.fillStyle = color;
        ctx.fillRect(p.c * cell + 1, p.r * cell + 1, cell - 2, cell - 2);
      });

      // 中心线
      const lineColor = level.theme?.accentColor
        ? level.theme.accentColor + '44'
        : 'rgba(200, 150, 255, 0.3)';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.forEach((p, i) => {
        const px = p.c * cell + cell / 2;
        const py = p.r * cell + cell / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    });

    // 入口和出口标记
    if (paths[0] && paths[0].length > 0) {
      const start = paths[0][0];
      ctx.fillStyle = level.theme?.accentColor || '#ff6644';
      ctx.beginPath();
      ctx.arc(start.c * cell + cell / 2, start.r * cell + cell / 2, cell * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const lastPath = paths[paths.length - 1];
    if (lastPath && lastPath.length > 0) {
      const end = lastPath[lastPath.length - 1];
      ctx.fillStyle = '#44ff66';
      ctx.beginPath();
      ctx.arc(end.c * cell + cell / 2, end.r * cell + cell / 2, cell * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 边框
    const borderColor = level.theme?.accentColor || '#664433';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * 更新关卡进度
   */
  updateProgress(levelId, stars) {
    // 更新最佳星级
    if (!this.levelStars[levelId] || stars > this.levelStars[levelId]) {
      this.levelStars[levelId] = stars;
    }

    // 解锁下一关
    if (levelId < LEVEL_CONFIG.TOTAL_LEVELS) {
      this.unlockedLevels = Math.max(this.unlockedLevels, levelId + 1);
    }

    // 保存到localStorage
    localStorage.setItem(LEVEL_CONFIG.STORAGE_KEY, this.unlockedLevels.toString());
    localStorage.setItem(LEVEL_CONFIG.STARS_KEY, JSON.stringify(this.levelStars));
  }
}
