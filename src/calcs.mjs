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
// End positions are reference CENTERS, not the outside faces of a finished wall.
// Drop a penultimate nominal OC mark when it would physically overlap the
// mandatory end member. Other layout tools retain their own center policies.
const studCenters=(length,spacing,faceWidth)=>{
  need(faceWidth>0&&length>=faceWidth&&spacing>=faceWidth,
    "Stud face width must fit the wall and cannot exceed the OC interval.");
  const centers=positions(length,spacing);
  while(centers.length>1&&centers.at(-1)-centers.at(-2)<faceWidth-1e-8)
    centers.splice(-2,1);
  return centers;
};
// One pitch convention across common rafter, pitched roof and hip rafter:
// pitch means rise per 12 horizontal (never per 12 along the sloping line).
const roofRunGeometry=(run,pitch)=>{
  const slope=pitch/12,rise=run*slope;
  return {slope,rise,line:Math.hypot(run,rise),angle:deg(Math.atan(slope))};
};
// Eliminate floating-point false extra rows at exact dimension ratios (e.g. 105/7.5 after unit conversion).
const ceilStable=(x)=>Math.abs(x-Math.round(x))<=1e-10?Math.round(x):Math.ceil(x);

// State-compressed exact branch-and-bound over WHOLE cut pieces and
// quoted stock offers. Equal canonical states (same next piece and the
// same per-offer sorted used lengths) have identical future feasible cuts,
// purchase costs, reserve counts and unallocated offcut, regardless of which
// physical member is in which bar. Reusing their solved subtree is exact.
// Only a complete search can certify the modeled optimal purchase cost.
// Bound both piece count and UNIQUE explored states for browser responsiveness.
export function exactFramingStock(ordered,offers,kerf,allowance,seed,settings={}){
  const maxPieces=16,nodeLimit=Math.max(1,Math.min(40000,Math.floor(settings.nodeLimit??40000)));
  if(!ordered.length)return {status:"not-required",nodes:0,certified:false,candidate:null,maxPieces,nodeLimit};
  if(!offers.length)return {status:"quote-needed",nodes:0,certified:false,candidate:null,maxPieces,nodeLimit};
  if(ordered.length>maxPieces)return {status:"size-limit",nodes:0,certified:false,candidate:null,maxPieces,nodeLimit};
  const priceCents=offers.map(o=>Math.round(o.unitPrice*100));
  const groups=new Array(offers.length).fill(0);
  const bins=[];
  const offerIndex=new Map(offers.map((offer,i)=>[offer.code,i]));
  const seenStates=new Set();
  let nodes=0,capped=false,memoHits=0,costPrunes=0;
  // A canonical state is sufficient because every opened stock bar is
  // nonempty. Its future cut incurs the same kerf regardless of cut order.
  // A sorted per-offer list of USED stock lengths also determines the
  // final offcut sum and current per-offer purchase quantity exactly.
  const stateKey=index=>{
    const groups=Array.from({length:offers.length},()=>[]);
    for(const bar of bins)groups[offerIndex.get(bar.offer.code)].push(bar.used);
    return index+"|"+groups.map(values=>
      values.sort((x,y)=>x-y).join(",")).join("|");
  };
  const purchase=n=>n?Math.ceil(n*(1+allowance/100)-1e-10):0;
  const countsCost=()=>groups.reduce((sum,n,i)=>sum+purchase(n)*priceCents[i],0);
  const getOffcut=bars=>q(bars.reduce((sum,b)=>sum+b.offer.stockLength-b.used,0));
  const getPurchases=()=>groups.reduce((s,n)=>s+purchase(n),0);
  const cloneBars=bars=>bars.map(b=>({offer:b.offer,used:b.used,cuts:[...b.cuts]}));
  let winner=cloneBars(seed.bars);
  let bestCost=Math.round(seed.purchaseCost*100);
  let bestOffcut=getOffcut(seed.bars),bestPurchases=seed.purchaseCount;
  // We take the first remaining piece, trying each feasible used bar
  // (symmetrical identical bars are equivalent), then every new offer.
  const visit=index=>{
    if(capped)return;
    const key=stateKey(index);
    if(seenStates.has(key)){memoHits++;return;}
    // Budget is on actual distinct states rather than repeated permutations.
    // Once exhausted, even a feasible incumbent is explicitly NOT proven.
    if(nodes>=nodeLimit){capped=true;return;}
    seenStates.add(key);nodes++;
    const cost=countsCost();
    if(cost>bestCost){costPrunes++;return;} // Existing bars' purchase cost cannot decrease.
    if(index===ordered.length){
      const off=getOffcut(bins),purchases=getPurchases();
      if(cost<bestCost||(cost===bestCost&&
        (off<bestOffcut-1e-7||(Math.abs(off-bestOffcut)<=1e-7&&purchases<bestPurchases)))){
        bestCost=cost;bestOffcut=off;bestPurchases=purchases;winner=cloneBars(bins);
      }
      return;
    }
    const piece=ordered[index],seen=new Set();
    for(const bar of bins){
      const fingerprint=bar.offer.code+":"+bar.used;
      if(seen.has(fingerprint))continue;
      seen.add(fingerprint);
      const increase=piece.cutLength+(bar.cuts.length?kerf:0);
      if(bar.used+increase>bar.offer.stockLength+1e-8)continue;
      const previous=bar.used;
      bar.used=q(previous+increase);bar.cuts.push(piece);
      visit(index+1);
      bar.cuts.pop();bar.used=previous;
      if(capped)return;
    }
    for(let k=0;k<offers.length;k++){
      const offer=offers[k];
      if(piece.cutLength>offer.stockLength+1e-8)continue;
      groups[k]++;
      bins.push({offer,used:q(piece.cutLength),cuts:[piece]});
      visit(index+1);
      bins.pop();groups[k]--;
      if(capped)return;
    }
  };
  visit(0);
  return {status:capped?"node-limit":"proved",nodes,certified:!capped,
    memoHits,costPrunes,candidate:{kind:"exact",bars:winner},maxPieces,nodeLimit};
}

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
// Remove degenerate clipping vertices before issuing any polygon cut coordinates.
// A hip line through an exact stock-grid corner otherwise creates a duplicate
// endpoint and zero-length cutting edge (e.g. square roof, rotated stock).
function roofCleanPolygon(vertices){
  const tol=1e-8;
  const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=tol;
  let poly=[];
  for(const p of vertices)if(!poly.length||!same(p,poly.at(-1)))poly.push(p);
  if(poly.length>1&&same(poly[0],poly.at(-1)))poly.pop();
  if(poly.length<3)return [];
  // A collinear midpoint has no independent edge or cutting instruction.
  // Remove only when it lies on the segment between its neighbors.
  let changed=true;
  while(changed&&poly.length>3){
    changed=false;
    for(let i=0;i<poly.length;i++){
      const prev=poly[(i+poly.length-1)%poly.length],cur=poly[i],next=poly[(i+1)%poly.length];
      const dx=next[0]-prev[0],dy=next[1]-prev[1],norm=Math.hypot(dx,dy);
      if(norm<=tol)continue;
      const cross=Math.abs((cur[0]-prev[0])*dy-(cur[1]-prev[1])*dx)/norm;
      const projection=((cur[0]-prev[0])*dx+(cur[1]-prev[1])*dy)/(norm*norm);
      if(cross<=tol&&projection>=0&&projection<=1){
        poly.splice(i,1);changed=true;break;
      }
    }
  }
  return poly;
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
      const clipped=roofCleanPolygon(roofClipPolygon(plane.poly,u0,v0,u0+sheetAlong,v0+sheetUphill));
      const area=roofPolygonArea(clipped);
      if(area<=1e-9)continue;
      const sheetArea=sheetAlong*sheetUphill;
      need(area<=sheetArea+Math.max(1e-6,sheetArea*1e-9),
        "Clipped hip polygon exceeds the original sheet surface.");
      const localVertices=clipped.map(p=>[q(p[0]-u0),q(p[1]-v0)]);
      const planPoints=clipped.map(p=>plane.toPlan(p[0],p[1]).map(q));
      panels.push({
        id:"S"+(panels.length+1),plane:plane.name,planeIndex:idx,
        row:row+1,column:col+1,
        eaveOffset:q(u0),slopeOffset:q(v0),
        cutAreaSqIn:area,offcutAreaSqIn:Math.max(0,sheetArea-area),
        localVertices,planPoints
      });
      need(panels.length<=900,"Over 900 roof sheet positions; simplify the layout.");
    }
  }
  return panels;
}


/**
 * Optional no-rotation guillotine stock layout. Every roof piece is placed
 * by its entire axis-aligned bounding rectangle on ONE original full sheet.
 * Polygon waste inside that rectangle is intentionally unavailable for reuse.
 * This proves non-overlap in the *chosen* placements, not minimum stock.
 * The one explicit kerf applies at split lines within each free rectangle.
 */
function packRoofCutBoxes(parts,stockWidth,stockHeight,kerf){
  need(parts.length>0&&parts.length<=400,
    "Reuse plan is bounded to 400 roof cut pieces; use a larger sheet or disable reuse.");
  need(stockWidth>0&&stockHeight>0&&kerf>=0&&kerf<Math.min(stockWidth,stockHeight),
    "Saw kerf must be smaller than both stock sheet dimensions.");
  const ordered=parts.map((p,index)=>({...p,originalOrder:index}))
    .sort((a,b)=>b.width*b.height-a.width*a.height||a.originalOrder-b.originalOrder);
  const boards=[],out=[];
  let kerfLost=0,polygonWasted=0;
  for(const item of ordered){
    need(item.width>=1e-7&&item.height>=1e-7&&
      item.width<=stockWidth+1e-7&&item.height<=stockHeight+1e-7,
      "At least one roof cut bounding rectangle cannot fit the full stock sheet.");
    need(item.actualArea>0&&item.actualArea<=item.width*item.height+
      Math.max(1e-6,item.width*item.height*1e-8),
      "Roof polygon area is inconsistent with its stock bounding rectangle.");
    let winner=null;
    for(const board of boards)for(const [j,free] of board.free.entries()){
      if(item.width>free.width+1e-7||item.height>free.height+1e-7)continue;
      const excess=free.width*free.height-item.width*item.height;
      if(!winner||excess<winner.excess-1e-9)
        winner={board,index:j,free,excess};
    }
    if(!winner){
      const board={id:"R"+(boards.length+1),
        free:[{x:0,y:0,width:stockWidth,height:stockHeight}],placements:[]};
      boards.push(board);
      winner={board,index:0,free:board.free[0],excess:stockWidth*stockHeight-item.width*item.height};
    }
    const {board,free}=winner;
    board.free.splice(winner.index,1);
    const dx=Math.max(0,free.width-item.width),
      dy=Math.max(0,free.height-item.height);
    const kerfX=dx>1e-8?Math.min(kerf,dx):0,
      kerfY=dy>1e-8?Math.min(kerf,dy):0;
    const rightWidth=Math.max(0,dx-kerfX);
    const topHeight=Math.max(0,dy-kerfY);
    if(rightWidth>=1e-7)board.free.push({
      x:free.x+item.width+kerfX,y:free.y,width:rightWidth,height:free.height
    });
    if(topHeight>=1e-7)board.free.push({
      x:free.x,y:free.y+item.height+kerfY,width:item.width,height:topHeight
    });
    // Even sub-resolution unrecoverable slivers are counted as non-reusable
    // material, not inflated into a new perfectly usable free rectangle.
    const oldArea=free.width*free.height;
    const usableNewArea=(rightWidth>=1e-7?rightWidth*free.height:0)+
      (topHeight>=1e-7?item.width*topHeight:0);
    kerfLost+=Math.max(0,oldArea-item.width*item.height-usableNewArea);
    polygonWasted+=Math.max(0,item.width*item.height-item.actualArea);
    const row={
      item:item.id,sourcePlane:item.plane||"Single roof plane",
      row:item.row,column:item.column,stockId:board.id,
      stockX:q(free.x),stockY:q(free.y),
      boxWidth:q(item.width),boxHeight:q(item.height),
      installedAreaFt2:q(item.actualArea/144),
      rectangularBoxAreaFt2:q((item.width*item.height)/144),
      stockCutVertices:item.vertices.map(([x,y])=>[q(free.x+x),q(free.y+y)])
    };
    board.placements.push(row);out.push(row);
  }
  // Put user-visible schedule back in original roof-position order.
  const indexById=new Map(parts.map((part,i)=>[part.id,i]));
  out.sort((a,b)=>indexById.get(a.item)-indexById.get(b.item));
  const sheetArea=stockWidth*stockHeight;
  const remainingFreeArea=boards.reduce((s,b)=>s+
    b.free.reduce((t,rect)=>t+rect.width*rect.height,0),0);
  const installedArea=parts.reduce((s,p)=>s+p.actualArea,0);
  const stockArea=boards.length*sheetArea;
  need(Math.abs(installedArea+polygonWasted+kerfLost+remainingFreeArea-stockArea)<=
    Math.max(1e-5,stockArea*1e-8),
    "Roof reuse plan violates full stock, used polygon and kerf conservation.");
  for(const board of boards){
    // Every cut has its own non-overlapping rectangular envelope.
    for(let i=0;i<board.placements.length;i++)for(let j=i+1;j<board.placements.length;j++){
      const a=board.placements[i],b=board.placements[j];
      const overlapX=Math.min(a.stockX+a.boxWidth,b.stockX+b.boxWidth)-
        Math.max(a.stockX,b.stockX);
      const overlapY=Math.min(a.stockY+a.boxHeight,b.stockY+b.boxHeight)-
        Math.max(a.stockY,b.stockY);
      need(overlapX<=1e-7||overlapY<=1e-7,
        "Roof reuse layout accidentally places overlapping stock bounding boxes.");
    }
  }
  return {
    stockCount:boards.length,rows:out,boards,
    installedAreaSqIn:installedArea,stockAreaSqIn:stockArea,
    kerfAreaSqIn:kerfLost,cornerScrapAreaSqIn:polygonWasted,
    freeAreaSqIn:remainingFreeArea,
    reusedCutCount:out.length-boards.length,
    stockWidth,stockHeight,kerf
  };
}

