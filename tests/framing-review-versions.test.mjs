import test from "node:test";
import assert from "node:assert/strict";
import {reallocateFramingOffcuts} from "../src/calcs.mjs";
import {makeFramingStationLedger,auditMeasuredFramingFits,
  assessFramingPurchaseReview} from "../src/framing-stations.mjs";
import {makeFramingReviewVersion,validateFramingReviewVersion,
  compareFramingReviewVersions,framingReviewVersionNote
} from "../src/framing-review-versions.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const mkBar=(stockId,pieces)=>({
  stockGroup:"Stud",stockId,offerCode:"B96",offerLabel:"Base",
  stockLength:96,actualStockLength:96,unitPrice:10.5,
  cuts:pieces.map(([item,cutLength])=>({item,type:"Stud",cutLength})),
  cutCount:pieces.length,
  usedLength:pieces.reduce((sum,c)=>sum+c[1],0)+
    Math.max(0,pieces.length-1)*.125
});
const fixture=(options={})=>{
  const original=[
    mkBar("STUD-001",[["A",50]]),
    mkBar("STUD-002",[["B",40]]),
    mkBar("STUD-003",[["C",30]])
  ];
  const alternative=reallocateFramingOffcuts(original,{
    kerf:.125,endTrim:options.endTrim??0,
    finalSeverKerf:options.lastKerf??0,
    reuseMin:10,allowance:10
  });
  assert.equal(alternative.status,"reallocated");
  const ledger=makeFramingStationLedger(alternative,original);
  const fieldInputs={sawKerf:.125,endTrim:0,finalSeverKerf:0};
  const lengths=Object.fromEntries(ledger.bars.map(x=>[x.stockId,96]));
  const checks=Object.fromEntries(ledger.bars.map(x=>[x.stockId,{
    profileGradeReviewed:true,defectsReviewed:true
  }]));
  const globals={
    sawSafetyReviewed:true,structuralReviewed:true,
    supplierVerified:true,totalCostReviewed:true
  };
  const create=({alt=alternative,measurements=lengths,
    inputs=fieldInputs,declared=checks,globalChecks=globals,currency="USD"}={})=>{
    const measured=auditMeasuredFramingFits(ledger,measurements,inputs);
    const report=assessFramingPurchaseReview(ledger,measured,
      declared,globalChecks,alt);
    return makeFramingReviewVersion({
      ledger,fieldReview:measured,fieldInputs:inputs,
      purchaseReview:report,alternative:alt,currency
    });
  };
  return {original,alternative,ledger,fieldInputs,lengths,checks,globals,create};
};
const clone=v=>JSON.parse(JSON.stringify(v));

test("Review IDs are deterministic, component-scoped and independent of timestamp or display units",()=>{
  const f=fixture();
  const inputBefore=JSON.stringify([f.original,f.alternative,f.ledger,f.lengths,f.checks]);
  const a=f.create(),b=f.create();
  assert.deepEqual(a,b);
  assert.equal(validateFramingReviewVersion(a),true);
  assert.match(a.versionIds.packet,/^PACK-[0-9a-f]{16}$/);
  for(const [key,prefix] of [
    ["layout","LAY"],["measurement","MEAS"],
    ["quotation","QUOTE"],["declaration","DECL"]
  ])assert.match(a.versionIds[key],new RegExp("^"+prefix+"-[0-9a-f]{16}$"));
  assert.equal(a.parts.declaration.automaticPurchaseAuthorized,false);
  assert.equal(a.parts.declaration.humanApprovalRequired,true);
  assert.equal(JSON.stringify([f.original,f.alternative,f.ledger,f.lengths,f.checks]),
    inputBefore);
  const imported=JSON.parse(JSON.stringify({
    ...a,exportedAtUtc:"2026-11-06T01:02:03.000Z"
  }));
  assert.equal(validateFramingReviewVersion(imported),true);
  assert.equal(compareFramingReviewVersions(imported,a).totalChanges,0);
  assert.equal(compareFramingReviewVersions(imported,a).samePacket,true);
});

test("Manual saw-kerf or real length changes only their own component until declarations change",()=>{
  const f=fixture(),old=f.create();
  const saw=f.create({inputs:{...f.fieldInputs,sawKerf:.25}});
  assert.equal(saw.versionIds.layout,old.versionIds.layout);
  assert.notEqual(saw.versionIds.measurement,old.versionIds.measurement);
  assert.equal(saw.versionIds.quotation,old.versionIds.quotation);
  assert.equal(saw.versionIds.declaration,old.versionIds.declaration);
  const diff=compareFramingReviewVersions(old,saw);
  assert.deepEqual(diff.changedSections,["measurement"]);
  assert.ok(diff.changes.some(row=>
    row.section==="measurement"&&row.field==="Entered sawKerf"));
  const sizes=f.create({measurements:{...f.lengths,
    [f.ledger.bars[0].stockId]:95}});
  assert.notEqual(sizes.versionIds.measurement,old.versionIds.measurement);
  assert.equal(sizes.versionIds.layout,old.versionIds.layout);
  assert.equal(sizes.versionIds.quotation,old.versionIds.quotation);
  const pending=f.create({measurements:{}});
  assert.notEqual(pending.versionIds.measurement,old.versionIds.measurement);
  const wrong=f.create({inputs:{...f.fieldInputs,sawKerf:NaN}});
  assert.equal(wrong.parts.measurement.sawKerf,"INVALID NUMBER");
  assert.notEqual(wrong.versionIds.measurement,pending.versionIds.measurement);
});

