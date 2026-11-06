import test from "node:test";
import assert from "node:assert/strict";
import {reallocateFramingOffcuts,compute} from "../src/calcs.mjs";
import {makeFramingStationLedger} from "../src/framing-stations.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const stock=(stockId,pieces,len=96)=>{
  const kerf=.125;
  return {stockGroup:"Stud",stockId,offerLabel:"Base",offerCode:"B96",
    unitPrice:10.55,stockLength:len,actualStockLength:len,
    cuts:pieces.map(([item,cutLength])=>({item,type:"Stud",cutLength})),
    cutCount:pieces.length,usedLength:pieces.reduce((n,r)=>n+r[1],0)+
      Math.max(0,pieces.length-1)*kerf};
};
const fixture=()=>[
  stock("STUD-001",[["A",50]]),
  stock("STUD-002",[["B",40]]),
  stock("STUD-003",[["C",30]])
];
const approx=(a,b,tag)=>assert.ok(Math.abs(a-b)<=1e-7,tag+": "+a+" / "+b);
const unique=rows=>new Set(rows.map(x=>x.stockGroup+"|"+x.item));

test("Post-reallocation stock-local station segments partition every source exactly once",()=>{
  for(const [trim,sever] of [[0,0],[0,.125],[1,.125],[2,.25],[3,.125]]){
    const sources=fixture();
    const untouched=JSON.stringify(sources);
    const alternate=reallocateFramingOffcuts(sources,{
      kerf:.125,endTrim:trim,finalSeverKerf:sever,reuseMin:10,allowance:10
    });
    assert.equal(alternate.status,"reallocated");
    const ledger=makeFramingStationLedger(alternate);
    assert.equal(ledger.available,true);
    assert.equal(ledger.sourceCount,alternate.plannedSticks);
    assert.equal(ledger.memberCount,alternate.rows.length);
    assert.equal(ledger.unverifiedSourceCount,alternate.plannedSticks);
    assert.equal(unique(alternate.rows).size,ledger.memberCount);
    for(const summary of ledger.bars){
      const segments=ledger.rows.filter(x=>x.stockId===summary.stockId);
      let at=0,parts=0;
      for(const seg of segments){
        approx(seg.stationStart,at,"segment continuity");
        approx(seg.stationEnd-seg.stationStart,seg.segmentLength,"segment length");
        assert.ok(seg.stationEnd>seg.stationStart,"no zero/nonpositive segment");
        assert.ok(seg.segmentLength<=summary.stockLength,"no segment over stock");
        assert.equal(seg.verification,"NOT FIELD VERIFIED");
        at=seg.stationEnd;
        if(seg.segmentKind==="RETAINED MEMBER")parts++;
        if(seg.segmentKind.includes("KERF"))
          assert.ok(seg.segmentLength>0,"saw kerf not physical length");
      }
      approx(at,summary.stockLength,"source covered to last physical endpoint");
      approx(segments.reduce((sum,s)=>sum+s.segmentLength,0),
        summary.stockLength,"source conservation");
      assert.equal(parts,summary.retainedPieces);
      assert.equal(summary.physicalStockChecked,false);
      assert.equal(summary.profileGradeChecked,false);
      assert.equal(summary.realBladeKerfChecked,false);
      assert.equal(summary.defectAndClampChecked,false);
      const tails=segments.filter(x=>x.segmentKind==="UNALLOCATED TAIL");
      approx(tails.reduce((n,row)=>n+row.segmentLength,0),
        summary.unallocatedTail,"tail separately accounted");
      const trimParts=segments.filter(s=>s.segmentKind.endsWith("END TRIM"));
      assert.equal(trimParts.length,trim>0?2:0);
      const sawParts=segments.filter(s=>s.segmentKind==="LAST SEPARATION KERF");
      assert.equal(sawParts.length,sever>0?1:0);
    }
    assert.equal(JSON.stringify(sources),untouched,"ledger must not modify underlying plan");
  }
});

