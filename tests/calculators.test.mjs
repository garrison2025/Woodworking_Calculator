import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compute,safeCompute,convertToInches,convertFromInches} from "../src/calcs.mjs";

const {tools}=JSON.parse(readFileSync(new URL("../src/tools.json",import.meta.url),"utf8"));
const published=tools.filter(t=>t.priority==="P0"||t.priority==="P1");
const held=tools.filter(t=>t.priority==="P2");
const defaults=t=>Object.fromEntries(t.inputs.map(x=>[x.key,x.value]));
const value=(result,label)=>{const item=result.metrics.find(m=>m.label===label);assert.ok(item,"Missing metric: "+label);return item.value};
const near=(actual,expected,tolerance=1e-3)=>assert.ok(Math.abs(actual-expected)<=tolerance,"Expected "+expected+", got "+actual);
test("Manifest has 9 P0, 17 P1 and five held P2 routes",()=>{
  assert.equal(published.filter(t=>t.priority==="P0").length,9);
  assert.equal(published.filter(t=>t.priority==="P1").length,17);
  assert.equal(held.length,5);
  assert.equal(new Set(tools.map(t=>t.slug)).size,31);
  for(const t of held)assert.equal(t.status,"HOLD");
  for(const t of published)assert.ok(t.keyword&&t.kd<=29&&t.example&&t.formula&&t.limit);
});
const golden={
  "stud-calculator":["Last cut length",163.5],
  "framing-calculator":["Regular studs",6],
  "deck-board-calculator":["Last rip width",1.875],
  "baluster-spacing-calculator":["Baluster count",17],
  "rafter-calculator":["Rafter reference length",Math.hypot(120,60)],
  "crown-molding-calculator":["Miter magnitude",31.615],
  "soffit-calculator":["Nominal roof-line drop",12],
  "kerf-bending-calculator":["Proposed cuts",8],
  "wainscoting-calculator":["Panel width",21.2],
  "stair-calculator":["Risers",14],
  "rise-run-calculator":["Slope angle",26.565],
  "deck-material-calculator":["Deck area",120],
  "segmented-bowl-calculator":["Segment half-miter",15],
  "roof-pitch-calculator":["Percentage grade",50],
  "equal-spacing-calculator":["Centers",6],
  "hip-rafter-calculator":["Hip line length",180],
  "hip-roof-calculator":["Ridge length",120],
  "wall-stud-calculator":["Stud count",9],
  "shelf-spacing-calculator":["Shelf count",3],
  "gable-roof-calculator":["Roof rise",66],
  "square-layout-calculator":["Ideal right-angle diagonal",60],
  "diagonal-brace-calculator":["Full centerline",60],
  "hole-spacing-calculator":["Hole center pitch",(3.937-2*.19685)/3],
  "stair-stringer-calculator":["Total horizontal run",130],
  "roof-sheathing-calculator":["Sheet geometric lower bound",5],
  "fence-post-calculator":["Posts",14]
};
for(const t of published){
  const slug=t.slug, original=defaults(t);
  test(slug+" · golden default fixture",()=>{const [label,expected]=golden[slug];near(value(compute(slug,original),label),expected,slug==="crown-molding-calculator"?.02:1e-3)});
  test(slug+" · output geometry and cut list contain only finite numbers",()=>{
    const r=compute(slug,original);
    assert.ok(r.metrics.length>0&&r.span>0);
    assert.ok(Array.isArray(r.rows),slug+" must return an array of schedule rows");
    assert.ok(Array.isArray(r.marks),slug+" must return an array of diagram marks");
    assert.equal(typeof r.shape,"string",slug+" must return a valid diagram type");
    for(const metric of r.metrics)assert.ok(Number.isFinite(metric.value),metric.label);
    for(const mark of r.marks)assert.ok(Number.isFinite(mark.x)&&mark.x>=0&&mark.x<=r.span+1e-6);
    for(const row of r.rows)for(const val of Object.values(row))if(typeof val==="number")assert.ok(Number.isFinite(val));
  });
  test(slug+" · same inputs produce the same output",()=>{
    assert.deepEqual(compute(slug,structuredClone(original)),compute(slug,structuredClone(original)));
  });
  test(slug+" · arguments are not modified",()=>{
    const frozen=Object.freeze({...original});compute(slug,frozen);assert.deepEqual(frozen,original);
  });
  test(slug+" · five unit conversions preserve physical lengths",()=>{
    const before=compute(slug,original);
    for(const units of ["in","ft","mm","cm","m"]){
      const unitConverted={...original};
      for(const f of t.inputs)if(f.kind==="L")unitConverted[f.key]=convertToInches(convertFromInches(original[f.key],units),units);
      const after=compute(slug,unitConverted);
      assert.equal(before.metrics.length,after.metrics.length);
      for(let i=0;i<before.metrics.length;i++)near(before.metrics[i].value,after.metrics[i].value,1e-7);
    }
  });
  test(slug+" · first invalid negative parameter yields a safe error",()=>{
    const changed={...original,[t.inputs[0].key]:-1};
    assert.equal(safeCompute(slug,changed).ok,false);
  });
  test(slug+" · NaN, Infinity, overflow are rejected",()=>{
    for(const v of [NaN,Infinity,-Infinity,1e12]){
      const changed={...original,[t.inputs[0].key]:v};
      assert.equal(safeCompute(slug,changed).ok,false);
    }
  });
  test(slug+" · unsupported zero width or count inputs cannot silently succeed",()=>{
    const f=t.inputs.find(f=>["length","width","run","radius","outer","wall","rise","height","projection","spring"].includes(f.key))||t.inputs[0];
    const changed={...original,[f.key]:0};
    if(slug==="rise-run-calculator"&&f.key==="rise")return;
    if(slug==="roof-pitch-calculator"&&f.key==="pitch")return;
    if(slug==="framing-calculator"&&f.key==="openingStart")return;
    assert.equal(safeCompute(slug,changed).ok,false);
  });
}
test("Deck corrected hand calculation: final row width is 1.875 in, not 3.625 in",()=>{
  const r=compute("deck-board-calculator",{width:120,length:144,board:5.5,gap:.125,stock:144,waste:0});
  near(value(r,"Last rip width"),1.875);
  near(value(r,"Board rows"),22);
});
test("Baluster 17 equal gaps match 96in opening",()=>{
  const r=compute("baluster-spacing-calculator",{length:96,width:1.5,gap:4});
  near(value(r,"Equal clear gap"),(96-17*1.5)/18,1e-6);
});
test("Two-center equal spacing uses the full interval",()=>{
  const r=compute("equal-spacing-calculator",{length:1000/25.4,count:6,left:0,right:0});
  near(value(r,"Equal center interval")*25.4,200,1e-7);
});
test("Gable geometry: wall end height 168in before plate deductions",()=>{
  const r=compute("stud-calculator",{length:144,start:96,pitch:6,spacing:16,plates:4.5});
  near(value(r,"Last cut length")+4.5,168);
});
test("Unsafe opening extending beyond frame is rejected",()=>{
  assert.equal(safeCompute("framing-calculator",{length:120,spacing:16,width:1.5,openingStart:90,openingWidth:40,openingHeight:80}).ok,false);
});
test("Hole overlap is rejected",()=>{
  assert.equal(safeCompute("hole-spacing-calculator",{length:4,holes:8,edge:.5,diameter:1}).ok,false);
});
test("P2 routes are blocked by the geometry engine",()=>{
  for(const t of held)assert.equal(safeCompute(t.slug,{}).ok,false);
});

