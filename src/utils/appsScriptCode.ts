/**
 * GOOGLE APPS SCRIPT DATABASE ENGINE FOR TDN MEAT TRACKER
 * -------------------------------------------------------------
 * Script ini dipasang di Google Spreadsheet via menu:
 * Ekstensi (Extensions) -> Apps Script
 *
 * Mendukung sinkronisasi realtime 2-arah antara akun Butcher, Admin Toko, dan MD Pusat.
 * Memungkinkan input data dengan nama dan jumlah yang sama (berdasarkan ID unik).
 */

export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * TDN MEAT TRACKER - GOOGLE APPS SCRIPT SPREADSHEET DATABASE
 * Terhubung Realtime dengan Akun Butcher, Admin Toko, dan MD Pusat
 */

var SHEETS_CONFIG = {
  'Daftar_Toko': [
    'ID', 'Kode_Cabang', 'Nama_Toko', 'Kota', 'Tanggal_Dibuat'
  ],
  'Pengguna': [
    'ID', 'Username', 'Role', 'Nama_Lengkap', 'ID_Toko', 'Nama_Toko', 'Tanggal_Dibuat'
  ],
  'Master_COGS': [
    'ID', 'Kode_Item', 'Nama_Bahan', 'Nama_Rencana', 'Kategori', 'HPP_Per_Kg', 'Harga_Jual_Per_Kg', 'Diupdate_Oleh', 'Terakhir_Update'
  ],
  'Thawing_Daging': [
    'ID', 'ID_Toko', 'Nama_Item', 'Status', 'Berat_Sebelum_Kg', 'Berat_Sesudah_Kg', 'Susut_Thawing_Kg', 'Persen_Susut', 'Jam_Mulai', 'Jam_Selesai', 'Durasi_Menit', 'Rencana_Pabrikasi', 'Tujuan_Buka', 'Nama_Butcher', 'Foto_Bukti', 'Waktu_Dibuat'
  ],
  'Pabrikasi_Segmen': [
    'ID', 'ID_Toko', 'ID_Item_Thawing', 'Nama_Item', 'Segmen_Potong', 'Target_Berat_Kg', 'Berat_Aktual_Kg', 'Susut_Proses_Kg', 'Sales_Kg', 'Status_Transfer', 'Waktu_Dibuat'
  ],
  'Closing_Harian': [
    'ID', 'ID_Toko', 'Tanggal', 'Kategori', 'Nama_Produk', 'Stok_Awal_Kg', 'Olahan_Baru_Kg', 'GRN_Masuk_Kg', 'Sales_Kg', 'Adjust_In_Kg', 'Adjust_Out_Kg', 'Sisa_Sistem_Kg', 'Sisa_Fisik_Kg', 'Susut_Jual_Kg', 'Tally_Kg', 'Bruto_Kg', 'Netto_Kg', 'Cost_Per_Kg', 'Sale_Per_Kg', 'GP_Percent', 'Catatan', 'Nama_Petugas', 'Foto_Bukti', 'Timestamp'
  ],
  'Penerimaan_GRN': [
    'ID', 'ID_Toko', 'Tanggal', 'Kategori_Laporan', 'Sub_Kategori', 'Kode_Item', 'PLU', 'Nama_Produk', 'Berat_Masuk_Kg', 'Supplier', 'No_Surat_Jalan', 'Diterima_Oleh', 'Timestamp'
  ],
  'Koreksi_Stok_Admin': [
    'ID', 'ID_Toko', 'Tanggal', 'Nama_Produk', 'Jenis_Koreksi', 'Berat_Kg', 'Alasan', 'Nama_Admin', 'Timestamp'
  ],
  'Laporan_Harian_Rekap': [
    'ID', 'ID_Toko', 'Nama_Toko', 'Tanggal', 'Total_Bahan_Baku_Kg', 'Total_Thawing_Kg', 'Total_Pabrikasi_Kg', 'Total_Susut_Proses_Kg', 'Total_Sales_Kg', 'Total_Sisa_Fisik_Kg', 'Persen_Susut_Thawing', 'Persen_Susut_Pabrikasi', 'Persen_Susut_Jual', 'Persen_Total_Susut', 'Status_Alert', 'Nama_Petugas', 'Timestamp'
  ],
  'Data_Susut': [
    'ID', 'Tanggal', 'Nama_Toko', 'ID_Toko', 'Nama_Plan', 'Susut_Proses_Kg', 'Susut_Jual_Kg', 'Waktu_Dibuat'
  ],
  'Konfigurasi_Sistem': [
    'Key', 'Value', 'Keterangan', 'Terakhir_Update'
  ]
};

