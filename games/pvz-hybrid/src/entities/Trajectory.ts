// 弹道系统架构：支持多种弹道类型
// 纯逻辑，无 Phaser 依赖

export enum TrajectoryType {
  LINEAR = "linear",           // 直线运动（默认）
  PARABOLIC = "parabolic",     // 抛物线运动（西瓜、冰瓜）
  ARC = "arc",                 // 弧线运动（部分植物）
  FALLING = "falling",         // 从天而降（特殊植物）
  SPIRAL = "spiral",           // 螺旋运动（闪电链等）
}

export interface TrajectoryConfig {
  type: TrajectoryType;
  // 抛物线参数
  gravity?: number;            // 重力加速度
  initialVelocityY?: number;  // 初始垂直速度
  // 弧线参数
  arcHeight?: number;          // 弧线高度
  arcDuration?: number;        // 弧线持续时间
  // 从天而降参数
  fallStartY?: number;         // 起始Y坐标
  fallEndY?: number;           // 结束Y坐标
  fallDuration?: number;       // 下落持续时间
  // 螺旋参数
  spiralRadius?: number;       // 螺旋半径
  spiralSpeed?: number;        // 螺旋速度
  spiralRotations?: number;    // 螺旋圈数
}

// 默认弹道配置
export const TRAJECTORY_CONFIGS: Record<TrajectoryType, TrajectoryConfig> = {
  [TrajectoryType.LINEAR]: {
    type: TrajectoryType.LINEAR,
  },
  [TrajectoryType.PARABOLIC]: {
    type: TrajectoryType.PARABOLIC,
    gravity: 400,
    initialVelocityY: -250,
  },
  [TrajectoryType.ARC]: {
    type: TrajectoryType.ARC,
    arcHeight: 100,
    arcDuration: 600,
  },
  [TrajectoryType.FALLING]: {
    type: TrajectoryType.FALLING,
    fallStartY: -50,
    fallEndY: 400,
    fallDuration: 800,
  },
  [TrajectoryType.SPIRAL]: {
    type: TrajectoryType.SPIRAL,
    spiralRadius: 30,
    spiralSpeed: 5,
    spiralRotations: 2,
  },
};

// 弹丸类型到弹道类型的映射
export const PROJECTILE_TRAJECTORY: Record<string, TrajectoryType> = {
  pea: TrajectoryType.LINEAR,
  icepea: TrajectoryType.LINEAR,
  icebolt: TrajectoryType.LINEAR,
  melon: TrajectoryType.PARABOLIC,
  wintermelon: TrajectoryType.PARABOLIC,
  fireball: TrajectoryType.ARC,
  axe: TrajectoryType.LINEAR,
  chain: TrajectoryType.SPIRAL,
  beam: TrajectoryType.LINEAR,
  missile: TrajectoryType.FALLING,
  drone: TrajectoryType.FALLING,
  spike: TrajectoryType.LINEAR,
  cannonball: TrajectoryType.PARABOLIC,
  cactusball: TrajectoryType.LINEAR,
};

// 弹道计算接口
export interface TrajectoryCalculator {
  calculate(
    config: TrajectoryConfig,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    progress: number // 0-1
  ): { x: number; y: number };
}

// 抛物线计算器
export class ParabolicCalculator implements TrajectoryCalculator {
  calculate(
    config: TrajectoryConfig,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    progress: number
  ): { x: number; y: number } {
    const gravity = config.gravity ?? 400;
    const initialVelocityY = config.initialVelocityY ?? -250;
    
    // 水平匀速运动
    const x = startX + (targetX - startX) * progress;
    
    // 垂直方向：匀加速运动
    const time = progress; // 简化为0-1
    const y = startY + initialVelocityY * time + 0.5 * gravity * time * time;
    
    return { x, y };
  }
}

// 弧线计算器
export class ArcCalculator implements TrajectoryCalculator {
  calculate(
    config: TrajectoryConfig,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    progress: number
  ): { x: number; y: number } {
    const arcHeight = config.arcHeight ?? 100;
    
    // 水平匀速运动
    const x = startX + (targetX - startX) * progress;
    
    // 垂直方向：正弦曲线
    const y = startY + (targetY - startY) * progress - arcHeight * Math.sin(progress * Math.PI);
    
    return { x, y };
  }
}

// 从天而降计算器
export class FallingCalculator implements TrajectoryCalculator {
  calculate(
    config: TrajectoryConfig,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    progress: number
  ): { x: number; y: number } {
    const fallStartY = config.fallStartY ?? -50;
    const fallEndY = config.fallEndY ?? 400;
    
    // 水平匀速运动
    const x = startX + (targetX - startX) * progress;
    
    // 垂直方向：先快后慢
    const y = fallStartY + (fallEndY - fallStartY) * Math.pow(progress, 0.7);
    
    return { x, y };
  }
}

// 螺旋计算器
export class SpiralCalculator implements TrajectoryCalculator {
  calculate(
    config: TrajectoryConfig,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    progress: number
  ): { x: number; y: number } {
    const spiralRadius = config.spiralRadius ?? 30;
    const spiralSpeed = config.spiralSpeed ?? 5;
    const spiralRotations = config.spiralRotations ?? 2;
    
    // 水平匀速运动
    const x = startX + (targetX - startX) * progress;
    
    // 垂直方向：螺旋运动
    const angle = progress * spiralRotations * Math.PI * 2;
    const y = startY + (targetY - startY) * progress + spiralRadius * Math.sin(angle * spiralSpeed);
    
    return { x, y };
  }
}

// 计算器工厂
export class TrajectoryCalculatorFactory {
  private static calculators: Record<TrajectoryType, TrajectoryCalculator> = {
    [TrajectoryType.LINEAR]: new ParabolicCalculator(), // 线性运动简化处理
    [TrajectoryType.PARABOLIC]: new ParabolicCalculator(),
    [TrajectoryType.ARC]: new ArcCalculator(),
    [TrajectoryType.FALLING]: new FallingCalculator(),
    [TrajectoryType.SPIRAL]: new SpiralCalculator(),
  };
  
  static getCalculator(type: TrajectoryType): TrajectoryCalculator {
    return this.calculators[type];
  }
}
