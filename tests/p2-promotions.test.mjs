import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv} from "../src/cut-list.mjs";
const ts=JSON.parse(readFileSync(new URL("../src/tools.json",import.meta.url),"utf8")).tools;
const defaults=slug=>Object.fromEntries(ts.find(t=>t.slug===slug).inputs.map(f=>[f.key,f.value]));
const metric=(r,label)=>{const m=r.metrics.find(x=>x.label===label);assert.ok(m,label);return m.value};
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,String(a)+" differs from "+b);

test("picket faces and n+1 equal gaps close to 120in clear post-face opening",()=>{
 const a=defaults("fence-picket-calculator"),r=compute("fence-picket-calculator",a);
 assert.equal(r.shape,"picket-layout");assert.equal(r.rows.length,16);
 near(metric(r,"Equal clear gap"),64/17);
 near(r.rows[0].faceLeft,64/17,1e-8);
 near(r.rows.at(-1).faceRight,120-64/17,1e-8);
 for(const [i,x] of r.rows.entries()){
   near(x.faceRight-x.faceLeft,3.5,2e-8);
   near(x.position,(x.faceLeft+x.faceRight)/2,2e-8);
   if(i)near(x.faceLeft-r.rows[i-1].faceRight,64/17,2e-8);
 }
 near(r.rows.reduce((s,x)=>s+x.faceRight-x.faceLeft,0)+17*64/17,120);
 const csv=buildScheduleCsv(r.rows,"mm");
 assert.match(csv,/"Face Left \(mm\)"/);assert.match(csv,/"Cut Height \(mm\)"/);
});

test("picket flush-end, fixed count and stepped top preserve distinct physical layouts",()=>{
 const a=defaults("fence-picket-calculator"),flush=compute("fence-picket-calculator",{...a,edgeMode:1});
 assert.equal(flush.rows.length,17);
 near(flush.rows[0].faceLeft,0);near(flush.rows.at(-1).faceRight,120);
 near(metric(flush,"Equal clear gap"),(120-17*3.5)/16);
 for(const edgeMode of [0,1]){
  const r=compute("fence-picket-calculator",{...a,length:96,layoutMode:1,count:20,edgeMode});
  near(metric(r,"Equal clear gap"),26/(edgeMode===0?21:19));
 }
 const arch=compute("fence-picket-calculator",{...a,archMode:1});
 for(const [i,x] of arch.rows.entries()){
  const u=2*x.position/120-1;
  near(x.cutHeight,48+6*(1-u*u),2e-8);
  near(x.cutHeight,arch.rows.at(-1-i).cutHeight,2e-8);
 }
});

test("picket rejects impossible stock, bad counts, lost clearance and unsupported modes",()=>{
 const a=defaults("fence-picket-calculator");
 for(const patch of [
  {width:150},{length:0},{maxGap:-1},{edgeMode:2},{archMode:2},
  {archMode:1,archRise:0},{layoutMode:1,count:0},{layoutMode:1,count:900},
  {layoutMode:1,count:2,width:80},{length:2000,maxGap:0.1,width:1},
  {length:96,width:3.5,maxGap:0}
 ])assert.equal(safeCompute("fence-picket-calculator",{...a,...patch}).ok,false,JSON.stringify(patch));
});

test("gambrel roof four physical slope sections, vertex stations and area conserve",()=>{
 const a=defaults("gambrel-roof-calculator"),r=compute("gambrel-roof-calculator",a);
 assert.equal(r.shape,"gambrel-profile");assert.equal(r.rows.length,4);
 near(metric(r,"Overall roof span including eaves"),264);
 near(metric(r,"Roof length including end overhangs"),384);
 near(metric(r,"One-side upper horizontal run"),72);
 near(metric(r,"Ridge elevation above eave datum"),84);
 const lower=Math.hypot(60,60),upper=Math.hypot(72,24),area=2*(lower+upper)*384/144;
 near(metric(r,"Total sloped roof surface"),area);
 near(metric(r,"Area with entered waste allowance"),area*1.1);
 assert.deepEqual(r.gambrelVertices,[{x:0,y:0},{x:60,y:60},{x:132,y:84},{x:204,y:60},{x:264,y:0}]);
 near(r.rows.reduce((s,x)=>s+x.roofFaceAreaFt2,0),area);
 const csv=buildScheduleCsv(r.rows,"mm");
 assert.match(csv,/"Roof Face Area \(m²\)"/);assert.match(csv,/"Start X \(mm\)"/);
});

test("gambrel independent sweep over slope pitches and overhangs stays symmetric",()=>{
 const d=defaults("gambrel-roof-calculator");
 for(const lowerRun of [12,36,60,105])for(const pitch of [[12,4],[18,6],[24,2]])
 for(const eave of [0,12,24]){
  const a={...d,lowerRun,eaveOverhang:eave,lowerPitch:pitch[0],upperPitch:pitch[1]};
  const r=compute("gambrel-roof-calculator",a);
  const half=(a.width+2*eave)/2,upperRun=half-lowerRun;
  near(r.gambrelVertices[2].x,half);
  near(r.gambrelVertices[3].x,2*half-lowerRun);
  near(r.gambrelVertices[2].y,lowerRun*a.lowerPitch/12+upperRun*a.upperPitch/12);
  near(metric(r,"Total sloped roof surface"),
   2*(Math.hypot(lowerRun,lowerRun*a.lowerPitch/12)+
   Math.hypot(upperRun,upperRun*a.upperPitch/12))*(a.length+2*a.endOverhang)/144,1e-6);
 }
});

test("gambrel rejects inverted pitches, collapse and negative input",()=>{
 const a=defaults("gambrel-roof-calculator");
 for(const patch of [
  {width:0},{length:0},{lowerRun:0},{lowerRun:132},{lowerRun:140},
  {lowerPitch:4},{upperPitch:12},{upperPitch:0},{lowerPitch:121},
  {eaveOverhang:-1},{endOverhang:-1},{waste:-1},{waste:101}
 ])assert.equal(safeCompute("gambrel-roof-calculator",{...a,...patch}).ok,false,JSON.stringify(patch));
});
