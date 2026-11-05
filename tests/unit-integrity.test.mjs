import {test} from "node:test";
import assert from "node:assert/strict";
import {convertEditableLength,inchFraction} from "../src/calcs.mjs";

test("unit switching keeps very small nonzero gaps without turning them into zero",()=>{
  for(const original of [0.000002,0.0000001,-0.000002,0.125,36.03125,144]){
    let n=original,unit="in";
    for(const next of ["ft","mm","m","cm","in"]){
      n=convertEditableLength(n,unit,next);
      unit=next;
      assert.equal(Number.isFinite(n),true);
      if(original!==0)assert.notEqual(n,0,"small measurement must not be erased");
    }
    assert.ok(Math.abs(n-original)<=Math.max(1e-12,Math.abs(original)*1e-9),
      "round trip from "+original+" became "+n);
  }
  assert.throws(()=>convertEditableLength(2,"in","yard"),/Unsupported/);
});

test("approximate inch fractions retain sign and carry without changing numeric CSV",()=>{
  assert.equal(inchFraction(39.03125,32),"39 1/32 in");
  assert.equal(inchFraction(-1.5,16),"−1 1/2 in");
  assert.equal(inchFraction(-0.03125,32),"−1/32 in");
  assert.equal(inchFraction(1.999999,16),"2 in");
  assert.equal(inchFraction(0,16),"0 in");
  assert.equal(inchFraction(0.5,3),"");
});
