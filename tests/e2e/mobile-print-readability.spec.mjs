import { test, expect } from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";

test("320px forms remain single column and legible without horizontal overflow",async({page})=>{
  await page.setViewportSize({width:320,height:740});
  for(const slug of ["stud-calculator","framing-calculator","rafter-calculator",
    "deck-material-calculator","stair-stringer-calculator","shelf-spacing-calculator"]){
    await page.goto("/"+slug+"/");
    await expect(page.locator("#calc-error"),slug).toBeHidden();
    if(slug==="stud-calculator"){
      mkdirSync("visual-evidence",{recursive:true});
      await page.screenshot({path:"visual-evidence/stud-320-mobile-form.png",fullPage:true});
    }
    await expect(page.locator("#result-cards .metric").first(),slug).toBeVisible();
    const measurements=await page.evaluate(()=>{
      const fields=[...document.querySelectorAll("#calculator-form > .field")];
      const first=fields[0].getBoundingClientRect(),second=fields[1].getBoundingClientRect();
      const input=fields[0].querySelector("input,select");
      const rect=input.getBoundingClientRect();
      return {overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
        stacked:second.top>=first.bottom-1&&Math.abs(second.left-first.left)<1,
        width:rect.width,height:rect.height,right:rect.right,
        font:parseFloat(getComputedStyle(input).fontSize)};
    });
    expect(measurements.overflow,slug+" overflow").toBeLessThanOrEqual(1);
    expect(measurements.stacked,slug+" single column").toBe(true);
    expect(measurements.width,slug+" editable width").toBeGreaterThan(200);
    expect(measurements.right,slug+" viewport").toBeLessThanOrEqual(320);
    expect(measurements.height,slug+" tap height").toBeGreaterThanOrEqual(44);
    expect(measurements.font,slug+" iOS focus font").toBeGreaterThanOrEqual(16);
  }
});

test("390px mobile input editing and unit switching",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/stud-calculator/");
  mkdirSync("visual-evidence",{recursive:true});
  await page.screenshot({path:"visual-evidence/stud-390-mobile-form.png",fullPage:true});
  await page.locator("#unit-select").selectOption("mm");
  await page.locator("#f-length").fill("3000");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
  expect(await page.locator("#f-length").evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(250);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test("full print schedule splits wide columns into readable labelled groups",async({page})=>{
  await page.goto("/segmented-bowl-calculator/");
  await page.locator("#f-segments").fill("180");
  await page.locator("#f-rings").fill("2");
  await expect(page.locator("#calc-error")).toBeHidden();
  expect(await page.locator("#cut-table thead th").count()).toBeGreaterThan(5);
  await page.locator("#schedule-next").click();
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 2 of 3");
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  const printed=page.locator("#print-schedule-readable"),parts=printed.locator(".print-schedule-part");
  expect(await parts.count()).toBeGreaterThanOrEqual(2);
  expect(await parts.count()).toBeLessThanOrEqual(5);
  await page.emulateMedia({media:"print"});
  await expect(printed).toBeVisible();
  await expect(page.locator("#cut-table").locator("xpath=..")).toBeHidden();
  await expect(page.locator("#print-calibration")).toBeVisible();
  await expect(page.locator(".proof #print-assumptions")).toBeVisible();
  await expect(page.locator(".proof>.caution")).toBeHidden();
  await expect(page.locator(".calibration-warning")).toContainText("structural capacity");
  await expect(page.locator(".proof .print-only-heading")).toBeVisible();
  await expect(page.locator(".proof > .formula")).toBeHidden();
  expect(await parts.first().evaluate(e=>getComputedStyle(e).breakInside)).toBe("auto");
  for(const part of await parts.all()){
    await expect(part.locator("tbody tr")).toHaveCount(360);
    expect(await part.locator("thead th").count()).toBeLessThanOrEqual(5);
    expect(await part.locator("thead th").count()).toBeGreaterThanOrEqual(2);
    expect(await part.locator("table").evaluate(e=>parseFloat(getComputedStyle(e).fontSize)))
      .toBeGreaterThanOrEqual(12);
  }
  await expect(parts.first().locator("tbody tr").last()).toContainText("Ring 2");
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
  await expect(printed).toBeHidden();
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(160);
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 2 of 3");
});

test("grouped measurement worksheet exports genuine A4 and Letter PDF examples",async({page})=>{
  await page.goto("/segmented-bowl-calculator/");
  await page.locator("#f-segments").fill("12");
  await page.locator("#f-rings").fill("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({media:"print"});
  await expect(page.locator("#print-schedule-readable")).toBeVisible();
  await expect(page.locator("#print-calibration")).toBeVisible();
  mkdirSync("print-evidence",{recursive:true});
  for(const paper of ["A4","Letter"]){
    const pdf=await page.pdf({format:paper,printBackground:true,
      preferCSSPageSize:false,scale:1,
      margin:{top:"15mm",right:"15mm",bottom:"15mm",left:"15mm"}});
    expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
    // Chromium emits a page dictionary per real PDF page; this catches
    // reintroduced orphan pages and oversized groups in both paper formats.
    const pageCount=(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)||[]).length;
    expect(pageCount,paper+" worksheet pages").toBeLessThanOrEqual(paper==="A4"?5:6);
    writeFileSync("print-evidence/segmented-bowl-"+paper.toLowerCase()+"-readable.pdf",pdf);
  }
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("#print-schedule-readable")).toBeHidden();
});

test.describe("320px touch and keyboard-height simulation",()=>{
  test.use({viewport:{width:320,height:640},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  test("focused editable measurements survive a reduced visible viewport",async({page})=>{
    await page.goto("/stud-calculator/");
    await page.setViewportSize({width:320,height:390}); // Approximate soft keyboard occlusion.
    const field=page.locator("#f-length");
    await field.tap();
    await field.fill("120");
    await expect(field).toHaveValue("120");
    await expect(page.locator("#calc-error")).toBeHidden();
    const coords=await field.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,height:innerHeight,
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
        active:document.activeElement===el};
    });
    expect(coords.active).toBe(true);
    expect(coords.top).toBeGreaterThanOrEqual(-1);
    expect(coords.bottom).toBeLessThanOrEqual(coords.height+1);
    expect(coords.overflow).toBeLessThanOrEqual(1);
  });
});


