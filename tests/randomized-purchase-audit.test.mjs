import {test} from "node:test";
import assert from "node:assert/strict";
import {safeCompute,compute} from "../src/calcs.mjs";
import {buildScheduleCsv} from "../src/cut-list.mjs";

// Reproducible, dependency-free property sweeps. Failure messages include the
// iteration/seed so any counterexample can be promoted to a golden fixture.
const SEED=0x5A17B90D;
let state=SEED;
const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
const choose=items=>items[Math.floor(rand()*items.length)];
const cents=(min,max)=>Math.floor(rand()*(max-min+1))+min;
const close=(actual,expected,tolerance=1e-6,message="values differ")=>
  assert.ok(Math.abs(actual-expected)<=tolerance,
    message+": "+actual+" versus "+expected);
const allowances=[0,10,50,100];
const quantized=x=>Math.round(x*1e8)/1e8;

function checkFraming(result,allowance,caseName){
  assert.equal(result.stockCuts.length,result.framingRows.length,caseName+" lost framing cuts");
  const byId=new Map(result.stockPlan.map(bar=>[bar.stockId,bar]));
  const cutNames=new Map();
  for(const row of result.framingRows)
    cutNames.set(row.item,(cutNames.get(row.item)||0)+1);
  for(const bar of result.stockPlan){
    assert.ok(bar.stockLength>0&&bar.usedLength>=0,caseName+" invalid stock dimensions");
    assert.ok(bar.usedLength<=bar.stockLength+1e-12,caseName+" over-allocated "+bar.stockId);
    assert.equal(bar.cuts.length,bar.cutCount,caseName+" stock cut count mismatch");
    close(bar.piecesLength+bar.kerfLoss+bar.offcutLength,
      bar.stockLength,1e-6,caseName+" nonconserved source "+bar.stockId);
    for(const piece of bar.cuts)
      assert.ok(piece.cutLength<=bar.stockLength+1e-12,
        caseName+" physical piece longer than source: "+piece.item);
  }
  const groupCounts=new Map();
  for(const cut of result.stockCuts){
    const bar=byId.get(cut.stockId);
    assert.ok(bar,caseName+" cut without a stock source");
    assert.ok(cut.cutLength<=bar.stockLength+1e-12,
      caseName+" cut longer than its purchased source");
    assert.ok(cut.runningUsedLength<=bar.stockLength+1e-12,
      caseName+" saw kerf causes cut past source end");
    assert.ok(cut.remainingLength>=-1e-12,caseName+" negative source remainder");
    assert.ok(cutNames.has(cut.item),caseName+" extraneous cut: "+cut.item);
    cutNames.set(cut.item,cutNames.get(cut.item)-1);
    const count=(groupCounts.get(cut.stockId)||0)+1;
    groupCounts.set(cut.stockId,count);
    close(cut.kerfBefore,count===1?0:bar.cutCount>1?
      // All subsequent cuts on a bar are charged the same saw kerf.
      bar.kerfLoss/(bar.cutCount-1):0,1e-8,caseName+" kerf separation");
  }
  assert.ok([...cutNames.values()].every(n=>n===0),caseName+" duplicate or omitted cut");
  for(const bar of result.stockPlan)
    assert.equal(groupCounts.get(bar.stockId),bar.cutCount,caseName+" cut-count mismatch");
  const planCounts=new Map();
  for(const bar of result.stockPlan){
    const key=bar.stockGroup+"|"+bar.offerLabel;
    planCounts.set(key,(planCounts.get(key)||0)+1);
  }
  let centsTotal=0,priced=true,plannedSum=0,purchasedSum=0;
  for(const offer of result.purchaseVariants){
    const n=planCounts.get(offer.stockGroup+"|"+offer.offerLabel)||0;
    assert.equal(offer.plannedSticks,n,caseName+" purchase plan does not match cutting plan");
    const expectedPurchase=n?Math.ceil(n*(1+allowance/100)-1e-10):0;
    assert.equal(offer.purchaseSticks,expectedPurchase,caseName+" allowance is insufficient");
    assert.equal(offer.allowanceSticks,expectedPurchase-n);
    plannedSum+=n;purchasedSum+=expectedPurchase;
    if(n&&offer.unitPrice===null)priced=false;
    if(offer.unitPrice!==null){
      const priceInCents=Math.round(offer.unitPrice*100);
      const expectedCents=expectedPurchase*priceInCents;
      close(offer.purchaseCost*100,expectedCents,1e-5,caseName+" incorrect stick quote");
      close((offer.plannedCost+offer.reserveCost)*100,expectedCents,1e-5,
        caseName+" planned + allowance quote mismatch");
      centsTotal+=expectedCents;
    }
  }
  assert.equal(result.materialSummary.reduce((n,r)=>n+r.plannedSticks,0),plannedSum);
  assert.equal(result.materialSummary.reduce((n,r)=>n+r.purchaseSticks,0),purchasedSum);
  assert.equal(result.costSummary.allPricesEntered,priced);
  close(result.costSummary.quotedSubtotal*100,centsTotal,1e-5,
    caseName+" purchase total not equal to priced variant sum");
  const csv=buildScheduleCsv(result.stockCuts,"mm","Randomized stock-boundary audit");
  assert.ok(csv.includes('"Stock Length (mm)"'));
  assert.ok(csv.includes('"Kerf Before (mm)"'));
}

