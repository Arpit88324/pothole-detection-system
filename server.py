from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import os
import sqlite3
import math
from datetime import datetime, timezone

app = Flask(__name__)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "*")
CORS(app, resources={r"/api/*": {"origins": FRONTEND_URL}})

# ─── Model ────────────────────────────────────────────────────────────────────
MODEL_PATH = "runs/detect/train-3/weights/best.pt"
model = None

import threading
def load_model_async():
    global model
    print("⏳ Loading YOLO model in background to prevent startup blocking...")
    try:
        model = YOLO(MODEL_PATH)
        print("✅ YOLO model loaded and ready.")
    except Exception as e:
        print(f"❌ Failed to load YOLO model: {e}")

# Start background thread to load model exactly once per worker process
threading.Thread(target=load_model_async, daemon=True).start()

# ─── GPS Duplicate-Prevention Thresholds ──────────────────────────────────────
GPS_DISTANCE_THRESHOLD_M = 30   # metres — closer detections are treated as duplicates
GPS_TIME_THRESHOLD_S     = 60   # seconds — only consider recent records for dedup

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL")
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "potholes.db")

def get_db():
    if DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        return conn, "postgres"
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn, "sqlite"

def execute_query(query, args=(), fetch=None):
    conn, db_type = get_db()
    try:
        if db_type == "postgres":
            query = query.replace("?", "%s")
            if fetch == "lastrowid":
                query += " RETURNING id"
            with conn.cursor() as cur:
                cur.execute(query, args)
                if fetch == "all":
                    res = cur.fetchall()
                elif fetch == "one":
                    res = cur.fetchone()
                elif fetch == "lastrowid":
                    res = cur.fetchone()["id"]
                else:
                    res = None
            conn.commit()
            return res
        else:
            cur = conn.execute(query, args)
            if fetch == "all":
                res = cur.fetchall()
            elif fetch == "one":
                res = cur.fetchone()
            elif fetch == "lastrowid":
                res = cur.lastrowid
            else:
                res = None
            conn.commit()
            return res
    finally:
        conn.close()

def init_db():
    """Create the GPS potholes table if it doesn't exist."""
    conn, db_type = get_db()
    try:
        if db_type == "postgres":
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS gps_potholes (
                        id           SERIAL PRIMARY KEY,
                        latitude     DOUBLE PRECISION NOT NULL,
                        longitude    DOUBLE PRECISION NOT NULL,
                        gps_accuracy DOUBLE PRECISION,
                        confidence   DOUBLE PRECISION NOT NULL,
                        severity     VARCHAR NOT NULL,
                        class_name   VARCHAR,
                        timestamp    VARCHAR NOT NULL,
                        image_b64    TEXT
                    )
                """)
            conn.commit()
            print("✅ GPS potholes PostgreSQL database ready")
        else:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS gps_potholes (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    latitude     REAL    NOT NULL,
                    longitude    REAL    NOT NULL,
                    gps_accuracy REAL,
                    confidence   REAL    NOT NULL,
                    severity     TEXT    NOT NULL,
                    class_name   TEXT,
                    timestamp    TEXT    NOT NULL,
                    image_b64    TEXT
                )
            """)
            conn.commit()
            print("✅ GPS potholes SQLite database ready →", DB_PATH)
    finally:
        conn.close()

