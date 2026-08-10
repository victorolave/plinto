#!/usr/bin/env python3
"""Normalize `CUENTAS POR PAGAR (1).xlsx` into JSON that `load.ts` can write.

Parsed with the standard library alone (zipfile + ElementTree): this machine has
no openpyxl and no libreoffice, and adding a dependency to read one file once is
not worth it.

Three things about this workbook drive every design choice here:

* **Months run sideways.** A month is a block of columns (B/C, E/F, H/I) whose
  own header cell names it. Nothing can be read row by row; a block is found by
  its `CUENTAS POR PAGAR <MES>` header and walked downward to its own TOTAL.
* **The formulas are the data.** The per-line payment signal the values lost is
  still in the formula text — but `TOTAL PAGADOS` alone is not enough, because
  some months record further payments in scratch cells that only `FALTANTES`
  refers to (July 2026 hides three groups in column D that way). So the
  authority is `FALTANTES`, expanded recursively down to leaf cells. Same trick
  reads `TRANSFERENCIAS ENTRE CUENTAS PROPIAS`, which enumerates the income rows
  that are really internal moves.
* **The labels lie, the references do not.** The `CREDITOS <MES>` sub-tables are
  titled one month off — January 2026 reads the table headed "DICIEMBRE". Every
  link to a sub-table is resolved through the cell reference in the formula and
  never through the title.

Usage:  python3 extract.py <workbook.xlsx> > data.json
"""
import json
import re
import sys
import zipfile
from datetime import date, timedelta
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"

MONTHS = {
    "ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4, "MAYO": 5, "JUNIO": 6,
    "JULIO": 7, "AGOSTO": 8, "SEPTIEMBRE": 9, "OCTUBRE": 10, "NOVIEMBRE": 11,
    "DICIEMBRE": 12,
}
CELL_REF = re.compile(r"\b([A-Z]{1,3})(\d{1,5})\b")
RANGE_REF = re.compile(r"\b([A-Z]{1,3})(\d{1,5}):([A-Z]{1,3})(\d{1,5})\b")
SEMESTER = re.compile(r"INGRESOS\s+(PRIMER|SEGUNDO)\s+SEMESTRE\s+DE\s+(\d{4})")
# Excel's day 1 is 1900-01-01, and it wrongly believes 1900 was a leap year, so
# the serial origin that makes modern dates come out right is 1899-12-30.
EXCEL_EPOCH = date(1899, 12, 30)


# --------------------------------------------------------------------------- #
# Cell address helpers
# --------------------------------------------------------------------------- #

def col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def num_to_col(n: int) -> str:
    out = ""
    while n:
        n, rem = divmod(n - 1, 26)
        out = chr(65 + rem) + out
    return out


def split_ref(ref: str):
    i = 0
    while i < len(ref) and ref[i].isalpha():
        i += 1
    return ref[:i], int(ref[i:])


# --------------------------------------------------------------------------- #
# Workbook reading
# --------------------------------------------------------------------------- #

def load_workbook(path: str):
    """{sheet name: (values by cell ref, formulas by cell ref)}."""
    z = zipfile.ZipFile(path)
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        shared = ["".join(t.text or "" for t in si.iter(f"{NS}t"))
                  for si in root.findall(f"{NS}si")]
    except KeyError:
        shared = []

    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    targets = {r.get("Id"): r.get("Target")
               for r in rels.findall(f"{PKG}Relationship")}

    sheets = {}
    for sheet in wb.find(f"{NS}sheets"):
        part = "xl/" + targets[sheet.get(f"{RNS}id")].lstrip("/").replace("xl/", "", 1)
        values, formulas = {}, {}
        for c in ET.fromstring(z.read(part)).iter(f"{NS}c"):
            ref, typ = c.get("r"), c.get("t")
            f, v = c.find(f"{NS}f"), c.find(f"{NS}v")
            if f is not None and f.text:
                formulas[ref] = f.text
            if v is not None:
                values[ref] = shared[int(v.text)] if typ == "s" else v.text
            elif typ == "inlineStr":
                values[ref] = "".join(t.text or "" for t in c.iter(f"{NS}t"))
        sheets[sheet.get("name")] = (values, formulas)
    return sheets


