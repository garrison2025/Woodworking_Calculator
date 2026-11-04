import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const registry=JSON.parse(readFileSync("src/tools.json","utf8"));
const active=registry.tools.filter(t=>t.priority==="P0"||t.priority==="P1");

test("homepage links to every active tool without publishing P2",async({page})=>{
  const response=await page.goto("/");
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading",{name:/Good work begins/i})).toBeVisible();
  for(const t of active)expect(await page.locator('a[href="/'+t.slug+'/"]').count()).toBeGreaterThan(0);
  for(const t of registry.tools.filter(t=>t.priority==="P2"))
    expect(await page.locator('a[href="/'+t.slug+'/"]').count()).toBe(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content",/noindex/);
});

test("all 26 calculator pages execute JS, render metrics and SVG",async({page})=>{
  const pageErrors=[];
  page.on("pageerror",e=>pageErrors.push(e.message));
  for(const t of active){
    const response=await page.goto("/"+t.slug+"/");
    expect(response.status(),t.slug).toBe(200);
    const calcError=await page.locator("#calc-error").textContent();
    if(calcError?.trim())throw new Error(t.slug+": "+calcError.trim());
    await expect(page.locator("#result-cards .metric").first(),t.slug).toBeVisible();
    await expect(page.locator("#dimension-svg svg"),t.slug).toHaveCount(1);
    await expect(page.locator("#calc-error"),t.slug).toBeHidden();
    await expect(page.locator("#calculator-form input, #calculator-form select"),t.slug).toHaveCount(t.inputs.length);
    await expect(page.locator("meta[name='robots']"),t.slug).toHaveAttribute("content",/noindex/);
    const html=await page.locator("main").innerText();
    expect(html,t.slug).not.toContain('{esc(t[');
    expect(html,t.slug).not.toContain('{esc(');
    expect(html,t.slug).toContain("Geometry rule");
  }
  expect(pageErrors).toEqual([]);
});

test("deck row calculation uses the verified 1.875-inch final rip",async({page})=>{
  await page.goto("/deck-board-calculator/");
  const rip=page.locator("#result-cards .metric").filter({hasText:"Last rip width"});
  await expect(rip).toContainText("1.875 in");
  const count=page.locator("#result-cards .metric").filter({hasText:"Board rows"});
  await expect(count).toContainText("22");
});

test("stud recalculation changes results and input validation surfaces errors",async({page})=>{
  await page.goto("/stud-calculator/");
  const last=page.locator("#result-cards .metric").filter({hasText:"Last cut length"});
  await expect(last).toContainText("163.5 in");
  await page.locator("#f-length").fill("120");
  await expect(last).toContainText("151.5 in");
  await expect(page.locator("#dimension-svg svg")).toBeVisible();
  await page.locator("#f-length").fill("-10");
  await expect(page.locator("#calc-error")).toBeVisible();
  await page.getByRole("button",{name:/Reset dimensions/}).click();
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(last).toContainText("163.5 in");
});

test("inch to millimeter toggle preserves physical lengths",async({page})=>{
  await page.goto("/stud-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(3657.6,1);
  const last=page.locator("#result-cards .metric").filter({hasText:"Last cut length"});
  await expect(last).toContainText("4,152.9 mm");
  await page.locator("#unit-select").selectOption("cm");
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(365.76,3);
  await expect(last).toContainText("415.29 cm");
  await page.locator("#unit-select").selectOption("m");
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(3.6576,4);
  await expect(last).toContainText("4.1529 m");
  await page.locator("#unit-select").selectOption("ft");
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(12,4);
  await expect(last).toContainText("13.625 ft");
  await page.locator("#unit-select").selectOption("in");
  expect(Number(await page.locator("#f-length").inputValue())).toBeCloseTo(144,4);
});

test("zoom adjusts SVG only, preserving the drawing container size",async({page})=>{
  await page.goto("/stud-calculator/");
  const container=page.locator("#dimension-svg"),svg=container.locator("svg");
  const before=await container.boundingBox();
  await page.locator("#zoom-in").click();
  await expect(svg).toHaveCSS("width",/\d+(\.\d+)?px/);
  const after=await container.boundingBox();
  expect(after.width).toBeCloseTo(before.width,1);
  await page.locator("#zoom-reset").click();
  expect(await svg.evaluate(el=>el.style.width)).toBe("100%");
});

test("CSV and SVG controls produce local downloadable files",async({page})=>{
  await page.goto("/deck-board-calculator/");
  const csvEvent=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=await csvEvent;
  expect(csv.suggestedFilename()).toMatch(/deck-board-calculator-in-cut-list\.csv$/);
  const svgEvent=page.waitForEvent("download");
  await page.locator("#download-svg").click();
  const svg=await svgEvent;
  expect(svg.suggestedFilename()).toMatch(/deck-board-calculator-in-diagram\.svg$/);
});

for(const width of [360,390,768,1024,1440]){
  test("no page-level horizontal overflow at "+width+" px",async({page})=>{
    await page.setViewportSize({width,height:850});
    for(const url of ["/","/stud-calculator/"]){
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,offenders:[...document.querySelectorAll("body *")].map(el=>({tag:el.tagName,id:el.id,cls:typeof el.className==="string"?el.className.slice(0,70):"",right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)})).filter(el=>el.right>innerWidth+3).slice(0,8)}));
      expect(dims.scroll,url+" "+JSON.stringify(dims.offenders)).toBeLessThanOrEqual(dims.client+2);
    }
  });
}

