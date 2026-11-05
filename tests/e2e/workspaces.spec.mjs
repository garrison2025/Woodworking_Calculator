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

test("drilling layout draws proportional hole circles and exports edge-clear coordinates",async({page})=>{
  await page.goto("/hole-spacing-calculator/");
  await page.locator("#unit-select").selectOption("mm");
  await page.locator("#f-length").fill("100");
  await page.locator("#f-holes").fill("4");
  await page.locator("#f-edge").fill("5");
  await page.locator("#f-diameter").fill("5");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#result-cards .metric").filter({hasText:"Clear material between holes"})).toContainText("25 mm");
  await expect(page.locator("#result-cards .metric").filter({hasText:"End material margin"})).toContainText("2.5 mm");
  const holes=page.locator("#dimension-svg svg .drill-hole");
  await expect(holes).toHaveCount(4);
  const first=holes.first();
  const r1=Number(await first.getAttribute("r")),cx1=Number(await first.getAttribute("cx"));
  const cx2=Number(await holes.nth(1).getAttribute("cx"));
  expect((cx2-cx1)/(2*r1)).toBeCloseTo(30/5,3);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(4);
  await expect(page.locator("#cut-table thead")).toContainText("Hole Left Edge (mm)");
  await expect(page.locator("#cut-table thead")).toContainText("Hole Right Edge (mm)");
  await expect(page.locator("#cut-table tbody tr").first()).toContainText("2.5 mm");
  const {readFileSync}=await import("node:fs");
  const event=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const data=readFileSync(await (await event).path(),"utf8");
  expect(data).toContain('"Hole Left Edge (mm)","Hole Right Edge (mm)"');
  expect(data).toContain('"Hole 1","5","2.5","7.5","5"');
  await page.locator("#f-diameter").fill("10");
  await expect(page.locator("#calc-error")).toBeHidden();
  const r2=Number(await holes.first().getAttribute("r"));
  expect(r2).toBeGreaterThan(r1*1.9);
  await page.locator("#f-diameter").fill("40");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(holes).toHaveCount(0);
});
test("deck row calculation uses the verified 1.875-inch final rip",async({page})=>{
  await page.goto("/deck-board-calculator/");
  const rip=page.locator("#result-cards .metric").filter({hasText:"Last rip width"});
  await expect(rip).toContainText("1.875 in");
  const count=page.locator("#result-cards .metric").filter({hasText:"Board rows"}).first();
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
  expect(hipCsv).toContain('"Cut Area (m²)","Offcut Area (m²)","Cut Vertices (mm)","Plan Projection Vertices (mm)"');
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
  await expect(page.locator("#dimension-svg svg .rafter-stock-section")).toHaveCount(1);
  await expect(page.locator("#dimension-svg svg .rafter-top-reference")).toHaveCount(1);
  await expect(page.locator("#dimension-svg svg .rafter-seat-reference")).toHaveCount(1);
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
  expect(csv).toContain('"Center (mm)","Face Left (mm)","Face Right (mm)","Clear Bay To Next (mm)"');
  expect(csv).toContain('"Post 1","0","-298.45","298.45","12.7"');
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
test("large bowl cut list paginates without losing the exported per-piece schedule",async({page})=>{
  const {readFileSync}=await import("node:fs");
  await page.goto("/segmented-bowl-calculator/");
  await expect(page.locator("#schedule-pager")).toBeHidden();
  await page.locator("#f-segments").fill("180");
  await page.locator("#f-rings").fill("3");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#result-cards .metric").filter({hasText:"Total segments"})).toContainText("540");
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(160);
  await expect(page.locator("#schedule-pager")).toBeVisible();
  await expect(page.locator("#schedule-count")).toContainText("rows 1–160 of 540");
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 1 of 4");
  await expect(page.locator("#schedule-prev")).toBeDisabled();
  await page.locator("#schedule-next").click();
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 2 of 4");
  await expect(page.locator("#cut-table tbody tr").first()).toContainText("Ring 1 / segment 161");
  await page.locator("#schedule-page-input").fill("4");
  await page.locator("#schedule-go").click();
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(60);
  await expect(page.locator("#cut-table tbody tr").first()).toContainText("Ring 3 / segment 121");
  await expect(page.locator("#cut-table tbody tr").last()).toContainText("Ring 3 / segment 180");
  await expect(page.locator("#schedule-next")).toBeDisabled();
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 4 of 4");
  await expect(page.locator("#cut-table thead")).toContainText("Outer Chord (mm)");
  const download=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await download).path(),"utf8");
  expect(csv).toContain('"Ring 1 / segment 1","1","1"');
  expect(csv).toContain('"Ring 3 / segment 180","3","180"');
  expect(csv.split("\r\n").length).toBe(543);
  await page.locator("#f-rings").fill("1");
  await expect(page.locator("#schedule-page-status")).toHaveText("Page 1 of 2");
  await expect(page.locator("#cut-table tbody tr").first()).toContainText("Ring 1 / segment 1");
  await page.locator("#f-inner").fill("500");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#schedule-pager")).toBeHidden();
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
});
test("wainscoting panel faces match typed CSV edges and preserve actual visible gaps",async({page})=>{
  const {readFileSync}=await import("node:fs");
  await page.goto("/wainscoting-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#result-cards .metric").filter({hasText:"Total layout width"})).toContainText("120 in");
  const panels=page.locator("#dimension-svg svg .wainscot-panel");
  await expect(panels).toHaveCount(5);
  await expect(page.locator("#cut-table thead")).toContainText("Right (in)");
  await expect(page.locator("#cut-table thead")).toContainText("Gap After (in)");
  await expect(page.locator("#cut-table tbody tr").first()).toContainText("24.2 in");
  const first=panels.first(),second=panels.nth(1),last=panels.last();
  const firstX=Number(await first.getAttribute("x")),firstW=Number(await first.getAttribute("width"));
  const secondX=Number(await second.getAttribute("x"));
  expect((secondX-firstX)/firstW).toBeCloseTo(23.2/21.2,7);
  expect(firstW).toBeGreaterThan(0);
  const wall=page.locator("#dimension-svg svg .wainscot-wall");
  const wallX=Number(await wall.getAttribute("x")),wallW=Number(await wall.getAttribute("width"));
  const rightEnd=Number(await last.getAttribute("x"))+Number(await last.getAttribute("width"));
  expect((firstX-wallX)/wallW).toBeCloseTo(3/120,7);
  expect((wallX+wallW-rightEnd)/wallW).toBeCloseTo(3/120,7);
  await page.locator("#f-gap").fill("0");
  const w0=Number(await panels.first().getAttribute("width"));
  const xNext=Number(await panels.nth(1).getAttribute("x"));
  expect(xNext-Number(await panels.first().getAttribute("x"))-w0).toBeCloseTo(0,7);
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Right (mm)");
  const download=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await download).path(),"utf8");
  expect(csv).toContain('"Left (mm)","Right (mm)","Width (mm)","Height (mm)","Gap After (mm)"');
  await page.locator("#f-panels").fill("501"); // Whole-count guard: 500 is still a valid panel-count input.
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(panels).toHaveCount(0);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
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
  await page.locator("#f-stock").fill("100");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Stock boards (no offcut reuse)"})).toContainText("44");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Butt joints on joist center references"})).toContainText("22");
  await expect(page.locator("#dimension-svg svg .deck-plan-seam")).toHaveCount(22);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(54);
  await expect(page.locator("#cut-table tbody tr").first()).toContainText("96 in");
  await expect(page.locator("#cut-table tbody tr").nth(1)).toContainText("48 in");
  const down=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const file=await down;
  expect(file.suggestedFilename()).toContain("deck-material-calculator-in-cut-list.csv");
  const {readFileSync}=await import("node:fs");
  const exportText=readFileSync(await file.path(),"utf8");
  expect(exportText).toContain('"Butt Joint At End (in)"');
  expect(exportText).toContain('"Row 1 piece 1","Decking"');
  await page.locator("#f-stock").fill("15.9");
  await expect(page.locator("#calc-error")).toContainText("No intermediate joist center is reachable");
  await expect(page.locator("#dimension-svg svg .deck-plan-seam")).toHaveCount(0);
  await page.locator("#f-stock").fill("96");
  await expect(page.locator("#dimension-svg svg .deck-plan-seam")).toHaveCount(22);
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

