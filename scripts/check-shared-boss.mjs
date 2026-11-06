import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const directory=await mkdtemp(join(tmpdir(),'starlight-http-'));
const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'0',STARLIGHT_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
try {
 const base=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('server startup timeout')),5000);
  child.stdout.on('data',bytes=>{const match=bytes.toString().match(/http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(`http://127.0.0.1:${match[1]}`);}});
  child.on('error',reject);child.on('exit',code=>{if(code)reject(Error(`server exit ${code}`));});
 });
 const a=await fetch(base+'/api/boss'),b=await fetch(base+'/api/boss');
 const cookieA=a.headers.get('set-cookie').split(';')[0],cookieB=b.headers.get('set-cookie').split(';')[0];
 assert.notEqual(cookieA,cookieB);
 const original=(await a.json()).boss;
 const attack=async(cookie,id,damage)=>(await fetch(base+'/api/boss/attack',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({seasonId:original.seasonId,requestId:id,damage})})).json();
 await Promise.all([attack(cookieA,'http-attack-01',30),attack(cookieB,'http-attack-02',40)]);
 const current=(await (await fetch(base+'/api/boss')).json()).boss;
 assert.equal(current.currentHp,original.currentHp-70);
 await attack(cookieA,'http-attack-01',30);
 assert.equal((await (await fetch(base+'/api/boss')).json()).boss.currentHp,current.currentHp);
 assert.equal((await fetch(base+'/.data/boss.sqlite')).status,404);
 assert.equal((await fetch(base+'/server/index.js')).status,404);
 assert.equal((await fetch(base+'/')).status,200);
 console.log('Two independent users share HP; parallel damage, retry deduplication, and private database routes verified.');
} finally {
 const exited=once(child,'exit');child.kill('SIGTERM');await exited;
 await rm(directory,{recursive:true,force:true});
}
