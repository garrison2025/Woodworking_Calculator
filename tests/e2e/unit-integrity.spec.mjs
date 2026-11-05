import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

test("tiny deck gap survives ft/m/mm/in switching and its CSV stays numeric",async({page})=>{
  await page.goto("/deck-board-calculator/");
  const field=page.locator("#f-gap");
  await field.fill("0.000002");
  await expect(page.locator("#calc-error")).toBeHidden();
  for(const next of ["ft","m","mm","in"]){
    await page.locator("#unit-select").selectOption(next);
    await expect(page.locator("#calc-error")).toBeHidden();
    const v=Number(await field.inputValue());
    expect(v).toBeGreaterThan(0);
  }
  expect(Number(await field.inputValue())).toBeCloseTo(0.000002,11);
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Item"');
  expect(csv).not.toContain("NaN");
});

test("metric-only calculator CSV is numeric with a separate physical-unit column",async({page})=>{
  await page.goto("/roof-pitch-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Measurement","Value","Unit"');
  expect(csv).toMatch(/"Roof angle","[0-9.]+","°"/);
  expect(csv).not.toContain('"26.565°"');
  expect(csv).toContain('"mm"');
  expect(csv).toContain('"rise per 12 run"');
  expect(csv).toContain('"Source note"');
});
