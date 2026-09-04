/**
 * Google Apps Script Backend Code for TDN Meat Tracker
 * 
 * Instructions:
 * 1. Open your Google Spreadsheet (e.g. LAPORAN DAGING / TDN Database)
 * 2. Click Extensions > Apps Script (Ekstensi > Apps Script)
 * 3. Replace all code in Code.gs with this script
 * 4. Click Deploy > New deployment (Terapkan > Terapkan baru)
 * 5. Select type: Web app (Aplikasi web)
 * 6. Set:
 *    - Description: TDN Meat Tracker API v2 (Multi-Device Multi-User)
 *    - Execute as: Me (your_email@gmail.com)
 *    - Who has access: Anyone (Siapa saja)
 * 7. Click Deploy, Authorize access, and copy the Web App URL (https://script.google.com/macros/s/.../exec)
 * 8. Paste the Web App URL into the TDN Meat Tracker Settings / Sync dialog.
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * TDN MEAT TRACKER - GOOGLE APPS SCRIPT MULTI-DEVICE CLOUD DATABASE ENGINE
 * =========================================================================
 * Version: 2.5.0
 * Supports: Real-time Multi-Device Sync (Laptop + HP + Tablet),
 *           Concurrent Lock Protection, Automatic Schema Creation & Migration.
 */

// Schema & Column Headers Definitions for all 8 Tables
var TABLE_SCHEMAS = {
  'Toko_Cabang': ['id', 'code', 'name', 'city', 'createdAt'],
  'Pengguna': ['id', 'username', 'role', 'fullName', 'storeId', 'storeName', 'createdAt'],
  'Master_COGS': ['id', 'itemCode', 'itemName', 'planName', 'cogsPerKg', 'defaultPricePerKg', 'sellingPricePerKg', 'category', 'updatedAt', 'updatedBy'],
  'Thawing_Daging': ['id', 'storeId', 'name', 'pabrikasiCategory', 'plannedFabrication', 'openingPurpose', 'status', 'weightBeforeThawing', 'weightAfterThawing', 'shrinkageThawing', 'shrinkageThawingPercent', 'susutJualKg', 'salesKg', 'thawingStartTime', 'thawingEndTime', 'durationMinutes', 'butcherName', 'isCarryover', 'image', 'createdAt'],
  'Pabrikasi_Segmen': ['id', 'storeId', 'itemId', 'itemName', 'segmentName', 'targetWeight', 'actualWeight', 'periodicShrinkage', 'salesKg', 'plannedFabrication', 'openingPurpose', 'isTransferred', 'originalPurpose', 'transferTimestamp', 'createdAt'],
  'Closing_Fisik': ['id', 'storeId', 'date', 'planName', 'category', 'openingStockKg', 'newProcessedKg', 'salesKg', 'adjustInKg', 'adjustOutKg', 'closingStockBySystemKg', 'actualClosingStockKg', 'susutJualKg', 'photoUrl', 'photoCaption', 'note', 'butcherName', 'timestamp'],
  'Laporan_Closing': ['id', 'storeId', 'storeName', 'date', 'totalWeightRaw', 'totalWeightAfterThawing', 'totalWeightFabricated', 'totalPeriodicShrinkage', 'totalSales', 'totalEndStock', 'thawingLossPercent', 'fabricationLossPercent', 'salesLossPercent', 'overallLossPercent', 'statusAlert', 'closingPhotoUrl', 'butcherName', 'createdAt'],
  'Koreksi_Stok': ['id', 'storeId', 'planName', 'type', 'weightKg', 'reason', 'adminName', 'createdAt'],
  'Loss_Config': ['id', 'maxProcessLossPercent', 'maxSalesLossPercent', 'maxDailyLossPercent', 'safeThawingLossPercent', 'safeFabricationLossPercent', 'salesPredictionKg']
};

