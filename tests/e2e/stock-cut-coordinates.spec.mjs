import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const q=x=>Math.round(x*1e8)/1e8;
const close=(a,b,label)=>expect(Math.abs(a-b),label+": "+a+" vs "+b).toBeLessThanOrEqual(1e-7);
function stockRows(csv){
  const lines=csv.replace(/^\uFEFF/,"").split("\r\n").filter(Boolean);
  const headers=lines[0].slice(1,-1).split('","');
  const values=lines.slice(1,-1).map(s=>s.slice(1,-1).split('","'));
  return {headers,rows:values.map(v=>Object.fromEntries(headers.map((key,i)=>[key,v[i]])))};
}
test("Framing stock-local start/end locations match every exported cut and printed sequence",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/framing-calculator/");
  await page.locator("#framing-stock-options summary").click();
  for(const [field,val] of [
    ["wallHeight","80"],["openingHeight","60"],["studUnitPrice","8"],
    ["studAltUnitPrice","8.2"],["studAlt2UnitPrice","8.5"],["headerUnitPrice","12"],
    ["stockKerf",".125"]
  ])await page.locator("#f-"+field).fill(val);
  await expect(page.locator("#calc-error")).toBeHidden();
  const stockTable=page.locator("#framing-stock-table tbody tr");
  await expect(stockTable).toHaveCount(9);
  const stockText=await page.locator("#framing-stock-table").innerText();
  expect(stockText).toMatch(/\[[0-9.,]+ in\s+[–-]\s+[0-9.,]+ in\]/);
  const download=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  const csv=stockRows(readFileSync(await(await download).path(),"utf8"));
  expect(csv.headers).toContain("Cut Start (in)");
  expect(csv.headers).toContain("Cut End (in)");
  expect(csv.headers).toContain("Kerf Before (in)");
  const latest=new Map();
  for(const row of csv.rows){
    const id=row["Stock Id"];
    const index=Number(row.Index),length=Number(row["Cut Length (in)"]);
    const start=Number(row["Cut Start (in)"]),end=Number(row["Cut End (in)"]);
    const kerf=Number(row["Kerf Before (in)"]);
    const source=Number(row["Stock Length (in)"]);
    const previous=latest.get(id)||0;
    close(start,q(previous+kerf),"kerf-separated stock-local start "+id);
    close(end,q(start+length),"stock-local cut end "+id);
    close(end-start,length,"stock-local physical segment "+id);
    close(end,Number(row["Running Used Length (in)"]),"stock used "+id);
    expect(start).toBeGreaterThanOrEqual(previous-1e-8);
    expect(end).toBeLessThanOrEqual(source+1e-12);
    expect(index===1?kerf===0:kerf===.125).toBe(true);
    latest.set(id,end);
  }
  expect(csv.rows.length).toBe(13);
  await page.locator("#unit-select").selectOption("mm");
  const downloadMM=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  const mm=stockRows(readFileSync(await(await downloadMM).path(),"utf8"));
  expect(mm.headers).toContain("Cut Start (mm)");
  expect(mm.headers).toContain("Cut End (mm)");
  expect(mm.rows.length).toBe(csv.rows.length);
  for(let i=0;i<mm.rows.length;i++){
    close(Number(mm.rows[i]["Cut Start (mm)"]),
      Number(csv.rows[i]["Cut Start (in)"])*25.4,
      "metric start conversion");
    close(Number(mm.rows[i]["Cut End (mm)"]),
      Number(csv.rows[i]["Cut End (in)"])*25.4,
      "metric end conversion");
  }
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({media:"print"});
  await expect(page.locator("#framing-stock-table")).toBeVisible();
  expect(await page.locator("#framing-stock-table").innerText()).toContain(" – ");
  await expect(page.locator("#print-calibration")).toBeVisible();
  const widths=await page.evaluate(()=>({
    mm:document.querySelector(".calibration-100mm").getBoundingClientRect().width,
    inch:document.querySelector(".calibration-1in").getBoundingClientRect().width
  }));
  expect(Math.abs(widths.mm-(100/25.4)*96)).toBeLessThan(1);
  expect(Math.abs(widths.inch-96)).toBeLessThan(.5);
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
  await page.locator("#f-studStockLength").fill("1");
  // Alternate quoted stock offers can still cover the wall; a clearly
  // invalid geometry instead must disable the stock CSV and clear the table.
  // The unit selector is still millimeters: 25400 mm is 1000 in.
  await page.locator("#f-wallHeight").fill("25400");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(stockTable).toHaveCount(0);
  await expect(page.locator("#download-stock-csv")).toBeDisabled();
  await page.locator("#f-wallHeight").fill("2032");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#download-stock-csv")).toBeEnabled();
});