test("framing drawing, nominal cut schedule and metric export share member elevations",async({page})=>{
  await page.goto("/framing-calculator/");
  await expect(page.locator("#dimension-svg svg .framing-member")).toHaveCount(10);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(13);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Regular and king cut length"})).toContainText("91.5 in");
  await expect(page.locator('#dimension-svg svg .framing-member[data-cut-length="78.5"]')).toHaveCount(2);
  await page.locator("#f-bottomPlate").fill("2");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Regular and king cut length"})).toContainText("91 in");
  await expect(page.locator('#dimension-svg svg .framing-member[data-cut-length="78"]')).toHaveCount(2);
  await page.locator("#unit-select").selectOption("mm");
  const ready=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await ready).path(),"utf8");
  expect(csv).toContain('"Cut Length (mm)"');
  expect(csv).toContain('"Bottom Elevation (mm)"');
  expect(csv).toContain('"Top Elevation (mm)"');
  expect(csv).toContain('"1981.2"'); // 78-in jack after bottom plate change
  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-topPlate").fill("120");
  await expect(page.locator("#calc-error")).toBeVisible();
});

test("flat and sloped stud drawings expose exactly the exported center-cut pairs",async({page})=>{
  await page.goto("/stud-calculator/");
  const gable=page.locator("#dimension-svg svg .gable-cut-stud");
  await expect(gable).toHaveCount(10);
  await expect(gable.last()).toHaveAttribute("data-position","144");
  await expect(gable.last()).toHaveAttribute("data-cut-length","163.5");
  await expect(page.locator("#dimension-svg svg .gable-gross-reference")).toHaveCount(1);
  await page.locator("#f-plates").fill("5.5");
  await expect(gable.last()).toHaveAttribute("data-cut-length","162.5");
  await page.goto("/wall-stud-calculator/");
  const wall=page.locator("#dimension-svg svg .wall-cut-stud");
  await expect(wall).toHaveCount(9);
  await expect(wall.last()).toHaveAttribute("data-position","120");
  await expect(wall.last()).toHaveAttribute("data-cut-length","91.5");
  await page.locator("#f-length").fill("113");
  await expect(wall).toHaveCount(8);
  await expect(wall.last()).toHaveAttribute("data-position","113");
  await expect(page.locator('#dimension-svg svg .wall-cut-stud[data-position="112"]')).toHaveCount(0);
});

