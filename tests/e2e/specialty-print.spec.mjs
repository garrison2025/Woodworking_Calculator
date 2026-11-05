import {test,expect} from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";

const cases=[
  {slug:"framing-calculator",tables:["framing-material-table","framing-price-table","framing-offer-table","framing-proof-table"]},
  {slug:"deck-material-calculator",tables:["deck-budget-table","deck-fastener-table"]},
  {slug:"stair-stringer-calculator",tables:["stringer-sawline-table","stringer-end-lines-table","stringer-end-contact-table"]},
  {slug:"shelf-spacing-calculator",tables:["shelf-pin-table"],prepare:async page=>{
    await page.locator("#f-height").fill("40");
    await page.locator("#f-thickness").fill("1");
    await page.locator("#f-top").fill("1");
    await page.locator("#f-bottom").fill("2");
    await page.locator("#f-caseDepth").fill("12");
    await page.locator("#f-frontPinInset").fill("1.5");
    await page.locator("#f-backPinInset").fill("1.5");
    await page.locator("#f-pinCenterDrop").fill("0.25");
    await page.locator("#f-pinHoleDiameter").fill("0.2");
  }}
];

for(const fixture of cases){
  test("wide professional print tables preserve exact row values: "+fixture.slug,async({page})=>{
    test.setTimeout(100000);
    await page.goto("/"+fixture.slug+"/");
    if(fixture.prepare)await fixture.prepare(page);
    await expect(page.locator("#calc-error")).toBeHidden();
    // Snapshot all source rows and header cells BEFORE printing.
    const before=await page.evaluate(ids=>Object.fromEntries(ids.map(id=>{
      const table=document.getElementById(id);
      return [id,{
        headings:[...table.tHead.rows[0].cells].map(x=>x.textContent.trim()),
        rows:[...table.tBodies[0].rows].map(tr=>[...tr.cells].map(x=>x.textContent.trim()))
      }];
    })),fixture.tables);
    await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({media:"print"});
    await expect(page.locator("#print-calibration")).toBeVisible();
    const printed={};
    for(const [id,source] of Object.entries(before)){
      if(source.rows.length===0)continue;
      const sections=page.locator('.print-specialty-groups[data-source="'+id+'"] .print-specialty-part');
      const table=page.locator("#"+id);
      // A colspan placeholder is an honest "not configured" state, not
      // an editable coordinate row. Preserve it untouched in print.
      if(source.rows.some(row=>row.length!==source.headings.length)){
        await expect(sections).toHaveCount(0);
        await expect(table.locator("xpath=..")).toBeVisible();
        continue;
      }
      // At least one value column appears in each group, with identifiers repeated.
      const count=await sections.count();
      expect(count,id+" split into print groups").toBeGreaterThan(0);
      await expect(table.locator("xpath=..")).toBeHidden();
      let allNames=[];
      for(const section of await sections.all()){
        const headers=await section.locator("thead th").allTextContents();
        const cols=headers.map(s=>s.trim());
        expect(cols[0]).toBe(source.headings[0]);
        expect(cols.length).toBeLessThanOrEqual(id==="shelf-pin-table"?6:5);
        expect(cols.length).toBeGreaterThanOrEqual(2);
        for(const field of cols)if(!allNames.includes(field))allNames.push(field);
        await expect(section.locator("tbody tr")).toHaveCount(source.rows.length);
        const rows=await section.locator("tbody tr").evaluateAll(trs=>
          trs.map(tr=>[...tr.cells].map(td=>td.textContent.trim())));
        for(let i=0;i<rows.length;i++){
          for(let j=0;j<cols.length;j++){
            const sourceCol=source.headings.indexOf(cols[j]);
            expect(sourceCol,id+" source heading lookup").toBeGreaterThanOrEqual(0);
            expect(rows[i][j],id+" row "+i+" column "+cols[j]).toBe(source.rows[i][sourceCol]);
          }
        }
        expect(await section.locator("table").evaluate(x=>parseFloat(getComputedStyle(x).fontSize)))
          .toBeGreaterThanOrEqual(12);
      }
      expect(allNames.sort(),id+" all columns preserved").toEqual([...source.headings].sort());
      printed[id]={rows:source.rows.length,groups:count,columns:source.headings.length};
    }
    expect(Object.keys(printed).length).toBeGreaterThanOrEqual(1);
    mkdirSync("print-evidence",{recursive:true});
    for(const paper of ["A4","Letter"]){
      const pdf=await page.pdf({format:paper,printBackground:true,preferCSSPageSize:false,scale:1,
        margin:{top:"15mm",right:"15mm",bottom:"15mm",left:"15mm"}});
      expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(10000);
      writeFileSync("print-evidence/specialty-"+fixture.slug+"-"+paper.toLowerCase()+".pdf",pdf);
    }
    await page.emulateMedia({media:"screen"});
    await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator(".print-specialty-groups")).toHaveCount(0);
    for(const id of Object.keys(printed))
      await expect(page.locator("#"+id).locator("xpath=..")).toBeVisible();
  });
}

test("disabled optional drill guides do not create fake printable measurements",async({page})=>{
  await page.goto("/shelf-spacing-calculator/");
  await expect(page.locator("#shelf-pin-table tbody tr")).toHaveCount(0);
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({media:"print"});
  await expect(page.locator('.print-specialty-groups[data-source="shelf-pin-table"]')).toHaveCount(0);
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
});
