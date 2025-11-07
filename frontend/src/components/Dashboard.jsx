import React, { useEffect, useState, useRef } from "react";
import { fetchPredictions, fetchData } from "../api";
import LocationCard from "./LocationCard";
import PredictionsTable from "./PredictionsTable";
import DownloadReport from "./DownloadReport";

export default function Dashboard() {
  const [range, setRange] = useState("current");
  const [summary, setSummary] = useState(null);
  const [raw, setRaw] = useState([]);
  const intervalRef = useRef(null);

  async function load(r = range) {
    try {
      const p = await fetchPredictions(r);
      const d = await fetchData(r);
      setSummary(p);
      setRaw(d.data || d);
    } catch (err) {
      console.error("load error", err);
    }
  }

  useEffect(() => {
    load(range);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => load(range), 5000);
    return () => clearInterval(intervalRef.current);
  }, [range]);

  // heat helpers
  const heatData = summary?.summaries || [];
  const maxVal = Math.max(...heatData.map((s) => s.current || 0), 1);

  return (
    <div className="space-y-6" id="report-root">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">ESP32 Crowd Dashboard</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Time range:</label>
          <select
            className="px-3 py-2 rounded-lg border"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="current">Current</option>
            <option value="hour">Past hour</option>
            <option value="day">Past day</option>
            <option value="week">Past week</option>
          </select>
        </div>
      </div>

      <div className="flex items-start gap-6">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {summary?.summaries?.map((s) => (
            <LocationCard key={s.location} summary={s} raw={raw.filter((r) => r.location === s.location)} />
          ))}
        </div>

        <aside className="w-96">
          <div className="p-4 bg-white rounded-2xl shadow">
            <h3 className="font-semibold mb-2">Global</h3>
            <p>Predicted busiest: <strong>{summary?.predicted_busiest || "—"}</strong></p>
            <div className="mt-4">
              <PredictionsTable summaries={summary?.summaries || []} />
            </div>
            <div className="mt-4">
              <DownloadReport targetId="report-root" filename={`ESP32-report-${range}-${Date.now()}.pdf`} range={range} />
            </div>
          </div>
        </aside>
      </div>

      {/* HEATMAP */}
      <div id="heatmap-section" className="p-4 bg-white rounded-2xl shadow">
        <h3 className="font-semibold mb-3">Crowd Heatmap (by Location)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {heatData.map((s) => {
            const intensity = (s.current || 0) / maxVal;
            const color = `rgba(255, 64, 64, ${0.3 + intensity * 0.7})`;
            return (
              <div
                key={s.location}
                className="rounded-xl p-3 text-center font-medium text-slate-800"
                style={{ backgroundColor: color }}
                data-report-summary={`${s.location}: Current ${s.current}`}
              >
                {s.location} <br />
                <span className="text-xs text-slate-600">Current: {s.current}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
