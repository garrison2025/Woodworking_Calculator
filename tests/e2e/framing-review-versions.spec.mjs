import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const downloaded=async(page,selector)=>{
  const future=page.waitForEvent("download");
  await page.locator(selector).click();
  return {download:await future};
};
const content=async(page,selector)=>{
  const {download}=await downloaded(page,selector);
  return readFileSync(await download.path(),"utf8");
};
const setup=async page=>{
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#framing-stock-options summary").click();
  for(const [key,value] of [["studUnitPrice","8"],
    ["headerUnitPrice","12"],["sillUnitPrice","12"]])
    await page.locator("#f-"+key).fill(value);
  await page.locator("#f-stockAuditMode").selectOption("2");
  await page.locator("#f-stockAuditReuseMin").fill("2");
  await expect(page.locator("#framing-review-versions")).toBeVisible();
};
const packetId=async(page)=>{
  const label=await page.locator("#framing-version-identifiers").innerText();
  const match=label.match(/PACKET (PACK-[0-9a-f]{16})/);
  expect(match).not.toBeNull();
  return match[1];
};

test("Local version IDs, snapshot JSON and imported comparison change with quotations, measurements and declarations",async({page})=>{
  test.setTimeout(160000);
  await setup(page);
  const panel=page.locator("#framing-review-versions");
  const idLabel=page.locator("#framing-version-identifiers");
  const state=page.locator("#framing-version-status");
  await expect(idLabel).toContainText("LAYOUT LAY-");
  await expect(idLabel).toContainText("MEASUREMENTS MEAS-");
  await expect(idLabel).toContainText("SUPPLIER QUOTE QUOTE-");
  await expect(idLabel).toContainText("SELF-DECLARATIONS DECL-");
  const originalCsv=await content(page,"#download-stock-csv");
  const originalQuote=await content(page,"#download-price-csv");
  const emptyId=await packetId(page);
  const emptyCsv=await content(page,"#download-framing-purchase-review-csv");
  expect(emptyCsv).toContain(emptyId);
  expect(emptyCsv).toContain('"Packet Version Id"');
  await expect(page.locator("#framing-version-diff-csv")).toBeDisabled();

  for(const [key,value] of [["sawKerf","0.125"],["endTrim","0"],
    ["finalSeverKerf","0"]])
    await page.locator('[data-measured-global="'+key+'"]').fill(value);
  const sticks=page.locator("#framing-field-preflight [data-measured-stock]");
  const n=await sticks.count();expect(n).toBeGreaterThan(2);
  for(let i=0;i<n;i++)await sticks.nth(i).fill("120");
  const checkSource=page.locator('[data-review-source-input]');
  for(let i=0;i<n*2;i++)await checkSource.nth(i).check();
  const checkGlobal=page.locator('#framing-purchase-review [data-review-global]');
  for(let i=0;i<4;i++)await checkGlobal.nth(i).check();
  await expect(page.locator("#framing-purchase-review-status")).toContainText(
    "SELF-DECLARED REVIEW COMPLETE");

  const completedId=await packetId(page);
  expect(completedId).not.toBe(emptyId);
  const snapshotText=await content(page,"#framing-version-json");
  const snapshot=JSON.parse(snapshotText);
  expect(snapshot.schema).toBe("framing-self-declared-review-v1");
  expect(snapshot.versionIds.packet).toBe(completedId);
  expect(snapshot.versionIds.layout).toMatch(/^LAY-[0-9a-f]{16}$/);
  expect(snapshot.versionIds.measurement).toMatch(/^MEAS-[0-9a-f]{16}$/);
  expect(snapshot.versionIds.quotation).toMatch(/^QUOTE-[0-9a-f]{16}$/);
  expect(snapshot.versionIds.declaration).toMatch(/^DECL-[0-9a-f]{16}$/);
  expect(snapshot.parts.declaration.automaticPurchaseAuthorized).toBe(false);
  expect(snapshot.parts.declaration.humanApprovalRequired).toBe(true);
  expect(snapshot.warning).toContain("No digital signature");
  const baseReviewCsv=await content(page,"#download-framing-purchase-review-csv");
  for(const v of Object.values(snapshot.versionIds))expect(baseReviewCsv).toContain(v);
  for(const exportId of ["#download-framing-field-csv",
    "#download-framing-stations-csv","#download-framing-reuse-csv",
    "#download-framing-reuse-quote-csv"]){
    const csv=await content(page,exportId);
    expect(csv).toContain(snapshot.versionIds.packet);
    expect(csv).toContain(snapshot.versionIds.quotation);
    expect(csv).toContain("NO PURCHASE APPROVAL");
  }
  await page.locator("#framing-version-pin").click();
  await expect(state).toContainText("SAME PACKET");
  await expect(page.locator("#framing-version-diff-csv")).toBeDisabled();

  await page.locator("#unit-select").selectOption("mm");
  await expect(idLabel).toContainText(completedId);
  await page.locator("#unit-select").selectOption("in");
  await expect(idLabel).toContainText(completedId);

  await page.locator("#f-studUnitPrice").fill("9");
  await expect(state).toContainText("CHANGED PACKET");
  await expect(state).toContainText("quotation");
  await expect(page.locator("#framing-version-diff-csv")).toBeEnabled();
  const changedId=await packetId(page);
  expect(changedId).not.toBe(completedId);
  const diffCsv=await content(page,"#framing-version-diff-csv");
  expect(diffCsv).toContain(completedId);
  expect(diffCsv).toContain(changedId);
  expect(diffCsv).toContain('"quotation"');
  expect(diffCsv).toContain('"declaration"');
  expect(diffCsv).toContain("supplierVerified");
  await expect(page.locator('[data-review-global="supplierVerified"]')).not.toBeChecked();

  // Import a real earlier JSON reference into the same browser after
  // reloading: no localStorage dependency, no network upload or server API.
  await page.reload();
  await setupAfterReload(page);
  const noReference=page.locator("#framing-version-status");
  await expect(noReference).toContainText("No comparison reference");
  await page.locator("#framing-version-import").setInputFiles({
    name:"earlier-framing-review.json",mimeType:"application/json",
    buffer:Buffer.from(snapshotText,"utf8")
  });
  await expect(noReference).toContainText("CHANGED PACKET");
  await expect(noReference).toContainText(completedId);
  await expect(page.locator("#framing-version-diff-csv")).toBeEnabled();

  // Imported references are content-checked, not trusted by filename.
  const tampered=JSON.parse(snapshotText);
  tampered.versionIds.quotation="QUOTE-0000000000000000";
  await page.locator("#framing-version-import").setInputFiles({
    name:"tampered.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(tampered),"utf8")
  });
  await expect(noReference).toContainText("IMPORT REJECTED");
  await expect(noReference).toContainText("mismatch");
  // Tampering must NOT replace the previous intact reference.
  const compared=await content(page,"#framing-version-diff-csv");
  expect(compared).toContain(completedId);
  expect(compared).not.toContain("QUOTE-0000000000000000");
  await expect(page.locator("#framing-purchase-review-status")).toContainText("HOLD");
  await page.locator("#f-stockAuditMode").selectOption("0");
  await expect(panel).toBeHidden();
  await expect(page.locator("#framing-version-json")).toBeDisabled();
  expect(await content(page,"#download-stock-csv")).toBe(originalCsv);
  expect(await content(page,"#download-price-csv")).toBe(originalQuote);
});

const setupAfterReload=async page=>{
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#framing-stock-options summary").click();
  for(const [key,value] of [["studUnitPrice","8"],
    ["headerUnitPrice","12"],["sillUnitPrice","12"]])
    await page.locator("#f-"+key).fill(value);
  await page.locator("#f-stockAuditMode").selectOption("2");
  await page.locator("#f-stockAuditReuseMin").fill("2");
  await expect(page.locator("#framing-review-versions")).toBeVisible();
};
