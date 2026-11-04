import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";

const standard={radius:3.937,angle:90,thickness:.75,web:.125,kerf:.125};

test("Kerf exported slot edges and continuous web cannot quantize to zero",()=>{
  for(const changed of [
    {...standard,web:1e-9},
    {...standard,kerf:1e-9},
    {...standard,web:.749999999}
  ]){
    const trial=safeCompute("kerf-bending-calculator",changed);
    assert.equal(trial.ok,false);
    assert.match(trial.error,/coordinate resolution/i);
  }
  const good=compute("kerf-bending-calculator",standard);
  assert.equal(good.rows.length,8);
  for(const row of good.rows){
    assert.ok(row.slotRight-row.slotLeft>0);
    assert.ok(row.cutDepth>0);
    assert.ok(row.retainedWeb>0);
    assert.ok(row.slotLeft>=0);
  }
});
