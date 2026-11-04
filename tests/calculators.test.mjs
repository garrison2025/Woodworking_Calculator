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
test("Drilled hole centers, circular extents and longitudinal clearances agree in millimeters",()=>{
  const a={length:100/25.4,holes:4,edge:5/25.4,diameter:5/25.4};
  const r=compute("hole-spacing-calculator",a);
  near(value(r,"Hole center pitch")*25.4,30,1e-7);
  near(value(r,"Clear material between holes")*25.4,25,1e-7);
  near(value(r,"End material margin")*25.4,2.5,1e-7);
  assert.equal(r.rows.length,4);
  for(const [i,row] of r.rows.entries()){
    near(row.center*25.4,5+i*30,2e-7);
    near(row.holeLeftEdge*25.4,2.5+i*30,2e-7);
    near(row.holeRightEdge*25.4,7.5+i*30,2e-7);
    near((row.holeRightEdge-row.holeLeftEdge)*25.4,5,3e-7);
    if(i===0)assert.equal(row.clearToPrevious,null);
    else near(row.clearToPrevious*25.4,25,2e-7);
  }
  near(r.rows[0].holeLeftEdge*25.4,2.5,2e-7);
  near((a.length-r.rows.at(-1).holeRightEdge)*25.4,2.5,2e-7);
  assert.equal(r.shape,"holes");
});
test("Drill interval properties conserve stock margin and forbid negative hole gaps",()=>{
  for(const n of [2,3,4,8,20])for(const d of [1,2.5,5])for(const e of [d/2,d,2*d]){
    const a={length:120,holes:n,edge:e,diameter:d};
    const pitch=(a.length-2*e)/(n-1);
    const r=safeCompute("hole-spacing-calculator",a);
    if(pitch<d){
      assert.equal(r.ok,false);
      continue;
    }
    assert.equal(r.ok,true);
    const data=r.data;
    near(data.rows[0].holeLeftEdge,e-d/2,1e-7);
    near(data.rows.at(-1).holeRightEdge,120-e+d/2,1e-7);
    for(let i=1;i<data.rows.length;i++){
      near(data.rows[i].center-data.rows[i-1].center,pitch,1e-7);
      near(data.rows[i].holeLeftEdge-data.rows[i-1].holeRightEdge,pitch-d,1e-7);
    }
  }
  const touching=compute("hole-spacing-calculator",{length:30,holes:3,edge:5,diameter:10});
  near(value(touching,"Clear material between holes"),0,1e-9);
  assert.equal(safeCompute("hole-spacing-calculator",{length:20,holes:2,edge:4,diameter:10}).ok,false);
  assert.equal(safeCompute("hole-spacing-calculator",{length:25,holes:4,edge:5,diameter:7}).ok,false);
});
test("Kerf reference plan conserves developed length, slit mouths and remaining wood",()=>{
  const a={radius:3.937,angle:90,thickness:.75,web:.125,kerf:.125};
  const r=compute("kerf-bending-calculator",a);
  assert.equal(r.shape,"kerfs");
  assert.equal(r.rows.length,8);
  const arc=a.radius*Math.PI/2,depth=a.thickness-a.web;
  const closure=2*Math.atan(a.kerf/(2*depth));
  near(value(r,"Arc length"),arc,1e-9);
  near(value(r,"Saw depth"),depth,1e-9);
  near(value(r,"Retained continuous web"),a.web,1e-9);
  near(value(r,"Proposed spacing"),arc/8,1e-9);
  near(value(r,"Uncut land between kerfs"),arc/8-a.kerf,1e-9);
  near(value(r,"Planned turn / cut"),90/8,1e-9);
  near(value(r,"Estimated closure / cut"),closure*180/Math.PI,1e-9);
  for(const [i,row] of r.rows.entries()){
    const center=(i+.5)*arc/8;
    near(row.position,center,1e-8);
    near(row.slotLeft,center-a.kerf/2,1e-8);
    near(row.slotRight,center+a.kerf/2,1e-8);
    near(row.slotRight-row.slotLeft,a.kerf,1e-8);
    near(row.cutDepth+row.retainedWeb,a.thickness,1e-8);
    if(i>0)near(row.slotLeft-r.rows[i-1].slotRight,arc/8-a.kerf,1e-8);
  }
});
test("Kerf model rejects severed continuous web and touching/overlapping flat slots",()=>{
  const a={radius:3.937,angle:90,thickness:.75,web:.125,kerf:.125};
  assert.equal(safeCompute("kerf-bending-calculator",{...a,web:0}).ok,false);
  assert.match(safeCompute("kerf-bending-calculator",{...a,radius:.1}).error,/overlap|touch/i);
  assert.equal(safeCompute("kerf-bending-calculator",{...a,web:.75}).ok,false);
  assert.equal(safeCompute("kerf-bending-calculator",{...a,angle:361}).ok,false);
  const steep=compute("kerf-bending-calculator",{...a,angle:180,radius:20});
  assert.ok(value(steep,"Uncut land between kerfs")>0);
  assert.equal(steep.rows.length,value(steep,"Proposed cuts"));
});
test("Hole overlap is rejected",()=>{
  assert.equal(safeCompute("hole-spacing-calculator",{length:4,holes:8,edge:.5,diameter:1}).ok,false);
});
test("P2 routes are blocked by the geometry engine",()=>{
  for(const t of held)assert.equal(safeCompute(t.slug,{}).ok,false);
});