test.describe("320px diagram zoom and local file-picking accessibility",()=>{
  test.use({viewport:{width:320,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true});

  test("finger-size zoom controls and readable local JSON chooser fit narrow screens",async({page})=>{
    await page.goto("/stud-calculator/");
    const zoom=page.locator(".zoom-controls");
    await expect(zoom).toHaveAttribute("role","group");
    await expect(zoom).toHaveAttribute("aria-label","Diagram zoom controls");
    for(const id of ["#zoom-out","#zoom-reset","#zoom-in"]){
      const button=page.locator(id);
      await expect(button).toHaveAttribute("aria-controls","dimension-svg");
      const box=await button.boundingBox();
      expect(box.width,id+" width").toBeGreaterThanOrEqual(44);
      expect(box.height,id+" height").toBeGreaterThanOrEqual(44);
      const bounds=await button.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right}});
      expect(bounds.left,id+" left edge").toBeGreaterThanOrEqual(-1);
      expect(bounds.right,id+" right edge").toBeLessThanOrEqual(321);
    }
    const chooser=page.locator("#load-measurements-json");
    const read=await chooser.evaluate(el=>({
      font:parseFloat(getComputedStyle(el).fontSize),
      height:el.getBoundingClientRect().height
    }));
    expect(read.font,"avoid iOS file-picker focus zoom").toBeGreaterThanOrEqual(16);
    expect(read.height,"file picker tap area").toBeGreaterThanOrEqual(52);
    expect(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,
      document.body.scrollWidth)-innerWidth)).toBeLessThanOrEqual(1);
  });

  test("zoom percentage stays accurate through touch, keyboard, redraw and limits",async({page})=>{
    await page.goto("/stud-calculator/");
    const plus=page.locator("#zoom-in"),minus=page.locator("#zoom-out");
    const reset=page.locator("#zoom-reset"),svg=page.locator("#dimension-svg svg");
    await expect(reset).toHaveText("100%");
    await plus.tap();
    await expect(reset).toHaveText("120%");
    await expect(reset).toHaveAttribute("aria-label",
      "Reset diagram zoom to 100% (current 120%)");
    expect(await svg.evaluate(el=>el.style.width)).toBe("120%");
    await page.locator("#f-length").fill("125");
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(reset).toHaveText("120%");
    expect(await svg.evaluate(el=>el.style.width)).toBe("120%");
    await reset.focus();
    await page.keyboard.press("Space");
    await expect(reset).toHaveText("100%");
    expect(await svg.evaluate(el=>el.style.width)).toBe("100%");
    await minus.tap();await minus.tap();
    await expect(reset).toHaveText("60%");
    await expect(minus).toBeDisabled();
    for(let i=0;i<10;i++)if(await plus.isEnabled())await plus.tap();
    await expect(reset).toHaveText("250%");
    await expect(plus).toBeDisabled();
    expect(await svg.evaluate(el=>el.style.width)).toBe("250%");
    expect(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,
      document.body.scrollWidth)-innerWidth)).toBeLessThanOrEqual(1);
    await reset.tap();
    await expect(reset).toHaveText("100%");
    await expect(minus).toBeEnabled();
    await expect(plus).toBeEnabled();
  });
});
