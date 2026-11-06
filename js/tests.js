import test from 'node:test';
import assert from 'node:assert/strict';
import { getRealCost, createInitialState, loadState, getStatSnapshot } from './state.js';
import { POTION_CONFIG, WORLD_BOSS_DATA } from './data.js';

test('getRealCost는 기본 강화 비용을 계산한다', () => {
  assert.equal(getRealCost('attackLevel', 0), 15);
  assert.equal(getRealCost('speedLevel', 1), Math.floor(35 * 1.42));
});

test('기본 상태는 빈 직업 상태를 만든다', () => {
  const state = createInitialState();
  assert.equal(state.job, null);
  assert.equal(state.version, 2);
  assert.deepEqual(state.potionInventory.common, 0);
});

test('기본 스탯 스냅샷은 직업 기본 능력치와 장비 합산을 계산한다', () => {
  const state = createInitialState();
  state.job = 'warrior';
  const stats = getStatSnapshot(state);
  assert.ok(stats.maxHp >= 150);
  assert.ok(stats.attack >= 8);
  assert.ok(stats.speed >= 0.85);
});

test('포션 설정은 회복량과 가격 정보를 보유한다', () => {
  assert.equal(POTION_CONFIG.common.amount, 20);
  assert.equal(POTION_CONFIG.mythic.price, 3000);
  assert.ok(WORLD_BOSS_DATA.maxHp > 0);
});

test('loadState는 기존 저장을 복원할 수 있다', () => {
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    data: {},
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; }
  };

  try {
    const state = createInitialState();
    state.job = 'mage';
    state.gold = 500;
    state.agilityLevel = 7;
    delete state.growthVersion;
    delete state.evasionLevel;
    globalThis.localStorage.setItem('starlight_idle_v04', JSON.stringify(state));
    const loaded = loadState();
    assert.equal(loaded.job, 'mage');
    assert.equal(loaded.gold, 500);
    assert.equal(loaded.evasionLevel, 7);
    assert.equal(loaded.agilityLevel, 0);
    assert.equal(loaded.growthVersion, 2);
  } finally {
    globalThis.localStorage = originalStorage;
  }
});


import { getRangedMovement } from './combat.js';

test('원거리 직업은 가까운 적에게서 멀어지고 사거리 밖의 적에게 접근한다', () => {
  const hero = { x: 200, y: 200 };
  const retreat = getRangedMovement(hero, [{ x: 240, y: 200 }], 180, 100, 0.05, 800, 600);
  assert.ok(retreat.x < hero.x);
  const approach = getRangedMovement(hero, [{ x: 500, y: 200 }], 180, 100, 0.05, 800, 600);
  assert.ok(approach.x > hero.x);
});

test('원거리 회피는 맵 가장자리에서도 이동하고 안전 거리에서는 멈춘다', () => {
  const edge = getRangedMovement({ x: 18, y: 200 }, [{ x: 50, y: 200 }], 180, 100, 0.05, 800, 600);
  assert.ok(edge.x >= 18);
  assert.notEqual(edge.y, 200);
  assert.deepEqual(getRangedMovement({ x: 200, y: 200 }, [{ x: 350, y: 200 }], 180, 100, 0.05, 800, 600), { x: 200, y: 200 });
});


test('네 구석에 몰려도 멈추거나 제자리에서 진동하지 않고 탈출한다', () => {
  for (const [x, y, dx, dy] of [[18, 18, 1, 1], [782, 18, -1, 1], [18, 582, 1, -1], [782, 582, -1, -1]]) {
    const hero = { x, y };
    const enemies = [{ x: x + dx * 32, y: y + dy * 32 }];
    for (let frame = 0; frame < 100; frame++) {
      const next = getRangedMovement(hero, enemies, 180, 100, 0.05, 800, 600);
      assert.ok(next.x >= 18 && next.x <= 782 && next.y >= 18 && next.y <= 582);
      Object.assign(hero, next);
    }
    assert.ok(Math.hypot(hero.x - x, hero.y - y) > 100);
    assert.ok(Math.hypot(hero.x - enemies[0].x, hero.y - enemies[0].y) >= 140);
  }
});

import { getFieldCamera, projectGround, unprojectGround, createScenery } from './world-view.js';

