import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const metric=(page,label)=>page.locator("#result-cards .metric").filter({hasText:label});

test("existing deck estimator opt-in equalized joist mode aligns metrics, SVG stations, CSV and back",async({page})=>{
  await page.goto("/deck-material-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#f-joistLayoutMode")).toHaveValue("0");
  await page.locator("#f-length").fill("140");
  const line=page.locator("#dimension-svg svg .deck-plan-joist");
  await expect(line).toHaveCount(10);
  await expect(line.nth(1).locator("title")).toContainText("16");
  await expect(metric(page,"Equalized joist bays")).toHaveCount(0);

  await page.locator("#f-joistLayoutMode").selectOption("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(line).toHaveCount(10);
  await expect(metric(page,"Equalized joist bays")).toContainText("9");
  await expect(metric(page,"Actual equalized joist OC")).toBeVisible();
  await expect(line.nth(1).locator("title")).toContainText("15.5");
  const texts=await line.locator("title").allTextContents();
  expect(texts).toHaveLength(10);
  expect(texts[0]).toMatch(/at 0\b/);
  expect(texts.at(-1)).toMatch(/140/);
  expect(texts.slice(1,9).some(x=>/\bat 16\b/.test(x))).toBe(false);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(32);

  const csvPromise=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await csvPromise).path(),"utf8");
  expect(csv).toContain('"Joist Center (in)"');
  expect(csv).toContain('"15.55555556"');
  expect(csv).not.toContain('"16"');

  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#calc-error")).toBeHidden();
  const metricPromise=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const mmCsv=readFileSync(await (await metricPromise).path(),"utf8");
  expect(mmCsv).toContain('"Joist Center (mm)"');
  expect(mmCsv).toContain('"395.111111"');

  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-joistLayoutMode").selectOption("0");
  await expect(metric(page,"Equalized joist bays")).toHaveCount(0);
  await expect(line.nth(1).locator("title")).toContainText("16");
});

test("equalized joist mode preserves error feedback without stale rows or drawing",async({page})=>{
  await page.goto("/deck-material-calculator/");
  await page.locator("#f-joistLayoutMode").selectOption("1");
  await page.locator("#f-length").fill("140");
  await page.locator("#f-joists").fill("0.0001");
  await expect(page.locator("#calc-error")).toContainText("Too many equalized joist bays");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await expect(page.locator("#dimension-svg svg .deck-plan-joist")).toHaveCount(0);
  await page.locator("#f-joists").fill("16");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#dimension-svg svg .deck-plan-joist")).toHaveCount(10);
});
