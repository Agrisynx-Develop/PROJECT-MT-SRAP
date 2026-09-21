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
  DataSusutRecord
} from '../types';
import { ensureCloudSafeImage } from './imageCompressor';

export interface AllSheetsData {
  stores: Store[];
  users: UserAccount[];
  cogsMaster: CogsMaster[];
  thawingItems: ThawingItem[];
  fabricationSegments: FabricationSegment[];
  closingPlanRecords: ClosingPlanRecord[];
  dailyClosingReports: DailyClosingReport[];
  stockAdjustments: StockAdjustment[];
  dataSusut?: DataSusutRecord[];
  lossConfig: LossAlertConfig;
}

const STORAGE_KEY_URL = 'google_sheets_apps_script_url';
const STORAGE_KEY_LAST_SYNC = 'google_sheets_last_sync_time';

/**
 * Normalizes table names to match Google Spreadsheet 8 canonical tab names
 */
export function normalizeSheetTableName(table: string): string {
  const map: Record<string, string> = {
    // 1. Data_Thawing
    thawing_items: 'Data_Thawing',
    Thawing_Daging: 'Data_Thawing',
    thawingItems: 'Data_Thawing',
    data_thawing: 'Data_Thawing',
    Data_Thawing: 'Data_Thawing',

    // 2. Data_Pabrikasi
    fabrication_segments: 'Data_Pabrikasi',
    Pabrikasi_Segmen: 'Data_Pabrikasi',
    fabricationSegments: 'Data_Pabrikasi',
    data_pabrikasi: 'Data_Pabrikasi',
    Data_Pabrikasi: 'Data_Pabrikasi',

    // 3. Closing_Rencana_Potong
    closing_plan_records: 'Closing_Rencana_Potong',
    Closing_Fisik: 'Closing_Rencana_Potong',
    closingPlanRecords: 'Closing_Rencana_Potong',
    closing_rencana_potong: 'Closing_Rencana_Potong',
    Closing_Rencana_Potong: 'Closing_Rencana_Potong',
    daily_closing_reports: 'Closing_Rencana_Potong',
    Laporan_Closing: 'Closing_Rencana_Potong',
    dailyClosingReports: 'Closing_Rencana_Potong',
    daily_reports: 'Closing_Rencana_Potong',

    // 4. Pengguna
    users: 'Pengguna',
    users_list: 'Pengguna',
    Pengguna: 'Pengguna',

    // 5. Toko_Cabang
    stores: 'Toko_Cabang',
    stores_list: 'Toko_Cabang',
    Toko_Cabang: 'Toko_Cabang',

    // 6. Master_COGS
    cogs_master: 'Master_COGS',
    cogsMaster: 'Master_COGS',
    Master_COGS: 'Master_COGS',

    // 7. Adjustment
    stock_adjustments: 'Adjustment',
    Koreksi_Stok: 'Adjustment',
    stockAdjustments: 'Adjustment',
    Adjustment: 'Adjustment',
    adjustment: 'Adjustment',

    // 8. Data_Susut
    data_susut: 'Data_Susut',
    dataSusut: 'Data_Susut',
    Data_Susut: 'Data_Susut',
  };
  return map[table] || table;
}

/**
 * Cleans and normalizes Google Apps Script URL
 */