test("No tail, no terminal sever or fictitious final cut on an exactly used source",()=>{
  const b=stock("STUD-001",[["A",96]],96);
  const plan=reallocateFramingOffcuts([b],{kerf:.125,endTrim:0,
    finalSeverKerf:.125,reuseMin:1,allowance:0});
  assert.equal(plan.status,"no-reduction");
  const ledger=makeFramingStationLedger(plan);
  assert.deepEqual(ledger.rows.map(x=>x.segmentKind),["RETAINED MEMBER"]);
  approx(ledger.bars[0].unallocatedTail,0,"no phantom remaining stock");
  approx(ledger.bars[0].lastSeverKerf,0,"no phantom terminal kerf");
});

test("Actual source-local cutting station CSV preserves numeric units and unverified safety marker",()=>{
  const a=compute("framing-calculator",{
    length:120,spacing:16,width:1.5,wallHeight:80,
    openingStart:32,openingWidth:36,openingHeight:60,
    stockAuditMode:2,stockAuditReuseMin:2,stockKerf:.125,
    studUnitPrice:8,headerUnitPrice:12
  });
  const ledger=makeFramingStationLedger(a.stockReusePlan);
  assert.equal(ledger.available,true);
  for(const [unit,factor] of [["in",1],["ft",1/12],["mm",25.4],
    ["cm",2.54],["m",.0254]]){
    const cols=scheduleColumns(ledger.rows,unit);
    const keys=["stationStart","stationEnd","segmentLength","stockLength"];
    for(const key of keys){
      const col=cols.find(c=>c.key===key);
      assert.equal(col.kind,"length",key+" is a dimensional column");
      assert.ok(col.label.endsWith("("+unit+")"));
    }
    const csv=buildScheduleCsv(ledger.rows,unit,
      "NOT a saw order; verify actual wood and blade");
    assert.ok(csv.includes('"NOT FIELD VERIFIED"'));
    assert.ok(csv.includes('"Station Start ('+unit+')"'));
    assert.ok(csv.includes('"Station End ('+unit+')"'));
    assert.ok(csv.includes('"RETAINED MEMBER"'));
    const lines=csv.replace(/^\uFEFF/,"").split("\r\n").filter(Boolean);
    assert.equal(lines.length,ledger.rows.length+2);
    const startIndex=cols.findIndex(x=>x.key==="stationStart");
    for(const [i,row] of ledger.rows.entries()){
      const fields=lines[i+1].slice(1,-1).split('","');
      approx(Number(fields[startIndex]),row.stationStart*factor,
        unit+" CSV station conversion");
    }
  }
});

test("Incomplete, blocked and adulterated plans cannot be silently exported as station ledgers",()=>{
  const blocked=reallocateFramingOffcuts(fixture(),{
    kerf:.125,endTrim:30,finalSeverKerf:.125,reuseMin:2
  });
  assert.equal(makeFramingStationLedger(blocked).available,false);
  assert.equal(makeFramingStationLedger({enabled:false}).available,false);
  const good=reallocateFramingOffcuts(fixture(),{kerf:.125,reuseMin:10});
  const modify=()=>structuredClone(good);
  let corrupted=modify();
  corrupted.bars[0].cuts[0].cutStart+=.25;
  assert.throws(()=>makeFramingStationLedger(corrupted),/mismatch|invalid/i);
  corrupted=modify();
  corrupted.bars[0].actualStockLength-=1;
  assert.throws(()=>makeFramingStationLedger(corrupted),/overflows|mismatch/i);
  corrupted=modify();
  corrupted.rows[0].item="NO SUCH CUT";
  assert.throws(()=>makeFramingStationLedger(corrupted),/disagrees|cover/i);
  corrupted=modify();
  corrupted.bars[1].stockId=corrupted.bars[0].stockId;
  assert.throws(()=>makeFramingStationLedger(corrupted),/duplicate source/i);
});
