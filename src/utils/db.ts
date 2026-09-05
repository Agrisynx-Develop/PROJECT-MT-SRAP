import {
  Store,
  UserAccount,
  CogsMaster,
  StockAdjustment,
  ClosingPlanRecord,
  ThawingItem,
  FabricationSegment,
  DailyClosingReport,
  LossAlertConfig,
} from '../types';
import {
  fetchAllDataFromSheets,
  upsertRecordToSheets,
  deleteRecordFromSheets,
  updateTableInSheets,
  getGoogleAppsScriptUrl,
  AllSheetsData
} from './sheetsApi';

// Default alert configuration
const DEFAULT_CONFIG: LossAlertConfig = {
  maxProcessLossPercent: 1.0,
  maxSalesLossPercent: 1.0,
  maxDailyLossPercent: 2.0,
  safeThawingLossPercent: 1.0,
  safeFabricationLossPercent: 1.0,
  salesPredictionKg: 40.0,
};

// Background API sync helper for Node.js server (if running in full-stack mode)
const postApiBackground = async (endpoint: string, body: any) => {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Ignore offline or static deploy errors
  }
};

/**
 * Smart User / Store Resolver:
 * Resolves username input (e.g. 'md_pusat', 'butcher_ckt', 'admin_ckt', 'cikut')
 * directly to the UserAccount based on current stores and database users.
 */
export function resolveUserFromInput(usernameInput: any): UserAccount {
  const str = String(usernameInput || '');
  const raw = str.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const cleanInput = str.trim().toLowerCase();

  // 1. MD Pusat
  if (
    cleanInput.includes('md') ||
    cleanInput.includes('merchandis') ||
    cleanInput.includes('pusat') ||
    raw === 'mdpusat' ||
    raw === 'md'
  ) {
    return {
      id: 'user_md_1',
      username: 'md_pusat',
      role: 'md',
      fullName: 'Chief Merchandiser (MD Pusat)',
      createdAt: new Date().toISOString(),
    };
  }

  // 2. Check existing user list by username
  const currentUsers = getUsers();
  const exactMatch = currentUsers.find(
    (u) => u.username.toLowerCase() === cleanInput || u.username.toLowerCase().replace(/[\s_-]+/g, '') === raw
  );
  if (exactMatch) {
    return exactMatch;
  }

  // 3. Determine role
  const isButcher = cleanInput.includes('butcher') || cleanInput.includes('jagal') || cleanInput.includes('potong');
  const role: 'butcher' | 'admin' = isButcher ? 'butcher' : 'admin';

  // 4. Match branch store
  const allStores = getStores();
  let matchedStore: Store | undefined;

  for (const store of allStores) {
    const code = store.code.toLowerCase();
    const city = store.city.toLowerCase().replace(/[\s_-]+/g, '');
    const nameClean = store.name.toLowerCase().replace(/[\s_-]+/g, '');

    if (cleanInput.includes(code) || raw.includes(code) || raw.includes(city) || raw.includes(nameClean)) {
      matchedStore = store;
      break;
    }
  }

  if (!matchedStore && allStores.length > 0) {
    matchedStore = allStores[0];
  }

  const codeLower = matchedStore?.code.toLowerCase() || 'ckt';
  const storeName = matchedStore?.name || 'TDN Cikut';
  const storeId = matchedStore?.id || 'store_ckt';

  return {
    id: `user_${role}_${codeLower}`,
    username: `${role}_${codeLower}`,
    role,
    storeId,
    storeName,
    fullName: `${role === 'butcher' ? 'Butcher' : 'Admin'} ${storeName}`,
    createdAt: new Date().toISOString(),
  };
}

// --- DATABASE SYNCHRONIZATION HELPERS ---

export const getStores = (): Store[] => {
  const data = localStorage.getItem('stores_list');
  return data ? JSON.parse(data) : [];
};

