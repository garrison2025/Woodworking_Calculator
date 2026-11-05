import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const near=(actual,expected,tol=1e-6)=>
  assert.ok(Math.abs(actual-expected)<=tol,`expected ${expected}, got ${actual}`);
const metric=(data,name)=>{
  const m=data.metrics.find(x=>x.label===name);
  assert.ok(m,"Missing metric "+name);
  return m.value;
};
const area=(poly)=>Math.abs(poly.reduce((s,p,i)=>{
  const n=poly[(i+1)%poly.length];
  return s+p[0]*n[1]-n[0]*p[1];
},0))/2;
const parseCsvLine=(line)=>{
  const values=[];let field="",inside=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(inside&&line[i+1]==='"'){field+='"';i++;}
      else inside=!inside;
    } else if(c===","&&!inside){values.push(field);field="";}
    else field+=c;
  }
  values.push(field);return values;
};

test("square hip grid corner yields clean nonzero cutting edges, not repeated cut vertices",()=>{
  const input={width:144,length:144,pitch:6,overhang:0,sheetWidth:48,sheetLength:96,orientation:1};
  const r=compute("hip-roof-calculator",input);
  assert.equal(r.roofPanels.length,12);
  assert.equal(new Set(r.roofPanels.map(p=>p.plane)).size,4);
  const minor=144,major=144,factor=Math.hypot(1,.5),sheetArea=48*96;
  near(metric(r,"Stock face area before allowance")*144,12*sheetArea);
  near(metric(r,"Whole sloped area")*144,minor*major*factor);
  near(metric(r,"Unreused stock area")*144,12*sheetArea-minor*major*factor);
  for(const [i,p] of r.roofPanels.entries()){
    assert.equal(p.id,"S"+(i+1));
    assert.ok(Number.isInteger(p.row)&&p.row>=1);
    assert.ok(Number.isInteger(p.column)&&p.column>=1);
    assert.equal(r.rows[i].row,p.row);
    assert.equal(r.rows[i].column,p.column);
    assert.deepEqual(r.rows[i].cutVertices,p.localVertices);
    assert.deepEqual(r.rows[i].planVertices,p.planPoints);
    assert.ok(p.localVertices.length>=3&&p.localVertices.length<=6,"cut polygon must be simple");
    assert.equal(p.localVertices.length,p.planPoints.length);
    near(area(p.localVertices),p.cutAreaSqIn,1e-5);
    near(area(p.planPoints)*factor,p.cutAreaSqIn,1e-5);
    near(p.cutAreaSqIn+p.offcutAreaSqIn,sheetArea,1e-6);
    for(let j=0;j<p.localVertices.length;j++){
      const v=p.localVertices[j],next=p.localVertices[(j+1)%p.localVertices.length];
      assert.ok(Math.hypot(v[0]-next[0],v[1]-next[1])>1e-8,
        "zero-length edge in "+p.id+" at vertex "+j);
    }
  }
});

