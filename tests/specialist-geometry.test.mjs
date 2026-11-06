import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute,convertFromInches,convertToInches} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";
const spiral={totalRise:96,innerRadius:3,outerRadius:30,walkRadius:15,
 totalTurn:360,steps:12,direction:0};
const stave={topDiameter:24,bottomDiameter:18,height:30,staveCount:12,
 thickness:.75,roughMargin:0,roughKerf:0};
const v=(r,label)=>{const x=r.metrics.find(m=>m.label===label);assert.ok(x,label);return x.value};
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,String(a)+" != "+b);

test("spiral 360 degrees / 12 sectors gives exactly 30 degrees, 8 inch vertical stations and walkline arc",()=>{
 const r=compute("spiral-staircase-calculator",spiral);
 assert.equal(r.shape,"spiral-plan");assert.equal(r.rows.length,12);
 assert.equal(v(r,"Tread sectors / vertical stations"),12);
 near(v(r,"Equal station rise"),8);
 near(v(r,"Rotation per sector"),30);
 near(v(r,"Walkline arc per sector"),15*Math.PI/6);
 near(v(r,"Walkline straight chord per sector"),30*Math.sin(Math.PI/12));
 near(v(r,"Outer chord per sector"),60*Math.sin(Math.PI/12));
 near(v(r,"Inner chord per sector"),6*Math.sin(Math.PI/12));
 near(v(r,"Physical clear radial band (not code clear width)"),27);
 near(r.rows.at(-1).elevationEnd,96);
 for(const [i,row] of r.rows.entries()){
   near(row.angleStartDeg,i*30,1e-8);
   near(row.angleEndDeg,(i+1)*30,1e-8);
   near(row.elevationStart,i*8,1e-8);
   near(row.elevationEnd,(i+1)*8,1e-8);
   assert.equal(row.planVertices.length,4);
   for(const [j,p] of row.planVertices.entries()){
     const distance=Math.hypot(p[0]-30,p[1]-30);
     near(distance,(j===0||j===3)?3:30,2e-8);
   }
 }
 const start=r.rows[0].planVertices[0],end=r.rows.at(-1).planVertices[3];
 near(start[0],end[0]);near(start[1],end[1]);
});

test("spiral direction reverses Y orientation but leaves physical sector widths and rises unchanged",()=>{
 const a=compute("spiral-staircase-calculator",spiral);
 const b=compute("spiral-staircase-calculator",{...spiral,direction:1});
 for(let i=0;i<12;i++){
   near(a.rows[i].walklineArc,b.rows[i].walklineArc);
   near(a.rows[i].elevationEnd,b.rows[i].elevationEnd);
   near(a.rows[i].walklineCenterX,b.rows[i].walklineCenterX,2e-8);
   near(a.rows[i].walklineCenterY+b.rows[i].walklineCenterY,60,2e-8);
 }
});
test("spiral partial sweep and nested radii respect independent geometric constraints",()=>{
 const a={...spiral,steps:12,totalTurn:270,innerRadius:4,outerRadius:28,walkRadius:12};
 const r=compute("spiral-staircase-calculator",a);
 near(v(r,"Rotation per sector"),22.5);
 near(v(r,"Walkline arc per sector"),12*Math.PI/8);
 near(r.rows.at(-1).angleEndDeg,270);
 near(r.rows.at(-1).elevationEnd,96);
 const csv=buildScheduleCsv(r.rows,"mm");
 assert.ok(csv.includes('"Plan Projection Vertices (mm)"'));
 assert.ok(csv.includes('"Walkline Arc (mm)"'));
});
test("spiral rejects invalid column, radii, turn and unsupported structural assumptions",()=>{
 for(const change of [
  {outerRadius:3},{outerRadius:2},{innerRadius:0},{walkRadius:3},
  {walkRadius:30},{walkRadius:31},{totalRise:0},{totalTurn:0},
  {totalTurn:361},{steps:3},{steps:65},{steps:12.5},{direction:2},
  {outerRadius:3+1e-9},{walkRadius:3+1e-9}
 ]){
  const r=safeCompute("spiral-staircase-calculator",{...spiral,...change});
  assert.equal(r.ok,false,JSON.stringify(change));
 }
});

