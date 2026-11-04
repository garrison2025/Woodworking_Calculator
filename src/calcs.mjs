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
  const count=ceilStable(length/spacing);
  need(count<=1200,"Too many layout marks; increase spacing.");
  const xs=Array.from({length:count},(_,i)=>i*spacing).filter(x=>x<length-1e-7);
  if(!xs.length||xs[0]!==0)xs.unshift(0);
  xs.push(length);
  return xs;
};
const q=(x)=>Math.round(x*1e8)/1e8;
// Eliminate floating-point false extra rows at exact dimension ratios (e.g. 105/7.5 after unit conversion).
const ceilStable=(x)=>Math.abs(x-Math.round(x))<=1e-10?Math.round(x):Math.ceil(x);

function roofPolygonArea(poly){
  if(poly.length<3)return 0;
  return Math.abs(poly.reduce((sum,p,i)=>{
    const n=poly[(i+1)%poly.length];return sum+p[0]*n[1]-n[0]*p[1];
  },0))/2;
}
function roofClipPolygon(poly,u0,v0,u1,v1){
  const clip=(pts,axis,bound,lower)=>{
    const inside=p=>lower?p[axis]>=bound-1e-10:p[axis]<=bound+1e-10;
    const intersect=(a,b)=>{
      const t=(bound-a[axis])/(b[axis]-a[axis]);
      return [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
    };
    const out=[];
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length],ia=inside(a),ib=inside(b);
      if(ia&&ib)out.push(b);
      else if(ia&&!ib)out.push(intersect(a,b));
      else if(!ia&&ib)out.push(intersect(a,b),b);
    }
    return out;
  };
  let result=poly;
  for(const [axis,bound,lower] of [[0,u0,true],[0,u1,false],[1,v0,true],[1,v1,false]]){
    if(result.length<3)return [];
    result=clip(result,axis,bound,lower);
  }
  return result;
}
// Each clipped position consumes a separate sheet. No reuse, staggering, or structural joint design.
function layoutHipSheets(major,minor,factor,sheetAlong,sheetUphill){
  const h=minor*factor/2;
  const side=[[0,0],[major,0],[major-minor/2,h],[minor/2,h]];
  const end=[[0,0],[minor,0],[minor/2,h]];
  const planes=[
    {name:"North slope",poly:side,toPlan:(u,v)=>[u,v/factor]},
    {name:"South slope",poly:side,toPlan:(u,v)=>[u,minor-v/factor]},
    {name:"West hip",poly:end,toPlan:(u,v)=>[v/factor,u]},
    {name:"East hip",poly:end,toPlan:(u,v)=>[major-v/factor,u]}
  ];
  const panels=[];
  for(const [idx,plane] of planes.entries()){
    const cols=ceilStable(Math.max(...plane.poly.map(p=>p[0]))/sheetAlong);
    const rows=ceilStable(Math.max(...plane.poly.map(p=>p[1]))/sheetUphill);
    need(cols>=1&&rows>=1&&cols*rows<=900,"Roof sheet grid is too dense; enter a larger sheet or smaller roof.");
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const u0=col*sheetAlong,v0=row*sheetUphill;
      const clipped=roofClipPolygon(plane.poly,u0,v0,u0+sheetAlong,v0+sheetUphill);
      const area=roofPolygonArea(clipped);
      if(area<=1e-9)continue;
      panels.push({
        id:"S"+(panels.length+1),plane:plane.name,planeIndex:idx,
        eaveOffset:q(u0),slopeOffset:q(v0),cutAreaSqIn:area,
        localVertices:clipped.map(p=>[q(p[0]-u0),q(p[1]-v0)]),
        planPoints:clipped.map(p=>plane.toPlan(p[0],p[1]).map(q))
      });
      need(panels.length<=900,"Over 900 roof sheet positions; simplify the layout.");
    }
  }
  return panels;
}