test("Shelves conserve full case height with reserved ends and exact face positions",()=>{
  for(const n of [1,2,3,5,10])for(const [top,bottom] of [[0,0],[1,2],[8,3]]){
    const a={height:60,shelves:n,thickness:1.25,top,bottom};
    const r=compute("shelf-spacing-calculator",a);
    const shared=(a.height-n*a.thickness-top-bottom)/(n+1);
    near(value(r,"Shared base clear gap"),shared,1e-8);
    near(value(r,"Actual top clearance"),shared+top,1e-8);
    near(value(r,"Actual bottom clearance"),shared+bottom,1e-8);
    assert.equal(r.rows.length,n);
    near(r.rows[0].shelfBottom,shared+bottom,1e-7);
    near(r.rows.at(-1).shelfTop+shared+top,a.height,1e-7);
    for(let i=0;i<r.rows.length;i++){
      const row=r.rows[i];
      near(row.shelfTop-row.shelfBottom,a.thickness,1e-7);
      near(row.clearBelow,i===0?shared+bottom:shared,1e-7);
      near(row.clearAbove,i===n-1?shared+top:shared,1e-7);
      if(i>0)near(row.shelfBottom-r.rows[i-1].shelfTop,shared,1e-7);
    }
  }
  const invalid={height:10,shelves:4,thickness:2,top:2,bottom:2};
  assert.equal(safeCompute("shelf-spacing-calculator",invalid).ok,false);
});
test("Fence-post centerline data stays inside the user-defined run",()=>{
  const a={length:1200,bay:96,post:3.5};
  const r=compute("fence-post-calculator",a);
  near(value(r,"Bays"),13);
  near(value(r,"Posts"),14);
  near(value(r,"True OC interval"),1200/13);
  near(value(r,"Approximate clear bay"),1200/13-3.5);
  assert.equal(r.rows.length,14);
  near(r.rows[0].center,0);
  near(r.rows.at(-1).center,1200);
  assert.equal(r.rows.at(-1).clearBayToNext,null);
  for(let i=0;i<r.rows.length-1;i++){
    near(r.rows[i+1].center-r.rows[i].center,1200/13,1e-7);
    near(r.rows[i].clearBayToNext,1200/13-3.5,1e-7);
  }
});
test("Fence-post rejects posts wider than computed bay even when they fit overall run",()=>{
  const a={length:120,bay:24,post:25};
  assert.equal(safeCompute("fence-post-calculator",a).ok,false);
  assert.match(safeCompute("fence-post-calculator",a).error,/overlap|touch/i);
  assert.equal(safeCompute("fence-post-calculator",{...a,post:24}).ok,false);
  const close=compute("fence-post-calculator",{...a,post:23.5});
  near(value(close,"Approximate clear bay"),.5);
  assert.equal(safeCompute("fence-post-calculator",{...a,bay:.01}).ok,false);
});
test("Fence-post property grid conserves centers, widths and maximum OC",()=>{
  for(const length of [72,97,120,1000])for(const maxBay of [12,16,24,36,96]){
    const n=Math.ceil(length/maxBay);
    if(n>500)continue;
    const usable=length/n;
    const r=compute("fence-post-calculator",{length,bay:maxBay,post:usable/2});
    assert.equal(r.rows.length,n+1);
    near(r.rows.at(-1).center,length);
    near(value(r,"True OC interval"),usable,1e-9);
    near(value(r,"Approximate clear bay"),usable/2,1e-9);
    assert.ok(usable<=maxBay+1e-9);
  }
});
test("Segmented-bowl per-piece schedule conserves ring sweeps and chord lengths",()=>{
  for(const n of [3,6,12,24,48,180])for(const rings of [1,2,4]){
    const a={outer:12,inner:8,segments:n,rings};
    const r=compute("segmented-bowl-calculator",a);
    assert.equal(r.shape,"ring");
    assert.equal(r.rows.length,n*rings);
    near(value(r,"Segment half-miter"),180/n);
    near(value(r,"Segment sweep"),360/n);
    near(value(r,"Outer chord"),12*Math.sin(Math.PI/n));
    near(value(r,"Inner chord"),8*Math.sin(Math.PI/n));
    for(let ring=1;ring<=rings;ring++){
      const pieces=r.rows.filter(x=>x.ring===ring);
      assert.equal(pieces.length,n);
      near(pieces[0].startAngle,0);
      near(pieces.at(-1).endAngle,360,1e-7);
      for(const p of pieces){
        near(p.outerChord,12*Math.sin(Math.PI/n),1e-7);
        near(p.innerChord,8*Math.sin(Math.PI/n),1e-7);
        near(p.radialDepth,2);
      }
    }
  }
  assert.equal(safeCompute("segmented-bowl-calculator",{outer:8,inner:12,segments:12,rings:1}).ok,false);
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
test("Deck estimator returns board rows, last rip, stock pieces and joist center coordinates",()=>{
  const a={width:120,length:144,board:5.5,gap:0.125,stock:144,joists:16,waste:10};
  const r=compute("deck-material-calculator",a);
  assert.equal(r.shape,"deck-plan");
  near(value(r,"Deck area"),120);
  near(value(r,"Deck rows"),22);
  near(value(r,"Last rip width"),1.875);
  near(value(r,"Joist reference lines"),10);
  near(value(r,"Final joist bay"),16);
  near(value(r,"Installed linear decking"),264);
  near(value(r,"Stock boards (no offcut reuse)"),22);
  near(value(r,"Stock boards with allowance"),25);
  near(value(r,"Board-joist intersections"),220);
  near(r.deckRows.at(-1).ripWidth,1.875);
  assert.deepEqual(r.joistGrid,[0,16,32,48,64,80,96,112,128,144]);
  assert.equal(r.rows.length,32);
  assert.equal(r.rows.filter(x=>x.type==="Decking").length,22);
  assert.equal(r.rows.filter(x=>x.type==="Joist center").length,10);
});
test("Deck estimator handles partial stock pieces and final joist bay",()=>{
  const a={width:120,length:140,board:5.5,gap:.125,stock:96,joists:16,waste:0};
  const r=compute("deck-material-calculator",a);
  near(value(r,"Stock boards (no offcut reuse)"),44);
  near(value(r,"Final joist bay"),12);
  const first=r.rows.filter(x=>x.type==="Decking").slice(0,2);
  near(first[0].cutLength,96);
  near(first[1].cutLength,44);
  near(first[1].alongStart,96);
  const cutLengthTotal=r.rows.filter(x=>x.type==="Decking").reduce((s,x)=>s+x.cutLength,0);
  near(cutLengthTotal,22*140);
});
test("Deck estimator aligns non-divisor stock joints to reachable joist references",()=>{
  const a={width:120,length:144,board:5.5,gap:.125,stock:100,joists:16,waste:10};
  const r=compute("deck-material-calculator",a);
  assert.deepEqual(r.seamCenters,[96]);
  near(value(r,"Butt joints on joist center references"),22);
  near(value(r,"Stock boards (no offcut reuse)"),44);
  near(value(r,"Stock boards with allowance"),49);
  const segments=r.rows.filter(x=>x.type==="Decking"&&x.item.startsWith("Row 1 "));
  assert.equal(segments.length,2);
  assert.deepEqual(segments.map(x=>[x.alongStart,x.cutLength,x.buttJointAtEnd]),[[0,96,96],[96,48,null]]);
  for(const row of r.rows.filter(x=>x.type==="Decking")){
    if(row.buttJointAtEnd!==null)assert.ok(r.joistGrid.includes(row.buttJointAtEnd));
    assert.ok(row.cutLength<=a.stock+1e-7);
  }
});
test("Deck estimator rejects stock that cannot reach even one intermediate joist",()=>{
  const a={width:120,length:144,board:5.5,gap:.125,stock:15.9,joists:16,waste:10};
  const out=safeCompute("deck-material-calculator",a);
  assert.equal(out.ok,false);
  assert.match(out.error,/no intermediate joist center is reachable/i);
  assert.equal(safeCompute("deck-material-calculator",{...a,stock:96,joists:100}).ok,false);
  const exact=compute("deck-material-calculator",{...a,stock:16});
  near(value(exact,"Stock boards (no offcut reuse)"),198);
  assert.equal(exact.seamCenters.length,8);
});
test("Deck supported seams conserve row lengths across different stock and joist spacings",()=>{
  for(const len of [110,140,144,183])for(const joists of [12,16,24])for(const stock of [32,50,80,96,100,144,200]){
    const a={width:30,length:len,board:5.5,gap:.125,stock,joists,waste:0};
    const r=safeCompute("deck-material-calculator",a);
    if(!r.ok){
      assert.match(r.error,/joist center is reachable|900/i);
      continue;
    }
    const data=r.data;
    assert.deepEqual(data.seamCenters,[...data.seamCenters].sort((u,v)=>u-v));
    const pieces=data.rows.filter(x=>x.type==="Decking"&&x.item.startsWith("Row 1 "));
    near(pieces.reduce((s,x)=>s+x.cutLength,0),len,1e-7);
    assert.equal(pieces.length,data.seamCenters.length+1);
    assert.ok(pieces.every(x=>x.cutLength>0&&x.cutLength<=stock+1e-7));
    assert.ok(pieces.slice(0,-1).every(x=>data.joistGrid.some(y=>Math.abs(y-x.buttJointAtEnd)<1e-7)));
  }
});
test("Deck estimator rejects unbounded stock subdivision and zero lengths",()=>{
  const a={width:120,length:144,board:5.5,gap:.125,stock:144,joists:16,waste:10};
  assert.equal(safeCompute("deck-material-calculator",{...a,stock:0}).ok,false);
  assert.equal(safeCompute("deck-material-calculator",{...a,stock:.001}).ok,false);
  assert.equal(safeCompute("deck-material-calculator",{...a,joists:0}).ok,false);
  assert.equal(safeCompute("deck-material-calculator",{...a,gap:-1}).ok,false);
  assert.equal(safeCompute("deck-material-calculator",{...a,board:0}).ok,false);
});
test("Deck stock count does not assume offcut reuse",()=>{
  const r=compute("deck-board-calculator",{width:120,length:144,board:5.5,gap:.125,stock:120,waste:0});
  near(value(r,"Stock pieces: no offcut reuse"),44);
});

test("Soffit normal stock depth affects finished datum and obeys parallel-line geometry",()=>{
  const a={projection:24,pitch:6,depth:5.5,lining:.5,fasciaOffset:0};
  const r=compute("soffit-calculator",a),f=Math.hypot(1,.5);
  assert.equal(r.shape,"soffit-section");
  near(value(r,"Nominal roof-line drop"),12,1e-9);
  near(value(r,"Vertical rafter depth at same station"),5.5*f,1e-9);
  near(value(r,"Eave rafter underside drop"),12+5.5*f,1e-9);
  near(value(r,"Finished soffit reference drop"),12+5.5*f+.5,1e-9);
  near(r.rows[0].roofTopDrop,0);
  near(r.rows[0].rafterUndersideDrop,5.5*f,1e-7);
  near(r.rows[1].roofTopDrop,12);
  near(r.rows[1].rafterUndersideDrop,12+5.5*f,1e-7);
  near(r.rows[1].soffitFaceDrop,12+5.5*f+.5,1e-7);
  const deep=compute("soffit-calculator",{...a,depth:11});
  near(value(deep,"Finished soffit reference drop")-value(r,"Finished soffit reference drop"),5.5*f,1e-9);
  const noDepth=compute("soffit-calculator",{...a,depth:0});
  near(value(noDepth,"Finished soffit reference drop"),12.5,1e-9);
  const offset=compute("soffit-calculator",{...a,fasciaOffset:-2});
  near(value(offset,"Finished soffit reference drop"),value(r,"Finished soffit reference drop")-2,1e-9);
  assert.equal(safeCompute("soffit-calculator",{...a,fasciaOffset:-40}).ok,false);
});
test("Soffit datum perpendicular depth remains consistent across 0:12 to 24:12 pitches",()=>{
  for(const pitch of [0,2,6,9,12,24]){
    const a={projection:36,pitch,depth:7.25,lining:.75,fasciaOffset:1.25};
    const r=compute("soffit-calculator",a);
    const s=pitch/12;
    near(value(r,"Vertical rafter depth at same station")/Math.hypot(1,s),a.depth,1e-9);
    near(value(r,"Nominal roof-line drop"),36*s,1e-9);
    near(value(r,"Finished soffit reference drop"),36*s+a.depth*Math.hypot(1,s)+2,1e-9);
    near(r.rows.at(-1).soffitFaceDrop,value(r,"Finished soffit reference drop"),1e-7);
    assert.equal(r.marks.length,2);
  }
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

test("Single-plane roof sheathing conserves area, counts cuts and rotates sheets",()=>{
  const a={width:144,length:120,pitch:6,sheetWidth:48,sheetLength:96,waste:10,orientation:0};
  const r=compute("roof-sheathing-calculator",a);
  assert.equal(r.shape,"sheathing-panels");
  near(value(r,"Sheet geometric lower bound"),5);
  near(value(r,"Sheet positions (no offcut reuse)"),8);
  near(value(r,"Order sheets with allowance"),9);
  near(r.roofSheets.reduce((sum,s)=>sum+s.cutAreaSqIn,0),r.roofEave*r.roofSlope,1e-5);
  for(const s of r.roofSheets){
    assert.ok(s.cutAlong>0&&s.cutAlong<=96+1e-6);
    assert.ok(s.cutUphill>0&&s.cutUphill<=48+1e-6);
    assert.ok(s.eaveStart+s.cutAlong<=r.roofEave+1e-6);
    assert.ok(s.slopeStart+s.cutUphill<=r.roofSlope+1e-6);
  }
  const rotated=compute("roof-sheathing-calculator",{...a,orientation:1});
  near(value(rotated,"Sheet positions (no offcut reuse)"),6);
  near(value(rotated,"Sloped roof surface"),value(r,"Sloped roof surface"));
});
test("Single-plane sheathing edge cuts and invalid grid inputs are checked",()=>{
  const a={width:70,length:110,pitch:0,sheetWidth:48,sheetLength:96,waste:0,orientation:0};
  const r=compute("roof-sheathing-calculator",a);
  near(value(r,"Sheet positions (no offcut reuse)"),4);
  near(value(r,"Full sheets"),1);
  near(value(r,"Edge-cut sheets"),3);
  near(r.roofSheets.reduce((sum,s)=>sum+s.cutAreaSqIn,0),7700);
  assert.equal(safeCompute("roof-sheathing-calculator",{...a,orientation:3}).ok,false);
  assert.equal(safeCompute("roof-sheathing-calculator",{...a,sheetWidth:.001,sheetLength:.001}).ok,false);
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

test("Hip clipping area is conserved across 72 dimension, slope, orientation fixtures",()=>{
  for(const width of [72,96,144])for(const length of [132,196,252])
  for(const pitch of [0,2,6,11])for(const orientation of [0,1]){
    const a={width,length,pitch,overhang:6,sheetWidth:48,sheetLength:96,orientation};
    const r=compute("hip-roof-calculator",a);
    const expected=(width+12)*(length+12)*Math.hypot(1,pitch/12);
    const cutSum=r.roofPanels.reduce((sum,p)=>sum+p.cutAreaSqIn,0);
    near(cutSum,expected,Math.max(1e-5,expected*1e-9));
    near(value(r,"Whole sloped area")*144,expected,1e-6);
    assert.equal(r.rows.length,r.roofPanels.length);
    assert.ok(value(r,"Sheet positions (no offcut reuse)")>=value(r,"Sheet area lower bound"));
  }
});
