import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const num=async(el,key)=>Number(await el.getAttribute(key));
const metric=async(page,label)=>{
 const cell=page.locator("#result-cards .metric").filter({has:page.getByText(label,{exact:true})});
 await expect(cell).toHaveCount(1);
 const x=(await cell.locator("strong").textContent()).match(/-?\d[\d,]*(?:\.\d+)?/);
 return Number(x[0].replace(/,/g,""));
};
test("spiral stair one-turn station geometry stays identical across screen, SVG and typed CSV",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/spiral-staircase-calculator/");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex,nofollow,noarchive");
 const svg=page.locator("#dimension-svg svg"),sectors=svg.locator(".spiral-tread-face");
 await expect(sectors).toHaveCount(12);
 expect(await metric(page,"Rotation per sector")).toBe(30);
 expect(await metric(page,"Equal station rise")).toBe(8);
 expect(await metric(page,"Walkline arc per sector")).toBeCloseTo(15*Math.PI/6,3);
 expect(await num(sectors.first(),"data-angle-start")).toBe(0);
 expect(await num(sectors.last(),"data-angle-end")).toBe(360);
 expect(await num(sectors.last(),"data-rise-end")).toBe(96);
 for(const i of [0,3,7,11]){
  const pts=(await sectors.nth(i).getAttribute("points")).split(/\s+/);
  expect(pts).toHaveLength(4);
 }
 await page.locator("#unit-select").selectOption("mm");
 expect(await num(sectors.last(),"data-angle-end")).toBe(360);
 expect(await metric(page,"Equal station rise")).toBeCloseTo(203.2,1);
 const dl=page.waitForEvent("download");
 await page.locator("#download-csv").click();
 const csv=readFileSync(await(await dl).path(),"utf8");
 expect(csv).toContain('"Plan Projection Vertices (mm)"');
 expect(csv).toContain('"Tread station 12"');
 await page.locator("#f-walkRadius").fill("1000");
 await expect(page.locator("#calc-error")).toBeVisible();
 await expect(sectors).toHaveCount(0);
 await page.locator("#reset-values").click();
 await expect(page.locator("#calc-error")).toBeHidden();
 await expect(sectors).toHaveCount(12);
});
test("stave straight trapezoid and developed corner edge conserve physical SVG and CSV",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/stave-calculator/");
 const svg=page.locator("#dimension-svg svg"),face=svg.locator(".stave-flat-template");
 await expect(face).toHaveCount(1);
 const top=await num(face,"data-top-chord"),bottom=await num(face,"data-bottom-chord"),
  slant=await num(face,"data-face-slant"),edge=await num(face,"data-corner-edge");
 expect(top).toBeCloseTo(24*Math.sin(Math.PI/12),8);
 expect(bottom).toBeCloseTo(18*Math.sin(Math.PI/12),8);
 expect(Math.hypot(slant,(top-bottom)/2)).toBeCloseTo(edge,7);
 const pts=(await face.getAttribute("points")).split(/\s+/).map(s=>s.split(",").map(Number));
 expect(pts).toHaveLength(4);
 const leftTop=pts[0],rightTop=pts[1],rightBottom=pts[2],leftBottom=pts[3];
 expect((rightTop[0]-leftTop[0])/(rightBottom[0]-leftBottom[0])).toBeCloseTo(top/bottom,8);
 await page.locator("#unit-select").selectOption("mm");
 await expect(page.locator("#cut-table tbody tr")).toHaveCount(12);
 const dl=page.waitForEvent("download");
 await page.locator("#download-csv").click();
 const csv=readFileSync(await(await dl).path(),"utf8");
 expect(csv).toContain('"Plan Projection Vertices (mm)"');
 expect(csv).toContain('"Stave 12"');
 await page.locator("#f-staveCount").fill("2");
 await expect(page.locator("#calc-error")).toBeVisible();
 await expect(face).toHaveCount(0);
 await page.locator("#reset-values").click();
 await expect(page.locator("#calc-error")).toBeHidden();
 await expect(face).toHaveCount(1);
});
