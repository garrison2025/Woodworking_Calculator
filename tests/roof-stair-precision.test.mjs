import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

test("roof sheathing rejects vanishing positive edge strips rather than silently omitting them",()=>{
  const base={width:48,length:96,pitch:0,sheetWidth:48,sheetLength:96,waste:0,orientation:0};
  for(const changed of [
    {width:48+5e-8},{length:96+5e-8},{width:5e-8},{length:5e-8}
  ]){
    const result=safeCompute("roof-sheathing-calculator",{...base,...changed});
    assert.equal(result.ok,false,JSON.stringify(changed));
    assert.match(result.error,/cut-coordinate resolution/,JSON.stringify(changed));
  }
  const exact=compute("roof-sheathing-calculator",base);
  assert.equal(exact.roofSheets.length,1);
  assert.equal(exact.roofSheets[0].full,true);
});

test("roof sheathing narrow but measurable edge strips reconcile every CSV and drawing coordinate",()=>{
  const r=compute("roof-sheathing-calculator",{
    width:48.000002,length:96.000002,pitch:0,
    sheetWidth:48,sheetLength:96,waste:5,orientation:0
  });
  assert.equal(r.roofSheets.length,4);
  assert.equal(r.rows.length,4);
  for(let i=0;i<r.rows.length;i++){
    const row=r.rows[i],s=r.roofSheets[i];
    assert.equal(row.item,s.id);
    for(const key of ["eaveStart","eaveEnd","slopeStart","slopeEnd","cutAlong","cutUphill"])
      assert.equal(row[key],s[key]);
    assert.ok(s.eaveEnd>s.eaveStart&&s.slopeEnd>s.slopeStart);
    assert.ok(Math.abs(s.eaveEnd-s.eaveStart-s.cutAlong)<=1e-8);
    assert.ok(Math.abs(s.slopeEnd-s.slopeStart-s.cutUphill)<=1e-8);
  }
  assert.ok(Math.abs(r.roofSheets.reduce((s,v)=>s+v.cutAreaSqIn,0)-
    r.roofEave*r.roofSlope)<=1e-7);
  const columns=scheduleColumns(r.rows,"mm");
  assert.ok(columns.some(c=>c.label==="Eave End (mm)"));
  const csv=buildScheduleCsv(r.rows,"mm","Roof cut positions");
  assert.ok(csv.includes('"Cut Along (mm)"'));
  assert.ok(csv.includes('"S4"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,6);
});

test("stairs and stringers refuse nonrepresentable positive riser or tread coordinates",()=>{
  const base={rise:105,desired:7.5,tread:10,landing:0};
  for(const changed of [{rise:1e-7,desired:5e-8},{tread:1e-9}]){
    const result=safeCompute("stair-calculator",{...base,...changed});
    assert.equal(result.ok,false,JSON.stringify(changed));
    assert.match(result.error,/cut-coordinate resolution/);
  }
  const stringer={rise:105,risers:14,tread:10,depth:11.25};
  for(const changed of [{rise:1e-7,risers:2},{tread:1e-9}]){
    const result=safeCompute("stair-stringer-calculator",{...stringer,...changed});
    assert.equal(result.ok,false,JSON.stringify(changed));
    assert.match(result.error,/cut-coordinate resolution/);
  }
});

test("fractional stair risers join every tread to the next riser and match CSV",()=>{
  const r=compute("stair-calculator",{rise:95,desired:7,tread:11,landing:28});
  assert.equal(r.rows.length,14);
  assert.equal(r.marks.length,14);
  for(const [i,row] of r.rows.entries()){
    assert.equal(row.run,r.marks[i].x);
    assert.ok(row.riserHeight>=1e-7);
    assert.ok(Math.abs(row.rise-(i+1)*95/14)<1e-8);
    if(i>0){assert.ok(row.rise>r.rows[i-1].rise);assert.ok(row.run>r.rows[i-1].run);}
    if(i<13)assert.ok(Math.abs(row.treadEnd-r.rows[i+1].run)<1e-8);
    else {assert.equal(row.run,143);assert.equal(row.treadEnd,171);}
  }
  const csv=buildScheduleCsv(r.rows,"mm");
  assert.ok(csv.includes('"Riser Height (mm)"'));
  assert.ok(csv.includes('"Tread End (mm)"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,16);
});