test("Supplier price and currency changes invalidate quotation ID, never silently reprice physical units",()=>{
  const f=fixture(),old=f.create();
  const quote=clone(f.alternative);
  quote.purchaseVariants[0].unitPrice=11.5;
  quote.purchaseVariants[0].purchaseCost=
    quote.purchaseVariants[0].purchaseSticks*11.5;
  quote.reallocatedQuotedSubtotal=quote.purchaseVariants.reduce(
    (sum,v)=>sum+v.purchaseCost,0);
  const changed=f.create({alt:quote});
  const diff=compareFramingReviewVersions(old,changed);
  assert.deepEqual(diff.changedSections,["quotation"]);
  assert.equal(changed.versionIds.layout,old.versionIds.layout);
  assert.equal(changed.versionIds.measurement,old.versionIds.measurement);
  assert.equal(changed.versionIds.declaration,old.versionIds.declaration);
  assert.ok(diff.changes.some(x=>
    x.section==="quotation"&&x.field.endsWith("unitPrice")));
  const euro=f.create({currency:"EUR"});
  assert.deepEqual(compareFramingReviewVersions(old,euro).changedSections,
    ["quotation"]);
  assert.equal(euro.parts.quotation.currency,"EUR");
  const note=framingReviewVersionNote(euro,old);
  assert.ok(note.includes(euro.versionIds.packet));
  assert.ok(note.includes(euro.versionIds.quotation));
  assert.ok(note.includes(old.versionIds.packet));
  assert.ok(note.includes("NO PURCHASE APPROVAL"));
});

test("Same raw quotation but altered stock grade or declaration status changes only declaration ID",()=>{
  const f=fixture(),old=f.create();
  const changes=clone(f.checks);
  const first=f.ledger.bars[0].stockId;
  changes[first].defectsReviewed=false;
  const next=f.create({declared:changes});
  const diff=compareFramingReviewVersions(old,next);
  assert.deepEqual(diff.changedSections,["declaration"]);
  assert.ok(diff.changes.some(x=>
    x.field.includes("defectsReviewed")&&x.before==="true"&&x.after==="false"));
  assert.equal(next.parts.declaration.reviewPacketComplete,false);
  assert.equal(next.parts.declaration.automaticPurchaseAuthorized,false);
});

test("Trimmed alternative layout changes layout reference even if the stock group and all members persist",()=>{
  const a=fixture({endTrim:0}).create();
  const b=fixture({endTrim:1}).create();
  const diff=compareFramingReviewVersions(a,b);
  assert.ok(diff.changedSections.includes("layout"));
  assert.notEqual(a.versionIds.layout,b.versionIds.layout);
  assert.equal(a.versionIds.declaration,b.versionIds.declaration);
  assert.ok(diff.changes.some(x=>x.section==="layout"));
});

test("Version comparison must enumerate changed fields and be reversible, including source stock deletions",()=>{
  const f=fixture(),original=f.create();
  const changed=f.create({
    measurements:{...f.lengths,[f.ledger.bars[0].stockId]:1}
  });
  const forward=compareFramingReviewVersions(original,changed);
  const reverse=compareFramingReviewVersions(changed,original);
  assert.equal(forward.totalChanges,reverse.totalChanges);
  assert.notEqual(forward.referenceId,forward.currentId);
  assert.equal(forward.referenceId,reverse.currentId);
  assert.ok(forward.changes.some(x=>x.field.includes("shortfall")));
  assert.equal(forward.samePacket,false);
});

test("Imported JSON rejects tampered component IDs, invented approvals and unknown schema",()=>{
  const original=fixture().create();
  const tamper=(mutate)=>{const data=clone(original);mutate(data);return data};
  assert.throws(()=>validateFramingReviewVersion(tamper(v=>
    v.parts.quotation.currency="EUR")) ,/mismatch/);
  assert.throws(()=>validateFramingReviewVersion(tamper(v=>
    v.versionIds.packet="PACK-0000000000000000")),/mismatch/);
  assert.throws(()=>validateFramingReviewVersion(tamper(v=>
    v.schema="unknown-v9")),/Unsupported/);
  assert.throws(()=>validateFramingReviewVersion(tamper(v=>
    v.parts.declaration.automaticPurchaseAuthorized=true)),/authorize/);
  const noMetadata=tamper(v=>delete v.versionIds);
  assert.throws(()=>validateFramingReviewVersion(noMetadata),/incomplete/);
  assert.throws(()=>compareFramingReviewVersions(original,noMetadata),/incomplete/);
});

test("Versioned review CSV columns and notes are strings, never converted to fake wood lengths",()=>{
  const ver=fixture().create();
  const ids=ver.versionIds;
  const note=framingReviewVersionNote(ver);
  for(const unit of ["in","ft","mm","cm","m"]){
    const rows=ver.parts.declaration.sourceRows.map(r=>({...r,
      layoutVersionId:ids.layout,measurementVersionId:ids.measurement,
      quotationVersionId:ids.quotation,declarationVersionId:ids.declaration,
      packetVersionId:ids.packet,currency:"USD",
      automaticPurchaseAuthorized:false,humanApprovalRequired:true}));
    const cols=scheduleColumns(rows,unit);
    for(const key of ["layoutVersionId","measurementVersionId",
      "quotationVersionId","declarationVersionId","packetVersionId"])
      assert.equal(cols.find(c=>c.key===key).kind,"plain");
    const exported=buildScheduleCsv(rows,unit,
      "HUMAN AUTHORIZATION REQUIRED. "+note);
    assert.ok(exported.includes('"Packet Version Id"'));
    assert.ok(exported.includes('"'+ids.packet+'"'));
    assert.ok(exported.includes('"'+ids.quotation+'"'));
    assert.ok(exported.includes('"Source note"'));
    assert.ok(exported.includes('"false"'));
    assert.ok(exported.includes('"true"'));
  }
});
