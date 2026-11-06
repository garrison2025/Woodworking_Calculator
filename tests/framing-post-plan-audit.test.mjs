import {test} from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute,auditFramingStock} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const base={
  length:120,spacing:16,width:1.5,wallHeight:96,
  openingStart:32,openingWidth:36,openingHeight:80,
  studUnitPrice:8,headerUnitPrice:12,stockWaste:10,stockKerf:.125
};
const q=x=>Math.round(x*1e8)/1e8;
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,
  label+" differs: "+a+" vs "+b);

test("Optional end trims and last separation kerf NEVER mutate the certified base purchasing model",()=>{
  const original=compute("framing-calculator",base);
  const review=compute("framing-calculator",{
    ...base,stockAuditMode:1,stockAuditEndTrim:3,
    stockAuditSeverKerf:.125,stockAuditReuseMin:2
  });
  for(const key of ["rows","framingRows","stockPlan","stockCuts","materialSummary",
    "stockComparisons","purchaseVariants","costSummary","optimizerStatus","metrics"])
    assert.deepEqual(review[key],original[key],"review changed base "+key);
  assert.equal(original.stockAudit.enabled,false);
  assert.equal(review.stockAudit.enabled,true);
  assert.equal(review.stockAudit.physicallyFits,false);
  assert.ok(review.stockAudit.failingSticks>0,"must detect base stock not fitting double trim");
  assert.equal(review.stockAudit.rows.length,review.stockPlan.length);
  assert.ok(review.stockAudit.rows.some(row=>row.status==="DOES NOT FIT"));
  assert.ok(review.stockAudit.candidateSticks>0,
    "The audit must still report genuinely unallocated candidate tails");
});

test("Independent raw-source conservation and status for added physical trimming",()=>{
  const inputs=[0,.125,.25].flatMap(sever=>[0,.5,2,3].map(trim=>({trim,sever})));
  for(const {trim,sever} of inputs){
    const out=compute("framing-calculator",{
      ...base,stockAuditMode:1,stockAuditEndTrim:trim,
      stockAuditSeverKerf:sever,stockAuditReuseMin:3
    });
    const summary=out.stockAudit;
    const plan=new Map(out.stockPlan.map(bar=>[bar.stockId,bar]));
    let bad=0,candidates=0,scrap=0;
    for(const row of summary.rows){
      const bar=plan.get(row.stockId);
      assert.ok(bar);
      const raw=bar.actualStockLength,used=bar.usedLength;
      const tailExists=raw-(trim+used)>1e-12;
      const terminal=tailExists?sever:0;
      const required=trim+used+trim+terminal;
      const rest=raw-required;
      const fits=rest>=-1e-12;
      const reusable=fits&&rest>=3-1e-12;
      close(row.adjustedFirstCutStart,trim,"trimmed first position");
      close(row.adjustedLastCutEnd,q(trim+used),"last cut");
      close(row.finalSeverKerf,terminal,"terminal separation kerf");
      close(row.requiredLength,q(required),"conservative required source");
      close(row.shortfallLength,q(fits?0:-rest),"shortfall");
      close(row.usableOffcutLength,q(fits?Math.max(0,rest):0),"tail");
      assert.equal(row.reuseEligible,reusable);
      if(!fits)bad++;
      if(reusable){candidates++;scrap+=row.usableOffcutLength;}
      assert.equal(row.status,!fits?"DOES NOT FIT":
        reusable?"REUSE CANDIDATE":"FITS — NO REUSE CLAIM");
    }
    assert.equal(summary.physicallyFits,bad===0);
    assert.equal(summary.failingSticks,bad);
    assert.equal(summary.candidateSticks,candidates);
    close(summary.candidateTotalLength,q(scrap),"candidate total");
    // Audit candidate quantities are not purchases and cannot reduce buy cost.
    assert.equal(out.costSummary.quotedSubtotal,
      compute("framing-calculator",base).costSummary.quotedSubtotal);
  }
});

