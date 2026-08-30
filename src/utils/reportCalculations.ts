import { Store, DailyClosingReport, ThawingItem, ClosingPlanRecord, CogsMaster } from '../types';
import { matchStoreEntity } from './storeHelper';
export { matchStoreEntity };

export type MeatCategoryKey = 'SHANKLE' | 'RENDANG' | 'PREMIUM' | 'RAWON';

export interface StoreDailyData {
  taly: number;
  netto: number;
  susut1: number;
  susutJual: number;
}

export interface StoreCategoryAggregate {
  store: Store;
  taly: number;
  netto: number;
  susut1: number;
  susutJual: number;
  totalSusut: number;
  pct: number;
  dailyMap: Map<number, StoreDailyData>;
}

export interface CategoryAggregateResult {
  storeAggregates: StoreCategoryAggregate[];
  grandTaly: number;
  grandNetto: number;
  grandSusut1: number;
  grandSusutJual: number;
  grandTotalSusut: number;
  grandPct: number;
}

/**
 * Single source of truth for classifying a thawing item into exactly 1 of the 8 columns
 * 1: HQ 41/42/44/45 (Daging Fresh Rendang Default)
 * 2: DG RNDG BEKU 1kg
 * 3: DAGING HUSUS (Khusus)
 * 4: DG Prem 2 (D premium lokal / Sirloin / Ribeye)
 * 5: FRIBOY
 * 6: RAWON BEKU
 * 7: RAWON FRESH A (Rawon curah / Fresh)
 * 8: FQ 60 / SHANK (Shankle / D fresh ekonomis)
 */
export function getThawingItemColumn(item: { name?: string; pabrikasiCategory?: string; plannedFabrication?: string; openingPurpose?: string }): number {
  const name = (item.name || '').toUpperCase();
  const cat = (item.pabrikasiCategory || '').toUpperCase();
  const plan = (item.plannedFabrication || (item as any).openingPurpose || '').toUpperCase();
  const combined = `${name} ${cat} ${plan}`;

  // Col 8: FQ 60 / SHANK
  if (combined.includes('SHANK') || combined.includes('FQ 60') || combined.includes('EKONOMIS') || combined.includes('SH-01')) {
    return 8;
  }

  // Col 6 & 7: RAWON
  if (combined.includes('RAWON') || combined.includes('105') || combined.includes('106') || combined.includes('18')) {
    if (combined.includes('BEKU')) {
      return 6; // RAWON BEKU
    }
    return 7; // RAWON FRESH A
  }

  // Col 4 & 5: DAGING PREMIUM
  if (combined.includes('FRIBOY') || combined.includes('DP-02')) {
    return 5; // FRIBOY
  }
  if (combined.includes('PREM') || combined.includes('LOKAL') || combined.includes('SIRLOIN') || combined.includes('RIBEYE') || combined.includes('DP-01')) {
    return 4; // DG Prem 2
  }

  // Col 2: DG RNDG BEKU 1kg
  if (combined.includes('BEKU') && (combined.includes('RNDG') || combined.includes('RENDANG') || combined.includes('1KG') || combined.includes('DF-02'))) {
    return 2;
  }

  // Col 3: DAGING HUSUS
  if (combined.includes('KHUSUS') || combined.includes('HUSUS') || combined.includes('DF-04')) {
    return 3;
  }

  // Col 1: HQ 41/42/44/45 (DAGING FRESH DEFAULT)
  return 1;
}

/**
 * Single Source of Truth for matching meat categories across all reports & exports
 */
export function isMatchingCategory(
  key: MeatCategoryKey | string,
  name: string = '',
  cat: string = '',
  purpose: string = ''
): boolean {
  const uKey = (key || '').toUpperCase();
  const col = getThawingItemColumn({ name, pabrikasiCategory: cat, plannedFabrication: purpose });

  if (uKey.includes('SHANK')) {
    return col === 8;
  }
  if (uKey.includes('RENDANG') || uKey.includes('FRESH')) {
    return col === 1 || col === 2 || col === 3;
  }
  if (uKey.includes('PREM') || uKey === 'PREMIUM') {
    return col === 4 || col === 5;
  }
  if (uKey.includes('RAWON') || uKey === 'RAWON') {
    return col === 6 || col === 7;
  }

  return false;
}

