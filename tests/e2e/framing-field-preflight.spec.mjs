import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const download=async(page,selector)=>{
  const pending=page.waitForEvent("download");
  await page.locator(selector).click();
  return readFileSync(await(await pending).path(),"utf8");
};

test("Manual source dimensional preflight uses explicit inputs, never autocertifies lumber or changes purchase",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const panel=page.locator("#framing-field-preflight");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-framing-field-csv")).toBeDisabled();
  await page.locator("#framing-stock-options summary").click();
  await page.locator("#f-studUnitPrice").fill("8");
  await page.locator("#f-headerUnitPrice").fill("12");
  const original=await download(page,"#download-stock-csv");
  const oldQuote=await download(page,"#download-price-csv");
  await page.locator("#f-stockAuditMode").selectOption("2");
  await page.locator("#f-stockAuditReuseMin").fill("2");
  await expect(panel).toBeVisible();
  const sticks=panel.locator("[data-measured-stock]");
  const count=await sticks.count();
  expect(count).toBeGreaterThan(2);
  for(let i=0;i<count;i++)await expect(sticks.nth(i)).toBeEmpty();
  await expect(page.locator("#framing-field-status")).toContainText("0/"+count);
  await expect(page.locator("#framing-field-status")).toContainText("pending");
  expect(await download(page,"#download-framing-field-csv")).toContain('"PENDING INPUT"');
  for(const [key,value] of [
    ["sawKerf","0.125"],["endTrim","0"],["finalSeverKerf","0"]
  ])await page.locator('[data-measured-global="'+key+'"]').fill(value);
  await expect(page.locator("#framing-field-status")).toContainText(count+" pending");
  for(let i=0;i<count;i++)await sticks.nth(i).fill("120");
  await expect(page.locator("#framing-field-status")).toContainText("DIMENSION-ONLY FIT");
  await expect(page.locator("#framing-field-status")).toContainText("NOT field-certified");
  const fit=await download(page,"#download-framing-field-csv");
  expect(fit).toContain('"Entered Length (in)"');
  expect(fit).toContain('"Required Length (in)"');
  expect(fit).toContain('"DIMENSION FIT ONLY"');
  expect(fit).toContain('"DIMENSIONS ONLY — NOT FIELD CERTIFIED"');
  expect(fit).not.toContain('"SHORT — REPLAN"');
  const sourceId=await sticks.first().getAttribute("data-measured-stock");
  await sticks.first().fill("1");
  await expect(page.locator("#framing-field-status")).toContainText("1 SHORT — REPLAN");
  const short=await download(page,"#download-framing-field-csv");
  expect(short).toContain('"SHORT — REPLAN"');
  expect(short).toContain('"'+sourceId+'"');
  // Re-entering a valid physical length only changes the manual review,
  // never the original cutting plan or supplier quote.
  await sticks.first().fill("120");
  expect(await download(page,"#download-stock-csv")).toBe(original);
  expect(await download(page,"#download-price-csv")).toBe(oldQuote);
  await page.locator("#unit-select").selectOption("mm");
  await expect(sticks.first()).toHaveValue("3048");
  await expect(page.locator('[data-measured-global="sawKerf"]')).toHaveValue("3.175");
  const metric=await download(page,"#download-framing-field-csv");
  expect(metric).toContain('"Entered Length (mm)"');
  expect(metric).toContain('"Entered Blade Kerf (mm)"');
  expect(metric).toContain('"DIMENSION FIT ONLY"');
  await page.evaluate(()=>dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({media:"print"});
  await expect(page.locator("#framing-field-table")).toBeVisible();
  await expect(page.locator("#framing-field-table .field-print-value").first()).toContainText("3,048 mm");
  const file=await page.pdf({format:"Letter",printBackground:true});
  expect(file.subarray(0,5).toString()).toBe("%PDF-");
  expect(file.length).toBeGreaterThan(10000);
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>dispatchEvent(new Event("afterprint")));
  await page.locator("#unit-select").selectOption("in");
  await expect(sticks.first()).toHaveValue("120");

  // A changed alternative layout must discard the old manual readings.
  await page.locator("#f-stockAuditEndTrim").fill("1");
  await expect(panel).toBeVisible();
  await expect(page.locator("#framing-field-status")).toContainText("0/"+count);
  await expect(sticks.first()).toBeEmpty();

  await page.locator("#f-stockAuditEndTrim").fill("90");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-framing-field-csv")).toBeDisabled();
  await page.locator("#f-stockAuditEndTrim").fill("0");
  await expect(panel).toBeVisible();
  await expect(sticks.first()).toBeEmpty();
  await page.locator("#f-stockAuditMode").selectOption("0");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-framing-field-csv")).toBeDisabled();
  expect(await download(page,"#download-stock-csv")).toBe(original);
  expect(await download(page,"#download-price-csv")).toBe(oldQuote);
});
