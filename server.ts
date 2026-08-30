import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Initialize PostgreSQL Connection Pool using DATABASE_URL
let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
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
    { id: '1', code: 'CKR', name: 'TDN CKR', city: 'Cikarang', createdAt: '2026-01-01' }
  ],
  users: [
    { id: '1', username: 'butcher_ckr', password: 'butcher123', role: 'butcher', storeId: '1', storeName: 'TDN CKR', fullName: 'Butcher CKR', createdAt: '2026-01-01' },
    { id: '2', username: 'admin_ckr', password: 'admin123', role: 'admin', storeId: '1', storeName: 'TDN CKR', fullName: 'Admin CKR', createdAt: '2026-01-01' },
    { id: '3', username: 'md_pusat', password: 'md123', role: 'md', storeId: null, storeName: null, fullName: 'MD Pusat', createdAt: '2026-01-01' },
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
  dailyClosingReports: [] as any[],
  lossConfig: {
    maxProcessLossPercent: 1.0,
    maxSalesLossPercent: 1.0,
    maxDailyLossPercent: 2.0,
    safeThawingLossPercent: 1.0,
    safeFabricationLossPercent: 1.0,
    salesPredictionKg: 40.0,
  }
};

// Database Schema Initializer for PostgreSQL (DATABASE_URL)
async function initDatabaseTables() {
  const p = getPool();
  if (!p) {
    console.log('DATABASE_URL is not set yet. Running with active memory engine.');
    return;
  }

  try {
    const client = await p.connect();
    try {
      console.log('Connecting to PostgreSQL via DATABASE_URL and verifying tables & columns...');

      await client.query(`
        CREATE TABLE IF NOT EXISTS stores (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) NOT NULL,
          name VARCHAR(100) NOT NULL,
          city VARCHAR(100) DEFAULT '',
          created_at TEXT DEFAULT ''
        );

        -- Ensure columns exist if stores table was created previously with different columns
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS code VARCHAR(50);
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS name VARCHAR(100);
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT '';
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT '';

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          store_id INTEGER,
          store_name VARCHAR(100),
          created_at TEXT DEFAULT ''
        );

        -- Ensure columns exist in users table
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id INTEGER;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS store_name VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT '';

        CREATE TABLE IF NOT EXISTS cogs_master (
          id TEXT PRIMARY KEY,
          item_code TEXT,
          item_name TEXT,
          plan_name TEXT,
          cogs_per_kg REAL NOT NULL,
          default_price_per_kg REAL DEFAULT 0,
          selling_price_per_kg REAL DEFAULT 0,
          category TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          updated_by TEXT DEFAULT 'MD Pusat'
        );

        ALTER TABLE cogs_master ADD COLUMN IF NOT EXISTS item_code TEXT;
        ALTER TABLE cogs_master ADD COLUMN IF NOT EXISTS item_name TEXT;
        ALTER TABLE cogs_master ADD COLUMN IF NOT EXISTS default_price_per_kg REAL DEFAULT 0;
        ALTER TABLE cogs_master ADD COLUMN IF NOT EXISTS updated_by TEXT DEFAULT 'MD Pusat';

        CREATE TABLE IF NOT EXISTS thawing_items (
          id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          weight_before_thawing REAL NOT NULL,
          weight_after_thawing REAL,
          shrinkage_thawing REAL,
          shrinkage_thawing_percent REAL,
          thawing_start_time TEXT NOT NULL,
          thawing_end_time TEXT,
          duration_minutes INTEGER DEFAULT 0,
          photo_evidence TEXT,
          image TEXT,
          planned_fabrication TEXT,
          opening_purpose TEXT,
          butcher_name TEXT,
          is_carryover BOOLEAN DEFAULT FALSE,
          is_transferred BOOLEAN DEFAULT FALSE,
          original_purpose TEXT,
          transfer_timestamp TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS fabrication_segments (
          id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          segment_name TEXT NOT NULL,
          target_weight REAL NOT NULL,
          actual_weight REAL NOT NULL,
          periodic_shrinkage REAL DEFAULT 0,
          sales_kg REAL DEFAULT 0,
          planned_fabrication TEXT,
          opening_purpose TEXT,
          is_transferred BOOLEAN DEFAULT FALSE,
          original_purpose TEXT,
          transfer_timestamp TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS stock_adjustments (
          id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          plan_name TEXT NOT NULL,
          type TEXT NOT NULL,
          weight_kg REAL NOT NULL,
          reason TEXT NOT NULL,
          admin_name TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS closing_plan_records (
          id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          plan_name TEXT NOT NULL,
          date TEXT NOT NULL,
          category TEXT DEFAULT '',
          opening_stock_kg REAL DEFAULT 0,
          new_processed_kg REAL DEFAULT 0,
          sales_kg REAL DEFAULT 0,
          adjust_in_kg REAL DEFAULT 0,
          adjust_out_kg REAL DEFAULT 0,
          closing_stock_by_system_kg REAL DEFAULT 0,
          actual_closing_stock_kg REAL DEFAULT 0,
          susut_jual_kg REAL DEFAULT 0,
          photo_url TEXT,
          photo_caption TEXT,
          note TEXT,
          butcher_name TEXT,
          timestamp TEXT NOT NULL
        );

        -- Ensure modern columns exist in closing_plan_records table
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS opening_stock_kg REAL DEFAULT 0;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS new_processed_kg REAL DEFAULT 0;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS sales_kg REAL DEFAULT 0;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS adjust_in_kg REAL DEFAULT 0;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS adjust_out_kg REAL DEFAULT 0;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS closing_stock_by_system_kg REAL DEFAULT 0;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS actual_closing_stock_kg REAL DEFAULT 0;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS susut_jual_kg REAL DEFAULT 0;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS photo_url TEXT;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS photo_caption TEXT;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS note TEXT;
        ALTER TABLE closing_plan_records ADD COLUMN IF NOT EXISTS butcher_name TEXT;

        CREATE TABLE IF NOT EXISTS daily_closing_reports (
          id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          store_name TEXT NOT NULL,
          date TEXT NOT NULL,
          total_weight_raw REAL NOT NULL,
          total_weight_after_thawing REAL NOT NULL,
          total_weight_fabricated REAL NOT NULL,
          total_periodic_shrinkage REAL NOT NULL,
          total_sales REAL NOT NULL,
          total_end_stock REAL NOT NULL,
          thawing_loss_percent REAL NOT NULL,
          fabrication_loss_percent REAL NOT NULL,
          sales_loss_percent REAL NOT NULL,
          overall_loss_percent REAL NOT NULL,
          status_alert TEXT NOT NULL,
          closing_photo_url TEXT,
          butcher_name TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS loss_config (
          id TEXT PRIMARY KEY,
          max_process_loss_percent REAL NOT NULL,
          max_sales_loss_percent REAL NOT NULL,
          max_daily_loss_percent REAL NOT NULL,
          safe_thawing_loss_percent REAL NOT NULL,
          safe_fabrication_loss_percent REAL NOT NULL,
          sales_prediction_kg REAL NOT NULL
        );
      `);

      // Seed CKR store if empty
      const storeCount = await client.query('SELECT COUNT(*) FROM stores');
      if (parseInt(storeCount.rows[0].count, 10) === 0) {
        console.log('Seeding initial TDN CKR store and accounts to PostgreSQL...');
        const newStore = await client.query(
          `INSERT INTO stores (code, name, city, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
          ['CKR', 'TDN CKR', 'Cikarang', '2026-01-01']
        );
        const storeId = newStore.rows[0].id;
        await client.query(
          `INSERT INTO users (username, password, role, full_name, store_id, store_name, created_at) VALUES 
           ($1, $2, $3, $4, $5, $6, $7),
           ($8, $9, $10, $11, $12, $13, $14),
           ($15, $16, $17, $18, $19, $20, $21)
           ON CONFLICT (username) DO NOTHING`,
          [
            'butcher_ckr', 'butcher123', 'butcher', 'Butcher CKR', storeId, 'TDN CKR', '2026-01-01',
            'admin_ckr', 'admin123', 'admin_toko', 'Admin CKR', storeId, 'TDN CKR', '2026-01-01',
            'md_pusat', 'md123', 'md_pusat', 'MD Pusat', null, null, '2026-01-01'
          ]
        );
      }

      // Seed COGS if empty
      const cogsCount = await client.query('SELECT COUNT(*) FROM cogs_master');
      if (parseInt(cogsCount.rows[0].count, 10) === 0) {
        for (const c of inMemoryStore.cogsMaster) {
          await client.query(
            `INSERT INTO cogs_master (id, item_code, item_name, plan_name, cogs_per_kg, default_price_per_kg, selling_price_per_kg, category, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
            [c.id, c.itemCode, c.itemName, c.planName, c.cogsPerKg, c.defaultPricePerKg, c.sellingPricePerKg, c.category, c.updatedAt, c.updatedBy]
          );
        }
      }

      console.log('PostgreSQL database verified and ready via DATABASE_URL.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error initializing PostgreSQL tables:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize DB tables asynchronously
  initDatabaseTables();

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

      // Memory Fallback
      const user = inMemoryStore.users.find(
        (u) => u.username.toLowerCase() === clean || u.username.toLowerCase().replace(/[\s_-]+/g, '') === clean.replace(/[\s_-]+/g, '')
      );
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
          createdAt: user.createdAt,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Gagal login database: ' + err.message });
    }
  });

  // ----------------- GOOGLE SHEETS BACKEND DATABASE SYNC HELPER -----------------
  const formatDateTime = (val?: string | null) => {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const pad = (n: number) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      const secs = pad(d.getSeconds());
      return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
    } catch {
      return String(val);
    }
  };

  const sanitizeItemForSheets = (table: string, item: any) => {
    const clean = { ...item };
    
    // Remove large base64 image strings to prevent Google Sheets 50,000 character cell limit truncation
    ['image', 'photoUrl', 'photoEvidence', 'closingPhotoUrl', 'photoDisplayUrl', 'photoPesananUrl'].forEach((k) => {
      if (typeof clean[k] === 'string' && (clean[k].startsWith('data:image') || clean[k].length > 200)) {
        clean[k] = clean[k].startsWith('data:image') ? 'Foto Kamera Terlampir' : clean[k].substring(0, 200);
      }
    });

    if (table === 'Thawing_Daging') {
      const startT = clean.thawingStartTime || clean.createdAt || new Date().toISOString();
      const endT = clean.thawingEndTime || (clean.status === 'pabrikasi_ready' || clean.status === 'pabrikasi_done' ? new Date().toISOString() : '');
      const durMinutes = clean.durationMinutes || (startT && endT ? Math.round((new Date(endT).getTime() - new Date(startT).getTime()) / 60000) : '');

      return {
        id: clean.id || `meat_${Date.now()}`,
        storeId: clean.storeId || 'store_ckr',
        name: clean.name || '',
        pabrikasiCategory: clean.pabrikasiCategory || 'DAGING FRESH',
        plannedFabrication: clean.plannedFabrication || clean.name || '',
        openingPurpose: clean.openingPurpose || 'UNTUK DISPLAY',
        status: clean.status || 'thawing',
        weightBeforeThawing: Number(clean.weightBeforeThawing) || 0,
        weightAfterThawing: clean.weightAfterThawing !== undefined && clean.weightAfterThawing !== null && clean.weightAfterThawing !== '' ? Number(clean.weightAfterThawing) : '',
        shrinkageThawing: clean.shrinkageThawing !== undefined && clean.shrinkageThawing !== null && clean.shrinkageThawing !== '' ? Number(clean.shrinkageThawing) : '',
        shrinkageThawingPercent: clean.shrinkageThawingPercent !== undefined && clean.shrinkageThawingPercent !== null && clean.shrinkageThawingPercent !== '' ? Number(clean.shrinkageThawingPercent) : '',
        susutJualKg: Number(clean.susutJualKg) || 0,
        salesKg: Number(clean.salesKg) || 0,
        thawingStartTime: formatDateTime(startT),
        thawingEndTime: endT ? formatDateTime(endT) : '',
        durationMinutes: durMinutes || '',
        butcherName: clean.butcherName || 'Butcher TDN Cikarang',
        isCarryover: clean.isCarryover ? 'YA' : 'TIDAK',
        image: clean.image || 'Foto Kamera Terlampir',
        createdAt: formatDateTime(clean.createdAt || startT),
      };
    }

    if (table === 'Pabrikasi_Segmen') {
      return {
        id: clean.id || `seg_${Date.now()}`,
        storeId: clean.storeId || 'store_ckr',
        itemId: clean.itemId || '',
        itemName: clean.itemName || '',
        segmentName: clean.segmentName || '',
        targetWeight: Number(clean.targetWeight) || 0,
        actualWeight: Number(clean.actualWeight) || 0,
        periodicShrinkage: Number(clean.periodicShrinkage) || 0,
        salesKg: Number(clean.salesKg) || 0,
        plannedFabrication: clean.plannedFabrication || '',
        openingPurpose: clean.openingPurpose || 'UNTUK DISPLAY',
        isTransferred: clean.isTransferred ? 'YA' : 'TIDAK',
        originalPurpose: clean.originalPurpose || '',
        transferTimestamp: clean.transferTimestamp ? formatDateTime(clean.transferTimestamp) : '',
        createdAt: formatDateTime(clean.createdAt || new Date().toISOString()),
      };
    }

    if (table === 'Closing_Fisik') {
      return {
        id: clean.id || `close_${Date.now()}`,
        storeId: clean.storeId || 'store_ckr',
        date: clean.date || new Date().toISOString().split('T')[0],
        planName: clean.planName || '',
        category: clean.category || 'DAGING FRESH',
        openingStockKg: Number(clean.openingStockKg) || 0,
        newProcessedKg: Number(clean.newProcessedKg) || 0,
        salesKg: Number(clean.salesKg) || 0,
        adjustInKg: Number(clean.adjustInKg) || 0,
        adjustOutKg: Number(clean.adjustOutKg) || 0,
        closingStockBySystemKg: Number(clean.closingStockBySystemKg) || 0,
        actualClosingStockKg: Number(clean.actualClosingStockKg) || 0,
        susutJualKg: Number(clean.susutJualKg) || 0,
        photoUrl: clean.photoUrl ? 'Foto Timbangan Terlampir' : '',
        photoCaption: clean.photoCaption || '',
        note: clean.note || '',
        butcherName: clean.butcherName || 'Butcher TDN',
        timestamp: formatDateTime(clean.timestamp || new Date().toISOString()),
      };
    }

    if (table === 'Laporan_Closing') {
      return {
        id: clean.id || `rep_${Date.now()}`,
        storeId: clean.storeId || 'store_ckr',
        storeName: clean.storeName || 'TDN Cikarang',
        date: clean.date || new Date().toISOString().split('T')[0],
        totalWeightRaw: Number(clean.totalWeightRaw) || 0,
        totalWeightAfterThawing: Number(clean.totalWeightAfterThawing) || 0,
        totalWeightFabricated: Number(clean.totalWeightFabricated) || 0,
        totalPeriodicShrinkage: Number(clean.totalPeriodicShrinkage) || 0,
        totalSales: Number(clean.totalSales) || 0,
        totalEndStock: Number(clean.totalEndStock) || 0,
        thawingLossPercent: Number(clean.thawingLossPercent) || 0,
        fabricationLossPercent: Number(clean.fabricationLossPercent) || 0,
        salesLossPercent: Number(clean.salesLossPercent) || 0,
        overallLossPercent: Number(clean.overallLossPercent) || 0,
        statusAlert: clean.statusAlert || 'Normal',
        butcherName: clean.butcherName || 'Butcher TDN Cikarang',
        closingPhotoUrl: clean.closingPhotoUrl ? 'Foto Closing Terlampir' : '',
        createdAt: formatDateTime(clean.createdAt || new Date().toISOString()),
      };
    }

    if (table === 'Koreksi_Stok') {
      return {
        id: clean.id || `adj_${Date.now()}`,
        storeId: clean.storeId || 'store_ckr',
        planName: clean.planName || '',
        type: clean.type || 'IN',
        weightKg: Number(clean.weightKg) || 0,
        reason: clean.reason || '',
        adminName: clean.adminName || 'Admin Toko',
        createdAt: formatDateTime(clean.createdAt || new Date().toISOString()),
      };
    }

    if (table === 'Pengguna' || table === 'users') {
      return {
        id: clean.id || '',
        username: clean.username || '',
        role: clean.role || '',
        fullName: clean.fullName || clean.full_name || '',
        storeId: clean.storeId || clean.store_id || '',
        storeName: clean.storeName || clean.store_name || '',
        createdAt: formatDateTime(clean.createdAt || clean.created_at || new Date().toISOString()),
      };
    }

    if (table === 'Toko_Cabang' || table === 'stores') {
      return {
        id: clean.id || '',
        code: clean.code || clean.kode || '',
        name: clean.name || clean.nama || '',
        city: clean.city || clean.kota || '',
        createdAt: formatDateTime(clean.createdAt || clean.created_at || new Date().toISOString()),
      };
    }

    if (table === 'Master_COGS' || table === 'cogs_master') {
      return {
        id: clean.id || '',
        planName: clean.planName || clean.itemName || '',
        cogsPerKg: Number(clean.cogsPerKg) || 0,
        sellingPricePerKg: Number(clean.sellingPricePerKg || clean.defaultPricePerKg) || 0,
        category: clean.category || '',
        updatedAt: formatDateTime(clean.updatedAt || new Date().toISOString()),
      };
    }

    return clean;
  };

  const TABLE_SCHEMA_HEADERS: Record<string, string[]> = {
    'Toko_Cabang': ['id', 'code', 'name', 'city', 'createdAt'],
    'Pengguna': ['id', 'username', 'role', 'fullName', 'storeId', 'storeName', 'createdAt'],
    'Master_COGS': ['id', 'planName', 'cogsPerKg', 'sellingPricePerKg', 'category', 'updatedAt'],
    'Thawing_Daging': ['id', 'storeId', 'name', 'pabrikasiCategory', 'plannedFabrication', 'openingPurpose', 'status', 'weightBeforeThawing', 'weightAfterThawing', 'shrinkageThawing', 'shrinkageThawingPercent', 'susutJualKg', 'salesKg', 'thawingStartTime', 'thawingEndTime', 'durationMinutes', 'butcherName', 'isCarryover', 'image', 'createdAt'],
    'Pabrikasi_Segmen': ['id', 'storeId', 'itemId', 'itemName', 'segmentName', 'targetWeight', 'actualWeight', 'periodicShrinkage', 'salesKg', 'plannedFabrication', 'openingPurpose', 'isTransferred', 'originalPurpose', 'transferTimestamp', 'createdAt'],
    'Closing_Fisik': ['id', 'storeId', 'planName', 'date', 'displayClosingKg', 'pesananClosingKg', 'totalPhysicalClosingKg', 'photoDisplayUrl', 'photoPesananUrl', 'timestamp'],
    'Laporan_Closing': ['id', 'storeId', 'storeName', 'date', 'totalWeightRaw', 'totalWeightAfterThawing', 'totalWeightFabricated', 'totalPeriodicShrinkage', 'totalSales', 'totalEndStock', 'thawingLossPercent', 'fabricationLossPercent', 'salesLossPercent', 'overallLossPercent', 'statusAlert', 'closingPhotoUrl', 'butcherName', 'createdAt'],
    'Koreksi_Stok': ['id', 'storeId', 'planName', 'type', 'weightKg', 'reason', 'adminName', 'createdAt'],
  };

  const syncToSheetsBackend = async (table: string, items: any[]) => {
    const appsScriptUrl = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;
    if (!appsScriptUrl) return;

    try {
      const rawList = Array.isArray(items) ? items : [items];
      const sanitized = rawList.map((item) => sanitizeItemForSheets(table, item));
      const defaultHeaders = TABLE_SCHEMA_HEADERS[table] || (sanitized[0] ? Object.keys(sanitized[0]) : []);

      await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'updateTable',
          table,
          headers: defaultHeaders,
          items: sanitized,
          email: process.env.GOOGLE_SHEETS_EMAIL || 'server@backend',
          timestamp: new Date().toISOString()
        })
      });
      console.log(`[Google Sheets Backend] Auto-synced table ${table} with ${sanitized.length} sanitized records`);
    } catch (err) {
      console.warn(`[Google Sheets Backend] Sync failed for table ${table}:`, err);
    }
  };

  const syncAll8Tables = async () => {
    const appsScriptUrl = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;
    if (!appsScriptUrl) return;

    console.log('[Google Sheets Backend] Initiating complete 8-table mirroring to Google Sheets...');
    const allTables: Array<{ name: string; items: any[] }> = [
      { name: 'Toko_Cabang', items: inMemoryStore.stores },
      { name: 'Pengguna', items: inMemoryStore.users },
      { name: 'Master_COGS', items: inMemoryStore.cogsMaster },
      { name: 'Thawing_Daging', items: inMemoryStore.thawingItems },
      { name: 'Pabrikasi_Segmen', items: inMemoryStore.fabricationSegments },
      { name: 'Closing_Fisik', items: inMemoryStore.closingPlanRecords },
      { name: 'Laporan_Closing', items: inMemoryStore.dailyClosingReports },
      { name: 'Koreksi_Stok', items: inMemoryStore.stockAdjustments },
    ];

    for (const t of allTables) {
      await syncToSheetsBackend(t.name, t.items);
    }
    console.log('[Google Sheets Backend] Complete 8-table mirroring finished.');
  };

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
      const { code, name, city } = req.body;
      const codeUpper = (code || '').toUpperCase().trim();
      const codeLower = (code || '').toLowerCase().trim();
      const storeName = (name || '').trim();
      const storeCity = (city || '').trim();
      const createdAt = new Date().toISOString().split('T')[0];

      let storeId = '1';

      const p = getPool();
      if (p) {
        try {
          const insertRes = await p.query(
            `INSERT INTO stores (code, name, city, created_at)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [codeUpper, storeName, storeCity, createdAt]
          );
          storeId = insertRes.rows[0].id.toString();

          // Create Butcher and Admin for this store
          const intStoreId = parseInt(storeId, 10) || 1;
          await p.query(
            `INSERT INTO users (username, password, role, full_name, store_id, store_name, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (username) DO UPDATE SET full_name = $4, store_name = $6`,
            [`butcher_${codeLower}`, 'butcher123', 'butcher', `Butcher ${codeUpper}`, intStoreId, storeName, createdAt]
          );

          await p.query(
            `INSERT INTO users (username, password, role, full_name, store_id, store_name, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (username) DO UPDATE SET full_name = $4, store_name = $6`,
            [`admin_${codeLower}`, 'admin123', 'admin_toko', `Admin ${codeUpper}`, intStoreId, storeName, createdAt]
          );
        } catch (dbErr) {
          console.error('Postgres insert store error:', dbErr);
        }
      }

      const newStore = { id: storeId, code: codeUpper, name: storeName, city: storeCity, createdAt };
      inMemoryStore.stores.push(newStore);
      
      const newButcherUser = {
        id: `usr_${Date.now()}_1`,
        username: `butcher_${codeLower}`,
        password: 'butcher123',
        role: 'butcher',
        fullName: `Butcher ${codeUpper}`,
        storeId: storeId,
        storeName: storeName,
        createdAt,
      };
      const newAdminUser = {
        id: `usr_${Date.now()}_2`,
        username: `admin_${codeLower}`,
        password: 'admin123',
        role: 'admin_toko',
        fullName: `Admin ${codeUpper}`,
        storeId: storeId,
        storeName: storeName,
        createdAt,
      };
      inMemoryStore.users.push(newButcherUser, newAdminUser);

      syncToSheetsBackend('Toko_Cabang', inMemoryStore.stores);
      syncToSheetsBackend('Pengguna', inMemoryStore.users);

      res.json({ success: true, store: newStore });
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
      syncToSheetsBackend('Master_COGS', items);
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
          query += ` WHERE store_id = $1`;
          params.push(storeId);
        }
        query += ` ORDER BY created_at DESC`;
        const result = await p.query(query, params);
        return res.json(result.rows);
      } catch (err) {
        console.warn('Postgres fetch thawing items error:', err);
      }
    }
    const filtered = storeId ? inMemoryStore.thawingItems.filter((i) => !i.storeId || i.storeId === storeId) : inMemoryStore.thawingItems;
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
      if (Array.isArray(req.body)) {
        inMemoryStore.thawingItems = req.body;
      } else {
        const item = req.body;
        const idx = inMemoryStore.thawingItems.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          inMemoryStore.thawingItems[idx] = { ...inMemoryStore.thawingItems[idx], ...item };
        } else {
          inMemoryStore.thawingItems.unshift(item);
        }
      }
      syncToSheetsBackend('Thawing_Daging', inMemoryStore.thawingItems);
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
          query += ` WHERE store_id = $1`;
          params.push(storeId);
        }
        query += ` ORDER BY created_at DESC`;
        const result = await p.query(query, params);
        return res.json(result.rows);
      } catch (err) {
        console.warn('Postgres fetch fabrication segments error:', err);
      }
    }
    const filtered = storeId ? inMemoryStore.fabricationSegments.filter((s) => !s.storeId || s.storeId === storeId) : inMemoryStore.fabricationSegments;
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
      if (Array.isArray(req.body)) {
        inMemoryStore.fabricationSegments = req.body;
      } else {
        const seg = req.body;
        const idx = inMemoryStore.fabricationSegments.findIndex((s) => s.id === seg.id);
        if (idx >= 0) {
          inMemoryStore.fabricationSegments[idx] = { ...inMemoryStore.fabricationSegments[idx], ...seg };
        } else {
          inMemoryStore.fabricationSegments.unshift(seg);
        }
      }
      syncToSheetsBackend('Pabrikasi_Segmen', inMemoryStore.fabricationSegments);
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
          query += ` WHERE store_id = $1`;
          params.push(storeId);
        }
        query += ` ORDER BY created_at DESC`;
        const result = await p.query(query, params);
        return res.json(result.rows);
      } catch (err) {
        console.warn('Postgres fetch adjustments error:', err);
      }
    }
    const filtered = storeId ? inMemoryStore.stockAdjustments.filter((a) => !a.storeId || a.storeId === storeId) : inMemoryStore.stockAdjustments;
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
      if (Array.isArray(req.body)) {
        inMemoryStore.stockAdjustments = req.body;
      } else {
        const a = req.body;
        const idx = inMemoryStore.stockAdjustments.findIndex((item) => item.id === a.id);
        if (idx >= 0) {
          inMemoryStore.stockAdjustments[idx] = { ...inMemoryStore.stockAdjustments[idx], ...a };
        } else {
          inMemoryStore.stockAdjustments.unshift(a);
        }
      }
      syncToSheetsBackend('Koreksi_Stok', inMemoryStore.stockAdjustments);
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
          query += ` WHERE store_id = $1`;
          params.push(storeId);
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
    const filtered = storeId ? inMemoryStore.closingPlanRecords.filter((r) => !r.storeId || r.storeId === storeId) : inMemoryStore.closingPlanRecords;
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
      if (Array.isArray(req.body)) {
        inMemoryStore.closingPlanRecords = req.body;
      } else {
        const r = req.body;
        const idx = inMemoryStore.closingPlanRecords.findIndex((item) => item.id === r.id || (item.storeId === r.storeId && item.planName === r.planName && item.date === r.date));
        if (idx >= 0) {
          inMemoryStore.closingPlanRecords[idx] = { ...inMemoryStore.closingPlanRecords[idx], ...r };
        } else {
          inMemoryStore.closingPlanRecords.unshift(r);
        }
      }
      syncToSheetsBackend('Closing_Fisik', inMemoryStore.closingPlanRecords);
      res.json({ success: true, records: inMemoryStore.closingPlanRecords });
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
                 created_at as "createdAt"
          FROM daily_closing_reports
        `;
        const params: any[] = [];
        if (storeId) {
          query += ` WHERE store_id = $1`;
          params.push(storeId);
        }
        query += ` ORDER BY date DESC, created_at DESC`;
        const result = await p.query(query, params);
        return res.json(result.rows);
      } catch (err) {
        console.warn('Postgres fetch reports error:', err);
      }
    }
    const filtered = storeId ? inMemoryStore.dailyClosingReports.filter((r) => !r.storeId || r.storeId === storeId) : inMemoryStore.dailyClosingReports;
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
                overall_loss_percent, status_alert, closing_photo_url, butcher_name, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
              ON CONFLICT (id) DO UPDATE SET
                total_sales = $9, total_end_stock = $10, overall_loss_percent = $14, status_alert = $15`,
              [
                r.id, r.storeId || '1', r.storeName || 'TDN CKR', r.date,
                r.totalWeightRaw || 0, r.totalWeightAfterThawing || 0,
                r.totalWeightFabricated || 0, r.totalPeriodicShrinkage || 0,
                r.totalSales || 0, r.totalEndStock || 0,
                r.thawingLossPercent || 0, r.fabricationLossPercent || 0,
                r.salesLossPercent || 0, r.overallLossPercent || 0,
                r.statusAlert || 'Normal', r.closingPhotoUrl || null,
                r.butcherName || 'Butcher', r.createdAt || new Date().toISOString()
              ]
            );
          }
        } catch (dbErr) {
          console.error('Postgres save reports error:', dbErr);
        }
      }
      if (Array.isArray(req.body)) {
        inMemoryStore.dailyClosingReports = req.body;
      } else {
        const r = req.body;
        const idx = inMemoryStore.dailyClosingReports.findIndex((item) => item.id === r.id);
        if (idx >= 0) {
          inMemoryStore.dailyClosingReports[idx] = { ...inMemoryStore.dailyClosingReports[idx], ...r };
        } else {
          inMemoryStore.dailyClosingReports.unshift(r);
        }
      }
      syncToSheetsBackend('Laporan_Closing', inMemoryStore.dailyClosingReports);
      res.json({ success: true, reports: inMemoryStore.dailyClosingReports });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- GOOGLE SHEETS BACKEND STATUS & SYNC -----------------
  app.get('/api/sheets/status', (req, res) => {
    const scriptUrl = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;
    const sheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const email = process.env.GOOGLE_SHEETS_EMAIL;

    res.json({
      configured: Boolean(scriptUrl || sheetId),
      hasScriptUrl: Boolean(scriptUrl),
      hasSheetId: Boolean(sheetId),
      email: email || null,
      records: {
        thawing: inMemoryStore.thawingItems.length,
        fabrication: inMemoryStore.fabricationSegments.length,
        closing: inMemoryStore.closingPlanRecords.length,
        adjustments: inMemoryStore.stockAdjustments.length,
        reports: inMemoryStore.dailyClosingReports.length,
        cogs: inMemoryStore.cogsMaster.length,
      }
    });
  });

  app.post('/api/sheets/backend-sync', async (req, res) => {
    const appsScriptUrl = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
      return res.status(400).json({ error: 'GOOGLE_SHEETS_APPS_SCRIPT_URL is not configured in backend environment.' });
    }

    try {
      await syncAll8Tables();
      res.json({ success: true, message: 'All 8 tables synced to Google Sheets from backend successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to sync to Google Sheets from backend.' });
    }
  });

  // Auto trigger initial push of all 8 tables if URL is set on server boot
  if (process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL) {
    setTimeout(async () => {
      try {
        await syncAll8Tables();
      } catch (e) {
        console.warn('[Google Sheets Backend] Initial auto-sync skipped/failed:', e);
      }
    }, 2000);
  }

  // ----------------- DATABASE RESET -----------------
  app.post('/api/database/reset', async (req, res) => {
    try {
      const p = getPool();
      if (p) {
        await p.query('TRUNCATE TABLE thawing_items, fabrication_segments, stock_adjustments, closing_plan_records, daily_closing_reports');
      }
      inMemoryStore.thawingItems = [];
      inMemoryStore.fabricationSegments = [];
      inMemoryStore.stockAdjustments = [];
      inMemoryStore.closingPlanRecords = [];
      inMemoryStore.dailyClosingReports = [];
      res.json({ success: true, message: 'Database reset successfully' });
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
