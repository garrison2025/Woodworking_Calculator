import test from "node:test";
import assert from "node:assert/strict";
import {compute,safeCompute} from "../src/calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

const near=(actual,expected,tol=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tol,
    "Expected "+expected+", got "+actual+"; tolerance "+tol);
};
const metric=(r,label)=>{
  const item=r.metrics.find(x=>x.label===label);
  assert.ok(item,"Missing metric "+label);
  return item.value;
};
const spiralBase={totalRise:108,outerDiameter:72,poleDiameter:4,risers:15,
  totalRotation:360,walkInset:12,direction:0};
const gambrelBase={width:240,length:360,eaveOverhang:12,endOverhang:12,
  lowerRun:60,lowerPitch:12,upperPitch:4,waste:10};
const staveBase={topCornerDiameter:20,bottomCornerDiameter:16,
  height:24,staves:12,roughMargin:.125,roughKerf:.125};
const polygonArea=vertices=>Math.abs(vertices.reduce((s,p,i)=>{
  const next=vertices[(i+1)%vertices.length];
  return s+p[0]*next[1]-next[0]*p[1];
},0))/2;

test("spiral default: 14 physical polygon treads and distinct curved vs straight areas",()=>{
  const r=compute("spiral-staircase-calculator",spiralBase);
  assert.equal(r.rows.length,14);
  assert.equal(metric(r,"Physical wedge treads"),14);
  const R=36,inner=2,theta=2*Math.PI/14;
  const annular=(R*R-inner*inner)*theta/2/144;
  const chord=(R*R-inner*inner)*Math.sin(theta)/2/144;
  near(metric(r,"Annular sector area per tread"),annular,1e-10);
  near(metric(r,"Straight-chord polygon area per tread"),chord,1e-10);
  near(metric(r,"Curved-sector minus chord-polygon area"),annular-chord,1e-10);
  assert.ok(annular>chord);
  for(const [i,row] of r.rows.entries()){
    near(row.treadChordPolygonAreaFt2,chord,1e-10);
    near(row.treadAnnularAreaFt2,annular,1e-10);
    near(polygonArea(row.planVertices)/144,chord,2e-8);
    near(row.treadTopElevation,(i+1)*spiralBase.totalRise/spiralBase.risers,1e-8);
    assert.ok(row.treadTopElevation>0);
  }
  near(r.rows.at(-1).treadTopElevation,100.8,1e-8);
  near(metric(r,"Upper finished floor elevation"),108,1e-10);
  const columns=scheduleColumns(r.rows,"mm").map(c=>c.label);
  assert.ok(columns.includes("Tread Annular Area (m²)"));
  assert.ok(columns.includes("Tread Chord Polygon Area (m²)"));
  const csv=buildScheduleCsv(r.rows,"mm");
  assert.ok(csv.includes('"Plan Projection Vertices (mm)"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,16);
});

test("spiral clockwise and counterclockwise chord areas conserve each projected polygon",()=>{
  for(const opts of [
    {...spiralBase,direction:1,risers:12,totalRotation:270},
    {...spiralBase,totalRise:101,outerDiameter:88,poleDiameter:6,
      risers:13,walkInset:14,totalRotation:300,direction:1},
    {...spiralBase,totalRise:72,outerDiameter:48,poleDiameter:3,
      risers:8,walkInset:10,totalRotation:180}
  ]){
    const r=compute("spiral-staircase-calculator",opts);
    const theta=opts.totalRotation*Math.PI/180/(opts.risers-1);
    const theoretical=((opts.outerDiameter/2)**2-(opts.poleDiameter/2)**2)*Math.sin(theta)/2/144;
    assert.equal(r.rows.length,opts.risers-1);
    for(const [i,row] of r.rows.entries()){
      near(row.treadChordPolygonAreaFt2,theoretical,1e-10);
      near(polygonArea(row.planVertices)/144,theoretical,3e-8);
      near(row.treadTopElevation,(i+1)*opts.totalRise/opts.risers,1e-8);
      assert.ok(row.treadAnnularAreaFt2>row.treadChordPolygonAreaFt2);
    }
  }
});

test("spiral cannot export nonzero risers or inner pole chords rounded to zero",()=>{
  for(const changed of [
    {...spiralBase,totalRise:1e-7},
    {...spiralBase,poleDiameter:1e-9}
  ]){
    const x=safeCompute("spiral-staircase-calculator",changed);
    assert.equal(x.ok,false,JSON.stringify(changed));
    assert.match(x.error,/cut-coordinate resolution/i);
  }
});

test("gambrel four slopes reconcile x/y vertices, physical lengths and total area",()=>{
  for(const input of [
    gambrelBase,
    {...gambrelBase,width:336,eaveOverhang:18,
      lowerRun:82,lowerPitch:18,upperPitch:3.5},
    {...gambrelBase,width:168,eaveOverhang:0,
      lowerRun:32,lowerPitch:10,upperPitch:2,length:240}
  ]){
    const r=compute("gambrel-roof-calculator",input);
    assert.equal(r.rows.length,4);
    const span=input.width+2*input.eaveOverhang;
    const roofLength=input.length+2*input.endOverhang;
    const half=span/2,upperRun=half-input.lowerRun;
    const rise1=input.lowerRun*input.lowerPitch/12;
    const rise2=upperRun*input.upperPitch/12;
    const expected=2*(Math.hypot(input.lowerRun,rise1)+
      Math.hypot(upperRun,rise2))*roofLength/144;
    near(r.totalAreaFt2,expected,1e-9);
    near(r.ridgeRise,rise1+rise2,1e-10);
    near(r.rows.reduce((s,row)=>s+row.roofFaceAreaFt2,0),expected,1e-9);
    for(const row of r.rows){
      const run=Math.abs(row.endX-row.startX);
      const rise=Math.abs(row.endHeight-row.startHeight);
      near(row.horizontalRun,run,1e-8);
      near(row.verticalRise,rise,1e-8);
      near(row.slopedLength,Math.hypot(run,rise),1e-7);
      assert.ok(run>=1e-7&&rise>=1e-7);
    }
    near(r.rows[0].horizontalRun+r.rows[1].horizontalRun,half,1e-8);
    near(r.rows[2].horizontalRun+r.rows[3].horizontalRun,half,1e-8);
  }
});

test("gambrel rejects tiny positive pitch or run before exporting a zero-looking roof face",()=>{
  for(const changed of [
    {...gambrelBase,lowerRun:1e-8},
    {...gambrelBase,lowerRun:131.99999999},
    {...gambrelBase,upperPitch:1e-9},
    {...gambrelBase,lowerPitch:2e-8,upperPitch:1e-8}
  ]){
    const x=safeCompute("gambrel-roof-calculator",changed);
    assert.equal(x.ok,false,JSON.stringify(changed));
    assert.match(x.error,/cut-coordinate resolution/i);
  }
});

test("stave straight trapezoid shoelace area reconciles chord and face length",()=>{
  for(const input of [
    staveBase,
    {...staveBase,topCornerDiameter:18,bottomCornerDiameter:26,
      height:22,staves:16},
    {...staveBase,topCornerDiameter:20,bottomCornerDiameter:20,
      height:26,staves:8,roughMargin:0,roughKerf:0}
  ]){
    const r=compute("stave-calculator",input);
    const half=Math.PI/input.staves;
    const top=input.topCornerDiameter*Math.sin(half);
    const bottom=input.bottomCornerDiameter*Math.sin(half);
    const diff=(input.topCornerDiameter-input.bottomCornerDiameter)/2;
    const slant=Math.hypot(input.height,diff*Math.cos(half));
    const expected=(top+bottom)*slant/2/144;
    near(r.staveBlank.topChord,top,1e-10);
    near(r.staveBlank.bottomChord,bottom,1e-10);
    near(r.staveBlank.faceLength,slant,1e-10);
    near(polygonArea(r.staveBlank.vertices)/144,expected,2e-8);
    assert.equal(r.rows.length,input.staves);
    for(const row of r.rows)near(row.staveFaceAreaFt2,expected,1e-10);
  }
});
