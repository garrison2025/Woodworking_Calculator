import {test,expect} from "@playwright/test";

const representative=[
  "/deck-board-calculator/","/framing-calculator/",
  "/stair-stringer-calculator/","/lumber-price-calculator/"
];

test("responsive workbench shortcuts link to real measurement, result and drawing panes",async({page})=>{
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:850});
    for(const route of representative){
      await page.goto(route);
      const nav=page.getByRole("navigation",{name:"Jump between calculator sections"});
      await expect(nav).toHaveCount(1);
      for(const [name,hash] of [
        ["Measurements","#workbench-input"],["Results","#workbench-results"],
        ["Drawing","#workbench-drawing"]
      ]){
        const link=nav.getByRole("link",{name,exact:true});
        await expect(link).toHaveAttribute("href",hash);
        await expect(page.locator(hash)).toHaveCount(1);
      }
      await nav.getByRole("link",{name:"Results",exact:true}).click();
      await expect(page).toHaveURL(/#workbench-results$/);
      await expect(nav.getByRole("link",{name:"Results",exact:true}))
        .toHaveAttribute("aria-current","location");
      await expect(page.locator("#result-cards .metric").first()).toBeVisible();
      await nav.getByRole("link",{name:"Drawing",exact:true}).click();
      await expect(page).toHaveURL(/#workbench-drawing$/);
      await expect(nav.getByRole("link",{name:"Drawing",exact:true}))
        .toHaveAttribute("aria-current","location");
      await expect(page.locator("#workbench-drawing #dimension-svg svg")).toBeVisible();
      const actual=await page.evaluate(()=>({
        scroll:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
        viewport:innerWidth,
        position:getComputedStyle(document.querySelector(".workbench-dock")).position
      }));
      expect(actual.scroll-actual.viewport,route+" at "+width).toBeLessThanOrEqual(2);
      expect(actual.position).toBe("sticky");
    }
  }
});

test("live workbench summary equals computed primary metric and never retains an invalid value",async({page})=>{
  await page.goto("/deck-board-calculator/");
  const firstMetric=page.locator("#result-cards .metric").first();
  await expect(firstMetric).toBeVisible();
  await expect(page.locator("#dock-primary-label")).toHaveText(
    (await firstMetric.locator("span").first().textContent()).trim()
  );
  await expect(page.locator("#dock-primary-value")).toHaveText(
    (await firstMetric.locator("strong").textContent()).trim()
  );
  const firstField=page.locator('#calculator-form input[id^="f-"]').first();
  const initial=await firstField.inputValue();
  await firstField.fill("");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator(".dock-summary")).toHaveClass(/is-invalid/);
  await expect(page.locator("#dock-primary-value")).toHaveText("—");
  await expect(page.locator("#dock-primary-label")).toHaveText("Review measurements");
  await firstField.fill(initial);
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator(".dock-summary")).not.toHaveClass(/is-invalid/);
  await expect(page.locator("#dock-primary-value")).toHaveText(
    (await page.locator("#result-cards .metric").first().locator("strong").textContent()).trim()
  );
});

test("reduced-motion means no dock or result-value animation, with functioning anchor navigation",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:390,height:844});
  await page.goto("/rafter-calculator/");
  const nav=page.getByRole("navigation",{name:"Jump between calculator sections"});
  await expect(nav).toBeVisible();
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
  const state=await page.evaluate(()=>({
    dockAnimations:document.querySelector(".workbench-dock").getAnimations().length,
    valueAnimations:document.querySelector("#dock-primary-value").getAnimations().length,
    behavior:getComputedStyle(document.documentElement).scrollBehavior
  }));
  expect(state.dockAnimations).toBe(0);
  expect(state.valueAnimations).toBe(0);
  expect(state.behavior).toBe("auto");
  await nav.getByRole("link",{name:"Results",exact:true}).click();
  await expect(nav.getByRole("link",{name:"Results",exact:true}))
    .toHaveAttribute("aria-current","location");
  await expect(page.locator("#workbench-results")).toBeVisible();
});

test("workbench navigator does not add an extra Tab stop at the three destinations",async({page})=>{
  await page.goto("/framing-calculator/");
  for(const id of ["workbench-input","workbench-results","workbench-drawing"]){
    await expect(page.locator("#"+id)).toHaveAttribute("tabindex","-1");
  }
  const anchors=page.locator(".dock-links a");
  await expect(anchors).toHaveCount(3);
  await expect(page.locator('a[href="#measurements"]')).toHaveCount(0);
});