test("copy results and print controls are wired to the live worksheet",async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("/roof-pitch-calculator/");
  await page.locator("#copy-result").click();
  await expect(page.locator("#action-status")).toContainText("Copied results.");
  const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
  expect(clipboard).toContain("Roof angle:");
  await page.evaluate(()=>{window.__printInvoked=false;window.print=()=>{window.__printInvoked=true}});
  await page.locator("#print-sheet").click();
  expect(await page.evaluate(()=>window.__printInvoked)).toBe(true);
});

test("workspaces load without third-party API or font requests",async({page})=>{
  const external=[];
  page.on("request",r=>{
    if(!r.url().startsWith("http://127.0.0.1:8787/"))external.push(r.url());
  });
  await page.goto("/kerf-bending-calculator/");
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
  expect(external).toEqual([]);
});

test("capture actual desktop and mobile preview renders for design review",async({page})=>{
  const {mkdirSync}=await import("node:fs");
  mkdirSync("visual-evidence",{recursive:true});
  for(const [label,width,height] of [["desktop",1440,900],["mobile",390,844]]){
    await page.setViewportSize({width,height});
    for(const [name,url] of [["home","/"],["stud","/stud-calculator/"],["deck","/deck-board-calculator/"],["rafter","/rafter-calculator/"],["stringer","/stair-stringer-calculator/"],["hip-roof","/hip-roof-calculator/"]]){
      await page.goto(url);
      if(name!=="home")await expect(page.locator("#result-cards .metric").first()).toBeVisible();
      await page.screenshot({path:"visual-evidence/"+name+"-"+label+".png",fullPage:true,animations:"disabled"});
    }
  }
});

test("rafter: notch depth is visible and changes when seat is revised",async({page})=>{
  await page.goto("/rafter-calculator/");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Seat notch (normal depth)"})).toContainText("1.3416 in");
  await expect(page.locator("#dimension-svg svg")).toHaveCount(1);
  expect(await page.locator("#dimension-svg svg path").count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("heading",{name:"Differentiate seat length and notch depth"})).toBeVisible();
  await page.locator("#f-seat").fill("4");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Seat notch (normal depth)"})).toContainText("1.7889 in");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#f-depth").fill("1");
  await expect(page.locator("#calc-error")).toBeVisible();
});

test("stringer: calculate finished floor bottom-cut correction with editable field",async({page})=>{
  await page.goto("/stair-stringer-calculator/");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Bottom riser layout cut"})).toContainText("6 in");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Uncut throat (nominal)"})).toContainText("5.25 in");
  await expect(page.getByRole("heading",{name:"Correct the bottom cut for installed finishes"})).toBeVisible();
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(14);
  await page.locator("#f-lowerFinish").fill("0.5");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Bottom riser layout cut"})).toContainText("6.5 in");
  await page.locator("#f-treadThickness").fill("9");
  await expect(page.locator("#calc-error")).toBeVisible();
});

