import {test,expect} from "@playwright/test";

test("gaps below displayed coordinate precision show an actionable error, then recover",async({page})=>{
  for(const [slug,selector,invalid,valid] of [
    ["deck-board-calculator","#f-gap","0.000000001","0.000002"],
    ["deck-material-calculator","#f-gap","0.000000001","0.000002"],
    ["wainscoting-calculator","#f-gap","0.000000001","0.002"],
    ["equal-spacing-calculator","#f-itemWidth","0.000000001","0.25"]
  ]){
    await page.goto("/"+slug+"/");
    // Equal-spacing defaults place the first/last marks at the measured ends.
    // Give physical pieces actual face margins before a positive-width recovery.
    if(slug==="equal-spacing-calculator"){
      await page.locator("#f-left").fill("0.5");
      await page.locator("#f-right").fill("0.5");
    }
    await expect(page.locator("#calc-error")).toBeHidden();
    await page.locator(selector).fill(invalid);
    await expect(page.locator("#calc-error")).toContainText("coordinate resolution");
    await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
    await page.locator(selector).fill(valid);
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(page.locator("#cut-table tbody tr").first()).toBeVisible();
  }
});

test("visible tiny nonzero cut clearance never rounds to zero in any selected unit",async({page})=>{
  await page.goto("/deck-board-calculator/");
  await page.locator("#f-gap").fill("0.000002");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#cut-table tbody")).toContainText("0.000002 in");
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#cut-table tbody")).toContainText("0.0000508 mm");
  await page.locator("#f-gap").fill("0");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#cut-table tbody")).toContainText("0 mm");
});
