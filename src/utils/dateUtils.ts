import { ClosingPlanRecord } from '../types';
import { matchStoreEntity, isMatchPlan } from './storeHelper';

/**
 * Mendapatkan tanggal kalender tepat 1 hari sebelumnya (H-1) dalam format YYYY-MM-DD
 */
export function getPreviousDateStr(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    const prevY = dateObj.getFullYear();
    const prevM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const prevD = String(dateObj.getDate()).padStart(2, '0');
    return `${prevY}-${prevM}-${prevD}`;
  } catch {
    return '';
  }
}

/**
 * Mendapatkan tanggal kalender tepat 1 hari sesudahnya (H+1) dalam format YYYY-MM-DD
 */
export function getNextDateStr(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    const nextY = dateObj.getFullYear();
    const nextM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nextD = String(dateObj.getDate()).padStart(2, '0');
    return `${nextY}-${nextM}-${nextD}`;
  } catch {
    return '';
  }
}

/**
 * Mencari data closing fisik tepat H-1 (1 hari sebelum targetDate) untuk toko & rencana potong tertentu.
 * Aturan Bisnis:
 * Hanya data dari H-1 (tepat 1 hari kalender sebelum targetDate) yang terhitung sebagai
 * sisa kemarin / stock awal tanggal targetDate.
 * Jika H-1 belum memiliki data closing, maka sisa kemarin adalah 0 (terisolasi per tanggal).
 */
export function findHMinus1ClosingRecord(
  records: ClosingPlanRecord[],
  storeIdOrObj: any,
  planName: string,
  targetDate: string
): ClosingPlanRecord | undefined {
  const hMinus1Date = getPreviousDateStr(targetDate);
  if (!hMinus1Date) return undefined;

  return records.find((r) => {
    const rDate = (r.date || r.timestamp || '').split('T')[0];
    return (
      rDate === hMinus1Date &&
      matchStoreEntity(r.storeId, storeIdOrObj) &&
      isMatchPlan(r.planName, planName)
    );
  });
}

/**
 * Mendapatkan angka stock awal (sisa kemarin) untuk targetDate dari closing H-1.
 * Mengembalikan null jika belum ada closing di H-1.
 */
export function getHMinus1ClosingStock(
  records: ClosingPlanRecord[],
  storeIdOrObj: any,
  planName: string,
  targetDate: string
): number | null {
  const h1 = findHMinus1ClosingRecord(records, storeIdOrObj, planName, targetDate);
  if (h1 && typeof h1.actualClosingStockKg === 'number' && !isNaN(h1.actualClosingStockKg)) {
    return h1.actualClosingStockKg;
  }
  return null;
}

/**
 * Ketika closing untuk tanggal D disimpan, fungsi ini memeriksa apakah sudah ada data closing
 * untuk hari berikutnya (D + 1). Jika sudah ada, sisa kemarin (openingStockKg) hari D + 1
 * otomatis diperbarui mengikuti actualClosingStockKg hari D, dan susut jualnya dihitung ulang.
 */
export function propagateClosingToNextDay(
  currentRecord: ClosingPlanRecord,
  allRecords: ClosingPlanRecord[]
): ClosingPlanRecord[] {
  const recordDate = (currentRecord.date || currentRecord.timestamp || '').split('T')[0];
  if (!recordDate) return allRecords;

  const nextDayDate = getNextDateStr(recordDate);
  const closingStock = typeof currentRecord.actualClosingStockKg === 'number'
    ? currentRecord.actualClosingStockKg
    : 0;

  return allRecords.map((r) => {
    const rDate = (r.date || r.timestamp || '').split('T')[0];
    if (
      rDate === nextDayDate &&
      matchStoreEntity(r.storeId, { id: currentRecord.storeId }) &&
      isMatchPlan(r.planName, currentRecord.planName)
    ) {
      const newOpening = closingStock;
      const totalTersedia = newOpening + (r.newProcessedKg || 0) + (r.adjustInKg || 0) - (r.adjustOutKg || 0);
      const closingStockBySystemKg = Math.max(0, totalTersedia - (r.salesKg || 0));
      const susutJualKg = Math.max(0, closingStockBySystemKg - (r.actualClosingStockKg || 0));

      return {
        ...r,
        openingStockKg: parseFloat(newOpening.toFixed(3)),
        closingStockBySystemKg: parseFloat(closingStockBySystemKg.toFixed(3)),
        susutJualKg: parseFloat(susutJualKg.toFixed(3)),
      };
    }
    return r;
  });
}
