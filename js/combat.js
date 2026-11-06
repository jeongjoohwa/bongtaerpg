const escapeRoutes = new WeakMap();

// Choose a safe reachable step, including alternate routes along map edges.
export function getRangedMovement(hero, enemies, range, speed, dt, width, height, constrain = (point) => point) {
  if (!enemies.length) return { x: hero.x, y: hero.y };
  const nearest = Math.min(...enemies.map((enemy) => Math.hypot(enemy.x - hero.x, enemy.y - hero.y)));
  const preferred = range * 0.78;
  const escape = escapeRoutes.get(hero);
  if (escape) {
    const distance = Math.hypot(escape.x - hero.x, escape.y - hero.y);
    if (distance > 8 && nearest < preferred) {
      const step = Math.min(speed * dt, distance);
      return { x: hero.x + (escape.x - hero.x) / distance * step, y: hero.y + (escape.y - hero.y) / distance * step };
    }
    escapeRoutes.delete(hero);
  }
  if (nearest >= preferred && nearest <= range * 0.92) return { x: hero.x, y: hero.y };
  let best = { x: hero.x, y: hero.y, score: -Infinity };
  for (let i = -1; i < 16; i++) {
    const angle = i * Math.PI / 8;
    const step = i === -1 ? 0 : speed * dt;
    const { x, y } = constrain({ x: Math.max(18, Math.min(width - 18, hero.x + Math.cos(angle) * step)),
      y: Math.max(18, Math.min(height - 18, hero.y + Math.sin(angle) * step)) });
    const distances = enemies.map((enemy) => Math.hypot(enemy.x - x, enemy.y - y));
    const closest = Math.min(...distances);
    const danger = distances.reduce((sum, distance) => sum + Math.max(0, preferred - distance) ** 2, 0);
    const score = -Math.abs(closest - preferred) - danger / preferred;
    if (score > best.score) best = { x, y, score };
  }
  // Immediate distance alone can favor standing still in a corner. Commit to
  // a longer escape route even when its first steps approach an enemy.
  if (nearest < preferred && Math.hypot(best.x - hero.x, best.y - hero.y) < speed * dt * 0.25) {
    let route = null;
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const { x, y } = constrain({ x: Math.max(18, Math.min(width - 18, hero.x + Math.cos(angle) * range)),
        y: Math.max(18, Math.min(height - 18, hero.y + Math.sin(angle) * range)) });
      const distance = Math.hypot(x - hero.x, y - hero.y);
      if (distance < range * 0.5) continue;
      let danger = 0;
      for (let sample = 1; sample <= 8; sample++) {
        const px = hero.x + (x - hero.x) * sample / 8;
        const py = hero.y + (y - hero.y) * sample / 8;
        for (const enemy of enemies) {
          danger += Math.max(0, preferred - Math.hypot(enemy.x - px, enemy.y - py)) ** 2;
        }
      }
      const clearance = Math.min(...enemies.map((enemy) => Math.hypot(enemy.x - x, enemy.y - y)));
      const score = clearance - danger / (8 * preferred);
      if (!route || score > route.score) route = { x, y, score };
    }
    if (route) {
      escapeRoutes.set(hero, route);
      const distance = Math.hypot(route.x - hero.x, route.y - hero.y);
      const step = Math.min(speed * dt, distance);
      return { x: hero.x + (route.x - hero.x) / distance * step, y: hero.y + (route.y - hero.y) / distance * step };
    }
  }
  return { x: best.x, y: best.y };
}

export function rollAttackDamage(stats, roll = Math.random()) {
  return Math.round(stats.attack * (roll < stats.critChance ? stats.critDamage : 1));
}

export function evadesAttack(stats, roll = Math.random()) {
  return roll < stats.evade;
}

// Defense reduces every incoming attack proportionally, with a minimum of 1.
export function calculateIncomingDamage(damage, defense = 0) {
  return Math.max(1, Math.round(damage * 100 / (100 + Math.max(0, defense))));
}
