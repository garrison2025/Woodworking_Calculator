import {test,expect} from "@playwright/test";

test("reset is reversible for exact fractional inch input, drawing zoom and computed result",async({page})=>{
  await page.goto("/deck-board-calculator/");
  const board=page.locator("#f-board");
  const initial=await board.inputValue();
  await board.fill("5 3/4");
  await expect(page.locator("#calc-error")).toBeHidden();
  const metricBefore=await page.locator("#result-cards .metric strong").first().textContent();
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-reset")).toHaveText("120%");
  const undo=page.getByRole("button",{name:"Undo last reset"});
  await expect(undo).toBeHidden();
  await page.locator("#reset-values").click();
  await expect(board).toHaveValue(initial);
  await expect(page.locator("#zoom-reset")).toHaveText("100%");
  await expect(undo).toBeVisible();
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(board).toHaveValue("5 3/4");
  await expect(page.locator("#zoom-reset")).toHaveText("120%");
  await expect(page.locator("#result-cards .metric strong").first()).toHaveText(metricBefore.trim());
  await expect(undo).toBeHidden();
});

test("an edit after reset invalidates undo to avoid overwriting newer measurements",async({page})=>{
  await page.goto("/stud-calculator/");
  const wall=page.locator("#f-length");
  const undo=page.getByRole("button",{name:"Undo last reset"});
  await wall.fill("160");
  await page.locator("#reset-values").click();
  await expect(undo).toBeVisible();
  // Two consecutive Reset clicks retain the FIRST pre-reset values.
  await page.locator("#reset-values").click();
  await undo.click();
  await expect(wall).toHaveValue("160");
  await wall.fill("170");
  await page.locator("#reset-values").click();
  await expect(undo).toBeVisible();
  await wall.fill("180");
  await expect(undo).toBeHidden();
  await expect(wall).toHaveValue("180");
  await page.locator("#reset-values").click();
  await undo.click();
  await expect(wall).toHaveValue("180");
});

test("a reported invalid input can be located and focused from results, then clears on correction",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/deck-board-calculator/");
  const width=page.locator("#f-width");
  const review=page.getByRole("button",{name:"Find invalid measurement"});
  await expect(review).toBeHidden();
  await width.fill("");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(width).toHaveAttribute("aria-invalid","true");
  await expect(review).toBeVisible();
  await review.click();
  await expect(width).toBeFocused();
  await expect(page.locator("#dock-primary-value")).toHaveText("—");
  await width.fill("120");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(review).toBeHidden();
  await expect(page.locator("#dock-primary-value")).not.toHaveText("—");
});

test("small-screen recovery buttons stay tappable and no extra motion runs under reduced-motion",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    await page.goto("/deck-board-calculator/");
    await page.locator("#f-board").fill("5 3/4");
    await page.locator("#reset-values").click();
    const undo=page.locator("#undo-reset");
    await expect(undo).toBeVisible();
    const dimensions=await undo.evaluate(el=>({
      h:el.getBoundingClientRect().height,
      animation:getComputedStyle(el).animationName,
      overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth
    }));
    expect(dimensions.h).toBeGreaterThanOrEqual(44);
    expect(dimensions.animation).toBe("none");
    expect(dimensions.overflow).toBeLessThanOrEqual(2);
    await undo.click();
    await page.locator("#f-width").fill("");
    const review=page.locator("#review-invalid");
    await expect(review).toBeVisible();
    expect(await review.evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
    expect(await review.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
});

test("untouched defaults do not offer meaningless undo",async({page})=>{
  await page.goto("/deck-board-calculator/");
  await page.locator("#reset-values").click();
  await expect(page.locator("#undo-reset")).toBeHidden();
});