export const saveStores = (stores: Store[]) => {
  localStorage.setItem('stores_list', JSON.stringify(stores));
  postApiBackground('/api/stores', stores);
  if (getGoogleAppsScriptUrl()) {
    updateTableInSheets('Toko_Cabang', stores);
  }
};

export const getUsers = (): UserAccount[] => {
  const data = localStorage.getItem('users_list');
  return data ? JSON.parse(data) : [];
};

export const saveUsers = (users: UserAccount[]) => {
  localStorage.setItem('users_list', JSON.stringify(users));
  postApiBackground('/api/users', users);
  if (getGoogleAppsScriptUrl()) {
    updateTableInSheets('Pengguna', users);
  }
};

export const getCurrentUser = (): UserAccount => {
  const data = localStorage.getItem('current_logged_user');
  if (!data) {
    const defaultUser: UserAccount = {
      id: 'user_butcher_ckt',
      username: 'butcher_ckt',
      role: 'butcher',
      storeId: 'store_ckt',
      storeName: 'TDN Cikut',
      fullName: 'Butcher TDN Cikut',
      createdAt: '2026-01-01',
    };
    localStorage.setItem('current_logged_user', JSON.stringify(defaultUser));
    return defaultUser;
  }
  return JSON.parse(data);
};

export const setCurrentUser = (user: UserAccount) => {
  localStorage.setItem('current_logged_user', JSON.stringify(user));
};

export const DEFAULT_COGS_MASTER: CogsMaster[] = [
  { id: 'cogs_1', itemCode: 'DF-01', itemName: 'HQ 41/42/44/45 (Daging Fresh)', category: 'DAGING FRESH', cogsPerKg: 102000, defaultPricePerKg: 125000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_2', itemCode: 'DF-02', itemName: 'DG RNDG BEKU 1kg', category: 'DAGING FRESH', cogsPerKg: 96000, defaultPricePerKg: 118000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_3', itemCode: 'SH-01', itemName: 'FQ 60 / SHANK (Daging Ekonomis)', category: 'SHANKLE', cogsPerKg: 85200, defaultPricePerKg: 105000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_4', itemCode: 'DP-01', itemName: 'D Premium Lokal (Sirloin/Ribeye)', category: 'DAGING PREMIUM', cogsPerKg: 127000, defaultPricePerKg: 155000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_5', itemCode: 'DP-02', itemName: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM', cogsPerKg: 103000, defaultPricePerKg: 135000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_6', itemCode: 'RW-01', itemName: 'Rawon Curah (FQ 106/105)', category: 'RAWON', cogsPerKg: 86500, defaultPricePerKg: 110000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_7', itemCode: 'DF-03', itemName: 'RENDANG BEKU CURAH', category: 'DAGING FRESH', cogsPerKg: 102550, defaultPricePerKg: 125000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_8', itemCode: 'DF-04', itemName: 'DAGING KHUSUS TDN', category: 'DAGING FRESH', cogsPerKg: 96000, defaultPricePerKg: 115000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
];

export const normalizeCogsList = (list: any[]): CogsMaster[] => {
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_COGS_MASTER;
  return list.map((c, idx) => {
    const fallbackDef = DEFAULT_COGS_MASTER[idx] || DEFAULT_COGS_MASTER.find((d) => d.id === c.id || d.category === c.category);
    const catUpper = (c.category || fallbackDef?.category || 'DAGING FRESH').toUpperCase();
    const catCode = catUpper.includes('PREM') ? 'DP' : catUpper.includes('SHANK') ? 'SH' : catUpper.includes('RAWON') ? 'RW' : 'DF';
    const itemCode = c.itemCode || fallbackDef?.itemCode || `${catCode}-${String(idx + 1).padStart(2, '0')}`;
    const itemName = c.itemName || c.planName || fallbackDef?.itemName || `Bahan ${catUpper} #${idx + 1}`;
    const defaultPricePerKg = Number(c.defaultPricePerKg || c.sellingPricePerKg) || fallbackDef?.defaultPricePerKg || Math.round(Number(c.cogsPerKg || 100000) * 1.25);
    const updatedBy = c.updatedBy || fallbackDef?.updatedBy || 'MD Pusat';
    const updatedAt = c.updatedAt || '2026-08-01';
    return {
      id: c.id || `cogs_${idx + 1}`,
      itemCode,
      itemName,
      category: catUpper,
      cogsPerKg: Number(c.cogsPerKg) || fallbackDef?.cogsPerKg || 102000,
      defaultPricePerKg,
      updatedAt,
      updatedBy,
    };
  });
};

export const getCogsMaster = (): CogsMaster[] => {
  const data = localStorage.getItem('cogs_master');
  if (!data) return DEFAULT_COGS_MASTER;
  try {
    const parsed = JSON.parse(data);
    return normalizeCogsList(parsed);
  } catch {
    return DEFAULT_COGS_MASTER;
  }
};

export const saveCogsMaster = (cogs: CogsMaster[]) => {
  const normalized = normalizeCogsList(cogs);
  localStorage.setItem('cogs_master', JSON.stringify(normalized));
  postApiBackground('/api/cogs', normalized);
  if (getGoogleAppsScriptUrl()) {
    updateTableInSheets('Master_COGS', normalized);
  }
};

/**
 * Defensive localStorage setter with quota management and fallback
 */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err: any) {
    console.warn(`[LocalStorage] Quota warning on ${key}:`, err);
    try {
      // If quota exceeded, try to clean up non-critical cache or compress stored images
      if (key === 'closing_plan_records') {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          // Keep transaction data, but sanitize redundant large image base64 if needed
          const trimmed = parsed.map((item, idx) => {
            if (idx > 10 && item.photoUrl && item.photoUrl.length > 50000) {
              return { ...item, photoUrl: '' };
            }
            return item;
          });
          localStorage.setItem(key, JSON.stringify(trimmed));
          return;
        }
      }
      if (key === 'thawing_items') {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const trimmed = parsed.map((item, idx) => {
            if (idx > 15 && item.image && item.image.length > 50000) {
              return { ...item, image: 'placeholder' };
            }
            return item;
          });
          localStorage.setItem(key, JSON.stringify(trimmed));
          return;
        }
      }
    } catch (innerErr) {
      console.error(`[LocalStorage] Failed to write ${key}:`, innerErr);
    }
  }
}

