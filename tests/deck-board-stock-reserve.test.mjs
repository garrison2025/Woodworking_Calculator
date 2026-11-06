import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute,convertToInches} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const base={width:95,length:120,board:5.5,gap:0.25,stock:60,waste:10};
const metric=(r,label)=>{const m=r.metrics.find(x=>x.label===label);assert.ok(m,label);return m.value;};
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,String(a)+" != "+b);

test("two physically reserved end trims plus a charged kerf change a close-to-fit stock count",()=>{
 const raw=compute("deck-board-calculator",base);
 assert.equal(raw.rows.length,17);
 near(metric(raw,"Last rip width"),3);
 assert.equal(metric(raw,"Stock pieces per row (unverified joints)"),2);
 assert.equal(metric(raw,"Stock pieces: no offcut reuse"),38);
 const r=compute("deck-board-calculator",{...base,boardEndTrim:.75,boardCrosscutKerf:.125});
 near(metric(r,"Measured stock length"),60);
 near(metric(r,"Two end trims plus reserved crosscut kerf"),1.625);
 near(metric(r,"Usable stock length after allowance"),58.375);
 assert.equal(metric(r,"Nominal pieces per row (no loss reserve)"),2);
 assert.equal(metric(r,"Stock pieces per row (unverified joints)"),3);
 assert.equal(metric(r,"Rows needing unverified butt-joint locations"),17);
 assert.equal(metric(r,"Stock pieces: no offcut reuse"),57);
 assert.equal(r.deckBoardStock.requiresJointPlan,true);
 assert.equal(r.deckBoardStock.piecesPerRow,3);
 assert.equal(r.deckBoardStock.nominalPiecesPerRow,2);
 near(r.deckBoardStock.usableStockLength,58.375);
 near(r.rows.reduce((sum,row)=>sum+row.right-row.left,0)+16*.25,95);
 for(const unit of ["in","mm"]){
  const csv=buildScheduleCsv(r.rows,unit,"Dimension planning only — seams not verified");
  const cols=scheduleColumns(r.rows,unit);
  assert.ok(cols.some(c=>c.label==="Rip Width ("+unit+")"));
  assert.ok(csv.includes('"Row 17"'));
  assert.ok(!csv.includes("NaN"));
 }
});

test("crosscut allowance does not silently treat an exact nominal stock fit as buildable",()=>{
 const a={width:12,length:120,board:5.5,gap:.125,stock:120,waste:0};
 const nominal=compute("deck-board-calculator",a);
 assert.equal(nominal.deckBoardStock.piecesPerRow,1);
 const adjusted=compute("deck-board-calculator",{...a,boardEndTrim:.25,boardCrosscutKerf:.125});
 near(adjusted.deckBoardStock.usableStockLength,119.375);
 assert.equal(adjusted.deckBoardStock.nominalPiecesPerRow,1);
 assert.equal(adjusted.deckBoardStock.piecesPerRow,2);
 assert.equal(adjusted.deckBoardStock.requiresJointPlan,true);
 const one=compute("deck-board-calculator",{...a,length:119.375,
  boardEndTrim:.25,boardCrosscutKerf:.125});
 assert.equal(one.deckBoardStock.piecesPerRow,1);
 assert.equal(one.deckBoardStock.requiresJointPlan,false);
 near(metric(one,"Usable stock length after allowance"),119.375);
});

test("stock-loss planning rejects negative, sub-resolution, consumed or absurd inputs",()=>{
 for(const patch of [
  {boardEndTrim:-.01},{boardCrosscutKerf:-.01},
  {boardEndTrim:1e-9},{boardCrosscutKerf:1e-9},
  {stock:1,boardEndTrim:.5},{stock:1,boardEndTrim:.49999998,boardCrosscutKerf:.00000003},
  {length:50000,stock:1},{length:5000000,stock:100},
 ]){
  const r=safeCompute("deck-board-calculator",{...base,...patch});
  assert.equal(r.ok,false,JSON.stringify(patch));
  assert.ok(r.error.length>10,JSON.stringify(patch));
 }
});

test("metric entry has same internal stock count as inch entry when all dimensions are converted from millimeters",()=>{
 const src={...base,boardEndTrim:.75,boardCrosscutKerf:.125};
 const mm=Object.fromEntries(Object.entries(src).map(([k,v])=>
   [k,["width","length","board","gap","stock","boardEndTrim","boardCrosscutKerf"].includes(k)?
     convertToInches(v*25.4,"mm"):v]));
 const a=compute("deck-board-calculator",src),b=compute("deck-board-calculator",mm);
 assert.equal(metric(a,"Stock pieces: no offcut reuse"),metric(b,"Stock pieces: no offcut reuse"));
 near(a.deckBoardStock.usableStockLength,b.deckBoardStock.usableStockLength,1e-7);
 assert.deepEqual(a.rows,b.rows);
});
