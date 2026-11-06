import { isInsideField } from './field-shape.js';
// The simulation remains top-down; projection only changes the normal map view.
export function projectGround(x, y) {
  return { x: Math.round(1100 + (x - y) * 0.65), y: Math.round(38 + (x + y) * 0.34) };
}

export function unprojectGround(x, y) {
  const difference = (x - 1100) / 0.65;
  const sum = (y - 38) / 0.34;
  return { x: (sum + difference) / 2, y: (sum - difference) / 2 };
}

function diamond(ctx, color, x, y, width, height, elevation = 0) {
  const points = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]].map(([px, py]) => projectGround(px, py));
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y - elevation) : ctx.moveTo(p.x, p.y - elevation));
  ctx.closePath();
  ctx.fill();
}

export function createScenery(width, height) {
  const objects = [];
  for (let row = 0; row < Math.ceil(height / 100); row++) {
    for (let col = 0; col < Math.ceil(width / 110); col++) {
      const seed = (row * 73 + col * 137 + row * col * 19) % 997;
      const x = 45 + col * 110 + seed % 47;
      const y = 80 + row * 100 + seed % 31;
      if (!isInsideField(x, y, width, height, 25) || x > width - 35 || y > height - 25 || Math.abs(x - width * 0.49 - Math.sin(y / 90) * 44) < 75 || Math.abs(y - height * 0.54) < 55) continue;
      objects.push({ x, y, type: seed % 7 ? 'tree' : 'rock' });
    }
  }
  // Overlapping crowns hide the ground beyond the playable clearing.
  for (let row = -2; row < Math.ceil(height / 42) + 3; row++) {
    for (let col = -2; col < Math.ceil(width / 46) + 3; col++) {
      const seed = Math.abs(row * 73 + col * 137 + row * col * 19);
      const x = col * 46 + (row % 2 ? 23 : 0) + seed % 13;
      const y = row * 42 + seed % 17;
      if (isInsideField(x, y, width, height, -14)) continue;
      objects.push({ x, y, type: 'tree', dense: true });
    }
  }
  return objects;
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function drawGround(ctx, width, height, view = { x: 0, y: 0, width, height }) {
  rect(ctx, '#14291f', view.x, view.y, view.width, view.height);
  const corners = [[view.x, view.y], [view.x + view.width, view.y], [view.x, view.y + view.height + 32], [view.x + view.width, view.y + view.height + 32]].map(([x, y]) => unprojectGround(x, y));
  const minX = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x)) / 32) * 32 - 32);
  const minY = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y)) / 32) * 32 - 32);
  const maxX = Math.min(width, Math.max(...corners.map(p => p.x)) + 64);
  const maxY = Math.min(height, Math.max(...corners.map(p => p.y)) + 64);
  for (let y = minY; y < maxY; y += 32) {
    for (let x = minX; x < maxX; x += 32) {
      const seed = (x * 13 + y * 37) >>> 0;
      const inside = isInsideField(x + 16, y + 16, width, height);
      const edge = inside && !isInsideField(x + 16, y + 16, width, height, 38);
      const path = Math.abs(x - width * 0.49 - Math.sin(y / 90) * 44) < 50 || Math.abs(y - height * 0.54) < 28;
      const color = !inside ? '#172d22' : edge ? '#5b6447' : path ? ['#8d7855','#96815c','#87714f'][seed % 3] : ['#365c44','#3d6649','#426c4d'][seed % 3];
      diamond(ctx, color, x, y, 33, 33);
      if (path && inside && !edge) {
        diamond(ctx, '#ab9268', x + 5, y + 5, 19, 17);
        diamond(ctx, '#756044', x + 5, y + 22, 19, 2);
      } else if (inside) {
        const p = projectGround(x + 10 + seed % 12, y + 16);
        rect(ctx, '#577b4d', p.x, p.y - 3, 2, 4);
        rect(ctx, '#284b38', p.x + 3, p.y, 3, 2);
      }
    }
  }
}

export function getSceneryOpacity(object, viewer) {
  if (!viewer || object.type !== 'tree' || object.x + object.y <= viewer.x + viewer.y) return 1;
  const tree = projectGround(object.x, object.y);
  const player = projectGround(viewer.x, viewer.y);
  const overlaps = tree.x - 35 < player.x + 13 && tree.x + 35 > player.x - 13
    && tree.y - 98 < player.y + 4 && tree.y > player.y - 44;
  return overlaps ? 0.22 : 1;
}

export function drawScenery(ctx, object, viewer) {
  ctx.save();
  ctx.globalAlpha *= getSceneryOpacity(object, viewer);
  paintScenery(ctx, object);
  ctx.restore();
}

