import {spawn} from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readJson,packageFiles,json} from './release-common.mjs';
import {verifyHttp} from './release-http.mjs';
import {verifyBrowser} from './release-browser.mjs';
const directory=process.argv[2];assert.ok(directory,'Missing evidence directory');
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const log=await fs.open(path.join(directory,'server.log'),'w');
const child=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore',log.fd,log.fd]});
const serverClosed=new Promise(resolve=>child.once('close',resolve));let serverError;
child.once('error',error=>serverError=error);
try{
 let ready=false;const deadline=Date.now()+10000;
 while(Date.now()<deadline){
  if(serverError)throw serverError;if(child.exitCode!==null)throw Error('Local server exited: '+child.exitCode);
  try{const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break;}}
  catch(error){if(!['TypeError','TimeoutError'].includes(error.name))throw error;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(ready,'Local server startup timed out');
 const base=`http://127.0.0.1:${port}`,version=(await readJson('package.json')).version;
 const http=await verifyHttp(base,process.cwd(),await packageFiles(process.cwd()));await json(path.join(directory,'local-http.json'),http);
 const browser=await verifyBrowser(base,version,directory);console.log(JSON.stringify({http,browser}));
}finally{if(child.exitCode===null)child.kill('SIGTERM');await serverClosed;await log.close();}
