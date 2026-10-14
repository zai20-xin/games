# 技能特效多维度设计方案

> 调研来源：Path of Exile（支持宝石系统）、Diablo（VFX 设计理念）、Last Epoch（技能树节点）、弹幕游戏通用设计

## 问题诊断

当前系统把"移动方式"和"视觉表现"绑死在基因类型里，导致：
- 7 个基因 × 14 个修饰 ≈ 组合空间看似大，实际视觉重复度高
- "穿透"基因 = 直线 + 箭头形状 + 蓝色尾迹，永远不变
- 修饰只改数值（伤害/速度），不改视觉

**核心矛盾：行为维度和视觉维度没有分离。**

---

## 参考：Path of Exile 的支持宝石拆法

PoE 的技能由「主动技能宝石 + 支持宝石」组合，每个支持宝石只改一个维度：

| 支持宝石 | 改什么 |
|---|---|
| Faster Projectiles | 移动速度 |
| Pierce | 穿透行为 |
| Chain | 链接行为 |
| Fork | 分裂行为 |
| Concentrated Effect | AOE 半径 |
| Increased Duration | 持续时间 |
| Added Chaos Damage | 伤害类型 |

关键洞察：**维度之间正交，组合爆炸式增长。**

---

## 新设计：6 维正交模型

每个技能由 6 个独立维度组合而成，维度之间无依赖：

### 维度 1：弹道类型（How it moves）

| 弹道 | 行为 | 视觉暗示 |
|---|---|---|
| `straight` | 直线飞行，打到边界消失 | 稳定、精确 |
| `homing` | 自动追踪最近敌人，缓慢修正方向 | 追踪、制导 |
| `wave` | 正弦波路径前进 | 能量、波动 |
| `bounce` | 打到敌人/边界后反弹，最多3次 | 弹射、连锁 |
| `spiral` | 螺旋前进，覆盖面积大 | 范围、压制 |
| `ground` | 贴地爬行，碰到障碍爆炸 | 地雷、陷阱 |
| `rain` | 从天空抛物线落下 | 轰炸、AOE |
| `return` | 飞出后自动返回发射者 | 回旋镖、 boomerang |

### 维度 2：弹体形态（What it looks like）

| 形态 | 渲染方式 | 视觉特征 |
|---|---|---|
| `arrow` | 三角形+尖端高光 | 锐利、穿透感 |
| `orb` | 圆形+内核光晕 | 能量球、法球 |
| `bolt` | 之字形线条 | 闪电、电弧 |
| `beam` | 持续线段（发射者到目标） | 激光、射线 |
| `wave` | 扇形/弧形扩散 | 冲击波、音波 |
| `spray` | 多个小粒子散射 | 弹幕、散射 |
| `nova` | 从中心向外扩散的环 | 爆炸环、脉冲 |
| `column` | 垂直柱状 | 天降、光柱 |

### 维度 3：命中行为（What happens on hit）

| 行为 | 效果 |
|---|---|
| `pierce` | 穿过敌人继续飞行，最多穿透N个 |
| `chain` | 命中后跳跃到附近敌人，最多链接N次 |
| `split` | 命中后分裂成2-3个新弹体飞向不同方向 |
| `explode` | 命中后产生范围爆炸（AOE半径可调） |
| `dot` | 命中后留下持续伤害区域（地面燃烧） |
| `slow` | 命中后减速敌人 |
| `knockback` | 命中后击退敌人 |
| `none` | 穿透后消失（无特殊行为） |

### 维度 4：尾迹效果（Trail visual）

| 尾迹 | 渲染 | 适用场景 |
|---|---|---|
| `glow` | 弹体后方渐隐光晕 | 能量弹、魔法弹 |
| `smoke` | 灰色/深色烟雾尾迹 | 物理弹、爆炸弹 |
| `spark` | 随机火花粒子 | 电系、金属弹 |
| `ribbon` | 彩带状连续尾迹 | 冰系、风系 |
| `none` | 无尾迹 | 干净、快速弹 |

### 维度 5：爆炸/命中特效（Impact effect）

| 特效 | 表现 |
|---|---|
| `burst` | 圆形冲击波扩散 + 碎片飞散 |
| `shatter` | 冰碎裂效果（三角碎片） |
| `melt` | 液态融化效果（颜色渐变下沉） |
| `arc` | 闪电弧连接命中点 |
| `ripple` | 水面波纹扩散 |
| `none` | 无命中特效 |