test("hip clipped local cut polygons and overhead projection independently conserve all four slopes",()=>{
  let cases=0;
  for(const width of [72,96,144])for(const length of [132,196,252])
  for(const pitch of [0,2,6,11])for(const orientation of [0,1]){
    const input={width,length,pitch,overhang:6,sheetWidth:48,sheetLength:96,orientation};
    const r=compute("hip-roof-calculator",input);
    const major=Math.max(width+12,length+12),minor=Math.min(width+12,length+12);
    const factor=Math.hypot(1,pitch/12),sheetArea=input.sheetWidth*input.sheetLength;
    const slopeEnd=minor*minor*factor/4;
    const slopeSide=(major*minor/2-minor*minor/4)*factor;
    const expected=[slopeSide,slopeSide,slopeEnd,slopeEnd];
    const sums=[0,0,0,0],projected=[0,0,0,0];
    for(const [i,p] of r.roofPanels.entries()){
      sums[p.planeIndex]+=p.cutAreaSqIn;
      projected[p.planeIndex]+=area(p.planPoints);
      near(p.cutAreaSqIn+p.offcutAreaSqIn,sheetArea,1e-6);
      near(area(p.localVertices),p.cutAreaSqIn,1e-5);
      near(area(p.planPoints)*factor,p.cutAreaSqIn,1e-5);
      near(p.eaveOffset,(p.column-1)*r.sheetAlong,1e-7);
      near(p.slopeOffset,(p.row-1)*r.sheetUphill,1e-7);
      for(const [j,[u,v]] of p.localVertices.entries()){
        assert.ok(u>=-1e-6&&u<=r.sheetAlong+1e-6);
        assert.ok(v>=-1e-6&&v<=r.sheetUphill+1e-6);
        const globalU=p.eaveOffset+u,globalV=p.slopeOffset+v;
        let expectedPlan;
        if(p.planeIndex===0)expectedPlan=[globalU,globalV/factor];
        else if(p.planeIndex===1)expectedPlan=[globalU,minor-globalV/factor];
        else if(p.planeIndex===2)expectedPlan=[globalV/factor,globalU];
        else expectedPlan=[major-globalV/factor,globalU];
        near(p.planPoints[j][0],expectedPlan[0],1e-7);
        near(p.planPoints[j][1],expectedPlan[1],1e-7);
      }
      assert.equal(p.localVertices.length,p.planPoints.length);
      assert.deepEqual(r.rows[i].cutVertices,p.localVertices);
      assert.deepEqual(r.rows[i].planVertices,p.planPoints);
      near(r.rows[i].offcutAreaFt2*144,p.offcutAreaSqIn,1e-6);
      for(let j=0;j<p.localVertices.length;j++){
        const x=p.localVertices[j],y=p.localVertices[(j+1)%p.localVertices.length];
        assert.ok(Math.hypot(y[0]-x[0],y[1]-x[1])>1e-8,
          "duplicate vertices in "+p.id);
      }
    }
    for(let j=0;j<4;j++){
      near(sums[j],expected[j],Math.max(1e-5,expected[j]*1e-9));
      near(projected[j],expected[j]/factor,1e-5);
    }
    const stockArea=r.roofPanels.length*sheetArea;
    const used=r.roofPanels.reduce((s,p)=>s+p.cutAreaSqIn,0);
    const offcut=r.roofPanels.reduce((s,p)=>s+p.offcutAreaSqIn,0);
    near(used+offcut,stockArea,Math.max(1e-5,stockArea*1e-10));
    near(used,(width+12)*(length+12)*factor,Math.max(1e-5,used*1e-9));
    near(metric(r,"Unreused stock area")*144,offcut,1e-5);
    near(metric(r,"Stock face area before allowance")*144,stockArea,1e-5);
    cases++;
  }
  assert.equal(cases,72);
});

test("hip CSV exports separate local cutting vertices and projected roof-plan points with correct units",()=>{
  const r=compute("hip-roof-calculator",{
    width:144,length:144,pitch:6,overhang:0,
    sheetWidth:48,sheetLength:96,orientation:1
  });
  for(const unit of ["in","ft","mm","cm","m"]){
    const cols=scheduleColumns(r.rows,unit);
    const areaUnit=["in","ft"].includes(unit)?"ft²":"m²";
    assert.equal(cols.find(c=>c.key==="offcutAreaFt2")?.label,"Offcut Area ("+areaUnit+")");
    assert.equal(cols.find(c=>c.key==="cutVertices")?.label,"Cut Vertices ("+unit+")");
    assert.equal(cols.find(c=>c.key==="planVertices")?.label,"Plan Projection Vertices ("+unit+")");
    assert.equal(cols.find(c=>c.key==="planVertices")?.kind,"vertices");
    assert.equal(cols.find(c=>c.key==="row")?.kind,"plain");
    assert.equal(cols.find(c=>c.key==="column")?.kind,"plain");
    const csv=buildScheduleCsv(r.rows,unit,"cut and plan coordinate systems differ");
    const lines=csv.replace(/^\uFEFF/,"").trimEnd().split("\r\n");
    assert.equal(lines.length,r.rows.length+2);
    const head=parseCsvLine(lines[0]),row=parseCsvLine(lines[1]);
    assert.equal(head.length,row.length);
    assert.equal(row[head.indexOf("Row")],String(r.rows[0].row));
    assert.equal(row[head.indexOf("Column")],String(r.rows[0].column));
    const cut=JSON.parse(row[head.indexOf("Cut Vertices ("+unit+")")]);
    const plan=JSON.parse(row[head.indexOf("Plan Projection Vertices ("+unit+")")]);
    assert.equal(cut.length,r.rows[0].cutVertices.length);
    assert.equal(plan.length,r.rows[0].planVertices.length);
    const factor={in:1,ft:1/12,mm:25.4,cm:2.54,m:.0254}[unit];
    for(let i=0;i<cut.length;i++){
      near(cut[i][0],r.rows[0].cutVertices[i][0]*factor,unit==="mm"?2e-6:2e-7);
      near(cut[i][1],r.rows[0].cutVertices[i][1]*factor,unit==="mm"?2e-6:2e-7);
      near(plan[i][0],r.rows[0].planVertices[i][0]*factor,unit==="mm"?2e-6:2e-7);
      near(plan[i][1],r.rows[0].planVertices[i][1]*factor,unit==="mm"?2e-6:2e-7);
    }
  }
  assert.equal(safeCompute("hip-roof-calculator",{
    width:144,length:144,pitch:6,overhang:0,sheetWidth:.001,sheetLength:.001,orientation:1
  }).ok,false);
});
