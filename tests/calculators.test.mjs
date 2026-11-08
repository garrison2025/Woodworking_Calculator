import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compute,safeCompute,convertToInches,convertFromInches,exactFramingStock} from "../src/calcs.mjs";
import {buildScheduleCsv} from "../src/cut-list.mjs";

const {tools}=JSON.parse(readFileSync(new URL("../src/tools.json",import.meta.url),"utf8"));
const published=tools.filter(t=>t.priority==="P0"||t.priority==="P1");
const held=tools.filter(t=>t.priority==="P2");
const defaults=t=>Object.fromEntries(t.inputs.map(x=>[x.key,x.value]));
const value=(result,label)=>{const item=result.metrics.find(m=>m.label===label);assert.ok(item,"Missing metric: "+label);return item.value};
const near=(actual,expected,tolerance=1e-3)=>assert.ok(Math.abs(actual-expected)<=tolerance,"Expected "+expected+", got "+actual);
test("Manifest has 9 P0, 22 P1 and zero held P2 routes",()=>{
  assert.equal(published.filter(t=>t.priority==="P0").length,9);
  assert.equal(published.filter(t=>t.priority==="P1").length,22);
  assert.equal(held.length,0);
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
  "fence-post-calculator":["Posts",14],
  "fence-picket-calculator":["Pickets",16],
  "gambrel-roof-calculator":["Ridge elevation above eave datum",84],
  "lumber-price-calculator":["Board feet per piece",4],
  "spiral-staircase-calculator":["Uniform riser height",7.2],
  "stave-calculator":["Plan half-miter reference",15]
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
    const a={length:120,holes:n,edge:e,diameter:d,boardWidth:d*1.2};
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
  const touching=compute("hole-spacing-calculator",{length:30,holes:3,edge:5,diameter:10,boardWidth:12});
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
test("maximum supported segmented bowl yields 18,000 ordered entries without missing ring endpoints",()=>{
  const r=compute("segmented-bowl-calculator",{outer:30,inner:22,segments:180,rings:100});
  assert.equal(r.rows.length,18000);
  assert.equal(r.rows[0].item,"Ring 1 / segment 1");
  assert.equal(r.rows[179].item,"Ring 1 / segment 180");
  assert.equal(r.rows[180].item,"Ring 2 / segment 1");
  assert.equal(r.rows.at(-1).item,"Ring 100 / segment 180");
  assert.equal(r.rows.at(-1).ring,100);
  assert.equal(r.rows.at(-1).segment,180);
  near(r.rows.at(-1).endAngle,360);
  near(value(r,"Total segments"),18000);
  for(const k of [0,179,180,8999,17999]){
    near(r.rows[k].outerChord,30*Math.sin(Math.PI/180),1e-7);
    near(r.rows[k].radialDepth,4);
  }
});
test("Wainscoting left/right face edges, gaps and symmetric margin close exactly",()=>{
  const a={wall:120,panels:5,margin:3,gap:2,height:36};
  const r=compute("wainscoting-calculator",a);
  const nearW=(x,y)=>assert.ok(Math.abs(x-y)<1e-7,`expected ${y}, got ${x}`);
  assert.equal(r.rows.length,5);
  for(const [i,p] of r.rows.entries()){
    const left=3+i*23.2,right=left+21.2;
    nearW(p.left,left);nearW(p.right,right);nearW(p.width,21.2);
    if(i<4){nearW(r.rows[i+1].left-p.right,2);nearW(p.gapAfter,2);}
    else assert.equal(p.gapAfter,null);
    assert.ok(p.right>p.left);
  }
  nearW(r.rows[0].left,3);
  nearW(120-r.rows.at(-1).right,3);
  nearW(r.rows.reduce((s,p)=>s+p.width+(p.gapAfter||0),6),120);
  nearW(value(r,"Total layout width"),120);
  nearW(value(r,"Total inter-panel gaps"),8);
  assert.deepEqual(r.panelRows,r.rows);
});
test("Wainscoting one panel, zero gaps, and extreme narrow faces keep honest coordinates",()=>{
  const nearW=(x,y)=>assert.ok(Math.abs(x-y)<1e-7,`expected ${y}, got ${x}`);
  const single=compute("wainscoting-calculator",{wall:100,panels:1,margin:5,gap:20,height:22});
  assert.equal(single.rows.length,1);
  assert.equal(single.rows[0].left,5);
  assert.equal(single.rows[0].right,95);
  assert.equal(single.rows[0].gapAfter,null);
  nearW(value(single,"Total inter-panel gaps"),0);
  const zero=compute("wainscoting-calculator",{wall:12,panels:4,margin:0,gap:0,height:18});
  for(let i=0;i<3;i++)nearW(zero.rows[i].right,zero.rows[i+1].left);
  const thin=compute("wainscoting-calculator",{wall:120,panels:400,margin:0,gap:0,height:18});
  assert.equal(thin.rows.length,400);
  nearW(thin.rows.at(-1).right,120);
  assert.ok(thin.rows.every(p=>p.width>0&&p.right>p.left));
  for(const input of [
    {wall:1,panels:1,margin:.5,gap:0,height:12},
    {wall:1,panels:1,margin:0.4999999995,gap:0,height:12},
    {wall:12,panels:4,margin:1,gap:4,height:12}
  ]){
    const out=safeCompute("wainscoting-calculator",input);
    assert.equal(out.ok,false);
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
  assert.equal(r.rows.length,5);
  assert.deepEqual(r.rows.map(p=>p.item),["Ridge reference","Bearing reference","Overhang end","Birdsmouth horizontal seat","Birdsmouth plumb heel"]);
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
  assert.deepEqual(r.rows.filter(x=>x.type==="King"||x.type==="Jack").map(x=>x.position),[29.75,31.25,68.75,70.25]);
  assert.equal(r.rows.filter(x=>x.item.startsWith("Regular")).some(x=>x.position>=29&&x.position<=71),false);
  assert.equal(new Set(r.rows.filter(x=>x.type==="King"||x.type==="Jack"||x.type==="Regular").map(x=>x.position)).size,value(r,"Regular studs")+value(r,"Opening-side reference members"));
  near(value(r,"Rough opening face area"),36*80/144);
});
test("Framing supports a second independently elevated window",()=>{
  const r=compute("framing-calculator",{length:160,spacing:16,width:1.5,wallHeight:108,studStockLength:120,openingStart:24,openingWidth:24,openingHeight:80,openingSill:0,opening2Start:88,opening2Width:24,opening2Height:42,opening2Sill:34});
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

test("Stud and Wall Stud use the same flat-wall centers and net lengths",()=>{
  const opts={length:120,spacing:16,studWidth:1.5,plates:4.5};
  const slope=compute("stud-calculator",{...opts,start:96,pitch:0});
  const wall=compute("wall-stud-calculator",{...opts,height:96});
  assert.deepEqual(slope.rows.map(r=>r.position),wall.rows.map(r=>r.position));
  assert.deepEqual(slope.rows.map(r=>r.length),wall.rows.map(r=>r.cutLength));
  assert.equal(wall.rows.length,9);
  for(let i=0;i<wall.rows.length;i++){
    near(slope.rows[i].grossHeight,96);
    near(slope.rows[i].length,91.5);
    near(slope.marks[i].topHeight,slope.rows[i].length);
    near(wall.marks[i].topHeight,wall.rows[i].cutLength);
  }
});

test("Rake Stud cut-list heights and drawing marks subtract total plates once",()=>{
  const r=compute("stud-calculator",{length:144,start:96,pitch:6,spacing:16,studWidth:1.5,plates:4.5});
  near(r.rows[0].grossHeight,96);
  near(r.rows[0].length,91.5);
  near(r.rows.at(-1).grossHeight,168);
  near(r.rows.at(-1).length,163.5);
  assert.equal(r.shape,"slope");
  assert.equal(r.rows.length,r.marks.length);
  for(let i=0;i<r.rows.length;i++){
    const row=r.rows[i],mark=r.marks[i];
    near(row.length,row.grossHeight-4.5,1e-7);
    near(row.topElevation-row.bottomElevation,row.length,1e-7);
    near(row.faceRight-row.faceLeft,1.5,1e-7);
    near(row.position,mark.x,1e-7);
    near(row.length,mark.cutLength,1e-7);
  }
  const m=compute("stud-calculator",{
    length:144/25.4*25.4,start:96,pitch:6,spacing:16,studWidth:1.5,plates:4.5
  });
  near(value(m,"Last cut length"),value(r,"Last cut length"));
});

test("Opening frame counts, center faces and plate-referenced cut rows match drawing",()=>{
  const a={length:120,spacing:16,width:1.5,wallHeight:96,bottomPlate:1.5,
    topPlate:3,openingStart:32,openingWidth:36,openingHeight:80,openingSill:0};
  const r=compute("framing-calculator",a);
  assert.equal(r.rows.length,13);
  assert.equal(r.rows.length,r.marks.length);
  near(value(r,"Header pieces (geometry only)"),1);
  near(value(r,"Window sills"),0);
  near(value(r,"Upper cripples"),2);
  near(value(r,"Lower cripples"),0);
  near(value(r,"Total listed pieces"),13);
  near(value(r,"Regular studs"),6);
  near(value(r,"Opening-side reference members"),4);
  near(value(r,"Regular and king cut length"),91.5);
  for(let i=0;i<r.rows.length;i++){
    const row=r.rows[i],mark=r.marks[i];
    near(row.position,(row.faceLeft+row.faceRight)/2,1e-7);
    if(row.orientation==="vertical")near(row.faceRight-row.faceLeft,1.5,1e-7);
    else near(row.faceRight-row.faceLeft,row.cutLength,1e-7);
    if(row.orientation==="vertical")near(row.topElevation-row.bottomElevation,row.cutLength,1e-7);
    else near(row.topElevation-row.bottomElevation,row.stockDepth,1e-7);
    near(row.position,mark.x,1e-7);
    near(row.cutLength,mark.cutLength,1e-7);
    near(row.topElevation,mark.topHeight,1e-7);
    near(row.bottomElevation,mark.bottomHeight,1e-7);
    if(row.type==="Jack")near(row.cutLength,78.5,1e-7);
    if(row.type==="Regular"||row.type==="King")near(row.cutLength,91.5,1e-7);
  }
  const plain=compute("wall-stud-calculator",{length:120,spacing:16,height:96,plates:4.5,studWidth:1.5});
  for(const row of r.rows.filter(x=>x.type==="Regular")){
    const corresponding=plain.rows.find(p=>p.position===row.position);
    assert.ok(corresponding);
    near(row.cutLength,corresponding.cutLength,1e-7);
  }
});

test("Framing excludes nominal studs that partially overlap side-member faces",()=>{
  const r=compute("framing-calculator",{length:120,spacing:14,width:1.5,wallHeight:96,
    bottomPlate:1.5,topPlate:3,openingStart:31.2,openingWidth:28,openingHeight:80,openingSill:0});
  assert.equal(r.rows.some(row=>row.type==="Regular"&&row.position===28),false);
  const base=r.rows.filter(row=>["Regular","King","Jack"].includes(row.type));
  for(let i=1;i<base.length;i++)
    assert.ok(base[i].faceLeft>=base[i-1].faceRight-1e-7,
      "Overlapping full-height faces at "+base[i-1].item+" / "+base[i].item);
});

test("Mandatory far-end stud center cannot overlap last OC member",()=>{
  for(const slug of ["stud-calculator","wall-stud-calculator"]){
    const a={length:113,spacing:16,studWidth:1.5,plates:4.5,start:96,pitch:0,height:96};
    const r=compute(slug,a);
    assert.ok(!r.rows.some(row=>row.position===112));
    assert.equal(r.rows.at(-1).position,113);
    for(let i=1;i<r.rows.length;i++)
      assert.ok(r.rows[i].position-r.rows[i-1].position>=1.5-1e-7);
  }
  assert.equal(safeCompute("wall-stud-calculator",{length:120,spacing:1,height:96,plates:4.5,studWidth:1.5}).ok,false);
});

test("Framing plate thickness and impossible jack net lengths fail visibly",()=>{
  const a={length:120,spacing:16,width:1.5,wallHeight:96,openingStart:32,
    openingWidth:36,openingHeight:80,openingSill:0};
  assert.equal(safeCompute("framing-calculator",{...a,bottomPlate:95,topPlate:3}).ok,false);
  assert.equal(safeCompute("framing-calculator",{...a,bottomPlate:1.5,openingHeight:1}).ok,false);
  const r=compute("framing-calculator",{...a,bottomPlate:2,topPlate:2});
  near(value(r,"Regular and king cut length"),92);
  near(r.rows.find(row=>row.type==="Jack").cutLength,78);
});

test("Rake-wall stud profile conserves left/center/right top-cut elevations",()=>{
  const a={length:144,start:96,pitch:6,spacing:16,studWidth:1.5,plates:4.5};
  const r=compute("stud-calculator",a);
  near(r.rows[0].leftEdgeCut,91.125,1e-7);
  near(r.rows[0].rightEdgeCut,91.875,1e-7);
  near(r.rows.at(-1).leftEdgeCut,163.125,1e-7);
  near(r.rows.at(-1).rightEdgeCut,163.875,1e-7);
  for(const row of r.rows){
    near((row.leftEdgeCut+row.rightEdgeCut)/2,row.length,1e-7);
    near(row.rightEdgeCut-row.leftEdgeCut,a.studWidth*a.pitch/12,1e-7);
    near(row.leftEdgeCut,a.start+row.faceLeft*a.pitch/12-a.plates,1e-7);
    near(row.rightEdgeCut,a.start+row.faceRight*a.pitch/12-a.plates,1e-7);
  }
  const flat=compute("stud-calculator",{...a,pitch:0});
  assert.ok(flat.rows.every(row=>row.leftEdgeCut===row.length&&row.rightEdgeCut===row.length));
  const shallow={...a,length:16,start:2,pitch:12,plates:1,studWidth:4};
  assert.equal(safeCompute("stud-calculator",shallow).ok,false);
});

test("Framing header and cripple positions close exactly to opening and plate datums",()=>{
  const a={length:120,spacing:16,width:1.5,wallHeight:96,bottomPlate:1.5,topPlate:3,
    headerDepth:5.5,sillThickness:1.5,openingStart:32,openingWidth:36,
    openingHeight:80,openingSill:0};
  const r=compute("framing-calculator",a);
  const header=r.rows.filter(x=>x.type==="Header");
  const upper=r.rows.filter(x=>x.type==="Upper cripple");
  assert.equal(header.length,1);
  assert.equal(upper.length,2);
  assert.deepEqual(upper.map(x=>x.position),[48,64]);
  assert.deepEqual([header[0].faceLeft,header[0].faceRight],[30.5,69.5]);
  near(header[0].cutLength,39);
  near(header[0].bottomElevation,80);
  near(header[0].topElevation,85.5);
  for(const member of upper){
    near(member.bottomElevation,header[0].topElevation);
    near(member.topElevation,a.wallHeight-a.topPlate);
    near(member.cutLength,7.5);
    assert.ok(member.faceLeft>=a.openingStart&&member.faceRight<=a.openingStart+a.openingWidth);
  }
  assert.equal(r.rows.filter(x=>x.type==="Sill").length,0);
  assert.equal(value(r,"Total listed pieces"),r.rows.length);
  assert.deepEqual(r.rows.map(x=>x.item),r.marks.map(x=>x.label));
});

test("Windows generate sill, lower and upper cripples with no overlap into clear opening",()=>{
  const a={length:160,spacing:16,width:1.5,wallHeight:108,studStockLength:120,
    bottomPlate:1.5,topPlate:3,headerDepth:5.5,sillThickness:1.5,
    openingStart:24,openingWidth:24,openingHeight:80,openingSill:0,
    opening2Start:88,opening2Width:24,opening2Height:42,opening2Sill:34};
  const r=compute("framing-calculator",a);
  const windowRows=r.rows.filter(x=>x.item.startsWith("Opening 2"));
  const h=windowRows.find(x=>x.type==="Header"),s=windowRows.find(x=>x.type==="Sill");
  const upper=windowRows.filter(x=>x.type==="Upper cripple"),
    lower=windowRows.filter(x=>x.type==="Lower cripple");
  assert.ok(h&&s);
  assert.deepEqual([h.faceLeft,h.faceRight,h.bottomElevation,h.topElevation],[86.5,113.5,76,81.5]);
  assert.deepEqual([s.faceLeft,s.faceRight,s.bottomElevation,s.topElevation],[88,112,32.5,34]);
  near(h.cutLength,27);near(s.cutLength,24);
  assert.deepEqual(upper.map(x=>x.position),[96]);
  assert.deepEqual(lower.map(x=>x.position),[96]);
  near(upper[0].cutLength,23.5);
  near(lower[0].cutLength,31);
  for(const member of lower){
    near(member.topElevation,s.bottomElevation);
    assert.ok(member.faceLeft>=88&&member.faceRight<=112);
  }
  for(const member of upper)near(member.bottomElevation,h.topElevation);
  near(value(r,"Header pieces (geometry only)"),2);
  near(value(r,"Window sills"),1);
  near(value(r,"Lower cripples"),1);
  assert.equal(value(r,"Total listed pieces"),r.rows.length);
});

test("Framing header and sill invalid reference geometry is rejected safely",()=>{
  const a={length:120,spacing:16,width:1.5,wallHeight:96,
    openingStart:32,openingWidth:36,openingHeight:80,openingSill:0};
  for(const override of [
    {headerDepth:14},
    {headerDepth:0},
    {sillThickness:0},
    {openingSill:3,openingHeight:40,sillThickness:2},
    {openingSill:20,openingHeight:73},
    {opening2Start:82,opening2Width:20,opening2Height:40,opening2Sill:2}
  ])assert.equal(safeCompute("framing-calculator",{...a,...override}).ok,false,
    "Unexpectedly allowed "+JSON.stringify(override));
});

test("Header and cripple geometry conserves vertical free space under zero-height zones",()=>{
  const a={length:120,spacing:16,width:1.5,wallHeight:96,topPlate:3,
    bottomPlate:1.5,headerDepth:5.5,sillThickness:1.5,
    openingStart:32,openingWidth:36,openingSill:0,openingHeight:87.5};
  const r=compute("framing-calculator",a);
  assert.equal(r.rows.filter(x=>x.type==="Upper cripple").length,0);
  near(r.rows.find(x=>x.type==="Header").topElevation,93);
  assert.equal(value(r,"Upper cripples"),0);
  assert.ok(r.rows.every(x=>x.cutLength>0));
});

test("Framing stock takeoff conserves every member, kerf and remaining stick length",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator");
  const r=compute("framing-calculator",defaults(t));
  near(value(r,"Installed member linear length"),943/12,1e-7);
  near(value(r,"Planned stock sticks (FFD estimate)"),11);
  near(value(r,"Purchase sticks incl. allowance"),11);
  near(value(r,"Planned stock offcut length"),112.75/12,1e-7);
  near(value(r,"Planned saw kerf loss"),0.25);
  assert.equal(r.stockPlan.length,11);
  assert.equal(r.stockCuts.length,r.rows.length);
  assert.equal(r.materialSummary.length,3);
  const [stud,header,sill]=r.materialSummary;
  assert.deepEqual([stud.stockGroup,stud.pieces,stud.cutLength,stud.plannedSticks,stud.purchaseSticks],
    ["Stud",12,904,10,10]);
  assert.deepEqual([header.stockGroup,header.pieces,header.cutLength,header.plannedSticks],
    ["Header",1,39,1]);
  assert.deepEqual([sill.stockGroup,sill.pieces,sill.plannedSticks,sill.purchaseSticks],
    ["Sill",0,0,0]);
  assert.deepEqual(r.stockCuts.map(x=>x.item).sort(),r.rows.map(x=>x.item).sort());
  for(const bar of r.stockPlan){
    assert.ok(bar.cuts.length>0);
    near(bar.cuts.reduce((s,p)=>s+p.cutLength,0),bar.piecesLength,1e-7);
    near(bar.piecesLength+bar.kerfLoss+bar.offcutLength,bar.stockLength,1e-7);
    near(bar.kerfLoss,(bar.cuts.length-1)*.125,1e-7);
    assert.ok(bar.offcutLength>=0);
  }
  const stockIds=new Set(r.stockPlan.map(b=>b.stockId));
  assert.equal(stockIds.size,r.stockPlan.length);
  assert.ok(r.stockCuts.every(row=>stockIds.has(row.stockId)));
});

test("Kerf is charged between adjacent cuts, changing a borderline exact packing",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const noKerf=compute("framing-calculator",{...base,studStockLength:183,stockKerf:0});
  const withKerf=compute("framing-calculator",{...base,studStockLength:183,stockKerf:0.125});
  assert.equal(noKerf.materialSummary[0].plannedSticks,5);
  assert.equal(withKerf.materialSummary[0].plannedSticks,8);
  assert.equal(noKerf.materialSummary[0].kerfLoss,0);
  assert.ok(withKerf.materialSummary[0].kerfLoss>0);
  assert.ok(noKerf.stockPlan.filter(b=>b.stockGroup==="Stud").some(b=>b.cuts.length===2&&
    b.cuts.every(p=>p.cutLength===91.5)));
  assert.ok(withKerf.stockPlan.filter(b=>b.stockGroup==="Stud").every(b=>
    !(b.cuts.length===2&&b.cuts.every(p=>p.cutLength===91.5))));
});

test("Framing allowance adds whole purchase sticks per used material family only",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const r=compute("framing-calculator",{...base,stockWaste:10});
  assert.deepEqual(r.materialSummary.map(x=>[x.stockGroup,x.plannedSticks,x.purchaseSticks,x.allowanceSticks]),
    [["Stud",10,11,1],["Header",1,2,1],["Sill",0,0,0]]);
  near(value(r,"Purchase sticks incl. allowance"),13);
  near(value(r,"Planned stock sticks (FFD estimate)"),11);
  assert.equal(r.stockPlan.length,11,"Reserve sticks must not masquerade as loaded cuts");
});

test("Different stock profiles never cross-pack, including window sill stock",()=>{
  const a={length:160,spacing:16,width:1.5,wallHeight:108,bottomPlate:1.5,topPlate:3,
    headerDepth:5.5,sillThickness:1.5,openingStart:24,openingWidth:24,openingHeight:80,
    openingSill:0,opening2Start:88,opening2Width:24,opening2Height:42,opening2Sill:34,
    studStockLength:120,headerStockLength:36,sillStockLength:25,stockKerf:.125,stockWaste:0};
  const r=compute("framing-calculator",a);
  assert.deepEqual(r.materialSummary.map(x=>x.stockGroup),["Stud","Header","Sill"]);
  const groups={Stud:["Regular","King","Jack","Upper cripple","Lower cripple"],
    Header:["Header"],Sill:["Sill"]};
  for(const row of r.stockCuts)
    assert.ok(groups[row.stockGroup].includes(row.type),
      "Cross-profile cut: "+row.stockGroup+" / "+row.type);
  for(const bar of r.stockPlan)assert.ok(bar.usedLength<=bar.stockLength+1e-8);
  assert.equal(r.materialSummary.find(x=>x.stockGroup==="Header").pieces,2);
  assert.equal(r.materialSummary.find(x=>x.stockGroup==="Sill").pieces,1);
  assert.equal(r.stockCuts.length,r.rows.length);
  assert.deepEqual(r.stockCuts.filter(x=>x.stockGroup==="Sill").map(x=>x.cutLength),[24]);
});

test("Rejects cuts too long for stock, impossible kerf and excess reserve percent",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  for(const override of [
    {studStockLength:91.4},{headerStockLength:38.9},
    {studStockLength:0},{sillStockLength:0},
    {stockKerf:-.1},{stockKerf:96},{stockWaste:-1},{stockWaste:100.1}
  ]){
    const r=safeCompute("framing-calculator",{...base,...override});
    assert.equal(r.ok,false,"Unexpected stock allocation: "+JSON.stringify(override));
  }
  const noKerf=compute("framing-calculator",{...base,stockKerf:0});
  assert.equal(noKerf.materialSummary[0].kerfLoss,0);
  assert.equal(noKerf.stockCuts.length,noKerf.rows.length);
});


test("Framing zero price means missing quote, not free material",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator");
  const r=compute("framing-calculator",defaults(t));
  assert.deepEqual(r.costSummary.unpricedGroups,["Stud","Header"]);
  assert.equal(r.costSummary.allPricesEntered,false);
  assert.equal(r.costSummary.requiredGroups,2);
  assert.equal(r.costSummary.pricedGroups,0);
  assert.equal(r.costSummary.quotedSubtotal,0);
  assert.equal(r.materialSummary[0].unitPrice,null);
  assert.equal(r.materialSummary[0].purchaseCost,null);
  assert.equal(r.materialSummary[2].unitPrice,null);
  assert.equal(r.materialSummary[2].purchaseCost,0);
  assert.equal(r.metrics.some(m=>m.label==="Quoted purchase total"),false);
  near(value(r,"Material families awaiting quotes"),2);
});