### 维度 6：色彩主题（Color palette）

| 主题 | 主色 | 辅色 | 高光 |
|---|---|---|---|
| `fire` | #ff5722 | #ff9800 | #ffcc02 |
| `ice` | #4fc3f7 | #81d4fa | #e1f5fe |
| `lightning` | #42a5f5 | #90caf9 | #ffffff |
| `poison` | #66bb6a | #a5d6a7 | #c8e6c9 |
| `physical` | #8d6e63 | #bcaaa4 | #d7ccc8 |
| `arcane` | #ab47bc | #ce93d8 | #e1bee7 |
| `blood` | #c62828 | #ef5350 | #ffcdd2 |
| `shadow` | #37474f | #546e7a | #78909c |

---

## 组合空间分析

| 维度 | 选项数 |
|---|---|
| 弹道类型 | 8 |
| 弹体形态 | 8 |
| 命中行为 | 8 |
| 尾迹效果 | 5 |
| 命中特效 | 6 |
| 色彩主题 | 8 |
| **总计** | **8 × 8 × 8 × 5 × 6 × 8 = 122,880** |

即使去掉不合理的组合（如 beam + spiral），有效组合也超过 **50,000 种**，远超当前的 ~100 种。

---

## 实现建议

### 数据结构

```typescript
interface SkillEffect {
  // 弹道
  trajectory: "straight" | "homing" | "wave" | "bounce" | "spiral" | "ground" | "rain" | "return";
  // 弹体形态
  form: "arrow" | "orb" | "bolt" | "beam" | "wave" | "spray" | "nova" | "column";
  // 命中行为
  onHit: "pierce" | "chain" | "split" | "explode" | "dot" | "slow" | "knockback" | "none";
  // 尾迹
  trail: "glow" | "smoke" | "spark" | "ribbon" | "none";
  // 命中特效
  impact: "burst" | "shatter" | "melt" | "arc" | "ripple" | "none";
  // 色彩主题
  palette: "fire" | "ice" | "lightning" | "poison" | "physical" | "arcane" | "blood" | "shadow";
  // 数值参数（可调范围）
  params: {
    damage: number;
    speed: number;
    size: number;       // 弹体大小 0.5 ~ 2.0
    pierceCount: number; // 穿透次数
    chainCount: number;  // 链接次数
    splitCount: number;  // 分裂数
    aoeRadius: number;   // AOE半径
    duration: number;    // 持续时间
    trailLength: number; // 尾迹长度
    burstCount: number;  // 爆炸碎片数
  };
}
```

### 随机生成策略

1. **随机生成**：每个维度独立随机选值，参数在合理范围内随机
2. **兼容性约束**（可选）：
   - `beam` + `spiral` → 冲突，重选
   - `ground` + `rain` → 冲突，重选
   - `dot` + `pierce` → 合理（穿透后留下燃烧）
3. **稀有度加权**：
   - 普通：随机1-2个维度取"基础"值
   - 稀有：3个维度取"高级"值
   - 传说：全部维度取"高级"值 + 特殊参数

### 与现有系统的对接

| 现有概念 | 对应新维度 |
|---|---|
| 基因类型 penetrate | trajectory=straight, form=arrow, onHit=pierce |
| 基因类型 explode | trajectory=straight, form=orb, onHit=explode |
| 基因类型 track | trajectory=homing, form=orb |
| 基因类型 chain | trajectory=straight, form=bolt, onHit=chain |
| 基因类型 boomerang | trajectory=return, form=arrow |
| 基因类型 shuttle | trajectory=spiral, form=orb |
| 基因类型 continuous | trajectory=straight, form=orb, onHit=dot |

---

## 视觉多样性提升预期

| 场景 | 当前 | 新方案 |
|---|---|---|
| "来一个火球" | 固定橙色圆形 | orb + straight + explode + glow + burst + fire（可调大小/速度/碎片数） |
| "来一道闪电" | 固定蓝色之字 | bolt + straight + chain + spark + arc + lightning |
| "来一个追踪冰弹" | 固定绿色菱形 | orb + homing + slow + ribbon + shatter + ice |
| "来一个回旋镖" | 固定金色V形 | arrow + return + pierce + glow + none + physical |
| "来一个地面毒液" | 不存在 | orb + ground + dot + smoke + melt + poison |

**核心改进：同一个"火球"可以有100种不同的表现，取决于其他维度的组合。**
