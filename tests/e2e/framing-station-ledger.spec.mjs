import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const csv=async(page)=>{
  const pending=page.waitForEvent("download");
  await page.locator("#download-framing-stations-csv").click();
  const result=await pending;
  return readFileSync(await result.path(),"utf8");
};
test("Optional source stations account for all stock and persist in metric CSV / print",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-station-ledger")).toBeHidden();
  await expect(page.locator("#download-framing-stations-csv")).toBeDisabled();
  await page.locator("#framing-stock-options summary").click();
  await page.locator("#f-studUnitPrice").fill("8");
  await page.locator("#f-headerUnitPrice").fill("12");
  const baseCutPromise=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  const baseline=readFileSync(await(await baseCutPromise).path(),"utf8");

  await page.locator("#f-stockAuditMode").selectOption("2");
  await page.locator("#f-stockAuditReuseMin").fill("2");
  await page.locator("#f-stockAuditEndTrim").fill("1");
  await page.locator("#f-stockAuditSeverKerf").fill("0.125");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-station-ledger")).toBeVisible();
  const status=page.locator("#framing-station-status");
  await expect(status).toContainText("DIMENSIONAL CHECK ONLY");
  await expect(status).toContainText("No physical stock");
  const lines=page.locator("#framing-station-table tbody tr");
  expect(await lines.count()).toBeGreaterThan(14);
  const inch=await csv(page);
  expect(inch).toContain('"Station Start (in)"');
  expect(inch).toContain('"Station End (in)"');
  expect(inch).toContain('"Segment Length (in)"');
  expect(inch).toContain('"RETAINED MEMBER"');
  expect(inch).toContain('"LEADING END TRIM"');
  expect(inch).toContain('"TRAILING END TRIM"');
  expect(inch).toContain('"LAST SEPARATION KERF"');
  expect(inch).toContain('"NOT FIELD VERIFIED"');
  const linesCsv=inch.replace(/^\uFEFF/,"").split("\r\n").filter(Boolean);
  expect(linesCsv.length).toBe(await lines.count()+2);
  const headings=linesCsv[0].slice(1,-1).split('","');
  const mapped=linesCsv.slice(1,-1).map(v=>Object.fromEntries(
    v.slice(1,-1).split('","').map((cell,i)=>[headings[i],cell])));
  const byStock=new Map();
  for(const row of mapped){
    const id=row["Stock Id"];
    const start=Number(row["Station Start (in)"]);
    const end=Number(row["Station End (in)"]);
    const length=Number(row["Segment Length (in)"]);
    const previous=byStock.get(id)??0;
    expect(Math.abs(start-previous),id+" gap").toBeLessThan(1e-6);
    expect(end-start).toBeCloseTo(length,6);
    expect(end).toBeGreaterThan(start);
    byStock.set(id,end);
    expect(row.Verification).toBe("NOT FIELD VERIFIED");
  }
  for(const row of mapped.filter(x=>x["Segment Kind"]==="TRAILING END TRIM")){
    expect(Number(row["Station End (in)"])).toBeCloseTo(
      Number(row["Stock Length (in)"]),6);
  }
  const oldStockPromise=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  expect(readFileSync(await(await oldStockPromise).path(),"utf8")).toBe(baseline);

  await page.locator("#unit-select").selectOption("mm");
  const mm=await csv(page);
  expect(mm).toContain('"Station Start (mm)"');
  expect(mm).toContain('"Station End (mm)"');
  expect(mm).toContain('"Segment Length (mm)"');
  const printed=page.locator('.print-specialty-groups[data-source="framing-station-table"]');
  await page.evaluate(()=>dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({media:"print"});
  await expect(printed.locator(".print-specialty-part")).toHaveCount(2);
  const printText=await printed.innerText();
  expect(printText).toContain("Station");
  expect(printText).toContain("Segment Kind");
  const pdf=await page.pdf({format:"Letter",printBackground:true});
  expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(10000);
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>dispatchEvent(new Event("afterprint")));
  await expect(printed).toHaveCount(0);

  // A non-fitting baseline must remove every alternative station and
  // prevent users from exporting a stale source dimension worksheet.
  await page.locator("#f-stockAuditEndTrim").fill("127");
  await expect(page.locator("#framing-reuse-status")).toContainText("NO SAFE COMPARISON");
  await expect(page.locator("#framing-station-ledger")).toBeHidden();
  await expect(page.locator("#download-framing-stations-csv")).toBeDisabled();
  await page.locator("#f-stockAuditEndTrim").fill("25.4");
  await expect(page.locator("#framing-station-ledger")).toBeVisible();
  await page.locator("#f-stockAuditMode").selectOption("0");
  await expect(page.locator("#framing-station-ledger")).toBeHidden();
  await expect(page.locator("#download-framing-stations-csv")).toBeDisabled();
});
