import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv} from "../src/cut-list.mjs";

const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,
  "Expected "+a+" ≈ "+b+" within "+tol);
const framing={
  length:120,spacing:16,width:1.5,wallHeight:100.5,
  openingStart:32,openingWidth:36,openingHeight:80,
  studStockLength:96,headerStockLength:96,sillStockLength:96
};

test("Framing must not purchase stock a quantized increment shorter than a physical cut",()=>{
  const r=safeCompute("framing-calculator",{...framing,wallHeight:100.500000008});
  assert.equal(r.ok,false,"Old 1e-8 tolerance permitted an overlength cut");
  assert.match(r.error,/cut exceeds all quoted stock lengths|longer stock required|stock length/i);
  const withLongOffer=compute("framing-calculator",{
    ...framing,wallHeight:100.500000008,
    studAltStockLength:120,studAltUnitPrice:7.25,
    headerUnitPrice:14.25
  });
  assert.ok(withLongOffer.stockPlan.length>0);
  for(const stock of withLongOffer.stockPlan){
    assert.ok(stock.usedLength<=stock.stockLength+1e-12,
      stock.stockId+" consumes longer than purchased source stock");
    for(const cut of stock.cuts){
      assert.ok(cut.cutLength<=stock.stockLength+1e-12,
        cut.item+" longer than its assigned stock");
    }
    near(stock.piecesLength+stock.kerfLoss+stock.offcutLength,
      stock.stockLength,1e-6);
  }
});

test("Full-width joist stock must not be slightly shorter than the actual decking width",()=>{
  const base={width:120,length:144,board:5.5,gap:.125,stock:144,
    joists:16,waste:0,joistUnitPrice:15.75};
  const tooShort=safeCompute("deck-material-calculator",{
    ...base,joistStockLength:119.999999992
  });
  assert.equal(tooShort.ok,false);
  assert.match(tooShort.error,/cannot cover full deck width/i);
  const exact=compute("deck-material-calculator",{
    ...base,joistStockLength:120
  });
  assert.ok(exact.rows.filter(row=>row.type==="Joist straight cut").every(
    row=>row.cutLength<=row.purchasedStockLength));
});

test("Decking stock must not silently cover an overlong single piece when no seam support exists",()=>{
  const base={width:30,length:100.000000008,board:5.5,gap:.125,
    stock:100,joists:150,waste:0};
  const r=safeCompute("deck-material-calculator",base);
  assert.equal(r.ok,false);
  assert.match(r.error,/intermediate joist center|stock length|seam/i);
  const valid=compute("deck-material-calculator",{...base,stock:100.00000001});
  for(const row of valid.rows.filter(row=>row.type==="Decking")){
    assert.ok(row.cutLength<=100.00000001+1e-12);
  }
});

test("Deck pricing and stock allowances change purchasing, not cut geometry or fasteners",()=>{
  const base={width:120,length:144,board:5.5,gap:.125,stock:60,
    joists:16,boardUnitPrice:8.75,fastenerPackSize:100,
    fastenersPerContact:2,fastenerPackPrice:20.25,
    joistStockLength:120,joistUnitPrice:13.50};
  const runs=[0,10,50,100].map(waste=>compute("deck-material-calculator",{
    ...base,waste
  }));
  const geometry=JSON.stringify(runs[0].rows),fasteners=runs[0].deckFastenerRows;
  let previous=-1;
  for(const [index,r] of runs.entries()){
    const waste=[0,10,50,100][index];
    assert.equal(JSON.stringify(r.rows),geometry);
    assert.deepEqual(r.deckFastenerRows,fasteners);
    assert.equal(r.deckCostSummary.fastenerPacks,runs[0].deckCostSummary.fastenerPacks);
    assert.equal(r.deckCostSummary.purchaseBoards,
      Math.ceil(r.deckCostSummary.stockedBoards*(1+waste/100)-1e-10));
    assert.equal(r.deckCostSummary.joistPurchaseCount,
      Math.ceil(r.deckCostSummary.joistStockCount*(1+waste/100)-1e-10));
    const price=r.deckCostSummary.quotedSubtotal;
    assert.ok(price>=previous);
    previous=price;
    const rows=r.deckPurchaseRows;
    const sum=rows.reduce((total,x)=>total+x.purchaseCost,0);
    near(sum,price,1e-6);
    for(const item of rows)if(item.unitPrice!==null)
      near(item.purchaseCost,item.purchaseQuantity*item.unitPrice,1e-6);
    const csv=buildScheduleCsv(rows,"mm","Purchase quote");
    assert.ok(csv.includes('"Purchase Quantity"'));
  }
});

test("Framing waste allowance never changes physical cut rows, quotes reconcile to cents",()=>{
  const base={...framing,wallHeight:100.5,studStockLength:120,
    headerStockLength:120,studUnitPrice:5.25,headerUnitPrice:14.75};
  const runs=[0,10,50,100].map(stockWaste=>
    compute("framing-calculator",{...base,stockWaste}));
  const stockCut=JSON.stringify(runs[0].stockCuts);
  const stockPlan=JSON.stringify(runs[0].stockPlan);
  let last=-1;
  for(const [index,r] of runs.entries()){
    const allowance=[0,10,50,100][index];
    assert.equal(JSON.stringify(r.stockCuts),stockCut);
    assert.equal(JSON.stringify(r.stockPlan),stockPlan);
    assert.equal(r.costSummary.allPricesEntered,true);
    assert.ok(r.costSummary.quotedSubtotal>=last);
    last=r.costSummary.quotedSubtotal;
    const rows=r.purchaseVariants;
    for(const row of rows){
      const reserve=row.plannedSticks?
        Math.ceil(row.plannedSticks*(1+allowance/100)-1e-10)-row.plannedSticks:0;
      assert.equal(row.allowanceSticks,reserve);
      assert.equal(row.purchaseSticks,row.plannedSticks+reserve);
      if(row.unitPrice===null)continue;
      near(row.purchaseCost*100,
        row.purchaseSticks*Math.round(row.unitPrice*100),1e-6);
      near((row.plannedCost+row.reserveCost)*100,
        row.purchaseCost*100,1e-6);
    }
    near(r.costSummary.quotedSubtotal,
      rows.reduce((total,row)=>total+(row.purchaseCost??0),0),1e-7);
  }
});

test("Roof allowance changes purchase count without affecting physical roof SVG/CSV source",()=>{
  const base={width:70,length:110,pitch:0,sheetWidth:48,sheetLength:96,
    orientation:0,reuseMode:1,roofKerf:0};
  const runs=[0,10,50,100].map(waste=>
    compute("roof-sheathing-calculator",{...base,waste}));
  const expected=JSON.stringify(runs[0].rows);
  const stock=JSON.stringify(runs[0].roofReusePlan.rows);
  for(let i=0;i<runs.length;i++){
    const r=runs[i],waste=[0,10,50,100][i];
    assert.equal(JSON.stringify(r.rows),expected);
    assert.equal(JSON.stringify(r.roofReusePlan.rows),stock);
    const metric=label=>r.metrics.find(x=>x.label===label)?.value;
    assert.equal(metric("Order sheets with allowance"),
      Math.ceil(r.roofSheets.length*(1+waste/100)-1e-10));
    assert.equal(metric("Order sheets after reuse and allowance"),
      Math.ceil(r.roofReusePlan.stockCount*(1+waste/100)-1e-10));
  }
});
