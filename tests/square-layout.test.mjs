import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const metric=(r,label)=>{
  const x=r.metrics.find(m=>m.label===label);
  assert.ok(x,"Missing metric: "+label);
  return x.value;
};
const near=(actual,expected,tol=1e-8)=>
  assert.ok(Math.abs(actual-expected)<=tol,"Expected "+expected+", got "+actual);

test("square checker measures both target errors and A-B spread independently",()=>{
  const a={width:36,length:48,measuredA:59.875,measuredB:60,tolerance:.125};
  const r=compute("square-layout-calculator",a);
  assert.equal(r.shape,"rectangle");
  near(metric(r,"Ideal right-angle diagonal"),60);
  near(metric(r,"Diagonal A error"),-.125);
  near(metric(r,"Diagonal B error"),0);
  near(metric(r,"Difference between measured diagonals"),.125);
  near(metric(r,"Maximum absolute diagonal target error"),.125);
  near(metric(r,"Chosen diagonal check tolerance"),.125);
  near(metric(r,"Numeric checks within tolerance (of 3)"),3);
  assert.deepEqual(r.rows.map(x=>x.item),["Diagonal A","Diagonal B","A vs B spread"]);
  assert.deepEqual(r.rows.map(x=>x.checkResult),Array(3).fill("Within stated tolerance"));
  assert.deepEqual(r.rows.map(x=>x.measuredDiagonal),[59.875,60,.125]);
  assert.equal(r.rectWidth,36);assert.equal(r.rectHeight,48);
  near(r.idealDiagonal,60);
});

test("equal but wrong measured diagonals are NOT treated as matching the intended rectangle",()=>{
  const r=compute("square-layout-calculator",{width:36,length:48,measuredA:65,measuredB:65,tolerance:.125});
  near(metric(r,"Difference between measured diagonals"),0);
  near(metric(r,"Diagonal A error"),5);
  near(metric(r,"Diagonal B error"),5);
  assert.equal(r.withinCount,1);
  assert.deepEqual(r.rows.map(x=>x.checkResult),[
    "Outside stated tolerance","Outside stated tolerance","Within stated tolerance"
  ]);
});

test("one target diagonal in tolerance cannot override out-of-range second and spread",()=>{
  const r=compute("square-layout-calculator",{width:36,length:48,measuredA:60,measuredB:60.25,tolerance:.125});
  assert.equal(r.withinCount,1);
  near(metric(r,"Difference between measured diagonals"),.25);
  assert.equal(r.rows[1].checkResult,"Outside stated tolerance");
  assert.equal(r.rows[2].checkResult,"Outside stated tolerance");
});

test("Pythagorean target, boundary-inclusive checks and user tolerance scale consistently",()=>{
  for(const scale of [.1,1,12,120]){
    const ideal=5*scale,offset=scale*.0125;
    const r=compute("square-layout-calculator",{
      width:3*scale,length:4*scale,
      measuredA:ideal-offset,measuredB:ideal,tolerance:offset
    });
    near(metric(r,"Ideal right-angle diagonal"),ideal,1e-7);
    assert.equal(r.withinCount,3);
  }
  const exact=compute("square-layout-calculator",{width:3,length:4,measuredA:5,measuredB:5,tolerance:0});
  assert.equal(exact.withinCount,3);
  assert.equal(safeCompute("square-layout-calculator",{width:3,length:4,measuredA:5,measuredB:5,tolerance:-.001}).ok,false);
  assert.equal(safeCompute("square-layout-calculator",{width:0,length:4,measuredA:5,measuredB:5,tolerance:0}).ok,false);
});

test("square-check CSV keeps numeric lengths and text check results separate",()=>{
  const r=compute("square-layout-calculator",{width:36,length:48,measuredA:65,measuredB:65,tolerance:.125});
  const cols=scheduleColumns(r.rows,"mm");
  assert.ok(cols.some(x=>x.label==="Measured Diagonal (mm)"&&x.kind==="length"));
  assert.ok(cols.some(x=>x.label==="Check Result"&&x.kind==="plain"));
  const csv=buildScheduleCsv(r.rows,"mm","Comparison only, not a corner-angle survey");
  assert.ok(csv.includes('"Target Diagonal (mm)","Measured Diagonal (mm)","Signed Error (mm)","Absolute Error (mm)","Allowed Deviation (mm)","Check Result"'));
  assert.ok(csv.includes('"Outside stated tolerance"'));
  assert.ok(csv.includes('"Within stated tolerance"'));
  assert.equal(csv.split("\r\n").length,5);
});
