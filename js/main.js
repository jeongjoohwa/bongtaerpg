import { MISSIONS, acceptMission, progressMission, claimMission } from './missions.js';
import { createSharedBossClient } from './shared-boss.js';
import { drawBossArena, createVolcanoScenery } from './boss-view.js';
import { shouldDropChest, createChestEquipment, getEnhancementInfo, enhanceWeapon } from './equipment.js';
import { isInsideField, constrainToField } from './field-shape.js';
import { getThreatLevel, createEnemyStats } from './encounters.js';
import { SLAM, updateSlam } from './boss-attacks.js';
import { projectGround, unprojectGround, getFieldCamera, createScenery, drawGround, drawScenery, drawActor } from './world-view.js';
import { getRangedMovement, rollAttackDamage, evadesAttack, calculateIncomingDamage } from './combat.js';
import { JOBS, POTION_CONFIG, WORLD_BOSS_DATA, EQUIPMENT_SLOTS } from './data.js';
import { createInitialState, getStatSnapshot, loadState, saveState, resetSave, getRealCost } from './state.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
  huntTimeLabel: document.getElementById('huntTimeLabel'),
  goldLabel: document.getElementById('goldLabel'),
  shopGoldLabel: document.getElementById('shopGoldLabel'),
  threatLabel: document.getElementById('threatLabel'),
  heroName: document.getElementById('heroName'),
  hpText: document.getElementById('hpText'),
  hpBar: document.getElementById('hpBar'),
  buildInfo: document.getElementById('buildInfo'),
  saveStatus: document.getElementById('saveStatus'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  innBtn: document.getElementById('innBtn'),
  bossBtn: document.getElementById('bossBtn'),
  jobSelection: document.getElementById('jobSelection'),
  innScreen: document.getElementById('innScreen'),
  equipmentScreen: document.getElementById('equipmentScreen'),
  shopScreen: document.getElementById('shopScreen'),
  bossScreen: document.getElementById('bossScreen'),
  innHeroName: document.getElementById('innHeroName'),
  innHpText: document.getElementById('innHpText'),
  innTimer: document.getElementById('innTimer'),
  innRestBtn: document.getElementById('innRestBtn'),
  innEquipBtn: document.getElementById('innEquipBtn'),
  innShopBtn: document.getElementById('innShopBtn'),
  equipmentList: document.getElementById('equipmentList'),
  shopList: document.getElementById('shopList'),
  bossTitle: document.getElementById('bossTitle'),
  bossStats: document.getElementById('bossStats'),
  bossHpBar: document.getElementById('bossHpBar'),
  bossChallengeBtn: document.getElementById('bossChallengeBtn'),
  bossCloseBtn: document.getElementById('bossCloseBtn'),
  atkBtn: document.getElementById('atkBtn'),
  spdBtn: document.getElementById('spdBtn'),
  atkCost: document.getElementById('atkCost'),
  spdCost: document.getElementById('spdCost'),
  hpBtn: document.getElementById('hpBtn')
};

const worldConfig = {
  tile: 32,
  width: canvas.width,
  height: canvas.height,
  restDurationMs: 30_000,
  autoPotionCooldownMs: 2000
};

const field = { width: 2560, height: 1920 };
const scenery = createScenery(field.width, field.height);
let explorationTarget = null;
let equipmentMode = 'inventory';

let state = loadState();
let hero = {
  x: field.width / 2,
  y: field.height / 2,
  dir: 0,
  move: 0,
  walk: 0,
  hp: 1,
  maxHp: 1,
  attackTimer: 0,
  invuln: 0,
  attackAnim: 0,
  attackDir: 0,
  state: 'move',
  attackTarget: null,
  hitLock: false,
  lastDamage: 0
};
let mobs = [];
let projectiles = [];
let particles = [];
let lastTimestamp = performance.now();
let saveAccumulator = 0;
let bodyTexts = [];
let bossBattle = null;
let battleStartedAt = 0;
let lastPotionUsedAt = 0;

const sharedBoss = createSharedBossClient({
  onStatus(connected) {
    document.getElementById('bossConnection').textContent = connected ? '모든 유저가 같은 보스 HP를 공유합니다.' : '공유 서버 연결 끊김 · 자동 재연결 중';
    ui.bossChallengeBtn.disabled = !connected || !state.job || state.inn.inInn || state.inn.isResting || state.worldBoss.defeated;
  },
  onBoss(boss) {
    const previous = state.worldBoss;
    if (previous.slot === 'shared' && (boss.createdAt < previous.createdAt || (boss.seasonId === previous.seasonId && boss.revision < previous.revision))) return;
    if (bossBattle && previous.seasonId !== boss.seasonId) endBossFight('새로운 주간 보스가 등장했습니다.');
    state.worldBoss = boss;
    if (bossBattle && mobs[0]?.worldBoss) {
      mobs[0].hp = boss.currentHp;
      mobs[0].maxHp = boss.maxHp;
      if (boss.defeated) endBossFight('모든 모험가의 힘으로 레드드래곤을 처치했습니다!');
    }
    renderBossInfo();
  },
  onReward(gold) {
    state.gold += gold;
    saveState(state);
    logToBox(`공유 보스 처치 참여 보상 ${formatNumber(gold)} G를 받았습니다.`);
  }
});

function formatNumber(value) {
  return Math.floor(value || 0).toLocaleString('ko-KR');
}

function logToBox(text) {
  // Keep combat messages available without a permanent description below the field.
  canvas.setAttribute('aria-description', text);
}

function setSaveStatus(text) {
  ui.saveStatus.textContent = text;
}

function applyJobSelection(jobId) {
  state.job = jobId;
  state.lastKnownHp = 100;
  startNewAdventure();
  saveState(state);
}

function startNewAdventure() {
  const stats = getStatSnapshot(state);
  hero = {
    x: field.width / 2,
    y: field.height / 2,
    dir: 0,
    move: 0,
    walk: 0,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    attackTimer: 0.1,
    invuln: 0,
    attackAnim: 0,
    attackDir: 0,
    state: 'move',
    attackTarget: null,
    hitLock: false,
    lastDamage: 0
  };
  mobs = [];
  projectiles = [];
  particles = [];
  state.inn.inInn = false;
  state.inn.isResting = false;
  state.inn.restStartedAt = null;
  state.inn.restEndsAt = null;
  state.inn.recoverAtEnd = false;
  state.battle.inBossFight = false;
  ui.jobSelection.classList.add('hidden');
  ui.innScreen.classList.add('hidden');
  spawnMob();
  spawnMob();
  logToBox(`${JOBS[state.job].name}이(가) 모험을 시작합니다.`);
  updateUi();
}

function ensureBossSeason() {
  // Shared boss seasons and HP are owned by the server.
}