function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || 'ping';

  if (action === 'ping') {
    return jsonResponse({
      status: 'success',
      message: 'TDN Spreadsheet Database Web App siap & online',
      timestamp: new Date().toISOString()
    });
  }

  if (action === 'getAll') {
    return jsonResponse({
      status: 'success',
      data: readAllSheetsData()
    });
  }

  if (action === 'getTable') {
    var tableName = params.table;
    if (!tableName) return jsonResponse({ status: 'error', message: 'Parameter table wajib diisi' });
    return jsonResponse({
      status: 'success',
      table: tableName,
      data: readSingleSheet(tableName)
    });
  }

  return jsonResponse({ status: 'error', message: 'Action tidak dikenal: ' + action });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        return jsonResponse({ status: 'error', message: 'Format JSON invalid: ' + err.message });
      }
    }

    var action = postData.action || 'ping';

    if (action === 'initSheets') {
      initAllDatabaseSheets();
      return jsonResponse({
        status: 'success',
        message: 'Seluruh struktur tab database spreadsheet berhasil dibuat & dirapikan!',
        sheets: Object.keys(SHEETS_CONFIG)
      });
    }

    if (action === 'syncAll') {
      var allData = postData.data || {};
      writeAllSheetsData(allData);
      return jsonResponse({
        status: 'success',
        message: 'Seluruh data berhasil disinkronkan ke Spreadsheet!',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'upsert') {
      var table = postData.table;
      var records = postData.records || (postData.record ? [postData.record] : []);
      if (!table || !SHEETS_CONFIG[table]) {
        return jsonResponse({ status: 'error', message: 'Tabel tidak valid: ' + table });
      }
      var count = upsertRecords(table, records);
      return jsonResponse({
        status: 'success',
        table: table,
        savedCount: count,
        message: 'Berhasil menyimpan ' + count + ' data ke tabel ' + table
      });
    }

    if (action === 'delete') {
      var table = postData.table;
      var idToDelete = postData.id;
      if (!table || !idToDelete) {
        return jsonResponse({ status: 'error', message: 'Table dan ID wajib disertakan untuk delete' });
      }
      var deleted = deleteRecordById(table, idToDelete);
      return jsonResponse({
        status: 'success',
        table: table,
        id: idToDelete,
        deleted: deleted
      });
    }

    return jsonResponse({ status: 'error', message: 'Action tidak didukung: ' + action });
  } catch (ex) {
    return jsonResponse({ status: 'error', message: ex.toString() });
  } finally {
    lock.releaseLock();
  }
}

function initAllDatabaseSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = Object.keys(SHEETS_CONFIG);

  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    var headers = SHEETS_CONFIG[name];
    var currentLastCol = sheet.getLastColumn();
    var currentLastRow = sheet.getLastRow();

    if (currentLastRow === 0 || currentLastCol === 0) {
      sheet.appendRow(headers);
    } else {
      var existingHeaders = sheet.getRange(1, 1, 1, Math.max(headers.length, currentLastCol)).getValues()[0];
      var matches = true;
      for (var h = 0; h < headers.length; h++) {
        if (existingHeaders[h] !== headers[h]) {
          matches = false;
          break;
        }
      }
      if (!matches) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    }

    // Styling Header
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1E293B');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    headerRange.setVerticalAlignment('middle');
    sheet.setRowHeight(1, 32);
    sheet.setFrozenRows(1);
  }
}