test("rake stud physical face polygons share short/long cuts with the exported row",async({page})=>{
  await page.goto("/stud-calculator/");
  const faces=page.locator("#dimension-svg svg .gable-cut-face");
  await expect(faces).toHaveCount(10);
  await expect(faces.first()).toHaveAttribute("data-left-cut","91.125");
  await expect(faces.first()).toHaveAttribute("data-center-cut","91.5");
  await expect(faces.first()).toHaveAttribute("data-right-cut","91.875");
  await expect(faces.last()).toHaveAttribute("data-left-cut","163.125");
  await expect(faces.last()).toHaveAttribute("data-center-cut","163.5");
  await expect(faces.last()).toHaveAttribute("data-right-cut","163.875");
  await expect(page.locator("#cut-table thead")).toContainText("Left Edge Cut");
  await expect(page.locator("#cut-table thead")).toContainText("Right Edge Cut");
  await page.locator("#f-pitch").fill("0");
  await expect(faces.first()).toHaveAttribute("data-left-cut","91.5");
  await expect(faces.first()).toHaveAttribute("data-right-cut","91.5");
});

test("framing headers, sills and cripple studs follow one browser drawing and CSV schedule",async({page})=>{
  await page.goto("/framing-calculator/");
  const svg=page.locator("#dimension-svg svg");
  await expect(svg.locator(".framing-member")).toHaveCount(10);
  await expect(svg.locator(".framing-header")).toHaveCount(1);
  await expect(svg.locator(".framing-cripple")).toHaveCount(2);
  await expect(svg.locator(".framing-sill")).toHaveCount(0);
  await expect(svg.locator('.framing-header[data-cut-length="39"]')).toHaveCount(1);
  await expect(svg.locator('.framing-cripple[data-cut-length="7.5"]')).toHaveCount(2);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(13);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Total listed pieces"})).toContainText("13");
  await page.locator("#f-opening2Start").fill("82");
  await page.locator("#f-opening2Width").fill("18");
  await page.locator("#f-opening2Height").fill("40");
  await page.locator("#f-opening2Sill").fill("32");
  await expect(svg.locator(".opening-cutout")).toHaveCount(2);
  await expect(svg.locator(".framing-header")).toHaveCount(2);
  await expect(svg.locator(".framing-sill")).toHaveCount(1);
  await expect(svg.locator('.framing-sill[data-cut-length="18"]')).toHaveCount(1);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Window sills"})).toContainText("1");
  await page.locator("#unit-select").selectOption("mm");
  const wait=page.waitForEvent("download");
  await page.locator("#download-csv").click();
  const csv=readFileSync(await (await wait).path(),"utf8");
  expect(csv).toContain('"Stock Depth (mm)"');
  expect(csv).toContain('"Header"');
  expect(csv).toContain('"Sill"');
  expect(csv).toContain('"Upper cripple"');
  expect(csv).toContain('"Lower cripple"');
  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-headerDepth").fill("30");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await page.locator("#f-headerDepth").fill("5.5");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(svg.locator(".framing-header")).toHaveCount(2);
});

