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

const unitToInches={in:1,ft:12,mm:1/25.4,cm:10/25.4,m:1000/25.4};
export const convertToInches=(value,units)=>value*(unitToInches[units]??1);
export const convertFromInches=(value,units)=>value/(unitToInches[units]??1);
export function compute(slug,a){
  a={wallHeight:96,bottomPlate:1.5,topPlate:3,studWidth:1.5,headerDepth:5.5,sillThickness:1.5,studStockLength:96,headerStockLength:96,sillStockLength:96,stockKerf:0.125,stockWaste:0,studUnitPrice:0,headerUnitPrice:0,sillUnitPrice:0,studAltStockLength:120,studAltUnitPrice:0,studAlt2StockLength:144,studAlt2UnitPrice:0,headerAltStockLength:120,headerAltUnitPrice:0,headerAlt2StockLength:144,headerAlt2UnitPrice:0,sillAltStockLength:120,sillAltUnitPrice:0,sillAlt2StockLength:144,sillAlt2UnitPrice:0,openingSill:0,opening2Start:0,opening2Width:0,opening2Height:40,opening2Sill:36,opening3Start:0,opening3Width:0,opening3Height:40,opening3Sill:36,orientation:0,tolerance:0.125,...a};
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
    const stockPlan=[],stockCuts=[],materialSummary=[],purchaseVariants=[];
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
      const fitting=available.filter(o=>ordered.every(p=>p.cutLength<=o.stockLength+1e-8));
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
      const rated=candidates.map(candidate=>{
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
      });
      rated.sort((x,y)=>(x.purchaseCost??Infinity)-(y.purchaseCost??Infinity)||
        x.offcut-y.offcut||x.purchaseCount-y.purchaseCount||
        (x.kind==="single"?-1:1));
      const best=rated[0],bins=best.bars;
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
      allPricesEntered=unpricedGroups.length===0;
    need(Math.abs(quotedPlanned+quotedReserve-quotedSubtotal)<1e-5,
      "Material subtotal does not reconcile to planned and reserve costs.");
    const costSummary={
      allPricesEntered,unpricedGroups,quotedSubtotal,quotedPlanned,quotedReserve,
      pricedGroups:materialSummary.filter(r=>r.quoted&&r.purchaseSticks>0).length,
      requiredGroups:materialSummary.filter(r=>r.purchaseSticks>0).length
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
      studRows:fullRows,framingRows,materialSummary,stockPlan,stockCuts,purchaseVariants,costSummary
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
    const schedule=[
      {item:"Ridge reference",horizontalRun:0,slopeDistance:0,verticalDrop:0},
      {item:"Bearing reference",horizontalRun:q(run),slopeDistance:q(line),verticalDrop:q(rise)},
      {item:"Overhang end",horizontalRun:q(run+a.overhang),slopeDistance:q(line+over),verticalDrop:q(rise+a.overhang*slope)}
    ];
    return result([
      M("Adjusted run",run),M("Ridge centerline run before allowance",a.run),
      M("Rise",rise),M("Rafter reference length",line),
      M("Overhang slope length",over),M("Total slope to tail",line+over),
      M("Total horizontal run to tail",run+a.overhang),
      M("Plumb cut angle",ref.angle,"A"),M("Seat reference drop",heel),
      M("Seat notch (normal depth)",notchNormal),M("Remaining stock (normal)",remaining),
      M("Notch / stock depth",100*notchNormal/a.depth,"D")
    ],schedule.map(r=>P(r.horizontalRun,r.item)),run+a.overhang,schedule,"rafter",
    {rise,run,seat:a.seat,overhang:a.overhang,stockDepth:a.depth,
      notchNormal,pitch:a.pitch,roofSlope:slope,
      totalHorizontalRun:run+a.overhang,totalRise:rise+tail.rise,
      referencePoints:schedule});
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
    positive("length");nonnegative("left","right");whole("count");
    need(a.left+a.right<a.length,"Offsets consume the available length.");
    const p=a.count===1?0:(a.length-a.left-a.right)/(a.count-1);
    xs=Array.from({length:a.count},(_,i)=>a.count===1?(a.left+a.length-a.right)/2:a.left+i*p);
    rows=xs.map((x,i)=>({item:"Center "+(i+1),position:q(x)}));
    return result([M("Centers",a.count,"N"),M("Equal center interval",p),M("Usable length",a.length-a.left-a.right)],xs.map(x=>P(x)),a.length,rows);
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
    positive("width","length","sheetWidth","sheetLength");nonnegative("pitch","overhang");whole("orientation",0,1);
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
      M("Unreused stock area",offcuts/144,"FT2")
    ],[],large,rows,"roof-panels",{
      roofMajor:large,roofMinor:small,roofFactor:factor,
      roofPanels:panels,sheetAlong,sheetUphill,
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
      M("Unreused offcut area",offcuts/144,"FT2")
    ],[],eaveLength,cutRows,"sheathing-panels",
    {roofEave:eaveLength,roofSlope:uphillLength,roofSheets:sheets,
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