test("Complete supplier quotes reconcile planned purchase and reserve costs",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const r=compute("framing-calculator",{...base,studUnitPrice:5.5,
    headerUnitPrice:14.25,sillUnitPrice:0});
  assert.equal(r.costSummary.allPricesEntered,true);
  assert.deepEqual(r.costSummary.unpricedGroups,[]);
  near(r.costSummary.quotedPlanned,69.25,1e-7);
  near(r.costSummary.quotedReserve,0,1e-7);
  near(r.costSummary.quotedSubtotal,69.25,1e-7);
  near(value(r,"Quoted purchase total"),69.25,1e-7);
  near(value(r,"Material families awaiting quotes"),0);
  assert.deepEqual(r.materialSummary.slice(0,2).map(s=>s.purchaseCost),[55,14.25]);
  const withReserve=compute("framing-calculator",{...base,studUnitPrice:5.5,
    headerUnitPrice:14.25,stockWaste:10});
  near(withReserve.costSummary.quotedPlanned,69.25,1e-7);
  near(withReserve.costSummary.quotedReserve,19.75,1e-7);
  near(withReserve.costSummary.quotedSubtotal,89,1e-7);
  near(value(withReserve,"Quoted reserve cost"),19.75,1e-7);
  assert.deepEqual(withReserve.materialSummary.map(s=>s.purchaseSticks),[11,2,0]);
  for(const row of withReserve.materialSummary){
    near((row.plannedCost??0)+(row.allowanceCost??0),row.purchaseCost??0,1e-7);
  }
});

test("Partial framing quote only reports a labeled subtotal, never a total",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const r=compute("framing-calculator",{...base,studUnitPrice:7.25,headerUnitPrice:0});
  assert.deepEqual(r.costSummary.unpricedGroups,["Header"]);
  assert.equal(r.costSummary.allPricesEntered,false);
  near(r.costSummary.quotedSubtotal,72.5);
  assert.equal(r.materialSummary[1].purchaseCost,null);
  assert.equal(r.metrics.some(m=>m.label==="Quoted purchase total"),false);
});

test("Second opening activates a separately quoted sill cost without mixing stock families",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const r=compute("framing-calculator",{...base,opening2Start:82,
    opening2Width:18,opening2Sill:32,opening2Height:40,
    studUnitPrice:8,headerUnitPrice:12,sillUnitPrice:4,stockWaste:10});
  assert.equal(r.costSummary.allPricesEntered,true);
  assert.equal(r.costSummary.requiredGroups,3);
  const sill=r.materialSummary.find(x=>x.stockGroup==="Sill");
  assert.equal(sill.pieces,1);
  assert.equal(sill.unitPrice,4);
  assert.ok(sill.purchaseSticks>=1);
  assert.equal(sill.purchaseCost,sill.purchaseSticks*4);
  const sum=r.materialSummary.reduce((s,row)=>s+(row.purchaseCost??0),0);
  near(sum,r.costSummary.quotedSubtotal);
  for(const g of r.materialSummary)
    assert.ok(g.quoted&&g.purchaseCost===g.purchaseSticks*g.unitPrice);
});

test("Framing price quotes reject negative or implausibly large per-stick numbers",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  for(const q of [
    {studUnitPrice:-0.01},{headerUnitPrice:-1},{sillUnitPrice:-3},
    {studUnitPrice:1e6+1},{headerUnitPrice:1e6+1},{sillUnitPrice:1e6+1}
  ])assert.equal(safeCompute("framing-calculator",{...base,...q}).ok,false,JSON.stringify(q));
  assert.equal(safeCompute("framing-calculator",{...base,studUnitPrice:0,headerUnitPrice:0}).ok,true);
});


test("Unquoted 10ft/12ft offers preserve all legacy single-stock outputs",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const current=compute("framing-calculator",base);
  const legacy=compute("framing-calculator",{...base,
    studAltUnitPrice:0,studAlt2UnitPrice:0,
    headerAltUnitPrice:0,headerAlt2UnitPrice:0,
    sillAltUnitPrice:0,sillAlt2UnitPrice:0});
  near(value(current,"Planned stock sticks (FFD estimate)"),11);
  assert.equal(current.stockPlan.length,legacy.stockPlan.length);
  assert.deepEqual(current.materialSummary,legacy.materialSummary);
  assert.equal(current.stockComparisons.filter(p=>p.stockGroup==="Stud").length,1);
  assert.equal(current.stockComparisons.filter(p=>p.stockGroup==="Header").length,1);
  assert.equal(current.purchaseVariants.filter(p=>p.purchaseSticks>0).length,2);
  assert.equal(current.stockCuts.length,13);
  assert.ok(current.stockCuts.every(p=>p.stockLength===96&&p.offerLabel==="Base"));
  assert.equal(current.costSummary.allPricesEntered,false);
});

