import test from "node:test";
import assert from "node:assert/strict";
import {reallocateFramingOffcuts} from "../src/calcs.mjs";
import {makeFramingStationLedger,auditMeasuredFramingFits,
  assessFramingPurchaseReview} from "../src/framing-stations.mjs";
import {scheduleColumns,buildScheduleCsv} from "../src/cut-list.mjs";

const source=(stockId,parts)=>({
  stockGroup:"Stud",stockId,offerLabel:"Base",offerCode:"B96",
  stockLength:96,actualStockLength:96,unitPrice:10.5,
  cuts:parts.map(([item,cutLength])=>({item,type:"Stud",cutLength})),
  cutCount:parts.length,
  usedLength:parts.reduce((sum,p)=>sum+p[1],0)+
    (parts.length-1)*.125
});
const setup=()=>{
  const original=[
    source("STUD-001",[["A",50]]),
    source("STUD-002",[["B",40]]),
    source("STUD-003",[["C",30]])
  ];
  const alternate=reallocateFramingOffcuts(original,{
    kerf:.125,reuseMin:10,allowance:10
  });
  assert.equal(alternate.status,"reallocated");
  const ledger=makeFramingStationLedger(alternate,original);
  const allLengths=Object.fromEntries(ledger.bars.map(b=>[b.stockId,96]));
  const review=lengths=>auditMeasuredFramingFits(ledger,lengths,{
    sawKerf:.125,endTrim:0,finalSeverKerf:0
  });
  const stocks=Object.fromEntries(ledger.bars.map(b=>[b.stockId,{
    profileGradeReviewed:true,defectsReviewed:true
  }]));
  const globalChecks={
    sawSafetyReviewed:true,structuralReviewed:true,
    supplierVerified:true,totalCostReviewed:true
  };
  return {original,alternate,ledger,allLengths,review,stocks,globalChecks};
};
const gate=(f,measurements=f.review(f.allLengths),stocks=f.stocks,
  global=f.globalChecks,quote=f.alternate)=>
  assessFramingPurchaseReview(f.ledger,measurements,stocks,global,quote);

test("All source and supplier declarations omitted: fail closed even with full modeled source fit",()=>{
  const f=setup();
  const absent=assessFramingPurchaseReview(f.ledger,f.review(f.allLengths),
    {},{},f.alternate);
  assert.equal(absent.available,true);
  assert.equal(absent.reviewed,0);
  assert.equal(absent.unreviewed,f.ledger.bars.length);
  assert.equal(absent.globalPending.length,4);
  assert.equal(absent.quoteComplete,true);
  assert.match(absent.status,/HOLD — STOCK INSPECTION/);
  assert.equal(absent.reviewPacketComplete,false);
  assert.equal(absent.humanApprovalRequired,true);
  assert.equal(absent.automaticPurchaseAuthorized,false);
  const notMeasured=gate(f,f.review({}));
  assert.equal(notMeasured.shortOrInvalid,f.ledger.bars.length);
  assert.match(notMeasured.status,/HOLD — DIMENSION/);
});

test("User-checked review can only complete self-reported packet; never authorizes a purchase",()=>{
  const f=setup();
  const inputs=JSON.stringify(f);
  const checked=gate(f);
  assert.equal(checked.total,2);
  assert.equal(checked.reviewed,2);
  assert.equal(checked.shortOrInvalid,0);
  assert.equal(checked.globalPending.length,0);
  assert.equal(checked.reviewPacketComplete,true);
  assert.equal(checked.status,
    "SELF-DECLARED REVIEW COMPLETE — HUMAN AUTHORIZATION REQUIRED");
  assert.equal(checked.automaticPurchaseAuthorized,false);
  assert.equal(checked.humanApprovalRequired,true);
  assert.equal(checked.currencyClaim,"MODEL QUOTE ONLY — NEVER AN INVOICE");
  assert.equal(checked.reviewedQuotedSubtotal,f.alternate.reallocatedQuotedSubtotal);
  assert.equal(JSON.stringify(f),inputs,"review must not alter source geometry, quotes or input declarations");
});

test("Any individual source declaration or global signoff left unmarked keeps review on hold",()=>{
  const f=setup(),id=f.ledger.bars[0].stockId;
  const noGrade=structuredClone(f.stocks);
  noGrade[id].profileGradeReviewed=false;
  const missingSource=gate(f,undefined,noGrade);
  assert.equal(missingSource.unreviewed,1);
  assert.match(missingSource.status,/HOLD — STOCK INSPECTION/);
  assert.equal(missingSource.rows.find(r=>r.stockId===id).profileGradeReviewed,false);
  const noDefect=structuredClone(f.stocks);
  noDefect[id].defectsReviewed=false;
  assert.equal(gate(f,undefined,noDefect).reviewPacketComplete,false);
  for(const key of Object.keys(f.globalChecks)){
    const checks={...f.globalChecks,[key]:false};
    const incomplete=gate(f,undefined,f.stocks,checks);
    assert.match(incomplete.status,/HOLD — PURCHASE AND SAFETY/);
    assert.deepEqual(incomplete.globalPending,[key]);
    assert.equal(incomplete.automaticPurchaseAuthorized,false);
  }
});

