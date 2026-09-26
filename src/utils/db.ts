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
  TrainingFileRecord,
  DailyTargetManualConfig,
  SalesTrainingRecord,
  SalesPredictionModelConfig,
  PythonModelArtifact,
  GrnRecord,
} from '../types';
import { normalizePlanName, getDeterministicClosingRecordId } from './storeHelper';

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

  const codeLower = matchedStore?.code.toLowerCase() || 'ckr';
  const storeName = matchedStore?.name || 'TDN CKR';
  const storeId = matchedStore?.id || '1';
  const partnerRole = role === 'butcher' ? 'admin' : 'butcher';

  return {
    id: `user_${role}_${codeLower}`,
    username: `${role}_${codeLower}`,
    role,
    storeId,
    storeName,
    fullName: `${role === 'butcher' ? 'Butcher' : 'Admin'} ${storeName}`,
    linkedAccountId: `user_${partnerRole}_${codeLower}`,
    createdAt: new Date().toISOString(),
  };
}

// --- DATABASE SYNCHRONIZATION HELPERS ---

export const DEFAULT_STORES: Store[] = [
  { id: '1', code: 'CKR', name: 'TDN CKR', city: 'Cikarang', createdAt: '2026-01-01' },
  { id: '2', code: 'BKS', name: 'TDN BKS', city: 'Bekasi', createdAt: '2026-01-15' },
  { id: '3', code: 'BDG', name: 'TDN BDG', city: 'Bandung', createdAt: '2026-02-01' },
];

export const DEFAULT_USERS: UserAccount[] = [
  { id: '1', username: 'butcher_ckr', role: 'butcher', storeId: '1', storeName: 'TDN CKR', fullName: 'Butcher TDN CKR', linkedAccountId: '2', createdAt: '2026-01-01' },
  { id: '2', username: 'admin_ckr', role: 'admin', storeId: '1', storeName: 'TDN CKR', fullName: 'Admin TDN CKR', linkedAccountId: '1', createdAt: '2026-01-01' },
  { id: '3', username: 'md_pusat', role: 'md', storeId: undefined, storeName: undefined, fullName: 'Chief Merchandiser (MD Pusat)', createdAt: '2026-01-01' },
  { id: '4', username: 'butcher_bks', role: 'butcher', storeId: '2', storeName: 'TDN BKS', fullName: 'Butcher TDN BKS', linkedAccountId: '5', createdAt: '2026-01-15' },
  { id: '5', username: 'admin_bks', role: 'admin', storeId: '2', storeName: 'TDN BKS', fullName: 'Admin TDN BKS', linkedAccountId: '4', createdAt: '2026-01-15' },
  { id: '6', username: 'butcher_bdg', role: 'butcher', storeId: '3', storeName: 'TDN BDG', fullName: 'Butcher TDN BDG', linkedAccountId: '7', createdAt: '2026-02-01' },
  { id: '7', username: 'admin_bdg', role: 'admin', storeId: '3', storeName: 'TDN BDG', fullName: 'Admin TDN BDG', linkedAccountId: '6', createdAt: '2026-02-01' },
];

export const getStores = (): Store[] => {
  const data = localStorage.getItem('stores_list');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // Fallback
    }
  }
  return DEFAULT_STORES;
};

export const saveStores = (stores: Store[]) => {
  localStorage.setItem('stores_list', JSON.stringify(stores));
  postApiBackground('/api/stores', stores);
};

export const getUsers = (): UserAccount[] => {
  const data = localStorage.getItem('users_list');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // Fallback
    }
  }
  return DEFAULT_USERS;
};

export const saveUsers = (users: UserAccount[]) => {
  localStorage.setItem('users_list', JSON.stringify(users));
  postApiBackground('/api/users', users);
};