# ─── Haversine Distance ───────────────────────────────────────────────────────
def haversine_m(lat1, lng1, lat2, lng2):
    """Return distance in metres between two GPS coordinates."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi       = math.radians(lat2 - lat1)
    dlambda    = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# â”€â”€â”€ Existing Routes (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route("/api/detect", methods=["POST"])
def detect():
    if model is None:
        return jsonify({"error": "AI model is still warming up. Please try again in a moment."}), 503

    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]

    # Read image from upload
    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if img is None:
        return jsonify({"error": "Invalid image file"}), 400

    # Run detection â€” all road hazard classes
    results = model.predict(source=img, conf=0.1)
    result = results[0]

    # Build detections list
    detections = []
    if result.boxes is not None and len(result.boxes) > 0:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "name": result.names[cls_id],
                "confidence": round(conf * 100, 1),
                "bbox": {
                    "x1": round(x1),
                    "y1": round(y1),
                    "x2": round(x2),
                    "y2": round(y2)
                }
            })

    # Draw annotated image
    annotated = result.plot()

    # Encode annotated image to base64
    _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 90])
    annotated_b64 = base64.b64encode(buffer).decode("utf-8")

    # Encode original image to base64
    _, orig_buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    original_b64 = base64.b64encode(orig_buffer).decode("utf-8")

    return jsonify({
        "original": original_b64,
        "annotated": annotated_b64,
        "detections": detections,
        "total_detections": len(detections),
        "image_size": {
            "width": img.shape[1],
            "height": img.shape[0]
        }
    })


@app.route("/api/stream_detect", methods=["POST"])
def stream_detect():
    if model is None:
        return jsonify({"error": "AI model is still warming up. Please try again in a moment."}), 503

    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]

    # Read image from upload
    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if img is None:
        return jsonify({"error": "Invalid image file"}), 400

    # Run detection
    results = model.predict(source=img, conf=0.1, verbose=False)

    detections = []
    if results and len(results) > 0:
        result = results[0]
        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "name": result.names[cls_id],
                    "confidence": conf,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2
                })

    return jsonify({"detections": detections})


@app.route("/", methods=["GET", "HEAD"])
def index():
    return "Pothole Detection API is running!", 200


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_PATH, "model_ready": model is not None})


# â”€â”€â”€ New GPS Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route("/api/gps_detect", methods=["POST"])
def gps_detect():
    """
    Receive a GPS-tagged pothole detection and persist it if it is not a
    duplicate of a recent nearby record.

    Expected JSON body:
        latitude     (float, required)
        longitude    (float, required)
        gps_accuracy (float, optional â€” metres)
        confidence   (float, required â€” 0-100)
        severity     (str,   required â€” 'critical' | 'moderate' | 'low')
        class_name   (str,   optional â€” YOLO class label)
        image_b64    (str,   optional â€” base64 thumbnail)
    """
    data = request.get_json(silent=True) or {}

    # Validate required fields
    try:
        lat  = float(data["latitude"])
        lng  = float(data["longitude"])
        conf = float(data["confidence"])
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"error": f"Missing or invalid field: {e}"}), 400

    severity     = str(data.get("severity",    "moderate"))
    class_name   = str(data.get("class_name",  "pothole"))
    gps_accuracy = data.get("gps_accuracy")
    image_b64    = data.get("image_b64")
    now_iso      = datetime.now(timezone.utc).isoformat()

    # Duplicate prevention
    if DATABASE_URL:
        recent = execute_query(
            f"SELECT latitude, longitude FROM gps_potholes WHERE CAST(timestamp AS TIMESTAMP) > NOW() - INTERVAL '{GPS_TIME_THRESHOLD_S} seconds'",
            fetch="all"
        )
    else:
        recent = execute_query(
            "SELECT latitude, longitude FROM gps_potholes WHERE datetime(timestamp) > datetime('now', ?)",
            (f"-{GPS_TIME_THRESHOLD_S} seconds",),
            fetch="all"
        )

    for row in recent:
        dist = haversine_m(lat, lng, row["latitude"], row["longitude"])
        if dist < GPS_DISTANCE_THRESHOLD_M:
            return jsonify({
                "saved":  False,
                "reason": "duplicate",
                "dist_m": round(dist, 1),
            }), 200

    # Insert new record
    new_id = execute_query(
        """
        INSERT INTO gps_potholes
            (latitude, longitude, gps_accuracy, confidence, severity,
             class_name, timestamp, image_b64)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (lat, lng, gps_accuracy, conf, severity, class_name, now_iso, image_b64),
        fetch="lastrowid"
    )

    print(f"ðŸ“ GPS pothole saved  id={new_id}  lat={lat:.6f} lng={lng:.6f}  sev={severity}  conf={conf:.1f}%")

    return jsonify({
        "saved":      True,
        "id":         new_id,
        "latitude":   lat,
        "longitude":  lng,
        "severity":   severity,
        "confidence": conf,
        "timestamp":  now_iso,
    }), 201


@app.route("/api/gps_potholes", methods=["GET"])
@app.route("/api/potholes", methods=["GET"])
def gps_potholes():
    """Return all stored GPS-tagged potholes as a JSON array (no image data)."""
    rows = execute_query("SELECT id, latitude, longitude, gps_accuracy, confidence, severity, class_name, timestamp FROM gps_potholes ORDER BY id DESC", fetch="all")
    return jsonify([dict(row) for row in rows])


@app.route("/api/gps_potholes/<int:pothole_id>", methods=["DELETE"])
def delete_gps_pothole(pothole_id):
    """Delete a single GPS pothole record by ID."""
    execute_query("DELETE FROM gps_potholes WHERE id = ?", (pothole_id,))
    return jsonify({"deleted": True, "id": pothole_id})


# â”€â”€â”€ Startup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    print(f"ðŸš€ Pothole Detection API starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)