function getSeasonId(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMondayStart(nowTs) {
  const now = new Date(nowTs);
  const current = new Date(now);
  const day = current.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  current.setDate(current.getDate() + diff);
  current.setHours(0, 0, 0, 0);
  return current;
}

function countPotion() {
  return Object.values(state.potionInventory).reduce((sum, value) => sum + value, 0);
}

function getTierColor(tier) {
  const map = {
    common: '#9aa5b1',
    rare: '#66d57d',
    epic: '#5aa9ff',
    heroic: '#c27cff',
    legendary: '#ffb052',
    mythic: '#ff5d5d'
  };
  return map[tier] || '#fff';
}

function getPotionAmount(tier, maxHp) {
  const config = POTION_CONFIG[tier];
  if (!config) return 0;
  if (config.amount) return Math.min(config.amount, maxHp);
  if (config.amountRatio) return Math.floor(maxHp * config.amountRatio);
  return 0;
}

function usePotionIfNeeded() {
  if (!state.job || !state.autoPotion || state.inn.isResting || hero.hp <= 0) return false;
  const stats = getStatSnapshot(state);
  if (hero.hp > 5 || hero.hp > stats.maxHp) return false;
  const preferredOrder = ['mythic', 'legendary', 'heroic', 'epic', 'rare', 'common'];
  const targetTier = state.autoPotionTier || 'rare';
  const possible = preferredOrder.includes(targetTier) ? [targetTier, ...preferredOrder.filter(v => v !== targetTier)] : preferredOrder;

  const now = Date.now();
  if (now - lastPotionUsedAt < worldConfig.autoPotionCooldownMs) return false;

  for (const tier of possible) {
    if (state.potionInventory[tier] <= 0) continue;
    const heal = getPotionAmount(tier, stats.maxHp);
    if (heal <= 0) continue;
    state.potionInventory[tier] -= 1;
    hero.hp = Math.min(stats.maxHp, hero.hp + heal);
    lastPotionUsedAt = now;
    particles.push({ x: hero.x, y: hero.y - 30, text: `+${heal} HP`, age: 0, color: '#b9ffd9' });
    logToBox(`${POTION_CONFIG[tier].name}을(를) 사용해 체력을 회복했습니다.`);
    return true;
  }
  return false;
}

function spawnMob() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 220 + Math.random() * 180;
  const x = Math.max(35, Math.min(field.width - 35, hero.x + Math.cos(angle) * radius));
  const y = Math.max(35, Math.min(field.height - 35, hero.y + Math.sin(angle) * radius));

  mobs.push({ ...constrainToField({ x, y }, field.width, field.height, 60), ...createEnemyStats(state.fieldSeconds) });
}

function getClosestMob() {
  let best = null;
  let bestDistance = Infinity;
  for (const mob of mobs) {
    const dist = Math.hypot(mob.x - hero.x, mob.y - hero.y);
    if (dist < bestDistance) {
      bestDistance = dist;
      best = mob;
    }
  }
  return { mob: best, dist: bestDistance };
}

function getAttackStats() {
  return getStatSnapshot(state);
}

function dealDamage(target, damage) {
  if (!target || !mobs.includes(target)) return;
  if (target.worldBoss) {
    const encounter = bossBattle;
    sharedBoss.attack(damage).then((dealt) => {
      if (!dealt || bossBattle !== encounter || !mobs.includes(target)) return;
      state.battle.bossDamage += dealt;
      target.flash = 0.14;
      particles.push({ x: target.x, y: target.y - 48, text: `-${dealt}`, age: 0, color: '#ffd79d' });
    });
    return;
  }
  target.hp -= damage;
  target.flash = 0.14;
  particles.push({ x: target.x, y: target.y - 24, text: `-${damage}`, age: 0, color: '#ffd79d' });
  if (target.hp <= 0) {
    const goldReward = Math.round((target.reward || 8) * (1 + state.coinLevel * 0.2));
    state.gold += goldReward;
    state.kills += 1;
    const completedMission = progressMission(state, target);
    if (completedMission) showMissionToast(completedMission);
    saveState(state);
    if (shouldDropChest()) {
      state.lootChests.push({ x: target.x, y: target.y });
      particles.push({ x: target.x, y: target.y - 40, text: '장비상자!', age: 0, color: '#ffe094' });
      logToBox('희귀한 장비상자가 떨어졌습니다. 다가가면 자동으로 획득합니다.');
      saveState(state);
    }
    const index = mobs.indexOf(target);
    if (index >= 0) mobs.splice(index, 1);
    particles.push({ x: target.x, y: target.y - 36, text: `+${goldReward} G`, age: 0, color: '#fddc75' });

  }
}

function beginHeroAttack(target) {
  const stats = getAttackStats();
  hero.state = 'attack';
  hero.attackAnim = 0;
  hero.attackTarget = target;
  hero.hitLock = false;
  hero.attackDir = hero.dir;
  hero.attackTimer = 0.75 / Math.max(0.15, stats.speed);
}

function updateHeroAttack(dt) {
  const stats = getAttackStats();
  hero.attackAnim += dt;
  const duration = 0.42;
  const ratio = Math.min(1, hero.attackAnim / duration);

  if (!hero.hitLock && ratio >= 0.42 && hero.attackTarget && mobs.includes(hero.attackTarget)) {
    const dist = Math.max(0, Math.hypot(hero.attackTarget.x - hero.x, hero.attackTarget.y - hero.y) - (hero.attackTarget.worldBoss ? 60 : 0));
    if (state.job !== 'warrior' && dist <= stats.range) {
      projectiles.push({
        x: hero.x, y: hero.y, target: hero.attackTarget,
        damage: rollAttackDamage(stats), speed: state.job === 'archer' ? 380 : 270,
        color: JOBS[state.job].color, type: state.job
      });
    } else if (state.job === 'warrior' && dist <= 64) {
      dealDamage(hero.attackTarget, rollAttackDamage(stats));
    }
    hero.hitLock = true;
  }

  if (ratio >= 1) {
    hero.state = 'move';
    hero.attackAnim = 0;
    hero.attackTarget = null;
    hero.hitLock = false;
    hero.attackTimer = 0.75 / Math.max(0.15, stats.speed);
  }
}

function updatePlayer(dt) {
  if (!state.job || state.inn.isResting) return;

  const stats = getAttackStats();
  hero.invuln = Math.max(0, hero.invuln - dt);
  hero.attackTimer = Math.max(0, hero.attackTimer - dt);
  hero.walk += dt * 9;

  const chest = [...state.lootChests].sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y))[0];
  if (chest) {
    const dx = chest.x - hero.x;
    const dy = chest.y - hero.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 26) {
      const item = createChestEquipment(state.job);
      state.inventory.push(item);
      state.lootChests.splice(state.lootChests.indexOf(chest), 1);
      logToBox(`장비상자 획득! ${item.name}이(가) 인벤토리에 들어왔습니다.`);
      particles.push({ x: hero.x, y: hero.y - 35, text: item.name, age: 0, color: '#ffe094' });
      saveState(state);
    } else {
      hero.x += dx / distance * Math.min(distance, stats.move * dt);
      hero.y += dy / distance * Math.min(distance, stats.move * dt);
      hero.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
      if (hero.state === 'attack') updateHeroAttack(dt);
      return;
    }
  }
  const { mob: target, dist } = getClosestMob();

  if (!target) {
    if (!explorationTarget || Math.hypot(explorationTarget.x - hero.x, explorationTarget.y - hero.y) < 20) {
      explorationTarget = constrainToField({ x: 120 + Math.random() * (field.width - 240), y: 120 + Math.random() * (field.height - 240) }, field.width, field.height, 100);
    }
    const dx = explorationTarget.x - hero.x;
    const dy = explorationTarget.y - hero.y;
    const distance = Math.hypot(dx, dy) || 1;
    const step = Math.min(stats.move * dt, distance);
    hero.x += dx / distance * step;
    hero.y += dy / distance * step;
    hero.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
    hero.state = 'move';
    hero.attackTarget = null;
    return;
  }

  if (state.job !== 'warrior') {
    const next = getRangedMovement(hero, mobs, stats.range, stats.move, dt, field.width, field.height, (point) => constrainToField(point, field.width, field.height));
    hero.x = next.x;
    hero.y = next.y;
    if (target) {
      const dx = target.x - hero.x;
      const dy = target.y - hero.y;
      hero.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
    }
    if (hero.state === 'attack') updateHeroAttack(dt);
    else if (target && Math.hypot(target.x - hero.x, target.y - hero.y) <= stats.range && hero.attackTimer <= 0) beginHeroAttack(target);
    return;
  }

  if (hero.state === 'attack') {
    updateHeroAttack(dt);
  } else if (target) {
    const desiredRange = state.job === 'warrior' ? 38 : stats.range * 0.8;
    if (dist > desiredRange) {
      const dx = (target.x - hero.x) / (dist || 1);
      const dy = (target.y - hero.y) / (dist || 1);
      hero.x += dx * stats.move * dt;
      hero.y += dy * stats.move * dt;
      hero.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
    }
    if (dist <= desiredRange && hero.attackTimer <= 0) {
      beginHeroAttack(target);
    }
  }

  hero.x = Math.max(18, Math.min(field.width - 18, hero.x));
  hero.y = Math.max(18, Math.min(field.height - 18, hero.y));
}

