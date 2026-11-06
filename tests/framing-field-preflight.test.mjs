import test from "node:test";
import assert from "node:assert/strict";
import {reallocateFramingOffcuts,compute} from "../src/calcs.mjs";
import {makeFramingStationLedger,auditMeasuredFramingFits} from "../src/framing-stations.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const stock=(id,parts)=>({
  stockGroup:"Stud",stockId:id,offerLabel:"Base",offerCode:"B96",
  unitPrice:10.55,stockLength:96,actualStockLength:96,
  cuts:parts.map(([item,cutLength])=>({item,type:"Stud",cutLength})),
  cutCount:parts.length,
  usedLength:parts.reduce((n,p)=>n+p[1],0)+(parts.length-1)*.125
});
const original=()=>[
  stock("STUD-001",[["A",50]]),stock("STUD-002",[["B",40]]),
  stock("STUD-003",[["C",30]])
];
const setup=()=>{
  const baseline=original();
  const alt=reallocateFramingOffcuts(baseline,{kerf:.125,reuseMin:10});
  assert.equal(alt.status,"reallocated");
  return {baseline,alt,ledger:makeFramingStationLedger(alt,baseline)};
};
const near=(a,b,why)=>assert.ok(Math.abs(a-b)<1e-8,why+": "+a+" vs "+b);

test("Every field datum is PENDING by default; no modeled stock length masquerades as measured",()=>{
  const {ledger}=setup();
  const before=JSON.stringify(ledger);
  const result=auditMeasuredFramingFits(ledger);
  assert.equal(result.available,true);
  assert.equal(result.complete,false);
  assert.equal(result.allDimensionalFit,false);
  assert.equal(result.entered,0);
  assert.equal(result.pending,ledger.bars.length);
  assert.equal(result.fitting,0);
  for(const row of result.rows){
    assert.equal(row.enteredLength,null);
    assert.equal(row.status,"PENDING INPUT");
    assert.equal(row.requiredLength,null);
    assert.equal(row.claim,"DIMENSIONS ONLY — NOT FIELD CERTIFIED");
  }
  assert.equal(JSON.stringify(ledger),before);
});

test("User-entered saw/trim values independently recompute all member clearances, never change sources",()=>{
  const {ledger,baseline,alt}=setup();
  const baselineCopy=JSON.stringify(baseline),altCopy=JSON.stringify(alt);
  const lengths=Object.fromEntries(ledger.bars.map(x=>[x.stockId,96]));
  const fit=auditMeasuredFramingFits(ledger,lengths,{
    sawKerf:.125,endTrim:1,finalSeverKerf:.125
  });
  assert.equal(fit.complete,true);
  assert.equal(fit.fitting,ledger.bars.length);
  assert.equal(fit.short,0);
  assert.equal(fit.allDimensionalFit,true);
  for(const row of fit.rows){
    const members=ledger.rows.filter(r=>r.stockId===row.stockId&&
      r.segmentKind==="RETAINED MEMBER");
    const physicalSum=members.reduce((n,p)=>n+p.segmentLength,0);
    const modeledCutEnd=1+physicalSum+(members.length-1)*.125;
    const measuredSever=96-modeledCutEnd>1e-12?.125:0;
    const need=modeledCutEnd+1+measuredSever;
    near(row.requiredLength,need,"independently required physical length");
    near(row.clearance,96-need,"remaining length");
    assert.equal(row.status,"DIMENSION FIT ONLY");
  }
  const first=fit.rows[0];
  const tooShort=auditMeasuredFramingFits(ledger,{...lengths,[first.stockId]:20},{
    sawKerf:.125,endTrim:1,finalSeverKerf:.125
  });
  assert.equal(tooShort.short,1);
  assert.equal(tooShort.fitting,fit.rows.length-1);
  assert.equal(tooShort.allDimensionalFit,false);
  assert.ok(tooShort.rows.find(r=>r.stockId===first.stockId).shortfall>0);
  assert.equal(JSON.stringify(baseline),baselineCopy);
  assert.equal(JSON.stringify(alt),altCopy);
});

