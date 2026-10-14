// ===== v0.15 时装流派化：出战时装 = 开局技能池偏向 =====
// 换装从「皮肤+小被动」升级为「选流派」。
// 每套时装定义 skillBias：偏向技能的出现权重倍率（未列出的技能保持基础权重5，
// 保证保底可达——任何技能仍可能出现，只是概率不同）。
// 选装界面显示「流派」标签；挑战备战同样生效。

var OUTFIT_SKILL_BIAS = {  // 见习冒险家：无偏向（全流派均衡）
  novice: null,
  // 烈焰舞裙 → 火系流派
  flame: { label:"🔥 火系流派", skills:{ fireball:2.4, quake:2.0, knives:1.6 } },
  // 寒霜斗篷 → 冰系控制流派
  frost: { label:"❄ 冰系控制", skills:{ frostnova:2.6, starfall:2.0 } },
  // 雷霆战衣 → 雷系速射流派
  storm: { label:"⚡ 雷系速射", skills:{ chainbolt:2.6, blades:2.0, holypulse:1.4 } },
  // 暗影夜行衣 → 暗杀流派
  shadow:{ label:"🌑 暗杀流派", skills:{ knives:2.6, gas:2.0, blades:1.6 } },
  // 圣辉礼服 → 圣光生存流派
  holy:  { label:"✨ 圣光生存", skills:{ holypulse:2.6, poison:1.8, fireball:1.3 } },
};

// 查询接口：返回 {label, skills} 或 null
function outfitSkillBias(outfitId){
  return OUTFIT_SKILL_BIAS[outfitId]||null;
}

// 选装卡片上的流派标签（由 art_ui_v2 或 ui.js 调用）
function drawOutfitBiasTag(ctx,outfitId,cx,cy){
  const b=outfitSkillBias(outfitId);
  if(!b)return;
  ctx.save();
  ctx.font="bold 11px sans-serif";ctx.textAlign="center";
  ctx.fillStyle="rgba(255,230,109,.9)";
  ctx.fillText(b.label,cx,cy);
  ctx.restore();
}