test("framing horizontal elevation respects header depth and window sill thickness",async({page})=>{
  await page.goto("/framing-calculator/");
  const svg=page.locator("#dimension-svg svg");
  const header=svg.locator(".framing-header");
  await expect(header).toHaveAttribute("data-bottom","80");
  await expect(header).toHaveAttribute("data-top","85.5");
  await page.locator("#f-headerDepth").fill("7");
  await expect(header).toHaveAttribute("data-top","87");
  await expect(svg.locator('.framing-cripple[data-cut-length="6"]')).toHaveCount(2);
  await page.locator("#f-openingSill").fill("24");
  await page.locator("#f-openingHeight").fill("48");
  await expect(svg.locator(".framing-sill")).toHaveAttribute("data-bottom","22.5");
  await expect(svg.locator(".framing-sill")).toHaveAttribute("data-top","24");
  await expect(svg.locator('.framing-cripple[data-cut-length="21"]')).toHaveCount(2);
  await page.locator("#f-sillThickness").fill("2");
  await expect(svg.locator(".framing-sill")).toHaveAttribute("data-bottom","22");
  await expect(svg.locator('.framing-cripple[data-cut-length="20.5"]')).toHaveCount(2);
});

test("framing stock takeoff, fractional cuts, grouped stick plan and CSV update live",async({page})=>{
  await page.goto("/framing-calculator/");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-material-table tbody tr")).toHaveCount(3);
  await expect(page.locator("#framing-stock-table tbody tr")).toHaveCount(11);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(13);
  await expect(page.locator("#result-cards .metric").filter({hasText:"Planned stock sticks (FFD estimate)"})).toContainText("11");
  await expect(page.locator("#cut-table tbody")).toContainText("≈ 91 1/2 in");
  await expect(page.locator("#framing-stock-table tbody")).toContainText("91 1/2 in");
  await page.locator("#f-stockWaste").fill("10");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Purchase sticks incl. allowance"})).toContainText("13");
  await expect(page.locator("#framing-stock-table tbody tr")).toHaveCount(11);
  await page.locator("#f-stockWaste").fill("0");
  await page.locator("#f-openingWidth").fill("36.03125");
  await page.locator("#fraction-select").selectOption("32");
  await expect(page.locator("#cut-table tbody")).toContainText("39 1/32 in");
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#cut-table thead")).toContainText("Cut Length (mm)");
  const downloading=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  const csv=readFileSync(await (await downloading).path(),"utf8");
  expect(csv).toContain('"Cut Length (mm)"');
  expect(csv).toContain('"Kerf Before (mm)"');
  expect(csv).toContain('"Stock Group"');
  expect(csv).toContain('"Header"');
  expect(csv.split("\r\n").filter(Boolean).length).toBe(15); // header, 13 cuts, source note
  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-studStockLength").fill("90");
  await expect(page.locator("#calc-error")).toContainText("longer stock required");
  await expect(page.locator("#framing-stock-table tbody tr")).toHaveCount(0);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(0);
  await page.locator("#f-studStockLength").fill("96");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-stock-table tbody tr")).toHaveCount(11);
});

test("framing window stock family and printable fraction schedules stay visible",async({page})=>{
  await page.goto("/framing-calculator/");
  await page.locator("#f-opening2Start").fill("82");
  await page.locator("#f-opening2Width").fill("18");
  await page.locator("#f-opening2Height").fill("40");
  await page.locator("#f-opening2Sill").fill("32");
  const material=page.locator("#framing-material-table tbody");
  await expect(material.locator("tr").nth(2)).toContainText("Sill");
  await expect(material.locator("tr").nth(2)).toContainText("18 in");
  await expect(page.locator("#framing-stock-table tbody")).toContainText("SILL-001");
  await expect(page.locator("#cut-table tbody")).toContainText("Lower cripple");
  await page.emulateMedia({media:"print"});
  await expect(page.locator("#print-calibration")).toBeVisible();
  await expect(page.locator("#framing-takeoff")).toBeVisible();
  await expect(page.locator("#framing-material-table")).toBeVisible();
  await expect(page.locator("#framing-stock-table")).toBeVisible();
  await expect(page.locator("#download-stock-csv")).toBeHidden();
  await expect(page.locator("#cut-table tbody")).toContainText("≈");
});


