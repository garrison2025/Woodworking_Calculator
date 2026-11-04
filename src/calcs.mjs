// All geometry is calculated in inches and degrees. No network or structural-code input.
const PI=Math.PI, rad=d=>d*PI/180,deg=r=>r*180/PI;
const need=(condition,message)=>{if(!condition)throw new RangeError(message)};
const metric=(label,value,kind="L")=>({label,value,kind});
const point=(x,label="",role="mark")=>({x,label,role});
const result=(metrics,marks=[],span=1,rows=[],shape="ruler",extra={})=>{
  if(!Array.isArray(rows)||!Array.isArray(marks)||typeof shape!=="string")throw new TypeError("Invalid calculator layout contract");
  return {metrics,marks,span,rows,shape,...extra};
};
const positions=(length,spacing)=>{
  need(length>0&&spacing>0,"Length and spacing must be positive.");
  const count=Math.ceil(length/spacing);
  need(count<=1200,"Too many layout marks; increase spacing.");
  const xs=Array.from({length:count},(_,i)=>i*spacing).filter(x=>x<length-1e-7);
  if(!xs.length||xs[0]!==0)xs.unshift(0);
  xs.push(length);
  return xs;
};
const q=(x)=>Math.round(x*1e8)/1e8;
export const convertToInches=(value,units)=>units==="mm"?value/25.4:value;
export const convertFromInches=(value,units)=>units==="mm"?value*25.4:value;
export function compute(slug,a){
  a={opening2Start:0,opening2Width:0,opening3Start:0,opening3Width:0,...a};
  need(Object.values(a).every(v=>Number.isFinite(v)&&Math.abs(v)<1e8),"Enter finite measurements within the supported range.");
  const positive=(...ks)=>ks.forEach(k=>need(a[k]>0,k+" must be greater than zero."));
  const nonnegative=(...ks)=>ks.forEach(k=>need(a[k]>=0,k+" cannot be negative."));
  const whole=(k,min=1,max=500)=>need(Number.isInteger(a[k])&&a[k]>=min&&a[k]<=max,k+" must be a whole number between "+min+" and "+max+".");
  const M=metric,P=point;
  let xs,rows,g,n,span;
  switch(slug){
  case "stud-calculator":{
    positive("length","start","spacing");nonnegative("pitch","plates");
    xs=positions(a.length,a.spacing);
    rows=xs.map((x,i)=>({item:"Stud "+(i+1),position:q(x),length:q(a.start+x*a.pitch/12-a.plates)}));
    need(rows.every(r=>r.length>0),"Plate deductions exceed a stud length.");
    return result([M("Stud positions",rows.length,"N"),M("First cut length",rows[0].length),M("Last cut length",rows.at(-1).length),M("Top cut angle",deg(Math.atan(a.pitch/12)),"A")],xs.map((x,i)=>P(x,String(i+1))),a.length,rows,"slope",{rise:a.length*a.pitch/12,start:a.start,boardHeight:a.start+a.length*a.pitch/12});
  }
  case "framing-calculator":{
    positive("length","spacing","width","openingWidth","openingHeight");
    nonnegative("openingStart","opening2Start","opening2Width","opening3Start","opening3Width");
    const openings=[
      {start:a.openingStart,width:a.openingWidth,label:"Opening 1"},
      {start:a.opening2Start,width:a.opening2Width,label:"Opening 2"},
      {start:a.opening3Start,width:a.opening3Width,label:"Opening 3"}
    ].filter(o=>o.width>0).map(o=>({...o,end:o.start+o.width})).sort((u,v)=>u.start-v.start);
    for(let i=0;i<openings.length;i++){
      const o=openings[i];
      need(o.start>0&&o.end<a.length,"Every opening must fit inside solid wall end margins.");
      if(i>0)need(o.start>openings[i-1].end,"Openings must not overlap or share a boundary.");
    }
    xs=positions(a.length,a.spacing).filter(x=>!openings.some(o=>x>o.start&&x<o.end));
    const studRows=xs.map((x,i)=>({item:"Regular "+(i+1),position:q(x),length:null}));
    for(const o of openings){
      for(const [name,x] of [
        ["King left",Math.max(0,o.start-a.width)],["Jack left",o.start],
        ["Jack right",o.end],["King right",Math.min(a.length,o.end+a.width)]
      ])studRows.push({item:o.label+" "+name,position:q(x),length:null});
    }
    studRows.sort((u,v)=>u.position-v.position);
    return result([
      M("Regular studs",xs.length,"N"),M("Opening intervals",openings.length,"N"),
      M("Opening-side reference members",openings.length*4,"N"),
      M("Total listed pieces",studRows.length,"N")
    ],studRows.map(r=>P(r.position,r.item,r.item.includes("King")||r.item.includes("Jack")?"accent":"mark")),
    a.length,studRows,"opening",{openings});
  }
  case "deck-board-calculator":{
    positive("width","length","board","stock");nonnegative("gap","waste");
    need(a.waste<=200,"Waste allowance is unreasonably large.");
    n=Math.ceil((a.width+a.gap)/(a.board+a.gap));
    need(n<=1200,"Too many rows to display.");const last=a.width-(n-1)*(a.board+a.gap);
    need(last>0&&last<=a.board+1e-7,"Board width/gap combination is invalid.");
    const linear=n*a.length;
    const conservativeOrder=Math.ceil(n*Math.ceil(a.length/a.stock)*(1+a.waste/100));
    rows=Array.from({length:n},(_,i)=>({item:"Row "+(i+1),position:q(i*(a.board+a.gap)),length:q(a.length),ripWidth:q(i===n-1?last:a.board)}));
    return result([M("Board rows",n,"N"),M("Last rip width",last),M("Installed linear footage",linear/12,"FT"),M("Stock pieces: no offcut reuse",conservativeOrder,"N")],rows.map(r=>P(r.position,r.item)),a.width,rows,"boards",{boardWidth:a.board,lastWidth:last});
  }
  case "baluster-spacing-calculator":{
    positive("length","width","gap");
    n=Math.max(1,Math.ceil((a.length-a.gap)/(a.width+a.gap)));
    need(n<=500&&n*a.width<=a.length,"Balusters cannot fit in the opening.");
    g=(a.length-n*a.width)/(n+1);need(g>=-1e-8&&g<=a.gap+1e-7,"No feasible spacing.");
    xs=Array.from({length:n},(_,i)=>g+(i*(a.width+g))+a.width/2);
    rows=xs.map((x,i)=>({item:"Baluster "+(i+1),center:q(x),clearGap:q(g)}));
    return result([M("Baluster count",n,"N"),M("Equal clear gap",g),M("Center pitch",a.width+g),M("Edge gap",g)],xs.map((x,i)=>P(x,String(i+1))),a.length,rows,"balusters",{itemWidth:a.width});
  }
  case "rafter-calculator":{
    positive("run","depth");nonnegative("pitch","ridge","overhang","seat");
    need(a.ridge<2*a.run,"Ridge thickness must be less than the full span.");
    need(a.seat<a.run&&a.seat*a.pitch/12<a.depth,"Birdsmouth reference exceeds the stated rafter section.");
    const run=a.run-a.ridge/2,rise=run*a.pitch/12,line=Math.hypot(run,rise),over=Math.hypot(a.overhang,a.overhang*a.pitch/12),heel=a.seat*a.pitch/12;
    return result([M("Adjusted run",run),M("Rise",rise),M("Rafter reference length",line),M("Overhang slope length",over),M("Plumb cut angle",deg(Math.atan(a.pitch/12)),"A"),M("Seat reference drop",heel)],[],run,[],"triangle",{rise,run,seat:a.seat,stockDepth:a.depth});
  }
  case "crown-molding-calculator":{
    positive("spring","corner");need(a.spring<90&&a.corner<180&&a.corner>0,"Angles must be between 0 and their geometric limits.");whole("inside",0,1);whole("left",0,1);
    const spring=rad(a.spring),half=rad(a.corner/2),miter=deg(Math.atan(Math.sin(spring)/Math.tan(half))),bevel=deg(Math.asin(Math.cos(spring)*Math.cos(half)));
    const sign=((a.inside===1)===(a.left===1))?1:-1;
    return result([M("Miter magnitude",miter,"A"),M("Bevel magnitude",bevel,"A"),M("Diagram miter sign",sign*miter,"A"),M("Wall corner",a.corner,"A")],[],100,[],"angles",{miter,bevel,inside:!!a.inside,left:!!a.left});
  }
  case "soffit-calculator":{
    positive("projection");nonnegative("pitch","lining","depth");need(Math.abs(a.fasciaOffset)<1000,"Reference offset out of range.");
    const drop=a.projection*a.pitch/12, adjusted=drop+a.fasciaOffset+a.lining;
    need(adjusted>=0,"Offsets produce a negative final drop; review the reference plane.");
    return result([M("Nominal roof-line drop",drop),M("Specified reference drop",adjusted),M("Roof-line length",Math.hypot(a.projection,drop)),M("Pitch angle",deg(Math.atan(a.pitch/12)),"A")],[],a.projection,[],"triangle",{rise:drop,run:a.projection});
  }
  case "kerf-bending-calculator":{
    positive("radius","angle","thickness","kerf");nonnegative("web");need(a.angle<=360,"Bend angle must not exceed 360°.");need(a.web<a.thickness,"Retained web must be thinner than stock.");
    const depth=a.thickness-a.web,turn=2*Math.atan(a.kerf/(2*depth)),arc=a.radius*rad(a.angle),count=Math.ceil(rad(a.angle)/turn);
    need(count<=500&&count>=1,"Required cut count is outside supported trial layout.");
    const spacing=arc/count;xs=Array.from({length:count},(_,i)=>(i+.5)*spacing);
    rows=xs.map((x,i)=>({item:"Kerf "+(i+1),position:q(x),cutDepth:q(depth)}));
    return result([M("Arc length",arc),M("Proposed cuts",count,"N"),M("Proposed spacing",spacing),M("Saw depth",depth),M("Estimated closure / cut",deg(turn),"A")],xs.map(x=>P(x)),arc,rows,"kerfs",{angle:a.angle});
  }
  case "wainscoting-calculator":{
    positive("wall","height");nonnegative("margin","gap");whole("panels");
    const available=a.wall-2*a.margin-(a.panels-1)*a.gap,width=available/a.panels;
    need(width>0,"Margins and gaps leave no usable panel width.");
    rows=Array.from({length:a.panels},(_,i)=>({item:"Panel "+(i+1),left:q(a.margin+i*(width+a.gap)),width:q(width),height:q(a.height)}));
    return result([M("Panel width",width),M("Panel count",a.panels,"N"),M("Total panel face width",width*a.panels),M("Panel height",a.height)],rows.map(r=>P(r.left+r.width/2,r.item)),a.wall,rows,"panels",{panelWidth:width,panelHeight:a.height});
  }
  case "stair-calculator":{
    positive("rise","desired","tread");const risers=Math.ceil(a.rise/a.desired);need(risers>=2&&risers<=200,"Stair count outside supported range.");
    const treads=risers-1,h=a.rise/risers;
    rows=Array.from({length:risers},(_,i)=>({item:"Riser "+(i+1),rise:q((i+1)*h),run:q(Math.min(i,treads)*a.tread)}));
    return result([M("Risers",risers,"N"),M("Treads",treads,"N"),M("Actual riser height",h),M("Horizontal run",treads*a.tread),M("Incline",deg(Math.atan(h/a.tread)),"A")],rows.map(r=>P(r.run,r.item)),Math.max(treads*a.tread,1),rows,"stairs",{stepRise:h,tread:a.tread,risers});
  }
  case "rise-run-calculator":{
    positive("run");nonnegative("rise");
    const angle=deg(Math.atan2(a.rise,a.run)),hyp=Math.hypot(a.rise,a.run);
    return result([M("Slope length",hyp),M("Slope angle",angle,"A"),M("Pitch / 12",12*a.rise/a.run,"P"),M("Grade",100*a.rise/a.run,"D")],[],a.run,[],"triangle",{rise:a.rise,run:a.run});
  }
  case "deck-material-calculator":{
    positive("width","length","board","joists");nonnegative("gap","waste");need(a.waste<=200,"Waste must be 0–200%.");
    const boards=Math.ceil((a.width+a.gap)/(a.board+a.gap)),joists=Math.ceil(a.length/a.joists)+1,area=a.width*a.length;
    return result([M("Deck area",area/144,"FT2"),M("Deck rows",boards,"N"),M("Estimated joist lines",joists,"N"),M("Linear decking",boards*a.length/12,"FT"),M("Decking with waste",boards*a.length*(1+a.waste/100)/12,"FT")],positions(a.width,a.board+a.gap).map(x=>P(x)),a.width,[],"boards",{boardWidth:a.board});
  }
  case "segmented-bowl-calculator":{
    positive("outer","inner");whole("segments",3,180);whole("rings",1,100);need(a.inner<a.outer,"Inner diameter must be less than outer diameter.");
    const theta=PI/a.segments,outerChord=a.outer*Math.sin(theta),innerChord=a.inner*Math.sin(theta);
    return result([M("Segment half-miter",180/a.segments,"A"),M("Outer chord",outerChord),M("Inner chord",innerChord),M("Segment radial depth",(a.outer-a.inner)/2),M("Total segments",a.segments*a.rings,"N")],[],a.outer,[],"ring",{segments:a.segments,inner:a.inner,outer:a.outer});
  }
  case "roof-pitch-calculator":{
    nonnegative("pitch");positive("run");const rise=a.run*a.pitch/12,angle=deg(Math.atan(a.pitch/12));
    return result([M("Roof angle",angle,"A"),M("Percentage grade",a.pitch/12*100,"D"),M("Rise over reference run",rise),M("Slope line",Math.hypot(a.run,rise))],[],a.run,[],"triangle",{rise,run:a.run});
  }
  case "equal-spacing-calculator":{
    positive("length");nonnegative("left","right");whole("count");
    need(a.left+a.right<a.length,"Offsets consume the available length.");
    const p=a.count===1?0:(a.length-a.left-a.right)/(a.count-1);
    xs=Array.from({length:a.count},(_,i)=>a.count===1?(a.left+a.length-a.right)/2:a.left+i*p);
    rows=xs.map((x,i)=>({item:"Center "+(i+1),position:q(x)}));
    return result([M("Centers",a.count,"N"),M("Equal center interval",p),M("Usable length",a.length-a.left-a.right)],xs.map(x=>P(x)),a.length,rows);
  }
  case "hip-rafter-calculator":{
    positive("runX","runY");nonnegative("pitch");
    const plan=Math.hypot(a.runX,a.runY),rise=a.runY*a.pitch/12;
    return result([M("Plan diagonal",plan),M("Vertical rise",rise),M("Hip line length",Math.hypot(plan,rise)),M("Plan hip angle",deg(Math.atan2(a.runY,a.runX)),"A")],[],plan,[],"triangle",{rise,run:plan});
  }
  case "hip-roof-calculator":{
    positive("width","length","sheetWidth","sheetLength");nonnegative("pitch","overhang");
    const W=a.width+2*a.overhang,L=a.length+2*a.overhang,small=Math.min(W,L),large=Math.max(W,L),factor=Math.hypot(1,a.pitch/12),area=W*L*factor,ridge=large-small;
    const endArea=(small*small/4)*factor,sideArea=((large*small/2)-(small*small/4))*factor;
    const sheets=Math.ceil(area/(a.sheetWidth*a.sheetLength));
    return result([M("Ridge length",ridge),M("Whole sloped area",area/144,"FT2"),M("Each hip-end plane",endArea/144,"FT2"),M("Each long-side plane",sideArea/144,"FT2"),M("Sheet area lower bound",sheets,"N")],[],large,[],"roof",{roofWidth:W,roofLength:L});
  }
  case "wall-stud-calculator":{
    positive("length","spacing","height");nonnegative("plates");need(a.height>a.plates,"Plate deduction leaves no cut length.");
    xs=positions(a.length,a.spacing);rows=xs.map((x,i)=>({item:"Stud "+(i+1),position:q(x),cutLength:q(a.height-a.plates)}));
    return result([M("Stud count",xs.length,"N"),M("Cut length",a.height-a.plates),M("Final bay size",xs.at(-1)-xs.at(-2))],xs.map(x=>P(x)),a.length,rows);
  }
  case "shelf-spacing-calculator":{
    positive("height","thickness");nonnegative("top","bottom");whole("shelves");
    const gap=(a.height-a.shelves*a.thickness-a.top-a.bottom)/(a.shelves+1);
    need(gap>=0,"Shelf thickness and clearances exceed the case.");
    rows=Array.from({length:a.shelves},(_,i)=>({item:"Shelf "+(i+1),bottom:q(a.bottom+gap*(i+1)+a.thickness*i)}));
    return result([M("Equal clear gap",gap),M("Shelf count",a.shelves,"N"),M("Shelf stack thickness",a.shelves*a.thickness)],rows.map(r=>P(r.bottom,r.item)),a.height,rows,"shelves");
  }
  case "gable-roof-calculator":{
    positive("width","length");nonnegative("pitch","overhang");
    const run=a.width/2+a.overhang,rise=run*a.pitch/12,line=Math.hypot(run,rise),roofLen=a.length+2*a.overhang;
    return result([M("Half-span run",run),M("Roof rise",rise),M("Each slope length",line),M("Total roof surface",2*line*roofLen/144,"FT2")],[],run,[],"triangle",{run,rise});
  }
  case "square-layout-calculator":{
    positive("width","length","measuredA","measuredB");
    const d=Math.hypot(a.width,a.length);
    return result([M("Ideal right-angle diagonal",d),M("Diagonal A error",a.measuredA-d),M("Diagonal B error",a.measuredB-d),M("Difference between measured diagonals",Math.abs(a.measuredA-a.measuredB))],[],a.length,[],"rectangle",{rectWidth:a.width,rectHeight:a.length});
  }
  case "diagonal-brace-calculator":{
    positive("width","height");nonnegative("setback");
    const d=Math.hypot(a.width,a.height);need(2*a.setback<d,"Total cut setbacks exceed brace length.");
    return result([M("Full centerline",d),M("After end setbacks",d-2*a.setback),M("Brace angle",deg(Math.atan2(a.height,a.width)),"A")],[],a.width,[],"triangle",{rise:a.height,run:a.width});
  }
  case "hole-spacing-calculator":{
    positive("length","diameter");nonnegative("edge");whole("holes",2,500);
    need(a.edge>=a.diameter/2&&2*a.edge<a.length,"Hole edges extend outside stock.");
    g=(a.length-2*a.edge)/(a.holes-1);need(g>=a.diameter,"Holes overlap at the requested count.");
    xs=Array.from({length:a.holes},(_,i)=>a.edge+i*g);
    rows=xs.map((x,i)=>({item:"Hole "+(i+1),center:q(x),diameter:q(a.diameter)}));
    return result([M("Hole center pitch",g),M("Hole count",a.holes,"N"),M("Edge offset",a.edge)],xs.map((x,i)=>P(x,String(i+1))),a.length,rows,"holes",{holeDiameter:a.diameter});
  }
  case "stair-stringer-calculator":{
    positive("rise","tread","depth");whole("risers",2,200);
    const h=a.rise/a.risers,run=(a.risers-1)*a.tread;
    need(h>0&&a.depth>h/2,"Available stringer depth should be reviewed relative to its cut shape.");
    rows=Array.from({length:a.risers},(_,i)=>({item:"Step corner "+(i+1),run:q(Math.min(i,a.risers-1)*a.tread),rise:q((i+1)*h)}));
    return result([M("Uniform riser height",h),M("Treads",a.risers-1,"N"),M("Total horizontal run",run),M("Stringer diagonal",Math.hypot(run,a.rise))],rows.map(r=>P(r.run)),Math.max(run,1),rows,"stairs",{stepRise:h,tread:a.tread,risers:a.risers});
  }
  case "roof-sheathing-calculator":{
    positive("width","length","sheetWidth","sheetLength");nonnegative("pitch","waste");need(a.waste<=200,"Waste must be 0–200%.");
    const area=a.width*a.length*Math.hypot(1,a.pitch/12),per=a.sheetWidth*a.sheetLength,minimum=Math.ceil(area/per),ordered=Math.ceil(area*(1+a.waste/100)/per);
    return result([M("Sloped roof surface",area/144,"FT2"),M("Sheet geometric lower bound",minimum,"N"),M("With percent allowance",ordered,"N"),M("Sheet face area",per/144,"FT2")],[],a.length,[],"rectangle",{rectWidth:a.width,rectHeight:a.length});
  }
  case "fence-post-calculator":{
    positive("length","bay","post");need(a.post<a.length,"Post wider than run.");
    const bays=Math.ceil(a.length/a.bay);need(bays<=500,"Too many bays.");
    const interval=a.length/bays;xs=Array.from({length:bays+1},(_,i)=>i*interval);
    rows=xs.map((x,i)=>({item:"Post "+(i+1),center:q(x)}));
    return result([M("Bays",bays,"N"),M("Posts",bays+1,"N"),M("True OC interval",interval),M("Approximate clear bay",interval-a.post)],xs.map(x=>P(x)),a.length,rows,"posts",{itemWidth:a.post});
  }
  default:throw new Error("Calculator not implemented: "+slug);
  }
}
export function safeCompute(slug,inputs){try{return {ok:true,data:compute(slug,inputs)}}catch(err){return {ok:false,error:err instanceof Error?err.message:"Calculation failed"}}}