test('넓은 필드 카메라는 캐릭터를 따라가며 맵 가장자리에서 멈춘다', () => {
  const center = getFieldCamera({ x: 1280, y: 960 }, 2560, 1920, 640, 384);
  assert.equal(center.x + 320, projectGround(1280, 960).x);
  assert.equal(center.y + 192, projectGround(1280, 960).y);
  const start = getFieldCamera({ x: 18, y: 18 }, 2560, 1920, 640, 384);
  assert.ok(start.x >= 0);
  assert.equal(start.y, 0);
  const end = getFieldCamera({ x: 2542, y: 1902 }, 2560, 1920, 640, 384);
  assert.ok(end.x + 640 <= 1100 + 2560 * 0.65);
  assert.ok(end.y + 384 <= projectGround(2560, 1920).y + 10);
  assert.ok(createScenery(2560, 1920).length > 100);
});


import { SLAM, updateSlam } from './boss-attacks.js';

test('보스 내려찍기는 예고 후 한 번만 피해를 주고 회피가 가능하다', () => {
  const battle = { width: 1920, slamCooldown: 0 };
  const hero = { x: 200 };
  assert.equal(updateSlam(battle, hero, 0.05), false);
  assert.equal(battle.slam.x, 200);
  assert.equal(updateSlam(battle, hero, SLAM.windup - 0.1), false);
  assert.equal(updateSlam(battle, hero, 0.11), true);
  assert.equal(updateSlam(battle, hero, 0.05), false);
  updateSlam(battle, hero, SLAM.recovery);
  assert.equal(battle.slam, null);
  battle.slamCooldown = 0;
  updateSlam(battle, hero, 0.05);
  hero.x = battle.slam.dodgeX;
  hero.y = battle.slam.dodgeY;
  assert.equal(updateSlam(battle, hero, SLAM.windup), false);
});

import { getThreatLevel, createEnemyStats } from './encounters.js';

test('사냥 시간에 따라 몬스터 종류가 해금되고 능력치가 증가한다', () => {
  assert.equal(getThreatLevel(59.9), 1);
  assert.equal(getThreatLevel(60), 2);
  assert.equal(createEnemyStats(0, 0.99).type, 'normal');
  const fast = createEnemyStats(60, 0.99);
  const tank = createEnemyStats(120, 0.99);
  const ranged = createEnemyStats(180, 0.99);
  assert.equal(fast.type, 'fast');
  assert.ok(fast.speed > createEnemyStats(60, 0).speed);
  assert.equal(tank.type, 'tank');
  assert.ok(tank.hp > createEnemyStats(120, 0).hp * 2);
  assert.equal(ranged.type, 'ranged');
  assert.equal(ranged.range, 200);
  assert.ok(createEnemyStats(600, 0).hp > createEnemyStats(0, 0).hp);
});

import { isInsideField, constrainToField } from './field-shape.js';

test('불규칙 필드는 중앙이 연결되고 사각 모서리를 제외하며 이동을 경계 안으로 제한한다', () => {
  assert.ok(isInsideField(1280, 960, 2560, 1920));
  assert.equal(isInsideField(18, 18, 2560, 1920), false);
  for (let i = 0; i < 100; i++) {
    const angle = i * Math.PI / 50;
    const point = constrainToField({ x: 1280 + Math.cos(angle) * 2000, y: 960 + Math.sin(angle) * 2000 }, 2560, 1920);
    assert.ok(isInsideField(point.x, point.y, 2560, 1920));
    for (let t = 0; t <= 1; t += 0.1) assert.ok(isInsideField(1280 + (point.x - 1280) * t, 960 + (point.y - 960) * t, 2560, 1920));
  }
});

import { shouldDropChest, createChestEquipment, getEnhancementInfo, enhanceWeapon } from './equipment.js';

test('장비상자 드롭은 1%이며 장비는 직업에 맞는 무기와 방어구로 무작위 생성된다', () => {
  assert.equal(shouldDropChest(0.0099), true);
  assert.equal(shouldDropChest(0.01), false);
  for (const [job, weapon] of [['warrior', 'sword'], ['mage', 'staff'], ['archer', 'bow']]) {
    const item = createChestEquipment(job, () => 0);
    assert.equal(item.type, 'weapon');
    assert.equal(item.weaponType, weapon);
    assert.equal(item.level, 0);
  }
  const rolls = [0.6, 0.98, 0.123];
  const armor = createChestEquipment('mage', () => rolls.shift());
  assert.equal(armor.type, 'armor');
  assert.equal(armor.tier, 'epic');
  assert.ok(armor.stats.maxHp > 0);
});

