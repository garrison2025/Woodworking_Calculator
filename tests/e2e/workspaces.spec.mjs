import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const registry=JSON.parse(readFileSync("src/tools.json","utf8"));
const active=registry.tools.filter(t=>t.priority==="P0"||t.priority==="P1");

test("homepage links to every active tool without publishing P2",async({page})=>{
  const response=await page.goto("/");
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading",{name:/Good work begins/i})).toBeVisible();
  for(const t of active)expect(await page.locator('a[href="/'+t.slug+'/"]').count()).toBeGreaterThan(0);
  for(const t of registry.tools.filter(t=>t.priority==="P2"))
    expect(await page.locator('a[href="/'+t.slug+'/"]').count()).toBe(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content",/noindex/);
});

test("all 26 calculator pages execute JS, render metrics and SVG",async({page})=>{
  const pageErrors=[];
  page.on("pageerror",e=>pageErrors.push(e.message));
  for(const t of active){
    const response=await page.goto("/"+t.slug+"/");
    expect(response.status(),t.slug).toBe(200);
    const calcError=await page.locator("#calc-error").textContent();
    if(calcError?.trim())throw new Error(t.slug+": "+calcError.trim());
    await expect(page.locator("#result-cards .metric").first(),t.slug).toBeVisible();
    await expect(page.locator("#dimension-svg svg"),t.slug).toHaveCount(1);
    await expect(page.locator("#calc-error"),t.slug).toBeHidden();
    await expect(page.locator("#calculator-form input"),t.slug).toHaveCount(t.inputs.length);
    await expect(page.locator("meta[name='robots']"),t.slug).toHaveAttribute("content",/noindex/);
    const html=await page.locator("main").innerText();
    expect(html,t.slug).not.toContain('{esc(t[');
    expect(html,t.slug).not.toContain('{esc(');
    expect(html,t.slug).toContain("Geometry rule");
  }
  expect(pageErrors).toEqual([]);
});

test("deck row calculation uses the verified 1.875-inch final rip",async({page})=>{
  await page.goto("/deck-board-calculator/");
  const rip=page.locator("#result-cards .metric").filter({hasText:"Last rip width"});
  await expect(rip).toContainText("1.875 in");
  const count=page.locator("#result-cards .metric").filter({hasText:"Board rows"});
  await expect(count).toContainText("22");
});

test("stud recalculation changes results and input validation surfaces errors",async({page})=>{
  await page.goto("/stud-calculator/");
  const last=page.locator("#result-cards .metric").filter({hasText:"Last cut length"});
  await expect(last).toContainText("163.5 in");
  await page.locator("#f-length").fill("120");
  await expect(last).toContainText("151.5 in");
  await expect(page.locator("#dimension-svg svg")).toBeVisible();
  await page.locator("#f-length").fill("-10");
  await expect(page.locator("#calc-error")).toBeVisible();
  await page.getByRole("button",{name:/Reset dimensions/}).click();
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(last).toContainText("163.5 in");
});

test("inch to millimeter toggle preserves physical lengths",async({page})=>{
  await page.goto("/stud-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(3657.6,1);
  const last=page.locator("#result-cards .metric").filter({hasText:"Last cut length"});
  await expect(last).toContainText("4,152.9 mm");
  await page.locator("#unit-select").selectOption("in");
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(144,4);
});

test("zoom adjusts SVG only, preserving the drawing container size",async({page})=>{
  await page.goto("/stud-calculator/");
  const container=page.locator("#dimension-svg"),svg=container.locator("svg");
  const before=await container.boundingBox();
  await page.locator("#zoom-in").click();
  await expect(svg).toHaveCSS("width",/\d+(\.\d+)?px/);
  const after=await container.boundingBox();
  expect(after.width).toBeCloseTo(before.width,1);
  await page.locator("#zoom-reset").click();
  expect(await svg.evaluate(el=>el.style.width)).toBe("100%");
});

test("CSV and SVG controls produce local downloadable files",async({page})=>{
  await page.goto("/deck-board-calculator/");
  const csvEvent=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=await csvEvent;
  expect(csv.suggestedFilename()).toMatch(/deck-board-calculator-in-cut-list\.csv$/);
  const svgEvent=page.waitForEvent("download");
  await page.locator("#download-svg").click();
  const svg=await svgEvent;
  expect(svg.suggestedFilename()).toMatch(/deck-board-calculator-in-diagram\.svg$/);
});

for(const width of [360,390,768,1024,1440]){
  test("no page-level horizontal overflow at "+width+" px",async({page})=>{
    await page.setViewportSize({width,height:850});
    for(const url of ["/","/stud-calculator/"]){
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,offenders:[...document.querySelectorAll("body *")].map(el=>({tag:el.tagName,id:el.id,cls:typeof el.className==="string"?el.className.slice(0,70):"",right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)})).filter(el=>el.right>innerWidth+3).slice(0,8)}));
      expect(dims.scroll,url+" "+JSON.stringify(dims.offenders)).toBeLessThanOrEqual(dims.client+2);
    }
  });
}