function readAllSheetsData() {
  var result = {};
  var names = Object.keys(SHEETS_CONFIG);
  for (var i = 0; i < names.length; i++) {
    result[names[i]] = readSingleSheet(names[i]);
  }
  return result;
}

function readSingleSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var list = [];

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var obj = {};
    var hasContent = false;
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      if (!key) continue;
      var val = row[c];
      if (val !== '' && val !== null && val !== undefined) {
        hasContent = true;
      }
      obj[key] = val;
    }
    if (hasContent && obj['ID']) {
      list.push(obj);
    }
  }
  return list;
}

function upsertRecords(tableName, records) {
  if (!records || records.length === 0) return 0;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tableName);
  if (!sheet) {
    initAllDatabaseSheets();
    sheet = ss.getSheetByName(tableName);
  }

  var headers = SHEETS_CONFIG[tableName];
  var lastRow = sheet.getLastRow();
  var lastCol = headers.length;

  var idRowMap = {};
  if (lastRow > 1) {
    var idColVals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var r = 0; r < idColVals.length; r++) {
      var existingId = String(idColVals[r][0] || '').trim();
      if (existingId) {
        idRowMap[existingId] = r + 2;
      }
    }
  }

  var newRowsToAppend = [];
  var updatedCount = 0;

  for (var i = 0; i < records.length; i++) {
    var item = records[i];
    if (!item) continue;
    var rowVals = mapObjectToRowValues(item, headers);
    var recordId = String(item.id || item.ID || '').trim();

    if (recordId && idRowMap[recordId]) {
      var targetRow = idRowMap[recordId];
      sheet.getRange(targetRow, 1, 1, lastCol).setValues([rowVals]);
      updatedCount++;
    } else {
      newRowsToAppend.push(rowVals);
      updatedCount++;
    }
  }

  if (newRowsToAppend.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRowsToAppend.length, lastCol).setValues(newRowsToAppend);
  }

  return updatedCount;
}

function writeAllSheetsData(data) {
  initAllDatabaseSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetMap = {
    'Daftar_Toko': data.stores || data.Daftar_Toko,
    'Pengguna': data.users || data.Pengguna,
    'Master_COGS': data.cogsMaster || data.Master_COGS,
    'Thawing_Daging': data.thawingItems || data.Thawing_Daging,
    'Pabrikasi_Segmen': data.fabricationSegments || data.Pabrikasi_Segmen,
    'Closing_Harian': data.closingPlanRecords || data.Closing_Harian,
    'Penerimaan_GRN': data.grnRecords || data.Penerimaan_GRN,
    'Koreksi_Stok_Admin': data.stockAdjustments || data.Koreksi_Stok_Admin,
    'Laporan_Harian_Rekap': data.dailyClosingReports || data.Laporan_Harian_Rekap,
    'Data_Susut': data.dataSusut || data.Data_Susut,
    'Konfigurasi_Sistem': data.lossConfig ? [
      { Key: 'maxProcessLossPercent', Value: data.lossConfig.maxProcessLossPercent, Keterangan: 'Maksimal Toleransi Susut Proses (%)', Terakhir_Update: new Date().toISOString() },
      { Key: 'maxSalesLossPercent', Value: data.lossConfig.maxSalesLossPercent, Keterangan: 'Maksimal Toleransi Susut Jual (%)', Terakhir_Update: new Date().toISOString() },
      { Key: 'maxDailyLossPercent', Value: data.lossConfig.maxDailyLossPercent, Keterangan: 'Maksimal Toleransi Total Susut Harian (%)', Terakhir_Update: new Date().toISOString() },
      { Key: 'safeThawingLossPercent', Value: data.lossConfig.safeThawingLossPercent, Keterangan: 'Ambang Batas Thawing Aman (%)', Terakhir_Update: new Date().toISOString() },
      { Key: 'salesPredictionKg', Value: data.lossConfig.salesPredictionKg, Keterangan: 'Target Estimasi Penjualan Harian (Kg)', Terakhir_Update: new Date().toISOString() }
    ] : []
  };

  for (var name in sheetMap) {
    var records = sheetMap[name];
    if (!records || !Array.isArray(records)) continue;

    var sheet = ss.getSheetByName(name);
    var headers = SHEETS_CONFIG[name];

    // Clear old data rows if any (keep headers)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }

    if (records.length > 0) {
      var rowsToSet = [];
      for (var r = 0; r < records.length; r++) {
        rowsToSet.push(mapObjectToRowValues(records[r], headers));
      }
      sheet.getRange(2, 1, rowsToSet.length, headers.length).setValues(rowsToSet);
    }
  }
}