test("framing elevations render distinct door and window cutouts and reject overflow",async({page})=>{
  await page.goto("/framing-calculator/");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Regular studs"})).toContainText("6");
  await page.locator("#f-opening2Start").fill("82");
  await page.locator("#f-opening2Width").fill("18");
  await page.locator("#f-opening2Height").fill("40");
  await page.locator("#f-opening2Sill").fill("32");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Opening intervals"})).toContainText("2");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Opening 2 top elevation"})).toContainText("72 in");
  await expect(page.locator("#dimension-svg svg .opening-cutout")).toHaveCount(2);
  await page.locator("#f-opening2Sill").fill("70");
  await expect(page.locator("#calc-error")).toBeVisible();
});

test("single-plane sheathing SVG reflects sheet orientation and exports a cut list",async({page})=>{
  await page.goto("/roof-sheathing-calculator/");
  const count=page.locator("#result-cards .metric").filter({hasText:"Sheet positions (no offcut reuse)"});
  await expect(count).toContainText("8");
  await expect(page.locator("#dimension-svg svg .sheathing-cut")).toHaveCount(8);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(8);
  await page.locator("#f-orientation").selectOption("1");
  await expect(count).toContainText("6");
  await expect(page.locator("#dimension-svg svg .sheathing-cut")).toHaveCount(6);
  const downloaded=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  expect((await downloaded).suggestedFilename()).toContain("roof-sheathing-calculator-in-cut-list.csv");
  await page.locator("#f-sheetWidth").fill("0.0001");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#dimension-svg svg .sheathing-cut")).toHaveCount(0);
});
test("deck estimator plan, stock segmentation, joist grid and CSV update together",async({page})=>{
  await page.goto("/deck-material-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#result-cards .metric").filter({hasText:"Last rip width"})).toContainText("1.875 in");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Stock boards (no offcut reuse)"})).toContainText("22");
  await expect(page.locator("#dimension-svg svg .deck-plan-board")).toHaveCount(22);
  await expect(page.locator("#dimension-svg svg .deck-plan-joist")).toHaveCount(10);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(32);
  await page.locator("#f-stock").fill("96");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Stock boards (no offcut reuse)"})).toContainText("44");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(54);
  const down=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  expect((await down).suggestedFilename()).toContain("deck-material-calculator-in-cut-list.csv");
  await page.locator("#f-joists").fill("-1");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#dimension-svg svg .deck-plan-board")).toHaveCount(0);
});
test("hip roof clipped sheets are visible and orientation, export and error controls work",async({page})=>{
  await page.goto("/hip-roof-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  const polygons=page.locator("#dimension-svg svg .roof-panel-cut");
  expect(await polygons.count()).toBeGreaterThan(8);
  await expect(page.locator("#cut-table tbody tr").first()).toContainText("North slope");
  await expect(page.locator("#schedule-count")).toContainText("computed rows");
  await page.locator("#f-orientation").selectOption("1");
  await expect(page.locator("#calc-error")).toBeHidden();
  expect(await polygons.count()).toBeGreaterThan(8);
  await page.locator("#unit-select").selectOption("mm");
  const promise=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  expect((await promise).suggestedFilename()).toContain("-mm-cut-list.csv");
  await page.locator("#f-sheetWidth").fill("0.0001");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(polygons).toHaveCount(0);
});

test("hip roof small fixture uses six sheets unrotated and twelve rotated",async({page})=>{
  await page.goto("/hip-roof-calculator/");
  for(const [name,value] of [["width","96"],["length","192"],["pitch","0"],["overhang","0"]]){
    await page.locator("#f-"+name).fill(value);
  }
  const sheetCount=page.locator("#result-cards .metric").filter({hasText:"Sheet positions (no offcut reuse)"});
  await expect(sheetCount).toContainText("6");
  await expect(page.locator("#dimension-svg svg .roof-panel-cut")).toHaveCount(6);
  await page.locator("#f-orientation").selectOption("1");
  await expect(sheetCount).toContainText("12");
  await expect(page.locator("#dimension-svg svg .roof-panel-cut")).toHaveCount(12);
});
