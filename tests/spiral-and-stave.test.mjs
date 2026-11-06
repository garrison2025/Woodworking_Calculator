import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compute,safeCompute,convertToInches,convertFromInches} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";
const entries=JSON.parse(readFileSync(new URL("../src/tools.json",import.meta.url),"utf8")).tools;
const defaults=slug=>Object.fromEntries(entries.find(t=>t.slug===slug).inputs.map(f=>[f.key,f.value]));
const metric=(r,name)=>{const m=r.metrics.find(x=>x.label===name);assert.ok(m,name);return m.value;};
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,String(a)+" != "+b);
const spiral="spiral-staircase-calculator",stave="stave-calculator";

test("spiral: one turn closes 14 physical wedges and final 15th floor rise",()=>{
 const a=defaults(spiral),r=compute(spiral,a);
 assert.equal(r.shape,"spiral-plan");assert.equal(r.rows.length,14);
 assert.equal(metric(r,"Risers including the upper finished floor"),15);
 assert.equal(metric(r,"Physical wedge treads"),14);
 near(metric(r,"Uniform riser height"),7.2);
 near(metric(r,"Angle per physical tread"),360/14);
 near(metric(r,"Walk-line radius from stair center"),14);
 near(metric(r,"Walk-line arc going per tread"),2*Math.PI);
 near(metric(r,"Walk-line straight chord per tread"),28*Math.sin(Math.PI/14));
 assert.ok(metric(r,"Walk-line straight chord per tread")<metric(r,"Walk-line arc going per tread"));
 near(metric(r,"Outer-edge straight chord per tread"),72*Math.sin(Math.PI/14));
 near(metric(r,"Inner-edge straight chord per tread"),4*Math.sin(Math.PI/14));
 near(r.rows.at(-1).endAngleDeg,360);
 near(r.rows.at(-1).treadTopElevation,100.8);
 near(metric(r,"Upper finished floor elevation"),108);
 near(r.rows.at(-1).treadTopElevation+7.2,108);
 near(r.rows.reduce((sum,row)=>sum+row.treadAnnularAreaFt2,0),Math.PI*(36*36-2*2)/144);
 for(const row of r.rows){
  assert.equal(row.planVertices.length,4);
  for(const [i,v] of row.planVertices.entries()){
   near(Math.hypot(v[0]-36,v[1]-36),(i===0||i===3)?2:36,1.5e-8);
  }
 }
});
test("spiral: sweeping partial turns, counts and directions preserve plan and rise",()=>{
 const a=defaults(spiral);
 for(const turn of [90,180,270,360])for(const risers of [8,12,20,31]){
  const clockwise=compute(spiral,{...a,totalRotation:turn,risers,direction:0});
  const counter=compute(spiral,{...a,totalRotation:turn,risers,direction:1});
  near(metric(clockwise,"Angle per physical tread")*(risers-1),turn);
  near(metric(clockwise,"Uniform riser height")*risers,a.totalRise);
  assert.equal(clockwise.rows.length,risers-1);
  for(const [i,row] of clockwise.rows.entries()){
   const reverse=counter.rows[i];
   near(row.walklineArcLength,reverse.walklineArcLength);
   near(row.outerChord,reverse.outerChord);
   near(row.treadTopElevation,reverse.treadTopElevation);
   near(row.startAngleDeg,-reverse.startAngleDeg);
   near(row.endAngleDeg,-reverse.endAngleDeg);
  }
  near(clockwise.rows.reduce((sum,row)=>sum+row.treadAnnularAreaFt2,0),
   Math.PI*(a.outerDiameter*a.outerDiameter-a.poleDiameter*a.poleDiameter)/4*turn/360/144);
 }
});
test("spiral: invalid radial widths, sector, integer count, turn and stock fail safely",()=>{
 const a=defaults(spiral);
 for(const patch of [
  {totalRise:0},{outerDiameter:4},{poleDiameter:72},{walkInset:34},
  {walkInset:0},{risers:2},{risers:49},{risers:10.5},{direction:2},
  {totalRotation:59},{totalRotation:361},{totalRotation:360,risers:3},
  {outerDiameter:1e9}
 ])assert.equal(safeCompute(spiral,{...a,...patch}).ok,false,JSON.stringify(patch));
});
test("stave: independent face slant, corner-edge, true chords and bevel closure",()=>{
 const a=defaults(stave),r=compute(stave,a);
 assert.equal(r.shape,"stave-trapezoid");assert.equal(r.rows.length,12);
 const angle=Math.PI/12,s=Math.sin(angle),c=Math.cos(angle),
   top=20*s,bottom=16*s,face=Math.hypot(24,2*c),
   leg=Math.hypot(24,2),k=2*c/24;
 const halfDihedral=Math.acos((Math.cos(2*angle)+k*k)/(1+k*k))*90/Math.PI;
 near(metric(r,"Top outside straight chord"),top);
 near(metric(r,"Bottom outside straight chord"),bottom);
 near(metric(r,"Face-center slant length"),face);
 near(metric(r,"Corner-edge true length"),leg);
 near(metric(r,"Plan half-miter reference"),15);
 near(metric(r,"Theoretical face-to-face half-dihedral"),halfDihedral);
 near(metric(r,"Flat face-edge side taper"),Math.atan((top-bottom)/(2*face))*180/Math.PI);
 near(leg*leg,face*face+((top-bottom)/2)**2,1e-7);
 near(metric(r,"Conservative rough blank width"),top+.25+.125);
 near(metric(r,"Conservative rough blank length"),face+.25+.125);
 const vertices=r.rows[0].planVertices;
 near(vertices[1][0]-vertices[0][0],top,2e-8);
 near(vertices[2][0]-vertices[3][0],bottom,2e-8);
 near(vertices[2][1]-vertices[1][1],face,2e-8);
 for(const row of r.rows){
  assert.equal(row.planVertices.length,4);
  near(row.topOuterChord,top,2e-8);
  near(row.bottomOuterChord,bottom,2e-8);
  near(row.faceCenterlineLength,face,2e-8);
  near(row.cornerEdgeLength,leg,2e-8);
 }
});
test("stave: untapered barrel is rectangular and tapered diameter reversal conserves lengths",()=>{
 const a=defaults(stave);
 const plain=compute(stave,{...a,bottomCornerDiameter:a.topCornerDiameter,roughMargin:0,roughKerf:0});
 near(metric(plain,"Top outside straight chord"),metric(plain,"Bottom outside straight chord"));
 near(metric(plain,"Face-center slant length"),a.height);
 near(metric(plain,"Corner-edge true length"),a.height);
 near(metric(plain,"Flat face-edge side taper"),0);
 near(metric(plain,"Theoretical face-to-face half-dihedral"),15);
 const r=compute(stave,a),reversed=compute(stave,{...a,topCornerDiameter:a.bottomCornerDiameter,
  bottomCornerDiameter:a.topCornerDiameter});
 for(const name of ["Face-center slant length","Corner-edge true length",
  "Theoretical face-to-face half-dihedral"])
  near(metric(r,name),metric(reversed,name));
 near(metric(r,"Top outside straight chord"),metric(reversed,"Bottom outside straight chord"));
});
test("stave: invalid dimensions, tiny allowances and count reject safely",()=>{
 const a=defaults(stave);
 for(const patch of [
  {topCornerDiameter:0},{bottomCornerDiameter:0},{height:0},{staves:2},
  {staves:61},{staves:12.5},{roughMargin:-.1},{roughKerf:-.01},
  {roughKerf:1e-9},{roughMargin:1e-9},{height:1e-9},
  {topCornerDiameter:1e9}
 ])assert.equal(safeCompute(stave,{...a,...patch}).ok,false,JSON.stringify(patch));
});
test("new polygons have typed angles, vertex arrays and areas in five units",()=>{
 for(const slug of [spiral,stave]){
  const a=defaults(slug),r=compute(slug,a);
  for(const unit of ["in","mm","ft","cm","m"]){
   const cols=scheduleColumns(r.rows,unit);
   assert.ok(cols.some(x=>x.key==="planVertices"&&x.kind==="vertices"));
   assert.ok(cols.some(x=>x.key==="number"&&x.kind==="plain"));
   assert.ok(cols.some(x=>x.kind==="area"&&x.label.includes("²")));
   assert.ok(cols.some(x=>x.kind==="angle"&&x.label.includes("°")));
   const csv=buildScheduleCsv(r.rows,unit,"Schematic geometry only");
   assert.ok(csv.includes('"'+r.rows.at(-1).item+'"'));
   assert.ok(csv.includes('"Plan Projection Vertices ('+unit+')"'));
   assert.ok(!csv.includes("NaN")&&!csv.includes("undefined"));
   const converted={...a};
   for(const f of entries.find(t=>t.slug===slug).inputs)
     if(f.kind==="L")converted[f.key]=convertToInches(convertFromInches(a[f.key],unit),unit);
   const check=compute(slug,converted);
   assert.equal(check.rows.length,r.rows.length);
   for(const [i,m] of r.metrics.entries())
     near(check.metrics[i].value,m.value,Math.max(1e-7,Math.abs(m.value)*1e-9));
  }
 }
});
