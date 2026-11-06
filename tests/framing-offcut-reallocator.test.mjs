import test from "node:test";
import assert from "node:assert/strict";
import {compute,reallocateFramingOffcuts} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const source=(group,id,len,parts,price=10.5,code="BASE")=>({
  stockGroup:group,stockId:id,offerLabel:code==="BASE"?"Base":"Alternative 1",
  offerCode:code,stockLength:len,actualStockLength:len,unitPrice:price,
  cuts:parts.map(([item,n])=>({item,type:group,cutLength:n})),
  cutCount:parts.length,usedLength:parts.reduce((s,p)=>s+p[1],0)
});
const example=()=>[
  source("Stud","STUD-001",96,[["A",50]]),
  source("Stud","STUD-002",96,[["B",40]]),
  source("Stud","STUD-003",96,[["C",30]])
];
const preserved=xs=>JSON.parse(JSON.stringify(xs));
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<=1e-7,
  label+": "+a+" vs "+b);

function independentlyVerifyAlternative(input,out,{kerf=0,endTrim=0,finalSeverKerf=0,allowance=0}={}){
  const expected=input.flatMap(s=>s.cuts.map(c=>s.stockGroup+"|"+c.item)).sort();
  const actual=out.rows.map(r=>r.stockGroup+"|"+r.item).sort();
  assert.deepEqual(actual,expected,"must conserve each member exactly once");
  const oldByName=new Map(input.flatMap(s=>s.cuts.map(c=>[s.stockGroup+"|"+c.item,
    {cut:c,origin:s.stockId,group:s.stockGroup}])));
  const originalSources=new Map(input.map(s=>[s.stockId,s]));
  const grouped=new Map();
  for(const row of out.rows){
    const key=row.stockGroup+"|"+row.item;
    assert.equal(row.cutLength,oldByName.get(key).cut.cutLength);
    assert.equal(row.originalStockId,oldByName.get(key).origin);
    const current=originalSources.get(row.stockId);
    assert.ok(current,"new physical source cannot be invented");
    assert.equal(row.stockGroup,current.stockGroup,"no mixed profile / cross section");
    assert.equal(row.stockLength,current.stockLength);
    if(!grouped.has(row.stockId))grouped.set(row.stockId,[]);
    grouped.get(row.stockId).push(row);
  }
  assert.equal(grouped.size,out.plannedSticks);
  let count=0,total=0;
  const perSku=new Map();
  for(const [id,rows] of grouped){
    const b=originalSources.get(id);
    let previous=endTrim,used=0;
    for(const [i,row] of rows.entries()){
      const before=i?kerf:0;
      close(row.kerfBefore,before,"kerf");
      close(row.cutStart,previous+before,"local cut start");
      close(row.cutEnd,row.cutStart+row.cutLength,"local cut end");
      assert.ok(row.cutStart+1e-12>=previous,"overlapping retained members");
      assert.ok(row.cutEnd<=b.stockLength+1e-12,"source overrun");
      used+=row.cutLength+before;previous=row.cutEnd;
    }
    const sever=b.stockLength-(endTrim+used)>1e-12?finalSeverKerf:0;
    const tail=b.stockLength-(used+endTrim*2+sever);
    assert.ok(tail>=-1e-12,"negative physical offcut");
    const key=b.stockGroup+"|"+b.offerCode;
    perSku.set(key,(perSku.get(key)||0)+1);
  }
  for(const r of out.purchaseVariants){
    const n=perSku.get(r.stockGroup+"|"+r.offerCode)||0;
    assert.equal(r.plannedSticks,n);
    assert.equal(r.purchaseSticks,Math.ceil(n*(1+allowance/100)-1e-10));
    count+=r.purchaseSticks;
    if(r.unitPrice!==null){
      const cents=Math.round(r.unitPrice*100)*r.purchaseSticks;
      close(r.purchaseCost*100,cents,"per-SKU currency cents");
      total+=cents;
    }
  }
  assert.equal(count,out.purchaseSticks);
  if(out.quotedDifference!==null){
    close((out.originalQuotedSubtotal-out.reallocatedQuotedSubtotal)*100,
      out.quotedDifference*100,"modeled quote saving cents");
  }
  assert.equal(out.movedPieces.length,out.rows.filter(r=>r.originalStockId!==r.stockId).length);
  return total;
}

test("Offcut reallocation can retire one complete paid source and recompute per-SKU reserve",()=>{
  for(const allowance of [0,10,50,100]){
    const bars=example(),before=preserved(bars);
    const r=reallocateFramingOffcuts(bars,{kerf:.125,endTrim:0,
      finalSeverKerf:0,reuseMin:10,allowance});
    assert.equal(r.status,"reallocated");
    assert.equal(r.physicallyFits,true);
    assert.equal(r.originalPlannedSticks,3);
    assert.equal(r.plannedSticks,2);
    assert.equal(r.removedSourceIds.length,1);
    assert.equal(r.originalPurchaseSticks,Math.ceil(3*(1+allowance/100)-1e-10));
    assert.equal(r.purchaseSticks,Math.ceil(2*(1+allowance/100)-1e-10));
    assert.equal(r.canClaimModeledSavings,true);
    const expectedSaving=(r.originalPurchaseSticks-r.purchaseSticks)*10.5;
    close(r.quotedDifference,expectedSaving,"model savings");
    independentlyVerifyAlternative(bars,r,{kerf:.125,allowance});
    assert.deepEqual(bars,before,"must NEVER mutate baseline source bars");
  }
});