test("A short real source overrides every optimistic checked declaration",()=>{
  const f=setup(),shortId=f.ledger.bars[0].stockId;
  const measured=f.review({...f.allLengths,[shortId]:1});
  const report=gate(f,measured);
  assert.equal(report.shortOrInvalid,1);
  assert.equal(report.reviewPacketComplete,false);
  assert.match(report.status,/HOLD — DIMENSION/);
  assert.equal(report.rows.find(r=>r.stockId===shortId).sourceStatus,"HOLD — DIMENSIONS");
  assert.equal(report.automaticPurchaseAuthorized,false);
});

test("Quoted supplier costs must independently reconcile; missing or changed quote blocks review",()=>{
  const f=setup();
  const noPrices=structuredClone(f.alternate);
  noPrices.purchaseVariants[0].unitPrice=null;
  noPrices.purchaseVariants[0].purchaseCost=null;
  noPrices.reallocatedQuotedSubtotal=null;
  const incomplete=gate(f,undefined,f.stocks,f.globalChecks,noPrices);
  assert.equal(incomplete.quoteComplete,false);
  assert.match(incomplete.status,/SUPPLIER PRICES UNQUOTED/);
  assert.equal(incomplete.reviewPacketComplete,false);
  const tampered=structuredClone(f.alternate);
  tampered.purchaseVariants[0].purchaseCost+=1;
  assert.equal(gate(f,undefined,f.stocks,f.globalChecks,tampered).quoteComplete,false);
  const tamperedTotal=structuredClone(f.alternate);
  tamperedTotal.reallocatedQuotedSubtotal+=5;
  assert.equal(gate(f,undefined,f.stocks,f.globalChecks,tamperedTotal).quoteComplete,false);
  const zeroQuote=structuredClone(f.alternate);
  zeroQuote.purchaseVariants[0].unitPrice=0;
  assert.equal(gate(f,undefined,f.stocks,f.globalChecks,zeroQuote).quoteComplete,false);
});

test("No fabricated approval when alternative plan is blocked, missing, or member IDs mismatch",()=>{
  const f=setup();
  const none=assessFramingPurchaseReview({available:false},null,{}, {},null);
  assert.equal(none.available,false);
  assert.equal(none.reviewPacketComplete,false);
  assert.equal(none.automaticPurchaseAuthorized,false);
  const corrupt=structuredClone(f.review(f.allLengths));
  corrupt.rows.pop();
  assert.throws(()=>gate(f,corrupt),/missing a stock dimension row/i);
  const dup=structuredClone(f.review(f.allLengths));
  dup.rows[1].stockId=dup.rows[0].stockId;
  assert.throws(()=>gate(f,dup),/Duplicate measured physical stock/i);
});

test("Exported purchasing review records preserve statuses, model cost denomination and no authorization",()=>{
  const f=setup(),report=gate(f);
  const rows=report.rows.map(row=>({...row,packetStatus:report.status,
    sourceInspectionClaim:"USER DECLARATIONS ONLY",
    sawSafetyReviewed:report.globalChecks.sawSafetyReviewed,
    structuralReviewed:report.globalChecks.structuralReviewed,
    supplierVerified:report.globalChecks.supplierVerified,
    totalCostReviewed:report.globalChecks.totalCostReviewed,
    modelQuoteCost:report.reviewedQuotedSubtotal,
    currency:"USD",humanApprovalRequired:true,
    automaticPurchaseAuthorized:false}));
  for(const unit of ["in","ft","mm","cm","m"]){
    const cols=scheduleColumns(rows,unit);
    assert.equal(cols.find(c=>c.key==="enteredLength").kind,"length");
    assert.equal(cols.find(c=>c.key==="modelStockLength").kind,"length");
    assert.equal(cols.find(c=>c.key==="modelQuoteCost").kind,"plain",
      "Supplier cost must never be converted to length units.");
    const csv=buildScheduleCsv(rows,unit,"NOT A PURCHASE APPROVAL");
    assert.ok(csv.includes('"Model Quote Cost"'));
    assert.ok(csv.includes('"Human Approval Required"'));
    assert.ok(csv.includes('"SELF-DECLARED REVIEW COMPLETE — HUMAN AUTHORIZATION REQUIRED"'));
    assert.ok(csv.includes('"false"'));
    assert.ok(csv.includes('"USD"'));
    assert.equal(csv.split("\r\n").filter(Boolean).length,rows.length+2);
  }
});
