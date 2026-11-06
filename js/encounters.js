export function getThreatLevel(seconds = 0) {
  return 1 + Math.floor(Math.max(0, seconds) / 60);
}

export function createEnemyStats(seconds = 0, roll = Math.random()) {
  const level = getThreatLevel(seconds);
  const types = ['normal'];
  if (level >= 2) types.push('fast');
  if (level >= 3) types.push('tank');
  if (level >= 4) types.push('ranged');
  const type = types[Math.min(types.length - 1, Math.floor(Math.max(0, roll) * types.length))];
  const hp = Math.round((56 + (level - 1) * 14) * (type === 'tank' ? 2.4 : type === 'fast' ? 0.8 : 1));
  return { type, hp, maxHp: hp, damage: Math.round((8 + (level - 1) * 2) * (type === 'tank' ? 1.3 : 1)),
    speed: Math.min(150, 128 + (level - 1) * 2) * (type === 'fast' ? 1.6 : type === 'tank' ? 0.65 : 1),
    range: type === 'ranged' ? 200 : 20,
    reward: Math.round((6 + level * 2) * (type === 'tank' ? 1.8 : 1)),
    boss: false, attackTimer: 1.2, flash: 0 };
}