test("All global settings require explicit numbers including an explicitly measured zero",()=>{
  const {ledger}=setup();
  const id=ledger.bars[0].stockId;
  const missing=auditMeasuredFramingFits(ledger,{[id]:96},{
    sawKerf:0,endTrim:0,finalSeverKerf:null
  });
  assert.equal(missing.fitting,0);
  assert.equal(missing.pending,ledger.bars.length);
  const zeros=auditMeasuredFramingFits(ledger,{[id]:96},{
    sawKerf:0,endTrim:0,finalSeverKerf:0
  });
  assert.equal(zeros.fitting,1);
  assert.equal(zeros.pending,ledger.bars.length-1);
  const invalid=auditMeasuredFramingFits(ledger,{[id]:96},{
    sawKerf:1e-9,endTrim:0,finalSeverKerf:0
  });
  assert.equal(invalid.invalid,ledger.bars.length);
  assert.equal(invalid.allDimensionalFit,false);
  const negative=auditMeasuredFramingFits(ledger,{[id]:-1},{
    sawKerf:.125,endTrim:0,finalSeverKerf:0
  });
  assert.equal(negative.invalid,1);
  assert.equal(negative.complete,false);
});

test("Sub-quantum actual shortfall is still short; exact source needs no invented terminal saw kerf",()=>{
  const source=stock("STUD-ONLY",[["A",96]]);
  const alt=reallocateFramingOffcuts([source],{
    kerf:.125,reuseMin:1,finalSeverKerf:.125
  });
  const ledger=makeFramingStationLedger(alt,[source]);
  const opts={sawKerf:.125,endTrim:0,finalSeverKerf:.125};
  const exact=auditMeasuredFramingFits(ledger,{"STUD-ONLY":96},opts);
  assert.equal(exact.fitting,1);
  assert.equal(exact.rows[0].chargedLastKerf,0);
  assert.equal(exact.rows[0].clearance,0);
  const short=auditMeasuredFramingFits(ledger,{"STUD-ONLY":95.999999999},opts);
  assert.equal(short.short,1);
  assert.ok(short.rows[0].shortfall>0);
});

test("Per-source measurement CSV has typed numeric dimensions and no invented approvals",()=>{
  const {ledger}=setup();
  const lengths=Object.fromEntries(ledger.bars.map(b=>[b.stockId,96]));
  const checked=auditMeasuredFramingFits(ledger,lengths,{
    sawKerf:.125,endTrim:1,finalSeverKerf:.125
  });
  for(const [unit,factor] of [["in",1],["ft",1/12],["mm",25.4],
    ["cm",2.54],["m",.0254]]){
    const data=checked.rows.map(r=>({...r,enteredBladeKerf:.125,
      enteredEndTrim:1,enteredFinalSeverKerf:.125}));
    const cols=scheduleColumns(data,unit);
    for(const key of ["modelStockLength","enteredLength","requiredLength",
      "retainedLength","clearance","shortfall","enteredBladeKerf"]){
      assert.equal(cols.find(c=>c.key===key)?.kind,"length",
        key+" must be an accurately labeled length");
    }
    const exportText=buildScheduleCsv(data,unit,"USER ENTERED, NOT FIELD VERIFIED");
    assert.ok(exportText.includes('"Entered Length ('+unit+')"'));
    assert.ok(exportText.includes('"DIMENSION FIT ONLY"'));
    assert.ok(exportText.includes('"DIMENSIONS ONLY — NOT FIELD CERTIFIED"'));
    const lines=exportText.replace(/^\uFEFF/,"").split("\r\n").filter(Boolean);
    assert.equal(lines.length,data.length+2);
    const lengthIndex=cols.findIndex(c=>c.key==="enteredLength");
    for(let i=0;i<data.length;i++){
      const cells=lines[i+1].slice(1,-1).split('","');
      near(Number(cells[lengthIndex]),96*factor,"entered length converted "+unit);
    }
  }
});

test("Integration retains original framing buy list, cut CSV and exact-model status",()=>{
  const base={length:120,spacing:16,width:1.5,wallHeight:80,
    openingStart:32,openingWidth:36,openingHeight:60,
    studUnitPrice:8,headerUnitPrice:12,stockKerf:.125};
  const original=compute("framing-calculator",base);
  const alternative=compute("framing-calculator",{
    ...base,stockAuditMode:2,stockAuditReuseMin:2
  });
  const ledger=makeFramingStationLedger(alternative.stockReusePlan,alternative.stockPlan);
  const measurements=Object.fromEntries(ledger.bars.map(b=>[b.stockId,b.stockLength]));
  const review=auditMeasuredFramingFits(ledger,measurements,{
    sawKerf:.125,endTrim:0,finalSeverKerf:0});
  assert.equal(review.allDimensionalFit,true);
  for(const key of ["stockCuts","stockPlan","purchaseVariants",
    "optimizerStatus","costSummary","materialSummary"])
    assert.deepEqual(alternative[key],original[key],"base model must remain unchanged");
});
