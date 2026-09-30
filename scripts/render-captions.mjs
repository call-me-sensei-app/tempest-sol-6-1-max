// Render a code-native SVG text strip; original screenshots are never edited.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
// Optional report tooling dependency. Override with SHARP_PACKAGE_PATH when
// using a bundled runtime; normal installations resolve the "sharp" package.
const require=createRequire(process.env.SHARP_PACKAGE_PATH || import.meta.url);
const sharp=process.env.SHARP_PACKAGE_PATH ? require('./') : require('sharp');
const root=path.resolve(import.meta.dirname,'..');
const frames=JSON.parse(await fs.readFile(path.join(root,'artifacts/screenshot-accounting.json'),'utf8')).filter(f=>f.file.startsWith('progress/'));
const out=path.join(root,'artifacts/timelapse-fragments');await fs.mkdir(out,{recursive:true});
for(let i=0;i<frames.length;i++){
 const f=frames[i],t=Math.floor(f.elapsedSeconds),u=f.tokens??{},pad=n=>String(n).padStart(2,'0');
 const label=`ELAPSED ${pad(Math.floor(t/3600))}h ${pad(Math.floor(t/60)%60)}m ${pad(t%60)}s  |  TOTAL ${(u.total_tokens??0).toLocaleString('en-US')} TOKENS  |  OUTPUT ${(u.output_tokens??0).toLocaleString('en-US')}`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="66"><rect width="1280" height="66" fill="#09161c"/><text x="30" y="40" font-family="Arial, sans-serif" font-size="18" fill="#e9e8df">${label}</text></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(path.join(out,`${String(i).padStart(3,'0')}.png`));
}
console.log(`${frames.length} SVG accounting strips rendered.`);
