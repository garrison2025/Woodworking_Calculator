#!/usr/bin/env python3
"""Cross-check the human task/keyword triage against immutable research and live tool spec.

This is NOT a SERP ranking test, organic traffic test or permission to index.
"""
import csv
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
research=list(csv.DictReader((root/"research"/"woodworking-keyword-map-152.csv").open(encoding="utf-8",newline="")))
tools=json.loads((root/"src"/"tools.json").read_text(encoding="utf-8"))["tools"]
intents={x["slug"]:x for x in json.loads((root/"src"/"tool-intents.json").read_text(encoding="utf-8"))["tools"]}
cautions=json.loads((root/"research"/"keyword-intent-cautions.json").read_text(encoding="utf-8"))["flagged"]
closure=json.loads((root/"research"/"keyword-intent-closure-20261107.json").read_text(encoding="utf-8"))
primary=closure["primary"]
reviewed=closure["flagged"]
routes={"/"+x["slug"]+"/" for x in tools}
approved={"task-specific-match","qualified-broad","research-query-ambiguous"}
decisions={"existing-tool-reassignment","needs-intent-verification","standalone-feature-gated",
           "guide-intent-not-calculator","exclude-as-target-keyword",
           "qualified-existing-layout-only"}
assert len(tools)==31 and len(intents)==31 and len(research)==152 and len(cautions)==22
assert len(primary)==31 and len({x["slug"] for x in primary})==31
assert {x["slug"] for x in primary}==set(intents)
assert {x["slug"] for x in primary}=={x["slug"] for x in tools}
assert len(reviewed)==22
assert all(x["class"] in approved for x in primary)
assert all(x["decision"] in decisions for x in reviewed)
assert all(x["reason"].strip() for x in reviewed)
assert all(x["scope"].strip() for x in primary)
assert all(x["notFor"].strip() for x in primary)
assert { (x["keyword"], x["originalRoute"]) for x in reviewed } == {
    (x["keyword"],x["originalRoute"]) for x in cautions}
assert len({x["keyword"] for x in reviewed})==22
assert len({x["keyword"] for x in research})==152
assert all(0<=int(r["kd"])<=29 for r in research)
assert all(x["target_route"] in routes for x in research)
assert all((x["keyword"],x["originalRoute"]) in {
    (r["keyword"],r["target_route"]) for r in research} for x in reviewed)
for x in primary:
    t=next(y for y in tools if y["slug"]==x["slug"])
    assert x["keyword"]==t["keyword"], (x["slug"],"historical primary changed")
    assert x["notFor"]==intents[x["slug"]]["notFor"], (x["slug"],"scope drift")
    assert any(r["keyword"]==x["keyword"] and r["target_route"]=="/"+x["slug"]+"/"
               for r in research), (x["slug"],"missing primary source")
    assert (root/"dist"/x["slug"]/"index.html").is_file(), (x["slug"],"page not built")
for x in reviewed:
    if "candidateRoute" in x:
        assert x["candidateRoute"] in routes, "Candidate cannot point to unknown page"
    assert x.get("candidateRoute")!=x["originalRoute"], "Historical wrong route cannot be copied as candidate"
    if x["decision"]=="existing-tool-reassignment":
        assert x.get("candidateRoute") == "/framing-calculator/"
    elif x["decision"]=="needs-intent-verification":
        assert "candidateRoute" in x, "Pending verification must identify its proposed existing page"
    else:
        assert "candidateRoute" not in x, "An excluded or unbuilt feature cannot silently acquire an approved route"
assert sum(x["class"]=="task-specific-match" for x in primary)==21
assert sum(x["class"]=="qualified-broad" for x in primary)==9
assert [x["slug"] for x in primary if x["class"]=="research-query-ambiguous"]==["lumber-price-calculator"]
expected={"existing-tool-reassignment":1,"needs-intent-verification":2,
          "standalone-feature-gated":10,"qualified-existing-layout-only":2,
          "guide-intent-not-calculator":3,"exclude-as-target-keyword":4}
assert {k:sum(x["decision"]==k for x in reviewed) for k in decisions}==expected
assert sum(int(x["monthly_volume_us"]) for x in research)==108930
print("PASS: exactly 31 current calculator task-intent verdicts (21 scoped matches, 9 broad qualifiers, 1 ambiguous primary),")
print("      22 traced historical query cautions (1 reassigned, 2 verify, 10 gated feature, 2 qualified existing layout, 3 guides, 4 excluded),")
print("      152 immutable researched KD<=29 keywords and 31 generated routes; NO page/index expansion authorized.")
