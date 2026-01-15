#!/usr/bin/env tsx
/*
  Migration script: populate `department.metadata.sectionStats` for existing departments.
  Usage: npx tsx scripts/migrate-section-stats.ts [--filter=prefix] [--dry-run]
*/
import dotenv from 'dotenv';
dotenv.config();
import { prisma } from '@/lib/auth/prisma';
 import { departmentService } from '../src/services/department.service';

async function main() {
  const args = process.argv.slice(2);
  const filterArg = args.find(a => a.startsWith('--filter='));
  const dryRun = args.includes('--dry-run');
  const filter = filterArg ? filterArg.split('=')[1] : undefined;

  console.log(`Starting migrate-section-stats${filter ? ` (filter=${filter})` : ''}${dryRun ? ' [dry-run]' : ''}`);

  const where: any = {};
  if (filter) where.code = { contains: filter };

  const depts = await prisma.department.findMany({ where, orderBy: { code: 'asc' } });
  console.log(`Found ${depts.length} departments to process`);

  let succeeded = 0;
  for (const d of depts) {
    try {
      const code = d.code;
      process.stdout.write(`Processing ${code} ... `);
      const stats = await departmentService.recalculateSectionStats(code);
      if (dryRun) {
        console.log(`DRY ${code}: ${JSON.stringify(stats)}`);
      } else {
        console.log(`OK`);
      }
      succeeded++;
    } catch (err: any) {
      console.error(`ERROR processing ${d.code}:`, err?.message || err);
    }
  }

  console.log(`Done. Succeeded: ${succeeded} / ${depts.length}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
