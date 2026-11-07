import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

function csvTable(raw){
  const lines=raw.replace(/^\uFEFF/,"").trim().split("\r\n");
  const parse=line=>{
    const result=[];let field="",quoted=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'&&quoted&&line[i+1]==='"'){field+='"';i++;}
      else if(c==='"')quoted=!quoted;
      else if(c===","&&!quoted){result.push(field);field="";}
      else field+=c;
    }
    result.push(field);return result;
  };
  const columns=parse(lines[0]);
  return lines.slice(1).map(line=>{
    const cells=parse(line);
    return Object.fromEntries(columns.map((k,i)=>[k,cells[i]]));
  }).filter(row=>row[columns[0]]!=="Source note");
}
const exportRows=async page=>{
  const promised=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  return csvTable(readFileSync(await (await promised).path(),"utf8"));
};
const near=(actual,expected,tol=1e-5)=>{
  expect(Math.abs(actual-expected)).toBeLessThanOrEqual(tol);
};
const polyArea=poly=>Math.abs(poly.reduce((sum,p,i)=>{
  const n=poly[(i+1)%poly.length];
  return sum+p[0]*n[1]-n[0]*p[1];
},0))/2;

test("spiral each drawn four-corner tread matches millimeter CSV and distinct sector/polygon areas",async({page})=>{
  await page.goto("/spiral-staircase-calculator/");
  await page.locator("#f-totalRise").fill("112");
  await page.locator("#f-outerDiameter").fill("84");
  await page.locator("#f-poleDiameter").fill("6");
  await page.locator("#f-walkInset").fill("13");
  await page.locator("#f-totalRotation").fill("300");
  await page.locator("#f-direction").selectOption("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  const circle=await page.locator("#dimension-svg svg .spiral-outer-envelope")
    .evaluate(el=>({cx:+el.getAttribute("cx"),cy:+el.getAttribute("cy"),r:+el.getAttribute("r")}));
  const shapes=await page.locator("#dimension-svg svg .spiral-tread-face")
    .evaluateAll(els=>els.map(el=>({
      vertices:el.getAttribute("points").trim().split(/\s+/)
        .map(pair=>pair.split(",").map(Number)),
      polygonFt2:+el.dataset.chordAreaFt2,
      sectorFt2:+el.dataset.sectorAreaFt2,
      elevationIn:+el.dataset.elevationIn
    })));
  expect(shapes).toHaveLength(14);
  const scale=circle.r/42;
  await page.locator("#unit-select").selectOption("mm");
  const rows=await exportRows(page);
  expect(rows).toHaveLength(shapes.length);
  for(const [i,row] of rows.entries()){
    const p=shapes[i];
    const xy=JSON.parse(row["Plan Projection Vertices (mm)"]);
    expect(xy).toHaveLength(4);
    for(let j=0;j<4;j++){
      near(p.vertices[j][0],circle.cx+(xy[j][0]/25.4-42)*scale,2e-5);
      near(p.vertices[j][1],circle.cy+(xy[j][1]/25.4-42)*scale,2e-5);
    }
    near(p.polygonFt2*.09290304,+row["Tread Chord Polygon Area (m²)"],1e-8);
    near(p.sectorFt2*.09290304,+row["Tread Annular Area (m²)"],1e-8);
    near(polyArea(xy)/1e6,+row["Tread Chord Polygon Area (m²)"],1e-8);
    near(p.elevationIn*25.4,+row["Tread Top Elevation (mm)"],1e-6);
    expect(p.sectorFt2).toBeGreaterThan(p.polygonFt2);
  }
  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-totalRise").fill("0.0000001");
  await expect(page.locator("#calc-error")).toContainText("cut-coordinate resolution");
  await expect(page.locator("#dimension-svg svg .spiral-tread-face")).toHaveCount(0);
  await expect(page.locator("#download-csv")).toBeDisabled();
  await page.locator("#f-totalRise").fill("112");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#dimension-svg svg .spiral-tread-face")).toHaveCount(14);
});

test("gambrel four displayed slope segments exactly follow the selected CSV positions",async({page})=>{
  await page.goto("/gambrel-roof-calculator/");
  await page.locator("#f-width").fill("272");
  await page.locator("#f-lowerRun").fill("64");
  await page.locator("#f-lowerPitch").fill("14");
  await page.locator("#f-upperPitch").fill("3");
  await expect(page.locator("#calc-error")).toBeHidden();
  const segs=await page.locator("#dimension-svg svg .gambrel-slope-segment")
    .evaluateAll(els=>els.map(el=>({
      startX:+el.dataset.startX,endX:+el.dataset.endX,
      startY:+el.dataset.startHeight,endY:+el.dataset.endHeight,
      length:+el.dataset.slopeLength,
      x1:+el.getAttribute("x1"),x2:+el.getAttribute("x2"),
      y1:+el.getAttribute("y1"),y2:+el.getAttribute("y2")
    })));
  expect(segs).toHaveLength(4);
  const scale=(segs[0].x2-segs[0].x1)/(segs[0].endX-segs[0].startX);
  const originX=segs[0].x1,originY=segs[0].y1;
  await page.locator("#unit-select").selectOption("mm");
  const rows=await exportRows(page);
  expect(rows).toHaveLength(4);
  for(let i=0;i<4;i++){
    const r=rows[i],s=segs[i];
    near(s.startX*25.4,+r["Start X (mm)"],1e-6);
    near(s.endX*25.4,+r["End X (mm)"],1e-6);
    near(s.startY*25.4,+r["Start Height (mm)"],1e-6);
    near(s.endY*25.4,+r["End Height (mm)"],1e-6);
    near(s.length*25.4,+r["Sloped Length (mm)"],1e-6);
    near(s.x1,originX+s.startX*scale,1e-5);
    near(s.x2,originX+s.endX*scale,1e-5);
    near(s.y1,originY-s.startY*scale,1e-5);
    near(s.y2,originY-s.endY*scale,1e-5);
    expect(s.startX).toBeLessThan(s.endX);
  }
  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-upperPitch").fill("0.000000001");
  await expect(page.locator("#calc-error")).toContainText("cut-coordinate resolution");
  await expect(page.locator("#dimension-svg svg .gambrel-slope-segment")).toHaveCount(0);
  await page.locator("#f-upperPitch").fill("3");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#dimension-svg svg .gambrel-slope-segment")).toHaveCount(4);
});

test("tapered stave polygon corners match the exported millimeter 2D trapezoid",async({page})=>{
  await page.goto("/stave-calculator/");
  await page.locator("#f-topCornerDiameter").fill("18");
  await page.locator("#f-bottomCornerDiameter").fill("26");
  await page.locator("#f-height").fill("22");
  await page.locator("#f-staves").fill("16");
  await expect(page.locator("#calc-error")).toBeHidden();
  const poly=await page.locator("#dimension-svg svg .stave-face").evaluate(el=>({
    points:el.getAttribute("points").trim().split(/\s+/)
      .map(pair=>pair.split(",").map(Number)),
    scale:+el.dataset.planScale,ox:+el.dataset.originX,oy:+el.dataset.originY,
    top:+el.dataset.topChordIn,bottom:+el.dataset.bottomChordIn,
    faceLength:+el.dataset.faceLengthIn
  }));
  expect(poly.points).toHaveLength(4);
  expect(poly.bottom).toBeGreaterThan(poly.top);
  await page.locator("#unit-select").selectOption("mm");
  const rows=await exportRows(page);
  expect(rows).toHaveLength(16);
  for(const row of rows){
    const xy=JSON.parse(row["Plan Projection Vertices (mm)"]);
    expect(xy).toHaveLength(4);
    for(let i=0;i<4;i++){
      near(poly.points[i][0],poly.ox+xy[i][0]/25.4*poly.scale,2e-5);
      near(poly.points[i][1],poly.oy+xy[i][1]/25.4*poly.scale,2e-5);
    }
    near(polyArea(xy)/1e6,+row["Stave Face Area (m²)"],1e-8);
    near(poly.top*25.4,+row["Top Outer Chord (mm)"],1e-6);
    near(poly.bottom*25.4,+row["Bottom Outer Chord (mm)"],1e-6);
    near(poly.faceLength*25.4,+row["Face Centerline Length (mm)"],1e-6);
  }
});