function takeHeroDamage(damage) {
  if (hero.invuln > 0 || hero.hp <= 0) return;
  const stats = getAttackStats();
  if (evadesAttack(stats)) {
    particles.push({ x: hero.x, y: hero.y - 28, text: '회피!', age: 0, color: '#b6eaff' });
    return;
  }
  damage = calculateIncomingDamage(damage, stats.defense);
  hero.hp = Math.max(0, hero.hp - damage);
  hero.invuln = 0.35;
  hero.lastDamage = damage;
  particles.push({ x: hero.x, y: hero.y - 28, text: `-${Math.ceil(damage)}`, age: 0, color: '#ff9494' });
}

function updateEnemies(dt) {
  for (const mob of [...mobs]) {
    mob.flash = Math.max(0, mob.flash - dt);
    mob.attackAnim = Math.max(0, (mob.attackAnim || 0) - dt);
    mob.attackTimer -= dt;
    const dx = hero.x - mob.x;
    const dy = hero.y - mob.y;
    const dist = Math.hypot(dx, dy) || 1;
    const attackDistance = mob.range + 12 + (mob.worldBoss ? 60 : 0);
    if (dist > attackDistance + 0.01) {
      const preparingSlam = mob.worldBoss && bossBattle?.slam && !bossBattle.slam.impacted;
      if (!preparingSlam) {
        const step = Math.min(mob.speed * dt, Math.max(0, dist - attackDistance));
        mob.x += (dx / dist) * step;
        mob.y += (dy / dist) * step;
        if (mob.worldBoss) {
          mob.x = Math.max(70, Math.min(bossBattle.width - 70, mob.x));
          mob.y = Math.max(70, Math.min(bossBattle.height - 70, mob.y));
        }
      }
    }
    const distanceAfterMoving = Math.hypot(hero.x - mob.x, hero.y - mob.y);
    if (distanceAfterMoving <= attackDistance + 0.01 && mob.attackTimer <= 0) {
      mob.attackAnim = 0.25;
      mob.attackTimer = mob.worldBoss ? WORLD_BOSS_DATA.attackInterval : mob.boss ? 1.2 : 1.8;
      if (mob.type === 'ranged') {
        projectiles.push({ x: mob.x, y: mob.y, vx: dx / dist * 170, vy: dy / dist * 170,
          damage: mob.damage, hostile: true, life: 3, color: '#ff866d' });
      } else {
        takeHeroDamage(mob.damage);
      }
    }
  }
}

function updateProjectiles(dt) {
  for (const projectile of [...projectiles]) {
    if (projectile.hostile) {
      const oldX = projectile.x;
      const oldY = projectile.y;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      const dx = projectile.x - oldX;
      const dy = projectile.y - oldY;
      const t = Math.max(0, Math.min(1, ((hero.x - oldX) * dx + (hero.y - oldY) * dy) / (dx * dx + dy * dy || 1)));
      const hit = Math.hypot(hero.x - oldX - dx * t, hero.y - oldY - dy * t) < 15;
      if (hit) takeHeroDamage(projectile.damage);
      if (hit || projectile.life <= 0) projectiles.splice(projectiles.indexOf(projectile), 1);
      continue;
    }
    if (!projectile.target || !mobs.includes(projectile.target)) {
      projectiles.splice(projectiles.indexOf(projectile), 1);
      continue;
    }
    const dx = projectile.target.x - projectile.x;
    const dy = projectile.target.y - projectile.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = projectile.speed * dt;
    if (dist <= step + (projectile.target.worldBoss ? 60 : 8)) {
      dealDamage(projectile.target, projectile.damage);
      projectiles.splice(projectiles.indexOf(projectile), 1);
    } else {
      projectile.x += (dx / dist) * step;
      projectile.y += (dy / dist) * step;
    }
  }
}

function updateParticles(dt) {
  for (const particle of [...particles]) {
    particle.age += dt;
    particle.y -= 22 * dt;
    if (particle.age > 0.8) particles.splice(particles.indexOf(particle), 1);
  }
}

function handleDeath() {
  if (hero.hp > 0) return;
  state.inn.isResting = true;
  state.inn.inInn = true;
  state.inn.restStartedAt = Date.now();
  state.inn.restEndsAt = Date.now() + worldConfig.restDurationMs;
  state.inn.recoverAtEnd = true;
  state.inn.woundedAt = Date.now();
  showInnScreen();
  logToBox('체력이 소진되어 길드으로 이동했습니다. 30초 휴식 후 자동으로 사냥에 복귀합니다.');
  saveState(state);
}

function showInnScreen() {
  ui.innScreen.classList.remove('hidden');
  ui.jobSelection.classList.add('hidden');
  updateInnUi();
}

function hideInnScreen() {
  ui.innScreen.classList.add('hidden');
}

function hideEquipmentScreen() {
  ui.equipmentScreen.classList.add('hidden');
}

function hideShopScreen() {
  ui.shopScreen.classList.add('hidden');
}

function closeBossScreen() {
  ui.bossScreen.classList.add('hidden');
}

let missionToastTimer;
function showMissionToast(mission) {
  const toast = document.getElementById('missionToast');
  document.getElementById('missionToastName').textContent = mission.name;
  document.getElementById('missionToastDetail').textContent = `길드 접수원에게 보고하고 ${mission.gold} G를 받으세요.`;
  clearTimeout(missionToastTimer);
  toast.classList.add('is-visible');
  missionToastTimer = setTimeout(() => toast.classList.remove('is-visible'), 5000);
}

