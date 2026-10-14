import {
  DIFFICULTY,
  DOOR_MAX,
  DOOR_TIER,
  BED_MAX,
  TURRETS,
  TOTAL_NIGHTS,
} from "./balance.js";
import {
  aliveCount,
  bedRate,
  doorUpgradeCost,
  bedUpgradeCost,
  playerRoom,
} from "./engine.js";

const $ = (id) => document.getElementById(id);

export function bindUI(w, actions) {
  const overlay = $("overlay");
  const modalTitle = $("modal-title");
  const modalBody = $("modal-body");
  const modalExtra = $("modal-extra");
  const modalPrimary = $("modal-primary");
  const modalSecondary = $("modal-secondary");
  const hud = $("hud");
  const shop = $("shop");
  const stage = $("stage");

  let diffPick = w.diff.id;
  let primaryHandler = null;
  let secondaryHandler = null;
  /** 当前展示的弹窗类型，避免首屏 overlay 已显示时漏绑事件 */
  let currentModal = null;

  function showOverlay({ title, body, extraHtml, primary, secondary, onPrimary, onSecondary }) {
    modalTitle.textContent = title;
    modalBody.innerHTML = body || "";
    modalExtra.innerHTML = extraHtml || "";
    if (primary) {
      modalPrimary.textContent = primary.label;
      modalPrimary.classList.remove("hidden");
      primaryHandler = primary.onClick || onPrimary || null;
    } else {
      modalPrimary.classList.add("hidden");
      primaryHandler = null;
    }
    if (secondary) {
      modalSecondary.textContent = secondary.label;
      modalSecondary.classList.remove("hidden");
      secondaryHandler = secondary.onClick || onSecondary || null;
    } else {
      modalSecondary.classList.add("hidden");
      secondaryHandler = null;
    }
    overlay.classList.remove("hidden");
    currentModal = "custom";
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
    currentModal = null;
  }

  modalPrimary.addEventListener("click", () => primaryHandler && primaryHandler());
  modalSecondary.addEventListener("click", () => secondaryHandler && secondaryHandler());

  function showTitle() {
    const diffs = Object.values(DIFFICULTY);
    const extra = `
      <div class="diff-grid" id="diff-grid">
        ${diffs
          .map(
            (d) => `
          <button type="button" class="diff-btn ${d.id === diffPick ? "active" : ""}" data-diff="${d.id}">
            <strong>${d.label}</strong>
            <span>${d.hint}</span>
          </button>`
          )
          .join("")}
      </div>`;
    showOverlay({
      title: "躺平",
      body: `选一间宿舍上床躺平，产金币、升床铺、造建筑，顶住<strong>猎梦者</strong>挠门，撑到<strong>天亮</strong>（${TOTAL_NIGHTS} 夜）。<br/>房间可能刷出<strong>矿脉</strong>加成产金；残血升门回满；每过一夜可从 3 个技能里选 1 个。`,
      extraHtml: extra,
      primary: { label: "进入宿舍", onClick: () => actions.onStart(diffPick) },
    });
    currentModal = "title";
    const grid = $("diff-grid");
    grid?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-diff]");
      if (!btn) return;
      diffPick = btn.dataset.diff;
      grid.querySelectorAll(".diff-btn").forEach((el) => {
        el.classList.toggle("active", el.dataset.diff === diffPick);
      });
    });
  }

  function showResult(win, world) {
    const src = world || w;
    const me = playerRoom(src);
    const rows = [
      `难度：${src.diff.label}`,
      `到达夜晚：${src.night} / ${TOTAL_NIGHTS}`,
      `输出伤害：${Math.round(src.playerDmg)}`,
      me ? `门：${DOOR_TIER[me.door.level] || "门"} ${me.door.level}` : "门：—",
      me ? `床：Lv${me.bed.level}` : "床：—",
      me?.mine?.name ? `矿脉：${me.mine.name}` : "矿脉：无",
      `技能：${src.playerBuffs?.length ? src.playerBuffs.join("、") : "无"}`,
      `剩余室友：${aliveCount(src)}`,
    ];
    showOverlay({
      title: win ? "躺赢！" : "躺输…",
      body: win
        ? "猎梦者被熬走了。这局你证明了：躺平也是一种战术。"
        : "门被拆了。要不要换个姿势再躺一次？",
      extraHtml: `<div class="result-list">${rows.map((r) => `<div>${r}</div>`).join("")}</div>`,
      primary: { label: "再来一局", onClick: () => actions.onRestart() },
      secondary: { label: "回标题", onClick: () => actions.onTitle() },
    });
    currentModal = win ? "win" : "lose";
  }

  function showBuffPick(world) {
    const list = world.pendingBuffs || [];
    const extra = `<div class="buff-grid">${list
      .map(
        (b) => `
      <button type="button" class="buff-card" data-buff="${b.id}">
        <div class="buff-icon">${b.icon}</div>
        <div class="buff-name">${b.name}</div>
        <div class="buff-desc">${b.desc}</div>
      </button>`
      )
      .join("")}</div>`;
    showOverlay({
      title: "天亮了",
      body: `准备第 <b>${world.night}</b> 夜。选一项躺平技能（只能选一个）：`,
      extraHtml: extra,
      primary: null,
      secondary: null,
    });
    currentModal = "buff";
    modalExtra.querySelectorAll("[data-buff]").forEach((btn) => {
      btn.addEventListener("click", () => actions.onChooseBuff(btn.dataset.buff));
    });
  }

  function setHudPhase(w2) {
    const el = $("hud-phase");
    if (!el) return;
    if (w2.phase === "day") {
      el.textContent = `白天 ${Math.ceil(w2.dayLeft)}s`;
      el.style.color = "#8dffd4";
    } else if (w2.phase === "night") {
      el.textContent = "夜晚 · 猎梦者拆门";
      el.style.color = "#ffb3c1";
    } else if (w2.phase === "buff") {
      el.textContent = "选技能";
      el.style.color = "#f0c14b";
    } else if (w2.phase === "pause") {
      el.textContent = "已暂停";
      el.style.color = "#e8eef8";
    } else {
      el.textContent = w2.phase;
      el.style.color = "";
    }
  }

  function refreshShop(w2) {
    const world = w2 || w;
    const room = playerRoom(world);
    const doorLv = $("door-lv");
    const bedLv = $("bed-lv");
    if (!room) {
      doorLv.textContent = "—";
      bedLv.textContent = "—";
      $("door-hp").textContent = "—";
      $("bed-rate").textContent = "—";
      $("door-cost").textContent = "";
      $("bed-cost").textContent = "";
      $("btn-up-door").disabled = true;
      $("btn-up-bed").disabled = true;
      return;
    }

    doorLv.textContent = `${DOOR_TIER[room.door.level] || "门"} ${room.door.level}`;
    $("door-hp").textContent = `${Math.ceil(room.door.hp)}/${room.door.maxHp}`;
    $("door-hp-bar").style.width = `${Math.max(0, (room.door.hp / room.door.maxHp) * 100)}%`;
    bedLv.textContent = String(room.bed.level);
    $("bed-rate").textContent = `+${Math.floor(bedRate(room))}/s${
      room.mine?.id !== "none" ? ` · ${room.mine.name}` : ""
    }`;
    $("room-tag").textContent = room.label;

    const dCost = doorUpgradeCost(room.door.level);
    const bCost = bedUpgradeCost(room.bed.level);
    const lowHp = room.door.hp / room.door.maxHp < 0.35;
    $("door-cost").textContent =
      dCost == null
        ? "已满级"
        : lowHp
          ? `费用 ${dCost} 金 · 残血升级回满！`
          : `费用 ${dCost} 金 · 升级回满血`;
    $("bed-cost").textContent = bCost == null ? "已满级" : `费用 ${bCost} 金`;
    $("btn-up-door").disabled = dCost == null || world.gold < dCost;
    $("btn-up-bed").disabled = bCost == null || world.gold < bCost;

    const list = $("turret-list");
    list.innerHTML = Object.values(TURRETS)
      .map((t) => {
        const active = world.selectedTurret === t.id;
        const afford = world.gold >= t.cost;
        const meta = t.goldPerSec ? t.desc : `${t.desc} · 伤${t.dmg}`;
        return `
          <button type="button" class="turret-card ${active ? "active" : ""}" data-turret="${t.id}" ${afford ? "" : "disabled"}>
            <div class="turret-icon">${t.icon}</div>
            <div>
              <div class="turret-name">${t.name}</div>
              <div class="turret-meta">${meta}</div>
            </div>
            <div class="turret-price">${t.cost}</div>
          </button>`;
      })
      .join("");

    list.querySelectorAll("[data-turret]").forEach((btn) => {
      btn.addEventListener("click", () => {
        world.selectedTurret = btn.dataset.turret;
        refreshShop(world);
      });
    });

    const slotLabel =
      world.selectedSlot >= 0 ? `槽位 ${world.selectedSlot + 1}` : "地图空槽";
    $("shop-hint").textContent =
      world.selectedSlot >= 0
        ? `已选${slotLabel}，点上方炮台卡或「建造」放置 ${TURRETS[world.selectedTurret]?.name || ""}`
        : "点地图上的 + 空槽，再选炮台建造";

    let buildBtn = $("btn-build");
    if (!buildBtn) {
      buildBtn = document.createElement("button");
      buildBtn.id = "btn-build";
      buildBtn.className = "btn primary";
      buildBtn.style.marginTop = "10px";
      buildBtn.style.width = "100%";
      buildBtn.textContent = "建造到选中槽";
      $("turret-list").after(buildBtn);
      buildBtn.addEventListener("click", () => actions.onBuild());
    }
    buildBtn.disabled =
      world.selectedSlot < 0 || world.gold < (TURRETS[world.selectedTurret]?.cost ?? 0);

    $("stat-mine").textContent = room.mine?.name || "无";
    $("stat-buffs").textContent = world.playerBuffs?.length
      ? world.playerBuffs.join("、")
      : "—";
    $("stat-dmg").textContent = String(Math.round(world.playerDmg));
    $("stat-alive").textContent = String(aliveCount(world));
  }

  // shop buttons
  $("btn-up-door").addEventListener("click", () => actions.onUpgradeDoor());
  $("btn-up-bed").addEventListener("click", () => actions.onUpgradeBed());
  $("btn-restart").addEventListener("click", () => actions.onRestart());
  $("btn-pause").addEventListener("click", () => actions.onTogglePause());
  $("btn-mute").addEventListener("click", () => actions.onToggleMute());

  function frame(w2) {
    const playing =
      w2.phase !== "title" && w2.phase !== "select" && w2.phase !== "buff";
    hud.classList.toggle("hidden", !playing && w2.phase !== "pause");
    shop.classList.toggle(
      "hidden",
      w2.phase === "title" || w2.phase === "select" || w2.phase === "buff"
    );
    stage.classList.toggle(
      "without-shop",
      w2.phase === "title" || w2.phase === "select" || w2.phase === "buff"
    );

    if (w2.phase === "title") {
      // 首屏 overlay 默认就可见：必须主动 showTitle 绑事件，不能等 hidden
      if (currentModal !== "title") showTitle();
      return;
    }
    if (w2.phase === "select") {
      hideOverlay();
      hud.classList.add("hidden");
      shop.classList.add("hidden");
      stage.classList.add("without-shop");
      return;
    }
    if (w2.phase === "buff") {
      if (currentModal !== "buff") showBuffPick(w2);
      return;
    }
    if (w2.phase === "win") {
      if (currentModal !== "win") showResult(true, w2);
      return;
    }
    if (w2.phase === "lose") {
      if (currentModal !== "lose") showResult(false, w2);
      return;
    }

    hideOverlay();
    hud.classList.remove("hidden");
    shop.classList.remove("hidden");
    stage.classList.remove("without-shop");

    $("hud-gold").textContent = String(Math.floor(w2.gold));
    $("hud-night").textContent = String(w2.night);
    setHudPhase(w2);

    const g = w2.ghost;
    if (g && g.maxHp) {
      $("ghost-hp-bar").style.width = `${Math.max(0, (g.hp / g.maxHp) * 100)}%`;
      const tag = g.form ? "·变身" : "";
      $("hud-ghost-hp").textContent = `猎梦者${tag} ${Math.ceil(g.hp)}/${g.maxHp}`;
    } else if (w2.phase === "day") {
      $("ghost-hp-bar").style.width = "0%";
      $("hud-ghost-hp").textContent = "未出现";
    }

    $("btn-mute").textContent = w2.muted ? "🔇" : "🔊";
    $("btn-pause").textContent = w2.phase === "pause" ? "▶" : "⏸";

    refreshShop(w2);
  }

  return {
    showTitle,
    showResult,
    frame,
    hideOverlay,
  };
}

export function bindBanner(w) {
  // canvas-free banner via phase chip already; extra floating banner
  let el = document.querySelector(".banner");
  if (!el) {
    el = document.createElement("div");
    el.className = "banner";
    $("stage").appendChild(el);
  }
  if (w.banner) {
    el.textContent = w.banner.text;
    el.classList.add("show");
    el.classList.toggle("danger", w.banner.kind === "danger");
    el.classList.toggle("ok", w.banner.kind === "ok");
  } else {
    el.classList.remove("show");
  }
}