def as_number(raw):
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def as_text(raw):
    return re.sub(r"\s+", " ", raw).strip() if isinstance(raw, str) else None


def refs_in(formula: str):
    """Cell references named by a formula, with `A1:A9` ranges expanded."""
    if not formula:
        return []
    text = formula.upper()
    out, consumed = [], set()
    for m in RANGE_REF.finditer(text):
        c1, r1, c2, r2 = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
        if col_to_num(c1) == col_to_num(c2):
            out += [f"{c1}{r}" for r in range(min(r1, r2), max(r1, r2) + 1)]
        consumed.add(m.span())
    masked = RANGE_REF.sub(lambda m: " " * (m.end() - m.start()), text)
    out += [f"{c}{r}" for c, r in CELL_REF.findall(masked)]
    return out


def paid_leaves(formulas, values, missing_ref, total_ref, stop, depth=6):
    """Cells that `FALTANTES` counts as already paid.

    `FALTANTES = TOTAL - PAGADOS - <extras>`, so everything it reaches except
    the TOTAL subtree is a payment. Intermediate cells are themselves formulas
    (`TOTAL PAGADOS` lists cells; the scratch groups list more), so this walks
    down until it reaches a cell holding a value of its own — or one of `stop`,
    the cells that already ARE the things being paid. Without that stop the walk
    would step straight through a line like `CREDITOS ONLINE`, whose value is a
    reference to its own sub-table, and lose the line it was asking about.
    """
    if not missing_ref or missing_ref not in formulas:
        return []
    frontier = [r for r in refs_in(formulas[missing_ref]) if r != total_ref]
    leaves, visited = [], {missing_ref, total_ref}
    for _ in range(depth):
        nxt = []
        for ref in frontier:
            if ref in visited:
                continue
            visited.add(ref)
            if ref not in stop and ref in formulas:
                nxt += refs_in(formulas[ref])
            elif ref in values:
                leaves.append({"ref": ref, "value": as_number(values[ref])})
        if not nxt:
            break
        frontier = nxt
    return [leaf for leaf in leaves if leaf["value"]]


# --------------------------------------------------------------------------- #
# Year sheets: the monthly `CUENTAS POR PAGAR` blocks
# --------------------------------------------------------------------------- #

def expense_blocks(values, formulas, year: int, stop_extra=()):
    blocks = []
    for ref, raw in values.items():
        label = as_text(raw)
        if not label or not label.upper().startswith("CUENTAS POR PAGAR"):
            continue
        month_name = label.upper().replace("CUENTAS POR PAGAR", "").strip()
        if month_name not in MONTHS:
            continue

        col, row = split_ref(ref)
        vcol = num_to_col(col_to_num(col) + 1)
        items, total, missing = [], None, None
        total_ref = missing_ref = None
        blank = 0
        r = row + 1
        while blank < 4 and r < row + 40:
            name = as_text(values.get(f"{col}{r}"))
            if name:
                upper = name.upper()
                if upper.startswith("TOTAL PAGADOS"):
                    pass  # reached through FALTANTES, which sees the extras too
                elif upper == "TOTAL":
                    total = as_number(values.get(f"{vcol}{r}"))
                    total_ref = f"{vcol}{r}"
                elif upper.startswith("FALTANTES"):
                    missing = as_number(values.get(f"{vcol}{r}"))
                    missing_ref = f"{vcol}{r}"
                    break
                elif upper != "OTROS":
                    items.append({
                        "ref": f"{vcol}{r}",
                        "concept": name,
                        "amount": as_number(values.get(f"{vcol}{r}")),
                        "formula": formulas.get(f"{vcol}{r}"),
                    })
                blank = 0
            else:
                blank += 1
            r += 1

        blocks.append({
            "year": year,
            "month": MONTHS[month_name],
            "sheet": str(year),
            "header": ref,
            "items": items,
            "sheetTotal": total,
            "sheetMissing": missing,
            "paidLeaves": paid_leaves(
                formulas, values, missing_ref, total_ref,
                {i["ref"] for i in items} | set(stop_extra),
            ),
        })
    return sorted(blocks, key=lambda b: b["month"])