function showMissions() {
  const list = document.getElementById('missionList');
  list.innerHTML = '';
  for (const mission of MISSIONS) {
    const active = state.mission?.id === mission.id;
    const done = active && state.mission.progress >= mission.count;
    const card = document.createElement('div'); card.className = 'item-card';
    card.innerHTML = `<h3>${mission.name}</h3><p>${mission.description}</p><p>보상 ${mission.gold} G</p>${active ? `<p>진행 ${state.mission.progress} / ${mission.count}</p>` : ''}<button class="btn" ${state.mission && !done ? 'disabled' : ''}>${done ? '완료 보고 · 보상 받기' : active ? '진행 중' : '의뢰 수락'}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      const reward = done ? claimMission(state) : 0;
      if (!done) acceptMission(state, mission.id);
      saveState(state);
      document.getElementById('missionMessage').textContent = reward ? `토벌 보고 완료! ${reward} G를 받았습니다.` : '의뢰를 수락했습니다. 사냥터에서 토벌 후 돌아와 보고하세요.';
      showMissions(); updateUi();
    });
    list.appendChild(card);
  }
  document.getElementById('missionScreen').classList.remove('hidden');
}

function showEquipmentScreen(mode = 'inventory') {
  equipmentMode = mode;
  document.getElementById('equipmentMessage').textContent = '';
  renderEquipmentList();
  ui.equipmentScreen.classList.remove('hidden');
}

function showShopScreen() {
  renderShopList();
  ui.shopScreen.classList.remove('hidden');
}

function showBossScreen() {
  ensureBossSeason();
  renderBossInfo();
  ui.bossScreen.classList.remove('hidden');
}

function endBossFight(message) {
  if (!bossBattle) return;
  const normal = bossBattle.normal;
  state.battle.inBossFight = false;
  bossBattle = null;
  hero.x = normal.x;
  hero.y = normal.y;
  hero.state = 'move';
  hero.attackTarget = null;
  hero.attackTimer = 0;
  mobs = normal.mobs;
  projectiles = [];
  particles = [];
  document.getElementById('bossLeaveBtn').hidden = true;
  saveState(state);
  logToBox(message);
}

function setBattleMode(mode) {
  if (!sharedBoss.ready) { logToBox('공유 보스 서버에 연결 중입니다. 잠시 후 다시 도전해 주세요.'); return; }
  if (mode !== 'boss' || bossBattle || !state.job || state.inn.inInn || state.inn.isResting) return;
  ensureBossSeason();
  if (state.worldBoss.currentHp <= 0) {
    logToBox('이번 주 보스는 이미 처치했습니다.');
    return;
  }
  bossBattle = {
    durationMs: WORLD_BOSS_DATA.durationSeconds * 1000,
    width: 2400,
    height: 1920,
    scenery: createVolcanoScenery(2400, 1920),
    normal: { x: hero.x, y: hero.y, mobs },
    camera: { x: 0, y: 0 }
  };
  battleStartedAt = Date.now();
  state.battle.inBossFight = true;
  state.battle.bossDamage = 0;
  hero.x = 1000;
  hero.y = 1150;
  hero.state = 'move';
  hero.attackTarget = null;
  hero.attackTimer = 0;
  mobs = [{ x: 1320, y: 940, hp: state.worldBoss.currentHp, maxHp: state.worldBoss.maxHp,
    damage: WORLD_BOSS_DATA.damage + getThreatLevel(state.fieldSeconds) * WORLD_BOSS_DATA.damagePerStage,
    speed: WORLD_BOSS_DATA.moveSpeed, range: WORLD_BOSS_DATA.attackRange,
    attackTimer: WORLD_BOSS_DATA.attackInterval, boss: true, worldBoss: true, flash: 0 }];
  projectiles = [];
  particles = [];
  ui.bossScreen.classList.add('hidden');
  document.getElementById('bossLeaveBtn').hidden = false;
  logToBox('보스 한 마리와 2.5D 전장에서 자동 전투를 시작합니다.');
}

function renderBossInfo() {
  ensureBossSeason();
  const boss = state.worldBoss;
  ui.bossTitle.textContent = `${boss.bossName || WORLD_BOSS_DATA.name} · 공유 월드 보스`;
  ui.bossStats.textContent = `보스 HP ${formatNumber(boss.currentHp)} / ${formatNumber(boss.maxHp)}`;
  ui.bossHpBar.style.width = `${Math.max(0, (boss.currentHp / boss.maxHp) * 100)}%`;
}

function buildEquipmentStatsText(item) {
  if (!item || !item.stats) return '능력치 없음';
  const parts = [];
  if (item.stats.attack) parts.push(`공격 +${item.stats.attack}`);
  if (item.stats.maxHp) parts.push(`최대 HP +${item.stats.maxHp}`);
  if (item.stats.defense) parts.push(`방어 +${item.stats.defense}`);
  if (item.stats.attackSpeed) parts.push(`공격 속도 +${item.stats.attackSpeed}`);
  if (item.stats.moveSpeed) parts.push(`이동 속도 +${item.stats.moveSpeed}`);
  if (item.stats.evade) parts.push(`회피 +${item.stats.evade}`);
  return parts.join(' · ') || '기본 장비';
}

function renderEquipmentList() {
  const smith = equipmentMode === 'smith';
  const items = (state.inventory || []).filter((item) => !smith || item.type === 'weapon');
  document.getElementById('equipmentTitle').textContent = smith ? '대장장이 · 무기 강화' : '길드 접수원 · 인벤토리';
  document.getElementById('equipmentSummary').textContent = smith
    ? `보유 골드 ${formatNumber(state.gold)} G · 성공 시 공격력 +2 · 일반 실패 시 강화도 유지 · +5부터 파괴 위험 · 최대 +15`
    : `장비 ${state.inventory.length}개 · ${Object.entries(state.potionInventory).map(([tier, count]) => `${POTION_CONFIG[tier].name} ${count}개`).join(' · ')}`;
  ui.equipmentList.innerHTML = '';
  if (!items.length) ui.equipmentList.textContent = smith ? '강화할 무기가 없습니다. 일반 필드에서 장비상자를 찾아보세요.' : '보관 중인 장비가 없습니다.';

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'item-card';
    const info = getEnhancementInfo(item.level || 0);
    card.innerHTML = `
      <h3>${item.name}${item.type === 'weapon' ? ` +${item.level || 0}` : ''}</h3>
      <div class="meta">
        <div>종류: ${item.type}</div>
        <div>등급: ${item.tier}</div>
        <div>내구도: ${item.durability || 0} / ${item.maxDurability || 100}</div>
        <div>${buildEquipmentStatsText(item)}${item.type === 'weapon' ? ` · 강화 공격 +${(item.level || 0) * 2}` : ''}</div>
        ${smith ? `<div>강화 비용 ${formatNumber(info.cost)} G</div><div>성공 ${(info.success * 100).toFixed(0)}% · 실패 ${(info.fail * 100).toFixed(0)}% · 파괴 ${(info.destroy * 100).toFixed(0)}%</div><div>${info.destroy ? '파괴 시 무기가 사라집니다.' : '현재 단계는 파괴되지 않습니다.'}</div>` : ''}
      </div>
      <div class="actions">
        ${smith ? `<button class="btn small" data-action="enhance" data-id="${item.id}" ${info.maxed || state.gold < info.cost ? 'disabled' : ''}>${info.maxed ? '최대 강화' : `+${(item.level || 0) + 1} 강화 시도`}</button>` : ''}
        <button class="btn small" data-action="equip" data-id="${item.id}">${state.equipment[item.type] && state.equipment[item.type].id === item.id ? '장착 해제' : '장착'}</button>
        <button class="btn alt small" data-action="repair" data-id="${item.id}">수리</button>
      </div>
    `;
    ui.equipmentList.appendChild(card);
  }

  ui.equipmentList.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      const itemId = button.dataset.id;
      const item = state.inventory.find((entry) => entry.id === itemId);
      if (!item) return;
      if (action === 'enhance') {
        const result = enhanceWeapon(state, itemId);
        const message = { success: `${item.name} 강화 성공! +${item.level}`, failed: '강화 실패. 강화도는 유지됩니다.', destroyed: `${item.name} 강화 중 파괴되었습니다.`, poor: '골드가 부족합니다.', maxed: '최대 강화입니다.', missing: '무기가 없습니다.' }[result];
        document.getElementById('equipmentMessage').textContent = message;
        logToBox(message);
      } else if (action === 'equip') {
        toggleEquipItem(item);
      } else if (action === 'repair') {
        repairItem(item);
      }
      hero.hp = Math.min(hero.hp, getAttackStats().maxHp);
      saveState(state);
      renderEquipmentList();
      updateUi();
    });
  });
}

function toggleEquipItem(item) {
  const slot = item.type;
  const current = state.equipment[slot];
  if (current && current.id === item.id) {
    state.equipment[slot] = null;
    item.isEquipped = false;
    logToBox(`${item.name}을(를) 장비에서 해제했습니다.`);
    return;
  }
  if (slot === 'weapon' && !JOBS[state.job]?.weaponTypes.includes(item.weaponType)) {
    logToBox('현재 직업이 사용할 수 없는 무기입니다.');
    return;
  }
  if (current) {
    const previous = state.inventory.find((entry) => entry.id === current.id);
    if (previous) previous.isEquipped = false;
  }
  state.equipment[slot] = item;
  item.isEquipped = true;
  logToBox(`${item.name}을(를) 장착했습니다.`);
}

function repairItem(item) {
  const repairCost = Math.max(5, Math.ceil((item.maxDurability - item.durability) * 0.35));
  if (state.gold < repairCost) {
    logToBox('골드가 부족해 장비를 수리할 수 없습니다.');
    return;
  }
  state.gold -= repairCost;
  item.durability = item.maxDurability;
  logToBox(`${item.name}을(를) 수리했습니다. 비용 ${repairCost} G`);
}

function renderShopList() {
  ui.shopGoldLabel.textContent = `${state.gold.toLocaleString('ko-KR')} G`;
  ui.shopList.innerHTML = '';
  const potionItems = Object.entries(POTION_CONFIG).map(([key, config]) => ({
    id: key,
    type: 'potion',
    label: config.name,
    price: config.price,
    tier: config.tier,
    info: config.amount ? `${config.amount} HP 회복` : `${Math.round((config.amountRatio || 0) * 100)}% HP 회복`,
    potionKey: key
  }));

  for (const entry of potionItems) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <h3>${entry.label}</h3>
      <div class="meta">
        <div>등급: ${entry.tier}</div>
        <div>가격: ${entry.price} G</div>
        <div>${entry.info}</div>
      </div>
      <div class="actions">
        <button class="btn small" data-shop="buy-potion" data-potion="${entry.potionKey}" data-price="${entry.price}">구매</button>
      </div>
    `;
    ui.shopList.appendChild(card);
  }

  ui.shopList.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const shopAction = button.dataset.shop;
      if (shopAction === 'buy-potion') {
        const potionKey = button.dataset.potion;
        const price = Number(button.dataset.price || 0); 
        if (state.gold < price) {
          logToBox('골드가 부족해 구매할 수 없습니다.');
          return;
        }
        state.gold -= price;
        state.potionInventory[potionKey] = (state.potionInventory[potionKey] || 0) + 1;
        logToBox(`${POTION_CONFIG[potionKey].name}을(를) 구매했습니다.`);
      }
      saveState(state);
      updateUi();
      renderShopList();
    });
  });
}

