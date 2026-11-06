import { JOBS } from './data.js';

export const CHEST_DROP_CHANCE = 0.01;
export const MAX_WEAPON_LEVEL = 15;
export const shouldDropChest = (roll = Math.random()) => roll < CHEST_DROP_CHANCE;

export function createChestEquipment(job, random = Math.random) {
  const slots = ['weapon', 'weapon', 'helmet', 'armor', 'gloves', 'boots'];
  const type = slots[Math.min(slots.length - 1, Math.floor(random() * slots.length))];
  const roll = random();
  const tier = roll < 0.7 ? 'common' : roll < 0.95 ? 'rare' : 'epic';
  const multiplier = { common: 1, rare: 1.6, epic: 2.5 }[tier];
  const weaponType = JOBS[job]?.weaponTypes[0] || 'sword';
  const labels = { sword: '검', staff: '지팡이', bow: '활', helmet: '투구', armor: '갑옷', gloves: '장갑', boots: '신발' };
  const stats = {
    weapon: { attack: Math.round(7 * multiplier) },
    helmet: { maxHp: Math.round(14 * multiplier), defense: Math.round(2 * multiplier) },
    armor: { maxHp: Math.round(22 * multiplier), defense: Math.round(3 * multiplier) },
    gloves: { attack: Math.round(3 * multiplier), attackSpeed: 0.03 * multiplier },
    boots: { moveSpeed: Math.round(6 * multiplier) }
  };
  return { id: `chest-${Date.now()}-${random().toString(36).slice(2)}`, type,
    weaponType: type === 'weapon' ? weaponType : null,
    name: `${{ common: '일반', rare: '희귀', epic: '고급' }[tier]} ${labels[type === 'weapon' ? weaponType : type]}`,
    tier, stats: stats[type], level: 0, durability: 100, maxDurability: 100, isEquipped: false, price: 0 };
}

export function getEnhancementInfo(level = 0) {
  const success = Math.max(0.2, 0.95 - level * 0.07);
  const destroy = level >= 5 ? Math.min(0.25, (level - 4) * 0.03) : 0;
  return { cost: Math.round(40 * Math.pow(level + 1, 1.5)), success, destroy, fail: 1 - success - destroy,
    maxed: level >= MAX_WEAPON_LEVEL };
}

export function enhanceWeapon(state, id, roll = Math.random()) {
  const item = state.inventory.find((entry) => entry.id === id && entry.type === 'weapon');
  if (!item) return 'missing';
  const info = getEnhancementInfo(item.level || 0);
  if (info.maxed) return 'maxed';
  if (state.gold < info.cost) return 'poor';
  state.gold -= info.cost;
  if (roll < info.success) {
    item.level = (item.level || 0) + 1;
    if (state.equipment.weapon?.id === id) state.equipment.weapon = item;
    return 'success';
  }
  if (roll >= 1 - info.destroy) {
    state.inventory = state.inventory.filter((entry) => entry.id !== id);
    if (state.equipment.weapon?.id === id) state.equipment.weapon = null;
    return 'destroyed';
  }
  return 'failed';
}
