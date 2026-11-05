import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

// Engine-level physical dimensions are cross-checked independently by Node;
// this small cross-engine suite catches browser-specific DOM/SVG/export
// regressions in Firefox and the Linux WebKit engine (not Safari on macOS).
test("Rafter measured seat & heel render and typed metric CSV exports",async({page})=>{
  await page.goto("/rafter-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#dimension-svg svg .rafter-heel-plumb-cut")).toHaveCount(1);
  await expect(page.locator("#dimension-svg svg .rafter-seat-reference")).toHaveCount(1);
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Start X (mm)");
  const received=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const data=readFileSync(await (await received).path(),"utf8");
  expect(data).toContain('"Birdsmouth horizontal seat"');
  expect(data).toContain('"Birdsmouth plumb heel"');
  await page.locator("#f-depth").fill("0.2");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#dimension-svg svg .rafter-heel-plumb-cut")).toHaveCount(0);
});
test("Deck user-entered joist stock quote and centered butt gap work in each engine",async({page})=>{
  await page.goto("/deck-material-calculator/");
  await page.locator("#f-stock").fill("100");
  await page.locator("#f-buttEndGap").fill("0.25");
  await page.locator("#f-joistFaceWidth").fill("3.5");
  await page.locator("#f-minEndBearing").fill("1.5");
  await expect(page.locator("#dimension-svg svg .deck-plan-butt-gap")).toHaveCount(22);
  await page.locator("#f-joistStockLength").fill("144");
  await expect(page.locator("#result-cards .metric")
    .filter({hasText:"Joist stock sticks with allowance"})).toContainText("11");
  await page.locator("#f-minEndBearing").fill("1.7");
  await expect(page.locator("#calc-error")).toBeVisible();
  await page.locator("#f-minEndBearing").fill("1.5");
  await expect(page.locator("#calc-error")).toBeHidden();
});
test("Core pages remain usable at phone width without horizontal overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const slug of ["rafter-calculator","stair-stringer-calculator","deck-material-calculator"]){
    await page.goto("/"+slug+"/");
    await expect(page.locator("#result-cards .metric").first()).toBeVisible();
    const overflow=await page.evaluate(()=>Math.max(
      document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    expect(overflow,slug+" horizontal overflow").toBeLessThanOrEqual(1);
  }
});