function resolveGASSheetName(table) {
  var map = {
    'thawing_items': 'Thawing_Daging', 'thawingItems': 'Thawing_Daging',
    'fabrication_segments': 'Pabrikasi_Segmen', 'fabricationSegments': 'Pabrikasi_Segmen',
    'closing_plan_records': 'Closing_Fisik', 'closingPlanRecords': 'Closing_Fisik',
    'daily_closing_reports': 'Laporan_Closing', 'dailyClosingReports': 'Laporan_Closing', 'daily_reports': 'Laporan_Closing',
    'stock_adjustments': 'Koreksi_Stok', 'stockAdjustments': 'Koreksi_Stok',
    'stores': 'Toko_Cabang', 'stores_list': 'Toko_Cabang',
    'users': 'Pengguna', 'users_list': 'Pengguna',
    'cogs_master': 'Master_COGS', 'cogsMaster': 'Master_COGS',
    'loss_config': 'Loss_Config', 'lossConfig': 'Loss_Config'
  };
  return map[table] || table;
}

/**
 * Handle HTTP GET Requests (Read Data)
 * Examples:
 *   ?action=ping
 *   ?action=getAllData
 *   ?action=getTable&table=Thawing_Daging
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAllData';
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // 1. PING Test
    if (action === 'ping') {
      return jsonResponse({
        status: 'ONLINE',
        message: 'TDN Google Apps Script API is active & reachable',
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        timestamp: new Date().toISOString()
      });
    }

    // 2. GET ALL DATA (Primary synchronization endpoint for Laptop & HP)
    if (action === 'getAllData') {
      var allData = {
        stores: readTableData(ss, 'Toko_Cabang'),
        users: readTableData(ss, 'Pengguna'),
        cogsMaster: readTableData(ss, 'Master_COGS'),
        thawingItems: readTableData(ss, 'Thawing_Daging'),
        fabricationSegments: readTableData(ss, 'Pabrikasi_Segmen'),
        closingPlanRecords: readTableData(ss, 'Closing_Fisik'),
        dailyClosingReports: readTableData(ss, 'Laporan_Closing'),
        stockAdjustments: readTableData(ss, 'Koreksi_Stok'),
        lossConfig: readConfigData(ss)
      };

      // Seed default Master COGS or default store if completely empty
      ensureDefaultsIfEmpty(ss, allData);

      return jsonResponse({
        success: true,
        action: 'getAllData',
        data: allData,
        timestamp: new Date().toISOString()
      });
    }

    // 3. GET SINGLE TABLE
    if (action === 'getTable') {
      var tableName = e.parameter.table;
      if (!tableName) {
        return jsonResponse({ success: false, error: 'Parameter "table" is required' });
      }
      var tableItems = readTableData(ss, tableName);
      return jsonResponse({
        success: true,
        table: tableName,
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
 * Handle HTTP POST Requests (Write Data with Concurrency Lock)
 */
