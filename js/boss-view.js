import { projectGround, unprojectGround, drawActor } from './world-view.js';
import { SLAM } from './boss-attacks.js';

function polygon(ctx, color, points) {
  ctx.fillStyle = color; ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath(); ctx.fill();
}
export function createVolcanoScenery(width, height) {
  const objects = [];
  for (let row = 0; row < height / 160; row++) {
    for (let col = 0; col < width / 180; col++) {
      const seed = (row * 137 + col * 71 + row * col * 31) % 997;
      const x = 70 + col * 180 + seed % 65;
      const y = 60 + row * 160 + seed % 57;
      if (x >= width - 60 || y >= height - 60 || Math.hypot(x - 1200, y - 1050) < 220) continue;
      objects.push({ x, y, type: seed % 5 === 0 ? 'vent' : seed % 3 === 0 ? 'crater' : 'basalt', size: 18 + seed % 22 });
    }
  }
  return objects;
}

function drawVolcanoObject(ctx, object, time) {
  const p = projectGround(object.x, object.y);
  const size = object.size;
  ctx.fillStyle = '#19171c'; ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 3, size * 1.4, size * .45, 0, 0, Math.PI * 2); ctx.fill();
  if (object.type === 'basalt') {
    polygon(ctx, '#50454b', [{x:p.x-size,y:p.y-10},{x:p.x-8,y:p.y-size*2},{x:p.x+size*.7,y:p.y-size*2-8},{x:p.x+size,y:p.y-8}]);
    polygon(ctx, '#322d36', [{x:p.x,y:p.y-size*2},{x:p.x+size*.7,y:p.y-size*2-8},{x:p.x+size,y:p.y-8},{x:p.x+4,y:p.y+3}]);
    polygon(ctx, '#6b5754', [{x:p.x-size,y:p.y-10},{x:p.x-8,y:p.y-size*2},{x:p.x,y:p.y-size*2},{x:p.x+4,y:p.y+3}]);
  } else {
    ctx.fillStyle = '#64372f'; ctx.beginPath(); ctx.ellipse(p.x,p.y,size,size*.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ed7136'; ctx.beginPath(); ctx.ellipse(p.x,p.y-2,size*.7,size*.3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffbd62'; ctx.fillRect(p.x-6,p.y-4,12,3);
    if (object.type === 'vent') {
      for(let i=0;i<3;i++) {
        const rise = (time*14+i*19)%65;
        ctx.fillStyle = `rgba(139,118,116,${.25*(1-rise/65)})`;
        ctx.fillRect(p.x-7+Math.sin(rise*.1)*8,p.y-8-rise,14+rise*.25,10+rise*.15);
      }
    }
  }
}

function drawRedDragon(ctx, boss, time) {
  const p = projectGround(boss.x,boss.y);
  const wing = Math.sin(time*2.2)*5;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(p.x+10,p.y+5,100,28,0,0,Math.PI*2); ctx.fill();
  // Tail and raised wings share the body's foot position.
  polygon(ctx, '#853c3a', [{x:p.x+26,y:p.y-12},{x:p.x+115,y:p.y+7},{x:p.x+150,y:p.y-24},{x:p.x+104,y:p.y-4},{x:p.x+48,y:p.y-49}]);
  for(const side of [-1,1]) {
    polygon(ctx,'#672e39',[{x:p.x+side*30,y:p.y-105},{x:p.x+side*156,y:p.y-190-wing},{x:p.x+side*128,y:p.y-83},{x:p.x+side*88,y:p.y-105},{x:p.x+side*63,y:p.y-52}]);
    polygon(ctx,'#bd4d43',[{x:p.x+side*31,y:p.y-110},{x:p.x+side*150,y:p.y-183-wing},{x:p.x+side*87,y:p.y-112},{x:p.x+side*64,y:p.y-64}]);
  }
  ctx.fillStyle = boss.flash > 0 ? '#fff0ca' : '#b6463e'; ctx.fillRect(p.x-44,p.y-115,88,100);
  ctx.fillStyle = '#df9b62'; ctx.fillRect(p.x-22,p.y-84,40,62);
  ctx.fillStyle = '#7f3335'; ctx.fillRect(p.x+25,p.y-110,19,90);
  ctx.fillRect(p.x-63,p.y-40,35,42); ctx.fillRect(p.x+28,p.y-40,35,42);
  ctx.fillStyle = '#e6c493'; for(const side of [-1,1])for(let i=0;i<3;i++)ctx.fillRect(p.x+side*40-10+i*8,p.y-2,5,8);
  ctx.fillStyle = boss.flash > 0 ? '#fff0ca' : '#c95542'; ctx.fillRect(p.x-37,p.y-162,74,59); ctx.fillRect(p.x-28,p.y-124,56,27);
  polygon(ctx,'#e5c28c',[{x:p.x-33,y:p.y-151},{x:p.x-54,y:p.y-192},{x:p.x-12,y:p.y-158}]);
  polygon(ctx,'#e5c28c',[{x:p.x+33,y:p.y-151},{x:p.x+54,y:p.y-192},{x:p.x+12,y:p.y-158}]);
  ctx.fillStyle = '#ffdc65'; ctx.fillRect(p.x-26,p.y-141,15,7); ctx.fillRect(p.x+11,p.y-141,15,7);
  ctx.fillStyle = '#311c25'; ctx.fillRect(p.x-19,p.y-113,38,6);
}