test("framing supplier quotes show partial coverage, reserve costs and no FX conversion",async({page})=>{
  await page.goto("/framing-calculator/");
  const summary=page.locator("#framing-price-status");
  await expect(summary).toContainText("prices required: Stud, Header");
  await expect(summary).toContainText("NOT a complete purchase total");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Quoted purchase total"})).toHaveCount(0);
  const quote=page.locator("#framing-price-table tbody");
  await expect(quote.locator("tr")).toHaveCount(3);
  await expect(quote.locator("tr").first()).toContainText("Quote needed");
  await page.locator("#f-studUnitPrice").fill("5.50");
  await expect(summary).toContainText("priced groups subtotal USD 55.00");
  await expect(summary).toContainText("prices required: Header");
  await page.locator("#f-headerUnitPrice").fill("14.25");
  await expect(summary).toContainText("Estimated quoted lumber purchase: USD 69.25");
  await expect(summary).toContainText("reserve USD 0.00");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Quoted purchase total"})).toContainText("USD 69.25");
  await expect(quote.locator("tr").nth(0)).toContainText("USD 55.00");
  await expect(quote.locator("tr").nth(1)).toContainText("USD 14.25");
  await page.locator("#f-stockWaste").fill("10");
  await expect(summary).toContainText("USD 89.00");
  await expect(summary).toContainText("reserve USD 19.75");
  await expect(page.locator("#framing-ticket-list li")).toHaveCount(2);
  await expect(page.locator("#framing-ticket-status")).toContainText("USD 89.00");
  await page.locator("#framing-currency").selectOption("BRL");
  await expect(summary).toContainText("BRL 89.00");
  await expect(summary).not.toContainText("USD");
  await expect(page.locator("#framing-ticket-list")).toContainText("BRL 60.50");
  await page.locator("#unit-select").selectOption("mm");
  await expect(summary).toContainText("BRL 89.00"); // Length unit must not change quoted money
  const download=page.waitForEvent("download");
  await page.locator("#download-price-csv").click();
  const csv=readFileSync(await(await download).path(),"utf8");
  expect(csv).toContain('"Stock Length (mm)"');
  expect(csv).toContain('"Unit Price"');
  expect(csv).toContain('"Planned Sticks"');
  expect(csv).toContain('"Purchase Cost"');
  expect(csv).toContain('"BRL"');
  expect(csv).not.toContain('"Total Job Estimate"'); // No tax, hardware, labor or complete-job claim
  expect(csv).not.toContain('"Unit Price (mm)"');
  await page.locator("#unit-select").selectOption("in");
  await page.locator("#f-studUnitPrice").fill("-1");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(quote.locator("tr")).toHaveCount(0);
  await expect(page.locator("#framing-ticket-list li")).toHaveCount(0);
  await page.locator("#f-studUnitPrice").fill("5.5");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(summary).toContainText("BRL 89.00");
});

test("framing purchasing ticket and quote details are printable without export controls",async({page})=>{
  await page.goto("/framing-calculator/");
  await page.locator("#f-studUnitPrice").fill("7.25");
  await page.locator("#f-headerUnitPrice").fill("14");
  await page.locator("#f-stockWaste").fill("10");
  await page.emulateMedia({media:"print"});
  await expect(page.locator("#framing-order-ticket")).toBeVisible();
  await expect(page.locator("#framing-price-table")).toBeVisible();
  await expect(page.locator("#framing-material-table")).toBeVisible();
  await expect(page.locator("#framing-stock-table")).toBeVisible();
  await expect(page.locator("#framing-ticket-list li")).toHaveCount(2);
  await expect(page.locator("#framing-ticket-list")).toContainText("planned 10 + reserve 1");
  await expect(page.locator("#framing-ticket-list")).toContainText("USD 79.75");
  await expect(page.locator("#framing-ticket-status")).toContainText("Total material quote");
  await expect(page.locator("#framing-currency")).toBeHidden();
  await expect(page.locator("#download-price-csv")).toBeHidden();
  await expect(page.locator("#download-stock-csv")).toBeHidden();
  await expect(page.locator("#print-calibration")).toBeVisible();
  await expect(page.locator("#cut-table tbody")).toContainText("≈");
});


