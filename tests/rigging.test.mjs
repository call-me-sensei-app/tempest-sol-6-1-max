import test from 'node:test';
import assert from 'node:assert/strict';
import {MASTS,HELM_CENTER,HELM_CLEAR_RADIUS,standingLines,segmentDistance} from '../src/rigging-layout.js';
import {hullHalfWidth} from '../src/simulation.js';
const lines=standingLines(hullHalfWidth);
test('every standing-rigging segment clears the helm swept volume',()=>{for(const line of lines)assert.ok(segmentDistance(HELM_CENTER,line.a,line.b)>HELM_CLEAR_RADIUS+line.r,`${line.name} mast ${line.mast} intersects the wheel clearance sphere`);});
test('shrouds and climbing ratlines are consistently abaft their mast',()=>{for(const line of lines.filter(l=>l.name==='shroud'||l.name==='ratline'))for(const p of [line.a,line.b])assert.ok(p[0]<=MASTS[line.mast].x-.0449);});
test('backstays end on outboard channels, never at the central wheel',()=>{for(const line of lines.filter(l=>l.name==='backstay'))assert.ok(Math.abs(line.b[2])>.2);});
test('forestays terminate at the next mast foot or bowsprit, not through every forward sail',()=>{const stays=lines.filter(l=>l.name==='forestay');assert.equal(stays.length,3);for(let i=0;i<2;i++){assert.equal(stays[i].b[0],MASTS[i+1].x);assert.ok(stays[i].b[1]<.6);}});