export function cleanAppsScriptUrl(raw: string): string {
  if (!raw) return '';
  let url = raw.trim().replace(/['"]/g, '');
  // Auto-correct /dev to /exec if user copied test URL
  if (url.includes('/macros/s/') && url.endsWith('/dev')) {
    url = url.replace(/\/dev$/, '/exec');
  }
  return url;
}

/**
 * Validates Google Apps Script URL with specific guidance
 */
export function validateAppsScriptUrl(raw: string): { isValid: boolean; error?: string; cleanedUrl?: string } {
  const cleaned = cleanAppsScriptUrl(raw);
  if (!cleaned) {
    return { isValid: false, error: 'URL Google Apps Script belum diisi.' };
  }
  if (!cleaned.startsWith('https://') && !cleaned.startsWith('http://')) {
    return { isValid: false, error: 'URL harus diawali dengan https://' };
  }
  if (cleaned.includes('docs.google.com/spreadsheets')) {
    return {
      isValid: false,
      error: 'URL yang Anda masukkan adalah link Spreadsheet Google Docs, BUKAN link Web App! Buka Spreadsheet > Ekstensi > Apps Script > Terapkan (Deploy) > Aplikasi Web (Web App), lalu salin URL yang berakhiran /exec.'
    };
  }
  if (!cleaned.includes('script.google.com') && !cleaned.includes('/exec')) {
    return {
      isValid: false,
      error: 'Format URL Web App Google Apps Script tidak dikenali. URL biasanya berupa: https://script.google.com/macros/s/.../exec'
    };
  }
  return { isValid: true, cleanedUrl: cleaned };
}

/**
 * Get configured Google Apps Script Web App URL
 */
export function getGoogleAppsScriptUrl(): string {
  // 1. User configured in browser / settings
  const localUrl = localStorage.getItem(STORAGE_KEY_URL);
  if (localUrl && localUrl.trim().startsWith('http')) {
    return cleanAppsScriptUrl(localUrl);
  }

  // 2. Vite environment variable (if set during build or deploy on Netlify / Cloud)
  const envUrl = 
    (import.meta as any).env?.VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    (import.meta as any).env?.VITE_APPS_SCRIPT_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
    return cleanAppsScriptUrl(envUrl);
  }

  return '';
}

/**
 * Set and persist Google Apps Script Web App URL across browser and backend
 */
export function setGoogleAppsScriptUrl(url: string): void {
  saveGoogleAppsScriptUrl(url);
}

export function saveGoogleAppsScriptUrl(url: string): void {
  const clean = cleanAppsScriptUrl(url);
  if (clean) {
    localStorage.setItem(STORAGE_KEY_URL, clean);
  } else {
    localStorage.removeItem(STORAGE_KEY_URL);
  }
  // Sync to server backend asynchronously so other devices share it
  fetch('/api/config/sheets-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: clean })
  }).catch(() => {});
}

/**
 * Get the timestamp of the last successful synchronization
 */
export function getLastSyncTime(): string | null {
  return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
}

/**
 * Set the last synchronization timestamp
 */
export function setLastSyncTime(): void {
  localStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());
}

/**
 * Parse and normalize payload data received from Google Spreadsheet
 */
function parseAllSheetsPayload(raw: any): AllSheetsData {
  return {
    stores: Array.isArray(raw.stores) ? raw.stores : [],
    users: Array.isArray(raw.users) ? raw.users : [],
    cogsMaster: Array.isArray(raw.cogsMaster) ? raw.cogsMaster : [],
    thawingItems: Array.isArray(raw.thawingItems) ? raw.thawingItems : [],
    fabricationSegments: Array.isArray(raw.fabricationSegments) ? raw.fabricationSegments : [],
    closingPlanRecords: Array.isArray(raw.closingPlanRecords) ? raw.closingPlanRecords : [],
    dailyClosingReports: Array.isArray(raw.dailyClosingReports) ? raw.dailyClosingReports : [],
    stockAdjustments: Array.isArray(raw.stockAdjustments) ? raw.stockAdjustments : [],
    dataSusut: Array.isArray(raw.dataSusut) ? raw.dataSusut : [],
    lossConfig: raw.lossConfig || {
      maxProcessLossPercent: 1.0,
      maxSalesLossPercent: 1.0,
      maxDailyLossPercent: 2.0,
      safeThawingLossPercent: 1.0,
      safeFabricationLossPercent: 1.0,
      salesPredictionKg: 40.0,
    },
  };
}

/**
 * Test connectivity to Google Apps Script Web App with dual POST/GET and Proxy fallback
 */
