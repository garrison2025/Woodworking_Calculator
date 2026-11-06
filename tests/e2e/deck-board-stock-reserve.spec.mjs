import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const numeric=async(page,label)=>{
 const row=page.locator("#result-cards .metric").filter({
  has:page.getByText(label,{exact:true})
 });
 await expect(row).toHaveCount(1);
 return Number((await row.locator("strong").textContent()).replace(/[^\d.\-]/g,""));
};
test("deck board stock reserve warns for unsupported joints, survives mm and works on narrow phones",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/deck-board-calculator/");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex,nofollow,noarchive");
 await expect(page.locator("#worked-cases .worked-apply")).toHaveCount(2);
 await expect(page.locator("#f-boardEndTrim")).toHaveValue("0");
 await expect(page.locator("#f-boardCrosscutKerf")).toHaveValue("0");
 for(const [key,val] of Object.entries({
  width:"95",length:"120",board:"5.5",gap:"0.25",stock:"60",
  waste:"10",boardEndTrim:"0.75",boardCrosscutKerf:"0.125"
 }))await page.locator("#f-"+key).fill(val);
 await expect(page.locator("#calc-error")).toBeHidden();
 expect(await numeric(page,"Usable stock length after allowance")).toBeCloseTo(58.375,3);
 expect(await numeric(page,"Stock pieces per row (unverified joints)")).toBe(3);
 expect(await numeric(page,"Stock pieces: no offcut reuse")).toBe(57);
 await expect(page.locator(".deck-joint-warning")).toContainText("joist centers");
 const svg=page.locator("#dimension-svg svg");
 await expect(svg).toHaveAttribute("data-model-shape","boards");
 await expect(svg.locator(".deck-board-face")).toHaveCount(17);
 await page.locator("#unit-select").selectOption("mm");
 await expect(page.locator(".deck-joint-warning")).toBeVisible();
 expect(Number(await page.locator("#f-boardEndTrim").inputValue())).toBeCloseTo(19.05,4);
 expect(Number(await page.locator("#f-boardCrosscutKerf").inputValue())).toBeCloseTo(3.175,4);
 expect(await numeric(page,"Stock pieces: no offcut reuse")).toBe(57);
 const downloading=page.waitForEvent("download");
 await page.locator("#download-csv").click();
 const csv=readFileSync(await(await downloading).path(),"utf8");
 expect(csv).toContain('"Rip Width (mm)"');
 expect(csv).toContain('"Row 17"');
 const viewport=await page.evaluate(()=>({
  client:document.documentElement.clientWidth,
  scroll:document.documentElement.scrollWidth
 }));
 expect(viewport.scroll).toBeLessThanOrEqual(viewport.client+2);
 await page.locator("#f-boardEndTrim").fill("1000");
 await expect(page.locator("#calc-error")).toBeVisible();
 await expect(svg).toHaveCount(0);
 await expect(page.locator("#download-csv")).toBeDisabled();
 await page.locator("#reset-values").click();
 await expect(page.locator("#calc-error")).toBeHidden();
 await expect(page.locator(".deck-joint-warning")).toHaveCount(0);
 await page.locator("#worked-cases [data-case-id='deck-patio-120']").click();
 await expect(page.locator(".deck-joint-warning")).toHaveCount(0);
 expect(await numeric(page,"Stock pieces: no offcut reuse")).toBe(25);
});
