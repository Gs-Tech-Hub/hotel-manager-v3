import {prisma} from '@/lib/auth/prisma';
import { ExchangeRate as ExchangeRateType } from '@/lib/currency';

export interface PersistedRate {
  from: string;
  to: string;
  rate: number;
  source?: string | null;
  updatedAt: Date;
}

export async function loadAllPersistedRates(): Promise<PersistedRate[]> {
  const clientAny = prisma as any;
  const rows: any[] = await clientAny.exchangeRate.findMany();
  return rows.map((r: any) => ({
    from: r.fromCurrency,
    to: r.toCurrency,
    rate: Number(r.rate),
    source: r.source ?? undefined,
    updatedAt: r.updatedAt,
  }));
}

export async function getRatesForBase(base: string): Promise<Record<string, number>> {
  const clientAny = prisma as any;
  const rows: any[] = await clientAny.exchangeRate.findMany({ where: { fromCurrency: base } });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.toCurrency] = Number(r.rate);
  return out;
}

export async function setRatePersistent(
  from: string,
  to: string,
  rate: number,
  source?: string | null,
  updatedBy?: string | null
): Promise<void> {
  const data = {
    fromCurrency: from,
    toCurrency: to,
    rate: rate.toString(),
    source: source ?? null,
    updatedBy: updatedBy ?? null,
  };

  // Upsert by from+to composite unique
  const clientAny = prisma as any;
  await clientAny.exchangeRate.upsert({
    where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
    update: { rate: data.rate, source: data.source, updatedBy: data.updatedBy },
    create: data,
  });
}
