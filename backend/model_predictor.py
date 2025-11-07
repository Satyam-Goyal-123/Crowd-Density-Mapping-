import json
import math
import time
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta

DATA_FILE = "data.json"

# -----------------------
# I/O utilities
# -----------------------
def read_data():
    try:
        with open(DATA_FILE, "r") as f:
            data = json.load(f)
    except Exception:
        data = []
    return data

def write_data_point(point):
    data = read_data()
    data.append(point)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# -----------------------
# Timestamp handling & filtering
# -----------------------
def parse_ts_val(t):
    """Return float seconds since epoch for timestamp-like value.
    Accepts:
     - epoch seconds (float/int)
     - epoch milliseconds (very large int)
     - ISO string
     - small integers (assumed epoch seconds as-is)
    """
    if t is None:
        return None
    # already numeric
    try:
        val = float(t)
        # if timestamp looks like milliseconds -> convert
        if val > 1e12:
            return val / 1000.0
        return val
    except Exception:
        # try ISO
        try:
            return datetime.fromisoformat(str(t)).timestamp()
        except Exception:
            return None

def filter_by_time(data, range_key):
    """Return list of points that fall in the requested window.
    range_key: 'current' (all), 'hour', 'day', 'week'
    """
    if not data:
        return []

    now = time.time()

    if range_key == "hour":
        cutoff = now - 3600
    elif range_key == "day":
        cutoff = now - 86400
    elif range_key == "week":
        cutoff = now - 7 * 86400
    else:
        cutoff = -1e18  # include all

    filtered = []
    for d in data:
        ts = parse_ts_val(d.get("timestamp"))
        if ts is None:
            # if timestamp missing, keep it only for 'current' (we treat as recent)
            if range_key == "current":
                filtered.append(d)
            continue
        if ts >= cutoff:
            filtered.append(d)
    return filtered

# -----------------------------
# Data preprocessing utilities
# -----------------------------
def build_location_df(data, location):
    recs = [r for r in data if r.get("location") == location]
    if not recs:
        return pd.DataFrame()
    df = pd.DataFrame(recs)
    df["ts_float"] = df["timestamp"].apply(parse_ts_val)
    df = df.dropna(subset=["ts_float"])
    df = df.sort_values("ts_float")
    # ensure numeric columns exist
    for c in ["wifi_count", "ble_count", "total_count"]:
        if c not in df.columns:
            df[c] = 0
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    return df

# -----------------------------
# Prediction & Analysis Helpers
# -----------------------------
def predict_with_lr(series_ts, series_y, future_steps=6):
    """Linear regression-based time extrapolation"""
    if len(series_y) < 2:
        return [float(series_y[-1]) if len(series_y) else 0.0] * future_steps

    X = np.array(series_ts).reshape(-1, 1)
    y = np.array(series_y).astype(float)
    X_fit, y_fit = X[-20:], y[-20:]

    model = LinearRegression()
    try:
        model.fit(X_fit, y_fit)
        last_ts = float(X_fit[-1, 0])
        diffs = np.diff(X_fit.flatten())
        step = float(np.median(diffs)) if len(diffs) else 1.0
        preds = []
        for i in range(1, future_steps + 1):
            t = last_ts + i * step
            val = float(model.predict([[t]])[0])
            preds.append(max(0.0, val))
        return preds
    except Exception:
        ma = float(np.mean(y_fit)) if len(y_fit) else 0.0
        return [ma] * future_steps

def exponential_smoothing(series, alpha=0.5):
    if len(series) == 0:
        return None
    s = float(series[0])
    for x in series[1:]:
        s = alpha * float(x) + (1 - alpha) * s
    return s

def detect_anomalies(series):
    if len(series) < 5:
        return []
    arr = np.array(series, dtype=float)
    mean, std = float(arr.mean()), float(arr.std())
    if std == 0:
        return []
    z = (arr - mean) / std
    idx = np.where(np.abs(z) > 2.5)[0].tolist()
    return idx

