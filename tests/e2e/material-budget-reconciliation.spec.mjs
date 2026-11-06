import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

// Quote arithmetic is deliberately recalculated from *exported CSV cells*
// instead of trusting the browser's metric or the calculator's subtotal.
const csvRows=body=>body.replace(/^\uFEFF/,"").split("\r\n").filter(Boolean)
  .map(line=>line.replace(/^"|"$/g,"").split('","'));
const priceCents=decimal=>Math.round(Number(decimal)*100);
const money=(cents,currency="USD")=>currency+" "+(cents/100).toLocaleString(
  "en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const textCells=async locator=>locator.evaluateAll(rows=>rows.map(row=>
  [...row.querySelectorAll("td")].map(cell=>cell.textContent.trim())));
const numeric=text=>Number(String(text).replace(/[^0-9.]/g,""));

test("Deck optional-joist purchase reconciles browser, CSV, print and 0/10/50/100% reserves",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/deck-material-calculator/");
  for(const [key,value] of [
    ["boardUnitPrice","8"],["fastenerPackPrice","20"],
    ["joistStockLength","144"],["joistUnitPrice","9"]
  ])await page.locator("#f-"+key).fill(value);
  const status=page.locator("#deck-cost-status");
  const ticket=page.locator("#deck-ticket-status");
  const totalMetric=page.locator("#result-cards .metric")
    .filter({hasText:"Quoted deck materials total"});
  let previous=0,baseCutSchedule=null,baseFasteners=null;
  for(const waste of [0,10,50,100]){
    await page.locator("#f-waste").fill(String(waste));
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(status).toContainText("optional full-width joist stock");
    await expect(status).not.toContainText("Excludes structural framing, joist lumber");
    const visible=await textCells(page.locator("#deck-budget-table tbody tr"));
    expect(visible).toHaveLength(3);
    const exportPromise=page.waitForEvent("download");
    await page.locator("#download-deck-budget-csv").click();
    const exported=csvRows(readFileSync(await(await exportPromise).path(),"utf8"));
    expect(exported[0]).toEqual([
      "Material","Planned Quantity","Purchase Quantity","Unit",
      "Unit Price","Purchase Cost","Currency"
    ]);
    const items=exported.slice(1,4);
    expect(items.map(item=>item[0])).toEqual(visible.map(item=>item[0]));
    expect(items[2][0]).toBe("Optional full-width joist stock");
    let subtotal=0;
    for(let i=0;i<items.length;i++){
      const row=items[i],display=visible[i];
      const qty=Number(row[2]),unit=priceCents(row[4]),cost=qty*unit;
      expect(Number.isInteger(qty)).toBe(true);
      expect(Number(row[1])).toBeLessThanOrEqual(qty);
      expect(priceCents(row[5]),"CSV material "+row[0]).toBe(cost);
      expect(numeric(display[2]),"screen quantity "+row[0]).toBe(qty);
      expect(Math.round(numeric(display[5])*100),"screen cost "+row[0]).toBe(cost);
      expect(row[6]).toBe("USD");
      subtotal+=cost;
    }
    expect(subtotal).toBeGreaterThanOrEqual(previous);
    previous=subtotal;
    await expect(status).toContainText(money(subtotal));
    await expect(ticket).toContainText(money(subtotal));
    await expect(totalMetric).toContainText(money(subtotal));
    const rowLabels=await page.locator("#cut-table tbody tr").allTextContents();
    const fasteners=await page.locator("#deck-fastener-table tbody tr").allTextContents();
    if(baseCutSchedule!==null){
      expect(rowLabels).toEqual(baseCutSchedule);
      expect(fasteners).toEqual(baseFasteners);
    }
    baseCutSchedule=rowLabels;
    baseFasteners=fasteners;
    if(waste===100){
      await page.evaluate(()=>dispatchEvent(new Event("beforeprint")));
      await page.emulateMedia({media:"print"});
      const parts=page.locator('.print-specialty-groups[data-source="deck-budget-table"] .print-specialty-part');
      await expect(parts).toHaveCount(2);
      const entirePrint=await parts.allTextContents();
      expect(entirePrint.join(" ")).toContain("Optional full-width joist stock");
      for(const item of visible)
        expect(entirePrint.join(" ")).toContain(item[5]);
      await expect(page.locator("#deck-ticket-status")).toContainText(money(subtotal));
      const pdf=await page.pdf({format:"Letter",printBackground:true,scale:1});
      expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(10000);
      await page.emulateMedia({media:"screen"});
      await page.evaluate(()=>dispatchEvent(new Event("afterprint")));
      await expect(parts).toHaveCount(0);
    }
  }
  await page.locator("#deck-currency").selectOption("EUR");
  await expect(status).toContainText(money(previous,"EUR"));
  await expect(ticket).toContainText(money(previous,"EUR"));
});

