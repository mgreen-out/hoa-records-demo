#!/usr/bin/env python3
"""Generate a FAKE demo database for the HOA records app.

Every name, address, amount and date produced here is invented for the demo
("Maple Court Condominiums", 8 units). The table and view layouts match the
real app so the same frontend runs unchanged. No real association data is used.

Usage:
  python generate_fake_data.py            # writes data/extracted.db
"""

import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

random.seed(42)
DB = Path(__file__).parent / "extracted.db"  # name matches the frontend's /extracted API path
PROPERTY = "Maple Court Condominiums"
UNITS = [str(u) for u in range(101, 109)]
OWNERS = [
    ("Avery", "Lindqvist"), ("Jordan", "Okafor"), ("Riley", "Moreau"), ("Sam", "Takahashi"),
    ("Casey", "Brennan"), ("Morgan", "Delacroix"), ("Taylor", "Novak"), ("Quinn", "Halvorsen"),
]
VENDORS = [
    ("Summit Roofing Co.", "Roofing"), ("Riverbend Landscaping", "Landscaping"),
    ("Clearwater Utilities", "Utilities"), ("Northfield Insurance Group", "Insurance"),
    ("Brightline Plumbing", "Plumbing"), ("Keystone Legal LLP", "Legal"),
    ("Evergreen Snow Services", "Snow Removal"), ("Parkside Gutter Care", "Gutters"),
    ("Lakeview Property Management", "Management"), ("Copperfield Drywall", "Repairs"),
    ("Harbor Electric", "Electrical"), ("Oakline CPA Group", "Accounting"),
]
GL = {  # account -> (type, typical monthly expense or None)
    "1000 Operating Cash": ("Asset", None),
    "1050 Reserve Cash": ("Asset", None),
    "4000 Assessment Income": ("Income", None),
    "5100 Insurance": ("Expense", "Northfield Insurance Group"),
    "5200 Water and Sewer": ("Expense", "Clearwater Utilities"),
    "5300 Repairs and Maintenance": ("Expense", None),
    "5400 Landscaping": ("Expense", "Riverbend Landscaping"),
    "5500 Management Fees": ("Expense", "Lakeview Property Management"),
    "5600 Legal": ("Expense", "Keystone Legal LLP"),
}
START, END = date(2013, 12, 1), date(2026, 9, 30)


