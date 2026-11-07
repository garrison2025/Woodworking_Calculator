import {test,expect,devices} from "@playwright/test";
import {readFileSync} from "node:fs";

const registry=JSON.parse(readFileSync(new URL("../../src/tools.json",import.meta.url),"utf8"));
const toolPaths=registry.tools.map(t=>"/"+t.slug+"/");

const luminance=(channel)=>{
  const v=channel/255;
  return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);
};
const relative=(rgb)=>{
  const values=rgb.match(/[\d.]+/g)?.slice(0,3).map(Number);
  if(!values||values.length!==3)throw Error("Cannot parse RGB "+rgb);
  return .2126*luminance(values[0])+.7152*luminance(values[1])+
    .0722*luminance(values[2]);
};
const contrast=(a,b)=>{
  const x=relative(a),y=relative(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};

test("31 calculator layouts remain navigable at 320/390/768 CSS-pixel widths",async({page})=>{
  for(const url of toolPaths){
    await page.setViewportSize({width:390,height:844});
    await page.goto(url);
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(page.locator("#result-cards .metric").first()).toBeVisible();
    const controls=page.locator("#calculator-form input[id^='f-'],#calculator-form select[id^='f-']");
    expect(await controls.count(),url+" source input count").toBeGreaterThan(0);
    for(const width of [320,390,768]){
      await page.setViewportSize({width,height:844});
      const audit=await page.evaluate(()=>{
        const actualWidth=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);
        const fields=[...document.querySelectorAll("#calculator-form input[id^='f-'],#calculator-form select[id^='f-']")];
        const failures=[];
        for(const el of fields){
          if(!document.querySelector('label[for="'+el.id+'"]'))failures.push(el.id+" missing label");
          if(!document.querySelector("#field-note-"+el.id.slice(2)))failures.push(el.id+" missing helper");
          if(!el.closest("[hidden]")){
            const box=el.getBoundingClientRect();
            if(box.width<60||box.left<0||box.right>innerWidth+2)failures.push(el.id+" clipped");
          }
        }
        return {actualWidth,viewport:innerWidth,failures,metricCount:
          document.querySelectorAll("#result-cards .metric").length};
      });
      expect(audit.actualWidth-audit.viewport,url+" horizontal overflow at "+width)
        .toBeLessThanOrEqual(2);
      expect(audit.failures,url+" missing/clipped form controls at "+width).toEqual([]);
      expect(audit.metricCount,url+" missing numerical results at "+width)
        .toBeGreaterThan(0);
    }
  }
});

test("small helper text and navigation tagline stay legible; focus outline is contrasting",async({page})=>{
  for(const url of ["/","/deck-material-calculator/","/framing-calculator/"]){
    await page.setViewportSize({width:390,height:844});
    await page.goto(url);
    const parts=await page.evaluate(()=>{
      const selectors=[".brand small",".field small",".field label span",".drawing-caption"];
      return selectors.flatMap(selector=>[...document.querySelectorAll(selector)]
        .slice(0,4).map(el=>({
          selector,foreground:getComputedStyle(el).color,
          fontSize:parseFloat(getComputedStyle(el).fontSize),
          text:el.textContent.trim()
        })).filter(x=>x.text.length));
    });
    for(const {selector,foreground,fontSize} of parts){
      // All selected helper text is displayed against approximately white.
      const ratio=contrast(foreground,"rgb(254, 254, 253)");
      expect(ratio,url+" "+selector+" contrast").toBeGreaterThanOrEqual(4.5);
      expect(fontSize,url+" "+selector+" small-text size").toBeGreaterThanOrEqual(10);
    }
    const focused=await page.evaluate(()=>{
      const a=document.querySelector("a.brand");a.focus();
      return getComputedStyle(a).outlineColor;
    });
    expect(contrast(focused,"rgb(254, 254, 253)"),url+" keyboard focus")
      .toBeGreaterThanOrEqual(3);
  }
});

test("iPhone-viewport emulation: joist mode, touch controls, status, reduced motion, metric units",async({browser},info)=>{
  test.skip(info.project.name!=="chromium","iPhone touch emulation is a Chromium-only assertion, not a physical iPhone test");
  const context=await browser.newContext({...devices["iPhone 13"],reducedMotion:"reduce",acceptDownloads:true});
  const page=await context.newPage();
  try{
    await page.goto("/deck-material-calculator/");
    await expect(page.locator("#calc-error")).toBeHidden();
    expect(await page.evaluate(()=>matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const css=await page.locator(".btn.primary").first().evaluate(el=>({
      transition:getComputedStyle(el).transitionDuration,
      animation:getComputedStyle(el).animationDuration
    }));
    expect(css.transition).toMatch(/^(?:0s(?:,\s*0s)*)$/);
    expect(css.animation).toMatch(/^(?:0s(?:,\s*0s)*)$/);
    await page.locator("#f-length").fill("140");
    await page.locator("#f-joistLayoutMode").selectOption("1");
    await expect(page.locator("#result-cards .metric").filter({hasText:"Equalized joist bays"}))
      .toContainText("9");
    const zoom=page.locator("#zoom-in");
    await zoom.tap();
    await expect(page.locator("#action-status")).toContainText("Updated:");
    const v=await page.evaluate(()=>
      Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
    expect(v,"physical-size mobile viewport emulation overflow").toBeLessThanOrEqual(2);
    const tap=await zoom.evaluate(el=>el.getBoundingClientRect().toJSON());
    expect(tap.width).toBeGreaterThanOrEqual(44);
    expect(tap.height).toBeGreaterThanOrEqual(44);
    await page.locator("#unit-select").selectOption("mm");
    await expect(page.locator("#calc-error")).toBeHidden();
    await page.locator("#f-joists").fill("0");
    await expect(page.locator("#calc-error")).toBeVisible();
    await expect(page.locator("#dimension-svg svg .deck-plan-joist")).toHaveCount(0);
    await page.locator("#f-joists").fill("406.4");
    await expect(page.locator("#calc-error")).toBeHidden();
    await expect(page.locator("#dimension-svg svg .deck-plan-joist")).toHaveCount(10);
  }finally{
    await context.close();
  }
});