test("Multiple framing openings remove interior regular studs",()=>{
  const a={length:160,spacing:16,width:1.5,openingStart:24,openingWidth:24,openingHeight:80,opening2Start:88,opening2Width:24,opening3Start:0,opening3Width:0};
  const r=compute("framing-calculator",a);
  near(value(r,"Opening intervals"),2);
  near(value(r,"Opening-side reference members"),8);
  assert.equal(r.rows.some(p=>p.item.startsWith("Regular")&&p.position===32),false);
  assert.equal(r.rows.some(p=>p.item.startsWith("Regular")&&p.position===96),false);
  assert.equal(r.openings.length,2);
});
test("Overlapping framing openings are rejected",()=>{
  const a={length:160,spacing:16,width:1.5,openingStart:24,openingWidth:60,openingHeight:80,opening2Start:64,opening2Width:24};
  assert.equal(safeCompute("framing-calculator",a).ok,false);
});
test("Deck stock count does not assume offcut reuse",()=>{
  const r=compute("deck-board-calculator",{width:120,length:144,board:5.5,gap:.125,stock:120,waste:0});
  near(value(r,"Stock pieces: no offcut reuse"),44);
});

test("Rafter: independent notch geometry and ridge allowance",()=>{
  const a={run:120,pitch:6,ridge:1.5,overhang:12,depth:5.5,seat:3};
  const r=compute("rafter-calculator",a);
  const horizontal=120-1.5/2;
  const theta=Math.atan2(6,12);
  const expectedNotch=3*Math.sin(theta);
  near(value(r,"Adjusted run"),119.25,1e-8);
  near(value(r,"Rise"),119.25*.5,1e-8);
  near(value(r,"Rafter reference length"),Math.hypot(horizontal,horizontal*.5),1e-8);
  near(value(r,"Overhang slope length"),Math.hypot(12,6),1e-8);
  near(value(r,"Seat reference drop"),1.5,1e-8);
  near(value(r,"Seat notch (normal depth)"),expectedNotch,1e-8);
  near(value(r,"Remaining stock (normal)"),5.5-expectedNotch,1e-8);
  near(value(r,"Notch / stock depth"),100*expectedNotch/5.5,1e-8);
  assert.equal(r.rows.length,3);
  assert.deepEqual(r.rows.map(p=>p.item),["Ridge reference","Bearing reference","Overhang end"]);
  near(r.rows[1].horizontalRun,119.25,1e-8);
  near(r.rows[2].horizontalRun,131.25,1e-8);
  assert.equal(r.shape,"rafter");
});
test("Rafter: deep cut geometrically consumes the nominal section and is rejected",()=>{
  const a={run:120,pitch:12,ridge:0,overhang:12,depth:2,seat:5};
  assert.equal(safeCompute("rafter-calculator",a).ok,false);
});
test("Rafter notch uses perpendicular depth rather than overly strict vertical distance",()=>{
  const a={run:120,pitch:12,ridge:0,overhang:0,depth:2.5,seat:3};
  const r=compute("rafter-calculator",a);
  near(value(r,"Seat reference drop"),3,1e-9);
  near(value(r,"Seat notch (normal depth)"),3/Math.sqrt(2),1e-9);
  near(value(r,"Remaining stock (normal)"),2.5-3/Math.sqrt(2),1e-9);
});
test("Rafter: zero slope has no rise or notch depth",()=>{
  const r=compute("rafter-calculator",{run:120,pitch:0,ridge:0,overhang:12,depth:5.5,seat:3});
  near(value(r,"Rise"),0,1e-9);
  near(value(r,"Seat notch (normal depth)"),0,1e-9);
  near(value(r,"Overhang slope length"),12,1e-9);
});
test("Stringer: cut corners, full riser height and 6-inch bottom reference",()=>{
  const a={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,lowerFinish:0};
  const r=compute("stair-stringer-calculator",a);
  near(value(r,"Uniform riser height"),7.5);
  near(value(r,"Total horizontal run"),130);
  near(value(r,"Bottom riser layout cut"),6);
  near(value(r,"Notch penetration (normal)"),6);
  near(value(r,"Uncut throat (nominal)"),5.25);
  assert.equal(r.rows.length,14);
  assert.deepEqual(r.rows[0],{item:"Riser 1",horizontalRun:0,riserTopHeight:7.5,treadStart:0,treadEnd:10});
  assert.deepEqual(r.rows.at(-1),{item:"Top landing vertical",horizontalRun:130,riserTopHeight:105,treadStart:130,treadEnd:null});
  assert.equal(r.shape,"stringer");
});
test("Stringer: finish-to-install later adds its thickness to bottom layout cut",()=>{
  const base={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,lowerFinish:.5};
  const r=compute("stair-stringer-calculator",base);
  near(value(r,"Bottom riser layout cut"),6.5);
  assert.equal(safeCompute("stair-stringer-calculator",{...base,treadThickness:9,lowerFinish:0}).ok,false);
  assert.equal(safeCompute("stair-stringer-calculator",{...base,depth:5}).ok,false);
});