test("Multi-length framing quote comparison selects cheaper mixed-stick plan",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const a={...base,wallHeight:80,openingHeight:60,studUnitPrice:8,
    studAltUnitPrice:8.2,studAlt2UnitPrice:8.5,headerUnitPrice:12};
  const result=compute("framing-calculator",a);
  assert.equal(result.costSummary.allPricesEntered,true);
  const stu=result.materialSummary.find(r=>r.stockGroup==="Stud");
  assert.equal(stu.mixedLengths,true);
  assert.equal(stu.stockLength,null);
  assert.equal(stu.unitPrice,null);
  assert.equal(stu.plannedSticks,8);
  near(stu.purchaseCost,65);
  near(result.costSummary.quotedSubtotal,77);
  assert.deepEqual(result.purchaseVariants.filter(x=>x.stockGroup==="Stud")
    .map(r=>[r.offerLabel,r.stockLength,r.purchaseSticks,r.unitPrice]),[
      ["Base",96,6,8],["Alternative 2",144,2,8.5]
    ]);
  const comp=result.stockComparisons.filter(r=>r.stockGroup==="Stud");
  assert.equal(comp.length,5);
  const names=comp.map(r=>r.planLabel);
  assert.ok(names.includes("Single length · Base"));
  assert.ok(names.includes("Single length · Alternative 1"));
  assert.ok(names.includes("Single length · Alternative 2"));
  const chosen=comp.find(r=>r.selected);
  assert.ok(chosen);
  assert.equal(chosen.planLabel,"Exhaustive small-layout plan");
  assert.equal(result.optimizerStatus.find(x=>x.stockGroup==="Stud").certified,true);
  assert.equal(result.costSummary.allGroupsCertified,true);
  near(chosen.purchaseCost,65);
  near(comp.find(r=>r.planLabel==="Greedy mixed lengths").purchaseCost,65.2);
  near(comp.find(r=>r.planLabel==="Single length · Base").purchaseCost,80);
  near(comp.find(r=>r.planLabel==="Single length · Alternative 1").purchaseCost,73.8);
  near(comp.find(r=>r.planLabel==="Single length · Alternative 2").purchaseCost,68);
  assert.equal(result.stockCuts.length,result.rows.length);
  assert.deepEqual(result.stockCuts.map(r=>r.item).sort(),
    result.rows.map(r=>r.item).sort());
  assert.equal(new Set(result.stockPlan.filter(b=>b.stockGroup==="Stud")
    .map(b=>b.stockLength)).size,2);
  for(const bar of result.stockPlan)
    near(bar.piecesLength+bar.kerfLoss+bar.offcutLength,bar.stockLength,1e-7);
});

test("Reserve-aware multi-length selection recomputes by chosen offered size",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const without=compute("framing-calculator",{...base,wallHeight:80,
    openingHeight:60,studUnitPrice:8,studAltUnitPrice:8.2,
    studAlt2UnitPrice:8.5,headerUnitPrice:12,stockWaste:0});
  const reserve=compute("framing-calculator",{...base,wallHeight:80,
    openingHeight:60,studUnitPrice:8,studAltUnitPrice:8.2,
    studAlt2UnitPrice:8.5,headerUnitPrice:12,stockWaste:10});
  assert.equal(without.materialSummary[0].mixedLengths,true);
  assert.equal(reserve.materialSummary[0].mixedLengths,false);
  assert.equal(reserve.materialSummary[0].stockLength,144);
  assert.equal(reserve.materialSummary[0].plannedSticks,8);
  assert.equal(reserve.materialSummary[0].purchaseSticks,9);
  near(reserve.materialSummary[0].purchaseCost,76.5);
  near(reserve.costSummary.quotedSubtotal,100.5);
  near(reserve.costSummary.quotedPlanned,80);
  near(reserve.costSummary.quotedReserve,20.5);
  assert.deepEqual(reserve.purchaseVariants.filter(p=>p.purchaseSticks>0)
    .map(p=>[p.stockGroup,p.stockLength,p.purchaseSticks]),
    [["Stud",144,9],["Header",96,2]]);
});

test("Longer quoted alternative can satisfy a member that cannot fit base stock",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),a={...defaults(t),wallHeight:108};
  assert.equal(safeCompute("framing-calculator",a).ok,false);
  const result=compute("framing-calculator",{...a,studAltUnitPrice:11,
    headerUnitPrice:15});
  assert.equal(result.costSummary.allPricesEntered,true);
  const s=result.materialSummary[0];
  assert.equal(s.stockLength,120);
  assert.equal(s.mixedLengths,false);
  assert.ok(result.stockPlan.filter(x=>x.stockGroup==="Stud")
    .every(x=>x.stockLength===120));
  assert.ok(result.stockCuts.every(x=>x.cutLength<=x.stockLength));
});

test("Mixed-size purchase variants conserve quoted costs and do not cross material families",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator");
  const r=compute("framing-calculator",{...defaults(t),wallHeight:80,openingHeight:60,
    studUnitPrice:8,studAltUnitPrice:8.2,studAlt2UnitPrice:8.5,
    headerUnitPrice:12,opening2Start:82,opening2Width:18,opening2Height:36,
    opening2Sill:28,sillUnitPrice:5});
  for(const group of r.materialSummary){
    const variants=r.purchaseVariants.filter(x=>x.stockGroup===group.stockGroup);
    const cost=variants.reduce((s,v)=>s+(v.purchaseCost??0),0);
    near(cost,group.purchaseCost??0);
    assert.equal(variants.reduce((s,v)=>s+v.plannedSticks,0),group.plannedSticks);
    assert.equal(variants.reduce((s,v)=>s+v.purchaseSticks,0),group.purchaseSticks);
    assert.equal(variants.reduce((s,v)=>s+v.allowanceSticks,0),group.allowanceSticks);
  }
  assert.ok(r.stockPlan.some(x=>x.stockGroup==="Sill"));
  assert.equal(new Set(r.stockCuts.map(x=>x.item)).size,r.rows.length);
  assert.ok(r.stockPlan.every(x=>x.cuts.every(piece=>
    (x.stockGroup==="Stud"&&!["Header","Sill"].includes(piece.type))||
    x.stockGroup===piece.type)));
  near(r.stockPlan.reduce((s,b)=>s+b.stockLength,0),
    r.stockPlan.reduce((s,b)=>s+b.piecesLength+b.kerfLoss+b.offcutLength,0),1e-7);
});

test("Alternative supplier offer prices and lengths enforce safe boundaries",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  for(const changes of [
    {studAltUnitPrice:-1},{headerAlt2UnitPrice:-1},{sillAltUnitPrice:-1},
    {studAlt2UnitPrice:1e6+1},{studAltUnitPrice:5.555},
    {headerAltStockLength:0,headerAltUnitPrice:6},
    {studAltStockLength:0,studAltUnitPrice:4},
    {sillAlt2StockLength:0,sillAlt2UnitPrice:5}
  ]){
    assert.equal(safeCompute("framing-calculator",{...base,...changes}).ok,
      false,"Should reject "+JSON.stringify(changes));
  }
  const partial=compute("framing-calculator",{...base,studUnitPrice:0,
    studAltUnitPrice:11,headerUnitPrice:0});
  assert.deepEqual(partial.costSummary.unpricedGroups,["Header"]);
  assert.equal(partial.metrics.some(m=>m.label==="Quoted purchase total"),false);
  assert.equal(partial.stockPlan.filter(p=>p.stockGroup==="Stud")[0].offerLabel,
    "Alternative 1");
});


test("Small fully quoted wall gets per-family exhaustive search certificates",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator");
  const a={...defaults(t),length:64,openingStart:16,openingWidth:24,
    wallHeight:80,openingHeight:60,studUnitPrice:8,headerUnitPrice:12};
  const r=compute("framing-calculator",a);
  assert.equal(r.materialSummary[0].pieces,8);
  assert.equal(r.costSummary.allPricesEntered,true);
  assert.equal(r.optimizerStatus.length,3);
  assert.deepEqual(r.optimizerStatus.map(s=>s.status),
    ["proved","proved","not-required"]);
  assert.deepEqual(r.optimizerStatus.map(s=>s.certified),
    [true,true,false]);
  assert.equal(r.costSummary.certifiedGroups,2);
  assert.equal(r.costSummary.allGroupsCertified,true);
  near(value(r,"Proven optimal material families"),2);
  assert.ok(r.optimizerStatus[0].nodes>0);
  assert.equal(r.optimizerStatus[0].maxPieces,16);
  assert.equal(r.optimizerStatus[0].limit,40000);
  assert.equal(r.stockComparisons.filter(s=>s.planLabel==="Exhaustive small-layout plan").length,2);
  assert.ok(r.stockComparisons.filter(s=>s.selected).every(s=>
    s.planLabel==="Exhaustive small-layout plan"||s.planLabel==="No material required"));
  for(const bar of r.stockPlan)near(bar.stockLength,
    bar.piecesLength+bar.kerfLoss+bar.offcutLength,1e-7);
});
test("Large priced wall remains explicitly uncertified even if header is proved",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),a={
    ...defaults(t),length:240,studUnitPrice:5.5,headerUnitPrice:14.25
  };
  const r=compute("framing-calculator",a);
  const stud=r.optimizerStatus.find(s=>s.stockGroup==="Stud");
  assert.equal(stud.status,"size-limit");
  assert.equal(stud.nodes,0);
  assert.equal(stud.certified,false);
  assert.ok(stud.pieceCount>16);
  assert.equal(r.optimizerStatus.find(s=>s.stockGroup==="Header").status,"proved");
  assert.equal(r.costSummary.certifiedGroups,1);
  assert.equal(r.costSummary.allGroupsCertified,false);
  assert.ok(value(r,"Quoted purchase total")>69.25);
  near(value(r,"Proven optimal material families"),1);
});
test("Small wall with incomplete header quote never claims all materials optimal",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator");
  const r=compute("framing-calculator",{...defaults(t),length:64,
    openingStart:16,openingWidth:24,wallHeight:80,openingHeight:60,
    studUnitPrice:8,headerUnitPrice:0});
  assert.equal(r.optimizerStatus[0].status,"proved");
  assert.equal(r.optimizerStatus[1].status,"quote-needed");
  assert.equal(r.costSummary.allPricesEntered,false);
  assert.equal(r.costSummary.allGroupsCertified,false);
  assert.equal(r.metrics.some(m=>m.label==="Quoted purchase total"),false);
});
test("Independent brute-force partition checks exact solver's cost including reserve and kerf",()=>{
  const pieces=[6.5,5.5,4.1,3.4].map((length,i)=>({
    item:"Piece "+i,cutLength:length
  }));
  const offers=[
    {code:"BASE",label:"Base",stockLength:10,unitPrice:5.5},
    {code:"ALT1",label:"Alternative 1",stockLength:12,unitPrice:6.2},
    {code:"ALT2",label:"Alternative 2",stockLength:14,unitPrice:7}
  ];
  for(const waste of [0,10,25]){
    for(const kerf of [0,.125]){
      // A deliberately poor but FEASIBLE incumbent: one 10-in stick per piece.
      const baseCount=Math.ceil(pieces.length*(1+waste/100)-1e-10);
      const seed={bars:pieces.map(p=>({offer:offers[0],cuts:[p],used:p.cutLength})),
        purchaseCost:baseCount*offers[0].unitPrice,purchaseCount:baseCount};
      const exact=exactFramingStock(pieces,offers,kerf,waste,seed);
      assert.equal(exact.status,"proved");
      assert.equal(exact.certified,true);
      assert.ok(exact.nodes>0&&exact.nodes<=40000);
      // Separate deliberately simple, unconstrained exhaustive oracle.
      let oracle=Infinity;
      const brute=(index,bars)=>{
        if(index===pieces.length){
          const counts=offers.map(o=>bars.filter(b=>b.offer===o).length);
          const cents=counts.reduce((sum,n,i)=>
            sum+Math.ceil(n*(1+waste/100)-1e-10)*
              Math.round(offers[i].unitPrice*100),0);
          oracle=Math.min(oracle,cents);
          return;
        }
        const p=pieces[index];
        for(const bar of bars){
          const add=p.cutLength+(bar.cuts.length?kerf:0);
          if(bar.used+add>bar.offer.stockLength+1e-8)continue;
          bar.used+=add;bar.cuts.push(p);
          brute(index+1,bars);
          bar.cuts.pop();bar.used-=add;
        }
        for(const offer of offers){
          if(p.cutLength>offer.stockLength)continue;
          bars.push({offer,used:p.cutLength,cuts:[p]});
          brute(index+1,bars);
          bars.pop();
        }
      };
      brute(0,[]);
      const counts=offers.map(o=>
        exact.candidate.bars.filter(b=>b.offer.code===o.code).length);
      const exactCents=counts.reduce((sum,n,i)=>
        sum+Math.ceil(n*(1+waste/100)-1e-10)*
          Math.round(offers[i].unitPrice*100),0);
      assert.equal(exactCents,oracle,"Independent oracle disagrees for "+JSON.stringify({waste,kerf}));
      assert.equal(exact.candidate.bars.reduce((s,b)=>s+b.cuts.length,0),pieces.length);
      for(const b of exact.candidate.bars){
        const piecesLength=b.cuts.reduce((s,p)=>s+p.cutLength,0);
        const used=piecesLength+(b.cuts.length-1)*kerf;
        assert.ok(used<=b.offer.stockLength+1e-8);
        near(used,b.used,1e-7);
      }
    }
  }
});
test("Exact solver's node and size caps never issue a false proof",()=>{
  const pieces=[6,4,4].map((cutLength,i)=>({item:"Cut "+i,cutLength}));
  const offer={code:"BASE",label:"Base",stockLength:10,unitPrice:6};
  const seed={bars:pieces.map(p=>({offer,used:p.cutLength,cuts:[p]})),
    purchaseCount:3,purchaseCost:18};
  const cutoff=exactFramingStock(pieces,[offer],.125,0,seed,{nodeLimit:1});
  assert.equal(cutoff.status,"node-limit");
  assert.equal(cutoff.certified,false);
  assert.equal(cutoff.nodes,1);
  assert.ok(cutoff.candidate);
  const noQuotes=exactFramingStock(pieces,[],.125,0,seed);
  assert.equal(noQuotes.status,"quote-needed");
  assert.equal(noQuotes.certified,false);
  const overSize=exactFramingStock(Array.from({length:17},(_,i)=>({
    item:"n"+i,cutLength:1
  })),[offer],.125,0,seed);
  assert.equal(overSize.status,"size-limit");
  assert.equal(overSize.certified,false);
  assert.equal(overSize.nodes,0);
  const empty=exactFramingStock([],[offer],.125,0,seed);
  assert.equal(empty.status,"not-required");
  assert.equal(empty.certified,false);
});


test("Memoized exact solver proves 16 identical cuts without expanding all equivalent permutations",()=>{
  const pieces=Array.from({length:16},(_,i)=>({item:"Identical "+i,cutLength:1}));
  const offer={code:"BASE",label:"Base",stockLength:4,unitPrice:5};
  const seed={bars:pieces.map(p=>({offer,used:p.cutLength,cuts:[p]})),purchaseCost:80,purchaseCount:16};
  const exact=exactFramingStock(pieces,[offer],0,0,seed);
  assert.equal(exact.status,"proved");
  assert.equal(exact.certified,true);
  assert.equal(exact.maxPieces,16);
  assert.ok(exact.nodes>0&&exact.nodes<=exact.nodeLimit,exact.nodes);
  assert.ok(exact.memoHits>0,"Repeated equivalent partial stock plans must be merged");
  const bars=exact.candidate.bars;
  assert.equal(bars.length,4);
  assert.equal(bars.reduce((s,b)=>s+b.cuts.length,0),16);
  for(const bar of bars){
    assert.equal(bar.cuts.length,4);
    assert.equal(bar.used,4);
    assert.equal(bar.offer.stockLength,4);
  }
});

