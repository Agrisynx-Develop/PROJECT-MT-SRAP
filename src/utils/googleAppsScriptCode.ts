/**
 * Google Apps Script Backend Code for TDN Meat Tracker
 * 
 * Instructions:
 * 1. Open your Google Spreadsheet (e.g. LAPORAN DAGING / TDN Database)
 * 2. Click Extensions > Apps Script (Ekstensi > Apps Script)
 * 3. Replace all code in Code.gs with this script
 * 4. Click Deploy > New deployment (Terapkan > Penerapan baru)
 * 5. Select type: Web app (Aplikasi web)
 * 6. Set:
 *    - Description: TDN Meat Tracker 8-Sheet Database Engine
 *    - Execute as: Me (your_email@gmail.com)
 *    - Who has access: Anyone (Siapa saja)
 * 7. Click Deploy, Authorize access, and copy the Web App URL (https://script.google.com/macros/s/.../exec)
 * 8. Paste the Web App URL into the TDN Meat Tracker Settings / Sync dialog.
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * TDN MEAT TRACKER - 8-SHEET DATABASE ENGINE (GOOGLE APPS SCRIPT)
 * =========================================================================
 * Version: 3.0.0
 * 
 * Struktur Database 8-Sheet Resmi:
 * Sheet 1 (Data_Thawing):
 *   Kolom: nama bahan, tanggal, berat sebelum thawing, berat setelah thawing, foto, susut proses, durasi thawing, status
 * Sheet 2 (Data_Pabrikasi):
 *   Kolom: nama bahan, tanggal, kategori, rencana pabrikasi, daftar segmen hasil potongan, Tujuan, berat rencana pabrikasi
 * Sheet 3 (Closing_Rencana_Potong):
 *   Kolom: tanggal, nama bahan, sisa kemarin, diolah baru, sales real, timbangan sisa stok akhir, foto timbangan, susut jual, status, catatan
 * Sheet 4 (Pengguna):
 *   Kolom: id, user name, role, full name, store id, store name, created at
 * Sheet 5 (Toko_Cabang):
 *   Kolom: id, code, name, city, created at
 * Sheet 6 (Master_COGS):
 *   Kolom: id, item code, item name, plan name, cogs per kg, selling price, kategori, updated at, updated by
 * Sheet 7 (Adjustment):
 *   Kolom: tanggal, nama toko, id toko, jenis, rencana potong, berat, alasan
 * Sheet 8 (Data_Susut):
 *   Kolom: tanggal, nama toko, id toko, rencana potong, susut proses, susut jual
 */

var CANONICAL_SHEETS = [
  'Data_Thawing',
  'Data_Pabrikasi',
  'Closing_Rencana_Potong',
  'Pengguna',
  'Toko_Cabang',
  'Master_COGS',
  'Adjustment',
  'Data_Susut'
];

var TABLE_SCHEMAS = {
  'Data_Thawing': ['id', 'id toko', 'nama toko', 'nama bahan', 'kategori', 'rencana pabrikasi', 'tanggal', 'berat sebelum thawing', 'berat setelah thawing', 'foto', 'susut proses', 'durasi thawing', 'status', 'waktu mulai', 'petugas butcher'],
  'Data_Pabrikasi': ['id', 'id item', 'id toko', 'nama toko', 'nama bahan', 'tanggal', 'kategori', 'rencana pabrikasi', 'daftar segmen hasil potongan', 'Tujuan', 'berat rencana pabrikasi', 'susut pabrikasi', 'foto'],
  'Closing_Rencana_Potong': ['id', 'tanggal', 'nama toko', 'id toko', 'nama bahan', 'kategori', 'sisa kemarin', 'diolah baru', 'sales real', 'timbangan sisa stok akhir', 'foto timbangan', 'susut jual', 'status', 'catatan', 'petugas butcher'],
  'Pengguna': ['id', 'user name', 'role', 'full name', 'store id', 'store name', 'created at'],
  'Toko_Cabang': ['id', 'code', 'name', 'city', 'created at'],
  'Master_COGS': ['id', 'item code', 'item name', 'plan name', 'cogs per kg', 'selling price', 'kategori', 'updated at', 'updated by'],
  'Adjustment': ['tanggal', 'nama toko', 'id toko', 'jenis', 'rencana potong', 'berat', 'alasan'],
  'Data_Susut': ['tanggal', 'nama toko', 'id toko', 'rencana potong', 'susut proses', 'susut jual']
};