export const getCurrentUser = (): UserAccount => {
  const data = localStorage.getItem('current_logged_user');
  if (!data) {
    const defaultUser: UserAccount = DEFAULT_USERS[0];
    localStorage.setItem('current_logged_user', JSON.stringify(defaultUser));
    return defaultUser;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_USERS[0];
  }
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

export const saveStockAdjustmentsLocally = (adjs: StockAdjustment[]) => {
  safeSetItem('stock_adjustments', JSON.stringify(adjs));
};

export const saveStockAdjustments = (adjs: StockAdjustment[], _updatedSingleAdj?: StockAdjustment) => {
  safeSetItem('stock_adjustments', JSON.stringify(adjs));
  postApiBackground('/api/adjustments', adjs);
};

export const getClosingPlanRecords = (): ClosingPlanRecord[] => {
  const data = localStorage.getItem('closing_plan_records');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

export const saveClosingPlanRecordsLocally = (records: ClosingPlanRecord[]) => {
  safeSetItem('closing_plan_records', JSON.stringify(records));
};

export const saveClosingPlanRecords = (records: ClosingPlanRecord[], _updatedSingleRecord?: ClosingPlanRecord) => {
  safeSetItem('closing_plan_records', JSON.stringify(records));
  postApiBackground('/api/closing-records', records);
};

export const deleteClosingPlanRecord = (id: string): ClosingPlanRecord[] => {
  const current = getClosingPlanRecords();
  const updated = current.filter((r) => r.id !== id);
  safeSetItem('closing_plan_records', JSON.stringify(updated));
  fetch(`/api/closing-records/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  return updated;
};

/**
 * Purge all records across all tables for a specific date
 */
export const purgeDateRecords = (dateToPurge: string) => {
  if (!dateToPurge) return;
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


export const deduplicateThawingItems = (rawItems: ThawingItem[]): ThawingItem[] => {
  if (!Array.isArray(rawItems)) return [];
  const mapById = new Map<string, ThawingItem>();

  for (const item of rawItems) {
    if (!item) continue;
    const id = item.id || `meat_${Math.random().toString(36).substring(2, 8)}`;
    const hasPhoto = Boolean(item.image && item.image !== 'placeholder' && item.image.trim());

    if (mapById.has(id)) {
      const existing = mapById.get(id)!;
      const existingHasPhoto = Boolean(existing.image && existing.image !== 'placeholder' && existing.image.trim());
      mapById.set(id, {
        ...existing,
        ...item,
        id,
        image: hasPhoto ? item.image : (existingHasPhoto ? existing.image : item.image),
      });
    } else {
      mapById.set(id, { ...item, id });
    }
  }

  return Array.from(mapById.values());
};

export const deduplicateDailyReports = (reports: DailyClosingReport[]): DailyClosingReport[] => {
  if (!Array.isArray(reports)) return [];
  const map = new Map<string, DailyClosingReport>();
  for (const r of reports) {
    if (!r) continue;
    const storeId = r.storeId || '1';
    const date = (r.date || '').split('T')[0];
    const key = `${storeId}_${date}`;
    if (!map.has(key)) {
      map.set(key, r);
    } else {
      const existing = map.get(key)!;
      const existingTime = new Date(existing.closedAt || 0).getTime();
      const newTime = new Date(r.closedAt || 0).getTime();
      if (newTime >= existingTime) {
        map.set(key, r);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

export const getThawingItems = (): ThawingItem[] => {
  const data = localStorage.getItem('thawing_items');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return deduplicateThawingItems(parsed);
  } catch {
    return [];
  }
};

export const saveThawingItemsLocally = (items: ThawingItem[]) => {
  const cleanItems = deduplicateThawingItems(items);
  safeSetItem('thawing_items', JSON.stringify(cleanItems));
};

export const saveThawingItems = (items: ThawingItem[], _updatedSingleItem?: ThawingItem) => {
  const cleanItems = deduplicateThawingItems(items);
  safeSetItem('thawing_items', JSON.stringify(cleanItems));
  postApiBackground('/api/thawing-items', cleanItems);
};

export const getFabricationSegments = (): FabricationSegment[] => {
  const data = localStorage.getItem('fabrication_segments');
  return data ? JSON.parse(data) : [];
};

export const saveFabricationSegmentsLocally = (segments: FabricationSegment[]) => {
  safeSetItem('fabrication_segments', JSON.stringify(segments));
};

export const saveFabricationSegments = (segments: FabricationSegment[], _updatedSingleSegment?: FabricationSegment) => {
  safeSetItem('fabrication_segments', JSON.stringify(segments));
  postApiBackground('/api/fabrication-segments', segments);
};

export const deleteFabricationSegment = (id: string): FabricationSegment[] => {
  const current = getFabricationSegments();
  const updated = current.filter((s) => s.id !== id);
  safeSetItem('fabrication_segments', JSON.stringify(updated));
  fetch(`/api/fabrication-segments/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  return updated;
};

export const getDailyReports = (): DailyClosingReport[] => {
  const data = localStorage.getItem('daily_reports');
  return data ? JSON.parse(data) : [];
};

export const saveDailyReportsLocally = (reports: DailyClosingReport[]) => {
  safeSetItem('daily_reports', JSON.stringify(reports));
};

export const saveDailyReports = (reports: DailyClosingReport[], _updatedSingleReport?: DailyClosingReport) => {
  safeSetItem('daily_reports', JSON.stringify(reports));
  postApiBackground('/api/reports', reports);
};

export const deleteDailyReport = (id: string): DailyClosingReport[] => {
  const current = getDailyReports();
  const updated = current.filter((r) => r.id !== id);
  safeSetItem('daily_reports', JSON.stringify(updated));
  fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  return updated;
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
  // Wipe all transaction / input stores
  localStorage.removeItem('thawing_items');
  localStorage.removeItem('fabrication_segments');
  localStorage.removeItem('stock_adjustments');
  localStorage.removeItem('closing_plan_records');
  localStorage.removeItem('daily_reports');
  localStorage.removeItem('data_susut');
  localStorage.removeItem('training_files_records');
  localStorage.removeItem('sales_training_dataset');
  localStorage.removeItem('python_ml_models');

  // Trigger server-side truncate
  try {
    await fetch('/api/database/reset', { method: 'POST' });
  } catch {
    // ignore
  }
};

// --- TRAINING FILES STORAGE ---
export const getTrainingFiles = (): TrainingFileRecord[] => {
  try {
    const data = localStorage.getItem('training_files_records');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveTrainingFiles = (files: TrainingFileRecord[]): void => {
  safeSetItem('training_files_records', JSON.stringify(files));
  postApiBackground('/api/training-files', files);
};

export const deleteTrainingFile = (id: string): TrainingFileRecord[] => {
  const current = getTrainingFiles();
  const updated = current.filter((f) => f.id !== id);
  safeSetItem('training_files_records', JSON.stringify(updated));
  fetch(`/api/training-files/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  return updated;
};

// --- DAILY TARGET MANUAL CONFIGS STORAGE ---
export const getDailyTargetConfigs = (): DailyTargetManualConfig[] => {
  try {
    const data = localStorage.getItem('daily_target_configs');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveDailyTargetConfigs = (configs: DailyTargetManualConfig[]): void => {
  safeSetItem('daily_target_configs', JSON.stringify(configs));
  postApiBackground('/api/daily-targets', configs);
};

// --- SALES PREDICTION TRAINING DATASET STORAGE ---
export const generateDefaultSalesTrainingData = (storeId: string = '1'): SalesTrainingRecord[] => {
  const result: SalesTrainingRecord[] = [];
  const baseDate = new Date();
  const daysOfWeek = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const plans = [
    { name: 'D.sapi pot. rdang', cat: 'DAGING FRESH', baseKg: 18.5 },
    { name: 'Daging Rendang Shankle', cat: 'DAGING FRESH', baseKg: 11.2 },
    { name: 'Rawon Curah', cat: 'RAWON FRESH', baseKg: 7.8 },
    { name: 'FRIBOY / Daging Prem 2', cat: 'DAGING PREMIUM', baseKg: 5.5 },
  ];

  // Generate 21 days historical training dataset
  for (let i = 21; i >= 1; i--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayIndex = d.getDay();
    const dayName = daysOfWeek[dayIndex];
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    const isFriday = dayIndex === 5;
    const dayMultiplier = isWeekend ? 1.35 : isFriday ? 1.15 : 1.0;

    plans.forEach((p, idx) => {
      // Add slight realistic variance
      const variance = 0.9 + ((i * 3 + idx * 7) % 25) / 100;
      const salesKg = Math.round(p.baseKg * dayMultiplier * variance * 10) / 10;
      const productionKg = Math.round((salesKg + 1.2) * 10) / 10;
      const lossKg = Math.round((productionKg - salesKg) * 0.2 * 10) / 10;
      const lossPct = Math.round((lossKg / productionKg) * 1000) / 10;

      result.push({
        id: `tr_${storeId}_${dateStr}_${idx}`,
        storeId,
        date: dateStr,
        dayName,
        planName: p.name,
        category: p.cat,
        salesKg,
        productionKg,
        lossKg,
        lossPercent: lossPct,
        notes: isWeekend ? 'Lonjakan weekend reguler' : 'Hari kerja reguler',
        source: 'upload_file',
        createdAt: d.toISOString(),
      });
    });
  }

  return result;
};

export const getSalesTrainingDataset = (storeId?: string): SalesTrainingRecord[] => {
  try {
    const data = localStorage.getItem('sales_training_dataset');
    if (data) {
      const parsed: SalesTrainingRecord[] = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return storeId ? parsed.filter((r) => !r.storeId || String(r.storeId) === String(storeId)) : parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load sales training dataset:', e);
  }

  // If empty, generate realistic seed dataset
  const seed = generateDefaultSalesTrainingData(storeId || '1');
  safeSetItem('sales_training_dataset', JSON.stringify(seed));
  postApiBackground('/api/sales-training-dataset', seed);
  return seed;
};

export const saveSalesTrainingDataset = (dataset: SalesTrainingRecord[]): void => {
  safeSetItem('sales_training_dataset', JSON.stringify(dataset));
  postApiBackground('/api/sales-training-dataset', dataset);
};

export const getSalesPredictionConfig = (storeId: string = '1'): SalesPredictionModelConfig => {
  try {
    const data = localStorage.getItem(`sales_ml_config_${storeId}`);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // fallback
  }

  return {
    storeId,
    customBaselineKg: 35.0,
    weekendMultiplier: 1.35,
    paydayMultiplier: 1.25,
    fridayMultiplier: 1.15,
    algorithmMode: 'hybrid_ml',
    updatedAt: new Date().toISOString(),
  };
};

export const saveSalesPredictionConfig = (config: SalesPredictionModelConfig): void => {
  safeSetItem(`sales_ml_config_${config.storeId}`, JSON.stringify(config));
  postApiBackground('/api/sales-prediction-config', config);
};

// --- PYTHON TRAINED MODEL ARTIFACTS STORAGE (.pkl, .joblib, .onnx, dll) ---
export const getPythonModels = (storeId?: string): PythonModelArtifact[] => {
  try {
    const data = localStorage.getItem('python_ml_models');
    if (data) {
      const parsed: PythonModelArtifact[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return storeId ? parsed.filter((m) => !m.storeId || String(m.storeId) === String(storeId)) : parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load python models:', e);
  }
  return [];
};

export const savePythonModels = (models: PythonModelArtifact[]): void => {
  safeSetItem('python_ml_models', JSON.stringify(models));
  postApiBackground('/api/python-models', models);
};

export const deletePythonModel = (id: string, storeId?: string): PythonModelArtifact[] => {
  const current = getPythonModels();
  const updated = current.filter((m) => m.id !== id);
  savePythonModels(updated);
  fetch(`/api/python-models/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  return storeId ? updated.filter((m) => !m.storeId || String(m.storeId) === String(storeId)) : updated;
};

export const setActivePythonModel = (modelId: string | null, storeId: string = '1'): void => {
  const models = getPythonModels();
  const updatedModels = models.map((m) => {
    if (String(m.storeId) === String(storeId)) {
      return { ...m, isActive: m.id === modelId };
    }
    return m;
  });
  savePythonModels(updatedModels);

  // Update sales prediction config
  const cfg = getSalesPredictionConfig(storeId);
  const activeModel = updatedModels.find((m) => m.id === modelId && String(m.storeId) === String(storeId));
  const newCfg: SalesPredictionModelConfig = {
    ...cfg,
    algorithmMode: activeModel ? 'python_model' : 'hybrid_ml',
    activePythonModelId: activeModel ? activeModel.id : undefined,
    activePythonModelName: activeModel ? (activeModel.algorithmName || activeModel.fileName) : undefined,
    customBaselineKg: activeModel?.customBaselineKg ? activeModel.customBaselineKg : cfg.customBaselineKg,
    updatedAt: new Date().toISOString(),
  };
  saveSalesPredictionConfig(newCfg);
};

// --- GRN (GOODS RECEIVED NOTE) STORAGE ---
export const getGrnRecords = (storeId?: string, date?: string): GrnRecord[] => {
  try {
    const data = localStorage.getItem('grn_records');
    if (data) {
      let parsed: GrnRecord[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        if (storeId) parsed = parsed.filter((r) => !r.storeId || String(r.storeId) === String(storeId));
        if (date) parsed = parsed.filter((r) => (r.date || '').split('T')[0] === date.split('T')[0]);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load GRN records:', e);
  }
  return [];
};

export const saveGrnRecords = (records: GrnRecord[] | GrnRecord): void => {
  const current = getGrnRecords();
  const incoming = Array.isArray(records) ? records : [records];
  const updated = [...current];

  incoming.forEach((rec) => {
    // Strictly match by unique ID to preserve multiple shipments with the same product name and amount
    const idx = updated.findIndex((r) => Boolean(rec.id && r.id && r.id === rec.id));
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], ...rec };
    } else {
      updated.unshift(rec);
    }
  });

  safeSetItem('grn_records', JSON.stringify(updated));
  postApiBackground('/api/grn', incoming);
};

export const deleteGrnRecord = (id: string): void => {
  const current = getGrnRecords();
  const updated = current.filter((r) => r.id !== id);
  safeSetItem('grn_records', JSON.stringify(updated));
  fetch(`/api/grn/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
};

