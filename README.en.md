# 🕹️ Web Mini-Games Collection

English | [简体中文](README.md)

> 19 web mini-games from prototype to shippable, plus a reusable game-engineering system — contract registry, automatic port allocation, a unified dashboard, and delivery quality gates. All open source.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Games](https://img.shields.io/badge/games-19-brightgreen.svg)
![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%7C%20Phaser%203%20%7C%20PixiJS%20%7C%20Vite%20%7C%20TS-orange.svg)

---

## 🎮 Game Overview

### Released (playable × 12)

| Game | ID | Stack | Gameplay |
|---|---|---|---|
| [Coastal Skate](games/coastal-skate/) | `coastal-skate` | Vanilla JS / ES modules · zero deps | Seaside-themed skateboard runner |
| [Conway's Life](games/conway-life/) | `conway-life` | Vanilla Canvas · zero deps | A wish-making universe: write a wish and watch chaos condense it into a symbol — same birthday, same universe |
| [Emotion Pot](games/emotion-pot/) | `emotion-pot` | Vanilla JS · zero deps | Throw whatever annoys you into the pot; poke it, stew it, add weird ingredients, watch it mess up |
| [Football Shootout](games/football-shootout/) | `football-shootout` | Vanilla JS · zero deps | Hot-blooded style football shooting challenge |
| [Garden Defense](games/garden-defense/) | `garden-defense` | Phaser 3 + Vite | Portrait 10-row grid flower defense: pollen evolves to Lv5 premium; tracking / whirlwind / laser / arc trajectories |
| [Lying Flat](games/lying-flat/) | `lying-flat` | Vanilla JS · zero deps | Single-player remake of a "dorm horror" game: earn gold in bed, mine buffs, upgrade doors and turrets, survive dream hunters |
| [Candy Chain Match3](games/match3/) | `match3` | Phaser 3 + TS + Vite | 30 linear levels + daily challenge + score card export |
| [Pixel Mecha Duel](games/mecha-duel/) | `mecha-duel` | Vanilla JS · zero deps | Retro pixel mecha versus fighting with Street-Fighter-style specials (rising dragon / fireball) + combos |
| [PvZ Hybrid](games/pvz-hybrid/) | `pvz-hybrid` | Phaser 3 + TS + Vite | 17 plants + conveyor random card picks + fused monster mutations, 10 zombie types across 10 waves |
| [Queens Daily](games/queens-daily/) | `queens-daily` | Vite + TS | A LinkedIn-Queens-style daily puzzle: place N queens on an N×N grid, exactly one per row/column/color region, none attacking |
| [Ski Adventure](games/ski-adventure/) | `ski-adventure` | Vite + Canvas | Subway-surfers-like 3-lane endless ski runner |
| [Family Xiangqi](games/xiangqi/) | `xiangqi` | Vanilla JS + PWA | Family-friendly Chinese chess; installable via Service Worker |

### Demos (demo × 3)

| Game | ID | Stack | Gameplay |
|---|---|---|---|
| [Contra Remake](games/contra-remake/) | `contra-remake` | Phaser 3 + TS + Vite | Remake of Contra's first level; the most engineering-complete reference project |
| [Infinite Evolution](games/infinite-evolution/) | `infinite-evolution` | Vanilla JS · zero deps | Evolution-themed web game with full design docs and a development plan |
| [Star Defense](games/star-defense/) | `star-defense` | Vite + Canvas | Space sci-fi tower defense: multi-path, elemental counters, tower combos, versus mode |

### Prototypes (prototype × 3)

| Game | ID | Stack | Gameplay |
|---|---|---|---|
| [Hello Game](games/hello-game/) | `hello-game` | Vanilla JS · zero deps | Catch-the-ball sample demonstrating template-dashboard integration |
| [Roguelite Dress-up](games/roguelite-dressup/) | `roguelite-dressup` | Vite + Vanilla JS | Roguelite × dress-up gameplay, multi-module implementation, with design docs |
| [Skill Lab](games/skill-lab/) | `skill-lab` | PixiJS + Vite | Character / skill / VFX playground: a lab for physics-behavior gene fusion |

### Archived (archived × 1)

| Game | ID | Stack | Gameplay |
|---|---|---|---|
| [Snake](games/snake/) | `snake` | Vanilla JS · zero deps | The classic snake |

---

## 🏗️ The Engineering System

This repo is more than a game collection — it is a reusable game-workspace methodology:

| Mechanism | Description |
|---|---|
| **game.json contract** | One contract file per game: the single source of truth for id, status, port, and start command; the dashboard and all tools render from contracts |
| **Automatic port allocation** | Dedicated 4100–4999 range; `tools/new.mjs` scans the registry and live-probes for a free port — no more hand-picked conflicts |
| **Unified dashboard** | The dashboard proxies `/g/<id>/` so you never memorize ports; cards can start/stop games, health-polled every 3 seconds |
| **Four-verb script convention** | Repo-wide `dev` / `build` / `test` / `lint`; static games fall back to `python3 -m http.server` |
| **Delivery quality gates** | `tools/check.mjs` health audit (checklist completeness / port conflicts / missing assets); `tools/qa.mjs` pre-delivery contract + lint/test + quality self-check |
| **Status lifecycle** | `idea → prototype → demo → playable → archived`; status changes only touch game.json — projects are never deleted |
| **Single source of rules** | [AGENTS.md](AGENTS.md): directory structure, contract schema, port ranges, script verbs, lifecycle — all rules in one place |

## 🚀 Quick Start

```bash
# Option 1: dashboard (recommended) — one entry point, one-click start/stop for any game
node dashboard/server.mjs        # open http://localhost:4000

# Option 2: static games directly (10 zero-dependency games, no npm install)
cd games/conway-life && python3 -m http.server 4100   # http://localhost:4100

# Option 3: Vite / Phaser games
cd games/garden-defense && npm install && npm run dev
```

Daily tools:

```bash
node tools/ports.mjs            # port allocation table and online status
node tools/check.mjs            # workspace health audit
node tools/qa.mjs <game-id>     # pre-delivery self-check
```

## 📁 Directory Structure

```
games/
├── games/              # one directory per game: game.json / README / cover.png / docs
├── dashboard/          # management dashboard (global entry, rendered from game.json)
├── tools/              # new / ports / check / qa global scripts
└── AGENTS.md           # workspace rules (single source of rules)
```

## 📦 Notes on Scope

- **19 games** across five tech lines: vanilla JS/Canvas, Phaser 3, PixiJS, Vite + TypeScript, PWA
- Every game ships its own game.json contract, README, cover, and design docs, and runs standalone
- Third-party copyrighted assets and oversized assets are excluded; covers are uniformly compressed to 640px wide to keep the repo lean

## 📄 License

[MIT](LICENSE) © 2026 二十年小飞侠
