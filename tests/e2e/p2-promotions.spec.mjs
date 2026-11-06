import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const num=async(el,key)=>Number(await el.getAttribute(key));
test("Fence picket SVG measured faces, stepped top and downloadable CSV",async({page})=>{
 await page.goto("/fence-picket-calculator/");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex,nofollow,noarchive");
 const svg=page.locator("#dimension-svg svg"),faces=svg.locator(".picket-face");
 await expect(faces).toHaveCount(16);
 await expect(page.locator("#result-cards .metric").filter({hasText:"Equal clear gap"}))
   .toContainText("3.7647 in");
 const gap=64/17;
 expect(await num(faces.first(),"data-face-left")).toBeCloseTo(gap,7);
 expect(await num(faces.last(),"data-face-right")).toBeCloseTo(120-gap,7);
 expect((await num(faces.first(),"height"))/(await num(faces.first(),"width"))).toBeCloseTo(48/3.5,8);
 await page.locator("#f-archMode").selectOption("1");
 await expect(page.locator("#f-archRise").locator("xpath=..")).toBeVisible();
 expect(await num(faces.nth(7),"data-cut-height"))
   .toBeGreaterThan(await num(faces.first(),"data-cut-height"));
 await page.locator("#f-edgeMode").selectOption("1");
 await expect(faces).toHaveCount(17);
 expect(await num(faces.first(),"data-face-left")).toBe(0);
 expect(await num(faces.last(),"data-face-right")).toBe(120);
 await page.locator("#unit-select").selectOption("mm");
 await expect(page.locator("#cut-table thead")).toContainText("Cut Height (mm)");
 const dl=page.waitForEvent("download");
 await page.locator("#download-csv").click();
 const csv=readFileSync(await(await dl).path(),"utf8");
 expect(csv).toContain('"Face Left (mm)"');
 expect(csv).toContain('"Picket 17"');
 await page.locator("#f-width").fill("4000");
 await expect(page.locator("#calc-error")).toBeVisible();
 await expect(svg).toHaveCount(0);
 await expect(page.locator("#download-csv")).toBeDisabled();
});
test("Gambrel: four proportional roof lines agree with coordinates and CSV area",async({page})=>{
 await page.goto("/gambrel-roof-calculator/");
 const lines=page.locator("#dimension-svg svg .gambrel-slope-segment");
 await expect(lines).toHaveCount(4);
 await expect(page.locator("#result-cards .metric").filter({hasText:"Ridge elevation above eave datum"}))
   .toContainText("84 in");
 for(const [i,run,rise] of [[0,60,60],[1,72,24],[2,72,24],[3,60,60]]){
   const line=lines.nth(i),dx=Math.abs(await num(line,"x2")-await num(line,"x1"));
   const dy=Math.abs(await num(line,"y2")-await num(line,"y1"));
   expect(dy/dx).toBeCloseTo(rise/run,8);
 }
 const shape=page.locator("#dimension-svg svg .gambrel-roof-profile");
 await expect(shape).toHaveCount(1);
 expect((await shape.getAttribute("points")).trim().split(/\s+/)).toHaveLength(5);
 await page.locator("#unit-select").selectOption("mm");
 await expect(page.locator("#cut-table thead")).toContainText("Roof Face Area (m²)");
 const dl=page.waitForEvent("download");
 await page.locator("#download-csv").click();
 const csv=readFileSync(await(await dl).path(),"utf8");
 expect(csv).toContain('"Start X (mm)"');
 expect(csv).toContain('"Left lower slope"');
 expect(csv).toContain('"Right lower slope"');
 await page.locator("#f-upperPitch").fill("18");
 await expect(page.locator("#calc-error")).toBeVisible();
 await expect(lines).toHaveCount(0);
 await page.locator("#f-upperPitch").fill("4");
 await expect(page.locator("#calc-error")).toBeHidden();
 await expect(lines).toHaveCount(4);
});
