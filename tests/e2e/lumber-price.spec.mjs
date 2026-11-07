import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const value=async(page,title)=>{
 const metric=page.locator("#result-cards .metric").filter({has:page.getByText(title,{exact:true})});
 await expect(metric).toHaveCount(1);
 const text=await metric.locator("strong").textContent();
 const match=text.match(/-?\d[\d,]*(?:\.\d+)?/);
 expect(match).toBeTruthy();
 return Number(match[0].replace(/,/g,""));
};
test("lumber quote BF and MBF prices, currency, actual sizes, SVG, CSV and mobile",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/lumber-price-calculator/");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex,nofollow,noarchive");
 const price=page.locator("#lumber-currency");
 await expect(price).toHaveValue("USD");
 expect(await value(page,"Board feet per piece")).toBe(4);
 expect(await value(page,"Whole purchased pieces including reserve")).toBe(11);
 expect(await value(page,"Total quoted price")).toBeCloseTo(261.36,2);
 const rect=page.locator("#dimension-svg svg .lumber-board-face");
 await expect(rect).toHaveCount(1);
 expect(Number(await rect.getAttribute("width"))/Number(await rect.getAttribute("height"))).toBeCloseTo(96/6,8);
 await page.locator("#f-priceBasis").selectOption("1");
 await expect(page.locator("#f-boardFootRate").locator("xpath=..")).toBeHidden();
 await expect(page.locator("#f-thousandBoardFootRate").locator("xpath=..")).toBeVisible();
 expect(await value(page,"Total quoted price")).toBeCloseTo(261.36,2);
 await price.selectOption("EUR");
 await expect(page.locator("#result-cards").getByText("EUR 261.36")).toBeVisible();
 await page.locator("#f-dimensionBasis").selectOption("1");
 await page.locator("#f-thickness").fill("0.75");
 await page.locator("#f-width").fill("5.5");
 expect(await value(page,"Board feet per piece")).toBeCloseTo(2.75,3);
 expect(await value(page,"Purchased board feet")).toBeCloseTo(30.25,3);
 await page.locator("#unit-select").selectOption("mm");
 await expect(page.locator("#f-thickness")).toHaveValue("19.05");
 await expect(page.locator("#f-width")).toHaveValue("139.7");
 expect(await value(page,"Board feet per piece")).toBeCloseTo(2.75,3);
 const dl=page.waitForEvent("download");
 await page.locator("#download-csv").click();
 const csv=readFileSync(await(await dl).path(),"utf8");
 expect(csv).toContain('"Board Feet Per Piece"');
 expect(csv).toContain('"Ordered Board Feet"');
 expect(csv).toContain('"Source note"');
 expect(csv).toContain("EUR");
 const viewport=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 expect(viewport.scroll).toBeLessThanOrEqual(viewport.client+2);
 await page.locator("#f-length").fill("0");
 await expect(page.locator("#calc-error")).toBeVisible();
 await expect(page.locator("#download-csv")).toBeDisabled();
 await page.locator("#reset-values").click();
 await expect(page.locator("#calc-error")).toBeHidden();
 expect(await value(page,"Total quoted price")).toBeCloseTo(261.36,2);
});

test("blank or zero supplier rate leaves quantity and downloads available",async({page})=>{
 await page.goto("/lumber-price-calculator/");
 for(const rate of ["","0"]){
  await page.locator("#f-boardFootRate").fill(rate);
  expect(await value(page,"Board feet per piece")).toBe(4);
  await expect(page.locator("#result-cards").getByText("Total quoted price")).toHaveCount(0);
  await expect(page.locator("#result-cards").getByRole("note")).toContainText("positive supplier rate");
  await expect(page.locator("#download-csv")).toBeEnabled();
 }
 await page.locator("#f-priceBasis").selectOption("1");
 expect(await value(page,"Total quoted price")).toBeCloseTo(261.36,2);
});
