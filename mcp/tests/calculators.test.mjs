import {test} from "node:test";
import assert from "node:assert/strict";
import {riseRun,lumberBoardFeet,balusterSpacing} from "../core.mjs";

function metric(result,label){
  assert.equal(result.ok,true,JSON.stringify(result));
  const m=result.metrics.find(m=>m.label===label);
  assert.ok(m,"Expected metric: "+label);
  return m.value;
}
test("rise/run uses existing WoodLayout slope engine",()=>{
  const r=riseRun({rise:36,run:72});
  assert.ok(Math.abs(metric(r,"Slope angle")-26.565051177)<1e-6);
  assert.equal(metric(r,"Pitch / 12"),6);
  assert.equal(metric(r,"Grade"),50);
  assert.equal(r.source,"https://woodlayout.com/rise-run-calculator/");
});
test("lumber feet and quoted totals are calculated by production engine",()=>{
  const r=lumberBoardFeet({thickness:1,width:6,length:96,quantity:10,
    pricePerBoardFoot:5.5,taxPercent:0});
  assert.equal(metric(r,"Board feet per piece"),4);
  assert.equal(metric(r,"Purchased board feet"),40);
  assert.equal(metric(r,"Total quoted price"),220);
  assert.equal(r.source,"https://woodlayout.com/lumber-price-calculator/");
});
test("lumber quantities always use whole purchased pieces",()=>{
  const r=lumberBoardFeet({thickness:1,width:6,length:96,quantity:3,wastePercent:10});
  assert.equal(metric(r,"Whole purchased pieces including reserve"),4);
});
test("baluster spacing uses engine and returns bounded sample",()=>{
  const r=balusterSpacing({openingLength:96,balusterWidth:1.5,maxClearGap:4});
  assert.equal(metric(r,"Baluster count"),17);
  assert.equal(r.rowCount,17);
  assert.equal(r.rows.length,17);
  assert.equal(r.rowsTruncated,false);
});
test("bad sizes reject rather than execute unbounded calculations",()=>{
  assert.throws(()=>riseRun({rise:10,run:0}),RangeError);
  assert.throws(()=>lumberBoardFeet({thickness:1,width:6,length:96,quantity:10000}),RangeError);
  assert.throws(()=>balusterSpacing({openingLength:100,balusterWidth:1,maxClearGap:Infinity}),RangeError);
});
test("invalid geometry returns a flagged error, not an invented answer",()=>{
  const r=balusterSpacing({openingLength:2,balusterWidth:3,maxClearGap:4});
  assert.equal(r.ok,false);
  assert.ok(r.error);
});
