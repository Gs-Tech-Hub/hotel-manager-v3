"use client"

import { formatTablePrice } from '@/lib/formatters'

type GameStatsType = {
  totalGames: number
  completedGames: number
  pendingGames: number
  totalRevenue: number
  pendingRevenue: number
  completionRate: number
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

  const { totalGames, completedGames, pendingGames, totalRevenue, pendingRevenue, completionRate } = stats

  return (
    <div className="space-y-4">
      {/* GAME SESSION STATS TABLE */}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-blue-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-blue-900">🎮 Game Sessions</th>
              <th className="text-right px-4 py-3 font-semibold text-blue-900">Total</th>
              <th className="text-right px-4 py-3 font-semibold text-blue-900">Completed</th>
              <th className="text-right px-4 py-3 font-semibold text-blue-900">Pending</th>
              <th className="text-right px-4 py-3 font-semibold text-blue-900">Completion %</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 hover:bg-blue-50/30">
              <td className="px-4 py-3 text-gray-600">Current Period</td>
              <td className="px-4 py-3 text-right font-medium">{totalGames}</td>
              <td className="px-4 py-3 text-right font-medium text-green-600">{completedGames}</td>
              <td className="px-4 py-3 text-right font-medium text-orange-600">{pendingGames}</td>
              <td className="px-4 py-3 text-right font-medium text-blue-600">{completionRate}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* REVENUE STATS TABLE */}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-green-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-green-900">💰 Revenue</th>
              <th className="text-right px-4 py-3 font-semibold text-green-900">Total Revenue</th>
              <th className="text-right px-4 py-3 font-semibold text-green-900">Collected</th>
              <th className="text-right px-4 py-3 font-semibold text-green-900">Pending</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 hover:bg-green-50/30">
              <td className="px-4 py-3 text-gray-600">Current Period</td>
              <td className="px-4 py-3 text-right font-medium">{formatTablePrice(totalRevenue + pendingRevenue)}</td>
              <td className="px-4 py-3 text-right font-medium text-green-600">{formatTablePrice(totalRevenue)}</td>
              <td className="px-4 py-3 text-right font-medium text-orange-600">{formatTablePrice(pendingRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-4 gap-4 pt-4">
        <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
          <div className="text-xs font-medium text-blue-600">Total Games</div>
          <div className="text-2xl font-bold text-blue-900">{totalGames}</div>
        </div>
        <div className="rounded-lg bg-green-50 p-4 border border-green-200">
          <div className="text-xs font-medium text-green-600">Completed</div>
          <div className="text-2xl font-bold text-green-900">{completedGames}</div>
        </div>
        <div className="rounded-lg bg-orange-50 p-4 border border-orange-200">
          <div className="text-xs font-medium text-orange-600">Pending</div>
          <div className="text-2xl font-bold text-orange-900">{pendingGames}</div>
        </div>
        <div className="rounded-lg bg-purple-50 p-4 border border-purple-200">
          <div className="text-xs font-medium text-purple-600">Avg Revenue/Game</div>
          <div className="text-2xl font-bold text-purple-900">
            {totalGames > 0 ? formatTablePrice(Math.round((totalRevenue + pendingRevenue) / totalGames)) : '$0'}
          </div>
        </div>
      </div>
    </div>
  )
}