function checkDeck(result,input,allowance,caseName){
  const quote=result.deckCostSummary;
  const rows=result.rows.filter(row=>row.type==="Decking");
  assert.equal(rows.length,quote.stockedBoards,caseName+" undercounts purchased board pieces");
  assert.equal(quote.purchaseBoards,Math.ceil(quote.stockedBoards*(1+allowance/100)-1e-10));
  assert.equal(quote.joistPurchaseCount,input.joistStockLength>0?
    Math.ceil(quote.joistStockCount*(1+allowance/100)-1e-10):0);
  for(const row of rows){
    assert.ok(row.cutLength>0&&row.cutLength<=quantized(input.stock)+1e-12,
      caseName+" decking stock overlength: "+row.item);
    assert.ok(row.alongStart>=-1e-8&&
      row.alongStart+row.cutLength<=input.length+1e-7,
      caseName+" decking piece placed outside footprint");
    if(row.buttJointAtEnd!==null)
      assert.ok(result.joistGrid.some(x=>Math.abs(x-row.buttJointAtEnd)<1e-7),
        caseName+" unsupported butt joint");
  }
  for(const row of result.deckRows){
    const installed=rows.filter(x=>x.item.startsWith(row.item+" piece "))
      .reduce((sum,x)=>sum+x.cutLength,0);
    close(installed+row.seamCenters.length*input.buttEndGap,input.length,
      1e-6,caseName+" row cut/gap conservation");
    assert.ok(row.ripWidth>0&&row.ripWidth<=input.board+1e-7,
      caseName+" invalid rip width");
  }
  for(const row of result.rows.filter(x=>x.type==="Joist straight cut"))
    assert.ok(row.cutLength<=row.purchasedStockLength+1e-12,
      caseName+" full-width joist needs longer stock");
  const contactTotal=result.deckFastenerRows.reduce((sum,r)=>sum+r.fasteningContacts,0);
  assert.equal(contactTotal,quote.fastenerContacts);
  assert.equal(quote.fastenerPieces,contactTotal*input.fastenersPerContact);
  assert.equal(quote.fastenerPacks,quote.fastenerPieces?
    Math.ceil(quote.fastenerPieces/input.fastenerPackSize-1e-10):0);
  let totalCents=0;
  for(const item of result.deckPurchaseRows){
    if(item.unitPrice!==null){
      const cost=item.purchaseQuantity*Math.round(item.unitPrice*100);
      close(item.purchaseCost*100,cost,1e-5,caseName+" wrong priced supply quantity");
      totalCents+=cost;
    }
  }
  close(quote.quotedSubtotal*100,totalCents,1e-5,caseName+" supplier quote subtotal mismatch");
  assert.equal(result.deckPurchaseRows[0].purchaseQuantity,quote.purchaseBoards);
  const csv=buildScheduleCsv(result.deckPurchaseRows,"mm","Random purchase quote audit");
  assert.ok(csv.includes('"Purchase Quantity"'),caseName+" missing purchase CSV column");
}

test("Deterministic randomized framing source, kerf, stock-price and allowance invariants",()=>{
  let accepted=0,rejected=0;
  for(let i=0;i<48;i++){
    const base={
      length:choose([96,120,144,168]),
      spacing:choose([12,16,24]),width:1.5,
      wallHeight:choose([94.5,100.5,106.5,112.5]),
      openingStart:32,openingWidth:30,openingHeight:65,
      studStockLength:choose([88,96,104,120,144]),
      headerStockLength:choose([32,36,48,72,96]),
      sillStockLength:96,
      stockKerf:choose([0,.0625,.125,.1875]),
      studUnitPrice:cents(250,2400)/100,
      headerUnitPrice:cents(400,1600)/100,
      studAltStockLength:choose([120,144]),
      studAltUnitPrice:choose([0,cents(400,2200)/100]),
      headerAltStockLength:choose([48,96]),
      headerAltUnitPrice:choose([0,cents(450,1800)/100])
    };
    let geometry=null,previousPurchase=-1;
    for(const allowance of allowances){
      const name="framing seed="+SEED+" i="+i+" allowance="+allowance+" inputs="+JSON.stringify(base);
      const response=safeCompute("framing-calculator",{...base,stockWaste:allowance});
      if(!response.ok){
        rejected++;continue;
      }
      accepted++;
      const r=response.data;
      checkFraming(r,allowance,name);
      const cuts=JSON.stringify(r.framingRows);
      if(geometry!==null)assert.equal(cuts,geometry,name+" changed actual cut geometry");
      geometry=cuts;
      // Optimizer may select different supplier lengths across allowances,
      // so compare physical cuts, not bar IDs / quote-dependent bin packing.
      assert.ok(r.costSummary.quotedSubtotal>=previousPurchase,
        name+" purchase quote decreased with larger reserve");
      previousPurchase=r.costSummary.quotedSubtotal;
    }
  }
  assert.ok(accepted>=40,"Not enough successful varied framing scenarios: "+accepted);
  assert.ok(rejected>0,"No unavailable-stock boundary was exercised");
});