export const getStockAdjustments = (): StockAdjustment[] => {
  const data = localStorage.getItem('stock_adjustments');
  return data ? JSON.parse(data) : [];
};

export const saveStockAdjustments = (adjs: StockAdjustment[], updatedSingleAdj?: StockAdjustment) => {
  safeSetItem('stock_adjustments', JSON.stringify(adjs));
  postApiBackground('/api/adjustments', adjs);
  if (getGoogleAppsScriptUrl()) {
    if (updatedSingleAdj) {
      upsertRecordToSheets('Koreksi_Stok', updatedSingleAdj);
    } else {
      updateTableInSheets('Koreksi_Stok', adjs);
    }
  }
};

export const getClosingPlanRecords = (): ClosingPlanRecord[] => {
  const data = localStorage.getItem('closing_plan_records');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    // Filter out unwanted test dates such as 2026-08-29
    return parsed.filter((r) => {
      const d = (r.date || r.timestamp || '').split('T')[0];
      return d !== '2026-08-29';
    });
  } catch {
    return [];
  }
};

export const saveClosingPlanRecords = (records: ClosingPlanRecord[], updatedSingleRecord?: ClosingPlanRecord) => {
  // Always sanitize before saving
  const sanitized = records.filter((r) => {
    const d = (r.date || r.timestamp || '').split('T')[0];
    return d !== '2026-08-29';
  });
  safeSetItem('closing_plan_records', JSON.stringify(sanitized));
  postApiBackground('/api/closing-records', sanitized);
  if (getGoogleAppsScriptUrl()) {
    if (updatedSingleRecord && (updatedSingleRecord.date || updatedSingleRecord.timestamp || '').split('T')[0] !== '2026-08-29') {
      upsertRecordToSheets('Closing_Fisik', updatedSingleRecord);
    } else {
      updateTableInSheets('Closing_Fisik', sanitized);
    }
  }
};

