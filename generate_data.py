import csv
from app import simulate
rows = simulate(30, seed=7)
with open("data/data.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["id", "lat", "lon", "jenis", "berat"])
    w.writeheader()
    for r in rows:
        w.writerow({k: r[k] for k in w.fieldnames})
print("data/data.csv dibuat:", len(rows), "titik")
