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
  expect(csv).toMatch(/"Percentage grade","50","%"/);
  expect(csv).toContain('"Rise over reference run","1524","mm"');
  expect(csv).toContain('"Source note"');
});

test("quoted purchase allowance changes counts and cost but not physical deck layout",async({page})=>{
  await page.goto("/deck-material-calculator/");
  const waste=page.locator("#f-waste");
  const price=page.locator("#f-boardUnitPrice");
  await price.fill("8.75");
  await waste.fill("0");
  await expect(page.locator("#calc-error")).toBeHidden();
  const originalCuts=await page.locator("#cut-table tbody").innerText();
  const originalDiagram=await page.locator("#dimension-svg svg").getAttribute("viewBox");
  const originalPurchase=await page.locator("#deck-budget-table tbody").innerText();
  await waste.fill("25");
  await expect(page.locator("#calc-error")).toBeHidden();
  const afterCuts=await page.locator("#cut-table tbody").innerText();
  const afterDiagram=await page.locator("#dimension-svg svg").getAttribute("viewBox");
  const changedPurchase=await page.locator("#deck-budget-table tbody").innerText();
  expect(afterCuts).toBe(originalCuts);
  expect(afterDiagram).toBe(originalDiagram);
  expect(changedPurchase).not.toBe(originalPurchase);
  const dl=page.waitForEvent("download");
  await page.locator("#download-deck-budget-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Purchase Quantity"');
  expect(csv).toContain('"Purchase Cost"');
  expect(csv).not.toContain('"Purchase Quantity (in)"');
});
