import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {compute,convertFromInches} from "../../src/calcs.mjs";
import {scheduleColumns} from "../../src/cut-list.mjs";

// A sitewide regression contract, not a second copy of the calculation
// formulas. The engine, screen, SVG and downloaded CSV must agree; the
// trade calculations themselves also have independent numerical fixtures.
const registry=JSON.parse(readFileSync(new URL("../../src/tools.json",import.meta.url),"utf8"));
const active=registry.tools.filter(t=>t.priority==="P0"||t.priority==="P1");
const defaults=t=>Object.fromEntries(t.inputs.map(f=>[f.key,f.value]));
const approx=(a,b,eps=1e-6)=>expect(
  Math.abs(a-b), "Expected "+b+", got "+a
).toBeLessThanOrEqual(eps);
const att=async(el,key)=>Number(await el.getAttribute(key));

function csvCells(source){
  const s=source.replace(/^\uFEFF/,"");
  let quoted=false,field="",row=[],records=[];
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==='"'){
      if(quoted&&s[i+1]==='"'){field+='"';i++;}
      else quoted=!quoted;
    }else if(!quoted&&c===","){row.push(field);field="";}
    else if(!quoted&&(c==="\r"||c==="\n")){
      if(c==="\r"&&s[i+1]==="\n")i++;
      row.push(field);records.push(row);row=[];field="";
    }else field+=c;
  }
  expect(quoted).toBe(false);
  if(row.length||field)records.push([...row,field]);
  return records;
}
const sourceCount=model=>{
  const shapes={
    slope:[".gable-cut-face",model.studRows?.length],
    opening:[".opening-cutout",model.openings?.length],
    boards:[".deck-board-face",model.boardRows?.length],
    balusters:[".baluster-face",model.faceRows?.length],
    rafter:[".rafter-stock-section",1],
    angles:[".crown-miter-ray",1],
    "soffit-section":[".soffit-rafter",1],
    kerfs:[".kerf-slot",model.marks?.length],
    panels:[".wainscot-panel",model.panelRows?.length],
    stairs:[".stair-riser",model.stairRows?.length],
    triangle:[".roof-pitch-slope",1],
    "deck-plan":[".deck-plan-board",model.deckRows?.length],
    ring:[".ring-segment-face",model.segments],
    ruler:[".axis",1],
    "spacing-faces":[".equal-part-face",model.faceRows?.length],
    "hip-line":[".hip-plan-diagonal",1],
    "roof-panels":[".roof-panel-cut",model.roofPanels?.length],
    "wall-studs":[".wall-cut-stud",model.studRows?.length],
    shelves:[".shelf-face",model.shelfRows?.length],
    rectangle:[".square-target-outline",1],
    brace:[".brace-cut-centerline",1],
    holes:[".drill-hole",model.holeCenters?.length],
    stringer:[".stringer-step-profile",1],
    "sheathing-panels":[".sheathing-cut",model.roofSheets?.length],
    posts:[".post-face",model.faceRows?.length],
    "picket-layout":[".picket-face",model.faceRows?.length],
    "gambrel-profile":[".gambrel-slope-segment",model.gambrelRows?.length],
    "lumber-board":[".lumber-board-face",1]
  };
  const found=shapes[model.shape];
  expect(found,"Missing explicit SVG family assertion for "+model.shape).toBeTruthy();
  expect(Number.isInteger(found[1])&&found[1]>=1).toBe(true);
  return found;
};
const units=["in","mm"];

function expectedMetricValue(metric,unit){
  if(metric.kind==="L")return convertFromInches(metric.value,unit);
  if(metric.kind==="FT")return unit==="mm"?metric.value*.3048:metric.value;
  if(metric.kind==="FT2")return unit==="mm"?metric.value*.09290304:metric.value;
  return metric.value;
}
const numberInText=txt=>{
  const match=txt.match(/-?\d[\d,]*(?:\.\d+)?(?:e[+-]?\d+)?/i);
  expect(match,"Expected numeric text, got "+txt).toBeTruthy();
  return Number(match[0].replace(/,/g,""));
};

function checkRows(record,columns,data,unit){
  expect(record.length).toBe(columns.length);
  for(let i=0;i<columns.length;i++){
    const col=columns[i],raw=data[col.key],cell=record[i];
    if(raw===null||raw===undefined){expect(cell,col.key).toBe("");continue;}
    if(col.kind==="vertices"){
      const parsed=JSON.parse(cell);
      expect(parsed.length).toBe(raw.length);
      for(let j=0;j<parsed.length;j++)for(let k=0;k<parsed[j].length;k++)
        approx(parsed[j][k],convertFromInches(raw[j][k],unit),unit==="mm"?1.1e-6:1e-7);
      continue;
    }
    if(col.kind==="lengthList"){
      const parsed=cell?cell.split("; ").map(Number):[];
      expect(parsed.length).toBe(raw.length);
      for(let j=0;j<parsed.length;j++)
        approx(parsed[j],convertFromInches(raw[j],unit),unit==="mm"?1.1e-6:1e-7);
      continue;
    }
    if(typeof raw==="number"){
      const expected=col.kind==="length"?convertFromInches(raw,unit):
        col.kind==="area"&&unit==="mm"?raw*.09290304:raw;
      approx(Number(cell),expected,
        col.kind==="length"&&unit==="mm"?1.1e-6:
        Math.max(1e-7,Math.abs(expected)*1e-10));
    }else expect(cell).toBe(String(raw));
  }
}