export function drawBossArena(ctx, battle, hero, boss, job, color, width, height, drawEffects) {
  const time = performance.now()/1000;
  ctx.fillStyle = '#231a22'; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(-battle.camera.x, -battle.camera.y);
  const corners = [[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>unprojectGround(x+battle.camera.x,y+battle.camera.y));
  const minX = Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x))/48)*48-48);
  const minY = Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y))/48)*48-48);
  const maxX = Math.min(battle.width,Math.max(...corners.map(p=>p.x))+96);
  const maxY = Math.min(battle.height,Math.max(...corners.map(p=>p.y))+96);
  for (let y = minY; y < maxY; y += 48) {
    for (let x = minX; x < maxX; x += 48) {
      const points = [[x,y],[x+49,y],[x+49,y+49],[x,y+49]].map(([px,py])=>projectGround(px,py));
      const seed = ((x/48)*37+(y/48)*71)%13;
      polygon(ctx,['#3e333b','#483a40','#3a323b'][seed%3],points);
      const lava = Math.abs(x-battle.width*.28-Math.sin(y/180)*95)<42 || Math.abs(y-battle.height*.74-Math.sin(x/155)*80)<35;
      if(lava) {
        polygon(ctx,'#963b30',points);
        polygon(ctx,'#ec6d31',[[x+4,y+10],[x+45,y+16],[x+39,y+34],[x+9,y+29]].map(([a,b])=>projectGround(a,b)));
        const p=projectGround(x+20,y+22);ctx.fillStyle='#ffd17c';ctx.fillRect(p.x,p.y,8,3);
      } else if(seed<3) {
        const a=projectGround(x+4,y+3),b=projectGround(x+30,y+21),c=projectGround(x+25,y+37);
        ctx.strokeStyle='#915346';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.stroke();
      }
    }
  }
  const drawBoss = () => drawRedDragon(ctx,boss,time);
  const slam = battle.slam;
  const drawSlam = () => {
    if (!slam) return;
    const p = projectGround(slam.x,slam.y);
    const points = Array.from({length:32},(_,i)=>projectGround(slam.x+Math.cos(i*Math.PI/16)*SLAM.radius,slam.y+Math.sin(i*Math.PI/16)*SLAM.radius));
    polygon(ctx, slam.impacted ? '#ffe1a0' : 'rgba(245,85,75,.55)',points);
    const rise = slam.impacted ? 0 : 120 - Math.min(1,slam.age/SLAM.windup)*70;
    ctx.fillStyle = '#8e3833'; ctx.fillRect(p.x-23,p.y-90-rise,46,50);
    ctx.fillStyle = '#c95b43'; ctx.fillRect(p.x-32,p.y-48-rise,64,48);
    ctx.fillStyle = '#f3c09f'; for(let i=0;i<4;i++)ctx.fillRect(p.x-27+i*14,p.y-43-rise,10,16);
  };
  [...(battle.scenery || []).filter(object=>{const p=projectGround(object.x,object.y);return p.x>battle.camera.x-100 && p.x<battle.camera.x+width+100 && p.y>battle.camera.y-20 && p.y<battle.camera.y+height+120;}).map(object=>({depth:object.x+object.y,draw:()=>drawVolcanoObject(ctx,object,time)})),
    {depth:hero.x+hero.y,draw:()=>drawActor(ctx,hero,{hero:true,job,color})},
    {depth:boss.x+boss.y,draw:drawBoss},
    {depth:slam ? slam.x+slam.y : 0,draw:drawSlam}].sort((a,b)=>a.depth-b.depth).forEach(item=>item.draw());
  drawEffects(); ctx.restore();
  // Sparse embers above the field, kept behind the HTML controls.
  ctx.fillStyle = 'rgba(255,162,78,.55)';
  for(let i=0;i<18;i++) {
    const x=(i*137+Math.sin(time*.5+i)*18)%width;
    const y=height-((time*(9+i%5)+i*83)%height);
    ctx.fillRect(x,y,2,2);
  }
}