test('강화 성공은 비용을 소모하고 재로드된 장착 무기의 능력치에도 반영된다', () => {
  const state = JSON.parse(JSON.stringify(createInitialState()));
  state.job = 'warrior'; state.gold = 10000;
  const weapon = state.inventory.find((item) => item.type === 'weapon');
  state.equipment.weapon = JSON.parse(JSON.stringify(weapon));
  const before = getStatSnapshot(state).attack;
  const cost = getEnhancementInfo(0).cost;
  assert.equal(enhanceWeapon(state, weapon.id, 0), 'success');
  assert.equal(weapon.level, 1);
  assert.equal(state.gold, 10000 - cost);
  assert.equal(getStatSnapshot(state).attack, before + 2);
  assert.equal(getStatSnapshot(JSON.parse(JSON.stringify(state))).attack, before + 2);
});

test('일반 실패는 강화도를 유지하고 고강화 파괴는 인벤토리와 장착에서 제거한다', () => {
  const state = createInitialState(); state.gold = 100000;
  const weapon = state.inventory.find((item) => item.type === 'weapon');
  assert.equal(enhanceWeapon(state, weapon.id, 0.99), 'failed');
  assert.equal(weapon.level, 0);
  assert.equal(getEnhancementInfo(4).destroy, 0);
  assert.ok(getEnhancementInfo(5).destroy > 0);
  weapon.level = 5; state.equipment.weapon = { ...weapon };
  assert.equal(enhanceWeapon(state, weapon.id, 0.99), 'destroyed');
  assert.equal(state.equipment.weapon, null);
  assert.ok(!state.inventory.some((item) => item.id === weapon.id));
});

test('골드 부족과 최대 강화에서는 비용이나 무기를 변경하지 않는다', () => {
  const state = createInitialState();
  const weapon = state.inventory.find((item) => item.type === 'weapon');
  assert.equal(enhanceWeapon(state, weapon.id, 0), 'poor');
  assert.equal(weapon.level, 0);
  state.gold = 100000; weapon.level = 15;
  assert.equal(enhanceWeapon(state, weapon.id, 0), 'maxed');
  assert.equal(state.gold, 100000);
  for (let level = 0; level <= 15; level++) {
    const info = getEnhancementInfo(level);
    assert.ok(Math.abs(info.success + info.destroy + info.fail - 1) < 1e-10);
    assert.ok(info.fail >= 0);
  }
});

import { rollAttackDamage } from './combat.js';

test('치명타 성장은 피해에, 회피율 성장은 회피 판정에 적용된다', () => {
  const state = createInitialState(); state.job = 'archer';
  const before = getStatSnapshot(state);
  state.critChanceLevel = 10; state.critDamageLevel = 5; state.evasionLevel = 4;
  const stats = getStatSnapshot(state);
  assert.ok(Math.abs(stats.critChance - 0.15) < 1e-10);
  assert.equal(stats.critDamage, 2);
  assert.equal(stats.move, before.move);
  assert.equal(stats.evade, 0.04);
  assert.equal(rollAttackDamage(stats, 0.1), stats.attack * 2);
  assert.equal(rollAttackDamage(stats, 0.5), stats.attack);
  state.critChanceLevel = 100;
  assert.equal(getStatSnapshot(state).critChance, 0.75);
  for (const key of ['critChanceLevel', 'critDamageLevel', 'agilityLevel']) assert.ok(Number.isFinite(getRealCost(key, 1)));
});


import { evadesAttack } from './combat.js';

test('성장과 장비 회피율이 합산되고 근접·원거리·보스 공격에 쓸 회피를 판정한다', () => {
  const state = createInitialState();
  state.evasionLevel = 10;
  state.equipment.boots = { type: 'boots', stats: { evade: 0.05 } };
  const stats = getStatSnapshot(state);
  assert.ok(Math.abs(stats.evade - 0.15) < 1e-10);
  assert.equal(evadesAttack(stats, 0.1), true);
  assert.equal(evadesAttack(stats, 0.2), false);
  state.evasionLevel = 100;
  assert.equal(getStatSnapshot(state).evade, 0.75);
});


test('사선 투영은 두 이동 축에 깊이를 주고 미니맵 좌표로 역변환된다', () => {
  const origin = projectGround(100, 100);
  const east = projectGround(132, 100);
  const south = projectGround(100, 132);
  assert.ok(east.x > origin.x && east.y > origin.y);
  assert.ok(south.x < origin.x && south.y > origin.y);
  for (const [x, y] of [[1280,960],[18,18],[2400,1500]]) {
    const projected = projectGround(x, y);
    const restored = unprojectGround(projected.x, projected.y);
    assert.ok(Math.abs(restored.x-x) < 2 && Math.abs(restored.y-y) < 2);
  }
});


