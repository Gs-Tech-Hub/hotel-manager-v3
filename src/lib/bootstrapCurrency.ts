import prisma from '@/lib/prisma';
import { loadAllPersistedRates } from './exchangeRateStore';
import { exchangeRateManager, currencyContextManager } from './currency';

let _bootstrapped = false;

export async function bootstrapCurrency(): Promise<void> {
  if (_bootstrapped) return;
  _bootstrapped = true;

  // Load organisation currency
  try {
    const org = await prisma.organisationInfo.findFirst();
    if (org && org.currency) {
      try {
        currencyContextManager.setContext({ baseCurrency: org.currency });
        console.info('Currency bootstrap: set baseCurrency to', org.currency);
      } catch (e) {
        console.warn('Currency bootstrap: failed to set currency context', e);
      }
    }
  } catch (e) {
    console.warn('Currency bootstrap: failed to read OrganisationInfo', e);
  }

  // Load persisted exchange rates
  try {
    const persisted = await loadAllPersistedRates();
    for (const r of persisted) {
      try {
        exchangeRateManager.setRate(r.from, r.to, r.rate, r.source || 'persisted');
      } catch (err) {
        console.warn('Currency bootstrap: failed to set rate', r, err);
      }
    }
    if (persisted.length > 0) console.info('Currency bootstrap: loaded', persisted.length, 'persisted exchange rates');
  } catch (e) {
    console.warn('Currency bootstrap: failed to load persisted rates', e);
  }
}
