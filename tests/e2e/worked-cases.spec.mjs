import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {compute,convertFromInches} from "../../src/calcs.mjs";
const cases=JSON.parse(readFileSync(new URL("../../src/worked-cases.json",import.meta.url),"utf8")).cases;
const tools=JSON.parse(readFileSync(new URL("../../src/tools.json",import.meta.url),"utf8")).tools;
const ntext=t=>{
 const match=t.match(/-?\d[\d,]*(?:\.\d+)?/);
 expect(match).toBeTruthy();
 return Number(match[0].replace(/,/g,""));
};
for(const slug of ["deck-board-calculator","rafter-calculator","stair-stringer-calculator"]){
 test(slug+" · click each scenario in both units, inspect SVG and CSV and reset",async({page})=>{
  test.setTimeout(100000);
  const current=cases.filter(s=>s.slug===slug);
  const tool=tools.find(s=>s.slug===slug);
  await page.goto("/"+slug+"/");
  const panel=page.locator("#worked-cases");
  await expect(panel.locator("button.worked-apply")).toHaveCount(2);
  await expect(panel).toContainText("Not verified on real lumber");
  for(const unit of ["in","mm"]){
   if(unit==="mm")await page.locator("#unit-select").selectOption(unit);
   for(const c of current){
    await panel.locator('[data-case-id="'+c.id+'"]').click();
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(page.locator("#action-status")).toContainText("Loaded example: "+c.title);
    const m=compute(slug,c.inputs),svg=page.locator("#dimension-svg svg");
    await expect(svg).toHaveAttribute("data-model-shape",m.shape);
    expect(Number(await svg.getAttribute("data-model-span-in"))).toBeCloseTo(m.span,7);
    for(const field of tool.inputs){
     const input=page.locator("#f-"+field.key);
     const expected=field.kind==="L"?
       convertFromInches(c.inputs[field.key],unit):c.inputs[field.key];
     const actual=Number(await input.inputValue());
     expect(Math.abs(actual-expected),c.id+" / "+field.key)
       .toBeLessThanOrEqual(field.kind==="L"&&unit==="mm"?1e-5:1e-7);
    }
    for(const check of c.checks){
     const cell=page.locator("#result-cards .metric").filter({hasText:check.label});
     await expect(cell).toHaveCount(1);
     const actual=ntext(await cell.locator("strong").textContent());
     const expected=check.kind==="L"?convertFromInches(check.value,unit):check.value;
     const tolerance=check.kind==="N"?0.000001:unit==="mm"?0.015:0.0011;
     expect(Math.abs(actual-expected),c.id+" / "+check.label)
       .toBeLessThanOrEqual(tolerance);
    }
    await expect(page.locator("#cut-table tbody tr").first()).toContainText(m.rows[0].item);
    const dl=page.waitForEvent("download");
    await page.locator("#download-csv").click();
    const csv=readFileSync(await (await dl).path(),"utf8");
    expect(csv).toContain('"'+m.rows[0].item+'"');
    expect(csv).toContain('"'+m.rows.at(-1).item+'"');
    expect(csv).toContain(unit==="mm"?"(mm)":"(in)");
   }
  }
  await page.locator("#reset-values").click();
  const first=tool.inputs[0];
  const expected=first.kind==="L"?convertFromInches(first.value,"mm"):first.value;
  const currentValue=Number(await page.locator("#f-"+first.key).inputValue());
  expect(Math.abs(currentValue-expected)).toBeLessThan(1e-5);
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#worked-cases")).toBeVisible();
 });
}