test("One-offer 12-member default framing is now certifiable without extra API or stock cost",()=>{
  const t=tools.find(t=>t.slug==="framing-calculator"),base=defaults(t);
  const data=compute("framing-calculator",{...base,studUnitPrice:5.5,headerUnitPrice:14.25});
  assert.equal(data.materialSummary[0].pieces,12);
  const stud=data.optimizerStatus[0];
  assert.equal(stud.maxPieces,16);
  assert.equal(stud.status,"proved");
  assert.equal(stud.certified,true);
  assert.ok(stud.nodes<=stud.limit);
  assert.equal(data.costSummary.allGroupsCertified,true);
  assert.equal(data.costSummary.certifiedGroups,2);
  near(value(data,"Quoted purchase total"),69.25);
  assert.equal(data.stockCuts.length,data.rows.length);
  assert.deepEqual(data.stockCuts.map(x=>x.item).sort(),data.rows.map(x=>x.item).sort());
});

test("Larger memoized exact model remains unproved if distinct-state search budget is exhausted",()=>{
  const pieces=Array.from({length:14},(_,i)=>({
    item:"Variable "+i,cutLength:2+(i%7)*0.71
  }));
  const offers=[
    {code:"BASE",label:"Base",stockLength:18,unitPrice:10},
    {code:"ALT1",label:"Alternative 1",stockLength:22,unitPrice:11},
    {code:"ALT2",label:"Alternative 2",stockLength:26,unitPrice:12}
  ];
  const bars=pieces.map(p=>({offer:offers[0],used:p.cutLength,cuts:[p]}));
  const seed={bars,purchaseCount:14,purchaseCost:140};
  const result=exactFramingStock(pieces,offers,.125,10,seed,{nodeLimit:20});
  assert.equal(result.certified,false);
  assert.equal(result.status,"node-limit");
  assert.equal(result.nodes,20);
  assert.ok(result.candidate.bars.length>=1);
  assert.ok(result.memoHits>=0);
});

test("Memoized canonical search matches brute force even with repeated equal-size pieces",()=>{
  const prices=[
    {code:"BASE",label:"Base",stockLength:8,unitPrice:3},
    {code:"ALT1",label:"Alternative 1",stockLength:12,unitPrice:4.5}
  ];
  const pieces=[5,5,3,3,3,2].map((cutLength,i)=>({item:"Tie "+i,cutLength}));
  const seed={bars:pieces.map(p=>({offer:prices[1],used:p.cutLength,cuts:[p]})),
    purchaseCount:pieces.length,purchaseCost:pieces.length*4.5};
  const exact=exactFramingStock(pieces,prices,.125,10,seed);
  assert.equal(exact.certified,true);
  assert.ok(exact.memoHits>0);
  let bruteMin=Infinity;
  const allocations=[];
  const recurse=i=>{
    if(i===pieces.length){
      let cost=0;
      for(const o of prices){
        const n=allocations.filter(b=>b.offer.code===o.code).length;
        if(n)cost+=Math.ceil(n*1.1-1e-10)*o.unitPrice;
      }
      bruteMin=Math.min(bruteMin,cost);
      return;
    }
    const p=pieces[i];
    for(const bar of allocations){
      const add=p.cutLength+(bar.cuts.length?.125:0);
      if(bar.used+add>bar.offer.stockLength+1e-8)continue;
      bar.used+=add;bar.cuts.push(p);
      recurse(i+1);
      bar.cuts.pop();bar.used-=add;
    }
    for(const offer of prices){
      if(p.cutLength>offer.stockLength)continue;
      allocations.push({offer,used:p.cutLength,cuts:[p]});
      recurse(i+1);
      allocations.pop();
    }
  };
  recurse(0);
  const byOffer=prices.map(o=>exact.candidate.bars.filter(b=>b.offer.code===o.code).length);
  const optimized=byOffer.reduce((sum,n,i)=>
    sum+(n?Math.ceil(n*1.1-1e-10)*prices[i].unitPrice:0),0);
  near(optimized,bruteMin,1e-7);
  assert.equal(exact.candidate.bars.reduce((s,b)=>s+b.cuts.length,0),pieces.length);
});


test("Straight stair default is 14 equal risers, 13 treads, no added landing",()=>{
  const t=tools.find(t=>t.slug==="stair-calculator"),r=compute(t.slug,defaults(t));
  assert.equal(value(r,"Risers"),14);
  assert.equal(value(r,"Treads"),13);
  near(value(r,"Actual riser height"),7.5);
  near(value(r,"Horizontal run"),130);
  near(value(r,"Upper landing reference depth"),0);
  near(value(r,"Total reference footprint"),130);
  near(value(r,"Incline"),Math.atan(.75)*180/Math.PI);
  assert.equal(r.stairRows.length,14);
  assert.deepEqual(r.rows[0],{
    item:"Riser 1",rise:7.5,run:0,riserHeight:7.5,
    treadStart:0,treadEnd:10,walkingSurface:"Tread 1"
  });
  assert.deepEqual(r.rows.at(-1),{
    item:"Riser 14",rise:105,run:130,riserHeight:7.5,
    treadStart:130,treadEnd:null,walkingSurface:"Upper landing"
  });
  assert.equal(r.shape,"stairs");
});
test("Upper stair landing changes total reference footprint, not riser or tread count",()=>{
  const t=tools.find(t=>t.slug==="stair-calculator"),a={...defaults(t),landing:36};
  const r=compute(t.slug,a),base=compute(t.slug,{...a,landing:0});
  assert.equal(value(r,"Risers"),value(base,"Risers"));
  assert.equal(value(r,"Treads"),value(base,"Treads"));
  near(value(r,"Horizontal run"),130);
  near(value(r,"Total reference footprint"),166);
  near(r.flightRun,130);
  near(r.landingDepth,36);
  near(r.totalRise,105);
  assert.equal(r.rows.at(-1).treadEnd,166);
  assert.equal(r.rows.at(-1).walkingSurface,"Upper landing");
  assert.deepEqual(r.rows.slice(0,-1),base.rows.slice(0,-1));
  for(const [i,row] of r.rows.entries()){
    near(row.run,i*a.tread,1e-7);
    near(row.rise,(i+1)*a.rise/r.rows.length,1e-7);
    near(row.riserHeight,a.rise/r.rows.length,1e-7);
    if(i<r.rows.length-1)near(row.treadEnd-row.treadStart,a.tread);
  }
});
test("Nondivisible stair rise distributes equal risers without cumulative mark drift",()=>{
  const t=tools.find(t=>t.slug==="stair-calculator"),r=compute(t.slug,{
    ...defaults(t),rise:95,desired:7,tread:11,landing:28
  });
  assert.equal(value(r,"Risers"),14);
  assert.equal(value(r,"Treads"),13);
  near(value(r,"Actual riser height"),95/14);
  near(value(r,"Horizontal run"),143);
  near(value(r,"Total reference footprint"),171);
  near(r.rows.at(-1).rise,95);
  near(r.rows.at(-1).run,143);
  near(r.rows.at(-1).treadEnd,171);
  for(let i=1;i<r.rows.length;i++){
    near(r.rows[i].rise-r.rows[i-1].rise,95/14,1e-7);
    near(r.rows[i].run-r.rows[i-1].run,11,1e-7);
  }
});
test("Stair landing input rejects negatives and preserves zero as the original convention",()=>{
  const t=tools.find(t=>t.slug==="stair-calculator"),a=defaults(t);
  assert.equal(safeCompute(t.slug,{...a,landing:-0.1}).ok,false);
  assert.equal(safeCompute(t.slug,{...a,desired:0}).ok,false);
  assert.equal(safeCompute(t.slug,{...a,rise:0}).ok,false);
  assert.equal(safeCompute(t.slug,{...a,rise:5000,desired:1}).ok,false);
  assert.equal(safeCompute(t.slug,{...a,tread:0}).ok,false);
  assert.equal(safeCompute(t.slug,{...a,landing:0}).ok,true);
  const withoutLanding=compute(t.slug,{rise:105,desired:7.5,tread:10});
  near(value(withoutLanding,"Total reference footprint"),130);
});


test("Equal spacing derives real part faces and clear gaps from measured center offsets",()=>{
  const mm=x=>x/25.4;
  const t=tools.find(t=>t.slug==="equal-spacing-calculator");
  const r=compute(t.slug,{...defaults(t),length:mm(1000),count:6,
    left:mm(50),right:mm(50),itemWidth:mm(30)});
  assert.equal(r.shape,"spacing-faces");
  assert.equal(r.rows.length,6);
  near(value(r,"Equal center interval")*25.4,180,2e-7);
  near(value(r,"Clear space between faces")*25.4,150,2e-7);
  near(value(r,"Left end face margin")*25.4,35,2e-7);
  near(value(r,"Right end face margin")*25.4,35,2e-7);
  assert.deepEqual(r.rows.map(row=>Math.round(row.position*25.4)),[
    50,230,410,590,770,950
  ]);
  for(const [i,row] of r.rows.entries()){
    near((row.faceRightEdge-row.faceLeftEdge)*25.4,30,3e-7);
    near((row.faceRightEdge+row.faceLeftEdge)/2,row.position,1e-7);
    if(i===0)assert.equal(row.clearToPrevious,null);
    else near(row.clearToPrevious*25.4,150,3e-7);
  }
  assert.equal(r.faceRows,r.rows);
  near(r.partFaceWidth*25.4,30);
});
test("Single equal-width part has a centered face and undefined between-part gap",()=>{
  const r=compute("equal-spacing-calculator",{
    length:100,count:1,left:10,right:20,itemWidth:12
  });
  assert.equal(r.rows.length,1);
  near(r.rows[0].position,45);
  near(r.rows[0].faceLeftEdge,39);
  near(r.rows[0].faceRightEdge,51);
  assert.equal(r.rows[0].clearToPrevious,null);
  assert.equal(r.clearFaceGap,null);
  near(value(r,"Left end face margin"),39);
  near(value(r,"Right end face margin"),49);
  assert.equal(r.metrics.some(m=>m.label==="Clear space between faces"),false);
});
test("Center-only equal spacing remains backwards compatible without fabricated face widths",()=>{
  const t=tools.find(t=>t.slug==="equal-spacing-calculator");
  const r=compute(t.slug,defaults(t));
  assert.equal(r.shape,"ruler");
  assert.equal(r.rows.length,6);
  assert.ok(r.rows.every(row=>row.faceLeftEdge===null&&
    row.faceRightEdge===null&&row.clearToPrevious===null));
  assert.equal(r.metrics.some(m=>m.label==="Clear space between faces"),false);
  assert.equal(r.metrics.some(m=>m.label==="Left end face margin"),false);
  const legacy=compute(t.slug,{length:39.37008,count:6,left:0,right:0});
  near(value(legacy,"Equal center interval"),value(r,"Equal center interval"));
});
test("Physical equal-spacing parts reject overlap and faces beyond stock boundaries",()=>{
  const a={length:100,count:4,left:10,right:10,itemWidth:10};
  assert.equal(safeCompute("equal-spacing-calculator",a).ok,true);
  for(const bad of [
    {...a,left:3},{...a,right:4},
    {...a,itemWidth:30},{...a,itemWidth:-1},
    {...a,length:15},{...a,count:0},{...a,left:60,right:40}
  ]){
    assert.equal(safeCompute("equal-spacing-calculator",bad).ok,false,
      "Should reject invalid face geometry "+JSON.stringify(bad));
  }
});


test("Deck material budget counts both pieces at a joist-centered butt seam",()=>{
  const t=tools.find(t=>t.slug==="deck-material-calculator");
  const a={...defaults(t),stock:100,boardUnitPrice:8.75,
    fastenersPerContact:2,fastenerPackSize:100,fastenerPackPrice:22};
  const r=compute(t.slug,a);
  near(value(r,"Deck area"),120);
  assert.equal(value(r,"Stock boards (no offcut reuse)"),44);
  assert.equal(value(r,"Stock boards with allowance"),49);
  assert.equal(value(r,"Board-joist intersections"),220);
  assert.equal(value(r,"Butt joints on joist center references"),22);
  assert.equal(value(r,"Piece-joist fastening contacts"),242);
  assert.equal(value(r,"Fasteners requested"),484);
  assert.equal(value(r,"Fastener packs to buy"),5);
  near(value(r,"Quoted deck materials total"),538.75);
  assert.equal(r.deckCostSummary.allPricesEntered,true);
  assert.deepEqual(r.deckCostSummary.missingQuotes,[]);
  assert.equal(r.deckCostSummary.boardCost,428.75);
  assert.equal(r.deckCostSummary.fastenerCost,110);
  assert.deepEqual(r.deckPurchaseRows.map(x=>
    [x.material,x.plannedQuantity,x.purchaseQuantity,x.unitPrice,x.purchaseCost]),[
    ["Decking stock boards",44,49,8.75,428.75],
    ["Fastener packs",5,5,22,110]
  ]);
  assert.equal(r.deckFastenerRows.length,22);
  for(const row of r.deckFastenerRows){
    assert.equal(row.joistReferences,10);
    assert.equal(row.buttSeams,1);
    assert.equal(row.fasteningContacts,11);
    assert.equal(row.fastenersPerContact,2);
    assert.equal(row.fastenerPiecesPerRow,22);
    near(row.firstSeamAt,96);
    near(row.lastSeamAt,96);
  }
  assert.equal(r.deckFastenerRows.reduce((s,row)=>s+row.fastenerPiecesPerRow,0),484);
  assert.deepEqual(r.seamCenters,[96]);
});
test("Deck no-seam rows never double-count fastener contacts",()=>{
  const t=tools.find(t=>t.slug==="deck-material-calculator");
  const a={...defaults(t),stock:144,boardUnitPrice:9.25,
    fastenersPerContact:2,fastenerPackSize:100,fastenerPackPrice:12.6};
  const r=compute(t.slug,a);
  assert.equal(value(r,"Stock boards (no offcut reuse)"),22);
  assert.equal(value(r,"Stock boards with allowance"),25);
  assert.equal(value(r,"Butt joints on joist center references"),0);
  assert.equal(value(r,"Piece-joist fastening contacts"),220);
  assert.equal(value(r,"Fasteners requested"),440);
  assert.equal(value(r,"Fastener packs to buy"),5);
  near(value(r,"Quoted deck materials total"),25*9.25+5*12.6);
  assert.ok(r.deckFastenerRows.every(x=>x.buttSeams===0&&
    x.firstSeamAt===null&&x.lastSeamAt===null&&x.fasteningContacts===10));
});
test("Deck partial quotes display partial subtotal without inventing free materials",()=>{
  const t=tools.find(t=>t.slug==="deck-material-calculator"),d=defaults(t);
  const unpriced=compute(t.slug,d);
  assert.equal(unpriced.deckCostSummary.allPricesEntered,false);
  assert.deepEqual(unpriced.deckCostSummary.missingQuotes,["Decking boards","Fastener packs"]);
  assert.equal(unpriced.metrics.some(x=>x.label==="Quoted deck materials total"),false);
  assert.equal(unpriced.deckPurchaseRows[0].purchaseCost,null);
  assert.equal(unpriced.deckPurchaseRows[1].purchaseCost,null);
  const partial=compute(t.slug,{...d,boardUnitPrice:7.25});
  assert.deepEqual(partial.deckCostSummary.missingQuotes,["Fastener packs"]);
  assert.equal(partial.deckCostSummary.quotedSubtotal,25*7.25);
  assert.equal(partial.metrics.some(x=>x.label==="Quoted deck materials total"),false);
  const noFasteners=compute(t.slug,{...d,boardUnitPrice:7.25,fastenersPerContact:0});
  assert.equal(noFasteners.deckCostSummary.allPricesEntered,true);
  assert.equal(noFasteners.deckCostSummary.fastenerPacks,0);
  assert.equal(noFasteners.deckCostSummary.fastenerCost,0);
  assert.equal(noFasteners.deckPurchaseRows[1].purchaseQuantity,0);
  near(value(noFasteners,"Quoted deck materials total"),25*7.25);
});
test("Deck fastener packs and supplier quotes enforce integer, precision and range constraints",()=>{
  const t=tools.find(t=>t.slug==="deck-material-calculator"),d=defaults(t);
  for(const overrides of [
    {fastenersPerContact:-1},{fastenersPerContact:2.5},{fastenersPerContact:21},
    {fastenerPackSize:0},{fastenerPackSize:2.2},{fastenerPackSize:100001},
    {boardUnitPrice:-.5},{fastenerPackPrice:-1},{boardUnitPrice:1e6+1},
    {fastenerPackPrice:1e6+1},{boardUnitPrice:2.555},{fastenerPackPrice:1.999}
  ]){
    assert.equal(safeCompute(t.slug,{...d,...overrides}).ok,false,JSON.stringify(overrides));
  }
  assert.equal(safeCompute(t.slug,{...d,fastenersPerContact:0}).ok,true);
});
test("Deck fastener pack rounding is stable at exact pack boundaries",()=>{
  const t=tools.find(t=>t.slug==="deck-material-calculator"),d=defaults(t);
  const a={...d,fastenerPackSize:110,fastenersPerContact:2,stock:144};
  const exact=compute(t.slug,a);
  assert.equal(value(exact,"Fasteners requested"),440);
  assert.equal(value(exact,"Fastener packs to buy"),4);
  const nearly=compute(t.slug,{...a,fastenerPackSize:109});
  assert.equal(value(nearly,"Fastener packs to buy"),5);
  const joined=compute(t.slug,{...a,stock:100});
  assert.equal(value(joined,"Fasteners requested"),484);
  assert.equal(value(joined,"Fastener packs to buy"),5);
});


