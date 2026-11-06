export const MISSIONS = [
  { id: 'slime-hunt', name: '숲길의 슬라임 토벌', target: 'normal', count: 10, gold: 120, description: '일반 슬라임 10마리를 처치하고 길드에 보고하세요.' },
  { id: 'fast-hunt', name: '날쌘 몬스터 토벌', target: 'fast', count: 5, gold: 180, description: '빠른 몬스터 5마리를 처치하세요. 사냥 1분 이후 등장합니다.' }
];
export function acceptMission(state, id) {
  if (state.mission || !MISSIONS.some(m => m.id === id)) return false;
  state.mission = { id, progress: 0 }; return true;
}
export function progressMission(state, enemy) {
  const definition = MISSIONS.find(m => m.id === state.mission?.id);
  if (!definition || enemy.worldBoss || enemy.type !== definition.target || state.mission.progress >= definition.count) return null;
  state.mission.progress = Math.min(definition.count, state.mission.progress + 1);
  return state.mission.progress === definition.count ? definition : null;
}
export function claimMission(state) {
  const definition = MISSIONS.find(m => m.id === state.mission?.id);
  if (!definition || state.mission.progress < definition.count) return 0;
  state.gold += definition.gold; state.mission = null; return definition.gold;
}