function resolveGASSheetName(table) {
  var map = {
    'thawing_items': 'Data_Thawing', 'thawingItems': 'Data_Thawing', 'Thawing_Daging': 'Data_Thawing', 'data_thawing': 'Data_Thawing', 'Data_Thawing': 'Data_Thawing',
    'fabrication_segments': 'Data_Pabrikasi', 'fabricationSegments': 'Data_Pabrikasi', 'Pabrikasi_Segmen': 'Data_Pabrikasi', 'data_pabrikasi': 'Data_Pabrikasi', 'Data_Pabrikasi': 'Data_Pabrikasi',
    'closing_plan_records': 'Closing_Rencana_Potong', 'closingPlanRecords': 'Closing_Rencana_Potong', 'Closing_Fisik': 'Closing_Rencana_Potong', 'closing_rencana_potong': 'Closing_Rencana_Potong', 'Closing_Rencana_Potong': 'Closing_Rencana_Potong',
    'stock_adjustments': 'Adjustment', 'stockAdjustments': 'Adjustment', 'Koreksi_Stok': 'Adjustment', 'Adjustment': 'Adjustment', 'adjustment': 'Adjustment',
    'stores': 'Toko_Cabang', 'stores_list': 'Toko_Cabang', 'Toko_Cabang': 'Toko_Cabang',
    'users': 'Pengguna', 'users_list': 'Pengguna', 'Pengguna': 'Pengguna',
    'cogs_master': 'Master_COGS', 'cogsMaster': 'Master_COGS', 'Master_COGS': 'Master_COGS',
    'data_susut': 'Data_Susut', 'dataSusut': 'Data_Susut', 'Data_Susut': 'Data_Susut'
  };
  return map[table] || table;
}

/**
 * Menu Spreadsheet UI otomatis di Google Sheets
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('TDN Meat Tracker')
      .addItem('Format & Inisialisasi 8 Database Sheet', 'menuInit8Sheets')
      .addItem('Hapus Data Input Transaksi (Kecuali COGS & Pengguna)', 'menuResetTransactions')
      .addToUi();
  } catch (e) {
    // ignore in non-UI contexts
  }
}

function menuInit8Sheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupAndClean8Sheets(ss, false);
  SpreadsheetApp.getUi().alert('8 Sheet Database berhasil diselaraskan sesuai spesifikasi!');
}

function menuResetTransactions() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert('Konfirmasi Hapus Data', 'Hapus semua data input transaksi? Master COGS, Pengguna, dan Toko Cabang akan TETAP AMAN.', ui.ButtonSet.YES_NO);
  if (res === ui.Button.YES) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupAndClean8Sheets(ss, true);
    ui.alert('Data input transaksi berhasil dikosongkan. Master COGS & Pengguna tetap aman terjaga.');
  }
}

/**
 * Ensures the 8 canonical sheets exist with exact headers and cleans unwanted legacy sheets
 */
function setupAndClean8Sheets(ss, clearTransactions) {
  // 1. Ensure all 8 canonical sheets exist with correct row 1 headers & formatting
  for (var i = 0; i < CANONICAL_SHEETS.length; i++) {
    var name = CANONICAL_SHEETS[i];
    var sheet = ss.getSheetByName(name);
    var headers = TABLE_SCHEMAS[name];

    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    // Set row 1 headers exactly
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    // If clearTransactions is true, clear data rows for transaction sheets
    if (clearTransactions) {
      var isTransTable = (name === 'Data_Thawing' || name === 'Data_Pabrikasi' || name === 'Closing_Rencana_Potong' || name === 'Adjustment' || name === 'Data_Susut');
      if (isTransTable && sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }
    }
  }

  // 2. Delete unwanted legacy sheets if any exist
  var legacyNames = [
    'Sheet1', 'Sheet 1', 'Sheet 2', 'Sheet 3', 'Sheet 4',
    'thawing_items', 'fabrication_segments', 'closing_plan_records',
    'daily_closing_reports', 'stock_adjustments', 'Thawing_Daging',
    'Pabrikasi_Segmen', 'Closing_Fisik', 'Koreksi_Stok', 'Laporan_Closing', 'Loss_Config'
  ];

  var allSheets = ss.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    var sName = allSheets[s].getName();
    if (CANONICAL_SHEETS.indexOf(sName) === -1) {
      // It is not one of our 8 canonical sheets
      if (legacyNames.indexOf(sName) !== -1 || allSheets.length > 8) {
        try {
          ss.deleteSheet(allSheets[s]);
        } catch (delErr) {
          // ignore if deletion fails
        }
      }
    }
  }

  // 3. Seed default Master COGS, Pengguna, and Toko Cabang if completely empty
  ensureDefaultsIfEmpty(ss);
  SpreadsheetApp.flush();
}

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAllData';
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // 1. PING Test
    if (action === 'ping') {
      return jsonResponse({
        status: 'ONLINE',
        message: 'TDN Google Apps Script 8-Sheet Database is active & reachable',
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheets: CANONICAL_SHEETS,
        timestamp: new Date().toISOString()
      });
    }

    // 2. INIT / FORMAT 8 SHEETS
    if (action === 'init8Sheets') {
      var clearFlag = e && e.parameter && e.parameter.clear === 'true';
      setupAndClean8Sheets(ss, clearFlag);
      return jsonResponse({
        success: true,
        action: 'init8Sheets',
        clearedTransactions: clearFlag,
        sheets: CANONICAL_SHEETS,
        timestamp: new Date().toISOString()
      });
    }

    // 3. RESET DATA (Clear input transactions, preserve COGS & Pengguna)
    if (action === 'resetData') {
      setupAndClean8Sheets(ss, true);
      return jsonResponse({
        success: true,
        action: 'resetData',
        message: 'Semua data input transaksi berhasil dibersihkan (Master COGS & Pengguna tetap aman).',
        timestamp: new Date().toISOString()
      });
    }

    // 4. GET ALL DATA
    if (action === 'getAllData') {
      // Auto-ensure sheets exist
      setupAndClean8Sheets(ss, false);

      var allData = {
        stores: readTableData(ss, 'Toko_Cabang'),
        users: readTableData(ss, 'Pengguna'),
        cogsMaster: readTableData(ss, 'Master_COGS'),
        thawingItems: readTableData(ss, 'Data_Thawing'),
        fabricationSegments: readTableData(ss, 'Data_Pabrikasi'),
        closingPlanRecords: readTableData(ss, 'Closing_Rencana_Potong'),
        stockAdjustments: readTableData(ss, 'Adjustment'),
        dataSusut: readTableData(ss, 'Data_Susut')
      };

      return jsonResponse({
        success: true,
        action: 'getAllData',
        data: allData,
        timestamp: new Date().toISOString()
      });
    }

    // 5. GET SINGLE TABLE
    if (action === 'getTable') {
      var rawTable = e.parameter.table;
      if (!rawTable) {
        return jsonResponse({ success: false, error: 'Parameter "table" is required' });
      }
      var targetTable = resolveGASSheetName(rawTable);
      var tableItems = readTableData(ss, targetTable);
      return jsonResponse({
        success: true,
        table: targetTable,
        items: tableItems,
        count: tableItems.length,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString(), stack: err.stack });
  }
}