test("Deterministic randomized decking cuts, support centers, quantities and supplier totals",()=>{
  let accepted=0,rejected=0;
  for(let i=0;i<72;i++){
    const width=choose([24,36,60,84,120,144]);
    const base={
      width,length:choose([48,60,96,120,144,168,192,240]),
      board:choose([3.5,5.5,7.25]),gap:choose([0,.125,.25]),
      stock:choose([32,48,60,72,96,120,144,192,240]),
      joists:choose([12,16,24,30,48]),
      seamMode:choose([0,1]),buttEndGap:choose([0,.0625,.125]),
      joistFaceWidth:1.5,minEndBearing:0,
      joistStockLength:choose([width,width+12,width+24,width-1e-8]),
      boardUnitPrice:cents(200,2300)/100,
      fastenerPackSize:choose([50,100,200,500]),
      fastenersPerContact:choose([0,1,2,4]),
      fastenerPackPrice:cents(150,3800)/100,
      joistUnitPrice:cents(400,3300)/100
    };
    let geometry=null,fasteners=null,lastCost=-1;
    for(const allowance of allowances){
      const name="deck seed="+SEED+" i="+i+" allowance="+allowance+" inputs="+JSON.stringify(base);
      const response=safeCompute("deck-material-calculator",{...base,waste:allowance});
      if(!response.ok){rejected++;continue;}
      accepted++;
      checkDeck(response.data,base,allowance,name);
      const r=response.data;
      const rows=JSON.stringify(r.rows),f=JSON.stringify(r.deckFastenerRows);
      if(geometry!==null){
        assert.equal(rows,geometry,name+" reserve changed installation geometry");
        assert.equal(f,fasteners,name+" reserve changed required fasteners");
      }
      geometry=rows;fasteners=f;
      assert.ok(r.deckCostSummary.quotedSubtotal>=lastCost,name+" higher reserve cheaper");
      lastCost=r.deckCostSummary.quotedSubtotal;
    }
  }
  assert.ok(accepted>=60,"Not enough feasible randomized deck cases: "+accepted);
  assert.ok(rejected>0,"No unsupported deck stock cases exercised");
});

test("Supplier unit-price changes do not mutate measured cut geometry",()=>{
  const frame={length:120,spacing:16,width:1.5,wallHeight:100.5,
    openingStart:32,openingWidth:36,openingHeight:80,studStockLength:120,
    headerStockLength:96,sillStockLength:96,stockKerf:.125,stockWaste:10,
    studUnitPrice:9.50,headerUnitPrice:12.75,
    studAltStockLength:144,studAltUnitPrice:11.25};
  const a=compute("framing-calculator",frame);
  const b=compute("framing-calculator",{...frame,studUnitPrice:12.50,
    studAltUnitPrice:8.75,headerUnitPrice:24.25});
  assert.deepEqual(a.framingRows,b.framingRows);
  checkFraming(a,10,"framing quote A");checkFraming(b,10,"framing quote B");
  const deck={width:120,length:144,board:5.5,gap:.125,stock:72,
    joists:16,buttEndGap:.125,joistStockLength:120,
    boardUnitPrice:8.75,fastenerPackPrice:15.25,joistUnitPrice:14.50,
    fastenerPackSize:100,fastenersPerContact:2,waste:50};
  const d=compute("deck-material-calculator",deck);
  const e=compute("deck-material-calculator",{...deck,
    boardUnitPrice:19.25,fastenerPackPrice:29.95,joistUnitPrice:24.95});
  assert.deepEqual(d.rows,e.rows);
  assert.deepEqual(d.deckFastenerRows,e.deckFastenerRows);
  checkDeck(d,deck,50,"deck quote A");checkDeck(e,deck,50,"deck quote B");
});
