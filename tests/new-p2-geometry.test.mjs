import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv} from "../src/cut-list.mjs";
const tools=JSON.parse(readFileSync(new URL("../src/tools.json",import.meta.url),"utf8")).tools;
const defaults=slug=>Object.fromEntries(tools.find(t=>t.slug===slug).inputs.map(f=>[f.key,f.value]));
const value=(r,label)=>{const m=r.metrics.find(x=>x.label===label);assert.ok(m,label);return m.value};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,a+" != "+b);

test("picket integer solver independently closes 96in opening with 13 pickets and 14 gaps",()=>{
  const a=defaults("fence-picket-calculator"),r=compute("fence-picket-calculator",a);
  const g=(96-13*3.5)/14;
  assert.equal(r.shape,"picket-faces");
  assert.equal(value(r,"Pickets"),13);
  assert.equal(r.rows.length,13);
  near(value(r,"Equal clear gap including both ends"),g,1e-8);
  near(r.rows[0].faceLeft,g,1e-8);
  near(r.rows.at(-1).faceRight,96-g,1e-8);
  near(13*3.5+14*g,96);
  const fixed=compute("fence-picket-calculator",{...a,mode:1,count:12});
  near(value(fixed,"Equal clear gap including both ends"),(96-12*3.5)/13,1e-8);
  assert.match(buildScheduleCsv(r.rows,"mm"),/Face Left \(mm\)/);
  assert.match(buildScheduleCsv(r.rows,"mm"),/Face Right \(mm\)/);
  for(const bad of [
    {opening:0},{width:0},{width:97},{mode:9},
    {mode:1,count:0},{mode:1,count:28},{mode:1,count:1000},
    {maxGap:-1},{opening:1,width:.3,maxGap:.00001}
  ])assert.equal(safeCompute("fence-picket-calculator",{...a,...bad}).ok,false,
    JSON.stringify(bad));
});

test("gambrel roof true two-slope lines and mirrored face area are independently reproducible",()=>{
  const a=defaults("gambrel-roof-calculator"),
    r=compute("gambrel-roof-calculator",a);
  assert.equal(r.shape,"gambrel-profile");
  assert.equal(r.rows.length,4);
  const half=240/2+12,upper=half-60;
  const lowerLine=Math.hypot(60,60),upperLine=Math.hypot(upper,upper*4/12);
  const expectedArea=2*(lowerLine+upperLine)*(360+2*12)/144;
  near(value(r,"Total plan roof width including eaves"),2*half);
  near(value(r,"Lower break elevation"),60);
  near(value(r,"Ridge elevation above eave datum"),84);
  near(value(r,"One lower slope line"),lowerLine);
  near(value(r,"One upper slope line"),upperLine);
  near(value(r,"Sloped roof surface"),expectedArea,1e-6);
  near(value(r,"Area with entered allowance"),expectedArea*1.1,1e-6);
  near(r.profilePoints[2].x,half);near(r.profilePoints[2].y,84);
  near(r.rows[0].endX,r.rows[1].startX);
  near(r.rows[1].endX,r.rows[2].startX);
  near(r.rows[2].endX,r.rows[3].startX);
  assert.deepEqual(r.rows.map(x=>x.item),[
    "Left lower slope","Left upper slope","Right upper slope","Right lower slope"
  ]);
  const csv=buildScheduleCsv(r.rows,"mm");
  assert.match(csv,/Start X \(mm\)/);
  assert.match(csv,/Slope Line \(mm\)/);
  assert.match(csv,/Slope Angle Deg \(°\)/);
  for(const bad of [
    {width:0},{length:0},{eaveOverhang:-1},{lowerRun:0},
    {lowerRun:132},{lowerPitch:4,upperPitch:4},
    {lowerPitch:3,upperPitch:4},{upperPitch:-1},{waste:201}
  ])assert.equal(safeCompute("gambrel-roof-calculator",{...a,...bad}).ok,false,
    JSON.stringify(bad));
});
