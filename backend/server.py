from flask import Flask, request, jsonify
from flask_cors import CORS
from model_predictor import write_data_point, read_data, summarize_location, global_summary, DATA_FILE, filter_by_time, read_data
import json
import os
import numpy as np

app = Flask(__name__)
CORS(app)

# Ensure data file exists
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump([], f)

@app.route("/post_data", methods=["POST"])
def receive_data():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "msg": "no json body"}), 400
        # normalize/validate fields
        point = {
            "location": data.get("location", "Unknown"),
            "timestamp": data.get("timestamp" , data.get("ts") ),
            "wifi_count": int(data.get("wifi_count", 0)),
            "ble_count": int(data.get("ble_count", 0)),
            "total_count": int(data.get("total_count", data.get("wifi_count",0) + data.get("ble_count",0)))
        }
        write_data_point(point)
        # return quick summary for this location
        all_data = read_data()
        summary = summarize_location(all_data, point["location"]) or {}
        return jsonify({"status":"success", "received": point, "summary": summary}), 200
    except Exception as e:
        print("❌ Error:", e)
        return jsonify({"status": "error", "msg": str(e)}), 400

@app.route("/data", methods=["GET"])
def get_data():
    # range param: current (default), hour, day, week
    range_key = request.args.get("range", "current")
    with open(DATA_FILE, "r") as f:
        data = json.load(f)
    # use model_predictor.filter_by_time if available
    try:
        from model_predictor import filter_by_time
        filtered = filter_by_time(data, range_key)
    except Exception:
        filtered = data
    return jsonify({"range": range_key, "data": filtered})

@app.route("/predictions", methods=["GET"])
def get_predictions():
    range_key = request.args.get("range", "current")
    with open(DATA_FILE, "r") as f:
        data = json.load(f)
    # filter
    try:
        from model_predictor import filter_by_time
        filtered = filter_by_time(data, range_key)
    except Exception:
        filtered = data

    summary = global_summary(filtered)

    # Convert any numpy types to python native recursively
    def to_native(x):
        if isinstance(x, np.generic):
            return x.item()
        if isinstance(x, dict):
            return {k: to_native(v) for k, v in x.items()}
        if isinstance(x, list):
            return [to_native(v) for v in x]
        return x

    return jsonify(to_native(summary))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
