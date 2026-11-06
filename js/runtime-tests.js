import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function runtime() {
  const source = await readFile(new URL('./main.js', import.meta.url), 'utf8');
  const bindings = {};
  for (const match of source.matchAll(/^import \{([^}]+)\} from '([^']+)';/gm)) {
    Object.assign(bindings, await import(new URL(match[2], import.meta.url)));
  }
  bindings.createSharedBossClient = () => ({ ready: false, start() {}, attack: async () => 0 });
  const elements = new Map();
  const canvasContext = new Proxy({}, { get: () => () => {} });
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set();
    const node = { value: '', textContent: '', innerHTML: '', hidden: false, disabled: false,
      width: 640, height: 384, dataset: {}, style: {}, handlers: {},
      classList: { add: (...values) => values.forEach(v => classes.add(v)), remove: (...values) => values.forEach(v => classes.delete(v)), contains: value => classes.has(value) },
      addEventListener(event, callback) { this.handlers[event] = callback; },
      setAttribute(name, value) { this[name] = value; }, getAttribute(name) { return this[name]; },
      focus() {}, getContext: () => canvasContext, querySelector: () => element(id + '-button'), querySelectorAll: () => [], appendChild() {} };
    elements.set(id, node); return node;
  }
  const cards = ['warrior', 'mage', 'archer'].map(job => { const node = element('job-' + job); node.dataset.job = job; return node; });
  const context = vm.createContext({ ...bindings, assert, console, performance,
    window: { innerWidth: 1280, innerHeight: 768, addEventListener() {} },
    document: { getElementById: element, querySelectorAll: selector => selector === '.job-card' ? cards : [], createElement: () => element('created') },
    requestAnimationFrame() {}, setTimeout() { return 1; }, clearTimeout() {} });
  vm.runInContext(source.replace(/^import .*;$/gm, ''), context);
  return code => vm.runInContext(code, context);
}

test('이름을 입력하면 실제 길드에 들어가고 접수원이 직업을 등록한다', async () => {
  const run = await runtime();
  run(`
    state = createInitialState(); selectedJob = null;
    showCreationStep(true);
    assert.equal(document.getElementById('storySpeaker').textContent, '마을 문지기');
    document.getElementById('nicknameInput').value = '새모험가';
    document.getElementById('nicknameForm').handlers.submit({ preventDefault() {} });
    assert.equal(state.job, null);
    assert.equal(state.inn.inInn, true);
    assert.ok(ui.jobSelection.classList.contains('hidden'));
    assert.ok(!ui.innScreen.classList.contains('hidden'));
    ui.innRestBtn.handlers.click();
    assert.equal(document.getElementById('storySpeaker').textContent, '길드 접수원');
    assert.equal(document.getElementById('prologueScene').dataset.scene, 'guild');
    document.getElementById('job-mage').handlers.click();
    assert.equal(state.job, 'mage');
    assert.equal(state.inn.inInn, true);
    returnFromInn();
    assert.equal(state.inn.inInn, false);
  `);
});

test('근접 공격 경계의 소수점 오차에도 피해가 들어가고 HP 표시가 갱신된다', async () => {
  const run = await runtime();
  run(`
    state = createInitialState(); state.job = 'warrior'; state.nickname = '검증';
    hero.x = 200; hero.y = 200; hero.hp = 150; hero.invuln = 0;
    mobs = [{ x: 232.000000000001, y: 200, range: 20, speed: 128, damage: 8, attackTimer: 0, flash: 0 }];
    updateEnemies(0.05);
    assert.equal(hero.hp, 142);
    updateUi();
    assert.ok(ui.hpText.textContent.includes('142'));
    hero.invuln = 0;
    mobs[0].attackTimer = 0;
    updateEnemies(0.05);
    assert.equal(hero.hp, 134);
  `);
});

test('움직이는 플레이어를 따라 공격 거리에 도착한 프레임에 즉시 공격한다', async () => {
  const run = await runtime();
  run(`
    state = createInitialState(); state.job = 'warrior';
    hero.x = 1000; hero.y = 1000; hero.hp = 150; hero.invuln = 0;
    mobs = [{ x: 1032, y: 1000, range: 20, speed: 128, damage: 8, attackTimer: 0, flash: 0 }];
    for (let i = 0; i < 40; i++) {
      hero.x -= 4;
      hero.invuln = Math.max(0, hero.invuln - 0.05);
      updateEnemies(0.05);
    }
    assert.ok(hero.hp < 142, '추격 중에도 여러 차례 공격해야 합니다.');
    assert.ok(mobs[0].attackAnim >= 0);
  `);
});

test('방어력 강화는 피해를 줄이고 체력 강화는 최대·현재 체력을 늘린다', async () => {
  const run = await runtime();
  run(`
    state = createInitialState(); state.job = 'warrior'; state.gold = 10000;
    hero.hp = 150; hero.invuln = 0; state.defenseLevel = 50;
    takeHeroDamage(30);
    assert.equal(hero.hp, 135);
    const initialMaxHp = getAttackStats().maxHp;
    document.getElementById('hpBtn').handlers.click();
    assert.equal(getAttackStats().maxHp, initialMaxHp + 15);
    assert.equal(hero.hp, 150);
    state.gold = 1e20;
    document.getElementById('defenseBtn').handlers.click();
    assert.equal(getAttackStats().defense, 102);
  `);
});