test("Offcut candidates require a positive threshold and NEVER imply reclaimed cuts or discounts",()=>{
  const all=compute("framing-calculator",{...base,stockAuditMode:1,
    stockAuditEndTrim:0,stockAuditSeverKerf:0,stockAuditReuseMin:2});
  const disabled=compute("framing-calculator",{...base,stockAuditMode:1,
    stockAuditEndTrim:0,stockAuditSeverKerf:0,stockAuditReuseMin:0});
  assert.ok(all.stockAudit.candidateSticks>0);
  assert.equal(disabled.stockAudit.candidateSticks,0);
  assert.equal(disabled.stockAudit.candidateTotalLength,0);
  assert.deepEqual(all.stockPlan,disabled.stockPlan);
  assert.deepEqual(all.stockCuts,disabled.stockCuts);
  assert.deepEqual(all.purchaseVariants,disabled.purchaseVariants);
  assert.deepEqual(all.costSummary,disabled.costSummary);
  for(const row of all.stockAudit.rows.filter(r=>r.reuseEligible)){
    assert.ok(row.usableOffcutLength>=2-1e-12);
    assert.ok(["Stud","Header","Sill"].includes(row.stockGroup));
    assert.ok(row.status==="REUSE CANDIDATE");
  }
});

test("Exactly-fit raw source, source epsilon and trimmed-offcut units remain explicit",()=>{
  const raw=[{stockId:"STUD-TEST",stockGroup:"Stud",offerLabel:"Base",
    stockLength:96.00000001,actualStockLength:96.000000006,
    usedLength:96,cutCount:1}];
  const pass=auditFramingStock(raw,{endTrim:0,finalSeverKerf:0,reuseMin:1});
  assert.equal(pass.physicallyFits,true);
  assert.equal(pass.candidateSticks,0);
  const fail=auditFramingStock(raw,{endTrim:0,finalSeverKerf:.125,reuseMin:0});
  assert.equal(fail.physicallyFits,false,
    "Slightly too short for final severing MUST be detected at physical length");
  assert.equal(fail.failingSticks,1);
  for(const unit of ["in","mm","cm","m"]){
    const rows=compute("framing-calculator",{...base,stockAuditMode:1,
      stockAuditEndTrim:1,stockAuditSeverKerf:.125,
      stockAuditReuseMin:2}).stockAudit.rows;
    const csv=buildScheduleCsv(rows,unit,"DIAGNOSTIC ONLY; no procurement count changes");
    const cols=scheduleColumns(rows,unit);
    for(const key of ["stockLength","endTrim","adjustedFirstCutStart",
      "adjustedLastCutEnd","finalSeverKerf","usableOffcutLength","shortfallLength"])
      assert.equal(cols.find(col=>col.key===key).kind,"length",key);
    assert.ok(csv.includes('"Stock Id"'));
    assert.ok(csv.includes('"Usable Offcut Length ('+unit+')"'));
    assert.ok(csv.includes('"DOES NOT FIT"'));
    assert.equal(csv.split("\r\n").filter(Boolean).length,rows.length+2);
  }
});

test("Audit invalid mode or sub-resolution and negative loss cannot fake a clean plan",()=>{
  for(const extra of [
    {stockAuditMode:3},{stockAuditMode:1,stockAuditEndTrim:1e-9},
    {stockAuditMode:1,stockAuditSeverKerf:1e-9},
    {stockAuditMode:1,stockAuditReuseMin:1e-9},
    {stockAuditMode:1,stockAuditEndTrim:-1}
  ]){
    const response=safeCompute("framing-calculator",{...base,...extra});
    assert.equal(response.ok,false,"must reject "+JSON.stringify(extra));
  }
  const inactive=compute("framing-calculator",{
    ...base,stockAuditMode:0,stockAuditEndTrim:3,
    stockAuditSeverKerf:.125,stockAuditReuseMin:2});
  assert.equal(inactive.stockAudit.enabled,false);
  assert.deepEqual(inactive.purchaseVariants,compute("framing-calculator",base).purchaseVariants);
});
