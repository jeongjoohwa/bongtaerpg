import { DatabaseSync } from 'node:sqlite';
import { WORLD_BOSS_DATA } from '../js/data.js';

export function bossSeason(now = Date.now()) {
  const day = new Date(now + 9 * 3600000);
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  const start = day.getTime() - 9 * 3600000;
  return { id: day.toISOString().slice(0, 10), start, end: start + 7 * 86400000 };
}

export function createBossStore(path, { maxHp = WORLD_BOSS_DATA.maxHp, now = Date.now } = {}) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS bosses (season TEXT PRIMARY KEY, hp INTEGER NOT NULL, max_hp INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS participants (season TEXT, player TEXT, damage INTEGER NOT NULL DEFAULT 0, rewarded INTEGER NOT NULL DEFAULT 0, last_hit INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(season,player));
    CREATE TABLE IF NOT EXISTS hits (player TEXT, request TEXT, season TEXT, damage INTEGER, PRIMARY KEY(player,request));`);
  function snapshot() {
    const season = bossSeason(now());
    db.prepare('INSERT OR IGNORE INTO bosses(season,hp,max_hp) VALUES(?,?,?)').run(season.id,maxHp,maxHp);
    const row = db.prepare('SELECT * FROM bosses WHERE season=?').get(season.id);
    return { seasonId:season.id, bossId:WORLD_BOSS_DATA.bossId, bossName:WORLD_BOSS_DATA.name,
      currentHp:row.hp,maxHp:row.max_hp,revision:row.revision,totalDamage:row.max_hp-row.hp,
      defeated:row.hp===0,createdAt:season.start,endsAt:season.end,slot:'shared' };
  }
  return {
    snapshot,
    attack(player, request, seasonId, damage) {
      if (!Number.isSafeInteger(damage) || damage<1 || damage>100000 || typeof request!=='string' || !/^[a-zA-Z0-9-]{8,80}$/.test(request)) throw new Error('invalid_attack');
      const boss=snapshot();
      if(seasonId!==boss.seasonId) return {boss,damage:0};
      db.exec('BEGIN IMMEDIATE');
      try {
        const duplicate=db.prepare('SELECT damage FROM hits WHERE player=? AND request=?').get(player,request);
        if(duplicate) { db.exec('COMMIT'); return {boss:snapshot(),damage:duplicate.damage}; }
        const participant=db.prepare('SELECT last_hit FROM participants WHERE season=? AND player=?').get(seasonId,player);
        if(participant && now()-participant.last_hit<150) {db.exec('COMMIT');return {boss:snapshot(),damage:0};}
        const current=db.prepare('SELECT hp FROM bosses WHERE season=?').get(seasonId).hp;
        const dealt=Math.min(damage,current);
        if(dealt>0) {
          db.prepare('UPDATE bosses SET hp=hp-?,revision=revision+1 WHERE season=?').run(dealt,seasonId);
          db.prepare('INSERT INTO participants(season,player,damage,last_hit) VALUES(?,?,?,?) ON CONFLICT(season,player) DO UPDATE SET damage=damage+excluded.damage,last_hit=excluded.last_hit').run(seasonId,player,dealt,now());
        }
        db.prepare('INSERT INTO hits VALUES(?,?,?,?)').run(player,request,seasonId,dealt);
        db.exec('COMMIT');return {boss:snapshot(),damage:dealt};
      } catch(error) {db.exec('ROLLBACK');throw error;}
    },
    claim(player) {
      const boss=snapshot();
      if(!boss.defeated)return {gold:0};
      const result=db.prepare('UPDATE participants SET rewarded=1 WHERE season=? AND player=? AND damage>0 AND rewarded=0').run(boss.seasonId,player);
      return {gold:result.changes ? WORLD_BOSS_DATA.reward.gold : 0};
    },
    close(){db.close();}
  };
}