function toggleRest() {
  if (!state.inn.isResting) {
    state.inn.isResting = true;
    state.inn.restStartedAt = Date.now();
    state.inn.restEndsAt = Date.now() + worldConfig.restDurationMs;
    state.inn.inInn = true;
    logToBox('길드에서 휴식 중... 00:30');
    saveState(state);
    return;
  }
  const now = Date.now();
  if (now >= (state.inn.restEndsAt || now)) {
    completeRest();
  }
}

function completeRest() {
  const autoReturn = state.inn.recoverAtEnd;
  const stats = getStatSnapshot(state);
  hero.hp = stats.maxHp;
  state.inn.isResting = false;
  state.inn.recoverAtEnd = false;
  state.inn.restStartedAt = null;
  state.inn.restEndsAt = null;
  if (autoReturn) {
    state.fieldSeconds = 0;
    state.inn.inInn = false;
    hero.state = 'move';
    hero.attackTarget = null;
    hero.attackTimer = 0;
    hero.invuln = 3;
    mobs = [];
    projectiles = [];
    hideEquipmentScreen();
    hideShopScreen();
    document.getElementById('missionScreen').classList.add('hidden');
    hideInnScreen();
    logToBox('30초 휴식으로 체력을 회복했습니다. 사냥 시간과 위협도를 초기화하고 자동 사냥을 재개합니다.');
  } else {
    logToBox('체력 회복 완료! 전투맵으로 돌아갈 수 있습니다.');
  }
  saveState(state);
}

