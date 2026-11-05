import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const line=async(locator)=>{
  const [x1,y1,x2,y2]=await Promise.all(
    ["x1","y1","x2","y2"].map(k=>locator.getAttribute(k).then(Number))
  );
  return {x1,y1,x2,y2};
};
const val=(r)=>Math.abs(r.x2-r.x1)>1e-10?
  Math.abs((r.y2-r.y1)/(r.x2-r.x1)):NaN;

test("roof pitch and common rafter slope references use the same real rise/run ratio",async({page})=>{
  await page.goto("/roof-pitch-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const pitchLine=page.locator("#dimension-svg svg .roof-pitch-slope");
  await expect(pitchLine).toHaveCount(1);
  const p=await line(pitchLine);
  expect(val(p)).toBeCloseTo(.5,9);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Roof angle"})).toContainText("26.565");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Slope line"})).toContainText("134.164");
  await page.locator("#f-pitch").fill("0");
  const zero=await line(pitchLine);
  expect(zero.y1).toBeCloseTo(zero.y2,9);
  await page.locator("#f-pitch").fill("12");
  const full=await line(pitchLine);
  expect(val(full)).toBeCloseTo(1,9);
  await page.goto("/rafter-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const top=page.locator("#dimension-svg svg .rafter-top-reference");
  await expect(top).toHaveCount(1);
  const r=await line(top);
  expect(val(r)).toBeCloseTo(.5,9);
  const stock=page.locator("#dimension-svg svg .rafter-stock-section");
  await expect(stock).toHaveCount(1);
  const poly=(await stock.getAttribute("points")).split(/\s+/).map(pair=>pair.split(",").map(Number));
  expect(poly).toHaveLength(7); // real selected notch in a PLUMB-clipped 2D section
  const along=[poly[1][0]-poly[0][0],poly[1][1]-poly[0][1]];
  const scale=along[0]/132; // default 120in bearing run +12in tail
  const verticalDepth=poly.at(-1)[1]-poly[0][1];
  expect(verticalDepth/scale).toBeCloseTo(5.5*Math.sqrt(1+.5*.5),7);
  // The two sloping stock faces remain a measured 5.5in apart NORMAL
  // to roof pitch; end clips are plumb, not perpendicular end saw cuts.
  expect((verticalDepth/scale)/Math.sqrt(1+.5*.5)).toBeCloseTo(5.5,7);
  await expect(page.locator("#dimension-svg svg .rafter-seat-reference")).toHaveCount(1);
  await expect(page.locator("#dimension-svg svg .rafter-heel-plumb-cut")).toHaveCount(1);
  const main=page.locator("#result-cards .metric").filter({hasText:"Adjusted run"});
  await expect(main).toContainText("120 in");
  await page.locator("#f-ridge").fill("1.5");
  await expect(main).toContainText("119.25 in");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Ridge centerline run before allowance"})).toContainText("120 in");
  await page.locator("#f-pitch").fill("0");
  await expect(page.locator("#calc-error")).toBeHidden();
  const flat=await line(top);
  expect(flat.y1).toBeCloseTo(flat.y2,9);
  await expect(page.locator("#dimension-svg svg .rafter-heel-plumb-cut")).toHaveCount(0);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Seat notch (normal depth)"})).toContainText("0 in");
  await page.locator("#f-pitch").fill("6");
  await expect(page.locator("#dimension-svg svg .rafter-heel-plumb-cut")).toHaveCount(1);
});

test("hip rafter diagram uses distinct plan and true elevation triangles and exports typed angles",async({page})=>{
  await page.goto("/hip-rafter-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const plan=page.locator("#dimension-svg svg .hip-plan-diagonal");
  const elev=page.locator("#dimension-svg svg .hip-elevation-line");
  await expect(plan).toHaveCount(1);
  await expect(elev).toHaveCount(1);
  expect(val(await line(plan))).toBeCloseTo(1,9); // 120 x 120 plan
  expect(val(await line(elev))).toBeCloseTo(60/Math.hypot(120,120),9);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Hip line length"})).toContainText("180 in");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Hip elevation angle"})).toContainText("19.471");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Common roof-face slope angle"})).toContainText("26.565");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(1);
  await expect(page.locator("#cut-table thead")).toContainText("Plan Angle Deg (°)");
  await expect(page.locator("#cut-table thead")).toContainText("Hip Elevation Angle Deg (°)");
  const first=await line(plan);
  await page.locator("#f-runX").fill("240");
  expect(val(await line(plan))).toBeCloseTo(.5,9);
  expect(val(await line(elev))).toBeCloseTo(60/Math.hypot(240,120),9);
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Along Plan Run (mm)");
  await expect(page.locator("#cut-table thead")).toContainText("True Hip Length (mm)");
  await expect(page.locator("#cut-table thead")).toContainText("Hip Elevation Angle Deg (°)");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Along Plan Run (mm)","Across Plan Run (mm)","Vertical Rise (mm)"');
  expect(csv).toContain('"Plan Angle Deg (°)","Hip Elevation Angle Deg (°)"');
  expect(csv).toContain('"Hip line reference"');
  await page.locator("#f-pitch").fill("0");
  await expect(page.locator("#calc-error")).toBeHidden();
  expect(val(await line(elev))).toBeCloseTo(0,9);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Hip elevation angle"})).toContainText("0°");
  await page.locator("#f-runY").fill("-100");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(plan).toHaveCount(0);
});
