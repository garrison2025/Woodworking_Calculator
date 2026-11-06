import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {compute} from "../../src/calcs.mjs";

const numeric=async(page,label)=>{
 const row=page.locator("#result-cards .metric").filter({has:page.getByText(label,{exact:true})});
 await expect(row).toHaveCount(1);
 const t=await row.locator("strong").textContent();
 const match=t.match(/-?\d[\d,]*(?:\.\d+)?/);
 expect(match).toBeTruthy();
 return Number(match[0].replace(/,/g,""));
};
const input=async(page,name)=>Number(await page.locator("#f-"+name).inputValue());
test("Spiral: 14 measured wedges, 15 risers, directional SVG and metric CSV on mobile",async({page})=>{
 test.setTimeout(75000);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/spiral-staircase-calculator/");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex,nofollow,noarchive");
 await expect(page.locator("#calc-error")).toBeHidden();
 expect(await numeric(page,"Physical wedge treads")).toBe(14);
 expect(await numeric(page,"Risers including the upper finished floor")).toBe(15);
 expect(await numeric(page,"Uniform riser height")).toBeCloseTo(7.2,3);
 expect(await numeric(page,"Walk-line arc going per tread")).toBeCloseTo(2*Math.PI,3);
 const svg=page.locator("#dimension-svg svg"),wedges=svg.locator(".spiral-tread-face");
 await expect(svg).toHaveAttribute("data-model-shape","spiral-plan");
 await expect(wedges).toHaveCount(14);
 expect(Number(await wedges.last().getAttribute("data-end-angle"))).toBeCloseTo(360,5);
 expect(Number(await wedges.last().getAttribute("data-elevation-in"))).toBeCloseTo(100.8,5);
 await page.locator("#f-direction").selectOption("1");
 expect(Number(await wedges.last().getAttribute("data-end-angle"))).toBeCloseTo(-360,5);
 await page.locator("#f-direction").selectOption("0");
 await page.locator("#unit-select").selectOption("mm");
 expect(await input(page,"outerDiameter")).toBeCloseTo(1828.8,3);
 expect(await input(page,"poleDiameter")).toBeCloseTo(101.6,3);
 expect(await numeric(page,"Physical wedge treads")).toBe(14);
 const dl=page.waitForEvent("download");
 await page.locator("#download-csv").click();
 const csv=readFileSync(await(await dl).path(),"utf8");
 expect(csv).toContain('"Plan Projection Vertices (mm)"');
 expect(csv).toContain('"Tread 14"');
 expect(csv).toContain('"Walkline Arc Length (mm)"');
 const width=await page.evaluate(()=>({
  page:document.documentElement.scrollWidth,
  client:document.documentElement.clientWidth}));
 expect(width.page).toBeLessThanOrEqual(width.client+2);
 await page.locator("#f-walkInset").fill("2000");
 await expect(page.locator("#calc-error")).toBeVisible();
 await expect(svg).toHaveCount(0);
 await expect(page.locator("#download-csv")).toBeDisabled();
 await page.locator("#reset-values").click();
 await expect(page.locator("#calc-error")).toBeHidden();
 await expect(wedges).toHaveCount(14);
});

test("Stave: true trapezoid face geometry, zero-taper boundary, metric CSV and reset",async({page})=>{
 test.setTimeout(75000);
 await page.setViewportSize({width:360,height:780});
 await page.goto("/stave-calculator/");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex,nofollow,noarchive");
 await expect(page.locator("#calc-error")).toBeHidden();
 const svg=page.locator("#dimension-svg svg"),face=svg.locator(".stave-face");
 await expect(svg).toHaveAttribute("data-model-shape","stave-trapezoid");
 await expect(face).toHaveCount(1);
 const model=compute("stave-calculator",{
  topCornerDiameter:20,bottomCornerDiameter:16,height:24,
  staves:12,roughMargin:0.125,roughKerf:0.125});
 for(const [key,v] of [
  ["data-top-chord-in",model.staveBlank.topChord],
  ["data-bottom-chord-in",model.staveBlank.bottomChord],
  ["data-face-length-in",model.staveBlank.faceLength],
  ["data-edge-length-in",model.staveBlank.edgeLength],
  ["data-half-dihedral-deg",model.staveBlank.halfDihedralDeg]
 ]){
  expect(Number(await face.getAttribute(key)),key).toBeCloseTo(v,7);
 }
 expect(await numeric(page,"Plan half-miter reference")).toBeCloseTo(15,3);
 await page.locator("#f-bottomCornerDiameter").fill("20");
 expect(await numeric(page,"Flat face-edge side taper")).toBe(0);
 expect(await numeric(page,"Face-center slant length")).toBe(24);
 await page.locator("#unit-select").selectOption("mm");
 expect(await input(page,"topCornerDiameter")).toBeCloseTo(508,3);
 expect(await input(page,"bottomCornerDiameter")).toBeCloseTo(508,3);
 const dl=page.waitForEvent("download");
 await page.locator("#download-csv").click();
 const csv=readFileSync(await(await dl).path(),"utf8");
 expect(csv).toContain('"Stave 12"');
 expect(csv).toContain('"Plan Projection Vertices (mm)"');
 expect(csv).toContain('"Stave Face Area (m²)"');
 const width=await page.evaluate(()=>({
  page:document.documentElement.scrollWidth,
  client:document.documentElement.clientWidth}));
 expect(width.page).toBeLessThanOrEqual(width.client+2);
 await page.locator("#f-staves").fill("2");
 await expect(page.locator("#calc-error")).toBeVisible();
 await expect(svg).toHaveCount(0);
 await expect(page.locator("#download-csv")).toBeDisabled();
 await page.locator("#reset-values").click();
 await expect(page.locator("#calc-error")).toBeHidden();
 await expect(face).toHaveCount(1);
});
