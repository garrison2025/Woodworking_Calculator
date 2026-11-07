import {test,expect} from "@playwright/test";

test("home makes tool families recognizable and supports slash-to-search",async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.goto("/");
  await expect(page.locator(".tool-card")).toHaveCount(6);
  for(const card of await page.locator(".tool-card").all()){
    await expect(card.locator(".tool-icon svg")).toHaveCount(1);
    await expect(card.locator(".tool-priority")).not.toHaveText(/^P[012]$/);
    await expect(card).toHaveAttribute("data-category",/^(framing|decks|roof|interior|wood|materials)$/);
  }
  expect(await page.locator(".topbar").evaluate(el=>getComputedStyle(el).position)).toBe("sticky");
  const search=page.getByLabel("Find a calculator");
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await page.keyboard.type("rafter");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(31);
  await page.locator("#all-tools").scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.querySelector(".topbar").getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(-1);
});

test("all interaction polish stays viewport-safe on home, category and calculator",async({page})=>{
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:850});
    for(const route of ["/","/woodworking/","/deck-board-calculator/"]){
      await page.goto(route);
      await expect(page.getByRole("link",{name:"WoodLayout home"})).toBeVisible();
      const overflow=await page.evaluate(()=>
        Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
      expect(overflow,route+" width "+width).toBeLessThanOrEqual(2);
      if(route==="/deck-board-calculator/"){
        await expect(page.locator("#result-cards .metric").first()).toBeVisible();
        await page.locator("#calculator-form input").first().focus();
        const focusState=await page.evaluate(()=>{
          const field=document.activeElement;
          return {border:getComputedStyle(field).borderColor,
            outline:getComputedStyle(field).outlineStyle};
        });
        expect(focusState.outline).not.toBe("none");
      }
    }
  }
});

test("prefers-reduced-motion disables decorative animation while retaining visible content",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await expect(page.locator(".hero-graphic")).toBeVisible();
  await expect(page.locator(".tool-card").first()).toBeVisible();
  expect(await page.evaluate(()=>getComputedStyle(document.querySelector(".hero-copy h1")).animationName))
    .toBe("none");
  expect(await page.locator(".reveal-ready").count()).toBe(0);
  expect(await page.evaluate(()=>getComputedStyle(document.querySelector(".blueprint-trace")).strokeDashoffset))
    .toBe("0px");
  await page.getByLabel("Find a calculator").fill("deck");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(2);
});

test("motion-allowed homepage uses one-shot geometry tracing and progressive reveal",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setViewportSize({width:1280,height:800});
  await page.goto("/");
  const name=await page.evaluate(()=>getComputedStyle(document.querySelector(".blueprint-trace")).animationName);
  expect(name).toBe("woodlayout-trace");
  const card=page.locator(".tool-card").first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/is-revealed/);
  await expect(card).toBeVisible();
});
