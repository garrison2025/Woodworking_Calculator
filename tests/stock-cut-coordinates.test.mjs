import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

// Independent source-local placement verifier: all coordinates refer to one
// purchased stick's zero end, NOT to wall/member placement. Between-piece
// kerf is included; the model does not include terminal sever/trim kerf.
const q=x=>Math.round(x*1e8)/1e8;
const near=(a,b,eps=1e-8,label="quantity")=>
  assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps,
    label+": "+a+" != "+b);
function checkLocalPositions(result,kerf,description){
  const cutsByStock=new Map();
  for(const cut of result.stockCuts){
    if(!cutsByStock.has(cut.stockId))cutsByStock.set(cut.stockId,[]);
    cutsByStock.get(cut.stockId).push(cut);
  }
  assert.equal(cutsByStock.size,result.stockPlan.length,description+" stock missing");
  let seen=0;
  for(const bar of result.stockPlan){
    const cuts=cutsByStock.get(bar.stockId);
    assert.ok(cuts?.length>0,description+" missing "+bar.stockId);
    assert.equal(cuts.length,bar.cutCount);
    assert.equal(bar.cuts.length,cuts.length);
    let end=0,totalPieces=0,totalKerf=0;
    for(const [index,row] of cuts.entries()){
      const expectedKerf=index===0?0:kerf;
      near(row.kerfBefore,q(expectedKerf),1e-8,"kerf before "+row.item);
      const start=q(end+expectedKerf);
      const next=q(end+expectedKerf+row.cutLength);
      near(row.cutStart,start,1e-8,"cut start "+row.item);
      near(row.cutEnd,next,1e-8,"cut end "+row.item);
      near(row.cutEnd-row.cutStart,row.cutLength,1e-8,"cut length "+row.item);
      near(row.runningUsedLength,row.cutEnd,1e-8,"running used "+row.item);
      assert.ok(row.cutStart>=end-1e-10,"pieces overlap on "+bar.stockId);
      assert.ok(row.cutEnd<=bar.stockLength+1e-12,"piece exceeds "+bar.stockId);
      near(row.remainingLength,q(bar.stockLength-row.cutEnd),
        1e-8,"remaining stock "+row.item);
      const source=bar.cuts[index];
      for(const key of ["item","type","cutLength","cutStart","cutEnd","kerfBefore"])
        assert.equal(source[key],row[key],description+" screen/CSV source mismatch "+key);
      totalPieces+=row.cutLength;totalKerf+=expectedKerf;
      end=row.cutEnd;seen++;
    }
    near(end,bar.usedLength,1e-7,"bar used "+bar.stockId);
    near(end,bar.offcutStart,1e-7,"bar offcut starts after last cut "+bar.stockId);
    near(q(bar.stockLength-end),bar.offcutLength,1e-7,
      "bar final unreused offcut "+bar.stockId);
    near(q(totalKerf),bar.kerfLoss,1e-8,"bar kerf total");
    near(q(totalPieces),bar.piecesLength,1e-8,"bar retained pieces total");
    near(q(totalPieces+totalKerf+bar.offcutLength),
      bar.stockLength,1e-6,"bar conservation");
  }
  assert.equal(seen,result.framingRows.length,description+" cut count");
}