export async function testAppsScriptConnection(testUrl?: string): Promise<{
  success: boolean;
  message: string;
  spreadsheetName?: string;
  spreadsheetId?: string;
  normalizedUrl?: string;
}> {
  const rawTarget = testUrl !== undefined ? testUrl : getGoogleAppsScriptUrl();
  const validation = validateAppsScriptUrl(rawTarget);
  if (!validation.isValid) {
    return {
      success: false,
      message: validation.error || 'URL Web App tidak valid.'
    };
  }

  const url = validation.cleanedUrl!;

  // 1. Try POST ping (Bypasses 302 redirect & CORS preflight blocking)
  try {
    const postRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping', timestamp: new Date().toISOString() })
    });
    if (postRes.ok) {
      const data = await postRes.json().catch(() => null);
      if (data && (data.status === 'ONLINE' || data.success)) {
        saveGoogleAppsScriptUrl(url);
        return {
          success: true,
          message: data.message || 'Koneksi ke Google Spreadsheet Berhasil & Aktif!',
          spreadsheetName: data.spreadsheetName,
          spreadsheetId: data.spreadsheetId,
          normalizedUrl: url
        };
      }
    }
  } catch (postErr) {
    console.warn('[SheetsApi] POST ping failed, testing GET ping...', postErr);
  }

  // 2. Try GET ping
  try {
    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping&_t=${Date.now()}`;
    const res = await fetch(fetchUrl, { method: 'GET' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'ONLINE' || data.success)) {
        saveGoogleAppsScriptUrl(url);
        return {
          success: true,
          message: data.message || 'Koneksi ke Google Spreadsheet Berhasil & Aktif!',
          spreadsheetName: data.spreadsheetName,
          spreadsheetId: data.spreadsheetId,
          normalizedUrl: url
        };
      }
    }
  } catch (getErr) {
    console.warn('[SheetsApi] GET ping failed, checking backend proxy...', getErr);
  }

  // 3. Try server proxy fallback
  try {
    const proxyRes = await fetch('/api/sheets-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, payload: { action: 'ping' } })
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json().catch(() => null);
      if (data && (data.status === 'ONLINE' || data.success)) {
        saveGoogleAppsScriptUrl(url);
        return {
          success: true,
          message: (data.message || 'Koneksi Berhasil!') + ' (Terhubung via Proxy Server)',
          spreadsheetName: data.spreadsheetName,
          spreadsheetId: data.spreadsheetId,
          normalizedUrl: url
        };
      }
    }
  } catch (proxyErr) {}

  return {
    success: false,
    message: 'Gagal terhubung ke Google Apps Script. Pastikan Web App diatur: "Execute as: Me" dan "Who has access: Anyone" (Siapa saja), lalu deploy versi baru (New deployment).',
    normalizedUrl: url
  };
}

/**
 * Fetch ALL 8 tables from Google Spreadsheet via Google Apps Script
 */
export async function fetchAllDataFromSheets(): Promise<{
  success: boolean;
  data?: AllSheetsData;
  error?: string;
}> {
  let url = getGoogleAppsScriptUrl();
  if (!url) {
    // Check if server knows the URL
    try {
      const srvRes = await fetch('/api/config/sheets-url');
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData?.url) {
          url = cleanAppsScriptUrl(srvData.url);
          saveGoogleAppsScriptUrl(url);
        }
      }
    } catch {}
  }

  if (!url) {
    return {
      success: false,
      error: 'URL Google Apps Script belum dikonfigurasi.'
    };
  }

  const cleanUrl = cleanAppsScriptUrl(url);

  // 1. Try POST (most reliable against mobile browser redirect blocking)
  try {
    const postRes = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getAllData', timestamp: new Date().toISOString() })
    });
    if (postRes.ok) {
      const json = await postRes.json();
      if (json.success && json.data) {
        setLastSyncTime();
        return { success: true, data: parseAllSheetsPayload(json.data) };
      }
    }
  } catch (e) {
    console.warn('[SheetsApi] POST getAllData failed, attempting GET...', e);
  }

  // 2. Try GET with action=getAllData
  try {
    const fetchUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=getAllData&_t=${Date.now()}`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        setLastSyncTime();
        return { success: true, data: parseAllSheetsPayload(json.data) };
      }
    }
  } catch (e) {
    console.warn('[SheetsApi] GET getAllData failed, attempting backend proxy...', e);
  }

  // 3. Try backend proxy
  try {
    const proxyRes = await fetch('/api/sheets-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, payload: { action: 'getAllData' } })
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success && json.data) {
        setLastSyncTime();
        return { success: true, data: parseAllSheetsPayload(json.data) };
      }
    }
  } catch (e) {}

  return {
    success: false,
    error: 'Tidak dapat mengambil data dari Google Spreadsheet. Periksa koneksi internet atau izin Web App.'
  };
}

/**
 * Post a targeted update/upsert to Google Apps Script
 * Using text/plain to avoid CORS preflight options blocking in browsers
 */
export async function postToSheets(payload: any): Promise<boolean> {
  const url = getGoogleAppsScriptUrl();
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setLastSyncTime();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Google Sheets Sync] Post to sheets warning:', err);
    return false;
  }
}

