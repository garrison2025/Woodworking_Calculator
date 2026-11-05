import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

function table(csv){
  const lines=csv.replace(/^\uFEFF/,"").trim().split("\r\n");
  const parse=line=>{
    const out=[];let text="",quoted=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'&&quoted&&line[i+1]==='"'){text+='"';i++;}
      else if(c==='"')quoted=!quoted;
      else if(c===","&&!quoted){out.push(text);text="";}
      else text+=c;
    }
    out.push(text);
    return out;
  };
  const headers=parse(lines[0]);
  return lines.slice(1).map(line=>{
    const cells=parse(line);
    return Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));
  }).filter(r=>r[headers[0]]!=="Source note");
}

test("roof SVG rectangles use exactly the numeric cut positions exported to mm CSV",async({page})=>{
  await page.goto("/roof-sheathing-calculator/");
  await page.locator("#f-pitch").fill("0");
  await page.locator("#f-width").fill("48.000002");
  await page.locator("#f-length").fill("96.000002");
  await page.locator("#f-sheetWidth").fill("48");
  await page.locator("#f-sheetLength").fill("96");
  await expect(page.locator("#calc-error")).toBeHidden();
  const rectangles=page.locator("#dimension-svg svg .sheathing-cut");
  await expect(rectangles).toHaveCount(4);
  const shape=await rectangles.evaluateAll(els=>els.map(el=>({
    row:Number(el.dataset.row),column:Number(el.dataset.column),
    eaveStart:Number(el.dataset.eaveStart),eaveEnd:Number(el.dataset.eaveEnd),
    slopeStart:Number(el.dataset.slopeStart),slopeEnd:Number(el.dataset.slopeEnd),
    cutAlong:Number(el.dataset.cutAlong),cutUphill:Number(el.dataset.cutUphill),
    width:Number(el.getAttribute("width")),height:Number(el.getAttribute("height"))
  })));
  await page.locator("#unit-select").selectOption("mm");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const exported=table(readFileSync(await (await dl).path(),"utf8"));
  expect(exported).toHaveLength(4);
  for(const [i,rect] of shape.entries()){
    const row=exported[i];
    expect(Number(row.Row)).toBe(rect.row);
    expect(Number(row.Column)).toBe(rect.column);
    const columns={
      "Eave Start (mm)":rect.eaveStart,"Eave End (mm)":rect.eaveEnd,
      "Slope Start (mm)":rect.slopeStart,"Slope End (mm)":rect.slopeEnd,
      "Cut Along (mm)":rect.cutAlong,"Cut Uphill (mm)":rect.cutUphill
    };
    for(const [name,raw] of Object.entries(columns))
      expect(Number(row[name])).toBeCloseTo(raw*25.4,5);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  }
  // The download above was in mm; switch the EDIT form back to inches
  // before supplying the intentionally sub-resolution 48-inch edge strip.
  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-width").fill("48.00000005");
  await expect(page.locator("#calc-error")).toContainText("cut-coordinate resolution");
  await expect(rectangles).toHaveCount(0);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
});

test("nondivisible stairs: SVG riser/tread/landing references agree with mm CSV",async({page})=>{
  await page.goto("/stair-calculator/");
  await page.locator("#f-rise").fill("95");
  await page.locator("#f-desired").fill("7");
  await page.locator("#f-tread").fill("11");
  await page.locator("#f-landing").fill("28");
  await expect(page.locator("#calc-error")).toBeHidden();
  const risers=await page.locator("#dimension-svg svg .stair-riser")
    .evaluateAll(els=>els.map(el=>({
      run:Number(el.dataset.horizontalRun),rise:Number(el.dataset.topRise)
    })));
  const treads=await page.locator("#dimension-svg svg .stair-tread")
    .evaluateAll(els=>els.map(el=>({
      start:Number(el.dataset.start),end:Number(el.dataset.end)
    })));
  expect(risers).toHaveLength(14);
  expect(treads).toHaveLength(13);
  const landing=await page.locator("#dimension-svg svg .stair-landing").evaluate(el=>({
    start:Number(el.dataset.start),end:Number(el.dataset.end)
  }));
  expect(landing).toEqual({start:143,end:171});
  await page.locator("#unit-select").selectOption("mm");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const rows=table(readFileSync(await (await dl).path(),"utf8"));
  expect(rows).toHaveLength(14);
  for(const [i,row] of rows.entries()){
    expect(Number(row["Run (mm)"])).toBeCloseTo(risers[i].run*25.4,5);
    expect(Number(row["Rise (mm)"])).toBeCloseTo(risers[i].rise*25.4,5);
    if(i<13){
      expect(Number(row["Tread Start (mm)"])).toBeCloseTo(treads[i].start*25.4,5);
      expect(Number(row["Tread End (mm)"])).toBeCloseTo(treads[i].end*25.4,5);
    }
  }
  await page.locator("#f-rise").fill("0.0000001");
  await page.locator("#f-desired").fill("0.00000005");
  await expect(page.locator("#calc-error")).toContainText("cut-coordinate resolution");
  await expect(page.locator("#dimension-svg svg .stair-riser")).toHaveCount(0);
});
