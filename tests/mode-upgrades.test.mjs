import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compute,safeCompute} from "../src/calcs.mjs";
const tools=JSON.parse(readFileSync(new URL("../src/tools.json",import.meta.url),"utf8")).tools;
const def=slug=>Object.fromEntries(tools.find(t=>t.slug===slug).inputs.map(f=>[f.key,f.value]));
const metric=(r,label)=>{const x=r.metrics.find(y=>y.label===label);assert.ok(x,"missing "+label);return x.value};
const near=(actual,expected,epsilon=1e-7)=>assert.ok(Math.abs(actual-expected)<=epsilon,actual+" != "+expected);
test("roof pitch source modes agree and default pitch calculation remains unchanged",()=>{
 const d=def("roof-pitch-calculator");
 const base=compute("roof-pitch-calculator",d);
 for(const patch of [
  {roofMode:1,angle:Math.atan(.5)*180/Math.PI},
  {roofMode:2,grade:50},
  {roofMode:3,measuredRise:60}
 ]){
  const r=compute("roof-pitch-calculator",{...d,...patch});
  near(metric(r,"Roof angle"),metric(base,"Roof angle"));
  near(metric(r,"Pitch / 12"),6);
  near(metric(r,"Rise over reference run"),60);
  near(r.roofLine,Math.hypot(120,60));
 }
 for(const bad of [
  {roofMode:1,angle:90},{roofMode:1,angle:-0.1},
  {roofMode:2,grade:-1},{roofMode:3,measuredRise:-1},
  {roofMode:7},{roofMode:0,pitch:-1}
 ])assert.equal(safeCompute("roof-pitch-calculator",{...d,...bad}).ok,false,JSON.stringify(bad));
});
test("equal spacing derives smallest count for face clear-gap limit and nearest target pitch",()=>{
 const mm=n=>n/25.4,base={...def("equal-spacing-calculator"),
  length:mm(1000),left:mm(50),right:mm(50),itemWidth:mm(30)};
 const max=compute("equal-spacing-calculator",{...base,spacingMode:1,maxClearGap:mm(150)});
 assert.equal(max.rows.length,6);
 near(metric(max,"Clear space between faces")*25.4,150,1e-6);
 const reduced=compute("equal-spacing-calculator",{...base,spacingMode:1,maxClearGap:mm(130)});
 assert.equal(reduced.rows.length,7);
 assert.ok(metric(reduced,"Clear space between faces")<mm(130));
 const pitch=compute("equal-spacing-calculator",{...base,spacingMode:2,targetPitch:mm(180)});
 assert.equal(pitch.rows.length,6);
 near(metric(pitch,"Difference from target interval"),0,1e-7);
 for(const bad of [
  {...base,spacingMode:1,itemWidth:0,maxClearGap:4},
  {...base,spacingMode:1,maxClearGap:0},
  {...base,spacingMode:2,targetPitch:0},
  {...base,spacingMode:1,itemWidth:mm(40),maxClearGap:mm(0.01),left:mm(5)}
 ])assert.equal(safeCompute("equal-spacing-calculator",bad).ok,false,JSON.stringify(bad));
});
test("deck stair mode validates board coverage and available horizontal footprint independently",()=>{
 const base=def("stair-calculator");
 const original=compute("stair-calculator",base);
 assert.equal(original.metrics.length,7);
 const deck=compute("stair-calculator",{...base,stairMode:1,availableRun:140});
 assert.equal(deck.rows.length,original.rows.length);
 near(metric(deck,"Horizontal run"),130);
 near(metric(deck,"Deck tread board coverage"),11.125);
 near(metric(deck,"Available horizontal space remaining"),10);
 for(const patch of [
  {availableRun:120},{deckBoardWidth:3},{deckBoardGap:-.1},
  {deckBoardsPerTread:0},{deckBoardThickness:0}
 ])assert.equal(safeCompute("stair-calculator",{...base,stairMode:1,...patch}).ok,false,JSON.stringify(patch));
});