test("framing quoted 8/10/12ft supplier offers select and export a mixed stock plan",async({page})=>{
  await page.goto("/framing-calculator/");
  const details=page.locator("#framing-stock-options");
  await expect(details).not.toHaveAttribute("open");
  await details.locator("summary").click();
  await expect(page.locator("#f-studAltUnitPrice")).toBeVisible();
  await page.locator("#f-wallHeight").fill("80");
  await page.locator("#f-openingHeight").fill("60");
  await page.locator("#f-studUnitPrice").fill("8");
  await page.locator("#f-headerUnitPrice").fill("12");
  await page.locator("#f-studAltUnitPrice").fill("8.2");
  await page.locator("#f-studAlt2UnitPrice").fill("8.5");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-price-status")).toContainText("USD 77.00");
  await expect(page.locator("#framing-material-table tbody tr").first()).toContainText("Mixed lengths");
  const plans=page.locator("#framing-offer-table tbody");
  await expect(plans.locator("tr")).toHaveCount(7); // Three single plans, greedy, exact, plus two Header candidates
  await expect(plans.locator("tr.selected-plan").first()).toContainText("Exhaustive small-layout plan");
  await expect(plans.locator("tr.selected-plan").first()).toContainText("USD 65.00");
  await expect(plans).toContainText("Greedy mixed lengths");
  await expect(plans).toContainText("USD 65.20");
  await expect(plans).toContainText("Single length · Base");
  await expect(plans).toContainText("Single length · Alternative 1");
  await expect(plans).toContainText("Single length · Alternative 2");
  const ticket=page.locator("#framing-ticket-list");
  await expect(ticket.locator("li")).toHaveCount(3);
  await expect(ticket).toContainText("6 sticks × 96 in");
  await expect(ticket).toContainText("2 sticks × 144 in");
  await expect(page.locator("#framing-stock-table tbody tr")).toHaveCount(9);
  await expect(page.locator("#cut-table tbody tr")).toHaveCount(13);
  await page.locator("#unit-select").selectOption("mm");
  await expect(page.locator("#framing-price-status")).toContainText("USD 77.00");
  const quoteDownload=page.waitForEvent("download");
  await page.locator("#download-price-csv").click();
  const csv=readFileSync(await(await quoteDownload).path(),"utf8");
  expect(csv).toContain('"Offer Label"');
  expect(csv).not.toContain('"Alternative 1"');
  expect(csv).toContain('"Alternative 2"');
  expect(csv).not.toContain('"3048"');
  expect(csv).toContain('"3657.6"');
  expect(csv).toContain('"Purchase Cost"');
  expect(csv).not.toContain('"Unit Price (mm)"');
  expect(csv.split("\r\n").filter(Boolean)).toHaveLength(6);
  const cutDownload=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  const cuts=readFileSync(await(await cutDownload).path(),"utf8");
  expect(cuts).toContain('"Offer Label"');
  expect(cuts).toContain('"Stock Length (mm)"');
  expect(cuts.split("\r\n").filter(Boolean)).toHaveLength(15);
});

test("framing reserve allowance switches lowest quoted plan and print ticket",async({page})=>{
  await page.goto("/framing-calculator/");
  await page.locator("#framing-stock-options summary").click();
  await page.locator("#f-wallHeight").fill("80");
  await page.locator("#f-openingHeight").fill("60");
  await page.locator("#f-studUnitPrice").fill("8");
  await page.locator("#f-studAltUnitPrice").fill("8.2");
  await page.locator("#f-studAlt2UnitPrice").fill("8.5");
  await page.locator("#f-headerUnitPrice").fill("12");
  await expect(page.locator("#framing-price-status")).toContainText("USD 77.00");
  await page.locator("#f-stockWaste").fill("10");
  await expect(page.locator("#framing-price-status")).toContainText("USD 100.50");
  await expect(page.locator("#framing-price-status")).toContainText("reserve USD 20.50");
  await expect(page.locator("#framing-offer-table .selected-plan").first()).toContainText("Exhaustive small-layout plan · Alternative 2");
  const ticket=page.locator("#framing-ticket-list");
  await expect(ticket.locator("li")).toHaveCount(2);
  await expect(ticket).toContainText("9 sticks × 144 in");
  await expect(ticket).toContainText("2 sticks × 96 in");
  await page.locator("#framing-currency").selectOption("BRL");
  await expect(page.locator("#framing-price-status")).toContainText("BRL 100.50");
  await page.emulateMedia({media:"print"});
  await expect(page.locator("#framing-order-ticket")).toBeVisible();
  await expect(page.locator("#framing-offer-table")).toBeVisible();
  await expect(page.locator("#framing-stock-options")).toBeHidden();
  await expect(page.locator("#download-price-csv")).toBeHidden();
  await expect(page.locator("#framing-ticket-status")).toContainText("BRL 100.50");
});

