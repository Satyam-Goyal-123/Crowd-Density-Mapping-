import React from "react";
import Charts from "./Charts";

export default function LocationCard({ summary, raw }) {
  return (
    <div className="location-card bg-white p-4 rounded-2xl shadow" data-report-summary={`${summary.location}: Current ${summary.current}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold">{summary.location}</h4>
          <div className="text-xs text-slate-500">Current: {summary.current} • Smoothed: {Math.round(summary.smoothed || 0)}</div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs ${summary.busy ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
          {summary.busy ? "Busy" : "Normal"}
        </div>
      </div>

      <div className="mb-3">
        {/* Charts expects raw for that location; small charts are fine */}
        <Charts raw={raw} summary={summary} />
      </div>

      <div className="flex gap-2 text-sm text-slate-600">
        <div>Trend: {summary.slope > 0 ? "Rising" : "Falling"}</div>
        <div>| P90: {summary.p90}</div>
        <div>| Anomalies: {summary.anomalies?.length || 0}</div>
      </div>
    </div>
  );
}