test("Framing mixed supplier quote is conserved across exported and printed line items",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/framing-calculator/");
  for(const [key,value] of [
    ["wallHeight","80"],["openingHeight","60"],["studUnitPrice","8"],
    ["studAltUnitPrice","8.2"],["studAlt2UnitPrice","8.5"],
    ["headerUnitPrice","12"]
  ])await page.locator("#f-"+key).fill(value);
  const status=page.locator("#framing-price-status");
  const ticket=page.locator("#framing-ticket-status");
  const sourceRows=page.locator("#framing-price-table tbody tr");
  let installedGeometry=null;
  for(const allowance of [0,10,50,100]){
    await page.locator("#f-stockWaste").fill(String(allowance));
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(status).toContainText("Estimated quoted lumber purchase");
    const mainCutRows=await page.locator("#cut-table tbody tr").allTextContents();
    if(installedGeometry!==null)expect(mainCutRows).toEqual(installedGeometry);
    installedGeometry=mainCutRows;
    const visible=await textCells(sourceRows);
    const result=page.waitForEvent("download");
    await page.locator("#download-price-csv").click();
    const csv=csvRows(readFileSync(await(await result).path(),"utf8"));
    expect(csv[0]).toEqual([
      "Stock Group","Offer Label","Stock Length (in)","Planned Sticks",
      "Allowance Sticks","Purchase Sticks","Unit Price","Planned Cost",
      "Reserve Cost","Purchase Cost","Currency"
    ]);
    const rows=csv.slice(1,-1);
    expect(rows).toHaveLength(visible.length);
    const plannedCounts=new Map();
    const cutStock=page.locator("#framing-stock-table tbody tr");
    const stockText=await cutStock.allTextContents();
    let subtotal=0;
    for(let i=0;i<rows.length;i++){
      const r=rows[i],v=visible[i];
      expect(r[0]).toBe(v[0]);
      const planned=Number(r[3]),reserve=Number(r[4]),purchased=Number(r[5]);
      expect(purchased).toBe(planned+reserve);
      expect(purchased).toBe(planned?Math.ceil(planned*(1+allowance/100)-1e-10):0);
      if(planned>0){
        expect(r[6]).not.toBe("");
        const cents=purchased*priceCents(r[6]);
        expect(priceCents(r[9])).toBe(cents);
        expect(priceCents(r[7])+priceCents(r[8])).toBe(cents);
        subtotal+=cents;
      }
      plannedCounts.set(r[0]+" "+r[1],planned);
      expect(r[10]).toBe("USD");
    }
    expect([...plannedCounts.values()].reduce((a,b)=>a+b,0)).toBe(stockText.length);
    await expect(status).toContainText(money(subtotal));
    await expect(ticket).toContainText(money(subtotal));
    if(allowance===50){
      await page.evaluate(()=>dispatchEvent(new Event("beforeprint")));
      await page.emulateMedia({media:"print"});
      const parts=page.locator('.print-specialty-groups[data-source="framing-price-table"] .print-specialty-part');
      await expect(parts).toHaveCount(2);
      await expect(page.locator("#framing-ticket-status")).toContainText(money(subtotal));
      const printed=await parts.allTextContents();
      for(const row of visible.filter(x=>x[2]!=="0"))
        expect(printed.join(" ")).toContain(row[0]);
      await page.emulateMedia({media:"screen"});
      await page.evaluate(()=>dispatchEvent(new Event("afterprint")));
      await expect(parts).toHaveCount(0);
    }
  }
});