/**
 * Standard COGS Lookup for Categories with reliable fallbacks
 */
export function getCogsForCategory(cogsList?: CogsMaster[], categoryKey?: string): number {
  const safeList = Array.isArray(cogsList) ? cogsList : [];
  const uKey = (categoryKey || '').toUpperCase();
  const found = safeList.find((c) => {
    if (!c) return false;
    const cCat = (c.category || '').toUpperCase();
    const cName = (c.itemName || (c as any).planName || '').toUpperCase();
    if (uKey.includes('SHANK')) return cCat.includes('SHANK') || cName.includes('SHANK');
    if (uKey.includes('RENDANG')) return (cCat.includes('FRESH') || cCat.includes('RENDANG')) && !cName.includes('BEKU');
    if (uKey.includes('PREM')) return cCat.includes('PREMIUM') || cName.includes('PREM') || cName.includes('FRIBOY');
    if (uKey.includes('RAWON')) return cCat.includes('RAWON') || cName.includes('RAWON');
    return cCat.includes(uKey) || cName.includes(uKey);
  });

  if (found && typeof found.cogsPerKg === 'number' && found.cogsPerKg > 0) return found.cogsPerKg;

  if (uKey.includes('SHANK')) return 85200;
  if (uKey.includes('RENDANG')) return 102000;
  if (uKey.includes('PREM')) return 118000;
  if (uKey.includes('RAWON')) return 86500;
  return 102000;
}

/**
 * Calculate multi-store aggregated data for a specific meat category.
 * Integrates both closed daily reports and active live records.
 */