/**
 * Handle HTTP POST Requests with Concurrency Lock
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      return jsonResponse({
        success: false,
        error: 'Database sedang sibuk. Silakan coba lagi dalam beberapa detik.'
      });
    }

    var contents = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var payload = {};
    try {
      payload = JSON.parse(contents);
    } catch (parseErr) {
      payload = e.parameter || {};
    }

    var action = payload.action || (e && e.parameter && e.parameter.action) || 'updateTable';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 0. PING Test (POST support)
    if (action === 'ping') {
      return jsonResponse({
        status: 'ONLINE',
        message: 'TDN Google Apps Script 8-Sheet Database is active & reachable',
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheets: CANONICAL_SHEETS,
        timestamp: new Date().toISOString()
      });
    }

    // 0.1 GET ALL DATA (POST support)
    if (action === 'getAllData') {
      setupAndClean8Sheets(ss, false);
      var allData = {
        stores: readTableData(ss, 'Toko_Cabang'),
        users: readTableData(ss, 'Pengguna'),
        cogsMaster: readTableData(ss, 'Master_COGS'),
        thawingItems: readTableData(ss, 'Data_Thawing'),
        fabricationSegments: readTableData(ss, 'Data_Pabrikasi'),
        closingPlanRecords: readTableData(ss, 'Closing_Rencana_Potong'),
        stockAdjustments: readTableData(ss, 'Adjustment'),
        dataSusut: readTableData(ss, 'Data_Susut')
      };
      return jsonResponse({
        success: true,
        action: 'getAllData',
        data: allData,
        timestamp: new Date().toISOString()
      });
    }

    // 0.2 GET SINGLE TABLE (POST support)
    if (action === 'getTable') {
      var rawTable = payload.table || (e && e.parameter && e.parameter.table);
      if (!rawTable) {
        return jsonResponse({ success: false, error: 'Parameter "table" is required' });
      }
      var targetTable = resolveGASSheetName(rawTable);
      var tableItems = readTableData(ss, targetTable);
      return jsonResponse({
        success: true,
        table: targetTable,
        items: tableItems,
        count: tableItems.length,
        timestamp: new Date().toISOString()
      });
    }

    // 1. INIT / FORMAT 8 SHEETS
    if (action === 'init8Sheets') {
      var shouldClear = payload.clearTransactions === true;
      setupAndClean8Sheets(ss, shouldClear);
      return jsonResponse({
        success: true,
        action: 'init8Sheets',
        clearedTransactions: shouldClear,
        sheets: CANONICAL_SHEETS,
        timestamp: new Date().toISOString()
      });
    }

    // 2. RESET DATA
    if (action === 'resetData') {
      setupAndClean8Sheets(ss, true);
      return jsonResponse({
        success: true,
        action: 'resetData',
        clearedTables: ['Data_Thawing', 'Data_Pabrikasi', 'Closing_Rencana_Potong', 'Adjustment', 'Data_Susut'],
        preservedTables: ['Master_COGS', 'Pengguna', 'Toko_Cabang'],
        timestamp: new Date().toISOString()
      });
    }

    // 3. PUSH / UPDATE ENTIRE TABLE
    if (action === 'updateTable') {
      var table = resolveGASSheetName(payload.table);
      var items = payload.items || [];
      if (!table) {
        return jsonResponse({ success: false, error: 'Table name is required' });
      }
      var count = writeTableData(ss, table, items, payload.headers);
      return jsonResponse({
        success: true,
        action: 'updateTable',
        table: table,
        savedCount: count,
        timestamp: new Date().toISOString()
      });
    }

    // 4. UPSERT SINGLE RECORD
    if (action === 'upsertRecord') {
      var table = resolveGASSheetName(payload.table);
      var record = payload.record || payload.item;
      if (!table || !record) {
        return jsonResponse({ success: false, error: 'Table and record are required for upsertRecord' });
      }
      var result = upsertSingleRecord(ss, table, record);
      return jsonResponse({
        success: true,
        action: 'upsertRecord',
        table: table,
        recordId: record.id || record.planName || record.name,
        operation: result.operation,
        timestamp: new Date().toISOString()
      });
    }

    // 5. BATCH UPSERT RECORDS
    if (action === 'upsertRecords') {
      var table = resolveGASSheetName(payload.table);
      var records = payload.records || payload.items || [];
      if (!table) {
        return jsonResponse({ success: false, error: 'Table is required for upsertRecords' });
      }
      for (var i = 0; i < records.length; i++) {
        upsertSingleRecord(ss, table, records[i]);
      }
      return jsonResponse({
        success: true,
        action: 'upsertRecords',
        table: table,
        count: records.length,
        timestamp: new Date().toISOString()
      });
    }

    // 6. DELETE SINGLE RECORD
    if (action === 'deleteRecord') {
      var table = resolveGASSheetName(payload.table);
      var recordId = payload.id || payload.recordId;
      if (!table || !recordId) {
        return jsonResponse({ success: false, error: 'Table and id are required for deleteRecord' });
      }
      var deleted = deleteSingleRecord(ss, table, recordId);
      return jsonResponse({
        success: true,
        action: 'deleteRecord',
        table: table,
        deletedId: recordId,
        found: deleted,
        timestamp: new Date().toISOString()
      });
    }

    // 7. SAVE ALL 8 TABLES
    if (action === 'saveAllData') {
      var data = payload.data || {};
      if (data.stores) writeTableData(ss, 'Toko_Cabang', data.stores);
      if (data.users) writeTableData(ss, 'Pengguna', data.users);
      if (data.cogsMaster) writeTableData(ss, 'Master_COGS', data.cogsMaster);
      if (data.thawingItems) writeTableData(ss, 'Data_Thawing', data.thawingItems);
      if (data.fabricationSegments) writeTableData(ss, 'Data_Pabrikasi', data.fabricationSegments);
      if (data.closingPlanRecords) writeTableData(ss, 'Closing_Rencana_Potong', data.closingPlanRecords);
      if (data.stockAdjustments) writeTableData(ss, 'Adjustment', data.stockAdjustments);
      if (data.dataSusut) writeTableData(ss, 'Data_Susut', data.dataSusut);

      return jsonResponse({
        success: true,
        action: 'saveAllData',
        sheets: CANONICAL_SHEETS,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ success: false, error: 'Unknown POST action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString(), stack: err.stack });
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

// -------------------------------------------------------------------------
// SPREADSHEET HELPER FUNCTIONS
// -------------------------------------------------------------------------

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var defaultHeaders = TABLE_SCHEMAS[sheetName] || ['id', 'createdAt'];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    var headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  } else {
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      var headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
      headerRange.setBackground('#1e293b');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function extractYMD(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = ('0' + (val.getMonth() + 1)).slice(-2);
    var d = ('0' + val.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  var s = String(val).trim();
  var match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[1] + '-' + match[2] + '-' + match[3];
  return s.split('T')[0];
}

function normalizeStrGAS(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Read data from sheet and convert to array of JSON objects
 */
