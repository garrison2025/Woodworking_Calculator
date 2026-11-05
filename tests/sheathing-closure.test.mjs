import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const metric=(r,label)=>{
  const x=r.metrics.find(m=>m.label===label);
  assert.ok(x,"Missing metric "+label);
  return x.value;
};
const near=(a,b,tol=1e-6)=>
  assert.ok(Math.abs(a-b)<=tol,`Expected ${b}, got ${a}`);

test("flat roof sheet grid preserves every full/edge cut and discarded area",()=>{
  const input={width:70,length:110,pitch:0,sheetWidth:48,sheetLength:96,waste:0,orientation:0};
  const r=compute("roof-sheathing-calculator",input);
  assert.equal(r.rows.length,4);
  assert.deepEqual(r.rows.map(x=>x.item),["S1","S2","S3","S4"]);
  assert.deepEqual(r.rows.map(x=>[x.row,x.column]),[[1,1],[1,2],[2,1],[2,2]]);
  assert.deepEqual(r.rows.map(x=>[x.eaveStart,x.eaveEnd,x.slopeStart,x.slopeEnd]),[
    [0,96,0,48],[96,110,0,48],[0,96,48,70],[96,110,48,70]
  ]);
  assert.deepEqual(r.rows.map(x=>[x.cutAlong,x.cutUphill]),[[96,48],[14,48],[96,22],[14,22]]);
  const offcut=[0,3936,2496,4300];
  for(let i=0;i<4;i++){
    const row=r.rows[i],sheet=r.roofSheets[i];
    near(row.cutAreaFt2*144,row.cutAlong*row.cutUphill,1e-8);
    near(row.offcutAreaFt2*144,offcut[i],1e-8);
    near(sheet.offcutAreaSqIn,offcut[i],1e-8);
    near(row.eaveEnd-row.eaveStart,row.cutAlong);
    near(row.slopeEnd-row.slopeStart,row.cutUphill);
    near(row.cutAreaFt2+row.offcutAreaFt2,32);
  }
  near(metric(r,"Sloped roof surface")*144,7700);
  near(metric(r,"Unreused offcut area")*144,10732);
  near(metric(r,"Stock face area before allowance")*144,18432);
  near(metric(r,"Sloped roof surface")+metric(r,"Unreused offcut area"),
       metric(r,"Stock face area before allowance"));
  assert.equal(metric(r,"Full sheets"),1);
  assert.equal(metric(r,"Edge-cut sheets"),3);
});
test("pitched roof and rotated sheet grids preserve area, ends and non-overlap",()=>{
  for(const width of [48,70,144,183])
    for(const length of [80,96,110,193])
      for(const pitch of [0,2,6,10])
        for(const orientation of [0,1]){
          const input={width,length,pitch,sheetWidth:48,sheetLength:96,waste:0,orientation};
          const r=compute("roof-sheathing-calculator",input);
          const expectArea=width*length*Math.hypot(1,pitch/12);
          const stockArea=r.rows.length*48*96;
          const used=r.rows.reduce((s,x)=>s+x.cutAreaFt2*144,0);
          const lost=r.rows.reduce((s,x)=>s+x.offcutAreaFt2*144,0);
          near(used,expectArea,Math.max(1e-5,expectArea*1e-9));
          near(used+lost,stockArea,Math.max(1e-5,stockArea*1e-10));
          assert.equal(new Set(r.rows.map(x=>x.row+"-"+x.column)).size,r.rows.length);
          const along=orientation===0?96:48,uphill=orientation===0?48:96;
          for(const row of r.rows){
            assert.ok(Number.isInteger(row.row)&&row.row>=1);
            assert.ok(Number.isInteger(row.column)&&row.column>=1);
            near(row.eaveStart,(row.column-1)*along,1e-7);
            near(row.slopeStart,(row.row-1)*uphill,1e-7);
            near(row.eaveEnd-row.eaveStart,row.cutAlong,1e-7);
            near(row.slopeEnd-row.slopeStart,row.cutUphill,1e-7);
            assert.ok(row.eaveStart>=0&&row.slopeStart>=0);
            assert.ok(row.eaveEnd<=length+1e-6);
            assert.ok(row.slopeEnd<=width*Math.hypot(1,pitch/12)+1e-6);
            assert.ok(row.cutAlong>0&&row.cutAlong<=along+1e-6);
            assert.ok(row.cutUphill>0&&row.cutUphill<=uphill+1e-6);
            near(row.cutAreaFt2*144+row.offcutAreaFt2*144,48*96,1e-6);
          }
        }
});
test("scrap columns are areas, not lengths, across ft/in and metric CSV",()=>{
  const r=compute("roof-sheathing-calculator",{width:70,length:110,pitch:0,sheetWidth:48,sheetLength:96,waste:0,orientation:0});
  for(const unit of ["in","ft","mm","cm","m"]){
    const cols=scheduleColumns(r.rows,unit);
    const areaUnit=["in","ft"].includes(unit)?"ft²":"m²";
    assert.equal(cols.find(x=>x.key==="cutAreaFt2")?.label,"Cut Area ("+areaUnit+")");
    assert.equal(cols.find(x=>x.key==="offcutAreaFt2")?.label,"Offcut Area ("+areaUnit+")");
    assert.equal(cols.find(x=>x.key==="cutAreaFt2")?.kind,"area");
    assert.equal(cols.find(x=>x.key==="offcutAreaFt2")?.kind,"area");
    assert.equal(cols.find(x=>x.key==="row")?.kind,"plain");
    assert.equal(cols.find(x=>x.key==="column")?.kind,"plain");
    assert.equal(cols.find(x=>x.key==="eaveEnd")?.label,"Eave End ("+unit+")");
    assert.equal(cols.find(x=>x.key==="slopeEnd")?.label,"Slope End ("+unit+")");
    const csv=buildScheduleCsv(r.rows,unit,"cut area is theoretical");
    assert.ok(csv.includes('"Cut Area ('+areaUnit+')","Offcut Area ('+areaUnit+')"'));
    assert.ok(csv.includes('"S4","2","2"'));
    const lines=csv.trim().split("\r\n");
    assert.equal(lines.length,6); // header, four sheet rows and one source note
    const keys=cols.map(x=>x.key);
    const header=lines[0];
    assert.ok(header.includes('"Row","Column"'));
    const rec=lines[2].split('","').map(x=>x.replace(/"/g,""));
    const areaIndex=keys.indexOf("cutAreaFt2"),scrapIndex=keys.indexOf("offcutAreaFt2");
    const factor=["in","ft"].includes(unit)?1:.09290304;
    near(Number(rec[areaIndex]),(672/144)*factor,1e-9);
    near(Number(rec[scrapIndex]),(3936/144)*factor,1e-9);
  }
  const bad=safeCompute("roof-sheathing-calculator",{width:70,length:110,pitch:0,sheetWidth:.001,sheetLength:.001,waste:0,orientation:0});
  assert.equal(bad.ok,false);
});
