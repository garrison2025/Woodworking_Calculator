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

test("Stringer 2D stock envelope and X-projection warnings survive Firefox/WebKit units",async({page})=>{
  await page.goto("/stair-stringer-calculator/");
  const blank=page.locator("#dimension-svg svg .stringer-blank-reference");
  await expect(blank).toHaveCount(1);
  await page.locator("#f-lowerEndCutRun").fill("3");
  await page.locator("#f-upperEndCutRun").fill("6");
  await page.locator("#f-lowerSupportRun").fill("5");
  await page.locator("#f-upperSupportRun").fill("4");
  await page.locator("#f-measuredBlankLength").fill("200");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(blank).toHaveAttribute("data-stock-fits","true");
  await expect(page.locator("#dimension-svg svg .stringer-support-projection-warning")).toHaveCount(1);
  await expect(page.locator("#stringer-blank-table tbody tr")).toHaveCount(4);
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#stringer-end-projection-table")).toContainText("50.8 mm");
  await page.locator("#f-measuredBlankLength").fill("2500");
  await expect(blank).toHaveAttribute("data-stock-fits","false");
});

test("Stringer 2D cut/support contact does not treat an X projection as rated bearing",async({page})=>{
  await page.goto("/stair-stringer-calculator/");
  await page.locator("#f-lowerEndCutRun").fill("3");
  await page.locator("#f-upperEndCutRun").fill("6");
  await page.locator("#f-lowerSupportRun").fill("5");
  await page.locator("#f-upperSupportRun").fill("4");
  const contact=page.locator("#dimension-svg svg .stringer-end-support-point");
  await expect(contact).toHaveCount(2);
  await expect(page.locator("#stringer-end-contact-table")).toContainText("Shared corner only");
  await page.locator("#f-upperSupportVerticalOffset").fill("-4.78125");
  await expect(contact.last()).toHaveAttribute("data-x","133");
  await expect(page.locator("#stringer-end-contact-table")).toContainText("Single point only");
  await page.locator("#f-upperSupportVerticalOffset").fill("-8");
  await expect(page.locator("#dimension-svg svg .stringer-end-support-noncontact")).toHaveCount(1);
  await expect(page.locator("#stringer-end-contact-table")).toContainText("No 2D intersection");
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#stringer-end-contact-table")).toContainText("0 mm");
});

test("Long schedule native print event expands all cuts and restores browsing page in other engines",async({page})=>{
  await page.goto("/segmented-bowl-calculator/");
  await page.locator("#f-segments").fill("180");
  await page.locator("#f-rings").fill("2");
  await expect(page.locator("#calc-error")).toBeHidden();
  const rows=page.locator("#cut-table tbody tr");
  await page.locator("#schedule-next").click();
  await expect(rows).toHaveCount(160);
  await expect(rows.first()).toContainText("Ring 1 / segment 161");
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await expect(rows).toHaveCount(360);
  await expect(rows.last()).toContainText("Ring 2 / segment 180");
  await expect(page.locator("#schedule-pager")).toBeHidden();
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
  await expect(rows).toHaveCount(160);
  await expect(rows.first()).toContainText("Ring 1 / segment 161");
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 2 of 3");
});

test("Printed rafter measurement snapshot preserves pitch ratio, exact typed units and field values",async({page})=>{
  await page.goto("/rafter-calculator/");
  const panel=page.locator("#print-input-snapshot");
  await expect(panel).toBeHidden();
  await expect(page.locator("#print-input-table tbody tr")).toHaveCount(6);
  await expect(page.locator('[data-print-field="pitch"] td')).toHaveText("6 rise per 12 run");
  await page.locator("#unit-select").selectOption("mm");
  await page.emulateMedia({media:"print"});
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-print-field="run"] td')).toHaveText("3048 mm");
  await expect(page.locator('[data-print-field="pitch"] td')).toHaveText("6 rise per 12 run");
  await page.emulateMedia({media:"screen"});
  await expect(panel).toBeHidden();
});

test("Keyboard can focus and PageDown through large measurement tables in Firefox and WebKit",async({page})=>{
  await page.goto("/segmented-bowl-calculator/");
  await page.locator("#f-segments").fill("180");
  await page.locator("#f-rings").fill("2");
  const region=page.locator("#cut-table").locator("xpath=..");
  await expect(region).toHaveAttribute("tabindex","0");
  await expect(region).toHaveAttribute("role","region");
  await expect(region).toHaveAttribute("aria-label",/Calculated cut and measurement schedule/);
  await region.focus();
  await page.keyboard.press("PageDown");
  await expect.poll(()=>region.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await page.goto("/rafter-calculator/");
  const baseWidth=await page.locator("#dimension-svg svg").evaluate(el=>el.getBoundingClientRect().width);
  await page.locator("#zoom-in").click();
  await page.locator("#zoom-in").click();
  await expect.poll(()=>page.locator("#dimension-svg svg").evaluate(el=>el.getBoundingClientRect().width))
    .toBeGreaterThan(baseWidth*1.3);
  await expect(page.locator("#dimension-svg")).toHaveAttribute("tabindex","0");
  await expect(page.locator("#action-status")).toContainText("Updated:");
});

test("Firefox and WebKit 390px wide cutting tables give keyboard-accessible column controls",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/stair-stringer-calculator/");
  const region=page.locator("#cut-table").locator("xpath=..");
  const toolbar=region.locator("xpath=preceding-sibling::*[1]");
  await expect(toolbar).toHaveClass(/table-navigator/);
  await expect(toolbar.locator(".table-nav-prev")).toBeDisabled();
  await toolbar.locator(".table-nav-next").click();
  await expect.poll(()=>region.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
  await expect(toolbar.locator(".table-nav-prev")).toBeEnabled();
  await toolbar.locator(".table-nav-prev").click();
  await expect(toolbar.locator(".table-nav-prev")).toBeDisabled();
  await page.emulateMedia({media:"print"});
  await expect(toolbar).toBeHidden();
  await page.emulateMedia({media:"screen"});
  await expect(toolbar).toBeVisible();
});


test("wall stud maximum OC survives cross-engine layout switching",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/wall-stud-calculator/");
  await expect(page.locator("#calculator-startup")).toBeHidden();
  await page.locator("#f-length").fill("161");
  await page.locator("#f-spacingMode").selectOption("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#dimension-svg .wall-cut-stud")).toHaveCount(12);
  await expect(page.getByText("Equalized maximum-OC layout.",{exact:true})).toBeVisible();
  await page.locator("#f-spacingMode").selectOption("0");
  await expect(page.getByText("Final bay exceeds nominal spacing.",{exact:true})).toBeVisible();
  await expect(page.locator("#dimension-svg .wall-cut-stud")).toHaveCount(11);
});