function readTableData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var rows = [];

  for (var r = 1; r < values.length; r++) {
    var rowData = values[r];
    var isEmpty = true;
    for (var c = 0; c < rowData.length; c++) {
      if (rowData[c] !== '' && rowData[c] !== null && rowData[c] !== undefined) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) continue;

    var item = {};
    for (var h = 0; h < headers.length; h++) {
      var headerKey = String(headers[h]).trim();
      if (!headerKey) continue;
      var rawVal = rowData[h];

      if (rawVal instanceof Date) {
        var y = rawVal.getFullYear();
        var m = ('0' + (rawVal.getMonth() + 1)).slice(-2);
        var d = ('0' + rawVal.getDate()).slice(-2);
        if (headerKey.toLowerCase() === 'tanggal' || headerKey.toLowerCase() === 'date') {
          rawVal = y + '-' + m + '-' + d;
        } else {
          rawVal = rawVal.toISOString();
        }
      }
      
      if (rawVal === 'YA' || rawVal === 'TRUE' || rawVal === true) {
        item[headerKey] = true;
      } else if (rawVal === 'TIDAK' || rawVal === 'FALSE' || rawVal === false) {
        item[headerKey] = false;
      } else {
        item[headerKey] = rawVal;
      }
    }

    // Normalizations to camelCase
    if (item['nama bahan']) { item.name = item['nama bahan']; item.itemName = item['nama bahan']; }
    if (item['tanggal']) { item.date = item['tanggal']; item.createdAt = item['tanggal']; }
    if (item['berat sebelum thawing'] !== undefined) { item.weightBeforeThawing = Number(item['berat sebelum thawing']) || 0; }
    if (item['berat setelah thawing'] !== undefined) { item.weightAfterThawing = Number(item['berat setelah thawing']) || 0; }
    if (item['foto']) { item.image = item['foto']; item.photoUrl = item['foto']; }
    if (item['susut proses'] !== undefined) { item.susutProses = Number(item['susut proses']) || 0; item.shrinkageThawing = Number(item['susut proses']) || 0; }
    if (item['durasi thawing']) {
      var numMatch = String(item['durasi thawing']).match(/\\d+/);
      item.durationMinutes = numMatch ? parseInt(numMatch[0], 10) : 45;
    }
    if (item['status']) { item.status = item['status']; }

    if (item['kategori']) { item.category = item['kategori']; item.pabrikasiCategory = item['kategori']; }
    if (item['rencana pabrikasi']) { item.plannedFabrication = item['rencana pabrikasi']; item.planName = item['rencana pabrikasi']; }
    if (item['daftar segmen hasil potongan']) { item.segmentName = item['daftar segmen hasil potongan']; }
    if (item['Tujuan']) { item.openingPurpose = item['Tujuan']; }
    if (item['berat rencana pabrikasi'] !== undefined) { item.actualWeight = Number(item['berat rencana pabrikasi']) || 0; item.targetWeight = Number(item['berat rencana pabrikasi']) || 0; }

    if (item['sisa kemarin'] !== undefined) { item.openingStockKg = Number(item['sisa kemarin']) || 0; }
    if (item['diolah baru'] !== undefined) { item.newProcessedKg = Number(item['diolah baru']) || 0; }
    if (item['sales real'] !== undefined) { item.salesKg = Number(item['sales real']) || 0; }
    if (item['timbangan sisa stok akhir'] !== undefined) { item.actualClosingStockKg = Number(item['timbangan sisa stok akhir']) || 0; }
    if (item['foto timbangan']) { item.photoUrl = item['foto timbangan']; }
    if (item['susut jual'] !== undefined) { item.susutJualKg = Number(item['susut jual']) || 0; item.susutJual = Number(item['susut jual']) || 0; }
    if (item['catatan']) { item.note = item['catatan']; }

    if (item['id']) { item.id = String(item['id']); }
    if (item['user name']) { item.username = item['user name']; }
    if (item['full name']) { item.fullName = item['full name']; }
    if (item['store id']) { item.storeId = String(item['store id']); }
    if (item['store name']) { item.storeName = item['store name']; }
    if (item['created at']) { item.createdAt = item['created at']; }

    if (item['code']) { item.code = item['code']; }
    if (item['name']) { item.name = item['name']; }
    if (item['city']) { item.city = item['city']; }

    if (item['item code']) { item.itemCode = item['item code']; }
    if (item['item name']) { item.itemName = item['item name']; }
    if (item['plan name']) { item.planName = item['plan name']; }
    if (item['cogs per kg'] !== undefined) { item.cogsPerKg = Number(item['cogs per kg']) || 0; }
    if (item['selling price'] !== undefined) { item.sellingPricePerKg = Number(item['selling price']) || 0; item.defaultPricePerKg = Number(item['selling price']) || 0; }
    if (item['updated at']) { item.updatedAt = item['updated at']; }
    if (item['updated by']) { item.updatedBy = item['updated by']; }

    if (item['nama toko']) { item.storeName = item['nama toko']; }
    if (item['id toko']) { item.storeId = String(item['id toko']); }
    if (item['jenis']) { item.type = item['jenis']; }
    if (item['rencana potong']) { item.planName = item['rencana potong']; item.meatName = item['rencana potong']; }
    if (item['berat'] !== undefined) { item.weightKg = Number(item['berat']) || 0; }
    if (item['alasan']) { item.reason = item['alasan']; }
    if (item['waktu mulai']) { item.thawingStartTime = item['waktu mulai']; }
    if (item['petugas butcher']) { item.butcherName = item['petugas butcher']; }
    if (item['id item']) { item.itemId = String(item['id item']); }
    if (item['susut pabrikasi'] !== undefined) { item.periodicShrinkage = Number(item['susut pabrikasi']) || 0; }

    // Deterministic fallback ID if not provided by older sheet schema
    if (!item.id || item.id === '') {
      if (sheetName === 'Data_Thawing') {
        var d = item.date || item.createdAt || 'nodate';
        var n = (item.name || 'meat').replace(/[^a-zA-Z0-9]/g, '');
        var w = item.weightBeforeThawing || 0;
        var s = item.storeId || '1';
        item.id = 'thaw_' + s + '_' + n + '_' + d + '_' + Math.round(w * 100) + '_r' + (i + 1);
      } else if (sheetName === 'Data_Pabrikasi') {
        var d = item.date || item.createdAt || 'nodate';
        var n = (item.name || 'seg').replace(/[^a-zA-Z0-9]/g, '');
        var seg = (item.segmentName || '').replace(/[^a-zA-Z0-9]/g, '');
        var s = item.storeId || '1';
        item.id = 'seg_' + s + '_' + n + '_' + seg + '_' + d + '_r' + (i + 1);
      }
    }

    rows.push(item);
  }

  return rows;
}

