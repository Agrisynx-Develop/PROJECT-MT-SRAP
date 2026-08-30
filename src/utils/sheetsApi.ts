import {
  Store,
  UserAccount,
  CogsMaster,
  StockAdjustment,
  ClosingPlanRecord,
  ThawingItem,
  FabricationSegment,
  DailyClosingReport,
  LossAlertConfig
} from '../types';

export interface AllSheetsData {
  stores: Store[];
  users: UserAccount[];
  cogsMaster: CogsMaster[];
  thawingItems: ThawingItem[];
  fabricationSegments: FabricationSegment[];
  closingPlanRecords: ClosingPlanRecord[];
  dailyClosingReports: DailyClosingReport[];
  stockAdjustments: StockAdjustment[];
  lossConfig: LossAlertConfig;
}

const STORAGE_KEY_URL = 'google_sheets_apps_script_url';
const STORAGE_KEY_LAST_SYNC = 'google_sheets_last_sync_time';

/**
 * Normalizes table names to match Google Spreadsheet tab names
 */
export function normalizeSheetTableName(table: string): string {
  const map: Record<string, string> = {
    thawing_items: 'Thawing_Daging',
    Thawing_Daging: 'Thawing_Daging',
    thawingItems: 'Thawing_Daging',
    fabrication_segments: 'Pabrikasi_Segmen',
    Pabrikasi_Segmen: 'Pabrikasi_Segmen',
    fabricationSegments: 'Pabrikasi_Segmen',
    closing_plan_records: 'Closing_Fisik',
    Closing_Fisik: 'Closing_Fisik',
    closingPlanRecords: 'Closing_Fisik',
    daily_closing_reports: 'Laporan_Closing',
    Laporan_Closing: 'Laporan_Closing',
    dailyClosingReports: 'Laporan_Closing',
    daily_reports: 'Laporan_Closing',
    stock_adjustments: 'Koreksi_Stok',
    Koreksi_Stok: 'Koreksi_Stok',
    stockAdjustments: 'Koreksi_Stok',
    stores: 'Toko_Cabang',
    stores_list: 'Toko_Cabang',
    Toko_Cabang: 'Toko_Cabang',
    users: 'Pengguna',
    users_list: 'Pengguna',
    Pengguna: 'Pengguna',
    cogs_master: 'Master_COGS',
    cogsMaster: 'Master_COGS',
    Master_COGS: 'Master_COGS',
    loss_config: 'Loss_Config',
    lossConfig: 'Loss_Config',
    Loss_Config: 'Loss_Config',
  };
  return map[table] || table;
}

/**
 * Get configured Google Apps Script Web App URL
 */
export function getGoogleAppsScriptUrl(): string {
  // 1. User configured in browser / settings
  const localUrl = localStorage.getItem(STORAGE_KEY_URL);
  if (localUrl && localUrl.trim().startsWith('http')) {
    return localUrl.trim();
  }

  // 2. Vite environment variable (if set during build or deploy on Netlify / Cloud)
  const envUrl = 
    (import.meta as any).env?.VITE_GOOGLE_SHEETS_APPS_SCRIPT_URL ||
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    (import.meta as any).env?.VITE_APPS_SCRIPT_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
    return envUrl.trim();
  }

  return '';
}

/**
 * Set and persist Google Apps Script Web App URL
 */
export function setGoogleAppsScriptUrl(url: string): void {
  const clean = url.trim();
  if (clean) {
    localStorage.setItem(STORAGE_KEY_URL, clean);
  } else {
    localStorage.removeItem(STORAGE_KEY_URL);
  }
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
 * Test connectivity to Google Apps Script Web App
 */
export async function testAppsScriptConnection(testUrl?: string): Promise<{
  success: boolean;
  message: string;
  spreadsheetName?: string;
  spreadsheetId?: string;
}> {
  const url = testUrl || getGoogleAppsScriptUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL Google Apps Script belum diisi. Masukkan URL Web App terlebih dahulu.'
    };
  }

  try {
    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping&_t=${Date.now()}`;
    const res = await fetch(fetchUrl, { method: 'GET' });
    
    if (!res.ok) {
      return {
        success: false,
        message: `HTTP Error ${res.status}: ${res.statusText}. Pastikan Web App disetting "Who has access: Anyone".`
      };
    }

    const data = await res.json();
    if (data.status === 'ONLINE' || data.success) {
      return {
        success: true,
        message: data.message || 'Koneksi ke Google Spreadsheet Berhasil & Aktif!',
        spreadsheetName: data.spreadsheetName,
        spreadsheetId: data.spreadsheetId,
      };
    }

    return {
      success: false,
      message: data.error || 'Respon diterima namun status tidak ONLINE.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi Google Apps Script: ${err.message || 'Cek koneksi internet atau izin Web App.'}`
    };
  }
}

/**
 * Fetch ALL 8 tables from Google Spreadsheet via Google Apps Script (GET request)
 */
export async function fetchAllDataFromSheets(): Promise<{
  success: boolean;
  data?: AllSheetsData;
  error?: string;
}> {
  const url = getGoogleAppsScriptUrl();
  if (!url) {
    return {
      success: false,
      error: 'URL Google Apps Script belum dikonfigurasi.'
    };
  }

  try {
    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=getAllData&_t=${Date.now()}`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (json.success && json.data) {
      setLastSyncTime();
      return {
        success: true,
        data: {
          stores: Array.isArray(json.data.stores) ? json.data.stores : [],
          users: Array.isArray(json.data.users) ? json.data.users : [],
          cogsMaster: Array.isArray(json.data.cogsMaster) ? json.data.cogsMaster : [],
          thawingItems: Array.isArray(json.data.thawingItems) ? json.data.thawingItems : [],
          fabricationSegments: Array.isArray(json.data.fabricationSegments) ? json.data.fabricationSegments : [],
          closingPlanRecords: Array.isArray(json.data.closingPlanRecords) ? json.data.closingPlanRecords : [],
          dailyClosingReports: Array.isArray(json.data.dailyClosingReports) ? json.data.dailyClosingReports : [],
          stockAdjustments: Array.isArray(json.data.stockAdjustments) ? json.data.stockAdjustments : [],
          lossConfig: json.data.lossConfig || {
            maxProcessLossPercent: 1.0,
            maxSalesLossPercent: 1.0,
            maxDailyLossPercent: 2.0,
            safeThawingLossPercent: 1.0,
            safeFabricationLossPercent: 1.0,
            salesPredictionKg: 40.0,
          },
        }
      };
    }

    return {
      success: false,
      error: json.error || 'Format data dari Spreadsheet tidak sesuai.'
    };
  } catch (err: any) {
    console.warn('[Google Sheets Sync] Fetch all data failed:', err);
    return {
      success: false,
      error: err.message || 'Gagal membaca data dari Google Spreadsheet.'
    };
  }
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
  return postToSheets({
    action: 'upsertRecord',
    table: normalizeSheetTableName(table),
    record,
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
  return postToSheets({
    action: 'updateTable',
    table: normalizeSheetTableName(table),
    items,
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
 * Reset transaction data in Google Sheets
 */
export async function resetSheetsData(): Promise<boolean> {
  return postToSheets({
    action: 'resetData',
    timestamp: new Date().toISOString()
  });
}