async function checkSvg(page,model){
  const root=page.locator("#dimension-svg svg");
  await expect(root).toHaveCount(1);
  expect(await root.getAttribute("viewBox")).toBe("0 0 900 344");
  expect(await root.getAttribute("data-model-shape")).toBe(model.shape);
  approx(await att(root,"data-model-span-in"),model.span,1e-7);
  const [selector,n]=sourceCount(model);
  await expect(root.locator(selector)).toHaveCount(n);
  const common=(element,attrib,expected)=>att(element,attrib).then(actual=>approx(actual,expected,1e-7));
  // Diagram annotations are physical engine coordinates, not rounded
  // screenshots. The following catches a wrong row/column or shifted datum.
  if(model.shape==="slope"){
    for(const [i,row] of model.studRows.entries()){
      const e=root.locator(".gable-cut-face").nth(i);
      await common(e,"data-position",row.position);
      await common(e,"data-center-cut",row.length);
      await common(e,"data-left-cut",row.leftEdgeCut);
      await common(e,"data-right-cut",row.rightEdgeCut);
    }
  }else if(model.shape==="boards"||model.shape==="panels"){
    const isBoard=model.shape==="boards",rows=isBoard?model.boardRows:model.panelRows;
    const selector=isBoard?".deck-board-face":".wainscot-panel";
    for(const [i,row] of rows.entries()){
      const e=root.locator(selector).nth(i);
      approx(await att(e,"x"),74+row.left/model.span*776,1e-5);
      approx(await att(e,"width"),(row.right-row.left)/model.span*776,1e-5);
    }
  }else if(model.shape==="holes"){
    for(const [i,hole] of model.holeCenters.entries()){
      const e=root.locator(".drill-hole").nth(i);
      await common(e,"data-x",hole.x);await common(e,"data-y",hole.y);
    }
  }else if(model.shape==="wall-studs"){
    for(const [i,row] of model.studRows.entries()){
      const e=root.locator(".wall-cut-stud").nth(i);
      await common(e,"data-position",row.position);
      await common(e,"data-cut-length",row.cutLength);
    }
  }else if(model.shape==="deck-plan"){
    for(const [i,row] of model.deckRows.entries()){
      const e=root.locator(".deck-plan-board").nth(i);
      await common(e,"data-across-start",row.acrossStart);
      await common(e,"data-rip-width",row.ripWidth);
    }
  }else if(model.shape==="sheathing-panels"){
    for(const [i,row] of model.roofSheets.entries()){
      const e=root.locator(".sheathing-cut").nth(i);
      await common(e,"data-row",row.row);await common(e,"data-column",row.column);
      await common(e,"data-cut-along",row.cutAlong);
      await common(e,"data-cut-uphill",row.cutUphill);
    }
  }else if(model.shape==="roof-panels"){
    for(const [i,row] of model.roofPanels.entries()){
      const e=root.locator(".roof-panel-cut").nth(i);
      await common(e,"data-row",row.row);await common(e,"data-column",row.column);
      await common(e,"data-plane",row.planeIndex);
      const pts=(await e.getAttribute("points")).trim().split(/\s+/);
      expect(pts.length).toBe(row.planPoints.length);
      for(const p of pts)expect(p.split(",").every(v=>Number.isFinite(Number(v)))).toBe(true);
    }
  }else if(model.shape==="rafter"){
    const e=root.locator(".rafter-seat-reference");
    await common(e,"data-start-x",model.seatStart.x);
    await common(e,"data-start-y",model.seatStart.y);
    await common(e,"data-end-x",model.heelTop.x);
    await common(e,"data-end-y",model.heelTop.y);
  }else if(model.shape==="stairs"){
    for(const [i,row] of model.stairRows.entries()){
      const e=root.locator(".stair-riser").nth(i);
      await common(e,"data-horizontal-run",row.run);
      await common(e,"data-top-rise",row.rise);
    }
  }else if(model.shape==="shelves"){
    for(const [i,row] of model.shelfRows.entries()){
      const e=root.locator(".shelf-face").nth(i);
      await common(e,"data-shelf-bottom",row.shelfBottom);
      await common(e,"data-shelf-top",row.shelfTop);
    }
  }else if(model.shape==="brace"){
    const line=root.locator(".brace-cut-centerline");
    await common(line,"data-start-x",model.braceCutRows[0].horizontalX);
    await common(line,"data-start-y",model.braceCutRows[0].verticalY);
    await common(line,"data-end-x",model.braceCutRows[1].horizontalX);
    await common(line,"data-end-y",model.braceCutRows[1].verticalY);
  }else if(model.shape==="lumber-board"){
    const el=root.locator(".lumber-board-face"),b=model.lumberBoard;
    await common(el,"data-length-in",b.length);
    await common(el,"data-width-in",b.width);
    await common(el,"data-thickness-in",b.thickness);
    approx((await att(el,"width"))/(await att(el,"height")),b.length/b.width,1e-8);
  }else if(model.shape==="triangle"){
    const slope=root.locator(".roof-pitch-slope");
    const dx=(await att(slope,"x2"))-(await att(slope,"x1"));
    const dy=(await att(slope,"y1"))-(await att(slope,"y2"));
    approx(dy/dx,model.rise/model.run,1e-8);
  }else if(model.shape==="stringer"){
    await common(root.locator(".stringer-step-profile"),"data-vertices",model.stepVertices.length);
  }else if(model.shape==="picket-layout"){
    for(const [i,r] of model.faceRows.entries()){
      const el=root.locator(".picket-face").nth(i);
      await common(el,"data-face-left",r.faceLeft);
      await common(el,"data-face-right",r.faceRight);
      await common(el,"data-center",r.position);
      await common(el,"data-cut-height",r.cutHeight);
      const h=await att(el,"height"),w=await att(el,"width");
      approx(h/w,r.cutHeight/(r.faceRight-r.faceLeft),1e-6);
    }
  }else if(model.shape==="gambrel-profile"){
    for(const [i,r] of model.gambrelRows.entries()){
      const el=root.locator(".gambrel-slope-segment").nth(i);
      await common(el,"data-start-x",r.startX);
      await common(el,"data-end-x",r.endX);
      await common(el,"data-start-height",r.startHeight);
      await common(el,"data-end-height",r.endHeight);
      await common(el,"data-slope-length",r.slopedLength);
      const dx=Math.abs((await att(el,"x2"))-(await att(el,"x1")));
      const dy=Math.abs((await att(el,"y2"))-(await att(el,"y1")));
      approx(dy/dx,r.verticalRise/r.horizontalRun,1e-8);
    }
  }
}

