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
  await page.emulateMedia({media:"print"});
  await expect(printed).toBeVisible();
  await expect(page.locator("#cut-table").locator("xpath=..")).toBeHidden();
  await expect(page.locator("#print-calibration")).toBeVisible();
  for(const part of await parts.all()){
    await expect(part.locator("tbody tr")).toHaveCount(360);
    expect(await part.locator("thead th").count()).toBeLessThanOrEqual(4);
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
