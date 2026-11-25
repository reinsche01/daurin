import csv, math, random
from pathlib import Path
import numpy as np
from flask import Flask, jsonify, render_template, request
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

app = Flask(__name__)
DATA = Path(__file__).parent / "data" / "data.csv"
AREAS = [(-5.4295, 105.2610), (-5.3900, 105.2800), (-5.4700, 105.2400), (-5.4200, 105.3100)]  # ubah sesuai kotamu
JENIS = ["plastik", "kertas", "kaca", "logam", "elektronik"]
EMISI_PER_KM = 0.1  # kg CO2/km, ASUMSI motor; ganti dengan faktor dari sumber resmi

def haversine(a, b):
    r = 6371
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = p2 - p1, math.radians(b["lon"] - a["lon"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))

def route_km(pts):
    return sum(haversine(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

def nearest_neighbor(pts):
    left, order = pts[:], []
    cur = left.pop(0)
    order.append(cur)
    while left:
        cur = min(left, key=lambda p: haversine(cur, p))
        left.remove(cur)
        order.append(cur)
    return order

def simulate(n, prefix="S", seed=None):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        c = rnd.choice(AREAS)
        out.append({"id": f"{prefix}{i+1:03d}", "lat": round(rnd.gauss(c[0], 0.012), 6),
                    "lon": round(rnd.gauss(c[1], 0.012), 6), "jenis": rnd.choice(JENIS),
                    "berat": round(rnd.uniform(0.5, 10), 1), "sumber": "simulasi"})
    return out

@app.route("/")
def index():
    return render_template("index.html", center=AREAS[0])

@app.route("/api/data")
def get_data():
    with open(DATA, newline="", encoding="utf-8") as f:
        rows = [{"id": r["id"], "lat": float(r["lat"]), "lon": float(r["lon"]), "jenis": r["jenis"],
                 "berat": float(r["berat"]), "sumber": "simulasi"} for r in csv.DictReader(f)]
    return jsonify(rows)

@app.route("/api/simulasi")
def get_sim():
    n = min(int(request.args.get("n", 20)), 100)
    return jsonify(simulate(n, prefix=f"T{random.randint(100, 999)}-"))

@app.route("/api/cluster", methods=["POST"])
def cluster():
    body = request.get_json()
    pts, k = body["points"], int(body["k"])
    if len(pts) < 2:
        return jsonify({"error": "Minimal 2 titik."}), 400
    k = max(2, min(k, len(pts)))
    X = np.array([[p["lat"], p["lon"]] for p in pts])
    labels = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(X)
    sil = float(silhouette_score(X, labels)) if k < len(pts) else None
    # Sebelum: titik dibagi acak ke k pelestari, dijemput sesuai urutan masuk
    before = sum(route_km(pts[i::k]) for i in range(k))
    # Sesudah: satu cluster = satu pelestari, urutan jemput nearest neighbor
    after, result = 0, []
    for c in range(k):
        group = [dict(p) for p, l in zip(pts, labels) if l == c]
        if not group:
            continue
        ordered = nearest_neighbor(group)
        after += route_km(ordered)
        for n, p in enumerate(ordered, 1):
            p.update(cluster=c, urutan=n, pelestari=f"Pelestari {c+1}")
            result.append(p)
    hemat = max(before - after, 0)
    return jsonify({"points": result, "k": k, "silhouette": sil,
                    "km_sebelum": round(before, 2), "km_sesudah": round(after, 2),
                    "km_hemat": round(hemat, 2), "persen": round(hemat / before * 100, 1) if before else 0,
                    "emisi_hemat": round(hemat * EMISI_PER_KM, 2)})

if __name__ == "__main__":
    app.run(debug=False)