test('2.5D 보스 내려찍기는 Y축으로 벗어나도 회피된다', () => {
  const battle = { width: 960, height: 800, slamCooldown: 0 };
  const hero = { x: 400, y: 400 };
  updateSlam(battle, hero, 0.05);
  assert.equal(battle.slam.y, 400);
  hero.y += SLAM.radius + 10;
  assert.equal(updateSlam(battle, hero, SLAM.windup), false);
});

import { acceptMission, progressMission, claimMission } from './missions.js';

test('길드 토벌 미션은 대상 처치만 집계하고 보고 시 보상을 한 번 지급한다', () => {
  const state = createInitialState();
  assert.equal(acceptMission(state, 'slime-hunt'), true);
  assert.equal(acceptMission(state, 'fast-hunt'), false);
  progressMission(state, { type: 'fast' });
  progressMission(state, { type: 'normal', worldBoss: true });
  assert.equal(state.mission.progress, 0);
  assert.equal(claimMission(state), 0);
  for (let i = 0; i < 12; i++) progressMission(state, { type: 'normal' });
  assert.equal(state.mission.progress, 10);
  assert.equal(claimMission(state), 120);
  assert.equal(claimMission(state), 0);
  assert.equal(state.gold, 120);
});

test('미션 달성 알림은 마지막 대상 처치에서만 한 번 발생한다', () => {
  const state = createInitialState(); acceptMission(state, 'slime-hunt');
  for (let i = 0; i < 9; i++) assert.equal(progressMission(state, {type:'normal'}), null);
  assert.equal(progressMission(state, {type:'fast'}), null);
  const completed = progressMission(state, {type:'normal'});
  assert.equal(completed.id, 'slime-hunt');
  assert.equal(progressMission(state, {type:'normal'}), null);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(progressMission(restored, {type:'normal'}), null);
});


import { getSceneryOpacity, drawScenery } from './world-view.js';

test('캐릭터를 앞에서 가리는 나무만 반투명해진다', () => {
  const hero = { x: 100, y: 100 };
  assert.equal(getSceneryOpacity({ x: 120, y: 120, type: 'tree' }, hero), 0.22);
  assert.equal(getSceneryOpacity({ x: 120, y: 120, type: 'tree', dense: true }, hero), 0.22);
  assert.equal(getSceneryOpacity({ x: 80, y: 80, type: 'tree' }, hero), 1);
  assert.equal(getSceneryOpacity({ x: 250, y: 100, type: 'tree' }, hero), 1);
  assert.equal(getSceneryOpacity({ x: 400, y: 400, type: 'tree' }, hero), 1);
  assert.equal(getSceneryOpacity({ x: 120, y: 120, type: 'rock' }, hero), 1);
  assert.equal(getSceneryOpacity({ x: 120, y: 120, type: 'tree' }), 1);
});

test('숲 투명도는 다른 캐릭터나 UI 그리기에 남지 않는다', () => {
  const stack = []; const observed = [];
  const ctx = { globalAlpha: 1, save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
    fillRect() { observed.push(this.globalAlpha); }, beginPath() {}, ellipse() {}, fill() {} };
  drawScenery(ctx, { x: 120, y: 120, type: 'tree' }, { x: 100, y: 100 });
  assert.ok(observed.every(alpha => alpha === 0.22));
  assert.equal(ctx.globalAlpha, 1);
});


import { calculateIncomingDamage } from './combat.js';

test('민첩성과 회피율은 독립적이며 방어력이 실제 피해를 감소시킨다', () => {
  const state = createInitialState();
  const initial = getStatSnapshot(state);
  state.agilityLevel = 5;
  assert.equal(getStatSnapshot(state).move, initial.move + 15);
  assert.equal(getStatSnapshot(state).evade, initial.evade);
  state.evasionLevel = 10; state.defenseLevel = 25;
  const stats = getStatSnapshot(state);
  assert.equal(stats.evade, 0.1);
  assert.equal(stats.defense, 50);
  assert.equal(calculateIncomingDamage(30, stats.defense), 20);
  assert.equal(calculateIncomingDamage(8, 0), 8);
  assert.equal(calculateIncomingDamage(1, 10000), 1);
});