function updateInnUi() {
  const stats = getStatSnapshot(state);
  const returnLocked = state.inn.recoverAtEnd && state.inn.isResting;
  document.getElementById('innDoorBtn').disabled = returnLocked;
  document.getElementById('innDoorBtn').setAttribute('aria-disabled', String(returnLocked));
  document.getElementById('innDoorTip').textContent = returnLocked ? '회복 후 자동 복귀' : '사냥터로 돌아가기';
  ui.innHeroName.textContent = state.nickname || '모험가';
  document.getElementById('guildHeroName').textContent = state.nickname || '내 캐릭터';
  document.getElementById('guildRegistrationHint').hidden = Boolean(state.job);
  ui.innHpText.textContent = `HP ${Math.max(0, Math.ceil(hero.hp))} / ${stats.maxHp}`;

  if (state.inn.isResting && state.inn.restEndsAt) {
    const diff = Math.max(0, state.inn.restEndsAt - Date.now());
    const seconds = Math.ceil(diff / 1000);
    ui.innTimer.textContent = `${state.inn.recoverAtEnd ? '자동 복귀까지' : '휴식 타이머'}: ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  } else {
    ui.innTimer.textContent = '휴식 완료 · 전투맵으로 돌아갈 수 있습니다.';
  }
}

function updateBossFight(dt) {
  if (!bossBattle) return;
  if (Date.now() - battleStartedAt >= bossBattle.durationMs) {
    endBossFight('보스 도전 시간이 끝났습니다. 일반 사냥으로 돌아갑니다.');
    return;
  }
  const target = mobs[0];
  const stats = getAttackStats();
  const dx = target.x - hero.x;
  const dy = target.y - hero.y;
  const centerDistance = Math.hypot(dx, dy) || 1;
  const distance = Math.max(0, centerDistance - 60);
  hero.invuln = Math.max(0, hero.invuln - dt);
  hero.attackTimer = Math.max(0, hero.attackTimer - dt);
  hero.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
  if (bossBattle.slam && !bossBattle.slam.impacted) {
    const escapeX = bossBattle.slam.dodgeX - hero.x;
    const escapeY = bossBattle.slam.dodgeY - hero.y;
    const length = Math.hypot(escapeX, escapeY) || 1;
    const step = Math.min(length, stats.move * dt);
    hero.x += escapeX / length * step;
    hero.y += escapeY / length * step;
  } else {
    const preferred = state.job === 'warrior' ? 40 : stats.range * 0.8;
    const movement = distance > preferred + 8 ? 1 : state.job !== 'warrior' && distance < preferred - 12 ? -1 : 0;
    if (hero.state !== 'attack' || state.job !== 'warrior') {
      hero.x += dx / centerDistance * stats.move * dt * movement;
      hero.y += dy / centerDistance * stats.move * dt * movement;
    }
  }
  hero.x = Math.max(24, Math.min(bossBattle.width - 24, hero.x));
  hero.y = Math.max(24, Math.min(bossBattle.height - 24, hero.y));
  if (hero.state === 'attack') updateHeroAttack(dt);
  else if (distance <= stats.range && hero.attackTimer <= 0) beginHeroAttack(target);
  updateEnemies(dt);
  if (updateSlam(bossBattle, hero, dt)) {
    takeHeroDamage(Math.ceil(target.damage * SLAM.damageMultiplier));
  }
  updateProjectiles(dt);
  usePotionIfNeeded();
  updateParticles(dt);
  if (!bossBattle) return;
  bossBattle.camera = getFieldCamera({ x: hero.x * 0.65 + target.x * 0.35, y: hero.y * 0.65 + target.y * 0.35 - 90 }, bossBattle.width, bossBattle.height, worldConfig.width, worldConfig.height);
  if (hero.hp <= 0) {
    endBossFight('보스 도전에서 쓰러졌습니다.');
    handleDeath();
  }
}

function updateGame(dt) {
  ensureBossSeason();
  if (state.battle.inBossFight) {
    updateBossFight(dt);
  } else if (state.job && !state.inn.inInn && !state.inn.isResting) {
    const previousThreat = getThreatLevel(state.fieldSeconds);
    state.fieldSeconds += dt;
    if (getThreatLevel(state.fieldSeconds) > previousThreat) logToBox('시간이 흐르며 더 강한 몬스터들이 나타나기 시작합니다.');
    if (mobs.length < 5 && Math.random() < 1.0 * dt) spawnMob();
    updatePlayer(dt);
    Object.assign(hero, constrainToField(hero, field.width, field.height));
    updateEnemies(dt);
    mobs.forEach((mob) => Object.assign(mob, constrainToField(mob, field.width, field.height)));
    updateProjectiles(dt);
    usePotionIfNeeded();
    updateParticles(dt);
    if (hero.hp <= 0) handleDeath();
  } else {
    updateParticles(dt);
  }

  if (state.inn.isResting) {
    const end = state.inn.restEndsAt || Date.now();
    if (Date.now() >= end) {
      completeRest();
    }
    updateInnUi();
  }

  saveAccumulator += dt;
  if (saveAccumulator > 5) {
    saveAccumulator = 0;
    saveState(state);
  }

  updateUi();
}

function updateUi() {
  const stats = getStatSnapshot(state);
  const seconds = Math.floor(state.fieldSeconds);
  ui.huntTimeLabel.textContent = `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, '0')}초`;
  ui.goldLabel.textContent = `${formatNumber(state.gold)} G`;
  ui.shopGoldLabel.textContent = `${state.gold.toLocaleString('ko-KR')} G`;
  ui.threatLabel.textContent = `Lv. ${getThreatLevel(state.fieldSeconds)}`;
  document.getElementById('mapName').textContent = state.battle.inBossFight ? '붉은 화산 · 레드드래곤' : '별빛 숲';
  ui.heroName.textContent = state.nickname || '모험가';
  ui.hpText.textContent = `HP ${Math.max(0, Math.ceil(hero.hp))} / ${stats.maxHp}`;
  ui.hpBar.style.width = `${Math.max(0, (hero.hp / stats.maxHp) * 100)}%`;

  ui.buildInfo.innerHTML = state.job ? `<strong>${JOBS[state.job].name} · 스탯</strong>
    <dl class="character-stats">
      <div><dt>공격력</dt><dd>${stats.attack}</dd></div>
      <div><dt>공격 속도</dt><dd>×${stats.speed.toFixed(2)}</dd></div>
      <div><dt>치명타 확률</dt><dd>${Math.round(stats.critChance * 100)}%</dd></div>
      <div><dt>치명타 피해</dt><dd>${Math.round(stats.critDamage * 100)}%</dd></div>
      <div><dt>회피율</dt><dd>${Math.round(stats.evade * 100)}%</dd></div>
      <div><dt>민첩성 · 이동 속도</dt><dd>${stats.move}</dd></div>
      <div><dt>방어력</dt><dd>${stats.defense}</dd></div>
      <div><dt>최대 체력</dt><dd>${stats.maxHp}</dd></div>
    </dl>` : '직업 미선택';

  ui.atkCost.textContent = getRealCost('attackLevel', state.attackLevel);
  ui.spdCost.textContent = getRealCost('speedLevel', state.speedLevel);

  for (const [id, key] of [['hp', 'hpLevel'], ['defense', 'defenseLevel'], ['critChance', 'critChanceLevel'], ['critDamage', 'critDamageLevel'], ['evasion', 'evasionLevel'], ['agility', 'agilityLevel']]) {
    const cost = getRealCost(key, state[key]);
    document.getElementById(`${id}Cost`).textContent = formatNumber(cost);
    document.getElementById(`${id}Btn`).disabled = !state.job || state.gold < cost || ((key === 'critChanceLevel' && stats.critChance >= 0.75) || (key === 'evasionLevel' && stats.evade >= 0.75));
  }
  ui.atkBtn.disabled = !state.job || state.gold < getRealCost('attackLevel', state.attackLevel);
  ui.spdBtn.disabled = !state.job || state.gold < getRealCost('speedLevel', state.speedLevel);

  ui.innBtn.disabled = !state.job || state.battle.inBossFight;
  ui.bossBtn.disabled = !state.job || state.battle.inBossFight || state.inn.inInn;
  ui.bossChallengeBtn.disabled = !sharedBoss.ready || !state.job || state.inn.inInn || state.inn.isResting || state.worldBoss.currentHp <= 0;

  renderBossInfo();
  updateInnUi();
}

function applyUpgrade(kind) {
  if (kind === 'evasionLevel' && getAttackStats().evade >= 0.75) return;
  if (kind === 'critChanceLevel' && getAttackStats().critChance >= 0.75) return;
  const cost = getRealCost(kind, state[kind]);
  if (!state.job || state.gold < cost) {
    logToBox('골드가 부족합니다.');
    return;
  }
  state.gold -= cost;
  state[kind] += 1;
  if (kind === 'hpLevel' && hero.hp > 0) hero.hp = Math.min(getAttackStats().maxHp, hero.hp + 15);
  saveState(state);
  logToBox('성장 강화가 적용되었습니다.');
  updateUi();
}

ui.atkBtn.addEventListener('click', () => applyUpgrade('attackLevel'));
ui.spdBtn.addEventListener('click', () => applyUpgrade('speedLevel'));
for (const key of ['hp', 'defense', 'critChance', 'critDamage', 'evasion', 'agility']) {
  document.getElementById(`${key}Btn`).addEventListener('click', () => applyUpgrade(`${key}Level`));
}

const settingsScreen = document.getElementById('settingsScreen');
const settingsBtn = document.getElementById('settingsBtn');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
function closeSettings() {
  settingsScreen.classList.add('hidden');
  settingsBtn.focus();
}
settingsBtn.addEventListener('click', () => {
  settingsScreen.classList.remove('hidden');
  settingsCloseBtn.focus();
});
settingsCloseBtn.addEventListener('click', closeSettings);
settingsScreen.addEventListener('click', (event) => {
  if (event.target === settingsScreen) closeSettings();
});
settingsScreen.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSettings();
  if (event.key === 'Tab') {
    const first = settingsCloseBtn;
    const last = ui.resetBtn;
    if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
  }
});

ui.saveBtn.addEventListener('click', () => {
  const ok = saveState(state);
  setSaveStatus(ok ? '저장 완료' : '저장 실패');
  logToBox(ok ? '게임을 저장했습니다.' : '저장에 실패했습니다.');
});

ui.resetBtn.addEventListener('click', () => {
  settingsScreen.classList.add('hidden');
  hideInnScreen();
  hideEquipmentScreen();
  hideShopScreen();
  closeBossScreen();
  bossBattle = null;
  mobs = [];
  projectiles = [];
  particles = [];
  explorationTarget = null;
  document.getElementById('bossLeaveBtn').hidden = true;
  document.getElementById('nicknameError').textContent = '';
  clearTimeout(missionToastTimer);
  document.getElementById('missionToast').classList.remove('is-visible');
  setSaveStatus('자동 저장 준비 중');
  resetSave();
  state = createInitialState();
  hero.hp = 1;
  ui.jobSelection.classList.add('hidden');
  document.getElementById('nicknameInput').value = '';
  selectedJob = null;
  document.querySelectorAll('.job-card').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  ui.jobSelection.classList.remove('hidden');
  startPrologue();
  logToBox('새 게임을 시작합니다. 직업을 선택해 주세요.');
  updateUi();
});

ui.innBtn.addEventListener('click', () => {
  if (!state.job) return;
  if (state.inn.inInn) {
    showInnScreen();
    return;
  }
  state.inn.recoverAtEnd = false;
  state.inn.isResting = true;
  state.inn.inInn = true;
  state.inn.restStartedAt = Date.now();
  state.inn.restEndsAt = Date.now() + worldConfig.restDurationMs;
  showInnScreen();
  logToBox('길드에 도착했습니다. 휴식을 시작합니다.');
});

ui.bossBtn.addEventListener('click', () => showBossScreen());

ui.innRestBtn.addEventListener('click', () => {
  if (!state.job) showCreationStep(false);
  else showMissions();
});
document.getElementById('guildHeroBtn').addEventListener('click', () => showEquipmentScreen('inventory'));
ui.innEquipBtn.addEventListener('click', () => showEquipmentScreen('smith'));
ui.innShopBtn.addEventListener('click', () => showShopScreen());
function returnFromInn() {
  if (!state.job) { showCreationStep(false); return; }
  if (state.inn.recoverAtEnd && state.inn.isResting) {
    if (Date.now() < state.inn.restEndsAt) return;
    completeRest();
  }
  hideInnScreen();
  document.getElementById('missionScreen').classList.add('hidden');
  state.inn.isResting = false;
  state.inn.inInn = false;
  state.inn.recoverAtEnd = false;
  state.inn.restStartedAt = null;
  state.inn.restEndsAt = null;
  saveState(state);
  logToBox('길드를 나와 자동 사냥을 재개합니다.');
}

document.getElementById('innDoorBtn').addEventListener('click', returnFromInn);
for (const id of ['innRestBtn', 'innEquipBtn', 'innShopBtn', 'innDoorBtn', 'guildHeroBtn']) {
  document.getElementById(id).addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
}

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => {
    const close = { equipmentScreen: hideEquipmentScreen, shopScreen: hideShopScreen, bossScreen: closeBossScreen, missionScreen: () => document.getElementById('missionScreen').classList.add('hidden') };
    close[button.dataset.close]();
  });
});

ui.bossChallengeBtn.addEventListener('click', () => setBattleMode('boss'));
ui.bossCloseBtn.addEventListener('click', closeBossScreen);
document.getElementById('bossLeaveBtn').addEventListener('click', () => endBossFight('보스 도전을 종료했습니다.'));

document.getElementById('growthToggle').addEventListener('click', () => {
  const button = document.getElementById('growthToggle');
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  document.getElementById('growthContent').hidden = expanded;
});

let selectedJob = state.job || null;
let storyIndex = 0;
const prologue = [
  { scene: 'accident', title: '멈춰 버린 일상', caption: '어느 늦은 밤, 횡단보도 앞', speaker: '나', text: '횡단보도에 발을 내딛는 순간, 눈앞을 가득 채운 트럭의 전조등. 급한 경적 소리와 함께 세상이 하얗게 물들었다.' },
  { scene: 'arrival', title: '낯선 하늘 아래', caption: '처음 보는 별빛, 낯선 숲길', speaker: '나', text: '…여긴 어디지? 분명 트럭이… 눈을 뜨자 아스팔트 대신 차가운 흙이 손에 잡혔다. 숲 너머로 성문과 불빛이 보였다.' },
  { scene: 'gate', title: '별빛 마을의 문지기', caption: '별빛 마을 입구', speaker: '마을 문지기', text: '거기, 멈추시오! 그 차림새… 또 다른 세계에서 온 사람인가? 놀라지 마시오. 이곳은 별빛 마을이오. 들어오기 전에 몇 가지 물어보겠소.' }
];
function showStoryPage() {
  const page = prologue[storyIndex];
  document.getElementById('creationTitle').textContent = page.title;
  document.getElementById('prologueScene').dataset.scene = page.scene;
  document.getElementById('storySceneCaption').textContent = page.caption;
  document.getElementById('storySpeaker').textContent = page.speaker;
  document.getElementById('storyDialogue').textContent = page.text;
  document.getElementById('storyNextBtn').textContent = storyIndex === prologue.length - 1 ? '문지기의 질문에 답하기' : '다음';
}
function startPrologue() {
  storyIndex = 0;
  ui.jobSelection.classList.remove('hidden');
  document.getElementById('introStep').hidden = false;
  document.getElementById('jobStep').hidden = true;
  document.getElementById('nicknameStep').hidden = true;
  document.getElementById('nicknameInput').disabled = true;
  showStoryPage();
  document.getElementById('storyNextBtn').focus();
}
document.getElementById('storyNextBtn').addEventListener('click', () => {
  if (storyIndex < prologue.length - 1) { storyIndex++; showStoryPage(); }
  else showCreationStep(true);
});
document.getElementById('storySkipBtn').addEventListener('click', () => showCreationStep(true));


function enterGuildRegistration() {
  saveState(state);
  state.inn.inInn = true;
  state.inn.isResting = false;
  state.inn.recoverAtEnd = false;
  state.inn.restStartedAt = null;
  state.inn.restEndsAt = null;
  showInnScreen();
  saveState(state);
  logToBox('문지기의 안내를 따라 길드에 도착했습니다. 접수원을 눌러 직업을 등록하세요.');
}

function showCreationStep(nicknameStep) {
  ui.jobSelection.classList.remove('hidden');
  document.getElementById('introStep').hidden = true;
  document.getElementById('prologueScene').dataset.scene = nicknameStep ? 'gate' : 'guild';
  document.getElementById('storySceneCaption').textContent = nicknameStep ? '별빛 마을 입구' : '모험가 길드 · 접수 창구';
  document.getElementById('storySpeaker').textContent = nicknameStep ? '마을 문지기' : '길드 접수원';
  document.getElementById('storyDialogue').textContent = nicknameStep
    ? '낯선 곳에 오느라 고생했소. 먼저 자네 이름을 알려 주겠소? 마을 명부에 적어 두겠소.'
    : `${state.nickname}님, 모험가 길드에 오신 걸 환영해요. 등록을 도와드릴게요. 전사, 마법사, 궁수 중 어떤 직업으로 활동하시겠어요?`;
  document.getElementById('jobStep').hidden = nicknameStep;
  document.getElementById('nicknameStep').hidden = !nicknameStep;
  document.getElementById('nicknameInput').disabled = !nicknameStep;
  document.getElementById('creationTitle').textContent = nicknameStep ? '문지기에게 이름 알려주기' : '길드에서 직업 등록';
  document.getElementById('nicknameError').textContent = '';
  document.getElementById('selectedJobLabel').textContent = selectedJob ? `선택한 직업: ${JOBS[selectedJob].name}` : '';
  document.getElementById(nicknameStep ? 'nicknameInput' : 'creationTitle').focus();
}
document.getElementById('creationBackBtn').addEventListener('click', startPrologue);

document.getElementById('nicknameForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.getElementById('nicknameInput');
  const nickname = input.value.trim();
  if (nickname.length < 2 || nickname.length > 12) {
    document.getElementById('nicknameError').textContent = '닉네임은 앞뒤 공백을 제외하고 2~12자로 입력해 주세요.';
    input.focus();
    return;
  }
  state.nickname = nickname;
  if (state.job) {
    saveState(state);
    ui.jobSelection.classList.add('hidden');
    updateUi();
  } else enterGuildRegistration();
});

document.querySelectorAll('.job-card').forEach((button) => {
  button.setAttribute('aria-pressed', String(button.dataset.job === selectedJob));
  button.addEventListener('click', () => {
    selectedJob = button.dataset.job;
    document.querySelectorAll('.job-card').forEach((card) => card.setAttribute('aria-pressed', String(card === button)));
    if (!state.nickname) { showCreationStep(true); return; }
    applyJobSelection(selectedJob);
    state.inn.inInn = true;
    state.inn.isResting = false;
    showInnScreen();
    saveState(state);
  });
});

function drawBackground() {
  ctx.fillStyle = '#2b4d44';
  ctx.fillRect(0, 0, worldConfig.width, worldConfig.height);

  for (let x = 0; x < worldConfig.width; x += 32) {
    for (let y = 0; y < worldConfig.height; y += 32) {
      ctx.fillStyle = ((x / 32 + y / 32) % 2 === 0) ? '#335c4f' : '#2d5247';
      ctx.fillRect(x, y, 32, 32);
    }
  }
}

function drawMobs() {
  for (const mob of mobs) {
    ctx.fillStyle = mob.boss ? '#d46d6d' : '#9bd88d';
    ctx.fillRect(mob.x - 16, mob.y - 16, 32, 32);
    ctx.fillStyle = '#2f2b38';
    ctx.fillRect(mob.x - 18, mob.y + 18, 36, 6);
    ctx.fillStyle = '#f56d6d';
    ctx.fillRect(mob.x - 18, mob.y + 18, 36 * (mob.hp / mob.maxHp), 6);
  }
}

function drawHeroSprite() {
  const bodyColor = JOBS[state.job]?.color || '#7fc6ff';
  ctx.fillStyle = '#1d2f35';
  ctx.fillRect(hero.x - 10, hero.y + 12, 20, 6);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(hero.x - 12, hero.y - 14, 24, 24);
  ctx.fillStyle = '#f6f3d1';
  ctx.fillRect(hero.x - 4, hero.y - 8, 8, 8);
}

function drawProjectiles(projected = false) {
  for (const projectile of projectiles) {
    ctx.fillStyle = projectile.color || '#ffe29a';
    const p = projected ? projectGround(projectile.x, projectile.y) : projectile;
    ctx.fillRect(p.x - 3, p.y - (projected ? 24 : 4), projectile.type === 'archer' ? 12 : 7, projectile.type === 'archer' ? 3 : 7);
  }
}

function drawParticles(projected = false) {
  for (const particle of particles) {
    ctx.fillStyle = particle.color || '#fff';
    ctx.font = 'bold 12px sans-serif';
    const p = projected ? projectGround(particle.x, particle.y) : particle;
    ctx.fillText(particle.text, p.x, p.y - (projected ? 22 : 0));
  }
}

function drawBossInfo() {
  if (!state.battle.inBossFight || !state.worldBoss) return;
  ctx.save();
  ctx.translate(0, 48);
  ctx.fillStyle = 'rgba(6,10,15,0.5)';
  ctx.fillRect(18, 18, 280, 52);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`레드드래곤 · 남은 시간 ${Math.max(0, Math.ceil((bossBattle.durationMs - Date.now() + battleStartedAt) / 1000))}초`, 32, 40);
  ctx.fillStyle = '#ffb0b0';
  const boss = state.worldBoss;
  ctx.fillRect(32, 45, 220, 12);
  ctx.fillStyle = '#ff4a4a';
  ctx.fillRect(32, 45, Math.max(0, (boss.currentHp / boss.maxHp) * 220), 12);
  ctx.restore();
}

function render() {
  if (bossBattle && state.battle.inBossFight) {
    drawBossArena(ctx, bossBattle, hero, mobs[0], state.job, JOBS[state.job]?.color, worldConfig.width, worldConfig.height, () => { drawProjectiles(true); drawParticles(true); });
    drawBossInfo();
    return;
  }
  const camera = getFieldCamera(hero, field.width, field.height, worldConfig.width, worldConfig.height);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, field.width, field.height, camera);
  const layers = [
    ...state.lootChests.map((chest) => ({ x: chest.x, y: chest.y, draw: () => {
      const p = projectGround(chest.x, chest.y);
      ctx.fillStyle = '#795130'; ctx.fillRect(p.x - 12, p.y - 18, 24, 18);
      ctx.fillStyle = '#f5cf73'; ctx.fillRect(p.x - 12, p.y - 13, 24, 4); ctx.fillRect(p.x - 2, p.y - 12, 5, 8);
    } })),
    ...scenery.map((object) => ({ x: object.x, y: object.y, draw: () => drawScenery(ctx, object, hero) })),
    ...mobs.map((mob) => ({ x: mob.x, y: mob.y, draw: () => drawActor(ctx, mob) })),
    { x: hero.x, y: hero.y, draw: () => drawActor(ctx, hero, { hero: true, job: state.job, color: JOBS[state.job]?.color || '#7fc6ff' }) }
  ];
  layers.filter((layer) => {
    const p = projectGround(layer.x, layer.y);
    return p.x > camera.x - 80 && p.x < camera.x + camera.width + 80 && p.y > camera.y - 30 && p.y < camera.y + camera.height + 110;
  }).sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach((layer) => layer.draw());
  drawProjectiles(true);
  drawParticles(true);
  ctx.restore();
  ctx.save();
  ctx.translate(worldConfig.width * 0.35, 34);
  ctx.scale(0.65, 0.65);
  const mapX = worldConfig.width - 140;
  ctx.fillStyle = 'rgba(12,22,28,0.85)';
  ctx.fillRect(mapX, 12, 128, 100);
  for (let my = 0; my < 80; my += 2) {
    for (let mx = 0; mx < 116; mx += 2) {
      if (!isInsideField((mx + 1) / 116 * field.width, (my + 1) / 80 * field.height, field.width, field.height)) {
        const seed = (mx * 13 + my * 7) % 11;
        ctx.fillStyle = seed < 4 ? '#294d30' : seed < 8 ? '#1c3c27' : '#122c20';
        ctx.fillRect(mapX + 6 + mx, 18 + my, 2, 2);
        continue;
      }
      ctx.fillStyle = '#45654b';
      ctx.fillRect(mapX + 6 + mx, 18 + my, 2, 2);
    }
  }
  // Tiny tree crowns mirror the dense forest beyond the clearing.
  for (let my = 4; my < 76; my += 7) {
    for (let mx = 4; mx < 112; mx += 7) {
      const offset = (my % 2) * 2;
      const px = mx + offset;
      if (isInsideField(px / 116 * field.width, my / 80 * field.height, field.width, field.height, -65)) continue;
      ctx.fillStyle = '#3a6139';
      ctx.fillRect(mapX + 6 + px, 18 + my - 2, 2, 2);
      ctx.fillStyle = '#2c5031';
      ctx.fillRect(mapX + 5 + px, 18 + my, 4, 2);
    }
  }
  ctx.strokeStyle = '#bfd4b4';
  const corners = [[camera.x, camera.y], [camera.x + camera.width, camera.y], [camera.x + camera.width, camera.y + camera.height], [camera.x, camera.y + camera.height]]
    .map(([x, y]) => unprojectGround(x, y));
  const left = Math.max(0, Math.min(1, Math.min(...corners.map(p => p.x)) / field.width));
  const right = Math.max(0, Math.min(1, Math.max(...corners.map(p => p.x)) / field.width));
  const top = Math.max(0, Math.min(1, Math.min(...corners.map(p => p.y)) / field.height));
  const bottom = Math.max(0, Math.min(1, Math.max(...corners.map(p => p.y)) / field.height));
  ctx.strokeRect(mapX + 6 + left * 116, 18 + top * 80, (right - left) * 116, (bottom - top) * 80);
  ctx.fillStyle = '#ffd67b';
  ctx.fillRect(mapX + 4 + hero.x / field.width * 116, 16 + hero.y / field.height * 80, 4, 4);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ecedd4';
  ctx.restore();
}

function mainLoop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000 || 0.016);
  lastTimestamp = timestamp;
  updateGame(dt);
  render();
  requestAnimationFrame(mainLoop);
}

state.battle.inBossFight = false;

if (state.job) {
  ui.jobSelection.classList.add('hidden');
  hero.hp = getStatSnapshot(state).maxHp;
  updateUi();
} else {
  ui.jobSelection.classList.remove('hidden');
}

if (state.inn.inInn || state.inn.isResting) {
  showInnScreen();
}

if (state.worldBoss) {
  ensureBossSeason();
  renderBossInfo();
}

function resizeGameViewport() {
  const width = Math.max(1, Math.round(window.innerWidth / 2));
  const height = Math.max(1, Math.round(window.innerHeight / 2));
  canvas.width = width;
  canvas.height = height;
  worldConfig.width = width;
  worldConfig.height = height;
  ctx.imageSmoothingEnabled = false;

}
window.addEventListener('resize', resizeGameViewport);
resizeGameViewport();
if (window.innerWidth <= 640 || window.innerHeight <= 600) {
  document.getElementById('growthToggle').setAttribute('aria-expanded', 'false');
  document.getElementById('growthContent').hidden = true;
}
if (!state.nickname || !state.job) {
  ui.jobSelection.classList.remove('hidden');
  document.getElementById('nicknameInput').value = state.nickname || '';
  if (!state.nickname && state.job) showCreationStep(true);
  else if (state.nickname) enterGuildRegistration();
  else startPrologue();
}

requestAnimationFrame(mainLoop);

sharedBoss.start();