function doPost(e) {
  // Use ScriptLock with 30-second timeout to prevent race condition between HP and Laptop!
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      return jsonResponse({
        success: false,
        error: 'Database is currently busy with another device operation. Please try again in a few seconds.'
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

    // 1. PUSH / UPDATE ENTIRE TABLE
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

    // 2. UPSERT RECORD (Smart atomic update row by ID without clobbering whole sheet)
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
        recordId: record.id,
        operation: result.operation,
        timestamp: new Date().toISOString()
      });
    }

    // 3. BATCH UPSERT RECORDS
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

    // 4. DELETE SINGLE RECORD BY ID
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

    // 5. BULK SAVE ALL TABLES (e.g. Initial migration or full sync)
    if (action === 'saveAllData') {
      var data = payload.data || {};
      if (data.stores) writeTableData(ss, 'Toko_Cabang', data.stores);
      if (data.users) writeTableData(ss, 'Pengguna', data.users);
      if (data.cogsMaster) writeTableData(ss, 'Master_COGS', data.cogsMaster);
      if (data.thawingItems) writeTableData(ss, 'Thawing_Daging', data.thawingItems);
      if (data.fabricationSegments) writeTableData(ss, 'Pabrikasi_Segmen', data.fabricationSegments);
      if (data.closingPlanRecords) writeTableData(ss, 'Closing_Fisik', data.closingPlanRecords);
      if (data.dailyClosingReports) writeTableData(ss, 'Laporan_Closing', data.dailyClosingReports);
      if (data.stockAdjustments) writeTableData(ss, 'Koreksi_Stok', data.stockAdjustments);
      if (data.lossConfig) writeConfigData(ss, data.lossConfig);

      return jsonResponse({
        success: true,
        action: 'saveAllData',
        timestamp: new Date().toISOString()
      });
    }

    // 6. RESET TRANSACTION DATA (Keep Toko, Pengguna, and COGS intact)
    if (action === 'resetData') {
      var transTables = ['Thawing_Daging', 'Pabrikasi_Segmen', 'Closing_Fisik', 'Laporan_Closing', 'Koreksi_Stok'];
      for (var t = 0; t < transTables.length; t++) {
        clearTableData(ss, transTables[t]);
      }
      return jsonResponse({
        success: true,
        action: 'resetData',
        clearedTables: transTables,
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

/**
 * Get or create sheet with headers and visual formatting
 */
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var defaultHeaders = TABLE_SCHEMAS[sheetName] || ['id', 'createdAt'];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Write headers
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    // Format header row
    var headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  } else {
    // Ensure header row exists
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
    // Skip completely empty rows
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

      // Format Date objects to ISO string
      if (rawVal instanceof Date) {
        rawVal = rawVal.toISOString();
      }
      
      // Parse Booleans if stored as string
      if (rawVal === 'YA' || rawVal === 'TRUE' || rawVal === true) {
        item[headerKey] = true;
      } else if (rawVal === 'TIDAK' || rawVal === 'FALSE' || rawVal === false) {
        item[headerKey] = false;
      } else {
        item[headerKey] = rawVal;
      }
    }

    if (item.id || item.code || item.username || item.name || item.itemCode || item.planName) {
      rows.push(item);
    }
  }

  return rows;
}

/**
 * Write full table data to sheet (Replaces existing content cleanly)
 */
function writeTableData(ss, sheetName, items, customHeaders) {
  var sheet = getOrCreateSheet(ss, sheetName);
  var headers = customHeaders || TABLE_SCHEMAS[sheetName];

  if (!headers || headers.length === 0) {
    if (items.length > 0) {
      headers = Object.keys(items[0]);
    } else {
      headers = ['id', 'createdAt'];
    }
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
 * Atomic Upsert of a single record by ID without replacing the whole sheet
 */
function upsertSingleRecord(ss, sheetName, record) {
  if (!record || (!record.id && !record.planName)) return { operation: 'skipped', error: 'No ID or PlanName' };
  var sheet = getOrCreateSheet(ss, sheetName);
  var headers = TABLE_SCHEMAS[sheetName] || Object.keys(record);

  var lastRow = sheet.getLastRow();
  var values = lastRow > 1 ? sheet.getRange(1, 1, lastRow, headers.length).getValues() : [headers];
  var idColIdx = headers.indexOf('id');
  if (idColIdx === -1) idColIdx = 0;
  var storeColIdx = headers.indexOf('storeId');
  var planColIdx = headers.indexOf('planName');
  var dateColIdx = headers.indexOf('date');

  var rowIndexToUpdate = -1;
  for (var r = 1; r < values.length; r++) {
    var rowId = String(values[r][idColIdx] || '');
    var rowStore = storeColIdx >= 0 ? String(values[r][storeColIdx] || '') : '';
    var rowPlan = planColIdx >= 0 ? String(values[r][planColIdx] || '') : '';
    var rowDate = dateColIdx >= 0 ? String(values[r][dateColIdx] || '') : '';

    if (record.id && rowId === String(record.id)) {
      rowIndexToUpdate = r + 1; // 1-based index
      break;
    }
    // For Closing_Fisik, also match by store + plan + date
    if (sheetName === 'Closing_Fisik' && record.planName && rowStore === String(record.storeId) && rowPlan.toLowerCase() === String(record.planName).toLowerCase() && (!record.date || !rowDate || rowDate === String(record.date))) {
      rowIndexToUpdate = r + 1;
      break;
    }
  }

  var rowData = [];
  for (var h = 0; h < headers.length; h++) {
    var val = record[headers[h]];
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
 * Delete a single record by ID
 */
function deleteSingleRecord(ss, sheetName, recordId) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIdx = headers.indexOf('id');
  if (idColIdx === -1) idColIdx = 0;

  var values = sheet.getRange(1, idColIdx + 1, lastRow, 1).getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(recordId)) {
      sheet.deleteRow(r + 1);
      SpreadsheetApp.flush();
      return true;
    }
  }
  return false;
}

/**
 * Clear data rows in sheet
 */
function clearTableData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    SpreadsheetApp.flush();
  }
}