function getRecordValueForHeaderGAS(record, header) {
  if (!record || typeof record !== 'object') return '';
  if (record[header] !== undefined && record[header] !== null) return record[header];
  var norm = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');

  var map = {
    'namabahan': record.name || record.itemName || record.namaBahan || record.bahan || record.planName || '',
    'tanggal': extractYMD(record.date || record.tanggal || record.thawingStartTime || record.createdAt || record.timestamp),
    'beratsebelumthawing': record.weightBeforeThawing !== undefined ? record.weightBeforeThawing : (record.tally || 0),
    'beratsetelahthawing': record.weightAfterThawing !== undefined ? record.weightAfterThawing : (record.netto || record.weightBeforeThawing || 0),
    'foto': record.photoUrl || record.image || record.foto || '',
    'susutproses': record.susutProses !== undefined ? record.susutProses : (record.shrinkageThawing || 0),
    'durasithawing': record.durationMinutes ? (record.durationMinutes + ' menit') : (record.durasi || '45 menit'),
    'status': record.status || 'SELESAI',
    'kategori': record.category || record.pabrikasiCategory || record.kategori || 'DAGING FRESH',
    'rencanapabrikasi': record.plannedFabrication || record.planName || record.rencanaPabrikasi || '',
    'daftarsegmenhasilpotongan': record.segmentName || record.daftarSegmen || '',
    'tujuan': record.openingPurpose || record.tujuan || record.Tujuan || 'UNTUK DISPLAY',
    'beratrencanapabrikasi': record.actualWeight !== undefined ? record.actualWeight : (record.targetWeight || 0),
    'sisakemarin': record.openingStockKg !== undefined ? record.openingStockKg : (record.sisaKemarin || 0),
    'diolahbaru': record.newProcessedKg !== undefined ? record.newProcessedKg : (record.diolahBaru || 0),
    'salesreal': record.salesKg !== undefined ? record.salesKg : (record.salesReal || 0),
    'timbangansisastokakhir': record.actualClosingStockKg !== undefined ? record.actualClosingStockKg : (record.timbanganSisaStokAkhir || 0),
    'fototimbangan': record.photoUrl || record.fotoTimbangan || record.image || '',
    'susutjual': record.susutJualKg !== undefined ? record.susutJualKg : (record.susutJual || 0),
    'catatan': record.note || record.catatan || '-',
    'id': record.id ? String(record.id) : '',
    'iditem': record.itemId ? String(record.itemId) : (record.id_item ? String(record.id_item) : ''),
    'username': record.username || record.userName || '',
    'role': record.role || '',
    'fullname': record.fullName || record.full_name || '',
    'storeid': record.storeId ? String(record.storeId) : (record.store_id ? String(record.store_id) : ''),
    'storename': record.storeName || record.store_name || '',
    'createdat': record.createdAt || record.created_at || extractYMD(new Date()),
    'code': record.code || record.kode || '',
    'name': record.name || record.nama || '',
    'city': record.city || record.kota || '',
    'itemcode': record.itemCode || record.kodeItem || '',
    'itemname': record.itemName || record.namaItem || '',
    'planname': record.planName || record.rencanaPotong || '',
    'cogsperkg': record.cogsPerKg !== undefined ? record.cogsPerKg : (record.cogs_per_kg || 0),
    'sellingprice': record.sellingPricePerKg !== undefined ? record.sellingPricePerKg : (record.selling_price_per_kg || record.defaultPricePerKg || 0),
    'updatedat': record.updatedAt || record.updated_at || extractYMD(new Date()),
    'updatedby': record.updatedBy || record.updated_by || 'MD Pusat',
    'namatoko': record.storeName || record.namaToko || 'TDN CKR',
    'idtoko': record.storeId ? String(record.storeId) : (record.idToko ? String(record.idToko) : '1'),
    'jenis': record.type || record.jenis || 'IN',
    'rencanapotong': record.planName || record.rencanaPotong || record.meatName || '',
    'berat': record.weightKg !== undefined ? record.weightKg : (record.berat || 0),
    'alasan': record.reason || record.alasan || '-',
    'waktumulai': record.thawingStartTime || record.waktuMulai || '',
    'petugasbutcher': record.butcherName || record.petugasButcher || '',
    'susutpabrikasi': record.periodicShrinkage !== undefined ? record.periodicShrinkage : (record.susutPabrikasi || 0)
  };
  return map[norm] !== undefined ? map[norm] : (record[header] !== undefined ? record[header] : '');
}

