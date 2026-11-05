import {test} from "node:test";
import assert from "node:assert/strict";
import {buildScheduleCsv,scheduleColumns} from "../src/cut-list.mjs";
import {compute} from "../src/calcs.mjs";

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
test("metric CSV suppresses inch-quantization conversion tails without modifying engine numbers",()=>{
  const rows=[{item:"Hole 1",center:0.19685039,holeLeftEdge:0.0984252,
    holeRightEdge:0.29527559,diameter:0.19685039,clearToPrevious:null}];
  const mm=buildScheduleCsv(rows,"mm","Physical dimensions remain schematic");
  assert.ok(mm.includes('"Hole 1","5","2.5","7.5","5",""'),mm);
  const cm=buildScheduleCsv(rows,"cm");
  assert.ok(cm.includes('"Hole 1","0.5","0.25","0.75","0.5",""'),cm);
  assert.equal(rows[0].center,0.19685039);
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

test("Framing stock cut CSV tracks every geometrical piece and typed kerf columns",()=>{
  const data=compute("framing-calculator",{length:120,spacing:16,width:1.5,wallHeight:96,
    openingStart:32,openingWidth:36,openingHeight:80,openingSill:0});
  const csv=buildScheduleCsv(data.stockCuts,"mm","FFD estimate, not structural approval");
  const col=scheduleColumns(data.stockCuts,"mm");
  const kind=name=>col.find(c=>c.key===name)?.kind;
  assert.equal(kind("index"),"plain");
  assert.equal(kind("cutLength"),"length");
  assert.equal(kind("kerfBefore"),"length");
  assert.equal(kind("remainingLength"),"length");
  assert.ok(csv.includes('"Cut Length (mm)"'),csv.slice(0,500));
  assert.ok(csv.includes('"Kerf Before (mm)"'));
  assert.ok(csv.includes('"Running Used Length (mm)"'));
  assert.ok(csv.includes('"Stock Group"'));
  assert.ok(csv.includes('"Stock Id"'));
  assert.ok(csv.includes('"2324.1"'),"91.5 inch stock cut converts to exact mm");
  assert.ok(csv.includes('"3.175"'),"One eighth inch kerf is 3.175 mm");
  assert.equal(csv.split("\r\n").filter(Boolean).length,data.rows.length+2);
  assert.equal(data.stockCuts.length,data.rows.length);
  assert.ok(csv.endsWith('"\r\n'));
});


test("Framing price estimate CSV keeps counts, money and units distinct",()=>{
  const input={length:120,spacing:16,width:1.5,wallHeight:96,openingStart:32,
    openingWidth:36,openingHeight:80,openingSill:0,studUnitPrice:5.5,
    headerUnitPrice:14.25,stockWaste:10};
  const result=compute("framing-calculator",input);
  const rows=result.materialSummary.map(r=>({
    stockGroup:r.stockGroup,pieces:r.pieces,stockLength:r.stockLength,
    plannedSticks:r.plannedSticks,allowanceSticks:r.allowanceSticks,
    purchaseSticks:r.purchaseSticks,unitPrice:r.unitPrice,
    plannedCost:r.plannedCost,reserveCost:r.allowanceCost,
    purchaseCost:r.purchaseCost,currency:"USD"
  }));
  const columns=scheduleColumns(rows,"mm");
  for(const key of ["pieces","plannedSticks","allowanceSticks","purchaseSticks",
    "unitPrice","plannedCost","reserveCost","purchaseCost"]){
    const column=columns.find(c=>c.key===key);
    assert.equal(column.kind,"plain",key);
    assert.ok(!column.label.includes(" (mm)"),column.label);
  }
  assert.equal(columns.find(x=>x.key==="stockLength").label,"Stock Length (mm)");
  const csv=buildScheduleCsv(rows,"mm","User-entered quote, no exchange conversion");
  assert.ok(csv.includes('"Unit Price"'));
  assert.ok(csv.includes('"Purchase Cost"'));
  assert.ok(csv.includes('"Allowance Sticks"'));
  assert.ok(csv.includes('"Currency"'));
  assert.ok(csv.includes('"5.5"'));
  assert.ok(csv.includes('"14.25"'));
  assert.ok(csv.includes('"60.5"'),"Stud purchased sticks including allowance");
  assert.ok(csv.includes('"28.5"'),"Header purchased sticks including allowance");
  assert.ok(csv.includes('"USD"'));
  assert.ok(!csv.includes('"Purchase Cost (mm)"'));
  assert.ok(!csv.includes('"Unit Price (mm)"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,rows.length+2);
});

test("Missing price CSV cells remain empty, and cannot masquerade as zero-dollar quotes",()=>{
  const result=compute("framing-calculator",{length:120,spacing:16,width:1.5,wallHeight:96,
    openingStart:32,openingWidth:36,openingHeight:80});
  const row=result.materialSummary[0];
  assert.equal(row.unitPrice,null);
  assert.equal(row.purchaseCost,null);
  const csv=buildScheduleCsv([{
    stockGroup:row.stockGroup,purchaseSticks:row.purchaseSticks,
    unitPrice:row.unitPrice,purchaseCost:row.purchaseCost,currency:"USD"
  }],"in","Price not provided");
  assert.ok(csv.includes('"Stud","10","","","USD"'),csv);
});