test("Stringer nosing and landing references keep the real nominal notch vertices unchanged",()=>{
  const t=tools.find(t=>t.slug==="stair-stringer-calculator"),
    original=compute(t.slug,defaults(t));
  const r=compute(t.slug,{...defaults(t),nosing:1.25,upperLandingDepth:36});
  near(value(r,"Uniform riser height"),7.5);
  near(value(r,"Total horizontal run"),130);
  near(value(r,"Tread nosing reference"),1.25);
  near(value(r,"Upper landing reference depth"),36);
  near(value(r,"Total horizontal planning reach"),166);
  near(value(r,"Notch pitch-line reference"),value(original,"Notch pitch-line reference"));
  near(value(r,"Floor-to-floor diagonal (not a cut length)"),
    value(original,"Floor-to-floor diagonal (not a cut length)"));
  near(value(r,"Uncut throat (nominal)"),5.25);
  assert.deepEqual(r.stepVertices,original.stepVertices);
  assert.equal(r.rows.length,14);
  assert.equal(r.noseReferences.length,13);
  near(r.rows[0].noseStart,-1.25);
  near(r.rows[0].noseEnd,0);
  near(r.rows[1].noseStart,8.75);
  near(r.rows[1].noseEnd,10);
  assert.equal(r.rows.at(-1).landingReferenceEnd,166);
  assert.equal(r.rows.at(-1).treadEnd,null);
  assert.equal(r.landingReferenceEnd,166);
  for(const [i,n] of r.noseReferences.entries()){
    near(n.noseEnd-n.noseStart,1.25,1e-7);
    near(n.rise,(i+1)*7.5,1e-7);
  }
});
test("Stringer reference options reject nonsensical nosing and preserve original default schedule",()=>{
  const t=tools.find(t=>t.slug==="stair-stringer-calculator"),d=defaults(t);
  for(const bad of [
    {nosing:-1},{nosing:10},{nosing:11},
    {upperLandingDepth:-1},{nosing:1e8}
  ]){
    assert.equal(safeCompute(t.slug,{...d,...bad}).ok,false,JSON.stringify(bad));
  }
  const legacy=compute(t.slug,{rise:105,risers:14,tread:10,
    depth:11.25,treadThickness:1.5,lowerFinish:0});
  assert.equal(legacy.noseReferences.length,0);
  assert.equal(legacy.landingReferenceEnd,130);
  assert.ok(legacy.rows.every(r=>!Object.hasOwn(r,"noseStart")&&
    !Object.hasOwn(r,"landingReferenceEnd")));
  assert.equal(legacy.stepVertices.length,28);
  near(value(legacy,"Total horizontal run"),130);
});


test("Stringer modeled side-section has 30 real coordinates and conserves perpendicular throat and area",()=>{
  const t=tools.find(t=>t.slug==="stair-stringer-calculator");
  const r=compute(t.slug,{...defaults(t),nosing:1.25,upperLandingDepth:36,
    lowerSupportRun:3,upperSupportRun:6});
  assert.equal(r.stockEnvelopeVertices.length,30);
  assert.equal(r.stringerEnvelopeRows.length,30);
  assert.deepEqual(r.stockEnvelopeVertices.slice(0,28),r.stepVertices);
  assert.deepEqual(r.stockEnvelopeVertices.at(-2),{x:130,y:90.9375});
  assert.deepEqual(r.stockEnvelopeVertices.at(-1),{x:0,y:-6.5625});
  near(r.stockNormalDepth,11.25);
  near(r.lowerEdgeAtStart,-6.5625);
  near(r.lowerEdgeAtTop,90.9375);
  near(r.minThroatFromVertices,5.25);
  near(value(r,"Modeled section minimum throat"),5.25);
  near(r.envelopeAreaSqIn,1340.625);
  near(value(r,"Modeled section face area")*144,1340.625);
  assert.deepEqual(r.supportReferences,[
    {item:"Lower horizontal support surface reference",startX:-3,endX:0,elevation:0},
    {item:"Upper horizontal support surface reference",startX:130,endX:136,elevation:105}
  ]);
  near(value(r,"Lower support surface reference run"),3);
  near(value(r,"Upper support surface reference run"),6);
  assert.deepEqual(r.stepVertices,compute(t.slug,defaults(t)).stepVertices);
  near(value(r,"Uncut throat (nominal)"),5.25);
});

test("Stringer side-profile polygon matches independent shoelace and integrated area for multiple pitches",()=>{
  const t=tools.find(t=>t.slug==="stair-stringer-calculator");
  for(const [rise,risers,tread,depth] of [
    [105,14,10,11.25],[95,14,11,13.5],[42,6,8,10],[15,2,14,8]
  ]){
    const a={...defaults(t),rise,risers,tread,depth,treadThickness:1};
    const r=compute(t.slug,a);
    const h=rise/risers,run=(risers-1)*tread,m=h/tread,
      lineFactor=Math.sqrt(1+m*m),lower=y=>h+m*y-depth*lineFactor;
    const verts=r.stockEnvelopeVertices;
    assert.equal(verts.length,2*risers+2);
    assert.equal(verts[verts.length-1].x,0);
    assert.equal(verts[verts.length-2].x,run);
    near(verts.at(-1).y,lower(0),3e-7);
    near(verts.at(-2).y,lower(run),3e-7);
    const manualArea=Math.abs(verts.reduce((acc,v,i)=>{
      const n=verts[(i+1)%verts.length];
      return acc+v.x*n.y-n.x*v.y;
    },0))/2;
    const analytic=run*(depth*lineFactor-h/2);
    near(manualArea,analytic,Math.max(1e-6,analytic*1e-9));
    near(r.envelopeAreaSqIn,analytic,Math.max(1e-6,analytic*1e-9));
    const notchMin=Math.min(...r.stepVertices.filter((_,i)=>i%2===0)
      .map(v=>(v.y-lower(v.x))/lineFactor));
    near(r.minThroatFromVertices,notchMin,1e-7);
    near(r.minThroatFromVertices,depth-h/lineFactor,1e-7);
    assert.ok(r.minThroatFromVertices>0);
    // The upper/left and lower/right edges are explicit drawing closures,
    // never misrepresented as an engineered physical bearing cut.
    assert.equal(r.stringerEnvelopeRows.at(-1).boundary,"Parallel lower reference edge");
  }
});

test("Stringer support surfaces are optional, bounded and never create hidden cut shapes",()=>{
  const t=tools.find(t=>t.slug==="stair-stringer-calculator");
  const a=defaults(t),base=compute(t.slug,a);
  assert.equal(base.supportReferences.length,0);
  assert.equal(base.stringerEnvelopeRows.length,30);
  assert.equal(base.stepVertices.length,28);
  assert.equal(base.envelopeAreaSqIn>0,true);
  for(const bad of [
    {lowerSupportRun:-1},{upperSupportRun:-1},
    {lowerSupportRun:131},{upperSupportRun:130.01}
  ]){
    assert.equal(safeCompute(t.slug,{...a,...bad}).ok,false,JSON.stringify(bad));
  }
  const measured=compute(t.slug,{...a,lowerSupportRun:3,upperSupportRun:6});
  near(measured.envelopeAreaSqIn,base.envelopeAreaSqIn);
  assert.deepEqual(measured.stepVertices,base.stepVertices);
  assert.deepEqual(measured.stockEnvelopeVertices,base.stockEnvelopeVertices);
  assert.equal(measured.supportReferences.length,2);
  const onlyBottom=compute(t.slug,{...a,lowerSupportRun:4});
  assert.equal(onlyBottom.supportReferences.length,1);
  assert.equal(onlyBottom.supportReferences[0].startX,-4);
});


test("Aligned three-row drilling grid conserves all circular X/Y centers and physical margins",()=>{
  const mm=x=>x/25.4;
  const a={length:mm(100),holes:4,edge:mm(5),diameter:mm(5),
    boardWidth:mm(40),rowCount:3,crossSetback:mm(5)};
  const r=compute("hole-spacing-calculator",a);
  assert.equal(r.shape,"holes");
  assert.equal(r.drillRows,3);
  assert.equal(r.holesPerRow,4);
  assert.equal(r.rows.length,12);
  assert.equal(r.holeCenters.length,12);
  assert.equal(r.marks.length,4);
  assert.equal(r.crossCenters.length,3);
  near(value(r,"Hole center pitch")*25.4,30,1e-7);
  near(value(r,"Clear material between holes")*25.4,25,1e-7);
  near(value(r,"Transverse center pitch")*25.4,15,1e-7);
  near(value(r,"Clear material between rows")*25.4,10,1e-7);
  near(value(r,"End material margin")*25.4,2.5,1e-7);
  near(value(r,"Side material margin")*25.4,2.5,1e-7);
  assert.equal(value(r,"Hole count"),12);
  assert.equal(value(r,"Drilling rows"),3);
  assert.deepEqual(r.crossCenters.map(y=>Math.round(y*25.4)),[5,20,35]);
  for(let ri=0;ri<3;ri++)for(let ci=0;ci<4;ci++){
    const row=r.rows[ri*4+ci],p=r.holeCenters[ri*4+ci];
    assert.equal(row.rowNumber,ri+1);
    assert.equal(row.columnNumber,ci+1);
    assert.equal(p.row,ri+1);
    assert.equal(p.column,ci+1);
    near(row.center*25.4,5+30*ci,2e-7);
    near(row.centerY*25.4,5+15*ri,2e-7);
    near((row.holeRightEdge-row.holeLeftEdge)*25.4,5,2e-7);
    near((row.holeTopEdge-row.holeBottomEdge)*25.4,5,2e-7);
    near(p.x,row.center);
    near(p.y,row.centerY);
    if(ci===0)assert.equal(row.clearToPrevious,null);
    else near(row.clearToPrevious*25.4,25,2e-7);
    if(ri===0)assert.equal(row.clearToPreviousRow,null);
    else near(row.clearToPreviousRow*25.4,10,2e-7);
    assert.ok(row.holeLeftEdge>=0&&row.holeRightEdge<=a.length);
    assert.ok(row.holeBottomEdge>=0&&row.holeTopEdge<=a.boardWidth);
  }
  near(r.rows[0].holeBottomEdge*25.4,2.5,2e-7);
  near((a.boardWidth-r.rows.at(-1).holeTopEdge)*25.4,2.5,2e-7);
});

test("Single drilling row remains center-located and retains historical CSV columns",()=>{
  const t=tools.find(t=>t.slug==="hole-spacing-calculator"),d=defaults(t);
  const r=compute(t.slug,d);
  assert.equal(r.rows.length,d.holes);
  assert.equal(r.drillRows,1);
  assert.equal(r.holeCenters.length,d.holes);
  assert.ok(r.rows.every(x=>Object.keys(x).join(",")===
    "item,center,holeLeftEdge,holeRightEdge,diameter,clearToPrevious"));
  const half=d.boardWidth/2;
  for(const p of r.holeCenters)near(p.y,half);
  const movedCross=compute(t.slug,{...d,crossSetback:d.boardWidth});
  assert.deepEqual(movedCross.rows,r.rows);
  assert.deepEqual(movedCross.holeCenters,r.holeCenters);
  near(value(movedCross,"Side material margin"),(d.boardWidth-d.diameter)/2);
  assert.equal(r.metrics.some(x=>x.label==="Transverse center pitch"),false);
  assert.equal(r.metrics.some(x=>x.label==="Clear material between rows"),false);
});

test("Two-dimensional drilling rows reject cross-edge escape, row overlap and massive layouts",()=>{
  const mm=x=>x/25.4;
  const base={length:mm(100),holes:4,edge:mm(5),diameter:mm(5),
    boardWidth:mm(40),rowCount:3,crossSetback:mm(5)};
  for(const override of [
    {rowCount:0},{rowCount:21},{rowCount:1.5},
    {boardWidth:0},{boardWidth:mm(4)},{boardWidth:mm(-40)},
    {crossSetback:mm(2)},{crossSetback:mm(22)},
    {rowCount:9},{rowCount:20},{holes:301,rowCount:3},
    {holes:100,rowCount:20},{holes:0},{diameter:mm(45)},
    {edge:mm(1)},{rowCount:4,crossSetback:mm(16)}
  ]){
    const r=safeCompute("hole-spacing-calculator",{...base,...override});
    assert.equal(r.ok,false,"must reject "+JSON.stringify(override));
  }
  assert.equal(safeCompute("hole-spacing-calculator",
    {...base,rowCount:20,holes:30,crossSetback:mm(2.5),boardWidth:mm(100)}).ok,false,
    "20 rows are not usable when rows are closer than the drill diameter");
  const touching=compute("hole-spacing-calculator",{
    ...base,rowCount:3,boardWidth:mm(20),crossSetback:mm(5)
  });
  near(value(touching,"Clear material between rows")*25.4,0,1e-7);
});

