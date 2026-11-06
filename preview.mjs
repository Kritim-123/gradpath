import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  let requested;
  try { requested = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname); } catch { res.writeHead(400);res.end();return; }
  const full = path.resolve(root,'.'+requested);
  if(full!==root && !full.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const file = full===root?path.join(root,'index.html'):full;
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});
server.listen(4317,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4317'));
