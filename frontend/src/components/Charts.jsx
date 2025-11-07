import React from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

function toChartData(raw) {
  if (!raw || !raw.length) return [];
  return raw.map((r) => ({
    t: String(r.timestamp),
    wifi: r.wifi_count,
    ble: r.ble_count,
    total: r.total_count,
  }));
}

export default function Charts({ raw, summary, rangeLabel = "Current" }) {
  const data = toChartData(raw);
  const current = summary?.current || 0;
  const wifi = raw.length ? raw[raw.length - 1].wifi_count : 0;
  const ble = raw.length ? raw[raw.length - 1].ble_count : 0;
  const COLORS = ["#2563EB", "#10B981", "#F97316"];

  return (
    <div id="charts-section" className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold">Dashboard — {rangeLabel}</h3>
        <p className="text-sm text-slate-500">Live & historical analytics for selected range</p>
      </div>

      {/* 1. Line */}
      <div className="chart-block" data-chart-title="Crowd Trends Over Time (Total / WiFi / BLE)">
        <h5 className="text-sm font-semibold text-slate-700 mb-1">📈 Crowd Trends Over Time</h5>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="t" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="wifi" stroke="#10B981" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="ble" stroke="#F97316" strokeWidth={1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Bar */}
      <div className="chart-block" data-chart-title="Device Count Comparison (WiFi vs BLE)">
        <h5 className="text-sm font-semibold text-slate-700 mb-1">📊 Device Count Comparison (WiFi vs BLE)</h5>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="t" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="wifi" fill="#10B981" />
              <Bar dataKey="ble" fill="#F97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Area */}
      <div className="chart-block" data-chart-title="Smoothed Total Crowd Density (Area)">
        <h5 className="text-sm font-semibold text-slate-700 mb-1">🌊 Smoothed Total Crowd Density</h5>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <XAxis dataKey="t" hide />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="total" stroke="#2563EB" fill="#93C5FD" fillOpacity={0.4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Pie */}
      <div className="chart-block" data-chart-title="Current Device Distribution (Pie)">
        <h5 className="text-sm font-semibold text-slate-700 mb-1">🥧 Current Device Distribution</h5>
        <div className="h-40 flex justify-center">
          <ResponsiveContainer width="70%" height="100%">
            <PieChart>
              <Pie
                dataKey="value"
                data={[
                  { name: "WiFi", value: wifi },
                  { name: "BLE", value: ble },
                  { name: "Other", value: Math.max(0, current - wifi - ble) },
                ]}
                innerRadius={30}
                outerRadius={60}
                label
              >
                {COLORS.map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
