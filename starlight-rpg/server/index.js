import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBossStore } from './boss-store.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const dataDirectory=resolve(process.env.STARLIGHT_DATA_DIR || resolve(root,'.data'));
await mkdir(dataDirectory,{recursive:true});
const store=createBossStore(resolve(dataDirectory,'boss.sqlite'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')) {
      if(req.method==='POST' && req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'origin_rejected'});
      let player=(req.headers.cookie || '').match(/(?:^|;\s*)starlight_player=([a-f0-9-]{36})(?:;|$)/)?.[1];
      if(!player){player=randomUUID();res.setHeader('Set-Cookie',`starlight_player=${player}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);}
      if(req.method==='GET' && url.pathname==='/api/boss')return json(200,{boss:store.snapshot()});
      if(req.method!=='POST')return json(405,{error:'method_not_allowed'});
      if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'json_required'});
      let body='';
      for await(const chunk of req){body+=chunk;if(body.length>4096)return json(413,{error:'body_too_large'});}
      let data;try{data=JSON.parse(body || '{}');}catch{return json(400,{error:'invalid_json'});}
      if(url.pathname==='/api/boss/attack') {
        try{return json(200,store.attack(player,data.requestId,data.seasonId,data.damage));}catch(error){if(error.message==='invalid_attack')return json(400,{error:error.message});throw error;}
      }
      if(url.pathname==='/api/boss/reward')return json(200,store.claim(player));
      return json(404,{error:'not_found'});
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    const path=decodeURIComponent(url.pathname==='/' ? '/index.html' : url.pathname);
    // Only public game assets are served; database and backend stay private.
    if(!(path==='/index.html' || /^\/(js|css|assets)\//.test(path))) {res.writeHead(404);return res.end();}
    const file=resolve(root,'.'+path);
    if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);return res.end();}
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end();}else{console.error(error);if(!res.headersSent)json(500,{error:'server_error'});}}
});
server.listen(Number(process.env.PORT || 8000),'0.0.0.0',()=>console.log(`Starlight server: http://localhost:${server.address().port}`));
function shutdown(){server.close(()=>{store.close();process.exit(0);});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