test("Framing centers do not duplicate king or jack packs",()=>{
  const r=compute("framing-calculator",{length:120,spacing:16,width:1.5,wallHeight:96,openingStart:32,openingWidth:36,openingHeight:80,openingSill:0});
  near(value(r,"Regular studs"),6);near(value(r,"Opening-side reference members"),4);
  near(value(r,"Opening 1 top elevation"),80);
  assert.deepEqual(r.rows.filter(x=>x.item.includes("Opening 1")).map(x=>x.position),[29.75,31.25,68.75,70.25]);
  assert.equal(r.rows.filter(x=>x.item.startsWith("Regular")).some(x=>x.position>=29&&x.position<=71),false);
  assert.equal(new Set(r.rows.map(x=>x.position)).size,r.rows.length);
  near(value(r,"Rough opening face area"),36*80/144);
});
test("Framing supports a second independently elevated window",()=>{
  const r=compute("framing-calculator",{length:160,spacing:16,width:1.5,wallHeight:108,openingStart:24,openingWidth:24,openingHeight:80,openingSill:0,opening2Start:88,opening2Width:24,opening2Height:42,opening2Sill:34});
  near(value(r,"Opening intervals"),2);near(value(r,"Opening 2 top elevation"),76);
  near(r.openings[1].sill,34);near(r.openings[1].height,42);
  assert.equal(r.marks.filter(x=>x.role==="jack"&&x.topHeight===76).length,2);
});
test("Framing rejects impossible window elevation and side-member interference",()=>{
  const base={length:120,spacing:16,width:1.5,wallHeight:96,openingStart:32,openingWidth:36,openingHeight:80,openingSill:0};
  assert.equal(safeCompute("framing-calculator",{...base,openingSill:22}).ok,false);
  assert.equal(safeCompute("framing-calculator",{...base,openingStart:2}).ok,false);
  assert.equal(safeCompute("framing-calculator",{...base,opening2Start:72,opening2Width:20}).ok,false);
});

