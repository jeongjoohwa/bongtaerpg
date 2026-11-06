export const JOBS = {
  warrior: {
    id: 'warrior',
    name: '전사',
    hp: 150,
    attack: 8,
    speed: 0.85,
    range: 46,
    move: 104,
    color: '#76c6fa',
    weaponTypes: ['sword', 'greatsword'],
    weaponName: '검'
  },
  mage: {
    id: 'mage',
    name: '마법사',
    hp: 85,
    attack: 14,
    speed: 0.65,
    range: 176,
    move: 95,
    color: '#bb94ff',
    weaponTypes: ['staff'],
    weaponName: '지팡이'
  },
  archer: {
    id: 'archer',
    name: '궁수',
    hp: 100,
    attack: 6,
    speed: 1.4,
    range: 207,
    move: 117,
    color: '#f3ce77',
    weaponTypes: ['bow'],
    weaponName: '활'
  }
};

export const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'armor', 'gloves', 'boots'];

export const EQUIPMENT_TYPES = {
  weapon: '무기',
  helmet: '투구',
  armor: '갑옷',
  gloves: '장갑',
  boots: '신발'
};

export const ITEM_TIERS = [
  { id: 'common', name: '일반', color: '#9aa5b1' },
  { id: 'rare', name: '고급', color: '#66d57d' },
  { id: 'epic', name: '희귀', color: '#5aa9ff' },
  { id: 'heroic', name: '영웅', color: '#c27cff' },
  { id: 'legendary', name: '전설', color: '#ffb052' },
  { id: 'mythic', name: '신화', color: '#ff5d5d' }
];

export const ITEM_TIER_VALUES = {
  common: 1,
  rare: 1.24,
  epic: 1.5,
  heroic: 1.9,
  legendary: 2.4,
  mythic: 3.1
};

export const POTION_CONFIG = {
  common: { tier: 'common', name: '일반 포션', amount: 20, price: 10 },
  rare: { tier: 'rare', name: '고급 포션', amount: 50, price: 35 },
  epic: { tier: 'epic', name: '희귀 포션', amount: 120, price: 100 },
  heroic: { tier: 'heroic', name: '영웅 포션', amount: 300, price: 300 },
  legendary: { tier: 'legendary', name: '전설 포션', amountRatio: 0.7, price: 1000 },
  mythic: { tier: 'mythic', name: '신화 포션', amountRatio: 1, price: 3000 }
};

export const DEFAULT_ITEMS = [
  {
    id: 'starter-sword',
    name: '초보용 검',
    type: 'weapon',
    weaponType: 'sword',
    tier: 'common',
    level: 0,
    durability: 100,
    maxDurability: 100,
    stats: { attack: 5 },
    isEquipped: false,
    price: 0
  },
  {
    id: 'basic-helmet',
    name: '기본 투구',
    type: 'helmet',
    tier: 'common',
    level: 0,
    durability: 100,
    maxDurability: 100,
    stats: { maxHp: 12, defense: 2 },
    isEquipped: false,
    price: 0
  },
  {
    id: 'basic-armor',
    name: '기본 갑옷',
    type: 'armor',
    tier: 'common',
    level: 0,
    durability: 100,
    maxDurability: 100,
    stats: { maxHp: 18, defense: 3 },
    isEquipped: false,
    price: 0
  },
  {
    id: 'basic-gloves',
    name: '기본 장갑',
    type: 'gloves',
    tier: 'common',
    level: 0,
    durability: 100,
    maxDurability: 100,
    stats: { attack: 2, attackSpeed: 0.02 },
    isEquipped: false,
    price: 0
  },
  {
    id: 'basic-boots',
    name: '기본 신발',
    type: 'boots',
    tier: 'common',
    level: 0,
    durability: 100,
    maxDurability: 100,
    stats: { moveSpeed: 8, evade: 0.02 },
    isEquipped: false,
    price: 0
  }
];

export const SHOP_ITEMS = [
  { id: 'potion-common', type: 'potion', potion: 'common', name: '일반 포션', price: 10 },
  { id: 'potion-rare', type: 'potion', potion: 'rare', name: '고급 포션', price: 35 },
  { id: 'potion-epic', type: 'potion', potion: 'epic', name: '희귀 포션', price: 100 },
  { id: 'potion-heroic', type: 'potion', potion: 'heroic', name: '영웅 포션', price: 300 },
  { id: 'weapon-sword', type: 'weapon', name: '철검', tier: 'rare', weaponType: 'sword', stats: { attack: 9 }, price: 120 },
  { id: 'weapon-bow', type: 'weapon', name: '숲의 활', tier: 'rare', weaponType: 'bow', stats: { attack: 8 }, price: 120 },
  { id: 'weapon-staff', type: 'weapon', name: '수습 마법봉', tier: 'rare', weaponType: 'staff', stats: { attack: 10 }, price: 120 },
  { id: 'armor-plate', type: 'armor', name: '철제 갑옷', tier: 'rare', stats: { maxHp: 28, defense: 4 }, price: 140 },
  { id: 'helmet-plate', type: 'helmet', name: '철제 투구', tier: 'rare', stats: { maxHp: 16, defense: 3 }, price: 120 },
  { id: 'gloves-plate', type: 'gloves', name: '강철 장갑', tier: 'rare', stats: { attack: 4, attackSpeed: 0.04 }, price: 120 },
  { id: 'boots-plate', type: 'boots', name: '가벼운 신발', tier: 'rare', stats: { moveSpeed: 9, evade: 0.03 }, price: 110 }
];

export const WORLD_BOSS_DATA = {
  bossId: 'red-dragon',
  name: '레드드래곤',
  maxHp: 1000000000,
  damage: 45,
  damagePerStage: 4,
  moveSpeed: 105,
  attackRange: 60,
  attackInterval: 0.8,
  reward: { gold: 250000, xp: 0 },
  durationSeconds: 60
};

export const SAVE_VERSION = 2;
