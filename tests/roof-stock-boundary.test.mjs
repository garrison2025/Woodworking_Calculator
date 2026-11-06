import {test} from "node:test";
import assert from "node:assert/strict";
import {packRoofCutBoxes,compute} from "../src/calcs.mjs";
import {buildScheduleCsv} from "../src/cut-list.mjs";

const piece=(id,width,height=10)=>({
  id,row:1,column:1,plane:"Independent stock bound test",
  width,height,actualArea:width*height,
  vertices:[[0,0],[width,0],[width,height],[0,height]]
});
const assertStockBounds=(plan)=>{
  for(const row of plan.rows){
    assert.ok(row.stockX>=0&&row.stockY>=0,
      row.item+" has a negative stock origin");
    assert.ok(row.stockX+row.boxWidth<=Math.round(plan.stockWidth*1e8)/1e8+1e-12,
      row.item+" overhangs the stock right edge");
    assert.ok(row.stockY+row.boxHeight<=Math.round(plan.stockHeight*1e8)/1e8+1e-12,
      row.item+" overhangs the stock upper edge");
    for(const [x,y] of row.stockCutVertices){
      assert.ok(x>=row.stockX-1e-8&&
        x<=row.stockX+row.boxWidth+1e-8&&
        y>=row.stockY-1e-8&&y<=row.stockY+row.boxHeight+1e-8,
        "polygon outside allocated stock rectangle");
    }
  }
};

test("A physically oversized cut never fits on an entire stock sheet through tolerance",()=>{
  const oversized=piece("A",10.00000005);
  assert.throws(()=>packRoofCutBoxes([oversized],10,10,0),
    /cannot fit the full stock sheet/);
  const exact=packRoofCutBoxes([piece("A",10)],10,10,0);
  assert.equal(exact.stockCount,1);
  assertStockBounds(exact);
});

test("Cut wider than a free slot by 0.00000005 inches opens another stock instead of overlapping",()=>{
  const items=[piece("A",5),piece("B",5.00000005)];
  const plan=packRoofCutBoxes(items,10,10,0);
  assert.equal(plan.stockCount,2,
    "Before fix both pieces fit one 10-in sheet by exceeding a free slot");
  assert.equal(plan.rows.length,2);
  assertStockBounds(plan);
  assert.equal(new Set(plan.rows.map(r=>r.stockId)).size,2);
  const csv=buildScheduleCsv(plan.rows,"mm","Independent bounding-box boundary audit");
  assert.ok(csv.includes('"Stock X (mm)"'));
  assert.ok(csv.includes('"Stock Cut Vertices (mm)"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,4);
  const exact=packRoofCutBoxes([piece("A",5),piece("B",5)],10,10,0);
  assert.equal(exact.stockCount,1);
  assertStockBounds(exact);
});

test("Saw kerf prevents adjacency; corner coordinates and stock area still conserve",()=>{
  const cuts=[piece("A",5),piece("B",5)];
  const zero=packRoofCutBoxes(cuts,10,10,0);
  const saw=packRoofCutBoxes(cuts,10,10,0.125);
  assert.equal(zero.stockCount,1);
  assert.equal(saw.stockCount,2);
  for(const p of [zero,saw]){
    assertStockBounds(p);
    const tolerance=Math.max(1e-5,p.stockAreaSqIn*1e-8);
    assert.ok(Math.abs(p.installedAreaSqIn+p.cornerScrapAreaSqIn+
      p.kerfAreaSqIn+p.freeAreaSqIn-p.stockAreaSqIn)<=tolerance);
  }
});

test("Existing hip-roof and flat-roof reuse scenarios still fit inside every stock boundary",()=>{
  const candidates=[
    compute("hip-roof-calculator",{
      width:96,length:192,pitch:6,overhang:12,
      sheetWidth:48,sheetLength:96,orientation:0,reuseMode:1,roofKerf:.125
    }),
    compute("roof-sheathing-calculator",{
      width:70,length:110,pitch:0,sheetWidth:48,sheetLength:96,
      orientation:0,waste:10,reuseMode:1,roofKerf:.125
    })
  ];
  for(const roof of candidates){
    const plan=roof.roofReusePlan;
    assert.ok(plan&&plan.rows.length>0);
    assertStockBounds(plan);
    for(const board of plan.boards)for(let i=0;i<board.placements.length;i++)
      for(let j=i+1;j<board.placements.length;j++){
        const a=board.placements[i],b=board.placements[j];
        const overlapX=Math.min(a.stockX+a.boxWidth,b.stockX+b.boxWidth)-
          Math.max(a.stockX,b.stockX);
        const overlapY=Math.min(a.stockY+a.boxHeight,b.stockY+b.boxHeight)-
          Math.max(a.stockY,b.stockY);
        assert.ok(overlapX<=1e-8||overlapY<=1e-8,"Overlap on "+board.id);
      }
  }
});
