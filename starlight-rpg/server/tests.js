import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBossStore, bossSeason } from './boss-store.js';

test('유저 간 HP 합산, 중복 공격 방지, 참여 보상 1회 지급',()=>{
 let time=Date.UTC(2026,10,5);const store=createBossStore(':memory:',{maxHp:100,now:()=>time});
 try{
 const season=store.snapshot().seasonId;
 assert.equal(store.attack('a','attack-0001',season,30).boss.currentHp,70);
 assert.equal(store.attack('b','attack-0002',season,40).boss.currentHp,30);
 time+=200;
 assert.equal(store.attack('a','attack-0001',season,30).boss.currentHp,30);
 assert.equal(store.claim('a').gold,0);
 assert.equal(store.attack('b','attack-0003',season,50).damage,30);
 assert.equal(store.snapshot().currentHp,0);
 assert.equal(store.claim('a').gold,250000);
 assert.equal(store.claim('a').gold,0);
 assert.equal(store.claim('b').gold,250000);
 assert.equal(store.claim('spectator').gold,0);
 }finally{store.close();}
});

test('서버 재시작 후 HP 유지 및 한국 시간 월요일 새 시즌',()=>{
 const directory=mkdtempSync(join(tmpdir(),'starlight-boss-'));let time=Date.UTC(2026,10,8,14,59,59);
 const path=join(directory,'boss.sqlite');let store=createBossStore(path,{maxHp:100,now:()=>time});
 try{
 const season=store.snapshot().seasonId;store.attack('a','attack-0004',season,25);store.close();
 store=createBossStore(path,{maxHp:100,now:()=>time});assert.equal(store.snapshot().currentHp,75);
 time+=1000;assert.notEqual(store.snapshot().seasonId,season);assert.equal(store.snapshot().currentHp,100);
 assert.equal(store.attack('a','attack-0005',season,100).damage,0);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
 assert.equal(bossSeason(Date.UTC(2026,10,8,15)).id,'2026-11-09');
});

test('잘못된 피해량과 공격 빈도 제한',()=>{
 let time=Date.now();const store=createBossStore(':memory:',{maxHp:100,now:()=>time});
 try{
 const season=store.snapshot().seasonId;
 for(const damage of [-1,0,1.5,Infinity,100001])assert.throws(()=>store.attack('a','attack-0006',season,damage));
 store.attack('a','attack-0007',season,10);
 assert.equal(store.attack('a','attack-0008',season,10).damage,0);
 assert.equal(store.snapshot().currentHp,90);
 }finally{store.close();}
});
