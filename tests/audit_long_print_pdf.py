#!/usr/bin/env python3
"""Validate real generated PDF, not just a beforeprint DOM snapshot."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


def audit(filename: str, paper: str, segments: int, rings: int, groups: int):
    path = Path(filename)
    reader = PdfReader(str(path), strict=True)
    expected_width, expected_height = {
        "A4": (595.28, 841.89),
        "Letter": (612.0, 792.0),
    }[paper]
    assert len(reader.pages) >= 4, f"{path}: unexpectedly few pages"

    texts = []
    print_pages = 0
    for i, page in enumerate(reader.pages, 1):
        box = page.mediabox
        assert abs(float(box.width) - expected_width) < 1.5, (path, i, "paper width", box)
        assert abs(float(box.height) - expected_height) < 1.5, (path, i, "paper height", box)
        text = re.sub(r"\s+", " ", page.extract_text() or "")
        assert text, f"{path}: blank PDF page {i}"
        if re.search(r"Ring \d+ / segment \d+", text):
            print_pages += 1
            # Tables must repeat identifying column headers on every
            # page where cut rows appear, including continued pages.
            assert re.search(r"\bItem\b", text), f"{path}: page {i} lost the table header"
        texts.append(text)
    combined = " ".join(texts)

    expected_total = segments * rings
    assert f"all {expected_total} calculated rows included" in combined, (
        path, "missing complete print-schedule statement"
    )
    assert "Physical print scale check" in combined, (path, "missing physical rulers")
    assert "100 mm reference" in combined and "1 in reference" in combined
    assert "Worksheet assumptions" in combined, (path, "missing tool limits")
    assert "structural capacity" in combined, (path, "missing safety disclaimer")

    parts = re.findall(r"Measurement schedule · part (\d+) of (\d+)", combined)
    assert len(parts) == groups, (path, "missing grouped table", parts)
    assert sorted(int(n) for n, total in parts if int(total) == groups) == list(range(1, groups + 1)), (
        path, "missing or duplicate group label", parts
    )
    missing = []
    duplicated = []
    for ring in range(1, rings + 1):
        for seg in range(1, segments + 1):
            marker = f"Ring {ring} / segment {seg}"
            occurrences = len(re.findall(re.escape(marker) + r"(?!\d)", combined))
            if occurrences < groups:
                missing.append((marker, occurrences))
            if occurrences > groups:
                duplicated.append((marker, occurrences))
    assert not missing, f"{path}: cut rows missing from PDF: {missing[:12]}"
    assert not duplicated, f"{path}: unexpected repeated identifiers: {duplicated[:12]}"
    assert print_pages >= groups, (path, "unexpectedly few table pages")

    result = {
        "paper": paper,
        "pages": len(reader.pages),
        "pages_with_schedule_rows": print_pages,
        "distinct_cut_ids_checked": expected_total,
        "print_groups": groups,
        "total_verified_row_identifiers": expected_total * groups,
        "missing": 0,
        "duplicated": 0,
        "physical_printer_measurement": "NOT RUN",
    }
    report = path.with_suffix(".audit.json")
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"PASS {path}: {json.dumps(result, ensure_ascii=False)}")


if __name__ == "__main__":
    if len(sys.argv) != 6:
        sys.exit("usage: audit_long_print_pdf.py PDF A4|Letter SEGMENTS RINGS GROUPS")
    audit(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]))