function deleteRecordById(tableName, id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tableName);
  if (!sheet) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  var idVals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var r = 0; r < idVals.length; r++) {
    if (String(idVals[r][0] || '').trim() === String(id).trim()) {
      sheet.deleteRow(r + 2);
      return true;
    }
  }
  return false;
}

function mapObjectToRowValues(obj, headers) {
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    var val = getPropValue(obj, h);
    if (typeof val === 'string' && val.length > 45000) {
      val = val.substring(0, 45000);
    }
    row.push(val !== undefined && val !== null ? val : '');
  }
  return row;
}

function getPropValue(obj, headerName) {
  if (obj[headerName] !== undefined) return obj[headerName];

  var map = {
    'ID': ['id', 'ID'],
    'Kode_Cabang': ['code', 'storeCode', 'kode'],
    'Nama_Toko': ['name', 'storeName', 'nama'],
    'Kota': ['city', 'kota'],
    'Tanggal_Dibuat': ['createdAt', 'created_at'],
    'Username': ['username'],
    'Role': ['role'],
    'Nama_Lengkap': ['fullName', 'full_name'],
    'ID_Toko': ['storeId', 'store_id'],
    'Kode_Item': ['itemCode', 'item_code'],
    'Nama_Bahan': ['itemName', 'item_name', 'name'],
    'Nama_Rencana': ['planName', 'plan_name'],
    'Kategori': ['category', 'kategori'],
    'HPP_Per_Kg': ['cogsPerKg', 'cogs_per_kg'],
    'Harga_Jual_Per_Kg': ['defaultPricePerKg', 'sellingPricePerKg', 'default_price_per_kg'],
    'Diupdate_Oleh': ['updatedBy', 'updated_by'],
    'Terakhir_Update': ['updatedAt', 'updated_at'],
    'Status': ['status'],
    'Berat_Sebelum_Kg': ['weightBeforeThawing', 'weight_before_thawing'],
    'Berat_Sesudah_Kg': ['weightAfterThawing', 'weight_after_thawing'],
    'Susut_Thawing_Kg': ['shrinkageThawing', 'shrinkage_thawing'],
    'Persen_Susut': ['shrinkageThawingPercent', 'shrinkage_thawing_percent', 'susutPercent'],
    'Jam_Mulai': ['thawingStartTime', 'thawing_start_time'],
    'Jam_Selesai': ['thawingEndTime', 'thawing_end_time'],
    'Durasi_Menit': ['durationMinutes', 'duration_minutes'],
    'Rencana_Pabrikasi': ['plannedFabrication', 'planned_fabrication'],
    'Tujuan_Buka': ['openingPurpose', 'opening_purpose'],
    'Nama_Butcher': ['butcherName', 'butcher_name'],
    'Foto_Bukti': ['photoEvidence', 'photoUrl', 'image', 'photo_evidence'],
    'Waktu_Dibuat': ['createdAt', 'transferTimestamp', 'timestamp'],
    'ID_Item_Thawing': ['itemId', 'item_id'],
    'Segmen_Potong': ['segmentName', 'segment_name'],
    'Target_Berat_Kg': ['targetWeight', 'target_weight'],
    'Berat_Aktual_Kg': ['actualWeight', 'actual_weight'],
    'Susut_Proses_Kg': ['periodicShrinkage', 'periodic_shrinkage', 'susutProses', 'susut_proses'],
    'Sales_Kg': ['salesKg', 'sales_kg'],
    'Status_Transfer': ['isTransferred', 'is_transferred'],
    'Tanggal': ['date'],
    'Nama_Produk': ['productName', 'planName', 'name'],
    'Stok_Awal_Kg': ['openingStockKg', 'opening_stock_kg'],
    'Olahan_Baru_Kg': ['newProcessedKg', 'new_processed_kg'],
    'GRN_Masuk_Kg': ['grnKg', 'grn_kg', 'weightKg'],
    'Adjust_In_Kg': ['adjustInKg', 'adjust_in_kg'],
    'Adjust_Out_Kg': ['adjustOutKg', 'adjust_out_kg'],
    'Sisa_Sistem_Kg': ['closingStockBySystemKg', 'closing_stock_by_system_kg'],
    'Sisa_Fisik_Kg': ['actualClosingStockKg', 'actual_closing_stock_kg'],
    'Susut_Jual_Kg': ['susutJualKg', 'susut_jual_kg', 'susutJual'],
    'Tally_Kg': ['tallyKg', 'tally_kg'],
    'Bruto_Kg': ['brutoKg', 'bruto_kg'],
    'Netto_Kg': ['nettoKg', 'netto_kg'],
    'Cost_Per_Kg': ['costPerKg', 'cost_per_kg'],
    'Sale_Per_Kg': ['sellingPricePerKg', 'sale_per_kg'],
    'GP_Percent': ['gpPercent', 'gp_percent'],
    'Catatan': ['note', 'notes'],
    'Nama_Petugas': ['butcherName', 'adminName', 'receivedBy', 'petugas'],
    'Timestamp': ['timestamp', 'createdAt'],
    'Kategori_Laporan': ['reportCategory', 'report_category'],
    'Sub_Kategori': ['subCategory', 'sub_category'],
    'PLU': ['plu'],
    'Berat_Masuk_Kg': ['weightKg', 'weight_kg'],
    'Supplier': ['supplier'],
    'No_Surat_Jalan': ['noSuratJalan', 'no_surat_jalan'],
    'Diterima_Oleh': ['receivedBy', 'received_by'],
    'Jenis_Koreksi': ['type', 'jenis'],
    'Berat_Kg': ['weightKg', 'weight_kg'],
    'Alasan': ['reason', 'alasan'],
    'Nama_Admin': ['adminName', 'admin_name'],
    'Total_Bahan_Baku_Kg': ['totalWeightRaw', 'total_weight_raw'],
    'Total_Thawing_Kg': ['totalWeightAfterThawing', 'total_weight_after_thawing'],
    'Total_Pabrikasi_Kg': ['totalWeightFabricated', 'total_weight_fabricated'],
    'Total_Susut_Proses_Kg': ['totalPeriodicShrinkage', 'total_periodic_shrinkage'],
    'Total_Sales_Kg': ['totalSales', 'total_sales'],
    'Total_Sisa_Fisik_Kg': ['totalEndStock', 'total_end_stock'],
    'Persen_Susut_Thawing': ['thawingLossPercent', 'thawing_loss_percent'],
    'Persen_Susut_Pabrikasi': ['fabricationLossPercent', 'fabrication_loss_percent'],
    'Persen_Susut_Jual': ['salesLossPercent', 'sales_loss_percent'],
    'Persen_Total_Susut': ['overallLossPercent', 'overall_loss_percent'],
    'Status_Alert': ['statusAlert', 'status_alert'],
    'Nama_Plan': ['planName', 'plan_name'],
    'Key': ['key', 'Key'],
    'Value': ['value', 'Value'],
    'Keterangan': ['keterangan', 'description', 'Deskripsi']
  };

  var possibleKeys = map[headerName] || [];
  for (var k = 0; k < possibleKeys.length; k++) {
    var key = possibleKeys[k];
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return '';
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
