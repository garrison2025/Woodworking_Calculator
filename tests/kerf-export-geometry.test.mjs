import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const base={radius:3.937,angle:90,thickness:.75,web:.125,kerf:.125};
const near=(actual,expected,tol=3e-8)=>assert.ok(
  Math.abs(actual-expected)<=tol,"expected "+expected+", got "+actual
);

test("kerf schedules are geometrically closed and non-overlapping across multiple stock sweeps",()=>{
  for(const input of [
    base,
    {...base,radius:5,angle:135},
    {...base,radius:3,angle:180},
    {...base,radius:20,angle:360},
    {...base,radius:8,kerf:.01,web:.1875},
    {...base,radius:16,thickness:.875,web:.25,angle:45}
  ]){
    const model=compute("kerf-bending-calculator",input);
    const sweep=input.angle*Math.PI/180;
    const arc=input.radius*sweep;
    const depth=input.thickness-input.web;
    const closure=2*Math.atan(input.kerf/(2*depth));
    const expectedCount=Math.ceil(sweep/closure-1e-10);
    assert.equal(model.rows.length,expectedCount);
    assert.equal(model.kerfCount,expectedCount);
    near(model.kerfArcLength,arc,2e-12);
    for(const [i,row] of model.rows.entries()){
      const center=(i+.5)*arc/expectedCount;
      near(row.position,center);
      near(row.slotLeft,center-input.kerf/2);
      near(row.slotRight,center+input.kerf/2);
      near(row.slotRight-row.slotLeft,input.kerf);
      near(row.cutDepth,depth);
      near(row.retainedWeb,input.web);
      assert.ok(row.slotLeft>=0);
      assert.ok(row.slotRight<=Math.round(arc*1e8)/1e8);
      assert.ok(row.slotRight>row.slotLeft);
      if(i)assert.ok(row.slotLeft>model.rows[i-1].slotRight);
    }
    const csv=buildScheduleCsv(model.rows,"mm","Geometry only; scrap trial required.");
    assert.match(csv,/Slot Left \(mm\)/);
    assert.match(csv,/Slot Right \(mm\)/);
    assert.equal(csv.split("\r\n").filter(Boolean).length,model.rows.length+2);
  }
});

test("kerf geometry rejects overlapping or non-representable physical mouths",()=>{
  for(const input of [
    {...base,radius:.1},
    {...base,web:1e-9},
    {...base,kerf:1e-9},
    {...base,thickness:.125000001},
    {...base,angle:361}
  ]){
    const r=safeCompute("kerf-bending-calculator",input);
    assert.equal(r.ok,false,JSON.stringify(input));
  }
});

test("crown 38/90 and 45/90 reference magnitudes remain independent of hand",()=>{
  for(const [spring,miter,bevel] of [
    [38,31.61900653746455,33.86291398096767],
    [45,35.264389682754654,30]
  ]){
    for(const inside of [0,1])for(const left of [0,1]){
      const r=compute("crown-molding-calculator",{spring,corner:90,inside,left});
      const sign=inside===left?1:-1;
      near(r.miter,miter,1e-10);
      near(r.bevel,bevel,1e-10);
      near(r.rows[0].miterMagnitudeAngle,miter,1e-7);
      near(r.rows[0].illustrativeMiterAngle,sign*miter,1e-7);
      const labels=scheduleColumns(r.rows,"mm").map(c=>c.label);
      assert.ok(labels.includes("Miter Magnitude Angle (°)"));
      assert.ok(labels.includes("Bevel Magnitude Angle (°)"));
      const csv=buildScheduleCsv(r.rows,"mm","Idealized reference, not saw handedness.");
      assert.match(csv,/Illustrative Miter Angle/);
    }
  }
});
