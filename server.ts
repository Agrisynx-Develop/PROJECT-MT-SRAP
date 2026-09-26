import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Initialize PostgreSQL Connection Pool using DATABASE_URL
let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.trim()) {
    return null;
  }
  if (!pool) {
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: dbUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pool;
}

// Normalize DB role to UI standard ('admin', 'butcher', 'md')
function normalizeRole(dbRole: string): 'admin' | 'butcher' | 'md' {
  const r = (dbRole || '').toLowerCase();
  if (r.includes('admin') || r === 'admin_toko') return 'admin';
  if (r.includes('butcher') || r.includes('jagal') || r.includes('potong')) return 'butcher';
  if (r.includes('md') || r.includes('pusat') || r.includes('merchandis')) return 'md';
  return 'admin';
}

// Fallback in-memory store matching actual database structure
const inMemoryStore = {
  stores: [
    { id: '1', code: 'CKR', name: 'TDN CKR', city: 'Cikarang', createdAt: '2026-01-01' },
    { id: '2', code: 'BKS', name: 'TDN BKS', city: 'Bekasi', createdAt: '2026-01-15' },
    { id: '3', code: 'BDG', name: 'TDN BDG', city: 'Bandung', createdAt: '2026-02-01' },
  ],
  users: [
    { id: '1', username: 'butcher_ckr', password: 'butcher123', role: 'butcher', storeId: '1', storeName: 'TDN CKR', fullName: 'Butcher CKR', linkedAccountId: '2', createdAt: '2026-01-01' },
    { id: '2', username: 'admin_ckr', password: 'admin123', role: 'admin', storeId: '1', storeName: 'TDN CKR', fullName: 'Admin CKR', linkedAccountId: '1', createdAt: '2026-01-01' },
    { id: '3', username: 'md_pusat', password: 'md123', role: 'md', storeId: null, storeName: null, fullName: 'MD Pusat', createdAt: '2026-01-01' },
    { id: '4', username: 'butcher_bks', password: 'butcher123', role: 'butcher', storeId: '2', storeName: 'TDN BKS', fullName: 'Butcher BKS', linkedAccountId: '5', createdAt: '2026-01-15' },
    { id: '5', username: 'admin_bks', password: 'admin123', role: 'admin', storeId: '2', storeName: 'TDN BKS', fullName: 'Admin BKS', linkedAccountId: '4', createdAt: '2026-01-15' },
    { id: '6', username: 'butcher_bdg', password: 'butcher123', role: 'butcher', storeId: '3', storeName: 'TDN BDG', fullName: 'Butcher BDG', linkedAccountId: '7', createdAt: '2026-02-01' },
    { id: '7', username: 'admin_bdg', password: 'admin123', role: 'admin', storeId: '3', storeName: 'TDN BDG', fullName: 'Admin BDG', linkedAccountId: '6', createdAt: '2026-02-01' },
  ],
  cogsMaster: [
    { id: 'cogs_1', itemCode: 'DF-01', itemName: 'HQ 41/42/44/45 (Daging Fresh)', planName: 'HQ 41/42/44/45', cogsPerKg: 102000, defaultPricePerKg: 125000, sellingPricePerKg: 125000, category: 'DAGING FRESH', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
    { id: 'cogs_2', itemCode: 'DF-02', itemName: 'DG RNDG BEKU 1kg', planName: 'DG RNDG BEKU 1kg', cogsPerKg: 96000, defaultPricePerKg: 118000, sellingPricePerKg: 118000, category: 'DAGING FRESH', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
    { id: 'cogs_3', itemCode: 'SH-01', itemName: 'FQ 60 / SHANK (Daging Ekonomis)', planName: 'FQ 60 /SHANK', cogsPerKg: 85200, defaultPricePerKg: 105000, sellingPricePerKg: 105000, category: 'SHANKLE', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
    { id: 'cogs_4', itemCode: 'DP-01', itemName: 'D Premium Lokal (Sirloin/Ribeye)', planName: 'D premium lokal', cogsPerKg: 127000, defaultPricePerKg: 155000, sellingPricePerKg: 155000, category: 'DAGING PREMIUM', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
    { id: 'cogs_5', itemCode: 'DP-02', itemName: 'FRIBOY / Daging Prem 2', planName: 'FRIBOY / Daging Prem 2', cogsPerKg: 103000, defaultPricePerKg: 135000, sellingPricePerKg: 135000, category: 'DAGING PREMIUM', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
    { id: 'cogs_6', itemCode: 'RW-01', itemName: 'Rawon Curah (FQ 106/105)', planName: 'Rawon Curah (FQ 106/105)', cogsPerKg: 86500, defaultPricePerKg: 110000, sellingPricePerKg: 110000, category: 'RAWON', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
    { id: 'cogs_7', itemCode: 'DF-03', itemName: 'RENDANG BEKU CURAH', planName: 'RENDANG BEKU CURAH', cogsPerKg: 102550, defaultPricePerKg: 125000, sellingPricePerKg: 125000, category: 'DAGING FRESH', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
    { id: 'cogs_8', itemCode: 'DF-04', itemName: 'DAGING KHUSUS TDN', planName: 'DAGING KHUSUS', cogsPerKg: 96000, defaultPricePerKg: 115000, sellingPricePerKg: 115000, category: 'DAGING FRESH', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  ],
  thawingItems: [] as any[],
  fabricationSegments: [] as any[],
  stockAdjustments: [] as any[],
  closingPlanRecords: [] as any[],
  grnRecords: [] as any[],
  dataSusut: [] as any[],
  dailyClosingReports: [] as any[],
  trainingFiles: [] as any[],
  dailyTargets: [] as any[],
  salesTrainingDataset: [] as any[],
  salesPredictionConfigs: {} as Record<string, any>,
  pythonModels: [] as any[],
  lossConfig: {
    maxProcessLossPercent: 1.0,
    maxSalesLossPercent: 1.0,
    maxDailyLossPercent: 2.0,
    safeThawingLossPercent: 1.0,
    safeFabricationLossPercent: 1.0,
    salesPredictionKg: 40.0,
  }
};

// ----------------- LOCAL DISK PERSISTENCE FOR IN-MEMORY DATA ENGINE -----------------
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'local_database.json');

function loadLocalStoreFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded = JSON.parse(content);
      if (loaded && typeof loaded === 'object') {
        if (Array.isArray(loaded.stores) && loaded.stores.length > 0) inMemoryStore.stores = loaded.stores;
        if (Array.isArray(loaded.users) && loaded.users.length > 0) inMemoryStore.users = loaded.users;
        if (Array.isArray(loaded.cogsMaster) && loaded.cogsMaster.length > 0) inMemoryStore.cogsMaster = loaded.cogsMaster;
        if (Array.isArray(loaded.thawingItems)) inMemoryStore.thawingItems = loaded.thawingItems;
        if (Array.isArray(loaded.fabricationSegments)) inMemoryStore.fabricationSegments = loaded.fabricationSegments;
        if (Array.isArray(loaded.stockAdjustments)) inMemoryStore.stockAdjustments = loaded.stockAdjustments;
        if (Array.isArray(loaded.closingPlanRecords)) inMemoryStore.closingPlanRecords = loaded.closingPlanRecords;
        if (Array.isArray(loaded.grnRecords)) inMemoryStore.grnRecords = loaded.grnRecords;
        if (Array.isArray(loaded.dataSusut)) inMemoryStore.dataSusut = loaded.dataSusut;
        if (Array.isArray(loaded.dailyClosingReports)) inMemoryStore.dailyClosingReports = loaded.dailyClosingReports;
        if (Array.isArray(loaded.trainingFiles)) inMemoryStore.trainingFiles = loaded.trainingFiles;
        if (Array.isArray(loaded.dailyTargets)) inMemoryStore.dailyTargets = loaded.dailyTargets;
        if (Array.isArray(loaded.salesTrainingDataset)) inMemoryStore.salesTrainingDataset = loaded.salesTrainingDataset;
        if (loaded.salesPredictionConfigs) inMemoryStore.salesPredictionConfigs = loaded.salesPredictionConfigs;
        if (Array.isArray(loaded.pythonModels)) inMemoryStore.pythonModels = loaded.pythonModels;
        if (loaded.lossConfig) inMemoryStore.lossConfig = loaded.lossConfig;
        console.log(`[Storage] Loaded persisted database: ${inMemoryStore.thawingItems.length} thawing items, ${inMemoryStore.closingPlanRecords.length} closing records, ${inMemoryStore.dailyClosingReports.length} reports`);
      }
    }
  } catch (err) {
    console.error('[Storage] Error reading local store from disk:', err);
  }
}

let persistTimeout: NodeJS.Timeout | null = null;
function persistStoreToDisk() {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[Storage] Error persisting local store to disk:', err);
    }
  }, 100);
}

// ----------------- GOOGLE APPS SCRIPT SPREADSHEET DATABASE SYNC ENGINE -----------------
const APPSCRIPT_CONFIG_FILE = path.join(DATA_DIR, 'appscript_config.json');

interface AppsScriptConfig {
  url: string;
  autoSync: boolean;
  lastSync: string | null;
}

let appsScriptConfig: AppsScriptConfig = {
  url: process.env.APPS_SCRIPT_URL || '',
  autoSync: true,
  lastSync: null,
};

function loadAppsScriptConfig() {
  try {
    if (fs.existsSync(APPSCRIPT_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(APPSCRIPT_CONFIG_FILE, 'utf-8'));
      if (data && typeof data === 'object') {
        appsScriptConfig = {
          url: data.url || process.env.APPS_SCRIPT_URL || '',
          autoSync: data.autoSync !== false,
          lastSync: data.lastSync || null,
        };
      }
    }
  } catch (e) {
    console.error('[AppsScript] Failed to load config:', e);
  }
}

function saveAppsScriptConfig(cfg: Partial<AppsScriptConfig>) {
  try {
    appsScriptConfig = { ...appsScriptConfig, ...cfg };
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(APPSCRIPT_CONFIG_FILE, JSON.stringify(appsScriptConfig, null, 2), 'utf-8');
  } catch (e) {
    console.error('[AppsScript] Failed to save config:', e);
  }
}

async function sendToAppsScript(payload: any, customUrl?: string): Promise<any> {
  const targetUrl = customUrl || appsScriptConfig.url;
  if (!targetUrl || !targetUrl.trim()) return null;

  try {
    const res = await fetch(targetUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    if (res.ok) {
      const data = await res.json();
      appsScriptConfig.lastSync = new Date().toISOString();
      saveAppsScriptConfig({});
      return data;
    } else {
      const text = await res.text();
      console.warn('[AppsScript] Server responded with error:', res.status, text.substring(0, 200));
      return null;
    }
  } catch (err: any) {
    console.warn('[AppsScript] Sync request failed:', err?.message || err);
    return null;
  }
}

function pushTableMutationToAppsScript(table: string, records: any[]) {
  if (!appsScriptConfig.url || !appsScriptConfig.autoSync || !records || records.length === 0) return;
  setTimeout(() => {
    sendToAppsScript({
      action: 'upsert',
      table,
      records,
    }).catch(() => {});
  }, 50);
}

async function pullAllFromAppsScript(): Promise<{ success: boolean; totalRecords: number; error?: string }> {
  if (!appsScriptConfig.url) return { success: false, totalRecords: 0, error: 'URL Google Apps Script belum diisi' };
  try {
    const cleanUrl = appsScriptConfig.url.trim();
    const fetchUrl = cleanUrl.includes('?') ? `${cleanUrl}&action=getAll` : `${cleanUrl}?action=getAll`;
    const res = await fetch(fetchUrl, { method: 'GET', redirect: 'follow' });
    if (!res.ok) {
      return { success: false, totalRecords: 0, error: `Google Sheets error: ${res.statusText}` };
    }
    const json = await res.json();
    if (!json || json.status !== 'success' || !json.data) {
      return { success: false, totalRecords: 0, error: json?.message || 'Data tidak ditemukan' };
    }

    const data = json.data;
    let count = 0;

    // Merge Closing_Harian (Match strictly by ID to allow same name & quantity)
    if (Array.isArray(data.Closing_Harian) && data.Closing_Harian.length > 0) {
      data.Closing_Harian.forEach((r: any) => {
        if (!r || !r.ID) return;
        const norm = {
          id: r.ID,
          storeId: r.ID_Toko || '1',
          date: r.Tanggal,
          category: r.Kategori || 'DAGING FRESH',
          planName: r.Nama_Produk,
          openingStockKg: Number(r.Stok_Awal_Kg) || 0,
          newProcessedKg: Number(r.Olahan_Baru_Kg) || 0,
          grnKg: Number(r.GRN_Masuk_Kg) || 0,
          salesKg: Number(r.Sales_Kg) || 0,
          adjustInKg: Number(r.Adjust_In_Kg) || 0,
          adjustOutKg: Number(r.Adjust_Out_Kg) || 0,
          closingStockBySystemKg: Number(r.Sisa_Sistem_Kg) || 0,
          actualClosingStockKg: Number(r.Sisa_Fisik_Kg) || 0,
          susutJualKg: Number(r.Susut_Jual_Kg) || 0,
          tallyKg: r.Tally_Kg ? Number(r.Tally_Kg) : undefined,
          brutoKg: r.Bruto_Kg ? Number(r.Bruto_Kg) : undefined,
          nettoKg: r.Netto_Kg ? Number(r.Netto_Kg) : undefined,
          costPerKg: r.Cost_Per_Kg ? Number(r.Cost_Per_Kg) : undefined,
          sellingPricePerKg: r.Sale_Per_Kg ? Number(r.Sale_Per_Kg) : undefined,
          gpPercent: r.GP_Percent ? Number(r.GP_Percent) : undefined,
          note: r.Catatan || '',
          butcherName: r.Nama_Petugas || 'Petugas',
          photoUrl: r.Foto_Bukti || '',
          timestamp: r.Timestamp || new Date().toISOString(),
        };
        const idx = inMemoryStore.closingPlanRecords.findIndex((c) => c.id === norm.id);
        if (idx >= 0) inMemoryStore.closingPlanRecords[idx] = { ...inMemoryStore.closingPlanRecords[idx], ...norm };
        else inMemoryStore.closingPlanRecords.unshift(norm);
        count++;
      });
    }

    // Merge Penerimaan_GRN (Match strictly by ID to allow same name & quantity)
    if (Array.isArray(data.Penerimaan_GRN) && data.Penerimaan_GRN.length > 0) {
      data.Penerimaan_GRN.forEach((g: any) => {
        if (!g || !g.ID) return;
        const norm = {
          id: g.ID,
          storeId: g.ID_Toko || '1',
          date: g.Tanggal,
          reportCategory: g.Kategori_Laporan || 'KENTANG_SOSIS_DORI',
          subCategory: g.Sub_Kategori || '',
          itemCode: g.Kode_Item || '',
          plu: g.PLU || '',
          productName: g.Nama_Produk,
          weightKg: Number(g.Berat_Masuk_Kg) || 0,
          supplier: g.Supplier || '',
          noSuratJalan: g.No_Surat_Jalan || '',
          receivedBy: g.Diterima_Oleh || 'Petugas Butcher',
          createdAt: g.Timestamp || new Date().toISOString(),
        };
        const idx = inMemoryStore.grnRecords.findIndex((item) => item.id === norm.id);
        if (idx >= 0) inMemoryStore.grnRecords[idx] = { ...inMemoryStore.grnRecords[idx], ...norm };
        else inMemoryStore.grnRecords.unshift(norm);
        count++;
      });
    }

    // Merge Thawing_Daging
    if (Array.isArray(data.Thawing_Daging) && data.Thawing_Daging.length > 0) {
      data.Thawing_Daging.forEach((t: any) => {
        if (!t || !t.ID) return;
        const norm = {
          id: t.ID,
          storeId: t.ID_Toko || '1',
          name: t.Nama_Item,
          status: t.Status || 'Thawing',
          weightBeforeThawing: Number(t.Berat_Sebelum_Kg) || 0,
          weightAfterThawing: t.Berat_Sesudah_Kg !== '' ? Number(t.Berat_Sesudah_Kg) : null,
          shrinkageThawing: t.Susut_Thawing_Kg !== '' ? Number(t.Susut_Thawing_Kg) : null,
          shrinkageThawingPercent: t.Persen_Susut !== '' ? Number(t.Persen_Susut) : null,
          thawingStartTime: t.Jam_Mulai || '',
          thawingEndTime: t.Jam_Selesai || null,
          durationMinutes: Number(t.Durasi_Menit) || 0,
          plannedFabrication: t.Rencana_Pabrikasi || null,
          openingPurpose: t.Tujuan_Buka || null,
          butcherName: t.Nama_Butcher || null,
          photoEvidence: t.Foto_Bukti || null,
          image: t.Foto_Bukti || null,
          createdAt: t.Waktu_Dibuat || new Date().toISOString(),
        };
        const idx = inMemoryStore.thawingItems.findIndex((item) => item.id === norm.id);
        if (idx >= 0) inMemoryStore.thawingItems[idx] = { ...inMemoryStore.thawingItems[idx], ...norm };
        else inMemoryStore.thawingItems.unshift(norm);
        count++;
      });
    }

    // Merge Pabrikasi_Segmen
    if (Array.isArray(data.Pabrikasi_Segmen) && data.Pabrikasi_Segmen.length > 0) {
      data.Pabrikasi_Segmen.forEach((p: any) => {
        if (!p || !p.ID) return;
        const norm = {
          id: p.ID,
          storeId: p.ID_Toko || '1',
          itemId: p.ID_Item_Thawing || '',
          itemName: p.Nama_Item || '',
          segmentName: p.Segmen_Potong || '',
          targetWeight: Number(p.Target_Berat_Kg) || 0,
          actualWeight: Number(p.Berat_Aktual_Kg) || 0,
          periodicShrinkage: Number(p.Susut_Proses_Kg) || 0,
          salesKg: Number(p.Sales_Kg) || 0,
          isTransferred: Boolean(p.Status_Transfer),
          createdAt: p.Waktu_Dibuat || new Date().toISOString(),
        };
        const idx = inMemoryStore.fabricationSegments.findIndex((item) => item.id === norm.id);
        if (idx >= 0) inMemoryStore.fabricationSegments[idx] = { ...inMemoryStore.fabricationSegments[idx], ...norm };
        else inMemoryStore.fabricationSegments.unshift(norm);
        count++;
      });
    }

    // Merge Koreksi_Stok_Admin
    if (Array.isArray(data.Koreksi_Stok_Admin) && data.Koreksi_Stok_Admin.length > 0) {
      data.Koreksi_Stok_Admin.forEach((a: any) => {
        if (!a || !a.ID) return;
        const norm = {
          id: a.ID,
          storeId: a.ID_Toko || '1',
          planName: a.Nama_Produk || '',
          type: a.Jenis_Koreksi || 'IN',
          weightKg: Number(a.Berat_Kg) || 0,
          reason: a.Alasan || '',
          adminName: a.Nama_Admin || 'Admin',
          createdAt: a.Timestamp || new Date().toISOString(),
        };
        const idx = inMemoryStore.stockAdjustments.findIndex((item) => item.id === norm.id);
        if (idx >= 0) inMemoryStore.stockAdjustments[idx] = { ...inMemoryStore.stockAdjustments[idx], ...norm };
        else inMemoryStore.stockAdjustments.unshift(norm);
        count++;
      });
    }

    // Merge Laporan_Harian_Rekap
    if (Array.isArray(data.Laporan_Harian_Rekap) && data.Laporan_Harian_Rekap.length > 0) {
      data.Laporan_Harian_Rekap.forEach((r: any) => {
        if (!r || !r.ID) return;
        const norm = {
          id: r.ID,
          storeId: r.ID_Toko || '1',
          storeName: r.Nama_Toko || 'TDN CKR',
          date: r.Tanggal,
          totalWeightRaw: Number(r.Total_Bahan_Baku_Kg) || 0,
          totalWeightAfterThawing: Number(r.Total_Thawing_Kg) || 0,
          totalWeightFabricated: Number(r.Total_Pabrikasi_Kg) || 0,
          totalPeriodicShrinkage: Number(r.Total_Susut_Proses_Kg) || 0,
          totalSales: Number(r.Total_Sales_Kg) || 0,
          totalEndStock: Number(r.Total_Sisa_Fisik_Kg) || 0,
          thawingLossPercent: Number(r.Persen_Susut_Thawing) || 0,
          fabricationLossPercent: Number(r.Persen_Susut_Pabrikasi) || 0,
          salesLossPercent: Number(r.Persen_Susut_Jual) || 0,
          overallLossPercent: Number(r.Persen_Total_Susut) || 0,
          statusAlert: r.Status_Alert || 'Normal',
          butcherName: r.Nama_Petugas || 'Petugas',
          createdAt: r.Timestamp || new Date().toISOString(),
        };
        const idx = inMemoryStore.dailyClosingReports.findIndex((item) => item.id === norm.id);
        if (idx >= 0) inMemoryStore.dailyClosingReports[idx] = { ...inMemoryStore.dailyClosingReports[idx], ...norm };
        else inMemoryStore.dailyClosingReports.unshift(norm);
        count++;
      });
    }

    // Merge Master_COGS
    if (Array.isArray(data.Master_COGS) && data.Master_COGS.length > 0) {
      data.Master_COGS.forEach((c: any) => {
        if (!c || !c.ID) return;
        const norm = {
          id: c.ID,
          itemCode: c.Kode_Item || '',
          itemName: c.Nama_Bahan || '',
          planName: c.Nama_Rencana || c.Nama_Bahan || '',
          category: c.Kategori || 'DAGING FRESH',
          cogsPerKg: Number(c.HPP_Per_Kg) || 100000,
          defaultPricePerKg: Number(c.Harga_Jual_Per_Kg) || 125000,
          sellingPricePerKg: Number(c.Harga_Jual_Per_Kg) || 125000,
          updatedBy: c.Diupdate_Oleh || 'MD Pusat',
          updatedAt: c.Terakhir_Update || new Date().toISOString().split('T')[0],
        };
        const idx = inMemoryStore.cogsMaster.findIndex((item) => item.id === norm.id);
        if (idx >= 0) inMemoryStore.cogsMaster[idx] = { ...inMemoryStore.cogsMaster[idx], ...norm };
        else inMemoryStore.cogsMaster.push(norm);
        count++;
      });
    }

    persistStoreToDisk();
    appsScriptConfig.lastSync = new Date().toISOString();
    saveAppsScriptConfig({});
    return { success: true, totalRecords: count };
  } catch (err: any) {
    return { success: false, totalRecords: 0, error: err.message };
  }
}


// Store matching helper handling all alias forms symmetrically
function matchStoreIdBackend(entityStoreId: any, targetStoreId: any): boolean {
  if (!targetStoreId) return true;
  if (!entityStoreId) return true;
  const e = String(entityStoreId).toLowerCase().trim();
  const t = String(targetStoreId).toLowerCase().trim();
  if (e === t) return true;

  const isCkr = (s: string) => s === '1' || s === 'store_ckr' || s === 'ckr' || s === 'store_ckt' || s === 'ckt' || s.includes('ckr') || s.includes('cikarang');
  if (isCkr(e) && isCkr(t)) return true;

  const isBks = (s: string) => s === '2' || s === 'store_bks' || s === 'bks' || s.includes('bekasi');
  if (isBks(e) && isBks(t)) return true;

  const isBdg = (s: string) => s === '3' || s === 'store_bdg' || s === 'bdg' || s.includes('bandung');
  if (isBdg(e) && isBdg(t)) return true;

  return false;
}

function getStoreIdVariants(storeId?: string): string[] {
  if (!storeId) return [];
  const s = String(storeId).toLowerCase().trim();
  if (s === '1' || s === 'store_ckr' || s === 'ckr' || s === 'store_ckt' || s === 'ckt' || s.includes('ckr') || s.includes('cikarang')) {
    return ['1', 'store_ckr', 'ckr', 'CKR', 'store_ckt', 'TDN CKR'];
  }
  if (s === '2' || s === 'store_bks' || s === 'bks' || s.includes('bekasi')) {
    return ['2', 'store_bks', 'bks', 'BKS', 'TDN BKS'];
  }
  if (s === '3' || s === 'store_bdg' || s === 'bdg' || s.includes('bandung')) {
    return ['3', 'store_bdg', 'bdg', 'BDG', 'TDN BDG'];
  }
  return [storeId];
}

// Database Structure Remover - Drops all tables & schemas if PostgreSQL is connected
async function dropDatabaseTables() {
  const p = getPool();
  if (!p) {
    console.log('[Database] No external SQL connection. Database structure cleared.');
    return;
  }

  try {
    const client = await p.connect();
    try {
      console.log('[Database] Removing entire database structure (dropping all tables)...');
      await client.query(`
        DROP TABLE IF EXISTS data_susut CASCADE;
        DROP TABLE IF EXISTS daily_closing_reports CASCADE;
        DROP TABLE IF EXISTS closing_plan_records CASCADE;
        DROP TABLE IF EXISTS stock_adjustments CASCADE;
        DROP TABLE IF EXISTS fabrication_segments CASCADE;
        DROP TABLE IF EXISTS thawing_items CASCADE;
        DROP TABLE IF EXISTS cogs_master CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS stores CASCADE;
        DROP TABLE IF EXISTS loss_config CASCADE;
      `);
      console.log('[Database] Entire database structure has been successfully deleted.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Database] Error dropping database structure:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Load persisted store from disk
  loadLocalStoreFromDisk();

  // Load Google Apps Script config
  loadAppsScriptConfig();

  // Background auto-pull timer: every 20s if Apps Script is configured
  setInterval(async () => {
    if (appsScriptConfig.url && appsScriptConfig.autoSync) {
      try {
        await pullAllFromAppsScript();
      } catch (e) {
        // silent
      }
    }
  }, 20000);

  // Remove and drop database tables if external database connection is present
  dropDatabaseTables();

  // Endpoint to explicitly drop and delete entire database structure
  app.post('/api/database/drop-structure', async (req, res) => {
    try {
      await dropDatabaseTables();
      inMemoryStore.thawingItems = [];
      inMemoryStore.fabricationSegments = [];
      inMemoryStore.stockAdjustments = [];
      inMemoryStore.closingPlanRecords = [];
      inMemoryStore.dataSusut = [];
      inMemoryStore.dailyClosingReports = [];
      persistStoreToDisk();
      res.json({ success: true, message: 'Seluruh struktur database berhasil dihapus.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error deleting database structure' });
    }
  });

  // ----------------- GOOGLE APPS SCRIPT SPREADSHEET PROXY ENDPOINTS -----------------
  app.get('/api/appscript/config', (req, res) => {
    res.json({
      configured: Boolean(appsScriptConfig.url),
      url: appsScriptConfig.url,
      autoSync: appsScriptConfig.autoSync,
      lastSync: appsScriptConfig.lastSync,
      stats: {
        stores: inMemoryStore.stores.length,
        users: inMemoryStore.users.length,
        cogs: inMemoryStore.cogsMaster.length,
        thawing: inMemoryStore.thawingItems.length,
        segments: inMemoryStore.fabricationSegments.length,
        closing: inMemoryStore.closingPlanRecords.length,
        grn: inMemoryStore.grnRecords.length,
        adjustments: inMemoryStore.stockAdjustments.length,
        reports: inMemoryStore.dailyClosingReports.length,
        susut: inMemoryStore.dataSusut.length,
      }
    });
  });

  app.post('/api/appscript/config', (req, res) => {
    try {
      const { url, autoSync } = req.body;
      saveAppsScriptConfig({
        url: typeof url === 'string' ? url.trim() : appsScriptConfig.url,
        autoSync: autoSync !== undefined ? Boolean(autoSync) : appsScriptConfig.autoSync,
      });
      res.json({ success: true, config: appsScriptConfig });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/appscript/test', async (req, res) => {
    try {
      const targetUrl = (req.body.url || appsScriptConfig.url || '').trim();
      if (!targetUrl) {
        return res.status(400).json({ error: 'URL Google Apps Script Web App wajib disertakan' });
      }

      const pingUrl = targetUrl.includes('?') ? `${targetUrl}&action=ping` : `${targetUrl}?action=ping`;
      const startTime = Date.now();
      const response = await fetch(pingUrl, { method: 'GET', redirect: 'follow' });
      const latency = Date.now() - startTime;

      if (!response.ok) {
        return res.status(502).json({
          error: `Google Spreadsheet Web App merespon status ${response.status}: ${response.statusText}`,
          latency
        });
      }

      const data = await response.json();
      saveAppsScriptConfig({ url: targetUrl });
      res.json({
        success: true,
        message: data.message || 'Koneksi ke Google Spreadsheet Berhasil & Realtime!',
        latency,
        data
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Gagal menghubungi Apps Script: ' + err.message });
    }
  });

  app.post('/api/appscript/init-sheets', async (req, res) => {
    try {
      const targetUrl = (req.body.url || appsScriptConfig.url || '').trim();
      if (!targetUrl) return res.status(400).json({ error: 'URL Apps Script belum diatur' });

      const resp = await sendToAppsScript({ action: 'initSheets' }, targetUrl);
      if (resp && resp.status === 'success') {
        saveAppsScriptConfig({ url: targetUrl });
        res.json({ success: true, message: resp.message, sheets: resp.sheets });
      } else {
        res.status(500).json({ error: resp?.message || 'Gagal inisialisasi tab di Google Sheets' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/appscript/sync-all', async (req, res) => {
    try {
      if (!appsScriptConfig.url) {
        return res.status(400).json({ error: 'URL Google Apps Script belum dikonfigurasi' });
      }

      // 1. Push all current data to Google Sheets
      const payload = {
        action: 'syncAll',
        data: {
          stores: inMemoryStore.stores,
          users: inMemoryStore.users,
          cogsMaster: inMemoryStore.cogsMaster,
          thawingItems: inMemoryStore.thawingItems,
          fabricationSegments: inMemoryStore.fabricationSegments,
          closingPlanRecords: inMemoryStore.closingPlanRecords,
          grnRecords: inMemoryStore.grnRecords,
          stockAdjustments: inMemoryStore.stockAdjustments,
          dailyClosingReports: inMemoryStore.dailyClosingReports,
          dataSusut: inMemoryStore.dataSusut,
          lossConfig: inMemoryStore.lossConfig,
        }
      };

      const pushResult = await sendToAppsScript(payload);
      if (!pushResult || pushResult.status !== 'success') {
        return res.status(502).json({ error: pushResult?.message || 'Gagal mengirim data ke Google Spreadsheet' });
      }

      res.json({
        success: true,
        message: 'Seluruh data berhasil disinkronkan ke Google Spreadsheet!',
        timestamp: appsScriptConfig.lastSync
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/appscript/pull', async (req, res) => {
    try {
      const pullResult = await pullAllFromAppsScript();
      if (pullResult.success) {
        res.json({
          success: true,
          totalRecords: pullResult.totalRecords,
          message: 'Berhasil menarik data dari Google Spreadsheet!',
          timestamp: appsScriptConfig.lastSync
        });
      } else {
        res.status(500).json({ error: pullResult.error || 'Gagal menarik data' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ----------------- HEALTH & DB STATUS -----------------
  app.get('/api/health', async (req, res) => {
    const p = getPool();
    let dbConnected = false;
    if (p) {
      try {
        const testRes = await p.query('SELECT NOW()');
        dbConnected = !!testRes;
      } catch (e) {
        dbConnected = false;
      }
    }
    res.json({
      status: 'ok',
      database: dbConnected ? 'PostgreSQL (DATABASE_URL Connected)' : 'In-Memory / Awaiting DATABASE_URL',
      isDatabaseUrlSet: !!process.env.DATABASE_URL,
    });
  });

  // ----------------- AUTH & LOGIN (Fail-safe, no brittle JOIN) -----------------
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password, pin } = req.body;
      const pass = (password || pin || '').toString().trim();
      if (!username) {
        return res.status(400).json({ error: 'Username wajib diisi' });
      }

      const clean = username.trim().toLowerCase();
      const p = getPool();

      if (p) {
        try {
          // Direct select from users table without brittle join
          const userRes = await p.query(
            `SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(REPLACE(username, '_', '')) = $2`,
            [clean, clean.replace(/[\s_-]+/g, '')]
          );

          if (userRes.rows.length > 0) {
            const user = userRes.rows[0];
            const storedPass = (user.password || '').toString().trim();
            // Validate password if provided
            if (pass && storedPass && storedPass !== pass) {
              return res.status(401).json({ error: 'Password / PIN salah.' });
            }

            const rawRole = user.role || 'admin';
            const normalizedRole = normalizeRole(rawRole);
            const fullName = user.full_name || user.fullName || user.username;
            const storeId = user.store_id || user.storeId;
            let storeName = user.store_name || user.storeName;

            // If storeName is missing and storeId is present, attempt safe store lookup
            if (!storeName && storeId) {
              try {
                const sRes = await p.query('SELECT * FROM stores WHERE id::text = $1', [storeId.toString()]);
                if (sRes.rows.length > 0) {
                  const s = sRes.rows[0];
                  storeName = s.name || s.store_name || s.nama || `TDN ${s.code || ''}`.trim();
                }
              } catch (sErr) {
                // Ignore store lookup error
              }
            }

            return res.json({
              success: true,
              user: {
                id: user.id.toString(),
                username: user.username,
                role: normalizedRole,
                dbRole: rawRole,
                fullName: fullName,
                storeId: storeId ? storeId.toString() : undefined,
                storeName: storeName || (normalizedRole === 'md' ? undefined : 'TDN CKR'),
                createdAt: user.created_at || user.createdAt || new Date().toISOString(),
              },
            });
          }
        } catch (dbErr) {
          console.error('DB query error during login, falling back:', dbErr);
        }
      }

      // Memory Fallback with Intelligent Resolver
      let user = inMemoryStore.users.find(
        (u) => u.username.toLowerCase() === clean || u.username.toLowerCase().replace(/[\s_-]+/g, '') === clean.replace(/[\s_-]+/g, '')
      );

      if (!user) {
        const isMd = clean.includes('md') || clean.includes('pusat') || clean.includes('merchandis');
        const isButcher = clean.includes('butcher') || clean.includes('jagal') || clean.includes('potong');
        const isAdmin = clean.includes('admin') || clean.includes('toko') || clean.includes('spv');

        if (isMd) {
          user = inMemoryStore.users.find((u) => u.role === 'md') || inMemoryStore.users[2];
        } else if (isButcher || isAdmin) {
          const targetRole = isButcher ? 'butcher' : 'admin';
          const partnerRole = isButcher ? 'admin' : 'butcher';
          const matchedStore = inMemoryStore.stores.find((s) => {
            const code = s.code.toLowerCase();
            const city = s.city.toLowerCase().replace(/[\s_-]+/g, '');
            const name = s.name.toLowerCase().replace(/[\s_-]+/g, '');
            return clean.includes(code) || clean.replace(/[\s_-]+/g, '').includes(code) || clean.includes(city) || clean.includes(name);
          }) || inMemoryStore.stores[0];

          if (matchedStore) {
            user = inMemoryStore.users.find((u) => u.role === targetRole && (u.storeId === matchedStore.id || (u.storeName && u.storeName.toLowerCase().includes(matchedStore.code.toLowerCase()))));
            if (!user) {
              const codeLower = matchedStore.code.toLowerCase();
              user = {
                id: `usr_${Date.now()}_${targetRole}`,
                username: `${targetRole}_${codeLower}`,
                password: `${targetRole}123`,
                role: targetRole,
                fullName: `${targetRole === 'butcher' ? 'Butcher' : 'Admin'} ${matchedStore.name}`,
                storeId: matchedStore.id,
                storeName: matchedStore.name,
                linkedAccountId: `usr_${Date.now()}_${partnerRole}`,
                createdAt: new Date().toISOString(),
              };
              inMemoryStore.users.push(user);
            }
          }
        }
      }

      if (!user) {
        return res.status(401).json({ error: `Akun '${username}' tidak ditemukan di database.` });
      }
      if (pass && user.password && user.password !== pass) {
        return res.status(401).json({ error: 'Password / PIN salah.' });
      }
      return res.json({
        success: true,
        user: {
          id: user.id.toString(),
          username: user.username,
          role: normalizeRole(user.role),
          fullName: user.fullName,
          storeId: user.storeId ? user.storeId.toString() : undefined,
          storeName: user.storeName || undefined,
          linkedAccountId: user.linkedAccountId || undefined,
          createdAt: user.createdAt,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Gagal login database: ' + err.message });
    }
  });

  // ----------------- STORES -----------------
  app.get('/api/stores', async (req, res) => {
    const p = getPool();
    if (p) {
      try {
        const result = await p.query('SELECT * FROM stores ORDER BY id ASC');
        if (result.rows.length > 0) {
          const mapped = result.rows.map((s) => ({
            id: s.id.toString(),
            code: s.code || s.store_code || s.kode || 'CKR',
            name: s.name || s.store_name || s.nama || `TDN ${s.code || 'Cabang'}`,
            city: s.city || s.kota || '',
            createdAt: s.created_at || s.createdAt || '',
          }));
          return res.json(mapped);
        }
      } catch (err) {
        console.warn('Postgres fetch stores failed, using cache:', err);
      }
    }
    res.json(inMemoryStore.stores);
  });

  app.post('/api/stores', async (req, res) => {
    try {
      const incoming = Array.isArray(req.body) ? req.body : [req.body];
      const savedStores: any[] = [];

      for (const item of incoming) {
        if (!item) continue;
        const codeUpper = (item.code || '').toUpperCase().trim();
        const codeLower = (item.code || '').toLowerCase().trim();
        const storeName = (item.name || `TDN ${codeUpper}`).trim();
        const storeCity = (item.city || '').trim();
        const createdAt = item.createdAt || new Date().toISOString().split('T')[0];

        let storeId = item.id ? item.id.toString() : (codeLower ? `store_${codeLower}` : `${inMemoryStore.stores.length + 1}`);

        const p = getPool();
        if (p) {
          try {
            const insertRes = await p.query(
              `INSERT INTO stores (code, name, city, created_at)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (code) DO UPDATE SET name = $2, city = $3
               RETURNING id`,
              [codeUpper, storeName, storeCity, createdAt]
            );
            if (insertRes.rows.length > 0) {
              storeId = insertRes.rows[0].id.toString();
            }

            const intStoreId = parseInt(storeId, 10) || 1;
            await p.query(
              `INSERT INTO users (username, password, role, full_name, store_id, store_name, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (username) DO UPDATE SET full_name = $4, store_name = $6`,
              [`butcher_${codeLower}`, item.butcherPassword || 'butcher123', 'butcher', item.butcherName || `Butcher ${codeUpper}`, intStoreId, storeName, createdAt]
            );

            await p.query(
              `INSERT INTO users (username, password, role, full_name, store_id, store_name, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (username) DO UPDATE SET full_name = $4, store_name = $6`,
              [`admin_${codeLower}`, item.adminPassword || 'admin123', 'admin_toko', item.adminName || `Admin ${codeUpper}`, intStoreId, storeName, createdAt]
            );
          } catch (dbErr) {
            console.error('Postgres insert store error:', dbErr);
          }
        }

        const newStore = { id: storeId, code: codeUpper, name: storeName, city: storeCity, createdAt };
        const existingStoreIdx = inMemoryStore.stores.findIndex((s) => s.id === storeId || (codeUpper && s.code === codeUpper));
        if (existingStoreIdx >= 0) {
          inMemoryStore.stores[existingStoreIdx] = { ...inMemoryStore.stores[existingStoreIdx], ...newStore };
        } else {
          inMemoryStore.stores.push(newStore);
        }

        const butcherUser = {
          id: `usr_b_${storeId}`,
          username: `butcher_${codeLower}`,
          password: item.butcherPassword || 'butcher123',
          role: 'butcher',
          fullName: item.butcherName || `Butcher ${codeUpper}`,
          storeId: storeId,
          storeName: storeName,
          linkedAccountId: `usr_a_${storeId}`,
          createdAt,
        };

        const adminUser = {
          id: `usr_a_${storeId}`,
          username: `admin_${codeLower}`,
          password: item.adminPassword || 'admin123',
          role: 'admin',
          fullName: item.adminName || `Admin ${codeUpper}`,
          storeId: storeId,
          storeName: storeName,
          linkedAccountId: `usr_b_${storeId}`,
          createdAt,
        };

        const bIdx = inMemoryStore.users.findIndex((u) => u.username === butcherUser.username);
        if (bIdx >= 0) inMemoryStore.users[bIdx] = { ...inMemoryStore.users[bIdx], ...butcherUser };
        else inMemoryStore.users.push(butcherUser);

        const aIdx = inMemoryStore.users.findIndex((u) => u.username === adminUser.username);
        if (aIdx >= 0) inMemoryStore.users[aIdx] = { ...inMemoryStore.users[aIdx], ...adminUser };
        else inMemoryStore.users.push(adminUser);

        savedStores.push(newStore);
      }

      res.json({ success: true, stores: inMemoryStore.stores, store: savedStores[0] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const incoming = Array.isArray(req.body) ? req.body : [req.body];
      incoming.forEach((u: any) => {
        if (!u || !u.username) return;
        const cleanUser = u.username.toLowerCase().trim();
        const idx = inMemoryStore.users.findIndex((item) => item.username.toLowerCase().trim() === cleanUser);
        const normUser = {
          ...u,
          role: normalizeRole(u.role),
          password: u.password || (normalizeRole(u.role) === 'md' ? 'md123' : `${normalizeRole(u.role)}123`),
        };
        if (idx >= 0) {
          inMemoryStore.users[idx] = { ...inMemoryStore.users[idx], ...normUser };
        } else {
          inMemoryStore.users.push(normUser);
        }
      });
      res.json({ success: true, users: inMemoryStore.users });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- USERS -----------------
  app.get('/api/users', async (req, res) => {
    const p = getPool();
    if (p) {
      try {
        const result = await p.query('SELECT * FROM users ORDER BY id ASC');
        if (result.rows.length > 0) {
          const mapped = result.rows.map((u) => ({
            id: u.id.toString(),
            username: u.username,
            password: u.password,
            role: normalizeRole(u.role),
            dbRole: u.role,
            fullName: u.full_name || u.fullName || u.username,
            storeId: u.store_id ? u.store_id.toString() : undefined,
            storeName: u.store_name || u.storeName || undefined,
            createdAt: u.created_at || u.createdAt || '',
          }));
          return res.json(mapped);
        }
      } catch (err) {
        console.warn('Postgres fetch users failed, using cache:', err);
      }
    }
    const safeUsers = inMemoryStore.users.map((u) => ({
      ...u,
      role: normalizeRole(u.role),
    }));
    res.json(safeUsers);
  });

  // ----------------- COGS MASTER -----------------
  app.get('/api/cogs', async (req, res) => {
    const p = getPool();
    if (p) {
      try {
        const result = await p.query(
          `SELECT 
             id, 
             COALESCE(item_code, '') as "itemCode", 
             COALESCE(item_name, plan_name, '') as "itemName", 
             COALESCE(plan_name, item_name, '') as "planName", 
             cogs_per_kg as "cogsPerKg", 
             COALESCE(default_price_per_kg, selling_price_per_kg, 0) as "defaultPricePerKg", 
             COALESCE(selling_price_per_kg, default_price_per_kg, 0) as "sellingPricePerKg", 
             category, 
             updated_at as "updatedAt",
             COALESCE(updated_by, 'MD Pusat') as "updatedBy"
           FROM cogs_master`
        );
        if (result.rows.length > 0) return res.json(result.rows);
      } catch (err) {
        console.warn('Postgres fetch cogs failed:', err);
      }
    }
    res.json(inMemoryStore.cogsMaster);
  });

  app.post('/api/cogs', async (req, res) => {
    try {
      const rawItems = Array.isArray(req.body) ? req.body : [req.body];
      const items = rawItems.map((item, idx) => {
        const cat = (item.category || 'DAGING FRESH').toUpperCase();
        const catCode = cat.includes('PREM') ? 'DP' : cat.includes('SHANK') ? 'SH' : cat.includes('RAWON') ? 'RW' : 'DF';
        return {
          id: item.id || `cogs_${Date.now()}_${idx}`,
          itemCode: item.itemCode || `${catCode}-${String(idx + 1).padStart(2, '0')}`,
          itemName: item.itemName || item.planName || `Bahan ${cat}`,
          planName: item.planName || item.itemName || `Bahan ${cat}`,
          cogsPerKg: Number(item.cogsPerKg) || 102000,
          defaultPricePerKg: Number(item.defaultPricePerKg || item.sellingPricePerKg) || Math.round(Number(item.cogsPerKg || 102000) * 1.25),
          sellingPricePerKg: Number(item.sellingPricePerKg || item.defaultPricePerKg) || Math.round(Number(item.cogsPerKg || 102000) * 1.25),
          category: cat,
          updatedAt: item.updatedAt || new Date().toISOString().split('T')[0],
          updatedBy: item.updatedBy || 'MD Pusat',
        };
      });

      const p = getPool();
      if (p) {
        try {
          for (const item of items) {
            await p.query(
              `INSERT INTO cogs_master (id, item_code, item_name, plan_name, cogs_per_kg, default_price_per_kg, selling_price_per_kg, category, updated_at, updated_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO UPDATE SET 
                 item_code = $2,
                 item_name = $3,
                 plan_name = $4,
                 cogs_per_kg = $5,
                 default_price_per_kg = $6,
                 selling_price_per_kg = $7,
                 category = $8,
                 updated_at = $9,
                 updated_by = $10`,
              [item.id, item.itemCode, item.itemName, item.planName, item.cogsPerKg, item.defaultPricePerKg, item.sellingPricePerKg, item.category, item.updatedAt, item.updatedBy]
            );
          }
        } catch (dbErr) {
          console.error('Postgres save cogs error:', dbErr);
        }
      }
      inMemoryStore.cogsMaster = items;
      persistStoreToDisk();
      pushTableMutationToAppsScript('Master_COGS', items);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- THAWING ITEMS -----------------
  app.get('/api/thawing-items', async (req, res) => {
    const storeId = req.query.storeId as string | undefined;
    const p = getPool();
    if (p) {
      try {
        let query = `
          SELECT id, store_id as "storeId", name, status, 
                 weight_before_thawing as "weightBeforeThawing",
                 weight_after_thawing as "weightAfterThawing",
                 shrinkage_thawing as "shrinkageThawing",
                 shrinkage_thawing_percent as "shrinkageThawingPercent",
                 thawing_start_time as "thawingStartTime",
                 thawing_end_time as "thawingEndTime",
                 duration_minutes as "durationMinutes",
                 photo_evidence as "photoEvidence",
                 image,
                 planned_fabrication as "plannedFabrication",
                 opening_purpose as "openingPurpose",
                 butcher_name as "butcherName",
                 is_carryover as "isCarryover",
                 is_transferred as "isTransferred",
                 original_purpose as "originalPurpose",
                 transfer_timestamp as "transferTimestamp",
                 created_at as "createdAt"
          FROM thawing_items
        `;
        const params: any[] = [];
        if (storeId) {
          const variants = getStoreIdVariants(storeId);
          query += ` WHERE store_id = ANY($1)`;
          params.push(variants);
        }
        query += ` ORDER BY created_at DESC`;
        const result = await p.query(query, params);
        return res.json(result.rows);
      } catch (err) {
        console.warn('Postgres fetch thawing items error:', err);
      }
    }
    const filtered = storeId
      ? inMemoryStore.thawingItems.filter((i) => matchStoreIdBackend(i.storeId, storeId))
      : inMemoryStore.thawingItems;
    res.json(filtered);
  });

  app.post('/api/thawing-items', async (req, res) => {
    try {
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const p = getPool();
      if (p) {
        try {
          for (const item of items) {
            await p.query(
              `INSERT INTO thawing_items (
                id, store_id, name, status, weight_before_thawing, weight_after_thawing,
                shrinkage_thawing, shrinkage_thawing_percent, thawing_start_time, thawing_end_time,
                duration_minutes, photo_evidence, image, planned_fabrication, opening_purpose,
                butcher_name, is_carryover, is_transferred, original_purpose, transfer_timestamp, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
              ON CONFLICT (id) DO UPDATE SET
                status = $4, weight_after_thawing = $6, shrinkage_thawing = $7, shrinkage_thawing_percent = $8,
                thawing_end_time = $10, duration_minutes = $11, photo_evidence = $12, image = $13,
                planned_fabrication = $14, opening_purpose = $15, butcher_name = $16, is_carryover = $17,
                is_transferred = $18, original_purpose = $19, transfer_timestamp = $20`,
              [
                item.id, item.storeId || '1', item.name, item.status || 'Thawing',
                item.weightBeforeThawing || 0, item.weightAfterThawing || null,
                item.shrinkageThawing || null, item.shrinkageThawingPercent || null,
                item.thawingStartTime || new Date().toISOString(), item.thawingEndTime || null,
                item.durationMinutes || 0, item.photoEvidence || null, item.image || null,
                item.plannedFabrication || null, item.openingPurpose || null,
                item.butcherName || null, !!item.isCarryover, !!item.isTransferred,
                item.originalPurpose || null, item.transferTimestamp || null,
                item.createdAt || new Date().toISOString()
              ]
            );
          }
        } catch (dbErr) {
          console.error('Postgres save thawing items error:', dbErr);
        }
      }
      const incoming = Array.isArray(req.body) ? req.body : [req.body];
      incoming.forEach((item: any) => {
        if (!item || !item.id) return;
        const idx = inMemoryStore.thawingItems.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          inMemoryStore.thawingItems[idx] = { ...inMemoryStore.thawingItems[idx], ...item };
        } else {
          inMemoryStore.thawingItems.unshift(item);
        }
      });
      persistStoreToDisk();
      pushTableMutationToAppsScript('Thawing_Daging', incoming);
      res.json({ success: true, items: inMemoryStore.thawingItems });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/thawing-items/:id', async (req, res) => {
    try {
      const p = getPool();
      if (p) {
        await p.query('DELETE FROM thawing_items WHERE id = $1', [req.params.id]);
      }
      inMemoryStore.thawingItems = inMemoryStore.thawingItems.filter((i) => i.id !== req.params.id);
      persistStoreToDisk();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- FABRICATION SEGMENTS -----------------
  app.get('/api/fabrication-segments', async (req, res) => {
    const storeId = req.query.storeId as string | undefined;
    const p = getPool();
    if (p) {
      try {
        let query = `
          SELECT id, store_id as "storeId", item_id as "itemId", item_name as "itemName",
                 segment_name as "segmentName", target_weight as "targetWeight",
                 actual_weight as "actualWeight", periodic_shrinkage as "periodicShrinkage",
                 sales_kg as "salesKg", planned_fabrication as "plannedFabrication",
                 opening_purpose as "openingPurpose", is_transferred as "isTransferred",
                 original_purpose as "originalPurpose", transfer_timestamp as "transferTimestamp",
                 created_at as "createdAt"
          FROM fabrication_segments
        `;
        const params: any[] = [];
        if (storeId) {
          const variants = getStoreIdVariants(storeId);
          query += ` WHERE store_id = ANY($1)`;
          params.push(variants);
        }
        query += ` ORDER BY created_at DESC`;
        const result = await p.query(query, params);
        return res.json(result.rows);
      } catch (err) {
        console.warn('Postgres fetch fabrication segments error:', err);
      }
    }
    const filtered = storeId
      ? inMemoryStore.fabricationSegments.filter((s) => matchStoreIdBackend(s.storeId, storeId))
      : inMemoryStore.fabricationSegments;
    res.json(filtered);
  });

  app.post('/api/fabrication-segments', async (req, res) => {
    try {
      const segments = Array.isArray(req.body) ? req.body : [req.body];
      const p = getPool();
      if (p) {
        try {
          for (const seg of segments) {
            await p.query(
              `INSERT INTO fabrication_segments (
                id, store_id, item_id, item_name, segment_name, target_weight, actual_weight,
                periodic_shrinkage, sales_kg, planned_fabrication, opening_purpose,
                is_transferred, original_purpose, transfer_timestamp, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (id) DO UPDATE SET
                actual_weight = $7, periodic_shrinkage = $8, sales_kg = $9,
                is_transferred = $12, original_purpose = $13, transfer_timestamp = $14`,
              [
                seg.id, seg.storeId || '1', seg.itemId, seg.itemName || '',
                seg.segmentName, seg.targetWeight || 0, seg.actualWeight || 0,
                seg.periodicShrinkage || 0, seg.salesKg || 0, seg.plannedFabrication || null,
                seg.openingPurpose || null, !!seg.isTransferred, seg.originalPurpose || null,
                seg.transferTimestamp || null, seg.createdAt || new Date().toISOString()
              ]
            );
          }
        } catch (dbErr) {
          console.error('Postgres save segments error:', dbErr);
        }
      }
      const incoming = Array.isArray(req.body) ? req.body : [req.body];
      incoming.forEach((seg: any) => {
        if (!seg || !seg.id) return;
        const idx = inMemoryStore.fabricationSegments.findIndex((s) => s.id === seg.id);
        if (idx >= 0) {
          inMemoryStore.fabricationSegments[idx] = { ...inMemoryStore.fabricationSegments[idx], ...seg };
        } else {
          inMemoryStore.fabricationSegments.unshift(seg);
        }
      });
      persistStoreToDisk();
      pushTableMutationToAppsScript('Pabrikasi_Segmen', incoming);
      res.json({ success: true, segments: inMemoryStore.fabricationSegments });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/fabrication-segments/:id', async (req, res) => {
    try {
      const p = getPool();
      if (p) {
        try {
          await p.query('DELETE FROM fabrication_segments WHERE id = $1', [req.params.id]);
        } catch (dbErr) {
          console.error('Postgres delete segment error:', dbErr);
        }
      }
      inMemoryStore.fabricationSegments = inMemoryStore.fabricationSegments.filter((s) => s.id !== req.params.id);
      persistStoreToDisk();
      res.json({ success: true, segments: inMemoryStore.fabricationSegments });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- STOCK ADJUSTMENTS -----------------
  app.get('/api/adjustments', async (req, res) => {
    const storeId = req.query.storeId as string | undefined;
    const p = getPool();
    if (p) {
      try {
        let query = `
          SELECT id, store_id as "storeId", plan_name as "planName", type,
                 weight_kg as "weightKg", reason, admin_name as "adminName",
                 created_at as "createdAt"
          FROM stock_adjustments
        `;
        const params: any[] = [];
        if (storeId) {
          const variants = getStoreIdVariants(storeId);
          query += ` WHERE store_id = ANY($1)`;
          params.push(variants);
        }
        query += ` ORDER BY created_at DESC`;
        const result = await p.query(query, params);
        return res.json(result.rows);
      } catch (err) {
        console.warn('Postgres fetch adjustments error:', err);
      }
    }
    const filtered = storeId ? inMemoryStore.stockAdjustments.filter((a) => matchStoreIdBackend(a.storeId, storeId)) : inMemoryStore.stockAdjustments;
    res.json(filtered);
  });

  app.post('/api/adjustments', async (req, res) => {
    try {
      const adjs = Array.isArray(req.body) ? req.body : [req.body];
      const p = getPool();
      if (p) {
        try {
          for (const a of adjs) {
            await p.query(
              `INSERT INTO stock_adjustments (id, store_id, plan_name, type, weight_kg, reason, admin_name, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO UPDATE SET weight_kg = $5, reason = $6`,
              [a.id, a.storeId || '1', a.planName, a.type, a.weightKg, a.reason, a.adminName, a.createdAt || new Date().toISOString()]
            );
          }
        } catch (dbErr) {
          console.error('Postgres save adjustments error:', dbErr);
        }
      }
      const incoming = Array.isArray(req.body) ? req.body : [req.body];
      incoming.forEach((a: any) => {
        if (!a || !a.id) return;
        const idx = inMemoryStore.stockAdjustments.findIndex((item) => item.id === a.id);
        if (idx >= 0) {
          inMemoryStore.stockAdjustments[idx] = { ...inMemoryStore.stockAdjustments[idx], ...a };
        } else {
          inMemoryStore.stockAdjustments.unshift(a);
        }
      });
      persistStoreToDisk();
      pushTableMutationToAppsScript('Koreksi_Stok_Admin', incoming);
      res.json({ success: true, adjustments: inMemoryStore.stockAdjustments });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- CLOSING RECORDS -----------------
  app.get('/api/closing-records', async (req, res) => {
    const storeId = req.query.storeId as string | undefined;
    const p = getPool();
    if (p) {
      try {
        let query = `
          SELECT id, store_id as "storeId", plan_name as "planName", date,
                 category,
                 opening_stock_kg as "openingStockKg",
                 new_processed_kg as "newProcessedKg",
                 sales_kg as "salesKg",
                 adjust_in_kg as "adjustInKg",
                 adjust_out_kg as "adjustOutKg",
                 closing_stock_by_system_kg as "closingStockBySystemKg",
                 actual_closing_stock_kg as "actualClosingStockKg",
                 susut_jual_kg as "susutJualKg",
                 photo_url as "photoUrl",
                 photo_caption as "photoCaption",
                 note,
                 butcher_name as "butcherName",
                 timestamp
          FROM closing_plan_records
        `;
        const params: any[] = [];
        if (storeId) {
          const variants = getStoreIdVariants(storeId);
          query += ` WHERE store_id = ANY($1)`;
          params.push(variants);
        }
        query += ` ORDER BY timestamp DESC`;
        const result = await p.query(query, params);
        if (result.rows.length > 0) {
          return res.json(result.rows);
        }
      } catch (err) {
        console.warn('Postgres fetch closing records error:', err);
      }
    }
    const filtered = storeId
      ? inMemoryStore.closingPlanRecords.filter((r) => matchStoreIdBackend(r.storeId, storeId))
      : inMemoryStore.closingPlanRecords;
    res.json(filtered);
  });

  app.post('/api/closing-records', async (req, res) => {
    try {
      const records = Array.isArray(req.body) ? req.body : [req.body];
      const p = getPool();
      if (p) {
        try {
          for (const r of records) {
            await p.query(
              `INSERT INTO closing_plan_records (
                id, store_id, plan_name, date, category,
                opening_stock_kg, new_processed_kg, sales_kg, adjust_in_kg, adjust_out_kg,
                closing_stock_by_system_kg, actual_closing_stock_kg, susut_jual_kg,
                photo_url, photo_caption, note, butcher_name, timestamp
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
              ON CONFLICT (id) DO UPDATE SET
                opening_stock_kg = $6, new_processed_kg = $7, sales_kg = $8,
                adjust_in_kg = $9, adjust_out_kg = $10, closing_stock_by_system_kg = $11,
                actual_closing_stock_kg = $12, susut_jual_kg = $13,
                photo_url = $14, photo_caption = $15, note = $16, butcher_name = $17, timestamp = $18`,
              [
                r.id || `cpr_${Date.now()}`,
                r.storeId || '1',
                r.planName || '',
                r.date || new Date().toISOString().split('T')[0],
                r.category || 'DAGING FRESH',
                Number(r.openingStockKg) || 0,
                Number(r.newProcessedKg) || 0,
                Number(r.salesKg) || 0,
                Number(r.adjustInKg) || 0,
                Number(r.adjustOutKg) || 0,
                Number(r.closingStockBySystemKg) || 0,
                Number(r.actualClosingStockKg) || 0,
                Number(r.susutJualKg) || 0,
                r.photoUrl || null,
                r.photoCaption || null,
                r.note || '',
                r.butcherName || 'Butcher',
                r.timestamp || new Date().toISOString()
              ]
            );
          }
        } catch (dbErr) {
          console.error('Postgres save closing records error:', dbErr);
        }
      }
      
      const incomingList = Array.isArray(req.body) ? req.body : [req.body];
      incomingList.forEach((r: any) => {
        if (!r) return;
        // Strictly match by ID to ensure multiple records with identical names and amounts are preserved
        const idx = inMemoryStore.closingPlanRecords.findIndex((item: any) => Boolean(r.id && item.id && item.id === r.id));
        if (idx >= 0) {
          inMemoryStore.closingPlanRecords[idx] = { ...inMemoryStore.closingPlanRecords[idx], ...r };
        } else {
          inMemoryStore.closingPlanRecords.unshift(r);
        }
      });
      persistStoreToDisk();
      pushTableMutationToAppsScript('Closing_Harian', incomingList);
      res.json({ success: true, records: inMemoryStore.closingPlanRecords });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/closing-records/:id', async (req, res) => {
    try {
      const p = getPool();
      if (p) {
        try {
          await p.query('DELETE FROM closing_plan_records WHERE id = $1', [req.params.id]);
        } catch (dbErr) {
          console.error('Postgres delete closing record error:', dbErr);
        }
      }
      inMemoryStore.closingPlanRecords = inMemoryStore.closingPlanRecords.filter((r) => r.id !== req.params.id);
      persistStoreToDisk();
      res.json({ success: true, records: inMemoryStore.closingPlanRecords });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- GRN (GOODS RECEIVED NOTE) -----------------
  app.get('/api/grn', (req, res) => {
    try {
      const storeId = req.query.storeId as string | undefined;
      const date = req.query.date as string | undefined;
      let list = inMemoryStore.grnRecords;
      if (storeId) {
        list = list.filter((r: any) => matchStoreIdBackend(r.storeId, storeId));
      }
      if (date) {
        list = list.filter((r: any) => (r.date || '').split('T')[0] === date.split('T')[0]);
      }
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/grn', (req, res) => {
    try {
      const incoming = Array.isArray(req.body) ? req.body : [req.body];
      incoming.forEach((item: any) => {
        if (!item) return;
        const record = {
          id: item.id || `grn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          storeId: item.storeId || '1',
          date: item.date || new Date().toISOString().split('T')[0],
          reportCategory: item.reportCategory || 'KENTANG_SOSIS_DORI',
          subCategory: item.subCategory || 'SOSIS & KENTANG',
          itemCode: item.itemCode || '',
          plu: item.plu || '',
          productName: item.productName || item.name || '',
          weightKg: Number(item.weightKg) || 0,
          supplier: item.supplier || '',
          noSuratJalan: item.noSuratJalan || '',
          receivedBy: item.receivedBy || 'Petugas Butcher',
          createdAt: item.createdAt || new Date().toISOString(),
        };

        // Strictly match by ID to ensure separate delivery receipts with same product name and amount are preserved
        const existingIdx = inMemoryStore.grnRecords.findIndex((r: any) => Boolean(record.id && r.id && r.id === record.id));

        if (existingIdx >= 0) {
          inMemoryStore.grnRecords[existingIdx] = { ...inMemoryStore.grnRecords[existingIdx], ...record };
        } else {
          inMemoryStore.grnRecords.unshift(record);
        }
      });

      persistStoreToDisk();
      pushTableMutationToAppsScript('Penerimaan_GRN', incoming);
      res.json({ success: true, records: inMemoryStore.grnRecords });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/grn/:id', (req, res) => {
    try {
      inMemoryStore.grnRecords = inMemoryStore.grnRecords.filter((r: any) => r.id !== req.params.id);
      persistStoreToDisk();
      res.json({ success: true, records: inMemoryStore.grnRecords });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- DATA SUSUT (SHEET 8) -----------------
  app.get('/api/data-susut', async (req, res) => {
    const storeId = req.query.storeId as string | undefined;
    const date = req.query.date as string | undefined;
    const p = getPool();
    if (p) {
      try {
        let query = `
          SELECT id, date, store_name as "storeName", store_id as "storeId",
                 plan_name as "planName", susut_proses as "susutProses",
                 susut_jual as "susutJual", created_at as "createdAt"
          FROM data_susut
        `;
        const params: any[] = [];
        const conds: string[] = [];
        if (storeId) {
          const variants = getStoreIdVariants(storeId);
          conds.push(`store_id = ANY($${params.length + 1})`);
          params.push(variants);
        }
        if (date) {
          conds.push(`date = $${params.length + 1}`);
          params.push(date);
        }
        if (conds.length > 0) {
          query += ` WHERE ` + conds.join(' AND ');
        }
        query += ` ORDER BY date DESC, created_at DESC`;
        const result = await p.query(query, params);
        if (result.rows.length > 0) {
          return res.json(result.rows);
        }
      } catch (err) {
        console.warn('Postgres fetch data susut error:', err);
      }
    }
    let filtered = inMemoryStore.dataSusut;
    if (storeId) {
      filtered = filtered.filter((s) => matchStoreIdBackend(s.storeId, storeId));
    }
    if (date) {
      filtered = filtered.filter((s) => !s.date || s.date === date);
    }
    res.json(filtered);
  });

  app.post('/api/data-susut', async (req, res) => {
    try {
      const records = Array.isArray(req.body) ? req.body : [req.body];
      const p = getPool();
      if (p) {
        try {
          for (const s of records) {
            await p.query(
              `INSERT INTO data_susut (id, date, store_name, store_id, plan_name, susut_proses, susut_jual, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO UPDATE SET
                 date = $2, store_name = $3, store_id = $4, plan_name = $5,
                 susut_proses = $6, susut_jual = $7`,
              [
                s.id || `susut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                s.date || new Date().toISOString().split('T')[0],
                s.storeName || 'TDN CKR',
                s.storeId || '1',
                s.planName || '',
                Number(s.susutProses) || 0,
                Number(s.susutJual) || 0,
                s.createdAt || new Date().toISOString()
              ]
            );
          }
        } catch (dbErr) {
          console.error('Postgres save data susut error:', dbErr);
        }
      }

      records.forEach((s: any) => {
        if (!s) return;
        const idx = inMemoryStore.dataSusut.findIndex((item: any) => item.id === s.id);
        if (idx >= 0) {
          inMemoryStore.dataSusut[idx] = { ...inMemoryStore.dataSusut[idx], ...s };
        } else {
          inMemoryStore.dataSusut.unshift(s);
        }
      });

      persistStoreToDisk();
      pushTableMutationToAppsScript('Data_Susut', records);
      res.json({ success: true, dataSusut: inMemoryStore.dataSusut });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/purge-date', async (req, res) => {
    try {
      const targetDate = req.query.date as string;
      if (!targetDate) {
        return res.status(400).json({ error: 'Parameter date is required' });
      }
      inMemoryStore.closingPlanRecords = inMemoryStore.closingPlanRecords.filter(
        (r) => (r.date || r.timestamp || '').split('T')[0] !== targetDate
      );
      inMemoryStore.thawingItems = inMemoryStore.thawingItems.filter(
        (i) => (i.createdAt || i.thawingStartTime || '').split('T')[0] !== targetDate
      );
      inMemoryStore.fabricationSegments = inMemoryStore.fabricationSegments.filter(
        (s) => (s.createdAt || s.transferTimestamp || '').split('T')[0] !== targetDate
      );
      inMemoryStore.stockAdjustments = inMemoryStore.stockAdjustments.filter(
        (a) => (a.createdAt || a.date || '').split('T')[0] !== targetDate
      );
      inMemoryStore.dailyClosingReports = inMemoryStore.dailyClosingReports.filter(
        (r) => (r.date || '').split('T')[0] !== targetDate
      );
      inMemoryStore.dataSusut = inMemoryStore.dataSusut.filter(
        (s) => (s.date || s.createdAt || '').split('T')[0] !== targetDate
      );
      persistStoreToDisk();

      const p = getPool();
      if (p) {
        try {
          await p.query('DELETE FROM closing_plan_records WHERE date = $1 OR timestamp LIKE $2', [targetDate, `${targetDate}%`]);
          await p.query('DELETE FROM thawing_items WHERE created_at LIKE $1 OR thawing_start_time LIKE $2', [`${targetDate}%`, `${targetDate}%`]);
          await p.query('DELETE FROM fabrication_segments WHERE created_at LIKE $1', [`${targetDate}%`]);
          await p.query('DELETE FROM stock_adjustments WHERE created_at LIKE $1', [`${targetDate}%`]);
          await p.query('DELETE FROM daily_closing_reports WHERE date = $1', [targetDate]);
          await p.query('DELETE FROM data_susut WHERE date = $1', [targetDate]);
        } catch (dbErr) {
          console.error('Postgres purge date error:', dbErr);
        }
      }
      res.json({ success: true, purgedDate: targetDate });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/purge-all-data', async (req, res) => {
    try {
      inMemoryStore.closingPlanRecords = [];
      inMemoryStore.thawingItems = [];
      inMemoryStore.fabricationSegments = [];
      inMemoryStore.stockAdjustments = [];
      inMemoryStore.dailyClosingReports = [];
      inMemoryStore.dataSusut = [];
      persistStoreToDisk();

      const p = getPool();
      if (p) {
        try {
          await p.query('TRUNCATE TABLE closing_plan_records, thawing_items, fabrication_segments, stock_adjustments, daily_closing_reports, data_susut');
        } catch (dbErr) {
          console.error('Postgres purge all error:', dbErr);
        }
      }
      res.json({ success: true, message: 'Semua data transaksi terinput dan dummy berhasil dibersihkan.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- DAILY CLOSING REPORTS -----------------
  app.get('/api/reports', async (req, res) => {
    const storeId = req.query.storeId as string | undefined;
    const p = getPool();
    if (p) {
      try {
        let query = `
          SELECT id, store_id as "storeId", store_name as "storeName", date,
                 total_weight_raw as "totalWeightRaw",
                 total_weight_after_thawing as "totalWeightAfterThawing",
                 total_weight_fabricated as "totalWeightFabricated",
                 total_periodic_shrinkage as "totalPeriodicShrinkage",
                 total_sales as "totalSales",
                 total_end_stock as "totalEndStock",
                 thawing_loss_percent as "thawingLossPercent",
                 fabrication_loss_percent as "fabricationLossPercent",
                 sales_loss_percent as "salesLossPercent",
                 overall_loss_percent as "overallLossPercent",
                 status_alert as "statusAlert",
                 closing_photo_url as "closingPhotoUrl",
                 butcher_name as "butcherName",
                 created_at as "createdAt",
                 report_data as "reportData"
          FROM daily_closing_reports
        `;
        const params: any[] = [];
        if (storeId) {
          const variants = getStoreIdVariants(storeId);
          query += ` WHERE store_id = ANY($1)`;
          params.push(variants);
        }
        query += ` ORDER BY date DESC, created_at DESC`;
        const result = await p.query(query, params);
        const mapped = result.rows.map((row: any) => {
          if (row.reportData) {
            try {
              const parsed = typeof row.reportData === 'string' ? JSON.parse(row.reportData) : row.reportData;
              return { ...row, ...parsed };
            } catch {
              return row;
            }
          }
          return row;
        });
        return res.json(mapped);
      } catch (err) {
        console.warn('Postgres fetch reports error:', err);
      }
    }
    const filtered = storeId
      ? inMemoryStore.dailyClosingReports.filter((r) => matchStoreIdBackend(r.storeId, storeId))
      : inMemoryStore.dailyClosingReports;
    res.json(filtered);
  });

  app.post('/api/reports', async (req, res) => {
    try {
      const reports = Array.isArray(req.body) ? req.body : [req.body];
      const p = getPool();
      if (p) {
        try {
          for (const r of reports) {
            await p.query(
              `INSERT INTO daily_closing_reports (
                id, store_id, store_name, date, total_weight_raw, total_weight_after_thawing,
                total_weight_fabricated, total_periodic_shrinkage, total_sales, total_end_stock,
                thawing_loss_percent, fabrication_loss_percent, sales_loss_percent,
                overall_loss_percent, status_alert, closing_photo_url, butcher_name, created_at, report_data
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
              ON CONFLICT (id) DO UPDATE SET
                total_sales = $9, total_end_stock = $10, overall_loss_percent = $14, status_alert = $15, report_data = $19`,
              [
                r.id, r.storeId || '1', r.storeName || 'TDN CKR', r.date,
                r.totalWeightRaw || r.totalWeightBeforeThawing || 0, r.totalWeightAfterThawing || 0,
                r.totalWeightFabricated || r.totalWeightAfterFabrication || 0, r.totalPeriodicShrinkage || r.totalProcessLoss || 0,
                r.totalSales || r.totalSalesKg || 0, r.totalEndStock || r.currentClosingStockKg || 0,
                r.thawingLossPercent || r.totalThawingLoss || 0, r.fabricationLossPercent || r.totalFabricationLoss || 0,
                r.salesLossPercent || 0, r.overallLossPercent || 0,
                r.statusAlert || 'Normal', r.closingPhotoUrl || null,
                r.butcherName || r.butcherInCharge || 'Butcher', r.createdAt || r.closedAt || new Date().toISOString(),
                JSON.stringify(r)
              ]
            );
          }
        } catch (dbErr) {
          console.error('Postgres save reports error:', dbErr);
        }
      }
      const incoming = Array.isArray(req.body) ? req.body : [req.body];
      incoming.forEach((r: any) => {
        if (!r || !r.id) return;
        const idx = inMemoryStore.dailyClosingReports.findIndex((item) => item.id === r.id);
        if (idx >= 0) {
          inMemoryStore.dailyClosingReports[idx] = { ...inMemoryStore.dailyClosingReports[idx], ...r };
        } else {
          inMemoryStore.dailyClosingReports.unshift(r);
        }
      });
      persistStoreToDisk();
      pushTableMutationToAppsScript('Laporan_Harian_Rekap', incoming);
      res.json({ success: true, reports: inMemoryStore.dailyClosingReports });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/reports/:id', async (req, res) => {
    try {
      const p = getPool();
      if (p) {
        try {
          await p.query('DELETE FROM daily_closing_reports WHERE id = $1', [req.params.id]);
        } catch (dbErr) {
          console.error('Postgres delete report error:', dbErr);
        }
      }
      inMemoryStore.dailyClosingReports = inMemoryStore.dailyClosingReports.filter((r) => r.id !== req.params.id);
      persistStoreToDisk();
      res.json({ success: true, reports: inMemoryStore.dailyClosingReports });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- TRAINING FILES API -----------------
  app.get('/api/training-files', (req, res) => {
    res.json({ success: true, files: inMemoryStore.trainingFiles });
  });

  app.post('/api/training-files', (req, res) => {
    try {
      if (Array.isArray(req.body)) {
        inMemoryStore.trainingFiles = req.body;
      } else {
        const f = req.body;
        const idx = inMemoryStore.trainingFiles.findIndex((item) => item.id === f.id);
        if (idx >= 0) {
          inMemoryStore.trainingFiles[idx] = { ...inMemoryStore.trainingFiles[idx], ...f };
        } else {
          inMemoryStore.trainingFiles.unshift(f);
        }
      }
      persistStoreToDisk();
      res.json({ success: true, files: inMemoryStore.trainingFiles });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/training-files/:id', (req, res) => {
    try {
      inMemoryStore.trainingFiles = inMemoryStore.trainingFiles.filter((f) => f.id !== req.params.id);
      persistStoreToDisk();
      res.json({ success: true, files: inMemoryStore.trainingFiles });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- DAILY TARGETS API -----------------
  app.get('/api/daily-targets', (req, res) => {
    res.json({ success: true, configs: inMemoryStore.dailyTargets });
  });

  app.post('/api/daily-targets', (req, res) => {
    try {
      if (Array.isArray(req.body)) {
        inMemoryStore.dailyTargets = req.body;
      } else {
        const c = req.body;
        const idx = inMemoryStore.dailyTargets.findIndex((item) => item.id === c.id);
        if (idx >= 0) {
          inMemoryStore.dailyTargets[idx] = { ...inMemoryStore.dailyTargets[idx], ...c };
        } else {
          inMemoryStore.dailyTargets.push(c);
        }
      }
      persistStoreToDisk();
      res.json({ success: true, configs: inMemoryStore.dailyTargets });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- SALES PREDICTION TRAINING DATASET API -----------------
  app.get('/api/sales-training-dataset', (req, res) => {
    const storeId = req.query.storeId as string;
    let records = inMemoryStore.salesTrainingDataset;
    if (storeId) {
      records = records.filter((r: any) => matchStoreIdBackend(r.storeId, storeId));
    }
    res.json({ success: true, dataset: records });
  });

  app.post('/api/sales-training-dataset', (req, res) => {
    try {
      if (Array.isArray(req.body)) {
        inMemoryStore.salesTrainingDataset = req.body;
      } else {
        const item = req.body;
        const idx = inMemoryStore.salesTrainingDataset.findIndex((r: any) => r.id === item.id);
        if (idx >= 0) {
          inMemoryStore.salesTrainingDataset[idx] = { ...inMemoryStore.salesTrainingDataset[idx], ...item };
        } else {
          inMemoryStore.salesTrainingDataset.unshift(item);
        }
      }
      persistStoreToDisk();
      res.json({ success: true, dataset: inMemoryStore.salesTrainingDataset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/sales-training-dataset/:id', (req, res) => {
    try {
      inMemoryStore.salesTrainingDataset = inMemoryStore.salesTrainingDataset.filter(
        (r: any) => r.id !== req.params.id
      );
      persistStoreToDisk();
      res.json({ success: true, dataset: inMemoryStore.salesTrainingDataset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/sales-training-dataset', (req, res) => {
    try {
      const storeId = req.query.storeId as string;
      if (storeId) {
        inMemoryStore.salesTrainingDataset = inMemoryStore.salesTrainingDataset.filter(
          (r: any) => !matchStoreIdBackend(r.storeId, storeId)
        );
      } else {
        inMemoryStore.salesTrainingDataset = [];
      }
      persistStoreToDisk();
      res.json({ success: true, dataset: inMemoryStore.salesTrainingDataset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- SALES PREDICTION MODEL CONFIG API -----------------
  app.get('/api/sales-prediction-config', (req, res) => {
    const storeId = (req.query.storeId as string) || '1';
    const cfg = inMemoryStore.salesPredictionConfigs[storeId] || {
      storeId,
      customBaselineKg: 35.0,
      weekendMultiplier: 1.35,
      paydayMultiplier: 1.25,
      fridayMultiplier: 1.15,
      algorithmMode: 'hybrid_ml',
    };
    res.json({ success: true, config: cfg });
  });

  app.post('/api/sales-prediction-config', (req, res) => {
    try {
      const cfg = req.body;
      const storeId = cfg.storeId || '1';
      inMemoryStore.salesPredictionConfigs[storeId] = {
        ...inMemoryStore.salesPredictionConfigs[storeId],
        ...cfg,
        updatedAt: new Date().toISOString(),
      };
      res.json({ success: true, config: inMemoryStore.salesPredictionConfigs[storeId] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- PYTHON TRAINED ML MODELS API (.pkl, .joblib, dll) -----------------
  app.get('/api/python-models', (req, res) => {
    const storeId = req.query.storeId as string;
    if (storeId) {
      const filtered = inMemoryStore.pythonModels.filter((m: any) => !m.storeId || String(m.storeId) === String(storeId));
      return res.json(filtered);
    }
    res.json(inMemoryStore.pythonModels);
  });

  app.post('/api/python-models', (req, res) => {
    try {
      const incoming = req.body;
      if (Array.isArray(incoming)) {
        // Merge or replace
        const incomingIds = new Set(incoming.map((m: any) => m.id));
        inMemoryStore.pythonModels = [
          ...inMemoryStore.pythonModels.filter((m: any) => !incomingIds.has(m.id)),
          ...incoming,
        ];
      } else if (incoming && incoming.id) {
        const idx = inMemoryStore.pythonModels.findIndex((m: any) => m.id === incoming.id);
        if (idx >= 0) {
          inMemoryStore.pythonModels[idx] = { ...inMemoryStore.pythonModels[idx], ...incoming };
        } else {
          inMemoryStore.pythonModels.push(incoming);
        }
      }
      res.json({ success: true, models: inMemoryStore.pythonModels });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/python-models/:id', (req, res) => {
    try {
      const id = req.params.id;
      inMemoryStore.pythonModels = inMemoryStore.pythonModels.filter((m: any) => m.id !== id);
      res.json({ success: true, models: inMemoryStore.pythonModels });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- DATABASE RESET -----------------
  app.post('/api/database/reset', async (req, res) => {
    try {
      const p = getPool();
      if (p) {
        await p.query('TRUNCATE TABLE thawing_items, fabrication_segments, stock_adjustments, closing_plan_records, daily_closing_reports, data_susut');
      }
      inMemoryStore.thawingItems = [];
      inMemoryStore.fabricationSegments = [];
      inMemoryStore.stockAdjustments = [];
      inMemoryStore.closingPlanRecords = [];
      inMemoryStore.grnRecords = [];
      inMemoryStore.dailyClosingReports = [];
      inMemoryStore.dataSusut = [];
      inMemoryStore.trainingFiles = [];
      inMemoryStore.dailyTargets = [];
      inMemoryStore.salesTrainingDataset = [];
      inMemoryStore.pythonModels = [];

      res.json({
        success: true,
        message: 'Database transaksi berhasil dikosongkan. Master_COGS, Pengguna, dan Toko_Cabang tetap aman terjaga.'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- VITE MIDDLEWARE / STATIC ASSETS -----------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meat Tracker Database & Web Server running on port ${PORT}`);
  });
}

startServer();
