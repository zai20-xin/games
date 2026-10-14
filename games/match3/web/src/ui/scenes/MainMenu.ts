import Phaser from "phaser";
import { SaveManager, BOOSTER_NAMES, BoosterKind } from "../save";
import { Sfx } from "../sfx";
import { UIKit } from "../uikit";
import { generateDailyLevel, dailyStreak, getDailyBest } from "../../game/daily";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  create(): void {
    UIKit.attach(this);
    UIKit.backdrop(this, "candy");
    UIKit.fade();

    this.add
      .text(360, 300, "糖果连锁", {
        fontSize: "92px",
        color: "#fff5d6",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setStroke("#ff5a8f", 10)
      .setShadow(0, 6, "#ff5a8f", 18, true, true);

    this.add.text(360, 388, "Match-3 Puzzle", { fontSize: "30px", color: "#4a2a6a" })
      .setOrigin(0.5)
      .setAlpha(0.78);

    UIKit.button(360, 530, 340, 78, "开始游戏", () => this.scene.start("LevelMap"), 30);
    UIKit.button(360, 640, 340, 74, "☀ 每日挑战", () => {
      const lv = generateDailyLevel();
      this.scene.start("Game", { level: lv, daily: true });
    }, 26);
    // 每日挑战副标：连续天数 / 今日最佳
    {
      const streak = dailyStreak(7);
      const best = getDailyBest(new Date().toISOString().slice(0, 10));
      let sub = "全站同一题 · 今日新关卡";
      if (best) sub = `今日最高 ${best.score} 分`;
      else if (streak > 0) sub = `已连续挑战 ${streak} 天`;
      this.add.text(360, 700, sub, { fontSize: "18px", color: "#7ae582", fontStyle: "bold" })
        .setOrigin(0.5);
    }
    UIKit.button(360, 780, 340, 74, "重置进度", () => {
      SaveManager.resetAll();
      Sfx.applySettings(SaveManager.getSetting("sfx"), SaveManager.getSetting("music"));
      Sfx.stopMusic();
      Sfx.playMusic();
    });

    const settings = UIKit.button(360, 880, 220, 58, "⚙ 设置", () => this.showSettings(), 24);
    void settings;

    this.claimDailyIfNeeded();
  }

  private claimDailyIfNeeded(): void {
    const claim = SaveManager.claimDaily();
    if (!claim.claimed) return;
    // 首次进游戏不弹窗（默默入账，不遮挡首屏体验，可作为干净的封面截图）
    if (claim.firstEver) return;
    // 第二天起才显示签到奖励弹窗
    const { panel, close } = UIKit.popup(520, 440);
    panel.add([
      UIKit.label(0, -130, "每日签到", 44, "#ffc043").setOrigin(0.5),
      UIKit.label(0, -55, `连续签到 ${claim.streak} 天`, 28).setOrigin(0.5),
      UIKit.label(0, 5, `获得 ${BOOSTER_NAMES[claim.kind as BoosterKind]} x1`, 32, "#7ae582").setOrigin(0.5),
    ]);

    const ok = UIKit.button(0, 110, 240, 64, "收下了", () => {
      Sfx.play("sparkle");
      close();
    });
    panel.add(ok.container);
  }

  private showSettings(): void {
    const { panel, close } = UIKit.popup(520, 430);
    panel.add(UIKit.label(0, -145, "设置", 40).setOrigin(0.5));

    const mkToggle = (y: number, key: "sfx" | "music", name: string) => {
      const btn = UIKit.button(0,
        y,
        330,
        62,
        `${name}：${SaveManager.getSetting(key) ? "开" : "关"}`,
        () => {
          const next = !SaveManager.getSetting(key);
          SaveManager.setSetting(key, next);
          Sfx.applySettings(SaveManager.getSetting("sfx"), SaveManager.getSetting("music"));
          if (key === "music" && next) Sfx.playMusic();
          btn.setText(`${name}：${next ? "开" : "关"}`);
        },
        26,
      );
      panel.add(btn.container);
    };
    mkToggle(-55, "sfx", "音效");
    mkToggle(25, "music", "音乐");

    const closeBtn = UIKit.button(0, 135, 220, 58, "关闭", close, 24);
    panel.add(closeBtn.container);
  }
}
