"""One-off generator for 12 monthly demo CSVs. Run: python _gen_csv.py"""
from pathlib import Path

OUT = Path(__file__).parent / "csv"
OUT.mkdir(parents=True, exist_ok=True)

MONTHLY = {
    1: 4_100_000,
    2: 4_200_000,
    3: 4_150_000,
    4: 4_300_000,
    5: 4_250_000,
    6: 4_400_000,
    7: 4_350_000,
    8: 4_500_000,
    9: 4_450_000,
    10: 4_600_000,
    11: 4_550_000,
    12: 4_700_000,
}
PLATFORMS = ["Facebook", "Zalo", "Website", "Instagram", "TikTok"]
CUSTOMERS = ["Nguyễn Văn A", "Trần Thị B", "Lê Văn C", "Phạm Thị D", "Hoàng Thị E"]
DESCS = [
    "Bán 2 áo thun",
    "Bán 1 túi xách",
    "Bán 5 sản phẩm",
    "Bán 3 áo sơ mi",
    "Bán 4 khăn",
]
INDUSTRY = "Phân phối, hàng hóa"
PREFIX = ["FB", "ZA", "WEB", "IG", "TT"]


def split_total(total: int, n: int = 5) -> list[int]:
    base = total // n
    rem = total - base * n
    parts = [base] * n
    for i in range(rem):
        parts[i] += 1
    return parts


def main() -> None:
    year_total = 0
    for m, total in MONTHLY.items():
        period = f"2026-{m:02d}"
        fname = f"mint_shop_goods_{period}.csv"
        parts = split_total(total)
        lines = [
            "date,revenue,platform,period,customer,description,order_id,industry"
        ]
        days = [1, 5, 12, 18, 25]
        for i, rev in enumerate(parts):
            d = f"2026-{m:02d}-{days[i]:02d}"
            oid = f"{PREFIX[i]}-{m:02d}-{i + 1:02d}"
            lines.append(
                f"{d},{rev},{PLATFORMS[i]},{period},{CUSTOMERS[i]},"
                f"{DESCS[i]},{oid},{INDUSTRY}"
            )
        (OUT / fname).write_text("\n".join(lines) + "\n", encoding="utf-8")
        year_total += total
        print(f"  {fname}: {total:,} VND")

    print(f"\nYear total: {year_total:,} VND")


if __name__ == "__main__":
    main()
