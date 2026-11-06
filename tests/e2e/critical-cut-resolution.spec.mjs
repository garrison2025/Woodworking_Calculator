import {test,expect} from "@playwright/test";

test("rafter refuses unmeasurable nonzero birdsmouth and restores all geometry",async({page})=>{
  await page.goto("/rafter-calculator/");
  const diagram=page.locator("#dimension-svg svg .rafter-stock-section");
  await expect(diagram).toHaveCount(1);
  await page.locator("#f-seat").fill("0.000000001");
  await expect(page.locator("#calc-error")).toContainText("cut-coordinate resolution");
  await expect(diagram).toHaveCount(0);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await expect(page.locator("#download-csv")).toBeDisabled();
  await page.locator("#f-seat").fill("3");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(diagram).toHaveCount(1);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(5);
  await page.locator("#f-pitch").fill("0.0000001");
  await expect(page.locator("#calc-error")).toContainText("cut-coordinate resolution");
  await page.locator("#f-pitch").fill("6");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(diagram).toHaveCount(1);
});

test("stringer refuses subresolution remaining throat or bottom cut and recovers",async({page})=>{
  await page.goto("/stair-stringer-calculator/");
  const profile=page.locator("#dimension-svg svg .stringer-step-profile");
  await expect(profile).toHaveCount(1);
  await page.locator("#f-depth").fill("6.000000001");
  await expect(page.locator("#calc-error")).toContainText("cut-coordinate resolution");
  await expect(profile).toHaveCount(0);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await page.locator("#f-depth").fill("11.25");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#f-treadThickness").fill("7.499999999");
  await expect(page.locator("#calc-error")).toContainText("cut-coordinate resolution");
  await page.locator("#f-treadThickness").fill("1.5");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(profile).toHaveCount(1);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(14);
});
