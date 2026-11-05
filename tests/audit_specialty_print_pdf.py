#!/usr/bin/env python3
"""Audit physical PDF files from all split-width trade-specific worksheets.

This checks PDF content and page sizes, not real printer dimensions or
structural correctness. DOM-to-source numeric identity is tested separately.
"""
from __future__ import annotations
from collections import Counter
import json
from pathlib import Path
import re
import sys
from pypdf import PdfReader

EXPECTED={
    "framing-calculator":{(1,2):4,(2,2):4},
    "deck-material-calculator":{(1,2):2,(2,2):2},
    "stair-stringer-calculator":{(1,2):3,(2,2):3},
    "shelf-spacing-calculator":{(1,3):1,(2,3):1,(3,3):1},
    "roof-sheathing-calculator":{(1,2):1,(2,2):1},
}
PAPER={"a4":(595.28,841.89),"letter":(612,792)}

def check(folder:Path):
    results=[]
    for slug,group_parts in EXPECTED.items():
        for paper,(width,height) in PAPER.items():
            file=folder/f"specialty-{slug}-{paper}.pdf"
            doc=PdfReader(str(file),strict=True)
            assert 2<=len(doc.pages)<55, (file,len(doc.pages))
            # Real PDF page content must not leave a single row or a fragment
            # of caveat text stranded on a nearly-empty final sheet.
            if slug=="framing-calculator":
                assert len(doc.pages)<=9, (file,"orphan framing/blank page",len(doc.pages))
            if slug=="stair-stringer-calculator" and paper=="letter":
                assert len(doc.pages)<=9, (file,"orphan stair safety-note page",len(doc.pages))
            pages=[]
            for page_no,page in enumerate(doc.pages,1):
                mediabox=page.mediabox
                assert abs(float(mediabox.width)-width)<1.5,(file,page_no,"width")
                assert abs(float(mediabox.height)-height)<1.5,(file,page_no,"height")
                plain=" ".join((page.extract_text() or "").split())
                assert plain,(file,page_no,"unexpected blank PDF page")
                pages.append(plain)
            text=" ".join(pages)
            assert "Physical print scale check" in text,(file,"missing rulers")
            assert "100 mm reference" in text and "1 in reference" in text,(file,"missing ruler labels")
            assert "Worksheet assumptions" in text,(file,"missing safety/assumptions")
            matches=Counter((int(a),int(b)) for a,b in re.findall(r"columns\s+(\d+)\s+of\s+(\d+)",text))
            assert matches==Counter(group_parts),(file,"missing/duplicated print groups",matches,group_parts)
            results.append({"calculator":slug,"paper":paper.upper(),"pages":len(doc.pages),
                "verified_print_groups":sum(group_parts.values()),"blank_pages":0,
                "printer_ruler_measurement":"NOT RUN"})
    out=folder/"specialty-print-audit.json"
    out.write_text(json.dumps(results,indent=2)+"\n",encoding="utf-8")
    print("PASS",len(results),"specialty trade worksheet PDFs:",
        json.dumps(results,ensure_ascii=False))

if __name__=="__main__":
    check(Path(sys.argv[1] if len(sys.argv)>1 else "print-evidence"))