test("invalid alternative supplier quote clears stale results and restores comparison",async({page})=>{
  await page.goto("/framing-calculator/");
  await page.locator("#framing-stock-options summary").click();
  await page.locator("#f-studUnitPrice").fill("8");
  await page.locator("#f-headerUnitPrice").fill("12");
  await page.locator("#f-studAltUnitPrice").fill("8.555");
  await expect(page.locator("#calc-error")).toContainText("two decimal places");
  await expect(page.locator("#framing-offer-table tbody tr")).toHaveCount(0);
  await expect(page.locator("#framing-ticket-list li")).toHaveCount(0);
  await page.locator("#f-studAltUnitPrice").fill("8.2");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-offer-table tbody tr").first()).toBeVisible();
  await page.locator("#f-studAltStockLength").fill("0");
  await expect(page.locator("#calc-error")).toContainText("needs a positive purchased length");
  await page.locator("#f-studAltStockLength").fill("120");
  await expect(page.locator("#calc-error")).toBeHidden();
  await page.locator("#reset-values").click();
  await expect(page.locator("#f-studAltUnitPrice")).toHaveValue("0");
  await expect(page.locator("#framing-price-status")).toContainText("prices required: Stud, Header");
  await expect(page.locator("#framing-stock-table tbody tr")).toHaveCount(11);
});


test("small quoted framing wall displays earned exact optimality proof on-screen and in print",async({page})=>{
  await page.goto("/framing-calculator/");
  await page.locator("#f-length").fill("64");
  await page.locator("#f-openingStart").fill("16");
  await page.locator("#f-openingWidth").fill("24");
  await page.locator("#f-wallHeight").fill("80");
  await page.locator("#f-openingHeight").fill("60");
  await page.locator("#f-studUnitPrice").fill("8");
  await page.locator("#f-headerUnitPrice").fill("12");
  await expect(page.locator("#calc-error")).toBeHidden();
  const status=page.locator("#framing-optimizer-status");
  await expect(status).toContainText("CERTIFIED: lowest purchase cost");
  await expect(status).toContainText("all 2 required material families");
  const proof=page.locator("#framing-proof-table tbody");
  await expect(proof.locator("tr")).toHaveCount(3);
  await expect(proof.locator("tr").nth(0)).toContainText("Completed memoized exact search");
  await expect(proof.locator("tr").nth(0)).toContainText("PROVEN optimal in model");
  await expect(proof.locator("tr").nth(1)).toContainText("PROVEN optimal in model");
  await expect(proof.locator("tr").nth(2)).toContainText("No material required");
  await expect(page.locator("#framing-offer-table tr.selected-plan")).toHaveCount(2);
  await expect(page.locator("#framing-offer-table tr.selected-plan").first()).toContainText("Exhaustive small-layout plan");
  await expect(page.locator("#result-cards .metric").filter({hasText:"Proven optimal material families"})).toContainText("2");
  await page.emulateMedia({media:"print"});
  await expect(page.locator("#framing-optimizer-panel")).toBeVisible();
  await expect(page.locator("#framing-proof-table")).toBeVisible();
  await expect(status).toContainText("CERTIFIED");
  await expect(page.locator("#framing-stock-options")).toBeHidden();
  await expect(page.locator("#framing-ticket-list li")).toHaveCount(2);
});
test("over-limit framing still computes purchases but never claims global optimum",async({page})=>{
  await page.goto("/framing-calculator/");
  await page.locator("#f-length").fill("240");
  await page.locator("#f-studUnitPrice").fill("5.5");
  await page.locator("#f-headerUnitPrice").fill("14.25");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-price-status")).toContainText("Estimated quoted lumber purchase: USD");
  await expect(page.locator("#framing-optimizer-status")).toContainText("NOT CERTIFIED");
  await expect(page.locator("#framing-optimizer-status")).toContainText("1 of 2");
  await expect(page.locator("#framing-proof-table tbody tr").nth(0)).toContainText("Heuristic (over 16 pieces)");
  await expect(page.locator("#framing-proof-table tbody tr").nth(1)).toContainText("Completed memoized exact search");
  await page.locator("#f-headerUnitPrice").fill("0");
  await expect(page.locator("#framing-optimizer-status")).toContainText("Missing supplier quotes");
  await expect(page.locator("#framing-optimizer-status")).toContainText("NOT CERTIFIED");
  await expect(page.locator("#framing-proof-table tbody tr").nth(1)).toContainText("Quote required");
  await page.locator("#f-headerUnitPrice").fill("14.25");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-optimizer-status")).toContainText("NOT CERTIFIED");
});


