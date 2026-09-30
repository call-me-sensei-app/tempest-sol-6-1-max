import { defineConfig } from 'vite';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export default defineConfig({plugins:[{name:'local-benchmark-recorder',configureServer(server){server.middlewares.use('/__benchmark',(req,res)=>{if(req.method!=='POST'){res.statusCode=405;res.end();return;}let body='';req.on('data',chunk=>{body+=chunk;if(body.length>200000)req.destroy();});req.on('end',async()=>{try{const record=JSON.parse(body);if(!/^[a-z0-9-]{1,40}$/.test(record.id))throw new Error('invalid id');const dir=resolve('artifacts/benchmarks');await mkdir(dir,{recursive:true});await writeFile(resolve(dir,`${record.id}.json`),JSON.stringify(record,null,2));res.setHeader('Content-Type','application/json');res.end('{"saved":true}');}catch{res.statusCode=400;res.end('{"saved":false}');}});});}}],build:{target:'esnext',chunkSizeWarningLimit:1100}});