# -----------------------------
# Advanced Predictive Features
# -----------------------------
def compute_peak_hour_forecast(df):
    """Return hour (0-23) with highest average total_count in df"""
    if df.empty:
        return None
    # ensure ts_float
    df = df.copy()
    df["hour"] = df["ts_float"].apply(lambda x: int(datetime.fromtimestamp(float(x)).hour))
    hour_means = df.groupby("hour")["total_count"].mean()
    if hour_means.empty:
        return None
    return int(hour_means.idxmax())

def compute_growth_rate(series):
    if len(series) < 2:
        return 0.0
    try:
        growth = ((float(series[-1]) - float(series[-2])) / max(float(series[-2]), 1.0)) * 100.0
        return round(float(growth), 2)
    except Exception:
        return 0.0

def compute_correlation(x, y):
    try:
        x_arr = np.array(x, dtype=float)
        y_arr = np.array(y, dtype=float)
        if len(x_arr) < 2 or len(y_arr) < 2:
            return None
        corr = np.corrcoef(x_arr, y_arr)[0, 1]
        if np.isnan(corr):
            return None
        return round(float(corr), 3)
    except Exception:
        return None

# -----------------------------
# Core Summaries
# -----------------------------
def summarize_location(data, location):
    df = build_location_df(data, location)
    if df.empty:
        return {}

    ts = df["ts_float"].values
    wifi = df["wifi_count"].values
    ble = df["ble_count"].values
    total = df["total_count"].values

    # Predictions
    short_pred = predict_with_lr(ts, total, future_steps=5)
    medium_pred = predict_with_lr(ts, total, future_steps=30)
    long_pred = predict_with_lr(ts, total, future_steps=120)

    # Trend (slope)
    slope = 0.0
    try:
        X_fit = ts.reshape(-1, 1)[-20:]
        y_fit = total[-20:]
        if len(X_fit) >= 2:
            lr = LinearRegression().fit(X_fit, y_fit)
            slope = float(lr.coef_[0])
    except Exception:
        slope = 0.0

    smoothed = exponential_smoothing(total[-10:].tolist()) if len(total) else None
    anomalies_idx = detect_anomalies(total)
    anomalies = [int(df.iloc[i]["timestamp"]) for i in anomalies_idx if i < len(df)]
    p90 = float(np.percentile(total, 90)) if len(total) else 0.0
    current = int(float(total[-1])) if len(total) else 0
    busy = bool(current >= p90)

    # Advanced analytics
    peak_hour = compute_peak_hour_forecast(df)
    growth_rate = compute_growth_rate(total)
    wifi_ble_corr = compute_correlation(wifi, ble)

    # Construct pure-python dict (no numpy types)
    return {
        "location": str(location),
        "current": int(current),
        "smoothed": float(smoothed) if smoothed is not None else None,
        "slope": float(slope),
        "short_pred": [int(round(float(x))) for x in short_pred],
        "medium_pred_sample": [int(round(float(x))) for x in (medium_pred[:5] if medium_pred else [])],
        "long_pred_sample": [int(round(float(x))) for x in (long_pred[:5] if long_pred else [])],
        "anomalies": anomalies,
        "busy": bool(busy),
        "p90": int(round(float(p90))),
        "peak_hour": int(peak_hour) if peak_hour is not None else None,
        "growth_rate": float(growth_rate),
        "wifi_ble_corr": float(wifi_ble_corr) if wifi_ble_corr is not None else None,
    }

def global_summary(data):
    # Return overall summary and per-location summaries
    locations = sorted(list({r.get("location") for r in data if r.get("location")}))
    summaries = [summarize_location(data, loc) for loc in locations]

    def avg_short(s):
        arr = s.get("short_pred") or []
        return float(np.mean(arr)) if len(arr) else 0.0

    busiest = None
    if summaries:
        busiest = max(summaries, key=avg_short).get("location")

    # Heatmap data: average of short_pred per location (fallback to current)
    heat_data = {}
    for s in summaries:
        loc = s.get("location")
        vals = s.get("short_pred") or []
        if len(vals):
            heat_data[loc] = float(np.mean(vals))
        else:
            heat_data[loc] = float(s.get("current") or 0)

    # Build pure python output
    out = {
        "locations": locations,
        "summaries": summaries,
        "predicted_busiest": busiest,
        "heatmap_data": heat_data,
    }
    return out
