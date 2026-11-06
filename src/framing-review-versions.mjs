/**
 * Portable, content-addressed provenance for the optional Framing
 * pre-purchase self-declaration packet. All physical lengths are the
 * engine's original inches. A version ID is a NON-CRYPTOGRAPHIC
 * comparison checksum, never a signature, approval or evidence of
 * physical inspection. Exported JSON stays local unless the user shares it.
 */
const SCHEMA="framing-self-declared-review-v1";
const KEYS=["layout","measurement","quotation","declaration"];
const MAX_RECORDS=15000;
const normalize=v=>{
  if(v===null||v===undefined)return null;
  if(typeof v==="number")return Number.isFinite(v)?v:"INVALID NUMBER";
  if(typeof v==="boolean"||typeof v==="string")return v;
  throw Error("Unexpected source value in review version.");
};
const ordered=(rows,keyFn)=>[...rows].sort((a,b)=>
  String(keyFn(a)).localeCompare(String(keyFn(b)),"en"));
const idFor=(prefix,value)=>{
  // 64-bit FNV-1a: deterministic identity hint, NOT collision resistant or
  // suitable for verifying authenticity, integrity or external signatures.
  const text=JSON.stringify(value);
  let acc=0xcbf29ce484222325n;
  for(let i=0;i<text.length;i++){
    acc=(acc^BigInt(text.charCodeAt(i)))*0x100000001b3n&
      0xffffffffffffffffn;
  }
  return prefix+"-"+acc.toString(16).padStart(16,"0");
};
const idsOf=parts=>{
  const items=Object.fromEntries(KEYS.map((key,i)=>[
    key,idFor(["LAY","MEAS","QUOTE","DECL"][i],
      {schema:SCHEMA,part:key,payload:parts[key]})
  ]));
  return {...items,packet:idFor("PACK",{schema:SCHEMA,ids:items})};
};
const sane=(records,what)=>{
  if(!Array.isArray(records)||records.length>MAX_RECORDS)
    throw Error("Review version "+what+" is missing or oversized.");
  return records;
};

