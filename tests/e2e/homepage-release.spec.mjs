import {test,expect} from "@playwright/test";

// Homepage content is pre-rendered; search/history affect local DOM/storage only.
test("home counts, six categories and searchable 31-tool directory",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".hero-facts")).toContainText("31 working calculator routes");
  await expect(page.locator(".hero-facts")).toContainText("6 active categories");
  await expect(page.locator(".graphic-caption")).toContainText("DRAWING 01 / 31");
  await expect(page.locator(".category-pill")).toHaveCount(6);
  await expect(page.locator("#tool-directory a")).toHaveCount(31);
  await page.getByLabel("Find a calculator").fill("wainscoting");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(1);
  await expect(page.locator("#tool-search-status")).toHaveText("Showing 1 of 31 tools");
  await page.getByLabel("Find a calculator").fill("unlikely-zzzz-geometry");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(0);
  await expect(page.locator("#tool-search-status")).toContainText("No matching calculator");
  await page.getByLabel("Find a calculator").fill("");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(31);
});

test("one-click recent-history clearing persists after reload",async({page})=>{
  await page.goto("/stud-calculator/");
  await page.waitForFunction(()=>{
    try{return JSON.parse(localStorage.getItem("woodwork-recent")||"[]").includes("stud-calculator")}catch{return false}
  });
  await page.goto("/");
  await expect(page.locator("#recent-tools")).toBeVisible();
  await expect(page.locator("#recent-links a")).toHaveCount(1);
  await page.getByRole("button",{name:"Clear history"}).click();
  await expect(page.locator("#recent-tools")).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("woodwork-recent"))).toBeNull();
  await page.reload();
  await expect(page.locator("#recent-tools")).toBeHidden();
  await page.goto("/rafter-calculator/");
  await page.waitForFunction(()=>localStorage.getItem("woodwork-recent")?.includes("rafter-calculator"));
  await page.goto("/");
  await expect(page.locator("#recent-links a")).toHaveCount(1);
});

test("mobile calculator discovery has no document-level overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.getByLabel("Find a calculator").fill("lumber");
  await expect(page.locator("#tool-directory a:visible")).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