for(const tool of active){
  test(tool.slug+" · screen metrics, scale-identified SVG and all typed CSV coordinates",async({page})=>{
    test.setTimeout(95000);
    const model=compute(tool.slug,defaults(tool));
    const resp=await page.goto("/"+tool.slug+"/");
    expect(resp?.status()).toBe(200);
    await expect(page.locator("#calc-error")).toBeHidden();
    for(const unit of units){
      if(unit==="mm")await page.locator("#unit-select").selectOption("mm");
      await expect(page.locator("#result-cards .metric")).toHaveCount(model.metrics.length);
      for(const [i,m] of model.metrics.entries()){
        const el=page.locator("#result-cards .metric").nth(i);
        expect((await el.locator("span").first().textContent()).trim()).toBe(m.label);
        const amount=numberInText(await el.locator("strong").textContent());
        const expected=expectedMetricValue(m,unit);
        const tolerance=m.kind==="N"?0.001:m.kind==="L"?
          (unit==="mm"?0.011:0.0011):m.kind==="C"?0.011:0.0011;
        approx(amount,expected,tolerance);
      }
      await checkSvg(page,model);
      const dl=page.waitForEvent("download");
      await page.locator("#download-csv").click();
      const file=await dl,csv=csvCells(readFileSync(await file.path(),"utf8"));
      expect(csv.length).toBe(model.rows.length?model.rows.length+2:model.metrics.length+2);
      if(model.rows.length){
        const cols=scheduleColumns(model.rows,unit);
        expect(csv[0]).toEqual(cols.map(x=>x.label));
        for(let i=0;i<model.rows.length;i++)checkRows(csv[i+1],cols,model.rows[i],unit);
      }else{
        expect(csv[0]).toEqual(["Measurement","Value","Unit"]);
        for(let i=0;i<model.metrics.length;i++){
          expect(csv[i+1][0]).toBe(model.metrics[i].label);
          approx(Number(csv[i+1][1]),expectedMetricValue(model.metrics[i],unit),1e-5);
        }
      }
      expect(csv.at(-1)[0]).toBe("Source note");
    }
  });
}
test("all active routes have explicit screenshot-family assertions",()=>{
  expect(active.length).toBe(29);
  expect(new Set(active.map(x=>x.slug)).size).toBe(29);
  expect(registry.tools.filter(x=>x.priority==="P2").length).toBe(2);
});
