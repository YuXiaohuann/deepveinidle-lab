// Manual Chrome integration check with direct capture and synthetic inputs.
import http from 'node:http';
import fs from 'node:fs';
const files=new Map([
 ['/',[new URL('../tests/fixtures/character-capture.html',import.meta.url),'text/html; charset=utf-8']],
 ['/candidate.js',[new URL('../src/character-import.user.js',import.meta.url),'text/javascript; charset=utf-8']],
]);
const port=Number(process.env.PORT||4186);
http.createServer((req,res)=>{
 const file=files.get(req.url);
 if(!file){res.writeHead(404);res.end();return;}
 try{res.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-store'});res.end(fs.readFileSync(file[0]));}
 catch(error){console.error(error);res.destroy(error);}
}).listen(port,'127.0.0.1',()=>console.log(`Character capture check: http://127.0.0.1:${port}/`));