test("Drill grid counts and center positions agree with independent evenly spaced references",()=>{
  const mm=x=>x/25.4;
  for(const [cols,rows] of [[2,2],[4,3],[6,5],[20,15]]){
    const width=mm(30+rows*6),length=mm(100+cols*10),d=mm(3),
      edge=mm(5),crossSetback=mm(5);
    const r=compute("hole-spacing-calculator",{
      length,holes:cols,rowCount:rows,edge,diameter:d,
      boardWidth:width,crossSetback
    });
    assert.equal(r.rows.length,cols*rows);
    const gp=(length-2*edge)/(cols-1),rp=(width-2*crossSetback)/(rows-1);
    for(const p of r.holeCenters){
      near(p.x,edge+(p.column-1)*gp,1e-7);
      near(p.y,crossSetback+(p.row-1)*rp,1e-7);
    }
    near(r.holeCenters[0].x,edge);
    near(r.holeCenters.at(-1).x,length-edge);
    near(r.holeCenters.at(-1).y,width-crossSetback);
    near(value(r,"Clear material between rows"),rp-d);
    near(value(r,"Clear material between holes"),gp-d);
  }
});


test("Three shelves create 12 independently checked side-panel support pin hole coordinates",()=>{
  const a={height:40,shelves:3,thickness:1,top:1,bottom:2,
    caseDepth:12,frontPinInset:1.5,backPinInset:1.5,
    pinCenterDrop:.25,pinHoleDiameter:.2};
  const r=compute("shelf-spacing-calculator",a);
  near(value(r,"Shared base clear gap"),8.5);
  near(value(r,"Actual bottom clearance"),10.5);
  near(value(r,"Actual top clearance"),9.5);
  near(value(r,"Support drill holes (both side panels)"),12);
  assert.equal(r.shelfPinEnabled,true);
  assert.equal(r.shelfPinRows.length,12);
  assert.equal(r.sidePanelHoles.length,6);
  assert.equal(r.rows.length,3);
  assert.deepEqual(r.rows.map(row=>row.shelfBottom),[10.5,20,29.5]);
  assert.deepEqual(r.sidePanelHoles.map(h=>[h.position,h.x,h.y]),[
    ["Front",1.5,10.25],["Back",10.5,10.25],
    ["Front",1.5,19.75],["Back",10.5,19.75],
    ["Front",1.5,29.25],["Back",10.5,29.25]
  ]);
  for(const row of r.shelfPinRows){
    assert.ok(["Left","Right"].includes(row.panel));
    assert.ok(["Front","Back"].includes(row.position));
    near(row.holeDiameter,.2);
    near(row.faceBackEdge-row.faceFrontEdge,.2);
    near(row.faceTopEdge-row.faceBottomEdge,.2);
    near(row.undersideClearance,.15);
    assert.ok(row.faceFrontEdge>=0&&row.faceBackEdge<=12);
    assert.ok(row.faceBottomEdge>=0&&row.faceTopEdge<=40);
    const shelf=r.rows[row.shelfNumber-1];
    near(shelf.shelfBottom-row.faceTopEdge,.15);
    const previous=row.shelfNumber===1?0:r.rows[row.shelfNumber-2].shelfTop;
    assert.ok(row.faceBottomEdge>=previous);
  }
  assert.deepEqual(r.shelfPinRows.slice(0,4).map(p=>[p.panel,p.position]),[
    ["Left","Front"],["Right","Front"],["Left","Back"],["Right","Back"]
  ]);
  assert.deepEqual(r.marks.map(x=>x.x),r.rows.map(x=>x.shelfBottom));
});
test("Zero shelf pin hole diameter preserves the original shelf face plan exactly",()=>{
  const a={height:40,shelves:3,thickness:1,top:1,bottom:2};
  const r=compute("shelf-spacing-calculator",a);
  const alternate=compute("shelf-spacing-calculator",{
    ...a,caseDepth:15,frontPinInset:2,backPinInset:4,
    pinCenterDrop:1,pinHoleDiameter:0
  });
  assert.deepEqual(r.rows,alternate.rows);
  assert.deepEqual(r.marks,alternate.marks);
  assert.deepEqual(r.metrics,alternate.metrics);
  assert.equal(r.metrics.length,5);
  assert.equal(r.shelfPinRows.length,0);
  assert.equal(r.sidePanelHoles.length,0);
  assert.equal(r.shelfPinEnabled,false);
  assert.equal(alternate.shelfPinEnabled,false);
});
test("Measured shelf pin positions must fit side panel and stay in real shelf clear openings",()=>{
  const a={height:40,shelves:3,thickness:1,top:1,bottom:2,
    caseDepth:12,frontPinInset:1.5,backPinInset:1.5,
    pinCenterDrop:.25,pinHoleDiameter:.2};
  for(const x of [
    {caseDepth:0},{caseDepth:2},{frontPinInset:-1},{backPinInset:-1},
    {pinCenterDrop:-1},{pinHoleDiameter:-1},
    {frontPinInset:.05},{backPinInset:.05},
    {frontPinInset:10.4},{backPinInset:11.5},
    {pinCenterDrop:.05},{pinCenterDrop:11},
    {pinHoleDiameter:.6},{pinHoleDiameter:3.5},
    {height:9,shelves:3,thickness:3,top:0,bottom:0},
    {height:500,shelves:101,thickness:.75,top:0,bottom:0}
  ]){
    const r=safeCompute("shelf-spacing-calculator",{...a,...x});
    assert.equal(r.ok,false,"bad measured support configuration "+JSON.stringify(x));
  }
  const touching=compute("shelf-spacing-calculator",{
    ...a,pinHoleDiameter:.5,pinCenterDrop:.25,frontPinInset:1.5,backPinInset:1.5
  });
  near(touching.shelfPinRows[0].undersideClearance,0);
  assert.equal(touching.shelfPinRows.length,12);
  const almost=compute("shelf-spacing-calculator",{
    ...a,frontPinInset:.1,backPinInset:.1,pinHoleDiameter:.2
  });
  near(almost.shelfPinRows[0].faceFrontEdge,0);
  near(almost.shelfPinRows[3].faceBackEdge,12);
});
test("Shelf support drilling holes remain conserved over several valid interior sizes",()=>{
  for(const [height,count,thickness] of [[40,3,1],[60,4,.75],[100,8,.5],[400,60,.625]]){
    const a={height,shelves:count,thickness,top:1,bottom:2,
      caseDepth:12,frontPinInset:1.5,backPinInset:1.5,
      pinCenterDrop:.25,pinHoleDiameter:.2};
    const r=compute("shelf-spacing-calculator",a);
    assert.equal(r.shelfPinRows.length,count*4);
    assert.equal(r.sidePanelHoles.length,count*2);
    assert.equal(r.rows.length,count);
    for(let i=0;i<count;i++){
      const records=r.shelfPinRows.filter(x=>x.shelfNumber===i+1);
      assert.equal(records.length,4);
      const ys=new Set(records.map(x=>x.centerY));
      assert.equal(ys.size,1);
      near(records[0].centerY,r.rows[i].shelfBottom-a.pinCenterDrop,1e-7);
      assert.equal(new Set(records.map(x=>x.panel)).size,2);
      assert.equal(new Set(records.map(x=>x.position)).size,2);
      assert.ok(records.every(x=>x.faceBottomEdge>=-1e-7));
    }
  }
});

test("P1 brace setbacks use diagonal station coordinates, not X/Y face setbacks",()=>{
  const r=compute("diagonal-brace-calculator",{width:36,height:48,setback:5});
  assert.equal(r.shape,"brace");
  near(value(r,"Full centerline"),60);
  near(value(r,"After end setbacks"),50);
  near(value(r,"Brace angle"),Math.atan2(48,36)*180/Math.PI,1e-9);
  near(value(r,"Cut horizontal projection"),30);
  near(value(r,"Cut vertical projection"),40);
  assert.deepEqual(r.rows,[
    {item:"Cut start",stationAlongFullLine:5,horizontalX:3,verticalY:4},
    {item:"Cut finish",stationAlongFullLine:55,horizontalX:33,verticalY:44}
  ]);
  assert.deepEqual(r.braceCutRows,r.rows);
  near(Math.hypot(r.rows[1].horizontalX-r.rows[0].horizontalX,
    r.rows[1].verticalY-r.rows[0].verticalY),value(r,"After end setbacks"));
});
test("P1 brace keeps exact zero-setback endpoints and rejects degenerate remaining cuts",()=>{
  const a=compute("diagonal-brace-calculator",{width:3,height:4,setback:0});
  assert.deepEqual(a.rows.map(p=>[p.horizontalX,p.verticalY]),[[0,0],[3,4]]);
  near(value(a,"After end setbacks"),5);
  for(const setback of [2.5,2.50001,2.49999999,-1]){
    assert.equal(safeCompute("diagonal-brace-calculator",{width:3,height:4,setback}).ok,false);
  }
});
test("P1 brace coordinate projections conserve length on varied slope and unit cases",()=>{
  for(const [width,height,setback] of [[36,48,5],[48,36,2],[10,10,1],[100,1,3],[1,100,3]]){
    const r=compute("diagonal-brace-calculator",{width,height,setback});
    const start=r.rows[0],finish=r.rows[1],full=Math.hypot(width,height);
    near(start.horizontalX,setback*width/full,1e-7);
    near(start.verticalY,setback*height/full,1e-7);
    near(finish.horizontalX,(full-setback)*width/full,1e-7);
    near(finish.verticalY,(full-setback)*height/full,1e-7);
    near(Math.hypot(finish.horizontalX-start.horizontalX,
      finish.verticalY-start.verticalY),full-2*setback,1e-7);
  }
});

test("P1 ring distinguishes polygon corner diameters, perpendicular face depth and turning circle",()=>{
  const n=12,theta=Math.PI/n;
  const r=compute("segmented-bowl-calculator",{outer:12,inner:8,segments:n,rings:3});
  near(value(r,"Outer chord"),12*Math.sin(theta),1e-7);
  near(value(r,"Inner chord"),8*Math.sin(theta),1e-7);
  near(value(r,"Segment radial depth"),2);
  near(value(r,"Perpendicular stock-face depth"),2*Math.cos(theta),1e-7);
  near(value(r,"Maximum circular outside diameter (ideal)"),12*Math.cos(theta),1e-7);
  near(value(r,"One complete polygon-ring face area")*144,60,1e-7);
  near(value(r,"One segment face area")*144,5,1e-7);
  near(r.rows[0].perpendicularFaceDepth,2*Math.cos(theta),1e-7);
  near(r.rows[0].segmentFaceAreaFt2*144,5,1e-6);
  assert.deepEqual(r.segmentTemplateVertices[0],[0,0]);
  near(r.segmentTemplateVertices[1][0],12*Math.sin(theta),1e-7);
  near(r.segmentTemplateVertices[2][1],2*Math.cos(theta),1e-7);
  near(r.segmentTemplateVertices[3][1],2*Math.cos(theta),1e-7);
  assert.ok(value(r,"Maximum circular outside diameter (ideal)")<12);
});
test("P1 polygon ring trapezoids conserve total area across segment counts and ring sizes",()=>{
  for(const n of [3,4,6,8,12,24,48,180]){
    for(const [outer,inner] of [[12,8],[30,22],[1,.5]]){
      const r=compute("segmented-bowl-calculator",{outer,inner,segments:n,rings:1});
      const theta=Math.PI/n;
      const independent=n*(outer*outer-inner*inner)*Math.sin(2*theta)/8;
      near(r.ringAreaSqIn,independent,1e-7);
      near(n*r.trapezoidAreaSqIn,independent,1e-7);
      near(r.turningLimit,outer*Math.cos(theta),1e-7);
      near(r.faceDepth,(outer-inner)/2*Math.cos(theta),1e-7);
      assert.equal(r.rows.length,n);
    }
  }
});

test("P1 deck optional alternate seams stay on entered joist centers and conserve row stock",()=>{
  const data={width:120,length:144,board:5.5,gap:.125,stock:100,joists:16,
    waste:10,boardUnitPrice:8.75,fastenersPerContact:2,fastenerPackSize:100,fastenerPackPrice:22,seamMode:1};
  const r=compute("deck-material-calculator",data);
  assert.equal(r.deckRows.length,22);
  assert.deepEqual(r.deckRows[0].seamCenters,[96]);
  assert.deepEqual(r.deckRows[1].seamCenters,[48]);
  assert.equal(r.staggeredRows,11);
  assert.equal(r.distinctSeamPatterns,2);
  assert.equal(r.rows.filter(x=>x.type==="Decking").length,44);
  assert.equal(r.deckFastenerRows[0].firstSeamAt,96);
  assert.equal(r.deckFastenerRows[1].firstSeamAt,48);
  near(value(r,"Stock boards (no offcut reuse)"),44);
  near(value(r,"Piece-joist fastening contacts"),242);
  for(const row of r.deckRows){
    const pieces=r.rows.filter(x=>x.type==="Decking"&&x.item.startsWith(row.item+" piece "));
    near(pieces.reduce((s,p)=>s+p.cutLength,0),144,1e-7);
    assert.ok(pieces.every(x=>x.cutLength<=100+1e-8&&x.cutLength>0));
    assert.ok(row.seamCenters.every(seam=>r.joistGrid.includes(seam)));
  }
  const original=compute("deck-material-calculator",{...data,seamMode:0});
  assert.ok(original.deckRows.every(x=>x.seamCenters.length===1&&x.seamCenters[0]===96));
  assert.equal(original.staggeredRows,0);
});
test("P1 deck alternation reports zero staggering when the joist grid has no alternative seam",()=>{
  const a={width:20,length:90,board:5,gap:0,stock:100,joists:15,waste:0,seamMode:1};
  const r=compute("deck-material-calculator",a);
  assert.equal(r.staggeredRows,0);
  assert.equal(r.distinctSeamPatterns,1);
  assert.ok(r.deckRows.every(x=>x.seamCenters.length===0));
  assert.equal(safeCompute("deck-material-calculator",{...a,seamMode:2}).ok,false);
});

test("P1 tapered segmented rings calculate independent physical piece dimensions and stack levels",()=>{
  const a={outer:12,inner:8,segments:12,rings:3,
    outerStep:-1,innerStep:-.5,ringHeight:.75,ringOversize:.125,ringKerf:.1};
  const r=compute("segmented-bowl-calculator",a);
  assert.equal(r.rows.length,36);
  assert.deepEqual(r.ringProfiles.map(x=>x.outer),[12,11,10]);
  assert.deepEqual(r.ringProfiles.map(x=>x.inner),[8,7.5,7]);
  assert.deepEqual(r.ringProfiles.map(x=>x.stackTop),[.75,1.5,2.25]);
  const theta=Math.PI/12;
  for(const [i,ring] of r.ringProfiles.entries()){
    const outer=a.outer+i*a.outerStep,inner=a.inner+i*a.innerStep;
    near(ring.outerChord,outer*Math.sin(theta),1e-7);
    near(ring.innerChord,inner*Math.sin(theta),1e-7);
    near(ring.blankLength,outer*Math.sin(theta)+.35,1e-7);
    near(ring.blankWidth,(outer-inner)/2*Math.cos(theta)+.35,1e-7);
    near(ring.turningLimit,outer*Math.cos(theta),1e-7);
    near(ring.trapezoidAreaSqIn*12,ring.ringAreaSqIn,1e-7);
    assert.ok(r.rows.filter(row=>row.ring===i+1)
      .every(row=>row.outerCornerDiameter===ring.outer&&row.roughBlankLength===ring.blankLength));
  }
  near(r.totalRingFaceAreaSqIn,r.ringProfiles.reduce((s,x)=>s+x.ringAreaSqIn,0),1e-7);
});
test("P1 tapered ring validates all derived inner/outer dimensions and physical blank entries",()=>{
 const basic={outer:12,inner:8,segments:12,rings:3,ringHeight:.75};
 for(const overrides of [
   {outerStep:-6},{innerStep:3},{ringHeight:0},{ringOversize:-1},{ringKerf:-.1}
 ]){
   const r=safeCompute("segmented-bowl-calculator",{...basic,...overrides});
   assert.equal(r.ok,false,JSON.stringify(overrides));
 }
 const original=compute("segmented-bowl-calculator",basic);
 assert.ok(original.ringProfiles.every(x=>x.outer===12&&x.inner===8));
});