/**
 * Write full table data to sheet (Replaces existing data rows cleanly)
 */
function writeTableData(ss, sheetName, items, customHeaders) {
  var sheet = getOrCreateSheet(ss, sheetName);
  var headers = customHeaders || TABLE_SCHEMAS[sheetName];

  if (!headers || headers.length === 0) {
    headers = TABLE_SCHEMAS[sheetName] || ['id', 'createdAt'];
  }

  // Clear existing data rows (keep header row 1)
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), headers.length);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  // Rewrite header in row 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1e293b');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  if (!items || items.length === 0) {
    SpreadsheetApp.flush();
    return 0;
  }

  var rows = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var row = [];
    for (var h = 0; h < headers.length; h++) {
      var val = item[headers[h]];
      if (val === undefined || val === null || val === '') {
        val = getRecordValueForHeaderGAS(item, headers[h]);
      }
      if (val === undefined || val === null) {
        val = '';
      } else if (typeof val === 'boolean') {
        val = val ? 'YA' : 'TIDAK';
      } else if (typeof val === 'string' && val.length > 48000) {
        val = val.substring(0, 48000);
      }
      row.push(val);
    }
    rows.push(row);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  SpreadsheetApp.flush();
  return rows.length;
}

/**
 * Smart atomic upsert single record
 */
