/**
 * 物品近战 / 远程 / 消耗品分类（供库存武器区块与漫漫尘途出装共用）
 * ------------------------------------------------------------------
 * - MELEE / RANGED：武器归类（按游戏设定拆分近战与远程）。
 * - CONSUMABLE：漫漫尘途出装里的非武器补给（工具/口粮）。
 * - cured meat 在出装里单独置顶，故不放入 CONSUMABLE。
 */

export const MELEE = [
  'bone spear', // 骨枪
  'iron sword', // 铁剑
  'steel sword', // 钢剑
  'energy blade', // 能量剑
  'bayonet', // 刺刀
];

export const RANGED = [
  'bolas', // 套索
  'grenade', // 炸弹
  'rifle', // 步枪
  'laser rifle', // 激光步枪
  'plasma rifle', // 等离子步枪
  'disruptor', // 干扰器
];

export const CONSUMABLE = [
  'bullets', // 子弹
  'energy cell', // 能量元件
  'charm', // 符咒
  'alien alloy', // 外星合金
  'medicine', // 药剂
  'torch', // 火把
  'hypo', // 注射剂
  'stim', // 兴奋剂
  'glowstone', // 辉光石
];

/** 库存「武器」区块排序：近战 → 远程 → 其他武器（内部按字母序） */
export function weaponRank(key) {
  if (MELEE.indexOf(key) >= 0) return 0;
  if (RANGED.indexOf(key) >= 0) return 1;
  return 2;
}

/** 漫漫尘途「出装」排序：熏肉置顶 → 近战 → 远程 → 消耗品 → 其他（内部按字母序） */
export function suppliesRank(key) {
  if (key === 'cured meat') return 0;
  if (MELEE.indexOf(key) >= 0) return 1;
  if (RANGED.indexOf(key) >= 0) return 2;
  if (CONSUMABLE.indexOf(key) >= 0) return 3;
  return 4;
}