const unitToInches={in:1,ft:12,mm:1/25.4,cm:10/25.4,m:1000/25.4};
export const convertToInches=(value,units)=>value*(unitToInches[units]??1);
export const convertFromInches=(value,units)=>value/(unitToInches[units]??1);
export function compute(slug,a){
  a={wallHeight:96,openingSill:0,opening2Start:0,opening2Width:0,opening2Height:40,opening2Sill:36,opening3Start:0,opening3Width:0,opening3Height:40,opening3Sill:36,orientation:0,...a};
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
    positive("length","spacing","width","wallHeight","openingWidth","openingHeight");
    nonnegative("openingStart","openingSill","opening2Start","opening2Width","opening2Sill","opening3Start","opening3Width","opening3Sill");
    const openings=[
      {start:a.openingStart,width:a.openingWidth,height:a.openingHeight,sill:a.openingSill,label:"Opening 1"},
      {start:a.opening2Start,width:a.opening2Width,height:a.opening2Height,sill:a.opening2Sill,label:"Opening 2"},
      {start:a.opening3Start,width:a.opening3Width,height:a.opening3Height,sill:a.opening3Sill,label:"Opening 3"}
    ].filter(o=>o.width>0).map(o=>({...o,end:o.start+o.width,top:o.sill+o.height})).sort((u,v)=>u.start-v.start);
    for(let i=0;i<openings.length;i++){
      const o=openings[i];
      need(o.start>2.5*a.width&&o.end<a.length-2.5*a.width,"Opening margins must accommodate king/jack reference studs and wall endpoints.");
      need(o.height>0&&o.sill>=0&&o.top<a.wallHeight,"Opening sill and height must fit below the wall top.");
      if(i>0)need(o.start-openings[i-1].end>=4*a.width,"Adjacent openings need room for both side-member packs.");
    }
    // Reference coordinates denote stud centers, not material-cut lengths.
    xs=positions(a.length,a.spacing).filter(x=>!openings.some(o=>x>=o.start-2*a.width-1e-8&&x<=o.end+2*a.width+1e-8));
    const studRows=xs.map((x,i)=>({item:"Regular "+(i+1),position:q(x),referenceTop:q(a.wallHeight)}));
    for(const o of openings){
      for(const [name,x,topHeight] of [
        ["King left",o.start-1.5*a.width,a.wallHeight],
        ["Jack left",o.start-.5*a.width,o.top],
        ["Jack right",o.end+.5*a.width,o.top],
        ["King right",o.end+1.5*a.width,a.wallHeight]
      ])studRows.push({item:o.label+" "+name,position:q(x),referenceTop:q(topHeight)});
    }
    studRows.sort((u,v)=>u.position-v.position);
    const roughArea=openings.reduce((sum,o)=>sum+o.width*o.height,0)/144;
    return result([
      M("Regular studs",xs.length,"N"),M("Opening intervals",openings.length,"N"),
      M("Opening-side reference members",openings.length*4,"N"),
      M("Total listed pieces",studRows.length,"N"),
      M("Wall reference height",a.wallHeight),M("Rough opening face area",roughArea,"FT2"),
      ...openings.map(o=>M(o.label+" top elevation",o.top))
    ],studRows.map(r=>({...P(r.position,r.item,r.item.includes("King")?"king":r.item.includes("Jack")?"jack":"mark"),topHeight:r.referenceTop})),
    a.length,studRows,"opening",{openings,wallHeight:a.wallHeight});
  }
  case "deck-board-calculator":{
    positive("width","length","board","stock");nonnegative("gap","waste");
    need(a.waste<=200,"Waste allowance is unreasonably large.");
    n=ceilStable((a.width+a.gap)/(a.board+a.gap));
    need(n<=1200,"Too many rows to display.");const last=a.width-(n-1)*(a.board+a.gap);
    need(last>0&&last<=a.board+1e-7,"Board width/gap combination is invalid.");
    const linear=n*a.length;
    const conservativeOrder=ceilStable(n*ceilStable(a.length/a.stock)*(1+a.waste/100));
    rows=Array.from({length:n},(_,i)=>({item:"Row "+(i+1),position:q(i*(a.board+a.gap)),length:q(a.length),ripWidth:q(i===n-1?last:a.board)}));
    return result([M("Board rows",n,"N"),M("Last rip width",last),M("Installed linear footage",linear/12,"FT"),M("Stock pieces: no offcut reuse",conservativeOrder,"N")],rows.map(r=>P(r.position,r.item)),a.width,rows,"boards",{boardWidth:a.board,lastWidth:last});
  }
  case "baluster-spacing-calculator":{
    positive("length","width","gap");
    n=Math.max(1,ceilStable((a.length-a.gap)/(a.width+a.gap)));
    need(n<=500&&n*a.width<=a.length,"Balusters cannot fit in the opening.");
    g=(a.length-n*a.width)/(n+1);need(g>=-1e-8&&g<=a.gap+1e-7,"No feasible spacing.");
    xs=Array.from({length:n},(_,i)=>g+(i*(a.width+g))+a.width/2);
    rows=xs.map((x,i)=>({item:"Baluster "+(i+1),center:q(x),clearGap:q(g)}));
    return result([M("Baluster count",n,"N"),M("Equal clear gap",g),M("Center pitch",a.width+g),M("Edge gap",g)],xs.map((x,i)=>P(x,String(i+1))),a.length,rows,"balusters",{itemWidth:a.width});
  }
  case "rafter-calculator":{
    positive("run","depth");nonnegative("pitch","ridge","overhang","seat");
    need(a.ridge<2*a.run,"Ridge thickness must be less than the full span.");
    need(a.seat<a.run-a.ridge/2,"Seat reference must fit inside the ridge-adjusted horizontal run.");
    const run=a.run-a.ridge/2,slope=a.pitch/12,angle=Math.atan(slope);
    const rise=run*slope,line=Math.hypot(run,rise),over=Math.hypot(a.overhang,a.overhang*slope);
    const heel=a.seat*slope,notchNormal=a.seat*Math.sin(angle),remaining=a.depth-notchNormal;
    need(remaining>0,"The nominal seat-notch depth consumes the full rafter depth; reduce the seat or slope.");
    const schedule=[
      {item:"Ridge reference",horizontalRun:0,slopeDistance:0,verticalDrop:0},
      {item:"Bearing reference",horizontalRun:q(run),slopeDistance:q(line),verticalDrop:q(rise)},
      {item:"Overhang end",horizontalRun:q(run+a.overhang),slopeDistance:q(line+over),verticalDrop:q(rise+a.overhang*slope)}
    ];
    return result([
      M("Adjusted run",run),M("Rise",rise),M("Rafter reference length",line),
      M("Overhang slope length",over),M("Total slope to tail",line+over),
      M("Plumb cut angle",deg(angle),"A"),M("Seat reference drop",heel),
      M("Seat notch (normal depth)",notchNormal),M("Remaining stock (normal)",remaining),
      M("Notch / stock depth",100*notchNormal/a.depth,"D")
    ],schedule.map(r=>P(r.horizontalRun,r.item)),run+a.overhang,schedule,"rafter",
    {rise,run,seat:a.seat,overhang:a.overhang,stockDepth:a.depth,notchNormal,pitch:a.pitch});
  }
  case "crown-molding-calculator":{
    positive("spring","corner");need(a.spring<90&&a.corner<180&&a.corner>0,"Angles must be between 0 and their geometric limits.");whole("inside",0,1);whole("left",0,1);
    // Flat-on-saw geometric angle MAGNITUDES use the supplied spring angle
    // convention and corner included angle. The illustrative sign below is
    // merely a chosen plan-view convention, NOT a saw rotation instruction.
    const spring=rad(a.spring),half=rad(a.corner/2);
    const miter=deg(Math.atan(Math.sin(spring)/Math.tan(half)));
    const bevel=deg(Math.asin(Math.cos(spring)*Math.cos(half)));
    const sign=((a.inside===1)===(a.left===1))?1:-1;
    rows=[{
      item:"Geometric angle reference",cornerType:a.inside===1?"Inside":"Outside",
      pieceHand:a.left===1?"Left":"Right",
      springAngle:q(a.spring),wallCornerAngle:q(a.corner),
      miterMagnitudeAngle:q(miter),bevelMagnitudeAngle:q(bevel),
      illustrativeMiterAngle:q(sign*miter)
    }];
    return result([
      M("Miter magnitude",miter,"A"),M("Bevel magnitude",bevel,"A"),
      M("Illustrative plan miter (not saw setting)",sign*miter,"A"),
      M("Wall corner",a.corner,"A")
    ],[],100,rows,"angles",{
      miter,bevel,planSign:sign,inside:!!a.inside,left:!!a.left
    });
  }
  case "soffit-calculator":{
    positive("projection");nonnegative("pitch","lining","depth");
    need(Math.abs(a.fasciaOffset)<1000,"Signed fascia adjustment exceeds the reference limit.");
    // Reference: top face of the rafter at the WALL (zero vertical drop).
    // 'depth' is perpendicular to the roof slope. For two parallel roof
    // faces at slope s, vertical separation at equal horizontal x is
    // depth * hypot(1,s), NOT depth*cos(atan(s)).
    // This defines a datum model only, not an engineered eave assembly.
    const slope=a.pitch/12,fall=a.projection*slope;
    const rafterVertical=a.depth*Math.hypot(1,slope);
    const underside=fall+rafterVertical;
    const finished=underside+a.lining+a.fasciaOffset;
    need(finished>=0,"Offsets place the finished soffit reference above the wall roof-top datum. Review the sign and reference plane.");
    rows=[
      {item:"At wall datum",horizontal:0,roofTopDrop:0,rafterUndersideDrop:q(rafterVertical),soffitFaceDrop:null},
      {item:"At eave / fascia",horizontal:q(a.projection),roofTopDrop:q(fall),rafterUndersideDrop:q(underside),soffitFaceDrop:q(finished)}
    ];
    return result([
      M("Nominal roof-line drop",fall),
      M("Vertical rafter depth at same station",rafterVertical),
      M("Eave rafter underside drop",underside),
      M("Finished soffit reference drop",finished),
      M("Roof-line length",Math.hypot(a.projection,fall)),
      M("Pitch angle",deg(Math.atan(slope)),"A")
    ],rows.map(r=>P(r.horizontal,r.item)),a.projection,rows,"soffit-section",
    {projection:a.projection,roofDrop:fall,verticalRafter:rafterVertical,
      soffitDatum:finished,stockDepth:a.depth,lining:a.lining,fasciaOffset:a.fasciaOffset});
  }
  case "kerf-bending-calculator":{
    positive("radius","angle","thickness","web","kerf");
    // Each exported kerf coordinate is quantized to 1e-8 inch. Reject
    // sub-resolution thicknesses that could appear as 0 in the cut list.
    need(a.web>=1e-7&&a.kerf>=1e-7&&a.thickness-a.web>=1e-7,
      "Kerf mouth, cut depth and continuous web must exceed the cut-coordinate resolution.");
    need(a.angle<=360,"Bend angle must not exceed 360°.");
    need(a.web<a.thickness,"Retained web must be thinner than stock.");
    // Trial-only symmetric closure model; wood springback and physical neutral axis are NOT predicted.
    const depth=a.thickness-a.web,maxClosure=2*Math.atan(a.kerf/(2*depth));
    const arc=a.radius*rad(a.angle),count=ceilStable(rad(a.angle)/maxClosure);
    need(count>=1&&count<=500,"Required cut count is outside the supported trial layout.");
    const spacing=arc/count,remaining=spacing-a.kerf;
    need(remaining>1e-8,"Kerf mouths overlap or touch along the flat reference layout. Increase radius, reduce saw kerf, or revise the stock/web geometry.");
    const planned=rad(a.angle)/count;
    xs=Array.from({length:count},(_,i)=>(i+.5)*spacing);
    rows=xs.map((x,i)=>({
      item:"Kerf "+(i+1),position:q(x),
      slotLeft:q(x-a.kerf/2),slotRight:q(x+a.kerf/2),
      cutDepth:q(depth),retainedWeb:q(a.web),maxClosureDeg:q(deg(maxClosure))
    }));
    return result([
      M("Arc length",arc),M("Proposed cuts",count,"N"),
      M("Proposed spacing",spacing),M("Uncut land between kerfs",remaining),
      M("End land before first kerf",remaining/2),
      M("Saw depth",depth),M("Retained continuous web",a.web),
      M("Estimated closure / cut",deg(maxClosure),"A"),
      M("Planned turn / cut",deg(planned),"A")
    ],xs.map(x=>P(x)),arc,rows,"kerfs",{
      angle:a.angle,kerfArcLength:arc,kerfWidth:a.kerf,
      stockThickness:a.thickness,cutDepth:depth,retainedWeb:a.web,kerfCount:count
    });
  }
  case "wainscoting-calculator":{
    positive("wall","height");nonnegative("margin","gap");whole("panels");
    const available=a.wall-2*a.margin-(a.panels-1)*a.gap,width=available/a.panels;
    need(width>0,"Margins and gaps leave no usable panel width.");
    rows=Array.from({length:a.panels},(_,i)=>({item:"Panel "+(i+1),left:q(a.margin+i*(width+a.gap)),width:q(width),height:q(a.height)}));
    return result([M("Panel width",width),M("Panel count",a.panels,"N"),M("Total panel face width",width*a.panels),M("Panel height",a.height)],rows.map(r=>P(r.left+r.width/2,r.item)),a.wall,rows,"panels",{panelWidth:width,panelHeight:a.height});
  }
  case "stair-calculator":{
    positive("rise","desired","tread");const risers=ceilStable(a.rise/a.desired);need(risers>=2&&risers<=200,"Stair count outside supported range.");
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
    positive("width","length","board","joists","stock");nonnegative("gap","waste");
    need(a.waste<=200,"Waste must be 0–200%.");
    // Surface board rows run along deck length; joist reference lines run across the width.
    // Ends include a final shortened bay. This is geometry, not a structural span design.
    const boards=ceilStable((a.width+a.gap)/(a.board+a.gap));
    const finalRip=a.width-(boards-1)*(a.board+a.gap);
    need(boards>=1&&boards<=900&&finalRip>0&&finalRip<=a.board+1e-7,"Board width or gap cannot cover this deck safely within the layout limit.");
    const joistGrid=positions(a.length,a.joists);
    need(joistGrid.length<=900,"Too many joist layout lines.");
    // Butt joints may occur only at the user-entered joist reference centers.
    // Greedily use the furthest reachable center to minimize stock pieces per
    // row within this fixed, unstaggered reference geometry. This does NOT
    // certify sufficient bearing, fasteners, double joists or safe joist spans.
    const cutEnds=[0],seamCenters=[];
    let cutStart=0;
    while(a.length-cutStart>a.stock+1e-8){
      let seam=null;
      for(const center of joistGrid){
        if(center>cutStart+1e-8&&center<a.length-1e-8&&center<=cutStart+a.stock+1e-8)seam=center;
      }
      need(seam!==null,"No intermediate joist center is reachable with this stock length. Use longer stock or closer joist centers; butt joints cannot be placed on the entered reference grid.");
      seamCenters.push(q(seam));
      cutEnds.push(q(seam));
      cutStart=seam;
      need(cutEnds.length<=900,"Too many supported deck segments; use longer stock or a shorter deck.");
    }
    cutEnds.push(a.length);
    const piecesPerRow=cutEnds.length-1;
    need(boards*piecesPerRow<=900,"Over 900 supported stock pieces are required; choose longer stock or a smaller footprint.");
    const deckRows=Array.from({length:boards},(_,i)=>({
      item:"Row "+(i+1),acrossStart:q(i*(a.board+a.gap)),
      ripWidth:q(i===boards-1?finalRip:a.board)
    }));
    const schedule=[];
    for(const row of deckRows)for(let j=0;j<piecesPerRow;j++){
      const start=cutEnds[j],end=cutEnds[j+1],segment=end-start;
      need(segment>1e-8&&segment<=a.stock+1e-7,"Supported stock segment exceeds purchased board length.");
      schedule.push({item:row.item+" piece "+(j+1),type:"Decking",
        acrossStart:row.acrossStart,alongStart:q(start),
        cutLength:q(segment),ripWidth:row.ripWidth,
        buttJointAtEnd:j<piecesPerRow-1?q(end):null,joistCenter:null});
    }
    for(const [i,x] of joistGrid.entries())schedule.push({
      item:"Joist reference "+(i+1),type:"Joist center",acrossStart:null,alongStart:null,
      cutLength:null,ripWidth:null,buttJointAtEnd:null,joistCenter:q(x)
    });
    const baseStock=boards*piecesPerRow;
    return result([
      M("Deck area",a.width*a.length/144,"FT2"),M("Deck rows",boards,"N"),
      M("Last rip width",finalRip),M("Joist reference lines",joistGrid.length,"N"),
      M("Final joist bay",joistGrid.at(-1)-joistGrid.at(-2)),
      M("Installed linear decking",boards*a.length/12,"FT"),
      M("Stock boards (no offcut reuse)",baseStock,"N"),
      M("Stock boards with allowance",ceilStable(baseStock*(1+a.waste/100)),"N"),
      M("Butt joints on joist center references",boards*seamCenters.length,"N"),
      M("Board-joist intersections",boards*joistGrid.length,"N")
    ],deckRows.map(row=>P(row.acrossStart,row.item)),a.width,schedule,"deck-plan",
    {deckWidth:a.width,deckLength:a.length,deckRows,joistGrid,seamCenters,stockLength:a.stock});
  }
  case "segmented-bowl-calculator":{
    positive("outer","inner");whole("segments",3,180);whole("rings",1,100);
    need(a.inner<a.outer,"Inner diameter must be less than outer diameter.");
    // These are finished ring diameters, not raw board dimensions: chord
    // lengths do NOT include saw kerf, oversize blanks, or glue-line allowance.
    const theta=PI/a.segments,outerChord=a.outer*Math.sin(theta),innerChord=a.inner*Math.sin(theta);
    const radial=(a.outer-a.inner)/2,miter=180/a.segments,sector=360/a.segments;
    rows=[];
    for(let ring=1;ring<=a.rings;ring++)for(let segment=1;segment<=a.segments;segment++){
      rows.push({
        item:"Ring "+ring+" / segment "+segment,
        ring,segment,
        startAngle:q((segment-1)*sector),endAngle:q(segment*sector),
        miterAngle:q(miter),
        outerChord:q(outerChord),innerChord:q(innerChord),radialDepth:q(radial)
      });
    }
    return result([
      M("Segment half-miter",miter,"A"),M("Outer chord",outerChord),
      M("Inner chord",innerChord),M("Segment radial depth",radial),
      M("Total segments",a.segments*a.rings,"N"),
      M("Segment sweep",sector,"A")
    ],[],a.outer,rows,"ring",{segments:a.segments,inner:a.inner,outer:a.outer});
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
    positive("width","length","sheetWidth","sheetLength");nonnegative("pitch","overhang");whole("orientation",0,1);
    const W=a.width+2*a.overhang,L=a.length+2*a.overhang;
    const small=Math.min(W,L),large=Math.max(W,L),factor=Math.hypot(1,a.pitch/12),area=W*L*factor,ridge=large-small;
    const endArea=(small*small/4)*factor,sideArea=((large*small/2)-(small*small/4))*factor;
    const sheetArea=a.sheetWidth*a.sheetLength,sheetAlong=a.orientation===0?a.sheetLength:a.sheetWidth,sheetUphill=a.orientation===0?a.sheetWidth:a.sheetLength;
    const panels=layoutHipSheets(large,small,factor,sheetAlong,sheetUphill);
    const tiledArea=panels.reduce((sum,p)=>sum+p.cutAreaSqIn,0);
    need(Math.abs(tiledArea-area)<=Math.max(1e-6,area*1e-8),"Roof panel clipping did not conserve the sloped area.");
    const uncut=panels.filter(p=>Math.abs(p.cutAreaSqIn-sheetArea)<=Math.max(1e-6,sheetArea*1e-8)).length;
    rows=panels.map(p=>({item:p.id,plane:p.plane,eaveOffset:p.eaveOffset,slopeOffset:p.slopeOffset,cutAreaFt2:p.cutAreaSqIn/144,cutVertices:p.localVertices}));
    return result([
      M("Ridge length",ridge),M("Whole sloped area",area/144,"FT2"),
      M("Each hip-end plane",endArea/144,"FT2"),M("Each long-side plane",sideArea/144,"FT2"),
      M("Sheet area lower bound",ceilStable(area/sheetArea),"N"),
      M("Sheet positions (no offcut reuse)",panels.length,"N"),
      M("Full rectangular sheets",uncut,"N"),M("Edge-cut sheets",panels.length-uncut,"N"),
      M("Unreused stock area",Math.max(0,panels.length*sheetArea-area)/144,"FT2")
    ],[],large,rows,"roof-panels",{roofMajor:large,roofMinor:small,roofPanels:panels,sheetAlong,sheetUphill});
  }
  case "wall-stud-calculator":{
    positive("length","spacing","height");nonnegative("plates");need(a.height>a.plates,"Plate deduction leaves no cut length.");
    xs=positions(a.length,a.spacing);rows=xs.map((x,i)=>({item:"Stud "+(i+1),position:q(x),cutLength:q(a.height-a.plates)}));
    return result([M("Stud count",xs.length,"N"),M("Cut length",a.height-a.plates),M("Final bay size",xs.at(-1)-xs.at(-2))],xs.map(x=>P(x)),a.length,rows);
  }
  case "shelf-spacing-calculator":{
    positive("height","thickness");nonnegative("top","bottom");whole("shelves");
    // Top/bottom are reserved minimum clearance, not the final equalized gaps.
    // Distribute the remaining free height equally among all n+1 spaces.
    const free=a.height-a.shelves*a.thickness-a.top-a.bottom;
    need(free>=-1e-8,"Shelf thickness and reserved clearances exceed the case height.");
    const shared=Math.max(0,free)/(a.shelves+1);
    const lower=shared+a.bottom,upper=shared+a.top;
    rows=Array.from({length:a.shelves},(_,i)=>{
      const bottom=a.bottom+shared*(i+1)+a.thickness*i;
      return {item:"Shelf "+(i+1),shelfBottom:q(bottom),shelfTop:q(bottom+a.thickness),
        clearBelow:q(i===0?lower:shared),
        clearAbove:q(i===a.shelves-1?upper:shared)};
    });
    need(rows.at(-1).shelfTop<=a.height+1e-7,"Last shelf exceeds the interior height.");
    return result([
      M("Shared base clear gap",shared),M("Actual bottom clearance",lower),
      M("Actual top clearance",upper),M("Shelf count",a.shelves,"N"),
      M("Shelf stack thickness",a.shelves*a.thickness)
    ],rows.map(r=>P(r.shelfBottom,r.item)),a.height,rows,"shelves",{shelfThickness:a.thickness});
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
    // 'edge' is the distance to the first/last CENTER, not the drilled edge.
    // The drawing describes longitudinal fit only; board face width and
    // perpendicular grain/edge margins are intentionally not inferred.
    need(a.edge>=a.diameter/2&&2*a.edge<a.length,"Hole edges extend outside stock.");
    g=(a.length-2*a.edge)/(a.holes-1);
    need(g>=a.diameter,"Holes overlap at the requested count.");
    const gap=g-a.diameter,margin=a.edge-a.diameter/2;
    xs=Array.from({length:a.holes},(_,i)=>a.edge+i*g);
    rows=xs.map((x,i)=>({
      item:"Hole "+(i+1),center:q(x),
      holeLeftEdge:q(x-a.diameter/2),holeRightEdge:q(x+a.diameter/2),
      diameter:q(a.diameter),clearToPrevious:i===0?null:q(gap)
    }));
    return result([
      M("Hole center pitch",g),M("Clear material between holes",gap),
      M("End material margin",margin),M("Hole count",a.holes,"N"),
      M("Edge offset",a.edge)
    ],xs.map((x,i)=>P(x,String(i+1))),a.length,rows,"holes",
    {holeDiameter:a.diameter,holeClearance:gap,endMaterialMargin:margin});
  }
  case "stair-stringer-calculator":{
    positive("rise","tread","depth");whole("risers",2,200);
    nonnegative("treadThickness","lowerFinish");
    const h=a.rise/a.risers,run=(a.risers-1)*a.tread;
    const normalNotch=h*a.tread/Math.hypot(h,a.tread);
    const throat=a.depth-normalNotch;
    const bottomLayoutRise=h-a.treadThickness+a.lowerFinish;
    need(throat>0,"The geometric step notch consumes the full stock depth; increase board depth or revise the stairs.");
    need(bottomLayoutRise>0,"The bottom riser cut reference is not positive; review tread and finished floor thickness.");
    // Pitch line connects first tread/upper riser reference (0,h) to the
    // upper landing (run,rise). A floor-to-floor (0,0)->(run,rise)
    // diagonal has DIFFERENT slope and is not a stringer cut length.
    const pitchRise=(a.risers-1)*h;
    const pitchLine=Math.hypot(run,pitchRise);
    const floorDiagonal=Math.hypot(run,a.rise);
    rows=Array.from({length:a.risers},(_,i)=>({
      item:i===a.risers-1?"Top landing vertical":"Riser "+(i+1),
      horizontalRun:q(i*a.tread),
      riserTopHeight:q((i+1)*h),
      treadStart:q(i*a.tread),
      treadEnd:i<a.risers-1?q((i+1)*a.tread):null
    }));
    // The SAME unadjusted (x,height) vertices drive the SVG, while the
    // bottom finish correction is a separate vertical trim reference.
    const stepVertices=[{x:0,y:0}];
    for(let i=0;i<a.risers;i++){
      const x=i*a.tread,y=(i+1)*h;
      stepVertices.push({x:q(x),y:q(y)});
      if(i<a.risers-1)stepVertices.push({x:q((i+1)*a.tread),y:q(y)});
    }
    need(stepVertices.length===2*a.risers,"Stair profile count mismatch.");
    return result([
      M("Uniform riser height",h),M("Treads",a.risers-1,"N"),
      M("Total horizontal run",run),
      M("Notch pitch-line reference",pitchLine),
      M("Floor-to-floor diagonal (not a cut length)",floorDiagonal),
      M("Bottom riser layout cut",bottomLayoutRise),
      M("Notch penetration (normal)",normalNotch),
      M("Uncut throat (nominal)",throat)
    ],rows.map(r=>P(r.horizontalRun,r.item)),Math.max(run,1),rows,"stringer",
    {stepRise:h,tread:a.tread,risers:a.risers,totalRise:a.rise,
      throat,bottomLayoutRise,notchNormal:normalNotch,
      pitchLine,floorDiagonal,stepVertices});
  }
  case "roof-sheathing-calculator":{
    positive("width","length","sheetWidth","sheetLength");nonnegative("pitch","waste");whole("orientation",0,1);
    need(a.waste<=200,"Waste must be 0–200%.");
    // Single rectangular plane; eave = roof plan length, uphill run = roof plan width.
    // Project the uphill run onto the sloped surface before laying out stock sheets.
    const uphillLength=a.width*Math.hypot(1,a.pitch/12),eaveLength=a.length;
    const area=eaveLength*uphillLength,per=a.sheetWidth*a.sheetLength;
    const along=a.orientation===0?a.sheetLength:a.sheetWidth;
    const uphill=a.orientation===0?a.sheetWidth:a.sheetLength;
    const cols=ceilStable(eaveLength/along),rowCount=ceilStable(uphillLength/uphill);
    need(cols>0&&rowCount>0&&cols*rowCount<=900,"Sheet grid exceeds 900 positions; use larger sheets or a smaller plane.");
    const sheets=[];
    for(let row=0;row<rowCount;row++)for(let col=0;col<cols;col++){
      const eaveStart=col*along,slopeStart=row*uphill;
      const cutAlong=Math.min(along,eaveLength-eaveStart);
      const cutUphill=Math.min(uphill,uphillLength-slopeStart);
      if(cutAlong<=1e-8||cutUphill<=1e-8)continue;
      sheets.push({id:"S"+(sheets.length+1),eaveStart:q(eaveStart),slopeStart:q(slopeStart),
        cutAlong:q(cutAlong),cutUphill:q(cutUphill),cutAreaSqIn:cutAlong*cutUphill,
        full:Math.abs(cutAlong-along)<1e-7&&Math.abs(cutUphill-uphill)<1e-7});
    }
    const coverage=sheets.reduce((sum,s)=>sum+s.cutAreaSqIn,0);
    need(Math.abs(coverage-area)<=Math.max(1e-6,area*1e-8),"Sheet positions do not conserve the sloped roof area.");
    const full=sheets.filter(s=>s.full).length;
    const cutRows=sheets.map(s=>({item:s.id,eaveStart:s.eaveStart,slopeStart:s.slopeStart,
      cutAlong:s.cutAlong,cutUphill:s.cutUphill,cutAreaFt2:s.cutAreaSqIn/144}));
    return result([
      M("Sloped roof surface",area/144,"FT2"),
      M("Sheet geometric lower bound",ceilStable(area/per),"N"),
      M("Sheet positions (no offcut reuse)",sheets.length,"N"),
      M("Full sheets",full,"N"),M("Edge-cut sheets",sheets.length-full,"N"),
      M("Order sheets with allowance",ceilStable(sheets.length*(1+a.waste/100)),"N"),
      M("Unreused offcut area",Math.max(0,sheets.length*per-area)/144,"FT2")
    ],[],eaveLength,cutRows,"sheathing-panels",
    {roofEave:eaveLength,roofSlope:uphillLength,roofSheets:sheets,sheetAlong:along,sheetUphill:uphill});
  }
  case "fence-post-calculator":{
    positive("length","bay","post");
    // 'length' is explicitly the center-to-center distance between end posts,
    // rather than the overall outside-to-outside width of the two end posts.
    const bays=ceilStable(a.length/a.bay);
    need(bays>=1&&bays<=500,"Number of bays exceeds the supported layout.");
    const interval=a.length/bays,clear=interval-a.post;
    need(clear>1e-8,"Post faces overlap or touch at this maximum bay spacing. Reduce post width or increase the allowed center-to-center span.");
    xs=Array.from({length:bays+1},(_,i)=>i*interval);
    rows=xs.map((x,i)=>({item:"Post "+(i+1),center:q(x),clearBayToNext:i<bays?q(clear):null}));
    return result([
      M("Bays",bays,"N"),M("Posts",bays+1,"N"),
      M("True OC interval",interval),M("Approximate clear bay",clear)
    ],xs.map(x=>P(x)),a.length,rows,"posts",{itemWidth:a.post});
  }
  default:throw new Error("Calculator not implemented: "+slug);
  }
}
export function safeCompute(slug,inputs){try{return {ok:true,data:compute(slug,inputs)}}catch(err){return {ok:false,error:err instanceof Error?err.message:"Calculation failed"}}}
