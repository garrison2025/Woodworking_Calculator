import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv} from "../src/cut-list.mjs";

// These are independent boundary checks for representable cut dimensions,
// NOT engineering or physical material-strength acceptance.
const rafter={run:120,pitch:6,ridge:0,overhang:12,depth:5.5,seat:3};
const stringer={rise:105,risers:14,tread:10,depth:11.25,
  treadThickness:1.5,lowerFinish:0};
const tiny=1e-9;
const reject=(slug,input,pattern)=> {
  const outcome=safeCompute(slug,input);
  assert.equal(outcome.ok,false,slug+" silently accepted a rounded-away cut");
  assert.match(outcome.error,pattern);
};

test("rafter rejects nonzero seat or heel below coordinate resolution",()=>{
  reject("rafter-calculator",{...rafter,seat:tiny},/cut-coordinate resolution/);
  reject("rafter-calculator",{...rafter,pitch:1e-7},/cut-coordinate resolution/);
  reject("rafter-calculator",{...rafter,pitch:12,seat:3,
    depth:3/Math.sqrt(2)+tiny},/cut-coordinate resolution/);
  // Zero pitch or zero seat deliberately describes no material-removing cut.
  for(const a of [{...rafter,pitch:0},{...rafter,seat:0}]){
    const r=compute("rafter-calculator",a);
    assert.equal(r.birdsmouthCutRows.length,0);
  }
});

test("rafter accepted small-but-resolvable cut exports two noncollapsed segments",()=>{
  const r=compute("rafter-calculator",{...rafter,seat:1e-6});
  assert.equal(r.birdsmouthCutRows.length,2);
  assert.equal(r.rows.length,5);
  assert.ok(r.seatStart.x<r.heelTop.x);
  assert.ok(r.heelTop.y<r.heelBottom.y);
  const seat=r.birdsmouthCutRows[0],heel=r.birdsmouthCutRows[1];
  assert.equal(seat.cutLength,1e-6);
  assert.ok(heel.cutLength>0);
  assert.equal(seat.endX,heel.startX);
  assert.equal(seat.endY,heel.startY);
  const csv=buildScheduleCsv(r.rows,"mm","Birdsmouth reference cuts");
  assert.match(csv,/Birdsmouth horizontal seat/);
  assert.match(csv,/Birdsmouth plumb heel/);
});

test("stringer rejects remaining wood and bottom correction rounded to zero",()=>{
  const notch=7.5*10/Math.hypot(7.5,10);
  assert.equal(notch,6);
  reject("stair-stringer-calculator",{...stringer,depth:notch+tiny},
    /cut-coordinate resolution/);
  reject("stair-stringer-calculator",{...stringer,
    treadThickness:7.5-tiny},/cut-coordinate resolution/);
  const valid=compute("stair-stringer-calculator",stringer);
  assert.ok(valid.throat>1);
  assert.equal(valid.bottomLayoutRise,6);
  assert.equal(valid.rows.length,14);
});

test("rafter independent parametric closure across six slopes and bearings",()=>{
  for(const pitch of [0,1,2,6,9,12,18])
  for(const ridge of [0,1.5,3]){
    const s=pitch/12,run=120-ridge/2,seat=2.5;
    const model=compute("rafter-calculator",{...rafter,pitch,ridge,seat,depth:8});
    const angle=Math.atan(s),notch=seat*Math.sin(angle);
    assert.ok(Math.abs(model.run-run)<1e-10);
    assert.ok(Math.abs(model.rise-run*s)<1e-10);
    assert.ok(Math.abs(model.notchNormal-notch)<1e-10);
    assert.ok(Math.abs(model.hap-(8*Math.hypot(1,s)-seat*s))<1e-10);
    assert.ok(Math.abs(model.seatStart.y-model.heelTop.y)<1e-8);
    assert.ok(Math.abs(model.heelBottom.y-model.heelTop.y-seat*s)<2e-8);
    assert.equal(model.birdsmouthCutRows.length,pitch===0?0:2);
    assert.ok(Math.abs(model.notchAreaSqIn-seat*seat*s/2)<1e-9);
  }
});