const unitToInches={in:1,ft:12,mm:1/25.4,cm:10/25.4,m:1000/25.4};
export const convertToInches=(value,units)=>value*(unitToInches[units]??1);
export const convertFromInches=(value,units)=>value/(unitToInches[units]??1);
export function compute(slug,a){
  a={caseDepth:12,frontPinInset:1.5,backPinInset:1.5,pinCenterDrop:0.25,pinHoleDiameter:0,boardWidth:40/25.4,rowCount:1,crossSetback:5/25.4,lowerSupportRun:0,upperSupportRun:0,nosing:0,upperLandingDepth:0,seamMode:0,buttEndGap:0,joistFaceWidth:1.5,minEndBearing:0,joistStockLength:0,joistUnitPrice:0,outerStep:0,innerStep:0,ringHeight:.75,ringOversize:0,ringKerf:0,lowerEndCutRun:0,upperEndCutRun:0,measuredBlankLength:0,blankEndAllowance:0,reuseMode:0,roofKerf:0,boardUnitPrice:0,fastenersPerContact:2,fastenerPackSize:100,fastenerPackPrice:0,landing:0,itemWidth:0,wallHeight:96,bottomPlate:1.5,topPlate:3,studWidth:1.5,headerDepth:5.5,sillThickness:1.5,studStockLength:96,headerStockLength:96,sillStockLength:96,stockKerf:0.125,stockWaste:0,studUnitPrice:0,headerUnitPrice:0,sillUnitPrice:0,studAltStockLength:120,studAltUnitPrice:0,studAlt2StockLength:144,studAlt2UnitPrice:0,headerAltStockLength:120,headerAltUnitPrice:0,headerAlt2StockLength:144,headerAlt2UnitPrice:0,sillAltStockLength:120,sillAltUnitPrice:0,sillAlt2StockLength:144,sillAlt2UnitPrice:0,openingSill:0,opening2Start:0,opening2Width:0,opening2Height:40,opening2Sill:36,opening3Start:0,opening3Width:0,opening3Height:40,opening3Sill:36,orientation:0,tolerance:0.125,...a};
  need(Object.values(a).every(v=>Number.isFinite(v)&&Math.abs(v)<1e8),"Enter finite measurements within the supported range.");
  const positive=(...ks)=>ks.forEach(k=>need(a[k]>0,k+" must be greater than zero."));
  const nonnegative=(...ks)=>ks.forEach(k=>need(a[k]>=0,k+" cannot be negative."));
  const whole=(k,min=1,max=500)=>need(Number.isInteger(a[k])&&a[k]>=min&&a[k]<=max,k+" must be a whole number between "+min+" and "+max+".");
  const M=metric,P=point;
  let xs,rows,g,n,span;
  switch(slug){
  case "stud-calculator":{
    positive("length","start","spacing","studWidth");nonnegative("pitch","plates");
    xs=studCenters(a.length,a.spacing,a.studWidth);
    rows=xs.map((x,i)=>{
      const gross=a.start+x*a.pitch/12,cut=gross-a.plates;
      // The reported 'length' is the vertical CENTERLINE cut reference.
      // An inclined top crosses the two stock faces at different elevations.
      const halfChange=(a.studWidth/2)*a.pitch/12;
      return {item:"Stud "+(i+1),position:q(x),length:q(cut),
        grossHeight:q(gross),bottomElevation:0,topElevation:q(cut),
        faceLeft:q(x-a.studWidth/2),faceRight:q(x+a.studWidth/2),
        leftEdgeCut:q(cut-halfChange),rightEdgeCut:q(cut+halfChange)};
    });
    need(rows.every(r=>r.leftEdgeCut>0&&r.rightEdgeCut>0),
      "Plate deductions or slope leave no positive length at a stud face.");
    return result([
      M("Stud positions",rows.length,"N"),
      M("First cut length",rows[0].length),
      M("Last cut length",rows.at(-1).length),
      M("Gross height at right end",rows.at(-1).grossHeight),
      M("Plate deduction",a.plates),
      M("Top cut angle",deg(Math.atan(a.pitch/12)),"A")
    ],rows.map((r,i)=>({...P(r.position,String(i+1)),topHeight:r.length,cutLength:r.length})),
    a.length,rows,"slope",{
      rise:a.length*a.pitch/12,start:rows[0].length,
      boardHeight:rows.at(-1).length,grossStart:a.start,
      grossEnd:rows.at(-1).grossHeight,studWidth:a.studWidth,
      studRows:rows
    });
  }
  case "framing-calculator":{
    positive("length","spacing","width","wallHeight","openingWidth","openingHeight","headerDepth","sillThickness","studStockLength","headerStockLength","sillStockLength");
    nonnegative("bottomPlate","topPlate","openingStart","openingSill","opening2Start","opening2Width","opening2Sill","opening3Start","opening3Width","opening3Sill","stockKerf","stockWaste","studUnitPrice","headerUnitPrice","sillUnitPrice","studAltStockLength","studAltUnitPrice","studAlt2StockLength","studAlt2UnitPrice","headerAltStockLength","headerAltUnitPrice","headerAlt2StockLength","headerAlt2UnitPrice","sillAltStockLength","sillAltUnitPrice","sillAlt2StockLength","sillAlt2UnitPrice");
    const prices=["studUnitPrice","headerUnitPrice","sillUnitPrice",
      "studAltUnitPrice","studAlt2UnitPrice","headerAltUnitPrice",
      "headerAlt2UnitPrice","sillAltUnitPrice","sillAlt2UnitPrice"];
    need(prices.every(key=>a[key]<=1e6),"Per-stick quotes must be no more than one million currency units.");
    need(prices.every(key=>Math.abs(a[key]*100-Math.round(a[key]*100))<1e-6),
      "Supplier quotes must use at most two decimal places.");
    for(const family of ["stud","header","sill"])for(const suffix of ["Alt","Alt2"]){
      if(a[family+suffix+"UnitPrice"]>0)
        need(a[family+suffix+"StockLength"]>0,
          family+" "+suffix+" stock option needs a positive purchased length.");
    }
    need(a.stockWaste<=100,"Purchase allowance must be 0–100 percent.");
    need(a.stockKerf<Math.min(a.studStockLength,a.headerStockLength,a.sillStockLength),"Kerf must be shorter than every stock stick.");
    need(a.spacing>=a.width&&a.length>=a.width,"Stud face width must fit the wall and OC interval.");
    const fullCut=a.wallHeight-a.bottomPlate-a.topPlate;
    need(fullCut>0,"Bottom and top plates leave no full-height stud cut length.");
    const openings=[
      {start:a.openingStart,width:a.openingWidth,height:a.openingHeight,sill:a.openingSill,label:"Opening 1"},
      {start:a.opening2Start,width:a.opening2Width,height:a.opening2Height,sill:a.opening2Sill,label:"Opening 2"},
      {start:a.opening3Start,width:a.opening3Width,height:a.opening3Height,sill:a.opening3Sill,label:"Opening 3"}
    ].filter(o=>o.width>0).map(o=>({...o,end:o.start+o.width,top:o.sill+o.height})).sort((u,v)=>u.start-v.start);
    for(let i=0;i<openings.length;i++){
      const o=openings[i];
      need(o.start>2.5*a.width&&o.end<a.length-2.5*a.width,
        "Opening margins must accommodate king/jack reference studs and wall endpoints.");
      need(o.height>0&&o.sill>=0&&o.top<a.wallHeight,
        "Opening sill and height must fit below the wall top.");
      need(o.top>a.bottomPlate,"Jack stud cut length must be positive above the bottom plate.");
      need(o.top+a.headerDepth<=a.wallHeight-a.topPlate+1e-8,
        "Header depth exceeds the space below the top plate.");
      if(o.sill>0)need(o.sill>=a.bottomPlate+a.sillThickness-1e-8,
        "Window sill stock does not fit above the bottom plate.");
      if(i>0)need(o.start-openings[i-1].end>=4*a.width,
        "Adjacent openings need room for both side-member packs.");
    }
    // All positions are inches from the left END STUD CENTER, and all
    // elevations are from the bottom of the wall. The header datum here is
    // explicitly the UNDERSIDE of a nominal rectangular header assembly.
    const vertical=(item,type,x,bottom,top,referenceTop=top)=>({
      item,type,orientation:"vertical",position:q(x),referenceTop:q(referenceTop),
      faceLeft:q(x-a.width/2),faceRight:q(x+a.width/2),
      bottomElevation:q(bottom),topElevation:q(top),
      cutLength:q(top-bottom)
    });
    const horizontal=(item,type,left,right,bottom,top)=>({
      item,type,orientation:"horizontal",position:q((left+right)/2),
      faceLeft:q(left),faceRight:q(right),bottomElevation:q(bottom),
      topElevation:q(top),cutLength:q(right-left),stockDepth:q(top-bottom)
    });
    const sideRows=[];
    for(const o of openings){
      sideRows.push(
        vertical(o.label+" King left","King",o.start-1.5*a.width,a.bottomPlate,a.wallHeight-a.topPlate,a.wallHeight),
        vertical(o.label+" Jack left","Jack",o.start-.5*a.width,a.bottomPlate,o.top,o.top),
        vertical(o.label+" Jack right","Jack",o.end+.5*a.width,a.bottomPlate,o.top,o.top),
        vertical(o.label+" King right","King",o.end+1.5*a.width,a.bottomPlate,a.wallHeight-a.topPlate,a.wallHeight)
      );
    }
    const nominal=studCenters(a.length,a.spacing,a.width);
    xs=nominal.filter(x=>{
      const left=x-a.width/2,right=x+a.width/2;
      return !openings.some(o=>right>o.start+1e-8&&left<o.end-1e-8)
        && !sideRows.some(r=>right>r.faceLeft+1e-8&&left<r.faceRight-1e-8);
    });
    const fullRows=[
      ...xs.map((x,i)=>vertical("Regular "+(i+1),"Regular",x,a.bottomPlate,a.wallHeight-a.topPlate,a.wallHeight)),
      ...sideRows
    ].sort((u,v)=>u.position-v.position);
    // Only full-height king/regular/jack members share the same vertical
    // zone. Cripples legitimately reuse centers above/below an opening.
    need(fullRows.every(r=>r.cutLength>0),"A stud cut length is not positive.");
    for(let i=1;i<fullRows.length;i++)
      need(fullRows[i].faceLeft>=fullRows[i-1].faceRight-1e-7,
        "Stud faces overlap; adjust opening intervals or spacing.");
    const horizontalRows=[],crippleRows=[];
    for(const o of openings){
      // Header cuts run between the INNER FACES of the king studs, across
      // the jack bearing faces, and do not imply structural header design.
      horizontalRows.push(horizontal(o.label+" Header","Header",
        o.start-a.width,o.end+a.width,o.top,o.top+a.headerDepth));
      const insideCenters=nominal.filter(x=>
        x-a.width/2>=o.start-1e-8&&x+a.width/2<=o.end+1e-8);
      const upperBottom=o.top+a.headerDepth;
      const upperTop=a.wallHeight-a.topPlate;
      if(upperTop-upperBottom>1e-8)
        insideCenters.forEach((x,i)=>crippleRows.push(vertical(
          o.label+" Upper cripple "+(i+1),"Upper cripple",x,upperBottom,upperTop)));
      if(o.sill>0){
        const sillBottom=o.sill-a.sillThickness;
        horizontalRows.push(horizontal(o.label+" Sill","Sill",
          o.start,o.end,sillBottom,o.sill));
        if(sillBottom-a.bottomPlate>1e-8)
          insideCenters.forEach((x,i)=>crippleRows.push(vertical(
            o.label+" Lower cripple "+(i+1),"Lower cripple",x,a.bottomPlate,sillBottom)));
      }
    }
    const framingRows=[...fullRows,...horizontalRows,...crippleRows]
      .sort((u,v)=>u.position-v.position||
        u.bottomElevation-v.bottomElevation||u.item.localeCompare(v.item));
    need(framingRows.every(r=>r.cutLength>0&&r.topElevation>r.bottomElevation),
      "A header, sill or cripple has no positive geometric length.");
    const markers=framingRows.map(r=>({
      ...P(r.position,r.item,r.type==="King"?"king":r.type==="Jack"?"jack":
        r.type==="Header"?"header":r.type==="Sill"?"sill":
        r.type.includes("cripple")?"cripple":"mark"),
      orientation:r.orientation,type:r.type,topHeight:r.topElevation,
      bottomHeight:r.bottomElevation,cutLength:r.cutLength,
      faceLeft:r.faceLeft,faceRight:r.faceRight
    }));
    // Quoted stock comparison is bounded to three offers per material
    // FAMILY. It evaluates every viable single-length FFD plan and one
    // deterministic mixed-length greedy plan, then selects the lowest
    // quoted COST among the evaluated candidates. It never claims global
    // optimum. Alternative offers with zero price are disabled; an unpriced
    // legacy base is used only when NO priced offer for that family exists.
    const offer=(family,kind,length,price)=>({
      code:kind,label:kind==="BASE"?"Base":kind==="ALT1"?"Alternative 1":"Alternative 2",
      stockLength:length,unitPrice:price>0?price:null,family
    });
    const groups=[
      {name:"Stud",prefix:"stud",items:framingRows.filter(r=>r.orientation==="vertical")},
      {name:"Header",prefix:"header",items:framingRows.filter(r=>r.type==="Header")},
      {name:"Sill",prefix:"sill",items:framingRows.filter(r=>r.type==="Sill")}
    ];
    const stockPlan=[],stockCuts=[],materialSummary=[],purchaseVariants=[],stockComparisons=[],optimizerStatus=[];
    const moneyRound=n=>Math.round((n+Number.EPSILON)*100)/100;
    for(const group of groups){
      const prefix=group.prefix;
      const offers=[
        offer(group.name,"BASE",a[prefix+"StockLength"],a[prefix+"UnitPrice"]),
        offer(group.name,"ALT1",a[prefix+"AltStockLength"],a[prefix+"AltUnitPrice"]),
        offer(group.name,"ALT2",a[prefix+"Alt2StockLength"],a[prefix+"Alt2UnitPrice"])
      ];
      const quoted=offers.filter(o=>o.unitPrice!==null);
      const available=quoted.length?quoted:[offers[0]];
      const ordered=[...group.items].sort((u,v)=>
        v.cutLength-u.cutLength||u.item.localeCompare(v.item));
      const fitting=ordered.length?available.filter(o=>ordered.every(p=>p.cutLength<=o.stockLength+1e-8)):[];
      const candidates=[];
      const makeBar=(source,cuts)=>({
        offer:source,used:q(cuts.reduce((sum,p,i)=>sum+p.cutLength+(i?a.stockKerf:0),0)),
        cuts
      });
      // Baseline independent FFD plan for each quoted length.
      for(const o of fitting){
        const bars=[];
        for(const p of ordered){
          let bar=bars.find(b=>b.used+p.cutLength+(b.cuts.length?a.stockKerf:0)<=o.stockLength+1e-8);
          if(!bar){bar=makeBar(o,[]);bars.push(bar);}
          bar.cuts.push(p);
          bar.used=q(bar.used+p.cutLength+(bar.cuts.length>1?a.stockKerf:0));
        }
        candidates.push({kind:"single",bars});
      }
      // Greedy mixed stock candidate. Each step scores the pieces that FIT
      // on one offered length as currency per captured net piece length,
      // then compares its completed cost against ALL single-length plans.
      // For large layouts, bounded at 1200 pieces by studCenters.
      if(quoted.length>1&&ordered.length){
        let pending=[...ordered],bars=[];
        while(pending.length){
          const options=[];
          for(const o of quoted){
            const selected=[];let used=0;
            for(const p of pending){
              const needed=p.cutLength+(selected.length?a.stockKerf:0);
              if(used+needed<=o.stockLength+1e-8){
                selected.push(p);used=q(used+needed);
              }
            }
            if(!selected.length)continue;
            const net=selected.reduce((s,p)=>s+p.cutLength,0);
            options.push({o,selected,used,score:o.unitPrice/net});
          }
          if(!options.length)break;
          options.sort((x,y)=>x.score-y.score||
            (x.o.stockLength-x.used)-(y.o.stockLength-y.used)||
            x.o.unitPrice-y.o.unitPrice||x.o.stockLength-y.o.stockLength||
            x.o.code.localeCompare(y.o.code));
          const chosen=options[0],taken=new Set(chosen.selected.map(p=>p.item));
          bars.push(makeBar(chosen.o,chosen.selected));
          pending=pending.filter(p=>!taken.has(p.item));
        }
        if(!pending.length)candidates.push({kind:"mixed",bars});
      }
      // An alternative can cover oversized members even when the base
      // length cannot. No valid source means the user must choose longer
      // stock; never hide an unsupported splice.
      if(ordered.length&&!candidates.length)
        need(false,group.name+" cut exceeds all quoted stock lengths; longer stock required (no splices).");
      if(!ordered.length)candidates.push({kind:"empty",bars:[]});
      const rateCandidate=candidate=>{
        const counts=new Map();
        for(const b of candidate.bars)counts.set(b.offer.code,
          {offer:b.offer,planned:(counts.get(b.offer.code)?.planned||0)+1});
        let purchase=0,plannedCost=0,reserveCost=0,offcut=0,quotedCost=true,purchaseCount=0;
        for(const row of counts.values()){
          const count=row.planned,reserve=Math.ceil(count*(1+a.stockWaste/100)-1e-10)-count;
          row.purchase=count+reserve;
          purchaseCount+=row.purchase;
          if(row.offer.unitPrice===null)quotedCost=false;
          else{
            plannedCost+=count*row.offer.unitPrice;
            reserveCost+=reserve*row.offer.unitPrice;
            purchase+=row.purchase*row.offer.unitPrice;
          }
        }
        for(const b of candidate.bars)offcut+=b.offer.stockLength-b.used;
        return {...candidate,counts,purchaseCost:quotedCost?moneyRound(purchase):null,
          plannedCost:quotedCost?moneyRound(plannedCost):null,
          reserveCost:quotedCost?moneyRound(reserveCost):null,
          offcut:q(offcut),purchaseCount};
      };
      const rated=candidates.map(rateCandidate);
      rated.sort((x,y)=>(x.purchaseCost??Infinity)-(y.purchaseCost??Infinity)||
        x.offcut-y.offcut||x.purchaseCount-y.purchaseCount||
        (x.kind==="single"?-1:1));
      const exact=exactFramingStock(ordered,quoted,a.stockKerf,a.stockWaste,
        rated[0]);
      if(exact.candidate){
        rated.push(rateCandidate(exact.candidate));
        rated.sort((x,y)=>(x.purchaseCost??Infinity)-(y.purchaseCost??Infinity)||
          x.offcut-y.offcut||x.purchaseCount-y.purchaseCount||
          (x.kind==="exact"?-1:y.kind==="exact"?1:0));
      }
      const best=exact.certified?rated.find(x=>x.kind==="exact"):rated[0],
        bins=best.bars;
      optimizerStatus.push({stockGroup:group.name,status:exact.status,
        nodes:exact.nodes,memoHits:exact.memoHits||0,costPrunes:exact.costPrunes||0,
        limit:exact.nodeLimit,maxPieces:exact.maxPieces,
        pieceCount:ordered.length,quotedOfferCount:quoted.length,
        certified:exact.certified});
      for(const candidate of rated){
        const sizes=[...candidate.counts.values()].map(v=>({
          stockLength:q(v.offer.stockLength),offerLabel:v.offer.label,
          purchaseSticks:v.purchase
        }));
        stockComparisons.push({stockGroup:group.name,
          planLabel:candidate.kind==="mixed"?"Greedy mixed lengths":
            candidate.kind==="exact"?(exact.certified?"Exhaustive small-layout plan":"Bounded search (not certified)"):
            candidate.kind==="empty"?"No material required":
            "Single length · "+sizes[0]?.offerLabel,
          selected:candidate===best,quoted:candidate.purchaseCost!==null,
          stockSizes:sizes,plannedSticks:candidate.bars.length,
          purchaseSticks:candidate.purchaseCount,
          purchaseCost:candidate.purchaseCost,
          offcutLength:candidate.offcut});
      }
      let sumCut=0,sumOffcut=0,sumKerf=0;
      for(const [i,b] of bins.entries()){
        const stockId=group.name.toUpperCase()+"-"+String(i+1).padStart(3,"0"),
          cutsLength=q(b.cuts.reduce((s,p)=>s+p.cutLength,0)),
          barKerf=q(Math.max(0,b.cuts.length-1)*a.stockKerf),
          remaining=q(Math.max(0,b.offer.stockLength-b.used));
        sumCut+=cutsLength;sumOffcut+=remaining;sumKerf+=barKerf;
        stockPlan.push({stockGroup:group.name,stockId,offerLabel:b.offer.label,
          offerCode:b.offer.code,stockLength:q(b.offer.stockLength),
          unitPrice:b.offer.unitPrice,cuts:b.cuts.map(p=>({
            item:p.item,type:p.type,cutLength:p.cutLength})),
          cutCount:b.cuts.length,piecesLength:cutsLength,kerfLoss:barKerf,
          usedLength:q(b.used),offcutLength:remaining});
        let consumed=0;
        for(const [idx,p] of b.cuts.entries()){
          const before=idx?a.stockKerf:0;
          consumed=q(consumed+p.cutLength+before);
          stockCuts.push({stockGroup:group.name,stockId,offerLabel:b.offer.label,
            index:idx+1,item:p.item,type:p.type,cutLength:p.cutLength,
            kerfBefore:q(before),stockLength:q(b.offer.stockLength),
            runningUsedLength:consumed,remainingLength:q(Math.max(0,b.offer.stockLength-consumed))});
        }
        need(Math.abs(cutsLength+barKerf+remaining-b.offer.stockLength)<1e-6,
          "Mixed-stock cut and offcut dimensions do not conserve source length.");
      }
      const lines=[...best.counts.values()].sort((x,y)=>
        x.offer.stockLength-y.offer.stockLength||x.offer.code.localeCompare(y.offer.code));
      let totalPurch=0,totalReserve=0,allQuoted=true;
      for(const row of lines){
        const o=row.offer,planned=row.planned,pcs=row.purchase,reserve=pcs-planned;
        totalPurch+=pcs;totalReserve+=reserve;
        allQuoted=allQuoted&&o.unitPrice!==null;
        purchaseVariants.push({stockGroup:group.name,offerLabel:o.label,
          stockLength:q(o.stockLength),plannedSticks:planned,
          allowanceSticks:reserve,purchaseSticks:pcs,unitPrice:o.unitPrice,
          plannedCost:o.unitPrice===null?null:moneyRound(planned*o.unitPrice),
          reserveCost:o.unitPrice===null?null:moneyRound(reserve*o.unitPrice),
          purchaseCost:o.unitPrice===null?null:moneyRound(pcs*o.unitPrice)});
      }
      if(!lines.length){
        purchaseVariants.push({stockGroup:group.name,offerLabel:"Base",
          stockLength:q(offers[0].stockLength),plannedSticks:0,
          allowanceSticks:0,purchaseSticks:0,unitPrice:null,
          plannedCost:0,reserveCost:0,purchaseCost:0});
      }
      const uniform=lines.length===1?lines[0].offer:null;
      materialSummary.push({stockGroup:group.name,pieces:group.items.length,
        cutLength:q(sumCut),
        stockLength:uniform?q(uniform.stockLength):group.items.length?null:q(offers[0].stockLength),
        plannedSticks:bins.length,purchaseSticks:totalPurch,
        allowanceSticks:totalReserve,kerfLoss:q(sumKerf),offcutLength:q(sumOffcut),
        unitPrice:uniform?uniform.unitPrice:null,
        quoted:allQuoted,plannedCost:allQuoted?best.plannedCost:null,
        allowanceCost:allQuoted?best.reserveCost:null,
        purchaseCost:allQuoted?best.purchaseCost:null,
        mixedLengths:lines.length>1});
    }
    need(stockCuts.length===framingRows.length,"Stock cut plan does not include all framing members.");
    const total=(key)=>materialSummary.reduce((sum,r)=>sum+r[key],0);
    const fullStockCount=total("plannedSticks"),purchaseCount=total("purchaseSticks"),
      totalCutLength=total("cutLength"),totalOffcut=total("offcutLength"),
      totalKerf=total("kerfLoss");
    need(Math.abs(totalCutLength+totalOffcut+totalKerf-
      stockPlan.reduce((s,r)=>s+r.stockLength,0))<1e-5,
      "Material summary does not conserve purchased stock lengths.");
    const unpricedGroups=materialSummary.filter(r=>!r.quoted&&r.purchaseSticks>0).map(r=>r.stockGroup),
      quotedSubtotal=q(materialSummary.reduce((sum,r)=>sum+(r.purchaseCost??0),0)),
      quotedPlanned=q(materialSummary.reduce((sum,r)=>sum+(r.plannedCost??0),0)),
      quotedReserve=q(materialSummary.reduce((sum,r)=>sum+(r.allowanceCost??0),0)),
      allPricesEntered=unpricedGroups.length===0,
      requiredOptimization=optimizerStatus.filter(s=>s.pieceCount>0),
      certifiedGroups=requiredOptimization.filter(s=>s.certified).length,
      allGroupsCertified=allPricesEntered&&requiredOptimization.every(s=>s.certified);
    need(Math.abs(quotedPlanned+quotedReserve-quotedSubtotal)<1e-5,
      "Material subtotal does not reconcile to planned and reserve costs.");
    const costSummary={
      allPricesEntered,unpricedGroups,quotedSubtotal,quotedPlanned,quotedReserve,
      pricedGroups:materialSummary.filter(r=>r.quoted&&r.purchaseSticks>0).length,
      requiredGroups:materialSummary.filter(r=>r.purchaseSticks>0).length,
      certifiedGroups,allGroupsCertified
    };
    const roughArea=openings.reduce((sum,o)=>sum+o.width*o.height,0)/144;
    const upper=crippleRows.filter(r=>r.type==="Upper cripple").length,
      lower=crippleRows.length-upper;
    need(framingRows.length===fullRows.length+horizontalRows.length+crippleRows.length,
      "Frame schedule does not reconcile to piece count.");
    return result([
      M("Regular studs",xs.length,"N"),M("Opening intervals",openings.length,"N"),
      M("Opening-side reference members",sideRows.length,"N"),
      M("Header pieces (geometry only)",openings.length,"N"),
      M("Window sills",horizontalRows.length-openings.length,"N"),
      M("Upper cripples",upper,"N"),M("Lower cripples",lower,"N"),
      M("Total listed pieces",framingRows.length,"N"),
      M("Installed member linear length",totalCutLength/12,"FT"),
      M("Planned stock sticks (FFD estimate)",fullStockCount,"N"),
      M("Purchase sticks incl. allowance",purchaseCount,"N"),
      M("Planned stock offcut length",totalOffcut/12,"FT"),
      M("Planned saw kerf loss",totalKerf),
      M("Material families awaiting quotes",unpricedGroups.length,"N"),
      M("Proven optimal material families",certifiedGroups,"N"),
      ...(allPricesEntered?[M("Quoted purchase total",quotedSubtotal,"C"),M("Quoted reserve cost",quotedReserve,"C")]:[]),
      M("Wall reference height",a.wallHeight),M("Regular and king cut length",fullCut),
      M("Bottom plate thickness",a.bottomPlate),M("Top plate thickness",a.topPlate),
      M("Header vertical depth (user-defined)",a.headerDepth),
      M("Window sill stock thickness",a.sillThickness),
      M("Rough opening face area",roughArea,"FT2"),
      ...openings.map(o=>M(o.label+" top elevation",o.top))
    ],markers,a.length,framingRows,"opening",{
      openings,wallHeight:a.wallHeight,bottomPlate:a.bottomPlate,topPlate:a.topPlate,
      studWidth:a.width,headerDepth:a.headerDepth,sillThickness:a.sillThickness,
      studRows:fullRows,framingRows,materialSummary,stockPlan,stockCuts,purchaseVariants,stockComparisons,optimizerStatus,costSummary
    });
  }
  case "deck-board-calculator":{
    positive("width","length","board","stock");nonnegative("gap","waste");
    need(a.waste<=200,"Waste allowance is unreasonably large.");
    n=ceilStable((a.width+a.gap)/(a.board+a.gap));
    need(n>=1&&n<=1200,"Board-row count exceeds supported layout.");
    const last=a.width-(n-1)*(a.board+a.gap);
    need(last>=1e-7&&last<=a.board+1e-8,
      "The final rip is not a representable positive board width; adjust board size or coverage.");
    const faceTotal=(n-1)*a.board+last,gapsTotal=(n-1)*a.gap;
    need(Math.abs(faceTotal+gapsTotal-a.width)<=Math.max(1e-7,a.width*1e-10),
      "Board faces and spaces do not close to the entered deck width.");
    const linear=n*a.length;
    const piecesPerRow=ceilStable(a.length/a.stock);
    const conservativeOrder=ceilStable(n*piecesPerRow*(1+a.waste/100));
    rows=Array.from({length:n},(_,i)=>{
      const left=i*(a.board+a.gap);
      const rip=i===n-1?last:a.board;
      return {item:"Row "+(i+1),position:q(left),left:q(left),
        right:q(left+rip),length:q(a.length),ripWidth:q(rip),
        gapAfter:i===n-1?null:q(a.gap)};
    });
    need(rows.every(row=>row.right>row.left&&row.ripWidth>0),
      "The board edges collapse at coordinate precision.");
    return result([
      M("Board rows",n,"N"),M("Last rip width",last),
      M("Total installed board-face width",faceTotal),
      M("Total spaces between board rows",gapsTotal),
      M("Covered deck width",faceTotal+gapsTotal),
      M("Installed linear footage",linear/12,"FT"),
      M("Stock pieces per row (unverified joints)",piecesPerRow,"N"),
      M("Stock pieces: no offcut reuse",conservativeOrder,"N")
    ],rows.map(row=>P(row.left+row.ripWidth/2,row.item)),a.width,rows,"boards",
    {boardWidth:a.board,lastWidth:last,boardRows:rows,boardGap:a.gap});
  }
  case "baluster-spacing-calculator":{
    positive("length","width","gap");
    need(a.width>=1e-7,"Baluster faces must exceed the cut-coordinate resolution.");
    n=Math.max(1,ceilStable((a.length-a.gap)/(a.width+a.gap)));
    need(n<=500&&n*a.width<=a.length,"Balusters cannot fit in the opening.");
    g=(a.length-n*a.width)/(n+1);
    need(g>=-1e-8&&g<=a.gap+1e-7,"No feasible spacing.");
    const actualGap=Math.max(0,g);
    const faceTotal=n*a.width,spaceTotal=(n+1)*actualGap;
    need(Math.abs(faceTotal+spaceTotal-a.length)<=Math.max(1e-7,a.length*1e-10),
      "Baluster faces and equal gaps do not close to the entered clear opening.");
    xs=Array.from({length:n},(_,i)=>actualGap+i*(a.width+actualGap)+a.width/2);
    rows=xs.map((center,i)=>{
      const faceLeft=center-a.width/2,faceRight=center+a.width/2;
      return {item:"Baluster "+(i+1),center:q(center),
        faceLeft:q(faceLeft),faceRight:q(faceRight),
        clearGap:q(actualGap),
        clearGapToNext:i===n-1?null:q(actualGap)};
    });
    need(rows.every(row=>row.faceRight>row.faceLeft),
      "Baluster faces collapse at the cut-coordinate resolution.");
    return result([
      M("Baluster count",n,"N"),M("Equal clear gap",actualGap),
      M("Center pitch",a.width+actualGap),M("Edge gap",actualGap),
      M("Total baluster face width",faceTotal),
      M("Total clear spaces",spaceTotal),
      M("Opening closure width",faceTotal+spaceTotal)
    ],xs.map((x,i)=>P(x,String(i+1))),a.length,rows,"balusters",
    {itemWidth:a.width,faceRows:rows});
  }
  case "rafter-calculator":{
    positive("run","depth");nonnegative("pitch","ridge","overhang","seat");
    need(a.ridge<2*a.run,"Ridge thickness must be less than the full span.");
    need(a.seat<a.run-a.ridge/2,"Seat reference must fit inside the ridge-adjusted horizontal run.");
    const run=a.run-a.ridge/2;
    const ref=roofRunGeometry(run,a.pitch),tail=roofRunGeometry(a.overhang,a.pitch);
    const slope=ref.slope,angle=rad(ref.angle);
    const rise=ref.rise,line=ref.line,over=tail.line;
    const heel=a.seat*slope,notchNormal=a.seat*Math.sin(angle),remaining=a.depth-notchNormal;
    need(remaining>0,"The nominal seat-notch depth consumes the full rafter depth; reduce the seat or slope.");
    // X: horizontal from ridge top, +x down roof toward tail.
    // Y: vertical DROP from ridge top, +y toward the lower edge.
    // Rafter depth D is NORMAL to slope; the lower edge therefore lies at
    // y = slope*x + D*sqrt(1+slope^2) for each fixed horizontal x.
    // The OUTSIDE wall-face plumb line is x=run, and the seat runs INWARD
    // from x=run-seat to x=run. A 2-line, square-ended triangular cut is
    // geometrically defined without inferring structure/fastening.
    const verticalDepth=a.depth*Math.hypot(1,slope);
    const lowerY=x=>slope*x+verticalDepth;
    const seatStart={x:q(run-a.seat),y:q(lowerY(run-a.seat))};
    const heelTop={x:q(run),y:seatStart.y};
    const heelBottom={x:q(run),y:q(lowerY(run))};
    const hap=verticalDepth-heel;
    const notchArea=a.seat*heel/2;
    need(hap>0&&Number.isFinite(hap),
      "Birdsmouth seat leaves no positive top-to-seat height; reduce the notch.");
    need(Math.abs((heelBottom.y-heelTop.y)-heel)<=Math.max(2e-8,heel*1e-8),
      "Birdsmouth cut coordinates do not conserve the selected heel height.");
    need(Math.abs((seatStart.x-heelTop.x)*heel/2)+1e-8>=notchArea,
      "Birdsmouth triangle geometry failed the independent area check.");
    const birdsmouthCutRows=(a.seat>0&&heel>1e-7)?[
      {item:"Birdsmouth horizontal seat",cutType:"Horizontal seat",
        startX:seatStart.x,startY:seatStart.y,endX:heelTop.x,endY:heelTop.y,
        cutLength:q(a.seat),cutAngleDeg:0},
      {item:"Birdsmouth plumb heel",cutType:"Vertical heel",
        startX:heelTop.x,startY:heelTop.y,endX:heelBottom.x,endY:heelBottom.y,
        cutLength:q(heel),cutAngleDeg:90}
    ]:[];
    const schedule=[
      {item:"Ridge reference",horizontalRun:0,slopeDistance:0,verticalDrop:0},
      {item:"Bearing reference",horizontalRun:q(run),slopeDistance:q(line),verticalDrop:q(rise)},
      {item:"Overhang end",horizontalRun:q(run+a.overhang),slopeDistance:q(line+over),verticalDrop:q(rise+a.overhang*slope)},
      ...birdsmouthCutRows
    ];
    return result([
      M("Adjusted run",run),M("Ridge centerline run before allowance",a.run),
      M("Rise",rise),M("Rafter reference length",line),
      M("Overhang slope length",over),M("Total slope to tail",line+over),
      M("Total horizontal run to tail",run+a.overhang),
      M("Plumb cut angle",ref.angle,"A"),M("Seat reference drop",heel),
      M("Seat notch (normal depth)",notchNormal),M("Remaining stock (normal)",remaining),
      M("Notch / stock depth",100*notchNormal/a.depth,"D"),
      M("HAP (vertical top to seat at wall)",hap),
      M("Birdsmouth horizontal seat length",a.seat),
      M("Birdsmouth vertical heel length",heel),
      M("Nominal removed triangular face area",notchArea/144,"FT2")
    ],schedule.slice(0,3).map(r=>P(r.horizontalRun,r.item)),run+a.overhang,schedule,"rafter",
    {rise,run,seat:a.seat,overhang:a.overhang,stockDepth:a.depth,
      notchNormal,pitch:a.pitch,roofSlope:slope,
      totalHorizontalRun:run+a.overhang,totalRise:rise+tail.rise,
      referencePoints:schedule.slice(0,3),
      verticalDepth,seatStart,heelTop,heelBottom,hap,
      birdsmouthCutRows,notchAreaSqIn:notchArea});
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
    const totalMargins=2*a.margin,totalGaps=(a.panels-1)*a.gap;
    const available=a.wall-totalMargins-totalGaps,width=available/a.panels;
    // Cut coordinates are stored at 1e-8 inch resolution. Reject panels
    // that would appear as zero-width or yield indistinguishable edges.
    need(width>=1e-7,"Margins, gaps or panel count leave no representable positive panel width.");
    const lastRight=a.margin+(a.panels-1)*(width+a.gap)+width;
    need(Math.abs(lastRight-(a.wall-a.margin))<=Math.max(1e-7,a.wall*1e-10),
      "Panel layout does not close at the intended right margin.");
    rows=Array.from({length:a.panels},(_,i)=>{
      const left=a.margin+i*(width+a.gap),right=left+width;
      return {item:"Panel "+(i+1),
        left:q(left),right:q(right),width:q(width),height:q(a.height),
        gapAfter:i<a.panels-1?q(a.gap):null};
    });
    need(rows.every(r=>r.right>r.left&&r.width>0),
      "Panel edges collapse at the coordinate precision; choose a wider panel.");
    return result([
      M("Panel width",width),M("Panel count",a.panels,"N"),
      M("Total panel face width",available),
      M("Total inter-panel gaps",totalGaps),
      M("Left end margin",a.margin),M("Right end margin",a.margin),
      M("Total layout width",available+totalGaps+totalMargins),
      M("Panel height",a.height)
    ],rows.map(r=>P(r.left+r.width/2,r.item)),a.wall,rows,"panels",
    {panelWidth:width,panelHeight:a.height,panelRows:rows,
      leftMargin:a.margin,rightMargin:a.margin,gap:a.gap});
  }
  case "stair-calculator":{
    positive("rise","desired","tread");nonnegative("landing");
    const risers=ceilStable(a.rise/a.desired);
    need(risers>=2&&risers<=200,"Stair count outside supported range.");
    const treads=risers-1,h=a.rise/risers,flightRun=treads*a.tread;
    const footprint=flightRun+a.landing;
    // The final riser reaches the finished upper floor/landing. There is
    // no additional counted tread at the top in this explicit convention.
    // All exported mark coordinates and drawn steps share one physical datum.
    rows=Array.from({length:risers},(_,i)=>{
      const x=i*a.tread,atTop=i===risers-1;
      return {
        item:"Riser "+(i+1),rise:q((i+1)*h),run:q(x),
        riserHeight:q(h),treadStart:q(x),
        treadEnd:atTop?(a.landing>0?q(footprint):null):q(x+a.tread),
        walkingSurface:atTop?"Upper landing":"Tread "+(i+1)
      };
    });
    need(Math.abs(rows.at(-1).rise-a.rise)<1e-6,
      "Calculated final riser must reach the specified finished floor level.");
    need(Math.abs(rows.at(-1).run-flightRun)<1e-6,
      "Calculated last riser position must match total flight run.");
    return result([
      M("Risers",risers,"N"),M("Treads",treads,"N"),
      M("Actual riser height",h),M("Horizontal run",flightRun),
      M("Upper landing reference depth",a.landing),
      M("Total reference footprint",footprint),
      M("Incline",deg(Math.atan(h/a.tread)),"A")
    ],rows.map(r=>P(r.run,r.item)),Math.max(footprint,1),rows,"stairs",{
      stepRise:h,tread:a.tread,risers,totalRise:a.rise,flightRun,
      landingDepth:a.landing,totalFootprint:footprint,stairRows:rows
    });
  }
  case "rise-run-calculator":{
    positive("run");nonnegative("rise");
    const angle=deg(Math.atan2(a.rise,a.run)),hyp=Math.hypot(a.rise,a.run);
    return result([M("Slope length",hyp),M("Slope angle",angle,"A"),M("Pitch / 12",12*a.rise/a.run,"P"),M("Grade",100*a.rise/a.run,"D")],[],a.run,[],"triangle",{rise:a.rise,run:a.run});
  }
  case "deck-material-calculator":{
    positive("width","length","board","joists","stock");nonnegative("gap","waste","boardUnitPrice","fastenerPackPrice",
      "joistStockLength","joistUnitPrice");
    whole("fastenersPerContact",0,20);whole("fastenerPackSize",1,100000);whole("seamMode",0,1);
    nonnegative("buttEndGap","minEndBearing");positive("joistFaceWidth");
    need(a.waste<=200,"Waste must be 0–200%.");
    need(a.boardUnitPrice<=1e6&&a.fastenerPackPrice<=1e6&&a.joistUnitPrice<=1e6,
      "Supplier unit prices cannot exceed one million in the selected currency.");
    need([a.boardUnitPrice,a.fastenerPackPrice,a.joistUnitPrice].every(price=>
      Math.abs(price*100-Math.round(price*100))<1e-6),
      "Supplier quotes must use at most two decimal places.");
    // Surface board rows run along deck length; joist reference lines run across the width.
    // Ends include a final shortened bay. This is geometry, not a structural span design.
    const boards=ceilStable((a.width+a.gap)/(a.board+a.gap));
    const finalRip=a.width-(boards-1)*(a.board+a.gap);
    need(boards>=1&&boards<=900&&finalRip>0&&finalRip<=a.board+1e-7,"Board width or gap cannot cover this deck safely within the layout limit.");
    const joistGrid=positions(a.length,a.joists);
    need(joistGrid.length<=900,"Too many joist layout lines.");
    // Optional full-deck-width joist procurement ONLY; support spacing
    // remains user-entered and does not imply structural span approval.
    const quoteJoists=a.joistStockLength>0;
    need(quoteJoists||a.joistUnitPrice===0,
      "Enter purchased joist stock length before quoting joist materials.");
    need(!quoteJoists||a.joistStockLength+1e-8>=a.width,
      "Purchased joist stock cannot cover full deck width; splicing is not modeled.");
    const joistPurchaseCount=quoteJoists?
      ceilStable(joistGrid.length*(1+a.waste/100)):0;
    const joistWasteOffcut=quoteJoists?
      (a.joistStockLength-a.width)*joistGrid.length:0;
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
    // A second complete seam solution is obtained by walking from the
    // opposite deck end. It uses exactly the same entered joist centers,
    // never an unsupported arbitrary joint location. Alternate rows use
    // the reverse solution only when the user explicitly opts in.
    const reverse=[a.length];
    let right=a.length;
    while(right>a.stock+1e-8){
      const center=joistGrid.find(x=>x>1e-8&&x<right-1e-8&&x>=right-a.stock-1e-8);
      need(center!==undefined,
        "Reverse seam layout cannot reach a support center with the entered stock.");
      reverse.unshift(q(center));right=center;
      need(reverse.length<=900,"Too many reverse seam pieces.");
    }
    reverse.unshift(0);
    const rowEnds=index=>a.seamMode===1&&index%2===1?reverse:cutEnds;
    // Joinery datums: all seams stay at a measured JOIST CENTER. Actual
    // square-cut end faces are +/- half of the entered clear joint gap.
    // Each supported end overlaps (joist face - joint gap)/2 horizontally.
    const hasSeams=cutEnds.length>2||reverse.length>2;
    const faceOverlap=(a.joistFaceWidth-a.buttEndGap)/2;
    if(hasSeams){
      need(faceOverlap>1e-8,
        "Butt-end gap leaves no positive joist-face overlap per board end.");
      need(faceOverlap+1e-8>=a.minEndBearing,
        "Butt-end joint falls short of your entered minimum face overlap per end.");
    }
    const deckRows=Array.from({length:boards},(_,i)=>{
      const ends=rowEnds(i);
      return {item:"Row "+(i+1),acrossStart:q(i*(a.board+a.gap)),
        ripWidth:q(i===boards-1?finalRip:a.board),
        seamCenters:ends.slice(1,-1),pieceCount:ends.length-1,
        layoutDirection:a.seamMode===1&&i%2===1?"Reverse":"Forward",
        seamGap:a.buttEndGap,
        geometricFaceOverlap:ends.length>2?q(faceOverlap):null};
    });
    const baseStock=deckRows.reduce((sum,row)=>sum+row.pieceCount,0);
    need(baseStock<=900,"Over 900 supported stock pieces are required; choose longer stock or a smaller footprint.");
    const schedule=[];
    for(const [index,row] of deckRows.entries()){
      const ends=rowEnds(index);
      for(let j=0;j<ends.length-1;j++){
        const referenceStart=ends[j],referenceEnd=ends[j+1];
        const start=referenceStart+(j>0?a.buttEndGap/2:0);
        const end=referenceEnd-(j<ends.length-2?a.buttEndGap/2:0);
        const segment=end-start;
        need(segment>1e-8&&segment<=a.stock+1e-7,
          "Butt-end gaps consume a board cut or a cut exceeds purchased stock length.");
        need(j===ends.length-2||joistGrid.some(x=>Math.abs(x-referenceEnd)<1e-7),
          "Butt seam is not on the measured joist-center reference.");
        schedule.push({item:row.item+" piece "+(j+1),type:"Decking",
          acrossStart:row.acrossStart,alongStart:q(start),
          cutLength:q(segment),ripWidth:row.ripWidth,
          buttJointAtEnd:j<ends.length-2?q(referenceEnd):null,joistCenter:null,
          ...(a.buttEndGap>0?{
            actualCutEnd:q(end),
            buttGapAtStart:j>0?q(a.buttEndGap):null,
            buttGapAtEnd:j<ends.length-2?q(a.buttEndGap):null,
            geometricFaceOverlap:ends.length>2?q(faceOverlap):null
          }:{})});
      }
    }
    for(const [i,x] of joistGrid.entries())schedule.push({
      item:"Joist reference "+(i+1),type:quoteJoists?"Joist straight cut":"Joist center",
      acrossStart:null,alongStart:null,
      cutLength:quoteJoists?q(a.width):null,ripWidth:null,
      buttJointAtEnd:null,joistCenter:q(x),
      ...(quoteJoists?{
        purchasedStockLength:q(a.joistStockLength),
        sourceOffcutLength:q(a.joistStockLength-a.width)
      }:{})
    });
    const buyBoards=ceilStable(baseStock*(1+a.waste/100));
    // A butt join touches one joist grid line with TWO independently
    // purchased pieces, rather than one continuous board. Thus every
    // seam adds one additional fastener CONTACT on the same reference line.
    // We do not infer real joist width, bearing or manufacturer fastening.
    const fastenerContacts=deckRows.reduce((sum,row)=>
      sum+joistGrid.length+row.seamCenters.length,0);
    const fastenerPieces=fastenerContacts*a.fastenersPerContact;
    const fastenerPacks=fastenerPieces?
      ceilStable(fastenerPieces/a.fastenerPackSize):0;
    const deckMoney=v=>Math.round((v+Number.EPSILON)*100)/100;
    const boardQuoted=a.boardUnitPrice>0,
      fastenerQuoted=fastenerPacks===0||a.fastenerPackPrice>0,
      joistQuoted=!quoteJoists||a.joistUnitPrice>0;
    const boardCost=boardQuoted?deckMoney(buyBoards*a.boardUnitPrice):null;
    const fastenerCost=fastenerPacks===0?0:
      fastenerQuoted?deckMoney(fastenerPacks*a.fastenerPackPrice):null;
    const joistCost=quoteJoists&&joistQuoted?
      deckMoney(joistPurchaseCount*a.joistUnitPrice):null;
    const deckCostSummary={
      allPricesEntered:boardQuoted&&fastenerQuoted&&joistQuoted,
      missingQuotes:[...(!boardQuoted?["Decking boards"]:[]),
        ...(!fastenerQuoted?["Fastener packs"]:[]),
        ...(!joistQuoted?["Full-width joist stock"]:[])],
      boardCost,fastenerCost,joistCost,
      quotedSubtotal:deckMoney((boardCost??0)+(fastenerCost??0)+(joistCost??0)),
      quoteJoists,joistPurchaseCount,joistStockCount:joistGrid.length,
      joistMeasuredCutLength:a.width,joistWasteOffcut,
      stockedBoards:baseStock,purchaseBoards:buyBoards,
      fastenerContacts,fastenerPieces,fastenerPacks,
      fastenersPerContact:a.fastenersPerContact,
      fastenerPackSize:a.fastenerPackSize
    };
    const deckPurchaseRows=[
      {material:"Decking stock boards",plannedQuantity:baseStock,
        purchaseQuantity:buyBoards,unit:"boards",
        unitPrice:boardQuoted?a.boardUnitPrice:null,purchaseCost:boardCost},
      {material:"Fastener packs",plannedQuantity:fastenerPacks,
        purchaseQuantity:fastenerPacks,unit:"packs",
        unitPrice:fastenerPacks&&fastenerQuoted?a.fastenerPackPrice:null,
        purchaseCost:fastenerCost},
      ...(quoteJoists?[{material:"Optional full-width joist stock",
        plannedQuantity:joistGrid.length,purchaseQuantity:joistPurchaseCount,
        unit:"sticks",unitPrice:joistQuoted?a.joistUnitPrice:null,
        purchaseCost:joistCost}]:[])
    ];
    const deckFastenerRows=deckRows.map((row,i)=>({
      item:row.item,rowNumber:i+1,joistReferences:joistGrid.length,
      buttSeams:row.seamCenters.length,
      fasteningContacts:joistGrid.length+row.seamCenters.length,
      fastenersPerContact:a.fastenersPerContact,
      fastenerPiecesPerRow:(joistGrid.length+row.seamCenters.length)*a.fastenersPerContact,
      firstSeamAt:row.seamCenters.length?row.seamCenters[0]:null,
      lastSeamAt:row.seamCenters.length?row.seamCenters.at(-1):null,
      seamStations:row.seamCenters.join("; "),
      layoutDirection:row.layoutDirection
    }));
    need(deckFastenerRows.reduce((s,row)=>s+row.fasteningContacts,0)===fastenerContacts,
      "Deck fastener reference contacts do not conserve grouped row counts.");
    const seamSet=[...new Set(deckRows.map(row=>row.seamCenters.join(",")))];
    const staggeredRows=deckRows.filter(row=>row.seamCenters.join(",")!==
      deckRows[0].seamCenters.join(",")).length;
    // No promise of stagger where geometry admits only one viable seam pattern.
    const seamCount=deckRows.reduce((sum,row)=>sum+row.seamCenters.length,0);
    const installedCutLength=schedule.filter(row=>row.type==="Decking")
      .reduce((sum,row)=>sum+row.cutLength,0);
    need(Math.abs(installedCutLength+seamCount*a.buttEndGap-boards*a.length)<=
      Math.max(1e-5,boards*a.length*1e-9),
      "Physical cut lengths and between-piece gaps do not conserve the deck length.");
    return result([
      M("Deck area",a.width*a.length/144,"FT2"),M("Deck rows",boards,"N"),
      M("Last rip width",finalRip),M("Joist reference lines",joistGrid.length,"N"),
      M("Final joist bay",joistGrid.at(-1)-joistGrid.at(-2)),
      ...(quoteJoists?[
        M("Straight joist cuts",joistGrid.length,"N"),
        M("Joist stock sticks with allowance",joistPurchaseCount,"N"),
        M("Total nominal joist cut length",joistGrid.length*a.width/12,"FT"),
        M("Unreused joist source offcut length",joistWasteOffcut/12,"FT")
      ]:[]),
      M("Installed linear decking",installedCutLength/12,"FT"),
      M("Stock boards (no offcut reuse)",baseStock,"N"),
      M("Stock boards with allowance",ceilStable(baseStock*(1+a.waste/100)),"N"),
      M("Butt joints on joist center references",deckRows.reduce((s,row)=>s+row.seamCenters.length,0),"N"),
      M("Rows with different seam stations",staggeredRows,"N"),
      ...(seamCount?[
        M("Butt-end clear gap",a.buttEndGap),
        M("Measured joist support face",a.joistFaceWidth),
        M("Geometric face overlap per joined end",faceOverlap),
        M("Installed physical board cut length",installedCutLength)
      ]:[]),
      M("Board-joist intersections",boards*joistGrid.length,"N"),
      M("Piece-joist fastening contacts",fastenerContacts,"N"),
      M("Fasteners requested",fastenerPieces,"N"),
      M("Fastener packs to buy",fastenerPacks,"N"),
      M("Material families awaiting quotes",deckCostSummary.missingQuotes.length,"N"),
      ...(deckCostSummary.allPricesEntered?
        [M("Quoted deck materials total",deckCostSummary.quotedSubtotal,"C")]:[])
    ],deckRows.map(row=>P(row.acrossStart,row.item)),a.width,schedule,"deck-plan",
    {deckWidth:a.width,deckLength:a.length,deckRows,joistGrid,seamCenters,stockLength:a.stock,
      deckSeamMode:a.seamMode,staggeredRows,distinctSeamPatterns:seamSet.length,
      deckButtEndGap:a.buttEndGap,deckJoistFaceWidth:a.joistFaceWidth,
      deckFaceOverlap:hasSeams?faceOverlap:null,
      deckJoistStockEnabled:quoteJoists,deckJoistStockLength:a.joistStockLength,
      deckFastenerRows,deckPurchaseRows,deckCostSummary});
  }
  case "segmented-bowl-calculator":{
    positive("outer","inner","ringHeight");
    nonnegative("ringOversize","ringKerf");
    whole("segments",3,180);whole("rings",1,100);
    need(a.inner<a.outer,"Inner diameter must be less than outer diameter.");
    // Diameters are measured THROUGH POLYGON VERTICES, not across finished
    // round lathe surfaces. Successive ring diameter changes are signed.
    // One material-allowance margin is added to EACH side of a conceptual
    // rectangular blank; one kerf per dimension is added as a stated
    // estimating convention, NOT an exact blade path or optimal nesting.
    const theta=PI/a.segments,miter=180/a.segments,sector=360/a.segments;
    const rings=[];
    for(let index=0;index<a.rings;index++){
      const outer=a.outer+index*a.outerStep,inner=a.inner+index*a.innerStep;
      need(outer>0&&inner>0&&inner<outer,
        "Ring "+(index+1)+" has invalid inner/outer corner diameters after taper; adjust diameter steps.");
      const outerChord=outer*Math.sin(theta),innerChord=inner*Math.sin(theta);
      const radialDepth=(outer-inner)/2,faceDepth=radialDepth*Math.cos(theta);
      need(faceDepth>=1e-7,
        "Ring "+(index+1)+" has a face depth smaller than coordinate resolution.");
      const faceAreaSqIn=(outerChord+innerChord)*faceDepth/2;
      const ringAreaSqIn=a.segments*Math.sin(2*theta)*(outer*outer-inner*inner)/8;
      need(Math.abs(faceAreaSqIn*a.segments-ringAreaSqIn)<=
        Math.max(1e-7,ringAreaSqIn*1e-10),
        "Ring "+(index+1)+" segment area fails polygon conservation.");
      const blankLength=outerChord+2*a.ringOversize+a.ringKerf;
      const blankWidth=faceDepth+2*a.ringOversize+a.ringKerf;
      rings.push({ring:index+1,outer:q(outer),inner:q(inner),outerChord:q(outerChord),
        innerChord:q(innerChord),radialDepth:q(radialDepth),
        faceDepth:q(faceDepth),turningLimit:q(outer*Math.cos(theta)),
        trapezoidAreaSqIn:faceAreaSqIn,ringAreaSqIn,
        blankLength:q(blankLength),blankWidth:q(blankWidth),
        blankAreaSqIn:blankLength*blankWidth,stackBottom:q(index*a.ringHeight),
        stackTop:q((index+1)*a.ringHeight)});
    }
    const first=rings[0],last=rings.at(-1);
    const template=[
      [q(0),q(0)],[first.outerChord,q(0)],
      [q((first.outerChord+first.innerChord)/2),first.faceDepth],
      [q((first.outerChord-first.innerChord)/2),first.faceDepth]
    ];
    rows=rings.flatMap(ring=>Array.from({length:a.segments},(_,index)=>({
      item:"Ring "+ring.ring+" / segment "+(index+1),ring:ring.ring,segment:index+1,
      startAngle:q(index*sector),endAngle:q((index+1)*sector),
      miterAngle:q(miter),outerCornerDiameter:ring.outer,
      innerCornerDiameter:ring.inner,outerChord:ring.outerChord,
      innerChord:ring.innerChord,radialDepth:ring.radialDepth,
      perpendicularFaceDepth:ring.faceDepth,
      idealTurnedOuterDiameter:ring.turningLimit,
      segmentFaceAreaFt2:q(ring.trapezoidAreaSqIn/144),
      roughBlankLength:ring.blankLength,roughBlankWidth:ring.blankWidth,
      roughBlankAreaFt2:q(ring.blankAreaSqIn/144),
      stackBottom:ring.stackBottom,stackTop:ring.stackTop
    })));
    const totalFaceArea=rings.reduce((s,r)=>s+r.ringAreaSqIn,0);
    const totalRoughArea=rings.reduce((s,r)=>s+r.blankAreaSqIn*a.segments,0);
    need(rows.length===a.segments*a.rings,
      "Ring profile rows do not match the requested segment count.");
    return result([
      M("Segment half-miter",miter,"A"),M("Outer chord",first.outerChord),
      M("Inner chord",first.innerChord),M("Segment radial depth",first.radialDepth),
      M("Perpendicular stock-face depth",first.faceDepth),
      M("Maximum circular outside diameter (ideal)",first.turningLimit),
      M("One segment face area",first.trapezoidAreaSqIn/144,"FT2"),
      M("One complete polygon-ring face area",first.ringAreaSqIn/144,"FT2"),
      M("Last ring outer corner diameter",last.outer),
      M("Last ring inner corner diameter",last.inner),
      M("Last ring theoretical round OD",last.turningLimit),
      M("Stack reference height",a.rings*a.ringHeight),
      M("One ring-1 rough blank length",first.blankLength),
      M("One ring-1 rough blank width",first.blankWidth),
      M("All rings geometric face area",totalFaceArea/144,"FT2"),
      M("All conceptual rough blanks area",totalRoughArea/144,"FT2"),
      M("Total segments",rows.length,"N"),
      M("Segment sweep",sector,"A")
    ],[],Math.max(a.outer,last.outer),rows,"ring",{
      segments:a.segments,inner:first.inner,outer:first.outer,
      segmentTemplateVertices:template,faceDepth:first.faceDepth,
      turningLimit:first.turningLimit,
      trapezoidAreaSqIn:first.trapezoidAreaSqIn,ringAreaSqIn:first.ringAreaSqIn,
      ringProfiles:rings,ringHeight:a.ringHeight,
      totalRingFaceAreaSqIn:totalFaceArea,totalRoughBlankAreaSqIn:totalRoughArea,
      ringOversize:a.ringOversize,ringKerf:a.ringKerf
    });
  }
  case "roof-pitch-calculator":{
    nonnegative("pitch");positive("run");
    const ref=roofRunGeometry(a.run,a.pitch);
    return result([
      M("Roof angle",ref.angle,"A"),M("Percentage grade",ref.slope*100,"D"),
      M("Rise over reference run",ref.rise),M("Slope line",ref.line)
    ],[],a.run,[],"triangle",{
      rise:ref.rise,run:a.run,pitch:a.pitch,roofLine:ref.line
    });
  }
  case "equal-spacing-calculator":{
    positive("length");nonnegative("left","right","itemWidth");
    whole("count");need(a.left+a.right<a.length,"Offsets consume the available length.");
    const pitch=a.count===1?0:(a.length-a.left-a.right)/(a.count-1);
    xs=Array.from({length:a.count},(_,i)=>a.count===1?
      (a.left+a.length-a.right)/2:a.left+i*pitch);
    // Zero width means center marks only; never imply zero-width pieces have
    // physical face gaps or a computed end-material clearance.
    const physical=a.itemWidth>0;
    const faces=xs.map((center,i)=>({
      item:"Center "+(i+1),position:q(center),
      faceLeftEdge:physical?q(center-a.itemWidth/2):null,
      faceRightEdge:physical?q(center+a.itemWidth/2):null,
      clearToPrevious:physical&&i>0?q(pitch-a.itemWidth):null
    }));
    if(physical){
      need(faces[0].faceLeftEdge>=-1e-7 &&
        faces.at(-1).faceRightEdge<=a.length+1e-7,
        "Part faces exceed the measured total length. Increase center offsets or reduce width.");
      need(a.count===1||pitch+1e-8>=a.itemWidth,
        "Part faces overlap. Reduce width or part count, or increase the run.");
    }
    const metrics=[
      M("Centers",a.count,"N"),
      M("Equal center interval",pitch),
      M("Usable length",a.length-a.left-a.right)
    ];
    if(physical){
      metrics.push(M("Physical part face width",a.itemWidth),
        M("Left end face margin",faces[0].faceLeftEdge),
        M("Right end face margin",a.length-faces.at(-1).faceRightEdge));
      if(a.count>1)metrics.push(M("Clear space between faces",pitch-a.itemWidth));
    }
    return result(metrics,xs.map(x=>P(x)),a.length,faces,
      physical?"spacing-faces":"ruler",
      {partFaceWidth:a.itemWidth,faceRows:faces,clearFaceGap:physical&&a.count>1?pitch-a.itemWidth:null});
  }
  case "hip-rafter-calculator":{
    positive("runX","runY");nonnegative("pitch");
    // The ridge rise is across-roof runY × common-face pitch, NOT
    // the diagonal plan run × common-face pitch.
    const roof=roofRunGeometry(a.runY,a.pitch),plan=Math.hypot(a.runX,a.runY);
    const rise=roof.rise,hipLength=Math.hypot(plan,rise);
    const planAngle=deg(Math.atan2(a.runY,a.runX));
    const elevationAngle=deg(Math.atan2(rise,plan));
    const effectivePitch=12*rise/plan;
    rows=[{
      item:"Hip line reference",alongPlanRun:q(a.runX),acrossPlanRun:q(a.runY),
      verticalRise:q(rise),planDiagonal:q(plan),trueHipLength:q(hipLength),
      planAngleDeg:q(planAngle),hipElevationAngleDeg:q(elevationAngle)
    }];
    return result([
      M("Plan diagonal",plan),M("Vertical rise",rise),
      M("Hip line length",hipLength),M("Plan hip angle",planAngle,"A"),
      M("Hip elevation angle",elevationAngle,"A"),
      M("Effective hip pitch per 12 plan run",effectivePitch,"D"),
      M("Common roof-face slope angle",roof.angle,"A")
    ],[],plan,rows,"hip-line",{
      run:plan,rise,hipRunX:a.runX,hipRunY:a.runY,
      hipLength,planAngle,elevationAngle,
      facePitch:a.pitch,effectiveHipPitch:effectivePitch,
      referencePoints:[{x:0,y:0,z:0},{x:a.runX,y:a.runY,z:rise}]
    });
  }
  case "hip-roof-calculator":{
    positive("width","length","sheetWidth","sheetLength");nonnegative("pitch","overhang","roofKerf");whole("orientation",0,1);whole("reuseMode",0,1);
    const W=a.width+2*a.overhang,L=a.length+2*a.overhang;
    const small=Math.min(W,L),large=Math.max(W,L),factor=Math.hypot(1,a.pitch/12),area=W*L*factor,ridge=large-small;
    const endArea=(small*small/4)*factor,sideArea=((large*small/2)-(small*small/4))*factor;
    const sheetArea=a.sheetWidth*a.sheetLength,sheetAlong=a.orientation===0?a.sheetLength:a.sheetWidth,sheetUphill=a.orientation===0?a.sheetWidth:a.sheetLength;
    const panels=layoutHipSheets(large,small,factor,sheetAlong,sheetUphill);
    const tiledArea=panels.reduce((sum,p)=>sum+p.cutAreaSqIn,0);
    need(Math.abs(tiledArea-area)<=Math.max(1e-6,area*1e-8),"Roof panel clipping did not conserve the sloped area.");
    // North/south trapezoids and west/east triangles must also individually
    // close to their analytically derived developed-surface plane areas.
    for(const idx of [0,1,2,3]){
      const actual=panels.filter(p=>p.planeIndex===idx).reduce((sum,p)=>sum+p.cutAreaSqIn,0);
      const target=idx<2?sideArea:endArea;
      need(Math.abs(actual-target)<=Math.max(1e-6,target*1e-8),
        "The clipped sheets do not conserve one hip-roof plane.");
    }
    const stockArea=panels.length*sheetArea;
    const offcuts=panels.reduce((sum,p)=>sum+p.offcutAreaSqIn,0);
    need(Math.abs(tiledArea+offcuts-stockArea)<=Math.max(1e-6,stockArea*1e-10),
      "Hip roof used and discarded sheet areas do not conserve consumed stock.");
    const uncut=panels.filter(p=>Math.abs(p.cutAreaSqIn-sheetArea)<=Math.max(1e-6,sheetArea*1e-8)).length;
    // Exact clipped polygons are embedded into nonoverlapping rectangular
    // bounding boxes on stock. Nonrectangular corner scraps are NOT reused.
    const reuseParts=panels.map(p=>{
      const xs=p.localVertices.map(v=>v[0]),ys=p.localVertices.map(v=>v[1]);
      const left=Math.min(...xs),bottom=Math.min(...ys);
      const width=Math.max(...xs)-left,height=Math.max(...ys)-bottom;
      return {id:p.id,plane:p.plane,row:p.row,column:p.column,
        width,height,actualArea:p.cutAreaSqIn,
        vertices:p.localVertices.map(v=>[v[0]-left,v[1]-bottom])};
    });
    const roofReusePlan=a.reuseMode===1?
      packRoofCutBoxes(reuseParts,sheetAlong,sheetUphill,a.roofKerf):null;
    need(!roofReusePlan||roofReusePlan.stockCount<=panels.length,
      "Roof reuse heuristic cannot require more sheets than the one-sheet-per-piece plan.");
    rows=panels.map(p=>({
      item:p.id,plane:p.plane,row:p.row,column:p.column,
      eaveOffset:p.eaveOffset,slopeOffset:p.slopeOffset,
      cutAreaFt2:p.cutAreaSqIn/144,offcutAreaFt2:p.offcutAreaSqIn/144,
      cutVertices:p.localVertices,planVertices:p.planPoints
    }));
    return result([
      M("Ridge length",ridge),M("Whole sloped area",area/144,"FT2"),
      M("Each hip-end plane",endArea/144,"FT2"),M("Each long-side plane",sideArea/144,"FT2"),
      M("Sheet area lower bound",ceilStable(area/sheetArea),"N"),
      M("Sheet positions (no offcut reuse)",panels.length,"N"),
      M("Full rectangular sheets",uncut,"N"),M("Edge-cut sheets",panels.length-uncut,"N"),
      M("Stock face area before allowance",stockArea/144,"FT2"),
      M("Unreused stock area",offcuts/144,"FT2"),
      ...(roofReusePlan?[
        M("Bounded reusable-box stock sheets",roofReusePlan.stockCount,"N"),
        M("Cuts assigned to already opened stock",roofReusePlan.reusedCutCount,"N"),
        M("Reuse-layout unallocated free stock",roofReusePlan.freeAreaSqIn/144,"FT2"),
        M("Reuse-layout within-box polygon scrap",roofReusePlan.cornerScrapAreaSqIn/144,"FT2"),
        M("Reuse-layout split-line loss",roofReusePlan.kerfAreaSqIn/144,"FT2")
      ]:[])
    ],[],large,rows,"roof-panels",{
      roofMajor:large,roofMinor:small,roofFactor:factor,
      roofPanels:panels,sheetAlong,sheetUphill,
      roofReusePlan,roofReuseMode:a.reuseMode,
      stockAreaSqIn:stockArea,coveredAreaSqIn:tiledArea,offcutAreaSqIn:offcuts
    });
  }
  case "wall-stud-calculator":{
    positive("length","spacing","height","studWidth");nonnegative("plates");
    need(a.height>a.plates,"Plate deduction leaves no cut length.");
    xs=studCenters(a.length,a.spacing,a.studWidth);
    rows=xs.map((x,i)=>({
      item:"Stud "+(i+1),position:q(x),cutLength:q(a.height-a.plates),
      grossHeight:q(a.height),bottomElevation:0,topElevation:q(a.height-a.plates),
      faceLeft:q(x-a.studWidth/2),faceRight:q(x+a.studWidth/2)
    }));
    return result([
      M("Stud count",xs.length,"N"),M("Cut length",a.height-a.plates),
      M("Plate deduction",a.plates),M("Final bay size",xs.at(-1)-xs.at(-2))
    ],rows.map(r=>({...P(r.position,r.item),topHeight:r.cutLength,cutLength:r.cutLength})),
    a.length,rows,"wall-studs",{
      studRows:rows,wallHeight:a.height,studWidth:a.studWidth
    });
  }
  case "shelf-spacing-calculator":{
    positive("height","thickness","caseDepth");
    nonnegative("top","bottom","frontPinInset","backPinInset",
      "pinCenterDrop","pinHoleDiameter");
    whole("shelves");
    // Top/bottom are reserved minimum clearances, not final equalized gaps.
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
    need(rows.at(-1).shelfTop<=a.height+1e-7,
      "Last shelf exceeds the interior height.");
    // A zero hole diameter is the intentionally OFF mode. It leaves the
    // original shelf-face rows, CSV, and spacing calculations untouched.
    // No hardware dimensions are ever assumed from the shelf thickness.
    const hasPins=a.pinHoleDiameter>0,rad=a.pinHoleDiameter/2;
    let shelfPinRows=[],sidePanelHoles=[],pinFrontX=null,pinBackX=null;
    if(hasPins){
      need(a.shelves<=100,
        "Support-hole grid is limited to 100 shelves / 400 holes.");
      need(a.frontPinInset+1e-8>=rad&&a.backPinInset+1e-8>=rad,
        "Support pin circles extend beyond a cabinet front/back edge.");
      pinFrontX=a.frontPinInset;
      pinBackX=a.caseDepth-a.backPinInset;
      need(pinBackX-pinFrontX>=a.pinHoleDiameter-1e-8,
        "Front and back support pin holes overlap or cannot fit the cabinet depth.");
      need(a.pinCenterDrop+1e-8>=rad,
        "Pin-hole center drop must keep each circle below its shelf underside.");
      sidePanelHoles=rows.flatMap((r,i)=>{
        const y=r.shelfBottom-a.pinCenterDrop;
        const previousTop=i===0?0:rows[i-1].shelfTop;
        need(y-rad>=previousTop-1e-8,
          "Shelf support pin circles extend into the preceding shelf or case floor.");
        need(y+rad<=r.shelfBottom+1e-8,
          "Shelf support pin circles extend above their shelf underside.");
        return [
          {shelfNumber:i+1,position:"Front",x:q(pinFrontX),y:q(y)},
          {shelfNumber:i+1,position:"Back",x:q(pinBackX),y:q(y)}
        ];
      });
      shelfPinRows=sidePanelHoles.flatMap(h=>["Left","Right"].map(panel=>({
        shelfNumber:h.shelfNumber,panel,position:h.position,
        centerX:h.x,centerY:h.y,holeDiameter:q(a.pinHoleDiameter),
        faceFrontEdge:q(h.x-rad),faceBackEdge:q(h.x+rad),
        faceBottomEdge:q(h.y-rad),faceTopEdge:q(h.y+rad),
        undersideClearance:q(a.pinCenterDrop-rad)
      })));
      need(shelfPinRows.length===a.shelves*4,
        "Shelf side-panel support-hole count mismatch.");
      need(shelfPinRows.every(r=>
        r.faceFrontEdge>=-1e-7&&r.faceBackEdge<=a.caseDepth+1e-7&&
        r.faceBottomEdge>=-1e-7&&r.faceTopEdge<=a.height+1e-7),
        "Shelf pin drilled circles exceed the measured side-panel boundaries.");
    }
    const measurements=[
      M("Shared base clear gap",shared),M("Actual bottom clearance",lower),
      M("Actual top clearance",upper),M("Shelf count",a.shelves,"N"),
      M("Shelf stack thickness",a.shelves*a.thickness)
    ];
    if(hasPins)measurements.push(
      M("Support drill holes (both side panels)",shelfPinRows.length,"N"),
      M("Front support-hole center X",pinFrontX),
      M("Back support-hole center X",pinBackX),
      M("Support-hole center drop",a.pinCenterDrop),
      M("Support-hole face diameter",a.pinHoleDiameter)
    );
    return result(measurements,rows.map(r=>P(r.shelfBottom,r.item)),
      a.height,rows,"shelves",{
        shelfThickness:a.thickness,
        interiorHeight:a.height,caseDepth:a.caseDepth,
        shelfRows:rows,shelfPinEnabled:hasPins,
        shelfPinRows,sidePanelHoles,
        supportHoleDiameter:a.pinHoleDiameter,
        supportFrontX:pinFrontX,supportBackX:pinBackX,
        supportCenterDrop:a.pinCenterDrop
      });
  }
  case "gable-roof-calculator":{
    positive("width","length");nonnegative("pitch","overhang");
    const run=a.width/2+a.overhang,rise=run*a.pitch/12,line=Math.hypot(run,rise),roofLen=a.length+2*a.overhang;
    return result([M("Half-span run",run),M("Roof rise",rise),M("Each slope length",line),M("Total roof surface",2*line*roofLen/144,"FT2")],[],run,[],"triangle",{run,rise});
  }
  case "square-layout-calculator":{
    positive("width","length","measuredA","measuredB");nonnegative("tolerance");
    // From two diagonals alone, even equality does not establish actual
    // perpendicular corners or the real shape of the four-sided layout.
    // Report only comparisons to the theoretical Pythagorean target.
    const d=Math.hypot(a.width,a.length);
    const errA=a.measuredA-d,errB=a.measuredB-d;
    const spread=Math.abs(a.measuredA-a.measuredB);
    const within=v=>v<=a.tolerance+1e-9;
    const row=(item,target,measured,error)=>({
      item,targetDiagonal:q(target),measuredDiagonal:q(measured),
      signedError:q(error),absoluteError:q(Math.abs(error)),
      allowedDeviation:q(a.tolerance),
      checkResult:within(Math.abs(error))?"Within stated tolerance":"Outside stated tolerance"
    });
    rows=[
      row("Diagonal A",d,a.measuredA,errA),
      row("Diagonal B",d,a.measuredB,errB),
      row("A vs B spread",0,spread,spread)
    ];
    const withinCount=rows.filter(x=>x.checkResult==="Within stated tolerance").length;
    return result([
      M("Ideal right-angle diagonal",d),
      M("Diagonal A error",errA),M("Diagonal B error",errB),
      M("Difference between measured diagonals",spread),
      M("Maximum absolute diagonal target error",Math.max(Math.abs(errA),Math.abs(errB))),
      M("Chosen diagonal check tolerance",a.tolerance),
      M("Numeric checks within tolerance (of 3)",withinCount,"N")
    ],[],Math.max(a.width,a.length),rows,"rectangle",{
      rectWidth:a.width,rectHeight:a.length,idealDiagonal:d,
      measuredA:a.measuredA,measuredB:a.measuredB,
      diagonalTolerance:a.tolerance,withinCount
    });
  }
  case "diagonal-brace-calculator":{
    positive("width","height");nonnegative("setback");
    // The two entered offsets locate the ORIGINAL brace centerline endpoints
    // in a right-handed layout: (0,0) to (width,height). Both end setbacks
    // are distances measured ALONG that centerline, not X or Y face offsets.
    const full=Math.hypot(a.width,a.height),cutLength=full-2*a.setback;
    need(cutLength>=1e-7,
      "Usable brace centerline is below layout resolution; reduce end setbacks.");
    const scale0=a.setback/full,scale1=(full-a.setback)/full;
    const start={x:q(a.width*scale0),y:q(a.height*scale0)};
    const finish={x:q(a.width*scale1),y:q(a.height*scale1)};
    need(Math.hypot(finish.x-start.x,finish.y-start.y)>=1e-7,
      "Brace cut endpoints collapse at coordinate precision; reduce setbacks.");
    rows=[
      {item:"Cut start",stationAlongFullLine:q(a.setback),
        horizontalX:start.x,verticalY:start.y},
      {item:"Cut finish",stationAlongFullLine:q(full-a.setback),
        horizontalX:finish.x,verticalY:finish.y}
    ];
    return result([
      M("Full centerline",full),
      M("After end setbacks",cutLength),
      M("Brace angle",deg(Math.atan2(a.height,a.width)),"A"),
      M("Cut horizontal projection",a.width*cutLength/full),
      M("Cut vertical projection",a.height*cutLength/full)
    ],[],a.width,rows,"brace",{
      braceRun:a.width,braceRise:a.height,braceFullLength:full,
      braceCutLength:cutLength,braceAngle:deg(Math.atan2(a.height,a.width)),
      braceCutStart:start,braceCutFinish:finish,
      braceCutRows:rows,braceSetback:a.setback
    });
  }
  case "hole-spacing-calculator":{
    positive("length","diameter","boardWidth");nonnegative("edge","crossSetback");
    whole("holes",2,500);whole("rowCount",1,20);
    // Guard against a 10k-circle preview and oversized CSV. Existing
    // single-row workflows retain the original 500-hole maximum.
    need(a.holes*a.rowCount<=600,
      "Drilling grid exceeds 600 holes; reduce row count or holes per row.");
    // Both dimensions are measured on the FLAT board face. The entered
    // end setback is always to the first/last CENTER, not the hole edge.
    need(a.edge+1e-9>=a.diameter/2&&2*a.edge<a.length,
      "Hole edges extend outside stock.");
    need(a.boardWidth+1e-9>=a.diameter,
      "Hole diameter exceeds the measured board face width.");
    g=(a.length-2*a.edge)/(a.holes-1);
    need(g+1e-9>=a.diameter,
      "Holes overlap at the requested count.");
    const margin=a.edge-a.diameter/2,gap=g-a.diameter;
    xs=Array.from({length:a.holes},(_,i)=>a.edge+i*g);
    // A solitary drilling row is centered across the measured width;
    // crossSetback only applies to two or more aligned drilling rows.
    const multi=a.rowCount>1;
    const transversePitch=multi?
      (a.boardWidth-2*a.crossSetback)/(a.rowCount-1):0;
    if(multi){
      need(a.crossSetback+1e-9>=a.diameter/2 &&
        2*a.crossSetback<a.boardWidth,
        "Crosswise row centers must fit the board face width.");
      need(transversePitch+1e-9>=a.diameter,
        "Drilling rows overlap; increase face width or reduce row count.");
    }
    const ys=Array.from({length:a.rowCount},(_,i)=>multi?
      a.crossSetback+i*transversePitch:a.boardWidth/2);
    const sideMargin=multi?a.crossSetback-a.diameter/2:
      (a.boardWidth-a.diameter)/2;
    need(sideMargin>=-1e-8,
      "Drilled circles extend outside the board side edges.");
    rows=ys.flatMap((y,ri)=>xs.map((x,ci)=>{
      const base={
        item:multi?"Row "+(ri+1)+" hole "+(ci+1):"Hole "+(ci+1),
        center:q(x),
        holeLeftEdge:q(x-a.diameter/2),
        holeRightEdge:q(x+a.diameter/2),
        diameter:q(a.diameter),
        clearToPrevious:ci===0?null:q(Math.max(0,gap))
      };
      // Do not silently change the original single-row CSV column layout.
      if(!multi)return base;
      return {...base,rowNumber:ri+1,columnNumber:ci+1,
        centerY:q(y),holeBottomEdge:q(y-a.diameter/2),
        holeTopEdge:q(y+a.diameter/2),
        clearToPreviousRow:ri===0?null:q(Math.max(0,transversePitch-a.diameter))};
    }));
    need(rows.every(r=>r.holeLeftEdge>=-1e-7&&
      r.holeRightEdge<=a.length+1e-7),
      "Drilled hole outside the board end reference.");
    const holeCenters=ys.flatMap((y,ri)=>xs.map((x,ci)=>({
      x:q(x),y:q(y),row:ri+1,column:ci+1,
      item:rows[ri*a.holes+ci].item
    })));
    const metrics=[
      M("Hole center pitch",g),M("Clear material between holes",Math.max(0,gap)),
      M("End material margin",margin),M("Hole count",rows.length,"N"),
      M("Edge offset",a.edge),M("Drilling rows",a.rowCount,"N"),
      M("Measured board face width",a.boardWidth),
      M("Side material margin",Math.max(0,sideMargin))
    ];
    if(multi)metrics.push(
      M("Transverse center pitch",transversePitch),
      M("Clear material between rows",Math.max(0,transversePitch-a.diameter))
    );
    return result(metrics,xs.map((x,i)=>P(x,String(i+1))),a.length,rows,"holes",{
      holeDiameter:a.diameter,holeClearance:Math.max(0,gap),
      endMaterialMargin:margin,boardWidth:a.boardWidth,
      drillRows:a.rowCount,holesPerRow:a.holes,holeCenters,
      crossCenters:ys.map(q),transversePitch,
      transverseClearance:multi?Math.max(0,transversePitch-a.diameter):null,
      sideMaterialMargin:Math.max(0,sideMargin)
    });
  }
  case "stair-stringer-calculator":{
    positive("rise","tread","depth");whole("risers",2,200);
    nonnegative("treadThickness","lowerFinish","nosing","upperLandingDepth",
      "lowerSupportRun","upperSupportRun",
      "lowerEndCutRun","upperEndCutRun","measuredBlankLength","blankEndAllowance");
    need(a.nosing<a.tread,"Tread nose projection must be smaller than the horizontal tread run.");
    const h=a.rise/a.risers,run=(a.risers-1)*a.tread;
    need(a.lowerSupportRun<=run&&a.upperSupportRun<=run,
      "Support reference lengths cannot exceed the nominal straight-flight horizontal run.");
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
      treadEnd:i<a.risers-1?q((i+1)*a.tread):null,
      ...(a.nosing>0&&i<a.risers-1?{
        noseStart:q(i*a.tread-a.nosing),noseEnd:q(i*a.tread)
      }:{}),
      ...(a.upperLandingDepth>0&&i===a.risers-1?{
        landingReferenceEnd:q(run+a.upperLandingDepth)
      }:{})
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
    const noseReferences=a.nosing>0?rows.slice(0,-1).map(r=>({
      item:r.item,noseStart:r.noseStart,noseEnd:r.noseEnd,
      rise:r.riserTopHeight
    })):[];
    need(noseReferences.every(r=>r.noseEnd-r.noseStart>=a.nosing-1e-7),
      "Tread nose coordinate drift exceeds the modeled projection.");
    // Modeled SIDE SECTION: a nominal upper pitch line and a parallel
    // lower edge offset by the entered normal board depth. Clip at the
    // first/last riser X datums. The clip ends are NOT physical bearing cuts.
    const pitchSlope=h/a.tread,normalFactor=Math.hypot(1,pitchSlope);
    const lowerEdgeAt=x=>h+pitchSlope*x-a.depth*normalFactor;
    const lowerAtStart=lowerEdgeAt(0),lowerAtTop=lowerEdgeAt(run);
    const envelopeVertices=[
      ...stepVertices,
      {x:q(run),y:q(lowerAtTop)},
      {x:0,y:q(lowerAtStart)}
    ];
    const envelopeArea2=envelopeVertices.reduce((s,v,i)=>{
      const next=envelopeVertices[(i+1)%envelopeVertices.length];
      return s+v.x*next.y-next.x*v.y;
    },0);
    const envelopeAreaSqIn=Math.abs(envelopeArea2)/2;
    const analyticAreaSqIn=run*(a.depth*normalFactor-h/2);
    need(envelopeVertices.length===2*a.risers+2&&
      Math.abs(envelopeAreaSqIn-analyticAreaSqIn)<=
        Math.max(1e-5,Math.abs(analyticAreaSqIn)*1e-8),
      "Modeled stringer section polygon does not conserve analytical area.");
    const minThroatFromVertices=Math.min(...stepVertices.filter((_,i)=>i%2===0)
      .map(v=>(v.y-lowerEdgeAt(v.x))/normalFactor));
    need(Math.abs(minThroatFromVertices-throat)<=
      Math.max(1e-7,Math.abs(throat)*1e-8),
      "Modeled notch corners do not conserve the minimum normal throat.");
    // Surface segments are explicitly OUTSIDE the clipped stock model.
    // These are measured datum references, not support/bearing cut designs.
    const supportReferences=[
      ...(a.lowerSupportRun>0?[{
        item:"Lower horizontal support surface reference",startX:q(-a.lowerSupportRun),
        endX:0,elevation:0
      }]:[]),
      ...(a.upperSupportRun>0?[{
        item:"Upper horizontal support surface reference",startX:q(run),
        endX:q(run+a.upperSupportRun),elevation:q(a.rise)
      }]:[])
    ];
    const stringerEnvelopeRows=envelopeVertices.map((v,i)=>({
      index:i+1,boundary:i<stepVertices.length?"Nominal notch profile":
        "Parallel lower reference edge",
      x:v.x,elevation:v.y
    }));
    // Each NOMINAL saw tooth leg is exported as two real (X,Y) endpoints.
    // These are line segments on the notch reference; wood-grade and saw
    // depth/overcut are NOT inferred. The two optional timber end planes
    // are specified by a field-measured lower-edge horizontal intersection.
    const stringerCutLineRows=stepVertices.slice(1).map((end,i)=>{
      const start=stepVertices[i];
      const dx=end.x-start.x,dy=end.y-start.y;
      const vertical=Math.abs(dx)<1e-8;
      return {item:(vertical?"Riser sawline ":"Tread sawline ")+(i+1),
        index:i+1,cutType:vertical?"Riser":"Tread",
        startX:start.x,startY:start.y,endX:end.x,endY:end.y,
        cutLength:q(Math.hypot(dx,dy)),
        cutAngleDeg:q(deg(Math.atan2(dy,dx)))};
    });
    const measuredEndCuts=[];
    const selectedEnds=[
      {role:"Lower",extension:a.lowerEndCutRun,
        start:{x:0,y:0},x:-a.lowerEndCutRun},
      {role:"Upper",extension:a.upperEndCutRun,
        start:stepVertices.at(-1),x:run+a.upperEndCutRun}
    ];
    for(const end of selectedEnds){
      if(end.extension<=0)continue;
      const y=lowerEdgeAt(end.x);
      need(end.role==="Lower"?y<0:y<a.rise,
        end.role+" chosen cut endpoint crosses the upper stair notch profile; reduce horizontal extension.");
      const endpoint={x:q(end.x),y:q(y)};
      const dx=endpoint.x-end.start.x,dy=endpoint.y-end.start.y;
      measuredEndCuts.push({item:end.role+" user-chosen end line",
        startX:end.start.x,startY:end.start.y,
        endX:endpoint.x,endY:endpoint.y,
        cutLength:q(Math.hypot(dx,dy)),
        cutAngleDeg:q(deg(Math.atan2(dy,dx))),
        cutType:"Measured reference – NOT bearing approved"});
    }
    const lowerSelected=measuredEndCuts.find(r=>r.item.startsWith("Lower"));
    const upperSelected=measuredEndCuts.find(r=>r.item.startsWith("Upper"));
    const stockAxisProfile=[
      ...stepVertices,
      {x:upperSelected?.endX??q(run),y:upperSelected?.endY??q(lowerAtTop)},
      {x:lowerSelected?.endX??0,y:lowerSelected?.endY??q(lowerAtStart)}
    ];
    const angle=Math.atan2(h,a.tread),cs=Math.cos(angle),sn=Math.sin(angle);
    const longitudinal=stockAxisProfile.map(p=>p.x*cs+(p.y-h)*sn);
    const minStockAxis=Math.min(...longitudinal),maxStockAxis=Math.max(...longitudinal);
    const stockAxisSpan=maxStockAxis-minStockAxis,
      requiredBlankAxis=stockAxisSpan+2*a.blankEndAllowance;
    const stockFitsModel=a.measuredBlankLength>0?
      a.measuredBlankLength+1e-8>=requiredBlankAxis:null;
    // Use a true PITCH-ALIGNED coordinate basis for an idealized rectangular
    // raw blank: longitudinal u=(x,y-h)·(cos,sin); normal
    // v=(x,y-h)·(-sin,cos), so upper uncut stock edge is v=0 and its
    // parallel lower edge is v=-stock normal depth.
    // This does NOT imply any actual supplier board or safe bearing cut.
    const normalStations=stockAxisProfile.map(p=>-p.x*sn+(p.y-h)*cs);
    const minNormalStation=Math.min(...normalStations),
      maxNormalStation=Math.max(...normalStations);
    need(minNormalStation>=-a.depth-1e-6&&maxNormalStation<=1e-6,
      "Selected step/end geometry exceeds the modeled normal stock depth.");
    const blankLengthShown=a.measuredBlankLength>0?
      a.measuredBlankLength:requiredBlankAxis;
    const axisMid=(minStockAxis+maxStockAxis)/2;
    const blankStartAxis=axisMid-blankLengthShown/2,
      blankEndAxis=axisMid+blankLengthShown/2;
    const blankCorner=(u,v)=>({
      x:q(u*cs-v*sn),
      y:q(h+u*sn+v*cs)
    });
    const blankCornerAxes=[
      [blankStartAxis,0],[blankEndAxis,0],
      [blankEndAxis,-a.depth],[blankStartAxis,-a.depth]
    ];
    const stringerBlankVertices=blankCornerAxes.map(([u,v])=>blankCorner(u,v));
    const stringerBlankRows=stringerBlankVertices.map((p,i)=>({
      item:"Reference stock corner "+(i+1),
      axisStation:q(blankCornerAxes[i][0]),
      normalOffset:q(blankCornerAxes[i][1]),
      x:p.x,elevation:p.y
    }));
    const rectangleArea=Math.abs(stringerBlankVertices.reduce((sum,p,i)=>{
      const b=stringerBlankVertices[(i+1)%stringerBlankVertices.length];
      return sum+p.x*b.y-b.x*p.y;
    },0))/2;
    need(Math.abs(rectangleArea-a.depth*blankLengthShown)<=
      Math.max(1e-5,rectangleArea*1e-8),
      "Pitch-aligned raw stock rectangle does not conserve its measured area.");
    // Independent user-measured horizontal SITE SUPPORT REFERENCES are
    // merely checked against projected end X stations. Neither a pass
    // nor fail establishes actual contact on any slope or load capacity.
    const endProjectionChecks=selectedEnds.filter(end=>
      end.extension>0&&(end.role==="Lower"?a.lowerSupportRun:a.upperSupportRun)>0
    ).map(end=>{
      const supportRun=end.role==="Lower"?a.lowerSupportRun:a.upperSupportRun;
      const projectedOutside=q(Math.max(0,end.extension-supportRun));
      return {
        item:end.role+" projected end / surface",
        chosenHorizontalExtension:q(end.extension),
        measuredSupportReferenceRun:q(supportRun),
        projectedEndX:q(end.x),
        projectedOutsideSupport:projectedOutside,
        projectionStatus:projectedOutside>1e-7?"Outside reference":"Inside reference",
        note:"X projection only; NOT bearing, fit or fastener approval"
      };
    });
    const outOfSupport=endProjectionChecks.filter(row=>
      row.projectedOutsideSupport>1e-7).length;
    // This is only a projected length AND normal-width fit of a 2D
    // schematic. A real raw blank must be independently positioned,
    // inspected and accepted by an appropriate construction professional.
    return result([
      M("Uniform riser height",h),M("Treads",a.risers-1,"N"),
      M("Total horizontal run",run),
      M("Tread nosing reference",a.nosing),
      M("Upper landing reference depth",a.upperLandingDepth),
      M("Total horizontal planning reach",run+a.upperLandingDepth),
      M("Notch pitch-line reference",pitchLine),
      M("Floor-to-floor diagonal (not a cut length)",floorDiagonal),
      M("Bottom riser layout cut",bottomLayoutRise),
      M("Notch penetration (normal)",normalNotch),
      M("Uncut throat (nominal)",throat),
      M("Modeled section minimum throat",minThroatFromVertices),
      M("Modeled section face area",envelopeAreaSqIn/144,"FT2"),
      M("Lower support surface reference run",a.lowerSupportRun),
      M("Upper support surface reference run",a.upperSupportRun),
      M("Nominal sawline segments",stringerCutLineRows.length,"N"),
      M("Modeled stock-axis length envelope",stockAxisSpan),
      M("Axis envelope plus chosen trim allowances",requiredBlankAxis),
      M("Reference blank rectangle normal width",a.depth),
      M("Reference blank rectangle longitudinal length",blankLengthShown),
      M("Reference blank rectangle area",rectangleArea/144,"FT2"),
      ...(endProjectionChecks.length?[
        M("Measured end projections outside support references",outOfSupport,"N")
      ]:[]),
      ...(a.measuredBlankLength>0?[
        M("Measured raw stock length",a.measuredBlankLength),
        M("Raw stock meets geometric length envelope",stockFitsModel?1:0,"N")
      ]:[])
    ],rows.map(r=>P(r.horizontalRun,r.item)),Math.max(run,1),rows,"stringer",
    {stepRise:h,tread:a.tread,risers:a.risers,totalRise:a.rise,
      throat,bottomLayoutRise,notchNormal:normalNotch,
      pitchLine,floorDiagonal,stepVertices,noseReferences,
      nosingProjection:a.nosing,landingDepth:a.upperLandingDepth,
      landingReferenceEnd:run+a.upperLandingDepth,
      lowerEdgeAtStart:q(lowerAtStart),lowerEdgeAtTop:q(lowerAtTop),
      stockNormalDepth:a.depth,stockEnvelopeVertices:envelopeVertices,
      stringerEnvelopeRows,envelopeAreaSqIn,minThroatFromVertices,
      supportReferences,lowerSupportRun:a.lowerSupportRun,
      upperSupportRun:a.upperSupportRun,
      lowerEndCutRun:a.lowerEndCutRun,upperEndCutRun:a.upperEndCutRun,
      measuredEndCuts,stringerCutLineRows,stockAxisProfile,
      stockAxisSpan,requiredBlankAxis,stockFitsModel,
      measuredBlankLength:a.measuredBlankLength,blankEndAllowance:a.blankEndAllowance,
      stringerBlankRows,stringerBlankVertices,blankLengthShown,
      blankStartAxis,blankEndAxis,minNormalStation,maxNormalStation,
      endProjectionChecks,outOfSupport});
  }
  case "roof-sheathing-calculator":{
    positive("width","length","sheetWidth","sheetLength");nonnegative("pitch","waste","roofKerf");whole("orientation",0,1);whole("reuseMode",0,1);
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
      // Keep absolute cut-box endpoints as well as nominal lengths:
      // these can be independently cross-checked against adjacent sheets.
      // Used and unused stock areas are evaluated BEFORE display rounding.
      const cutAreaSqIn=cutAlong*cutUphill;
      sheets.push({
        id:"S"+(sheets.length+1),row:row+1,column:col+1,
        eaveStart:q(eaveStart),eaveEnd:q(eaveStart+cutAlong),
        slopeStart:q(slopeStart),slopeEnd:q(slopeStart+cutUphill),
        cutAlong:q(cutAlong),cutUphill:q(cutUphill),cutAreaSqIn,
        offcutAreaSqIn:Math.max(0,per-cutAreaSqIn),
        full:Math.abs(cutAlong-along)<1e-8&&Math.abs(cutUphill-uphill)<1e-8
      });
    }
    const coverage=sheets.reduce((sum,s)=>sum+s.cutAreaSqIn,0);
    need(Math.abs(coverage-area)<=Math.max(1e-6,area*1e-8),"Sheet positions do not conserve the sloped roof area.");
    const offcuts=sheets.reduce((sum,s)=>sum+s.offcutAreaSqIn,0);
    const stockArea=sheets.length*per;
    need(Math.abs(coverage+offcuts-stockArea)<=Math.max(1e-6,stockArea*1e-10),
      "Roof sheathing used area and discarded offcuts do not conserve the stock area.");
    const full=sheets.filter(s=>s.full).length;
    const roofReusePlan=a.reuseMode===1?packRoofCutBoxes(
      sheets.map(s=>({id:s.id,row:s.row,column:s.column,
        width:s.cutAlong,height:s.cutUphill,actualArea:s.cutAreaSqIn,
        vertices:[[0,0],[s.cutAlong,0],[s.cutAlong,s.cutUphill],[0,s.cutUphill]]
      })),along,uphill,a.roofKerf):null;
    need(!roofReusePlan||roofReusePlan.stockCount<=sheets.length,
      "Rectangular roof reuse plan cannot exceed the original one-sheet-per-cut grid.");
    const cutRows=sheets.map(s=>({
      item:s.id,row:s.row,column:s.column,
      eaveStart:s.eaveStart,eaveEnd:s.eaveEnd,
      slopeStart:s.slopeStart,slopeEnd:s.slopeEnd,
      cutAlong:s.cutAlong,cutUphill:s.cutUphill,
      cutAreaFt2:s.cutAreaSqIn/144,offcutAreaFt2:s.offcutAreaSqIn/144
    }));
    return result([
      M("Sloped roof surface",area/144,"FT2"),
      M("Sheet geometric lower bound",ceilStable(area/per),"N"),
      M("Sheet positions (no offcut reuse)",sheets.length,"N"),
      M("Full sheets",full,"N"),M("Edge-cut sheets",sheets.length-full,"N"),
      M("Order sheets with allowance",ceilStable(sheets.length*(1+a.waste/100)),"N"),
      M("Stock face area before allowance",stockArea/144,"FT2"),
      M("Unreused offcut area",offcuts/144,"FT2"),
      ...(roofReusePlan?[
        M("Bounded reusable-box stock sheets",roofReusePlan.stockCount,"N"),
        M("Cuts assigned to already opened stock",roofReusePlan.reusedCutCount,"N"),
        M("Reuse-layout unallocated free stock",roofReusePlan.freeAreaSqIn/144,"FT2"),
        M("Reuse-layout split-line loss",roofReusePlan.kerfAreaSqIn/144,"FT2"),
        M("Order sheets after reuse and allowance",
          ceilStable(roofReusePlan.stockCount*(1+a.waste/100)),"N")
      ]:[])
    ],[],eaveLength,cutRows,"sheathing-panels",
    {roofEave:eaveLength,roofSlope:uphillLength,roofSheets:sheets,
      roofReusePlan,roofReuseMode:a.reuseMode,
      sheetAlong:along,sheetUphill:uphill,stockAreaSqIn:stockArea,
      coveredAreaSqIn:coverage,offcutAreaSqIn:offcuts});
  }
  case "fence-post-calculator":{
    positive("length","bay","post");
    // The entered run is end-post CENTER to end-post CENTER.
    // Physical faces extend beyond both end-center datums by half a post.
    const bays=ceilStable(a.length/a.bay);
    need(bays>=1&&bays<=500,"Number of bays exceeds the supported layout.");
    const interval=a.length/bays,clear=interval-a.post;
    need(clear>=1e-7,"Post faces overlap, touch, or have an unresolvable clear bay. Reduce post width or increase the center span.");
    xs=Array.from({length:bays+1},(_,i)=>i*interval);
    rows=xs.map((center,i)=>({
      item:"Post "+(i+1),center:q(center),
      faceLeft:q(center-a.post/2),faceRight:q(center+a.post/2),
      clearBayToNext:i<bays?q(clear):null
    }));
    const outsideLength=a.length+a.post;
    need(Math.abs((bays+1)*a.post+bays*clear-outsideLength)<=Math.max(1e-7,outsideLength*1e-10),
      "Fence post faces and clear bays do not close to outside-to-outside length.");
    need(rows.every(row=>row.faceRight>row.faceLeft),
      "Post faces collapse at cut-coordinate precision.");
    return result([
      M("Bays",bays,"N"),M("Posts",bays+1,"N"),
      M("True OC interval",interval),M("Approximate clear bay",clear),
      M("Outside-to-outside fence length",outsideLength),
      M("Total post face widths",(bays+1)*a.post),
      M("Total usable clear bays",bays*clear)
    ],xs.map(x=>P(x)),a.length,rows,"posts",
    {itemWidth:a.post,faceRows:rows,outsideLength});
  }
  default:throw new Error("Calculator not implemented: "+slug);
  }
}
export function safeCompute(slug,inputs){try{return {ok:true,data:compute(slug,inputs)}}catch(err){return {ok:false,error:err instanceof Error?err.message:"Calculation failed"}}}
