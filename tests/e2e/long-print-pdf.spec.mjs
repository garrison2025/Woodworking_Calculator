import {test,expect} from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";

test("real A4 and Letter PDFs contain the complete 540-cut multigroup worksheet",async({page})=>{
  test.setTimeout(240000);
  await page.goto("/segmented-bowl-calculator/");
  await page.locator("#f-segments").fill("180");
  await page.locator("#f-rings").fill("3");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#schedule-page-input").fill("4");
  await page.locator("#schedule-go").click();
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 4 of 4");
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({media:"print"});
  await expect(page.locator("#print-schedule-readable")).toBeVisible();
  const groups=page.locator("#print-schedule-readable .print-schedule-part");
  await expect(groups).toHaveCount(5);
  for(const group of await groups.all()){
    await expect(group.locator("tbody tr")).toHaveCount(540);
    await expect(group.locator("tbody tr").first()).toContainText("Ring 1 / segment 1");
    await expect(group.locator("tbody tr").last()).toContainText("Ring 3 / segment 180");
  }
  mkdirSync("print-evidence",{recursive:true});
  for(const paper of ["A4","Letter"]){
    const pdf=await page.pdf({
      format:paper,printBackground:true,preferCSSPageSize:false,scale:1,
      margin:{top:"15mm",right:"15mm",bottom:"15mm",left:"15mm"}
    });
    expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(10000);
    const count=(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)||[]).length;
    expect(count,paper+" pages for 540 cuts").toBeGreaterThan(10);
    expect(count,paper+" pages for 540 cuts").toBeLessThan(220);
    writeFileSync("print-evidence/segmented-bowl-540-"+paper.toLowerCase()+".pdf",pdf);
  }
  await page.emulateMedia({media:"screen"});
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("#print-schedule-readable")).toBeHidden();
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 4 of 4");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(60);
});
