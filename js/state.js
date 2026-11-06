import { JOBS, DEFAULT_ITEMS, SAVE_VERSION } from './data.js';

const STORAGE_KEY = 'starlight_idle_v04';

function getStorage() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
}

export function createInitialState() {
  return {
    version: SAVE_VERSION,
    job: null,
    nickname: '',
    mission: null,
    gold: 0,
    fieldSeconds: 0,
    lootChests: [],
    stage: 1,
    kills: 0,
    attackLevel: 0,
    speedLevel: 0,
    critChanceLevel: 0,
    critDamageLevel: 0,
    agilityLevel: 0,
    coinLevel: 0,
    hpLevel: 0,
    tempGoldBonus: 0,
    updatedAt: Date.now(),
    inventory: DEFAULT_ITEMS.map(item => ({ ...item, id: `${item.id}-${Math.random().toString(16).slice(2, 8)}` })),
    equipment: {
      weapon: null,
      helmet: null,
      armor: null,
      gloves: null,
      boots: null
    },
    potionInventory: {
      common: 0,
      rare: 0,
      epic: 0,
      heroic: 0,
      legendary: 0,
      mythic: 0
    },
    autoPotion: true,
    autoPotionTier: 'rare',
    saveTimestamp: Date.now(),
    inn: {
      inInn: false,
      restStartedAt: null,
      restEndsAt: null,
      woundedAt: null,
      isResting: false,
      recoverAtEnd: false
    },
    worldBoss: {
      seasonId: null,
      bossId: null,
      bossName: null,
      maxHp: 1000000000,
      currentHp: 1000000000,
      totalDamage: 0,
      defeated: false,
      createdAt: null,
      endsAt: null,
      slot: 'local'
    },
    battle: {
      inBossFight: false,
      bossBattleRemaining: 0,
      bossDamage: 0
    },
    lastKnownHp: 100
  };
}

export function calcCost(levelKey) {
  const table = { attackLevel: 15, speedLevel: 35, coinLevel: 50, hpLevel: 25, critChanceLevel: 50, critDamageLevel: 50, agilityLevel: 30 };
  return Math.floor(table[levelKey] * Math.pow(1.42, levelKey === 'attackLevel' ? 0 : 0));
}

export function getRealCost(levelKey, currentValue) {
  const table = { attackLevel: 15, speedLevel: 35, coinLevel: 50, hpLevel: 25, critChanceLevel: 50, critDamageLevel: 50, agilityLevel: 30 };
  const level = Number(currentValue || 0);
  return Math.floor(table[levelKey] * Math.pow(1.42, level));
}

export function getStatSnapshot(state) {
  const job = JOBS[state.job] || JOBS.warrior;
  const base = { maxHp: job.hp, attack: job.attack, speed: job.speed, range: job.range, move: job.move };
  const equipment = Object.values(state.equipment || {}).filter(Boolean);

  let maxHp = base.maxHp;
  let attack = base.attack;
  let speed = base.speed;
  let move = base.move;
  let defense = 0;
  let evade = 0;

  for (const item of equipment) {
    if (!item || !item.stats) continue;
    maxHp += item.stats.maxHp || 0;
    attack += (item.stats.attack || 0) + (item.type === 'weapon' ? (item.level || 0) * 2 : 0);
    speed += item.stats.attackSpeed || 0;
    move += item.stats.moveSpeed || 0;
    defense += item.stats.defense || 0;
    evade += item.stats.evade || 0;
  }

  maxHp += state.hpLevel * 15;
  attack += state.attackLevel * 3;
  speed = speed * Math.pow(1.08, state.speedLevel);
  evade = Math.min(0.75, evade + (state.agilityLevel || 0) * 0.01);
  const critChance = Math.min(0.75, 0.05 + (state.critChanceLevel || 0) * 0.01);
  const critDamage = 1.5 + (state.critDamageLevel || 0) * 0.1;
  const goldBonus = 1 + state.coinLevel * 0.2;

  return {
    job,
    maxHp,
    attack,
    speed,
    range: base.range,
    move,
    defense,
    evade,
    goldBonus,
    critChance,
    critDamage,
    agility: state.agilityLevel || 0
  };
}

export function loadState() {
  try {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    const state = { ...createInitialState(), ...parsed };

    if (!Number.isFinite(state.fieldSeconds) || state.fieldSeconds < 0) state.fieldSeconds = 0;
    if (!Array.isArray(state.lootChests)) state.lootChests = [];
    if (!state.inventory) state.inventory = DEFAULT_ITEMS.map(item => ({ ...item, id: `${item.id}-${Math.random().toString(16).slice(2, 8)}` }));
    if (!state.equipment) state.equipment = createInitialState().equipment;
    if (!state.potionInventory) state.potionInventory = createInitialState().potionInventory;
    if (!state.inn) state.inn = createInitialState().inn;
    if (!state.worldBoss) state.worldBoss = createInitialState().worldBoss;
    if (!state.battle) state.battle = createInitialState().battle;

    return state;
  } catch (error) {
    console.warn('저장된 게임 데이터를 불러오지 못해 새 상태를 생성합니다.', error);
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    state.updatedAt = Date.now();
    getStorage().setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('저장 실패:', error);
    return false;
  }
}

export function resetSave() {
  getStorage().removeItem(STORAGE_KEY);
}

export function getStorageKey() {
  return STORAGE_KEY;
}
