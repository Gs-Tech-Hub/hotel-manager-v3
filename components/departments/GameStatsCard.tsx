"use client"

import { formatTablePrice } from '@/lib/formatters'

type GameStatsType = {
  totalGames: number
  completedGames: number
  pendingGames: number
  totalRevenue: number
  pendingRevenue: number
  completionRate: number
  sectionSummary?: Array<{
    sectionId: string
    sectionName: string
    sessions: number
    gamesPlayed: number
    completedSessions: number
    pendingSessions: number
    revenueCollected: number
    revenuePending: number
  }>
  paidGames?: Array<{
    sessionId: string
    startedAt: string | null
    endedAt: string | null
    sectionId: string
    sectionName: string
    customerId: string | null
    customerName: string
    customerPhone: string | null
    serviceId: string | null
    serviceName: string
    gameCount: number
    orderId: string | null
    orderNumber: string | null
    subtotal: number
    tax: number
    total: number
    paymentStatus: string | null
  }>
}

type GameStatsCardProps = {
  stats: GameStatsType | null
}

export default function GameStatsCard({ stats }: GameStatsCardProps) {
  if (!stats) {
    return (
      <div className="rounded border border-gray-200 p-6 text-center text-gray-500">
        No game statistics available for the selected date range.
      </div>
    )
  }

  const { totalGames, completedGames, pendingGames, totalRevenue, pendingRevenue, completionRate, sectionSummary, paidGames } = stats

  return (
    <div className="space-y-4">
      {/* REVENUE STATS TABLE */}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-green-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-green-900">💰 Revenue (Paid & Closed)</th>
              <th className="text-right px-4 py-3 font-semibold text-green-900">Collected</th>
              <th className="text-right px-4 py-3 font-semibold text-green-900">Other Sessions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 hover:bg-green-50/30">
              <td className="px-4 py-3 text-gray-600">Current Period</td>
              <td className="px-4 py-3 text-right font-medium text-green-700">{formatTablePrice(totalRevenue)}</td>
              <td className="px-4 py-3 text-right font-medium text-orange-700">{formatTablePrice(pendingRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECTION SUMMARY */}
      {Array.isArray(sectionSummary) && sectionSummary.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-purple-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-purple-900">🏷️ Section Summary</th>
                <th className="text-right px-4 py-3 font-semibold text-purple-900">Sessions</th>
                <th className="text-right px-4 py-3 font-semibold text-purple-900">Games Played</th>
                <th className="text-right px-4 py-3 font-semibold text-purple-900">Collected</th>
                <th className="text-right px-4 py-3 font-semibold text-purple-900">Pending</th>
              </tr>
            </thead>
            <tbody>
              {sectionSummary.map((s) => (
                <tr key={s.sectionId} className="border-b border-gray-100 hover:bg-purple-50/30">
                  <td className="px-4 py-3 text-gray-700">{s.sectionName}</td>
                  <td className="px-4 py-3 text-right font-medium">{s.sessions}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">{s.gamesPlayed}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">{formatTablePrice(s.revenueCollected)}</td>
                  <td className="px-4 py-3 text-right font-medium text-orange-700">{formatTablePrice(s.revenuePending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAID GAMES LIST */}
      {Array.isArray(paidGames) && paidGames.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Player</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-900">Games</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-900">Paid</th>
              </tr>
            </thead>
            <tbody>
              {paidGames.map((g) => (
                <tr key={g.sessionId} className="border-b border-gray-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-gray-800">
                    <div className="font-medium">{g.customerName}</div>
                    <div className="text-xs text-gray-500">
                      {g.sectionName}{g.serviceName ? ` • ${g.serviceName}` : ''}
                      {g.orderNumber ? ` • ${g.orderNumber}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">{g.gameCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{formatTablePrice(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
