// 通关成绩卡导出
// 用隐藏 Canvas2D 绘制 PNG，触发下载。文件大小约几 KB，零外部依赖。

interface ScoreCardInput {
  title: string; // 关卡名 / "每日挑战 · YYYY-MM-DD"
  score: number;
  movesLeft: number;
  movesTotal: number;
  stars: number; // 0..3
  isDaily: boolean;
}

const CARD_W = 720;
const CARD_H = 960;

function starFilled(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ff5a8f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCandy(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, shape: 0 | 1 | 2 | 3 | 4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  if (shape === 0) { // 圆形
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
  } else if (shape === 1) { // 三角
    ctx.moveTo(0, -44); ctx.lineTo(40, 32); ctx.lineTo(-40, 32);
  } else if (shape === 2) { // 菱形
    ctx.moveTo(0, -44); ctx.lineTo(40, 0); ctx.lineTo(0, 44); ctx.lineTo(-40, 0);
  } else if (shape === 3) { // 方块
    ctx.rect(-40, -40, 80, 80);
  } else { // 五边
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = Math.cos(a) * 42;
      const py = Math.sin(a) * 42;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 高光
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(-12, -14, 14, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderScoreCard(input: ScoreCardInput): string {
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d")!;

  // 背景：糖果粉渐变
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_H);
  grad.addColorStop(0, "#ffeaf4");
  grad.addColorStop(1, "#ffd1e8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 光斑
  const blob = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(120, 200, 220, "rgba(255,140,180,0.45)");
  blob(620, 700, 220, "rgba(255,180,90,0.40)");
  blob(380, 480, 200, "rgba(200,140,255,0.30)");

  // 标题：糖果连锁
  ctx.font = "bold 76px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff5d6";
  ctx.strokeStyle = "#ff5a8f";
  ctx.lineWidth = 8;
  ctx.strokeText("糖果连锁", CARD_W / 2, 110);
  ctx.fillText("糖果连锁", CARD_W / 2, 110);

  // 副标（关卡名 / 每日挑战日期）
  ctx.font = "bold 38px 'PingFang SC', sans-serif";
  ctx.fillStyle = "#4a2a6a";
  ctx.fillText(input.title, CARD_W / 2, 190);

  // 装饰糖果三连
  drawCandy(ctx, 240, 280, "#ff5a5f", 0);
  drawCandy(ctx, 360, 280, "#7ae582", 1);
  drawCandy(ctx, 480, 280, "#ffc043", 2);

  // 分数卡片
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.strokeStyle = "#ff5a8f";
  ctx.lineWidth = 4;
  roundRect(ctx, CARD_W / 2 - 260, 360, 520, 220, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4a2a6a";
  ctx.font = "bold 32px 'PingFang SC', sans-serif";
  ctx.fillText("最终得分", CARD_W / 2, 405);
  ctx.font = "bold 88px 'PingFang SC', sans-serif";
  ctx.fillStyle = input.isDaily ? "#ff5a8f" : "#7a3ad9";
  ctx.fillText(String(input.score), CARD_W / 2, 500);
  ctx.font = "bold 22px 'PingFang SC', sans-serif";
  ctx.fillStyle = "#4a2a6a";
  ctx.fillText(`剩余步数 ${input.movesLeft} / ${input.movesTotal}`, CARD_W / 2, 555);

  // 星级
  ctx.fillStyle = "#4a2a6a";
  ctx.font = "bold 30px 'PingFang SC', sans-serif";
  ctx.fillText("通关评价", CARD_W / 2, 645);
  for (let i = 0; i < 3; i++) {
    const cx = CARD_W / 2 - 100 + i * 100;
    const filled = i < input.stars;
    starFilled(ctx, cx, 720, 36, filled ? "#ffd166" : "#d9d9e6");
  }

  // 底部标识
  ctx.font = "bold 22px 'PingFang SC', sans-serif";
  ctx.fillStyle = "#7a3ad9";
  ctx.fillText(input.isDaily ? "📅 今日挑战 · 全站同一题" : "🎯 通关记录", CARD_W / 2, 830);
  ctx.font = "16px 'PingFang SC', sans-serif";
  ctx.fillStyle = "rgba(74,42,106,0.6)";
  ctx.fillText(new Date().toISOString().slice(0, 10), CARD_W / 2, 870);
  ctx.font = "italic 18px 'PingFang SC', sans-serif";
  ctx.fillStyle = "rgba(74,42,106,0.5)";
  ctx.fillText("Match-3 Puzzle · 每日挑战等你来战", CARD_W / 2, 920);

  return c.toDataURL("image/png");
}

export function downloadScoreCard(input: ScoreCardInput): void {
  const dataUrl = renderScoreCard(input);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `match3-${input.isDaily ? `daily-${input.title}` : `level-${input.title}`}-${input.score}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}