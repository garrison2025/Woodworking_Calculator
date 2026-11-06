import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const downloadCsv=async(page,button)=>{
  const pending=page.waitForEvent("download");
  await page.locator(button).click();
  return readFileSync(await(await pending).path(),"utf8");
};

test("Independent same-profile offcut alternative never changes original cutting CSV or buying ticket",async({page})=>{
  test.setTimeout(110000);
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const panel=page.locator("#framing-reuse-plan");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-framing-reuse-csv")).toBeDisabled();
  await page.locator("#framing-stock-options summary").click();
  await page.locator("#f-studUnitPrice").fill("8");
  await page.locator("#f-headerUnitPrice").fill("12");
  const baselineCuts=await downloadCsv(page,"#download-stock-csv");
  const baselineQuote=await downloadCsv(page,"#download-price-csv");
  const beforeTicket=await page.locator("#framing-ticket-list").innerText();

  await page.locator("#f-stockAuditMode").selectOption("2");
  await page.locator("#f-stockAuditReuseMin").fill("2");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(panel).toBeVisible();
  const candidateTable=page.locator("#framing-reuse-table tbody tr");
  await expect(candidateTable.first()).toBeVisible();
  await expect(page.locator("#framing-reuse-status")).toContainText(
    /NO LOWER PURCHASE FOUND|BOUNDED REASSIGNMENT/);
  await expect(page.locator("#download-framing-reuse-csv")).toBeEnabled();
  await expect(page.locator("#download-framing-reuse-quote-csv")).toBeEnabled();
  const altCuts=await downloadCsv(page,"#download-framing-reuse-csv");
  const altQuote=await downloadCsv(page,"#download-framing-reuse-quote-csv");
  expect(altCuts).toContain('"Original Stock Id"');
  expect(altCuts).toContain('"Cut Start (in)"');
  expect(altCuts).toContain('"Cut End (in)"');
  expect(altQuote).toContain('"Planned Sticks"');
  expect(altQuote).toContain('"Purchase Cost"');
  expect(altQuote).toContain('"USD"');
  expect(altCuts.split("\r\n").filter(Boolean).length).toBe(15);
  expect(await downloadCsv(page,"#download-stock-csv")).toBe(baselineCuts);
  expect(await downloadCsv(page,"#download-price-csv")).toBe(baselineQuote);
  expect(await page.locator("#framing-ticket-list").innerText()).toBe(beforeTicket);
  // Activated alternatives must be printable without dropping the wide
  // stock-origin/source-ID and recalculated quote columns.
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({media:"print"});
  await expect(page.locator('.print-specialty-groups[data-source="framing-reuse-table"] .print-specialty-part')).toHaveCount(2);
  await expect(page.locator('.print-specialty-groups[data-source="framing-reuse-purchase-table"] .print-specialty-part')).toHaveCount(2);
  const printText=await page.locator('.print-specialty-groups[data-source="framing-reuse-table"]').innerText();
  expect(printText).toContain("Original Stock");
  expect(printText).toContain("Alternative Stock");
  const pdf=await page.pdf({format:"Letter",printBackground:true});
  expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(10000);
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator('.print-specialty-groups[data-source="framing-reuse-table"]')).toHaveCount(0);

  // With extra trims the current plan can no longer be certified as enough.
  await page.locator("#f-stockAuditEndTrim").fill("5");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-stock-audit-status")).toContainText("STOCK PLAN UNSAFE");
  await expect(page.locator("#framing-reuse-status")).toContainText("NO SAFE COMPARISON");
  await expect(candidateTable).toHaveCount(0);
  await expect(page.locator("#download-framing-reuse-csv")).toBeDisabled();
  await expect(page.locator("#framing-price-status")).toContainText("NOT be used as a sufficient order");
  expect(await downloadCsv(page,"#download-stock-csv")).toBe(baselineCuts);

  await page.locator("#f-stockAuditEndTrim").fill("0");
  await expect(candidateTable.first()).toBeVisible();
  // Bad precision invalidates all results, including the optional alternative.
  await page.locator("#f-stockAuditReuseMin").fill("0.000000001");
  await expect(page.locator("#calc-error")).toContainText("stockAuditReuseMin");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-framing-reuse-csv")).toBeDisabled();
  await expect(page.locator("#download-stock-csv")).toBeDisabled();
  await page.locator("#f-stockAuditReuseMin").fill("2");
  await expect(page.locator("#calc-error")).toBeHidden();

  await page.locator("#f-stockAuditMode").selectOption("1");
  await expect(panel).toBeHidden();
  await expect(page.locator("#framing-stock-audit")).toBeVisible();
  await page.locator("#f-stockAuditMode").selectOption("0");
  await expect(panel).toBeHidden();
  await expect(page.locator("#framing-stock-audit")).toBeHidden();
  await expect(page.locator("#download-framing-reuse-quote-csv")).toBeDisabled();
  expect(await downloadCsv(page,"#download-stock-csv")).toBe(baselineCuts);
  expect(await downloadCsv(page,"#download-price-csv")).toBe(baselineQuote);
});
