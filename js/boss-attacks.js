export const SLAM = { windup: 0.9, recovery: 0.4, interval: 2.8, radius: 68, damageMultiplier: 1.25 };

export function updateSlam(battle, hero, dt) {
  if (!battle.slam) {
    battle.slamCooldown = (battle.slamCooldown ?? 1.2) - dt;
    if (battle.slamCooldown <= 0) {
      const x = hero.x;
      const y = hero.y || 0;
      let route = null;
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const px = Math.max(24, Math.min(battle.width - 24, x + Math.cos(angle) * (SLAM.radius + 30)));
        const py = Math.max(24, Math.min((battle.height || 768) - 24, y + Math.sin(angle) * (SLAM.radius + 30)));
        const clearance = Math.min(px, battle.width - px, py, (battle.height || 768) - py);
        const score = Math.hypot(px - x, py - y) * 2 + clearance * 0.2;
        if (!route || score > route.score) route = { x: px, y: py, score };
      }
      battle.slam = { x, y, age: 0, impacted: false, dodgeX: route.x, dodgeY: route.y };
    }
    return false;
  }
  const slam = battle.slam;
  slam.age += dt;
  let hit = false;
  if (!slam.impacted && slam.age >= SLAM.windup) {
    slam.impacted = true;
    hit = Math.hypot(hero.x - slam.x, (hero.y || 0) - slam.y) <= SLAM.radius;
  }
  if (slam.age >= SLAM.windup + SLAM.recovery) {
    battle.slam = null;
    battle.slamCooldown = SLAM.interval;
  }
  return hit;
}