/**
 * Atomic Upsert single record (Prevents HP and Laptop from overwriting entire sheet!)
 */
export async function upsertRecordToSheets(table: string, record: any): Promise<boolean> {
  const normTable = normalizeSheetTableName(table);
  let safeRecord = record;
  if (record && typeof record === 'object') {
    safeRecord = { ...record };
    if (safeRecord.photoUrl && typeof safeRecord.photoUrl === 'string' && safeRecord.photoUrl.length > 35000) {
      safeRecord.photoUrl = await ensureCloudSafeImage(safeRecord.photoUrl, 35000);
    }
    if (safeRecord.image && typeof safeRecord.image === 'string' && safeRecord.image.length > 35000) {
      safeRecord.image = await ensureCloudSafeImage(safeRecord.image, 35000);
    }

    // Normalization for Laporan_Closing across Google Spreadsheet variations
    if (normTable === 'Laporan_Closing') {
      safeRecord.totalWeightRaw = safeRecord.totalWeightBeforeThawing ?? safeRecord.totalWeightRaw ?? 0;
      safeRecord.totalSales = safeRecord.totalSalesKg ?? safeRecord.totalSales ?? 0;
      safeRecord.totalEndStock = safeRecord.currentClosingStockKg ?? safeRecord.totalEndStock ?? 0;
      safeRecord.totalPeriodicShrinkage = safeRecord.totalProcessLoss ?? safeRecord.totalPeriodicShrinkage ?? 0;
      safeRecord.butcherName = safeRecord.butcherInCharge || safeRecord.adminInCharge || safeRecord.butcherName || '';
      if (Array.isArray(safeRecord.photos) && safeRecord.photos.length > 0 && !safeRecord.closingPhotoUrl) {
        safeRecord.closingPhotoUrl = safeRecord.photos[0]?.url || '';
      }
    }
  }

  return postToSheets({
    action: 'upsertRecord',
    table: normTable,
    record: safeRecord,
    timestamp: new Date().toISOString()
  });
}

/**
 * Atomic Delete single record by ID
 */
export async function deleteRecordFromSheets(table: string, recordId: string): Promise<boolean> {
  return postToSheets({
    action: 'deleteRecord',
    table: normalizeSheetTableName(table),
    id: recordId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Push full table (e.g. For bulk reorder or complete updates)
 */
export async function updateTableInSheets(table: string, items: any[]): Promise<boolean> {
  const safeItems = await Promise.all(
    (items || []).map(async (item) => {
      if (item && typeof item === 'object' && item.photoUrl && typeof item.photoUrl === 'string' && item.photoUrl.length > 35000) {
        return {
          ...item,
          photoUrl: await ensureCloudSafeImage(item.photoUrl, 35000),
        };
      }
      return item;
    })
  );

  return postToSheets({
    action: 'updateTable',
    table: normalizeSheetTableName(table),
    items: safeItems,
    timestamp: new Date().toISOString()
  });
}

/**
 * Push all database tables to Google Sheets (Full backup/migration)
 */
export async function pushAllDataToSheets(data: AllSheetsData): Promise<boolean> {
  return postToSheets({
    action: 'saveAllData',
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Reset transaction data in Google Sheets (Preserves Master_COGS, Pengguna, Toko_Cabang)
 */
export async function resetSheetsData(): Promise<boolean> {
  return postToSheets({
    action: 'resetData',
    timestamp: new Date().toISOString()
  });
}

/**
 * Initialize / Format 8 Database Sheets in Google Sheets
 */
export async function initialize8Sheets(clearTransactions: boolean = false): Promise<{ success: boolean; message: string }> {
  const url = getGoogleAppsScriptUrl();
  if (!url) {
    return { success: false, message: 'URL Google Apps Script belum disetel di pengaturan.' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'init8Sheets',
        clearTransactions,
        timestamp: new Date().toISOString()
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        message: data.message || (clearTransactions ? 'Berhasil inisialisasi 8-Sheet dan hapus data transaksi input.' : 'Berhasil menyelaraskan 8-Sheet Database di Google Sheets.')
      };
    }
    return { success: false, message: 'Gagal inisialisasi sheet di Google Apps Script.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error koneksi ke Google Apps Script.' };
  }
}

