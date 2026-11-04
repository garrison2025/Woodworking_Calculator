import {safeCompute,convertToInches,convertFromInches} from "./calcs.mjs";
const slug=document.body.dataset.tool;
if(slug){
  const manifest=await fetch("/assets/tools.json").then(r=>{if(!r.ok)throw Error("Missing tool registry");return r.json()});
  const tool=manifest.tools.find(t=>t.slug===slug&&t.priority!=="P2");
  if(!tool)throw Error("Unavailable calculator.");
  const form=document.querySelector("#calculator-form"),out=document.querySelector("#result-cards"),cut=document.querySelector("#cut-table"),diagram=document.querySelector("#dimension-svg"),error=document.querySelector("#calc-error"),units=document.querySelector("#unit-select"),fraction=document.querySelector("#fraction-select"),copy=document.querySelector("#copy-result"),csv=document.querySelector("#download-csv"),svg=document.querySelector("#download-svg"),print=document.querySelector("#print-sheet"),reset=document.querySelector("#reset-values"),zoomPlus=document.querySelector("#zoom-in"),zoomMinus=document.querySelector("#zoom-out"),zoomReset=document.querySelector("#zoom-reset"),status=document.querySelector("#action-status");
  let unit="in",latest=null,zoom=1;
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
    const span=Math.max(1,data.span||1);
    const x=v=>left+Math.min(1,Math.max(0,v/span))*W;
    const grid=Array.from({length:11},(_,i)=>'<line class="gridline" x1="'+(left+i*W/10)+'" y1="36" x2="'+(left+i*W/10)+'" y2="293"/>').join("");
    let content='<line class="axis" x1="'+left+'" y1="'+base+'" x2="'+right+'" y2="'+base+'"/>';
    let marks=data.marks||[];
    const tick=marks.length>60?Math.ceil(marks.length/60):1;
    if(["ruler","posts","holes","kerfs","balusters","shelves","boards","panels","slope","opening"].includes(data.shape)){
      if(data.shape==="boards"){
        const w=data.boardWidth||2;
        for(let i=0;i<Math.min(marks.length,180);i++){
          const px=x(marks[i].x),nx=x(Math.min(span,marks[i].x+w));
          content+='<rect x="'+px+'" y="125" width="'+Math.max(1,nx-px)+'" height="104" rx="1" fill="'+(i%2?"#d2b18b":"#e0c6a5")+'" stroke="#9e764c"/>';
        }
      }else if(data.shape==="panels"){
        const w=data.panelWidth||1;
        for(const [i,p] of marks.entries())content+='<rect x="'+x(p.x-w/2)+'" y="87" width="'+Math.max(1,x(p.x+w/2)-x(p.x-w/2))+'" height="162" fill="'+(i%2?"#e1c29d":"#f0d9bc")+'" stroke="#97734e" stroke-width="1.5"/>';
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
      }else if(data.shape==="shelves"){
        for(const p of marks)content+='<line x1="235" y1="'+(base-p.x/span*195)+'" x2="680" y2="'+(base-p.x/span*195)+'" stroke="#b88750" stroke-width="8" stroke-linecap="round"/>';
        content+='<rect x="220" y="73" width="475" height="205" fill="none" stroke="#345f50" stroke-width="8"/>';
      }else{
        for(const [i,p] of marks.entries()){
          const px=x(p.x);
          if(data.shape==="balusters"||data.shape==="posts")content+='<rect x="'+(px-3.5)+'" y="113" width="7" height="141" rx="2" fill="#b78d5b"/>';
          else content+='<line x1="'+px+'" y1="101" x2="'+px+'" y2="253" stroke="#ba8f60" stroke-width="'+(data.shape==="kerfs"?"2":"1.5")+'"/>';
        }
      }
      for(let i=0;i<marks.length;i+=tick){
        const p=marks[i],px=x(p.x);
        content+='<line x1="'+px+'" y1="'+base+'" x2="'+px+'" y2="'+(base+9)+'" stroke="#1e6454"/>';
        if(marks.length<=24||i%Math.max(tick,2)===0)content+=svgText(px-10,base+27,p.label?String(p.label).slice(0,9):trim(convertFromInches(p.x,unit),1),"tick-label");
      }
      content+=svgText(left,319,"0 "+unit,"dim-label")+svgText(right-96,319,fmt(span),"dim-label");
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
      const n=Math.max(2,data.risers),dx=W/(n-1),dy=180/n;
      let stair="M"+left+" "+base;
      for(let i=0;i<n;i++){
        const py=base-(i+1)*dy,px=left+i*dx;
        stair+=" V"+py;
        if(i<n-1)stair+=" H"+(left+(i+1)*dx);
      }
      const upper=base-n*dy;
      const lowerLine=base+24,upperLine=upper+80;
      content+='<path d="'+stair+' L'+right+' '+upperLine+' L'+left+' '+lowerLine+' Z" fill="#e3c9a7" stroke="#3b745f" stroke-width="2.4" stroke-linejoin="round"/>';
      content+='<path d="M'+left+' '+lowerLine+' L'+right+' '+upperLine+'" fill="none" stroke="#a88157" stroke-dasharray="6 5" stroke-width="2"/>';
      content+=svgText(left+12,55,n+" risers / "+(n-1)+" treads","dim-label");
      content+=svgText(left+12,320,"bottom riser layout "+fmt(data.bottomLayoutRise),"dim-label");
      content+=svgText(right-260,320,"nominal throat "+fmt(data.throat),"dim-label");
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
    }else if(data.shape==="rectangle"||data.shape==="roof"){
      content+='<rect x="235" y="73" width="465" height="195" fill="#e4ebe2" stroke="#1e6454" stroke-width="3"/>';
      if(data.shape==="roof")content+='<path d="M235 170 L333 73 M235 170 L333 268 M700 170 L602 73 M700 170 L602 268 M333 170 L602 170" stroke="#b27f49" stroke-width="2.5" fill="none"/>';
      else content+='<line x1="235" y1="73" x2="700" y2="268" stroke="#b27f49" stroke-width="2.5"/>';
    }else if(data.shape==="ring"){
      const seg=data.segments||12,R=104,cx=467,cy=166,r=R*(data.inner||1)/(data.outer||2);
      for(let i=0;i<seg;i++){const a1=i*2*Math.PI/seg-Math.PI/2,a2=(i+1)*2*Math.PI/seg-Math.PI/2;
        const p=(radius,a)=>[cx+radius*Math.cos(a),cy+radius*Math.sin(a)];
        const [x1,y1]=p(R,a1),[x2,y2]=p(R,a2),[x3,y3]=p(r,a2),[x4,y4]=p(r,a1);
        content+='<path d="M'+x1+','+y1+' A'+R+','+R+' 0 0,1 '+x2+','+y2+' L'+x3+','+y3+' A'+r+','+r+' 0 0,0 '+x4+','+y4+' Z" fill="'+(i%2?"#dfb989":"#c9945f")+'" stroke="#704f2d"/>';
      }
    }else if(data.shape==="angles"){
      const cx=460,cy=200;
      content+='<path d="M300 240 L650 240 M460 240 L630 85" stroke="#1e6454" stroke-width="5" fill="none"/><path d="M515 240 A55 55 0 0 0 500 199" stroke="#c58c54" stroke-width="3" fill="none"/>';
      content+=svgText(510,177,trim(data.miter,2)+"° miter","dim-label")+svgText(360,285,trim(data.bevel,2)+"° bevel","dim-label");
    }
    const title=esc(tool.title),label=esc("All diagram dimensions in "+({in:"inches",ft:"feet",mm:"millimeters",cm:"centimeters",m:"meters"}[unit]||"inches"));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 344" role="img" aria-label="'+title+' scaled schematic based on calculated values"><title>'+title+'</title><desc>'+label+'; illustrative geometry, not a one-to-one cutting template</desc><style>.gridline{stroke:#dbe1d9;stroke-width:1}.axis{stroke:#385f4d;stroke-width:2}.tick-label{font:12px ui-monospace,monospace;fill:#36574e}.dim-label{font:15px ui-monospace,monospace;fill:#203b33}</style><rect width="900" height="344" fill="#fcfbf8"/>'+grid+content+'</svg>';
  }
  const save=(name,content,type)=>{
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  };
  function render(){
    try{
      const data=safeCompute(slug,values());
      if(!data.ok)throw new Error(data.error);
      latest=data.data;error.hidden=true;
      out.innerHTML=latest.metrics.map((m,i)=>'<article class="metric '+(i===0?"main-metric":"")+'"><span>'+esc(m.label)+'</span><strong>'+esc(fmt(m.value,m.kind))+'</strong>'+(m.kind==="L"&&unit==="in"?'<small>≈ '+esc(frac(m.value))+'</small>':"")+'</article>').join("");
      cut.innerHTML=latest.rows.length?
        '<thead><tr>'+Object.keys(latest.rows[0]).map(k=>'<th scope="col">'+esc(k.replace(/([A-Z])/g," $1"))+'</th>').join("")+'</tr></thead><tbody>'+latest.rows.slice(0,160).map(row=>'<tr>'+Object.entries(row).map(([k,v])=>'<td>'+esc(v===null?"—":typeof v==="number"&&!["count"].includes(k)&&!k.toLowerCase().includes("angle")?fmt(v):v)+'</td>').join("")+'</tr>').join("")+'</tbody>':
        '<tbody><tr><td>Calculated dimensions are shown above. No repeating cut list for this geometry.</td></tr></tbody>';
      diagram.innerHTML=drawing(latest);diagram.querySelector("svg")?.style.setProperty("width",zoom*100+"%");
      document.querySelector("#print-assumptions").textContent=tool.limit;
      status.textContent="Updated from your measurements.";
    }catch(e){latest=null;error.hidden=false;error.textContent=e.message;out.innerHTML='<p class="empty-result">Fix an input to view the calculated results.</p>';cut.innerHTML="";diagram.innerHTML="";status.textContent="Calculation requires correction.";}
  }
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
  form.addEventListener("input",render);fraction.addEventListener("change",render);
  reset.addEventListener("click",()=>{restoreValues();zoom=1;render();});
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
    const keys=Object.keys(rows[0]);const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
    const text=[keys.map(quote).join(","),...rows.map(r=>keys.map(k=>quote(typeof r[k]==="number"&&k!=="count"?fmt(r[k]):r[k])).join(","))].join("\r\n");
    save(slug+"-"+unit+"-cut-list.csv","\uFEFF"+text+"\r\n"+'"Source note","'+tool.limit.replace(/"/g,'""')+'"',"text/csv;charset=utf-8");
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