def loan_tables(values):
    """`CREDITOS <MES>` sub-tables: one row per online loan taken that month.

    Keyed later by the cell holding the table's TOTAL, because that cell — not
    the table's title — is what the monthly block points at.
    """
    tables = []
    for ref, raw in values.items():
        label = as_text(raw)
        if not label:
            continue
        upper = label.upper()
        if not re.match(r"^CREDITOS?\s+(ON\s*LINE\s+)?[A-ZÑÁÉÍÓÚ]+$", upper):
            continue
        month_name = upper.split()[-1]
        if month_name not in MONTHS:
            continue

        col, row = split_ref(ref)
        c_total = num_to_col(col_to_num(col) + 1)
        c_principal = num_to_col(col_to_num(col) + 2)
        rows, total_ref, blank = [], None, 0
        r = row + 1
        # Tolerant of gaps: several of these tables have blank rows before their
        # TOTAL because a neighbouring table is taller.
        while blank < 8 and r < row + 32:
            name = as_text(values.get(f"{col}{r}"))
            if name:
                if name.upper().startswith("TOTAL"):
                    total_ref = f"{c_total}{r}"
                    break
                if name.upper() != "NOMBRE":
                    rows.append({
                        "lender": name,
                        "totalToPay": as_number(values.get(f"{c_total}{r}")),
                        "principal": as_number(values.get(f"{c_principal}{r}")),
                        "ref": f"{c_total}{r}",
                    })
                blank = 0
            else:
                blank += 1
            r += 1

        tables.append({
            "labelledMonth": MONTHS[month_name],
            "anchor": ref,
            "totalRef": total_ref,
            "sheetTotal": as_number(values.get(total_ref)) if total_ref else None,
            "rows": rows,
        })
    return tables


def link_loan_tables(blocks, tables):
    """Attach each block's online-loan table by following the cell reference.

    The `CREDITOS ONLINE` line of a monthly block is a formula pointing at a
    sub-table's TOTAL. That pointer is authoritative; the sub-table's own title
    is off by a month and must never be trusted.
    """
    by_total = {t["totalRef"]: t for t in tables if t["totalRef"]}
    for block in blocks:
        block["loanTable"] = None
        for item in block["items"]:
            if "CREDITO" not in item["concept"].upper():
                continue
            if not re.search(r"ON\s*LINE", item["concept"].upper()):
                continue
            hit = next((by_total[r] for r in refs_in(item["formula"] or "")
                        if r in by_total), None)
            block["loanTable"] = {
                "aggregateRef": item["ref"],
                "aggregateAmount": item["amount"],
                "anchor": hit["anchor"] if hit else None,
                "labelledMonth": hit["labelledMonth"] if hit else None,
                "rows": hit["rows"] if hit else [],
                "resolved": hit is not None,
            }
    return blocks


# --------------------------------------------------------------------------- #
# Income sheets
# --------------------------------------------------------------------------- #

def semester_headers(values):
    """(column, row, year, first semester?) for every `INGRESOS ... DE <year>`."""
    out = []
    for ref, raw in values.items():
        text = as_text(raw)
        if not text:
            continue
        m = SEMESTER.search(text.upper())
        if m:
            col, row = split_ref(ref)
            out.append((col_to_num(col), row, int(m.group(2)),
                        m.group(1) == "PRIMER"))
    return out


