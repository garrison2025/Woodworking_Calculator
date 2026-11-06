import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const download=async(page,id)=>{
  const pending=page.waitForEvent("download");
  await page.locator(id).click();
  return readFileSync(await(await pending).path(),"utf8");
};

test("Purchase gate only records human declarations; cost/stock changes revoke previously complete review",async({page})=>{
  test.setTimeout(150000);
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const panel=page.locator("#framing-purchase-review");
  const state=page.locator("#framing-purchase-review-status");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-framing-purchase-review-csv")).toBeDisabled();
  await page.locator("#framing-stock-options summary").click();
  for(const [key,value] of [
    ["studUnitPrice","8"],["headerUnitPrice","12"],["sillUnitPrice","12"]
  ])await page.locator("#f-"+key).fill(value);
  const baseline=await download(page,"#download-stock-csv");
  const originalCost=await download(page,"#download-price-csv");
  await page.locator("#f-stockAuditMode").selectOption("2");
  await page.locator("#f-stockAuditReuseMin").fill("2");
  await expect(panel).toBeVisible();
  await expect(state).toContainText("HOLD — DIMENSION");
  await expect(state).toContainText("No order authorization");
  const pending=await download(page,"#download-framing-purchase-review-csv");
  expect(pending).toContain('"HOLD — DIMENSION INPUT OR STOCK SHORTFALL"');
  expect(pending).toContain('"false"');
  const sticks=page.locator("#framing-field-preflight [data-measured-stock]");
  const count=await sticks.count();
  expect(count).toBeGreaterThan(2);
  for(const [key,value] of [["sawKerf","0.125"],
    ["endTrim","0"],["finalSeverKerf","0"]])
    await page.locator('[data-measured-global="'+key+'"]').fill(value);
  for(let i=0;i<count;i++)await sticks.nth(i).fill("120");
  await expect(state).toContainText("HOLD — STOCK INSPECTION");
  const perSource=page.locator('[data-review-source-input]');
  await expect(perSource).toHaveCount(count*2);
  // Both source inspection declarations must be explicitly checked for
  // every current source, not just for the first piece of each profile.
  for(let i=0;i<count*2;i++)await perSource.nth(i).check();
  await expect(state).toContainText("HOLD — PURCHASE AND SAFETY");
  const global=panel.locator("[data-review-global]");
  await expect(global).toHaveCount(4);
  for(let i=0;i<4;i++)await global.nth(i).check();
  await expect(state).toContainText("SELF-DECLARED REVIEW COMPLETE");
  await expect(state).toContainText("HUMAN AUTHORIZATION REQUIRED");
  await expect(state).toContainText("No order authorization is issued");
  const reviewed=await download(page,"#download-framing-purchase-review-csv");
  expect(reviewed).toContain('"Profile Grade Reviewed"');
  expect(reviewed).toContain('"Defects Reviewed"');
  expect(reviewed).toContain('"Human Approval Required"');
  expect(reviewed).toContain('"Automatic Purchase Authorized"');
  expect(reviewed).toContain('"SELF-DECLARED REVIEW COMPLETE — HUMAN AUTHORIZATION REQUIRED"');
  expect(reviewed).toContain('"USER DECLARATIONS ONLY"');
  expect(reviewed).toContain('"USD"');
  // All positive signoffs remain declarations only; no order endpoint or
  // payment action is triggered by this client-side validation.
  expect(reviewed).toContain('"false"');
  expect(await download(page,"#download-stock-csv")).toBe(baseline);
  expect(await download(page,"#download-price-csv")).toBe(originalCost);

  await page.evaluate(()=>dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({media:"print"});
  await expect(panel).toBeVisible();
  await expect(panel.locator(".review-print-value").first()).toContainText("USER DECLARED");
  const pdf=await page.pdf({format:"Letter",printBackground:true});
  expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(10000);
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>dispatchEvent(new Event("afterprint")));

  // A price change invalidates the supplier and full-cost confirmations,
  // even when the member allocations and actual source measurements match.
  await page.locator("#f-studUnitPrice").fill("9");
  await expect(state).toContainText("HOLD — PURCHASE AND SAFETY");
  await expect(panel.locator('[data-review-global="supplierVerified"]')).not.toBeChecked();
  await expect(panel.locator('[data-review-global="totalCostReviewed"]')).not.toBeChecked();
  await expect(panel.locator('[data-review-global="sawSafetyReviewed"]')).toBeChecked();
  await panel.locator('[data-review-global="supplierVerified"]').check();
  await panel.locator('[data-review-global="totalCostReviewed"]').check();
  await expect(state).toContainText("SELF-DECLARED REVIEW COMPLETE");

  // Edited physical data clears ALL old inspection declarations.
  await sticks.first().fill("1");
  await expect(state).toContainText("HOLD — DIMENSION");
  await expect(perSource.first()).not.toBeChecked();
  await expect(global.first()).not.toBeChecked();
  const short=await download(page,"#download-framing-purchase-review-csv");
  expect(short).toContain('"SHORT — REPLAN"');
  await sticks.first().fill("120");
  await expect(state).toContainText("HOLD — STOCK INSPECTION");
  await page.locator("#f-stockAuditEndTrim").fill("90");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-framing-purchase-review-csv")).toBeDisabled();
  await page.locator("#f-stockAuditEndTrim").fill("0");
  await expect(panel).toBeVisible();
  await expect(state).toContainText("HOLD — DIMENSION");
  await page.locator("#f-stockAuditMode").selectOption("0");
  await expect(panel).toBeHidden();
  await expect(page.locator("#download-framing-purchase-review-csv")).toBeDisabled();
});
