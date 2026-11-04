import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";

const metric=(r,label)=>{
  const m=r.metrics.find(x=>x.label===label);
  assert.ok(m,"missing metric: "+label);
  return m.value;
};
const near=(actual,expected,tol=1e-7)=>
  assert.ok(Math.abs(actual-expected)<=tol,`expected ${expected}, got ${actual}`);

test("stringer reference: 14 risers generate 14 vertical and 13 horizontal sections",()=>{
  const a={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,lowerFinish:0};
  const r=compute("stair-stringer-calculator",a);
  near(metric(r,"Uniform riser height"),7.5);
  near(metric(r,"Notch pitch-line reference"),162.5);
  near(metric(r,"Floor-to-floor diagonal (not a cut length)"),Math.hypot(130,105));
  assert.equal(r.stepVertices.length,28);
  assert.deepEqual(r.stepVertices[0],{x:0,y:0});
  assert.deepEqual(r.stepVertices.at(-1),{x:130,y:105});
  for(let i=1;i<r.stepVertices.length;i++){
    const prev=r.stepVertices[i-1],v=r.stepVertices[i];
    if(i%2===1){near(v.x,prev.x);near(v.y-prev.y,7.5);}
    else{near(v.x-prev.x,10);near(v.y,prev.y);}
  }
  near((r.stepVertices.at(-1).y-r.stepVertices[1].y)/130,.75);
  near(metric(r,"Bottom riser layout cut"),6);
  near(metric(r,"Uncut throat (nominal)"),5.25);
});

test("stringer independent pitch reference holds across riser counts and finish adjustments",()=>{
  for(const n of [2,3,7,14,25,50]){
    const h=7.25,tread=9.5;
    const base={rise:n*h,risers:n,tread,depth:12,treadThickness:1,lowerFinish:0};
    const r=compute("stair-stringer-calculator",base);
    const pitchRise=(n-1)*h,run=(n-1)*tread;
    near(metric(r,"Notch pitch-line reference"),Math.hypot(run,pitchRise));
    near(metric(r,"Floor-to-floor diagonal (not a cut length)"),Math.hypot(run,n*h));
    assert.ok(metric(r,"Floor-to-floor diagonal (not a cut length)")>metric(r,"Notch pitch-line reference"));
    assert.equal(r.stepVertices.length,2*n);
    assert.equal(r.rows.length,n);
    near(r.stepVertices.at(-1).x,run);
    near(r.stepVertices.at(-1).y,n*h);
    const withFinish=compute("stair-stringer-calculator",{...base,lowerFinish:.625});
    assert.deepEqual(withFinish.stepVertices,r.stepVertices);
    near(metric(withFinish,"Bottom riser layout cut"),h-1+.625);
  }
  const a={rise:105,risers:14,tread:10,depth:11.25,treadThickness:9,lowerFinish:0};
  assert.equal(safeCompute("stair-stringer-calculator",a).ok,false);
});

test("compound crown: known 38/90 reference and inverse trigonometric invariants",()=>{
  const d=180/Math.PI;
  for(const spring of [30,38,45,52])
  for(const corner of [60,90,110,135]){
    const base={spring,corner,inside:1,left:1};
    const r=compute("crown-molding-calculator",base);
    const m=metric(r,"Miter magnitude"),b=metric(r,"Bevel magnitude");
    if(spring===38&&corner===90){
      near(m,31.61900653746455,1e-9);
      near(b,33.86291398096767,1e-9);
    }
    near(Math.tan(m/d)*Math.tan(corner/2/d),Math.sin(spring/d),1e-12);
    near(Math.sin(b/d),Math.cos(spring/d)*Math.cos(corner/2/d),1e-12);
    assert.equal(r.rows.length,1);
    near(r.rows[0].springAngle,spring);
    near(r.rows[0].wallCornerAngle,corner);
    near(r.rows[0].miterMagnitudeAngle,m,1e-7);
    near(r.rows[0].bevelMagnitudeAngle,b,1e-7);
    for(const inside of [0,1])for(const left of [0,1]){
      const change=compute("crown-molding-calculator",{spring,corner,inside,left});
      const sign=inside===left?1:-1;
      near(metric(change,"Miter magnitude"),m);
      near(metric(change,"Bevel magnitude"),b);
      near(metric(change,"Illustrative plan miter (not saw setting)"),sign*m);
      near(change.rows[0].illustrativeMiterAngle,sign*m,1e-7);
      assert.equal(change.planSign,sign);
    }
  }
});
test("crown inputs reject invalid spring, corner, hand and corner type",()=>{
  const a={spring:38,corner:90,inside:1,left:1};
  for(const bad of [
    {...a,spring:0},{...a,spring:90},{...a,corner:0},{...a,corner:180},
    {...a,inside:2},{...a,left:-1},{...a,left:.5}
  ])assert.equal(safeCompute("crown-molding-calculator",bad).ok,false);
});
