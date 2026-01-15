#!/usr/bin/env tsx
/**
 * Roll up section-level stats into parent department metadata.stats
 * Usage: npx tsx scripts/rollup-parent-stats.ts
 */
import dotenv from 'dotenv'
dotenv.config()
import { prisma } from '@/lib/auth/prisma';
import { departmentService } from '../src/services/department.service'

async function main() {
  try {
    console.log('Starting parent-level rollup of section stats...')

    // Find all parent departments (codes without ':')
    const parents = await prisma.department.findMany({ where: { isActive: true, NOT: { code: { contains: ':' } } } })

    for (const parent of parents) {
      // Find section departments with codes starting with parent.code + ':'
      const prefix = `${parent.code}:`
      const sections = await prisma.department.findMany({ where: { code: { startsWith: prefix }, isActive: true } })
      if (!sections || sections.length === 0) {
        // nothing to roll up
        continue
      }

      // Ensure each section has up-to-date sectionStats; call recalc if missing
      const sectionStatsList: any[] = []
      for (const s of sections) {
        const meta = (s.metadata || {}) as any
        let stats = meta?.sectionStats || meta?.stats
        if (!stats) {
          // compute and write stats for this section
          stats = await departmentService.recalculateSectionStats(s.code)
        }
        if (stats) sectionStatsList.push({ code: s.code, id: s.id, stats })
      }

      // Sum fields across sections
      const rollup = {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        fulfilledOrders: 0,
        totalUnits: 0,
        fulfilledUnits: 0,
        totalAmount: 0,
      }

      for (const s of sectionStatsList) {
        const st = s.stats as any
        rollup.totalOrders += Number(st.totalOrders || st.total || 0)
        rollup.pendingOrders += Number(st.pendingOrders || st.pending || 0)
        rollup.processingOrders += Number(st.processingOrders || st.processing || 0)
        rollup.fulfilledOrders += Number(st.fulfilledOrders || st.fulfilled || 0)
        rollup.totalUnits += Number(st.totalUnits || 0)
        rollup.fulfilledUnits += Number(st.fulfilledUnits || 0)
        rollup.totalAmount += Number(st.totalAmount || st.amount || 0)
      }

      const fulfillmentRate = rollup.totalUnits > 0 ? Math.round((rollup.fulfilledUnits / rollup.totalUnits) * 100) : 0

      const parentStats = {
        total: rollup.totalOrders,
        pending: rollup.pendingOrders,
        processing: rollup.processingOrders,
        fulfilled: rollup.fulfilledOrders,
        totalUnits: rollup.totalUnits,
        fulfilledUnits: rollup.fulfilledUnits,
        totalAmount: rollup.totalAmount,
        fulfillmentRate,
        updatedAt: new Date(),
      }

      // Compose sectionRollups for transparency
      const sectionRollups = sectionStatsList.map((s) => ({ code: s.code, id: s.id, stats: s.stats }))

      // Merge into parent metadata: write both legacy `stats` and `sectionRollups`
      const existingMeta = (parent.metadata as any) || {}
      const merged = { ...existingMeta, stats: parentStats, sectionRollups }
      await prisma.department.update({ where: { id: parent.id }, data: { metadata: merged } })

      console.log(`Rolled up ${sections.length} sections -> parent ${parent.code}`)
    }

    console.log('Parent-level rollup completed')
  } catch (err) {
    console.error('rollup error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) main()

export { main }