export function calculateCategoryAggregates(
  catKey: MeatCategoryKey,
  stores: Store[] = [],
  reports: DailyClosingReport[] = [],
  liveItems: ThawingItem[] = [],
  liveClosingRecords: ClosingPlanRecord[] = [],
  startDate?: string,
  endDate?: string
): CategoryAggregateResult {
  let grandTaly = 0;
  let grandNetto = 0;
  let grandSusut1 = 0;
  let grandSusutJual = 0;

  const safeStores = Array.isArray(stores) ? stores : [];
  const safeReports = Array.isArray(reports) ? reports : [];
  const safeLiveItems = Array.isArray(liveItems) ? liveItems : [];
  const safeClosing = Array.isArray(liveClosingRecords) ? liveClosingRecords : [];

  const storeAggregates: StoreCategoryAggregate[] = [];

  // Filter historical reports by date range
  const filteredReports = safeReports.filter((r) => {
    if (!r) return false;
    if (!r.date) return true;
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    return true;
  });

  safeStores.forEach((store) => {
    if (!store) return;
    const storeReports = filteredReports.filter(
      (r) => r && (matchStoreEntity(r.storeId, store) || (r.storeName && matchStoreEntity(r.storeName, store)))
    );

    let storeTaly = 0;
    let storeNetto = 0;
    let storeSusutJual = 0;
    const dailyMap = new Map<number, StoreDailyData>();

    // 1. Accumulate from daily closing reports
    storeReports.forEach((rep) => {
      if (!rep) return;
      let dayNum = 1;
      if (rep.date) {
        try {
          const parts = rep.date.split('-');
          if (parts.length >= 3) {
            const parsed = parseInt(parts[2], 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) {
              dayNum = parsed;
            }
          }
        } catch {
          dayNum = 1;
        }
      }

      let dayTaly = 0;
      let dayNetto = 0;
      let daySusutJual = 0;

      if (Array.isArray(rep.itemsProcessed)) {
        rep.itemsProcessed.forEach((item) => {
          if (!item) return;
          if (isMatchingCategory(catKey, item.name, item.pabrikasiCategory, item.openingPurpose || (item as any).plannedFabrication)) {
            const wBefore = item.weightBefore || 0;
            const wAfter = item.weightAfter || item.finalWeight || 0;
            dayTaly += wBefore;
            dayNetto += wAfter;
            daySusutJual += item.susutJualKg || 0;
          }
        });
      }

      const closingList = rep.closingPlanRecords || (rep as any).closingRecords || [];
      if (Array.isArray(closingList)) {
        closingList.forEach((cr: any) => {
          if (cr && isMatchingCategory(catKey, cr.planName, '', '')) {
            daySusutJual += cr.susutJualKg || 0;
          }
        });
      }

      if (dayTaly > 0 || dayNetto > 0 || daySusutJual > 0) {
        const existing = dailyMap.get(dayNum) || { taly: 0, netto: 0, susut1: 0, susutJual: 0 };
        const sumT = existing.taly + dayTaly;
        const sumN = existing.netto + dayNetto;
        const sumSJ = existing.susutJual + daySusutJual;
        dailyMap.set(dayNum, {
          taly: sumT,
          netto: sumN,
          susut1: Math.max(0, sumT - sumN),
          susutJual: sumSJ,
        });

        storeTaly += dayTaly;
        storeNetto += dayNetto;
        storeSusutJual += daySusutJual;
      }
    });

    // 2. Include active live operations if today is within filter and not already saved in historyReports
    const todayStr = new Date().toISOString().split('T')[0];
    const hasTodayInHistory = storeReports.some((r) => r.date === todayStr);
    const isTodayInRange = (!startDate || todayStr >= startDate) && (!endDate || todayStr <= endDate);
    if (!hasTodayInHistory && isTodayInRange && (safeLiveItems.length > 0 || safeClosing.length > 0)) {
      const activeItems = safeLiveItems.filter(
        (i) => i && matchStoreEntity(i.storeId, store) && !i.isCarryover && isMatchingCategory(catKey, i.name, i.pabrikasiCategory, i.plannedFabrication)
      );
      const activeClosing = safeClosing.filter(
        (cr) => cr && matchStoreEntity(cr.storeId, store) && isMatchingCategory(catKey, cr.planName, '', '')
      );

      if (activeItems.length > 0 || activeClosing.length > 0) {
        const liveTaly = activeItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0);
        const liveNetto = activeItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing || 0), 0);
        const liveSJ = activeClosing.reduce((sum, cr) => sum + (cr.susutJualKg || 0), 0);
        let liveDay = 1;
        try {
          const parsed = parseInt(todayStr.split('-')[2], 10);
          if (!isNaN(parsed)) liveDay = parsed;
        } catch {
          liveDay = 1;
        }

        const existing = dailyMap.get(liveDay) || { taly: 0, netto: 0, susut1: 0, susutJual: 0 };
        const sumT = existing.taly + liveTaly;
        const sumN = existing.netto + liveNetto;
        const sumSJ = existing.susutJual + liveSJ;
        dailyMap.set(liveDay, {
          taly: sumT,
          netto: sumN,
          susut1: Math.max(0, sumT - sumN),
          susutJual: sumSJ,
        });

        storeTaly += liveTaly;
        storeNetto += liveNetto;
        storeSusutJual += liveSJ;
      }
    }

    const storeSusut1 = Math.max(0, storeTaly - storeNetto);
    const storeTotalSusut = storeSusut1 + storeSusutJual;
    const storePct = storeTaly > 0 ? (storeTotalSusut / storeTaly) * 100 : 0;

    grandTaly += storeTaly;
    grandNetto += storeNetto;
    grandSusut1 += storeSusut1;
    grandSusutJual += storeSusutJual;

    storeAggregates.push({
      store,
      taly: storeTaly,
      netto: storeNetto,
      susut1: storeSusut1,
      susutJual: storeSusutJual,
      totalSusut: storeTotalSusut,
      pct: storePct,
      dailyMap,
    });
  });

  const grandTotalSusut = grandSusut1 + grandSusutJual;
  const grandPct = grandTaly > 0 ? (grandTotalSusut / grandTaly) * 100 : 0;

  return {
    storeAggregates,
    grandTaly,
    grandNetto,
    grandSusut1,
    grandSusutJual,
    grandTotalSusut,
    grandPct,
  };
}