test("memoization certifies default twelve-cut Framing wall and shows reused states",async({page})=>{
  await page.goto("/framing-calculator/");
  await page.locator("#f-studUnitPrice").fill("5.5");
  await page.locator("#f-headerUnitPrice").fill("14.25");
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#framing-price-status")).toContainText("USD 69.25");
  await expect(page.locator("#framing-optimizer-status")).toContainText("CERTIFIED: lowest purchase cost");
  await expect(page.locator("#framing-proof-table tbody tr").nth(0)).toContainText("Completed memoized exact search");
  await expect(page.locator("#framing-proof-table tbody tr").nth(0)).toContainText("12");
  await expect(page.locator("#framing-proof-table tbody tr").nth(0)).toContainText("PROVEN optimal in model");
  await expect(page.locator("#framing-proof-table thead")).toContainText("Distinct states");
  await expect(page.locator("#framing-proof-table thead")).toContainText("Merged repeats");
  await expect(page.locator("#framing-material-table tbody tr")).toHaveCount(3);
  await expect(page.locator("#framing-stock-table tbody tr")).toHaveCount(11);
  const download=page.waitForEvent("download");
  await page.locator("#download-stock-csv").click();
  const csv=readFileSync(await(await download).path(),"utf8");
  expect(csv.split("\r\n").filter(Boolean).length).toBe(15);
});


test("all 26 tools retain blank inputs across unit changes and expose accessible error recovery",async({page})=>{
  const pageErrors=[];
  page.on("pageerror",err=>pageErrors.push(err.message));
  for(const tool of active){
    await page.goto("/"+tool.slug+"/");
    const f=tool.inputs.find(x=>x.kind==="L")||
      tool.inputs.find(x=>!x.options);
    expect(f,tool.slug+" needs an editable field").toBeTruthy();
    const field=page.locator("#f-"+f.key),note="field-note-"+f.key;
    await expect(field,tool.slug).toHaveAttribute("aria-describedby",note);
    await field.fill("");
    await expect(page.locator("#calc-error"),tool.slug).toContainText(f.label+" is required");
    await expect(field,tool.slug).toHaveAttribute("aria-invalid","true");
    await expect(field,tool.slug).toHaveAttribute("aria-describedby",note+" calc-error");
    await expect(page.locator("#result-cards .metric"),tool.slug).toHaveCount(0);
    await expect(page.locator("#dimension-svg svg"),tool.slug).toHaveCount(0);
    await page.locator("#unit-select").selectOption("mm");
    await expect(field,tool.slug).toHaveValue("");
    await expect(page.locator("#calc-error"),tool.slug).toBeVisible();
    const target=f.kind==="L"?Number((f.value*25.4).toFixed(6)):f.value;
    await field.fill(String(target));
    await expect(page.locator("#calc-error"),tool.slug).toBeHidden();
    await expect(field,tool.slug).not.toHaveAttribute("aria-invalid","true");
    await expect(field,tool.slug).toHaveAttribute("aria-describedby",note);
    await expect(page.locator("#result-cards .metric").first(),tool.slug).toBeVisible();
    await expect(page.locator("#dimension-svg svg"),tool.slug).toHaveCount(1);
    await page.locator("#unit-select").selectOption("in");
    const restored=Number(await field.inputValue());
    expect(restored,tool.slug+" physical input conversion").toBeCloseTo(Number(f.value),4);
  }
  expect(pageErrors).toEqual([]);
});

test("calculator forms prevent accidental Enter submits and maintain accessible live feedback",async({page})=>{
  await page.goto("/stud-calculator/");
  const start=await page.locator("#f-length").inputValue();
  await page.locator("#calculator-form").evaluate(form=>form.requestSubmit());
  await expect(page.locator("#f-length")).toHaveValue(start);
  await expect(page.locator("#calc-error")).toBeHidden();
  await expect(page.locator("#result-cards .metric").first()).toBeVisible();
  await page.locator("#f-length").fill("");
  await expect(page.locator("#calc-error")).toBeVisible();
  await expect(page.locator("#calc-error")).toHaveAttribute("role","alert");
  await page.locator("#reset-values").click();
  await expect(page.locator("#f-length")).toHaveValue(start);
  await expect(page.locator("#f-length")).not.toHaveAttribute("aria-invalid","true");
  await expect(page.locator("#calc-error")).toBeHidden();
});

test("all 26 calculator routes fit a 360px mobile viewport without page-wide horizontal overflow",async({page})=>{
  await page.setViewportSize({width:360,height:760});
  for(const tool of active){
    const response=await page.goto("/"+tool.slug+"/");
    expect(response.status(),tool.slug).toBe(200);
    await expect(page.locator("#result-cards .metric").first(),tool.slug).toBeVisible();
    const dimensions=await page.evaluate(()=>({
      client:document.documentElement.clientWidth,
      scroll:document.documentElement.scrollWidth,
      body:document.body.scrollWidth
    }));
    expect(dimensions.scroll,tool.slug+" page overflow").toBeLessThanOrEqual(dimensions.client+1);
    expect(dimensions.body,tool.slug+" body overflow").toBeLessThanOrEqual(dimensions.client+1);
  }
});
