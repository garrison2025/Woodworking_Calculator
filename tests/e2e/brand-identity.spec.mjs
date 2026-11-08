import {test,expect} from "@playwright/test";

test("WoodLayout header logo renders and stays within mobile viewports",async({page})=>{
  for(const url of ["/","/lumber-price-calculator/","/spiral-staircase-calculator/"]){
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:830});
      await page.goto(url);
      const brand=page.getByRole("link",{name:"WoodLayout home"});
      await expect(brand).toHaveCount(1);
      await expect(brand.locator("img")).toHaveAttribute("src","/logo-mark.svg");
      await expect(brand.locator("img")).toHaveAttribute("alt","WoodLayout logo");
      await expect(brand.locator(".brand-wordmark")).toContainText("WoodLayout");
      const check=await page.evaluate(()=>{
        const link=document.querySelector("a.brand");
        const img=link.querySelector("img");
        const box=link.getBoundingClientRect();
        const label=link.querySelector(".brand-wordmark strong").getBoundingClientRect();
        return {
          imageLoaded:img.complete&&img.naturalWidth>0,
          contained:box.left>=0&&box.right<=innerWidth+1&&label.right<=innerWidth+1,
          horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
          taglineSize:parseFloat(getComputedStyle(link.querySelector("small")).fontSize)
        };
      });
      expect(check.imageLoaded,url+" logo asset").toBe(true);
      expect(check.contained,url+" logo cropped at "+width).toBe(true);
      expect(check.horizontalOverflow,url+" overflow at "+width).toBeLessThanOrEqual(2);
      expect(check.taglineSize,url+" logo tagline size").toBeGreaterThanOrEqual(10);
    }
  }
});

test("navigation and browser tab use the same valid vector mark",async({page,request})=>{
  await page.goto("/");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href","/favicon.svg");
  const [icon,logo,lockup]=await Promise.all([
    request.get("/favicon.svg"),request.get("/logo-mark.svg"),request.get("/logo-lockup.svg")
  ]);
  expect(icon.ok()).toBe(true);
  expect(logo.ok()).toBe(true);
  expect(lockup.ok()).toBe(true);
  expect(await icon.text()).toBe(await logo.text());
  expect(await lockup.text()).toContain("WoodLayout");
});