def months(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d = date(d.year + (d.month // 12), d.month % 12 + 1, 1)


def iso(d: date) -> str:
    return d.isoformat() + "T00:00:00"


def money(x: float) -> str:
    return f"{x:.2f}"


def build() -> None:
    if DB.exists():
        DB.unlink()
    con = sqlite3.connect(DB)
    c = con.cursor()
    c.executescript("""
    CREATE TABLE bills ("BillID" INTEGER PRIMARY KEY, "Amount" TEXT, "AmountAllocated" TEXT, "BillDate" TEXT, "DueDate" TEXT, "IsFullyAllocated" TEXT, "Payee" TEXT, "CheckReference" TEXT, "PropertyName" TEXT);
    CREATE TABLE rpt_bills_paid ("BillsBillID", "ChecksReference", "AmountPaid", "ChecksCheckID");
    CREATE TABLE checks ("CheckDetailID" INTEGER PRIMARY KEY, "CheckID" TEXT, "Amount" TEXT, "TransactionDate" TEXT, "Payee" TEXT, "Reference" TEXT, "Comment" TEXT, "DetailComment" TEXT, "PropertyName" TEXT, "IsReversed" TEXT);
    CREATE TABLE history ("HistoryID" INTEGER PRIMARY KEY, "Note" TEXT, "HistoryCategory" TEXT, "HistoryDate" TEXT, "EntityKeyID" TEXT, "EntityType" TEXT, "HasFile" TEXT, "IsPinned" TEXT, "CreateUser" TEXT, "CreateDate" TEXT, "FileCount" TEXT, "FileNames" TEXT);
    CREATE TABLE vendors ("VendorID" INTEGER PRIMARY KEY, "Name" TEXT, "IsActive" TEXT, "Is1099" TEXT, "TaxID" TEXT, "AccountNumber" TEXT, "Category" TEXT, "PaymentMethod" TEXT, "Comment" TEXT, "InsuranceExpiration" TEXT, "WorkersCompExpiration" TEXT);
    CREATE TABLE service_issues ("ServiceManagerIssueID" INTEGER PRIMARY KEY, "Title" TEXT, "Description" TEXT, "Resolution" TEXT, "StatusID" TEXT, "PriorityID" TEXT, "CategoryID" TEXT, "IsClosed" TEXT, "AssignedOpenDate" TEXT, "DueDate" TEXT, "CloseDate" TEXT, "Hours" TEXT, "VendorID" TEXT, "IsSigned" TEXT);
    CREATE TABLE rpt_general_ledger_grid1 ("GLAccountName", "TransactionDate", "TransactionType", "TransactionReference", "PropertyShortName", "Description", "Debit", "Credit", "Balance", "GLAccountTypeName", "GLAccountID", "CustomerName", "UnitName", "SortOrder");
    CREATE TABLE rpt_unit_transaction_listing_grid1 ("PropertyName", "UnitID", "CustomerName", "UnitName", "TransactionDate", "Reference", "Description", "Comment", "Amount", "Balance", "UnitSortOrder", "CustomerLastName", "CustomerFirstName");
    CREATE TABLE rpt_move_in_move_out_grid1 ("LeaseMoveIn", "LeaseMoveOut", "EntitiesName", "AccountsName", "SubEntitiesName", "LeasesMoveInDate", "LeasesMoveOutDate", "AccountsLastName", "AccountsFirstName", "CustomerStatus");
    CREATE TABLE rpt_rent_roll_grid1 ("PropertyName", "CustomerName", "UnitName", "LastName", "FirstName", "ChargeTypeTotal");
    CREATE TABLE unit_sqft ("Unit" TEXT PRIMARY KEY, "SqFt" TEXT);
    """)

    # Vendors
    for i, (name, cat) in enumerate(VENDORS, 1):
        c.execute("INSERT INTO vendors VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                  (i, name, "True", "True" if cat not in ("Utilities", "Insurance") else "False",
                   f"00-000{i:04d}", f"ACCT-{1000 + i}", cat, "Check", "Demo vendor", "", ""))

    # Units, owners, sq ft, rent roll
    dues = {u: round(260 + random.uniform(0, 40), 2) for u in UNITS}
    for u, (first, last) in zip(UNITS, OWNERS):
        c.execute("INSERT INTO unit_sqft VALUES (?,?)", (u, str(random.choice([980, 1040, 1120, 1210]))))
        c.execute("INSERT INTO rpt_rent_roll_grid1 VALUES (?,?,?,?,?,?)",
                  (PROPERTY, f"{first} {last}", u, last, first, money(dues[u])))
        moved_in = date(random.randint(2008, 2022), random.randint(1, 12), 1)
        c.execute("INSERT INTO rpt_move_in_move_out_grid1 VALUES (?,?,?,?,?,?,?,?,?,?)",
                  ("Move In", "", PROPERTY, f"{last}, {first}", u, iso(moved_in), "", last, first, "Current"))

    # Monthly dues per unit -> unit transactions + ledger income
    gl_rows, sort = [], 0
    balances = {k: 0.0 for k in GL}
    unit_bal = {u: 0.0 for u in UNITS}
    for m in months(START, END):
        for u, (first, last) in zip(UNITS, OWNERS):
            amt = dues[u]
            for desc, sign in (("Monthly Assessment", 1), ("Payment - Thank you", -1)):
                unit_bal[u] += sign * amt
                c.execute("INSERT INTO rpt_unit_transaction_listing_grid1 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          (PROPERTY, u, f"{first} {last}", u, iso(m if sign > 0 else m + timedelta(days=random.randint(1, 9))),
                           f"{m:%Y%m}-{u}", desc, "", money(sign * amt), money(unit_bal[u]), int(u), last, first))
            balances["4000 Assessment Income"] -= amt
            sort += 1
            gl_rows.append(("4000 Assessment Income", iso(m), "Charge", f"{m:%Y%m}-{u}", "MAPLE", "Monthly Assessment",
                            "", money(amt), money(balances["4000 Assessment Income"]), "Income", 4000, f"{first} {last}", u, sort))

    # Bills, payments and expense ledger lines
    bill_id = check_id = 0
    for m in months(START, END):
        expenses = [("5500 Management Fees", "Lakeview Property Management", 350.0),
                    ("5200 Water and Sewer", "Clearwater Utilities", round(random.uniform(300, 480), 2)),
                    ("5100 Insurance", "Northfield Insurance Group", round(random.uniform(580, 740), 2))]
        if m.month in (4, 5, 6, 7, 8, 9, 10):
            expenses.append(("5400 Landscaping", "Riverbend Landscaping", round(random.uniform(180, 260), 2)))
        if random.random() < 0.18:
            vname, _ = random.choice([v for v in VENDORS if v[1] in ("Roofing", "Plumbing", "Repairs", "Electrical", "Gutters")])
            expenses.append(("5300 Repairs and Maintenance", vname, round(random.uniform(250, 4200), 2)))
        if random.random() < 0.04:
            expenses.append(("5600 Legal", "Keystone Legal LLP", round(random.uniform(400, 2500), 2)))
        for acct, payee, amt in expenses:
            bill_id += 1
            check_id += 1
            bdate = m + timedelta(days=random.randint(0, 20))
            pdate = bdate + timedelta(days=random.randint(3, 15))
            ref = str(5000 + check_id)
            c.execute("INSERT INTO bills VALUES (?,?,?,?,?,?,?,?,?)",
                      (bill_id, money(amt), money(amt), iso(bdate), iso(bdate + timedelta(days=30)), "True", payee, ref, PROPERTY))
            c.execute("INSERT INTO rpt_bills_paid VALUES (?,?,?,?)", (bill_id, ref, amt, check_id))
            c.execute("INSERT INTO checks VALUES (?,?,?,?,?,?,?,?,?,?)",
                      (check_id, str(check_id), money(amt), iso(pdate), payee, ref, acct.split(" ", 1)[1], "", PROPERTY, "False"))
            balances[acct] += amt
            sort += 1
            gl_rows.append((acct, iso(pdate), "Check", ref, "MAPLE", f"{payee}: {acct.split(' ', 1)[1].lower()}",
                            money(amt), "", money(balances[acct]), GL[acct][0], int(acct.split()[0]), "", "", sort))
        # monthly reserve transfer
        sort += 1
        balances["1050 Reserve Cash"] += 350
        gl_rows.append(("1050 Reserve Cash", iso(m + timedelta(days=27)), "Journal", f"RT{m:%Y%m}", "MAPLE",
                        "Transfer to reserve", "350.00", "", money(balances["1050 Reserve Cash"]), "Asset", 1050, "", "", sort))
    c.executemany("INSERT INTO rpt_general_ledger_grid1 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", gl_rows)

    # History notes with (fake) attachment names
    cats = ["Owner Report", "Inspection", "Insurance", "Legal", "Board Meeting"]
    hid = 0
    for m in months(date(2015, 1, 1), END):
        if random.random() < 0.5:
            hid += 1
            cat = random.choice(cats)
            fname = f"{cat.replace(' ', '_')}_{m:%Y_%m}.pdf"
            c.execute("INSERT INTO history VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                      (hid, f"{cat} for {m:%B %Y}", cat, iso(m + timedelta(days=5)), "1", "Property", "True", "False",
                       "manager", iso(m + timedelta(days=5)), "1", fname))

    # Service requests
    titles = ["Roof leak over unit", "Gutter overflow", "Hallway light out", "Drainage pooling in back yard",
              "Garage door sensor", "Snow removal missed", "Water stain on ceiling", "Loose handrail"]
    for i in range(1, 41):
        opened = START + timedelta(days=random.randint(0, (END - START).days))
        closed = opened + timedelta(days=random.randint(2, 40))
        status = 3 if closed < END else 2
        c.execute("INSERT INTO service_issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (i, random.choice(titles), "Reported by owner (demo data).", "Vendor completed repair (demo data)." if status == 3 else "",
                   status, "2", "1", "True" if status == 3 else "False", iso(opened), iso(opened + timedelta(days=14)),
                   iso(closed) if status == 3 else "", "", str(random.randint(1, len(VENDORS))), "False"))

    # Views (same layouts as the real app)
    c.executescript("""
    CREATE VIEW v_bills AS SELECT b.Payee AS "Payee", b.PropertyName AS "Property", REPLACE(b.BillDate, 'T00:00:00', '') AS "Bill Date", REPLACE(b.DueDate, 'T00:00:00', '') AS "Due Date", CASE WHEN b.IsFullyAllocated = 'True' THEN 'Yes' ELSE 'No' END AS "Paid", COALESCE(bp.ChecksReference, '') AS "Check #", b.Amount AS "Amount", b.Amount - COALESCE(bp.AmountPaid, 0) AS "Remaining", b.AmountAllocated AS "Allocated", b.CheckReference AS "Reference", b.BillID AS "Bill ID", bp.ChecksCheckID AS "Check ID" FROM bills b LEFT JOIN rpt_bills_paid bp ON b.BillID = bp.BillsBillID ORDER BY b.BillDate DESC;
    CREATE VIEW v_checks AS SELECT Reference AS "Reference", REPLACE(TransactionDate, 'T00:00:00', '') AS "Date", Payee AS "Payee", Comment AS "Comment", Amount AS "Amount", DetailComment AS "Detail", PropertyName AS "Property", IsReversed AS "Reversed", CheckID AS "Check ID" FROM checks ORDER BY TransactionDate DESC;
    CREATE VIEW v_history AS SELECT SUBSTR(HistoryDate, 6, 2) || '/' || SUBSTR(HistoryDate, 9, 2) || '/' || SUBSTR(HistoryDate, 1, 4) AS "Date", Note AS "Note", FileNames AS "Files", CreateUser AS "Author" FROM history WHERE HasFile = 'True' ORDER BY HistoryDate DESC;
    CREATE VIEW v_ledger AS SELECT TransactionType AS "Type", REPLACE(TransactionDate, 'T00:00:00', '') AS "Date", GLAccountName AS "Account", Description AS "Description", Debit AS "Debit", Credit AS "Credit", Balance AS "Balance", CustomerName AS "Customer", UnitName AS "Unit", GLAccountTypeName AS "Account Type" FROM rpt_general_ledger_grid1 ORDER BY TransactionDate DESC, SortOrder;
    CREATE VIEW v_rent_roll AS SELECT ROW_NUMBER() OVER (ORDER BY CAST(r.UnitName AS INTEGER)) AS "#", r.UnitName AS "Unit", r.FirstName || ' ' || r.LastName AS "Homeowner", CAST(COALESCE(s.SqFt, '') AS TEXT) AS "Sq Ft", CAST(r.ChargeTypeTotal AS REAL) AS "Fee" FROM rpt_rent_roll_grid1 r LEFT JOIN unit_sqft s ON r.UnitName = s.Unit ORDER BY CAST(r.UnitName AS INTEGER);
    CREATE VIEW v_service_issues AS SELECT ServiceManagerIssueID AS "Issue #", REPLACE(AssignedOpenDate, 'T00:00:00', '') AS "Open Date", REPLACE(CloseDate, 'T00:00:00', '') AS "Closed", CASE StatusID WHEN 1 THEN 'Open' WHEN 2 THEN 'In Progress' WHEN 3 THEN 'Closed' ELSE 'Unknown' END AS "Status", Title AS "Title", Description AS "Description", '' AS "Property", Resolution AS "Resolution", REPLACE(DueDate, 'T00:00:00', '') AS "Due Date" FROM service_issues ORDER BY AssignedOpenDate DESC;
    CREATE VIEW v_vendors AS SELECT Name AS "Name", CASE WHEN IsActive = 'True' THEN 'Yes' ELSE 'No' END AS "Active", Category AS "Category", TaxID AS "Tax ID", AccountNumber AS "Account #", Comment AS "Notes" FROM vendors ORDER BY Name;
    """)
    con.commit()
    for t in ("rpt_general_ledger_grid1", "rpt_unit_transaction_listing_grid1", "bills", "checks", "history", "vendors", "service_issues"):
        print(f"{t}: {c.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]} fake rows")
    con.close()
    print(f"Wrote {DB}")


if __name__ == "__main__":
    build()
