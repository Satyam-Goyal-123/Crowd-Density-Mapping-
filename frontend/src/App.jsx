import React from 'react'
import Dashboard from './components/Dashboard'

export default function App(){
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold">ESP32 Crowd Dashboard</h1>
          <div className="text-sm text-slate-500">Live predictions & reports</div>
        </header>
        <Dashboard />
      </div>
    </div>
  )
}
