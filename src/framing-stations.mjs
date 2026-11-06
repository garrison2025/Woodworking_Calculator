/**
 * An inspectable STOCK-LOCAL STATION LEDGER for the optional Framing
 * offcut-reallocation alternative. This is a dimensional accounting
 * document, NOT a safe/ordered saw sequence or a machine toolpath.
 *
 * Never use the independently modelled reserve sticks as cut sources:
 * only plan.bars with already assigned, uniquely identified members.
 */
export function makeFramingStationLedger(plan,originalStockPlan){
  if(!plan?.enabled||!Array.isArray(plan.bars)||!plan.bars.length||
    !Array.isArray(plan.rows)||!plan.rows.length){
    return {available:false,rows:[],bars:[],memberCount:0,sourceCount:0,
      warning:"No complete, physically fitting alternative placement is available."};
  }
  if(plan.physicallyFits!==true ||
    !["reallocated","no-reduction"].includes(plan.status))
    throw Error("Station ledger refuses an unverified or blocked alternative.");
  const EPS=1e-7;
  const near=(a,b,reason)=>{
    if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>EPS)
      throw Error("Station ledger mismatch: "+reason+".");
  };
  if(!Array.isArray(originalStockPlan)||!originalStockPlan.length)
    throw Error("Station ledger requires the independent original cutting plan.");
  const originalStocks=new Map(),originalMembers=new Map();
  for(const bar of originalStockPlan){
    if(originalStocks.has(bar.stockId))
      throw Error("Station ledger original stock IDs are not unique.");
    originalStocks.set(bar.stockId,bar);
    for(const cut of bar.cuts||[]){
      const key=bar.stockGroup+"|"+cut.item;
      if(originalMembers.has(key))
        throw Error("Station ledger duplicate baseline member.");
      originalMembers.set(key,{stockId:bar.stockId,length:cut.cutLength});
    }
  }
  const rows=[],summaries=[],ids=new Set(),memberIds=new Set();
  const allRows=new Map();
  for(const member of plan.rows){
    const key=member.stockGroup+"|"+member.item;
    if(memberIds.has(key))throw Error("Station ledger duplicate installed member: "+key);
    memberIds.add(key);
    if(!allRows.has(member.stockId))allRows.set(member.stockId,[]);
    allRows.get(member.stockId).push(member);
  }
  const visitedMembers=new Set();
  for(const source of plan.bars){
    if(ids.has(source.stockId))throw Error("Station ledger duplicate source stock ID.");
    ids.add(source.stockId);
    const L=source.actualStockLength;
    const originalSource=originalStocks.get(source.stockId);
    if(!originalSource||originalSource.stockGroup!==source.stockGroup||
      Math.abs((originalSource.actualStockLength??originalSource.stockLength)-L)>1e-12)
      throw Error("Station ledger source profile/real length disagrees with baseline.");
    if(!Number.isFinite(L)||L<=0||!source.cuts?.length)
      throw Error("Station ledger needs a positive real source length and assigned pieces.");
    const first=source.cuts[0],trim=first.endTrim;
    if(!Number.isFinite(trim)||trim<0||trim>=L/2)
      throw Error("Station ledger invalid two-end trim.");
    const sever=source.finalSeverKerf;
    if(!Number.isFinite(sever)||sever<0)
      throw Error("Station ledger invalid last severing kerf.");
    let at=0,number=0,kept=0;
    const segment=(kind,start,end,item="",originalStockId="")=>{
      if(!Number.isFinite(start)||!Number.isFinite(end)||
        start<-EPS||end>L+EPS||end<start-EPS)
        throw Error("Station ledger segment overflows purchased stock.");
      near(start,at,"noncontiguous source segments");
      if(end-start<=1e-12){at=end;return;}
      number++;
      rows.push({
        stockGroup:source.stockGroup,stockId:source.stockId,
        offerLabel:source.offerLabel,index:number,
        segmentKind:kind,item,originalStockId,
        stationStart:start,stationEnd:end,
        segmentLength:end-start,stockLength:L,
        verification:"NOT FIELD VERIFIED"
      });
      at=end;
    };
    if(trim>0)segment("LEADING END TRIM",0,trim);
    for(const [i,cut] of source.cuts.entries()){
      const origin=allRows.get(source.stockId)?.[i];
      if(origin?.item!==cut.item||origin?.stockGroup!==source.stockGroup||
        origin?.originalStockId!==cut.originalStockId)
        throw Error("Station ledger disagrees with exported alternative placement.");
      const validIdentity=source.stockGroup+"|"+cut.item;
      const originalMember=originalMembers.get(validIdentity);
      if(!originalMember||originalMember.stockId!==cut.originalStockId||
        Math.abs(originalMember.length-cut.cutLength)>EPS)
        throw Error("Station ledger retained member differs from original cutting plan.");
      if(visitedMembers.has(validIdentity))
        throw Error("Station ledger repeats a retained cut.");
      visitedMembers.add(validIdentity);
      if(cut.stockId!==source.stockId ||
        !Number.isFinite(cut.cutStart)||!Number.isFinite(cut.cutEnd)||
        cut.cutEnd-cut.cutStart<=0||
        Math.abs(cut.cutEnd-cut.cutStart-cut.cutLength)>EPS)
        throw Error("Station ledger retained member position invalid.");
      near(cut.cutStart,at+cut.kerfBefore,"saw kerf before "+cut.item);
      if(i===0){
        near(cut.kerfBefore,0,"first cut cannot have earlier kerf");
      }else if(cut.kerfBefore>0){
        segment("BETWEEN-PIECE KERF",at,cut.cutStart);
      }
      segment("RETAINED MEMBER",cut.cutStart,cut.cutEnd,
        cut.item,cut.originalStockId);
      kept++;
    }
    const lastEnd=at;
    if(sever>0)segment("LAST SEPARATION KERF",at,at+sever);
    const tailEnd=L-trim;
    if(tailEnd<at-EPS)throw Error("Station ledger extra trim or saw kerf does not fit.");
    if(tailEnd>at+1e-12)segment("UNALLOCATED TAIL",at,tailEnd);
    if(trim>0)segment("TRAILING END TRIM",tailEnd,L);
    near(at,L,"every source inch must be accounted for");
    const original=source.usableOffcutLength;
    const expectedTail=Math.max(0,tailEnd-lastEnd-sever);
    near(original,expectedTail,"reclaimed tail mismatch");
    if(source.cuts.length!==kept)throw Error("Station ledger lost source members.");
    const sourceRows=rows.filter(x=>x.stockId===source.stockId);
    const sum=sourceRows.reduce((acc,x)=>acc+x.segmentLength,0);
    near(sum,L,"stock length conservation");
    summaries.push({
      stockGroup:source.stockGroup,stockId:source.stockId,
      offerLabel:source.offerLabel,stockLength:L,
      retainedPieces:kept,segmentCount:sourceRows.length,
      leadingEndTrim:trim,trailingEndTrim:trim,
      lastSeverKerf:sever,unallocatedTail:expectedTail,
      segmentTotal:sum,
      physicalStockChecked:false,profileGradeChecked:false,
      realBladeKerfChecked:false,defectAndClampChecked:false,
      note:"Unverified dimensional worksheet; not an authorized saw procedure."
    });
  }
  if(allRows.size!==ids.size||visitedMembers.size!==memberIds.size||
    memberIds.size!==originalMembers.size||
    [...originalMembers.keys()].some(x=>!visitedMembers.has(x))||
    [...memberIds].some(x=>!visitedMembers.has(x)))
    throw Error("Station ledger does not cover all reallocated members.");
  return {available:true,rows,bars:summaries,sourceCount:summaries.length,
    memberCount:visitedMembers.size,
    unverifiedSourceCount:summaries.length,
    warning:"Coordinates are 0-origin stock references, NOT a saw-operation order. Every physical source, actual kerf, grade/profile, defect and clamp setup requires independent inspection before cutting."};
}


