import XLSX from 'xlsx-js-style';
import {
  Store,
  ThawingItem,
  FabricationSegment,
  StockAdjustment,
  ClosingPlanRecord,
  CogsMaster,
  DailyClosingReport
} from '../types';
import { matchStoreEntity } from './storeHelper';
import {
  calculateCategoryAggregates,
  getCogsForCategory,
  getThawingItemColumn,
} from './reportCalculations';

/**
 * Standard default cuts catalog for consistent report structure
 */
export const STANDARD_CUT_PLANS = [
  { name: 'Daging Rendang Shankle', category: 'SHANKLE', defaultCogs: 85200 },
  { name: 'D.sapi pot. rdang', category: 'DAGING FRESH', defaultCogs: 102000 },
  { name: 'D premium lokal', category: 'DAGING PREMIUM', defaultCogs: 127000 },
  { name: 'D.r. fresh member', category: 'DAGING FRESH', defaultCogs: 102000 },
  { name: 'Rawon Curah', category: 'RAWON', defaultCogs: 86500 },
  { name: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM', defaultCogs: 103000 },
];

/**
 * Helper to lookup COGS from master or default
 */
export const lookupCogs = (cogsList: CogsMaster[], name: string, category: string): number => {
  const safeName = (name || '').toLowerCase();
  const safeCat = (category || '').toLowerCase();
  const found = (cogsList || []).find(
    (c) =>
      (c.itemName || (c as any).planName || '').toLowerCase() === safeName ||
      (c.category || '').toLowerCase() === safeCat
  );
  if (found && found.cogsPerKg > 0) return found.cogsPerKg;
  const standard = STANDARD_CUT_PLANS.find((p) => (p.name || '').toLowerCase() === safeName);
  if (standard) return standard.defaultCogs;
  if (safeCat.includes('premium')) return 127000;
  if (safeCat.includes('rawon')) return 86500;
  if (safeCat.includes('shankle')) return 85200;
  return 102000;
};

// Helper: Format Day of Week in Indonesian
const getDayNameIndo = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'MINGGU';
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    return days[d.getDay()] || 'MINGGU';
  } catch {
    return 'MINGGU';
  }
};

// Helper: Short date string (e.g., 20-Aug)
const getShortDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
};

// ============================================================================
// STYLING ENGINE FOR XLSX-JS-STYLE
// ============================================================================
const BORDER_THIN = {
  top: { style: 'thin', color: { rgb: 'D9D9D9' } },
  bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
  left: { style: 'thin', color: { rgb: 'D9D9D9' } },
  right: { style: 'thin', color: { rgb: 'D9D9D9' } }
};

const BORDER_DARK_THIN = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } }
};

const BORDER_TOTAL_DOUBLE = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'double', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } }
};

export interface StyleOptions {
  bg?: string; // Hex without #
  color?: string; // Font color hex
  bold?: boolean;
  fontSize?: number;
  fontName?: string;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'center' | 'bottom';
  border?: 'thin' | 'darkThin' | 'double' | 'none';
  numFmt?: string;
  wrapText?: boolean;
}

/**
 * Clean hex string removing # prefix
 */
function cleanHex(hex?: string): string | undefined {
  if (!hex) return undefined;
  return hex.replace(/^#/, '').toUpperCase();
}

/**
 * Write a cell value with optional formula, type, and styling
 */
export function writeCell(
  ws: any,
  r: number,
  c: number,
  val: any,
  formula?: string,
  styleOptions?: StyleOptions
) {
  const cellRef = XLSX.utils.encode_cell({ r, c });
  const isNumber = typeof val === 'number';
  const cell: any = {
    t: isNumber ? 'n' : 's',
    v: val === undefined || val === null ? '' : val,
  };
  if (formula) {
    cell.f = formula;
  }
  if (styleOptions?.numFmt) {
    cell.z = styleOptions.numFmt;
  }

  // Apply style object
  const s: any = {
    font: {
      name: styleOptions?.fontName || 'Calibri',
      sz: styleOptions?.fontSize || 10,
      bold: !!styleOptions?.bold,
      color: styleOptions?.color ? { rgb: cleanHex(styleOptions.color) } : { rgb: '000000' },
    },
    alignment: {
      horizontal: styleOptions?.align || (isNumber ? 'right' : 'left'),
      vertical: styleOptions?.vAlign || 'center',
      wrapText: !!styleOptions?.wrapText,
    },
  };

  if (styleOptions?.bg) {
    s.fill = {
      patternType: 'solid',
      fgColor: { rgb: cleanHex(styleOptions.bg) },
    };
  }

  if (styleOptions?.border === 'double') {
    s.border = BORDER_TOTAL_DOUBLE;
  } else if (styleOptions?.border === 'darkThin') {
    s.border = BORDER_DARK_THIN;
  } else if (styleOptions?.border === 'thin') {
    s.border = BORDER_THIN;
  }

  cell.s = s;
  ws[cellRef] = cell;

  // Update worksheet bounds
  if (!ws['!ref']) {
    ws['!ref'] = XLSX.utils.encode_range({ s: { r, c }, e: { r, c } });
  } else {
    const range = XLSX.utils.decode_range(ws['!ref']);
    if (r < range.s.r) range.s.r = r;
    if (c < range.s.c) range.s.c = c;
    if (r > range.e.r) range.e.r = r;
    if (c > range.e.c) range.e.c = c;
    ws['!ref'] = XLSX.utils.encode_range(range);
  }
}

/**
 * Apply styling to an existing cell
 */
export function setCellStyle(ws: any, r: number, c: number, options: StyleOptions) {
  const cellRef = XLSX.utils.encode_cell({ r, c });
  if (!ws[cellRef]) {
    writeCell(ws, r, c, '', undefined, options);
    return;
  }
  const cell = ws[cellRef];
  const s = cell.s || {};
  s.font = {
    name: options.fontName || s.font?.name || 'Calibri',
    sz: options.fontSize || s.font?.sz || 10,
    bold: options.bold !== undefined ? options.bold : s.font?.bold,
    color: options.color ? { rgb: cleanHex(options.color) } : s.font?.color || { rgb: '000000' }
  };
  s.alignment = {
    horizontal: options.align || s.alignment?.horizontal || 'left',
    vertical: options.vAlign || s.alignment?.vertical || 'center',
    wrapText: options.wrapText !== undefined ? options.wrapText : s.alignment?.wrapText
  };
  if (options.bg) {
    s.fill = { patternType: 'solid', fgColor: { rgb: cleanHex(options.bg) } };
  }
  if (options.border === 'double') {
    s.border = BORDER_TOTAL_DOUBLE;
  } else if (options.border === 'darkThin') {
    s.border = BORDER_DARK_THIN;
  } else if (options.border === 'thin') {
    s.border = BORDER_THIN;
  }
  if (options.numFmt) {
    cell.z = options.numFmt;
  }
  cell.s = s;
}

/**
 * Apply styling to a rectangular range of cells and optionally merge
 */
export function styleRange(
  ws: any,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  options: StyleOptions,
  merge: boolean = false
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      setCellStyle(ws, r, c, options);
    }
  }
  if (merge) {
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({
      s: { r: startRow, c: startCol },
      e: { r: endRow, c: endCol }
    });
  }
}