/**
 * Read Loss Config
 */
function readConfigData(ss) {
  var rows = readTableData(ss, 'Loss_Config');
  if (rows.length > 0) {
    var r = rows[0];
    return {
      maxProcessLossPercent: Number(r.maxProcessLossPercent) || 1.0,
      maxSalesLossPercent: Number(r.maxSalesLossPercent) || 1.0,
      maxDailyLossPercent: Number(r.maxDailyLossPercent) || 2.0,
      safeThawingLossPercent: Number(r.safeThawingLossPercent) || 1.0,
      safeFabricationLossPercent: Number(r.safeFabricationLossPercent) || 1.0,
      salesPredictionKg: Number(r.salesPredictionKg) || 40.0,
    };
  }
  return {
    maxProcessLossPercent: 1.0,
    maxSalesLossPercent: 1.0,
    maxDailyLossPercent: 2.0,
    safeThawingLossPercent: 1.0,
    safeFabricationLossPercent: 1.0,
    salesPredictionKg: 40.0,
  };
}

/**
 * Write Loss Config
 */
function writeConfigData(ss, config) {
  var sheet = getOrCreateSheet(ss, 'Loss_Config');
  var headers = TABLE_SCHEMAS['Loss_Config'];
  var row = [
    'config_1',
    config.maxProcessLossPercent || 1.0,
    config.maxSalesLossPercent || 1.0,
    config.maxDailyLossPercent || 2.0,
    config.safeThawingLossPercent || 1.0,
    config.safeFabricationLossPercent || 1.0,
    config.salesPredictionKg || 40.0
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, 1, headers.length).setValues([row]);
  SpreadsheetApp.flush();
}

/**
 * Ensure default starter accounts and master COGS exist if sheet is fresh
 */
function ensureDefaultsIfEmpty(ss, allData) {
  if (allData.stores.length === 0) {
    var defaultStores = [
      { id: '1', code: 'CKR', name: 'TDN CKR', city: 'Cikarang', createdAt: '2026-01-01' }
    ];
    writeTableData(ss, 'Toko_Cabang', defaultStores);
    allData.stores = defaultStores;
  }

  if (allData.users.length === 0) {
    var defaultUsers = [
      { id: '1', username: 'butcher_ckr', role: 'butcher', fullName: 'Butcher CKR', storeId: '1', storeName: 'TDN CKR', createdAt: '2026-01-01' },
      { id: '2', username: 'admin_ckr', role: 'admin', fullName: 'Admin CKR', storeId: '1', storeName: 'TDN CKR', createdAt: '2026-01-01' },
      { id: '3', username: 'md_pusat', role: 'md', fullName: 'MD Pusat', storeId: '', storeName: '', createdAt: '2026-01-01' }
    ];
    writeTableData(ss, 'Pengguna', defaultUsers);
    allData.users = defaultUsers;
  }

  if (allData.cogsMaster.length === 0) {
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
    allData.cogsMaster = defaultCogs;
  }
}

/**
 * Format JSON HTTP response with CORS headers
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
