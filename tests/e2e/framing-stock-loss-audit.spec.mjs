import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

test("Optional stock-loss mode audits shortages but never silently reprices or replaces the original cut order",async({page})=>{
  test.setTimeout(100000);
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-stock-audit")).toBeHidden();
  await expect(page.locator("#download-stock-audit-csv")).toBeDisabled();
  await page.locator("#framing-stock-options summary").click();
  await expect(page.locator("#f-stockAuditMode")).toBeVisible();
  await page.locator("#f-studUnitPrice").fill("8");
  await page.locator("#f-headerUnitPrice").fill("12");
  const oldCuts=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  const originalCsv=readFileSync(await(await oldCuts).path(),"utf8");
  const oldBuy=page.waitForEvent("download");
  await page.locator("#download-price-csv").click();
  const originalBuy=readFileSync(await(await oldBuy).path(),"utf8");
  const initialLabel=await page.locator("#framing-price-status").innerText();
  expect(initialLabel).toContain("Estimated quoted lumber purchase");

  await page.locator("#f-stockAuditMode").selectOption("1");
  await page.locator("#f-stockAuditEndTrim").fill("3");
  await page.locator("#f-stockAuditSeverKerf").fill("0.125");
  await page.locator("#f-stockAuditReuseMin").fill("2");
  await expect(page.locator("#calc-error")).toBeHidden();
  const panel=page.locator("#framing-stock-audit");
  await expect(panel).toBeVisible();
  await expect(page.locator("#framing-stock-audit-table tbody tr")).toHaveCount(11);
  await expect(page.locator("#framing-stock-audit-status")).toContainText("STOCK PLAN UNSAFE");
  await expect(page.locator("#framing-stock-audit-status")).toContainText("original sticks are too short");
  await expect(page.locator("#framing-price-status")).toContainText("BASE-MODEL");
  await expect(page.locator("#framing-price-status")).toContainText("NOT be used as a sufficient order");
  await expect(page.locator("#framing-optimizer-status")).toContainText("BASE-MODEL CERTIFICATE ONLY");

  const afterCuts=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  expect(readFileSync(await(await afterCuts).path(),"utf8")).toBe(originalCsv);
  const afterBuy=page.waitForEvent("download");
  await page.locator("#download-price-csv").click();
  expect(readFileSync(await(await afterBuy).path(),"utf8")).toBe(originalBuy);

  await expect(page.locator("#download-stock-audit-csv")).toBeEnabled();
  const diagnostics=page.waitForEvent("download");
  await page.locator("#download-stock-audit-csv").click();
  const diagnosticCsv=readFileSync(await(await diagnostics).path(),"utf8");
  expect(diagnosticCsv).toContain('"Adjusted Last Cut End (in)"');
  expect(diagnosticCsv).toContain('"Usable Offcut Length (in)"');
  expect(diagnosticCsv).toContain('"DOES NOT FIT"');
  expect(diagnosticCsv.split("\r\n").filter(Boolean)).toHaveLength(13);
  // Print snapshot of ACTIVE review includes the actual audit parameters.
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator("#print-input-table tr[data-print-field^='stockAudit']")).toHaveCount(4);
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));

  // Revert additional losses, but preserve a positive candidate threshold.
  await page.locator("#f-stockAuditEndTrim").fill("0");
  await expect(page.locator("#framing-stock-audit-status")).toContainText("CHECK PASSED");
  await expect(page.locator("#framing-stock-audit-status")).toContainText("candidate tail offcuts");
  await expect(page.locator("#framing-price-status")).not.toContainText("NOT be used as a sufficient order");

  // A sub-resolution positive trim is invalid, and must invalidate all exports.
  await page.locator("#f-stockAuditEndTrim").fill("0.000000001");
  await expect(page.locator("#calc-error")).toContainText("stockAuditEndTrim");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-stock-csv")).toBeDisabled();
  await expect(page.locator("#download-stock-audit-csv")).toBeDisabled();
  await page.locator("#f-stockAuditEndTrim").fill("0");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(panel).toBeVisible();

  await page.locator("#f-stockAuditMode").selectOption("0");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-stock-audit-csv")).toBeDisabled();
  await expect(page.locator("#framing-price-status")).toContainText("Estimated quoted lumber purchase");
  const againCuts=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  expect(readFileSync(await(await againCuts).path(),"utf8")).toBe(originalCsv);
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator("#print-input-table tr[data-print-field^='stockAudit']")).toHaveCount(0);
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
});