// ============================================================================
// EXPORT 1: ADMIN STORE DAILY REPORT (LAP.DAGING, PROSES, SALES DAGING)
// ============================================================================
export function exportStoreDailyLaporanExcel(
  store: Store,
  dateStr: string,
  items: ThawingItem[],
  segments: FabricationSegment[],
  adjustments: StockAdjustment[],
  closingRecords: ClosingPlanRecord[],
  cogsList: CogsMaster[]
) {
  const wb = XLSX.utils.book_new();
  const dayName = getDayNameIndo(dateStr);
  const shortDate = getShortDate(dateStr);

  const todayItems = items.filter((i) => !i.isCarryover);
  const carryoverItems = items.filter((i) => i.isCarryover);

  // Partition today items strictly into the 8 columns (mutually exclusive)
  const col1Items = todayItems.filter((i) => getThawingItemColumn(i) === 1);
  const col2Items = todayItems.filter((i) => getThawingItemColumn(i) === 2);
  const col3Items = todayItems.filter((i) => getThawingItemColumn(i) === 3);
  const col4Items = todayItems.filter((i) => getThawingItemColumn(i) === 4);
  const col5Items = todayItems.filter((i) => getThawingItemColumn(i) === 5);
  const col6Items = todayItems.filter((i) => getThawingItemColumn(i) === 6);
  const col7Items = todayItems.filter((i) => getThawingItemColumn(i) === 7);
  const col8Items = todayItems.filter((i) => getThawingItemColumn(i) === 8);

  const getColTotals = (subItems: ThawingItem[]) => {
    const bahan = subItems.reduce((s, i) => s + (i.weightBeforeThawing || 0), 0);
    const hasil = subItems.reduce((s, i) => s + (i.weightAfterThawing !== null && i.weightAfterThawing !== undefined ? i.weightAfterThawing : i.weightBeforeThawing), 0);
    const susut = Math.max(0, bahan - hasil);
    return { bahan, hasil, susut };
  };

  const col1Totals = getColTotals(col1Items);
  const col2Totals = getColTotals(col2Items);
  const col3Totals = getColTotals(col3Items);
  const col4Totals = getColTotals(col4Items);
  const col5Totals = getColTotals(col5Items);
  const col6Totals = getColTotals(col6Items);
  const col7Totals = getColTotals(col7Items);
  const col8Totals = getColTotals(col8Items);

  // Group items by the 4 main operational meat categories for Section 2
  const dgFreshItems = [...col1Items, ...col2Items, ...col3Items];
  const dgPremItems = [...col4Items, ...col5Items];
  const rawonItems = [...col6Items, ...col7Items];
  const shankleItems = [...col8Items];

  // COGS prices
  const cogsFresh = lookupCogs(cogsList, dgFreshItems[0]?.name || 'D.sapi pot. rdang', 'DAGING FRESH');
  const cogsPrem = lookupCogs(cogsList, dgPremItems[0]?.name || 'D premium lokal', 'DAGING PREMIUM');
  const cogsRawon = lookupCogs(cogsList, rawonItems[0]?.name || 'Rawon Curah', 'RAWON');
  const cogsShank = lookupCogs(cogsList, shankleItems[0]?.name || 'D fresh ekonomis', 'SHANKLE');

  // Operational Weights
  const dgFreshBahan = dgFreshItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
  const dgFreshHasil = dgFreshItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
  const dgFreshSusutJual = closingRecords.filter((c) => (c.planName || '').toLowerCase().includes('rdang') || (c.category || '').toUpperCase().includes('FRESH')).reduce((s, c) => s + c.susutJualKg, 0);

  const dgPremBahan = dgPremItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
  const dgPremHasil = dgPremItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
  const dgPremSusutJual = closingRecords.filter((c) => (c.planName || '').toLowerCase().includes('prem')).reduce((s, c) => s + c.susutJualKg, 0);

  const rawonBahan = rawonItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
  const rawonHasil = rawonItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
  const rawonSusutJual = closingRecords.filter((c) => (c.planName || '').toLowerCase().includes('rawon')).reduce((s, c) => s + c.susutJualKg, 0);

  const shankBahan = shankleItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
  const shankHasil = shankleItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
  const shankSusutJual = closingRecords.filter((c) => (c.planName || '').toLowerCase().includes('shank') || (c.planName || '').toLowerCase().includes('ekonomis')).reduce((s, c) => s + c.susutJualKg, 0);

  // =========================================================================
  // SHEET 1: LAP.DAGING (Bagian 1: Matriks Proses Produksi Tally/Susut & Bagian 2: Laporan Modal/COGS)
  // =========================================================================
  const wsLapDaging: any = {};
  wsLapDaging['!cols'] = [
    { wch: 9 },   // Col A (0) - SUSUT (HQ)
    { wch: 9 },   // Col B (1) - TALLY
    { wch: 9 },   // Col C (2) - NETTO
    { wch: 9 },   // Col D (3) - SUSUT (DG RNDG)
    { wch: 9 },   // Col E (4) - TALLY
    { wch: 9 },   // Col F (5) - NETTO
    { wch: 9 },   // Col G (6) - SUSUT (DG HUSUS)
    { wch: 9 },   // Col H (7) - TALLY
    { wch: 9 },   // Col I (8) - NETTO
    { wch: 3 },   // Col J (9) - GAP
    { wch: 9 },   // Col K (10) - SUSUT (Prem 2)
    { wch: 9 },   // Col L (11) - TALLY
    { wch: 9 },   // Col M (12) - NETTO
    { wch: 9 },   // Col N (13) - SUSUT (FRIBOY)
    { wch: 9 },   // Col O (14) - TALLY
    { wch: 9 },   // Col P (15) - NETTO
    { wch: 3 },   // Col Q (16) - GAP
    { wch: 9 },   // Col R (17) - SUSUT (RAWON BEKU)
    { wch: 9 },   // Col S (18) - TALLY
    { wch: 9 },   // Col T (19) - NETTO
    { wch: 9 },   // Col U (20) - SUSUT (RAWON FRESH A)
    { wch: 9 },   // Col V (21) - TALLY
    { wch: 9 },   // Col W (22) - NETTO
    { wch: 3 },   // Col X (23) - GAP
    { wch: 9 },   // Col Y (24) - SUSUT (FQ 60 / SHANK)
    { wch: 9 },   // Col Z (25) - TALLY
    { wch: 9 },   // Col AA (26) - NETTO
  ];

  // -------------------------------------------------------------------------
  // BAGIAN 1: PROSES TDN [STORE] (MATRIKS TALLY / SUSUT / NETTO)
  // -------------------------------------------------------------------------
  // Row 0: Title Header
  writeCell(wsLapDaging, 0, 0, `PROSES TDN ${store.name.toUpperCase()}`, undefined, {
    bg: 'FFFFFF',
    color: '000000',
    bold: true,
    fontSize: 12,
    align: 'center',
    border: 'darkThin'
  });
  styleRange(wsLapDaging, 0, 0, 0, 26, { bg: 'FFFFFF', color: '000000', bold: true, fontSize: 12, align: 'center', border: 'darkThin' }, true);

  // Row 1: Top Major Category Banner (Red #FF0000)
  // DAGING PRESH (Cols 0-8)
  writeCell(wsLapDaging, 1, 0, 'DAGING PRESH', undefined, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' });
  styleRange(wsLapDaging, 1, 0, 1, 8, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' }, true);
  // DAGING PREMIUM (Cols 10-12)
  writeCell(wsLapDaging, 1, 10, 'DAGING PREMIUM', undefined, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' });
  styleRange(wsLapDaging, 1, 10, 1, 12, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' }, true);
  // DAGING PREMIUM (Cols 13-15)
  writeCell(wsLapDaging, 1, 13, 'DAGING PREMIUM', undefined, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' });
  styleRange(wsLapDaging, 1, 13, 1, 15, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' }, true);
  // RAWON FRESH (Cols 17-22)
  writeCell(wsLapDaging, 1, 17, 'RAWON FRESH', undefined, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' });
  styleRange(wsLapDaging, 1, 17, 1, 22, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' }, true);
  // DAGING FRESH (Cols 24-26)
  writeCell(wsLapDaging, 1, 24, 'DAGING FRESH', undefined, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' });
  styleRange(wsLapDaging, 1, 24, 1, 26, { bg: 'FF0000', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' }, true);

  // Row 2: Sub-Category Headers (Colored)
  // HQ 41/42/44/45 (Cols 0-2, #B4C6E7)
  writeCell(wsLapDaging, 2, 0, 'HQ 41/42/44/45', undefined, { bg: 'B4C6E7', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' });
  styleRange(wsLapDaging, 2, 0, 2, 2, { bg: 'B4C6E7', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);
  // DG RNDG BEKU 1kg (Cols 3-5, #B4C6E7)
  writeCell(wsLapDaging, 2, 3, 'DG RNDG BEKU 1kg', undefined, { bg: 'B4C6E7', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' });
  styleRange(wsLapDaging, 2, 3, 2, 5, { bg: 'B4C6E7', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);
  // DAGING HUSUS (Cols 6-8, #B4C6E7)
  writeCell(wsLapDaging, 2, 6, 'DAGING HUSUS', undefined, { bg: 'B4C6E7', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' });
  styleRange(wsLapDaging, 2, 6, 2, 8, { bg: 'B4C6E7', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);
  // DG Prem 2 (Cols 10-12, #FCE4D6)
  writeCell(wsLapDaging, 2, 10, 'DG Prem 2', undefined, { bg: 'FCE4D6', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' });
  styleRange(wsLapDaging, 2, 10, 2, 12, { bg: 'FCE4D6', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);
  // FRIBOY (Cols 13-15, #FCE4D6)
  writeCell(wsLapDaging, 2, 13, 'FRIBOY', undefined, { bg: 'FCE4D6', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' });
  styleRange(wsLapDaging, 2, 13, 2, 15, { bg: 'FCE4D6', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);
  // RAWON BEKU (Cols 17-19, #FFF2CC)
  writeCell(wsLapDaging, 2, 17, 'RAWON BEKU', undefined, { bg: 'FFF2CC', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' });
  styleRange(wsLapDaging, 2, 17, 2, 19, { bg: 'FFF2CC', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);
  // RAWON FRESH A (Cols 20-22, #FFF2CC)
  writeCell(wsLapDaging, 2, 20, 'RAWON FRESH A', undefined, { bg: 'FFF2CC', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' });
  styleRange(wsLapDaging, 2, 20, 2, 22, { bg: 'FFF2CC', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);
  // FQ 60 /SHANK (Cols 24-26, #E2EFDA)
  writeCell(wsLapDaging, 2, 24, 'FQ 60 /SHANK', undefined, { bg: 'E2EFDA', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' });
  styleRange(wsLapDaging, 2, 24, 2, 26, { bg: 'E2EFDA', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);

  // Row 3: SUSUT | TALLY | NETTO Metrics Header
  const colGroups = [0, 3, 6, 10, 13, 17, 20, 24];
  colGroups.forEach((baseCol) => {
    writeCell(wsLapDaging, 3, baseCol, 'SUSUT', undefined, { bg: 'F2F2F2', bold: true, fontSize: 8, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, 3, baseCol + 1, 'TALLY', undefined, { bg: 'F2F2F2', bold: true, fontSize: 8, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, 3, baseCol + 2, 'NETTO', undefined, { bg: 'F2F2F2', bold: true, fontSize: 8, align: 'center', border: 'thin' });
  });

  // Rows 4 to 20: 17 Data Grid Rows
  const totalGridRows = 17;
  for (let r = 0; r < totalGridRows; r++) {
    const rowIdx = 4 + r;
    const excelRow = rowIdx + 1; // 1-indexed

    // Col 1 (HQ 41/42/44/45) (Cols 0-2)
    const it1 = col1Items[r];
    const b1 = it1 ? it1.weightBeforeThawing : 0;
    const h1 = it1 ? (it1.weightAfterThawing || b1) : 0;
    const s1 = Math.max(0, b1 - h1);
    writeCell(wsLapDaging, rowIdx, 0, s1 > 0 ? s1 : 0, undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 1, b1 > 0 ? b1 : '', undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 2, h1 > 0 ? h1 : '', undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });

    // Col 2 (DG RNDG BEKU 1kg) (Cols 3-5)
    const it2 = col2Items[r];
    const b2 = it2 ? it2.weightBeforeThawing : 0;
    const h2 = it2 ? (it2.weightAfterThawing || b2) : 0;
    const s2 = Math.max(0, b2 - h2);
    writeCell(wsLapDaging, rowIdx, 3, s2 > 0 ? s2 : 0, undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 4, b2 > 0 ? b2 : '', undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 5, h2 > 0 ? h2 : '', undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });

    // Col 3 (DAGING HUSUS) (Cols 6-8)
    const it3 = col3Items[r];
    const b3 = it3 ? it3.weightBeforeThawing : 0;
    const h3 = it3 ? (it3.weightAfterThawing || b3) : 0;
    const s3 = Math.max(0, b3 - h3);
    writeCell(wsLapDaging, rowIdx, 6, s3 > 0 ? s3 : 0, undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 7, b3 > 0 ? b3 : '', undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 8, h3 > 0 ? h3 : '', undefined, { border: 'thin', numFmt: '#,##0.00', align: 'right' });

    // Col 4 (DG Prem 2) (Cols 10-12)
    const it4 = col4Items[r];
    const b4 = it4 ? it4.weightBeforeThawing : 0;
    const h4 = it4 ? (it4.weightAfterThawing || b4) : 0;
    const s4 = Math.max(0, b4 - h4);
    writeCell(wsLapDaging, rowIdx, 10, s4 > 0 ? s4 : 0, undefined, { bg: 'FCE4D6', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 11, b4 > 0 ? b4 : '', undefined, { bg: 'FCE4D6', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 12, h4 > 0 ? h4 : '', undefined, { bg: 'FCE4D6', border: 'thin', numFmt: '#,##0.00', align: 'right' });

    // Col 5 (FRIBOY) (Cols 13-15)
    const it5 = col5Items[r];
    const b5 = it5 ? it5.weightBeforeThawing : 0;
    const h5 = it5 ? (it5.weightAfterThawing || b5) : 0;
    const s5 = Math.max(0, b5 - h5);
    writeCell(wsLapDaging, rowIdx, 13, s5 > 0 ? s5 : 0, undefined, { bg: 'FCE4D6', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 14, b5 > 0 ? b5 : '', undefined, { bg: 'FCE4D6', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 15, h5 > 0 ? h5 : '', undefined, { bg: 'FCE4D6', border: 'thin', numFmt: '#,##0.00', align: 'right' });

    // Col 6 (RAWON BEKU) (Cols 17-19)
    const it6 = col6Items[r];
    const b6 = it6 ? it6.weightBeforeThawing : 0;
    const h6 = it6 ? (it6.weightAfterThawing || b6) : 0;
    const s6 = Math.max(0, b6 - h6);
    writeCell(wsLapDaging, rowIdx, 17, s6 > 0 ? s6 : 0, undefined, { bg: 'FFF2CC', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 18, b6 > 0 ? b6 : '', undefined, { bg: 'FFF2CC', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 19, h6 > 0 ? h6 : '', undefined, { bg: 'FFF2CC', border: 'thin', numFmt: '#,##0.00', align: 'right' });

    // Col 7 (RAWON FRESH A) (Cols 20-22)
    const it7 = col7Items[r];
    const b7 = it7 ? it7.weightBeforeThawing : 0;
    const h7 = it7 ? (it7.weightAfterThawing || b7) : 0;
    const s7 = Math.max(0, b7 - h7);
    writeCell(wsLapDaging, rowIdx, 20, s7 > 0 ? s7 : 0, undefined, { bg: 'FFF2CC', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 21, b7 > 0 ? b7 : '', undefined, { bg: 'FFF2CC', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 22, h7 > 0 ? h7 : '', undefined, { bg: 'FFF2CC', border: 'thin', numFmt: '#,##0.00', align: 'right' });

    // Col 8 (FQ 60 /SHANK) (Cols 24-26)
    const it8 = col8Items[r];
    const b8 = it8 ? it8.weightBeforeThawing : 0;
    const h8 = it8 ? (it8.weightAfterThawing || b8) : 0;
    const s8 = Math.max(0, b8 - h8);
    writeCell(wsLapDaging, rowIdx, 24, s8 > 0 ? s8 : 0, undefined, { bg: 'E2EFDA', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 25, b8 > 0 ? b8 : '', undefined, { bg: 'E2EFDA', border: 'thin', numFmt: '#,##0.00', align: 'right' });
    writeCell(wsLapDaging, rowIdx, 26, h8 > 0 ? h8 : '', undefined, { bg: 'E2EFDA', border: 'thin', numFmt: '#,##0.00', align: 'right' });
  }

  // Row 21: Yellow Total Summary Row (#FFFF00)
  const summaryRow = 21;
  // Daging Fresh HQ
  writeCell(wsLapDaging, summaryRow, 0, 0, '=SUM(A5:A21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 1, 0, '=SUM(B5:B21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 2, 0, '=SUM(C5:C21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  // DG RNDG BEKU 1kg
  writeCell(wsLapDaging, summaryRow, 3, 0, '=SUM(D5:D21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 4, 0, '=SUM(E5:E21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 5, 0, '=SUM(F5:F21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  // DAGING HUSUS
  writeCell(wsLapDaging, summaryRow, 6, 0, '=SUM(G5:G21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 7, 0, '=SUM(H5:H21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 8, 0, '=SUM(I5:I21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  // DG Prem 2
  writeCell(wsLapDaging, summaryRow, 10, 0, '=SUM(K5:K21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 11, 0, '=SUM(L5:L21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 12, 0, '=SUM(M5:M21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  // FRIBOY
  writeCell(wsLapDaging, summaryRow, 13, 0, '=SUM(N5:N21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 14, 0, '=SUM(O5:O21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 15, 0, '=SUM(P5:P21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  // RAWON BEKU
  writeCell(wsLapDaging, summaryRow, 17, 0, '=SUM(R5:R21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 18, 0, '=SUM(S5:S21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 19, 0, '=SUM(T5:T21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  // RAWON FRESH A
  writeCell(wsLapDaging, summaryRow, 20, 0, '=SUM(U5:U21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 21, 0, '=SUM(V5:V21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 22, 0, '=SUM(W5:W21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  // FQ 60 /SHANK
  writeCell(wsLapDaging, summaryRow, 24, 0, '=SUM(Y5:Y21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 25, 0, '=SUM(Z5:Z21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsLapDaging, summaryRow, 26, 0, '=SUM(AA5:AA21)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });

  // Rows 23-25: Summary Cards
  writeCell(wsLapDaging, 23, 0, `Bahan : ${col1Totals.bahan > 0 ? col1Totals.bahan.toFixed(2) : '-'}`, undefined, { bold: true, fontSize: 9 });
  writeCell(wsLapDaging, 24, 0, `Hasil 1 : ${col1Totals.hasil > 0 ? col1Totals.hasil.toFixed(2) : '-'}`, undefined, { fontSize: 9 });
  writeCell(wsLapDaging, 25, 0, `Susut : ${col1Totals.susut.toFixed(3)}`, undefined, { bold: true, color: 'C00000', fontSize: 9 });

  writeCell(wsLapDaging, 23, 3, `BAHAN : ${col2Totals.bahan > 0 ? col2Totals.bahan.toFixed(2) : '-'}`, undefined, { bold: true, fontSize: 9 });
  writeCell(wsLapDaging, 24, 3, `HASIL 1 : ${col2Totals.hasil > 0 ? col2Totals.hasil.toFixed(2) : '-'}`, undefined, { fontSize: 9 });
  writeCell(wsLapDaging, 25, 3, `SUSUT : ${col2Totals.susut.toFixed(2)}`, undefined, { bold: true, fontSize: 9 });

  writeCell(wsLapDaging, 23, 6, `BAHAN : ${col3Totals.bahan > 0 ? col3Totals.bahan.toFixed(2) : '-'}`, undefined, { bold: true, fontSize: 9 });
  writeCell(wsLapDaging, 24, 6, `HASIL 1 : ${col3Totals.hasil > 0 ? col3Totals.hasil.toFixed(2) : '-'}`, undefined, { fontSize: 9 });
  writeCell(wsLapDaging, 25, 6, `SUSUT : ${col3Totals.susut.toFixed(2)}`, undefined, { bold: true, fontSize: 9 });

  writeCell(wsLapDaging, 23, 10, `BAHAN : ${col4Totals.bahan > 0 ? col4Totals.bahan.toFixed(2) : '-'}`, undefined, { bold: true, fontSize: 9 });
  writeCell(wsLapDaging, 24, 10, `HASIL 1 : ${col4Totals.hasil > 0 ? col4Totals.hasil.toFixed(2) : '-'}`, undefined, { fontSize: 9 });
  writeCell(wsLapDaging, 25, 10, `SUSUT : ${col4Totals.susut.toFixed(2)}`, undefined, { bold: true, fontSize: 9 });

  writeCell(wsLapDaging, 23, 13, `BAHAN : ${col5Totals.bahan > 0 ? col5Totals.bahan.toFixed(2) : '-'}`, undefined, { bold: true, fontSize: 9 });
  writeCell(wsLapDaging, 24, 13, `HASIL 1 : ${col5Totals.hasil > 0 ? col5Totals.hasil.toFixed(2) : '-'}`, undefined, { fontSize: 9 });
  writeCell(wsLapDaging, 25, 13, `SUSUT : ${col5Totals.susut.toFixed(2)}`, undefined, { bold: true, color: 'C00000', fontSize: 9 });

  writeCell(wsLapDaging, 23, 17, `BAHAN : ${col6Totals.bahan > 0 ? col6Totals.bahan.toFixed(2) : '-'}`, undefined, { bold: true, fontSize: 9 });
  writeCell(wsLapDaging, 24, 17, `HASIL 1 : ${col6Totals.hasil > 0 ? col6Totals.hasil.toFixed(2) : '-'}`, undefined, { fontSize: 9 });
  writeCell(wsLapDaging, 25, 17, `SUSUT : ${col6Totals.susut.toFixed(2)}`, undefined, { bold: true, fontSize: 9 });

  writeCell(wsLapDaging, 23, 20, `BAHAN : ${col7Totals.bahan > 0 ? col7Totals.bahan.toFixed(2) : '-'}`, undefined, { bold: true, fontSize: 9 });
  writeCell(wsLapDaging, 24, 20, `HASIL 1 : ${col7Totals.hasil > 0 ? col7Totals.hasil.toFixed(2) : '-'}`, undefined, { fontSize: 9 });
  writeCell(wsLapDaging, 25, 20, `SUSUT : ${col7Totals.susut.toFixed(2)}`, undefined, { bold: true, color: 'C00000', fontSize: 9 });

  writeCell(wsLapDaging, 23, 24, `BAHAN : ${col8Totals.bahan > 0 ? col8Totals.bahan.toFixed(2) : '-'}`, undefined, { bold: true, fontSize: 9 });
  writeCell(wsLapDaging, 24, 24, `HASIL 1 : ${col8Totals.hasil > 0 ? col8Totals.hasil.toFixed(2) : '-'}`, undefined, { fontSize: 9 });
  writeCell(wsLapDaging, 25, 24, `SUSUT : ${col8Totals.susut.toFixed(2)}`, undefined, { bold: true, color: 'C00000', fontSize: 9 });

  // -------------------------------------------------------------------------
  // BAGIAN 2: LAPORAN DAGING DAN RAWON FRESH TDN (KALKULASI MODAL & COGS)
  // -------------------------------------------------------------------------
  const startModalRow = 28;
  // Title Banner (Row 28 - Row 29) - Green #00B050
  writeCell(wsLapDaging, startModalRow, 1, `LAPORAN DAGING DAN RAWON FRESH TDN ${store.name.toUpperCase()}`, undefined, {
    bg: '00B050',
    color: 'FFFFFF',
    bold: true,
    fontSize: 12,
    align: 'center',
    border: 'darkThin'
  });
  styleRange(wsLapDaging, startModalRow, 1, startModalRow, 8, { bg: '00B050', color: 'FFFFFF', bold: true, fontSize: 12, align: 'center', border: 'darkThin' }, true);

  writeCell(wsLapDaging, startModalRow + 1, 1, `Tanggal: ${dayName}, ${dateStr} | Terhubung ke Master COGS`, undefined, {
    bg: 'E2EFDA',
    color: '385723',
    bold: true,
    fontSize: 9,
    align: 'center',
    border: 'thin'
  });
  styleRange(wsLapDaging, startModalRow + 1, 1, startModalRow + 1, 8, { bg: 'E2EFDA', color: '385723', bold: true, fontSize: 9, align: 'center', border: 'thin' }, true);

  // Helper to build each of the 4 sections
  const buildSection = (
    startRow: number,
    catLabel: string,
    rawName: string,
    hasilName: string,
    bahanKg: number,
    hasilKg: number,
    cogs: number,
    susutJualKg: number,
    modalLabel: string
  ) => {
    // Row 0: Section Header
    writeCell(wsLapDaging, startRow, 1, catLabel, undefined, { bg: '1F4E78', color: 'FFFFFF', bold: true, fontSize: 10, align: 'left', border: 'darkThin' });
    styleRange(wsLapDaging, startRow, 1, startRow, 9, { bg: '1F4E78', color: 'FFFFFF', bold: true, fontSize: 10, align: 'left', border: 'darkThin' }, true);

    // Row 1: BAHAN
    const r1 = startRow + 1; // 1-indexed: r1+1
    const r1Idx = r1 + 1;
    writeCell(wsLapDaging, r1, 1, 'BAHAN', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r1, 2, rawName, undefined, { bg: 'BDD7EE', bold: true, fontSize: 9, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r1, 3, ':', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r1, 4, bahanKg, undefined, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsLapDaging, r1, 5, 'X', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r1, 6, cogs, undefined, { align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r1, 7, '=', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r1, 8, bahanKg * cogs, `=E${r1Idx}*G${r1Idx}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r1, 9, '', undefined, { border: 'thin' });

    // Row 2: TOTAL BAHAN
    const r2 = startRow + 2;
    const r2Idx = r2 + 1;
    writeCell(wsLapDaging, r2, 1, 'TOTAL', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r2, 2, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r2, 3, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r2, 4, bahanKg, `=E${r1Idx}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsLapDaging, r2, 5, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r2, 6, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r2, 7, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r2, 8, bahanKg * cogs, `=I${r1Idx}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r2, 9, '', undefined, { border: 'thin' });

    // Row 3: HASIL
    const r3 = startRow + 3;
    const r3Idx = r3 + 1;
    writeCell(wsLapDaging, r3, 1, `HASIL ${catLabel}`, undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r3, 2, hasilName, undefined, { bg: 'BDD7EE', bold: true, fontSize: 9, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r3, 3, ':', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r3, 4, hasilKg, undefined, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsLapDaging, r3, 5, 'X', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r3, 6, cogs, undefined, { align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r3, 7, '=', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r3, 8, hasilKg * cogs, `=E${r3Idx}*G${r3Idx}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r3, 9, '', undefined, { border: 'thin' });

    // Row 4: TOTAL HASIL
    const r4 = startRow + 4;
    const r4Idx = r4 + 1;
    writeCell(wsLapDaging, r4, 1, 'TOTAL', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r4, 2, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r4, 3, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r4, 4, hasilKg, `=E${r3Idx}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsLapDaging, r4, 5, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r4, 6, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r4, 7, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r4, 8, hasilKg * cogs, `=I${r3Idx}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r4, 9, '', undefined, { border: 'thin' });

    // Row 5: MODAL - SUSUT JUAL (Yellow Highlight #FFFF00)
    const r5 = startRow + 5;
    const r5Idx = r5 + 1;
    const r7Idx = startRow + 7 + 1;
    const susutProsesKg = hasilKg - bahanKg; // Negative
    const susutJualKgVal = -Math.abs(susutJualKg);
    const netWeight = Math.max(0, hasilKg - Math.abs(susutJualKg));
    const calcModalWithLoss = netWeight > 0 ? (bahanKg * cogs) / netWeight : cogs;

    writeCell(wsLapDaging, r5, 1, modalLabel, undefined, { bg: 'FFFF00', color: '000000', bold: true, fontSize: 9, align: 'left', border: 'double' });
    styleRange(wsLapDaging, r5, 1, r5, 7, { bg: 'FFFF00', color: '000000', bold: true, fontSize: 9, align: 'left', border: 'double' }, true);
    writeCell(
      wsLapDaging,
      r5,
      8,
      calcModalWithLoss,
      `=IF((E${r4Idx}+E${r7Idx})>0, I${r2Idx}/(E${r4Idx}+E${r7Idx}), G${r1Idx})`,
      { bg: 'FFFF00', color: '000000', bold: true, fontSize: 10, align: 'right', border: 'double', numFmt: '#,##0.00' }
    );
    writeCell(wsLapDaging, r5, 9, '', undefined, { bg: 'FFFF00', border: 'double' });

    // Row 6: SUSUT PROSES
    const r6 = startRow + 6;
    const r6Idx = r6 + 1;
    const pctProses = bahanKg > 0 ? (susutProsesKg / bahanKg) : 0;
    writeCell(wsLapDaging, r6, 1, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r6, 2, 'SUSUT PROSES', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r6, 3, ':', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r6, 4, susutProsesKg, `=E${r4Idx}-E${r2Idx}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsLapDaging, r6, 5, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r6, 6, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r6, 7, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r6, 8, susutProsesKg * cogs, `=E${r6Idx}*G${r1Idx}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r6, 9, pctProses, `=IF(E${r2Idx}>0, E${r6Idx}/E${r2Idx}, 0)`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '0.00%' });

    // Row 7: SUSUT JUAL
    const r7 = startRow + 7;
    const pctJual = bahanKg > 0 ? (Math.abs(susutJualKgVal) / bahanKg) : 0;
    writeCell(wsLapDaging, r7, 1, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r7, 2, 'SUSUT JUAL', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r7, 3, ':', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r7, 4, susutJualKgVal, undefined, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsLapDaging, r7, 5, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r7, 6, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r7, 7, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r7, 8, susutJualKgVal * cogs, `=E${r7Idx}*G${r1Idx}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r7, 9, pctJual, `=IF(E${r2Idx}>0, ABS(E${r7Idx})/E${r2Idx}, 0)`, { bg: 'FFFF00', color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '0.00%' });

    // Row 8: TOTAL SUSUT
    const r8 = startRow + 8;
    const r8Idx = r8 + 1;
    const totalSusutKg = susutProsesKg + susutJualKgVal;
    const pctTotal = bahanKg > 0 ? (Math.abs(totalSusutKg) / bahanKg) : 0;
    writeCell(wsLapDaging, r8, 1, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r8, 2, 'TOTAL SUSUT', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r8, 3, ':', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r8, 4, totalSusutKg, `=E${r6Idx}+E${r7Idx}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsLapDaging, r8, 5, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r8, 6, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r8, 7, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r8, 8, totalSusutKg * cogs, `=I${r6Idx}+I${r7Idx}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r8, 9, pctTotal, `=IF(E${r2Idx}>0, ((E${r2Idx}-(E${r4Idx}+E${r7Idx}))/E${r2Idx}), 0)`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '0.00%' });

    // Row 9: SELISIH NILAI BAHAN & HASIL
    const r9 = startRow + 9;
    const selisihNilai = (hasilKg * cogs + susutJualKgVal * cogs) - (bahanKg * cogs);
    writeCell(wsLapDaging, r9, 1, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r9, 2, 'SELISIH BAHAN & HASIL', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(wsLapDaging, r9, 3, ':', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(wsLapDaging, r9, 4, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r9, 5, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r9, 6, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r9, 7, '', undefined, { border: 'thin' });
    writeCell(wsLapDaging, r9, 8, selisihNilai, `=(I${r4Idx}+I${r7Idx})-I${r2Idx}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(wsLapDaging, r9, 9, '', undefined, { border: 'thin' });
  };

  // Build the 4 standard sections (Starting from Row 30 / Excel Row 31)
  // Section 1: Daging Fresh (Starts Row 30)
  buildSection(startModalRow + 2, 'DAGING FRESH', 'Bahan D. Rendang Fresh', 'D.s. pot. rdang', dgFreshBahan, dgFreshHasil, cogsFresh, dgFreshSusutJual, 'MODAL DG FRESH - SUSUT JUAL');
  // Section 2: Daging Premium (Starts Row 41)
  buildSection(startModalRow + 13, 'DAGING PREMIUM', 'Bahan Daging Premium', 'D premium lokal', dgPremBahan, dgPremHasil, cogsPrem, dgPremSusutJual, 'MODAL DG PREM - SUSUT JUAL');
  // Section 3: Rawon Fresh (Starts Row 52)
  buildSection(startModalRow + 24, 'RAWON FRESH', 'Bahan Rawon Curah', 'Rawon Curah', rawonBahan, rawonHasil, cogsRawon, rawonSusutJual, 'MODAL RAWON - SUSUT JUAL');
  // Section 4: Daging Fresh Ekonomis / Shankle (Starts Row 63)
  buildSection(startModalRow + 35, 'DAGING FRESH EKONOMIS (FQ 60 / SHANK)', 'Bahan Shankle / FQ 60', 'D fresh ekonomis', shankBahan, shankHasil, cogsShank, shankSusutJual, 'MODAL SANKLE - SUSUT JUAL');

  // =========================================================================
  // GRAND SUMMARY (Rows 74 to 81)
  // =========================================================================
  const grHeaderRow = startModalRow + 46; // Excel Row 75
  writeCell(wsLapDaging, grHeaderRow, 1, 'TOTAL REKAPITULASI SUSUT & OMSET HARIAN', undefined, {
    bg: '1F4E78',
    color: 'FFFFFF',
    bold: true,
    fontSize: 10,
    align: 'center',
    border: 'darkThin'
  });
  styleRange(wsLapDaging, grHeaderRow, 1, grHeaderRow, 9, { bg: '1F4E78', color: 'FFFFFF', bold: true, fontSize: 10, align: 'center', border: 'darkThin' }, true);

  // Total Susut Produksi -> Sum of Susut Proses rows (Excel Rows 37, 48, 59, 70)
  const rGr1 = grHeaderRow + 1;
  const rGr1Idx = rGr1 + 1;
  const susutProsesRows = [startModalRow + 9, startModalRow + 20, startModalRow + 31, startModalRow + 42];
  const eFormulaSP = susutProsesRows.map(r => `E${r}`).join('+');
  const iFormulaSP = susutProsesRows.map(r => `I${r}`).join('+');

  writeCell(wsLapDaging, rGr1, 1, 'TOTAL SUSUT PRODUKSI', undefined, { bold: true, align: 'left', border: 'thin' });
  styleRange(wsLapDaging, rGr1, 1, rGr1, 3, { bold: true, align: 'left', border: 'thin' }, true);
  writeCell(wsLapDaging, rGr1, 4, 0, `=${eFormulaSP}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
  styleRange(wsLapDaging, rGr1, 5, rGr1, 7, { border: 'thin' }, true);
  writeCell(wsLapDaging, rGr1, 8, 0, `=${iFormulaSP}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
  writeCell(wsLapDaging, rGr1, 9, '', undefined, { border: 'thin' });

  // Total Susut Jual -> Sum of Susut Jual rows (Excel Rows 38, 49, 60, 71)
  const rGr2 = grHeaderRow + 2;
  const rGr2Idx = rGr2 + 1;
  const susutJualRows = [startModalRow + 10, startModalRow + 21, startModalRow + 32, startModalRow + 43];
  const eFormulaSJ = susutJualRows.map(r => `E${r}`).join('+');
  const iFormulaSJ = susutJualRows.map(r => `I${r}`).join('+');

  writeCell(wsLapDaging, rGr2, 1, 'TOTAL SUSUT JUAL', undefined, { bold: true, align: 'left', border: 'thin' });
  styleRange(wsLapDaging, rGr2, 1, rGr2, 3, { bold: true, align: 'left', border: 'thin' }, true);
  writeCell(wsLapDaging, rGr2, 4, 0, `=${eFormulaSJ}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
  styleRange(wsLapDaging, rGr2, 5, rGr2, 7, { border: 'thin' }, true);
  writeCell(wsLapDaging, rGr2, 8, 0, `=${iFormulaSJ}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
  writeCell(wsLapDaging, rGr2, 9, '', undefined, { border: 'thin' });

  // Total Susut (Row)
  const rGr3 = grHeaderRow + 3;
  const rGr3Idx = rGr3 + 1;
  writeCell(wsLapDaging, rGr3, 1, 'TOTAL SUSUT', undefined, { bold: true, align: 'left', border: 'thin' });
  styleRange(wsLapDaging, rGr3, 1, rGr3, 3, { bold: true, align: 'left', border: 'thin' }, true);
  writeCell(wsLapDaging, rGr3, 4, 0, `=E${rGr1Idx}+E${rGr2Idx}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
  styleRange(wsLapDaging, rGr3, 5, rGr3, 7, { border: 'thin' }, true);
  writeCell(wsLapDaging, rGr3, 8, 0, `=I${rGr1Idx}+I${rGr2Idx}`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
  writeCell(wsLapDaging, rGr3, 9, '', undefined, { border: 'thin' });

  // Total Bahan -> Sum of Total Bahan rows (Excel Rows 33, 44, 55, 66)
  const rGr4 = grHeaderRow + 4;
  const rGr4Idx = rGr4 + 1;
  const totBahanRows = [startModalRow + 5, startModalRow + 16, startModalRow + 27, startModalRow + 38];
  const eFormulaTB = totBahanRows.map(r => `E${r}`).join('+');
  const iFormulaTB = totBahanRows.map(r => `I${r}`).join('+');

  writeCell(wsLapDaging, rGr4, 1, 'TOTAL BAHAN', undefined, { bold: true, align: 'left', border: 'thin' });
  styleRange(wsLapDaging, rGr4, 1, rGr4, 3, { bold: true, align: 'left', border: 'thin' }, true);
  writeCell(wsLapDaging, rGr4, 4, 0, `=${eFormulaTB}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
  styleRange(wsLapDaging, rGr4, 5, rGr4, 7, { border: 'thin' }, true);
  writeCell(wsLapDaging, rGr4, 8, 0, `=${iFormulaTB}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
  writeCell(wsLapDaging, rGr4, 9, '', undefined, { border: 'thin' });

  // Total Hasil -> Sum of Total Hasil rows (Excel Rows 35, 46, 57, 68)
  const rGr5 = grHeaderRow + 5;
  const rGr5Idx = rGr5 + 1;
  const totHasilRows = [startModalRow + 7, startModalRow + 18, startModalRow + 29, startModalRow + 40];
  const eFormulaTH = totHasilRows.map(r => `E${r}`).join('+');
  const iFormulaTH = totHasilRows.map(r => `I${r}`).join('+');

  writeCell(wsLapDaging, rGr5, 1, 'TOTAL HASIL', undefined, { bold: true, align: 'left', border: 'thin' });
  styleRange(wsLapDaging, rGr5, 1, rGr5, 3, { bold: true, align: 'left', border: 'thin' }, true);
  writeCell(wsLapDaging, rGr5, 4, 0, `=${eFormulaTH}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
  styleRange(wsLapDaging, rGr5, 5, rGr5, 7, { border: 'thin' }, true);
  writeCell(wsLapDaging, rGr5, 8, 0, `=${iFormulaTH}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });
  writeCell(wsLapDaging, rGr5, 9, '', undefined, { border: 'thin' });

  // Selisih (Row) - Yellow Highlight #FFFF00
  const rGr6 = grHeaderRow + 6;
  const rGr6Idx = rGr6 + 1;
  writeCell(wsLapDaging, rGr6, 1, 'SELISIH', undefined, { bg: 'FFFF00', color: 'C00000', bold: true, fontSize: 10, align: 'left', border: 'double' });
  styleRange(wsLapDaging, rGr6, 1, rGr6, 3, { bg: 'FFFF00', color: 'C00000', bold: true, fontSize: 10, align: 'left', border: 'double' }, true);
  writeCell(wsLapDaging, rGr6, 4, 0, `=E${rGr5Idx}-E${rGr4Idx}`, { bg: 'FFFF00', color: 'C00000', bold: true, fontSize: 10, align: 'right', border: 'double', numFmt: '#,##0.00' });
  styleRange(wsLapDaging, rGr6, 5, rGr6, 7, { bg: 'FFFF00', border: 'double' }, true);
  writeCell(wsLapDaging, rGr6, 8, 0, `=I${rGr5Idx}-I${rGr4Idx}`, { bg: 'FFFF00', color: 'C00000', bold: true, fontSize: 10, align: 'right', border: 'double', numFmt: '#,##0' });
  writeCell(wsLapDaging, rGr6, 9, '', undefined, { bg: 'FFFF00', border: 'double' });

  XLSX.utils.book_append_sheet(wb, wsLapDaging, 'LAP.DAGING');

  // =========================================================================
  // SHEET 2: PROSES (FORM PROSES PRODUKSI)
  // =========================================================================
  const wsProses: any = {};
  wsProses['!cols'] = [
    { wch: 4 },   // Col A
    { wch: 22 },  // Col B
    { wch: 8 },   // Col C (1)
    { wch: 8 },   // Col D (2)
    { wch: 8 },   // Col E (3)
    { wch: 8 },   // Col F (4)
    { wch: 8 },   // Col G (5)
    { wch: 8 },   // Col H (6)
    { wch: 8 },   // Col I (7)
    { wch: 8 },   // Col J (8)
    { wch: 8 },   // Col K (9)
    { wch: 8 },   // Col L (16)
    { wch: 14 },  // Col M (TOTAL)
    { wch: 4 },   // Col N
    { wch: 18 },  // Col O
    { wch: 14 },  // Col P
  ];

  // Banner Title (Row 1 / Excel Row 2) - Gold/Orange #FFC000
  writeCell(wsProses, 1, 1, 'FORM PROSES PRODUKSI', undefined, {
    bg: 'FFC000',
    color: '000000',
    bold: true,
    fontSize: 13,
    align: 'center',
    border: 'darkThin'
  });
  styleRange(wsProses, 1, 1, 1, 12, { bg: 'FFC000', color: '000000', bold: true, fontSize: 13, align: 'center', border: 'darkThin' }, true);

  // Metadata
  writeCell(wsProses, 3, 1, 'Hari', undefined, { bold: true });
  writeCell(wsProses, 3, 2, ':', undefined, { bold: true });
  writeCell(wsProses, 3, 3, dayName, undefined, { bold: true });

  writeCell(wsProses, 4, 1, 'Tanggal', undefined, { bold: true });
  writeCell(wsProses, 4, 2, ':', undefined, { bold: true });
  writeCell(wsProses, 4, 3, dateStr, undefined, { bold: true });

  // Table Headers (Row 6 / Excel Row 7)
  const headerCols = ['Nomor', '1', '2', '3', '4', '5', '6', '7', '8', '9', '16', 'TOTAL'];
  headerCols.forEach((txt, idx) => {
    const isTotal = idx === 11;
    writeCell(wsProses, 6, idx + 1, txt, undefined, {
      bg: isTotal ? 'BFBFBF' : 'D9D9D9',
      color: '000000',
      bold: true,
      fontSize: 10,
      align: 'center',
      border: 'darkThin'
    });
  });

  // Table Matrix Items (Excel Rows 8 to 14)
  // Row 8: Bahan
  writeCell(wsProses, 7, 1, 'Bahan', undefined, { bold: true, border: 'thin' });
  writeCell(wsProses, 7, 2, dgFreshBahan, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 7, 3, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 7, 4, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 7, 5, '', undefined, { border: 'thin' });
  writeCell(wsProses, 7, 6, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 7, 7, rawonBahan, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 7, 8, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 7, 9, dgPremBahan, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 7, 10, shankBahan, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 7, 11, '', undefined, { border: 'thin' });
  writeCell(wsProses, 7, 12, 0, '=SUM(C8:L8)', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });

  // Row 9: D.sapi p. rdang
  writeCell(wsProses, 8, 1, 'D.sapi p. rdang', undefined, { bold: true, border: 'thin' });
  writeCell(wsProses, 8, 2, dgFreshHasil, undefined, { border: 'thin', numFmt: '#,##0.00' });
  for (let c = 3; c <= 11; c++) writeCell(wsProses, 8, c, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 8, 12, 0, '=SUM(C9:L9)', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });

  // Row 10: D premium lokal
  writeCell(wsProses, 9, 1, 'D premium lokal', undefined, { bold: true, border: 'thin' });
  for (let c = 2; c <= 8; c++) writeCell(wsProses, 9, c, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 9, 9, dgPremHasil, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 9, 10, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 9, 11, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 9, 12, 0, '=SUM(C10:L10)', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });

  // Row 11: Empty/Spare
  writeCell(wsProses, 10, 1, '', undefined, { border: 'thin' });
  for (let c = 2; c <= 11; c++) writeCell(wsProses, 10, c, '', undefined, { border: 'thin' });
  writeCell(wsProses, 10, 12, '-', undefined, { align: 'center', border: 'thin' });

  // Row 12: D fresh ekonomis
  writeCell(wsProses, 11, 1, 'D fresh ekonomis', undefined, { bold: true, border: 'thin' });
  for (let c = 2; c <= 9; c++) writeCell(wsProses, 11, c, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 11, 10, shankHasil, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 11, 11, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 11, 12, 0, '=SUM(C12:L12)', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });

  // Row 13: Rawon Curah
  writeCell(wsProses, 12, 1, 'Rawon Curah', undefined, { bold: true, border: 'thin' });
  for (let c = 2; c <= 6; c++) writeCell(wsProses, 12, c, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 12, 7, rawonHasil, undefined, { border: 'thin', numFmt: '#,##0.00' });
  for (let c = 8; c <= 11; c++) writeCell(wsProses, 12, c, 0, undefined, { border: 'thin', numFmt: '#,##0.00' });
  writeCell(wsProses, 12, 12, 0, '=SUM(C13:L13)', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });

  // Row 14: Urat Triming
  writeCell(wsProses, 13, 1, 'Urat Triming', undefined, { bold: true, border: 'thin' });
  for (let c = 2; c <= 11; c++) writeCell(wsProses, 13, c, '', undefined, { border: 'thin' });
  writeCell(wsProses, 13, 12, '-', undefined, { align: 'center', border: 'thin' });

  // Row 15: Yellow Susut Selisih Bar (Row 14 / Excel 15)
  writeCell(wsProses, 14, 1, 'TOTAL SUSUT PROSES', undefined, { bg: 'FFFF00', bold: true, fontSize: 10, align: 'left', border: 'double' });
  styleRange(wsProses, 14, 1, 14, 11, { bg: 'FFFF00', bold: true, fontSize: 10, align: 'left', border: 'double' }, true);
  writeCell(wsProses, 14, 12, 0, '=M8-(M9+M10+M12+M13)', { bg: 'FFFF00', color: 'C00000', bold: true, fontSize: 10, align: 'right', border: 'double', numFmt: '#,##0.00' });

  // Side Summary Boxes (Row 7 to 9, Cols O-P)
  writeCell(wsProses, 6, 14, 'TOTAL BAHAN', undefined, { bg: 'D9D9D9', bold: true, align: 'left', border: 'darkThin' });
  writeCell(wsProses, 6, 15, 0, '=M8', { bg: 'D9D9D9', bold: true, align: 'right', border: 'darkThin', numFmt: '#,##0.00' });

  writeCell(wsProses, 7, 14, 'TOTAL BERSIH', undefined, { bg: 'D9D9D9', bold: true, align: 'left', border: 'darkThin' });
  writeCell(wsProses, 7, 15, 0, '=M9+M10+M12+M13', { bg: 'D9D9D9', bold: true, align: 'right', border: 'darkThin', numFmt: '#,##0.00' });

  writeCell(wsProses, 8, 14, 'SUSUT', undefined, { bg: 'FFFF00', bold: true, align: 'left', border: 'double' });
  writeCell(wsProses, 8, 15, 0, '=M15', { bg: 'FFFF00', color: 'C00000', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });

  // Bottom Calculation Breakdown (Excel Rows 17-28)
  writeCell(wsProses, 16, 1, 'HASIL PRODUKSI RENDANG FRESH', undefined, { bold: true });
  writeCell(wsProses, 16, 3, '=', undefined, { bold: true, align: 'center' });
  writeCell(wsProses, 16, 4, 0, '=M9', { bold: true, align: 'right', numFmt: '#,##0.00' });
  writeCell(wsProses, 16, 5, 'KG', undefined, { bold: true });

  writeCell(wsProses, 17, 1, 'DAGING PREMIUM', undefined, { bold: true });
  writeCell(wsProses, 17, 3, '=', undefined, { bold: true, align: 'center' });
  writeCell(wsProses, 17, 4, 0, '=M10', { bold: true, align: 'right', numFmt: '#,##0.00' });
  writeCell(wsProses, 17, 5, 'KG', undefined, { bold: true });

  writeCell(wsProses, 18, 1, 'BERSIH DAGING RENDANG FRESH', undefined, { bold: true });
  writeCell(wsProses, 18, 3, '=', undefined, { bold: true, align: 'center' });
  writeCell(wsProses, 18, 4, 0, '=M9', { bold: true, align: 'right', numFmt: '#,##0.00' });
  writeCell(wsProses, 18, 5, 'KG', undefined, { bold: true });

  // Summary Table (Excel Rows 20-27)
  const summaryDefs = [
    { label: 'Total Bahan', formula: '=M8', isSusut: false },
    { label: 'Total D. Sapi pot Rendang', formula: '=M9', isSusut: false },
    { label: 'Tot D Premium lokal', formula: '=M10', isSusut: false },
    { label: 'Total Sankle', formula: '', val: '-', isSusut: false },
    { label: 'D fresh ekonomis', formula: '=M12', isSusut: false },
    { label: 'Total Rawon', formula: '=M13', isSusut: false },
    { label: 'Total Urat triming', formula: '', val: '-', isSusut: false },
    { label: 'SUSUT', formula: '=M15', isSusut: true },
  ];

  summaryDefs.forEach((item, idx) => {
    const r = 20 + idx;
    writeCell(wsProses, r, 9, item.label, undefined, {
      bg: item.isSusut ? 'FFFF00' : 'F2F2F2',
      bold: true,
      align: 'left',
      border: item.isSusut ? 'double' : 'thin'
    });
    styleRange(wsProses, r, 9, r, 10, { bg: item.isSusut ? 'FFFF00' : 'F2F2F2', bold: true, align: 'left', border: item.isSusut ? 'double' : 'thin' }, true);

    if (item.formula) {
      writeCell(wsProses, r, 11, 0, item.formula, {
        bg: item.isSusut ? 'FFFF00' : 'F2F2F2',
        color: item.isSusut ? 'C00000' : '000000',
        bold: true,
        align: 'right',
        border: item.isSusut ? 'double' : 'thin',
        numFmt: '#,##0.00'
      });
    } else {
      writeCell(wsProses, r, 11, item.val || '-', undefined, {
        bg: 'F2F2F2',
        bold: true,
        align: 'center',
        border: 'thin'
      });
    }
  });

  XLSX.utils.book_append_sheet(wb, wsProses, 'PROSES');

  // =========================================================================
  // SHEET 3: SALES DAGING (LAPORAN STOCK DAGING)
  // =========================================================================
  const sheet3Name = `LAPORAN DAGING ${dateStr.toUpperCase()}`.substring(0, 31);
  const wsSales: any = {};
  wsSales['!cols'] = [
    { wch: 4 },   // Col A
    { wch: 10 },  // Col B: Tanggal
    { wch: 16 },  // Col C: Stock Awal
    { wch: 22 },  // Col D: Keterangan
    { wch: 10 },  // Col E: Tanggal
    { wch: 16 },  // Col F: BAHAN PRODUKSI
    { wch: 14 },  // Col G: Masuk ke Toko
    { wch: 10 },  // Col H: ADJ IN
    { wch: 10 },  // Col I: ADJ OUT
    { wch: 10 },  // Col J: Hasil
    { wch: 22 },  // Col K: Keterangan
    { wch: 16 },  // Col L: Total Real
    { wch: 14 },  // Col M: Penjualan
    { wch: 22 },  // Col N: Keterangan
    { wch: 20 },  // Col O: Stock Akhir Sistem
    { wch: 10 },  // Col P: Tanggal
    { wch: 20 },  // Col Q: Stock Akhir Real
    { wch: 22 },  // Col R: Keterangan
    { wch: 14 },  // Col S: Penyusutan
  ];

  // Title (Row 0 / Excel 1) - Dark Blue #1F4E78
  writeCell(wsSales, 0, 1, `LAPORAN STOCK DAGING TDN ${store.name.toUpperCase()} TGL ${dateStr.toUpperCase()}`, undefined, {
    bg: '1F4E78',
    color: 'FFFFFF',
    bold: true,
    fontSize: 11,
    align: 'center',
    border: 'darkThin'
  });
  styleRange(wsSales, 0, 1, 0, 18, { bg: '1F4E78', color: 'FFFFFF', bold: true, fontSize: 11, align: 'center', border: 'darkThin' }, true);

  // Headers (Row 1 / Excel 2) - Soft Blue #D9E1F2
  const sHeaders = [
    'Tanggal', 'Stock Awal\n(Pagi)', 'Keterangan', 'Tanggal', 'BAHAN\nPRODUKSI', 'Masuk ke\nToko',
    'ADJ IN', 'ADJ OUT', 'Hasil', 'Keterangan', 'Total Real\n( Kg )', 'Penjualan', 'Keterangan',
    'Stock Akhir by\nSistem', 'Tanggal', 'Stock Akhir\nReal (Kg)', 'Keterangan', 'Penyusutan'
  ];
  sHeaders.forEach((txt, idx) => {
    writeCell(wsSales, 1, idx + 1, txt, undefined, {
      bg: 'D9E1F2',
      color: '000000',
      bold: true,
      fontSize: 9,
      align: 'center',
      border: 'darkThin',
      wrapText: true
    });
  });

  const stockRowsDef = [
    { planName: 'Daging Rendang Shankle', alias: 'D fresh ekonomis', hasil: shankHasil, hasilFormula: '=PROSES!M12' },
    { planName: 'D.s. pot. rdang', alias: 'D.sapi pot. rdang', hasil: dgFreshHasil, hasilFormula: '=PROSES!M9' },
    { planName: 'D premium lokal', alias: 'D Premium lokal', hasil: dgPremHasil, hasilFormula: '=PROSES!M10' },
    { planName: 'D.r. fresh member', alias: 'D.r. fresh member', hasil: 0, hasilFormula: '' },
    { planName: 'Rawon Curah', alias: 'Rawon Curah', hasil: rawonHasil, hasilFormula: '=PROSES!M13' },
  ];

  stockRowsDef.forEach((def, idx) => {
    const r = 2 + idx;
    const rIdx = r + 1;

    const rec = closingRecords.find((c) => (c.planName || '').toLowerCase().includes(def.planName.toLowerCase()));
    const carry = carryoverItems.filter((c) => (c.plannedFabrication || '').toLowerCase().includes(def.planName.toLowerCase()));
    const planAdj = adjustments.filter((a) => (a.planName || a.meatName || '').toLowerCase().includes(def.planName.toLowerCase()));

    const stockAwal = rec ? rec.openingStockKg : carry.reduce((s, i) => s + i.weightBeforeThawing, 0);
    const adjIn = planAdj.filter((a) => a.type === 'IN').reduce((s, a) => s + a.weightKg, 0);
    const adjOut = planAdj.filter((a) => a.type === 'OUT').reduce((s, a) => s + a.weightKg, 0);
    const sales = rec ? rec.salesKg : 0;
    const stockAkhirReal = rec ? rec.actualClosingStockKg : 0;

    writeCell(wsSales, r, 1, idx === 0 ? shortDate : '', undefined, { align: 'center', border: 'thin' });
    writeCell(wsSales, r, 2, stockAwal, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsSales, r, 3, def.planName, undefined, { align: 'left', border: 'thin' });
    writeCell(wsSales, r, 4, idx === 0 ? shortDate : '', undefined, { align: 'center', border: 'thin' });
    writeCell(wsSales, r, 5, idx === 0 ? 0 : '', idx === 0 ? '=PROSES!M8' : undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsSales, r, 6, idx === 0 ? 0 : '', idx === 0 ? '=PROSES!P8' : undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsSales, r, 7, adjIn, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsSales, r, 8, adjOut, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });

    // Hasil (Col J / Col 9)
    if (def.hasilFormula) {
      writeCell(wsSales, r, 9, def.hasil, def.hasilFormula, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
    } else {
      writeCell(wsSales, r, 9, 0, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
    }
    writeCell(wsSales, r, 10, def.planName, undefined, { align: 'left', border: 'thin' });

    // Total Real (Col L / Col 11) -> Formula: =C[rIdx]+H[rIdx]-I[rIdx]+J[rIdx]
    writeCell(wsSales, r, 11, stockAwal + adjIn - adjOut + (def.hasil || 0), `=C${rIdx}+H${rIdx}-I${rIdx}+J${rIdx}`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });

    // Penjualan (Col M / Col 12)
    writeCell(wsSales, r, 12, sales, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsSales, r, 13, def.planName, undefined, { align: 'left', border: 'thin' });

    // Stock Akhir by Sistem (Col O / Col 14) -> Formula: =MAX(0, L[rIdx]-M[rIdx])
    const stokSistemVal = Math.max(0, (stockAwal + adjIn - adjOut + (def.hasil || 0)) - sales);
    writeCell(wsSales, r, 14, stokSistemVal, `=MAX(0, L${rIdx}-M${rIdx})`, { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(wsSales, r, 15, idx === 0 ? shortDate : '', undefined, { align: 'center', border: 'thin' });

    // Stock Akhir Real (Col Q / Col 16) - Highlight Soft Green #C6EFCE
    writeCell(wsSales, r, 16, stockAkhirReal, undefined, {
      bg: 'C6EFCE',
      color: '006100',
      bold: true,
      fontSize: 9,
      align: 'right',
      border: 'darkThin',
      numFmt: '#,##0.00'
    });
    writeCell(wsSales, r, 17, def.alias, undefined, { align: 'left', border: 'thin' });

    // Penyusutan (Col S / Col 18) -> Formula: =MAX(0, O[rIdx]-Q[rIdx])
    const susutVal = Math.max(0, stokSistemVal - stockAkhirReal);
    writeCell(wsSales, r, 18, susutVal, `=MAX(0, O${rIdx}-Q${rIdx})`, { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
  });

  // Total Row (Row 7 / Excel Row 8) - Bright Yellow #FFFF00
  writeCell(wsSales, 7, 1, 'TOTAL', undefined, { bg: 'FFFF00', bold: true, align: 'center', border: 'double' });
  writeCell(wsSales, 7, 2, 0, '=SUM(C3:C7)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 3, '', undefined, { bg: 'FFFF00', border: 'double' });
  writeCell(wsSales, 7, 4, 'SELISIH', undefined, { bg: 'FFFF00', bold: true, align: 'center', border: 'double' });
  writeCell(wsSales, 7, 5, 0, '=PROSES!M15', { bg: 'FFFF00', color: 'C00000', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 6, '', undefined, { bg: 'FFFF00', border: 'double' });
  writeCell(wsSales, 7, 7, 0, '=SUM(H3:H7)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 8, 0, '=SUM(I3:I7)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 9, 0, '=SUM(J3:J7)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 10, '', undefined, { bg: 'FFFF00', border: 'double' });
  writeCell(wsSales, 7, 11, 0, '=SUM(L3:L7)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 12, 0, '=SUM(M3:M7)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 13, '', undefined, { bg: 'FFFF00', border: 'double' });
  writeCell(wsSales, 7, 14, 0, '=SUM(O3:O7)', { bg: 'FFFF00', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 15, '', undefined, { bg: 'FFFF00', border: 'double' });
  writeCell(wsSales, 7, 16, 0, '=SUM(Q3:Q7)', { bg: 'FFFF00', color: '006100', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
  writeCell(wsSales, 7, 17, '', undefined, { bg: 'FFFF00', border: 'double' });
  writeCell(wsSales, 7, 18, 0, '=SUM(S3:S7)', { bg: 'FFFF00', color: 'C00000', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });

  XLSX.utils.book_append_sheet(wb, wsSales, sheet3Name);

  // Trigger file download in browser
  const filename = `LAPORAN DAGING ${store.name} ${dateStr}.xlsx`.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, filename);
}

// ============================================================================
// EXPORT 2: MD MULTI-STORE 9 SHEETS REKAPITULASI EXCEL
// ============================================================================
export function exportRekapSusutMultiStoreExcel(
  stores: Store[],
  dateRangeText: string,
  allReports: DailyClosingReport[],
  cogsList: CogsMaster[],
  allItems: ThawingItem[] = [],
  allClosingRecords: ClosingPlanRecord[] = [],
  startDate?: string,
  endDate?: string
) {
  const wb = XLSX.utils.book_new();

  // Extract store and category aggregations using the shared engine
  const shankleAgg = calculateCategoryAggregates('SHANKLE', stores, allReports, allItems, allClosingRecords, startDate, endDate);
  const rendangAgg = calculateCategoryAggregates('RENDANG', stores, allReports, allItems, allClosingRecords, startDate, endDate);
  const premiumAgg = calculateCategoryAggregates('PREMIUM', stores, allReports, allItems, allClosingRecords, startDate, endDate);
  const rawonAgg = calculateCategoryAggregates('RAWON', stores, allReports, allItems, allClosingRecords, startDate, endDate);

  // =========================================================================
  // SHEET 1: REKAP (4 side-by-side tables matching MdExcelReportView.tsx)
  // =========================================================================
  const wsRekap: any = {};
  wsRekap['!cols'] = [
    { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 4 },
    { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 4 },
    { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 4 },
    { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }
  ];

  // Header Titles per section (Row 0 - Soft Blue #8EA9DB)
  const sections = [
    { title: 'DAGING RENDANG SHANKLE', startCol: 0 },
    { title: 'DAGING RENDANG FRESH', startCol: 7 },
    { title: 'DAGING PREMIUM', startCol: 14 },
    { title: 'DAGING RAWON', startCol: 21 },
  ];

  sections.forEach((sec) => {
    writeCell(wsRekap, 0, sec.startCol, sec.title, undefined, {
      bg: '8EA9DB',
      color: '000000',
      bold: true,
      fontSize: 10,
      align: 'center',
      border: 'darkThin'
    });
    styleRange(wsRekap, 0, sec.startCol, 0, sec.startCol + 5, {
      bg: '8EA9DB',
      color: '000000',
      bold: true,
      fontSize: 10,
      align: 'center',
      border: 'darkThin'
    }, true);
  });

  // Subheaders (Row 1 - Yellow #FFFF00)
  const subCols = ['TOKO', 'TALY', 'NETTO', 'SUSUT 1', 'SUSUT JUAL', '%'];
  sections.forEach((sec) => {
    subCols.forEach((sub, sIdx) => {
      writeCell(wsRekap, 1, sec.startCol + sIdx, sub, undefined, {
        bg: 'FFFF00',
        color: '000000',
        bold: true,
        fontSize: 9,
        align: 'center',
        border: 'darkThin'
      });
    });
  });

  // Sort stores descending by % for each category
  const sortedShankle = [...shankleAgg.storeAggregates].sort((a, b) => b.pct - a.pct);
  const sortedRendang = [...rendangAgg.storeAggregates].sort((a, b) => b.pct - a.pct);
  const sortedPremium = [...premiumAgg.storeAggregates].sort((a, b) => b.pct - a.pct);
  const sortedRawon = [...rawonAgg.storeAggregates].sort((a, b) => b.pct - a.pct);

  const maxStores = Math.max(sortedShankle.length, sortedRendang.length, sortedPremium.length, sortedRawon.length);

  for (let i = 0; i < maxStores; i++) {
    const r = 2 + i;
    const rIdx = r + 1;

    const s = sortedShankle[i];
    const rd = sortedRendang[i];
    const p = sortedPremium[i];
    const w = sortedRawon[i];

    const groupData = [
      { obj: s, startCol: 0, tCol: 'B', nCol: 'C', s1Col: 'D', sjCol: 'E' },
      { obj: rd, startCol: 7, tCol: 'I', nCol: 'J', s1Col: 'K', sjCol: 'L' },
      { obj: p, startCol: 14, tCol: 'P', nCol: 'Q', s1Col: 'R', sjCol: 'S' },
      { obj: w, startCol: 21, tCol: 'W', nCol: 'X', s1Col: 'Y', sjCol: 'Z' },
    ];

    groupData.forEach((g) => {
      if (g.obj) {
        writeCell(wsRekap, r, g.startCol, g.obj.store.name.replace('TDN ', ''), undefined, { bold: true, align: 'left', border: 'thin' });
        writeCell(wsRekap, r, g.startCol + 1, g.obj.taly, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
        writeCell(wsRekap, r, g.startCol + 2, g.obj.netto, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
        writeCell(wsRekap, r, g.startCol + 3, g.obj.susut1, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
        writeCell(wsRekap, r, g.startCol + 4, g.obj.susutJual, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.00' });
        // Formula for % = IF(TALY>0, (SUSUT1+SUSUTJUAL)/TALY, 0)
        writeCell(wsRekap, r, g.startCol + 5, g.obj.pct / 100, `=IF(${g.tCol}${rIdx}>0, (${g.s1Col}${rIdx}+${g.sjCol}${rIdx})/${g.tCol}${rIdx}, 0)`, {
          align: 'right',
          border: 'thin',
          numFmt: '0.00%'
        });
      }
    });
  }

  // Rekap Grand Total Row
  const totalRow = 2 + maxStores;
  const totalRowIdx = totalRow + 1;
  const startDataRowIdx = 3;
  const endDataRowIdx = 2 + maxStores;

  const totalGroups = [
    { startCol: 0, tCol: 'B', nCol: 'C', s1Col: 'D', sjCol: 'E', pctCol: 'F', agg: shankleAgg },
    { startCol: 7, tCol: 'I', nCol: 'J', s1Col: 'K', sjCol: 'L', pctCol: 'M', agg: rendangAgg },
    { startCol: 14, tCol: 'P', nCol: 'Q', s1Col: 'R', sjCol: 'S', pctCol: 'T', agg: premiumAgg },
    { startCol: 21, tCol: 'W', nCol: 'X', s1Col: 'Y', sjCol: 'Z', pctCol: 'AA', agg: rawonAgg },
  ];

  totalGroups.forEach((g) => {
    writeCell(wsRekap, totalRow, g.startCol, 'TOTAL', undefined, { bg: 'D9D9D9', bold: true, align: 'left', border: 'double' });
    writeCell(wsRekap, totalRow, g.startCol + 1, g.agg.grandTaly, `=SUM(${g.tCol}${startDataRowIdx}:${g.tCol}${endDataRowIdx})`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
    writeCell(wsRekap, totalRow, g.startCol + 2, g.agg.grandNetto, `=SUM(${g.nCol}${startDataRowIdx}:${g.nCol}${endDataRowIdx})`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
    writeCell(wsRekap, totalRow, g.startCol + 3, g.agg.grandSusut1, `=SUM(${g.s1Col}${startDataRowIdx}:${g.s1Col}${endDataRowIdx})`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
    writeCell(wsRekap, totalRow, g.startCol + 4, g.agg.grandSusutJual, `=SUM(${g.sjCol}${startDataRowIdx}:${g.sjCol}${endDataRowIdx})`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '#,##0.00' });
    writeCell(wsRekap, totalRow, g.startCol + 5, g.agg.grandPct / 100, `=IF(${g.tCol}${totalRowIdx}>0, (${g.s1Col}${totalRowIdx}+${g.sjCol}${totalRowIdx})/${g.tCol}${totalRowIdx}, 0)`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '0.00%' });
  });

  XLSX.utils.book_append_sheet(wb, wsRekap, 'REKAP');

  // =========================================================================
  // HELPER FOR DAILY CATEGORY SHEETS (SHANKLE, RENDANG, PREMIUM, RAWON)
  // =========================================================================
  const buildDailyCategorySheet = (sheetTitle: string, agg: typeof shankleAgg) => {
    const ws: any = {};
    ws['!cols'] = [
      { wch: 8 },   // TGL
      { wch: 18 },  // TOKO
      { wch: 14 },  // TALY
      { wch: 14 },  // NETTO
      { wch: 14 },  // SUSUT 1
      { wch: 14 },  // SUSUT JUAL
      { wch: 12 },  // %
    ];

    // Title Row 0
    writeCell(ws, 0, 0, sheetTitle, undefined, { bg: 'D9D9D9', bold: true, fontSize: 10, align: 'left', border: 'darkThin' });
    styleRange(ws, 0, 0, 0, 1, { bg: 'D9D9D9', bold: true, fontSize: 10, align: 'left', border: 'darkThin' }, true);
    writeCell(ws, 0, 2, `PERIODE: ${startDate || 'AWAL'} s/d ${endDate || 'AKHIR'}`, undefined, { bg: 'D9D9D9', bold: true, fontSize: 9, align: 'right', border: 'darkThin' });
    styleRange(ws, 0, 2, 0, 6, { bg: 'D9D9D9', bold: true, fontSize: 9, align: 'right', border: 'darkThin' }, true);

    // Headers Row 1 - Yellow #FFFF00
    const colHeaders = ['TGL', 'TOKO', 'TALY', 'NETTO', 'SUSUT 1', 'SUSUT JUAL', '%'];
    colHeaders.forEach((h, idx) => {
      writeCell(ws, 1, idx, h, undefined, { bg: 'FFFF00', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'darkThin' });
    });

    let r = 2;
    agg.storeAggregates.forEach((sr) => {
      for (let day = 1; day <= 31; day++) {
        const dayData = sr.dailyMap.get(day);
        const taly = dayData?.taly || 0;
        const netto = dayData?.netto || 0;
        const susut1 = dayData?.susut1 || 0;
        const susutJual = dayData?.susutJual || 0;
        const rIdx = r + 1;

        writeCell(ws, r, 0, day, undefined, { align: 'center', border: 'thin' });
        writeCell(ws, r, 1, sr.store.name.replace('TDN ', ''), undefined, { bold: true, align: 'left', border: 'thin' });
        writeCell(ws, r, 2, taly, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.000' });
        writeCell(ws, r, 3, netto, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.000' });
        writeCell(ws, r, 4, susut1, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.000' });
        writeCell(ws, r, 5, susutJual, undefined, { align: 'right', border: 'thin', numFmt: '#,##0.000' });
        // Formula for % = IF(TALY>0, (SUSUT1+SUSUTJUAL)/TALY, 0)
        writeCell(ws, r, 6, taly > 0 ? (susut1 + susutJual) / taly : 0, `=IF(C${rIdx}>0, (E${rIdx}+F${rIdx})/C${rIdx}, 0)`, {
          align: 'right',
          border: 'thin',
          numFmt: '0.00%'
        });
        r++;
      }
    });

    // Grand Total Row
    const grandRow = r;
    const grandRowIdx = grandRow + 1;
    writeCell(ws, grandRow, 0, 'TOTAL', undefined, { bg: 'D9D9D9', bold: true, align: 'center', border: 'double' });
    writeCell(ws, grandRow, 1, 'SELURUH CABANG', undefined, { bg: 'D9D9D9', bold: true, align: 'left', border: 'double' });
    writeCell(ws, grandRow, 2, agg.grandTaly, `=SUM(C3:C${grandRow})`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '#,##0.000' });
    writeCell(ws, grandRow, 3, agg.grandNetto, `=SUM(D3:D${grandRow})`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '#,##0.000' });
    writeCell(ws, grandRow, 4, agg.grandSusut1, `=SUM(E3:E${grandRow})`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '#,##0.000' });
    writeCell(ws, grandRow, 5, agg.grandSusutJual, `=SUM(F3:F${grandRow})`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '#,##0.000' });
    writeCell(ws, grandRow, 6, agg.grandPct / 100, `=IF(C${grandRowIdx}>0, (E${grandRowIdx}+F${grandRowIdx})/C${grandRowIdx}, 0)`, { bg: 'D9D9D9', bold: true, align: 'right', border: 'double', numFmt: '0.00%' });

    return { ws, totalRowIdx: grandRowIdx };
  };

  // 2. SHANKLE
  const { ws: wsShankle, totalRowIdx: shankleTotIdx } = buildDailyCategorySheet('SHANKLE', shankleAgg);
  XLSX.utils.book_append_sheet(wb, wsShankle, 'SHANKLE');

  // 3. RENDANG
  const { ws: wsRendang, totalRowIdx: rendangTotIdx } = buildDailyCategorySheet('BAHAN RENDANG', rendangAgg);
  XLSX.utils.book_append_sheet(wb, wsRendang, 'RENDANG');

  // 4. PREMIUM
  const { ws: wsPremium, totalRowIdx: premiumTotIdx } = buildDailyCategorySheet('PREMIUM', premiumAgg);
  XLSX.utils.book_append_sheet(wb, wsPremium, 'PREMIUM');

  // 5. RAWON
  const { ws: wsRawon, totalRowIdx: rawonTotIdx } = buildDailyCategorySheet('RAWON', rawonAgg);
  XLSX.utils.book_append_sheet(wb, wsRawon, 'RAWON');

  // =========================================================================
  // HELPER FOR MODAL SHEETS (MODAL SHANKLE, MODAL RENDANG, MODAL PREMIUM, MODAL RAWON)
  // =========================================================================
  const buildModalSheet = (
    labelKey: string,
    agg: typeof shankleAgg,
    cogsValue: number,
    srcSheetName: string,
    srcTotIdx: number
  ) => {
    const ws: any = {};
    ws['!cols'] = [
      { wch: 22 },  // Col A
      { wch: 14 },  // Col B
      { wch: 6 },   // Col C
      { wch: 6 },   // Col D
      { wch: 14 },  // Col E
      { wch: 6 },   // Col F
      { wch: 18 },  // Col G
      { wch: 14 },  // Col H (Sum of TALY)
      { wch: 14 },  // Col I (Sum of NETTO)
      { wch: 14 },  // Col J (Sum of SUSUT 1)
      { wch: 18 },  // Col K (Sum of SUSUT JUAL)
    ];

    // Pivot Summary Header (Row 0 / Excel Row 1) - Soft Blue #BDD7EE
    const pivotHeaders = ['Sum of TALY', 'Sum of NETTO', 'Sum of SUSUT 1', 'Sum of SUSUT JUAL'];
    pivotHeaders.forEach((h, idx) => {
      writeCell(ws, 0, 7 + idx, h, undefined, { bg: 'BDD7EE', color: '000000', bold: true, fontSize: 9, align: 'center', border: 'darkThin' });
    });

    // Pivot Summary Values (Row 1 / Excel Row 2) - Linked to Category Sheet totals!
    writeCell(ws, 1, 7, agg.grandTaly, `=${srcSheetName}!C${srcTotIdx}`, { border: 'thin', fontSize: 9, align: 'right', numFmt: '#,##0.00' });
    writeCell(ws, 1, 8, agg.grandNetto, `=${srcSheetName}!D${srcTotIdx}`, { border: 'thin', fontSize: 9, align: 'right', numFmt: '#,##0.00' });
    writeCell(ws, 1, 9, agg.grandSusut1, `=${srcSheetName}!E${srcTotIdx}`, { border: 'thin', fontSize: 9, align: 'right', numFmt: '#,##0.00' });
    writeCell(ws, 1, 10, agg.grandSusutJual, `=${srcSheetName}!F${srcTotIdx}`, { border: 'thin', fontSize: 9, align: 'right', numFmt: '#,##0.00' });

    // Row 3 (Excel Row 4): BAHAN
    writeCell(ws, 3, 0, 'BAHAN', undefined, { bg: 'BDD7EE', bold: true, fontSize: 10, align: 'left', border: 'darkThin' });
    writeCell(ws, 3, 1, agg.grandTaly, '=H2', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(ws, 3, 3, 'X', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(ws, 3, 4, cogsValue, undefined, { align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(ws, 3, 5, '=', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(ws, 3, 6, agg.grandTaly * cogsValue, '=B4*E4', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });

    // Row 4 (Excel Row 5): HASIL
    writeCell(ws, 4, 0, 'HASIL', undefined, { bg: 'BDD7EE', bold: true, fontSize: 10, align: 'left', border: 'darkThin' });
    writeCell(ws, 4, 1, agg.grandNetto, '=I2', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(ws, 4, 3, 'X', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(ws, 4, 4, cogsValue, undefined, { align: 'right', border: 'thin', numFmt: '#,##0' });
    writeCell(ws, 4, 5, '=', undefined, { bold: true, align: 'center', border: 'thin' });
    writeCell(ws, 4, 6, agg.grandNetto * cogsValue, '=B5*E5', { bold: true, align: 'right', border: 'thin', numFmt: '#,##0' });

    // Row 6 (Excel Row 7): SUSUT PROSES
    writeCell(ws, 6, 0, 'SUSUT PROSES', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(ws, 6, 1, agg.grandSusut1, '=J2', { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });

    // Row 7 (Excel Row 8): SUSUT JUAL
    writeCell(ws, 7, 0, 'SUSUT JUAL', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(ws, 7, 1, agg.grandSusutJual, '=K2', { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });

    // Row 8 (Excel Row 9): TOTAL SUSUT
    writeCell(ws, 8, 0, 'TOTAL SUSUT', undefined, { bold: true, align: 'left', border: 'thin' });
    writeCell(ws, 8, 1, agg.grandTotalSusut, '=B7+B8', { color: 'C00000', bold: true, align: 'right', border: 'thin', numFmt: '#,##0.00' });
    writeCell(ws, 8, 3, agg.grandPct / 100, '=IF(B4>0, B9/B4, 0)', { bold: true, align: 'right', border: 'thin', numFmt: '0.00%' });

    // Row 10 (Excel Row 11): MODAL - SUSUT JUAL (Yellow Highlight #FFFF00)
    const netWeight = Math.max(0, agg.grandNetto - agg.grandSusutJual);
    const modalWithLoss = netWeight > 0 ? (agg.grandTaly * cogsValue) / netWeight : cogsValue;

    writeCell(ws, 10, 0, `MODAL ${labelKey} - SUSUT JUAL`, undefined, { bg: 'FFFF00', color: '000000', bold: true, fontSize: 10, align: 'left', border: 'double' });
    writeCell(ws, 10, 1, modalWithLoss, '=IF((B5-B8)>0, G4/(B5-B8), E4)', { bg: 'FFFF00', color: '000000', bold: true, fontSize: 10, align: 'right', border: 'double', numFmt: '#,##0.00' });

    return ws;
  };

  // 6. MODAL SHANKLE
  const wsModalShankle = buildModalSheet('SHANKLE', shankleAgg, getCogsForCategory(cogsList, 'SHANKLE'), 'SHANKLE', shankleTotIdx);
  XLSX.utils.book_append_sheet(wb, wsModalShankle, 'MODAL SHANKLE');

  // 7. MODAL RENDANG
  const wsModalRendang = buildModalSheet('D RENDANG', rendangAgg, getCogsForCategory(cogsList, 'RENDANG'), 'RENDANG', rendangTotIdx);
  XLSX.utils.book_append_sheet(wb, wsModalRendang, 'MODAL RENDANG');

  // 8. MODAL PREMIUM
  const wsModalPremium = buildModalSheet('PREMIUM', premiumAgg, getCogsForCategory(cogsList, 'PREM'), 'PREMIUM', premiumTotIdx);
  XLSX.utils.book_append_sheet(wb, wsModalPremium, 'MODAL PREMIUM');

  // 9. MODAL RAWON
  const wsModalRawon = buildModalSheet('RAWON', rawonAgg, getCogsForCategory(cogsList, 'RAWON'), 'RAWON', rawonTotIdx);
  XLSX.utils.book_append_sheet(wb, wsModalRawon, 'MODAL RAWON');

  const filename = `LAPORAN MD SUSUT MULTI CABANG ${dateRangeText.toUpperCase()}.xlsx`.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, filename);
}

// ============================================================================
// EXPORT 3: STORE DAILY CSV
// ============================================================================
export function exportStoreDailyLaporanCSV(
  store: Store,
  dateStr: string,
  items: ThawingItem[],
  segments: FabricationSegment[],
  adjustments: StockAdjustment[],
  closingRecords: ClosingPlanRecord[],
  cogsList: CogsMaster[]
) {
  const rows: (string | number)[][] = [];

  rows.push([`LAPORAN DAGING DAN RAWON FRESH TDN ${store.name.toUpperCase()}`]);
  rows.push([`Tanggal: ${dateStr}`]);
  rows.push(['']);

  // SECTION 1: BAHAN & HASIL
  rows.push(['--- 1. PROSES BAHAN & HASIL POTONG ---']);
  rows.push(['No', 'Bahan / Item', 'Tally Masuk (Kg)', 'x', 'Harga Pokok (Rp)', '=', 'Total Modal (Rp)', 'Susut Proses (Kg)', 'Netto Bersih (Kg)']);

  const todayItems = items.filter((i) => !i.isCarryover);
  let totalBahanKg = 0;
  let totalBahanModal = 0;
  let totalNettoKg = 0;

  todayItems.forEach((item, idx) => {
    const cogs = item.cogsPerKg || lookupCogs(cogsList, item.name, item.pabrikasiCategory || '');
    const bahanKg = item.weightBeforeThawing;
    const nettoKg = item.weightAfterThawing || item.weightBeforeThawing;
    const susutKg = Math.max(0, bahanKg - nettoKg);
    const subtotal = bahanKg * cogs;

    totalBahanKg += bahanKg;
    totalBahanModal += subtotal;
    totalNettoKg += nettoKg;

    rows.push([idx + 1, item.name, bahanKg, 'x', cogs, '=', subtotal, susutKg, nettoKg]);
  });

  rows.push(['TOTAL BAHAN', '', totalBahanKg, '', '', '', totalBahanModal, totalBahanKg - totalNettoKg, totalNettoKg]);
  rows.push(['']);

  // SECTION 2: STOCK REKONSILIASI
  rows.push(['--- 2. REKONSILIASI STOCK & PENJUALAN ---']);
  rows.push([
    'No',
    'Rencana Potong',
    'Stock Awal (Kg)',
    'Bahan Baru (Kg)',
    'Adj In (Kg)',
    'Adj Out (Kg)',
    'Hasil Potong (Kg)',
    'Total Tersedia (Kg)',
    'Penjualan / Sales (Kg)',
    'Sisa Sistem (Kg)',
    'Sisa Fisik Real (Kg)',
    'Susut Jual (Kg)',
    '% Susut',
  ]);

  const planNamesMap = new Set<string>();
  STANDARD_CUT_PLANS.forEach((p) => planNamesMap.add(p.name));
  closingRecords.forEach((c) => planNamesMap.add(c.planName));
  const planNames = Array.from(planNamesMap);

  let sumAwal = 0;
  let sumBahan = 0;
  let sumAdjIn = 0;
  let sumAdjOut = 0;
  let sumHasil = 0;
  let sumTersedia = 0;
  let sumSales = 0;
  let sumSistem = 0;
  let sumReal = 0;
  let sumSusutJual = 0;

  planNames.forEach((plan, idx) => {
    const record = closingRecords.find((c) => (c.planName || '').toLowerCase().includes(plan.toLowerCase()));
    const matchingToday = todayItems.filter((i) => (i.plannedFabrication || '').toLowerCase().includes(plan.toLowerCase()));
    const matchingCarryovers = items.filter((i) => i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(plan.toLowerCase()));
    const matchingSegs = segments.filter((s) => (s.plannedFabrication || '').toLowerCase().includes(plan.toLowerCase()));
    const matchingAdj = adjustments.filter((a) => (a.planName || a.meatName || '').toLowerCase().includes(plan.toLowerCase()));

    const stockAwal = record ? record.openingStockKg : matchingCarryovers.reduce((sum, c) => sum + (c.weightBeforeThawing || 0), 0);
    const bahanMasuk = matchingToday.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
    const adjIn = matchingAdj.filter((a) => a.type === 'IN').reduce((sum, a) => sum + a.weightKg, 0);
    const adjOut = matchingAdj.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + a.weightKg, 0);
    const hasil = matchingToday.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);

    const totalRealTersedia = stockAwal + hasil + adjIn - adjOut;
    const salesKg = record ? record.salesKg : matchingSegs.reduce((sum, s) => sum + (s.salesKg || 0), 0);
    const stockAkhirSistem = Math.max(0, totalRealTersedia - salesKg);
    const stockAkhirReal = record ? record.actualClosingStockKg : matchingSegs.reduce((sum, s) => sum + s.actualWeight, 0);
    const susutJual = record ? record.susutJualKg : Math.max(0, stockAkhirSistem - stockAkhirReal);
    const pct = totalRealTersedia > 0 ? (susutJual / totalRealTersedia) * 100 : 0;

    sumAwal += stockAwal;
    sumBahan += bahanMasuk;
    sumAdjIn += adjIn;
    sumAdjOut += adjOut;
    sumHasil += hasil;
    sumTersedia += totalRealTersedia;
    sumSales += salesKg;
    sumSistem += stockAkhirSistem;
    sumReal += stockAkhirReal;
    sumSusutJual += susutJual;

    rows.push([
      idx + 1,
      plan,
      stockAwal,
      bahanMasuk,
      adjIn,
      adjOut,
      hasil,
      totalRealTersedia,
      salesKg,
      stockAkhirSistem,
      stockAkhirReal,
      susutJual,
      `${pct.toFixed(2)}%`,
    ]);
  });

  const grandPct = sumTersedia > 0 ? (sumSusutJual / sumTersedia) * 100 : 0;
  rows.push([
    'TOTAL',
    '',
    sumAwal,
    sumBahan,
    sumAdjIn,
    sumAdjOut,
    sumHasil,
    sumTersedia,
    sumSales,
    sumSistem,
    sumReal,
    sumSusutJual,
    `${grandPct.toFixed(2)}%`,
  ]);

  const filename = `LAPORAN DAGING ${store.name} ${dateStr}.csv`.replace(/[/\\?%*:|"<>]/g, '-');
  downloadCSV(filename, rows);
}

// ============================================================================
// EXPORT 4: REKAPITULASI MULTI-STORE CSV
// ============================================================================
export function exportRekapSusutCSV(
  stores: Store[],
  dateRangeText: string,
  allReports: DailyClosingReport[]
) {
  const rows: (string | number)[][] = [];

  rows.push([`REKAPITULASI SUSUT DAGING MULTI-CABANG TDN - PERIODE ${dateRangeText.toUpperCase()}`]);
  rows.push(['']);
  rows.push([
    'No',
    'Kode',
    'Nama Cabang',
    'Kota',
    'Bahan Masuk / Tally (Kg)',
    'Hasil Bersih / Netto (Kg)',
    'Susut Proses (Kg)',
    '% Susut Proses',
    'Susut Jual (Kg)',
    '% Susut Jual',
    'Total Susut (Kg)',
    '% Total Susut',
    'Status Toleransi',
  ]);

  let sumTally = 0;
  let sumNetto = 0;
  let sumSusutProses = 0;
  let sumSusutJual = 0;

  stores.forEach((store, idx) => {
    const storeReports = allReports.filter((r) => matchStoreEntity(r.storeId, store) || (r.storeName && matchStoreEntity(r.storeName, store)));
    let tally = 0;
    let netto = 0;
    let susutJual = 0;

    storeReports.forEach((rep) => {
      rep.itemsProcessed?.forEach((item) => {
        tally += item.weightBefore || 0;
        netto += item.weightAfter || item.finalWeight || 0;
        susutJual += item.susutJualKg || 0;
      });
    });

    const susutProses = Math.max(0, tally - netto);
    const totalSusut = susutProses + susutJual;
    const susutProsesPct = tally > 0 ? (susutProses / tally) * 100 : 0;
    const susutJualPct = tally > 0 ? (susutJual / tally) * 100 : 0;
    const totalSusutPct = tally > 0 ? (totalSusut / tally) * 100 : 0;

    sumTally += tally;
    sumNetto += netto;
    sumSusutProses += susutProses;
    sumSusutJual += susutJual;

    const status =
      tally === 0
        ? 'BELUM ADA TRANSAKSI'
        : totalSusutPct <= 2.0
        ? 'AMAN (<= 2.0%)'
        : 'TINGGI (> 2.0%)';

    rows.push([
      idx + 1,
      store.code,
      store.name,
      store.city,
      tally,
      netto,
      susutProses,
      `${susutProsesPct.toFixed(2)}%`,
      susutJual,
      `${susutJualPct.toFixed(2)}%`,
      totalSusut,
      `${totalSusutPct.toFixed(2)}%`,
      status,
    ]);
  });

  const grandTotalSusut = sumSusutProses + sumSusutJual;
  const grandSusutProsesPct = sumTally > 0 ? (sumSusutProses / sumTally) * 100 : 0;
  const grandSusutJualPct = sumTally > 0 ? (sumSusutJual / sumTally) * 100 : 0;
  const grandTotalSusutPct = sumTally > 0 ? (grandTotalSusut / sumTally) * 100 : 0;

  rows.push([
    'TOTAL',
    '',
    'SELURUH CABANG',
    '',
    sumTally,
    sumNetto,
    sumSusutProses,
    `${grandSusutProsesPct.toFixed(2)}%`,
    sumSusutJual,
    `${grandSusutJualPct.toFixed(2)}%`,
    grandTotalSusut,
    `${grandTotalSusutPct.toFixed(2)}%`,
    grandTotalSusutPct <= 2.0 ? 'AMAN (<= 2.0%)' : 'TINGGI (> 2.0%)',
  ]);

  const filename = `SUSUT MULTI CABANG ${dateRangeText.toUpperCase()}.csv`.replace(/[/\\?%*:|"<>]/g, '-');
  downloadCSV(filename, rows);
}

/**
 * Universal CSV Download Trigger
 */
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csvContent =
    '\uFEFF' +
    rows
      .map((e) =>
        e
          .map((cell) => {
            const cellStr = cell === null || cell === undefined ? '' : String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(',')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
