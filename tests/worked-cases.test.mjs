import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compute,convertFromInches} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";
const cases=JSON.parse(readFileSync(new URL("../src/worked-cases.json",import.meta.url),"utf8")).cases;
const tools=JSON.parse(readFileSync(new URL("../src/tools.json",import.meta.url),"utf8")).tools;
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,String(a)+" != "+b);
const metric=(r,name)=>{const m=r.metrics.find(x=>x.label===name);assert.ok(m,name);return m;};
test("six complete synthetic examples cover three valuable calculator workflows",()=>{
 assert.equal(cases.length,6);
 assert.equal(new Set(cases.map(x=>x.id)).size,6);
 const group={};
 for(const c of cases){
  group[c.slug]=(group[c.slug]||0)+1;
  const tool=tools.find(t=>t.slug===c.slug);
  assert.ok(tool&&tool.priority!=="P2");
  assert.deepEqual(Object.keys(c.inputs).sort(),tool.inputs.map(f=>f.key).sort());
  assert.ok(c.verification.length>80&&c.description.length>40);
  for(const f of tool.inputs){
   assert.ok(Number.isFinite(c.inputs[f.key]),c.id+" / "+f.key);
   if(f.options)assert.ok(f.options.some(o=>o.value===c.inputs[f.key]));
  }
  const r=compute(c.slug,c.inputs);
  for(const check of c.checks){
   const m=metric(r,check.label);
   assert.equal(m.kind,check.kind,c.id+" / "+check.label+" kind changed");
   near(m.value,check.value,1e-6);
   assert.ok(Number.isFinite(convertFromInches(m.value,"mm")));
  }
  for(const u of ["in","mm"]){
   const csv=buildScheduleCsv(r.rows,u,"Synthetic measurement case");
   const columns=scheduleColumns(r.rows,u);
   assert.ok(r.rows.length>=1&&columns.length>=2);
   assert.ok(csv.includes('"'+columns[0].label+'"'),c.id);
   assert.ok(csv.includes('"'+r.rows.at(-1).item+'"'),c.id);
   assert.ok(!csv.includes("NaN")&&!csv.includes("undefined"));
  }
 }
 assert.deepEqual(group,{"deck-board-calculator":2,"rafter-calculator":2,"stair-stringer-calculator":2});
});
test("deck scenarios close board face widths plus between-row gaps",()=>{
 for(const c of cases.filter(s=>s.slug==="deck-board-calculator")){
  const a=c.inputs,r=compute(c.slug,a),n=r.rows.length;
  assert.equal(n,Math.ceil((a.width+a.gap)/(a.board+a.gap)-1e-10));
  near(r.rows.reduce((sum,row)=>sum+row.right-row.left,0)+(n-1)*a.gap,a.width,1e-7);
  near(r.rows.at(-1).ripWidth,a.width-(n-1)*(a.board+a.gap));
  assert.equal(metric(r,"Stock pieces: no offcut reuse").value,
   Math.ceil(n*Math.ceil(a.length/a.stock)*(1+a.waste/100)-1e-10));
 }
});
test("rafter scenario lengths and birdsmouth dimensions derive from independent geometry",()=>{
 for(const c of cases.filter(s=>s.slug==="rafter-calculator")){
  const a=c.inputs,r=compute(c.slug,a),run=a.run-a.ridge/2,slope=a.pitch/12;
  near(metric(r,"Adjusted run").value,run);
  near(metric(r,"Rise").value,run*slope);
  near(metric(r,"Rafter reference length").value,Math.hypot(run,run*slope));
  near(metric(r,"Seat notch (normal depth)").value,a.seat*slope/Math.hypot(1,slope));
  near(r.birdsmouthCutRows[0].endX-r.birdsmouthCutRows[0].startX,a.seat,1e-7);
  near(r.birdsmouthCutRows[1].endY-r.birdsmouthCutRows[1].startY,a.seat*slope,1e-7);
 }
});
test("stringer scenario risers, runs and throat are derived independently",()=>{
 for(const c of cases.filter(s=>s.slug==="stair-stringer-calculator")){
  const a=c.inputs,r=compute(c.slug,a),h=a.rise/a.risers,run=(a.risers-1)*a.tread;
  near(metric(r,"Uniform riser height").value,h);
  near(metric(r,"Total horizontal run").value,run);
  near(metric(r,"Bottom riser layout cut").value,h-a.treadThickness+a.lowerFinish);
  near(metric(r,"Uncut throat (nominal)").value,a.depth-h*a.tread/Math.hypot(h,a.tread));
  assert.equal(r.rows.length,a.risers);
  assert.equal(r.stepVertices.length,2*a.risers);
  near(r.rows.at(-1).riserTopHeight,a.rise,1e-7);
  near(r.rows.at(-1).horizontalRun,run,1e-7);
 }
});