test("End trims and last separation kerf must be counted on each reassigned source",()=>{
  const bars=example();
  for(const [endTrim,finalSeverKerf] of [[0,0],[2,.125],[4,.25],[8,1]]){
    const r=reallocateFramingOffcuts(bars,{kerf:.25,endTrim,
      finalSeverKerf,reuseMin:10,allowance:10});
    if(r.status==="reallocated"||r.status==="no-reduction")
      independentlyVerifyAlternative(bars,r,{kerf:.25,endTrim,
        finalSeverKerf,allowance:10});
    else assert.equal(r.status,"baseline-shortfall");
  }
});

test("Never move a cut between unlike source profiles even if a large compatible-length tail exists",()=>{
  const bars=[
    source("Stud","STUD-001",96,[["A",75]]),
    source("Stud","STUD-002",96,[["B",80]]),
    source("Header","HEADER-001",96,[["C",10]])
  ];
  const r=reallocateFramingOffcuts(bars,{kerf:.125,reuseMin:10});
  assert.equal(r.status,"no-reduction");
  assert.equal(r.plannedSticks,3);
  assert.equal(r.movedPieces.length,0);
  independentlyVerifyAlternative(bars,r,{kerf:.125});
});

test("A source with multiple cuts must be retired entirely; partial movement never counts as a saving",()=>{
  const bars=[
    source("Stud","STUD-001",96,[["A",70],["B",20]]),
    source("Stud","STUD-002",96,[["C",64]]),
    source("Stud","STUD-003",96,[["D",65]])
  ];
  const r=reallocateFramingOffcuts(bars,{kerf:.125,reuseMin:10,allowance:0});
  assert.equal(r.status,"no-reduction");
  assert.equal(r.plannedSticks,3);
  independentlyVerifyAlternative(bars,r,{kerf:.125});
});

test("Reject blocked, zero-threshold, bounded and unquoted cases without fabricated savings",()=>{
  const bars=example();
  const blocked=reallocateFramingOffcuts(bars,{kerf:.125,endTrim:30,
    finalSeverKerf:.125,reuseMin:5});
  assert.equal(blocked.status,"baseline-shortfall");
  assert.equal(blocked.canClaimModeledSavings,false);
  assert.equal(blocked.rows.length,0);
  const noThreshold=reallocateFramingOffcuts(bars,{kerf:.125,reuseMin:0});
  assert.equal(noThreshold.status,"threshold-required");
  const tooBig=reallocateFramingOffcuts(bars,{kerf:.125,reuseMin:10,maxBars:2});
  assert.equal(tooBig.status,"size-limit");
  const unknown=bars.map(bar=>({...bar,unitPrice:null}));
  const unquoted=reallocateFramingOffcuts(unknown,{kerf:.125,reuseMin:10});
  assert.equal(unquoted.status,"reallocated");
  assert.equal(unquoted.canClaimModeledSavings,false);
  assert.equal(unquoted.quotedDifference,null);
  independentlyVerifyAlternative(unknown,unquoted,{kerf:.125});
});

test("Mixed offered prices cannot allow cheaper-looking stick counts to increase total quote",()=>{
  const bars=[
    source("Stud","STUD-001",96,[["A",50]],20,"BASE"),
    source("Stud","STUD-002",96,[["B",40]],20,"BASE"),
    source("Stud","STUD-003",96,[["C",30]],2,"ALT1")
  ];
  const before=preserved(bars);
  const result=reallocateFramingOffcuts(bars,{kerf:.125,reuseMin:10,allowance:0});
  independentlyVerifyAlternative(bars,result,{kerf:.125});
  assert.ok(result.reallocatedQuotedSubtotal<=result.originalQuotedSubtotal);
  assert.deepEqual(bars,before);
  assert.equal(result.canClaimModeledSavings,result.quotedDifference>0);
});

test("Integration: mode 2 preserves base geometry, optimizer proof and supplier CSV",()=>{
  const b={length:120,spacing:16,width:1.5,wallHeight:80,
    openingStart:32,openingWidth:36,openingHeight:60,
    studUnitPrice:8,headerUnitPrice:12,stockWaste:10,stockKerf:.125};
  const normal=compute("framing-calculator",b);
  const opt=compute("framing-calculator",{...b,
    stockAuditMode:2,stockAuditEndTrim:0,stockAuditSeverKerf:0,
    stockAuditReuseMin:8});
  for(const key of ["rows","framingRows","stockPlan","stockCuts",
    "purchaseVariants","materialSummary","costSummary","optimizerStatus","metrics"])
    assert.deepEqual(opt[key],normal[key],"base model changed "+key);
  assert.equal(opt.stockAudit.enabled,true);
  assert.equal(opt.stockReusePlan.enabled,true);
  assert.ok(["no-reduction","reallocated"].includes(opt.stockReusePlan.status));
  independentlyVerifyAlternative(opt.stockPlan,opt.stockReusePlan,
    {kerf:.125,allowance:10});
  const headings=scheduleColumns(opt.stockReusePlan.rows,"mm");
  for(const key of ["cutStart","cutEnd","stockLength","kerfBefore"])
    assert.equal(headings.find(c=>c.key===key)?.kind,"length");
  const csv=buildScheduleCsv(opt.stockReusePlan.rows,"mm",
    "ALTERNATIVE, NOT BASELINE");
  assert.ok(csv.includes('"Original Stock Id"'));
  assert.ok(csv.includes('"Cut Start (mm)"'));
  const csvPrice=buildScheduleCsv(opt.stockReusePlan.purchaseVariants
    .map(r=>({...r,currency:"USD"})),"in","MODELED ONLY");
  assert.ok(csvPrice.includes('"Purchase Sticks"'));
  assert.ok(csvPrice.includes('"Currency"'));
});
