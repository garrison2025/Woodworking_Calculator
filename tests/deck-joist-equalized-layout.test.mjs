import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,buildMetricsCsv,scheduleColumns} from "../src/cut-list.mjs";

const input={width:120,length:140,board:5.5,gap:.125,stock:144,joists:16,waste:10};
const metric=(r,name)=>{const x=r.metrics.find(m=>m.label===name);assert.ok(x,`missing metric: ${name}`);return x.value;};
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`expected ${a} ≈ ${b}`);

test("legacy deck fixed-OC mode remains the default with the original shortened last bay",()=>{
  const original=compute("deck-material-calculator",input);
  const explicit=compute("deck-material-calculator",{...input,joistLayoutMode:0});
  assert.deepEqual(original,explicit);
  assert.deepEqual(original.joistGrid,[0,16,32,48,64,80,96,112,128,140]);
  assert.equal(original.metrics.some(m=>m.label==="Equalized joist bays"),false);
});

test("equalized joist grid shares centerlines evenly within user-verified maximum OC",()=>{
  const r=compute("deck-material-calculator",{...input,joistLayoutMode:1});
  assert.equal(r.deckJoistLayoutMode,1);
  assert.equal(r.deckVerifiedMaxJoistOC,16);
  assert.equal(metric(r,"Equalized joist bays"),9);
  assert.equal(metric(r,"Joist reference lines"),10);
  near(metric(r,"Entered verified maximum OC"),16);
  near(metric(r,"Actual equalized joist OC"),140/9);
  near(metric(r,"Final joist bay"),140/9,2e-8);
  assert.equal(r.joistGrid.length,10);
  assert.equal(r.joistGrid[0],0);
  assert.equal(r.joistGrid.at(-1),140);
  const bays=r.joistGrid.slice(1).map((pos,i)=>pos-r.joistGrid[i]);
  assert.ok(bays.every(w=>w>0&&w<=16+1e-8));
  assert.ok(bays.every(w=>Math.abs(w-140/9)<=2e-8));
  assert.ok(r.joistGrid[1]!==16,"equalized is a new plan, not the legacy fixed grid");
  assert.deepEqual(r.rows.filter(row=>row.type==="Joist center").map(row=>row.joistCenter),
    r.joistGrid);
});

test("equalized grid supports exact divisor lengths without phantom bay",()=>{
  const r=compute("deck-material-calculator",{...input,length:160,joistLayoutMode:1});
  assert.deepEqual(r.joistGrid,Array.from({length:11},(_,i)=>i*16));
  assert.equal(metric(r,"Equalized joist bays"),10);
  near(metric(r,"Actual equalized joist OC"),16);
});

test("equalized joist centers remain identical across cost, cut rows, PNG/SVG source grid and metric CSV",()=>{
  const r=compute("deck-material-calculator",{
    ...input,joistLayoutMode:1,stock:90,
    joistStockLength:144,joistUnitPrice:9,boardUnitPrice:8,
    fastenerPackPrice:10,fastenersPerContact:2});
  const centers=r.rows.filter(row=>row.type==="Joist straight cut");
  assert.equal(centers.length,r.joistGrid.length);
  assert.deepEqual(centers.map(row=>row.joistCenter),r.joistGrid);
  assert.ok(r.rows.filter(row=>row.type==="Decking").every(row=>
    row.buttJointAtEnd===null||r.joistGrid.includes(row.buttJointAtEnd)));
  assert.equal(r.deckCostSummary.joistStockCount,r.joistGrid.length);
  assert.equal(r.deckPurchaseRows.at(-1).plannedQuantity,r.joistGrid.length);
  assert.equal(metric(r,"Board-joist intersections"),metric(r,"Deck rows")*r.joistGrid.length);
  assert.ok(r.deckFastenerRows.every(row=>row.joistReferences===r.joistGrid.length));
  const csv=buildScheduleCsv(r.rows,"mm","geometry reference, no structural approval");
  const header=scheduleColumns(r.rows,"mm").find(c=>c.key==="joistCenter");
  assert.equal(header.label,"Joist Center (mm)");
  assert.ok(csv.includes('"Joist Center (mm)"'));
  assert.ok(csv.includes('"395.111111"')||csv.includes('"395.1111112"'),
    "equalized 15.5556in first center exported in millimeters");
  const metrics=buildMetricsCsv(r.metrics,"in","layout checked");
  assert.ok(metrics.includes('"Actual equalized joist OC"'));
  assert.ok(metrics.includes('"Equalized joist bays"'));
});

test("equalized nonstructural layout rejects invalid option and impossible tiny/too-many grids",()=>{
  const cases=[
    [{joistLayoutMode:-1},/whole number between 0 and 1/i],
    [{joistLayoutMode:2},/whole number between 0 and 1/i],
    [{joistLayoutMode:0.5},/whole number between 0 and 1/i],
    [{joistLayoutMode:1,joists:0},/joists must be greater than zero/i],
    [{joistLayoutMode:1,joists:.0001},/too many equalized joist bays/i],
    [{joistLayoutMode:1,length:0},/length must be greater than zero/i]
  ];
  for(const [extra,error] of cases){
    const result=safeCompute("deck-material-calculator",{...input,...extra});
    assert.equal(result.ok,false,JSON.stringify(extra));
    assert.match(result.error,error);
  }
});

test("the equalized mode never substitutes a structural span or code lookup",()=>{
  const r=compute("deck-material-calculator",{...input,joistLayoutMode:1});
  assert.equal(Object.hasOwn(r,"codeCompliance"),false);
  assert.equal(Object.hasOwn(r,"approvedJoistSpan"),false);
  assert.ok(!r.metrics.some(m=>/allowable span|safe spacing|compliance/i.test(m.label)));
});
