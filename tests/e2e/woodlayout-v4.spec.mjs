import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

test("all screen sizes expose working mobile categories and no horizontal overflow",async({page})=>{
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:850});
    for(const url of ["/","/woodworking/","/deck-board-calculator/"]){
      await page.goto(url);
      const menu=page.locator(".mobile-site-menu");
      await expect(menu).toHaveCount(1);
      if(width<=870){
        await expect(menu.locator("summary")).toBeVisible();
        await menu.locator("summary").click();
        await expect(menu.locator('nav[aria-label="Mobile tool categories"] a')).toHaveCount(7);
        await expect(menu.locator('a[href="/materials/"]')).toBeVisible();
        await menu.locator("summary").click();
        await expect(menu).not.toHaveAttribute("open","");
      }else{
        await expect(menu).toBeHidden();
      }
      const overflow=await page.evaluate(()=>
        Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
      expect(overflow,url+" at "+width).toBeLessThanOrEqual(2);
    }
  }
});

test("mobile workbench dock compacts on scroll and retains accessible section shortcuts",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/deck-board-calculator/");
  const dock=page.locator(".workbench-dock");
  await expect(dock).not.toHaveClass(/is-compact/);
  await page.evaluate(()=>window.scrollTo(0,640));
  await expect(dock).toHaveClass(/is-compact/);
  const toggle=page.getByRole("button",{name:/Sections/});
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded","false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded","true");
  await dock.getByRole("link",{name:"Drawing",exact:true}).click();
  await expect(page).toHaveURL(/#workbench-drawing$/);
  await expect(dock.getByRole("link",{name:"Drawing",exact:true}))
    .toHaveAttribute("aria-current","location");
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
});

test("complex framing shows a task index and keeps full advanced proof printable",async({page})=>{
  await page.goto("/framing-calculator/");
  const index=page.getByRole("navigation",{name:"Worksheet results sections"});
  await expect(index).toHaveCount(1);
  for(const anchor of ["#measurement-schedule","#framing-takeoff","#framing-optimizer-panel","#framing-order-ticket"]){
    await expect(index.locator('a[href="'+anchor+'"]')).toHaveCount(1);
    await expect(page.locator(anchor)).toHaveCount(1);
  }
  const details=page.locator(".advanced-results-disclosure");
  await expect(details).toHaveAttribute("open","");
  await details.locator("summary").click();
  await expect(details).not.toHaveAttribute("open","");
  await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
  await expect(details).toHaveAttribute("open","");
  await expect(page.locator("#framing-proof-table")).toHaveCount(1);
  await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));
  await expect(details).not.toHaveAttribute("open","");
});

test("numbered deck board geometry and schedule rows highlight the exact same part",async({page})=>{
  await page.goto("/deck-board-calculator/");
  await expect(page.locator("#dimension-svg svg[data-model-shape='boards']")).toBeVisible();
  const row=page.locator('#cut-table tbody tr[data-geometry-row="2"]');
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page.locator("#diagram-inspector")).toBeVisible();
  await expect(page.locator("#diagram-selection")).toContainText("Row 2 / ");
  await expect(page.locator('#dimension-svg .deck-board-face[data-row="2"]'))
    .toHaveClass(/is-selected-geometry/);
  await page.locator("#diagram-next-row").click();
  await expect(page.locator("#diagram-selection")).toContainText("Row 3 / ");
  await page.locator('#dimension-svg .deck-board-face[data-row="1"]').click();
  await expect(page.locator("#diagram-selection")).toContainText("Row 1 / ");
  await page.locator("#diagram-find-row").click();
  await expect(page.locator('#cut-table tbody tr[data-geometry-row="1"]'))
    .toHaveClass(/is-selected-geometry/);
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Save SVG"}).click();
  const saved=await downloadPromise;
  const file=await readFile(await saved.path(),"utf8");
  expect(file).toContain("deck-board-face");
  expect(file).not.toContain("is-selected-geometry");
});

test("unchanged physical geometry preserves its SVG subtree instead of triggering repaint",async({page})=>{
  await page.goto("/deck-board-calculator/");
  await expect(page.locator("#dimension-svg svg")).toBeVisible();
  const retained=await page.evaluate(async()=>{
    const root=document.querySelector("#dimension-svg");
    const original=root.firstElementChild;
    const field=document.querySelector("#f-width");
    field.dispatchEvent(new Event("input",{bubbles:true}));
    await new Promise(resolve=>queueMicrotask(resolve));
    await new Promise(resolve=>queueMicrotask(resolve));
    return root.firstElementChild===original;
  });
  expect(retained).toBe(true);
});

test("twenty rapid input events coalesce into one or two output refreshes and keep exact values",async({page})=>{
  await page.goto("/deck-board-calculator/");
  // The ES module loads asynchronously. Only measure event batching after
  // the live engine has attached the form listeners and rendered once.
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
  const count=await page.evaluate(async()=>{
    const field=document.querySelector("#f-width");
    const target=document.querySelector("#dimension-svg");
    let updates=0;
    const observer=new MutationObserver(events=>{
      if(events.some(x=>x.type==="childList"))updates++;
    });
    observer.observe(target,{childList:true});
    for(let i=0;i<20;i++){
      field.value=String(130+i);
      field.dispatchEvent(new Event("input",{bubbles:true}));
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    observer.disconnect();
    return updates;
  });
  expect(count).toBeLessThanOrEqual(2);
  await expect(page.locator("#f-width")).toHaveValue("149");
  await expect(page.locator("#dock-primary-value")).not.toHaveText("—");
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
});

test("motion preference disables V4 transitions, preserves labels and keyboard operation",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:320,height:790});
  await page.goto("/deck-board-calculator/");
  await page.evaluate(()=>window.scrollTo(0,600));
  await expect(page.locator(".workbench-dock")).toHaveClass(/is-compact/);
  const state=await page.evaluate(()=>({
    dock:getComputedStyle(document.querySelector(".workbench-dock")).animationName,
    font:parseFloat(getComputedStyle(document.querySelector("#calculator-form input")).fontSize),
    cardCount:document.querySelectorAll(".metric").length,
    width:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth
  }));
  expect(state.dock).toBe("none");
  expect(state.font).toBeGreaterThanOrEqual(16);
  expect(state.cardCount).toBeGreaterThan(0);
  expect(state.width).toBeLessThanOrEqual(2);
  await page.getByRole("button",{name:/Sections/}).click();
  await expect(page.locator("#workbench-shortcuts a")).toHaveCount(3);
});
