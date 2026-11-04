import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

test("stringer SVG follows actual engine profile and keeps bottom trim separate",async({page})=>{
  await page.goto("/stair-stringer-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#result-cards .metric").filter({hasText:"Notch pitch-line reference"})).toContainText("162.5 in");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Floor-to-floor diagonal"})).toContainText("167.1077 in");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(14);
  const path=page.locator("#dimension-svg svg .stringer-step-profile");
  await expect(path).toHaveCount(1);
  await expect(path).toHaveAttribute("data-vertices","28");
  const points=(await path.getAttribute("points")).trim().split(/\s+/).map(pair=>pair.split(",").map(Number));
  expect(points).toHaveLength(28);
  for(let i=1;i<points.length;i++){
    if(i%2===1){
      expect(points[i][0]).toBeCloseTo(points[i-1][0],7);
      expect(points[i][1]).toBeLessThan(points[i-1][1]);
    }else{
      expect(points[i][0]).toBeGreaterThan(points[i-1][0]);
      expect(points[i][1]).toBeCloseTo(points[i-1][1],7);
    }
  }
  expect((points[1][1]-points.at(-1)[1])/(points.at(-1)[0]-points[1][0])).toBeCloseTo(7.5/10,8);
  await expect(page.locator("#dimension-svg svg .stringer-pitch-line")).toHaveCount(1);
  await expect(page.locator("#dimension-svg svg .stringer-floor-diagonal")).toHaveCount(1);
  const trim=page.locator("#dimension-svg svg .stringer-bottom-trim");
  const yBefore=Number(await trim.getAttribute("y1"));
  const outlineBefore=await path.getAttribute("points");
  await page.locator("#f-lowerFinish").fill("0.5");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Bottom riser layout cut"})).toContainText("6.5 in");
  expect(Number(await trim.getAttribute("y1"))).toBeLessThan(yBefore);
  expect(await path.getAttribute("points")).toBe(outlineBefore);
  await page.locator("#f-treadThickness").fill("9");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(path).toHaveCount(0);
});

test("crown inside/outside and left/right affect illustrative plan only, not saw magnitudes",async({page})=>{
  await page.goto("/crown-molding-calculator/");
  const m=page.locator("#result-cards .metric").filter({hasText:"Miter magnitude"});
  const b=page.locator("#result-cards .metric").filter({hasText:"Bevel magnitude"});
  await expect(m).toContainText("31.619");
  await expect(b).toContainText("33.8629");
  const mText=await m.textContent(),bText=await b.textContent();
  const plan=page.locator("#dimension-svg svg .crown-miter-ray");
  await expect(plan).toHaveAttribute("data-sign","1");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(1);
  await expect(page.locator("#cut-table thead")).toContainText("Miter Magnitude Angle (°)");
  await expect(page.locator("#cut-table thead")).toContainText("Illustrative Miter Angle (°)");
  await page.locator("#f-inside").selectOption("0");
  await expect(plan).toHaveAttribute("data-sign","-1");
  await expect(m).toHaveText(mText);
  await expect(b).toHaveText(bText);
  await page.locator("#f-left").selectOption("0");
  await expect(plan).toHaveAttribute("data-sign","1");
  await page.locator("#unit-select").selectOption("mm");
  await expect(m).toHaveText(mText);
  const download=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await download).path(),"utf8");
  expect(csv).toContain('"Spring Angle (°)","Wall Corner Angle (°)"');
  expect(csv).toContain('"Miter Magnitude Angle (°)","Bevel Magnitude Angle (°)","Illustrative Miter Angle (°)"');
  expect(csv).toContain('"Outside","Right"');
  await page.locator("#f-corner").fill("180");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(plan).toHaveCount(0);
  await page.locator("#f-corner").fill("90");
  await expect(plan).toHaveAttribute("data-sign","1");
});