export function makeFramingReviewVersion({
  ledger,fieldReview,fieldInputs={},purchaseReview,alternative,
  currency="USD"
}={}){
  if(!ledger?.available||!fieldReview?.available||
    !purchaseReview?.available||!alternative?.enabled)
    return null;
  if(typeof currency!=="string"||!/^[A-Z]{3}$/.test(currency))
    throw Error("Review version currency must be ISO-style 3-letter code.");
  const unique=(arr,key,what)=>{
    if(new Set(arr.map(key)).size!==arr.length)
      throw Error("Review version duplicate "+what+".");
  };
  const bars=sane(ledger.bars,"physical stocks");
  const cuts=sane(alternative.rows,"reassigned members");
  const stations=sane(ledger.rows,"source station intervals");
  const measured=sane(fieldReview.rows,"field source readings");
  const declared=sane(purchaseReview.rows,"self-declarations");
  const offers=sane(alternative.purchaseVariants,"supplier SKU quotes");
  unique(bars,b=>b.stockId,"source IDs");
  unique(cuts,c=>c.stockGroup+"|"+c.item,"member IDs");
  unique(measured,m=>m.stockId,"field source IDs");
  unique(declared,d=>d.stockId,"declared source IDs");
  unique(offers,o=>o.stockGroup+"|"+o.offerCode,"supplier SKU IDs");
  const ids=bars.map(b=>b.stockId);
  for(const records of [measured,declared]){
    if(records.length!==ids.length||records.some(x=>!ids.includes(x.stockId)))
      throw Error("Review version source IDs differ from the modeled stock ledger.");
  }
  const pick=(obj,fields)=>Object.fromEntries(fields.map(k=>
    [k,normalize(obj?.[k])]));
  const parts={
    layout:{
      bars:ordered(bars,b=>b.stockId).map(b=>pick(b,[
        "stockId","stockGroup","offerLabel","stockLength",
        "retainedPieces","leadingEndTrim","trailingEndTrim",
        "lastSeverKerf","unallocatedTail","segmentTotal"
      ])),
      members:ordered(cuts,c=>c.stockGroup+"|"+c.item).map(c=>pick(c,[
        "stockGroup","item","originalStockId","stockId","offerLabel",
        "cutLength","cutStart","cutEnd","kerfBefore","stockLength",
        "finalSeverKerf","endTrim","usableOffcutLength"
      ])),
      stations:ordered(stations,s=>s.stockId+"|"+
        String(s.index).padStart(6,"0")).map(s=>pick(s,[
          "stockId","stockGroup","index","segmentKind","item",
          "originalStockId","stationStart","stationEnd",
          "segmentLength","stockLength"
        ])),
      retiredSources:ordered(alternative.removedSourceIds||[],x=>x),
      originallyPurchased:normalize(alternative.originalPurchaseSticks),
      alternativelyPurchased:normalize(alternative.purchaseSticks)
    },
    measurement:{
      sawKerf:normalize(fieldInputs.sawKerf),
      endTrim:normalize(fieldInputs.endTrim),
      finalSeverKerf:normalize(fieldInputs.finalSeverKerf),
      stocks:ordered(measured,m=>m.stockId).map(m=>pick(m,[
        "stockId","modelStockLength","enteredLength",
        "memberCount","retainedLength","requiredLength",
        "clearance","shortfall","status"
      ]))
    },
    quotation:{
      currency,
      originallyQuotedSubtotal:normalize(alternative.originalQuotedSubtotal),
      alternativelyQuotedSubtotal:normalize(alternative.reallocatedQuotedSubtotal),
      supplierRows:ordered(offers,o=>o.stockGroup+"|"+o.offerCode)
        .map(o=>pick(o,[
          "stockGroup","offerCode","offerLabel","stockLength",
          "plannedSticks","purchaseSticks","allowanceSticks",
          "unitPrice","purchaseCost"
        ]))
    },
    declaration:{
      sourceRows:ordered(declared,d=>d.stockId).map(d=>pick(d,[
        "stockId","dimensionStatus","profileGradeReviewed",
        "defectsReviewed","reviewed","sourceStatus"
      ])),
      globalChecks:Object.fromEntries([
        "sawSafetyReviewed","structuralReviewed",
        "supplierVerified","totalCostReviewed"
      ].map(k=>[k,purchaseReview.globalChecks?.[k]===true])),
      status:purchaseReview.status,
      reviewPacketComplete:purchaseReview.reviewPacketComplete===true,
      humanApprovalRequired:true,
      automaticPurchaseAuthorized:false
    }
  };
  const idsForParts=idsOf(parts);
  return {schema:SCHEMA,schemaVersion:1,
    versionIds:idsForParts,parts,
    warning:"LOCAL SELF-REPORTED COMPARISON CHECKSUMS ONLY. No digital signature, verified inspection, supplier invoice, safe cutting procedure or purchase authorization."};
}
export function validateFramingReviewVersion(version){
  if(!version||typeof version!=="object"||Array.isArray(version)||
    version.schema!==SCHEMA||version.schemaVersion!==1||
    !version.parts||typeof version.parts!=="object"||
    !version.versionIds||typeof version.versionIds!=="object")
    throw Error("Unsupported or incomplete Framing review reference format.");
  for(const key of KEYS){
    const v=version.parts[key];
    if(!v||typeof v!=="object"||Array.isArray(v))
      throw Error("Framing review reference is missing section "+key+".");
  }
  for(const [key,field] of [
    ["layout","bars"],["layout","members"],["layout","stations"],
    ["measurement","stocks"],["quotation","supplierRows"],
    ["declaration","sourceRows"]
  ])sane(version.parts[key][field],key+"."+field);
  // A map-based diff would silently overwrite duplicate identities. Reject
  // them before flattening, even if someone recomputed weak version IDs.
  const unique=(records,key,what)=>{
    const values=new Set();
    for(const row of records){
      if(!row||typeof row!=="object"||Array.isArray(row))
        throw Error("Malformed Framing reference "+what+" record.");
      const id=key(row);
      if(typeof id!=="string"||!id.length||id.length>256)
        throw Error("Invalid Framing reference "+what+" identity.");
      if(values.has(id))throw Error("Duplicate Framing reference "+what+" identity.");
      values.add(id);
    }
    return values;
  };
  const p=version.parts;
  const barIds=unique(p.layout.bars,r=>r.stockId,"stock");
  unique(p.layout.members,r=>r.stockGroup+"|"+r.item,"member");
  unique(p.layout.stations,r=>r.stockId+"|"+r.index,"station");
  const measuredIds=unique(p.measurement.stocks,r=>r.stockId,"measurement");
  const declaredIds=unique(p.declaration.sourceRows,r=>r.stockId,"declaration");
  unique(p.quotation.supplierRows,r=>r.stockGroup+"|"+r.offerCode,"SKU");
  for(const group of [measuredIds,declaredIds]){
    if(group.size!==barIds.size||[...barIds].some(id=>!group.has(id)))
      throw Error("Framing reference measurement/declaration source IDs differ.");
  }
  for(const row of p.measurement.stocks){
    if(row.enteredLength!==null&&(!Number.isFinite(row.enteredLength)||
      row.enteredLength<=0||row.enteredLength>=1e8))
      throw Error("Framing reference contains an invalid entered length.");
  }
  if(version.parts.declaration.automaticPurchaseAuthorized!==false||
    version.parts.declaration.humanApprovalRequired!==true)
    throw Error("Imported reference must never authorize buying.");
  const recalculated=idsOf(version.parts);
  for(const key of [...KEYS,"packet"]){
    if(recalculated[key]!==version.versionIds[key])
      throw Error("Framing reference content/ID mismatch; do not trust altered metadata.");
  }
  return true;
}
const rowLabel=(row,key)=>String(row?.[key]??"UNKNOWN");
const flattenVersion=version=>{
  const result=new Map(),parts=version.parts;
  const put=(section,field,value)=>
    result.set(section+"|"+field,{section,field,value});
  for(const bar of parts.layout.bars||[]){
    const k="Stock "+rowLabel(bar,"stockId");
    for(const [name,value] of Object.entries(bar)){
      if(name!=="stockId")put("layout",k+" · "+name,value);
    }
  }
  for(const cut of parts.layout.members||[]){
    const k="Member "+rowLabel(cut,"stockGroup")+" / "+rowLabel(cut,"item");
    for(const [name,value] of Object.entries(cut)){
      if(name!=="stockGroup"&&name!=="item")put("layout",k+" · "+name,value);
    }
  }
  for(const station of parts.layout.stations||[]){
    const k="Station "+rowLabel(station,"stockId")+" #"+rowLabel(station,"index");
    for(const [name,value] of Object.entries(station)){
      if(!["stockId","index"].includes(name))put("layout",k+" · "+name,value);
    }
  }
  put("layout","Retired source IDs",parts.layout.retiredSources);
  put("layout","Originally purchased",parts.layout.originallyPurchased);
  put("layout","Alternatively purchased",parts.layout.alternativelyPurchased);
  for(const key of ["sawKerf","endTrim","finalSeverKerf"])
    put("measurement","Entered "+key,parts.measurement[key]);
  for(const bar of parts.measurement.stocks||[]){
    for(const [key,value] of Object.entries(bar)){
      if(key!=="stockId")put("measurement",
        "Source "+rowLabel(bar,"stockId")+" · "+key,value);
    }
  }
  for(const key of ["currency","originallyQuotedSubtotal","alternativelyQuotedSubtotal"])
    put("quotation",key,parts.quotation[key]);
  for(const sku of parts.quotation.supplierRows||[]){
    const k="SKU "+rowLabel(sku,"stockGroup")+" / "+rowLabel(sku,"offerCode");
    for(const [key,value] of Object.entries(sku)){
      if(!["stockGroup","offerCode"].includes(key))
        put("quotation",k+" · "+key,value);
    }
  }
  for(const row of parts.declaration.sourceRows||[]){
    const k="Source "+rowLabel(row,"stockId");
    for(const [key,value] of Object.entries(row)){
      if(key!=="stockId")put("declaration",k+" · "+key,value);
    }
  }
  for(const [key,value] of Object.entries(parts.declaration.globalChecks||{}))
    put("declaration","Global · "+key,value);
  for(const key of ["status","reviewPacketComplete",
    "humanApprovalRequired","automaticPurchaseAuthorized"])
    put("declaration",key,parts.declaration[key]);
  return result;
};
const printable=v=>{
  if(v===undefined)return "(not in version)";
  if(v===null)return "(not entered)";
  if(Array.isArray(v))return v.length?v.join(", "):"(none)";
  return String(v);
};
export function compareFramingReviewVersions(reference,current){
  validateFramingReviewVersion(reference);
  validateFramingReviewVersion(current);
  const prior=flattenVersion(reference),now=flattenVersion(current);
  const changes=[];
  const keys=[...new Set([...prior.keys(),...now.keys()])].sort((a,b)=>
    a.localeCompare(b,"en"));
  for(const key of keys){
    const a=prior.get(key),b=now.get(key);
    if(JSON.stringify(a?.value)===JSON.stringify(b?.value))continue;
    changes.push({section:(b||a).section,field:(b||a).field,
      before:printable(a?.value),after:printable(b?.value),
      change:!a?"ADDED":!b?"REMOVED":"CHANGED"});
  }
  const changedSections=KEYS.filter(k=>
    reference.versionIds[k]!==current.versionIds[k]);
  if(changes.length===0&&changedSections.length>0)
    throw Error("Comparison did not enumerate all changed version fields.");
  return {samePacket:reference.versionIds.packet===current.versionIds.packet,
    referenceId:reference.versionIds.packet,currentId:current.versionIds.packet,
    changedSections,changes,totalChanges:changes.length,
    warning:"These IDs identify local comparison versions only; neither file is a signed record or purchase authorization."};
}
/**
 * Explicit recovery PROPOSAL ONLY, never automatic import. Restore raw
 * historical dimensions only if the exact CURRENT source layout matches
 * the reference. Calling code must discard all human inspection declarations
 * and must not change prices, stock arrangements or procurement actions.
 */