def year_for(headers, col_num: int, row: int, month: int):
    """The year owning a month header, from the nearest semester title above it.

    Income sheets stack semesters vertically and years side by side, so the
    owning title is the lowest one at or above this row within a column or two.
    """
    candidates = [h for h in headers
                  if abs(h[0] - col_num) <= 1 and h[1] <= row
                  and (h[3] == (month <= 6))]
    if not candidates:
        candidates = [h for h in headers
                      if abs(h[0] - col_num) <= 1 and h[1] <= row]
    if not candidates:
        return None
    return max(candidates, key=lambda h: h[1])[2]


def income_rows(values, formulas, sheet_name: str):
    """Rows under a month header: day, INGRESO, PRESTAMOS, CUENTA.

    Some sheets put the day of the month in the first column and the legacy one
    puts a full Excel date serial there; both are normalised to a real date.
    """
    headers = semester_headers(values)
    internal_refs = set()
    third_party_refs = set()
    for ref, raw in values.items():
        text = (as_text(raw) or "").upper()
        if "TRANSFERENCIAS ENTRE CUENTAS PROPIAS" in text:
            col, row = split_ref(ref)
            # The total sits to the right of the label, anywhere in the band.
            for dx in range(1, 6):
                cand = f"{num_to_col(col_to_num(col) + dx)}{row}"
                if cand in formulas:
                    internal_refs.update(refs_in(formulas[cand]))
                    break
        if "PAGO A TERCEROS" in text:
            col, row = split_ref(ref)
            for dx in range(1, 6):
                cand = f"{num_to_col(col_to_num(col) + dx)}{row}"
                if cand in formulas:
                    third_party_refs.update(refs_in(formulas[cand]))
                    break

    rows = []
    for ref, raw in values.items():
        text = as_text(raw)
        if not text or text.upper() not in MONTHS:
            continue
        col, row = split_ref(ref)
        cn = col_to_num(col)
        if as_text(values.get(f"{num_to_col(cn + 1)}{row}")) != "INGRESO":
            continue  # a month name that is not a block header

        month = MONTHS[text.upper()]
        year = year_for(headers, cn, row, month)
        if year is None:
            continue
        c_in, c_loan, c_acct = (num_to_col(cn + i) for i in (1, 2, 3))

        blank, r = 0, row + 1
        while blank < 4 and r < row + 45:
            first = values.get(f"{col}{r}")
            if as_text(first) and as_text(first).upper().startswith("TOTAL"):
                break
            day_raw = as_number(first)
            income = as_number(values.get(f"{c_in}{r}"))
            loan = as_number(values.get(f"{c_loan}{r}"))
            if day_raw is not None and (income or loan):
                if day_raw > 366:  # an Excel serial, not a day of the month
                    when = EXCEL_EPOCH + timedelta(days=int(day_raw))
                    day, month_of_row, year_of_row = when.day, when.month, when.year
                else:
                    day, month_of_row, year_of_row = int(day_raw), month, year
                income_ref = f"{c_in}{r}"
                rows.append({
                    "sheet": sheet_name,
                    "year": year_of_row,
                    "month": month_of_row,
                    "day": day,
                    "income": income,
                    "loan": loan,
                    "counterparty": as_text(values.get(f"{c_acct}{r}")),
                    "ref": income_ref,
                    "isInternalTransfer": income_ref in internal_refs,
                    "isThirdParty": income_ref in third_party_refs,
                })
                blank = 0
            elif day_raw is None and income is None and loan is None:
                blank += 1
            r += 1
    return rows


# --------------------------------------------------------------------------- #

def main(path: str):
    book = load_workbook(path)

    years = {}
    for year in ("2025", "2026"):
        values, formulas = book[year]
        tables = loan_tables(values)
        loan_refs = {row["ref"] for t in tables for row in t["rows"]}
        blocks = expense_blocks(values, formulas, int(year), loan_refs)
        years[year] = link_loan_tables(blocks, tables)

    income = []
    for sheet in ("INGRESOS VICTOR-2026", "INGRESOS SANDRA",
                  "INGRESOS VICTOR-202225"):
        values, formulas = book[sheet]
        income += income_rows(values, formulas, sheet)

    json.dump({"expenseYears": years, "income": income},
              sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