test("P1 stringer exports 27 exact notch sawline segments at consistent vertex datums",()=>{
 const a={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,lowerFinish:0};
 const r=compute("stair-stringer-calculator",a);
 assert.equal(r.stringerCutLineRows.length,27);
 assert.equal(r.measuredEndCuts.length,0);
 assert.equal(r.stringerCutLineRows.filter(x=>x.cutType==="Riser").length,14);
 assert.equal(r.stringerCutLineRows.filter(x=>x.cutType==="Tread").length,13);
 for(let i=0;i<r.stringerCutLineRows.length;i++){
   const row=r.stringerCutLineRows[i],start=r.stepVertices[i],end=r.stepVertices[i+1];
   assert.deepEqual([row.startX,row.startY,row.endX,row.endY],[start.x,start.y,end.x,end.y]);
   near(row.cutLength,Math.hypot(end.x-start.x,end.y-start.y),1e-7);
   near(row.cutAngleDeg,Math.atan2(end.y-start.y,end.x-start.x)*180/Math.PI,1e-7);
 }
 near(r.stockAxisSpan,170.9375,1e-7);
});
test("P1 measured stringer end intersections remain distinct from support surfaces and constrain raw stock",()=>{
 const a={rise:105,risers:14,tread:10,depth:11.25,
    treadThickness:1.5,lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6,
    lowerSupportRun:5,upperSupportRun:8,blankEndAllowance:1,
    measuredBlankLength:200};
 const r=compute("stair-stringer-calculator",a);
 assert.equal(r.measuredEndCuts.length,2);
 assert.equal(r.supportReferences.length,2);
 assert.deepEqual(r.measuredEndCuts.map(x=>x.endX),[-3,136]);
 near(r.measuredEndCuts[0].endY,-8.8125,1e-7);
 near(r.measuredEndCuts[1].endY,95.4375,1e-7);
 assert.equal(r.stockFitsModel,true);
 const small=compute("stair-stringer-calculator",{...a,measuredBlankLength:100});
 assert.equal(small.stockFitsModel,false);
 assert.ok(small.requiredBlankAxis>100);
 assert.equal(safeCompute("stair-stringer-calculator",{...a,upperEndCutRun:40}).ok,false);
});

test("P1 rectangular sheathing optional offcut reuse fits four cuts in three stock sheets",()=>{
 const args={width:70,length:110,pitch:0,sheetWidth:48,sheetLength:96,
   orientation:0,waste:0,reuseMode:1,roofKerf:0};
 const r=compute("roof-sheathing-calculator",args),p=r.roofReusePlan;
 assert.equal(r.roofSheets.length,4);
 assert.equal(p.rows.length,4);
 assert.equal(p.stockCount,3);
 assert.equal(p.reusedCutCount,1);
 near(p.stockAreaSqIn,3*96*48,1e-7);
 near(p.installedAreaSqIn,7700,1e-7);
 near(p.installedAreaSqIn+p.freeAreaSqIn+p.kerfAreaSqIn+p.cornerScrapAreaSqIn,
   p.stockAreaSqIn,1e-7);
 assert.ok(p.rows.every(row=>row.stockCutVertices.every(([x,y])=>
   x>=-1e-7&&y>=-1e-7&&x<=96+1e-7&&y<=48+1e-7)));
 near(value(r,"Bounded reusable-box stock sheets"),3);
 const baseline=compute("roof-sheathing-calculator",{...args,reuseMode:0});
 assert.equal(baseline.roofReusePlan,null);
 assert.equal(baseline.rows.length,4);
});
test("P1 roof rectangular stock reuse accounts for all kerfs and rejects invalid sizes",()=>{
 for(const kerf of [0,.125,.5]){
   const r=compute("roof-sheathing-calculator",{width:70,length:110,pitch:0,
     sheetWidth:48,sheetLength:96,orientation:0,waste:10,reuseMode:1,roofKerf:kerf});
   const p=r.roofReusePlan;
   near(p.stockAreaSqIn,p.installedAreaSqIn+p.freeAreaSqIn+
     p.kerfAreaSqIn+p.cornerScrapAreaSqIn,1e-6);
   assert.ok(p.stockCount<=r.roofSheets.length);
   for(const board of p.boards)for(let i=0;i<board.placements.length;i++)
     for(let j=i+1;j<board.placements.length;j++){
       const a=board.placements[i],b=board.placements[j];
       const overlapX=Math.min(a.stockX+a.boxWidth,b.stockX+b.boxWidth)-
         Math.max(a.stockX,b.stockX);
       const overlapY=Math.min(a.stockY+a.boxHeight,b.stockY+b.boxHeight)-
         Math.max(a.stockY,b.stockY);
       assert.ok(overlapX<=1e-7||overlapY<=1e-7);
     }
 }
 assert.equal(safeCompute("roof-sheathing-calculator",{
   width:70,length:110,pitch:0,sheetWidth:48,sheetLength:96,
   orientation:0,waste:0,reuseMode:1,roofKerf:49}).ok,false);
});
test("P1 hip developed-surface polygon reuse proves stock bounding box and full area accounting",()=>{
 const r=compute("hip-roof-calculator",{
   width:96,length:192,pitch:0,overhang:0,sheetWidth:48,sheetLength:96,
   orientation:0,reuseMode:1,roofKerf:.125});
 const p=r.roofReusePlan;
 assert.ok(p&&p.rows.length===r.roofPanels.length);
 assert.ok(p.stockCount<=r.roofPanels.length);
 near(p.installedAreaSqIn,r.coveredAreaSqIn,1e-5);
 near(p.stockAreaSqIn,p.installedAreaSqIn+
   p.kerfAreaSqIn+p.cornerScrapAreaSqIn+p.freeAreaSqIn,1e-5);
 for(const cut of p.rows){
   const target=r.roofPanels.find(x=>x.id===cut.item);
   assert.equal(cut.stockCutVertices.length,target.localVertices.length);
   const local=cut.stockCutVertices.map(v=>[v[0]-cut.stockX,v[1]-cut.stockY]);
   const twiceArea=local.reduce((sum,v,i)=>{
     const next=local[(i+1)%local.length];return sum+v[0]*next[1]-next[0]*v[1]},0);
   near(Math.abs(twiceArea)/2,target.cutAreaSqIn,1e-5);
   assert.ok(cut.stockCutVertices.every(([x,y])=>x>=-1e-7&&y>=-1e-7&&
      x<=p.stockWidth+1e-7&&y<=p.stockHeight+1e-7));
 }
});

test("P1 deck physical board-end positions conserve every row with entered butt gap",()=>{
  const inputs={width:11.125,length:144,board:5.5,gap:.125,stock:100,
    joists:16,waste:0,seamMode:0,buttEndGap:.25,joistFaceWidth:3.5,minEndBearing:1.5};
  const r=compute("deck-material-calculator",inputs);
  const pieces=r.rows.filter(row=>row.type==="Decking");
  assert.equal(r.deckRows.length,2);
  assert.equal(pieces.length,4);
  near(value(r,"Geometric face overlap per joined end"),1.625);
  near(value(r,"Installed physical board cut length"),287.5);
  near(value(r,"Installed linear decking"),287.5/12);
  for(let i=0;i<2;i++){
    const [before,after]=pieces.slice(i*2,i*2+2);
    near(before.buttJointAtEnd,96);
    near(before.actualCutEnd,95.875);
    near(after.alongStart,96.125);
    near(after.alongStart-before.actualCutEnd,.25);
    near(before.cutLength+after.cutLength+.25,144);
    near(before.geometricFaceOverlap,1.625);
    near(after.geometricFaceOverlap,1.625);
  }
  near(pieces.reduce((sum,row)=>sum+row.cutLength,0)+2*.25,2*144);
});
test("P1 deck measured joist face and minimum physical overlap reject impossible seams",()=>{
  const base={width:11.125,length:144,board:5.5,gap:.125,stock:100,joists:16,waste:0};
  for(const bad of [
    {buttEndGap:2,joistFaceWidth:1.5,minEndBearing:0},
    {buttEndGap:.25,joistFaceWidth:3.5,minEndBearing:1.7},
    {buttEndGap:1.5,joistFaceWidth:1.5},
    {buttEndGap:-.01},{joistFaceWidth:0},{minEndBearing:-1}
  ])assert.equal(safeCompute("deck-material-calculator",{...base,...bad}).ok,false,JSON.stringify(bad));
  const seamless=compute("deck-material-calculator",{
    ...base,stock:144,buttEndGap:2,joistFaceWidth:.5,minEndBearing:10
  });
  assert.equal(seamless.deckRows.every(row=>row.seamCenters.length===0),true);
});
test("P1 deck positive-gap opt-in retains original zero-gap results and independent seam centers",()=>{
  const base={width:120,length:144,board:5.5,gap:.125,stock:100,joists:16,
    waste:10,seamMode:1,boardUnitPrice:8.75,fastenersPerContact:2,fastenerPackSize:100,fastenerPackPrice:22};
  assert.deepEqual(compute("deck-material-calculator",base),compute("deck-material-calculator",{
    ...base,buttEndGap:0,joistFaceWidth:1.5,minEndBearing:0
  }));
  const altered=compute("deck-material-calculator",{
    ...base,buttEndGap:.125,joistFaceWidth:3.5,minEndBearing:1.5
  });
  assert.deepEqual(altered.deckRows[0].seamCenters,[96]);
  assert.deepEqual(altered.deckRows[1].seamCenters,[48]);
  const count=altered.deckRows.reduce((sum,row)=>sum+row.seamCenters.length,0);
  const cuts=altered.rows.filter(row=>row.type==="Decking");
  near(cuts.reduce((sum,row)=>sum+row.cutLength,0)+count*.125,22*144);
  near(value(altered,"Piece-joist fastening contacts"),242);
  near(value(altered,"Stock boards (no offcut reuse)"),44);
});

test("Rafter: cut seat, vertical heel and HAP conserve a physical 2D notch triangle",()=>{
  const a={run:120,pitch:6,ridge:1.5,overhang:12,depth:5.5,seat:3};
  const r=compute("rafter-calculator",a),run=119.25,slope=.5,k=Math.hypot(1,slope);
  assert.equal(r.birdsmouthCutRows.length,2);
  near(r.seatStart.x,run-3);
  near(r.seatStart.y,slope*(run-3)+5.5*k,1e-7);
  near(r.heelTop.x,run);
  near(r.heelTop.y,r.seatStart.y,1e-9);
  near(r.heelBottom.x,run);
  near(r.heelBottom.y,slope*run+5.5*k,1e-7);
  const [seat,heel]=r.birdsmouthCutRows;
  near(seat.startX,r.seatStart.x);near(seat.endX,r.heelTop.x);
  near(seat.startY,seat.endY);near(seat.cutLength,3);
  near(heel.startX,heel.endX);
  near(heel.startY,seat.endY);near(heel.endY,r.heelBottom.y);
  near(heel.cutLength,1.5);near(heel.cutAngleDeg,90);
  near(value(r,"HAP (vertical top to seat at wall)"),5.5*k-1.5);
  near(value(r,"Remaining stock (normal)"),5.5-3*.5/k);
  const triangle=[r.seatStart,r.heelTop,r.heelBottom];
  const area=Math.abs(triangle.reduce((sum,p,i)=>{
    const b=triangle[(i+1)%triangle.length];return sum+p.x*b.y-b.x*p.y;
  },0))/2;
  near(area,2.25,1e-7);
  near(value(r,"Nominal removed triangular face area"),area/144,1e-8);
});
test("Rafter: the same notch remains valid when the overhang is zero",()=>{
  const r=compute("rafter-calculator",{
    run:120,pitch:12,ridge:0,overhang:0,depth:2.5,seat:3
  });
  near(r.heelBottom.x,120);
  near(r.heelBottom.y-r.heelTop.y,3,1e-7);
  near(r.hap,2.5*Math.sqrt(2)-3,1e-8);
  near(r.birdsmouthCutRows[0].cutLength,3);
});
test("Rafter: zero pitch or zero seat does not invent a nonzero vertical cut",()=>{
  const base={run:120,pitch:0,ridge:0,overhang:12,depth:5.5,seat:3};
  const flat=compute("rafter-calculator",base);
  assert.deepEqual(flat.birdsmouthCutRows,[]);
  near(flat.hap,5.5);near(flat.notchAreaSqIn,0);
  near(flat.heelBottom.y,flat.heelTop.y);
  const none=compute("rafter-calculator",{...base,pitch:6,seat:0});
  assert.deepEqual(none.birdsmouthCutRows,[]);
  near(none.notchAreaSqIn,0);
});
test("Rafter: seat and heel XY run across five pitches without geometric coordinate drift",()=>{
  for(const p of [1,2,4,6,9,12,16]){
    const base={run:120,pitch:p,ridge:1.5,overhang:0,depth:11.25,seat:3};
    const r=compute("rafter-calculator",base);
    const slope=p/12,k=Math.hypot(1,slope);
    near(r.heelTop.x-r.seatStart.x,3,1e-8);
    near(r.heelBottom.y-r.heelTop.y,3*slope,1e-8);
    near(r.hap,11.25*k-3*slope,1e-9);
    near((r.heelBottom.y-r.heelTop.y)/k,11.25-value(r,"Remaining stock (normal)"),1e-7);
  }
});

