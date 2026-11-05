import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

test("roof sheathing displays physical eave/uphill end cuts and conserves offcut area",async({page})=>{
  await page.goto("/roof-sheathing-calculator/");
  await page.locator("#f-pitch").fill("0");
  await page.locator("#f-width").fill("70");
  await page.locator("#f-length").fill("110");
  await page.locator("#f-waste").fill("0");
  await expect(page.locator("#calc-error")).toBeHidden();
  const sheets=page.locator("#dimension-svg svg .sheathing-cut");
  await expect(sheets).toHaveCount(4);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Stock face area before allowance"})).toContainText("128 ft²");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Sloped roof surface"})).toContainText("53.472");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Unreused offcut area"})).toContainText("74.528");
  await expect(page.locator("#cut-table thead")).toContainText("Eave End (in)");
  await expect(page.locator("#cut-table thead")).toContainText("Slope End (in)");
  await expect(page.locator("#cut-table thead")).toContainText("Offcut Area (ft²)");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(4);
  await expect(sheets.nth(1)).toHaveAttribute("data-row","1");
  await expect(sheets.nth(1)).toHaveAttribute("data-column","2");
  const p1=sheets.nth(0),p2=sheets.nth(1),p3=sheets.nth(2),p4=sheets.nth(3);
  const pos=async p=>({
    x:Number(await p.getAttribute("x")),y:Number(await p.getAttribute("y")),
    w:Number(await p.getAttribute("width")),h:Number(await p.getAttribute("height"))
  });
  const [u,v,w,z]=await Promise.all([pos(p1),pos(p2),pos(p3),pos(p4)]);
  expect(v.x).toBeCloseTo(u.x+u.w,7);
  expect(w.y).toBeCloseTo(u.y+u.h,7);
  expect(v.w/u.w).toBeCloseTo(14/96,7);
  expect(w.h/u.h).toBeCloseTo(22/48,7);
  expect(z.x).toBeCloseTo(v.x,7);
  expect(z.y).toBeCloseTo(w.y,7);
  const last=page.locator("#cut-table tbody tr").last();
  await expect(last).toContainText("S4");
  await expect(last).toContainText("110 in");
  await expect(last).toContainText("70 in");
  await expect(last).toContainText("14 in");
  await expect(last).toContainText("22 in");
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Eave End (mm)");
  await expect(page.locator("#cut-table thead")).toContainText("Offcut Area (m²)");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Cut Area (m²)","Offcut Area (m²)"');
  expect(csv).toContain('"Eave Start (mm)","Eave End (mm)","Slope Start (mm)","Slope End (mm)"');
  expect(csv).toContain('"S4","2","2"');
  await page.locator("#f-sheetWidth").fill("0.001");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(sheets).toHaveCount(0);
  await page.locator("#f-sheetWidth").fill("1219.2");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(sheets).toHaveCount(4);
});
test("roof sheathing sheet rotation updates source cut bounds without changing roof area",async({page})=>{
  await page.goto("/roof-sheathing-calculator/");
  const area=page.locator("#result-cards .metric").filter({hasText:"Sloped roof surface"});
  const before=await area.textContent();
  const cuts=page.locator("#dimension-svg svg .sheathing-cut");
  await expect(cuts).toHaveCount(8);
  await page.locator("#f-orientation").selectOption("1");
  await expect(cuts).toHaveCount(6);
  await expect(area).toHaveText(before);
  await expect(page.locator("#cut-table thead")).toContainText("Column");
  await expect(page.locator("#cut-table thead")).toContainText("Eave End (in)");
});
