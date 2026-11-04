import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const metric=(r,label)=>{
  const m=r.metrics.find(x=>x.label===label);
  assert.ok(m,"Missing metric: "+label);
  return m.value;
};
const near=(x,y,tol=1e-7)=>
  assert.ok(Math.abs(x-y)<=tol,"Expected "+y+" but got "+x);

test("deck face coordinates close to coverage, with a real narrow final rip",()=>{
  const a={width:120,length:144,board:5.5,gap:.125,stock:144,waste:10};
  const r=compute("deck-board-calculator",a);
  assert.equal(r.rows.length,22);
  assert.equal(r.boardRows,r.rows);
  near(metric(r,"Board rows"),22);
  near(metric(r,"Last rip width"),1.875);
  near(metric(r,"Total installed board-face width"),117.375);
  near(metric(r,"Total spaces between board rows"),2.625);
  near(metric(r,"Covered deck width"),120);
  near(metric(r,"Stock pieces per row (unverified joints)"),1);
  near(metric(r,"Stock pieces: no offcut reuse"),25);
  for(const [i,row] of r.rows.entries()){
    const left=i*5.625,w=i===21?1.875:5.5;
    near(row.position,left);near(row.left,left);
    near(row.right,left+w);near(row.ripWidth,w);
    assert.equal(row.gapAfter,i===21?null:.125);
    near(row.right-row.left,w);
    if(i<21)near(r.rows[i+1].left-row.right,.125);
  }
  near(r.rows.at(-1).right,120);
  near(r.rows.reduce((s,row)=>s+row.ripWidth+(row.gapAfter||0),0),120);
});
test("deck stock count is an unverified quantity, not a joint schedule",()=>{
  const a={width:120,length:144,board:5.5,gap:.125,stock:100,waste:0};
  const r=compute("deck-board-calculator",a);
  near(metric(r,"Stock pieces per row (unverified joints)"),2);
  near(metric(r,"Stock pieces: no offcut reuse"),44);
  assert.equal(r.rows.length,22);
  assert.ok(!r.rows.some(x=>"buttJointAtEnd" in x));
  assert.equal(safeCompute("deck-board-calculator",{...a,width:5.62500005}).ok,false);
  const single=compute("deck-board-calculator",{...a,width:4,stock:200});
  assert.equal(single.rows.length,1);
  near(single.rows[0].right,4);
  assert.equal(single.rows[0].gapAfter,null);
  near(metric(single,"Total spaces between board rows"),0);
});
test("baluster faces and n+1 equal spaces conserve a clear opening",()=>{
  const a={length:96,width:1.5,gap:4};
  const r=compute("baluster-spacing-calculator",a);
  assert.equal(r.rows.length,17);
  near(metric(r,"Baluster count"),17);
  const g=(96-17*1.5)/18;
  near(metric(r,"Equal clear gap"),g);
  near(metric(r,"Total baluster face width"),25.5);
  near(metric(r,"Total clear spaces"),70.5);
  near(metric(r,"Opening closure width"),96);
  near(r.rows[0].faceLeft,g);
  near(96-r.rows.at(-1).faceRight,g);
  for(const [i,p] of r.rows.entries()){
    near(p.center-(p.faceLeft+p.faceRight)/2,0);
    near(p.faceRight-p.faceLeft,1.5);
    near(p.clearGap,g);
    assert.equal(p.clearGapToNext,i===16?null:Math.round(g*1e8)/1e8);
    if(i<16)near(r.rows[i+1].faceLeft-p.faceRight,g);
  }
  near(r.rows.reduce((sum,p)=>sum+p.faceRight-p.faceLeft,0)+18*g,96);
});
test("baluster one-face occupancy and large quantities preserve physical boundaries",()=>{
  const one=compute("baluster-spacing-calculator",{length:10,width:10,gap:4});
  assert.equal(one.rows.length,1);
  near(one.rows[0].faceLeft,0);near(one.rows[0].faceRight,10);
  near(metric(one,"Equal clear gap"),0);
  const small=compute("baluster-spacing-calculator",{length:120,width:.125,gap:.25});
  assert.ok(small.rows.length<=500);
  assert.ok(small.rows.every(p=>p.faceRight>p.faceLeft));
  near(small.rows[0].faceLeft,metric(small,"Equal clear gap"));
  near(small.rows.at(-1).faceRight,120-metric(small,"Equal clear gap"));
  assert.equal(safeCompute("baluster-spacing-calculator",{length:10,width:11,gap:4}).ok,false);
  assert.equal(safeCompute("baluster-spacing-calculator",{length:10,width:1e-9,gap:4}).ok,false);
});
test("fence outer faces, signed ends and clear bays close to outside length",()=>{
  const a={length:1200,bay:96,post:3.5};
  const r=compute("fence-post-calculator",a);
  assert.equal(r.rows.length,14);
  const actualOC=1200/13,clear=actualOC-3.5;
  near(metric(r,"Bays"),13);near(metric(r,"Posts"),14);
  near(metric(r,"True OC interval"),actualOC);
  near(metric(r,"Approximate clear bay"),clear);
  near(metric(r,"Outside-to-outside fence length"),1203.5);
  near(metric(r,"Total post face widths"),49);
  near(metric(r,"Total usable clear bays"),13*clear);
  near(r.rows[0].faceLeft,-1.75);near(r.rows[0].faceRight,1.75);
  near(r.rows.at(-1).faceLeft,1198.25);
  near(r.rows.at(-1).faceRight,1201.75);
  for(const [i,p] of r.rows.entries()){
    near(p.faceRight-p.faceLeft,3.5);
    near(p.center-(p.faceLeft+p.faceRight)/2,0);
    if(i<13){
      near(r.rows[i+1].faceLeft-p.faceRight,clear);
      near(p.clearBayToNext,clear);
    } else assert.equal(p.clearBayToNext,null);
  }
  near((r.rows.at(-1).faceRight-r.rows[0].faceLeft),1203.5);
  near(r.rows.reduce((s,p)=>s+p.faceRight-p.faceLeft+(p.clearBayToNext||0),0),1203.5,1e-6);
});
test("fence geometric gap limits and unit-aware signed face CSV",()=>{
  for(const [length,bay,post] of [[120,24,23.5],[250,60,3.5],[1200,96,3.5]]){
    const r=compute("fence-post-calculator",{length,bay,post});
    near(metric(r,"Outside-to-outside fence length"),length+post);
    near(r.rows.at(-1).faceRight-r.rows[0].faceLeft,length+post);
  }
  assert.equal(safeCompute("fence-post-calculator",{length:120,bay:24,post:24}).ok,false);
  const r=compute("fence-post-calculator",{length:120,bay:24,post:23.5});
  const cols=scheduleColumns(r.rows,"mm");
  assert.ok(cols.some(x=>x.label==="Face Left (mm)"));
  const csv=buildScheduleCsv(r.rows,"mm");
  assert.ok(csv.includes('"Face Left (mm)","Face Right (mm)"'),csv.slice(0,300));
  assert.ok(csv.includes('"Post 1","0","-298.45","298.45","12.7"'),csv.slice(0,500));
});
