import test from "node:test";
import assert from "node:assert/strict";
import {exactFramingStock} from "../src/calcs.mjs";

// This oracle deliberately does not call the application's FFD packer,
// candidate scorer, memoization, or branch-and-bound state compression.
// Short cases are exhaustively assigned to every feasible current or fresh
// stock bar. Purchase reserve is computed separately for EACH supplier SKU.
let seed=0x4B275AE3;
const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const pick=a=>a[Math.floor(rng()*a.length)];
const allowanceCount=(n,waste)=>n?Math.ceil(n*(1+waste/100)-1e-10):0;

function totalCents(bars,offers,waste){
  return offers.reduce((sum,o)=>{
    const count=bars.filter(b=>b.offer.code===o.code).length;
    return sum+allowanceCount(count,waste)*Math.round(o.unitPrice*100);
  },0);
}
function verifyPhysical(bars,parts,kerf){
  const counted=new Map();
  for(const bar of bars){
    assert.ok(bar.cuts.length>0);
    const used=bar.cuts.reduce((sum,p)=>sum+p.cutLength,0)+(bar.cuts.length-1)*kerf;
    assert.ok(Math.abs(used-bar.used)<1e-7,"candidate saw kerf accounting is inconsistent");
    assert.ok(used<=bar.offer.stockLength+1e-12,
      "cut pack exceeds its actual purchased stock");
    for(const cut of bar.cuts){
      assert.ok(cut.cutLength<=bar.offer.stockLength+1e-12);
      counted.set(cut.item,(counted.get(cut.item)||0)+1);
    }
  }
  assert.equal(counted.size,parts.length);
  for(const p of parts)assert.equal(counted.get(p.item),1,"lost/duplicated "+p.item);
}
function independentMinimum(parts,offers,kerf,waste){
  let best=Infinity;
  const bars=[];
  function walk(i){
    if(i===parts.length){
      best=Math.min(best,totalCents(bars,offers,waste));
      return;
    }
    const p=parts[i];
    const seen=new Set();
    for(const b of bars){
      const fingerprint=b.offer.code+"|"+b.used;
      if(seen.has(fingerprint))continue;
      seen.add(fingerprint);
      const add=p.cutLength+kerf;
      if(b.used+add>b.offer.stockLength+1e-12)continue;
      b.used+=add;b.cuts.push(p);walk(i+1);b.cuts.pop();b.used-=add;
    }
    for(const o of offers){
      if(p.cutLength>o.stockLength+1e-12)continue;
      bars.push({offer:o,used:p.cutLength,cuts:[p]});
      walk(i+1);bars.pop();
    }
  }
  walk(0);
  return best;
}
function seedCandidate(parts,offers,waste){
  const bars=parts.map(p=>{
    const o=offers.find(x=>x.stockLength>=p.cutLength);
    if(!o)throw Error("invalid oracle fixture: unbuyable piece");
    return {offer:o,used:p.cutLength,cuts:[p]};
  });
  return {bars,purchaseCost:totalCents(bars,offers,waste)/100,
    purchaseCount:offers.reduce((sum,o)=>
      sum+allowanceCount(bars.filter(b=>b.offer.code===o.code).length,waste),0)};
}

test("Certified small mixed-stock plans equal a separately enumerated cent-accurate optimum",()=>{
  let trials=0,mixed=0;
  for(let i=0;i<22;i++){
    const len=[64,80,104];
    const offers=len.map((stockLength,j)=>({
      code:"SKU-"+j,stockLength,
      unitPrice:(300+Math.floor(rng()*1600))/100
    }));
    const parts=Array.from({length:4+i%2},(_,j)=>({
      item:"Member-"+j,cutLength:pick([16,24,28,32,36,40,48,52,60,68,80])
    })).sort((a,b)=>b.cutLength-a.cutLength||a.item.localeCompare(b.item));
    const kerf=pick([0,.125,.25]);
    for(const allowance of [0,10,50,100]){
      const fixture="trial="+i+" allowance="+allowance+
        " kerf="+kerf+" offers="+JSON.stringify(offers)+
        " parts="+JSON.stringify(parts);
      const oracle=independentMinimum(parts,offers,kerf,allowance);
      const exact=exactFramingStock(parts,offers,kerf,allowance,
        seedCandidate(parts,offers,allowance),{nodeLimit:40000});
      assert.equal(exact.certified,true,fixture+" was incorrectly uncertified");
      const bars=exact.candidate.bars;
      verifyPhysical(bars,parts,kerf);
      assert.equal(totalCents(bars,offers,allowance),oracle,
        fixture+" certified an above-minimum source quote");
      if(new Set(bars.map(b=>b.offer.code)).size>1)mixed++;
      trials++;
    }
  }
  assert.equal(trials,88);
  assert.ok(mixed>0,"No mixed-stock optimum was exercised");
});

test("Physical one-quantum overlength remains prohibited in exact optimization",()=>{
  const piece={item:"Precision-critical cut",cutLength:96.00000001};
  const short={code:"short",stockLength:96.000000006,unitPrice:4};
  const exact={code:"exact",stockLength:96.00000001,unitPrice:5};
  const stock=seedCandidate([piece],[exact],0);
  const search=exactFramingStock([piece],[short,exact],0,0,stock);
  assert.equal(search.certified,true);
  verifyPhysical(search.candidate.bars,[piece],0);
  assert.equal(search.candidate.bars[0].offer.code,"exact");
  assert.equal(totalCents(search.candidate.bars,[short,exact],0),500);
});
