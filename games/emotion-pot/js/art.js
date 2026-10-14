/** 高级 SVG 美术库 — 统一圆润 Q 版 / 暖色渐变 */

const svg = (vb, body, cls = "") =>
  `<svg class="art ${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

// ---------- 角色形态（锅中物） ----------
export const CHAR_CHEF = svg(
  "0 0 120 120",
  `
  <defs>
    <radialGradient id="cskin" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFE2B8"/><stop offset="100%" stop-color="#F0B878"/>
    </radialGradient>
    <linearGradient id="chat" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF6E8"/><stop offset="100%" stop-color="#E8D0B0"/>
    </linearGradient>
  </defs>
  <ellipse cx="60" cy="108" rx="34" ry="8" fill="rgba(0,0,0,0.15)"/>
  <circle class="char-body" cx="60" cy="62" r="38" fill="url(#cskin)"/>
  <ellipse cx="60" cy="38" rx="28" ry="16" fill="url(#chat)"/>
  <ellipse cx="60" cy="32" rx="18" ry="10" fill="#FFFaf0"/>
  <g class="eyes">
    <circle cx="48" cy="60" r="4" fill="#3A2418"/>
    <circle cx="72" cy="60" r="4" fill="#3A2418"/>
    <circle cx="49.5" cy="58.5" r="1.4" fill="#fff"/>
    <circle cx="73.5" cy="58.5" r="1.4" fill="#fff"/>
  </g>
  <path class="mouth" d="M52 72 Q60 78 68 72" stroke="#3A2418" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="42" cy="68" rx="5" ry="3" fill="#FF9B7A" opacity="0.55"/>
  <ellipse cx="78" cy="68" rx="5" ry="3" fill="#FF9B7A" opacity="0.55"/>
  `,
  "char"
);

export const CHAR_BUN = svg(
  "0 0 120 120",
  `
  <defs>
    <radialGradient id="bskin" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="#FFF2DC"/><stop offset="100%" stop-color="#F0C898"/>
    </radialGradient>
  </defs>
  <ellipse cx="60" cy="110" rx="36" ry="8" fill="rgba(0,0,0,0.15)"/>
  <ellipse cx="60" cy="68" rx="42" ry="38" fill="url(#bskin)"/>
  <ellipse cx="60" cy="42" rx="14" ry="10" fill="#FFF8EC"/>
  <circle cx="48" cy="64" r="4.5" fill="#3A2418"/>
  <circle cx="72" cy="64" r="4.5" fill="#3A2418"/>
  <circle cx="49.5" cy="62.5" r="1.5" fill="#fff"/>
  <circle cx="73.5" cy="62.5" r="1.5" fill="#fff"/>
  <path d="M50 78 Q60 72 70 78" stroke="#3A2418" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="40" cy="72" rx="6" ry="3.5" fill="#FF8B6A" opacity="0.5"/>
  <ellipse cx="80" cy="72" rx="6" ry="3.5" fill="#FF8B6A" opacity="0.5"/>
  <path d="M88 48 Q94 42 90 36" stroke="#7EC8E3" stroke-width="3.5" fill="none" stroke-linecap="round" opacity="0.85"/>
  <ellipse cx="92" cy="34" rx="3" ry="4" fill="#7EC8E3" opacity="0.75"/>
  `,
  "char"
);

export const CHAR_OCTO = svg(
  "0 0 120 120",
  `
  <defs>
    <radialGradient id="oskin" cx="38%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FF9E6A"/><stop offset="100%" stop-color="#E85A38"/>
    </radialGradient>
  </defs>
  <ellipse cx="60" cy="110" rx="40" ry="8" fill="rgba(0,0,0,0.15)"/>
  <ellipse cx="60" cy="58" rx="40" ry="36" fill="url(#oskin)"/>
  <path d="M28 78 Q22 100 34 104 Q40 96 38 82Z" fill="#E85A38"/>
  <path d="M48 86 Q46 108 58 110 Q62 100 58 88Z" fill="#E85A38"/>
  <path d="M72 86 Q78 110 90 104 Q88 92 80 82Z" fill="#E85A38"/>
  <path d="M88 72 Q100 88 94 100 Q84 96 82 80Z" fill="#E85A38"/>
  <ellipse cx="46" cy="52" rx="8" ry="10" fill="#fff"/>
  <ellipse cx="74" cy="52" rx="8" ry="10" fill="#fff"/>
  <circle cx="47" cy="54" r="4" fill="#2A1810"/>
  <circle cx="75" cy="54" r="4" fill="#2A1810"/>
  <path d="M40 42 L52 48" stroke="#2A1810" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M80 42 L68 48" stroke="#2A1810" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M50 68 Q60 78 70 68" stroke="#2A1810" stroke-width="3" fill="none" stroke-linecap="round"/>
  `,
  "char"
);

export const CHAR_CLOWN = svg(
  "0 0 120 120",
  `
  <defs>
    <radialGradient id="pump" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="#FFB347"/><stop offset="100%" stop-color="#E87820"/>
    </radialGradient>
  </defs>
  <ellipse cx="60" cy="110" rx="38" ry="8" fill="rgba(0,0,0,0.15)"/>
  <ellipse cx="60" cy="66" rx="42" ry="38" fill="url(#pump)"/>
  <path d="M60 30 Q52 18 58 12 Q62 16 64 12 Q70 18 60 30Z" fill="#4A9040"/>
  <ellipse cx="48" cy="62" rx="7" ry="8" fill="#fff"/>
  <ellipse cx="72" cy="62" rx="7" ry="8" fill="#fff"/>
  <circle cx="49" cy="63" r="3.5" fill="#2A1810"/>
  <circle cx="73" cy="63" r="3.5" fill="#2A1810"/>
  <path d="M40 48 Q48 44 54 50" stroke="#2A1810" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M80 48 Q72 44 66 50" stroke="#2A1810" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="60" cy="74" rx="10" ry="8" fill="#E83A28"/>
  <circle cx="38" cy="70" r="6" fill="#FF6B6B" opacity="0.7"/>
  <circle cx="82" cy="70" r="6" fill="#FF6B6B" opacity="0.7"/>
  `,
  "char"
);

export const CHAR_POTATO = svg(
  "0 0 120 120",
  `
  <defs>
    <radialGradient id="pot" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="#E8C878"/><stop offset="100%" stop-color="#B88838"/>
    </radialGradient>
  </defs>
  <ellipse cx="60" cy="110" rx="38" ry="8" fill="rgba(0,0,0,0.15)"/>
  <ellipse cx="58" cy="66" rx="42" ry="36" fill="url(#pot)"/>
  <ellipse cx="88" cy="58" rx="14" ry="18" fill="url(#pot)"/>
  <circle cx="48" cy="62" r="5" fill="#2A1810"/>
  <circle cx="72" cy="62" r="5" fill="#2A1810"/>
  <circle cx="50" cy="60" r="1.8" fill="#fff"/>
  <circle cx="74" cy="60" r="1.8" fill="#fff"/>
  <path d="M46 76 Q60 90 76 76" stroke="#2A1810" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M42 50 L48 42 M54 46 L58 36 M68 46 L72 36 M80 50 L86 42" stroke="#2A1810" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="38" cy="72" rx="5" ry="3" fill="#FF8B6A" opacity="0.45"/>
  `,
  "char"
);

export const CHAR_LOBSTER = svg(
  "0 0 120 120",
  `
  <defs>
    <radialGradient id="lob" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="#FF7A4A"/><stop offset="100%" stop-color="#D63A18"/>
    </radialGradient>
    <linearGradient id="star5" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFE29A"/><stop offset="100%" stop-color="#FFB020"/>
    </linearGradient>
  </defs>
  <ellipse cx="60" cy="112" rx="36" ry="7" fill="rgba(0,0,0,0.15)"/>
  <ellipse cx="60" cy="68" rx="36" ry="32" fill="url(#lob)"/>
  <ellipse cx="60" cy="42" rx="22" ry="16" fill="url(#lob)"/>
  <path d="M30 58 Q12 42 18 32 Q28 36 34 52Z" fill="#D63A18"/>
  <path d="M90 58 Q108 42 102 32 Q92 36 86 52Z" fill="#D63A18"/>
  <path d="M42 30 Q38 12 44 8" stroke="#D63A18" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M78 30 Q82 12 76 8" stroke="#D63A18" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="48" cy="42" r="4" fill="#2A1810"/>
  <circle cx="72" cy="42" r="4" fill="#2A1810"/>
  <circle cx="49.5" cy="40.5" r="1.3" fill="#fff"/>
  <circle cx="73.5" cy="40.5" r="1.3" fill="#fff"/>
  <path d="M52 52 Q60 56 68 52" stroke="#2A1810" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M60 12 L63 20 L72 21 L65.5 27 L67.5 36 L60 31 L52.5 36 L54.5 27 L48 21 L57 20Z" fill="url(#star5)"/>
  `,
  "char"
);

export const FORM_ART = [CHAR_CHEF, CHAR_BUN, CHAR_OCTO, CHAR_CLOWN, CHAR_POTATO, CHAR_LOBSTER];

// ---------- 道具 ----------
export const ART_CAKE = svg(
  "0 0 64 64",
  `
  <defs><radialGradient id="ck" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE2A8"/><stop offset="100%" stop-color="#E8A848"/></radialGradient></defs>
  <ellipse cx="32" cy="46" rx="22" ry="10" fill="#C88830"/>
  <ellipse cx="32" cy="36" rx="24" ry="14" fill="url(#ck)"/>
  <ellipse cx="32" cy="32" rx="18" ry="8" fill="#FFF0C8"/>
  <path d="M18 34 Q32 22 46 34" stroke="#E8C060" stroke-width="2" fill="none"/>
  `,
  "item"
);

export const ART_MOUTH = svg(
  "0 0 64 64",
  `
  <defs><radialGradient id="mo" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFB898"/><stop offset="100%" stop-color="#E87858"/></radialGradient></defs>
  <ellipse cx="32" cy="34" rx="24" ry="18" fill="url(#mo)"/>
  <rect x="18" y="30" width="28" height="8" rx="4" fill="#3A2418"/>
  <rect x="20" y="32" width="24" height="3" rx="1.5" fill="#fff" opacity="0.85"/>
  <circle cx="22" cy="28" r="2.5" fill="#2A1810"/>
  <circle cx="42" cy="28" r="2.5" fill="#2A1810"/>
  `,
  "item"
);

export const ART_ALARM = svg(
  "0 0 64 64",
  `
  <defs><radialGradient id="al" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#FF8A6A"/><stop offset="100%" stop-color="#E84A28"/></radialGradient></defs>
  <circle cx="20" cy="18" r="8" fill="url(#al)"/>
  <circle cx="44" cy="18" r="8" fill="url(#al)"/>
  <circle cx="32" cy="36" r="18" fill="url(#al)"/>
  <circle cx="32" cy="36" r="13" fill="#FFF4E0"/>
  <path d="M32 36 L32 28 M32 36 L38 36" stroke="#3A2418" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="30" y="50" width="4" height="6" rx="2" fill="#C03018"/>
  `,
  "item"
);

export const ART_DREAM = svg(
  "0 0 64 64",
  `
  <defs><radialGradient id="dm" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#B89CFF"/><stop offset="100%" stop-color="#6A4ACC"/></radialGradient></defs>
  <ellipse cx="32" cy="36" rx="22" ry="16" fill="url(#dm)" opacity="0.85"/>
  <circle cx="24" cy="32" r="3" fill="#FFE29A"/>
  <circle cx="38" cy="28" r="2" fill="#FFE29A"/>
  <circle cx="42" cy="40" r="2.5" fill="#FFE29A"/>
  <path d="M22 40 Q32 48 42 40" stroke="#FFE29A" stroke-width="2" fill="none" opacity="0.7"/>
  <path d="M18 22 Q32 12 46 22" stroke="#C8B0FF" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>
  `,
  "item"
);

export const ART_PHONE = svg(
  "0 0 64 64",
  `
  <defs><linearGradient id="ph" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5A8ACC"/><stop offset="100%" stop-color="#2A4A8C"/></linearGradient></defs>
  <rect x="18" y="12" width="28" height="40" rx="6" fill="url(#ph)"/>
  <rect x="22" y="18" width="20" height="26" rx="3" fill="#B8D8FF"/>
  <circle cx="32" cy="48" r="3" fill="#B8D8FF"/>
  <path d="M26 28 L32 34 L38 28" stroke="#2A4A8C" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M48 14 Q58 20 56 32" stroke="#FF6B6B" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>
  `,
  "item"
);

export const ART_NOODLE = svg(
  "0 0 64 64",
  `
  <defs><radialGradient id="nd" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE2A8"/><stop offset="100%" stop-color="#E8A848"/></radialGradient></defs>
  <ellipse cx="32" cy="42" rx="22" ry="12" fill="url(#nd)"/>
  <ellipse cx="32" cy="38" rx="18" ry="8" fill="#FFF0C8"/>
  <path d="M18 36 Q32 28 46 36" stroke="#E88830" stroke-width="2.5" fill="none"/>
  <path d="M22 40 Q32 34 42 40" stroke="#E88830" stroke-width="2" fill="none"/>
  <path d="M40 18 Q48 12 52 20" stroke="#C88830" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="28" cy="36" r="2" fill="#FF6B6B"/>
  <circle cx="38" cy="38" r="1.5" fill="#4A9040"/>
  `,
  "item"
);

export const ART_SLIDE = svg(
  "0 0 64 64",
  `
  <defs><linearGradient id="sl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7EC8E3"/><stop offset="100%" stop-color="#3A7A98"/></linearGradient></defs>
  <rect x="12" y="14" width="40" height="30" rx="4" fill="url(#sl)"/>
  <rect x="16" y="18" width="32" height="18" rx="2" fill="#E8F8FF"/>
  <path d="M20 28 L28 28 L32 22 L38 32 L44 26" stroke="#3A7A98" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <rect x="26" y="46" width="12" height="4" rx="2" fill="#3A7A98"/>
  <rect x="22" y="50" width="20" height="3" rx="1.5" fill="#2A5A70"/>
  `,
  "item"
);

export const ART_ICE = svg(
  "0 0 64 64",
  `
  <defs><linearGradient id="ic" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#C8F0FF"/><stop offset="100%" stop-color="#6AC8E8"/></radialGradient></defs>
  <defs><linearGradient id="ic" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#C8F0FF"/><stop offset="100%" stop-color="#6AC8E8"/></linearGradient></defs>
  <polygon points="32,10 52,24 46,50 18,50 12,24" fill="url(#ic)" opacity="0.9"/>
  <polygon points="32,18 44,28 40,44 24,44 20,28" fill="#fff" opacity="0.35"/>
  <path d="M22 30 L32 24 L42 32" stroke="#fff" stroke-width="2" fill="none" opacity="0.6"/>
  `,
  "item"
);

export const ITEM_ART = {
  bossCake: ART_CAKE,
  clientMouth: ART_MOUTH,
  mondayAlarm: ART_ALARM,
  expiredDream: ART_DREAM,
  uselessCs: ART_PHONE,
  missedTakeout: ART_NOODLE,
  endlessMeeting: ART_SLIDE,
  coldJoke: ART_ICE,
};

// ---------- 动作图标 ----------
export const ART_POKE = svg(
  "0 0 48 48",
  `
  <defs><linearGradient id="pk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE29A"/><stop offset="100%" stop-color="#FFB020"/></linearGradient></defs>
  <circle cx="24" cy="24" r="22" fill="url(#pk)"/>
  <path d="M20 30 V16 Q20 12 24 12 Q28 12 28 16 V22 H32 Q36 22 36 26 V30 Q36 38 28 38 H24 Q20 38 20 34Z" fill="#fff" opacity="0.95"/>
  <circle cx="24" cy="14" r="1.5" fill="#FFB020"/>
  `,
  "ico"
);

export const ART_CHAOS = svg(
  "0 0 48 48",
  `
  <defs><linearGradient id="ch" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF8A9A"/><stop offset="100%" stop-color="#FF5A3A"/></linearGradient></defs>
  <circle cx="24" cy="24" r="22" fill="url(#ch)"/>
  <path d="M14 28 Q18 14 24 22 Q30 30 34 18" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M12 34 Q20 38 28 32 Q34 28 38 34" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>
  <circle cx="24" cy="24" r="3" fill="#fff"/>
  `,
  "ico"
);

export const ART_STEAM = svg(
  "0 0 48 48",
  `
  <defs><linearGradient id="st" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#A8F0E8"/><stop offset="100%" stop-color="#48B8B0"/></linearGradient></defs>
  <circle cx="24" cy="24" r="22" fill="url(#st)"/>
  <ellipse cx="24" cy="28" rx="12" ry="8" fill="#fff" opacity="0.9"/>
  <path d="M18 22 Q16 14 20 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M24 20 Q24 12 28 10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M30 22 Q32 14 30 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
  `,
  "ico"
);

// ---------- 品牌锅（首页 logo） ----------
export const ART_LOGO_POT = svg(
  "0 0 96 80",
  `
  <defs>
    <linearGradient id="lp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8A5638"/><stop offset="55%" stop-color="#4A2818"/><stop offset="100%" stop-color="#2A1408"/>
    </linearGradient>
    <linearGradient id="lr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C07848"/><stop offset="100%" stop-color="#7A4424"/>
    </linearGradient>
    <radialGradient id="lg" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#FFD166"/><stop offset="100%" stop-color="#FF8A3D"/>
    </radialGradient>
  </defs>
  <rect x="10" y="22" width="76" height="48" rx="16" fill="url(#lp)"/>
  <rect x="6" y="16" width="84" height="14" rx="8" fill="url(#lr)" stroke="#D89058" stroke-width="2"/>
  <rect x="2" y="32" width="12" height="22" rx="5" fill="url(#lr)"/>
  <rect x="82" y="32" width="12" height="22" rx="5" fill="url(#lr)"/>
  <ellipse cx="48" cy="52" rx="18" ry="8" fill="url(#lg)" opacity="0.85"/>
  <text x="48" y="56" text-anchor="middle" font-size="14" font-weight="800" fill="#2A1408" font-family="system-ui,sans-serif">ω</text>
  `,
  "logo"
);

// ---------- 杂项 ----------
export const ART_PLATE = svg(
  "0 0 64 64",
  `
  <defs><radialGradient id="pl" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFF8F0"/><stop offset="100%" stop-color="#E8D0B8"/></radialGradient></defs>
  <ellipse cx="32" cy="36" rx="26" ry="14" fill="url(#pl)"/>
  <ellipse cx="32" cy="34" rx="18" ry="9" fill="#FFF8F0" stroke="#D0B090" stroke-width="1.5"/>
  <ellipse cx="32" cy="32" rx="10" ry="5" fill="#F0D8B8"/>
  <rect x="8" y="30" width="4" height="18" rx="2" fill="#C8B8A8"/>
  <rect x="52" y="30" width="4" height="18" rx="2" fill="#C8B8A8"/>
  `,
  "ico"
);

export const ART_STAR = (filled = true) =>
  filled
    ? `<svg class="art ico" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5 L14.8 9.2 L22 9.8 L16.5 14.5 L18.2 21.5 L12 17.5 L5.8 21.5 L7.5 14.5 L2 9.8 L9.2 9.2Z" fill="#FFC857"/></svg>`
    : `<svg class="art ico star-off" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5 L14.8 9.2 L22 9.8 L16.5 14.5 L18.2 21.5 L12 17.5 L5.8 21.5 L7.5 14.5 L2 9.8 L9.2 9.2Z" fill="#C8B090"/></svg>`;

export function starsHtml(n, total = 5) {
  let out = "";
  for (let i = 0; i < total; i++) out += ART_STAR(i < n);
  return `<span class="stars-art">${out}</span>`;
}

export const ART_SOUND_ON = `<svg class="art ico" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16 8a5 5 0 010 8M18.5 5.5a9 9 0 010 13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
export const ART_SOUND_OFF = `<svg class="art ico" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
export const ART_BACK = `<svg class="art ico" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ART_FIRE = `<svg class="art ico" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C12 2 6 9 6 14a6 6 0 0012 0c0-3-2-6-4-8 0 2-1 3-2 3 1-3-1-5-0-7z" fill="#FF6B2C"/><path d="M12 22a3.5 3.5 0 01-3.5-3.5c0-2 2-4 3.5-5.5 1 2 3.5 3.5 3.5 5.5A3.5 3.5 0 0112 22z" fill="#FFD166"/></svg>`;
export const ART_POT_SMALL = ART_LOGO_POT;

// ---------- 完整锅体（舞台主视觉） ----------
export const ART_POT = svg(
  "0 0 360 280",
  `
  <defs>
    <linearGradient id="potBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8A5638"/>
      <stop offset="45%" stop-color="#5A3420"/>
      <stop offset="100%" stop-color="#2E180C"/>
    </linearGradient>
    <linearGradient id="potRim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D09058"/>
      <stop offset="55%" stop-color="#A06840"/>
      <stop offset="100%" stop-color="#6B4024"/>
    </linearGradient>
    <linearGradient id="handleG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B87848"/>
      <stop offset="100%" stop-color="#4A2814"/>
    </linearGradient>
    <radialGradient id="innerShade" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#3A2012"/>
      <stop offset="100%" stop-color="#160C08"/>
    </radialGradient>
    <linearGradient id="soupG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF9A5A"/>
      <stop offset="40%" stop-color="#E85A20"/>
      <stop offset="100%" stop-color="#A82C10"/>
    </linearGradient>
    <radialGradient id="soupHi" cx="35%" cy="25%" r="55%">
      <stop offset="0%" stop-color="#FFE2A8" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#FFE2A8" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity="0.45"/>
    </filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="16" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- 背光 -->
  <ellipse cx="180" cy="250" rx="150" ry="28" fill="#FF6B2C" opacity="0.18" filter="url(#glow)"/>

  <!-- 双耳 -->
  <rect x="18" y="110" width="36" height="78" rx="16" fill="url(#handleG)" stroke="#C08050" stroke-width="3"/>
  <rect x="306" y="110" width="36" height="78" rx="16" fill="url(#handleG)" stroke="#C08050" stroke-width="3"/>
  <rect x="26" y="118" width="12" height="40" rx="6" fill="#fff" opacity="0.12"/>
  <rect x="314" y="118" width="12" height="40" rx="6" fill="#fff" opacity="0.12"/>

  <!-- 锅体 -->
  <path d="M48 96
           L312 96
           Q328 96 332 118
           L348 210
           Q354 250 312 262
           L48 262
           Q6 250 12 210
           L28 118
           Q32 96 48 96Z"
        fill="url(#potBody)" filter="url(#softShadow)"/>

  <!-- 内腔 -->
  <ellipse cx="180" cy="128" rx="128" ry="36" fill="url(#innerShade)"/>

  <!-- 汤面 -->
  <g id="soupLayer">
    <ellipse cx="180" cy="150" rx="118" ry="34" fill="url(#soupG)" opacity="0.95"/>
    <ellipse cx="180" cy="150" rx="118" ry="34" fill="url(#soupHi)"/>
    <ellipse cx="130" cy="142" rx="18" ry="7" fill="#fff" opacity="0.18"/>
    <ellipse cx="210" cy="156" rx="12" ry="5" fill="#fff" opacity="0.12"/>
    <ellipse cx="175" cy="162" rx="22" ry="7" fill="#fff" opacity="0.1"/>
  </g>

  <!-- 锅沿 -->
  <rect x="22" y="78" width="316" height="34" rx="18" fill="url(#potRim)" stroke="#E0A068" stroke-width="3"/>
  <rect x="36" y="86" width="288" height="10" rx="5" fill="#fff" opacity="0.22"/>

  <!-- 高光 -->
  <path d="M60 130 Q70 200 90 240" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity="0.1"/>
  `,
  "pot-full"
);

// 底部火焰组
export const ART_FLAMES = svg(
  "0 0 240 90",
  `
  <defs>
    <radialGradient id="fl1" cx="50%" cy="80%" r="55%">
      <stop offset="0%" stop-color="#FFE28A"/><stop offset="55%" stop-color="#FF7A3D"/><stop offset="100%" stop-color="#FF3D2E"/>
    </radialGradient>
  </defs>
  <g class="flame-g">
    <ellipse cx="70" cy="70" rx="22" ry="32" fill="url(#fl1)" opacity="0.95"/>
    <ellipse cx="120" cy="58" rx="28" ry="42" fill="url(#fl1)"/>
    <ellipse cx="170" cy="70" rx="22" ry="32" fill="url(#fl1)" opacity="0.95"/>
  </g>
  `,
  "flames"
);

/** 汤面气泡层（叠在锅 SVG 上） */
export const ART_BUBBLES = svg(
  "0 0 360 120",
  `
  <defs>
    <radialGradient id="bub" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FFE2B0" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#FF8A4A" stop-opacity="0.15"/>
    </radialGradient>
  </defs>
  <g class="bubbles">
    <circle class="b b1" cx="110" cy="70" r="8" fill="url(#bub)"/>
    <circle class="b b2" cx="170" cy="78" r="11" fill="url(#bub)"/>
    <circle class="b b3" cx="230" cy="68" r="7" fill="url(#bub)"/>
    <circle class="b b4" cx="145" cy="88" r="6" fill="url(#bub)"/>
    <circle class="b b5" cx="205" cy="90" r="9" fill="url(#bub)"/>
    <circle class="b b6" cx="260" cy="80" r="5" fill="url(#bub)"/>
    <circle class="b b7" cx="90" cy="86" r="5" fill="url(#bub)"/>
  </g>
  `,
  "bubbles"
);

/** 蒸汽卷（叠在锅上方） */
export const ART_STEAM_CURLS = svg(
  "0 0 200 120",
  `
  <g class="steams" fill="none" stroke="#FFF4E4" stroke-linecap="round" stroke-width="6" opacity="0.35">
    <path class="s s1" d="M60 100 Q48 70 62 48 Q76 28 62 10" opacity="0.4"/>
    <path class="s s2" d="M100 105 Q92 72 106 50 Q118 30 104 12" opacity="0.3"/>
    <path class="s s3" d="M140 100 Q152 70 138 48 Q126 28 140 10" opacity="0.35"/>
    <path class="s s4" d="M78 100 Q70 78 82 58 Q92 42 80 24" opacity="0.22"/>
    <path class="s s5" d="M122 102 Q130 80 118 60 Q108 44 120 26" opacity="0.22"/>
  </g>
  `,
  "steams"
);

/** 空状态：空锅插画 */
export const ART_EMPTY_POT = svg(
  "0 0 160 140",
  `
  <defs>
    <linearGradient id="ep" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8A5638"/><stop offset="100%" stop-color="#2E180C"/>
    </linearGradient>
    <linearGradient id="er" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C08050"/><stop offset="100%" stop-color="#6B4024"/>
    </linearGradient>
  </defs>
  <ellipse cx="80" cy="128" rx="50" ry="8" fill="rgba(0,0,0,0.2)"/>
  <rect x="12" y="52" width="18" height="36" rx="8" fill="url(#er)"/>
  <rect x="130" y="52" width="18" height="36" rx="8" fill="url(#er)"/>
  <path d="M30 48 L130 48 Q140 48 142 62 L148 100 Q150 122 128 126 L32 126 Q10 122 12 100 L18 62 Q20 48 30 48Z" fill="url(#ep)"/>
  <ellipse cx="80" cy="62" rx="48" ry="14" fill="#1A0E08"/>
  <rect x="22" y="38" width="116" height="18" rx="10" fill="url(#er)" stroke="#D09058" stroke-width="2"/>
  <circle cx="64" cy="88" r="3" fill="#FFD166" opacity="0.5"/>
  <circle cx="96" cy="96" r="2.5" fill="#FFD166" opacity="0.35"/>
  <path d="M72 20 Q68 10 76 6 M88 18 Q92 8 84 4" stroke="#FFD166" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.55"/>
  `,
  "empty-art"
);

/** 空状态：星星归档 */
export const ART_EMPTY_STARS = svg(
  "0 0 160 120",
  `
  <defs>
    <linearGradient id="es" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFE29A"/><stop offset="100%" stop-color="#FFB020"/>
    </linearGradient>
  </defs>
  <circle cx="80" cy="60" r="42" fill="rgba(255,200,87,0.12)"/>
  <path d="M80 22 L90 48 L118 50 L96 68 L102 96 L80 80 L58 96 L64 68 L42 50 L70 48Z" fill="url(#es)"/>
  <circle cx="36" cy="36" r="4" fill="#FFE29A" opacity="0.7"/>
  <circle cx="128" cy="40" r="3" fill="#FFE29A" opacity="0.55"/>
  <circle cx="118" cy="88" r="3.5" fill="#FFE29A" opacity="0.5"/>
  <circle cx="42" cy="82" r="3" fill="#FFE29A" opacity="0.45"/>
  `,
  "empty-art"
);

/** 表情差分：在角色上叠加 */
export const ART_SWEAT = `<svg class="art acc-sweat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 Q16 10 16 14 A4 4 0 118 14 Q8 10 12 2Z" fill="#7EC8E3" opacity="0.9"/></svg>`;
export const ART_ANGER = `<svg class="art acc-anger" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 8 L10 12 M20 8 L14 12 M4 16 L10 14 M20 16 L14 14" stroke="#FF5A3A" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="#FF5A3A"/></svg>`;
export const ART_SPARK = `<svg class="art acc-spark" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L14 9 L22 10 L15.5 15 L17.5 22 L12 18 L6.5 22 L8.5 15 L2 10 L10 9Z" fill="#FFC857"/></svg>`;
export const ART_TEARS = `<svg class="art acc-tears" viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg"><path d="M6 4 Q8 12 8 15 A2.5 2.5 0 113 15 Q3 12 6 4Z" fill="#7EC8E3"/><path d="M26 4 Q28 12 28 15 A2.5 2.5 0 1123 15 Q23 12 26 4Z" fill="#7EC8E3"/></svg>`;

export const ACC_BY_HEAT = (heat) => {
  if (heat >= 100) return ART_SPARK;
  if (heat >= 80) return ART_ANGER;
  if (heat >= 40) return ART_SWEAT;
  return "";
};

export const CHARS = {
  chef: CHAR_CHEF,
  bun: CHAR_BUN,
  octo: CHAR_OCTO,
  clown: CHAR_CLOWN,
  potato: CHAR_POTATO,
  lobster: CHAR_LOBSTER,
};
