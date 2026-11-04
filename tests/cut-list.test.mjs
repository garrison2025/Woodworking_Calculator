import {test} from "node:test";
import assert from "node:assert/strict";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";

test("selected units and raw numeric coordinates are explicit and machine-readable",()=>{
  const rows=[
    {item:"Stud 1",position:0,length:96},
    {item:"Stud 2",position:16,length:95.4375}
  ];
  const text=buildScheduleCsv(rows,"mm",'Measure "twice"');
  assert.ok(text.startsWith("\uFEFF"));
  assert.ok(text.includes('"Position (mm)","Length (mm)"'));
  assert.ok(text.includes('"Stud 2","406.4","2424.1125"'));
  assert.ok(text.endsWith('"Source note","Measure ""twice""",""\r\n'));
  assert.ok(!text.includes('"2,424.11 mm"'));
  assert.equal(text.split("\r\n").filter(Boolean).length,4);
});
test("area, clipped polygon coordinates and nullable columns have their own units",()=>{
  const rows=[
    {item:"sheet 1",cutAreaFt2:1.5,cutVertices:[[0,0],[1,2]],joistCenter:null},
    {item:"joist 1",cutAreaFt2:null,cutVertices:null,joistCenter:12}
  ];
  const csv=buildScheduleCsv(rows,"cm","Unreused offcuts");
  assert.ok(csv.includes('"Cut Area (m²)","Cut Vertices (cm)","Joist Center (cm)"'));
  assert.ok(csv.includes('"0.13935456"'));
  assert.ok(csv.includes('[[0,0],[2.54,5.08]]'));
  assert.ok(csv.includes('"30.48"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,4);
});
test("textual values beginning with spreadsheet formulas cannot execute",()=>{
  const csv=buildScheduleCsv([{item:"=2+2",type:"@calc",position:-1}],"ft","-danger");
  assert.ok(csv.includes('"\'=2+2"'));
  assert.ok(csv.includes('"\'@calc"'));
  assert.ok(csv.includes('"-0.0833333333333"'));
  assert.ok(csv.includes('"\'-danger"'));
});
test("bowl segment index and ring are unitless while angles and lengths retain types",()=>{
  const r=[{item:"Ring 1 / segment 2",ring:1,segment:2,startAngle:30,endAngle:60,
    miterAngle:15,outerChord:3,innerChord:2,radialDepth:1}];
  const csv=buildScheduleCsv(r,"mm","Finished sizes only");
  assert.ok(csv.includes('"Ring","Segment","Start Angle (°)","End Angle (°)","Miter Angle (°)"'));
  assert.ok(csv.includes('"Outer Chord (mm)","Inner Chord (mm)","Radial Depth (mm)"'));
  assert.ok(csv.includes('"Ring 1 / segment 2","1","2","30","60","15","76.2","50.8","25.4"'));
  assert.ok(!csv.includes('"Ring (mm)"'));
});
test("screen and CSV draw typed headings from one schema",()=>{
  const rows=[
    {item:"Ring 1 / segment 2",ring:1,segment:2,startAngle:30,endAngle:60,miterAngle:15,
     outerChord:3,innerChord:2,radialDepth:1},
    {item:"Ring 2 / segment 1",ring:2,segment:1,startAngle:0,endAngle:30,miterAngle:15,
     outerChord:3,innerChord:2,radialDepth:1}
  ];
  const columns=scheduleColumns(rows,"cm");
  assert.equal(columns.find(x=>x.key==="ring").kind,"plain");
  assert.equal(columns.find(x=>x.key==="segment").kind,"plain");
  assert.equal(columns.find(x=>x.key==="miterAngle").kind,"angle");
  assert.equal(columns.find(x=>x.key==="outerChord").kind,"length");
  const headings=columns.map(x=>x.label);
  assert.ok(headings.includes("Miter Angle (°)"));
  assert.ok(headings.includes("Outer Chord (cm)"));
  const first=buildScheduleCsv(rows,"cm").slice(1).split("\r\n")[0];
  assert.equal(first,headings.map(x=>'"'+x+'"').join(","));
  assert.throws(()=>scheduleColumns([], "invalid"),/Unsupported unit/);
});
test("plain metric fallback and units validation remain supported",()=>{
  const csv=buildScheduleCsv([{measurement:"Roof angle",value:"26.565°"}],"in","Read limits");
  assert.ok(csv.includes('"Measurement","Value"'));
  assert.ok(csv.includes('"26.565°"'));
  assert.throws(()=>buildScheduleCsv([{item:"test"}],"yards"),/Unsupported unit/);
  assert.throws(()=>buildScheduleCsv([],"mm"),/No schedule available/);
});
