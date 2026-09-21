import { Store } from '../types';

/**
 * Matches an entity's store identifier against a target Store.
 * Supports store IDs ('1', 'store_ckr'), store codes ('CKR', 'ckr'),
 * store names ('TDN CKR', 'tdn ckr'), and handles untagged entities gracefully.
 */
export function matchStoreEntity(
  entityStoreId: any,
  targetStore: { id: any; code?: any; name?: any } | undefined | null
): boolean {
  if (!targetStore) return true;
  if (entityStoreId === undefined || entityStoreId === null || String(entityStoreId).trim() === '') {
    // Untagged entities belong to the default/primary store
    return true;
  }

  const eId = String(entityStoreId).toLowerCase().trim();
  const sId = String(targetStore.id || '').toLowerCase().trim();
  const sCode = String(targetStore.code || '').toLowerCase().trim();
  const sName = String(targetStore.name || '').toLowerCase().trim();

  if (eId === sId) return true;
  if (sCode && (eId === sCode || eId === `store_${sCode}` || eId.includes(sCode))) return true;
  if (sName && (eId === sName || eId.includes(sName) || sName.includes(eId))) return true;

  // Specific aliases fallback: ckr <-> ckt backwards compatibility
  if ((eId === 'store_ckr' || eId === 'ckr') && (sCode === 'ckr' || sId === '1')) return true;
  if ((eId === 'store_ckt' || eId === 'ckt') && (sCode === 'ckt' || sCode === 'ckr' || sId === '1')) return true;

  return false;
}

/**
 * Resolves the currently active store based on user role and selections.
 */
export function getEffectiveStore(
  stores: Store[],
  userRole: string,
  selectedStoreIdForMd: string,
  currentUserStoreId?: string
): Store {
  if (stores.length === 0) {
    return {
      id: '1',
      code: 'CKR',
      name: 'TDN CKR',
      city: 'Cikarang',
      createdAt: '2026-01-01',
    };
  }

  if (userRole === 'md') {
    const found = stores.find((s) => s.id === selectedStoreIdForMd || matchStoreEntity(selectedStoreIdForMd, s));
    if (found) return found;
  } else if (currentUserStoreId) {
    const found = stores.find((s) => s.id === currentUserStoreId || matchStoreEntity(currentUserStoreId, s));
    if (found) return found;
  }

  return stores[0];
}

/**
 * Normalizes and fuzzily matches plan names across all components.
 */
export function normalizePlanName(str?: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isMatchPlan(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().trim();
  const cleanB = b.toLowerCase().trim();
  if (cleanA === cleanB) return true;

  const normA = normalizePlanName(cleanA);
  const normB = normalizePlanName(cleanB);
  if (normA === normB) return true;

  // Distinct plan discrimination:
  const isFriboyA = normA.includes('friboy') || normA.includes('prem2');
  const isFriboyB = normB.includes('friboy') || normB.includes('prem2');
  if (isFriboyA !== isFriboyB) return false;

  const isShankleA = normA.includes('shank') || normA.includes('shankle');
  const isShankleB = normB.includes('shank') || normB.includes('shankle');
  if (isShankleA !== isShankleB) return false;

  const isMemberA = normA.includes('member');
  const isMemberB = normB.includes('member');
  if (isMemberA !== isMemberB) return false;

  const isRawonA = normA.includes('rawon');
  const isRawonB = normB.includes('rawon');
  if (isRawonA !== isRawonB) return false;

  // Rendang alias check (e.g. 'rdang' <-> 'rendang')
  const isRendangA = normA.includes('rdang') || normA.includes('rendang');
  const isRendangB = normB.includes('rdang') || normB.includes('rendang');
  if (isRendangA && isRendangB && !isShankleA && !isMemberA) return true;

  // Premium alias check (e.g. 'prem' <-> 'premium')
  const isPremA = normA.includes('prem') || normA.includes('premium');
  const isPremB = normB.includes('prem') || normB.includes('premium');
  if (isPremA && isPremB && !isFriboyA) return true;

  if (normA.length >= 6 && normB.length >= 6) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  return false;
}

/**
 * Generates a deterministic and synchronized ID for a ClosingPlanRecord
 * ensuring that Butcher, MD, and Admin devices all reference and update the exact same record
 * without generating mismatched random IDs.
 */
export function getDeterministicClosingRecordId(
  storeId?: string,
  planName?: string,
  date?: string
): string {
  const cleanStore = String(storeId || '1').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanPlan = normalizePlanName(planName || 'general');
  const cleanDate = (date || new Date().toISOString().split('T')[0]).replace(/[^0-9\-]/g, '');
  return `cpr_${cleanStore}_${cleanPlan}_${cleanDate}`;
}