export const deleteClosingPlanRecord = (id: string): ClosingPlanRecord[] => {
  const current = getClosingPlanRecords();
  const updated = current.filter((r) => r.id !== id);
  safeSetItem('closing_plan_records', JSON.stringify(updated));
  fetch(`/api/closing-records/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  if (getGoogleAppsScriptUrl()) {
    deleteRecordFromSheets('Closing_Fisik', id);
  }
  return updated;
};

/**
 * Purge all records across all tables for a specific date (default: 2026-08-29)
 */
export const purgeDateRecords = (dateToPurge: string = '2026-08-29') => {
  try {
    // 1. Closing Plan Records
    const closingKey = 'closing_plan_records';
    const rawClosing = localStorage.getItem(closingKey);
    if (rawClosing) {
      try {
        const parsed = JSON.parse(rawClosing);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((r) => {
            const d = (r.date || r.timestamp || '').split('T')[0];
            return d !== dateToPurge;
          });
          localStorage.setItem(closingKey, JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }
    }

    // 2. Thawing Items
    const thawingKey = 'thawing_items';
    const rawThawing = localStorage.getItem(thawingKey);
    if (rawThawing) {
      try {
        const parsed = JSON.parse(rawThawing);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((i) => {
            const d = (i.createdAt || i.thawingStartTime || '').split('T')[0];
            return d !== dateToPurge;
          });
          localStorage.setItem(thawingKey, JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }
    }

    // 3. Fabrication Segments
    const segKey = 'fabrication_segments';
    const rawSeg = localStorage.getItem(segKey);
    if (rawSeg) {
      try {
        const parsed = JSON.parse(rawSeg);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((s) => {
            const d = (s.createdAt || s.transferTimestamp || '').split('T')[0];
            return d !== dateToPurge;
          });
          localStorage.setItem(segKey, JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }
    }

    // 4. Stock Adjustments
    const adjKey = 'stock_adjustments';
    const rawAdj = localStorage.getItem(adjKey);
    if (rawAdj) {
      try {
        const parsed = JSON.parse(rawAdj);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((a) => {
            const d = (a.date || a.createdAt || '').split('T')[0];
            return d !== dateToPurge;
          });
          localStorage.setItem(adjKey, JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }
    }

    // 5. Daily Closing Reports
    const repKey = 'daily_reports';
    const rawRep = localStorage.getItem(repKey);
    if (rawRep) {
      try {
        const parsed = JSON.parse(rawRep);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((r) => {
            const d = (r.date || '').split('T')[0];
            return d !== dateToPurge;
          });
          localStorage.setItem(repKey, JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }
    }

    // Notify backend
    fetch(`/api/purge-date?date=${encodeURIComponent(dateToPurge)}`, { method: 'DELETE' }).catch(() => {});
  } catch (err) {
    console.warn(`[Purge] Error clearing records for ${dateToPurge}:`, err);
  }
};

// Immediately execute purge of 2026-08-29 on module evaluation
try {
  purgeDateRecords('2026-08-29');
} catch {
  // ignore
}


export const getThawingItems = (): ThawingItem[] => {
  const data = localStorage.getItem('thawing_items');
  return data ? JSON.parse(data) : [];
};

export const saveThawingItems = (items: ThawingItem[], updatedSingleItem?: ThawingItem) => {
  safeSetItem('thawing_items', JSON.stringify(items));
  postApiBackground('/api/thawing-items', items);
  if (getGoogleAppsScriptUrl()) {
    if (updatedSingleItem) {
      upsertRecordToSheets('Thawing_Daging', updatedSingleItem);
    } else {
      updateTableInSheets('Thawing_Daging', items);
    }
  }
};

export const deleteThawingItemFromCloud = (id: string) => {
  if (getGoogleAppsScriptUrl()) {
    deleteRecordFromSheets('Thawing_Daging', id);
  }
};

export const getFabricationSegments = (): FabricationSegment[] => {
  const data = localStorage.getItem('fabrication_segments');
  return data ? JSON.parse(data) : [];
};

export const saveFabricationSegments = (segments: FabricationSegment[], updatedSingleSegment?: FabricationSegment) => {
  safeSetItem('fabrication_segments', JSON.stringify(segments));
  postApiBackground('/api/fabrication-segments', segments);
  if (getGoogleAppsScriptUrl()) {
    if (updatedSingleSegment) {
      upsertRecordToSheets('Pabrikasi_Segmen', updatedSingleSegment);
    } else {
      updateTableInSheets('Pabrikasi_Segmen', segments);
    }
  }
};

export const getDailyReports = (): DailyClosingReport[] => {
  const data = localStorage.getItem('daily_reports');
  return data ? JSON.parse(data) : [];
};

export const saveDailyReports = (reports: DailyClosingReport[], updatedSingleReport?: DailyClosingReport) => {
  safeSetItem('daily_reports', JSON.stringify(reports));
  postApiBackground('/api/reports', reports);
  if (getGoogleAppsScriptUrl()) {
    if (updatedSingleReport) {
      upsertRecordToSheets('Laporan_Closing', updatedSingleReport);
    } else {
      updateTableInSheets('Laporan_Closing', reports);
    }
  }
};

export const getLossConfig = (): LossAlertConfig => {
  const data = localStorage.getItem('loss_config');
  return data ? JSON.parse(data) : DEFAULT_CONFIG;
};

export const saveLossConfig = (config: LossAlertConfig) => {
  safeSetItem('loss_config', JSON.stringify(config));
  postApiBackground('/api/loss-config', config);
};

export const resetDatabase = async () => {
  localStorage.removeItem('thawing_items');
  localStorage.removeItem('fabrication_segments');
  localStorage.removeItem('stock_adjustments');
  localStorage.removeItem('closing_plan_records');
  localStorage.removeItem('daily_reports');
  try {
    await fetch('/api/database/reset', { method: 'POST' });
  } catch {
    // ignore
  }
};

/**
 * Perform a full pull from Google Spreadsheet Cloud API
 * and refresh local cache (Defensive: never overwrites valid local records with empty array)
 */
export const pullAllDataFromGoogleSheets = async (): Promise<{
  success: boolean;
  data?: AllSheetsData;
  error?: string;
}> => {
  const result = await fetchAllDataFromSheets();
  if (result.success && result.data) {
    const d = result.data;
    if (d.stores && d.stores.length > 0) {
      safeSetItem('stores_list', JSON.stringify(d.stores));
    }
    if (d.users && d.users.length > 0) {
      safeSetItem('users_list', JSON.stringify(d.users));
    }
    if (d.cogsMaster && d.cogsMaster.length > 0) {
      safeSetItem('cogs_master', JSON.stringify(normalizeCogsList(d.cogsMaster)));
    }
    if (d.thawingItems && d.thawingItems.length > 0) {
      safeSetItem('thawing_items', JSON.stringify(d.thawingItems));
    }
    if (d.fabricationSegments && d.fabricationSegments.length > 0) {
      safeSetItem('fabrication_segments', JSON.stringify(d.fabricationSegments));
    }
    if (d.closingPlanRecords && d.closingPlanRecords.length > 0) {
      safeSetItem('closing_plan_records', JSON.stringify(d.closingPlanRecords));
    }
    if (d.dailyClosingReports && d.dailyClosingReports.length > 0) {
      safeSetItem('daily_reports', JSON.stringify(d.dailyClosingReports));
    }
    if (d.stockAdjustments && d.stockAdjustments.length > 0) {
      safeSetItem('stock_adjustments', JSON.stringify(d.stockAdjustments));
    }
    if (d.lossConfig) {
      safeSetItem('loss_config', JSON.stringify(d.lossConfig));
    }
  }
  return result;
};
