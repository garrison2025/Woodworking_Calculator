/**
 * An inspectable STOCK-LOCAL STATION LEDGER for the optional Framing
 * offcut-reallocation alternative. This is a dimensional accounting
 * document, NOT a safe/ordered saw sequence or a machine toolpath.
 *
 * Never use the independently modelled reserve sticks as cut sources:
 * only plan.bars with already assigned, uniquely identified members.
 */
export function makeFramingStationLedger(plan){
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
      const identity=cut.stockGroup+"|"+cut.item;
      // Cut rows currently omit stockGroup on the bar-local copy, so check
      // using the exact parent stock group.
      const validIdentity=source.stockGroup+"|"+cut.item;
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
    [...memberIds].some(x=>!visitedMembers.has(x)))
    throw Error("Station ledger does not cover all reallocated members.");
  return {available:true,rows,bars:summaries,sourceCount:summaries.length,
    memberCount:visitedMembers.size,
    unverifiedSourceCount:summaries.length,
    warning:"Coordinates are 0-origin stock references, NOT a saw-operation order. Every physical source, actual kerf, grade/profile, defect and clamp setup requires independent inspection before cutting."};
}
