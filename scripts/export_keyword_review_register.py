#!/usr/bin/env python3
"""Reproducible 152-row historical-keyword decision ledger.

Preserves the original Semrush export, and never interprets mapped routes as
SERP-confirmed targeting, predicted traffic or release authorization.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "research/woodworking-keyword-map-152.csv"
CLOSURE = ROOT / "research/keyword-intent-closure-20261107.json"
REGISTER = ROOT / "research/keyword-decision-register-152.csv"
OUT_COLUMNS = (
    "keyword", "monthly_volume_us", "kd", "cpc_usd",
    "historical_target_route", "historical_competitor_url", "review_status",
    "research_candidate_route", "seo_claim_status", "us_live_serp_status",
    "metrics_basis", "review_note",
)

def produce():
    with SOURCE.open("r", encoding="utf-8", newline="") as f:
        research=list(csv.DictReader(f))
    closure=json.loads(CLOSURE.read_text(encoding="utf-8"))
    primary={x["keyword"]:x for x in closure["primary"]}
    cautions={(x["keyword"],x["originalRoute"]):x for x in closure["flagged"]}
    if len(research)!=152 or len(cautions)!=22 or len(primary)!=31:
        raise ValueError("Source manifest size changed; refresh manual review before publishing")
    if len({r["keyword"] for r in research})!=152:
        raise ValueError("Research keywords must be unique")
    records=[]
    for r in research:
        term=r["keyword"]; route=r["target_route"]
        caution=cautions.get((term,route))
        p=primary.get(term)
        if caution:
            state="caution:"+caution["decision"]
            destination=caution.get("candidateRoute","")
            approved="only-approved-reassignment" if caution["decision"]=="existing-tool-reassignment" else "do-not-target-unqualified"
            note=caution["reason"]
        elif p and route=="/"+p["slug"]+"/":
            state="primary:"+p["class"]
            destination=route
            approved="task-limited-copy-only" if p["class"]!="research-query-ambiguous" else "do-not-target-unqualified"
            note=p["scope"]
        else:
            state="secondary:not-independently-verified"
            destination=""
            approved="research-only-not-approved"
            note="Historical competitor association is not proof that this site's exact current inputs/outputs satisfy the user query. Independent exact-intent review needed."
        records.append({
            "keyword":term,"monthly_volume_us":r["monthly_volume_us"],"kd":r["kd"],
            "cpc_usd":r["cpc_usd"],"historical_target_route":route,
            "historical_competitor_url":r["competitor_url"],
            "review_status":state, "research_candidate_route":destination,
            "seo_claim_status":approved,"us_live_serp_status":"NOT VERIFIED (US GEO)",
            "metrics_basis":"USER 2026-11-04 HISTORICAL SEMRUSH",
            "review_note":note,
        })
    if sum(x["review_status"].startswith("caution:") for x in records)!=22:
        raise ValueError("Caution count mismatch")
    # One of 31 historical primary queries is also a flagged ambiguous query.
    if sum(x["review_status"].startswith("primary:") for x in records)!=30:
        raise ValueError("Primary count mismatch")
    if sum(x["review_status"].startswith("secondary:") for x in records)!=100:
        raise ValueError("Secondary count mismatch")
    f=io.StringIO(newline="")
    writer=csv.DictWriter(f,fieldnames=OUT_COLUMNS,quoting=csv.QUOTE_ALL,
                          lineterminator="\n")
    writer.writeheader()
    writer.writerows(records)
    return f.getvalue()

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--check",action="store_true",
                        help="Fail if the committed ledger differs from current reviewed source")
    args=parser.parse_args()
    data=produce()
    if args.check:
        if not REGISTER.is_file() or REGISTER.read_text(encoding="utf-8")!=data:
            print("FAIL: stale or missing 152-keyword decision register",file=sys.stderr)
            raise SystemExit(1)
        print("PASS: 152 source rows = 22 cautions + 30 other primary rows + 100 secondary-unverified rows")
    else:
        REGISTER.write_text(data,encoding="utf-8")
        print(f"Wrote {REGISTER}: 152 distinct historical keywords")
