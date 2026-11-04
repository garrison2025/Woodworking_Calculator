import {test,expect} from "@playwright/test";

test("sub-inch wainscoting wall and zero-gap panels occupy the full reference span",async({page})=>{
  await page.goto("/wainscoting-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  await page.locator("#f-panels").fill("2");
  await page.locator("#f-margin").fill("0");
  await page.locator("#f-gap").fill("0");
  await page.locator("#f-wall").fill("12.7");
  await expect(page.locator("#calc-error")).toBeHidden();
  const wall=page.locator("#dimension-svg svg .wainscot-wall");
  const parts=page.locator("#dimension-svg svg .wainscot-panel");
  await expect(parts).toHaveCount(2);
  const x0=Number(await wall.getAttribute("x")),ww=Number(await wall.getAttribute("width"));
  const a0=Number(await parts.first().getAttribute("x")),aw=Number(await parts.first().getAttribute("width"));
  const b0=Number(await parts.last().getAttribute("x")),bw=Number(await parts.last().getAttribute("width"));
  expect(a0).toBeCloseTo(x0,6);
  expect(aw/ww).toBeCloseTo(.5,6);
  expect(b0).toBeCloseTo(a0+aw,6);
  expect(b0+bw).toBeCloseTo(x0+ww,6);
  await expect(page.locator("#cut-table tbody tr").first()).toContainText("6.35 mm");
  await expect(page.locator("#cut-table tbody tr").last()).toContainText("12.7 mm");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Total layout width"})).toContainText("12.7 mm");
});
