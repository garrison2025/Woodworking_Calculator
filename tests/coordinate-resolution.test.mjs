import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv} from "../src/cut-list.mjs";

test("nonzero but sub-resolution board, panel and baluster gaps cannot become printed zero",()=>{
  const samples=[
    ["deck-board-calculator",{width:12,length:144,board:5.5,gap:1e-9,stock:144,waste:10}],
    ["deck-material-calculator",{width:120,length:144,board:5.5,gap:1e-9,stock:144,joists:16,waste:10}],
    ["wainscoting-calculator",{wall:12,panels:4,margin:0,gap:1e-9,height:18}],
    ["baluster-spacing-calculator",{length:10+4e-9,width:10,gap:4}]
  ];
  for(const [slug,input] of samples){
    const result=safeCompute(slug,input);
    assert.equal(result.ok,false,slug+" should not silently export a zero gap");
    assert.match(result.error,/coordinate resolution/i,slug);
  }
});

test("center marks do not claim to describe sub-resolution physical part faces",()=>{
  const invalid=[
    {length:100,count:4,left:10,right:10,itemWidth:1e-9},
    {length:20,count:2,left:5,right:5,itemWidth:9.999999995}
  ];
  for(const a of invalid){
    const result=safeCompute("equal-spacing-calculator",a);
    assert.equal(result.ok,false,JSON.stringify(a));
    assert.match(result.error,/coordinate resolution/i);
  }
  const centers=compute("equal-spacing-calculator",{
    length:100,count:4,left:10,right:10,itemWidth:0
  });
  assert.ok(centers.rows.every(x=>x.faceLeftEdge===null&&x.clearToPrevious===null));
  const csv=buildScheduleCsv(centers.rows,"mm","Center-only marks");
  // A center-only schedule contains no physical faces. Null-only columns
  // remain unitless and empty; do not invent a measured physical edge.
  assert.ok(csv.includes('"Face Left Edge"'));
  assert.ok(csv.includes('"Center 1","254","","",""'));
});

test("representable narrow gaps, flush layouts and explicit unit conversion stay accepted",()=>{
  const tightBoard=compute("deck-board-calculator",{
    width:12,length:144,board:5.5,gap:.000002,stock:144,waste:10
  });
  assert.ok(tightBoard.rows.length>1);
  for(let i=1;i<tightBoard.rows.length;i++){
    assert.ok(tightBoard.rows[i].left>tightBoard.rows[i-1].right);
    assert.ok(tightBoard.rows[i-1].gapAfter>0);
  }
  const deck=compute("deck-material-calculator",{
    width:120,length:144,board:5.5,gap:.000002,stock:144,joists:16,waste:10
  });
  assert.ok(deck.deckRows.length>1);
  const wainscot=compute("wainscoting-calculator",{
    wall:12,panels:4,margin:0,gap:0,height:18
  });
  assert.ok(wainscot.rows.every((r,i)=>i===0||r.left===wainscot.rows[i-1].right));
  const baluster=compute("baluster-spacing-calculator",{length:10,width:10,gap:4});
  assert.equal(baluster.rows[0].clearGap,0);
  const face=compute("equal-spacing-calculator",{
    length:100,count:4,left:10,right:10,itemWidth:3
  });
  assert.ok(face.rows.every(row=>row.faceRightEdge>row.faceLeftEdge));
});
