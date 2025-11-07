import React from 'react'

export default function PredictionsTable({summaries}){
  return (
    <div className="text-sm">
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs text-slate-400">
            <th>Location</th>
            <th className="text-right">Current</th>
            <th className="text-right">Next(5)</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(s=> (
            <tr key={s.location} className="border-t">
              <td className="py-2">{s.location}</td>
              <td className="py-2 text-right">{s.current}</td>
              <td className="py-2 text-right">{s.short_pred?.[0] ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
