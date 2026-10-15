import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname),relative=['/formulas','/formulas/','/craft','/craft/','/mastery','/mastery/','/gather','/gather/','/debug','/debug/','/','/combat','/forecast','/combat/','/forecast/','/enhance','/enhance/'].includes(pathname)?'index.html':pathname.slice(1),file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||relative.split(/[\\/]/).some(x=>x.startsWith('.'))||relative.startsWith('node_modules')||!['index.html','DESIGN.md','README.md'].includes(relative)&&!relative.startsWith('src/')&&!relative.startsWith('vendor/')){res.writeHead(403);res.end('Forbidden');return;}
 if(path.extname(file)==='.md'&&!['DESIGN.md','README.md'].includes(relative)&&!/^src\/content\/formulas\/[a-z][a-z.-]*\.md$/.test(relative)){res.writeHead(403);res.end('Forbidden');return;}
 const content=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Deep Vein Idle Lab: http://127.0.0.1:${port}`));