test("Hip four-plane clipped sheet area conserves exact sloped area",()=>{
  const a={width:240,length:360,pitch:6,overhang:12,sheetWidth:48,sheetLength:96,orientation:0};
  const r=compute("hip-roof-calculator",a);
  assert.equal(r.shape,"roof-panels");
  assert.equal(new Set(r.roofPanels.map(p=>p.plane)).size,4);
  near(r.roofPanels.reduce((s,p)=>s+p.cutAreaSqIn,0),value(r,"Whole sloped area")*144,1e-5);
  near(value(r,"Sheet positions (no offcut reuse)"),r.rows.length);
  for(const panel of r.roofPanels){
    assert.ok(panel.cutAreaSqIn>0&&panel.cutAreaSqIn<=48*96+1e-6);
    for(const [u,v] of panel.localVertices){assert.ok(u>=-1e-6&&u<=96+1e-6);assert.ok(v>=-1e-6&&v<=48+1e-6)}
    for(const [x,y] of panel.planPoints){assert.ok(x>=-1e-6&&x<=r.roofMajor+1e-6);assert.ok(y>=-1e-6&&y<=r.roofMinor+1e-6)}
  }
});
test("Hip 192 by 96 flat sheet grid requires six sheets, area lower bound four",()=>{
  const a={width:96,length:192,pitch:0,overhang:0,sheetWidth:48,sheetLength:96,orientation:0};
  const r=compute("hip-roof-calculator",a);
  near(value(r,"Sheet area lower bound"),4);
  near(value(r,"Sheet positions (no offcut reuse)"),6);
  near(value(r,"Whole sloped area"),128);
});
test("Square hip roof and transposed inputs retain exact tiled area",()=>{
  const a={width:144,length:144,pitch:6,overhang:0,sheetWidth:48,sheetLength:96,orientation:1};
  const r=compute("hip-roof-calculator",a);near(value(r,"Ridge length"),0);
  near(r.roofPanels.reduce((s,p)=>s+p.cutAreaSqIn,0),value(r,"Whole sloped area")*144,1e-5);
  for(const p of r.roofPanels)for(const [u,v] of p.localVertices){assert.ok(u>=-1e-6&&u<=48+1e-6);assert.ok(v>=-1e-6&&v<=96+1e-6)}
  const left=compute("hip-roof-calculator",{...a,width:144,length:192});
  const right=compute("hip-roof-calculator",{...a,width:192,length:144});
  assert.deepEqual(left,right);
});
test("Hip orientation input and overly dense sheet grid are validated",()=>{
  const a={width:240,length:360,pitch:6,overhang:12,sheetWidth:48,sheetLength:96};
  assert.equal(safeCompute("hip-roof-calculator",{...a,orientation:2}).ok,false);
  assert.equal(safeCompute("hip-roof-calculator",{...a,sheetWidth:.01,sheetLength:.01}).ok,false);
  const a0=compute("hip-roof-calculator",{...a,orientation:0}),a1=compute("hip-roof-calculator",{...a,orientation:1});
  near(value(a0,"Whole sloped area"),value(a1,"Whole sloped area"));
});