function paintScenery(ctx, object) {
  const { x, y } = projectGround(object.x, object.y);
  ctx.fillStyle = 'rgba(9,24,21,.35)';
  ctx.beginPath(); ctx.ellipse(x + 13, y + 3, object.type === 'tree' ? 38 : 25, 10, -0.2, 0, Math.PI * 2); ctx.fill();
  if (object.type === 'tree') {
    rect(ctx, object.dense ? '#302d25' : '#4c352d', x - 7, y - 32, 14, 33);
    rect(ctx, object.dense ? '#4b4330' : '#846046', x - 6, y - 31, 5, 29);
    rect(ctx, object.dense ? '#10291f' : '#203d36', x - 27, y - 56, 54, 24);
    rect(ctx, object.dense ? '#173926' : '#254c3d', x - 35, y - 76, 70, 30);
    rect(ctx, object.dense ? '#23492f' : '#35644a', x - 26, y - 91, 52, 27);
    rect(ctx, object.dense ? '#2c5535' : '#457650', x - 17, y - 98, 32, 20);
    rect(ctx, object.dense ? '#39603b' : '#548354', x - 21, y - 77, 16, 7);
  } else {
    rect(ctx, '#455159', x - 18, y - 17, 36, 18);
    rect(ctx, '#68777c', x - 15, y - 26, 27, 18);
    rect(ctx, '#93a09b', x - 11, y - 26, 17, 5);
    rect(ctx, '#35434b', x + 8, y - 16, 10, 16);
  }
}

export function drawActor(ctx, actor, { hero = false, job = 'warrior', color = '#9bd88d' } = {}) {
  const { x, y } = projectGround(actor.x, actor.y);
  ctx.fillStyle = 'rgba(8,22,20,.4)';
  ctx.beginPath(); ctx.ellipse(x + 5, y + 2, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (hero) {
    rect(ctx, '#202a37', x - 8, y - 11, 6, 11);
    rect(ctx, '#202a37', x + 2, y - 11, 6, 11);
    rect(ctx, color, x - 11, y - 29, 22, 19);
    rect(ctx, '#334151', x + 5, y - 28, 6, 18);
    rect(ctx, '#e5bd95', x - 7, y - 41, 14, 13);
    rect(ctx, job === 'mage' ? '#76529e' : '#453a3b', x - 9, y - 44, 18, 7);
    rect(ctx, '#fff0ce', x + (actor.dir === 3 ? -6 : 3), y - 36, 3, 3);
    const side = actor.dir === 3 ? -1 : 1;
    const wx = x + side * 15;
    const swing = actor.state === 'attack' ? 5 : 0;
    if (job === 'mage') {
      rect(ctx, '#94714e', wx, y - 34 - swing, 3, 32);
      rect(ctx, '#bfa0ff', wx - 3, y - 39 - swing, 9, 9);
    } else if (job === 'archer') {
      rect(ctx, '#b58b4f', wx, y - 29 - swing, 3, 24);
      rect(ctx, '#e8d6a3', wx - side * 4, y - 25 - swing, 2, 16);
      rect(ctx, '#b58b4f', wx - 3, y - 30 - swing, 6, 3);
      rect(ctx, '#b58b4f', wx - 3, y - 7 - swing, 6, 3);
    } else {
      rect(ctx, '#c5d8de', wx, y - 34 - swing, 4, 23);
      rect(ctx, '#bd9655', wx - 3, y - 13 - swing, 10, 4);
    }
  } else {
    const size = actor.boss || actor.type === 'tank' ? 24 : actor.type === 'fast' ? 12 : 15;
    rect(ctx, actor.flash > 0 ? '#ffe4c0' : actor.boss ? '#a95c67' : actor.type === 'ranged' ? '#af87cb' : actor.type === 'fast' ? '#c5a464' : actor.type === 'tank' ? '#718ca0' : '#72a26a', x - size, y - size * 2, size * 2, size * 2);
    rect(ctx, '#b7ce8b', x - size + 3, y - size * 2, size, 5);
    rect(ctx, '#202e32', x - 7, y - size - 4, 4, 4);
    rect(ctx, '#202e32', x + 4, y - size - 4, 4, 4);
    if (actor.attackAnim > 0) {
      rect(ctx, '#ffd49a', x + size - 2, y - size - 4, 12, 6);
      rect(ctx, '#f09a67', x + size + 8, y - size - 7, 3, 12);
    }
    rect(ctx, '#28342f', x - 17, y + 7, 34, 4);
    rect(ctx, '#e7877c', x - 17, y + 7, Math.max(0, Math.round(34 * actor.hp / actor.maxHp)), 4);
  }
}

export function getFieldCamera(hero, width, height, viewportWidth, viewportHeight) {
  const p = projectGround(hero.x, hero.y);
  return {
    x: Math.round(Math.max(0, Math.min(1100 + width * 0.65 - viewportWidth, p.x - viewportWidth / 2))),
    y: Math.round(Math.max(0, Math.min(projectGround(width, height).y + 10 - viewportHeight, p.y - viewportHeight / 2))),
    width: viewportWidth, height: viewportHeight
  };
}
