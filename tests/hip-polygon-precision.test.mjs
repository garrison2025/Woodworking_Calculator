import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const fixture={width:96,length:192,pitch:0,overhang:0,
  sheetWidth:48,sheetLength:47.999999,orientation:0};
const polygonArea=points=>{
  if(points.length<3)return 0;
  const [ox,oy]=points[0];let total=0;
  for(let i=1;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    total+=(a[0]-ox)*(b[1]-oy)-(b[0]-ox)*(a[1]-oy);
  }
  return Math.abs(total)/2;
};
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,
  "Expected "+a+" ≈ "+b+" (tol "+tol+")");

test("hip: 47.999999-inch sheet grid retains four tiny positive clipped corners",()=>{
  const r=compute("hip-roof-calculator",{...fixture,reuseMode:0});
  assert.equal(r.rows.length,16,
    "Old area<=1e-9 shortcut dropped four real triangular cut pieces");
  assert.equal(r.roofPanels.length,16);
  assert.equal(r.rows.filter(row=>row.cutAreaFt2>0&&row.cutAreaFt2<1e-9/144).length,4);
  assert.equal(new Set(r.roofPanels.map(p=>p.plane)).size,4);
  for(const p of r.roofPanels){
    const actual=polygonArea(p.localVertices);
    assert.ok(actual>0,"cut "+p.id+" has degenerate rounded vertices");
    const localKeys=p.localVertices.map(v=>v.join(","));
    assert.equal(new Set(localKeys).size,localKeys.length,
      p.id+" contains duplicate SVG/cut-list vertices");
    assert.ok(Math.abs(actual-p.cutAreaSqIn)<=Math.max(1e-17,p.cutAreaSqIn*.05),
      p.id+" quantized polygon area is materially different");
    const planArea=polygonArea(p.planPoints);
    assert.ok(planArea>0,p.id+" plan projection unexpectedly collapsed");
  }
  near(r.coveredAreaSqIn,96*192,1e-6);
  near(r.roofPanels.reduce((s,p)=>s+p.cutAreaSqIn,0),r.coveredAreaSqIn,1e-6);
  const csv=buildScheduleCsv(r.rows,"mm");
  assert.ok(csv.includes('"Plan Projection Vertices (mm)"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,18);
  assert.ok(csv.includes('"S16"'));
  const exact=compute("hip-roof-calculator",{...fixture,sheetLength:48,reuseMode:0});
  assert.equal(exact.roofPanels.length,12,
    "Exact zero-area tangencies must not produce fictitious cuts");
});

test("hip: unrecoverably tiny positive corners fail explicitly, not erased",()=>{
  const r=safeCompute("hip-roof-calculator",{
    ...fixture,sheetLength:47.99999998,reuseMode:0
  });
  assert.equal(r.ok,false);
  assert.match(r.error,/sub-resolution|cut-coordinate resolution/);
});

test("hip: reuse stock polygons preserve footprint, kerf, area and unrounded tiny cut quantities",()=>{
  const r=compute("hip-roof-calculator",{
    ...fixture,reuseMode:1,roofKerf:0.125
  });
  const plan=r.roofReusePlan;
  assert.ok(plan);
  assert.equal(plan.rows.length,16);
  assert.ok(plan.stockCount>=1&&plan.stockCount<=16);
  assert.equal(plan.reusedCutCount,16-plan.stockCount);
  assert.ok(plan.kerfAreaSqIn>0);
  const original=new Map(r.roofPanels.map(p=>[p.id,p]));
  for(const item of plan.rows){
    const p=original.get(item.item);
    assert.ok(p);
    assert.ok(item.boxWidth>0&&item.boxHeight>0);
    assert.ok(item.stockX>=0&&item.stockY>=0);
    assert.ok(item.stockX+item.boxWidth<=plan.stockWidth+1e-7);
    assert.ok(item.stockY+item.boxHeight<=plan.stockHeight+1e-7);
    const shapeArea=polygonArea(item.stockCutVertices);
    assert.ok(shapeArea>0);
    near(shapeArea,p.cutAreaSqIn,Math.max(1e-17,p.cutAreaSqIn*.05));
    assert.ok(item.installedAreaFt2>0,
      "Micro-polygon cut area must not be serialized as zero");
    for(const [x,y] of item.stockCutVertices){
      assert.ok(x>=item.stockX-1e-7&&x<=item.stockX+item.boxWidth+1e-7);
      assert.ok(y>=item.stockY-1e-7&&y<=item.stockY+item.boxHeight+1e-7);
    }
  }
  for(const board of plan.boards)for(let i=0;i<board.placements.length;i++)
    for(let j=i+1;j<board.placements.length;j++){
      const a=board.placements[i],b=board.placements[j];
      const overX=Math.min(a.stockX+a.boxWidth,b.stockX+b.boxWidth)-Math.max(a.stockX,b.stockX);
      const overY=Math.min(a.stockY+a.boxHeight,b.stockY+b.boxHeight)-Math.max(a.stockY,b.stockY);
      assert.ok(overX<=1e-7||overY<=1e-7,"Stock rectangles overlap");
    }
  near(plan.installedAreaSqIn+plan.cornerScrapAreaSqIn+
    plan.kerfAreaSqIn+plan.freeAreaSqIn,plan.stockAreaSqIn,
    Math.max(1e-5,plan.stockAreaSqIn*1e-8));
  const cols=scheduleColumns(plan.rows,"mm");
  assert.ok(cols.some(c=>c.label==="Stock Cut Vertices (mm)"));
  assert.ok(cols.some(c=>c.label==="Installed Area (m²)"));
  assert.ok(cols.some(c=>c.label==="Rectangular Box Area (m²)"));
  assert.ok(!cols.some(c=>c.label.includes("Ft2")),
    "Area headings must not mix an imperial field name with a metric unit");
  const csv=buildScheduleCsv(plan.rows,"mm");
  assert.equal(csv.split("\r\n").filter(Boolean).length,18);
  assert.ok(!csv.includes('"Installed Area (m²)","0"'));
});

test("hip: sub-resolution nonzero saw kerf is rejected in the active reuse plan",()=>{
  const r=safeCompute("hip-roof-calculator",{...fixture,
    sheetLength:48,reuseMode:1,roofKerf:1e-9});
  assert.equal(r.ok,false);
  assert.match(r.error,/kerf.*cut-coordinate resolution/i);
  const off=safeCompute("hip-roof-calculator",{...fixture,
    sheetLength:48,reuseMode:0,roofKerf:1e-9});
  assert.equal(off.ok,true,"Dormant optional reuse parameters should not affect simple coverage");
});
