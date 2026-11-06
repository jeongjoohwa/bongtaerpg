export function createSharedBossClient({ onBoss, onStatus, onReward }) {
  let ready=false,stopped=false,busy=false,seasonId=null,lastBoss=null;
  async function request(path,body) {
    const response=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('boss_server_unavailable');
    return response.json();
  }
  async function accept(boss) {
    if(lastBoss && (boss.createdAt<lastBoss.createdAt || (boss.seasonId===lastBoss.seasonId && boss.revision<lastBoss.revision)))return;
    lastBoss=boss;
    seasonId=boss.seasonId;ready=true;onStatus(true);onBoss(boss);
    if(boss.defeated){const reward=await request('/api/boss/reward',{});if(reward.gold)onReward(reward.gold);}
  }
  async function sync() {
    if(busy||stopped)return;
    busy=true;
    try{await accept((await request('/api/boss')).boss);}catch{ready=false;onStatus(false);}finally{busy=false;}
  }
  async function attack(damage) {
    if(!ready)return;
    const body={damage:Math.min(100000,Math.max(1,Math.round(damage))),seasonId,requestId:crypto.randomUUID()};
    for(let attempt=0;attempt<3;attempt++) {
      try{const result=await request('/api/boss/attack',body);await accept(result.boss);return result.damage;}
      catch{if(attempt===2){ready=false;onStatus(false);}}
    }
    return 0;
  }
  return {start(){sync();this.timer=setInterval(sync,1000);},sync,attack,get ready(){return ready;},stop(){stopped=true;clearInterval(this.timer);}};
}
