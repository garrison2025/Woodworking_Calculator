import { test, expect } from "@playwright/test";

test("320px forms remain single column and legible without horizontal overflow",async({page})=>{
  await page.setViewportSize({width:320,height:740});
  for(const slug of ["stud-calculator","framing-calculator","rafter-calculator",
    "deck-material-calculator","stair-stringer-calculator","shelf-spacing-calculator"]){
    await page.goto("/"+slug+"/");
    await expect(page.locator("#calc-error"),slug).toBeHidden();
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