/**
 * User-entered dimensional preflight for an ALREADY verified, optional
 * station ledger. Entries are never taken as actual shop measurements
 * until independently confirmed by a person; neither source quality nor
 * safe saw operation can be inferred from numeric fit.
 *
 * A null entry is PENDING, NEVER a zero-length/zero-kerf reading.
 * Recompute from intact member lengths, not from model segment stations,
 * so measured kerf/end-trim changes can invalidate a previously fitting bar.
 */
export function auditMeasuredFramingFits(ledger,sourceLengths={},{
  sawKerf=null,endTrim=null,finalSeverKerf=null
}={}){
  if(!ledger?.available||!Array.isArray(ledger.bars)||!Array.isArray(ledger.rows))
    return {available:false,rows:[],entered:0,fitting:0,short:0,
      pending:0,invalid:0,complete:false,
      note:"No verified modeled alternative stations to compare."};
  const settings={sawKerf,endTrim,finalSeverKerf};
  const invalidSetting=Object.entries(settings).find(([,v])=>
    v!==null&&(!Number.isFinite(v)||v<0||v>=1e8||
      (v>0&&v<1e-8)));
  const settingsReady=Object.values(settings).every(v=>Number.isFinite(v)&&
    v>=0&&(v===0||v>=1e-8)&&v<1e8);
  const getLength=id=>sourceLengths instanceof Map?
    sourceLengths.get(id):Object.prototype.hasOwnProperty.call(sourceLengths,id)?
      sourceLengths[id]:null;
  const rows=[];
  for(const source of ledger.bars){
    const measured=getLength(source.stockId);
    const entered=measured!==null&&measured!==undefined;
    const invalid=entered&&(!Number.isFinite(measured)||measured<=0||
      measured>=1e8||measured<1e-8);
    const pieces=ledger.rows.filter(x=>x.stockId===source.stockId&&
      x.segmentKind==="RETAINED MEMBER");
    if(pieces.length!==source.retainedPieces||!pieces.length||
      !pieces.every(x=>x.segmentLength>0&&Number.isFinite(x.segmentLength)))
      throw Error("Measured preflight cannot use a corrupted retained-member ledger.");
    const pieceLength=pieces.reduce((sum,x)=>sum+x.segmentLength,0);
    const initial=source.stockLength;
    let result={stockId:source.stockId,stockGroup:source.stockGroup,
      offerLabel:source.offerLabel,modelStockLength:initial,
      enteredLength:entered&&!invalid?measured:null,
      memberCount:pieces.length,retainedLength:pieceLength,
      requiredLength:null,modeledDelta:entered&&!invalid?measured-initial:null,
      actualUsableTail:null,shortfall:null,clearance:null,chargedLastKerf:null,
      status:"PENDING INPUT",claim:"DIMENSIONS ONLY — NOT FIELD CERTIFIED"};
    if(invalid||invalidSetting){
      result.status="INVALID INPUT";
    }else if(entered&&settingsReady){
      const retainedUsed=pieceLength+(pieces.length-1)*sawKerf;
      const lastCutEnd=endTrim+retainedUsed;
      const terminal=measured-lastCutEnd>1e-12?finalSeverKerf:0;
      const required=lastCutEnd+endTrim+terminal;
      const clearance=measured-required;
      const fits=clearance>=-1e-12;
      result={...result,requiredLength:required,
        actualUsableTail:fits?Math.max(0,clearance):0,
        shortfall:fits?0:-clearance,clearance,
        chargedLastKerf:terminal,
        status:fits?"DIMENSION FIT ONLY":"SHORT — REPLAN"};
    }
    rows.push(result);
  }
  const count=status=>rows.filter(x=>x.status===status).length;
  const fitting=count("DIMENSION FIT ONLY"),short=count("SHORT — REPLAN"),
    invalid=count("INVALID INPUT"),pending=count("PENDING INPUT");
  return {available:true,rows,entered:rows.filter(x=>x.enteredLength!==null).length,
    fitting,short,invalid,pending,
    settingsReady,complete:rows.length>0&&pending===0&&invalid===0,
    allDimensionalFit:rows.length>0&&fitting===rows.length,
    note:"User-entered lengths and kerfs, not independently measured by the website. A dimension fit never certifies wood grade, defects, physical clamping, safe cut order, building codes or invoiced savings."};
}
