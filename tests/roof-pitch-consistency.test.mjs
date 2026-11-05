import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute,convertFromInches} from "../src/calcs.mjs";
import {scheduleColumns,buildScheduleCsv} from "../src/cut-list.mjs";

const metric=(data,name)=>{
  const found=data.metrics.find(m=>m.label===name);
  assert.ok(found,"Missing metric: "+name);
  return found.value;
};
const near=(actual,expected,tol=1e-8)=>{
  assert.ok(Math.abs(actual-expected)<=tol,`Expected ${expected} but received ${actual}`);
};
test("6:12 common roof, common rafter and 45-degree-plan hip have distinct but consistent slopes",()=>{
  const pitch=compute("roof-pitch-calculator",{run:120,pitch:6});
  const common=compute("rafter-calculator",{run:120,pitch:6,ridge:0,overhang:0,depth:5.5,seat:3});
  const hip=compute("hip-rafter-calculator",{runX:120,runY:120,pitch:6});
  const faceAngle=Math.atan(.5)*180/Math.PI;
  const hipAngle=Math.atan2(60,Math.hypot(120,120))*180/Math.PI;
  near(metric(pitch,"Roof angle"),faceAngle);
  near(metric(common,"Plumb cut angle"),faceAngle);
  near(metric(hip,"Common roof-face slope angle"),faceAngle);
  near(metric(pitch,"Rise over reference run"),60);
  near(metric(common,"Rise"),60);
  near(metric(hip,"Vertical rise"),60);
  near(metric(pitch,"Slope line"),Math.hypot(120,60));
  near(metric(common,"Rafter reference length"),Math.hypot(120,60));
  near(metric(hip,"Plan diagonal"),Math.hypot(120,120));
  near(metric(hip,"Hip line length"),180);
  near(metric(hip,"Plan hip angle"),45);
  near(metric(hip,"Hip elevation angle"),hipAngle);
  near(metric(hip,"Effective hip pitch per 12 plan run"),Math.sqrt(18));
  assert.ok(metric(hip,"Hip elevation angle")<metric(pitch,"Roof angle"));
  assert.equal(hip.shape,"hip-line");
  assert.equal(hip.rows.length,1);
  assert.equal(hip.rows[0].item,"Hip line reference");
  assert.deepEqual(hip.referencePoints,[{x:0,y:0,z:0},{x:120,y:120,z:60}]);
  assert.equal(common.shape,"rafter");
  assert.equal(common.referencePoints,common.rows);
  assert.equal(pitch.shape,"triangle");
});

test("roof pitch, ridge-adjusted common rafter and across-run hip geometry agree across 72 inputs",()=>{
  let trials=0;
  for(const pitch of [0,2,6,12])
  for(const run of [24,120,345.678])
  for(const ridge of [0,1.5,3])
  for(const xFactor of [.5,1]){
    const adjusted=run-ridge/2;
    const ref=compute("roof-pitch-calculator",{pitch,run:adjusted});
    const r=compute("rafter-calculator",{run,pitch,ridge,overhang:12,seat:2,depth:5.5});
    const hip=compute("hip-rafter-calculator",{runX:adjusted*xFactor,runY:adjusted,pitch});
    const rise=adjusted*pitch/12;
    const horizontal=Math.hypot(adjusted*xFactor,adjusted);
    const hipLength=Math.hypot(horizontal,rise);
    near(metric(r,"Ridge centerline run before allowance"),run);
    near(metric(r,"Adjusted run"),adjusted);
    near(metric(ref,"Rise over reference run"),rise);
    near(metric(r,"Rise"),rise);
    near(metric(hip,"Vertical rise"),rise);
    near(metric(ref,"Slope line"),metric(r,"Rafter reference length"),1e-8);
    near(metric(ref,"Roof angle"),metric(r,"Plumb cut angle"),1e-10);
    near(metric(hip,"Plan diagonal"),horizontal,1e-9);
    near(metric(hip,"Hip line length"),hipLength,1e-9);
    near(metric(hip,"Hip elevation angle"),Math.atan2(rise,horizontal)*180/Math.PI,1e-10);
    near(metric(hip,"Effective hip pitch per 12 plan run"),12*rise/horizontal,1e-10);
    near(metric(hip,"Common roof-face slope angle"),metric(ref,"Roof angle"),1e-10);
    near(metric(r,"Total horizontal run to tail"),adjusted+12);
    near(metric(r,"Total slope to tail"),Math.hypot(adjusted+12,(adjusted+12)*pitch/12),1e-9);
    near(r.totalRise,(adjusted+12)*pitch/12);
    near(r.referencePoints[1].horizontalRun,adjusted,1e-8);
    near(r.referencePoints[2].verticalDrop,r.totalRise,1e-8);
    trials++;
  }
  assert.equal(trials,72);
});

test("zero-pitch hip is planar and birdsmouth notch reference has no depth",()=>{
  const pitch=compute("roof-pitch-calculator",{pitch:0,run:120});
  const raf=compute("rafter-calculator",{run:120,pitch:0,ridge:0,overhang:12,seat:3,depth:5.5});
  const hip=compute("hip-rafter-calculator",{runX:120,runY:120,pitch:0});
  near(metric(pitch,"Roof angle"),0);
  near(metric(raf,"Seat reference drop"),0);
  near(metric(raf,"Seat notch (normal depth)"),0);
  near(metric(hip,"Hip elevation angle"),0);
  near(metric(hip,"Hip line length"),metric(hip,"Plan diagonal"));
  near(metric(hip,"Effective hip pitch per 12 plan run"),0);
  for(const changed of [
    {runX:-1,runY:120,pitch:6},
    {runX:120,runY:0,pitch:6},
    {runX:120,runY:120,pitch:-1}
  ])assert.equal(safeCompute("hip-rafter-calculator",changed).ok,false);
});

test("hip reference CSV distinguishes length dimensions from plan/elevation angles in five units",()=>{
  const hip=compute("hip-rafter-calculator",{runX:120,runY:120,pitch:6});
  for(const unit of ["in","ft","mm","cm","m"]){
    const cols=scheduleColumns(hip.rows,unit);
    for(const key of ["alongPlanRun","acrossPlanRun","verticalRise","planDiagonal","trueHipLength"]){
      const col=cols.find(c=>c.key===key);
      assert.equal(col?.kind,"length");
      assert.ok(col.label.endsWith("("+unit+")"));
    }
    for(const key of ["planAngleDeg","hipElevationAngleDeg"]){
      const col=cols.find(c=>c.key===key);
      assert.equal(col?.kind,"angle");
      assert.ok(col.label.endsWith("(°)"));
    }
    const csv=buildScheduleCsv(hip.rows,unit,"hip line reference; not saw settings");
    assert.ok(csv.includes('"Hip Line Reference"')===false); // Item cell is a value, not a header
    assert.ok(csv.includes('"Hip line reference"'));
    assert.ok(csv.includes('"Plan Angle Deg (°)","Hip Elevation Angle Deg (°)"'));
    const line=csv.replace(/^\uFEFF/,"").trimEnd().split("\r\n");
    assert.equal(line.length,3); // header, one geometry row, source note
    const factor=convertFromInches(1,unit);
    assert.ok(csv.includes('"'+Number((120*factor).toPrecision(12)).toString()+'"')||unit==="mm"||unit==="cm"||unit==="m");
  }
});
