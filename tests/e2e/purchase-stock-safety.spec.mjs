import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

test("framing rejects overlength stud stock, clears stale rows and recovers on a longer quote",async({page})=>{
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#f-wallHeight").fill("100.500000008");
  await expect(page.locator("#calc-error")).toContainText("longer stock required");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await expect(page.locator("#download-stock-csv")).toBeDisabled();
  await expect(page.locator("#download-price-csv")).toBeDisabled();
  await expect(page.locator("#download-csv")).toBeDisabled();
  await expect(page.locator("#print-sheet")).toBeDisabled();

  await page.locator("#f-studStockLength").fill("120");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#cut-table tbody tr").first()).toBeVisible();
  await expect(page.locator("#download-stock-csv")).toBeEnabled();
  await expect(page.locator("#download-price-csv")).toBeEnabled();
  await expect(page.locator("#print-sheet")).toBeEnabled();
  const dl=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Stock Length (in)"');
  expect(csv).toContain('"120"');
  expect(csv).toContain('"96.00000001"');
});

test("deck full-width joist sourcing rejects a sub-quantum shortfall then restores priced order",async({page})=>{
  await page.goto("/deck-material-calculator/");
  await page.locator("#f-joistStockLength").fill("119.999999992");
  await expect(page.locator("#calc-error")).toContainText("cannot cover full deck width");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await expect(page.locator("#download-deck-budget-csv")).toBeDisabled();
  await expect(page.locator("#download-deck-fastener-csv")).toBeDisabled();
  await page.locator("#f-joistStockLength").fill("120");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#cut-table tbody tr").first()).toBeVisible();
  await expect(page.locator("#download-deck-budget-csv")).toBeEnabled();
  await expect(page.locator("#download-deck-fastener-csv")).toBeEnabled();
});

test("deck without an intermediate joist cannot claim a physically undersized stock piece",async({page})=>{
  await page.goto("/deck-material-calculator/");
  await page.locator("#f-length").fill("100.000000008");
  await page.locator("#f-stock").fill("100");
  await page.locator("#f-joists").fill("150");
  await expect(page.locator("#calc-error")).toContainText("intermediate joist center");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await page.locator("#f-stock").fill("100.00000001");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#cut-table tbody tr").first()).toBeVisible();
});