function upsertSingleRecord(ss, sheetName, record) {
  if (!record) return { operation: 'skipped', error: 'No record data' };
  var sheet = getOrCreateSheet(ss, sheetName);
  var headers = TABLE_SCHEMAS[sheetName] || Object.keys(record);

  var lastRow = sheet.getLastRow();
  var values = lastRow > 1 ? sheet.getRange(1, 1, lastRow, headers.length).getValues() : [headers];

  var targetDate = extractYMD(record.date || record.tanggal || record.createdAt || record.timestamp);
  var targetName = normalizeStrGAS(record.planName || record.name || record.itemName || record['nama bahan'] || record['rencana potong']);
  var targetSegment = normalizeStrGAS(record.segmentName || record['daftar segmen hasil potongan']);
  var targetStore = normalizeStrGAS(record.storeId || record['id toko'] || record.id || '');
  var targetId = record.id ? String(record.id).trim() : '';

  var idColIdx = headers.indexOf('id');
  var dateColIdx = headers.indexOf('tanggal');
  var namaBahanColIdx = headers.indexOf('nama bahan');
  var rencanaPotongColIdx = headers.indexOf('rencana potong');
  var segmenColIdx = headers.indexOf('daftar segmen hasil potongan');
  var idTokoColIdx = headers.indexOf('id toko');

  var rowIndexToUpdate = -1;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var rowId = idColIdx >= 0 ? String(row[idColIdx] || '').trim() : '';

    // 1. Direct ID Match (Primary identifier for all physical meat items and segments)
    if (targetId && rowId && targetId === rowId) {
      rowIndexToUpdate = r + 1;
      break;
    }

    // Notice: For Data_Thawing and Data_Pabrikasi, we DO NOT do fuzzy date+name matching!
    // A butcher can thaw multiple batches of the same cut (e.g. 2 boxes of HQ 41/42/44/45, 20 kg each) on the same date.
    // Overwriting by date + name would overwrite duplicate cuts of meat!
    // They must be appended as individual rows if targetId does not match an existing row.

    // 2. Closing_Rencana_Potong: Match by date + id toko + plan name
    if (sheetName === 'Closing_Rencana_Potong' && dateColIdx >= 0 && namaBahanColIdx >= 0) {
      var rDate = extractYMD(row[dateColIdx]);
      var rName = normalizeStrGAS(row[namaBahanColIdx]);
      var rStore = idTokoColIdx >= 0 ? normalizeStrGAS(row[idTokoColIdx]) : '';
      if (rDate === targetDate && rName === targetName && (!targetStore || !rStore || rStore === targetStore)) {
        rowIndexToUpdate = r + 1;
        break;
      }
    }

    // 3. Adjustment: Match by date + id toko + rencana potong
    if (sheetName === 'Adjustment' && dateColIdx >= 0 && rencanaPotongColIdx >= 0) {
      var rDate = extractYMD(row[dateColIdx]);
      var rPlan = normalizeStrGAS(row[rencanaPotongColIdx]);
      var rStore = idTokoColIdx >= 0 ? normalizeStrGAS(row[idTokoColIdx]) : '';
      if (rDate === targetDate && rPlan === targetName && (!targetStore || !rStore || rStore === targetStore)) {
        rowIndexToUpdate = r + 1;
        break;
      }
    }

    // 4. Data_Susut: Match by date + id toko + rencana potong
    if (sheetName === 'Data_Susut' && dateColIdx >= 0 && rencanaPotongColIdx >= 0) {
      var rDate = extractYMD(row[dateColIdx]);
      var rPlan = normalizeStrGAS(row[rencanaPotongColIdx]);
      var rStore = idTokoColIdx >= 0 ? normalizeStrGAS(row[idTokoColIdx]) : '';
      if (rDate === targetDate && rPlan === targetName && (!targetStore || !rStore || rStore === targetStore)) {
        rowIndexToUpdate = r + 1;
        break;
      }
    }
  }

  var rowData = [];
  for (var h = 0; h < headers.length; h++) {
    var key = headers[h];
    var val = record[key];
    if (val === undefined || val === null || val === '') {
      val = getRecordValueForHeaderGAS(record, key);
    }
    if (val === undefined || val === null) {
      val = '';
    } else if (typeof val === 'boolean') {
      val = val ? 'YA' : 'TIDAK';
    } else if (typeof val === 'string' && val.length > 48000) {
      val = val.substring(0, 48000);
    }
    rowData.push(val);
  }

  if (rowIndexToUpdate > 0) {
    sheet.getRange(rowIndexToUpdate, 1, 1, headers.length).setValues([rowData]);
    SpreadsheetApp.flush();
    return { operation: 'updated', row: rowIndexToUpdate };
  } else {
    sheet.appendRow(rowData);
    SpreadsheetApp.flush();
    return { operation: 'inserted', row: sheet.getLastRow() };
  }
}

