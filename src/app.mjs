import {safeCompute,convertToInches,convertFromInches,convertEditableLength,inchFraction} from "./calcs.mjs";
import {createMeasurementFragment,parseMeasurementFragment} from "./measurement-links.mjs";
import {buildMeasurementFile,parseMeasurementFile} from "./measurement-files.mjs";
import {parseEditableLength} from "./length-entry.mjs";
import {buildScheduleCsv,buildMetricsCsv,scheduleColumns} from "./cut-list.mjs";
import {makeFramingStationLedger,auditMeasuredFramingFits,assessFramingPurchaseReview} from "./framing-stations.mjs";
import {makeFramingReviewVersion,validateFramingReviewVersion,
  compareFramingReviewVersions,framingReviewVersionNote,
  proposeFramingMeasurementRestore} from "./framing-review-versions.mjs";
const slug=document.body.dataset.tool;
if(slug){
  const tool=await fetch("/assets/tool-config/"+encodeURIComponent(slug)+".json").then(r=>{
    if(!r.ok)throw Error("Missing calculator configuration.");
    return r.json();
  });
  if(!tool||tool.slug!==slug||!["P0","P1"].includes(tool.priority))
    throw Error("Unavailable calculator.");
  const form=document.querySelector("#calculator-form"),out=document.querySelector("#result-cards"),cut=document.querySelector("#cut-table"),diagram=document.querySelector("#dimension-svg"),error=document.querySelector("#calc-error"),units=document.querySelector("#unit-select"),fraction=document.querySelector("#fraction-select"),copy=document.querySelector("#copy-result"),csv=document.querySelector("#download-csv"),svg=document.querySelector("#download-svg"),print=document.querySelector("#print-sheet"),reset=document.querySelector("#reset-values"),share=document.querySelector("#share-measurements"),measurementSave=document.querySelector("#download-measurements-json"),measurementImport=document.querySelector("#load-measurements-json"),zoomPlus=document.querySelector("#zoom-in"),zoomMinus=document.querySelector("#zoom-out"),zoomReset=document.querySelector("#zoom-reset"),status=document.querySelector("#action-status");
  // Reset recovery is intentionally in memory only. Neither invalid input
  // contents nor supplier prices are persisted or transmitted by this UI.
  const undoReset=document.querySelector("#undo-reset");
  const reviewInvalid=document.querySelector("#review-invalid");
  let resetSnapshot=null;
  let reviewField=null;
  const clearResetUndo=()=>{
    resetSnapshot=null;
    undoReset.hidden=true;
  };
  reviewInvalid?.addEventListener("click",()=>{
    if(!reviewField||!reviewField.isConnected||reviewField.closest("[hidden]"))return;
    // A targeted validation error may belong to advanced stock options.
    // Expand its existing disclosure before scrolling/focusing the real input.
    const details=reviewField.closest("details");
    if(details)details.open=true;
    reviewField.focus({preventScroll:true});
    reviewField.scrollIntoView({
      block:"center",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"
    });
  });
  // Real anchor navigation, not simulated tabs or duplicated calculator state.
  // Share links with #measure= continue to work independently of these anchors.
  const dockLabel=document.querySelector("#dock-primary-label");
  const dockValue=document.querySelector("#dock-primary-value");
  const dockSummary=document.querySelector(".dock-summary");
  const dockLinks=[...document.querySelectorAll(".dock-links a")];
  const dock=document.querySelector(".workbench-dock");
  const dockToggle=document.querySelector("#dock-toggle");
  const dockMobile=window.matchMedia("(max-width: 680px)");
  let dockScrolled=false,dockUserExpanded=false,dockScrollFrame=0;
  const syncCompactDock=()=>{
    dockScrollFrame=0;
    if(!dock||!dockToggle)return;
    const shouldCompact=dockMobile.matches && window.scrollY>310;
    // Preserve the expanded navigation after an explicit anchor click.
    // Only reset when the user scrolls back above the compact threshold.
    if(!shouldCompact&&dockScrolled)dockUserExpanded=false;
    dockScrolled=shouldCompact;
    dock.classList.toggle("is-compact",shouldCompact);
    dock.classList.toggle("is-expanded",shouldCompact&&dockUserExpanded);
    dockToggle.hidden=!shouldCompact;
    dockToggle.setAttribute("aria-expanded",String(!shouldCompact||dockUserExpanded));
  };
  dockToggle?.addEventListener("click",()=>{
    dockUserExpanded=!dockUserExpanded;
    syncCompactDock();
    if(dockUserExpanded)dockLinks[0]?.focus({preventScroll:true});
  });
  dockLinks.forEach(link=>link.addEventListener("click",()=>{
    dockUserExpanded=true;
    syncCompactDock();
  }));
  window.addEventListener("scroll",()=>{
    if(!dockScrollFrame) dockScrollFrame=requestAnimationFrame(syncCompactDock);
  },{passive:true});
  dockMobile.addEventListener("change",syncCompactDock);
  syncCompactDock();
  const mobileMenu=document.querySelector(".mobile-site-menu");
  document.addEventListener("click",event=>{
    if(mobileMenu?.open&&!mobileMenu.contains(event.target))mobileMenu.open=false;
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&mobileMenu?.open){
      mobileMenu.open=false;mobileMenu.querySelector("summary")?.focus();
    }
  });
  const syncDockLocation=()=>{
    const current=window.location.hash;
    for(const link of dockLinks){
      if(link.getAttribute("href")===current)link.setAttribute("aria-current","location");
      else link.removeAttribute("aria-current");
    }
  };
  syncDockLocation();
  window.addEventListener("hashchange",syncDockLocation);
  const updateDockSummary=(label,value,invalid=false)=>{
    if(!dockLabel||!dockValue||!dockSummary)return;
    dockLabel.textContent=label;
    const changed=dockValue.textContent!==value;
    dockValue.textContent=value;
    dockValue.title=value;
    dockSummary.classList.toggle("is-invalid",invalid);
    // A short color shift on a newly calculated value, NOT numeric count-up.
    // The visible and copied values always equal the calculation output.
    if(changed&&!invalid&&typeof dockValue.animate==="function"&&
       !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      dockValue.animate([{color:"#2e8f60"},{color:"#1d553f"}],
        {duration:260,easing:"ease-out"});
    }
  };
  // Keep the DOM, Tab sequence and screen-reader reading order consistent with
  // the actual responsive grid. Wide screens read input -> diagram -> results;
  // compact/two-column screens read input -> results -> diagram. Grid-area CSS
  // alone can visually reorder panes but leaves keyboard users in a different
  // sequence. Reparent the existing nodes, never clone them or their listeners.
  const workspace=document.querySelector("[data-workspace]");
  const drawingPane=workspace.querySelector(".drawing-pane");
  const resultPane=workspace.querySelector(".result-pane");
  const compactReadingOrder=window.matchMedia("(max-width: 1220px)");
  const syncWorkspaceReadingOrder=()=>{
    const next=compactReadingOrder.matches?resultPane:drawingPane;
    if(workspace.children[1]===next)return;
    const focused=document.activeElement;
    const restoreFocus=next.contains(focused);
    workspace.insertBefore(next,workspace.children[1]);
    if(restoreFocus&&focused.isConnected)focused.focus({preventScroll:true});
  };
  syncWorkspaceReadingOrder();
  compactReadingOrder.addEventListener("change",syncWorkspaceReadingOrder);
  let unit="in",latest=null,zoom=1,schedulePage=0,scheduleCols=[],printFullSchedule=false;
  const schedulePageSize=160;
  const geometryStatus=document.querySelector("#geometry-link-status");
  const geometryInspector=document.querySelector("#diagram-inspector");
  const geometryLabel=document.querySelector("#diagram-selection");
  const geometryPrevious=document.querySelector("#diagram-previous-row");
  const geometryNext=document.querySelector("#diagram-next-row");
  const geometryFind=document.querySelector("#diagram-find-row");
  const geometryShapes={
    "boards":[".deck-board-face","row"],
    "panels":[".wainscot-panel","panel"],
    "spacing-faces":[".equal-part-face","index"],
    "slope":[".gable-cut-stud","index"],
    "kerfs":[".kerf-slot","index"],
    "shelves":[".shelf-face","index"],
    "posts":[".post-face","index"],
    "balusters":[".baluster-face","index"]
  };
  let geometrySelected=0;
  const geometrySelector=()=>geometryShapes[latest?.shape]??null;
  const geometryPart=(i)=>{
    const map=geometrySelector();
    return map?diagram.querySelector(map[0]+'[data-'+map[1]+'="'+i+'"]'):null;
  };
  const highlightGeometry=()=>{
    const map=geometrySelector();
    diagram.querySelectorAll(".is-selected-geometry").forEach(n=>n.classList.remove("is-selected-geometry"));
    cut.querySelectorAll(".is-selected-geometry").forEach(n=>n.classList.remove("is-selected-geometry"));
    const element=geometrySelected?geometryPart(geometrySelected):null;
    if(!element||!map){
      geometryInspector.hidden=true;
      return;
    }
    element.classList.add("is-selected-geometry");
    const row=cut.querySelector('tbody tr[data-geometry-row="'+geometrySelected+'"]');
    row?.classList.add("is-selected-geometry");
    const source=latest.rows[geometrySelected-1];
    const name=source?.item??source?.label??("Row "+geometrySelected);
    geometryLabel.textContent="Row "+geometrySelected+" / "+latest.rows.length+" · "+String(name);
    geometryPrevious.disabled=geometrySelected<=1;
    geometryNext.disabled=geometrySelected>=latest.rows.length;
    geometryInspector.hidden=false;
  };
  const selectGeometry=(i,{bringDrawing=false}={})=>{
    if(!Number.isInteger(i)||i<1||i>latest?.rows?.length||!geometryPart(i))return;
    geometrySelected=i;
    highlightGeometry();
    if(bringDrawing)diagram.scrollIntoView({
      block:"center",
      behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"
    });
  };
  geometryPrevious?.addEventListener("click",()=>selectGeometry(geometrySelected-1));
  geometryNext?.addEventListener("click",()=>selectGeometry(geometrySelected+1));
  geometryFind?.addEventListener("click",()=>{
    if(!geometrySelected||!latest)return;
    const page=Math.floor((geometrySelected-1)/schedulePageSize);
    if(schedulePage!==page){schedulePage=page;renderSchedule();}
    highlightGeometry();
    const row=cut.querySelector('tbody tr[data-geometry-row="'+geometrySelected+'"]');
    if(!row)return;
    row.setAttribute("tabindex","-1");
    row.focus({preventScroll:true});
    row.scrollIntoView({
      block:"center",
      behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"
    });
  });
  cut.addEventListener("click",event=>{
    const row=event.target.closest("tr[data-geometry-row]");
    if(row)selectGeometry(Number(row.dataset.geometryRow),{bringDrawing:true});
  });
  diagram.addEventListener("click",event=>{
    const map=geometrySelector();
    if(!map||!event.target.closest)return;
    const element=event.target.closest(map[0]);
    const index=Number(element?.getAttribute("data-"+map[1]));
    if(index)selectGeometry(index);
  });
  const schedulePager=document.querySelector("#schedule-pager");
  const schedulePrev=document.querySelector("#schedule-prev");
  const scheduleNext=document.querySelector("#schedule-next");
  const schedulePageInput=document.querySelector("#schedule-page-input");
  const scheduleGo=document.querySelector("#schedule-go");
  const schedulePageStatus=document.querySelector("#schedule-page-status");
  const scheduleCount=document.querySelector("#schedule-count");
  const printReadableSchedule=document.querySelector("#print-schedule-readable");
  const printInputPanel=document.querySelector("#print-input-snapshot");
  const printInputRows=document.querySelector("#print-input-table tbody");
  const printInputContext=document.querySelector("#print-input-context");
  const framingMaterial=document.querySelector("#framing-material-table tbody");
  const framingStock=document.querySelector("#framing-stock-table tbody");
  const stockExport=document.querySelector("#download-stock-csv");
  const stockAuditPanel=document.querySelector("#framing-stock-audit");
  const stockAuditStatus=document.querySelector("#framing-stock-audit-status");
  const stockAuditTable=document.querySelector("#framing-stock-audit-table tbody");
  const stockAuditExport=document.querySelector("#download-stock-audit-csv");
  const stockReusePanel=document.querySelector("#framing-reuse-plan");
  const stockReuseStatus=document.querySelector("#framing-reuse-status");
  const stockReuseTable=document.querySelector("#framing-reuse-table tbody");
  const stockReusePriceTable=document.querySelector("#framing-reuse-purchase-table tbody");
  const stockReuseExport=document.querySelector("#download-framing-reuse-csv");
  const stockReusePriceExport=document.querySelector("#download-framing-reuse-quote-csv");
  const stationPanel=document.querySelector("#framing-station-ledger");
  const stationStatus=document.querySelector("#framing-station-status");
  const stationTable=document.querySelector("#framing-station-table tbody");
  const stationExport=document.querySelector("#download-framing-stations-csv");
  const fieldPanel=document.querySelector("#framing-field-preflight");
  const fieldTable=document.querySelector("#framing-field-table tbody");
  const fieldStatus=document.querySelector("#framing-field-status");
  const fieldExport=document.querySelector("#download-framing-field-csv");
  const fieldDraft={signature:"",unit:"in",sources:new Map(),
    sawKerf:null,endTrim:null,finalSeverKerf:null};
  const purchaseReviewPanel=document.querySelector("#framing-purchase-review");
  const purchaseReviewStatus=document.querySelector("#framing-purchase-review-status");
  const purchaseReviewTable=document.querySelector("#framing-purchase-review-table tbody");
  const purchaseReviewExport=document.querySelector("#download-framing-purchase-review-csv");
  const versionPanel=document.querySelector("#framing-review-versions");
  const versionIdentifiers=document.querySelector("#framing-version-identifiers");
  const versionStatus=document.querySelector("#framing-version-status");
  const versionDiffTable=document.querySelector("#framing-version-diff-table tbody");
  const versionPin=document.querySelector("#framing-version-pin");
  const versionJson=document.querySelector("#framing-version-json");
  const versionRestore=document.querySelector("#framing-version-restore");
  const versionRestoreWarning=document.querySelector("#framing-version-restore-warning");
  const versionDiffCsv=document.querySelector("#framing-version-diff-csv");
  const versionImport=document.querySelector("#framing-version-import");
  const versionState={current:null,reference:null,difference:null,importError:null};
  const purchaseReviewDraft={signature:"",quoteSignature:"",stocks:new Map(),
    globals:{sawSafetyReviewed:false,structuralReviewed:false,
      supplierVerified:false,totalCostReviewed:false}};
  const clearPurchaseReview=(all=true)=>{
    if(all){purchaseReviewDraft.signature="";purchaseReviewDraft.stocks.clear();}
    if(all)purchaseReviewDraft.globals.sawSafetyReviewed=false;
    if(all)purchaseReviewDraft.globals.structuralReviewed=false;
    purchaseReviewDraft.globals.supplierVerified=false;
    purchaseReviewDraft.globals.totalCostReviewed=false;
    purchaseReviewDraft.quoteSignature="";
  };
  const pricingExport=document.querySelector("#download-price-csv");
  const currency=document.querySelector("#framing-currency")||document.querySelector("#deck-currency")||document.querySelector("#lumber-currency");
  const framingPriceTable=document.querySelector("#framing-price-table tbody");
  const framingComparisons=document.querySelector("#framing-offer-table tbody");
  const framingProof=document.querySelector("#framing-proof-table tbody");
  const framingProofStatus=document.querySelector("#framing-optimizer-status");
  const framingPriceStatus=document.querySelector("#framing-price-status");
  const framingTicket=document.querySelector("#framing-ticket-list");
  const framingTicketStatus=document.querySelector("#framing-ticket-status");
  const shelfPinStatus=document.querySelector("#shelf-pin-status");
  const shelfPinTable=document.querySelector("#shelf-pin-table tbody");
  const shelfPinSvg=document.querySelector("#shelf-pin-svg");
  const shelfPinCsvExport=document.querySelector("#download-shelf-pins-csv");
  const shelfPinSvgExport=document.querySelector("#download-shelf-pin-svg");
  const stringerModelStatus=document.querySelector("#stringer-model-status");
  const stringerOutlineTable=document.querySelector("#stringer-outline-table tbody");
  const stringerSupportTable=document.querySelector("#stringer-support-table tbody");
  const stringerSectionExport=document.querySelector("#download-stringer-section-csv");
  const stringerSupportExport=document.querySelector("#download-stringer-support-csv");
  const stringerSawTable=document.querySelector("#stringer-sawline-table tbody");
  const stringerSawExport=document.querySelector("#download-stringer-sawline-csv");
  const stringerEndTable=document.querySelector("#stringer-end-lines-table tbody");
  const stringerEndExport=document.querySelector("#download-stringer-end-lines-csv");
  const stringerBlankTable=document.querySelector("#stringer-blank-table tbody");
  const stringerEndProjectionTable=document.querySelector("#stringer-end-projection-table tbody");
  const stringerBlankExport=document.querySelector("#download-stringer-blank-csv");
  const stringerProjectionExport=document.querySelector("#download-stringer-projections-csv");
  const stringerEndContactTable=document.querySelector("#stringer-end-contact-table tbody");
  const stringerEndContactExport=document.querySelector("#download-stringer-end-contact-csv");
  const roofReuseStatus=document.querySelector("#roof-reuse-status");
  const roofReuseTable=document.querySelector("#roof-reuse-table tbody");
  const roofReuseSvg=document.querySelector("#roof-reuse-svg");
  const roofReuseExport=document.querySelector("#download-roof-reuse-csv");
  const roofReuseSvgExport=document.querySelector("#download-roof-reuse-svg");
  const deckCostStatus=document.querySelector("#deck-cost-status");
  const deckBudgetTable=document.querySelector("#deck-budget-table tbody");
  const deckFastenerTable=document.querySelector("#deck-fastener-table tbody");
  const deckTicketList=document.querySelector("#deck-ticket-list");
  const deckTicketStatus=document.querySelector("#deck-ticket-status");
  const deckBudgetExport=document.querySelector("#download-deck-budget-csv");
  const deckFastenerExport=document.querySelector("#download-deck-fastener-csv");
  const currencyCode=()=>currency?.value||"USD";
  const money=x=>currencyCode()+" "+Number(x).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt=(x,kind="L")=>{
    if(!Number.isFinite(x))return "—";
    if(kind==="N")return String(Math.round(x));
    if(kind==="BF")return trim(x,4)+" board ft";
    if(kind==="C")return money(x);
    if(kind==="D")return trim(x,3)+"%";
    if(kind==="A")return trim(x,3)+"°";
    if(kind==="P")return trim(x,3)+":12";
    if(kind==="FT")return ["mm","cm","m"].includes(unit)?trim(x*.3048,3)+" m":trim(x,3)+" ft";
    if(kind==="FT2")return ["mm","cm","m"].includes(unit)?trim(x*.09290304,3)+" m²":trim(x,3)+" ft²";
    if(kind==="L"){
      const converted=convertFromInches(x,unit);
      const digits={in:4,ft:5,mm:2,cm:3,m:6}[unit]??4;
      // Ordinary dimensions stay compact, but a small NONZERO length
      // must never be rendered as 0 in or 0 mm. Display only.
      const small=converted!==0&&Number(converted.toFixed(digits))===0;
      return (small?Number(converted.toPrecision(8)).toString():trim(converted,digits))+" "+unit;
    }
    return trim(x,3);
  };
  const trim=(n,d=3)=>Number(n.toFixed(d)).toLocaleString("en-US",{maximumFractionDigits:d});
  const esc=s=>String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const frac=x=>unit==="in"?inchFraction(x,Number(fraction.value)||16):"";
  const formValue=key=>form.elements.namedItem(key)?.value??"";
  const isActiveField=(field,readValue=formValue)=>{
    if(!field.showWhen)return true;
    const [key,requiredValue]=field.showWhen.split(":");
    return String(readValue(key))===requiredValue;
  };
  const readInput=(field,raw)=>{
    if(raw.trim()==="")return field.emptyValue??null;
    return field.kind==="L"?parseEditableLength(raw,unit):Number(raw);
  };
  const values=()=>{
    const a={};
    for(const f of tool.inputs){
      if(!isActiveField(f)){
        a[f.key]=f.value;
        continue;
      }
      const raw=formValue(f.key);
      if(raw.trim()===""&&f.emptyValue===undefined){
        const issue=new Error(f.label+" is required.");
        issue.fieldKey=f.key;
        throw issue;
      }
      const v=readInput(f,raw);
      if(v===null||!Number.isFinite(v)){
        const issue=new Error(f.label+(f.kind==="L"&&unit==="in"?
          " must be a decimal, an inch fraction (5 1/2), or quoted feet and inches.":
          " must be a valid number."));
        issue.fieldKey=f.key;
        throw issue;
      }
      a[f.key]=f.kind==="L"?convertToInches(v,unit):v;
    }
    return a;
  };
  const point=(x,y,r=4,fill="#c58c54")=>'<circle cx="'+x.toFixed(2)+'" cy="'+y.toFixed(2)+'" r="'+r+'" fill="'+fill+'"/>';
  const svgText=(x,y,text,cl="")=>'<text x="'+x+'" y="'+y+'" class="'+cl+'">'+esc(text)+'</text>';
  function drawing(data){
    const left=74,right=850,top=50,base=278,W=right-left,H=base-top;
    // Preserve real scale for valid spans under one inch (e.g. 12.7 mm).
    // The earlier 1-inch floor made miniature layouts appear to occupy
    // only part of their full-width wall reference and distorted tick ratios.
    const span=Math.max(1e-8,data.span||1);
    const x=v=>left+Math.min(1,Math.max(0,v/span))*W;
    const grid=Array.from({length:11},(_,i)=>'<line class="gridline" x1="'+(left+i*W/10)+'" y1="36" x2="'+(left+i*W/10)+'" y2="293"/>').join("");
    let content='<line class="axis" x1="'+left+'" y1="'+base+'" x2="'+right+'" y2="'+base+'"/>';
    let marks=data.marks||[];
    const tick=marks.length>60?Math.ceil(marks.length/60):1;
    if(["ruler","spacing-faces","posts","holes","kerfs","balusters","shelves","boards","panels","slope","opening","wall-studs"].includes(data.shape)){
      // A single isotropic scale prevents wide drilled holes from becoming
      // distorted: shrink the board horizontally if the diameter would not
      // fit the fixed vertical diagram viewport.
      const holeScale=data.shape==="holes"?Math.min(W/span,124/data.boardWidth):null;
      const holeStart=holeScale===null?left:(900-span*holeScale)/2;
      // Shared scale on both axes: kerf mouth and retained-web thickness
      // remain proportionate to the entered flat stock dimensions.
      const kerfScale=data.shape==="kerfs"?Math.min(W/span,128/data.stockThickness):null;
      const kerfStart=kerfScale===null?left:(900-data.kerfArcLength*kerfScale)/2;
      if(data.shape==="spacing-faces"){
        // The exported face edges are the only source for the rectangles.
        // Do not draw a minimum apparent width: a tiny physical width must
        // stay proportionate to the whole measured layout.
        content+='<rect class="equal-stock-outline" x="'+left+'" y="99" width="'+W+'" height="148" fill="#f6f4ed" stroke="#8ba38f" stroke-width="1.1"/>';
        for(const [i,row] of (data.faceRows||[]).entries()){
          const x1=x(row.faceLeftEdge),x2=x(row.faceRightEdge),middle=x(row.position);
          content+='<rect class="equal-part-face" data-index="'+(i+1)+'" data-left="'+row.faceLeftEdge+'" data-right="'+row.faceRightEdge+'" data-center="'+row.position+'" x="'+x1+'" y="106" width="'+(x2-x1)+'" height="134" fill="#d7b68d" stroke="#866748" stroke-width=".8"><title>'+
            esc(row.item+" · face "+fmt(row.faceLeftEdge)+" to "+fmt(row.faceRightEdge)+" · center "+fmt(row.position))+'</title></rect>';
          content+='<line class="equal-part-center" data-index="'+(i+1)+'" x1="'+middle+'" y1="98" x2="'+middle+'" y2="246" stroke="#1e6454" stroke-width="1" stroke-dasharray="5 3"/>';
        }
        content+=svgText(left,71,"PART FACE WIDTH "+fmt(data.partFaceWidth),"dim-label");
        content+=svgText(left,90,data.clearFaceGap===null?"SINGLE CENTER · NO BETWEEN-PART GAP":
          "CLEAR BETWEEN FACES "+fmt(data.clearFaceGap),"tick-label");
      }else if(data.shape==="boards"){
        // Exactly the cut-list faces: no fake minimum width and no silently
        // omitted rows beyond the former 180-face drawing cap.
        content+='<rect class="deck-face-outline" x="'+left+'" y="123" width="'+W+'" height="108" fill="#f3f0e8" stroke="#ac9f8c" stroke-width="1"/>';
        for(const [i,row] of data.boardRows.entries()){
          const x1=x(row.left),x2=x(row.right);
          content+='<rect class="deck-board-face" data-row="'+(i+1)+'" x="'+x1+'" y="125" width="'+(x2-x1)+'" height="104" fill="'+(i%2?"#d2b18b":"#e0c6a5")+'" stroke="#9e764c" stroke-width=".35"><title>'+esc(row.item+" · face "+fmt(row.left)+" to "+fmt(row.right)+" · rip "+fmt(row.ripWidth))+'</title></rect>';
        }
      }else if(data.shape==="panels"){
        // Draw exactly the stored cut-list edges, with no fabricated
        // minimum visual width that would distort thin panels or zero gaps.
        content+='<rect class="wainscot-wall" x="'+left+'" y="82" width="'+W+'" height="172" fill="#f4f1ea" stroke="#b7b3a8" stroke-width="1.2"><title>'+esc("Target wall width "+fmt(span))+'</title></rect>';
        for(const [i,row] of data.panelRows.entries()){
          const x1=x(row.left),x2=x(row.right);
          content+='<rect class="wainscot-panel" data-panel="'+(i+1)+'" x="'+x1+'" y="87" width="'+(x2-x1)+'" height="162" fill="'+(i%2?"#e1c29d":"#f0d9bc")+'" stroke="#97734e" stroke-width=".65"><title>'+esc(row.item+" left "+fmt(row.left)+", right "+fmt(row.right)+", actual width "+fmt(row.width))+'</title></rect>';
        }
        content+=svgText(left,69,"LEFT MARGIN "+fmt(data.leftMargin),"tick-label");
        content+=svgText(right-227,69,"RIGHT MARGIN "+fmt(data.rightMargin),"tick-label");
        content+=svgText(left,335,"PANEL GAP "+fmt(data.gap)+" · ACTUAL END COORDINATES","tick-label");
      }else if(data.shape==="slope"){
        // Draw the ACTUAL cut heights from the exact rows also exported as CSV.
        // The dashed upper line is gross wall height before plate deductions.
        const rows=data.studRows||[];
        const topHeight=Math.max(1,data.grossEnd||1,...rows.map(r=>r.grossHeight||0));
        const yHeight=h=>base-175*h/topHeight;
        const yGross0=yHeight(data.grossStart),yGross1=yHeight(data.grossEnd);
        content+='<path class="gable-gross-reference" d="M'+left+' '+yGross0+' L'+right+' '+yGross1+'" fill="none" stroke="#89968d" stroke-width="1.5" stroke-dasharray="6 4"/>';
        content+='<path class="gable-net-cutline" d="M'+left+' '+yHeight(rows[0].length)+' L'+right+' '+yHeight(rows.at(-1).length)+'" fill="none" stroke="#1e6454" stroke-width="3"/>';
        const rawX=v=>left+v/span*W;
        for(const [i,r] of rows.entries()){
          // Real left/right top edges instead of a fictitious square-ended
          // vertical bar. The centerline is overlaid for clear measurement.
          const profile=[
            [rawX(r.faceLeft),base],[rawX(r.faceRight),base],
            [rawX(r.faceRight),yHeight(r.rightEdgeCut)],
            [rawX(r.faceLeft),yHeight(r.leftEdgeCut)]
          ].map(p=>p.join(",")).join(" ");
          content+='<polygon class="gable-cut-face" data-position="'+r.position+'" data-center-cut="'+r.length+'" data-left-cut="'+r.leftEdgeCut+'" data-right-cut="'+r.rightEdgeCut+'" points="'+profile+'" fill="#dbb88e" stroke="#9d7851" stroke-width=".6"><title>'+esc(r.item+" · left edge "+fmt(r.leftEdgeCut)+" · center "+fmt(r.length)+" · right edge "+fmt(r.rightEdgeCut))+'</title></polygon>';
          content+='<line class="gable-cut-stud" data-index="'+(i+1)+'" data-position="'+r.position+'" data-cut-length="'+r.length+'" x1="'+x(r.position)+'" y1="'+base+'" x2="'+x(r.position)+'" y2="'+yHeight(r.length)+'" stroke="#b98c56" stroke-width="1"><title>'+esc(r.item+" · center "+fmt(r.position)+" · centerline cut "+fmt(r.length)+" · gross height "+fmt(r.grossHeight))+'</title></line>';
        }
        content+=svgText(left,34,"NET LEFT "+fmt(rows[0].length)+" · RIGHT "+fmt(rows.at(-1).length),"dim-label");
        content+=svgText(left,324,"DASHED = GROSS HEIGHT · SOLID = NET CUT AFTER PLATES","tick-label");
      }else if(data.shape==="opening"){
        const openings=data.openings||[],wallHeight=Math.max(1,data.wallHeight||96);
        const yLevel=h=>255-179*Math.min(1,Math.max(0,h/wallHeight));
        const rawX=v=>left+(v/span)*W;
        content+='<rect x="'+left+'" y="76" width="'+W+'" height="179" fill="#e6e9de" opacity=".6" stroke="#426b5b" stroke-width="2"/>';
        if(data.bottomPlate>0)content+='<rect class="framing-bottom-plate" x="'+left+'" y="'+yLevel(data.bottomPlate)+'" width="'+W+'" height="'+(yLevel(0)-yLevel(data.bottomPlate))+'" fill="#b9a28a" opacity=".7"/>';
        if(data.topPlate>0)content+='<rect class="framing-top-plate" x="'+left+'" y="'+yLevel(wallHeight)+'" width="'+W+'" height="'+(yLevel(wallHeight-data.topPlate)-yLevel(wallHeight))+'" fill="#a2b8a5" opacity=".85"/>';
        for(const o of openings){
          const yTop=yLevel(o.top),ySill=yLevel(o.sill);
          content+='<rect class="opening-cutout" x="'+x(o.start)+'" y="'+yTop+'" width="'+(x(o.end)-x(o.start))+'" height="'+(ySill-yTop)+'" fill="#fcfbf8" stroke="#ad744e" stroke-width="2" stroke-dasharray="6 4"/>';
          content+=svgText(x(o.start)+4,Math.max(48,yTop-5),o.label+" · "+fmt(o.height),"tick-label");
          if(o.sill>0)content+='<line x1="'+x(o.start)+'" y1="'+ySill+'" x2="'+x(o.end)+'" y2="'+ySill+'" stroke="#ad744e" stroke-width="3"/>';
        }
        // Every member is drawn from exactly the row/mark geometry exported
        // in the typed cut list. Horizontal spans use left/right face bounds,
        // while crib studs use the same centers as the nominal OC grid.
        for(const p of marks.filter(p=>p.orientation==="horizontal")){
          const yTop=yLevel(p.topHeight),yBottom=yLevel(p.bottomHeight);
          const isHeader=p.role==="header";
          content+='<rect class="'+(isHeader?"framing-header":"framing-sill")+'" data-position="'+p.x+'" data-cut-length="'+p.cutLength+'" data-bottom="'+p.bottomHeight+'" data-top="'+p.topHeight+'" x="'+rawX(p.faceLeft)+'" y="'+yTop+'" width="'+(rawX(p.faceRight)-rawX(p.faceLeft))+'" height="'+(yBottom-yTop)+'" fill="'+(isHeader?"#9d7c53":"#b6a285")+'" stroke="#694e32" stroke-width=".6"><title>'+esc(p.label+" · horizontal cut "+fmt(p.cutLength)+" · depth "+fmt(p.topHeight-p.bottomHeight)+" · left "+fmt(p.faceLeft)+" · right "+fmt(p.faceRight))+'</title></rect>';
        }
        for(const p of marks.filter(p=>p.orientation==="vertical")){
          const yTop=yLevel(p.topHeight),yBottom=yLevel(p.bottomHeight);
          const isCripple=p.role==="cripple";
          const fill=p.role==="king"?"#1e6454":p.role==="jack"?"#c58c54":
            isCripple?"#6d91a3":"#426b5b";
          content+='<rect class="'+(isCripple?"framing-cripple":"framing-member")+'" data-position="'+p.x+'" data-cut-length="'+p.cutLength+'" data-bottom="'+p.bottomHeight+'" data-top="'+p.topHeight+'" x="'+rawX(p.faceLeft)+'" y="'+yTop+'" width="'+(rawX(p.faceRight)-rawX(p.faceLeft))+'" height="'+(yBottom-yTop)+'" fill="'+fill+'" opacity=".92"><title>'+esc(p.label+" · center "+fmt(p.x)+" · cut "+fmt(p.cutLength)+" · bottom "+fmt(p.bottomHeight)+" · top "+fmt(p.topHeight))+'</title></rect>';
        }
        const headerCount=marks.filter(p=>p.role==="header").length;
        const sillCount=marks.filter(p=>p.role==="sill").length;
        const crippleCount=marks.filter(p=>p.role==="cripple").length;
        content+=svgText(left+5,64,"WALL "+fmt(wallHeight)+" · BOTTOM "+fmt(data.bottomPlate)+" · TOP "+fmt(data.topPlate),"dim-label");
        content+=svgText(left,322,"HEADERS "+headerCount+" · SILLS "+sillCount+" · CRIPPLES "+crippleCount+" · GEOMETRY ONLY","tick-label");
      }else if(data.shape==="wall-studs"){
        const rows=data.studRows||[],height=data.wallHeight;
        const rawX=v=>left+v/span*W, yHeight=v=>base-179*v/height;
        content+='<line class="wall-gross-reference" x1="'+left+'" y1="'+yHeight(height)+'" x2="'+right+'" y2="'+yHeight(height)+'" stroke="#89968d" stroke-width="1.5" stroke-dasharray="6 4"/>';
        for(const r of rows){
          content+='<rect class="wall-cut-stud" data-position="'+r.position+'" data-cut-length="'+r.cutLength+'" x="'+rawX(r.faceLeft)+'" y="'+yHeight(r.cutLength)+'" width="'+(rawX(r.faceRight)-rawX(r.faceLeft))+'" height="'+(base-yHeight(r.cutLength))+'" fill="#426b5b"><title>'+esc(r.item+" · center "+fmt(r.position)+" · cut "+fmt(r.cutLength)+" · gross "+fmt(r.grossHeight))+'</title></rect>';
        }
        content+=svgText(left,64,"NET STUD CUT "+fmt(rows[0].cutLength)+" · "+rows.length+" STUD CENTERS","dim-label");
        content+=svgText(left,323,"DASHED = GROSS WALL HEIGHT · END POSITIONS ARE CENTERS","tick-label");
      }else if(data.shape==="holes"){
        // One physical X/Y scale for the entire flat board FACE, including
        // every circular hole. No minimum visual radius: it would fabricate
        // larger holes in a dense grid and break measured clearances.
        const boardLength=span*holeScale;
        const faceHeight=data.boardWidth*holeScale;
        const top=174-faceHeight/2,bottom=174+faceHeight/2;
        content+='<rect class="drilling-stock" data-board-width="'+data.boardWidth+
          '" x="'+holeStart+'" y="'+top+'" width="'+boardLength+'" height="'+faceHeight+
          '" fill="#ead4b2" stroke="#8e6b43" stroke-width="2"><title>'+
          esc("Flat board "+fmt(span)+" by "+fmt(data.boardWidth)+
          " · horizontal X from left, vertical Y from lower side")+'</title></rect>';
        const Y=y=>bottom-y*holeScale;
        for(const [ri,y] of (data.crossCenters||[]).entries()){
          const yy=Y(y);
          content+='<line class="drill-row-guide" data-row="'+(ri+1)+
            '" data-cross-center="'+y+'" x1="'+holeStart+'" y1="'+yy+
            '" x2="'+(holeStart+boardLength)+'" y2="'+yy+
            '" stroke="#866845" stroke-width="1.1" stroke-dasharray="5 4"/>';
        }
        for(const p of data.holeCenters||[]){
          const cx=holeStart+p.x*holeScale,cy=Y(p.y);
          const r=data.holeDiameter*holeScale/2;
          content+='<circle class="drill-hole" data-row="'+p.row+
            '" data-column="'+p.column+'" data-x="'+p.x+'" data-y="'+p.y+
            '" cx="'+cx+'" cy="'+cy+'" r="'+r+
            '" fill="#fcfbf8" stroke="#1e6454" stroke-width="1.4"><title>'+
            esc(p.item+" · X "+fmt(p.x)+" · Y "+fmt(p.y)+
            " · diameter "+fmt(data.holeDiameter))+'</title></circle>';
        }
        content+=svgText(holeStart,70,"HOLE Ø "+fmt(data.holeDiameter)+
          " · "+data.drillRows+" ROW"+(data.drillRows===1?"":"S"),"dim-label");
        content+=svgText(holeStart,90,"END CLEAR "+fmt(data.endMaterialMargin)+
          " · SIDE CLEAR "+fmt(data.sideMaterialMargin),"tick-label");
        content+=svgText(holeStart,330,data.drillRows===1?
          "LONGITUDINAL GAP "+fmt(data.holeClearance):
          "GAP X "+fmt(data.holeClearance)+" / Y "+fmt(data.transverseClearance),"dim-label");
      }else if(data.shape==="kerfs"){
        const y0=98,woodWidth=data.kerfArcLength*kerfScale;
        const stockH=data.stockThickness*kerfScale,depthH=data.cutDepth*kerfScale,webH=data.retainedWeb*kerfScale;
        content+='<rect class="kerf-stock" data-arc-in="'+data.kerfArcLength+
          '" data-thickness-in="'+data.stockThickness+
          '" x="'+kerfStart+'" y="'+y0+'" width="'+woodWidth+'" height="'+stockH+
          '" fill="#e4c49b" stroke="#926d45" stroke-width="1.8"><title>'+esc("Flat stock thickness "+fmt(data.stockThickness))+'</title></rect>';
        content+='<rect class="kerf-retained-web" x="'+kerfStart+'" y="'+(y0+depthH)+'" width="'+woodWidth+'" height="'+webH+'" fill="#a4c3a2"><title>'+esc("Continuous retained web "+fmt(data.retainedWeb))+'</title></rect>';
        // Draw from the quantized CSV schedule, not unrounded tick marks.
        for(const [i,row] of data.rows.entries()){
          const sx=kerfStart+row.slotLeft*kerfScale;
          const sw=(row.slotRight-row.slotLeft)*kerfScale;
          content+='<rect class="kerf-slot" data-index="'+(i+1)+
            '" data-center-in="'+row.position+
            '" data-left-in="'+row.slotLeft+
            '" data-right-in="'+row.slotRight+
            '" data-cut-depth-in="'+row.cutDepth+
            '" data-retained-web-in="'+row.retainedWeb+
            '" x="'+sx+'" y="'+y0+'" width="'+sw+'" height="'+(row.cutDepth*kerfScale)+
            '" fill="#fcfbf8" stroke="#9e764c" stroke-width=".35"><title>'+
            esc(row.item+" · center "+fmt(row.position)+" · left "+
              fmt(row.slotLeft)+" · right "+fmt(row.slotRight)+
              " · depth "+fmt(row.cutDepth))+'</title></rect>';
        }
        content+=svgText(kerfStart,71,"FLAT STOCK · KERF "+fmt(data.kerfWidth),"dim-label");
        content+=svgText(kerfStart,87,"GREEN WEB "+fmt(data.retainedWeb)+" · TRIAL ONLY","tick-label");
      }else if(data.shape==="shelves"){
        // Both faces come from the same bottom/thickness values as the schedule.
        const caseHeight=data.interiorHeight,scale=195/caseHeight;
        // The actual cut-list top and bottom faces are the only source of
        // shelf elevations; never inflate thin stock to a minimum pixel height.
        // Border strokes are illustrative, but filled faces retain exact scale.
        for(const [i,row] of (data.shelfRows||[]).entries()){
          const yy=base-row.shelfTop*scale;
          const faceHeight=(row.shelfTop-row.shelfBottom)*scale;
          content+='<rect class="shelf-face" data-index="'+(i+1)+
            '" data-shelf-bottom="'+row.shelfBottom+
            '" data-shelf-top="'+row.shelfTop+
            '" x="235" y="'+yy+'" width="445" height="'+faceHeight+
            '" fill="#dbb890" stroke="#8c663e" stroke-width="1.4"><title>'+
            esc(row.item+" · bottom "+fmt(row.shelfBottom)+
              " · top "+fmt(row.shelfTop)+
              " · thickness "+fmt(row.shelfTop-row.shelfBottom))+'</title></rect>';
        }
        const caseTop=base-caseHeight*scale;
        content+='<rect class="shelf-case-outline" data-interior-height="'+caseHeight+
          '" x="220" y="'+caseTop+'" width="475" height="'+(caseHeight*scale)+
          '" fill="none" stroke="#345f50" stroke-width="8"/>';
      }else{
        for(const [i,p] of marks.entries()){
          const px=x(p.x);
          if(data.shape==="balusters"||data.shape==="posts"){
            const row=data.faceRows[i];
            const map=data.shape==="posts"?v=>left+(v+data.itemWidth/2)/(span+data.itemWidth)*W:x;
            const faceX=map(row.faceLeft),faceRight=map(row.faceRight);
            content+='<rect class="'+(data.shape==="posts"?"post-face":"baluster-face")+'" data-index="'+(i+1)+'" x="'+faceX+'" y="113" width="'+(faceRight-faceX)+'" height="141" rx=".6" fill="#b78d5b"><title>'+esc(row.item+" · face "+fmt(row.faceLeft)+" to "+fmt(row.faceRight))+'</title></rect>';
          }
          else content+='<line x1="'+px+'" y1="101" x2="'+px+'" y2="253" stroke="#ba8f60" stroke-width="1.5"/>';
        }
      }
      for(let i=0;i<marks.length;i+=tick){
        const p=marks[i],px=data.shape==="holes"?holeStart+p.x*holeScale:data.shape==="kerfs"?kerfStart+p.x*kerfScale:data.shape==="posts"?left+(p.x+data.itemWidth/2)/(span+data.itemWidth)*W:x(p.x);
        content+='<line x1="'+px+'" y1="'+base+'" x2="'+px+'" y2="'+(base+9)+'" stroke="#1e6454"/>';
        if(marks.length<=24||i%Math.max(tick,2)===0)content+=svgText(px-10,base+27,p.label?String(p.label).slice(0,9):trim(convertFromInches(p.x,unit),1),"tick-label");
      }
      if(data.shape==="holes"||data.shape==="kerfs"){
        const scale=data.shape==="holes"?holeScale:kerfScale;
        const start=data.shape==="holes"?holeStart:kerfStart;
        content+=svgText(start,302,"0 "+unit,"dim-label");
        content+=svgText(start+data.span*scale-100,302,fmt(data.span),"dim-label");
      }else if(data.shape==="posts"){
        content+=svgText(left,317,"OUTSIDE FACES "+fmt(data.outsideLength),"dim-label");
        content+=svgText(left,338,"END CENTERS 0 TO "+fmt(span),"tick-label");
      }else content+=svgText(left,319,"0 "+unit,"dim-label")+svgText(right-96,319,fmt(span),"dim-label");
    }else if(data.shape==="rafter"){
      // True-proportional 2D side section: roof top y=m*x, lower reference
      // y=m*x+D*sqrt(1+m^2), with PLUMB reference clips at ridge/tail.
      // Seat and heel cut faces come ONLY from the calculation engine; this
      // never represents the strength of a constructed rafter/roof joint.
      const slope=data.roofSlope,total=data.totalHorizontalRun,
        rise=data.totalRise,depth=data.stockDepth;
      const bottom=rise+data.verticalDepth;
      const scale=Math.min(650/Math.max(1e-8,total),172/Math.max(1e-8,bottom));
      const X=v=>120+v*scale,Y=v=>77+v*scale;
      const p0={x:0,y:0},p1={x:total,y:rise};
      const low0={x:0,y:data.verticalDepth},low1={x:total,y:bottom};
      const a=data.seatStart,b=data.heelTop,c=data.heelBottom;
      const cutEnabled=(data.birdsmouthCutRows||[]).length===2;
      const profile=[p0,p1,low1,
        ...(cutEnabled?[c,b,a]:[]),low0];
      content+='<polygon class="rafter-stock-section" points="'+profile.map(p=>X(p.x)+","+Y(p.y)).join(" ")+
        '" fill="#e3c9a5" stroke="#876a48" stroke-width="1.8"><title>'+
        esc("Nominal plumb-clipped rafter SIDE SECTION at true coordinate scale; "+(cutEnabled?
          "measured horizontal seat and plumb heel cut are modeled":
          "no material-removing birdsmouth at zero pitch/seat")+
          "; not a certified 1:1 saw template")+'</title></polygon>';
      content+='<line class="rafter-uncut-lower" x1="'+X(low0.x)+'" y1="'+Y(low0.y)+
        '" x2="'+X(low1.x)+'" y2="'+Y(low1.y)+
        '" stroke="#a2a59a" stroke-width="1" stroke-dasharray="4 4"><title>Original parallel lower-edge reference BEFORE the selected birdsmouth notch</title></line>';
      content+='<line class="rafter-top-reference" x1="'+X(0)+'" y1="'+Y(0)+
        '" x2="'+X(total)+'" y2="'+Y(rise)+'" stroke="#236950" stroke-width="2.3"/>';
      const bearing=data.referencePoints[1],tail=data.referencePoints[2],
        xb=X(bearing.horizontalRun),yb=Y(bearing.verticalDrop);
      content+='<line class="rafter-bearing" x1="'+xb+'" y1="64" x2="'+xb+
        '" y2="266" stroke="#bd8051" stroke-dasharray="5 5" stroke-width="1.4"><title>'+
        esc("Wall outside face / heel PLUMB datum at horizontal x "+fmt(bearing.horizontalRun))+
        '</title></line>';
      content+='<circle class="rafter-bearing-point" cx="'+xb+'" cy="'+yb+'" r="3.1" fill="#236950"/>';
      content+='<circle class="rafter-tail-point" cx="'+X(tail.horizontalRun)+
        '" cy="'+Y(tail.verticalDrop)+'" r="3.1" fill="#236950"/>';
      // This named line persists for old UI consumers, but its physical XY
      // endpoints now come from the engine's same selected sawline rows.
      content+='<line class="rafter-seat-reference" data-start-x="'+a.x+
        '" data-start-y="'+a.y+'" data-end-x="'+b.x+'" data-end-y="'+b.y+
        '" x1="'+X(a.x)+'" y1="'+Y(a.y)+'" x2="'+X(b.x)+'" y2="'+Y(b.y)+
        '" stroke="#a05c33" stroke-width="3.3"><title>'+
        esc("Selected horizontal seat: "+fmt(data.seat)+
          " at y "+fmt(a.y)+" downhill from ridge top; verify wall plate and stock")+
        '</title></line>';
      if(cutEnabled){
        content+='<line class="rafter-heel-plumb-cut" data-start-x="'+b.x+
          '" data-start-y="'+b.y+'" data-end-x="'+c.x+'" data-end-y="'+c.y+
          '" x1="'+X(b.x)+'" y1="'+Y(b.y)+'" x2="'+X(c.x)+'" y2="'+Y(c.y)+
          '" stroke="#a05c33" stroke-width="3.3"><title>'+
          esc("Selected vertical heel cut "+fmt(data.hap)+" top-to-plate reference; actual heel height "+fmt(c.y-b.y))+
          '</title></line>';
      }
      content+=svgText(105,39,"COMMON RAFTER · PLUMB-CLIPPED 2D SIDE SECTION","dim-label");
      content+=svgText(105,60,"SEAT & HEEL COORDINATES · NOT STRUCTURAL APPROVAL","tick-label");
      content+=svgText(105,294,"ADJUSTED RUN "+fmt(data.run),"dim-label");
      content+=svgText(105,322,"SEAT "+fmt(data.seat)+" / HAP "+fmt(data.hap),"tick-label");
      content+=svgText(563,322,"TAIL "+fmt(data.overhang)+" / NORMAL THROAT "+fmt(depth-data.notchNormal),"tick-label");
    }else if(data.shape==="stringer"){
      // Actual engine profile vertices: one vertical riser per row and one
      // horizontal tread between successive risers. Preserve aspect ratio.
      // This is a nominal reference profile, NOT a certified stock outline.
      const verts=data.stepVertices,run=(data.risers-1)*data.tread,rise=data.totalRise;
      const nose=data.nosingProjection||0,landing=data.landingDepth||0;
      const blank=data.stringerBlankVertices||[];
      const minX=Math.min(0,-nose,-(data.lowerSupportRun||0),
        -(data.lowerEndCutRun||0),...blank.map(p=>p.x));
      const maxX=Math.max(run+Math.max(landing,data.upperSupportRun||0,
        data.upperEndCutRun||0),...blank.map(p=>p.x));
      const supportY=(data.supportReferences||[]).map(ref=>ref.elevation);
      const minY=Math.min(0,data.lowerEdgeAtStart??0,
        ...((data.measuredEndCuts||[]).map(ref=>ref.endY)),
        ...blank.map(p=>p.y),...supportY);
      const maxY=Math.max(rise,...blank.map(p=>p.y),...supportY);
      const width=maxX-minX,height=maxY-minY;
      const sc=Math.min(650/Math.max(.001,width),185/Math.max(.001,height));
      const ox=(900-width*sc)/2-minX*sc,oy=274+minY*sc;
      const px=v=>ox+v.x*sc,py=v=>oy-v.y*sc;
      if(blank.length===4){
        content+='<polygon class="stringer-blank-reference" data-axis-length="'+
          data.blankLengthShown+'" data-stock-fits="'+
          (data.stockFitsModel===null?"not-entered":String(data.stockFitsModel))+
          '" points="'+blank.map(v=>px(v)+","+py(v)).join(" ")+
          '" fill="#9bb6b8" fill-opacity=".12" stroke="#6a8795" stroke-width="2" stroke-dasharray="7 4"><title>'+
          esc("Pitch-aligned 2D rectangular raw stock REFERENCE "+fmt(data.blankLengthShown)+
            " long × "+fmt(data.stockNormalDepth)+
            " normal width. Not an actual purchased board or approved end bearing")+
          '</title></polygon>';
      }
      // This closed polygon is a reference SIDE SECTION, not the actual
      // uncut board blank or a verified top/bottom bearing cut shape.
      const envelope=data.stockEnvelopeVertices||[];
      if(envelope.length){
        const stockPoints=envelope.map(v=>px(v)+","+py(v)).join(" ");
        content+='<polygon class="stringer-modeled-section" points="'+stockPoints+
          '" data-area-sqin="'+data.envelopeAreaSqIn+
          '" data-min-throat="'+data.minThroatFromVertices+
          '" fill="#d9e9dc" stroke="#648b71" stroke-width="1.4"><title>'+
          esc("Modeled notched side section; lower stock edge is parallel to pitch; vertical end clips are NOT bearing cuts")+
          '</title></polygon>';
        const low0=envelope.at(-1),low1=envelope.at(-2);
        content+='<line class="stringer-lower-stock-edge" x1="'+px(low0)+'" y1="'+py(low0)+
          '" x2="'+px(low1)+'" y2="'+py(low1)+'" stroke="#567a61" stroke-width="2.4"><title>'+
          esc("Nominal parallel bottom reference of uncut board; stock normal depth "+fmt(data.stockNormalDepth))+
          '</title></line>';
        content+='<line class="stringer-lower-end-clip" x1="'+px(verts[0])+'" y1="'+py(verts[0])+
          '" x2="'+px(low0)+'" y2="'+py(low0)+'" stroke="#a26858" stroke-dasharray="5 4"><title>Reference clip only · NOT a bottom bearing cut</title></line>';
        content+='<line class="stringer-upper-end-clip" x1="'+px(verts.at(-1))+'" y1="'+py(verts.at(-1))+
          '" x2="'+px(low1)+'" y2="'+py(low1)+'" stroke="#a26858" stroke-dasharray="5 4"><title>Reference clip only · NOT a top bearing cut</title></line>';
      }
      for(const check of data.endProjectionChecks||[]){
        if(check.projectedOutsideSupport<=1e-7)continue;
        const cx=px({x:check.projectedEndX});
        const support=(data.supportReferences||[]).find(ref=>
          ref.item.startsWith(check.item.startsWith("Lower")?"Lower":"Upper"));
        const cy=py({y:support?.elevation??(check.item.startsWith("Lower")?0:rise)});
        content+='<circle class="stringer-support-projection-warning" cx="'+cx+
          '" cy="'+cy+'" r="6" fill="none" stroke="#a54836" stroke-width="2"><title>'+
          esc(check.item+": projected X is "+fmt(check.projectedOutsideSupport)+
            " outside entered horizontal support reference; not structural bearing")+
          '</title></circle>';
      }
      for(const ref of data.measuredEndCuts||[]){
        content+='<line class="stringer-field-end-line" data-start-x="'+ref.startX+
          '" data-start-y="'+ref.startY+'" data-end-x="'+ref.endX+
          '" data-end-y="'+ref.endY+'" x1="'+px({x:ref.startX})+
          '" y1="'+py({y:ref.startY})+'" x2="'+px({x:ref.endX})+
          '" y2="'+py({y:ref.endY})+
          '" stroke="#ab573c" stroke-width="3.2"><title>'+
          esc(ref.item+" · user-supplied end position; verify actual bearing and cutting details")+
          '</title></line>';
      }
      for(const ref of data.supportReferences||[]){
        const role=ref.item.startsWith("Lower")?"lower":"upper";
        content+='<line class="stringer-support-surface stringer-support-'+role+
          '" data-start="'+ref.startX+'" data-end="'+ref.endX+
          '" data-level="'+ref.elevation+'" x1="'+px({x:ref.startX})+
          '" y1="'+py({y:ref.elevation})+'" x2="'+px({x:ref.endX})+
          '" y2="'+py({y:ref.elevation})+
          '" stroke="#875d8e" stroke-width="3.2" stroke-dasharray="6 3"><title>'+
          esc(ref.item+" · measured horizontal surface only; NOT a bearing cut or strength certification")+
          '</title></line>';
      }
      for(const contact of data.endContactChecks||[]){
        const lower=contact.item.startsWith("Lower");
        if(contact.intersectionX!==null){
          const cx=px({x:contact.intersectionX}),
            cy=py({y:contact.intersectionElevation});
          content+='<circle class="stringer-end-support-point" data-side="'+
            (lower?"lower":"upper")+'" data-geometry="'+
            esc(contact.contactGeometry)+'" data-x="'+contact.intersectionX+
            '" data-y="'+contact.intersectionElevation+
            '" data-shared-length="0" cx="'+cx+'" cy="'+cy+
            '" r="5.5" fill="#fff1da" stroke="#9a552d" stroke-width="2.2"><title>'+
            esc(contact.item+" · "+contact.contactGeometry+
              "; zero common line length; NOT bearing area or approved connection")+
            '</title></circle>';
        }else{
          const x=px({x:(contact.supportStartX+contact.supportEndX)/2}),
            y=py({y:contact.supportElevation});
          content+='<g class="stringer-end-support-noncontact" data-side="'+
            (lower?"lower":"upper")+'" data-geometry="No 2D intersection">'+
            '<line x1="'+(x-5)+'" y1="'+(y-5)+'" x2="'+(x+5)+
            '" y2="'+(y+5)+'" stroke="#ae4133" stroke-width="2.2"/>'+
            '<line x1="'+(x-5)+'" y1="'+(y+5)+'" x2="'+(x+5)+
            '" y2="'+(y-5)+'" stroke="#ae4133" stroke-width="2.2"/>'+
            '<title>'+esc(contact.item+
              " · the modeled sawline and measured support segment do NOT intersect in 2D")+
            '</title></g>';
        }
      }
      const points=verts.map(v=>px(v)+","+py(v)).join(" ");
      content+='<polyline class="stringer-step-profile" points="'+points+'" data-vertices="'+verts.length+
        '" data-svg-scale="'+sc+'" data-origin-x="'+ox+'" data-origin-y="'+oy+
        '" fill="none" stroke="#246a58" stroke-width="2.7" stroke-linejoin="round"><title>Nominal riser and tread cut reference; vertices follow the exported riser elevations and horizontal runs</title></polyline>';
      const first=verts[1],end=verts.at(-1);
      content+='<line class="stringer-pitch-line" x1="'+px(first)+'" y1="'+py(first)+'" x2="'+px(end)+'" y2="'+py(end)+'" stroke="#b77b44" stroke-width="1.8" stroke-dasharray="6 4"><title>'+esc("Notch pitch line "+fmt(data.pitchLine)+"; NOT the floor diagonal")+'</title></line>';
      content+='<line class="stringer-floor-diagonal" x1="'+ox+'" y1="'+oy+'" x2="'+px(end)+'" y2="'+py(end)+'" stroke="#aeb7ad" stroke-width="1.2" stroke-dasharray="3 5"><title>'+esc("Floor datum diagonal "+fmt(data.floorDiagonal)+"; NOT a cut length")+'</title></line>';
      // These two overlays come from supplementary reference coordinates,
      // not the nominal stock cutline or a fictional extended stringer.
      for(const ref of data.noseReferences||[]){
        const y=py({y:ref.rise});
        content+='<line class="stringer-nosing-reference" data-start="'+ref.noseStart+
          '" data-end="'+ref.noseEnd+'" x1="'+px({x:ref.noseStart})+
          '" y1="'+y+'" x2="'+px({x:ref.noseEnd})+'" y2="'+y+
          '" stroke="#b77b44" stroke-width="3"><title>'+
          esc(ref.item+" · optional tread nose reference "+fmt(nose)+" downhill; not a stringer saw cut")+
          '</title></line>';
      }
      if(landing>0){
        const to={x:run+landing,y:rise};
        content+='<line class="stringer-landing-reference" data-depth="'+landing+
          '" data-start="'+run+'" data-end="'+to.x+'" x1="'+px({x:run})+
          '" y1="'+py({y:rise})+'" x2="'+px(to)+'" y2="'+py(to)+
          '" stroke="#b77b44" stroke-width="3.2"><title>'+
          esc("Upper landing horizontal reference "+fmt(landing)+
          " · not additional stringer stock length")+'</title></line>';
      }
      const bottomTrimY=oy-data.bottomLayoutRise*sc;
      content+='<line class="stringer-bottom-trim" x1="'+(ox-18)+'" y1="'+bottomTrimY+'" x2="'+(ox+17)+'" y2="'+bottomTrimY+'" stroke="#a85034" stroke-width="2.8"><title>'+esc("Separate bottom trim height "+fmt(data.bottomLayoutRise)+"; actual end fastening not modeled")+'</title></line>';
      content+=svgText(70,52,data.risers+" risers / "+(data.risers-1)+" treads","dim-label");
      content+=svgText(70,75,"MODELED SIDE SECTION · END CLIPS ARE NOT BEARING CUTS","tick-label");
      content+=svgText(70,309,"NOTCH PITCH "+fmt(data.pitchLine),"dim-label");
      content+=svgText(70,332,"BOTTOM TRIM "+fmt(data.bottomLayoutRise),"tick-label");
      content+=svgText(565,309,"THROAT (NOMINAL) "+fmt(data.throat),"dim-label");
      if(nose>0||landing>0){
        content+=svgText(565,332,"NOSE "+fmt(nose)+" / LANDING "+fmt(landing),"tick-label");
      }
    }else if(data.shape==="soffit-section"){
      // All three vertical positions share the wall-rafter-top datum at y=90.
      // The schematic preserves relative scale, but is NOT paper-scale.
      const scale=Math.min(535/data.projection,163/Math.max(1,data.roofDrop+data.verticalRafter,data.soffitDatum));
      const x0=155,x1=x0+data.projection*scale,y0=88;
      const roofY=y0+data.roofDrop*scale,under0=y0+data.verticalRafter*scale;
      const under1=roofY+data.verticalRafter*scale,finishY=y0+data.soffitDatum*scale;
      content+='<polygon class="soffit-rafter" points="'+x0+','+y0+' '+x1+','+roofY+' '+x1+','+under1+' '+x0+','+under0+'" fill="#dec4a1" stroke="#8c693f" stroke-width="2"><title>'+esc("Rafter depth measured normal to slope: "+fmt(data.stockDepth))+'</title></polygon>';
      content+='<line class="soffit-finished-datum" x1="'+x0+'" y1="'+finishY+'" x2="'+x1+'" y2="'+finishY+'" stroke="#1e6454" stroke-width="2.8" stroke-dasharray="7 4"/>';
      content+='<line x1="'+x1+'" y1="'+y0+'" x2="'+x1+'" y2="'+finishY+'" stroke="#9c7754" stroke-width="1.5" stroke-dasharray="3 3"/>';
      content+=svgText(x0,57,"WALL RAFTER TOP = 0","dim-label");
      content+=svgText(x1+9,Math.max(71,roofY-8),"ROOF TOP","tick-label");
      content+=svgText(x1+9,Math.min(279,under1+11),"RAFTER UNDERSIDE","tick-label");
      content+=svgText(x0,300,"RUN "+fmt(data.projection)+" / FALL "+fmt(data.roofDrop),"dim-label");
      content+=svgText(x0,326,"FINISHED REFERENCE DROP "+fmt(data.soffitDatum),"dim-label");
    }else if(data.shape==="hip-line"){
      // Two true-scale-within-view triangles. The PLAN and ELEVATION views
      // have independent viewport fit scales; neither substitutes the
      // common-face pitch for the shallower hip elevation angle.
      const xRun=data.hipRunX,yRun=data.hipRunY,plan=data.run,rise=data.rise;
      const ps=Math.min(310/Math.max(1e-8,xRun),146/Math.max(1e-8,yRun));
      const px0=100,py0=250,px1=px0+xRun*ps,py1=py0-yRun*ps;
      content+='<path class="hip-plan-triangle" d="M'+px0+' '+py0+' L'+px1+' '+py0+' L'+px1+' '+py1+' Z" fill="#e3eee5" stroke="#527a68" stroke-width="1.3"/>';
      content+='<line class="hip-plan-diagonal" x1="'+px0+'" y1="'+py0+'" x2="'+px1+'" y2="'+py1+'" stroke="#b77a43" stroke-width="2.6"><title>'+esc("Plan diagonal "+fmt(plan)+" from along "+fmt(xRun)+" and across "+fmt(yRun))+'</title></line>';
      const es=Math.min(310/Math.max(1e-8,plan),146/Math.max(1e-8,rise));
      const ex0=500,ey0=250,ex1=ex0+plan*es,ey1=ey0-rise*es;
      content+='<path class="hip-elevation-triangle" d="M'+ex0+' '+ey0+' L'+ex1+' '+ey0+' L'+ex1+' '+ey1+' Z" fill="#e7ece7" stroke="#527a68" stroke-width="1.3"/>';
      content+='<line class="hip-elevation-line" x1="'+ex0+'" y1="'+ey0+'" x2="'+ex1+'" y2="'+ey1+'" stroke="#b77a43" stroke-width="2.6"><title>'+esc("3D hip line "+fmt(data.hipLength)+", slope rise "+fmt(rise)+" over PLAN diagonal "+fmt(plan))+'</title></line>';
      content+=svgText(102,61,"PLAN VIEW · X / Y","dim-label");
      content+=svgText(102,82,"ALONG "+fmt(xRun)+" · ACROSS "+fmt(yRun),"tick-label");
      content+=svgText(100,283,"PLAN DIAGONAL "+fmt(plan),"tick-label");
      content+=svgText(100,304,"PLAN ANGLE "+trim(data.planAngle,3)+"°","tick-label");
      content+=svgText(500,61,"HIP ELEVATION · DIAGONAL / RISE","dim-label");
      content+=svgText(500,82,"RISE "+fmt(rise)+" · ROOF FACE "+trim(data.facePitch,3)+":12","tick-label");
      content+=svgText(500,283,"TRUE HIP "+fmt(data.hipLength),"tick-label");
      content+=svgText(500,304,"HIP ELEVATION "+trim(data.elevationAngle,3)+"°","tick-label");
    }else if(data.shape==="brace"){
      // Show the COMPLETE measured rectangle, then the shortened brace
      // centerline using the exact rounded endpoints exported in the CSV.
      // Nothing here represents physical timber breadth or an end-cut face.
      const run=data.braceRun,rise=data.braceRise;
      const scale=Math.min(620/run,168/rise);
      const x0=145,y0=267;
      const X=v=>x0+v*scale,Y=v=>y0-v*scale;
      const start=data.braceCutRows[0],finish=data.braceCutRows[1];
      content+='<path class="brace-reference-triangle" d="M'+X(0)+' '+Y(0)+
        ' L'+X(run)+' '+Y(0)+' L'+X(run)+' '+Y(rise)+
        ' Z" fill="none" stroke="#a6b7ab" stroke-width="1.6" stroke-dasharray="5 4"/>';
      content+='<line class="brace-full-reference" x1="'+X(0)+'" y1="'+Y(0)+
        '" x2="'+X(run)+'" y2="'+Y(rise)+
        '" stroke="#a6a6a0" stroke-dasharray="5 5" stroke-width="2"/>';
      content+='<line class="brace-cut-centerline" data-start-x="'+start.horizontalX+
        '" data-start-y="'+start.verticalY+'" data-end-x="'+finish.horizontalX+
        '" data-end-y="'+finish.verticalY+
        '" x1="'+X(start.horizontalX)+'" y1="'+Y(start.verticalY)+
        '" x2="'+X(finish.horizontalX)+'" y2="'+Y(finish.verticalY)+
        '" stroke="#1e6454" stroke-width="4" stroke-linecap="round"><title>'+
        esc("Usable brace centerline "+fmt(data.braceCutLength)+
        "; both setbacks measured ALONG original diagonal")+'</title></line>';
      content+='<circle class="brace-cut-start" cx="'+X(start.horizontalX)+
        '" cy="'+Y(start.verticalY)+'" r="4" fill="#b77a43"/>';
      content+='<circle class="brace-cut-finish" cx="'+X(finish.horizontalX)+
        '" cy="'+Y(finish.verticalY)+'" r="4" fill="#b77a43"/>';
      content+=svgText(103,43,"BRACE CENTERLINE · X/Y DATUM (0,0)","dim-label");
      content+=svgText(103,65,"GREEN = USABLE CENTERLINE · NO PHYSICAL END CUT","tick-label");
      content+=svgText(112,296,"RUN "+fmt(run)+" / RISE "+fmt(rise),"dim-label");
      content+=svgText(112,319,"FULL "+fmt(data.braceFullLength)+" / CUT "+fmt(data.braceCutLength),"dim-label");
      content+=svgText(570,319,"SETBACK EACH "+fmt(data.braceSetback),"tick-label");
    }else if(data.shape==="picket-layout"){
      // Shared physical X/Y scale; board heights are the exact FLAT cut
      // heights from the numerical schedule, not a continuous curved cut.
      const rows=data.faceRows||[],
        maxH=data.picketHeight+data.archRise;
      const scale=Math.min(752/span,179/Math.max(1e-8,maxH)),
        x0=(900-span*scale)/2,y0=261;
      const X=v=>x0+v*scale,Y=v=>y0-v*scale;
      content+='<rect class="picket-clear-opening" x="'+X(0)+'" y="'+Y(maxH)+
        '" width="'+(span*scale)+'" height="'+(maxH*scale)+
        '" fill="#f3f2ec" stroke="#9db5a9" stroke-dasharray="5 3"/>';
      for(const [i,r] of rows.entries()){
        const xx=X(r.faceLeft),w=(r.faceRight-r.faceLeft)*scale,
          yy=Y(r.cutHeight),h=r.cutHeight*scale;
        content+='<rect class="picket-face" data-index="'+(i+1)+
          '" data-face-left="'+r.faceLeft+'" data-face-right="'+r.faceRight+
          '" data-center="'+r.position+'" data-cut-height="'+r.cutHeight+
          '" x="'+xx+'" y="'+yy+'" width="'+w+'" height="'+h+
          '" fill="'+(i%2?"#d2b18b":"#e3c8a4")+
          '" stroke="#846541" stroke-width=".65"><title>'+
          esc(r.item+" · face "+fmt(r.faceLeft)+" to "+fmt(r.faceRight)+
            " · individual FLAT cut height "+fmt(r.cutHeight))+'</title></rect>';
      }
      content+=svgText(75,42,"CLEAR OPENING · POST INSIDE FACES","dim-label");
      content+=svgText(75,64,"EQUAL GAP "+fmt(data.equalGap)+" / "+data.picketCount+" PICKETS","tick-label");
      content+=svgText(75,302,"LEFT INNER FACE = 0 "+unit,"tick-label");
      content+=svgText(510,302,"RIGHT INNER FACE "+fmt(span),"tick-label");
      content+=svgText(75,328,data.archMode?
        "STEPPED FLAT TOPS · NOT A CURVED CUT":"LEVEL FLAT PICKET TOPS","tick-label");
    }else if(data.shape==="gambrel-profile"){
      // Draw exactly the 4 exported roof segment endpoint coordinates
      // in ONE physical 2D scale. No invented truss connection points.
      const pts=data.gambrelVertices,
        scale=Math.min(698/span,193/Math.max(1e-8,data.ridgeRise));
      const X=v=>(900-span*scale)/2+v*scale,Y=v=>269-v*scale;
      content+='<polyline class="gambrel-roof-profile" points="'+
        pts.map(p=>X(p.x)+","+Y(p.y)).join(" ")+
        '" fill="none" stroke="#9eaaa0" stroke-width="7" stroke-linejoin="round"/>';
      for(const [i,r] of data.gambrelRows.entries()){
        content+='<line class="gambrel-slope-segment" data-segment="'+r.segment+
          '" data-index="'+(i+1)+'" data-start-x="'+r.startX+
          '" data-end-x="'+r.endX+'" data-start-height="'+r.startHeight+
          '" data-end-height="'+r.endHeight+'" data-slope-length="'+r.slopedLength+
          '" x1="'+X(r.startX)+'" y1="'+Y(r.startHeight)+
          '" x2="'+X(r.endX)+'" y2="'+Y(r.endHeight)+
          '" stroke="'+(r.segment==="lower"?"#b37a45":"#28705b")+
          '" stroke-width="4" stroke-linecap="round"><title>'+
          esc(r.item+" · run "+fmt(r.horizontalRun)+" · rise "+fmt(r.verticalRise)+
            " · slope "+fmt(r.slopedLength))+'</title></line>';
      }
      for(const [i,p] of pts.entries())
        content+=point(X(p.x),Y(p.y),i===2?5:3,"#1e6454");
      content+=svgText(75,42,"SYMMETRIC GAMBREL · EAVE / BREAK / RIDGE","dim-label");
      content+=svgText(75,63,"LOWER STEEP / UPPER SHALLOW · NOT TRUSS DESIGN","tick-label");
      content+=svgText(75,301,"ROOF SPAN "+fmt(span),"dim-label");
      content+=svgText(75,328,"LOWER RUN "+fmt(data.lowerRun)+
        " / UPPER RUN "+fmt(data.upperRun),"tick-label");
      content+=svgText(570,328,"RIDGE RISE "+fmt(data.ridgeRise),"tick-label");
    }else if(data.shape==="lumber-board"){
      // Exact TOP-face physical aspect ratio from entered dimensions;
      // thickness is labeled, not silently drawn as a fake face width.
      const b=data.lumberBoard,scale=Math.min(690/b.length,125/b.width);
      const ww=b.length*scale,hh=b.width*scale,x0=(900-ww)/2,y0=192-hh/2;
      content+='<rect class="lumber-board-face" data-length-in="'+b.length+
        '" data-width-in="'+b.width+'" data-thickness-in="'+b.thickness+
        '" x="'+x0+'" y="'+y0+'" width="'+ww+'" height="'+hh+
        '" fill="#e4cba6" stroke="#8b6846" stroke-width="1.5"/>';
      content+=svgText(75,53,b.dimensionBasis===0?
        "ENTERED NOMINAL SIZE — VERIFY BILLING BASIS":"ENTERED ACTUAL SIZE — MEASURED BASIS","dim-label");
      content+=svgText(75,72,"BOARD LENGTH "+fmt(b.length)+" / FACE WIDTH "+fmt(b.width),"tick-label");
      content+=svgText(75,290,"THICKNESS "+fmt(b.thickness)+" · "+b.purchased+" WHOLE PIECES","dim-label");
      content+=svgText(75,318,"BOARD FEET/PIECE "+trim(b.boardFeetPerPiece,4)+" · SUPPLIER RATES NOT VERIFIED","tick-label");
    }else if(data.shape==="triangle"){

      // Roof pitch triangle uses ONE isotropic x/y scale, unlike the
      // previous height-exaggerated sketch which changed the shown pitch.
      const run=data.run||span,rise=Math.max(0,data.rise??0);
      const scale=Math.min(610/Math.max(1e-8,run),170/Math.max(1e-8,rise));
      const xx0=(900-run*scale)/2,yy0=260;
      const xx1=xx0+run*scale,yy1=yy0-rise*scale;
      content+='<path class="roof-pitch-triangle" d="M'+xx0+' '+yy0+' L'+xx1+' '+yy0+' L'+xx1+' '+yy1+' Z" fill="#e5ece5" stroke="#356c58" stroke-width="2"/>';
      content+='<line class="roof-pitch-slope" x1="'+xx0+'" y1="'+yy0+'" x2="'+xx1+'" y2="'+yy1+'" stroke="#b77a43" stroke-width="2.8"/>';
      content+=svgText(100,60,slug==="rise-run-calculator"?
          "GENERAL SLOPE · RISE PER 12 HORIZONTAL":
          "ROOF FACE · RISE PER 12 HORIZONTAL","dim-label");
      content+=svgText(100,84,"TRUE PROPORTIONAL SLOPE TRIANGLE","tick-label");
      content+=svgText(xx0,288,"RUN "+fmt(run),"dim-label");
      content+=svgText(xx0,310,"RISE "+fmt(rise),"tick-label");
      content+=svgText(540,310,"SLOPE LINE "+fmt(data.roofLine),"tick-label");
    }else if(data.shape==="stairs"){
      // SVG is an actual proportional elevation of the same coordinates
      // exported in the stair CSV, not equal-size decorative steps.
      const risers=data.stairRows||[],landing=data.landingDepth||0;
      const fullRun=data.totalFootprint||data.flightRun;
      const rise=data.totalRise||risers.at(-1)?.rise||1;
      const s=Math.min((W-80)/Math.max(fullRun,1),(H-45)/Math.max(rise,1));
      const x0=left+(W-fullRun*s)/2,bottom=base-7;
      const X=v=>Number((x0+v*s).toFixed(4));
      const Y=v=>Number((bottom-v*s).toFixed(4));
      content+='<line class="stair-base-datum" x1="'+X(0)+'" x2="'+X(fullRun)+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="#bccbbd" stroke-dasharray="5 5"/>';
      for(const [i,r] of risers.entries()){
        const bx=X(r.run),low=Y(r.rise-r.riserHeight),high=Y(r.rise);
        content+='<line class="stair-riser" data-index="'+(i+1)+'" data-horizontal-run="'+r.run+'" data-top-rise="'+r.rise+'" x1="'+bx+'" y1="'+low+'" x2="'+bx+'" y2="'+high+'" stroke="#1e6454" stroke-width="3.4"><title>'+
          esc("Riser "+(i+1)+" · x "+fmt(r.run)+" · upper finished height "+fmt(r.rise))+'</title></line>';
        if(i<risers.length-1){
          const end=X(r.treadEnd);
          content+='<line class="stair-tread" data-index="'+(i+1)+'" data-start="'+r.treadStart+'" data-end="'+r.treadEnd+'" x1="'+bx+'" y1="'+high+'" x2="'+end+'" y2="'+high+'" stroke="#1e6454" stroke-width="3.4"><title>'+
            esc("Tread "+(i+1)+" · horizontal "+fmt(r.treadEnd-r.treadStart))+'</title></line>';
          if(end-bx>26&&risers.length<=20)content+=svgText(bx+5,high-8,String(i+1),"tick-label");
        }else if(landing>0){
          content+='<line class="stair-landing" data-depth="'+landing+'" data-start="'+r.treadStart+'" data-end="'+r.treadEnd+'" x1="'+bx+'" y1="'+high+'" x2="'+X(fullRun)+'" y2="'+high+'" stroke="#b48456" stroke-width="4"><title>'+
            esc("Upper landing reference depth "+fmt(landing))+'</title></line>';
        }
      }
      content+=svgText(left,48,risers.length+" RISERS · "+Math.max(0,risers.length-1)+" TREADS · FINISHED DATUM","dim-label");
      content+=svgText(left,316,"FLIGHT RUN "+fmt(data.flightRun),"dim-label");
      content+=svgText(466,316,"FOOTPRINT "+fmt(fullRun),"dim-label");
    }else if(data.shape==="deck-plan"){
      const scale=Math.min(716/data.deckLength,210/data.deckWidth);
      const ww=data.deckLength*scale,hh=data.deckWidth*scale;
      const x0=(900-ww)/2,y0=(344-hh)/2;
      content+='<rect x="'+x0+'" y="'+y0+'" width="'+ww+'" height="'+hh+'" fill="#e7eae3" stroke="#1e6454" stroke-width="2"/>';
      for(const [i,row] of data.deckRows.entries()){
        const yy=y0+row.acrossStart*scale,sh=row.ripWidth*scale;
        content+='<rect class="deck-plan-board" data-row="'+(i+1)+
          '" data-across-start="'+row.acrossStart+
          '" data-rip-width="'+row.ripWidth+
          '" x="'+x0+'" y="'+yy+'" width="'+ww+'" height="'+sh+
          '" fill="'+(i%2?"#d2b18b":"#e2c8a5")+
          '" stroke="#957452" stroke-width=".45"><title>'+
          esc(row.item+" · "+fmt(row.ripWidth)+" rip")+'</title></rect>';
        for(const seam of row.seamCenters||[]){
          const xx=x0+seam*scale,jointWidth=(row.seamGap||0)*scale;
          if(jointWidth>0){
            content+='<rect class="deck-plan-butt-gap" data-center="'+seam+
              '" data-gap="'+row.seamGap+'" x="'+(xx-jointWidth/2)+
              '" y="'+yy+'" width="'+jointWidth+'" height="'+sh+
              '" fill="#fcfbf8"><title>'+esc(
                row.item+" clear butt joint "+fmt(row.seamGap)+
                "; nominal geometric joist-face overlap per end "+fmt(row.geometricFaceOverlap)+
                "; NOT a structural bearing approval")+'</title></rect>';
          }
          content+='<line class="deck-plan-seam" x1="'+xx+'" y1="'+yy+
            '" x2="'+xx+'" y2="'+(yy+sh)+
            '" stroke="#9b4e34" stroke-width="'+(jointWidth>0?1.1:2.2)+
            '" stroke-dasharray="'+(jointWidth>0?"3 2":"none")+
            '"><title>'+esc(row.item+" centerline seam station "+fmt(seam)+
              "; actual board ends "+fmt(seam-(row.seamGap||0)/2)+
              " and "+fmt(seam+(row.seamGap||0)/2))+'</title></line>';
        }
      }
      // Dashed centerlines are user-selected layout references, not certified spans.
      for(const [i,xj] of data.joistGrid.entries()){
        const xx=x0+xj*scale;
        content+='<line class="deck-plan-joist" x1="'+xx+'" y1="'+y0+'" x2="'+xx+'" y2="'+(y0+hh)+'" stroke="#1e6454" stroke-width="1.7" stroke-dasharray="4 3"><title>'+esc("Joist reference "+(i+1)+" at "+fmt(xj))+'</title></line>';
      }
      content+='<rect x="'+x0+'" y="'+y0+'" width="'+ww+'" height="'+hh+'" fill="none" stroke="#1e6454" stroke-width="2.5"/>';
      content+=svgText(x0,Math.max(23,y0-13),"LENGTH "+fmt(data.deckLength),"dim-label");
      content+=svgText(x0,Math.min(337,y0+hh+23),"COVERAGE "+fmt(data.deckWidth)+" | "+data.deckRows.length+" ROWS","dim-label");
    }else if(data.shape==="sheathing-panels"){
      const scale=Math.min(715/data.roofEave,207/data.roofSlope);
      const ww=data.roofEave*scale,hh=data.roofSlope*scale,x0=(900-ww)/2,y0=(344-hh)/2;
      for(const [i,sheet] of data.roofSheets.entries()){
        const xx=x0+sheet.eaveStart*scale,yy=y0+sheet.slopeStart*scale;
        const sw=(sheet.eaveEnd-sheet.eaveStart)*scale;
        const sh=(sheet.slopeEnd-sheet.slopeStart)*scale;
        content+='<rect class="sheathing-cut" data-row="'+sheet.row+'" data-column="'+sheet.column+
          '" data-eave-start="'+sheet.eaveStart+'" data-eave-end="'+sheet.eaveEnd+
          '" data-slope-start="'+sheet.slopeStart+'" data-slope-end="'+sheet.slopeEnd+
          '" data-cut-along="'+sheet.cutAlong+'" data-cut-uphill="'+sheet.cutUphill+
          '" x="'+xx+'" y="'+yy+'" width="'+sw+'" height="'+sh+'" fill="'+(i%2?"#d9bc95":"#c7ddcc")+'" stroke="#fffefd" stroke-width="1.6"><title>'+esc(sheet.id+" · eave "+fmt(sheet.eaveStart)+" to "+fmt(sheet.eaveEnd)+" · slope "+fmt(sheet.slopeStart)+" to "+fmt(sheet.slopeEnd)+" · offcut "+fmt(sheet.offcutAreaSqIn/144)+" ft²")+'</title></rect>';
        if(sw>37&&sh>24)content+=svgText(xx+5,yy+17,sheet.id,"tick-label");
      }
      content+='<rect x="'+x0+'" y="'+y0+'" width="'+ww+'" height="'+hh+'" fill="none" stroke="#1e6454" stroke-width="2.5"/>';
      content+=svgText(x0,Math.max(22,y0-12),"EAVE "+fmt(data.roofEave),"dim-label");
      content+=svgText(x0,Math.min(337,y0+hh+23),"UP SLOPE "+fmt(data.roofSlope)+" | "+data.roofSheets.length+" SHEETS","dim-label");
    }else if(data.shape==="roof-panels"){
      const scale=Math.min(710/data.roofMajor,213/data.roofMinor),ww=data.roofMajor*scale,hh=data.roofMinor*scale;
      const x0=(900-ww)/2,y0=(344-hh)/2,colors=["#c7ddcc","#d9bc95","#bdd7c9","#ead1b0"];
      for(const sheet of data.roofPanels){
        // The exported projected-plan vertices are the SVG's sole source of
        // polygon coordinates. Do not round to 0.01 pixels: tiny hip cuts
        // can collapse or misalign at sheet/diagonal intersections.
        const p=sheet.planPoints.map(x=>(x0+x[0]*scale)+","+(y0+x[1]*scale)).join(" ");
        content+='<polygon class="roof-panel-cut" data-panel="'+sheet.id+'" data-plane="'+sheet.planeIndex+'" data-row="'+sheet.row+'" data-column="'+sheet.column+'" points="'+p+'" fill="'+colors[sheet.planeIndex]+'" stroke="#fffefd" stroke-width="1"><title>'+esc(sheet.plane+" "+sheet.id+" · "+sheet.localVertices.length+" nonzero cut edges · "+fmt(sheet.cutAreaSqIn/144)+" ft² used · "+fmt(sheet.offcutAreaSqIn/144)+" ft² unreused offcut")+'</title></polygon>';
      }
      const ridge0=x0+data.roofMinor*scale/2,ridge1=x0+(data.roofMajor-data.roofMinor/2)*scale,mid=y0+hh/2;
      content+='<rect x="'+x0+'" y="'+y0+'" width="'+ww+'" height="'+hh+'" fill="none" stroke="#1e6454" stroke-width="2.5"/>';
      content+='<path d="M'+x0+' '+y0+' L'+ridge0+' '+mid+' L'+x0+' '+(y0+hh)+' M'+(x0+ww)+' '+y0+' L'+ridge1+' '+mid+' L'+(x0+ww)+' '+(y0+hh)+' M'+ridge0+' '+mid+' L'+ridge1+' '+mid+'" fill="none" stroke="#875f39" stroke-width="2"/>';
      content+=svgText(x0,Math.max(22,y0-12),"EAVE "+fmt(data.roofMajor),"dim-label");
      content+=svgText(x0,Math.min(337,y0+hh+22),"WIDTH "+fmt(data.roofMinor)+" | "+data.roofPanels.length+" SHEET CUTS","dim-label");
    }else if(data.shape==="rectangle"){
      // Render ONLY the intended Pythagorean rectangle at true aspect ratio.
      // Two measured diagonals do not determine actual corner locations.
      const sc=Math.min(470/data.rectWidth,193/data.rectHeight);
      const w=data.rectWidth*sc,h=data.rectHeight*sc;
      const x0=(900-w)/2,y0=(334-h)/2;
      content+='<rect class="square-target-outline" x="'+x0+'" y="'+y0+'" width="'+w+'" height="'+h+'" fill="#e4ebe2" stroke="#1e6454" stroke-width="3"><title>'+esc("Ideal target rectangle: "+fmt(data.rectWidth)+" by "+fmt(data.rectHeight))+'</title></rect>';
      content+='<line class="square-target-a" x1="'+x0+'" y1="'+y0+'" x2="'+(x0+w)+'" y2="'+(y0+h)+'" stroke="#b27f49" stroke-width="2.7"><title>'+esc("Ideal diagonal A "+fmt(data.idealDiagonal)+"; measured "+fmt(data.measuredA))+'</title></line>';
      content+='<line class="square-target-b" x1="'+(x0+w)+'" y1="'+y0+'" x2="'+x0+'" y2="'+(y0+h)+'" stroke="#356d81" stroke-dasharray="7 5" stroke-width="2.7"><title>'+esc("Ideal diagonal B "+fmt(data.idealDiagonal)+"; measured "+fmt(data.measuredB))+'</title></line>';
      content+=svgText(74,34,"IDEAL RECTANGLE ONLY · ACTUAL CORNERS NOT INFERRED","dim-label");
      content+=svgText(74,306,"A MEASURED "+fmt(data.measuredA)+" · IDEAL "+fmt(data.idealDiagonal),"tick-label");
      content+=svgText(500,306,"B MEASURED "+fmt(data.measuredB),"tick-label");
      content+=svgText(74,329,"USER TOLERANCE "+fmt(data.diagonalTolerance)+" · "+data.withinCount+"/3 NUMERIC CHECKS","tick-label");
    }else if(data.shape==="roof"){
      content+='<rect x="235" y="73" width="465" height="195" fill="#e4ebe2" stroke="#1e6454" stroke-width="3"/>';
      content+='<path d="M235 170 L333 73 M235 170 L333 268 M700 170 L602 73 M700 170 L602 268 M333 170 L602 170" stroke="#b27f49" stroke-width="2.5" fill="none"/>';
    }else if(data.shape==="ring"){
      // Each produced face is a real 4-corner trapezoid with straight
      // chord edges, rather than a curved arc suggesting prebent stock.
      const seg=data.segments||12,R=105,cx=470,cy=166,r=R*data.inner/data.outer;
      for(let i=0;i<seg;i++){
        const a1=i*2*Math.PI/seg-Math.PI/2,a2=(i+1)*2*Math.PI/seg-Math.PI/2;
        const p=(radius,a)=>[cx+radius*Math.cos(a),cy+radius*Math.sin(a)];
        const vertices=[p(R,a1),p(R,a2),p(r,a2),p(r,a1)];
        const points=vertices.map(v=>v.join(",")).join(" ");
        content+='<polygon class="ring-segment-face" data-segment="'+(i+1)+
          '" data-outer-chord="'+data.rows[i].outerChord+
          '" data-inner-chord="'+data.rows[i].innerChord+
          '" data-perpendicular-depth="'+data.rows[i].perpendicularFaceDepth+
          '" points="'+points+'" fill="'+(i%2?"#dfb989":"#c9945f")+
          '" stroke="#704f2d" stroke-width=".8"><title>'+
          esc("Straight trapezoid segment "+(i+1)+
            "; outer chord "+fmt(data.rows[i].outerChord)+
            "; perpendicular depth "+fmt(data.faceDepth))+'</title></polygon>';
      }
      const inscribedRadius=R*Math.cos(Math.PI/seg);
      content+='<circle class="ring-max-turn-circle" cx="'+cx+'" cy="'+cy+
        '" r="'+inscribedRadius+'" fill="none" stroke="#1e6454" stroke-width="2" stroke-dasharray="4 4"><title>'+
        esc("Ideal maximum circular outside diameter "+fmt(data.turningLimit)+
          "; corner-to-corner outside polygon diameter "+fmt(data.outer))+'</title></circle>';
      content+=svgText(85,43,"STRAIGHT-CHORD POLYGON RING · NOT CURVED STOCK","dim-label");
      content+=svgText(85,64,"DASHED CIRCLE = MAX IDEAL TURNED OUTER DIAMETER","tick-label");
      content+=svgText(74,312,"CORNER DIAMETER "+fmt(data.outer),"dim-label");
      content+=svgText(515,312,"ROUND OD LIMIT "+fmt(data.turningLimit),"dim-label");
      // Separate side-elevation view of corner-to-corner polygon ring
      // envelopes. This is a stack profile, not a lathe-ready section.
      const stack=data.ringProfiles||[],maxD=Math.max(...stack.map(r=>r.outer));
      const height=stack.length*data.ringHeight;
      const sideScale=Math.min(175/Math.max(1e-7,maxD),165/Math.max(1e-7,height));
      const centerX=744,bottomY=269;
      for(const item of stack){
        const ww=item.outer*sideScale,hh=(item.stackTop-item.stackBottom)*sideScale;
        content+='<rect class="ring-stack-outline" data-ring="'+item.ring+
          '" data-outer-diameter="'+item.outer+'" data-inner-diameter="'+item.inner+
          '" x="'+(centerX-ww/2)+'" y="'+(bottomY-item.stackTop*sideScale)+
          '" width="'+ww+'" height="'+hh+'" fill="none" stroke="#346a56" stroke-width="1.4"><title>'+
          esc("Ring "+item.ring+" corner diameter "+fmt(item.outer)+
              " · stack height "+fmt(item.stackTop))+'</title></rect>';
      }
      content+=svgText(650,49,"STACK ENVELOPE · CORNER DIAMETERS","tick-label");
      content+=svgText(655,290,"TOTAL STACK "+fmt(height),"tick-label");
    }else if(data.shape==="spiral-plan"){
      const d=data.spiralPlan,R=d.outerRadius,r=d.innerRadius,cx=468,cy=176,
        scale=128/R;
      content+='<circle class="spiral-outer-envelope" cx="'+cx+'" cy="'+cy+
        '" r="'+(R*scale)+'" fill="none" stroke="#b9c4ba" stroke-width="2"/>';
      content+='<circle class="spiral-walkline" cx="'+cx+'" cy="'+cy+
        '" r="'+(d.walkRadius*scale)+'" fill="none" stroke="#bc9050" stroke-dasharray="5 4" stroke-width="1.7"/>';
      for(const [i,row] of d.rows.entries()){
        const points=row.planVertices.map(v=>(cx+(v[0]-R)*scale)+","+
          (cy+(v[1]-R)*scale)).join(" ");
        content+='<polygon class="spiral-tread-face" data-index="'+(i+1)+
          '" data-sector-area-ft2="'+row.treadAnnularAreaFt2+
          '" data-chord-area-ft2="'+row.treadChordPolygonAreaFt2+
          '" data-start-angle="'+row.startAngleDeg+
          '" data-end-angle="'+row.endAngleDeg+
          '" data-elevation-in="'+row.treadTopElevation+
          '" data-walk-arc-in="'+row.walklineArcLength+
          '" points="'+points+
          '" fill="'+(i%2?"#dbe8dc":"#f2dfc6")+
          '" stroke="#456a59" stroke-width="1"><title>'+
          esc(row.item+" · elevation "+fmt(row.treadTopElevation)+
            " · walk-line arc "+fmt(row.walklineArcLength))+
          '</title></polygon>';
      }
      content+='<circle class="spiral-center-post" cx="'+cx+'" cy="'+cy+
        '" r="'+(r*scale)+'" fill="#667d70" stroke="#2c4b3d" stroke-width="1.5"/>';
      content+=svgText(76,50,"SPIRAL TOP VIEW · POLAR XY CHORD REFERENCE","dim-label");
      content+=svgText(76,71,"ONE TURN ONLY · NOT CODE / STRUCTURAL APPROVAL","tick-label");
      content+=svgText(76,91,"DRAWN STRAIGHT CHORDS ≠ CURVED SECTOR AREA","tick-label");
      content+=svgText(75,315,d.rows.length+" PHYSICAL TREADS · "+
        trim(d.treadAngle,3)+"° EACH · POLE "+fmt(d.poleDiameter),"dim-label");
      content+=svgText(600,335,"WALK RADIUS "+fmt(d.walkRadius),"tick-label");
    }else if(data.shape==="stave-trapezoid"){
      const d=data.staveBlank,scale=Math.min(142/Math.max(d.topChord,d.bottomChord),
        205/d.faceLength),cx=465,top=76,
        maxWidth=Math.max(d.topChord,d.bottomChord),left=cx-maxWidth*scale/2;
      const points=d.vertices.map(v=>(left+v[0]*scale)+","+
        (top+v[1]*scale)).join(" ");
      content+='<polygon class="stave-face" data-plan-scale="'+scale+
        '" data-origin-x="'+left+'" data-origin-y="'+top+
        '" data-top-chord-in="'+d.topChord+
        '" data-bottom-chord-in="'+d.bottomChord+
        '" data-face-length-in="'+d.faceLength+
        '" data-edge-length-in="'+d.edgeLength+
        '" data-half-dihedral-deg="'+d.halfDihedralDeg+
        '" points="'+points+'" fill="#e5c79c" stroke="#825c35" stroke-width="2"/>';
      content+=svgText(76,50,"STRAIGHT POLYGON-FRUSTUM STAVE · OUTSIDE FACE","dim-label");
      content+=svgText(76,70,"FACETED FACE, NOT A BULGED BARREL","tick-label");
      content+=svgText(78,315,"TOP CHORD "+fmt(d.topChord)+
        " / BOTTOM CHORD "+fmt(d.bottomChord),"dim-label");
      content+=svgText(575,315,"FACE SLANT "+fmt(d.faceLength),"tick-label");
      content+=svgText(575,334,"CORNER EDGE "+fmt(d.edgeLength),"tick-label");
    }else if(data.shape==="angles"){
      // Two independent angle illustrations. The inside/left choices affect
      // the PLAN reference orientation only, NEVER a real saw hand setting.
      const m=data.miter*Math.PI/180,b=data.bevel*Math.PI/180;
      const ox=255,oy=190,ray=140,sgn=data.planSign;
      const mx=ox+ray*Math.cos(m),my=oy-sgn*ray*Math.sin(m);
      content+='<line class="crown-miter-base" x1="'+ox+'" y1="'+oy+'" x2="'+(ox+ray)+'" y2="'+oy+'" stroke="#386b57" stroke-width="3"/>';
      content+='<line class="crown-miter-ray" data-sign="'+sgn+
        '" data-magnitude-deg="'+data.miter+
        '" data-plan-turn-deg="'+(sgn*data.miter)+
        '" x1="'+ox+'" y1="'+oy+'" x2="'+mx+'" y2="'+my+
        '" stroke="#bd8651" stroke-width="3.2"><title>'+
        esc("Illustrative plan turn "+trim(sgn*data.miter,3)+
          " degrees; NOT a left/right saw setting")+'</title></line>';
      const bx=610,by=240,br=145;
      content+='<line x1="'+bx+'" y1="'+by+'" x2="'+(bx+br)+'" y2="'+by+'" stroke="#386b57" stroke-width="3"/>';
      content+='<line class="crown-bevel-ray" data-bevel-deg="'+data.bevel+
        '" x1="'+bx+'" y1="'+by+'" x2="'+(bx+br*Math.cos(b))+
        '" y2="'+(by-br*Math.sin(b))+
        '" stroke="#bd8651" stroke-width="3.2"><title>'+
        esc("Bevel magnitude "+trim(data.bevel,3)+
          " degrees; test physical saw setup on scrap stock")+'</title></line>';
      content+=svgText(93,69,"MITER · ILLUSTRATIVE PLAN","dim-label");
      content+=svgText(93,89,(data.inside?"INSIDE":"OUTSIDE")+" / "+(data.left?"LEFT":"RIGHT")+" REFERENCE","tick-label");
      content+=svgText(93,317,trim(sgn*data.miter,2)+"° (NOT SAW SETTING)","dim-label");
      content+=svgText(93,334,"TEST LEFT/RIGHT ON SCRAP FIRST","tick-label");
      content+=svgText(573,69,"BEVEL · MAGNITUDE","dim-label");
      content+=svgText(594,315,trim(data.bevel,2)+"°","dim-label");
    }
    const title=esc(tool.title),label=esc("All diagram dimensions in "+({in:"inches",ft:"feet",mm:"millimeters",cm:"centimeters",m:"meters"}[unit]||"inches"));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 344" role="img" data-model-shape="'+esc(data.shape)+'" data-model-span-in="'+data.span+'" aria-label="'+title+' scaled schematic based on calculated values"><title>'+title+'</title><desc>'+label+'; illustrative geometry, not a one-to-one cutting template</desc><style>.gridline{stroke:#dbe1d9;stroke-width:1}.axis{stroke:#385f4d;stroke-width:2}.tick-label{font:12px ui-monospace,monospace;fill:#36574e}.dim-label{font:15px ui-monospace,monospace;fill:#203b33}</style><rect width="900" height="344" fill="#fcfbf8"/>'+grid+content+'</svg>';
  }
  const save=(name,content,type)=>{
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  };
  const scheduleValue=(kind,v,key="")=>{
    if(v===null||v===undefined)return "—";
    if(kind==="vertices"&&Array.isArray(v))
      return v.map(point=>"("+point.map(n=>fmt(n)).join(", ")+")").join("; ");
    if(kind==="lengthList"&&Array.isArray(v))
      return v.length?v.map(n=>fmt(n,"L")).join("; "):"—";
    if(kind==="area")return fmt(v,"FT2");
    if(kind==="angle")return fmt(v,"A");
    if(kind==="length"&&typeof v==="number")return fmt(v,"L")+(slug==="framing-calculator"&&key==="cutLength"&&unit==="in"?" (≈ "+frac(v)+")":"");
    return String(v);
  };
  const syncTableColumnNavigator=(region,overflowsHorizontally)=>{
    // Mobile cut tables often hide most columns past the right viewport
    // boundary. Display explicit touch/keyboard column controls ONLY when
    // the true rendered table is wider than its scroll container.
    const previous=region.previousElementSibling;
    let nav=previous?.classList.contains("table-navigator")?previous:null;
    if(!overflowsHorizontally){
      nav?.remove();
      delete region.dataset.horizontalScroll;
      return;
    }
    if(!nav){
      const tableName=region.querySelector("table")?.getAttribute("aria-label")||
        "Measurement table";
      nav=document.createElement("div");
      nav.className="table-navigator";
      nav.setAttribute("role","group");
      nav.setAttribute("aria-label",tableName+" horizontal column controls");
      nav.innerHTML='<button class="table-nav-prev" type="button" aria-label="Show columns to the left">← Columns</button>'+
        '<span class="table-nav-position" aria-live="off">Columns: 0% across</span>'+
        '<button class="table-nav-next" type="button" aria-label="Show columns to the right">Columns →</button>';
      region.before(nav);
      for(const [selector,direction] of [[".table-nav-prev",-1],[".table-nav-next",1]]){
        nav.querySelector(selector).addEventListener("click",()=>{
          const step=Math.max(120,Math.round(region.clientWidth*.78));
          region.scrollBy({left:direction*step,behavior:"auto"});
          updateTableColumnNavigator(region);
        });
      }
      // Register the passive native scroll event once for each stable table
      // wrapper. Newly recreated toolbar siblings are resolved dynamically.
      if(region.dataset.columnScrollListener!=="true"){
        region.addEventListener("scroll",()=>updateTableColumnNavigator(region),
          {passive:true});
        region.dataset.columnScrollListener="true";
      }
    }
    region.dataset.horizontalScroll="true";
    updateTableColumnNavigator(region);
  };
  const updateTableColumnNavigator=region=>{
    const nav=region.previousElementSibling;
    if(!nav?.classList.contains("table-navigator"))return;
    const max=Math.max(0,region.scrollWidth-region.clientWidth);
    const current=Math.max(0,Math.min(max,region.scrollLeft));
    const first=current<=2,last=current>=max-2;
    nav.querySelector(".table-nav-prev").disabled=first;
    nav.querySelector(".table-nav-next").disabled=last;
    const progress=max?Math.round(100*current/max):0;
    const message=first?"more columns right":last?"end of columns":
      "more columns left and right";
    nav.querySelector(".table-nav-position").textContent=
      progress+"% across · "+message;
  };
  const syncKeyboardScrollRegions=()=>{
    // A scroll area is not reachable with a keyboard merely because CSS
    // says overflow:auto. Add ONE native tab stop only when horizontal or
    // vertical overflow is present, and remove it when resizing resolves it.
    for(const region of document.querySelectorAll(".table-scroll, .drawing-grid")){
      const overflowX=region.scrollWidth>region.clientWidth+2;
      const overflowY=region.scrollHeight>region.clientHeight+2;
      const visible=region.getClientRects().length>0;
      const canScroll=(overflowX||overflowY)&&visible;
      if(region.classList.contains("table-scroll")){
        // An invalid or uninitialized result may still have a CSS min-width.
        // Do not offer meaningless column buttons for empty/error placeholders.
        const useful=Boolean(region.querySelector("thead th:nth-child(2)")&&
          region.querySelector("tbody tr > :not([colspan])"));
        syncTableColumnNavigator(region,overflowX&&visible&&useful);
      }
      if(canScroll){
        region.tabIndex=0;
        region.setAttribute("role","region");
        region.dataset.keyboardScroll="true";
        if(!region.getAttribute("aria-label")){
          const label=region.querySelector("table")?.getAttribute("aria-label")||
            region.closest(".content-block")?.querySelector("h2")?.textContent?.trim()||
            (region.id==="dimension-svg"?"Zoomed dimension drawing":"Measurement table");
          region.setAttribute("aria-label",label+" — arrow keys to scroll");
          region.dataset.autoScrollLabel="true";
        }
      }else if(region.dataset.keyboardScroll==="true"){
        // Preserve author-supplied labels (such as the dimension drawing).
        region.removeAttribute("tabindex");
        region.removeAttribute("role");
        if(region.dataset.autoScrollLabel==="true")region.removeAttribute("aria-label");
        delete region.dataset.keyboardScroll;
        delete region.dataset.autoScrollLabel;
      }
    }
  };
  window.addEventListener("resize",()=>requestAnimationFrame(syncKeyboardScrollRegions));
  window.addEventListener("afterprint",()=>requestAnimationFrame(syncKeyboardScrollRegions));
  const renderSchedule=()=>{
    if(!latest||!latest.rows.length){
      cut.innerHTML='<tbody><tr><td>Calculated dimensions are shown above. No repeating cut list for this geometry.</td></tr></tbody>';
      scheduleCount.textContent="";
      schedulePager.hidden=true;
      return;
    }
    const count=latest.rows.length,pages=Math.ceil(count/schedulePageSize);
    const printableGroups=scheduleCols.length>5?Math.ceil((scheduleCols.length-1)/4):1;
    const bulkAdvice=count>=160?" Large worksheet: "+count+" cuts in "+printableGroups+
      " printed measurement groups. Use CSV for bulk jobs to avoid a very long printout.":"";
    schedulePage=Math.min(Math.max(0,schedulePage),pages-1);
    const start=schedulePage*schedulePageSize,end=Math.min(count,start+schedulePageSize);
    // Screen DOM stays capped at 160 rows. The browser's beforeprint hook
    // temporarily materializes the complete schedule so native Ctrl+P and
    // the Print/PDF button cannot silently omit all nonvisible pages.
    const visible=printFullSchedule?latest.rows:latest.rows.slice(start,end);
    cut.innerHTML='<thead><tr>'+scheduleCols.map(col=>'<th scope="col">'+esc(col.label)+'</th>').join("")+'</tr></thead><tbody>'+
      visible.map((row,i)=>'<tr'+(geometrySelector()?' data-geometry-row="'+(printFullSchedule?i+1:start+i+1)+'"':'')+'>'+scheduleCols.map((col,i)=>
        '<td'+(i===0?' role="rowheader"':'')+'>'+esc(scheduleValue(col.kind,row[col.key],col.key))+'</td>'
      ).join("")+'</tr>').join("")+'</tbody>';
    schedulePager.hidden=printFullSchedule||pages<=1;
    schedulePrev.disabled=schedulePage===0;
    scheduleNext.disabled=schedulePage===pages-1;
    schedulePageInput.max=String(pages);
    schedulePageInput.value=String(schedulePage+1);
    schedulePageStatus.textContent="Page "+(schedulePage+1)+" of "+pages;
    highlightGeometry();
    scheduleCount.textContent=printFullSchedule?
      "PRINT WORKSHEET — all "+count+" calculated rows included; CSV contains the same "+count+" rows."+bulkAdvice:
      count>schedulePageSize?
        "Showing rows "+(start+1)+"–"+end+" of "+count+
          ". Print / PDF includes ALL "+count+" rows; CSV also includes all rows."+bulkAdvice:
        "Showing "+count+" computed rows.";
  };
  const renderReadablePrintSchedule=()=>{
    if(!printReadableSchedule)return;
    const tableRegion=cut.closest(".table-scroll");
    if(!printFullSchedule||!latest?.rows?.length||scheduleCols.length<=5){
      printReadableSchedule.hidden=true;
      printReadableSchedule.innerHTML="";
      printReadableSchedule.classList.remove("print-schedule-long");
      tableRegion?.classList.remove("print-original-schedule-hidden");
      return;
    }
    const first=scheduleCols[0],parts=[];
    // One identifier plus four numeric measurement fields fits A4 and Letter
    // at 9pt while reducing redundant group headers and repeated row IDs.
    const metricsPerGroup=4;
    const total=Math.ceil((scheduleCols.length-1)/metricsPerGroup);
    for(let i=1;i<scheduleCols.length;i+=metricsPerGroup){
      const cols=[first,...scheduleCols.slice(i,i+metricsPerGroup)];
      const part=1+Math.floor((i-1)/metricsPerGroup);
      const header=cols.map(c=>'<th scope="col">'+esc(c.label)+'</th>').join("");
      const rows=latest.rows.map(row=>'<tr>'+cols.map((c,j)=>
        '<td'+(j===0?' role="rowheader"':'')+'>'+esc(scheduleValue(c.kind,row[c.key],c.key))+'</td>'
      ).join("")+'</tr>').join("");
      parts.push('<section class="print-schedule-part"><h3>Measurement schedule · part '+
        part+' of '+total+'</h3><p>'+latest.rows.length+
        ' measured rows · '+esc(cols.slice(1).map(c=>c.label).join(", "))+
        '. Match entries using the repeated first column.</p>'+
        '<table aria-label="Print measurement schedule part '+part+' of '+total+
        '"><thead><tr>'+header+'</tr></thead><tbody>'+rows+'</tbody></table></section>');
    }
    printReadableSchedule.innerHTML=parts.join("");
    printReadableSchedule.classList.toggle("print-schedule-long",latest.rows.length>=160);
    printReadableSchedule.hidden=false;
    tableRegion?.classList.add("print-original-schedule-hidden");
  };
  const renderPrintInputSnapshot=()=>{
    if(!printInputPanel||!printInputRows||!printInputContext)return;
    if(!latest){
      printInputPanel.hidden=true;
      printInputRows.innerHTML="";
      return;
    }
    // The print worksheet omits the entire editable input sidebar. Capture
    // all actual raw form values (including advanced optional values),
    // not display-rounded metrics or default values guessed by the client.
    // Disabled, non-applied loss-review controls are not job measurements.
    // Preserve every active input when review is enabled, but do not add
    // four irrelevant blank audit settings to default print worksheets.
    const includedFields=latest?.stockAudit?.enabled?tool.inputs:
      tool.inputs.filter(f=>!f.key.startsWith("stockAudit"));
    printInputRows.innerHTML=includedFields.map(f=>{
      const field=form.elements.namedItem(f.key);
      const raw=field?.value??"";
      const display=f.kind==="E"?
        (f.options||[]).find(choice=>String(choice.value)===String(raw))?.label??raw:
        f.kind==="L"?raw+" "+unit:
        f.kind==="A"?raw+"°":
        f.kind==="D"?raw+"%":
        f.kind==="P"?raw+" rise per 12 run":
        f.kind==="C"?currencyCode()+" "+raw:raw;
      return '<tr data-print-field="'+esc(f.key)+'"><th scope="row">'+
        esc(f.label)+'</th><td>'+esc(display)+'</td></tr>';
    }).join("");
    printInputContext.textContent="Actual typed measurements at print time · input units "+unit+
      " · entered price currency "+currencyCode()+
      " · inch display precision 1/"+(Number(fraction.value)||16)+
      ". Includes optional advanced inputs and disabled-by-zero settings. "+
      (tool.slug==="framing-calculator"&&!latest?.stockAudit?.enabled?
        " Optional stock-loss review is OFF, so its inactive parameters are not shown.":"")+
      "No structural or field verification is implied.";
    printInputPanel.hidden=false;
  };
  // Wide supplier, drilling and stair schedules stay intact on screen and in
  // CSV. Only the print snapshot repeats identifying columns in readable
  // sections. Every source cell is copied in row order; no geometry is rerun.
  const specialtyPrintLayouts=[
    ["framing-material-table",1,5],["framing-price-table",2,5],
    ["framing-offer-table",2,5],["framing-proof-table",1,5],
    ["framing-reuse-table",3,6],["framing-reuse-purchase-table",2,5],
    ["framing-station-table",3,6],
    ["deck-budget-table",1,5],["deck-fastener-table",1,5],
    ["stringer-sawline-table",2,5],["stringer-end-lines-table",2,5],
    ["stringer-end-contact-table",2,5],["shelf-pin-table",3,6],
    ["roof-reuse-table",3,6]
  ];
  const clearSpecialtyPrintTables=()=>{
    for(const node of document.querySelectorAll(".print-specialty-groups"))node.remove();
    for(const node of document.querySelectorAll(".print-specialty-original-hidden"))
      node.classList.remove("print-specialty-original-hidden");
  };
  const renderSpecialtyPrintTables=()=>{
    clearSpecialtyPrintTables();
    if(!printFullSchedule||!latest)return;
    for(const [id,identityColumns,maxColumns] of specialtyPrintLayouts){
      const source=document.getElementById(id);
      const header=source?.tHead?.rows[0];
      const body=source?.tBodies[0];
      if(!header||!body||!body.rows.length||header.cells.length<=maxColumns)continue;
      const region=source.closest(".table-scroll");
      if(!region)continue;
      const names=[...header.cells].map(cell=>cell.textContent.trim());
      const rows=[...body.rows].map(tr=>[...tr.cells].map(td=>td.textContent.trim()));
      // Defensive: malformed/incomplete DOM cannot yield a silently
      // partial worksheet. Leave the original table printable instead.
      if(rows.some(cells=>cells.length!==names.length))continue;
      const step=maxColumns-identityColumns;
      const total=Math.ceil((names.length-identityColumns)/step);
      const wrapper=document.createElement("div");
      wrapper.className="print-specialty-groups";
      wrapper.dataset.source=id;
      wrapper.setAttribute("aria-label",source.getAttribute("aria-label")||id);
      const parts=[];
      for(let offset=identityColumns;offset<names.length;offset+=step){
        const cols=[...Array(identityColumns).keys(),
          ...Array.from({length:Math.min(step,names.length-offset)},(_,i)=>offset+i)];
        const number=1+Math.floor((offset-identityColumns)/step);
        const tableHead=cols.map(c=>'<th scope="col">'+esc(names[c])+'</th>').join("");
        const tableRows=rows.map(cells=>'<tr>'+cols.map((c,index)=>
          '<td'+(index===0?' role="rowheader"':'')+'>'+esc(cells[c])+'</td>'
        ).join("")+'</tr>').join("");
        parts.push('<section class="print-specialty-part" data-part="'+number+'">'+
          '<h4>'+esc(source.getAttribute("aria-label")||id)+' · columns '+number+
          ' of '+total+'</h4><table aria-label="'+
          esc(source.getAttribute("aria-label")||id)+' · print columns '+number+
          ' of '+total+'"><thead><tr>'+tableHead+'</tr></thead><tbody>'+
          tableRows+'</tbody></table></section>');
      }
      wrapper.innerHTML=parts.join("");
      region.insertAdjacentElement("afterend",wrapper);
      region.classList.add("print-specialty-original-hidden");
    }
  };
  const setPrintFullSchedule=enabled=>{
    // Neither a stale invalid worksheet nor a native print dialog should
    // invent geometry. afterprint restores the EXACT prior screen page.
    if(printFullSchedule===enabled)return;
    printFullSchedule=enabled;
    if(latest?.rows?.length)renderSchedule();
    renderReadablePrintSchedule();
    renderSpecialtyPrintTables();
  };
  let closedProofBeforePrint=[];
  window.addEventListener("beforeprint",()=>{
    setPrintFullSchedule(true);
    const disclosures=[...document.querySelectorAll(".advanced-results-disclosure")];
    closedProofBeforePrint=disclosures.filter(el=>!el.open);
    disclosures.forEach(el=>{el.open=true;});
  });
  window.addEventListener("afterprint",()=>{
    setPrintFullSchedule(false);
    closedProofBeforePrint.forEach(el=>{el.open=false;});
    closedProofBeforePrint=[];
  });
  // Framing summary and stock-by-stock schedule reuse exactly the engine's
  // stockPlan/materialSummary. Fraction rounding remains UI-only.
  const takeoffLength=v=>fmt(v,"L")+(unit==="in"?" (≈ "+frac(v)+")":"");
  // Local stock intervals use compact numeric endpoints, never fraction-
  // rounded positions. The main measurement schedule still offers fractions.
  const stockLocalValue=v=>Number(convertFromInches(v,unit).toPrecision(15)).toString();
  // Independently entered site dimensions are never populated from model
  // defaults. A changed cutting plan invalidates every previous entry.
  const fieldUnits=v=>v===null||v===undefined?"":String(
    Number(convertFromInches(v,unit).toPrecision(12)));
  const fieldNumeric=(raw,source=false)=>{
    if(raw.trim()==="")return null;
    const x=Number(raw);
    if(!Number.isFinite(x)||(source?x<=0:x<0))return NaN;
    return convertToInches(x,unit);
  };
  const refreshReviewVersionPanel=()=>{
    if(!versionPanel)return;
    const current=versionState.current;
    versionPanel.hidden=!current;
    versionPin.disabled=!current;
    versionJson.disabled=!current;
    versionDiffCsv.disabled=!current||!versionState.reference;
    versionRestore.disabled=!current||!versionState.reference;
    if(versionRestoreWarning&&!current)versionRestoreWarning.hidden=true;
    if(!current){
      versionIdentifiers.textContent="No current alternative review packet.";
      versionStatus.textContent=versionState.reference?
        "Reference retained locally; enable a valid alternative to compare it.":
        "No review reference saved in this page.";
      versionDiffTable.innerHTML="";
      versionState.difference=null;
      return;
    }
    const i=current.versionIds;
    versionIdentifiers.textContent=
      "PACKET "+i.packet+"\n"+
      "LAYOUT "+i.layout+"\n"+
      "MEASUREMENTS "+i.measurement+"\n"+
      "SUPPLIER QUOTE "+i.quotation+"\n"+
      "SELF-DECLARATIONS "+i.declaration;
    if(versionState.importError){
      versionStatus.textContent="IMPORT REJECTED — "+versionState.importError+
        " Previous reference, if any, remains unchanged.";
      versionState.importError=null;
    }else if(!versionState.reference){
      versionStatus.textContent=
        "No comparison reference pinned. Download the current JSON, "+
        "or pin this version to compare changes in the current page. "+
        "No site action authorizes buying.";
    }
    if(!versionState.reference){
      versionState.difference=null;
      versionDiffTable.innerHTML="";
      return;
    }
    const result=compareFramingReviewVersions(versionState.reference,current);
    versionState.difference=result;
    versionDiffCsv.disabled=result.changes.length===0;
    versionRestore.disabled=
      versionState.reference.versionIds.layout!==current.versionIds.layout;
    if(!versionStatus.textContent.startsWith("IMPORT REJECTED")){
      versionStatus.textContent=result.samePacket?
        "SAME PACKET — "+result.currentId+
        ". Reference matches all four current components; "+
        "this is NOT a material certification or order approval.":
        "CHANGED PACKET — reference "+result.referenceId+
        " vs current "+result.currentId+"; "+
        result.changedSections.join(", ")+" changed; "+
        result.totalChanges+" detailed field differences. "+
        "Export the complete comparison for the whole change list.";
    }
    const display=result.changes.slice(0,30);
    versionDiffTable.innerHTML=display.length?
      display.map(row=>'<tr>'+
        [row.section,row.field,row.before,row.after]
          .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join(""):
      '<tr><td colspan="4">No differences between reference and current packet.</td></tr>';
  };
  const renderReviewVersion=(ledger,measurements,report)=>{
    versionState.current=makeFramingReviewVersion({
      ledger,fieldReview:measurements,fieldInputs:{
        sawKerf:fieldDraft.sawKerf,endTrim:fieldDraft.endTrim,
        finalSeverKerf:fieldDraft.finalSeverKerf
      },purchaseReview:report,alternative:latest?.stockReusePlan,
      currency:currencyCode()
    });
    refreshReviewVersionPanel();
  };
  const renderPurchaseReview=(ledger,measurements)=>{
    if(!purchaseReviewPanel)return;
    const available=Boolean(ledger?.available);
    purchaseReviewPanel.hidden=!available;
    purchaseReviewExport.disabled=!available;
    if(!available){
      purchaseReviewTable.innerHTML="";
      purchaseReviewStatus.textContent="HOLD — no valid alternative and field review.";
      renderReviewVersion(null,null,null);
      clearPurchaseReview();
      return;
    }
    const alternative=latest?.stockReusePlan;
    const quoteSignature=JSON.stringify([currencyCode(),
      alternative?.reallocatedQuotedSubtotal,
      (alternative?.purchaseVariants||[]).map(row=>[
        row.stockGroup,row.offerCode,row.unitPrice,row.purchaseSticks,row.purchaseCost])]);
    if(purchaseReviewDraft.quoteSignature!==quoteSignature){
      purchaseReviewDraft.globals.supplierVerified=false;
      purchaseReviewDraft.globals.totalCostReviewed=false;
      purchaseReviewDraft.quoteSignature=quoteSignature;
    }
    const previousIds=[...purchaseReviewTable.querySelectorAll("tr[data-review-source]")].map(
      row=>row.getAttribute("data-review-source"));
    if(JSON.stringify(previousIds)!==JSON.stringify(ledger.bars.map(b=>b.stockId))){
      purchaseReviewTable.innerHTML=ledger.bars.map(bar=>{
        const id=esc(bar.stockId);
        return '<tr data-review-source="'+id+'"><td>'+id+' · '+esc(bar.stockGroup)+'</td>'+
          '<td data-review-dimension>—</td>'+
          '<td><label><input type="checkbox" data-review-source-input="'+id+
          '" data-review-source-key="profileGradeReviewed" aria-label="I reviewed profile and grade for '+
          id+'"><span class="review-print-value">NOT DECLARED</span></label></td>'+
          '<td><label><input type="checkbox" data-review-source-input="'+id+
          '" data-review-source-key="defectsReviewed" aria-label="I reviewed defects for '+
          id+'"><span class="review-print-value">NOT DECLARED</span></label></td>'+
          '<td data-review-outcome>HOLD</td></tr>';
      }).join("");
    }
    const report=assessFramingPurchaseReview(ledger,measurements,
      purchaseReviewDraft.stocks,purchaseReviewDraft.globals,alternative);
    for(const row of report.rows){
      const tr=[...purchaseReviewTable.querySelectorAll("tr[data-review-source]")].
        find(el=>el.getAttribute("data-review-source")===row.stockId);
      if(!tr)continue;
      tr.querySelector("[data-review-dimension]").textContent=row.dimensionStatus;
      tr.querySelector("[data-review-outcome]").textContent=row.sourceStatus;
      for(const key of ["profileGradeReviewed","defectsReviewed"]){
        const input=tr.querySelector('[data-review-source-key="'+key+'"]');
        if(input){
          input.checked=row[key];
          input.nextElementSibling.textContent=row[key]?
            "USER DECLARED":"NOT DECLARED";
        }
      }
    }
    for(const key of ["sawSafetyReviewed","structuralReviewed",
      "supplierVerified","totalCostReviewed"]){
      const input=purchaseReviewPanel.querySelector('[data-review-global="'+key+'"]');
      if(!input)continue;
      input.checked=report.globalChecks[key]===true;
      const note=input.nextElementSibling;
      if(note?.matches(".review-print-value"))note.textContent=input.checked?
        "USER DECLARED":"NOT DECLARED";
    }
    purchaseReviewStatus.textContent=report.status+
      " · "+report.reviewed+"/"+report.total+" source inspection sets declared"+
      " · "+report.shortOrInvalid+" source dimensions incomplete or short"+
      " · "+report.globalPending.length+" other declarations pending"+
      " · "+(report.quoteComplete?
        "Model quote "+money(report.reviewedQuotedSubtotal)+" (not actual invoice)":
        "Supplier price data incomplete")+
      ". No order authorization is issued by the site.";
    renderReviewVersion(ledger,measurements,report);
  };
  const renderFieldPreflight=ledger=>{
    if(!fieldPanel)return;
    const available=Boolean(ledger?.available);
    fieldPanel.hidden=!available;
    fieldExport.disabled=!available;
    if(!available){
      renderPurchaseReview(null,null);
      fieldDraft.signature="";
      fieldDraft.sources.clear();
      fieldDraft.sawKerf=null;fieldDraft.endTrim=null;fieldDraft.finalSeverKerf=null;
      fieldTable.innerHTML="";
      fieldStatus.textContent="No usable alternative station layout; measured inputs have been cleared.";
      return;
    }
    const signature=JSON.stringify([ledger.bars.map(b=>[
      b.stockId,b.stockLength,b.retainedPieces,b.lastSeverKerf,b.unallocatedTail]),
      ledger.rows.map(x=>[x.stockId,x.segmentKind,x.stationStart,x.stationEnd,x.item])]);
    const changed=fieldDraft.signature!==signature;
    if(changed){
      clearPurchaseReview();
      fieldDraft.sources.clear();
      fieldDraft.sawKerf=null;fieldDraft.endTrim=null;fieldDraft.finalSeverKerf=null;
      fieldDraft.signature=signature;
    }
    const rebuilt=changed||fieldDraft.unit!==unit||fieldTable.children.length!==ledger.bars.length;
    if(rebuilt){
      fieldDraft.unit=unit;
      for(const key of ["sawKerf","endTrim","finalSeverKerf"]){
        const input=fieldPanel.querySelector('[data-measured-global="'+key+'"]');
        if(input)input.value=fieldUnits(fieldDraft[key]);
      }
      fieldPanel.querySelectorAll("[data-field-unit]").forEach(el=>el.textContent=unit);
      fieldTable.innerHTML=ledger.bars.map(b=>'<tr data-source-id="'+esc(b.stockId)+'">'+
        '<td>'+esc(b.stockId)+' · '+esc(b.stockGroup)+'</td>'+
        '<td>'+esc(fmt(b.stockLength,"L"))+'</td>'+
        '<td><label><span class="sr-only">Entered stock length for '+esc(b.stockId)+'</span>'+
        '<input type="number" min="0" step="any" inputmode="decimal" data-measured-stock="'+
          esc(b.stockId)+'" aria-label="Actual source length for '+esc(b.stockId)+' in '+esc(unit)+'" value="'+
          esc(fieldUnits(fieldDraft.sources.get(b.stockId)??null))+'" placeholder="Not entered"></label>'+
        '<span class="field-print-value" data-field-echo>Not entered</span></td>'+
        '<td data-field-required>—</td><td data-field-clearance>—</td>'+
        '<td data-field-result>PENDING INPUT</td></tr>').join("");
    }
    for(const key of ["sawKerf","endTrim","finalSeverKerf"]){
      const fieldEcho=fieldPanel.querySelector('[data-field-global-echo="'+key+'"]');
      if(fieldEcho)fieldEcho.textContent=fieldDraft[key]===null?
        "Not entered":fmt(fieldDraft[key],"L");
    }
    const review=auditMeasuredFramingFits(ledger,fieldDraft.sources,{
      sawKerf:fieldDraft.sawKerf,endTrim:fieldDraft.endTrim,
      finalSeverKerf:fieldDraft.finalSeverKerf});
    const trs=[...fieldTable.querySelectorAll("tr")];
    for(const [i,row] of review.rows.entries()){
      const tr=trs[i];if(!tr)continue;
      tr.querySelector("[data-field-echo]").textContent=
        row.enteredLength===null?"Not entered":fmt(row.enteredLength,"L");
      tr.querySelector("[data-field-required]").textContent=
        row.requiredLength===null?"—":fmt(row.requiredLength,"L");
      tr.querySelector("[data-field-clearance]").textContent=
        row.clearance===null?"—":
        row.shortfall>0?"SHORT "+fmt(row.shortfall,"L"):
        "LEFT "+fmt(Math.max(0,row.clearance),"L");
      tr.querySelector("[data-field-result]").textContent=row.status;
    }
    renderPurchaseReview(ledger,review);
    fieldStatus.textContent=review.allDimensionalFit?
      "DIMENSION-ONLY FIT: "+review.fitting+" of "+review.rows.length+
      " entered source lengths fit the entered losses. NOT field-certified; inspect each actual source, grade and safe procedure.":
      "USER-ENTERED, NOT FIELD-VERIFIED — "+review.entered+"/"+review.rows.length+
      " source lengths entered; "+review.fitting+" dimension-fit; "+
      review.short+" SHORT — REPLAN; "+review.pending+" pending; "+
      review.invalid+" invalid. Model purchases/quotes remain unchanged.";
  };
  fieldPanel?.addEventListener("input",event=>{
    const el=event.target;
    if(!(el instanceof HTMLInputElement))return;
    if(el.hasAttribute("data-measured-stock")){
      const id=el.getAttribute("data-measured-stock");
      const value=fieldNumeric(el.value,true);
      if(value===null)fieldDraft.sources.delete(id);
      else fieldDraft.sources.set(id,value);
    }else if(el.hasAttribute("data-measured-global")){
      fieldDraft[el.getAttribute("data-measured-global")]=fieldNumeric(el.value);
    }else return;
    // Any changed field reading invalidates prior human declarations.
    clearPurchaseReview();
    renderFieldPreflight(makeFramingStationLedger(latest?.stockReusePlan,latest?.stockPlan));
  });
  purchaseReviewPanel?.addEventListener("change",event=>{
    const el=event.target;
    if(!(el instanceof HTMLInputElement)||el.type!=="checkbox")return;
    if(el.hasAttribute("data-review-source-input")){
      const id=el.getAttribute("data-review-source-input");
      const key=el.getAttribute("data-review-source-key");
      if(!["profileGradeReviewed","defectsReviewed"].includes(key))return;
      const flags=purchaseReviewDraft.stocks.get(id)||{};
      flags[key]=el.checked;purchaseReviewDraft.stocks.set(id,flags);
    }else if(el.hasAttribute("data-review-global")){
      const key=el.getAttribute("data-review-global");
      if(!["sawSafetyReviewed","structuralReviewed","supplierVerified",
        "totalCostReviewed"].includes(key))return;
      purchaseReviewDraft.globals[key]=el.checked;
    }else return;
    const ledger=makeFramingStationLedger(latest?.stockReusePlan,latest?.stockPlan);
    const review=auditMeasuredFramingFits(ledger,fieldDraft.sources,{
      sawKerf:fieldDraft.sawKerf,endTrim:fieldDraft.endTrim,
      finalSeverKerf:fieldDraft.finalSeverKerf});
    renderPurchaseReview(ledger,review);
  });
  versionPin?.addEventListener("click",()=>{
    if(!versionState.current)return;
    versionState.reference=JSON.parse(JSON.stringify(versionState.current));
    versionState.importError=null;
    refreshReviewVersionPanel();
    status.textContent="Local reference pinned for comparison only. Download JSON to retain it after this page is closed.";
  });
  versionJson?.addEventListener("click",()=>{
    if(!versionState.current)return;
    validateFramingReviewVersion(versionState.current);
    const version=versionState.current;
    const exportData={...version,exportedAtUtc:new Date().toISOString(),
      exportedFrom:"Woodworking Calculator · optional Framing pre-purchase self-report"};
    save(slug+"-"+version.versionIds.packet+"-self-reported-reference.json",
      JSON.stringify(exportData,null,2)+"\n","application/json;charset=utf-8");
    status.textContent="Local reference JSON downloaded. Not a signed inspection or purchase approval.";
  });
  versionImport?.addEventListener("change",async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try{
      if(file.size<=0||file.size>2000000)
        throw Error("Reference must be a nonempty JSON file under 2 MB.");
      const imported=JSON.parse(await file.text());
      validateFramingReviewVersion(imported);
      if(!versionState.current)
        throw Error("Activate a valid current Framing alternative before comparison.");
      // Fully exercise the diff on the imported shape before adopting it.
      compareFramingReviewVersions(imported,versionState.current);
      versionState.reference=JSON.parse(JSON.stringify(imported));
      versionState.importError=null;
      refreshReviewVersionPanel();
      status.textContent="Reference compared locally. This does not authenticate the file or authorize buying.";
    }catch(err){
      versionState.importError=String(err?.message||err).slice(0,240);
      refreshReviewVersionPanel();
    }finally{
      event.target.value="";
    }
  });
  versionRestore?.addEventListener("click",()=>{
    if(!versionState.reference||!versionState.current)return;
    try{
      const proposal=proposeFramingMeasurementRestore(
        versionState.reference,versionState.current);
      // Historical values can never reinstate inspection declarations,
      // supplier prices, structural/saw checks, or any purchasing status.
      clearPurchaseReview();
      fieldDraft.sources=new Map(proposal.sourceEntries);
      fieldDraft.sawKerf=proposal.sawKerf;
      fieldDraft.endTrim=proposal.endTrim;
      fieldDraft.finalSeverKerf=proposal.finalSeverKerf;
      // Force exact visible input regeneration at current display units.
      fieldDraft.unit="";
      renderFieldPreflight(makeFramingStationLedger(
        latest?.stockReusePlan,latest?.stockPlan));
      versionRestoreWarning.hidden=false;
      versionRestoreWarning.textContent=proposal.warning+
        " All source/global inspection confirmations are now cleared. "+
        "No source was remeasured by this website.";
      status.textContent="Only historical user-entered dimensions restored; "+
        "all review declarations cleared. Reinspect actual materials.";
    }catch(err){
      status.textContent="Restore blocked: "+String(err?.message||err);
      versionRestoreWarning.hidden=true;
    }
  });
  versionDiffCsv?.addEventListener("click",()=>{
    const diff=versionState.difference;
    if(!diff||!diff.changes.length||!versionState.current||
      !versionState.reference)return;
    const rows=diff.changes.map(row=>({...row,
      referencePacketId:diff.referenceId,currentPacketId:diff.currentId,
      humanApprovalRequired:true,automaticPurchaseAuthorized:false}));
    const note="CONTENT CHECKSUM COMPARISON ONLY, NOT A DIGITAL SIGNATURE OR PURCHASE AUTHORIZATION. Ref "+diff.referenceId+
      "; current "+diff.currentId+". Source values are inches for raw dimension changes; prices use the corresponding quote currency, not length units.";
    // Diff cells are already human-readable raw source values; never run
    // stock-length conversion on these free-text comparison columns.
    save(slug+"-"+diff.referenceId+"-to-"+diff.currentId+
      "-review-differences.csv",
      buildScheduleCsv(rows,unit,note),"text/csv;charset=utf-8");
    status.textContent="Complete local reference comparison saved as CSV; original purchase documents unchanged.";
  });
  const optionalVersionNote=()=>versionState.current?
    " "+framingReviewVersionNote(versionState.current,versionState.reference):"";
  const renderFramingTakeoff=()=>{
    if(!framingMaterial||!framingStock||!framingPriceTable||!framingComparisons||!framingProof||!framingProofStatus||!framingPriceStatus||!framingTicket||!framingTicketStatus)return;
    const audit=latest?.stockAudit;
    if(stockAuditPanel){
      stockAuditPanel.hidden=!audit?.enabled;
      stockAuditExport.disabled=!audit?.enabled||!audit.rows?.length;
      if(audit?.enabled){
        stockAuditStatus.textContent=!audit.physicallyFits?
          "STOCK PLAN UNSAFE WITH ENTERED EXTRA LOSSES — "+audit.failingSticks+
          " original sticks are too short. The base supplier quote is NOT a sufficient buy order. Replan with longer stock or more sticks before purchase.":
          "CHECK PASSED FOR EXISTING ALLOCATION — "+audit.rows.length+
          " source sticks fit the extra losses. "+audit.candidateSticks+
          " candidate tail offcuts ("+fmt(audit.candidateTotalLength,"L")+
          ") exceed your minimum. "+
          (latest?.stockReusePlan?.enabled?
            "This BASE audit does not change purchases; inspect the separately calculated relocation proposal below.":
            "NONE are assigned to new cuts or deducted from the purchase.");
        stockAuditTable.innerHTML=audit.rows.map(p=>'<tr>'+
          [p.stockId+" · "+p.offerLabel,fmt(p.stockLength,"L"),
           fmt(p.adjustedLastCutEnd,"L"),fmt(p.finalSeverKerf,"L"),
           fmt(p.usableOffcutLength,"L"),fmt(p.shortfallLength,"L"),
           p.status].map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
      }else{
        stockAuditStatus.textContent="Review mode off — original purchase and stock cut plan is unchanged.";
        stockAuditTable.innerHTML="";
      }
    }
    if(stockReusePanel){
      const alternative=latest?.stockReusePlan;
      const stationLedger=makeFramingStationLedger(alternative,latest?.stockPlan);
      renderFieldPreflight(stationLedger);
      if(stationPanel){
        stationPanel.hidden=!stationLedger.available;
        stationExport.disabled=!stationLedger.available;
        if(stationLedger.available){
          stationStatus.textContent="DIMENSIONAL CHECK ONLY — "+
            stationLedger.sourceCount+" source sticks, "+
            stationLedger.memberCount+" distinct retained pieces, "+
            stationLedger.rows.length+" source-length intervals. "+
            "No physical stock, blade or grade inspection has been performed.";
          stationTable.innerHTML=stationLedger.rows.map(row=>'<tr>'+
            [row.stockId,row.stockGroup,row.index,row.segmentKind,
              row.item||"—",row.originalStockId||"—",
              fmt(row.stationStart,"L"),fmt(row.stationEnd,"L"),
              fmt(row.segmentLength,"L")]
            .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
        }else{
          stationStatus.textContent="No valid optional source station ledger is available.";
          stationTable.innerHTML="";
        }
      }
      stockReusePanel.hidden=!alternative?.enabled;
      const hasAlternative=alternative?.enabled&&alternative.rows?.length>0;
      stockReuseExport.disabled=!hasAlternative;
      stockReusePriceExport.disabled=!hasAlternative||!alternative.purchaseVariants?.length;
      if(alternative?.enabled){
        const statusText={
          "baseline-shortfall":"NO SAFE COMPARISON — the original layout cannot fit the additional end trims / final kerf. Do not use the base buying ticket as a sufficient order.",
          "threshold-required":"SET A POSITIVE MINIMUM OFFCUT — zero disables reassignment candidates.",
          "size-limit":"SEARCH BOUND EXCEEDED — the existing material plan is unchanged.",
          "no-reduction":"NO LOWER PURCHASE FOUND within this bounded local search. The original quote and cut plan remain unchanged."
        };
        stockReuseStatus.textContent=statusText[alternative.status]||
          ("BOUNDED REASSIGNMENT — "+alternative.removedSourceIds.length+
            " original sticks removed; "+alternative.originalPurchaseSticks+
            " originally purchased versus "+alternative.purchaseSticks+
            " in this alternative (including separately rounded reserves). "+
            (alternative.canClaimModeledSavings?
              "Modeled supplier-quote difference: "+money(alternative.quotedDifference)+
                " LESS, before tax, delivery and physical verification.":
              "No defensible priced savings claim; verify quotes, profile and actual stock.")+
            " This is not a globally optimal or construction-certified plan.");
        stockReuseTable.innerHTML=(alternative.rows||[]).map(row=>'<tr>'+
          [row.stockGroup,row.originalStockId,row.stockId,
            row.item,fmt(row.cutLength,"L"),fmt(row.cutStart,"L"),
            fmt(row.cutEnd,"L"),fmt(row.kerfBefore,"L")]
          .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
        const oldOffers=new Map((latest?.purchaseVariants||[]).map(v=>
          [v.stockGroup+"|"+v.offerLabel,v.purchaseSticks]));
        stockReusePriceTable.innerHTML=(alternative.purchaseVariants||[]).map(row=>'<tr>'+
          [row.stockGroup,row.offerLabel+" · "+fmt(row.stockLength,"L"),
            oldOffers.get(row.stockGroup+"|"+row.offerLabel)??0,
            row.purchaseSticks,row.unitPrice===null?"Quote needed":money(row.unitPrice),
            row.purchaseCost===null?"Quote needed":money(row.purchaseCost)]
          .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
      }else{
        stockReuseStatus.textContent="Reallocation mode off — original procurement unchanged.";
        stockReuseTable.innerHTML="";
        stockReusePriceTable.innerHTML="";
      }
    }
    const groups=latest?.materialSummary||[],bars=latest?.stockPlan||[],
      variants=latest?.purchaseVariants||[],comparisons=latest?.stockComparisons||[],
      checks=latest?.optimizerStatus||[];
    framingMaterial.innerHTML=groups.map(r=>'<tr>'+
      [r.stockGroup,r.pieces,takeoffLength(r.cutLength),r.mixedLengths?"Mixed lengths":takeoffLength(r.stockLength),
       r.plannedSticks,r.allowanceSticks,r.purchaseSticks,takeoffLength(r.offcutLength)]
        .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    framingStock.innerHTML=bars.map(bar=>'<tr><td>'+esc(bar.stockId+' · '+bar.offerLabel+' · '+takeoffLength(bar.stockLength))+'</td><td>'+
      bar.cuts.map(p=>esc(p.item)+" · "+esc(fmt(p.cutLength,"L"))+
        " ["+esc(stockLocalValue(p.cutStart))+"–"+
        esc(stockLocalValue(p.cutEnd))+" "+esc(unit)+"]").join("<br>")+
      '</td><td>'+esc(takeoffLength(bar.kerfLoss))+'</td><td>'+
      esc(takeoffLength(bar.offcutLength))+'</td></tr>').join("");
    const summary=latest?.costSummary;
    const costText=(r,key)=>r.purchaseSticks===0?"Not needed":
      r.unitPrice!==null?money(r[key]):"Quote needed";
    framingPriceTable.innerHTML=variants.map(r=>'<tr>'+
      [r.stockGroup,r.offerLabel+" · "+takeoffLength(r.stockLength),r.purchaseSticks,
       r.unitPrice===null?(r.purchaseSticks?"Quote needed":"Not needed"):money(r.unitPrice),
       costText(r,"plannedCost"),costText(r,"reserveCost"),costText(r,"purchaseCost")]
        .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    framingComparisons.innerHTML=comparisons.filter(r=>r.plannedSticks>0).map(r=>
      '<tr'+(r.selected?' class="selected-plan"':'')+'>'+
      [r.stockGroup,r.planLabel+" · "+r.stockSizes.map(v=>
        v.offerLabel+" "+takeoffLength(v.stockLength)+" × "+v.purchaseSticks).join("; "),
        r.plannedSticks,r.purchaseSticks,
        r.quoted?money(r.purchaseCost):"Quote needed",
        takeoffLength(r.offcutLength),r.selected?"SELECTED":"Alternative"]
        .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    const meaning={proved:"Completed memoized exact search", "size-limit":"Heuristic (over 16 pieces)",
      "node-limit":"Heuristic (40,000 distinct-state limit)", "quote-needed":"Quote required",
      "not-required":"No material required"};
    framingProof.innerHTML=checks.map(check=>'<tr>'+
      [check.stockGroup,check.pieceCount,meaning[check.status]||"Not verified",
       check.nodes?check.nodes.toLocaleString("en-US"):"—",
       check.memoHits?check.memoHits.toLocaleString("en-US"):"—",
       check.certified?"PROVEN optimal in model":"Not proven"]
        .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    const required=checks.filter(s=>s.pieceCount>0);
    framingProofStatus.textContent=!summary?"Correct inputs to see validation.":
      summary.allGroupsCertified?
        (audit?.enabled?"BASE-MODEL CERTIFICATE ONLY: ":"CERTIFIED: ")+
          "lowest purchase cost under the quoted-stock model for all "+
          required.length+" required material families. This is not a real-world universal optimum."+
          (audit?.enabled?" Optional trim/sever/reuse diagnostics are OUTSIDE the certificate.":""):
        "NOT CERTIFIED for the whole wall — "+summary.certifiedGroups+
          " of "+required.length+" required material families have completed exact search. "+
          (summary.allPricesEntered?"Remaining results use a bounded heuristic.":"Missing supplier quotes.")+
          " No global optimality claim.";
    const missing=summary?.unpricedGroups||[];
    const auditWarning=audit?.enabled&&!audit.physicallyFits?
      " WARNING: selected sticks DO NOT FIT the optional extra losses. Recalculate purchases; this baseline quote must NOT be used as a sufficient order.":"";
    framingPriceStatus.textContent=!summary?"Fix inputs to see supplier quote costs.":
      !summary.allPricesEntered?
        "Incomplete quote — prices required: "+missing.join(", ")+
          (summary.pricedGroups?" · priced groups subtotal "+money(summary.quotedSubtotal):" · no groups priced yet")+
          ". This is NOT a complete purchase total.":
        (audit?.enabled?"Estimated BASE-MODEL lumber purchase: ":"Estimated quoted lumber purchase: ")+
        money(summary.quotedSubtotal)+
        " (planned "+money(summary.quotedPlanned)+
        " + reserve "+money(summary.quotedReserve)+"). Excludes tax, delivery, labor and fittings."+
        auditWarning;
    framingTicketStatus.textContent=!summary?"No valid material plan.":
      summary.allPricesEntered?(audit?.enabled?"Base-model material quote: ":"Total material quote: ")+
        money(summary.quotedSubtotal)+
        " · tax and delivery excluded"+auditWarning:
        "PRICE INCOMPLETE — obtain quotes for "+missing.join(", ")+".";
    framingTicket.innerHTML=variants.filter(r=>r.purchaseSticks>0).map(r=>
      '<li><span class="ticket-check" aria-hidden="true">□</span><strong>'+esc(r.stockGroup)+
      '</strong><span>'+esc(r.purchaseSticks+" sticks × "+takeoffLength(r.stockLength)+
      " · "+r.offerLabel)+
      ' (planned '+r.plannedSticks+' + reserve '+r.allowanceSticks+')</span><span>'+
      esc(r.unitPrice!==null?money(r.purchaseCost):"QUOTE NEEDED")+'</span></li>').join("");
  };
  const renderDeckTakeoff=()=>{
    if(!deckCostStatus||!deckBudgetTable||!deckFastenerTable||!deckTicketList||!deckTicketStatus)return;
    const quote=latest?.deckCostSummary,buys=latest?.deckPurchaseRows||[],
      rows=latest?.deckFastenerRows||[];
    deckCostStatus.textContent=!quote?"Correct inputs to see deck supplier costs.":
      quote.allPricesEntered?
        "Estimated quoted material subtotal: "+money(quote.quotedSubtotal)+
          " (decking boards "+money(quote.boardCost)+
          " + fastener packs "+money(quote.fastenerCost)+
          (quote.quoteJoists?" + optional full-width joist stock "+money(quote.joistCost):"")+
          "). Excludes unmodeled structure, tax, delivery and labor. "+
          "Any quoted straight joists are geometric cuts only, not approved structural sizing.":
        "INCOMPLETE QUOTE — missing: "+quote.missingQuotes.join(", ")+
          " · quoted components subtotal "+money(quote.quotedSubtotal)+
          " is NOT the total buying cost.";
    deckBudgetTable.innerHTML=buys.map(r=>'<tr>'+
      [r.material,r.plannedQuantity,r.purchaseQuantity,r.unit,
        r.unitPrice===null?(r.purchaseQuantity?"Quote needed":"Not needed"):money(r.unitPrice),
        r.purchaseCost===null?"Quote needed":money(r.purchaseCost)]
          .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    deckFastenerTable.innerHTML=rows.map(r=>'<tr>'+
      [r.item,r.joistReferences,r.buttSeams,r.fasteningContacts,
        r.fastenerPiecesPerRow,r.firstSeamAt===null?"—":fmt(r.firstSeamAt,"L"),
        r.lastSeamAt===null?"—":fmt(r.lastSeamAt,"L")]
          .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    deckTicketStatus.textContent=!quote?"No current material plan.":
      quote.allPricesEntered?"ALL LISTED MATERIALS QUOTED · subtotal: "+money(quote.quotedSubtotal):
        "PRICE INCOMPLETE — "+quote.missingQuotes.join(", ")+" require quotes.";
    deckTicketList.innerHTML=buys.filter(r=>r.purchaseQuantity>0).map(r=>
      '<li><span class="ticket-check" aria-hidden="true">□</span><strong>'+esc(r.material)+
      '</strong><span>'+esc(r.purchaseQuantity+" "+r.unit)+
      '</span><span>'+esc(r.purchaseCost===null?"QUOTE NEEDED":money(r.purchaseCost))+
      '</span></li>').join("");
  };
  const renderShelfPins=()=>{
    if(!shelfPinStatus||!shelfPinTable||!shelfPinSvg)return;
    const rows=latest?.shelfPinRows||[];
    const active=!!latest?.shelfPinEnabled&&rows.length>0;
    shelfPinCsvExport.disabled=!active;
    shelfPinSvgExport.disabled=!active;
    shelfPinTable.innerHTML="";
    shelfPinSvg.innerHTML="";
    if(!latest){
      shelfPinStatus.textContent="Correct measurements to view the optional drill grid.";
      return;
    }
    if(!active){
      shelfPinStatus.textContent="DRILL GRID OFF — enter a positive support pin hole diameter. Original shelf faces and spacing remain unchanged.";
      return;
    }
    shelfPinStatus.textContent="MEASURED PATTERN: "+latest.shelfRows.length+
      " shelves × 2 positions × 2 side panels = "+rows.length+
      " circular holes. Left and Right panels both use X from the INSIDE FRONT and Y from the INSIDE BOTTOM. Check actual pin bearing height before drilling.";
    shelfPinTable.innerHTML=rows.map(p=>'<tr>'+
      [p.shelfNumber,p.panel,p.position,fmt(p.centerX),fmt(p.centerY),
        fmt(p.holeDiameter),fmt(p.faceFrontEdge),fmt(p.faceBackEdge),
        fmt(p.faceBottomEdge),fmt(p.faceTopEdge),fmt(p.undersideClearance)]
        .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    // Each side view shares the SAME absolute physical length scale on X and
    // Y: no imaginary visual minimum is added to the hole radius.
    const depth=latest.caseDepth,height=latest.interiorHeight;
    const scale=Math.min(245/depth,205/height);
    const boardW=depth*scale,boardH=height*scale;
    const top=57+(205-boardH)/2;
    const bottom=top+boardH,centerX={Left:226,Right:674};
    const pinRows=rows;
    const svgParts=[
      '<svg class="shelf-side-drill-svg" viewBox="0 0 900 345" role="img" aria-label="Scaled Left and Right cabinet side panel hole reference maps; X from inside front and Y from inside bottom">',
      '<title>Proportional side-panel drill references — verify actual hardware, drilling and print scale</title>'
    ];
    for(const side of ["Left","Right"]){
      const x0=centerX[side]-boardW/2;
      svgParts.push('<text class="shelf-side-label" x="'+centerX[side]+'" y="25" text-anchor="middle">'+side.toUpperCase()+' INSIDE PANEL</text>');
      svgParts.push('<rect class="shelf-pin-side-stock" data-panel="'+side+
        '" data-depth="'+depth+'" data-height="'+height+
        '" x="'+x0+'" y="'+top+'" width="'+boardW+'" height="'+boardH+
        '" fill="#f2e2c7" stroke="#926d48" stroke-width="1.6"><title>'+
        esc(side+" panel · measured inside depth "+fmt(depth)+
          " · height "+fmt(height))+'</title></rect>');
      for(const [index,shelf] of latest.shelfRows.entries()){
        const y=bottom-shelf.shelfBottom*scale;
        svgParts.push('<line class="shelf-pin-shelf-guide" data-panel="'+side+
          '" data-shelf="'+(index+1)+'" x1="'+x0+'" y1="'+y+
          '" x2="'+(x0+boardW)+'" y2="'+y+
          '" stroke="#71927d" stroke-width="1" stroke-dasharray="4 3"/>');
      }
      for(const p of pinRows.filter(row=>row.panel===side)){
        const x=x0+p.centerX*scale,y=bottom-p.centerY*scale;
        const radius=p.holeDiameter*scale/2;
        svgParts.push('<circle class="shelf-pin-hole" data-panel="'+side+
          '" data-shelf="'+p.shelfNumber+'" data-position="'+p.position+
          '" data-x="'+p.centerX+'" data-y="'+p.centerY+
          '" cx="'+x+'" cy="'+y+'" r="'+radius+
          '" fill="#fbfaf7" stroke="#1e6454" stroke-width="1.15"><title>'+
          esc(side+" panel · shelf "+p.shelfNumber+" · "+p.position+
            " hole center X "+fmt(p.centerX)+" / Y "+fmt(p.centerY)+
            " · Ø "+fmt(p.holeDiameter))+'</title></circle>');
      }
      svgParts.push('<text class="shelf-side-foot" x="'+centerX[side]+'" y="289" text-anchor="middle">FRONT = LEFT · BOTTOM = Y 0</text>');
    }
    svgParts.push('<text class="shelf-side-note" x="450" y="329" text-anchor="middle">TWO INSIDE SIDE PANELS · SAME FRONT-REFERENCED X/Y · NOT A 1:1 DRILL JIG</text></svg>');
    shelfPinSvg.innerHTML=svgParts.join("");
  };
  const renderStringerSection=()=>{
    if(!stringerModelStatus||!stringerOutlineTable||!stringerSupportTable)return;
    const outline=latest?.stringerEnvelopeRows||[],surfaces=latest?.supportReferences||[];
    const sawlines=latest?.stringerCutLineRows||[],ends=latest?.measuredEndCuts||[];
    const blankRows=latest?.stringerBlankRows||[],
      endChecks=latest?.endProjectionChecks||[],
      contacts=latest?.endContactChecks||[];
    if(stringerEndContactExport)stringerEndContactExport.disabled=!contacts.length;
    if(stringerBlankExport)stringerBlankExport.disabled=!blankRows.length;
    if(stringerProjectionExport)stringerProjectionExport.disabled=!endChecks.length;
    const enabled=outline.length>0;
    stringerSectionExport.disabled=!enabled;
    stringerSupportExport.disabled=!surfaces.length;
    if(stringerSawExport)stringerSawExport.disabled=!sawlines.length;
    if(stringerEndExport)stringerEndExport.disabled=!ends.length;
    stringerModelStatus.textContent=!enabled?
      "Correct measurements to view modeled geometry; no cut profile is available.":
      "MODELED SIDE SECTION ONLY — "+outline.length+
        " calculated vertices · minimum perpendicular throat "+
        fmt(latest.minThroatFromVertices,"L")+
        " · face area "+fmt(latest.envelopeAreaSqIn/144,"FT2")+
        " · pitch-aligned blank "+fmt(latest.blankLengthShown,"L")+
        " × "+fmt(latest.stockNormalDepth,"L")+
        (latest.stockFitsModel===false?" · MEASURED STOCK SHORTER THAN MODEL":latest.stockFitsModel===true?" · measured 2D stock envelope fits":" · reference minimum only")+
        (latest.outOfSupport>0?" · "+latest.outOfSupport+" endpoint X projections outside entered supports":"")+
        (contacts.length?" · 2D lines: "+latest.unsupported2D+" no intersections, "+
          latest.pointOnly2D+" single-point-only intersections (ZERO bearing length)":"")+
        ". End surfaces and material strength are NOT bearing-approved.";
    stringerOutlineTable.innerHTML=outline.map(r=>'<tr>'+
      [r.index,r.boundary,fmt(r.x,"L"),fmt(r.elevation,"L")]
        .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    stringerSupportTable.innerHTML=surfaces.length?surfaces.map(r=>'<tr>'+
      [r.item,fmt(r.startX,"L"),fmt(r.endX,"L"),fmt(r.elevation,"L")]
        .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join(""):
      '<tr><td colspan="4">No measured support surface entered. End-bearing geometry is unverified.</td></tr>';
    if(stringerBlankTable)stringerBlankTable.innerHTML=blankRows.length?
      blankRows.map(r=>'<tr>'+[
        r.item,fmt(r.axisStation,"L"),fmt(r.normalOffset,"L"),
        fmt(r.x,"L"),fmt(r.elevation,"L")
      ].map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join(""):
      '<tr><td colspan="5">No valid stock reference rectangle.</td></tr>';
    if(stringerEndProjectionTable)stringerEndProjectionTable.innerHTML=endChecks.length?
      endChecks.map(r=>'<tr>'+[
        r.item,fmt(r.projectedEndX,"L"),fmt(r.chosenHorizontalExtension,"L"),
        fmt(r.measuredSupportReferenceRun,"L"),
        fmt(r.projectedOutsideSupport,"L"),r.projectionStatus
      ].map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join(""):
      '<tr><td colspan="6">Enter both end-line and support-reference measurements for a 1D projection check.</td></tr>';
    if(stringerEndContactTable)stringerEndContactTable.innerHTML=contacts.length?
      contacts.map(r=>'<tr>'+[
        r.item,fmt(r.supportElevation,"L"),r.contactGeometry,
        r.intersectionX===null?"—":fmt(r.intersectionX,"L"),
        r.intersectionElevation===null?"—":fmt(r.intersectionElevation,"L"),
        r.cutParameter===null?"—":trim(r.cutParameter,5),
        r.crossingHorizontalMiss===null?"—":fmt(r.crossingHorizontalMiss,"L"),
        fmt(r.sharedLineLength,"L")
      ].map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join(""):
      '<tr><td colspan="8">Enter a selected end line AND its measured horizontal support reference.</td></tr>';
    const lineCells=r=>[r.item,r.cutType,
      fmt(r.startX,"L"),fmt(r.startY,"L"),fmt(r.endX,"L"),fmt(r.endY,"L"),
      fmt(r.cutLength,"L"),fmt(r.cutAngleDeg,"A")]
      .map(v=>'<td>'+esc(v)+'</td>').join("");
    if(stringerSawTable)stringerSawTable.innerHTML=sawlines.map(r=>'<tr>'+lineCells(r)+'</tr>').join("");
    if(stringerEndTable)stringerEndTable.innerHTML=ends.map(r=>'<tr>'+lineCells(r)+'</tr>').join("");
  };
  const renderRoofReuse=()=>{
    if(!roofReuseStatus||!roofReuseTable||!roofReuseSvg)return;
    const plan=latest?.roofReusePlan;
    roofReuseExport.disabled=!plan?.rows?.length;
    roofReuseSvgExport.disabled=!plan?.rows?.length;
    if(!plan){
      roofReuseStatus.textContent="REUSE OFF — original estimate uses a fresh sheet at every occupied roof cut position.";
      roofReuseTable.innerHTML="";
      roofReuseSvg.innerHTML="";
      return;
    }
    roofReuseStatus.textContent="BOUNDED STOCK PLAN — "+plan.stockCount+
      " full stock sheets; "+plan.reusedCutCount+
      " additional cuts on already-open sheets. Free area "+
      fmt(plan.freeAreaSqIn/144,"FT2")+", split-line waste "+
      fmt(plan.kerfAreaSqIn/144,"FT2")+
      ". Polygon corner scraps are not reused. Not a minimum-purchase or engineered bearing certificate.";
    roofReuseTable.innerHTML=plan.rows.slice(0,160).map(r=>'<tr>'+
      [r.item,r.sourcePlane,r.stockId,fmt(r.stockX,"L"),fmt(r.stockY,"L"),
       fmt(r.boxWidth,"L"),fmt(r.boxHeight,"L"),fmt(r.installedAreaFt2,"FT2")]
        .map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join("");
    const count=Math.min(plan.stockCount,6),sc=Math.min(
      228/Math.max(1e-8,plan.stockWidth),126/Math.max(1e-8,plan.stockHeight));
    const parts=[
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 395" role="img" aria-label="Proportional stock-local polygon cut preview">',
      '<title>Stock-cut polygon preview; NOT a saw template</title>',
      '<rect width="900" height="395" fill="#fcfbf8"/>'
    ];
    for(let i=0;i<count;i++){
      const bx=40+i%3*280,by=48+Math.floor(i/3)*179,id="R"+(i+1);
      parts.push('<text x="'+bx+'" y="'+(by-11)+'" font-size="13" fill="#244d40">'+id+'</text>');
      parts.push('<rect class="roof-stock-full" data-stock="'+id+
        '" x="'+bx+'" y="'+by+'" width="'+(plan.stockWidth*sc)+
        '" height="'+(plan.stockHeight*sc)+'" fill="#e9eee7" stroke="#496b59" stroke-width="1.6"/>');
      for(const [index,piece] of plan.rows.filter(r=>r.stockId===id).entries()){
        // Keep full floating-point SVG coordinates. Fixed pixel rounding to
        // 5 digits could close tiny but positive polygon cuts in the preview.
        const polygon=piece.stockCutVertices.map(pair=>
          (bx+pair[0]*sc)+","+(by+pair[1]*sc)).join(" ");
        parts.push('<polygon class="roof-stock-cut" data-item="'+esc(piece.item)+
          '" data-stock="'+id+'" points="'+polygon+
          '" fill="'+(index%2?"#dfc399":"#b9d5c4")+
          '" stroke="#8a724d" stroke-width="1"><title>'+
          esc(piece.item+" on "+id+"; stock X "+fmt(piece.stockX)+
            " / Y "+fmt(piece.stockY)+"; NOT a cutting template")+'</title></polygon>');
      }
    }
    parts.push('<text x="32" y="387" font-size="12" fill="#345e50">Preview first '+count+
      " of "+plan.stockCount+" stock sheets. All cuts in CSV. NO 1:1 PRINT SCALE.</text></svg>");
    roofReuseSvg.innerHTML=parts.join("");
  };
  // A failed calculation invalidates every export, including specialized
  // purchasing files. A guarded click handler alone is not sufficient:
  // keyboard and screen-reader users must see that stale results are disabled.
  const syncResultActions=()=>{
    const enabled=!!latest;
    for(const button of [copy,csv,svg,print,share,measurementSave])if(button)button.disabled=!enabled;
    if(stockExport)stockExport.disabled=!latest?.stockCuts?.length;
    if(stockAuditExport)stockAuditExport.disabled=!latest?.stockAudit?.enabled||!latest?.stockAudit?.rows?.length;
    if(stockReuseExport)stockReuseExport.disabled=!latest?.stockReusePlan?.enabled||
      !latest?.stockReusePlan?.rows?.length;
    if(stockReusePriceExport)stockReusePriceExport.disabled=!latest?.stockReusePlan?.enabled||
      !latest?.stockReusePlan?.purchaseVariants?.length;
    if(stationExport)stationExport.disabled=!makeFramingStationLedger(latest?.stockReusePlan,latest?.stockPlan).available;
    if(pricingExport)pricingExport.disabled=!latest?.purchaseVariants?.length;
    if(deckBudgetExport)deckBudgetExport.disabled=!latest?.deckPurchaseRows?.length;
    if(deckFastenerExport)deckFastenerExport.disabled=!latest?.deckFastenerRows?.length;
  };
  const refreshConditionalFields=()=>{
    for(const field of tool.inputs){
      if(!field.showWhen)continue;
      form.elements.namedItem(field.key).closest("[data-show-when]").hidden=!isActiveField(field);
    }
  };
  // The visible percentage and accessible reset name describe the actual
  // schematic zoom, not the physical print scale (which is never 1:1).
  const applyDiagramZoom=()=>{
    const percent=Math.round(zoom*100);
    diagram.querySelector("svg")?.style.setProperty("width",percent+"%");
    zoomReset.textContent=percent+"%";
    zoomReset.setAttribute("aria-label","Reset diagram zoom to 100% (current "+percent+"%)");
    zoomMinus.disabled=percent<=60;
    zoomPlus.disabled=percent>=250;
  };
  function render(){
    // Flush a queued event frame when another action calls render directly.
    // This prevents stale geometry after a quick reset/unit change.
    if(inputQueued)inputQueued=false;
    geometrySelected=0;
    geometryInspector.hidden=true;
    refreshConditionalFields();
    reviewField=null;
    reviewInvalid.hidden=true;
    // Clear field-specific validation before re-reading the current inputs.
    // Errors caused by cross-field geometry rules remain in the main alert.
    for(const f of tool.inputs){
      const field=form.elements.namedItem(f.key);
      field?.removeAttribute("aria-invalid");
      field?.setAttribute("aria-describedby","field-note-"+f.key);
    }
    try{
      const data=safeCompute(slug,values());
      if(!data.ok)throw new Error(data.error);
      latest=data.data;error.hidden=true;
      renderPrintInputSnapshot();
      out.innerHTML=latest.metrics.map((m,i)=>'<article class="metric '+(i===0?"main-metric":"")+'"><span>'+esc(m.label)+'</span><strong>'+esc(fmt(m.value,m.kind))+'</strong>'+(m.kind==="L"&&unit==="in"?'<small>≈ '+esc(frac(m.value))+'</small>':"")+'</article>').join("");
      if(latest.lumberBoard?.pricePerBoardFoot===null){
        out.insertAdjacentHTML("beforeend",'<p role="note">Enter a positive supplier rate to show the quoted cost.</p>');
      }
      if(latest.deckBoardStock?.requiresJointPlan){
        out.insertAdjacentHTML("beforeend",
          '<p class="deck-joint-warning" role="note"><strong>Unverified butt joints.</strong> '
          +'The row exceeds the reserved usable stock length. '
          +'The stock count is NOT a supported installation plan: butt joints, '
          +'end bearing, joist centers and fastening remain unverified. '
          +'Use Deck Material Estimator for a separate joist-center reference.</p>');
      }
      scheduleCols=latest.rows.length?scheduleColumns(latest.rows,unit):[];
      renderSchedule();
      if(printFullSchedule)renderReadablePrintSchedule();
      renderFramingTakeoff();renderDeckTakeoff();renderStringerSection();renderRoofReuse();renderShelfPins();
      if(printFullSchedule)renderSpecialtyPrintTables();
      diagram.innerHTML=drawing(latest);applyDiagramZoom();
      const geometryMap=geometrySelector();
      const matches=geometryMap && latest.rows.length>0 ?
        diagram.querySelectorAll(geometryMap[0]).length===latest.rows.length &&
        Boolean(geometryPart(1)) && Boolean(geometryPart(latest.rows.length)) : false;
      geometryStatus.textContent=matches && latest.rows.length?
        "Interactive drawing: select a schedule row or illustrated part to highlight its exact match. Arrow buttons inspect adjacent rows.":
        "Schematic reference: not every geometry element corresponds to a numbered schedule row. Inspect the numeric measurements before use.";
      document.querySelector("#print-assumptions").textContent=tool.limit;
      status.textContent="Updated: "+latest.metrics[0].label+" — "+fmt(latest.metrics[0].value,latest.metrics[0].kind)+".";
      updateDockSummary(latest.metrics[0].label,fmt(latest.metrics[0].value,latest.metrics[0].kind));
      syncResultActions();
      requestAnimationFrame(syncKeyboardScrollRegions);
    }catch(e){
      latest=null;scheduleCols=[];schedulePage=0;
      renderPrintInputSnapshot();
      error.textContent=e.message;error.hidden=false;
      // Input parsing supplies its own field key. Most calculator rules use
      // "fieldKey must/cannot ..." messages; link those to the real input too.
      // Do not guess a field from cross-dimensional geometry explanations.
      const ruleKey=/^([A-Za-z][A-Za-z0-9]*) (?:must|cannot)\b/.exec(e.message)?.[1];
      const fieldKey=e.fieldKey||ruleKey;
      if(fieldKey){
        const field=form.elements.namedItem(fieldKey);
        if(field){
          field.setAttribute("aria-invalid","true");
          field.setAttribute("aria-describedby","field-note-"+fieldKey+" calc-error");
          if(!field.closest("[hidden]")){
            reviewField=field;
            reviewInvalid.hidden=false;
          }
        }
      }
      out.innerHTML='<p class="empty-result">Fix an input to view the calculated results.</p>';
      cut.innerHTML="";diagram.innerHTML="";scheduleCount.textContent="";
      geometryStatus.textContent="Correct the measurement input to restore the diagram.";
      renderReadablePrintSchedule();
      schedulePager.hidden=true;renderFramingTakeoff();renderDeckTakeoff();renderStringerSection();renderRoofReuse();renderShelfPins();
      renderSpecialtyPrintTables();
      status.textContent="Calculation requires correction; see the error message.";
      updateDockSummary("Review measurements","—",true);
      syncResultActions();
      requestAnimationFrame(syncKeyboardScrollRegions);
    }
  }
  const showSchedulePage=next=>{
    if(!latest||!latest.rows.length)return;
    const pages=Math.ceil(latest.rows.length/schedulePageSize);
    if(!Number.isInteger(next)||next<0||next>=pages){
      schedulePageInput.focus();
      return;
    }
    schedulePage=next;
    renderSchedule();
    cut.closest(".table-scroll")?.scrollTo(0,0);
    requestAnimationFrame(syncKeyboardScrollRegions);
  };
  schedulePrev.addEventListener("click",()=>showSchedulePage(schedulePage-1));
  scheduleNext.addEventListener("click",()=>showSchedulePage(schedulePage+1));
  const jumpSchedule=()=>showSchedulePage(Number(schedulePageInput.value)-1);
  scheduleGo.addEventListener("click",jumpSchedule);
  schedulePageInput.addEventListener("keydown",event=>{
    if(event.key==="Enter"){event.preventDefault();jumpSchedule();}
  });
  // All example inputs are in the same engine-internal inches as the
  // registry. Unit conversion happens exactly once when filling the form.
  const workedCases=document.querySelector("#worked-cases");
  workedCases?.addEventListener("click",event=>{
    const button=event.target.closest("button[data-case-inputs]");
    if(!button||!workedCases.contains(button))return;
    const preset=JSON.parse(button.dataset.caseInputs);
    const keys=Object.keys(preset);
    if(keys.length!==tool.inputs.length||
      tool.inputs.some(f=>!Object.hasOwn(preset,f.key)||
        typeof preset[f.key]!=="number"||!Number.isFinite(preset[f.key]))){
      status.textContent="Example is incomplete and was not applied.";
      return;
    }
    clearResetUndo();
    for(const field of tool.inputs){
      const el=form.elements.namedItem(field.key);
      el.value=field.kind==="L"?
        convertEditableLength(preset[field.key],"in",unit):preset[field.key];
    }
    schedulePage=0;zoom=1;render();
    if(latest)status.textContent="Loaded example: "+button.dataset.caseName+
      ". Compare physical reference faces before using dimensions.";
  });
  const restoreValues=()=>{
    for(const f of tool.inputs){
      const el=form.elements.namedItem(f.key);
      el.value=f.kind==="L"?convertEditableLength(f.value,"in",unit):f.value;
    }
  };
  units.addEventListener("change",()=>{
    const before=unit,after=units.value;if(before===after)return;
    for(const f of tool.inputs)if(f.kind==="L"){
      const el=form.elements.namedItem(f.key);
      // Never turn an intentionally blank or invalid field into a false zero
      // when the user switches between inches and metric units.
      if(!el||el.value.trim()==="")continue;
      const v=parseEditableLength(el.value,before);
      if(v!==null)el.value=convertEditableLength(v,before,after);
    }
    clearResetUndo();
    unit=after;document.querySelectorAll("[data-length-unit]").forEach(el=>el.textContent=unit);render();
  });
  form.addEventListener("submit",event=>event.preventDefault());
  let inputQueued=false;
  const flushInputRender=()=>{
    if(!inputQueued)return;
    inputQueued=false;
    render();
  };
  form.addEventListener("input",()=>{
    clearResetUndo();schedulePage=0;
    // A microtask renders after this input task, before the next browser
    // interaction can read stale data. Repeated input events in ONE task
    // coalesce; no animation-frame delay or deferred accuracy contract.
    if(!inputQueued){
      inputQueued=true;
      queueMicrotask(()=>{
        if(!inputQueued)return;
        inputQueued=false;
        render();
      });
    }
  });
  window.addEventListener("beforeprint",flushInputRender);
  document.addEventListener("click",event=>{
    // A fast click on a download or share control must use the LAST typed
    // dimensions even when the next paint has not occurred yet.
    if(inputQueued&&event.target.closest(
      '#copy-result,#download-csv,#download-svg,#print-sheet,#share-measurements,'+
      '#download-measurements-json,[id^="download-"]'
    ))flushInputRender();
  },true);
  fraction.addEventListener("change",()=>{clearResetUndo();render();});
  currency?.addEventListener("change",()=>{clearResetUndo();render();});
  // Measurement links intentionally use fragments. HTTP requests and hosting
  // access logs do not receive the measurements; no review/approval flags are
  // serialized. A complete numeric snapshot must pass the calculator model
  // before any field is changed.
  const availableCurrencies=currency?[...currency.options].map(o=>o.value):[];
  const applyValidatedMeasurementSnapshot=snapshot=>{
    // All-or-nothing: prove the numeric geometry BEFORE modifying form state.
    const candidate={};
    for(const field of tool.inputs){
      if(!isActiveField(field,key=>snapshot.inputs[key])){
        candidate[field.key]=field.value;
        continue;
      }
      const raw=Number(snapshot.inputs[field.key]);
      candidate[field.key]=field.kind==="L"?
        convertToInches(raw,snapshot.unit):raw;
    }
    const proof=safeCompute(slug,candidate);
    if(!proof.ok)throw Error("Imported inputs cannot be calculated: "+proof.error);
    // Never reuse human inspection, stock-measurement or purchasing review
    // declarations from a different session, even with matching layout.
    if(slug==="framing-calculator"){
      fieldDraft.signature="";
      fieldDraft.sources.clear();
      fieldDraft.sawKerf=null;fieldDraft.endTrim=null;fieldDraft.finalSeverKerf=null;
      clearPurchaseReview(true);
      versionState.current=null;versionState.difference=null;
    }
    clearResetUndo();
    unit=snapshot.unit;units.value=unit;
    fraction.value=snapshot.fraction;
    if(currency)currency.value=snapshot.currency;
    for(const field of tool.inputs)
      form.elements.namedItem(field.key).value=snapshot.inputs[field.key];
    document.querySelectorAll("[data-length-unit]").forEach(el=>el.textContent=unit);
  };
  const loadSharedMeasurements=()=>{
    const snapshot=parseMeasurementFragment(window.location.hash,tool.inputs,availableCurrencies);
    if(!snapshot)return false;
    applyValidatedMeasurementSnapshot(snapshot);
    return true;
  };
  // The link and JSON codecs intentionally accept numeric strings only.
  // Convert a typed US fraction to its exact decimal-inch equivalent before
  // serializing, so every restored calculation has the same physical length.
  const currentMeasurementFields=()=>tool.inputs.map(field=>{
    const raw=formValue(field.key);
    const value=readInput(field,raw);
    if(Number.isFinite(value)){
      return {key:field.key,value:field.kind==="L"||!raw.trim()?String(value):raw.trim()};
    }
    if(isActiveField(field))throw Error("Invalid measurement: "+field.label);
    // The v1 codecs require every key. Keep valid inactive edits and use
    // a numeric default only when an inactive field has no usable entry.
    const fallback=field.kind==="L"?
      convertEditableLength(field.value,"in",unit):field.value;
    return {key:field.key,value:String(fallback)};
  });
  measurementSave?.addEventListener("click",()=>{
    if(!latest)return;
    try{
      const content=buildMeasurementFile({
        slug,unit,fraction:fraction.value,currency:currency?currencyCode():null,
        fields:currentMeasurementFields()
      });
      save(slug+"-"+unit+"-measurements.json",content,"application/json;charset=utf-8");
      status.textContent="Measurements JSON saved locally. Inspection and purchase approval declarations are not included.";
    }catch(e){
      status.textContent="Could not save measurements: "+e.message;
    }
  });
  measurementImport?.addEventListener("change",async()=>{
    const selected=measurementImport.files?.[0];
    // Allow importing the same file again after correction without a refresh.
    measurementImport.value="";
    if(!selected)return;
    try{
      if(selected.size>16384)throw Error("File exceeds the 16 KB measurement limit.");
      const content=await selected.text();
      const snapshot=parseMeasurementFile(content,{
        slug,fields:tool.inputs,allowedCurrencies:availableCurrencies
      });
      applyValidatedMeasurementSnapshot(snapshot);
      // A previously opened share fragment must not silently restore its old
      // inputs when the user refreshes after importing another local file.
      if(window.location.hash.startsWith("#measure="))
        window.history.replaceState(null,"",window.location.pathname+window.location.search);
      schedulePage=0;zoom=1;render();
      status.textContent="Local measurements restored and recalculated. Human material inspections and purchasing approvals must be repeated.";
    }catch(e){
      // Do not erase the user's current dimensions for malformed files.
      status.textContent="Measurement file rejected; existing inputs unchanged. "+e.message;
    }
  });
  share?.addEventListener("click",async()=>{
    if(!latest)return;
    try{
      const fragment=createMeasurementFragment({
        unit,fraction:fraction.value,currency:currency?currencyCode():null,
        fields:currentMeasurementFields()
      });
      // The fragment is opt-in and does not change browser history or submit
      // entered values to the site. Never include self-declared approval data.
      const link=window.location.origin+window.location.pathname+fragment;
      await navigator.clipboard.writeText(link);
      status.textContent="Measurement link copied. It includes your numeric inputs, not site inspections, purchase approvals or other review records.";
    }catch(e){
      status.textContent="Could not copy the measurement link: "+e.message;
    }
  });
  reset.addEventListener("click",()=>{
    // Preserve the first pre-reset input state if Reset is tapped twice.
    // Raw strings (including typed inch fractions) are restored exactly.
    if(!resetSnapshot)resetSnapshot={
      values:tool.inputs.map(field=>({
        key:field.key,value:form.elements.namedItem(field.key).value
      })),
      zoom
    };
    if(window.location.hash.startsWith("#measure="))
      window.history.replaceState(null,"",window.location.pathname+window.location.search);
    restoreValues();zoom=1;schedulePage=0;render();
    const changed=resetSnapshot.zoom!==zoom||
      resetSnapshot.values.some(entry=>
        form.elements.namedItem(entry.key).value!==entry.value);
    undoReset.hidden=!changed;
    if(changed)
      status.textContent="Measurements reset to defaults. Undo last reset is available.";
    else resetSnapshot=null;
  });
  undoReset.addEventListener("click",()=>{
    if(!resetSnapshot)return;
    const saved=resetSnapshot;
    clearResetUndo();
    for(const entry of saved.values)
      form.elements.namedItem(entry.key).value=entry.value;
    zoom=saved.zoom;schedulePage=0;render();
    status.textContent="Previous measurements restored from this browser session. Verify inputs and calculated results before use.";
  });
  diagram.addEventListener("transitionend",event=>{
    // Width animates for 180ms; one rAF after click is too early to reliably
    // remove the keyboard tab stop when a drawing zooms back down to 100%.
    if(event.target===diagram.querySelector("svg")&&event.propertyName==="width")
      syncKeyboardScrollRegions();
  });
  for(const [el,delta] of [[zoomPlus,.2],[zoomMinus,-.2]])el.addEventListener("click",()=>{
    zoom=Math.min(2.5,Math.max(.6,Math.round((zoom+delta)*100)/100));
    applyDiagramZoom();requestAnimationFrame(syncKeyboardScrollRegions);
  });
  zoomReset.addEventListener("click",()=>{
    zoom=1;applyDiagramZoom();requestAnimationFrame(syncKeyboardScrollRegions);
  });
  copy.addEventListener("click",async()=>{
    if(!latest)return;
    const text=tool.title+"\n"+latest.metrics.map(m=>m.label+": "+fmt(m.value,m.kind)).join("\n")+"\n"+tool.limit;
    try{await navigator.clipboard.writeText(text);status.textContent="Copied results."}catch{status.textContent="Clipboard access unavailable in this browser."}
  });
  csv.addEventListener("click",()=>{
    if(!latest)return;
    const text=latest.rows.length?
      buildScheduleCsv(latest.rows,unit,
        tool.limit+(slug==="lumber-price-calculator"?
          " Entered price currency: "+currencyCode()+". No FX conversion.":"")):
      buildMetricsCsv(latest.metrics,unit,tool.limit,currencyCode());
    save(slug+"-"+unit+"-cut-list.csv",text,"text/csv;charset=utf-8");
    status.textContent="CSV saved locally.";
  });
  stockExport?.addEventListener("click",()=>{
    if(!latest||!Array.isArray(latest.stockCuts)||!latest.stockCuts.length)return;
    const text=buildScheduleCsv(latest.stockCuts,unit,
      "FFD stock cutting estimate; groups cannot mix; kerf charged between cuts; extra reserve sticks omitted from plan; not a structural or optimality guarantee.");
    save(slug+"-"+unit+"-stock-cut-plan.csv",text,"text/csv;charset=utf-8");
    status.textContent="Stock cut plan CSV saved locally.";
  });
  stockAuditExport?.addEventListener("click",()=>{
    if(!latest?.stockAudit?.enabled||!latest.stockAudit.rows.length)return;
    const body=buildScheduleCsv(latest.stockAudit.rows,unit,
      "OPTIONAL POST-PLAN DIAGNOSTIC ONLY. Incomplete fit means baseline purchase count and quote are NOT sufficient. Tail offcuts are candidates, NOT allocated, priced or proven safe for reuse. Inspect actual cuts and saw losses."+optionalVersionNote());
    save(slug+"-"+unit+"-optional-stock-loss-review.csv",body,"text/csv;charset=utf-8");
    status.textContent="Optional stock-loss review CSV saved locally; original purchase plan unchanged.";
  });
  purchaseReviewExport?.addEventListener("click",()=>{
    const ledger=makeFramingStationLedger(latest?.stockReusePlan,latest?.stockPlan);
    if(!ledger.available)return;
    const measured=auditMeasuredFramingFits(ledger,fieldDraft.sources,{
      sawKerf:fieldDraft.sawKerf,endTrim:fieldDraft.endTrim,
      finalSeverKerf:fieldDraft.finalSeverKerf});
    const report=assessFramingPurchaseReview(ledger,measured,
      purchaseReviewDraft.stocks,purchaseReviewDraft.globals,
      latest?.stockReusePlan);
    const detail=report.rows.map(row=>({...row,
      packetStatus:report.status,sourceInspectionClaim:"USER DECLARATIONS ONLY",
      sawSafetyReviewed:report.globalChecks.sawSafetyReviewed,
      structuralReviewed:report.globalChecks.structuralReviewed,
      supplierVerified:report.globalChecks.supplierVerified,
      totalCostReviewed:report.globalChecks.totalCostReviewed,
      modelQuoteCost:report.reviewedQuotedSubtotal,
      currency:currencyCode(),
      layoutVersionId:versionState.current?.versionIds.layout??null,
      measurementVersionId:versionState.current?.versionIds.measurement??null,
      quotationVersionId:versionState.current?.versionIds.quotation??null,
      declarationVersionId:versionState.current?.versionIds.declaration??null,
      packetVersionId:versionState.current?.versionIds.packet??null,
      comparedReferenceId:versionState.reference?.versionIds.packet??null,
      humanApprovalRequired:true,automaticPurchaseAuthorized:false}));
    const note="SELF-REPORTED PRE-PURCHASE REVIEW, NOT AN APPROVAL. No checkout, stock grade certification, professional structural signoff, blade safety check or actual savings confirmation. A completed review requires independent human purchasing authorization."+optionalVersionNote();
    save(slug+"-"+unit+"-self-reported-purchase-review.csv",
      buildScheduleCsv(detail,unit,note),"text/csv;charset=utf-8");
    status.textContent="Unapproved self-reported purchasing review exported; no order placed.";
  });
  fieldExport?.addEventListener("click",()=>{
    const ledger=makeFramingStationLedger(latest?.stockReusePlan,latest?.stockPlan);
    if(!ledger.available)return;
    const review=auditMeasuredFramingFits(ledger,fieldDraft.sources,{
      sawKerf:fieldDraft.sawKerf,endTrim:fieldDraft.endTrim,
      finalSeverKerf:fieldDraft.finalSeverKerf});
    const rows=review.rows.map(row=>({...row,
      enteredBladeKerf:fieldDraft.sawKerf,
      enteredEndTrim:fieldDraft.endTrim,
      enteredFinalSeverKerf:fieldDraft.finalSeverKerf}));
    const note="MANUAL USER ENTRIES ONLY. Blank means not measured. DIMENSION FIT ONLY does not certify physical stock, grade, saw safety, structure or actual savings. Purchase and cut plan unchanged."+optionalVersionNote();
    save(slug+"-"+unit+"-manual-source-preflight.csv",
      buildScheduleCsv(rows,unit,note),"text/csv;charset=utf-8");
    status.textContent="User-entered dimensional preflight exported; no physical inspection or safe cutting has been certified.";
  });
  stationExport?.addEventListener("click",()=>{
    if(!latest?.stockReusePlan?.enabled)return;
    const ledger=makeFramingStationLedger(latest.stockReusePlan,latest.stockPlan);
    if(!ledger.available)return;
    const body=buildScheduleCsv(ledger.rows,unit,
      "DIMENSIONAL ACCOUNTING ONLY, NOT A CUTTING ORDER OR MACHINE TOOLPATH. Every physical stock length, grade, defects, saw kerf, trims, clamping and structural suitability require independent verification. No site-verified cost savings."+optionalVersionNote());
    save(slug+"-"+unit+"-reallocation-station-ledger.csv",
      body,"text/csv;charset=utf-8");
    status.textContent="Independent stock-local dimensional ledger saved; physical inspection required.";
  });
  stockReuseExport?.addEventListener("click",()=>{
    if(!latest?.stockReusePlan?.enabled||!latest.stockReusePlan.rows?.length)return;
    const body=buildScheduleCsv(latest.stockReusePlan.rows,unit,
      "ALTERNATIVE, NOT THE ORIGINAL CUT PLAN: local whole-stick-retirement heuristic. Same-stock-profile intact cuts only. Positions include entered end trims and between-piece saw kerf. The source is not certified for construction or machine cutting."+optionalVersionNote());
    save(slug+"-"+unit+"-offcut-reallocation-plan.csv",body,"text/csv;charset=utf-8");
    status.textContent="Separate alternative offcut reassignment CSV saved; original cuts unchanged.";
  });
  stockReusePriceExport?.addEventListener("click",()=>{
    if(!latest?.stockReusePlan?.enabled||!latest.stockReusePlan.purchaseVariants?.length)return;
    const list=latest.stockReusePlan.purchaseVariants.map(r=>({...r,currency:currencyCode()}));
    const body=buildScheduleCsv(list,unit,
      "ALTERNATIVE PURCHASE ONLY, independent from the primary buying ticket. Quote differences are modeled for entered supplier prices, not real-world savings or a globally optimal plan. Prices do not include tax, delivery, flaws or labor."+optionalVersionNote());
    save(slug+"-"+unit+"-"+currencyCode().toLowerCase()+"-offcut-alternative-quote.csv",
      body,"text/csv;charset=utf-8");
    status.textContent="Separate modeled alternative supplier quote saved; original buying ticket unchanged.";
  });
  pricingExport?.addEventListener("click",()=>{
    if(!latest||!latest.materialSummary)return;
    const rows=latest.purchaseVariants.map(r=>({
      stockGroup:r.stockGroup,offerLabel:r.offerLabel,stockLength:r.stockLength,
      plannedSticks:r.plannedSticks,allowanceSticks:r.allowanceSticks,
      purchaseSticks:r.purchaseSticks,unitPrice:r.unitPrice,
      plannedCost:r.plannedCost,reserveCost:r.reserveCost,
      purchaseCost:r.purchaseCost,currency:currencyCode()
    }));
    const text=buildScheduleCsv(rows,unit,
      "Material-only user quotes; blank prices mean not quoted, not free. Currency labels do not exchange-convert. No tax, delivery, hardware, plates or labor.");
    save(slug+"-"+unit+"-"+currencyCode().toLowerCase()+"-material-quote.csv",
      text,"text/csv;charset=utf-8");
    status.textContent="Quoted materials CSV saved locally.";
  });
  deckBudgetExport?.addEventListener("click",()=>{
    if(!latest?.deckPurchaseRows)return;
    const rows=latest.deckPurchaseRows.map(r=>({...r,currency:currencyCode()}));
    const body=buildScheduleCsv(rows,unit,
      "Prices entered by user; zero means quote missing. Optional full-width joist stock is nonstructural; no FX conversion, taxes, delivery, structural design, blocking, beams, footings, labor or regulatory approval.");
    save(slug+"-"+unit+"-"+currencyCode().toLowerCase()+"-purchase-quote.csv",
      body,"text/csv;charset=utf-8");
    status.textContent="Deck material quote CSV saved locally.";
  });
  deckFastenerExport?.addEventListener("click",()=>{
    if(!latest?.deckFastenerRows)return;
    const body=buildScheduleCsv(latest.deckFastenerRows,unit,
      "Each separate stock piece at a joist reference = one contact; butt seams count both pieces. Fastener rate is user-entered; actual structural bearing and manufacturer requirements NOT verified.");
    save(slug+"-"+unit+"-fastener-contacts.csv",body,"text/csv;charset=utf-8");
    status.textContent="Deck fastener contacts CSV saved locally.";
  });
  shelfPinCsvExport?.addEventListener("click",()=>{
    if(!latest?.shelfPinEnabled||!latest.shelfPinRows?.length)return;
    const result=buildScheduleCsv(latest.shelfPinRows,unit,
      "Side-panel coordinates: X from each INSIDE FRONT edge; Y from the INSIDE BOTTOM. Both left/right panels use the same front datum. Measured hole-center drop from shelf underside; NOT a physical drilling template or pin load approval.");
    save(slug+"-"+unit+"-side-panel-support-holes.csv",result,"text/csv;charset=utf-8");
    status.textContent="Left/right shelf support-hole CSV saved locally.";
  });
  shelfPinSvgExport?.addEventListener("click",()=>{
    if(!latest?.shelfPinEnabled||!shelfPinSvg?.firstElementChild)return;
    save(slug+"-"+unit+"-side-panel-reference.svg",
      shelfPinSvg.firstElementChild.outerHTML,"image/svg+xml");
    status.textContent="Proportional side-panel reference SVG saved locally.";
  });
  stringerSectionExport?.addEventListener("click",()=>{
    if(!latest?.stringerEnvelopeRows?.length)return;
    const csv=buildScheduleCsv(latest.stringerEnvelopeRows,unit,
      "MODELED geometry only. Vertical first/last end clips and lower parallel stock edge are NOT finished bearing cuts; no 1:1 template, structural approval or raw stock purchase length.");
    save(slug+"-"+unit+"-modeled-section.csv",csv,"text/csv;charset=utf-8");
    status.textContent="Modeled side-section coordinate CSV saved locally.";
  });
  roofReuseExport?.addEventListener("click",()=>{
    if(!latest?.roofReusePlan?.rows?.length)return;
    const csv=buildScheduleCsv(latest.roofReusePlan.rows,unit,
      "Bounded nonrotated stock box placements and stock-local cut polygons; not a certified saw path, optimal purchase count, usable angular kerf or engineered roof installation.");
    save(slug+"-"+unit+"-stock-placement.csv",csv,"text/csv;charset=utf-8");
    status.textContent="Full stock-local cut placement CSV saved locally.";
  });
  roofReuseSvgExport?.addEventListener("click",()=>{
    if(!latest?.roofReusePlan?.rows?.length||!roofReuseSvg?.firstElementChild)return;
    save(slug+"-"+unit+"-stock-preview.svg",
      roofReuseSvg.firstElementChild.outerHTML,"image/svg+xml");
    status.textContent="Proportional roof stock layout preview saved locally.";
  });
  stringerSawExport?.addEventListener("click",()=>{
    if(!latest?.stringerCutLineRows?.length)return;
    const csv=buildScheduleCsv(latest.stringerCutLineRows,unit,
      "One nominal sawline per stair tread/riser leg: X/Y endpoints and lengths. No overcut, end bearing, building-code approval or printable 1:1 cutting template.");
    save(slug+"-"+unit+"-nominal-notch-sawlines.csv",csv,"text/csv;charset=utf-8");
    status.textContent="Notch sawline CSV saved locally.";
  });
  stringerEndExport?.addEventListener("click",()=>{
    if(!latest?.measuredEndCuts?.length)return;
    const csv=buildScheduleCsv(latest.measuredEndCuts,unit,
      "USER-CHOSEN end-edge intersection positions only; actual supports, stock strength, bearing and fastening have NOT been verified.");
    save(slug+"-"+unit+"-user-end-line-references.csv",csv,"text/csv;charset=utf-8");
    status.textContent="Measured reference end-cut CSV saved locally.";
  });
  stringerBlankExport?.addEventListener("click",()=>{
    if(!latest?.stringerBlankRows?.length)return;
    const csv=buildScheduleCsv(latest.stringerBlankRows,unit,
      "Pitch-aligned 2D rectangular raw stock REFERENCE only; centered estimated placement. NOT approved bearing, grain, physical purchase or saw template.");
    save(slug+"-"+unit+"-raw-stock-reference-corners.csv",csv,"text/csv;charset=utf-8");
    status.textContent="Rectangular stock reference corner CSV saved locally.";
  });
  stringerProjectionExport?.addEventListener("click",()=>{
    if(!latest?.endProjectionChecks?.length)return;
    const csv=buildScheduleCsv(latest.endProjectionChecks,unit,
      "X projection only; a within-reference result does NOT establish actual bearing or structural acceptance.");
    save(slug+"-"+unit+"-end-reference-projections.csv",csv,"text/csv;charset=utf-8");
    status.textContent="Nonstructural end X-projection diagnostics CSV saved locally.";
  });
  stringerEndContactExport?.addEventListener("click",()=>{
    if(!latest?.endContactChecks?.length)return;
    const csv=buildScheduleCsv(latest.endContactChecks,unit,
      "Mathematical 2D CUT LINE vs SUPPORT LINE only. One point has ZERO common length and NO verified bearing area; no structural approval.");
    save(slug+"-"+unit+"-end-to-support-2d-intersections.csv",csv,"text/csv;charset=utf-8");
    status.textContent="2D nonstructural cut/support intersection CSV saved locally.";
  });
  stringerSupportExport?.addEventListener("click",()=>{
    if(!latest?.supportReferences?.length)return;
    const csv=buildScheduleCsv(latest.supportReferences,unit,
      "User-entered horizontal support surface references only. NOT structural bearing, fastener or timber end cuts; verify actual site support details.");
    save(slug+"-"+unit+"-support-surfaces.csv",csv,"text/csv;charset=utf-8");
    status.textContent="Support surface reference CSV saved locally.";
  });
  svg.addEventListener("click",()=>{flushInputRender();if(latest){
    const clean=diagram.firstElementChild.cloneNode(true);
    clean.querySelectorAll(".is-selected-geometry").forEach(el=>el.classList.remove("is-selected-geometry"));
    save(slug+"-"+unit+"-diagram.svg",clean.outerHTML,"image/svg+xml");
    status.textContent="SVG saved locally.";
  }});
  print.addEventListener("click",()=>{if(latest)window.print()});
  const applySharedMeasurements=()=>{
    clearResetUndo();
    restoreValues();
    let imported=null;
    try{imported=loadSharedMeasurements();}catch{
      // A malformed or edited fragment never partially overwrites the form.
      imported="rejected";
    }
    schedulePage=0;zoom=1;render();
    if(imported===true&&latest)
      status.textContent="Shared measurements loaded and recalculated. Verify actual material dimensions independently.";
    else if(imported===true)
      status.textContent="Shared inputs could not be rendered. Review the calculation error before use.";
    else if(imported==="rejected")
      status.textContent="Invalid or incomplete measurement link ignored; default inputs restored.";
  };
  applySharedMeasurements();
  // Navigation to the same page with a different fragment is a same-document
  // navigation. It does not rerun the module, so restore explicitly here too.
  window.addEventListener("hashchange",()=>{
    if(window.location.hash.startsWith("#measure="))applySharedMeasurements();
  });
  try{const recent=JSON.parse(localStorage.getItem("woodwork-recent")||"[]");localStorage.setItem("woodwork-recent",JSON.stringify([slug,...recent.filter(x=>x!==slug)].slice(0,6)))}catch{}
}

