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

test("CSV cut sheets preserve numeric millimeters, typed area and polygon vertices",async({page})=>{
  const {readFileSync}=await import("node:fs");
  await page.goto("/stud-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  const ready=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const file=await ready;
  expect(file.suggestedFilename()).toBe("stud-calculator-mm-cut-list.csv");
  const csv=readFileSync(await file.path(),"utf8");
  expect(csv).toContain('"Position (mm)","Length (mm)"');
  expect(csv).toContain('"Stud 2","406.4"');
  expect(csv).not.toContain('"406.4 mm"');
  await page.goto("/hip-roof-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  const hipReady=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const hipCsv=readFileSync(await (await hipReady).path(),"utf8");
  expect(hipCsv).toContain('"Cut Area (m²)","Cut Vertices (mm)"');
  expect(hipCsv).toContain('"Source note"');
  await page.goto("/roof-pitch-calculator/");
  const fallback=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const noRows=readFileSync(await (await fallback).path(),"utf8");
  expect(noRows).toContain('"Measurement","Value"');
  expect(noRows).toContain('"Roof angle"');
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
    for(const url of ["/","/stud-calculator/","/deck-material-calculator/","/roof-sheathing-calculator/","/framing-calculator/"]){
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

test("print calibration stays hidden on screen and renders in Letter and A4 PDFs",async({page})=>{
  const {mkdirSync,writeFileSync}=await import("node:fs");
  await page.goto("/stud-calculator/");
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
  const calibration=page.locator("#print-calibration");
  await expect(calibration).toBeHidden();
  await page.emulateMedia({media:"print"});
  await expect(calibration).toBeVisible();
  const dimensions=await page.evaluate(()=>{
    const width=sel=>document.querySelector(sel).getBoundingClientRect().width;
    return {mm:width(".calibration-100mm"),inch:width(".calibration-1in"),
      main:getComputedStyle(document.querySelector(".topbar")).display,
      drawing:getComputedStyle(document.querySelector("#dimension-svg")).display};
  });
  expect(dimensions.mm).toBeCloseTo(100*96/25.4,1);
  expect(dimensions.inch).toBeCloseTo(96,1);
  expect(dimensions.main).toBe("none");
  expect(dimensions.drawing).not.toBe("none");
  mkdirSync("print-evidence",{recursive:true});
  for(const [paper,w,h] of [["Letter",612,792],["A4",595.28,841.89]]){
    const pdf=await page.pdf({format:paper,printBackground:true,preferCSSPageSize:false,scale:1,
      margin:{top:"15mm",bottom:"15mm",left:"15mm",right:"15mm"}});
    expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
    const mediaBox=pdf.toString("latin1").match(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    expect(mediaBox, paper+" missing PDF MediaBox").not.toBeNull();
    // Chromium's PDF A4 media box can round the nominal paper size to a few PDF points.
    // This verifies paper selection, not physical printer dimensional accuracy.
    expect(Math.abs(Number(mediaBox[1])-w)).toBeLessThanOrEqual(w*0.002);
    expect(Math.abs(Number(mediaBox[2])-h)).toBeLessThanOrEqual(h*0.002);
    writeFileSync("print-evidence/stud-"+paper.toLowerCase()+".pdf",pdf);
  }
  await page.emulateMedia({media:"screen"});
  await expect(calibration).toBeHidden();
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
    for(const [name,url] of [["home","/"],["stud","/stud-calculator/"],["deck","/deck-board-calculator/"],["rafter","/rafter-calculator/"],["stringer","/stair-stringer-calculator/"],["hip-roof","/hip-roof-calculator/"],["deck-material","/deck-material-calculator/"],["roof-sheathing","/roof-sheathing-calculator/"],["framing","/framing-calculator/"]]){
      await page.goto(url);
      if(name!=="home")await expect(page.locator("#result-cards .metric").first()).toBeVisible();
      await page.screenshot({path:"visual-evidence/"+name+"-"+label+".png",fullPage:true,animations:"disabled"});
    }
  }
});

test("soffit datum uses real rafter depth and updates cross-section and CSV",async({page})=>{
  const {readFileSync}=await import("node:fs");
  await page.goto("/soffit-calculator/");
  const result=page.locator("#result-cards .metric").filter({hasText:"Finished soffit reference drop"});
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(result).toContainText("18.6492 in");
  await expect(page.locator("#dimension-svg svg .soffit-rafter")).toHaveCount(1);
  await expect(page.locator("#dimension-svg svg .soffit-finished-datum")).toHaveCount(1);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(2);
  await page.locator("#f-depth").fill("11");
  await expect(result).toContainText("24.7984 in");
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Rafter Underside Drop (mm)");
  const pending=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const downloaded=readFileSync(await (await pending).path(),"utf8");
  expect(downloaded).toContain('"Roof Top Drop (mm)","Rafter Underside Drop (mm)","Soffit Face Drop (mm)"');
  await page.locator("#f-fasciaOffset").fill("-1200");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#dimension-svg svg .soffit-rafter")).toHaveCount(0);
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
test("fence-post rejects overlapping faces and exports center-to-center clear bays",async({page})=>{
  const {readFileSync}=await import("node:fs");
  await page.goto("/fence-post-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#result-cards .metric").filter({hasText:"Posts"})).toContainText("14");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(14);
  await page.locator("#f-length").fill("120");
  await page.locator("#f-bay").fill("24");
  await page.locator("#f-post").fill("25");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await page.locator("#f-post").fill("23.5");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Approximate clear bay"})).toContainText("0.5 in");
  await page.locator("#unit-select").selectOption("mm");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Center (mm)","Clear Bay To Next (mm)"');
  expect(csv).toContain('"Post 1","0","12.7"');
});
test("shelf reserved end gaps and actual face coordinates agree across table and drawing",async({page})=>{
  await page.goto("/shelf-spacing-calculator/");
  await expect(page.locator("#dimension-svg svg .shelf-face")).toHaveCount(3);
  await expect(page.locator("#cut-table thead")).toContainText("Shelf Bottom (in)");
  await expect(page.locator("#cut-table thead")).toContainText("Shelf Top (in)");
  await page.locator("#f-height").fill("40");
  await page.locator("#f-thickness").fill("1");
  await page.locator("#f-top").fill("1");
  await page.locator("#f-bottom").fill("2");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Shared base clear gap"})).toContainText("8.5 in");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Actual bottom clearance"})).toContainText("10.5 in");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Actual top clearance"})).toContainText("9.5 in");
  await expect(page.locator("#cut-table tbody tr").first().locator("td").nth(1)).toContainText("10.5 in");
  await expect(page.locator("#cut-table tbody tr").last().locator("td").nth(2)).toContainText("30.5 in");
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Shelf Bottom (mm)");
  await page.locator("#f-top").fill("1500");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#dimension-svg svg .shelf-face")).toHaveCount(0);
});
test("baluster and fence face widths are proportional to input dimensions",async({page})=>{
  await page.goto("/baluster-spacing-calculator/");
  const face=page.locator("#dimension-svg svg .baluster-face").first();
  await expect(face).toHaveCount(1);
  const before=Number(await face.getAttribute("width"));
  await page.locator("#f-width").fill("2");
  const after=Number(await face.getAttribute("width"));
  expect(after).toBeGreaterThan(before*1.25);
  await page.goto("/fence-post-calculator/");
  const post=page.locator("#dimension-svg svg .post-face").first();
  await expect(post).toHaveCount(1);
  const narrow=Number(await post.getAttribute("width"));
  await page.locator("#f-post").fill("7");
  const wide=Number(await post.getAttribute("width"));
  expect(wide).toBeGreaterThan(narrow*1.9);
});
test("segmented bowl emits every ring/segment and exports typed angles",async({page})=>{
  const {readFileSync}=await import("node:fs");
  await page.goto("/segmented-bowl-calculator/");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(36);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Segment half-miter"})).toContainText("15°");
  await page.locator("#f-rings").fill("4");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(48);
  await expect(page.locator("#cut-table thead")).toContainText("Ring");
  await expect(page.locator("#cut-table thead")).toContainText("Miter Angle (°)");
  const firstRing=page.locator("#cut-table tbody tr").first();
  await expect(firstRing.locator("td").nth(1)).toHaveText("1");
  await expect(firstRing.locator("td").nth(2)).toHaveText("1");
  await expect(firstRing.locator("td").nth(5)).toHaveText("15°");
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Outer Chord (mm)");
  await expect(firstRing.locator("td").nth(1)).toHaveText("1");
  await expect(firstRing.locator("td").nth(5)).toHaveText("15°");
  const dl=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await dl).path(),"utf8");
  expect(csv).toContain('"Ring","Segment","Start Angle (°)","End Angle (°)","Miter Angle (°)"');
  expect(csv).toContain('"Outer Chord (mm)","Inner Chord (mm)","Radial Depth (mm)"');
  expect(csv).toContain('"Ring 4 / segment 12","4","12"');
  // Inputs are now in millimeters: 320 mm exceeds the 304.8 mm outer diameter.
  await page.locator("#f-inner").fill("320");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
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