/**
 * Delete a single record by ID or by planName + date
 */
function deleteSingleRecord(ss, sheetName, recordId) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIdx = headers.indexOf('id');
  if (idColIdx === -1) idColIdx = 0;

  var values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idColIdx]) === String(recordId)) {
      sheet.deleteRow(r + 1);
      SpreadsheetApp.flush();
      return true;
    }
  }
  return false;
}

/**
 * Ensure default starter accounts and master COGS exist if sheet is fresh
 */
function ensureDefaultsIfEmpty(ss) {
  var storeSheet = ss.getSheetByName('Toko_Cabang');
  if (storeSheet && storeSheet.getLastRow() <= 1) {
    var defaultStores = [
      { id: '1', code: 'CKR', name: 'TDN CKR', city: 'Cikarang', createdAt: '2026-01-01' }
    ];
    writeTableData(ss, 'Toko_Cabang', defaultStores);
  }

  var userSheet = ss.getSheetByName('Pengguna');
  if (userSheet && userSheet.getLastRow() <= 1) {
    var defaultUsers = [
      { id: '1', username: 'butcher_ckr', role: 'butcher', fullName: 'Butcher CKR', storeId: '1', storeName: 'TDN CKR', createdAt: '2026-01-01' },
      { id: '2', username: 'admin_ckr', role: 'admin', fullName: 'Admin CKR', storeId: '1', storeName: 'TDN CKR', createdAt: '2026-01-01' },
      { id: '3', username: 'md_pusat', role: 'md', fullName: 'MD Pusat', storeId: '', storeName: '', createdAt: '2026-01-01' }
    ];
    writeTableData(ss, 'Pengguna', defaultUsers);
  }

  var cogsSheet = ss.getSheetByName('Master_COGS');
  if (cogsSheet && cogsSheet.getLastRow() <= 1) {
    var defaultCogs = [
      { id: 'cogs_1', itemCode: 'DF-01', itemName: 'HQ 41/42/44/45 (Daging Fresh)', planName: 'HQ 41/42/44/45', cogsPerKg: 102000, defaultPricePerKg: 125000, sellingPricePerKg: 125000, category: 'DAGING FRESH', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
      { id: 'cogs_2', itemCode: 'DF-02', itemName: 'DG RNDG BEKU 1kg', planName: 'DG RNDG BEKU 1kg', cogsPerKg: 96000, defaultPricePerKg: 118000, sellingPricePerKg: 118000, category: 'DAGING FRESH', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
      { id: 'cogs_3', itemCode: 'SH-01', itemName: 'FQ 60 / SHANK (Daging Ekonomis)', planName: 'FQ 60 /SHANK', cogsPerKg: 85200, defaultPricePerKg: 105000, sellingPricePerKg: 105000, category: 'SHANKLE', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
      { id: 'cogs_4', itemCode: 'DP-01', itemName: 'D Premium Lokal (Sirloin/Ribeye)', planName: 'D premium lokal', cogsPerKg: 127000, defaultPricePerKg: 155000, sellingPricePerKg: 155000, category: 'DAGING PREMIUM', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
      { id: 'cogs_5', itemCode: 'DP-02', itemName: 'FRIBOY / Daging Prem 2', planName: 'FRIBOY / Daging Prem 2', cogsPerKg: 103000, defaultPricePerKg: 135000, sellingPricePerKg: 135000, category: 'DAGING PREMIUM', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
      { id: 'cogs_6', itemCode: 'RW-01', itemName: 'Rawon Curah (FQ 106/105)', planName: 'Rawon Curah (FQ 106/105)', cogsPerKg: 86500, defaultPricePerKg: 110000, sellingPricePerKg: 110000, category: 'RAWON', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
      { id: 'cogs_7', itemCode: 'DF-03', itemName: 'RENDANG BEKU CURAH', planName: 'RENDANG BEKU CURAH', cogsPerKg: 102550, defaultPricePerKg: 125000, sellingPricePerKg: 125000, category: 'DAGING FRESH', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
      { id: 'cogs_8', itemCode: 'DF-04', itemName: 'DAGING KHUSUS TDN', planName: 'DAGING KHUSUS', cogsPerKg: 96000, defaultPricePerKg: 115000, sellingPricePerKg: 115000, category: 'DAGING FRESH', updatedAt: '2026-08-01', updatedBy: 'MD Pusat' }
    ];
    writeTableData(ss, 'Master_COGS', defaultCogs);
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
