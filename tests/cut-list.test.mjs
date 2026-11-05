import {test} from "node:test";
import assert from "node:assert/strict";
import {buildScheduleCsv,buildMetricsCsv,scheduleColumns} from "../src/cut-list.mjs";
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


test("Multi-size supplier quote CSV exports every chosen stock length with money columns untyped",()=>{
  const r=compute("framing-calculator",{
    length:120,spacing:16,width:1.5,wallHeight:80,openingStart:32,
    openingWidth:36,openingHeight:60,studUnitPrice:8,
    studAltUnitPrice:8.2,studAlt2UnitPrice:8.5,headerUnitPrice:12
  });
  assert.equal(r.costSummary.allPricesEntered,true);
  const rows=r.purchaseVariants.map(v=>({
    stockGroup:v.stockGroup,offerLabel:v.offerLabel,stockLength:v.stockLength,
    plannedSticks:v.plannedSticks,allowanceSticks:v.allowanceSticks,
    purchaseSticks:v.purchaseSticks,unitPrice:v.unitPrice,
    plannedCost:v.plannedCost,reserveCost:v.reserveCost,
    purchaseCost:v.purchaseCost,currency:"USD"
  }));
  assert.equal(rows.length,4); // Exact plan uses 2 stud lengths, 1 header and 1 inactive sill
  const csv=buildScheduleCsv(rows,"mm","Quoted multi-size plan");
  const cols=scheduleColumns(rows,"mm");
  assert.equal(cols.find(x=>x.key==="stockLength").kind,"length");
  assert.equal(cols.find(x=>x.key==="plannedSticks").kind,"plain");
  assert.equal(cols.find(x=>x.key==="unitPrice").kind,"plain");
  assert.equal(cols.find(x=>x.key==="purchaseCost").kind,"plain");
  assert.ok(csv.includes('"Offer Label"'));
  assert.ok(csv.includes('"Stock Length (mm)"'));
  assert.ok(csv.includes('"2438.4"'));
  assert.ok(!csv.includes('"3048"'),"Exact purchase does not require the 120-inch offer");
  assert.ok(csv.includes('"3657.6"'));
  assert.ok(csv.includes('"Alternative 2"'));
  assert.ok(csv.includes('"8.5"'));
  assert.ok(csv.includes('"USD"'));
  assert.ok(!csv.includes('"Purchase Cost (mm)"'));
  assert.ok(!csv.includes('"Unit Price (mm)"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,rows.length+2);
  assert.equal(rows.reduce((s,x)=>s+(x.purchaseCost??0),0),r.costSummary.quotedSubtotal);
});
test("Mixed-length stock cutting CSV keeps individual stick length and offer for every cut",()=>{
  const r=compute("framing-calculator",{
    length:120,spacing:16,width:1.5,wallHeight:80,openingStart:32,
    openingWidth:36,openingHeight:60,studUnitPrice:8,
    studAltUnitPrice:8.2,studAlt2UnitPrice:8.5,headerUnitPrice:12
  });
  const csv=buildScheduleCsv(r.stockCuts,"in","Never cross-profile splice or trim");
  assert.ok(csv.includes('"Offer Label"'));
  assert.ok(csv.includes('"Stock Length (in)"'));
  assert.ok(!csv.includes('"Alternative 1"'));
  assert.ok(csv.includes('"Alternative 2"'));
  assert.ok(!csv.includes('"120"'));
  assert.ok(csv.includes('"144"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,r.rows.length+2);
  const byId=new Map(r.stockPlan.map(bar=>[bar.stockId,bar]));
  for(const cut of r.stockCuts){
    const bar=byId.get(cut.stockId);
    assert.ok(bar);
    assert.equal(cut.stockLength,bar.stockLength);
    assert.equal(cut.offerLabel,bar.offerLabel);
  }
});


test("Physical equal spacing CSV preserves center and face edges in metric units",()=>{
  const r=compute("equal-spacing-calculator",{
    length:1000/25.4,count:6,left:50/25.4,
    right:50/25.4,itemWidth:30/25.4
  });
  const cols=scheduleColumns(r.rows,"mm");
  assert.deepEqual(cols.map(c=>c.label),[
    "Item","Position (mm)","Face Left Edge (mm)",
    "Face Right Edge (mm)","Clear To Previous (mm)"
  ]);
  const csv=buildScheduleCsv(r.rows,"mm","Physical faces are measured from one end");
  assert.ok(csv.includes('"Center 1","50","35","65",""'));
  assert.ok(csv.includes('"Center 2","230","215","245","150"'));
  assert.ok(csv.includes('"Center 6","950","935","965","150"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,8);
  const marks=compute("equal-spacing-calculator",{
    length:1000/25.4,count:6,left:0,right:0,itemWidth:0
  });
  const markers=buildScheduleCsv(marks.rows,"mm","Centers only");
  assert.ok(markers.includes('"Center 1","0","","",""'));
  assert.ok(!markers.includes('"Clear To Previous (mm)","150"'));
});


test("Deck material purchase CSV keeps board and fastener pack counts unitless",()=>{
  const r=compute("deck-material-calculator",{
    width:120,length:144,board:5.5,gap:.125,stock:100,joists:16,waste:10,
    boardUnitPrice:8.75,fastenersPerContact:2,fastenerPackSize:100,
    fastenerPackPrice:22
  });
  const rows=r.deckPurchaseRows.map(x=>({...x,currency:"USD"}));
  const cols=scheduleColumns(rows,"mm");
  for(const key of ["plannedQuantity","purchaseQuantity","unitPrice","purchaseCost"]){
    assert.equal(cols.find(c=>c.key===key).kind,"plain",key);
  }
  const csv=buildScheduleCsv(rows,"mm","User-supplied purchasing quotes");
  assert.ok(csv.includes('"Planned Quantity"'));
  assert.ok(csv.includes('"Purchase Quantity"'));
  assert.ok(csv.includes('"Unit Price"'));
  assert.ok(!csv.includes('"Purchase Cost (mm)"'));
  assert.ok(csv.includes('"Decking stock boards","44","49","boards","8.75","428.75","USD"'));
  assert.ok(csv.includes('"Fastener packs","5","5","packs","22","110","USD"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,4);
});
test("Deck fastening contact CSV converts seam coordinates but not pack or contact quantities",()=>{
  const r=compute("deck-material-calculator",{
    width:120,length:144,board:5.5,gap:.125,stock:100,joists:16,waste:10,
    boardUnitPrice:8.75,fastenersPerContact:2,fastenerPackSize:100,
    fastenerPackPrice:22
  });
  const cols=scheduleColumns(r.deckFastenerRows,"mm");
  for(const key of ["rowNumber","joistReferences","buttSeams","fasteningContacts",
      "fastenersPerContact","fastenerPiecesPerRow"]){
    assert.equal(cols.find(c=>c.key===key).kind,"plain",key);
  }
  assert.equal(cols.find(c=>c.key==="firstSeamAt").kind,"length");
  assert.equal(cols.find(c=>c.key==="lastSeamAt").kind,"length");
  const csv=buildScheduleCsv(r.deckFastenerRows,"mm","Two contacts on every shared seam");
  assert.ok(csv.includes('"Fasteners Per Contact"'));
  assert.ok(csv.includes('"First Seam At (mm)"'));
  assert.ok(csv.includes('"Last Seam At (mm)"'));
  assert.ok(csv.includes('"2438.4"'));
  assert.ok(csv.includes('"Row 1","1","10","1","11","2","22"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,24);
  const noSeam=compute("deck-material-calculator",{
    width:120,length:144,board:5.5,gap:.125,stock:144,joists:16,waste:10
  });
  const noSeamCsv=buildScheduleCsv(noSeam.deckFastenerRows,"mm","No seam");
  assert.ok(noSeamCsv.includes('"Row 1","1","10","0","10","2","20","",""'));
});


test("Stair stringer optional nose and landing references export unit-aware coordinates",()=>{
  const r=compute("stair-stringer-calculator",{
    rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,
    lowerFinish:0,nosing:1.25,upperLandingDepth:36
  });
  const cols=scheduleColumns(r.rows,"mm");
  assert.equal(cols.find(c=>c.key==="noseStart").kind,"length");
  assert.equal(cols.find(c=>c.key==="noseEnd").kind,"length");
  assert.equal(cols.find(c=>c.key==="landingReferenceEnd").kind,"length");
  const csv=buildScheduleCsv(r.rows,"mm","Nosing and landing are references, not saw cuts");
  assert.ok(csv.includes('"Nose Start (mm)"'));
  assert.ok(csv.includes('"Nose End (mm)"'));
  assert.ok(csv.includes('"Landing Reference End (mm)"'));
  assert.ok(csv.includes('"-31.75"'));
  assert.ok(csv.includes('"0"'));
  assert.ok(csv.includes('"4216.4"'));
  assert.ok(csv.includes('"Top landing vertical"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,16);
});


test("Stringer modeled profile export keeps vertex index unitless and converts negative elevations",()=>{
  const r=compute("stair-stringer-calculator",{
    rise:105,risers:14,tread:10,depth:11.25,
    treadThickness:1.5,lowerFinish:0,nosing:1.25,upperLandingDepth:36,
    lowerSupportRun:3,upperSupportRun:6
  });
  const columns=scheduleColumns(r.stringerEnvelopeRows,"mm");
  assert.deepEqual(columns.map(x=>x.label),[
    "Index","Boundary","X (mm)","Elevation (mm)"
  ]);
  assert.equal(columns[0].kind,"plain");
  assert.equal(columns[2].kind,"length");
  assert.equal(columns[3].kind,"length");
  const csv=buildScheduleCsv(r.stringerEnvelopeRows,"mm",
    "Only the modeled section, not a final cut template");
  assert.ok(csv.includes('"30","Parallel lower reference edge","0","-166.6875"'));
  assert.ok(csv.includes('"29","Parallel lower reference edge","3302","2309.8125"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,32);
  assert.ok(!csv.includes('"Index (mm)"'));
});
test("Stringer measured supports export signed site datums without invented bearing cuts",()=>{
  const r=compute("stair-stringer-calculator",{
    rise:105,risers:14,tread:10,depth:11.25,
    treadThickness:1.5,lowerFinish:0,nosing:0,upperLandingDepth:0,
    lowerSupportRun:3,upperSupportRun:6
  });
  const cols=scheduleColumns(r.supportReferences,"mm");
  assert.deepEqual(cols.map(c=>c.label),[
    "Item","Start X (mm)","End X (mm)","Elevation (mm)"
  ]);
  const csv=buildScheduleCsv(r.supportReferences,"mm",
    "Reference positions only, not physical bearing cuts");
  assert.ok(csv.includes('"Lower horizontal support surface reference","-76.2","0","0"'));
  assert.ok(csv.includes('"Upper horizontal support surface reference","3302","3454.4","2667"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,4);
});


test("Two-dimensional drill layout CSV exports signed face Y coordinates and unitless row indices",()=>{
  const mm=x=>x/25.4;
  const r=compute("hole-spacing-calculator",{
    length:mm(100),holes:4,edge:mm(5),diameter:mm(5),
    boardWidth:mm(40),rowCount:3,crossSetback:mm(5)
  });
  const cols=scheduleColumns(r.rows,"mm");
  for(const key of ["rowNumber","columnNumber"]){
    const col=cols.find(x=>x.key===key);
    assert.equal(col.kind,"plain",key);
    assert.ok(!col.label.includes("(mm)"),col.label);
  }
  for(const key of ["centerY","holeBottomEdge","holeTopEdge","clearToPreviousRow"]){
    const col=cols.find(x=>x.key===key);
    assert.equal(col.kind,"length",key);
    assert.ok(col.label.includes("(mm)"),col.label);
  }
  const csv=buildScheduleCsv(r.rows,"mm",
    "X from left and Y from lower face; not a drill jig");
  assert.ok(csv.includes('"Row Number","Column Number","Center Y (mm)"'));
  assert.ok(csv.includes('"Hole Bottom Edge (mm)","Hole Top Edge (mm)"'));
  assert.ok(csv.includes('"Row 1 hole 1","5","2.5","7.5","5","","1","1","5","2.5","7.5",""'));
  assert.ok(csv.includes('"Row 2 hole 1","5","2.5","7.5","5","","2","1","20","17.5","22.5","10"'));
  assert.ok(csv.includes('"Row 3 hole 4","95","92.5","97.5","5","25","3","4","35","32.5","37.5","10"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,14);
});
test("Single-row drilling still exports historical columns only",()=>{
  const r=compute("hole-spacing-calculator",{
    length:100/25.4,holes:4,edge:5/25.4,
    diameter:5/25.4
  });
  const cols=scheduleColumns(r.rows,"mm");
  assert.deepEqual(cols.map(x=>x.label),[
    "Item","Center (mm)","Hole Left Edge (mm)","Hole Right Edge (mm)",
    "Diameter (mm)","Clear To Previous (mm)"
  ]);
  const csv=buildScheduleCsv(r.rows,"mm","Original single row");
  assert.ok(csv.includes('"Hole 1","5","2.5","7.5","5",""'));
  assert.ok(!csv.includes('"Row Number"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,6);
});


test("Shelf pin CSV keeps shelf index unitless and converts the two side panels in millimeters",()=>{
  const r=compute("shelf-spacing-calculator",{
    height:40,shelves:3,thickness:1,top:1,bottom:2,
    caseDepth:12,frontPinInset:1.5,backPinInset:1.5,
    pinCenterDrop:.25,pinHoleDiameter:.2
  });
  const cols=scheduleColumns(r.shelfPinRows,"mm");
  assert.deepEqual(cols.map(x=>x.label),[
    "Shelf Number","Panel","Position","Center X (mm)","Center Y (mm)",
    "Hole Diameter (mm)","Face Front Edge (mm)","Face Back Edge (mm)",
    "Face Bottom Edge (mm)","Face Top Edge (mm)","Underside Clearance (mm)"
  ]);
  assert.equal(cols[0].kind,"plain");
  assert.ok(cols.slice(3).every(x=>x.kind==="length"));
  const csv=buildScheduleCsv(r.shelfPinRows,"mm",
    "Both left/right panels use X from inside FRONT and Y from inside floor");
  assert.ok(csv.includes('"1","Left","Front","38.1","260.35","5.08","35.56","40.64","257.81","262.89","3.81"'));
  assert.ok(csv.includes('"1","Right","Back","266.7","260.35","5.08","264.16","269.24","257.81","262.89","3.81"'));
  assert.ok(csv.includes('"3","Right","Back","266.7","742.95","5.08","264.16","269.24","740.41","745.49","3.81"'));
  assert.ok(!csv.includes('"Shelf Number (mm)"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,14);
});
test("Disabled shelf pin grid retains the former five-column shelf CSV without additional rows",()=>{
  const r=compute("shelf-spacing-calculator",{
    height:40,shelves:3,thickness:1,top:1,bottom:2
  });
  assert.equal(r.shelfPinRows.length,0);
  const cols=scheduleColumns(r.rows,"mm");
  assert.deepEqual(cols.map(x=>x.label),[
    "Item","Shelf Bottom (mm)","Shelf Top (mm)",
    "Clear Below (mm)","Clear Above (mm)"
  ]);
  const csv=buildScheduleCsv(r.rows,"mm","Original shelf face schedule");
  assert.ok(csv.includes('"Shelf 1","266.7","292.1","266.7","215.9"'));
  assert.equal(csv.split("\r\n").filter(Boolean).length,5);
});

test("P1 brace CSV exports physical X/Y cut points in typed units",()=>{
  const r=compute("diagonal-brace-calculator",{width:36,height:48,setback:5});
  const mm=buildScheduleCsv(r.rows,"mm","Centerline reference only; no timber end-cut faces.");
  assert.ok(mm.includes('"Station Along Full Line (mm)","Horizontal X (mm)","Vertical Y (mm)"'),mm);
  assert.ok(mm.includes('"Cut start","127","76.2","101.6"'),mm);
  assert.ok(mm.includes('"Cut finish","1397","838.2","1117.6"'),mm);
  const inch=buildScheduleCsv(r.rows,"in");
  assert.ok(inch.includes('"Cut start","5","3","4"'),inch);
  assert.ok(inch.includes('"Cut finish","55","33","44"'),inch);
});

test("P1 straight trapezoid ring exports perpendicular depth and actual segment area units",()=>{
  const r=compute("segmented-bowl-calculator",{outer:12,inner:8,segments:12,rings:1});
  const csv=buildScheduleCsv(r.rows,"mm","Corner diameters, NOT finished turn diameter.");
  assert.ok(csv.includes('"Perpendicular Face Depth (mm)","Ideal Turned Outer Diameter (mm)","Segment Face Area (m²)"'),csv.slice(0,650));
  assert.ok(csv.includes('"49.069032'),csv.slice(0,650));
  assert.ok(csv.includes('"0.00322579979355"'),csv.slice(0,650));
  const inCsv=buildScheduleCsv(r.rows,"in");
  assert.ok(inCsv.includes('"Radial Depth (in)","Perpendicular Face Depth (in)"'),inCsv.slice(0,650));
  assert.ok(inCsv.includes('"Segment Face Area (ft²)"'),inCsv.slice(0,650));
});

test("P1 tapered bowl exports every ring's distinct stock blank and elevation measurements",()=>{
 const r=compute("segmented-bowl-calculator",{
   outer:12,inner:8,segments:12,rings:3,outerStep:-1,innerStep:-.5,
   ringHeight:.75,ringOversize:.125,ringKerf:.1});
 const mm=buildScheduleCsv(r.rows,"mm","Rough blank allowances only.");
 assert.ok(mm.includes('"Outer Corner Diameter (mm)","Inner Corner Diameter (mm)"'),mm.slice(0,500));
 assert.ok(mm.includes('"Rough Blank Length (mm)","Rough Blank Width (mm)","Rough Blank Area (m²)"'),mm.slice(0,700));
 assert.ok(mm.includes('"Stack Bottom (mm)","Stack Top (mm)"'),mm.slice(0,750));
 assert.ok(mm.includes('"Ring 3 / segment 12"'),mm.slice(-1000));
});

test("P1 stringer complete sawline schedule and user end-line CSV retain endpoint units",()=>{
 const r=compute("stair-stringer-calculator",{rise:105,risers:14,tread:10,depth:11.25,
  treadThickness:1.5,lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6});
 const csv=buildScheduleCsv(r.stringerCutLineRows,"mm");
 assert.ok(csv.includes('"Start X (mm)","Start Y (mm)","End X (mm)","End Y (mm)","Cut Length (mm)","Cut Angle (°)"'),csv.slice(0,400));
 assert.ok(csv.includes('"Riser sawline 1"'),csv.slice(0,600));
 const ends=buildScheduleCsv(r.measuredEndCuts,"mm");
 assert.ok(ends.includes('"Lower user-chosen end line"'),ends);
 assert.ok(ends.includes('"-76.2"'),ends);
 assert.ok(ends.includes('"3454.4"'),ends);
});

test("P1 hip and sheathing roof reuse CSV converts independent stock coordinates and polygons",()=>{
 for(const slug of ["hip-roof-calculator","roof-sheathing-calculator"]){
   const inputs=slug==="hip-roof-calculator"?{
     width:96,length:192,pitch:0,overhang:0,sheetWidth:48,sheetLength:96,
     orientation:0,reuseMode:1,roofKerf:0}:{
     width:70,length:110,pitch:0,sheetWidth:48,sheetLength:96,
     orientation:0,waste:0,reuseMode:1,roofKerf:0};
   const r=compute(slug,inputs);
   const csv=buildScheduleCsv(r.roofReusePlan.rows,"mm","Stock-local, no structural bearing.");
   assert.ok(csv.includes('"Stock X (mm)","Stock Y (mm)","Box Width (mm)","Box Height (mm)"'),csv.slice(0,900));
   assert.ok(csv.includes('"Stock Cut Vertices (mm)"'),csv.slice(0,1200));
   assert.ok(csv.includes('"R1"'),csv.slice(0,1500));
   assert.ok(!csv.includes("NaN"));
   assert.ok(!csv.includes("undefined"));
 }
});

test("P1 deck CSV distinguishes joint CENTER from actual physical cut face in millimeters",()=>{
  const r=compute("deck-material-calculator",{
    width:11.125,length:144,board:5.5,gap:.125,stock:100,joists:16,
    waste:0,buttEndGap:.25,joistFaceWidth:3.5,minEndBearing:1.5
  });
  const rows=r.rows.filter(row=>row.type==="Decking");
  const metric=buildScheduleCsv(rows,"mm","Unverified centered joist-face overlap, not rated bearing.");
  assert.ok(metric.includes('"Along Start (mm)"'),metric.split("\r\n")[0]);
  assert.ok(metric.includes('"Butt Joint At End (mm)"'),metric.split("\r\n")[0]);
  assert.ok(metric.includes('"Actual Cut End (mm)"'),metric.split("\r\n")[0]);
  assert.ok(metric.includes('"Geometric Face Overlap (mm)"'),metric.split("\r\n")[0]);
  assert.ok(metric.includes('"2435.225"'),metric);
  assert.ok(metric.includes('"2441.575"'),metric);
  assert.ok(metric.includes('"2438.4"'),metric);
  assert.ok(metric.includes('"41.275"'),metric);
  const inch=buildScheduleCsv(rows,"in");
  assert.ok(inch.includes('"95.875"'),inch);
  assert.ok(inch.includes('"96.125"'),inch);
  assert.ok(inch.includes('"1.625"'),inch);
});

test("Rafter birdsmouth CSV carries independent mm X/Y endpoints and angles, not slope distances",()=>{
  const result=compute("rafter-calculator",{run:120,pitch:6,ridge:0,
    overhang:12,depth:5.5,seat:3});
  const csv=buildScheduleCsv(result.rows,"mm","Nominal reference only; verify physical bearing.");
  assert.ok(csv.includes('"Start X (mm)"'),csv.split("\r\n")[0]);
  assert.ok(csv.includes('"Start Y (mm)"'),csv.split("\r\n")[0]);
  assert.ok(csv.includes('"End X (mm)"'),csv.split("\r\n")[0]);
  assert.ok(csv.includes('"End Y (mm)"'),csv.split("\r\n")[0]);
  assert.ok(csv.includes('"Cut Angle (°)"'),csv.split("\r\n")[0]);
  assert.ok(csv.includes('"Birdsmouth horizontal seat"'),csv);
  assert.ok(csv.includes('"Birdsmouth plumb heel"'),csv);
  assert.ok(csv.includes('"2971.8"'),csv); // (120-3)*25.4
  assert.ok(csv.includes('"3048"'),csv); // 120*25.4
  assert.ok(csv.includes('"76.2"'),csv); // 3-in horizontal seat
  assert.ok(csv.includes('"38.1"'),csv); // 1.5-in plumb heel
  const flat=compute("rafter-calculator",{run:120,pitch:0,ridge:0,
    overhang:0,depth:5.5,seat:3});
  assert.equal(flat.rows.length,3);
  assert.ok(!buildScheduleCsv(flat.rows,"in").includes("Birdsmouth plumb heel"));
});

test("Optional deck joist stock cut CSV preserves center stations and millimeter material lengths",()=>{
  const r=compute("deck-material-calculator",{
    width:120,length:144,board:5.5,gap:.125,stock:144,joists:16,waste:10,
    boardUnitPrice:8,fastenerPackPrice:20,joistStockLength:144,joistUnitPrice:9
  });
  const cuts=r.rows.filter(x=>x.type==="Joist straight cut");
  const csv=buildScheduleCsv(cuts,"mm","Straight stock only; structural spans not rated.");
  assert.equal(cuts.length,10);
  assert.ok(csv.includes('"Purchased Stock Length (mm)"'),csv);
  assert.ok(csv.includes('"Source Offcut Length (mm)"'),csv);
  assert.ok(csv.includes('"Cut Length (mm)"'),csv);
  assert.ok(csv.includes('"3048"'),csv); // joist cut width = 120in
  assert.ok(csv.includes('"3657.6"'),csv); // raw stock = 144in
  assert.ok(csv.includes('"609.6"'),csv); // offcut per source = 24in
  const budget=buildScheduleCsv(r.deckPurchaseRows,"in","User price only.");
  assert.ok(budget.includes('"Optional full-width joist stock"'));
  assert.ok(budget.includes('"11"'));
  assert.ok(budget.includes('"99"'));
});

test("P1 stringer blank and 1D end projection diagnostics export exact selected metric geometry",()=>{
  const a={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,
    lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6,
    lowerSupportRun:5,upperSupportRun:4,
    blankEndAllowance:1,measuredBlankLength:200};
  const r=compute("stair-stringer-calculator",a);
  const metric=buildScheduleCsv(r.stringerBlankRows,"mm",
    "Pitch-aligned 2D reference, NOT actual purchased timber placement");
  assert.ok(metric.includes('"Axis Station (mm)"'),metric);
  assert.ok(metric.includes('"Normal Offset (mm)"'),metric);
  assert.ok(metric.includes('"Elevation (mm)"'),metric);
  assert.ok(metric.includes('"Reference stock corner 1"'),metric);
  assert.ok(metric.includes('"Reference stock corner 4"'),metric);
  for(const row of r.stringerBlankRows)
    assert.ok(metric.includes('"'+String(Number((row.x*25.4).toFixed(6)))+'"'),
      "Missing numeric x reference "+row.x);
  const projection=buildScheduleCsv(r.endProjectionChecks,"mm",
    "X-coordinates only, NOT structural bearing");
  assert.ok(projection.includes('"Projected Outside Support (mm)"'),projection);
  assert.ok(projection.includes('"50.8"'),projection);
  assert.ok(projection.includes('"Inside reference"'),projection);
  assert.ok(projection.includes('"Outside reference"'),projection);
});

test("Stringer 2D line intersections CSV keeps t dimensionless and signed X/Y in five units",()=>{
  const a={rise:105,risers:14,tread:10,depth:11.25,treadThickness:1.5,
    lowerFinish:0,lowerEndCutRun:3,upperEndCutRun:6,
    lowerSupportRun:5,upperSupportRun:4,
    lowerSupportVerticalOffset:-4.40625,
    upperSupportVerticalOffset:-4.78125};
  const r=compute("stair-stringer-calculator",a);
  for(const unit of ["in","ft","mm","cm","m"]){
    const cols=scheduleColumns(r.endContactChecks,unit);
    assert.equal(cols.find(c=>c.key==="cutParameter")?.kind,"plain");
    assert.equal(cols.find(c=>c.key==="cutParameter")?.label,"Cut Parameter");
    for(const key of ["intersectionX","intersectionElevation",
      "supportElevation","crossingHorizontalMiss","sharedLineLength"]){
      assert.equal(cols.find(c=>c.key===key)?.kind,"length");
      assert.ok(cols.find(c=>c.key===key)?.label.endsWith("("+unit+")"));
    }
    const csv=buildScheduleCsv(r.endContactChecks,unit,
      "Single mathematical point; no bearing area");
    assert.ok(csv.includes('"Cut Parameter"'),csv);
    assert.ok(!csv.includes('"Cut Parameter ('),csv);
    assert.ok(csv.includes('"Single point only"'),csv);
  }
  const mm=buildScheduleCsv(r.endContactChecks,"mm");
  assert.ok(mm.includes('"-38.1"'),mm); // lower intersection at x=-1.5in
  assert.ok(mm.includes('"3378.2"'),mm); // upper intersection at x=133in
  assert.ok(mm.includes('"2545.55625"'),mm); // support elevation 100.21875in
  assert.ok(mm.includes('"0.5"'),mm); // true unitless segment fraction
  assert.ok(mm.includes('"0"'),mm); // coincident linear contact length
});

test("metric-only calculator exports machine-readable numeric values and their physical units",()=>{
  const metrics=[
    {label:"Roof angle",value:26.56505117707799,kind:"A"},
    {label:"Horizontal run",value:120,kind:"L"},
    {label:"Rise per 12",value:6,kind:"P"},
    {label:"Estimated pieces",value:13,kind:"N"},
    {label:"Gross area",value:12.3456789,kind:"FT2"},
    {label:"Material quote",value:83.75,kind:"C"}
  ];
  const text=buildMetricsCsv(metrics,"mm","No 1:1 scale","EUR");
  assert.ok(text.startsWith("\uFEFF"));
  assert.ok(text.includes('"Roof angle","26.5650511771","°"'),text);
  assert.ok(text.includes('"Horizontal run","3048","mm"'));
  assert.ok(text.includes('"Rise per 12","6","rise per 12 run"'));
  assert.ok(text.includes('"Estimated pieces","13","count"'));
  assert.ok(text.includes('"Gross area","1.14695110067","m²"'),"area must use native sq-ft-to-sq-m conversion");
  assert.ok(text.includes('"Material quote","83.75","EUR"'));
  assert.ok(!text.includes('"3,048 mm"'));
  assert.ok(text.endsWith('"Source note","No 1:1 scale",""\r\n'));
  assert.equal(text.split("\r\n").filter(Boolean).length,metrics.length+2);
  assert.throws(()=>buildMetricsCsv(metrics,"yard"),/Unsupported unit/);
});


test("Deck multi-seam station list exports EVERY coordinate in selected units",()=>{
  const r=compute("deck-material-calculator",{
    width:120,length:144,board:5.5,gap:.125,
    stock:60,joists:16,waste:0,boardUnitPrice:8.75,
    fastenersPerContact:2,fastenerPackSize:100,fastenerPackPrice:20
  });
  assert.equal(r.deckFastenerRows.length,r.deckRows.length);
  for(let i=0;i<r.deckRows.length;i++){
    assert.deepEqual(r.deckFastenerRows[i].seamStations,r.deckRows[i].seamCenters);
    assert.deepEqual(r.deckFastenerRows[i].seamStations,[48,96]);
  }
  const columns=scheduleColumns(r.deckFastenerRows,"mm");
  assert.equal(columns.find(c=>c.key==="seamStations").kind,"lengthList");
  assert.equal(columns.find(c=>c.key==="seamStations").label,"Seam Stations (mm)");
  const mm=buildScheduleCsv(r.deckFastenerRows,"mm","Joint reference coordinates");
  assert.ok(mm.includes('"First Seam At (mm)"'));
  assert.ok(mm.includes('"Last Seam At (mm)"'));
  assert.ok(mm.includes('"Seam Stations (mm)"'));
  assert.ok(mm.includes('"1219.2; 2438.4"'),mm.slice(0,800));
  assert.ok(!mm.includes('"48; 96"'),"raw inch seam labels must not leak into mm CSV");
  const inches=buildScheduleCsv(r.deckFastenerRows,"in");
  assert.ok(inches.includes('"Seam Stations (in)"'));
  assert.ok(inches.includes('"48; 96"'));
  const meters=buildScheduleCsv(r.deckFastenerRows,"m");
  assert.ok(meters.includes('"Seam Stations (m)"'));
  assert.ok(meters.includes('"1.2192; 2.4384"'));
  assert.deepEqual(r.deckFastenerRows[0].seamStations,[48,96],"source must not be mutated");

  const seamFree=compute("deck-material-calculator",{
    width:120,length:144,board:5.5,gap:.125,stock:144,joists:16,waste:0
  });
  assert.deepEqual(seamFree.deckFastenerRows[0].seamStations,[]);
  const blank=buildScheduleCsv(seamFree.deckFastenerRows,"mm");
  const idx=scheduleColumns(seamFree.deckFastenerRows,"mm").findIndex(c=>c.key==="seamStations");
  const first=blank.slice(1).split("\r\n")[1].split(",");
  assert.equal(first[idx],'""',"no seams must produce an empty cell, not a fabricated zero");
});