test("Mixed-length framing layouts assign distinct stock-local coordinates, without inventing offcut reuse",()=>{
  const a={
    length:120,spacing:16,width:1.5,wallHeight:80,
    openingStart:32,openingWidth:36,openingHeight:60,
    stockKerf:.125,studUnitPrice:8,headerUnitPrice:12,
    studAltUnitPrice:8.20,studAlt2UnitPrice:8.50
  };
  const result=compute("framing-calculator",a);
  assert.ok(result.stockPlan.some(b=>b.cuts.length>1),
    "Fixture must contain consecutive retained cuts");
  assert.ok(result.materialSummary.some(r=>r.mixedLengths),
    "Fixture must test more than one purchased length");
  checkLocalPositions(result,a.stockKerf,"mixed lengths");
  const rows=result.stockCuts;
  const headings=scheduleColumns(rows,"mm");
  assert.equal(headings.find(c=>c.key==="cutStart").label,"Cut Start (mm)");
  assert.equal(headings.find(c=>c.key==="cutEnd").label,"Cut End (mm)");
  assert.equal(headings.find(c=>c.key==="kerfBefore").label,"Kerf Before (mm)");
  const exportMM=buildScheduleCsv(rows,"mm","0-origin stock-local cuts, no last saw");
  const exportIN=buildScheduleCsv(rows,"in","0-origin stock-local cuts, no last saw");
  assert.ok(exportMM.includes('"Cut Start (mm)","Cut End (mm)"'),"Metric typed positions");
  assert.ok(exportIN.includes('"Cut Start (in)","Cut End (in)"'),"Inch typed positions");
  assert.equal(exportMM.split("\r\n").filter(Boolean).length,rows.length+2);
  assert.equal(exportIN.split("\r\n").filter(Boolean).length,rows.length+2);
  const second=rows.find(p=>p.index===2);
  assert.ok(second,"Must test a second cut on one stock");
  assert.ok(exportMM.includes('"'+q(second.cutStart*25.4)+'"')||
    exportMM.includes('"'+Number((second.cutStart*25.4).toFixed(6))+'"'),
    "Metric cut-start coordinate appears in exported CSV");
  const before=JSON.stringify(result.framingRows);
  for(const waste of [0,10,50,100]){
    const scenario=compute("framing-calculator",{...a,stockWaste:waste});
    checkLocalPositions(scenario,a.stockKerf,"allowance "+waste);
    assert.equal(JSON.stringify(scenario.framingRows),before,
      "Purchased reserve must not change physical member cut lengths");
  }
});

test("Stock-local intervals conserve zero/small/large kerfs and true source endpoints",()=>{
  const input={
    length:120,spacing:16,width:1.5,wallHeight:84,
    openingStart:32,openingWidth:36,openingHeight:60,
    studStockLength:120,headerStockLength:96,sillStockLength:96
  };
  for(const kerf of [0,1e-8,1.5e-8,.0625,.125,.25]){
    const value=safeCompute("framing-calculator",{...input,stockKerf:kerf});
    assert.equal(value.ok,true,JSON.stringify({kerf,error:value.error}));
    checkLocalPositions(value.data,kerf,"kerf="+kerf);
  }
  const exact=compute("framing-calculator",{
    ...input,wallHeight:100.500000008,studStockLength:96.00000001
  });
  checkLocalPositions(exact,.125,"quantized exact-fit stock");
  const tooShort=safeCompute("framing-calculator",{
    ...input,wallHeight:100.500000008,studStockLength:96.000000006
  });
  assert.equal(tooShort.ok,false,"Sub-quantum source shortfall must be rejected");
});

test("Stock-local positions remain typed and coherent through five CSV length units",()=>{
  const data=compute("framing-calculator",{
    length:120,spacing:16,width:1.5,wallHeight:80,
    openingStart:32,openingWidth:36,openingHeight:60,stockKerf:.125
  });
  for(const [unit,factor] of [["in",1],["ft",1/12],["mm",25.4],["cm",2.54],["m",.0254]]){
    const cols=scheduleColumns(data.stockCuts,unit);
    for(const key of ["cutStart","cutEnd","stockLength","kerfBefore","runningUsedLength"]){
      assert.equal(cols.find(c=>c.key===key).kind,"length",key);
      assert.equal(cols.find(c=>c.key===key).label.includes("("+unit+")"),true);
    }
    const csv=buildScheduleCsv(data.stockCuts,unit);
    const lines=csv.replace(/^\uFEFF/,"").split("\r\n").filter(Boolean);
    const keys=cols.map(c=>c.key);
    const startIndex=keys.indexOf("cutStart"),endIndex=keys.indexOf("cutEnd");
    for(const [i,row] of data.stockCuts.entries()){
      const values=lines[i+1].slice(1,-1).split('","');
      near(Number(values[startIndex]),row.cutStart*factor,
        Math.max(1e-6,Math.abs(row.cutStart*factor)*1e-10),
        unit+" round-trip cutStart "+row.item);
      near(Number(values[endIndex]),row.cutEnd*factor,
        Math.max(1e-6,Math.abs(row.cutEnd*factor)*1e-10),
        unit+" round-trip cutEnd "+row.item);
    }
  }
});