test("stave trapezoid face chord and slant vs corner-edge geometry conserve 3D lengths",()=>{
 const r=compute("stave-calculator",stave);
 assert.equal(r.shape,"stave-flat");assert.equal(r.rows.length,12);
 const sin15=Math.sin(Math.PI/12),cos15=Math.cos(Math.PI/12);
 const tc=24*sin15,bc=18*sin15,
   developed=Math.hypot(30,3*cos15),edge=Math.hypot(30,3);
 near(v(r,"Staves"),12);
 near(v(r,"Top outside polygon chord"),tc);
 near(v(r,"Bottom outside polygon chord"),bc);
 near(v(r,"Developed flat face slant height"),developed);
 near(v(r,"Outside corner side edge"),edge);
 near(v(r,"Plan half-wedge angle (not saw angle)"),15);
 near(v(r,"Top ideal polygon inradius"),12*cos15);
 near(v(r,"Bottom ideal polygon inradius"),9*cos15);
 near(Math.hypot(developed,(tc-bc)/2),edge);
 for(const row of r.rows){
  near(row.topChord,tc,1e-8);
  near(row.bottomChord,bc,1e-8);
  near(row.developedFaceSlant,developed,1e-8);
  near(row.cornerSideEdge,edge,1e-8);
  assert.deepEqual(row.planVertices,r.staveVertices);
 }
 near(r.staveVertices[1][0]-r.staveVertices[0][0],tc,2e-8);
 near(r.staveVertices[2][0]-r.staveVertices[3][0],bc,2e-8);
 near(r.staveVertices[2][1],developed,1e-8);
});
test("untapered prism has identical top/bottom chords and 15 degree adjacent face-normal half angle",()=>{
 const r=compute("stave-calculator",{...stave,bottomDiameter:24});
 near(v(r,"Top outside polygon chord"),v(r,"Bottom outside polygon chord"));
 near(v(r,"Developed flat face slant height"),30);
 near(v(r,"Half-angle between adjacent face normals"),15);
 near(v(r,"Outside corner side edge"),30);
});
test("rough blank margin/kerf changes stock estimate only, never ideal stave geometry",()=>{
 const r=compute("stave-calculator",{...stave,roughMargin:.125,roughKerf:.125});
 const plain=compute("stave-calculator",stave);
 near(v(r,"Rough rectangular blank length"),v(plain,"Rough rectangular blank length")+.375);
 near(v(r,"Rough rectangular blank width"),v(plain,"Rough rectangular blank width")+.375);
 assert.deepEqual(r.staveVertices,plain.staveVertices);
 const csv=buildScheduleCsv(r.rows,"mm");
 assert.ok(csv.includes('"Plan Projection Vertices (mm)"'));
 assert.ok(csv.includes('"Face Normal Half Angle (°)"'));
});
test("stave arbitrary tapers preserve polygon face-vs-edge Pythagorean closure",()=>{
 for(const n of [6,8,12,20,32])
 for(const top of [15,24,50])
 for(const bottom of [10,18,55]){
  const r=compute("stave-calculator",{...stave,staveCount:n,
   topDiameter:top,bottomDiameter:bottom});
  const tc=top*Math.sin(Math.PI/n),bc=bottom*Math.sin(Math.PI/n);
  const slant=v(r,"Developed flat face slant height"),
    edge=v(r,"Outside corner side edge");
  near(Math.hypot(slant,(tc-bc)/2),edge,1e-7);
  assert.ok(v(r,"Half-angle between adjacent face normals")>0);
  assert.equal(r.rows.length,n);
 }
});
test("stave rejects impossible dimensions, subresolution allowance and unsupported counts",()=>{
 for(const patch of [
  {topDiameter:0},{bottomDiameter:0},{height:0},{thickness:0},
  {staveCount:2},{staveCount:65},{staveCount:3.5},
  {roughMargin:-1},{roughKerf:-1},
  {roughMargin:1e-9},{roughKerf:1e-9}
 ]){
  const r=safeCompute("stave-calculator",{...stave,...patch});
  assert.equal(r.ok,false,JSON.stringify(patch));
 }
});
test("spiral and stave metric inputs retain physical coordinates in in/mm/ft/cm/m",()=>{
 for(const [slug,base,keys] of [
  ["spiral-staircase-calculator",spiral,["totalRise","innerRadius","outerRadius","walkRadius"]],
  ["stave-calculator",stave,["topDiameter","bottomDiameter","height","thickness","roughMargin","roughKerf"]]
 ]){
  const orig=compute(slug,base);
  for(const unit of ["in","mm","ft","cm","m"]){
   const switched={...base};
   for(const key of keys)
    switched[key]=convertToInches(convertFromInches(base[key],unit),unit);
   const r=compute(slug,switched);
   assert.equal(r.rows.length,orig.rows.length);
   for(const [i,m] of r.metrics.entries())near(m.value,orig.metrics[i].value,1e-6);
  }
 }
});
