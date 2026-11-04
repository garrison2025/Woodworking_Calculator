import {safeCompute,convertToInches,convertFromInches} from "./calcs.mjs";
import {buildScheduleCsv,scheduleColumns} from "./cut-list.mjs";
const slug=document.body.dataset.tool;
if(slug){
  const manifest=await fetch("/assets/tools.json").then(r=>{if(!r.ok)throw Error("Missing tool registry");return r.json()});
  const tool=manifest.tools.find(t=>t.slug===slug&&t.priority!=="P2");
  if(!tool)throw Error("Unavailable calculator.");
  const form=document.querySelector("#calculator-form"),out=document.querySelector("#result-cards"),cut=document.querySelector("#cut-table"),diagram=document.querySelector("#dimension-svg"),error=document.querySelector("#calc-error"),units=document.querySelector("#unit-select"),fraction=document.querySelector("#fraction-select"),copy=document.querySelector("#copy-result"),csv=document.querySelector("#download-csv"),svg=document.querySelector("#download-svg"),print=document.querySelector("#print-sheet"),reset=document.querySelector("#reset-values"),zoomPlus=document.querySelector("#zoom-in"),zoomMinus=document.querySelector("#zoom-out"),zoomReset=document.querySelector("#zoom-reset"),status=document.querySelector("#action-status");
  let unit="in",latest=null,zoom=1,schedulePage=0,scheduleCols=[];
  const schedulePageSize=160;
  const schedulePager=document.querySelector("#schedule-pager");
  const schedulePrev=document.querySelector("#schedule-prev");
  const scheduleNext=document.querySelector("#schedule-next");
  const schedulePageInput=document.querySelector("#schedule-page-input");
  const scheduleGo=document.querySelector("#schedule-go");
  const schedulePageStatus=document.querySelector("#schedule-page-status");
  const scheduleCount=document.querySelector("#schedule-count");
  const fmt=(x,kind="L")=>{
    if(!Number.isFinite(x))return "—";
    if(kind==="N")return String(Math.round(x));
    if(kind==="D")return trim(x,3)+"%";
    if(kind==="A")return trim(x,3)+"°";
    if(kind==="P")return trim(x,3)+":12";
    if(kind==="FT")return ["mm","cm","m"].includes(unit)?trim(x*.3048,3)+" m":trim(x,3)+" ft";
    if(kind==="FT2")return ["mm","cm","m"].includes(unit)?trim(x*.09290304,3)+" m²":trim(x,3)+" ft²";
    if(kind==="L")return trim(convertFromInches(x,unit),{in:4,ft:5,mm:2,cm:3,m:6}[unit]??4)+" "+unit;
    return trim(x,3);
  };
  const trim=(n,d=3)=>Number(n.toFixed(d)).toLocaleString("en-US",{maximumFractionDigits:d});
  const esc=s=>String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const frac=(x)=>{
    if(unit!=="in"||x<0||!Number.isFinite(x))return "";
    const den=Number(fraction.value)||16,whole=Math.floor(x),numer=Math.round((x-whole)*den);
    if(numer===den)return String(whole+1)+" in";
    if(!numer)return whole+" in";
    const gcd=(a,b)=>b?gcd(b,a%b):a;
    const d=gcd(numer,den);
    return (whole?whole+" ":"")+numer/d+"/"+(den/d)+" in";
  };
  const values=()=>{
    const a={};
    for(const f of tool.inputs){
      const el=form.elements.namedItem(f.key);
      if(!el||el.value.trim()==="")throw new Error(f.label+" is required.");
      const v=Number(el.value);
      if(!Number.isFinite(v))throw new Error(f.label+" must be a valid number.");
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
    if(["ruler","posts","holes","kerfs","balusters","shelves","boards","panels","slope","opening"].includes(data.shape)){
      // A single isotropic scale prevents wide drilled holes from becoming
      // distorted: shrink the board horizontally if the diameter would not
      // fit the fixed vertical diagram viewport.
      const holeScale=data.shape==="holes"?Math.min(W/span,100/data.holeDiameter):null;
      const holeStart=holeScale===null?left:(900-span*holeScale)/2;
      // Shared scale on both axes: kerf mouth and retained-web thickness
      // remain proportionate to the entered flat stock dimensions.
      const kerfScale=data.shape==="kerfs"?Math.min(W/span,128/data.stockThickness):null;
      const kerfStart=kerfScale===null?left:(900-data.kerfArcLength*kerfScale)/2;
      if(data.shape==="boards"){
        const w=data.boardWidth||2;
        for(let i=0;i<Math.min(marks.length,180);i++){
          const px=x(marks[i].x),nx=x(Math.min(span,marks[i].x+w));
          content+='<rect x="'+px+'" y="125" width="'+Math.max(1,nx-px)+'" height="104" rx="1" fill="'+(i%2?"#d2b18b":"#e0c6a5")+'" stroke="#9e764c"/>';
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
        const min=Math.max(1,Math.max(data.start||1,data.boardHeight||1));
        const y0=base-(data.start/min)*175,y1=base-(data.boardHeight/min)*175;
        content+='<path d="M'+left+' '+y0+' L'+right+' '+y1+'" stroke="#1e6454" stroke-width="5" fill="none"/>';
        for(const p of marks)content+='<line x1="'+x(p.x)+'" y1="'+base+'" x2="'+x(p.x)+'" y2="'+(y0+(y1-y0)*p.x/span)+'" stroke="#b98c56" stroke-width="5"/>';
      }else if(data.shape==="opening"){
        const openings=data.openings||[],wallHeight=Math.max(1,data.wallHeight||96);
        const yLevel=h=>255-179*Math.min(1,Math.max(0,h/wallHeight));
        content+='<rect x="'+left+'" y="76" width="'+W+'" height="179" fill="#e6e9de" opacity=".6" stroke="#426b5b" stroke-width="2"/>';
        for(const o of openings){
          const yTop=yLevel(o.top),ySill=yLevel(o.sill);
          content+='<rect class="opening-cutout" x="'+x(o.start)+'" y="'+yTop+'" width="'+(x(o.end)-x(o.start))+'" height="'+(ySill-yTop)+'" fill="#fcfbf8" stroke="#ad744e" stroke-width="2" stroke-dasharray="6 4"/>';
          content+=svgText(x(o.start)+4,Math.max(48,yTop-5),o.label+" · "+fmt(o.height),"tick-label");
          if(o.sill>0)content+='<line x1="'+x(o.start)+'" y1="'+ySill+'" x2="'+x(o.end)+'" y2="'+ySill+'" stroke="#ad744e" stroke-width="3"/>';
        }
        for(const p of marks)content+='<line x1="'+x(p.x)+'" y1="'+yLevel(p.topHeight??wallHeight)+'" x2="'+x(p.x)+'" y2="255" stroke="'+(p.role==="king"?"#1e6454":p.role==="jack"?"#c58c54":"#426b5b")+'" stroke-width="'+(p.role==="mark"?"3":"5")+'"/>';
        content+=svgText(left+5,64,"WALL "+fmt(wallHeight),"dim-label");
      }else if(data.shape==="holes"){
        const boardWidth=span*holeScale;
        content+='<rect class="drilling-stock" x="'+holeStart+'" y="110" width="'+boardWidth+'" height="128" fill="#ead4b2" stroke="#8e6b43" stroke-width="2"><title>Length reference only; stock face width and cross-grain clearance not supplied</title></rect>';
        content+='<line x1="'+holeStart+'" y1="174" x2="'+(holeStart+boardWidth)+'" y2="174" stroke="#866845" stroke-width="1.2" stroke-dasharray="5 4"/>';
        for(const [i,p] of marks.entries()){
          const cx=holeStart+p.x*holeScale,r=Math.max(.15,data.holeDiameter*holeScale/2);
          content+='<circle class="drill-hole" cx="'+cx+'" cy="174" r="'+r+'" fill="#fcfbf8" stroke="#1e6454" stroke-width="1.4"><title>'+esc("Hole "+(i+1)+": center "+fmt(p.x)+", diameter "+fmt(data.holeDiameter))+'</title></circle>';
        }
        content+=svgText(holeStart,70,"HOLE Ø "+fmt(data.holeDiameter),"dim-label");
        content+=svgText(holeStart,90,"EDGE CLEAR "+fmt(data.endMaterialMargin),"tick-label");
        content+=svgText(holeStart,330,"CLEAR BETWEEN "+fmt(data.holeClearance),"dim-label");
      }else if(data.shape==="kerfs"){
        const y0=98,woodWidth=data.kerfArcLength*kerfScale;
        const stockH=data.stockThickness*kerfScale,depthH=data.cutDepth*kerfScale,webH=data.retainedWeb*kerfScale;
        content+='<rect class="kerf-stock" x="'+kerfStart+'" y="'+y0+'" width="'+woodWidth+'" height="'+stockH+'" fill="#e4c49b" stroke="#926d45" stroke-width="1.8"><title>'+esc("Flat stock thickness "+fmt(data.stockThickness))+'</title></rect>';
        content+='<rect class="kerf-retained-web" x="'+kerfStart+'" y="'+(y0+depthH)+'" width="'+woodWidth+'" height="'+webH+'" fill="#a4c3a2"><title>'+esc("Continuous retained web "+fmt(data.retainedWeb))+'</title></rect>';
        for(const [i,p] of marks.entries()){
          const sx=kerfStart+(p.x-data.kerfWidth/2)*kerfScale;
          content+='<rect class="kerf-slot" x="'+sx+'" y="'+y0+'" width="'+(data.kerfWidth*kerfScale)+'" height="'+depthH+'" fill="#fcfbf8" stroke="#9e764c" stroke-width=".35"><title>'+esc("Kerf "+(i+1)+" · center "+fmt(p.x)+" · width "+fmt(data.kerfWidth)+" · depth "+fmt(data.cutDepth))+'</title></rect>';
        }
        content+=svgText(kerfStart,71,"FLAT STOCK · KERF "+fmt(data.kerfWidth),"dim-label");
        content+=svgText(kerfStart,87,"GREEN WEB "+fmt(data.retainedWeb)+" · TRIAL ONLY","tick-label");
      }else if(data.shape==="shelves"){
        // Both faces come from the same bottom/thickness values as the schedule.
        const shelfHeight=(data.shelfThickness||1)/span*195;
        for(const p of marks){
          const yy=base-(p.x+data.shelfThickness)/span*195;
          content+='<rect class="shelf-face" x="235" y="'+yy+'" width="445" height="'+Math.max(1,shelfHeight)+'" fill="#dbb890" stroke="#8c663e" stroke-width="1.4"><title>'+esc("Shelf at "+fmt(p.x)+" · thickness "+fmt(data.shelfThickness))+'</title></rect>';
        }
        content+='<rect x="220" y="73" width="475" height="205" fill="none" stroke="#345f50" stroke-width="8"/>';
      }else{
        for(const [i,p] of marks.entries()){
          const px=x(p.x);
          if(data.shape==="balusters"||data.shape==="posts"){
            const pieceWidth=Math.min(105,Math.max(.15,(data.itemWidth||1)*W/span));
            content+='<rect class="'+(data.shape==="posts"?"post-face":"baluster-face")+'" x="'+(px-pieceWidth/2)+'" y="113" width="'+pieceWidth+'" height="141" rx=".6" fill="#b78d5b"><title>'+esc(fmt(data.itemWidth||1)+" actual face width")+'</title></rect>';
          }
          else content+='<line x1="'+px+'" y1="101" x2="'+px+'" y2="253" stroke="#ba8f60" stroke-width="'+(data.shape==="kerfs"?"2":"1.5")+'"/>';
        }
      }
      for(let i=0;i<marks.length;i+=tick){
        const p=marks[i],px=data.shape==="holes"?holeStart+p.x*holeScale:data.shape==="kerfs"?kerfStart+p.x*kerfScale:x(p.x);
        content+='<line x1="'+px+'" y1="'+base+'" x2="'+px+'" y2="'+(base+9)+'" stroke="#1e6454"/>';
        if(marks.length<=24||i%Math.max(tick,2)===0)content+=svgText(px-10,base+27,p.label?String(p.label).slice(0,9):trim(convertFromInches(p.x,unit),1),"tick-label");
      }
      if(data.shape==="holes"||data.shape==="kerfs"){
        const scale=data.shape==="holes"?holeScale:kerfScale;
        const start=data.shape==="holes"?holeStart:kerfStart;
        content+=svgText(start,302,"0 "+unit,"dim-label");
        content+=svgText(start+data.span*scale-100,302,fmt(data.span),"dim-label");
      }else content+=svgText(left,319,"0 "+unit,"dim-label")+svgText(right-96,319,fmt(span),"dim-label");
    }else if(data.shape==="rafter"){
      // Side-elevation reference, deliberately not a paper-scale cutting template.
      // Long edge and cutout are schematic; the numeric schedule comes from the geometry engine.
      const total=Math.max(1,data.run+data.overhang),bearX=x(data.run);
      const topAt=px=>102+116*(px-left)/W;
      const bottomAt=px=>topAt(px)+37;
      const startX=left,endX=right;
      content+='<path d="M'+startX+' '+topAt(startX)+' L'+endX+' '+topAt(endX)+' L'+endX+' '+bottomAt(endX)+' L'+startX+' '+bottomAt(startX)+' Z" fill="#dfc4a0" stroke="#8b6843" stroke-width="2"/>';
      const notchW=Math.min(Math.max(9,data.seat/total*W),bearX-left);
      const notchH=Math.max(3,Math.min(28,37*data.notchNormal/data.stockDepth));
      const atX=bearX-notchW;
      const topSeat=bottomAt(atX)-notchH;
      content+='<path d="M'+atX+' '+bottomAt(atX)+' L'+atX+' '+topSeat+' L'+bearX+' '+topSeat+' L'+bearX+' '+bottomAt(bearX)+' Z" fill="#fcfbf8" stroke="#a05c33" stroke-width="2.4"/>';
      content+='<line x1="'+bearX+'" y1="54" x2="'+bearX+'" y2="274" stroke="#d09b58" stroke-dasharray="5 5" stroke-width="1.8"/>';
      content+=svgText(left+25,73,"RIDGE REFERENCE","dim-label");
      content+=svgText(Math.max(left+290,bearX-96),67,"BEARING","dim-label");
      content+=svgText(left+24,291,"SEAT "+fmt(data.seat),"dim-label");
      content+=svgText(left+24,318,"NORMAL NOTCH "+fmt(data.notchNormal),"dim-label");
      content+=svgText(right-183,318,"EAVE "+fmt(data.overhang),"dim-label");
    }else if(data.shape==="stringer"){
      // Actual engine profile vertices: one vertical riser per row and one
      // horizontal tread between successive risers. Preserve aspect ratio.
      // This is a nominal reference profile, NOT a certified stock outline.
      const verts=data.stepVertices,run=(data.risers-1)*data.tread,rise=data.totalRise;
      const sc=Math.min(650/Math.max(.001,run),185/Math.max(.001,rise));
      const ox=(900-run*sc)/2,oy=274;
      const px=v=>ox+v.x*sc,py=v=>oy-v.y*sc;
      const points=verts.map(v=>px(v)+","+py(v)).join(" ");
      content+='<polyline class="stringer-step-profile" points="'+points+'" data-vertices="'+verts.length+'" fill="none" stroke="#246a58" stroke-width="2.7" stroke-linejoin="round"><title>Nominal riser and tread cut reference; vertices follow the exported riser elevations and horizontal runs</title></polyline>';
      const first=verts[1],end=verts.at(-1);
      content+='<line class="stringer-pitch-line" x1="'+px(first)+'" y1="'+py(first)+'" x2="'+px(end)+'" y2="'+py(end)+'" stroke="#b77b44" stroke-width="1.8" stroke-dasharray="6 4"><title>'+esc("Notch pitch line "+fmt(data.pitchLine)+"; NOT the floor diagonal")+'</title></line>';
      content+='<line class="stringer-floor-diagonal" x1="'+ox+'" y1="'+oy+'" x2="'+px(end)+'" y2="'+py(end)+'" stroke="#aeb7ad" stroke-width="1.2" stroke-dasharray="3 5"><title>'+esc("Floor datum diagonal "+fmt(data.floorDiagonal)+"; NOT a cut length")+'</title></line>';
      const bottomTrimY=oy-data.bottomLayoutRise*sc;
      content+='<line class="stringer-bottom-trim" x1="'+(ox-18)+'" y1="'+bottomTrimY+'" x2="'+(ox+17)+'" y2="'+bottomTrimY+'" stroke="#a85034" stroke-width="2.8"><title>'+esc("Separate bottom trim height "+fmt(data.bottomLayoutRise)+"; actual end fastening not modeled")+'</title></line>';
      content+=svgText(70,52,data.risers+" risers / "+(data.risers-1)+" treads","dim-label");
      content+=svgText(70,75,"NOMINAL STEP REFERENCE · SCALED SCHEMATIC","tick-label");
      content+=svgText(70,309,"NOTCH PITCH "+fmt(data.pitchLine),"dim-label");
      content+=svgText(70,332,"BOTTOM TRIM "+fmt(data.bottomLayoutRise),"tick-label");
      content+=svgText(565,309,"THROAT (NOMINAL) "+fmt(data.throat),"dim-label");
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
    }else if(data.shape==="triangle"){
      const run=data.run||span,rise=data.rise||0,hh=Math.max(10,Math.abs(rise));
      const ry=base-Math.min(210,Math.abs(rise)/Math.max(run,hh)*W*.52);
      content+='<polygon points="'+left+','+base+' '+right+','+base+' '+right+','+ry+'" fill="#e5ece5" stroke="#356c58" stroke-width="2"/><path d="M'+(right-19)+' '+base+' L'+(right-19)+' '+(base-19)+' L'+right+' '+(base-19)+'" fill="none" stroke="#8d987d"/>';
      content+=svgText(left+W/2,base+30,fmt(run),"dim-label")+svgText(right-73,(base+ry)/2,fmt(rise),"dim-label")+svgText(left+W/2-15,(base+ry)/2-18,fmt(Math.hypot(run,rise)),"dim-label");
    }else if(data.shape==="stairs"){
      const n=data.risers||2,stepW=W/Math.max(1,n-1),stepH=H/Math.max(2,n);
      let d="M"+left+" "+base;
      for(let i=1;i<n;i++)d+=" V"+(base-i*stepH)+" H"+(left+i*stepW);
      d+=" V"+(base-n*stepH);
      content+='<path d="'+d+'" fill="none" stroke="#1e6454" stroke-width="4" stroke-linecap="round"/>';
      content+=svgText(left+12,55,n+" risers · "+(n-1)+" treads","dim-label");
     }else if(data.shape==="deck-plan"){
      const scale=Math.min(716/data.deckLength,210/data.deckWidth);
      const ww=data.deckLength*scale,hh=data.deckWidth*scale;
      const x0=(900-ww)/2,y0=(344-hh)/2;
      content+='<rect x="'+x0+'" y="'+y0+'" width="'+ww+'" height="'+hh+'" fill="#e7eae3" stroke="#1e6454" stroke-width="2"/>';
      for(const [i,row] of data.deckRows.entries()){
        const yy=y0+row.acrossStart*scale,sh=row.ripWidth*scale;
        content+='<rect class="deck-plan-board" x="'+x0+'" y="'+yy+'" width="'+ww+'" height="'+Math.max(.1,sh)+'" fill="'+(i%2?"#d2b18b":"#e2c8a5")+'" stroke="#957452" stroke-width=".45"><title>'+esc(row.item+" · "+fmt(row.ripWidth)+" rip")+'</title></rect>';
        for(const seam of data.seamCenters||[]){
          const xx=x0+seam*scale;
          content+='<line class="deck-plan-seam" x1="'+xx+'" y1="'+yy+'" x2="'+xx+'" y2="'+(yy+sh)+'" stroke="#9b4e34" stroke-width="2.2"><title>'+esc(row.item+" butt joint at "+fmt(seam)+" on a joist center reference; support, fasteners and staggering are NOT verified")+'</title></line>';
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
        const sw=sheet.cutAlong*scale,sh=sheet.cutUphill*scale;
        content+='<rect class="sheathing-cut" x="'+xx+'" y="'+yy+'" width="'+sw+'" height="'+sh+'" fill="'+(i%2?"#d9bc95":"#c7ddcc")+'" stroke="#fffefd" stroke-width="1.6"><title>'+esc(sheet.id+" · "+fmt(sheet.cutAlong)+" × "+fmt(sheet.cutUphill))+'</title></rect>';
        if(sw>37&&sh>24)content+=svgText(xx+5,yy+17,sheet.id,"tick-label");
      }
      content+='<rect x="'+x0+'" y="'+y0+'" width="'+ww+'" height="'+hh+'" fill="none" stroke="#1e6454" stroke-width="2.5"/>';
      content+=svgText(x0,Math.max(22,y0-12),"EAVE "+fmt(data.roofEave),"dim-label");
      content+=svgText(x0,Math.min(337,y0+hh+23),"UP SLOPE "+fmt(data.roofSlope)+" | "+data.roofSheets.length+" SHEETS","dim-label");
    }else if(data.shape==="roof-panels"){
      const scale=Math.min(710/data.roofMajor,213/data.roofMinor),ww=data.roofMajor*scale,hh=data.roofMinor*scale;
      const x0=(900-ww)/2,y0=(344-hh)/2,colors=["#c7ddcc","#d9bc95","#bdd7c9","#ead1b0"];
      for(const sheet of data.roofPanels){
        const p=sheet.planPoints.map(x=>(x0+x[0]*scale).toFixed(2)+","+(y0+x[1]*scale).toFixed(2)).join(" ");
        content+='<polygon class="roof-panel-cut" points="'+p+'" fill="'+colors[sheet.planeIndex]+'" stroke="#fffefd" stroke-width="1"><title>'+esc(sheet.plane+" "+sheet.id)+'</title></polygon>';
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
      const seg=data.segments||12,R=104,cx=467,cy=166,r=R*(data.inner||1)/(data.outer||2);
      for(let i=0;i<seg;i++){const a1=i*2*Math.PI/seg-Math.PI/2,a2=(i+1)*2*Math.PI/seg-Math.PI/2;
        const p=(radius,a)=>[cx+radius*Math.cos(a),cy+radius*Math.sin(a)];
        const [x1,y1]=p(R,a1),[x2,y2]=p(R,a2),[x3,y3]=p(r,a2),[x4,y4]=p(r,a1);
        content+='<path d="M'+x1+','+y1+' A'+R+','+R+' 0 0,1 '+x2+','+y2+' L'+x3+','+y3+' A'+r+','+r+' 0 0,0 '+x4+','+y4+' Z" fill="'+(i%2?"#dfb989":"#c9945f")+'" stroke="#704f2d"/>';
      }
    }else if(data.shape==="angles"){
      // Two independent angle illustrations. The inside/left choices affect
      // the PLAN reference orientation only, NEVER a real saw hand setting.
      const m=data.miter*Math.PI/180,b=data.bevel*Math.PI/180;
      const ox=255,oy=190,ray=140,sgn=data.planSign;
      const mx=ox+ray*Math.cos(m),my=oy-sgn*ray*Math.sin(m);
      content+='<line class="crown-miter-base" x1="'+ox+'" y1="'+oy+'" x2="'+(ox+ray)+'" y2="'+oy+'" stroke="#386b57" stroke-width="3"/>';
      content+='<line class="crown-miter-ray" data-sign="'+sgn+'" x1="'+ox+'" y1="'+oy+'" x2="'+mx+'" y2="'+my+'" stroke="#bd8651" stroke-width="3.2"><title>'+esc("Illustrative plan turn "+trim(sgn*data.miter,3)+" degrees; NOT a saw rotation setting")+'</title></line>';
      const bx=610,by=240,br=145;
      content+='<line x1="'+bx+'" y1="'+by+'" x2="'+(bx+br)+'" y2="'+by+'" stroke="#386b57" stroke-width="3"/>';
      content+='<line class="crown-bevel-ray" x1="'+bx+'" y1="'+by+'" x2="'+(bx+br*Math.cos(b))+'" y2="'+(by-br*Math.sin(b))+'" stroke="#bd8651" stroke-width="3.2"><title>'+esc("Bevel magnitude "+trim(data.bevel,3)+" degrees")+'</title></line>';
      content+=svgText(93,69,"MITER · ILLUSTRATIVE PLAN","dim-label");
      content+=svgText(93,89,(data.inside?"INSIDE":"OUTSIDE")+" / "+(data.left?"LEFT":"RIGHT")+" REFERENCE","tick-label");
      content+=svgText(93,317,trim(sgn*data.miter,2)+"° (NOT SAW SETTING)","dim-label");
      content+=svgText(573,69,"BEVEL · MAGNITUDE","dim-label");
      content+=svgText(594,315,trim(data.bevel,2)+"°","dim-label");
    }
    const title=esc(tool.title),label=esc("All diagram dimensions in "+({in:"inches",ft:"feet",mm:"millimeters",cm:"centimeters",m:"meters"}[unit]||"inches"));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 344" role="img" aria-label="'+title+' scaled schematic based on calculated values"><title>'+title+'</title><desc>'+label+'; illustrative geometry, not a one-to-one cutting template</desc><style>.gridline{stroke:#dbe1d9;stroke-width:1}.axis{stroke:#385f4d;stroke-width:2}.tick-label{font:12px ui-monospace,monospace;fill:#36574e}.dim-label{font:15px ui-monospace,monospace;fill:#203b33}</style><rect width="900" height="344" fill="#fcfbf8"/>'+grid+content+'</svg>';
  }
  const save=(name,content,type)=>{
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  };
  const scheduleValue=(kind,v)=>{
    if(v===null||v===undefined)return "—";
    if(kind==="vertices"&&Array.isArray(v))
      return v.map(point=>"("+point.map(n=>fmt(n)).join(", ")+")").join("; ");
    if(kind==="area")return fmt(v,"FT2");
    if(kind==="angle")return fmt(v,"A");
    if(kind==="length"&&typeof v==="number")return fmt(v,"L");
    return String(v);
  };
  const renderSchedule=()=>{
    if(!latest||!latest.rows.length){
      cut.innerHTML='<tbody><tr><td>Calculated dimensions are shown above. No repeating cut list for this geometry.</td></tr></tbody>';
      scheduleCount.textContent="";
      schedulePager.hidden=true;
      return;
    }
    const count=latest.rows.length,pages=Math.ceil(count/schedulePageSize);
    schedulePage=Math.min(Math.max(0,schedulePage),pages-1);
    const start=schedulePage*schedulePageSize,end=Math.min(count,start+schedulePageSize);
    cut.innerHTML='<thead><tr>'+scheduleCols.map(col=>'<th scope="col">'+esc(col.label)+'</th>').join("")+'</tr></thead><tbody>'+
      latest.rows.slice(start,end).map(row=>'<tr>'+scheduleCols.map(col=>'<td>'+esc(scheduleValue(col.kind,row[col.key]))+'</td>').join("")+'</tr>').join("")+'</tbody>';
    schedulePager.hidden=pages<=1;
    schedulePrev.disabled=schedulePage===0;
    scheduleNext.disabled=schedulePage===pages-1;
    schedulePageInput.max=String(pages);
    schedulePageInput.value=String(schedulePage+1);
    schedulePageStatus.textContent="Page "+(schedulePage+1)+" of "+pages;
    scheduleCount.textContent=count>schedulePageSize?
      "Showing rows "+(start+1)+"–"+end+" of "+count+". Print shows this page only; CSV includes all "+count+" rows.":
      "Showing "+count+" computed rows.";
  };
  function render(){
    try{
      const data=safeCompute(slug,values());
      if(!data.ok)throw new Error(data.error);
      latest=data.data;error.hidden=true;
      out.innerHTML=latest.metrics.map((m,i)=>'<article class="metric '+(i===0?"main-metric":"")+'"><span>'+esc(m.label)+'</span><strong>'+esc(fmt(m.value,m.kind))+'</strong>'+(m.kind==="L"&&unit==="in"?'<small>≈ '+esc(frac(m.value))+'</small>':"")+'</article>').join("");
      scheduleCols=latest.rows.length?scheduleColumns(latest.rows,unit):[];
      renderSchedule();
      diagram.innerHTML=drawing(latest);diagram.querySelector("svg")?.style.setProperty("width",zoom*100+"%");
      document.querySelector("#print-assumptions").textContent=tool.limit;
      status.textContent="Updated from your measurements.";
    }catch(e){latest=null;scheduleCols=[];schedulePage=0;error.hidden=false;error.textContent=e.message;out.innerHTML='<p class="empty-result">Fix an input to view the calculated results.</p>';cut.innerHTML="";diagram.innerHTML="";scheduleCount.textContent="";schedulePager.hidden=true;status.textContent="Calculation requires correction."}
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
  };
  schedulePrev.addEventListener("click",()=>showSchedulePage(schedulePage-1));
  scheduleNext.addEventListener("click",()=>showSchedulePage(schedulePage+1));
  const jumpSchedule=()=>showSchedulePage(Number(schedulePageInput.value)-1);
  scheduleGo.addEventListener("click",jumpSchedule);
  schedulePageInput.addEventListener("keydown",event=>{
    if(event.key==="Enter"){event.preventDefault();jumpSchedule();}
  });
  const restoreValues=()=>{
    for(const f of tool.inputs){
      const el=form.elements.namedItem(f.key);
      el.value=f.kind==="L"?Number(convertFromInches(f.value,unit).toFixed(unit==="m"?7:6)):f.value;
    }
  };
  units.addEventListener("change",()=>{
    const before=unit,after=units.value;if(before===after)return;
    for(const f of tool.inputs)if(f.kind==="L"){
      const el=form.elements.namedItem(f.key),v=Number(el.value);
      if(Number.isFinite(v))el.value=Number(convertFromInches(convertToInches(v,before),after).toFixed(after==="m"?7:6));
    }
    unit=after;document.querySelectorAll("[data-length-unit]").forEach(el=>el.textContent=unit);render();
  });
  form.addEventListener("input",()=>{schedulePage=0;render();});
  fraction.addEventListener("change",render);
  reset.addEventListener("click",()=>{restoreValues();zoom=1;schedulePage=0;render();});
  for(const [el,delta] of [[zoomPlus,.2],[zoomMinus,-.2]])el.addEventListener("click",()=>{zoom=Math.min(2.5,Math.max(.6,zoom+delta));diagram.querySelector("svg")?.style.setProperty("width",zoom*100+"%");});
  zoomReset.addEventListener("click",()=>{zoom=1;diagram.querySelector("svg")?.style.setProperty("width","100%");});
  copy.addEventListener("click",async()=>{
    if(!latest)return;
    const text=tool.title+"\n"+latest.metrics.map(m=>m.label+": "+fmt(m.value,m.kind)).join("\n")+"\n"+tool.limit;
    try{await navigator.clipboard.writeText(text);status.textContent="Copied results."}catch{status.textContent="Clipboard access unavailable in this browser."}
  });
  csv.addEventListener("click",()=>{
    if(!latest)return;
    const rows=latest.rows.length?latest.rows:latest.metrics.map(m=>({measurement:m.label,value:fmt(m.value,m.kind)}));
    const text=buildScheduleCsv(rows,unit,tool.limit);
    save(slug+"-"+unit+"-cut-list.csv",text,"text/csv;charset=utf-8");
    status.textContent="CSV saved locally.";
  });
  svg.addEventListener("click",()=>{if(latest){save(slug+"-"+unit+"-diagram.svg",diagram.firstElementChild.outerHTML,"image/svg+xml");status.textContent="SVG saved locally."}});
  print.addEventListener("click",()=>{if(latest)window.print()});
  restoreValues();render();
  try{const recent=JSON.parse(localStorage.getItem("woodwork-recent")||"[]");localStorage.setItem("woodwork-recent",JSON.stringify([slug,...recent.filter(x=>x!==slug)].slice(0,6)))}catch{}
}

/* Homepage history is browser-only and optional; no tracking endpoint exists. */
if(!slug){
  const panel=document.querySelector("#recent-tools"),links=document.querySelector("#recent-links");
  if(panel&&links){
    try{
      const saved=JSON.parse(localStorage.getItem("woodwork-recent")||"[]");
      const manifest=await fetch("/assets/tools.json").then(r=>r.json());
      const available=manifest.tools.filter(t=>t.priority!=="P2");
      for(const item of saved.slice(0,6)){
        const found=available.find(t=>t.slug===item);
        if(!found)continue;
        const a=document.createElement("a");
        a.href="/"+found.slug+"/";
        a.textContent=found.title+" ↗";
        links.appendChild(a);
      }
      if(links.children.length)panel.hidden=false;
    }catch{/* Recent tool history is optional. */}
  }
}