test("Deck optional full-width joist procurement conserves cuts, reserve stock and exact user quotes",()=>{
  const a={width:120,length:144,board:5.5,gap:.125,stock:144,joists:16,
    waste:10,boardUnitPrice:8,fastenersPerContact:2,
    fastenerPackSize:100,fastenerPackPrice:20,
    joistStockLength:144,joistUnitPrice:9};
  const r=compute("deck-material-calculator",a);
  assert.equal(r.deckJoistStockEnabled,true);
  const joists=r.rows.filter(row=>row.type==="Joist straight cut");
  assert.equal(joists.length,10);
  for(const [i,j] of joists.entries()){
    near(j.joistCenter,i*16);near(j.cutLength,120);
    near(j.purchasedStockLength,144);
    near(j.sourceOffcutLength,24);
  }
  near(value(r,"Straight joist cuts"),10);
  near(value(r,"Joist stock sticks with allowance"),11);
  near(value(r,"Total nominal joist cut length"),100);
  near(value(r,"Unreused joist source offcut length"),20);
  assert.equal(r.deckPurchaseRows.length,3);
  const joistBuy=r.deckPurchaseRows.at(-1);
  assert.equal(joistBuy.material,"Optional full-width joist stock");
  near(joistBuy.plannedQuantity,10);near(joistBuy.purchaseQuantity,11);
  near(joistBuy.unitPrice,9);near(joistBuy.purchaseCost,99);
  near(value(r,"Quoted deck materials total"),399);
  assert.equal(r.deckCostSummary.allPricesEntered,true);
});
test("Deck optional joists do not invent structural spans, splices or free quotes",()=>{
  const base={width:120,length:144,board:5.5,gap:.125,stock:144,
    joists:16,waste:10,boardUnitPrice:8,fastenersPerContact:2,
    fastenerPackSize:100,fastenerPackPrice:20};
  const absent=compute("deck-material-calculator",base);
  assert.equal(absent.deckPurchaseRows.length,2);
  assert.equal(absent.rows.filter(r=>r.type==="Joist straight cut").length,0);
  near(value(absent,"Quoted deck materials total"),300);
  const unquoted=compute("deck-material-calculator",{...base,joistStockLength:144});
  assert.equal(unquoted.deckPurchaseRows.length,3);
  assert.equal(unquoted.deckPurchaseRows[2].purchaseCost,null);
  assert.equal(unquoted.deckCostSummary.allPricesEntered,false);
  assert.ok(unquoted.deckCostSummary.missingQuotes.includes("Full-width joist stock"));
  assert.equal(unquoted.metrics.some(r=>r.label==="Quoted deck materials total"),false);
  for(const bad of [
    {joistStockLength:110,joistUnitPrice:9},
    {joistStockLength:0,joistUnitPrice:9},
    {joistStockLength:-1},
    {joistStockLength:144,joistUnitPrice:-1}
  ])assert.equal(safeCompute("deck-material-calculator",{...base,...bad}).ok,false,JSON.stringify(bad));
});

test("P1 stringer blank rectangle is an actual pitch-aligned 2D bounding geometry with conserved area",()=>{
  for(const [rise,risers,tread,depth] of [
    [105,14,10,11.25],[95,14,11,13.5],[42,6,8,10],[15,2,14,8]
  ]){
    const a={rise,risers,tread,depth,treadThickness:1,
      lowerFinish:0,blankEndAllowance:1.25};
    const r=compute("stair-stringer-calculator",a);
    const theta=Math.atan2(rise/risers,tread),cs=Math.cos(theta),sn=Math.sin(theta),
      verts=r.stringerBlankVertices;
    assert.equal(verts.length,4);
    assert.equal(r.stringerBlankRows.length,4);
    near(r.blankLengthShown,r.requiredBlankAxis,1e-7);
    near(value(r,"Reference blank rectangle normal width"),depth);
    near(value(r,"Reference blank rectangle longitudinal length"),r.requiredBlankAxis);
    const along=[verts[1].x-verts[0].x,verts[1].y-verts[0].y],
      across=[verts[3].x-verts[0].x,verts[3].y-verts[0].y];
    near(Math.hypot(...along),r.requiredBlankAxis,1e-7);
    near(Math.hypot(...across),depth,1e-7);
    near(along[0]*across[0]+along[1]*across[1],0,2e-6);
    near(along[1]/along[0],sn/cs,1e-7);
    const area=Math.abs(verts.reduce((sum,p,i)=>{
      const n=verts[(i+1)%verts.length];return sum+p.x*n.y-n.x*p.y;
    },0))/2;
    near(area,r.requiredBlankAxis*depth,Math.max(1e-6,area*1e-9));
    near(value(r,"Reference blank rectangle area")*144,area,1e-6);
    for(const p of r.stockAxisProfile){
      const u=p.x*cs+(p.y-r.stepRise)*sn,
        v=-p.x*sn+(p.y-r.stepRise)*cs;
      assert.ok(u>=r.blankStartAxis-1e-7&&u<=r.blankEndAxis+1e-7,
        "Nominal profile lies outside blank longitudinal reference");
      assert.ok(v>=-depth-1e-7&&v<=1e-7,
        "Nominal profile lies outside blank normal depth");
    }
  }
});
test("P1 measured stringer raw stock visualizes too-short stock without falsely claiming bearing",()=>{
  const base={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,
    lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6,blankEndAllowance:1};
  const short=compute("stair-stringer-calculator",{...base,measuredBlankLength:100});
  const long=compute("stair-stringer-calculator",{...base,measuredBlankLength:200});
  assert.equal(short.stockFitsModel,false);
  assert.equal(long.stockFitsModel,true);
  near(short.blankLengthShown,100);near(long.blankLengthShown,200);
  near(value(short,"Reference blank rectangle longitudinal length"),100);
  near(value(long,"Reference blank rectangle longitudinal length"),200);
  near(short.stockAxisSpan,long.stockAxisSpan);
  const endpoints=long.stringerBlankRows.map(r=>r.axisStation);
  near(endpoints[1]-endpoints[0],200);
  near(endpoints[2]-endpoints[3],200);
  near(long.stringerBlankRows[0].normalOffset,0);
  near(long.stringerBlankRows[3].normalOffset,-11.25);
  assert.equal(long.stringerBlankRows.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.elevation)),true);
});
test("P1 stringer independent support X projections expose mismatch without inventing load bearing",()=>{
  const base={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,
    lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6,
    lowerSupportRun:5,upperSupportRun:4};
  const r=compute("stair-stringer-calculator",base);
  assert.equal(r.endProjectionChecks.length,2);
  const [lower,upper]=r.endProjectionChecks;
  near(lower.projectedEndX,-3);near(lower.projectedOutsideSupport,0);
  assert.equal(lower.projectionStatus,"Inside reference");
  near(upper.projectedEndX,136);near(upper.projectedOutsideSupport,2);
  assert.equal(upper.projectionStatus,"Outside reference");
  near(value(r,"Measured end projections outside support references"),1);
  const noSurface=compute("stair-stringer-calculator",{
    ...base,lowerSupportRun:0,upperSupportRun:0
  });
  assert.deepEqual(noSurface.endProjectionChecks,[]);
  assert.equal(noSurface.metrics.some(m=>m.label==="Measured end projections outside support references"),false);
  assert.deepEqual(noSurface.measuredEndCuts,r.measuredEndCuts);
});

test("P1 stringer selected end and default horizontal supports share CORNERS, never a bearing segment",()=>{
  const args={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,
    lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6,
    lowerSupportRun:5,upperSupportRun:4};
  const r=compute("stair-stringer-calculator",args);
  assert.equal(r.endContactChecks.length,2);
  assert.deepEqual(r.endContactChecks.map(c=>c.contactGeometry),
    ["Shared corner only","Shared corner only"]);
  assert.deepEqual(r.endContactChecks.map(c=>c.sharedLineLength),[0,0]);
  assert.deepEqual(r.endContactChecks.map(c=>c.intersectionX),[0,130]);
  assert.deepEqual(r.endContactChecks.map(c=>c.intersectionElevation),[0,105]);
  assert.deepEqual(r.endContactChecks.map(c=>c.cutParameter),[0,0]);
  assert.equal(r.pointOnly2D,2);
  assert.equal(r.unsupported2D,0);
  near(value(r,"End/support pairs touching at one point only"),2);
  near(value(r,"End/support pairs without 2D line intersection"),0);
  // Existing X datum is OUTSIDE at upper endpoint but the two complete
  // finite segments still share their initial corner. These differ.
  assert.equal(r.endProjectionChecks[1].projectionStatus,"Outside reference");
  assert.equal(r.endContactChecks[1].contactGeometry,"Shared corner only");
});
test("P1 stringer measured signed horizontal support Y offsets give exact interior 2D intersections",()=>{
  const a={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,
    lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6,
    lowerSupportRun:5,upperSupportRun:4,
    lowerSupportVerticalOffset:-4.40625,
    upperSupportVerticalOffset:-4.78125};
  const r=compute("stair-stringer-calculator",a);
  const [lower,upper]=r.endContactChecks;
  assert.deepEqual([lower.contactGeometry,upper.contactGeometry],
    ["Single point only","Single point only"]);
  near(lower.supportElevation,-4.40625);
  near(upper.supportElevation,100.21875);
  near(lower.intersectionX,-1.5);
  near(upper.intersectionX,133);
  near(lower.intersectionElevation,-4.40625);
  near(upper.intersectionElevation,100.21875);
  near(lower.cutParameter,.5);
  near(upper.cutParameter,.5);
  near(lower.sharedLineLength,0);near(upper.sharedLineLength,0);
  near(lower.crossingHorizontalMiss,0);near(upper.crossingHorizontalMiss,0);
  near(value(r,"End/support pairs without 2D line intersection"),0);
  near(value(r,"End/support pairs touching at one point only"),2);
  // The 1D endpoint projection STILL says upper is outside by 2in, but
  // crossing of the two COMPLETE finite line segments is at x=133in.
  near(r.endProjectionChecks[1].projectedOutsideSupport,2);
  assert.equal(r.endProjectionChecks[1].projectionStatus,"Outside reference");
  assert.equal(upper.contactGeometry,"Single point only");
  assert.equal(r.supportReferences[0].elevation,-4.40625);
  assert.equal(r.supportReferences[1].elevation,100.21875);
});
test("P1 stringer level miss and X miss are different zero-contact cases",()=>{
  const base={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,
    lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6,
    lowerSupportRun:5,upperSupportRun:4};
  const far=compute("stair-stringer-calculator",{
    ...base,lowerSupportVerticalOffset:1,upperSupportVerticalOffset:1
  });
  assert.deepEqual(far.endContactChecks.map(x=>x.contactGeometry),
    ["No 2D intersection","No 2D intersection"]);
  assert.equal(far.endContactChecks.every(x=>x.cutParameter===null),true);
  assert.equal(far.endContactChecks.every(x=>x.intersectionX===null),true);
  assert.equal(far.endContactChecks.every(x=>x.crossingHorizontalMiss===null),true);
  const beyond=compute("stair-stringer-calculator",{
    ...base,upperSupportVerticalOffset:-8
  });
  const upper=beyond.endContactChecks[1];
  assert.equal(upper.contactGeometry,"No 2D intersection");
  assert.ok(upper.cutParameter>.8&&upper.cutParameter<1);
  assert.ok(upper.crossingHorizontalMiss>0);
  assert.equal(upper.intersectionX,null);
  assert.equal(beyond.unsupported2D,1);
  assert.equal(beyond.pointOnly2D,1);
  const noSupport=compute("stair-stringer-calculator",{
    ...base,lowerSupportRun:0,upperSupportRun:0,
    lowerSupportVerticalOffset:10,upperSupportVerticalOffset:-10
  });
  assert.deepEqual(noSupport.endContactChecks,[]);
  assert.equal(noSupport.metrics.some(x=>
    x.label==="End/support pairs touching at one point only"),false);
});

test("stock cut rows independently conserve cut lengths, kerf, offcuts and quoted purchase cents",()=>{
  const input={length:120,spacing:16,width:1.5,wallHeight:96,
    openingStart:32,openingWidth:36,openingHeight:80,
    studUnitPrice:5.5,headerUnitPrice:14.25};
  for(const [kerf,waste] of [[0,0],[0.125,0],[0.125,10],[0.0625,25]]){
    const r=compute("framing-calculator",{
      ...input,stockKerf:kerf,stockWaste:waste
    });
    const allCutRows=new Set();
    for(const stock of r.stockPlan){
      const cuts=r.stockCuts.filter(c=>c.stockId===stock.stockId);
      assert.equal(cuts.length,stock.cutCount);
      let running=0;
      for(const [i,cut] of cuts.entries()){
        assert.equal(cut.index,i+1);
        assert.equal(cut.kerfBefore,i?kerf:0);
        assert.equal(cut.stockLength,stock.stockLength);
        running+=cut.cutLength+(i?kerf:0);
        assert.ok(Math.abs(cut.runningUsedLength-running)<=1e-6,
          "running physical cut length must include every prior kerf");
        assert.ok(Math.abs(cut.remainingLength-(stock.stockLength-running))<=1e-6,
          "exported remaining source stock does not reconcile");
        const key=stock.stockId+":"+cut.index;
        assert.ok(!allCutRows.has(key));
        allCutRows.add(key);
      }
      assert.ok(Math.abs(stock.usedLength-running)<=1e-6);
      assert.ok(Math.abs(stock.piecesLength+stock.kerfLoss+stock.offcutLength-stock.stockLength)<=1e-6);
      assert.ok(Math.abs(stock.kerfLoss-Math.max(0,cuts.length-1)*kerf)<=1e-6);
    }
    assert.equal(allCutRows.size,r.rows.length);
    let costCents=0;
    for(const item of r.purchaseVariants){
      assert.equal(item.purchaseSticks,item.plannedSticks+item.allowanceSticks);
      if(item.unitPrice===null){
        assert.equal(item.purchaseCost,item.purchaseSticks===0?0:null);
        continue;
      }
      const unitCents=Math.round(item.unitPrice*100);
      assert.equal(item.purchaseCost*100,item.purchaseSticks*unitCents);
      assert.equal(item.plannedCost*100,item.plannedSticks*unitCents);
      assert.equal(item.reserveCost*100,item.allowanceSticks*unitCents);
      costCents+=item.purchaseSticks*unitCents;
    }
    assert.equal(r.costSummary.allPricesEntered,true);
    assert.equal(Math.round(r.costSummary.quotedSubtotal*100),costCents);
    const mmCsv=buildScheduleCsv(r.stockCuts,"mm","Independent stock conservation");
    assert.ok(mmCsv.includes('"Kerf Before (mm)"'));
    assert.ok(mmCsv.includes('"Remaining Length (mm)"'));
    assert.equal(mmCsv.split("\r\n").filter(Boolean).length,r.stockCuts.length+2);
  }
});

test("sub-resolution physical kerf and butt-end gaps are rejected instead of exported as fake zero",()=>{
  const framing={length:120,spacing:16,width:1.5,wallHeight:96,
    openingStart:32,openingWidth:36,openingHeight:80};
  
  const tinyKerf=safeCompute("framing-calculator",{...framing,stockKerf:0.000000001});
  assert.equal(tinyKerf.ok,false);
  assert.match(tinyKerf.error,/coordinate resolution/i);
  const deck={width:120,length:144,board:5.5,gap:.125,stock:60,joists:16,waste:0};
  const tinyButt=safeCompute("deck-material-calculator",{...deck,buttEndGap:0.000000001});
  assert.equal(tinyButt.ok,false);
  assert.match(tinyButt.error,/coordinate resolution/i);
});

test("wall stud layout reports an extended last bay after end overlap",()=>{
  const wall={length:161,spacing:16,studWidth:1.5,height:96,plates:4.5};
  const extended=compute("wall-stud-calculator",wall);
  assert.equal(extended.metrics.find(m=>m.label==="Final bay size").value,17);
  assert.equal(extended.finalBayExceedsNominal,true);
  assert.equal(compute("wall-stud-calculator",{...wall,length:160}).finalBayExceedsNominal,false);
});

test("rise/run rejects an unrepresentable horizontal run",()=>{
  assert.throws(()=>compute("rise-run-calculator",{run:1e-309,rise:36}),/run must be at least/);
  assert.throws(()=>compute("rise-run-calculator",{run:1e-309,rise:0}),/run must be at least/);
  assert.equal(compute("rise-run-calculator",{run:72,rise:36}).metrics.find(m=>m.label==="Grade").value,50);
});