export function proposeFramingMeasurementRestore(reference,current){
  validateFramingReviewVersion(reference);
  validateFramingReviewVersion(current);
  if(reference.versionIds.layout!==current.versionIds.layout)
    throw Error("RESTORE BLOCKED — source layout differs from the reference.");
  const sourceIds=new Set(current.parts.layout.bars.map(b=>b.stockId));
  const previous=reference.parts.measurement;
  const values={sawKerf:previous.sawKerf,
    endTrim:previous.endTrim,finalSeverKerf:previous.finalSeverKerf};
  for(const [key,value] of Object.entries(values)){
    if(value!==null&&(!Number.isFinite(value)||value<0||
      (value>0&&value<1e-8)||value>=1e8))
      throw Error("RESTORE BLOCKED — invalid historical "+key+".");
  }
  const entries=previous.stocks.map(row=>{
    if(!sourceIds.has(row.stockId))
      throw Error("RESTORE BLOCKED — unknown historical source.");
    return [row.stockId,row.enteredLength];
  });
  if(entries.length!==sourceIds.size)
    throw Error("RESTORE BLOCKED — missing historical source measurements.");
  // Only physical measurements are recovered. The original record may
  // contain self-declared checked flags; deliberately ignore every one.
  return {
    layoutId:current.versionIds.layout,
    referenceId:reference.versionIds.packet,
    measurementId:reference.versionIds.measurement,
    sourceEntries:entries,
    ...values,
    restoresInspectionDeclarations:false,
    restoresSupplierPrices:false,
    restoresPurchaseAuthorization:false,
    warning:"HISTORICAL USER ENTRIES — remeasure every actual stick and independently reconfirm all inspection declarations before purchase."
  };
}
export function framingReviewVersionNote(version,reference=null){
  validateFramingReviewVersion(version);
  const i=version.versionIds;
  return "REVIEW VERSION "+i.packet+
    " | LAYOUT "+i.layout+" | MEASUREMENTS "+i.measurement+
    " | QUOTE "+i.quotation+" | DECLARATIONS "+i.declaration+
    (reference?" | REFERENCE "+reference.versionIds.packet:"")+
    " | SELF-REPORTED ONLY; NO PURCHASE APPROVAL OR DIGITAL SIGNATURE.";
}
