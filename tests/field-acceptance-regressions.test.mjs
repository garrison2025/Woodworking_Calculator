import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compute} from "../src/calcs.mjs";

const registry=JSON.parse(readFileSync(new URL("../src/tools.json",import.meta.url),"utf8")).tools;
const inputs=slug=>Object.fromEntries(registry.find(t=>t.slug===slug).inputs.map(f=>[f.key,f.value]));
const metric=(result,label)=>{
  const found=result.metrics.find(x=>x.label===label);
  assert.ok(found,"Missing metric: "+label);
  return found.value;
};
const close=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,`Expected ${b}, found ${a}`);

test("independent rafter seat, heel, ridge and slope-coordinate conservation",()=>{
  for(const pitch of [0,3,6,9,12]){
    for(const seat of [0,1,3]){
      const data={...inputs("rafter-calculator"),pitch,seat,ridge:2};
      const r=compute("rafter-calculator",data);
      const run=data.run-data.ridge/2, slope=pitch/12;
      const verticalStock=data.depth*Math.hypot(1,slope);
      close(metric(r,"Adjusted run"),run);
      close(metric(r,"Rafter reference length"),Math.hypot(run,run*slope));
      close(metric(r,"Birdsmouth vertical heel length"),seat*slope);
      close(metric(r,"HAP (vertical top to seat at wall)"),verticalStock-seat*slope);
      close(r.seatStart.x,run-seat);
      close(r.heelTop.x,run);
      close(r.heelTop.y,r.seatStart.y);
      close(r.heelBottom.y-r.heelTop.y,seat*slope);
      close(metric(r,"Notch / stock depth"),100*seat*Math.sin(Math.atan(slope))/data.depth);
      assert.equal(r.birdsmouthCutRows.length,seat>0&&pitch>0?2:0);
    }
  }
});

test("independent crown angle magnitude is invariant to illustration handedness",()=>{
  for(const spring of [30,38,45])for(const corner of [80,90,110]){
    const samples=[];
    for(const inside of [0,1])for(const left of [0,1]){
      const r=compute("crown-molding-calculator",{spring,corner,inside,left});
      const miter=Math.atan(Math.sin(spring*Math.PI/180)/Math.tan(corner*Math.PI/360))*180/Math.PI;
      const bevel=Math.asin(Math.cos(spring*Math.PI/180)*Math.cos(corner*Math.PI/360))*180/Math.PI;
      close(metric(r,"Miter magnitude"),miter);
      close(metric(r,"Bevel magnitude"),bevel);
      samples.push(metric(r,"Illustrative plan miter (not saw setting)"));
    }
    close(samples[0],-samples[1]);
    close(samples[0],-samples[2]);
    close(samples[0],samples[3]);
  }
});

test("independent hip roof slope-area and local stock-scrap conservation",()=>{
  for(const [width,length,pitch,orientation] of [[120,180,0,0],[144,240,6,1],[240,360,9,0]]){
    const data={...inputs("hip-roof-calculator"),width,length,pitch,overhang:12,orientation,reuseMode:0};
    const r=compute("hip-roof-calculator",data);
    const whole=(width+24)*(length+24)*Math.hypot(1,pitch/12)/144;
    close(metric(r,"Whole sloped area"),whole,1e-5);
    close(r.rows.reduce((s,x)=>s+x.cutAreaFt2,0),whole,1e-5);
    close(r.rows.reduce((s,x)=>s+x.cutAreaFt2+x.offcutAreaFt2,0),
      metric(r,"Stock face area before allowance"),1e-5);
    assert.ok(r.rows.every(x=>x.cutVertices.length>=3&&x.planVertices.length>=3));
  }
});

test("stair stringer exports 14 true vertical risers and 13 horizontal treads",()=>{
  const data=inputs("stair-stringer-calculator");
  const r=compute("stair-stringer-calculator",data);
  const h=data.rise/data.risers;
  assert.equal(r.stringerCutLineRows.length,2*data.risers-1);
  assert.equal(r.stringerCutLineRows.filter(x=>x.cutType==="Riser").length,data.risers);
  assert.equal(r.stringerCutLineRows.filter(x=>x.cutType==="Tread").length,data.risers-1);
  for(const row of r.stringerCutLineRows){
    const dx=row.endX-row.startX,dy=row.endY-row.startY;
    close(row.cutLength,Math.hypot(dx,dy),1e-6);
    if(row.cutType==="Riser"){close(dx,0);close(dy,h);}
    else{close(dy,0);close(dx,data.tread);}
  }
  close(metric(r,"Notch pitch-line reference"),Math.hypot((data.risers-1)*data.tread,(data.risers-1)*h));
  close(metric(r,"Floor-to-floor diagonal (not a cut length)"),Math.hypot((data.risers-1)*data.tread,data.rise));
});
