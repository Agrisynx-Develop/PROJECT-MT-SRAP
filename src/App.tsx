import React, { useState, useEffect } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  DailyClosingReport,
  LossAlertConfig,
  Store,
  UserAccount,
  CogsMaster,
  StockAdjustment,
  ClosingPlanRecord
} from './types';
import {
  getStores,
  saveStores,
  getUsers,
  saveUsers,
  getCurrentUser,
  setCurrentUser,
  getCogsMaster,
  saveCogsMaster,
  normalizeCogsList,
  getStockAdjustments,
  saveStockAdjustments,
  getClosingPlanRecords,
  saveClosingPlanRecords,
  deleteClosingPlanRecord,
  purgeDateRecords,
  getThawingItems,
  saveThawingItems,
  getFabricationSegments,
  saveFabricationSegments,
  getDailyReports,
  saveDailyReports,
  getLossConfig,
  saveLossConfig,
  resetDatabase,
  pullAllDataFromGoogleSheets,
  deleteThawingItemFromCloud,
} from './utils/db';
import {
  getGoogleAppsScriptUrl,
  getLastSyncTime,
  upsertRecordToSheets,
  deleteRecordFromSheets,
  updateTableInSheets,
  pushAllDataToSheets,
} from './utils/sheetsApi';
import { matchStoreEntity, getEffectiveStore, isMatchPlan, getDeterministicClosingRecordId } from './utils/storeHelper';

// Auth Screen
import LoginScreen from './components/LoginScreen';

// Primary views
import Dashboard from './components/Dashboard';
import AntrianPabrikasi from './components/AntrianPabrikasi';
import SegmentasiPabrikasi from './components/SegmentasiPabrikasi';
import UpdateSales from './components/UpdateSales';
import Summary from './components/Summary';
import RiwayatHarian from './components/RiwayatHarian';
import AdminTokoView from './components/AdminTokoView';
import MdHelicopterView from './components/MdHelicopterView';
import ButcherClosingView from './components/ButcherClosingView';

// Modals
import TransferPurposeModal from './components/TransferPurposeModal';
import EditRencanaPotongModal from './components/EditRencanaPotongModal';
import GoogleSheetsSetupModal from './components/GoogleSheetsSetupModal';

// Icons
import {
  LayoutDashboard,
  Clock,
  Scissors,
  DollarSign,
  TrendingDown,
  FileSpreadsheet,
  History,
  RotateCcw,
  Building2,
  Compass,
  Settings,
  X,
  Beef,
  Menu,
  LogOut,
  Database,
  CheckCircle2,
  CheckSquare,
  User
} from 'lucide-react';

// Helper to normalize user role regardless of casing ('MD_PUSAT', 'ADMIN_TOKO', 'md', 'admin', 'butcher')
export function normalizeRole(role?: any): 'butcher' | 'admin' | 'md' {
  if (!role) return 'butcher';
  const r = String(role).toLowerCase().trim();
  if (r.includes('md') || r.includes('merchandis') || r.includes('pusat')) {
    return 'md';
  }
  if (r.includes('admin') || r.includes('toko') || r.includes('store')) {
    return 'admin';
  }
  return 'butcher';
}

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Navigation active tab & Sidebar state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // Account & Store State
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreIdForMd, setSelectedStoreIdForMd] = useState<string>('store_ckt');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);

  // Operational Database State
  const [cogsList, setCogsList] = useState<CogsMaster[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [closingRecords, setClosingRecords] = useState<ClosingPlanRecord[]>([]);
  const [items, setItems] = useState<ThawingItem[]>([]);
  const [segments, setSegments] = useState<FabricationSegment[]>([]);
  const [reports, setReports] = useState<DailyClosingReport[]>([]);
  const [lossConfig, setLossConfig] = useState<LossAlertConfig>({
    maxProcessLossPercent: 1.0,
    maxSalesLossPercent: 1.0,
    maxDailyLossPercent: 2.0,
    safeThawingLossPercent: 1.0,
    safeFabricationLossPercent: 1.0,
    salesPredictionKg: 40.0,
  });

  // Google Sheets Cloud Sync & Multi-Device State
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(getLastSyncTime());
  const [cloudConnected, setCloudConnected] = useState<boolean>(Boolean(getGoogleAppsScriptUrl()));

  // Modal states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [editPlanItemId, setEditPlanItemId] = useState<string | null>(null);

  // New Store Form State (in Account Settings Modal)
  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('');
  const [newButcherName, setNewButcherName] = useState('');
  const [newButcherPassword, setNewButcherPassword] = useState('butcher123');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('admin123');
  const [addStoreSuccess, setAddStoreSuccess] = useState(false);

  // Initial Load from Integrated Database, Google Sheets, or local cache
  const fetchAllData = async (silent = false) => {
    if (!silent) setIsCloudSyncing(true);
    try {
      const hasSheetsUrl = Boolean(getGoogleAppsScriptUrl());
      setCloudConnected(hasSheetsUrl);

      // 1. If Google Apps Script is configured, prioritize pulling directly from Google Spreadsheet
      if (hasSheetsUrl) {
        const sheetsRes = await pullAllDataFromGoogleSheets();
        if (sheetsRes.success && sheetsRes.data) {
          const d = sheetsRes.data;
          if (d.stores && d.stores.length > 0) {
            setStores(d.stores);
            setSelectedStoreIdForMd((prev) => {
              if (d.stores && d.stores.some((s) => s.id === prev || matchStoreEntity(prev, s))) return prev;
              return d.stores ? d.stores[0].id : prev;
            });
          }
          if (d.users && d.users.length > 0) setUsers(d.users);
          if (d.cogsMaster && d.cogsMaster.length > 0) setCogsList(normalizeCogsList(d.cogsMaster));
          if (d.thawingItems) setItems((d.thawingItems || []).filter((i: any) => (i.createdAt || i.thawingStartTime || '').split('T')[0] !== '2026-08-29'));
          if (d.fabricationSegments) setSegments((d.fabricationSegments || []).filter((s: any) => (s.createdAt || s.transferTimestamp || '').split('T')[0] !== '2026-08-29'));
          if (d.closingPlanRecords) {
            const rawRecords = Array.isArray(d.closingPlanRecords) ? d.closingPlanRecords : [];
            const sanitized: ClosingPlanRecord[] = rawRecords
              .filter((r: any) => (r.date || r.timestamp || '').split('T')[0] !== '2026-08-29')
              .map((r: any) => ({
                ...r,
                openingStockKg: Number(r.openingStockKg) || 0,
                newProcessedKg: Number(r.newProcessedKg) || 0,
                adjustInKg: Number(r.adjustInKg) || 0,
                adjustOutKg: Number(r.adjustOutKg) || 0,
                salesKg: Number(r.salesKg) || 0,
                closingStockBySystemKg: Number(r.closingStockBySystemKg) || 0,
                actualClosingStockKg: Number(r.actualClosingStockKg) || 0,
                susutJualKg: Number(r.susutJualKg) || 0,
              }));

            // Merge with local records if local has newer closed timestamp or non-zero weight
            const local = getClosingPlanRecords();
            const localList = (Array.isArray(local) ? local : []).filter(
              (r) => (r.date || r.timestamp || '').split('T')[0] !== '2026-08-29'
            );
            const merged: ClosingPlanRecord[] = [...sanitized];

            localList.forEach((loc) => {
              const idx = merged.findIndex(
                (s) =>
                  s.id === loc.id ||
                  (matchStoreEntity(s.storeId, { id: loc.storeId }) &&
                    isMatchPlan(s.planName, loc.planName) &&
                    (s.date === loc.date || !s.date || !loc.date))
              );
              if (idx < 0) {
                merged.push(loc);
              } else {
                const locActual = Number(loc.actualClosingStockKg) || 0;
                const srvActual = Number(merged[idx].actualClosingStockKg) || 0;
                if (locActual > 0 && srvActual === 0) {
                  merged[idx] = { ...merged[idx], ...loc };
                } else if (new Date(loc.timestamp || 0).getTime() > new Date(merged[idx].timestamp || 0).getTime()) {
                  merged[idx] = { ...merged[idx], ...loc };
                }
              }
            });

            const filteredMerged = merged.filter((r) => (r.date || r.timestamp || '').split('T')[0] !== '2026-08-29');
            setClosingRecords(filteredMerged);
            if (filteredMerged.length > 0) {
              saveClosingPlanRecords(filteredMerged);
            }
          }
          if (d.dailyClosingReports) setReports((d.dailyClosingReports || []).filter((r: any) => (r.date || '').split('T')[0] !== '2026-08-29'));
          if (d.stockAdjustments) setAdjustments((d.stockAdjustments || []).filter((a: any) => (a.date || a.createdAt || '').split('T')[0] !== '2026-08-29'));
          if (d.lossConfig) setLossConfig(d.lossConfig);
          setLastCloudSync(new Date().toISOString());
          return;
        }
      }

      // 2. Fallback: Fetch from backend API / local cache
      const [resStores, resUsers, resCogs, resItems, resSegs, resAdjs, resRecords, resReps] = await Promise.all([
        fetch('/api/stores').catch(() => null),
        fetch('/api/users').catch(() => null),
        fetch('/api/cogs').catch(() => null),
        fetch('/api/thawing-items').catch(() => null),
        fetch('/api/fabrication-segments').catch(() => null),
        fetch('/api/adjustments').catch(() => null),
        fetch('/api/closing-records').catch(() => null),
        fetch('/api/reports').catch(() => null),
      ]);

      if (resStores && resStores.ok) {
        const data = await resStores.json();
        if (Array.isArray(data) && data.length > 0) {
          setStores(data);
          setSelectedStoreIdForMd((prev) => {
            if (data.some((s) => s.id === prev || matchStoreEntity(prev, s))) return prev;
            return data[0].id;
          });
        }
      } else {
        const localStores = getStores();
        setStores(localStores);
        if (localStores.length > 0) {
          setSelectedStoreIdForMd((prev) => {
            if (localStores.some((s) => s.id === prev || matchStoreEntity(prev, s))) return prev;
            return localStores[0].id;
          });
        }
      }

      if (resUsers && resUsers.ok) {
        const data = await resUsers.json();
        if (Array.isArray(data) && data.length > 0) setUsers(data);
      } else {
        setUsers(getUsers());
      }

      if (resCogs && resCogs.ok) {
        const data = await resCogs.json();
        if (Array.isArray(data) && data.length > 0) {
          const normalized = normalizeCogsList(data);
          setCogsList(normalized);
        } else {
          setCogsList(getCogsMaster());
        }
      } else {
        setCogsList(getCogsMaster());
      }

      if (resItems && resItems.ok) {
        const data = await resItems.json();
        if (Array.isArray(data)) setItems(data);
      } else {
        setItems(getThawingItems());
      }

      if (resSegs && resSegs.ok) {
        const data = await resSegs.json();
        if (Array.isArray(data)) setSegments(data);
      } else {
        setSegments(getFabricationSegments());
      }

      if (resAdjs && resAdjs.ok) {
        const data = await resAdjs.json();
        if (Array.isArray(data)) setAdjustments(data);
      } else {
        setAdjustments(getStockAdjustments());
      }

      if (resRecords && resRecords.ok) {
        const data = await resRecords.json();
        const local = getClosingPlanRecords();
        const serverList = (Array.isArray(data) ? data : []).filter((r: any) => (r.date || r.timestamp || '').split('T')[0] !== '2026-08-29');
        const localList = (Array.isArray(local) ? local : []).filter((r: any) => (r.date || r.timestamp || '').split('T')[0] !== '2026-08-29');

        // Merge: Start with server records, but keep any local records that are not on the server
        const merged = [...serverList];
        localList.forEach((loc) => {
          const idx = merged.findIndex(
            (s) =>
              matchStoreEntity(s.storeId, { id: loc.storeId }) &&
              isMatchPlan(s.planName, loc.planName) &&
              s.date === loc.date
          );
          if (idx < 0) {
            merged.push(loc);
          } else {
            // If local has newer timestamp or actual stock, prioritize it
            if (loc.actualClosingStockKg !== undefined && loc.actualClosingStockKg > 0 && (!merged[idx].actualClosingStockKg || merged[idx].actualClosingStockKg === 0)) {
              merged[idx] = { ...merged[idx], ...loc };
            }
          }
        });

        const filtered = merged.filter((r) => (r.date || r.timestamp || '').split('T')[0] !== '2026-08-29');
        setClosingRecords(filtered);
        if (filtered.length > 0) {
          saveClosingPlanRecords(filtered);
        }
      } else {
        setClosingRecords(getClosingPlanRecords());
      }

      if (resReps && resReps.ok) {
        const data = await resReps.json();
        if (Array.isArray(data)) setReports(data);
      } else {
        setReports(getDailyReports());
      }

      setLossConfig(getLossConfig());
    } catch (e) {
      console.warn('Using local fallback state:', e);
      setStores(getStores());
      setUsers(getUsers());
      setCogsList(getCogsMaster());
      setAdjustments(getStockAdjustments());
      setClosingRecords(getClosingPlanRecords());
      setItems(getThawingItems());
      setSegments(getFabricationSegments());
      setReports(getDailyReports());
      setLossConfig(getLossConfig());
    } finally {
      setIsCloudSyncing(false);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // 1. Initialize user session and default tab ONCE on mount
    const savedUserStr = localStorage.getItem('current_logged_user');
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.id) {
          const roleNorm = normalizeRole(parsed.role);
          const userObj = { ...parsed, role: roleNorm };
          setCurrentUserState(userObj);
          if (roleNorm === 'md') {
            setActiveTab('md');
          } else if (roleNorm === 'admin') {
            setActiveTab('admin_toko');
          } else {
            setActiveTab('dashboard');
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. Fetch initial data on mount (without touching activeTab)
    fetchAllData(true);

    // 3. Periodic gentle background polling (every 12s if tab is visible) to auto-sync closing and sales across roles
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAllData(true);
      }
    }, 12000);

    // 4. Gentle sync on tab return / window focus (NEVER resets activeTab)
    const handleFocus = () => {
      fetchAllData(true);
    };

    window.addEventListener('focus', handleFocus);

    // 5. Cross-tab instant communication via BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('tdn_meat_tracker_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'CLOSING_RECORD_SAVED' && event.data.record) {
            const incoming: ClosingPlanRecord = event.data.record;
            setClosingRecords((prev) => {
              const existingIdx = prev.findIndex(
                (r) =>
                  r.id === incoming.id ||
                  (matchStoreEntity(r.storeId, { id: incoming.storeId }) &&
                    isMatchPlan(r.planName, incoming.planName) &&
                    (r.date === incoming.date || !r.date || !incoming.date))
              );
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = incoming;
                return next;
              }
              return [incoming, ...prev];
            });
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel setup error:', e);
      }
    }

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      if (bc) {
        try {
          bc.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Handler: Login Success from SQL
  const handleLoginSuccess = (user: UserAccount) => {
    const roleNorm = normalizeRole(user.role);
    const userObj = { ...user, role: roleNorm };
    setCurrentUserState(userObj);
    setCurrentUser(userObj);
    if (roleNorm === 'md') {
      setActiveTab('md');
    } else if (roleNorm === 'admin') {
      setActiveTab('admin_toko');
    } else {
      setActiveTab('dashboard');
    }
  };

  // Handler: Logout (Guaranteed to clear session and reset to Login Screen)
  const handleLogout = () => {
    if (window.confirm('Yakin ingin keluar dari akun?')) {
      localStorage.removeItem('current_logged_user');
      localStorage.removeItem('tdn_current_user');
      setCurrentUserState(null);
      setIsMobileSidebarOpen(false);
    }
  };

  // Handler: Add Item for Thawing
  const handleAddItem = (
    newItem: Omit<ThawingItem, 'id' | 'status' | 'thawingStartTime' | 'createdAt' | 'butcherId' | 'butcherName'>
  ) => {
    const now = new Date();
    const item: ThawingItem = {
      ...newItem,
      id: `meat_${Date.now()}`,
      storeId: currentUser?.storeId || 'store_ckr',
      status: 'thawing',
      thawingStartTime: now.toISOString(),
      createdAt: now.toISOString(),
      butcherName: currentUser?.fullName || 'Petugas Butcher',
      isCarryover: false,
    };
    const updated = [item, ...items];
    setItems(updated);
    saveThawingItems(updated);

    // Sync to backend & Google Sheets immediately upon completion
    upsertRecordToSheets('thawing_items', item);
    fetch('/api/thawing-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    }).catch(console.error);
  };

  // Handler: Update Item
  const handleUpdateItem = (updatedItem: ThawingItem) => {
    const updated = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
    setItems(updated);
    saveThawingItems(updated);

    upsertRecordToSheets('thawing_items', updatedItem);
    fetch('/api/thawing-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem)
    }).catch(console.error);
  };

  // Handler: Delete Item(s)
  const handleDeleteItem = (itemIdOrIds: string | string[]) => {
    const ids = Array.isArray(itemIdOrIds) ? itemIdOrIds : [itemIdOrIds];
    const updated = items.filter((i) => !ids.includes(i.id));
    setItems(updated);
    saveThawingItems(updated);

    ids.forEach((id) => {
      deleteRecordFromSheets('thawing_items', id);
      deleteThawingItemFromCloud(id);
      fetch(`/api/thawing-items/${id}`, { method: 'DELETE' }).catch(() => {});
    });
  };

  // Handler: Confirm Thawing Finish (MANDATORY Photo)
  const handleStartFabrication = (id: string, weightAfter: number, photoImage?: string) => {
    let targetUpdatedObj: ThawingItem | null = null;
    const updated = items.map((item) => {
      if (item.id === id) {
        const lossKg = Math.max(0, item.weightBeforeThawing - weightAfter);
        const lossPct = item.weightBeforeThawing > 0 ? (lossKg / item.weightBeforeThawing) * 100 : 0;
        const updatedObj = {
          ...item,
          status: 'pabrikasi_ready' as const,
          weightAfterThawing: weightAfter,
          thawingEndTime: new Date().toISOString(),
          shrinkageThawing: lossKg,
          shrinkageThawingPercent: lossPct,
          image: photoImage || item.image || '',
        };
        targetUpdatedObj = updatedObj;
        fetch('/api/thawing-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedObj)
        }).catch(console.error);
        return updatedObj;
      }
      return item;
    });
    setItems(updated);
    saveThawingItems(updated);
    if (targetUpdatedObj) {
      upsertRecordToSheets('thawing_items', targetUpdatedObj);
    }
  };

  // Handler: Save Segments from SegmentasiPabrikasi
  const handleSaveSegments = (
    itemId: string,
    newSegmentInputs: { segmentName: string; targetWeight: number; actualWeight: number }[],
    updatedPlan?: string,
    updatedPurpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY'
  ) => {
    const parentItem = items.find((i) => i.id === itemId);
    const planName = updatedPlan || parentItem?.plannedFabrication || 'DAGING RENDANG PREMIUM';
    const purpose = updatedPurpose || parentItem?.openingPurpose || 'UNTUK DISPLAY';

    const createdSegments: FabricationSegment[] = newSegmentInputs.map((seg, idx) => ({
      id: `seg_${Date.now()}_${idx}`,
      itemId,
      itemName: parentItem?.name || 'Bahan Daging',
      segmentName: seg.segmentName,
      targetWeight: seg.targetWeight,
      actualWeight: seg.actualWeight,
      periodicShrinkage: 0,
      salesKg: 0,
      plannedFabrication: planName,
      openingPurpose: purpose,
      storeId: currentUser?.storeId || 'store_ckr',
      createdAt: new Date().toISOString(),
    }));

    const updatedSegments = [...segments, ...createdSegments];
    setSegments(updatedSegments);
    saveFabricationSegments(updatedSegments);

    // Sync to SQL & Sheets
    createdSegments.forEach((seg) => upsertRecordToSheets('fabrication_segments', seg));
    fetch('/api/fabrication-segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createdSegments)
    }).catch(console.error);

    // Update parent item to pabrikasi_done
    const updatedItems = items.map((i) =>
      i.id === itemId
        ? {
            ...i,
            status: 'pabrikasi_done' as const,
            plannedFabrication: planName,
            openingPurpose: purpose,
          }
        : i
    );
    setItems(updatedItems);
    saveThawingItems(updatedItems);
    const updatedParent = updatedItems.find((i) => i.id === itemId);
    if (updatedParent) {
      upsertRecordToSheets('thawing_items', updatedParent);
    }
  };

  // Handler: Update Sales from UpdateSales
  const handleUpdateSales = (
    planNameOrSegmentId: string,
    salesAmountKg: number,
    overridePhysicalClosingKg?: number
  ) => {
    const isSegment = segments.some((s) => s.id === planNameOrSegmentId);
    let updatedSegments: FabricationSegment[];

    const isMatchPlan = (a?: string, b?: string) => {
      if (!a || !b) return false;
      const cleanA = a.toLowerCase().trim();
      const cleanB = b.toLowerCase().trim();
      return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
    };

    if (isSegment) {
      updatedSegments = segments.map((s) => {
        if (s.id === planNameOrSegmentId) {
          const currentSales = s.salesKg || 0;
          const newActual = overridePhysicalClosingKg !== undefined ? overridePhysicalClosingKg : Math.max(0, s.actualWeight - salesAmountKg);
          return {
            ...s,
            salesKg: currentSales + salesAmountKg,
            actualWeight: newActual,
          };
        }
        return s;
      });
    } else {
      updatedSegments = segments.map((s) => {
        const parentItem = items.find((i) => i.id === s.itemId);
        const plan = s.plannedFabrication || parentItem?.plannedFabrication;
        if (isMatchPlan(plan, planNameOrSegmentId) && (s.openingPurpose || 'UNTUK DISPLAY') === 'UNTUK DISPLAY') {
          const currentSales = s.salesKg || 0;
          return {
            ...s,
            salesKg: currentSales + salesAmountKg,
            actualWeight: Math.max(0, s.actualWeight - salesAmountKg),
          };
        }
        return s;
      });
    }

    setSegments(updatedSegments);
    saveFabricationSegments(updatedSegments);
    updateTableInSheets('fabrication_segments', updatedSegments);

    fetch('/api/fabrication-segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSegments)
    }).catch(console.error);

    // ADAPTIVE RECALCULATION OF CLOSING RECORDS:
    // Even if closing was already done, updating sales recalculates system stock and susut jual dynamically!
    const effectiveStoreId = currentStore?.id || currentUser?.storeId || 'store_ckr';
    const updatedItems = items.map((i) => {
      if (isMatchPlan(i.plannedFabrication, planNameOrSegmentId) && matchStoreEntity(i.storeId, currentStore)) {
        return {
          ...i,
          salesKg: (i.salesKg || 0) + salesAmountKg,
        };
      }
      return i;
    });
    setItems(updatedItems);
    saveThawingItems(updatedItems);
    updateTableInSheets('thawing_items', updatedItems);

    let foundMatchingRecord = false;
    let updatedClosingRecords = closingRecords.map((rec) => {
      if (matchStoreEntity(rec.storeId, currentStore) && isMatchPlan(rec.planName, planNameOrSegmentId)) {
        foundMatchingRecord = true;
        const planSegments = updatedSegments.filter((s) => isMatchPlan(s.plannedFabrication, rec.planName));
        const totalPlanSales = planSegments.length > 0
          ? planSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0)
          : (rec.salesKg || 0) + salesAmountKg;
        const totalTersedia = (rec.openingStockKg || 0) + (rec.newProcessedKg || 0) + (rec.adjustInKg || 0) - (rec.adjustOutKg || 0);
        const closingBySystem = Math.max(0, totalTersedia - totalPlanSales);
        const actualClosing = overridePhysicalClosingKg !== undefined ? overridePhysicalClosingKg : rec.actualClosingStockKg;
        const susutJualKg = typeof actualClosing === 'number' ? Math.max(0, closingBySystem - actualClosing) : 0;

        return {
          ...rec,
          salesKg: parseFloat(totalPlanSales.toFixed(3)),
          closingStockBySystemKg: parseFloat(closingBySystem.toFixed(3)),
          actualClosingStockKg: actualClosing,
          susutJualKg: parseFloat(susutJualKg.toFixed(3)),
        };
      }
      return rec;
    });

    // If no closing record existed yet but user entered physical override or closing
    if (!foundMatchingRecord && overridePhysicalClosingKg !== undefined) {
      const planItems = updatedItems.filter((i) => isMatchPlan(i.plannedFabrication, planNameOrSegmentId) && matchStoreEntity(i.storeId, currentStore));
      const carryover = planItems.filter((i) => i.isCarryover).reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0);
      const newProc = planItems.filter((i) => !i.isCarryover).reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing || 0), 0);
      const totalTersedia = carryover + newProc;
      const closingBySystem = Math.max(0, totalTersedia - salesAmountKg);
      const susutJualKg = Math.max(0, closingBySystem - overridePhysicalClosingKg);

      const newRec: ClosingPlanRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        storeId: effectiveStoreId,
        date: new Date().toISOString().split('T')[0],
        planName: planNameOrSegmentId,
        category: planItems[0]?.pabrikasiCategory || 'DAGING FRESH',
        openingStockKg: carryover,
        newProcessedKg: newProc,
        adjustInKg: 0,
        adjustOutKg: 0,
        salesKg: salesAmountKg,
        closingStockBySystemKg: closingBySystem,
        actualClosingStockKg: overridePhysicalClosingKg,
        susutJualKg: susutJualKg,
        butcherName: currentUser?.fullName || currentUser?.username || 'Kasir',
        photoUrl: '',
        timestamp: new Date().toISOString(),
      };
      updatedClosingRecords = [...updatedClosingRecords, newRec];
    }

    setClosingRecords(updatedClosingRecords);
    saveClosingPlanRecords(updatedClosingRecords);
    updateTableInSheets('closing_plan_records', updatedClosingRecords);

    fetch('/api/closing-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedClosingRecords)
    }).catch(console.error);
  };

  // Handler: Daily Closing Refresh & Carryover (Sisa Fisik Jadi Stok Awal Besok)
  const handleDailyResetAndCarryover = () => {
    const effectiveStoreId = currentStore?.id || currentUser?.storeId || 'store_ckr';
    const storeClosings = closingRecords.filter((r) => matchStoreEntity(r.storeId, currentStore));
    const storeSegs = segments.filter((s) => matchStoreEntity(s.storeId, currentStore));
    const storeItms = items.filter((i) => matchStoreEntity(i.storeId, currentStore));

    // 1. Generate carryover thawing items from actual closing physical stock
    const carryoverItems: ThawingItem[] = [];

    // From closing records with physical stock > 0
    storeClosings.forEach((rec) => {
      if (rec.actualClosingStockKg > 0) {
        carryoverItems.push({
          id: `meat_carry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: `${rec.planName} (Sisa Kemarin)`,
          weightBeforeThawing: rec.actualClosingStockKg,
          weightAfterThawing: rec.actualClosingStockKg,
          shrinkageThawingPercent: 0,
          thawingStartTime: new Date().toISOString(),
          thawingEndTime: new Date().toISOString(),
          status: 'pabrikasi_done',
          plannedFabrication: rec.planName,
          pabrikasiCategory: rec.category || 'DAGING FRESH',
          openingPurpose: 'UNTUK DISPLAY',
          isCarryover: true,
          isTransferred: false,
          createdAt: new Date().toISOString(),
          storeId: effectiveStoreId,
          butcherName: currentUser?.fullName || 'Butcher',
          image: rec.photoUrl || '',
        });
      }
    });

    // Also include any segments that had actual weight > 0 if not covered in closing records
    storeSegs.forEach((seg) => {
      const parent = storeItms.find((i) => i.id === seg.itemId);
      const planName = seg.plannedFabrication || parent?.plannedFabrication || seg.segmentName;
      const alreadyHandled = storeClosings.some((c) => isMatchPlan(c.planName, planName));

      if (!alreadyHandled && seg.actualWeight > 0) {
        carryoverItems.push({
          id: `meat_carry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: `${seg.segmentName} (Sisa Kemarin)`,
          weightBeforeThawing: seg.actualWeight,
          weightAfterThawing: seg.actualWeight,
          shrinkageThawingPercent: 0,
          thawingStartTime: new Date().toISOString(),
          thawingEndTime: new Date().toISOString(),
          status: 'pabrikasi_done',
          plannedFabrication: planName,
          pabrikasiCategory: 'DAGING FRESH',
          openingPurpose: seg.openingPurpose || 'UNTUK DISPLAY',
          isCarryover: true,
          isTransferred: false,
          createdAt: new Date().toISOString(),
          storeId: effectiveStoreId,
          butcherName: currentUser?.fullName || 'Butcher',
          image: '',
        });
      }
    });

    // 2. Keep items of other stores, replace this store's items with carryover items
    const otherStoreItems = items.filter((i) => !matchStoreEntity(i.storeId, currentStore));
    const newItems = [...otherStoreItems, ...carryoverItems];
    setItems(newItems);
    saveThawingItems(newItems);
    updateTableInSheets('thawing_items', newItems);

    // 3. Clear today's segments for this store, keep other stores
    const otherStoreSegments = segments.filter((s) => !matchStoreEntity(s.storeId, currentStore));
    setSegments(otherStoreSegments);
    saveFabricationSegments(otherStoreSegments);
    updateTableInSheets('fabrication_segments', otherStoreSegments);

    // 4. Reset today's active closing records for this store to allow fresh closing tomorrow
    const otherStoreClosings = closingRecords.filter((r) => !matchStoreEntity(r.storeId, currentStore));
    setClosingRecords(otherStoreClosings);
    saveClosingPlanRecords(otherStoreClosings);
    updateTableInSheets('closing_plan_records', otherStoreClosings);

    // 5. Sync to backend API
    fetch('/api/thawing-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItems),
    }).catch(console.error);

    fetch('/api/fabrication-segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otherStoreSegments),
    }).catch(console.error);

    fetch('/api/closing-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otherStoreClosings),
    }).catch(console.error);
  };

  // Handler: Update Sales Prediction Target
  const handleUpdateSalesPrediction = (newTargetKg: number) => {
    const updatedConfig = { ...lossConfig, salesPredictionKg: newTargetKg };
    setLossConfig(updatedConfig);
    saveLossConfig(updatedConfig);
  };

  // Handler: Save Daily Closing Report
  const handleSaveDailyReport = (report: DailyClosingReport) => {
    const updated = [report, ...reports];
    setReports(updated);
    saveDailyReports(updated);

    upsertRecordToSheets('daily_closing_reports', report);
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    }).catch(console.error);
  };

  // Handler: Save Closing Plan Record (Physical Closing)
  const handleSaveClosingRecord = (record: Omit<ClosingPlanRecord, 'id' | 'timestamp'> & { id?: string }) => {
    const recId = record.id || getDeterministicClosingRecordId(record.storeId, record.planName, record.date);
    const newRec: ClosingPlanRecord = {
      ...record,
      id: recId,
      timestamp: new Date().toISOString(),
    };
    const existingIdx = closingRecords.findIndex(
      (r) =>
        r.id === newRec.id ||
        (matchStoreEntity(r.storeId, { id: newRec.storeId }) &&
          isMatchPlan(r.planName, newRec.planName) &&
          (r.date === newRec.date || !r.date || !newRec.date))
    );
    let updated: ClosingPlanRecord[];
    if (existingIdx >= 0) {
      updated = [...closingRecords];
      updated[existingIdx] = newRec;
    } else {
      updated = [newRec, ...closingRecords];
    }
    setClosingRecords(updated);
    saveClosingPlanRecords(updated, newRec);

    upsertRecordToSheets('closing_plan_records', newRec);
    fetch('/api/closing-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRec)
    }).catch(console.error);

    // Cross-tab broadcast for instant multi-device/multi-window synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('tdn_meat_tracker_channel');
        bc.postMessage({ type: 'CLOSING_RECORD_SAVED', record: newRec });
        bc.close();
      } catch (err) {
        console.warn('BroadcastChannel sync error:', err);
      }
    }

    // Trigger subtle cloud refresh to verify cloud alignment
    setTimeout(() => {
      fetchAllData(true);
    }, 1800);
  };

  // Handler: Transfer Purpose (Pesanan <-> Display)
  const handleTransferPurpose = (
    id: string,
    isSegment: boolean,
    targetPurpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY',
    transferWeightKg?: number
  ) => {
    if (isSegment) {
      const sourceSeg = segments.find((s) => s.id === id);
      if (!sourceSeg) return;

      const isPartial = typeof transferWeightKg === 'number' && transferWeightKg > 0 && transferWeightKg < sourceSeg.actualWeight;

      if (isPartial && transferWeightKg) {
        const remainingWeight = parseFloat((sourceSeg.actualWeight - transferWeightKg).toFixed(3));
        const updatedSource: FabricationSegment = {
          ...sourceSeg,
          actualWeight: remainingWeight,
        };

        const newTransferSegment: FabricationSegment = {
          id: `seg_trans_${Date.now()}`,
          itemId: sourceSeg.itemId,
          itemName: sourceSeg.itemName,
          segmentName: `${sourceSeg.segmentName} (Transfer ${targetPurpose === 'UNTUK PESANAN' ? 'Pesanan' : 'Display'})`,
          plannedFabrication: sourceSeg.plannedFabrication,
          targetWeight: transferWeightKg,
          actualWeight: transferWeightKg,
          openingPurpose: targetPurpose,
          isTransferred: true,
          originalPurpose: sourceSeg.openingPurpose || 'UNTUK DISPLAY',
          transferTimestamp: new Date().toISOString(),
          periodicShrinkage: 0,
          salesKg: 0,
          createdAt: new Date().toISOString(),
          storeId: sourceSeg.storeId || currentUser?.storeId || 'store_ckr',
        };

        const updatedSegments = segments.map((s) => (s.id === id ? updatedSource : s)).concat(newTransferSegment);
        setSegments(updatedSegments);
        saveFabricationSegments(updatedSegments);
        updateTableInSheets('fabrication_segments', updatedSegments);
      } else {
        const updatedSegments = segments.map((s) => {
          if (s.id === id) {
            return {
              ...s,
              openingPurpose: targetPurpose,
              isTransferred: true,
              originalPurpose: s.originalPurpose || s.openingPurpose || 'UNTUK DISPLAY',
              transferTimestamp: new Date().toISOString(),
            };
          }
          return s;
        });
        setSegments(updatedSegments);
        saveFabricationSegments(updatedSegments);
        updateTableInSheets('fabrication_segments', updatedSegments);
      }
    } else {
      const sourceItem = items.find((i) => i.id === id);
      if (!sourceItem) return;

      const currentWeight = sourceItem.weightAfterThawing ?? sourceItem.weightBeforeThawing;
      const isPartial = typeof transferWeightKg === 'number' && transferWeightKg > 0 && transferWeightKg < currentWeight;

      if (isPartial && transferWeightKg) {
        const remainingWeight = parseFloat((currentWeight - transferWeightKg).toFixed(3));
        const updatedSourceItem: ThawingItem = {
          ...sourceItem,
          weightBeforeThawing: sourceItem.weightAfterThawing !== undefined ? sourceItem.weightBeforeThawing : remainingWeight,
          weightAfterThawing: sourceItem.weightAfterThawing !== undefined ? remainingWeight : undefined,
        };

        const newTransferItem: ThawingItem = {
          ...sourceItem,
          id: `meat_trans_${Date.now()}`,
          name: `${sourceItem.name} (Transfer ke ${targetPurpose === 'UNTUK PESANAN' ? 'Pesanan' : 'Display'})`,
          weightBeforeThawing: transferWeightKg,
          weightAfterThawing: sourceItem.weightAfterThawing !== undefined ? transferWeightKg : undefined,
          openingPurpose: targetPurpose,
          isTransferred: true,
          originalPurpose: sourceItem.openingPurpose || 'UNTUK DISPLAY',
          transferTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        const updatedItems = items.map((i) => (i.id === id ? updatedSourceItem : i)).concat(newTransferItem);
        setItems(updatedItems);
        saveThawingItems(updatedItems);
        updateTableInSheets('thawing_items', updatedItems);
      } else {
        const updatedItems = items.map((i) => {
          if (i.id === id) {
            return {
              ...i,
              openingPurpose: targetPurpose,
              isTransferred: true,
              originalPurpose: i.originalPurpose || i.openingPurpose || 'UNTUK DISPLAY',
              transferTimestamp: new Date().toISOString(),
            };
          }
          return i;
        });
        setItems(updatedItems);
        saveThawingItems(updatedItems);
        updateTableInSheets('thawing_items', updatedItems);
      }
    }
  };

  // Handler: Edit Rencana Potong
  const handleUpdatePlan = (itemId: string, newPlanName: string, updateSegmentNames: boolean) => {
    const updatedItems = items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          plannedFabrication: newPlanName,
        };
      }
      return item;
    });
    setItems(updatedItems);
    saveThawingItems(updatedItems);
    updateTableInSheets('thawing_items', updatedItems);

    if (updateSegmentNames) {
      const updatedSegments = segments.map((seg) => {
        if (seg.itemId === itemId) {
          return {
            ...seg,
            plannedFabrication: newPlanName,
          };
        }
        return seg;
      });
      setSegments(updatedSegments);
      saveFabricationSegments(updatedSegments);
      updateTableInSheets('fabrication_segments', updatedSegments);
    }
  };

  // Handler: Add Stock Adjustment (Adjust IN/OUT)
  const handleAddAdjustment = (adj: Omit<StockAdjustment, 'id' | 'createdAt'>) => {
    const newAdj: StockAdjustment = {
      ...adj,
      id: `adj_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newAdj, ...adjustments];
    setAdjustments(updated);
    saveStockAdjustments(updated);

    upsertRecordToSheets('stock_adjustments', newAdj);
    fetch('/api/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAdj)
    }).catch(console.error);
  };

  const handleDeleteAdjustment = (id: string) => {
    const updated = adjustments.filter((a) => a.id !== id);
    setAdjustments(updated);
    saveStockAdjustments(updated);

    deleteRecordFromSheets('stock_adjustments', id);
    fetch(`/api/adjustments/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const handleDeleteClosingRecord = (id: string) => {
    const updated = closingRecords.filter((r) => r.id !== id);
    setClosingRecords(updated);
    saveClosingPlanRecords(updated);
    deleteClosingPlanRecord(id);
  };

  const handlePurgeDate = (dateToPurge: string) => {
    purgeDateRecords(dateToPurge);
    setClosingRecords((prev) => prev.filter((r) => (r.date || r.timestamp || '').split('T')[0] !== dateToPurge));
    setItems((prev) => prev.filter((i) => (i.createdAt || i.thawingStartTime || '').split('T')[0] !== dateToPurge));
    setSegments((prev) => prev.filter((s) => (s.createdAt || s.transferTimestamp || '').split('T')[0] !== dateToPurge));
    setAdjustments((prev) => prev.filter((a) => (a.date || a.createdAt || '').split('T')[0] !== dateToPurge));
    setReports((prev) => prev.filter((r) => (r.date || '').split('T')[0] !== dateToPurge));
  };

  // Handler: MD Add Store + Generate Paired Butcher & Admin Accounts to SQL
  const handleAddStore = async (
    storeData: Omit<Store, 'id' | 'createdAt'>,
    butcherName: string,
    adminName: string,
    butcherPassword?: string,
    adminPassword?: string
  ) => {
    const storeId = `store_${storeData.code.toLowerCase()}`;
    const newStore: Store = {
      ...storeData,
      id: storeId,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const butcherUser: UserAccount = {
      id: `user_butcher_${storeData.code.toLowerCase()}`,
      username: `butcher_${storeData.code.toLowerCase()}`,
      role: 'butcher',
      storeId: storeId,
      storeName: newStore.name,
      fullName: butcherName,
      pin: butcherPassword || 'butcher123',
      linkedAccountId: `user_admin_${storeData.code.toLowerCase()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const adminUser: UserAccount = {
      id: `user_admin_${storeData.code.toLowerCase()}`,
      username: `admin_${storeData.code.toLowerCase()}`,
      role: 'admin',
      storeId: storeId,
      storeName: newStore.name,
      fullName: adminName,
      pin: adminPassword || 'admin123',
      linkedAccountId: `user_butcher_${storeData.code.toLowerCase()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedStores = [...stores, newStore];
    const updatedUsers = [...users, butcherUser, adminUser];

    setStores(updatedStores);
    setUsers(updatedUsers);
    saveStores(updatedStores);
    saveUsers(updatedUsers);

    updateTableInSheets('stores', updatedStores);
    updateTableInSheets('users', updatedUsers);

    // Save to SQL
    try {
      await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: storeData.code,
          name: storeData.name,
          city: storeData.city,
          butcherName,
          butcherPassword: butcherPassword || 'butcher123',
          adminName,
          adminPassword: adminPassword || 'admin123'
        })
      });
    } catch (e) {
      console.error('Failed to sync new store to SQL backend:', e);
    }
  };

  // Handler: Update COGS Master (Strictly restricted to MD role)
  const handleUpdateCogs = (updatedCogs: CogsMaster[]) => {
    if (currentUser?.role !== 'md') {
      console.warn('Unauthorized COGS update attempt by non-MD user:', currentUser);
      alert('Akses Ditolak: Hanya akun MD (Merchandising Pusat) yang memiliki wewenang untuk mengatur dan mengubah Master COGS.');
      return;
    }
    setCogsList(updatedCogs);
    saveCogsMaster(updatedCogs);
    updateTableInSheets('cogs_master', updatedCogs);

    fetch('/api/cogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedCogs)
    }).catch(console.error);
  };

  // Reset database helper
  const handleResetData = () => {
    if (window.confirm('Reset semua data lokal ke format standar demo?')) {
      resetDatabase();
      window.location.reload();
    }
  };

  // Submit from Account Settings Modal
  const handleModalAddStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreCode.trim() || !newStoreName.trim() || !newStoreCity.trim()) return;
    if (!newButcherName.trim() || !newAdminName.trim()) return;

    handleAddStore(
      {
        code: newStoreCode.trim().toUpperCase(),
        name: newStoreName.trim().startsWith('TDN ') ? newStoreName.trim() : `TDN ${newStoreName.trim()}`,
        city: newStoreCity.trim(),
      },
      newButcherName.trim(),
      newAdminName.trim(),
      newButcherPassword.trim() || 'butcher123',
      newAdminPassword.trim() || 'admin123'
    );

    setNewStoreCode('');
    setNewStoreName('');
    setNewStoreCity('');
    setNewButcherName('');
    setNewAdminName('');
    setAddStoreSuccess(true);
    setTimeout(() => setAddStoreSuccess(false), 3000);
  };

  // Loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Memuat Sistem Database Daging...</p>
      </div>
    );
  }

  // Touch swipe support for mobile sidebar
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    // Horizontal swipe gesture detection
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX > 0 && touchStartX < 50) {
        // Swiped right from left edge -> Open drawer
        setIsMobileSidebarOpen(true);
      } else if (deltaX < 0 && isMobileSidebarOpen) {
        // Swiped left while open -> Close drawer
        setIsMobileSidebarOpen(false);
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  // If no user is logged in, show SQL Authentication Screen
  if (!currentUser) {
    return (
      <>
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
          cloudConnected={cloudConnected}
        />
        <GoogleSheetsSetupModal
          isOpen={isSheetsModalOpen}
          onClose={() => setIsSheetsModalOpen(false)}
          onDataSynced={() => {
            fetchAllData();
            setCloudConnected(Boolean(getGoogleAppsScriptUrl()));
          }}
          currentAllData={{
            stores,
            users,
            cogsMaster: cogsList,
            thawingItems: items,
            fabricationSegments: segments,
            closingPlanRecords: closingRecords,
            dailyClosingReports: reports,
            stockAdjustments: adjustments,
            lossConfig
          }}
        />
      </>
    );
  }

  const userRole = normalizeRole(currentUser.role);
  const currentStore = getEffectiveStore(stores, userRole, selectedStoreIdForMd, currentUser?.storeId);
  const effectiveStoreId = currentStore.id;

  // Store-isolated datasets for operational screens
  const storeItems = items.filter((i) => matchStoreEntity(i.storeId, currentStore));
  const storeSegments = segments.filter((s) => matchStoreEntity(s.storeId, currentStore));
  const storeAdjustments = adjustments.filter((a) => matchStoreEntity(a.storeId, currentStore));
  const storeClosingRecords = closingRecords.filter((r) => matchStoreEntity(r.storeId, currentStore));
  const storeReports = reports.filter((r) => matchStoreEntity(r.storeId, currentStore));

  // Nav Items configured dynamically based on role:
  // For MD: Only Helicopter View, Admin Toko View, Rekapitulasi
  const navItems = [
    ...(userRole === 'md'
      ? [
          {
            id: 'md',
            label: `MD / Helicopter View (${stores.length})`,
            icon: Compass,
            color: 'text-emerald-500',
            specialBg: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800',
            roles: ['md'],
          },
        ]
      : []),
    {
      id: 'admin_toko',
      label: 'Admin Toko & Adjust',
      icon: Building2,
      color: 'text-blue-500',
      specialBg: 'bg-blue-950/80 text-blue-300 border border-blue-800',
      roles: ['admin', 'md'],
    },
    {
      id: 'dashboard',
      label: userRole === 'butcher' ? 'Dashboard Bahan' : 'Input & Thawing',
      icon: LayoutDashboard,
      color: 'text-red-500',
      roles: ['butcher', 'admin'],
    },
    {
      id: 'antrian',
      label: 'Antrian Thawing',
      icon: Clock,
      color: 'text-amber-500',
      count: storeItems.filter((i) => i.status === 'thawing').length,
      roles: ['butcher', 'admin'],
    },
    {
      id: 'segmentasi',
      label: 'Segmentasi Potong',
      icon: Scissors,
      color: 'text-blue-500',
      roles: ['butcher', 'admin'],
    },
    {
      id: 'closing_butcher',
      label: 'Closing Rencana Potong',
      icon: CheckSquare,
      color: 'text-rose-500',
      roles: ['butcher', 'admin', 'md'],
    },
    {
      id: 'sales',
      label: 'Update Sales',
      icon: DollarSign,
      color: 'text-emerald-500',
      roles: ['admin'],
    },
    {
      id: 'riwayat',
      label: 'Riwayat Harian',
      icon: History,
      color: 'text-slate-500',
      roles: ['admin'],
    },
  ];

  const allowedNavItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-slate-100 flex font-sans relative"
    >
      {/* 1. PERMANENT DESKTOP SIDEBAR (Clean sidebar replaces double top-nav) */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 sticky top-0 h-screen z-40 shrink-0">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-xl text-white shadow-md flex items-center justify-center">
              <Beef className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white">TDN Tracker</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-950 text-red-300 border border-red-800 uppercase">
                  {userRole === 'md' ? 'MD' : currentStore.code}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium truncate block max-w-[140px]">
                {userRole === 'md' ? (activeTab === 'md' ? 'Seluruh Cabang' : currentStore.name) : currentStore.name}
              </span>
            </div>
          </div>
        </div>

        {/* User Card Profile */}
        <div className="p-3.5 mx-3 my-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 ${
                userRole === 'butcher'
                  ? 'bg-red-600'
                  : userRole === 'admin'
                  ? 'bg-blue-600'
                  : 'bg-emerald-600'
              }`}
            >
              {currentUser.fullName ? currentUser.fullName.charAt(0) : 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">
                {userRole === 'md' ? 'MD Pusat' : userRole === 'admin' ? 'Admin Toko' : 'Petugas Butcher'}
              </div>
            </div>
          </div>
          {userRole === 'md' && (
            <button
              onClick={() => setShowAccountModal(true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition cursor-pointer"
              title="Pengaturan Toko & Akun"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* MD Store Switcher when inspecting store modules */}
        {userRole === 'md' && stores.length > 0 && (
          <div className="px-3 pb-2">
            <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-emerald-400" />
                Cabang Yang Ditinjau:
              </label>
              <select
                value={selectedStoreIdForMd}
                onChange={(e) => setSelectedStoreIdForMd(e.target.value)}
                className="w-full text-xs font-bold bg-slate-900 border border-slate-700 text-emerald-200 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Navigation Item List */}
        <div className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-none">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 pt-2 pb-1">
            Modul Operasional
          </div>
          {allowedNavItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                  isActive
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.color}`} />
                  <span>{tab.label}</span>
                </div>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isActive ? 'bg-red-800 text-white' : 'bg-red-600 text-white'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom User Controls & Functional Logout Button */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={() => setIsSheetsModalOpen(true)}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
              cloudConnected
                ? 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-800/80 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Pengaturan Koneksi Google Spreadsheet Cloud"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Database Cloud</span>
            </div>
            <span className={`w-2 h-2 rounded-full ${cloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
            title="Keluar dari akun dan kembali ke form login"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Akun ({currentUser.username})</span>
          </button>
        </div>
      </aside>

      {/* 2. MOBILE TOP BAR (Only visible on mobile / tablet to toggle drawer) */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile Drawer */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              aria-label="Buka Menu Navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-600 rounded-lg text-white">
                <Beef className="w-4 h-4" />
              </div>
              <span className="font-black text-sm text-white">TDN Tracker</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-950 text-red-300 border border-red-800 uppercase">
                {userRole === 'md' ? 'MD' : currentStore.code}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSheetsModalOpen(true)}
              className={`p-2 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                cloudConnected
                  ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-800 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Status Database Cloud"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className={`w-1.5 h-1.5 rounded-full ${cloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* 3. MOBILE SLIDE-OUT DRAWER / SIDEBAR (Swipeable & Overlay Navigation) */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop overlay */}
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            />

            {/* Slide-out Sidebar Panel */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-white p-5 space-y-4 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              {/* Header Drawer */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-red-600 rounded-xl text-white">
                    <Beef className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Menu Navigasi</h3>
                    <p className="text-[11px] text-slate-400">{userRole === 'md' ? 'Kantor Pusat' : currentStore.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current User Card in Drawer */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white ${
                      userRole === 'butcher'
                        ? 'bg-red-600'
                        : userRole === 'admin'
                        ? 'bg-blue-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {currentUser.fullName ? currentUser.fullName.charAt(0) : 'U'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{currentUser.fullName}</div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      {userRole === 'md' ? 'MD Pusat' : userRole === 'admin' ? 'Admin Toko' : 'Petugas Butcher'}
                    </div>
                  </div>
                </div>
              </div>

              {/* MD Store Switcher in Drawer */}
              {userRole === 'md' && stores.length > 0 && (
                <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-emerald-400" />
                    Pilih Cabang Toko:
                  </label>
                  <select
                    value={selectedStoreIdForMd}
                    onChange={(e) => setSelectedStoreIdForMd(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-900 border border-slate-700 text-emerald-200 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nav list */}
              <div className="space-y-1.5 overflow-y-auto flex-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">
                  Modul Sistem
                </div>
                {allowedNavItems.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition text-left ${
                        isActive
                          ? 'bg-red-600 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.color}`} />
                        <span>{tab.label}</span>
                      </div>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className="px-2 py-0.5 bg-red-800 text-white rounded-full text-[10px]">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Drawer Functional Controls */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => {
                    setIsSheetsModalOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                    cloudConnected
                      ? 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-800/80 text-emerald-300'
                      : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Database Cloud (Sheets)</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${cloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 bg-red-950/90 hover:bg-red-900 border border-red-800 text-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar Akun ({currentUser.username})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. MAIN CONTENT VIEW CONTAINER */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* VIEW 1: Input & Thawing (Dashboard) */}
          {activeTab === 'dashboard' && (
            <Dashboard
              items={storeItems}
              segments={storeSegments}
              currentStore={currentStore}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              safeThawingLossPercent={lossConfig.safeThawingLossPercent}
              safeFabricationLossPercent={lossConfig.safeFabricationLossPercent}
              salesPredictionKg={lossConfig.salesPredictionKg}
              onUpdateSalesPrediction={handleUpdateSalesPrediction}
              onTransferPurpose={handleTransferPurpose}
              onOpenTransferModal={() => setIsTransferModalOpen(true)}
              onOpenEditPlanModal={(id) => {
                setEditPlanItemId(id || null);
                setIsEditPlanModalOpen(true);
              }}
              isButcherView={currentUser.role === 'butcher'}
            />
          )}

          {/* VIEW 2: Antrean Potong */}
          {activeTab === 'antrian' && (
            <AntrianPabrikasi
              items={storeItems}
              onStartFabrication={handleStartFabrication}
              safeThawingLossPercent={lossConfig.safeThawingLossPercent}
              onTransferPurpose={handleTransferPurpose}
              onOpenTransferModal={() => setIsTransferModalOpen(true)}
            />
          )}

          {/* VIEW 3: Segmentasi Potong */}
          {activeTab === 'segmentasi' && (
            <SegmentasiPabrikasi
              items={storeItems}
              existingSegments={storeSegments}
              onSaveSegments={handleSaveSegments}
              onUpdateItem={handleUpdateItem}
              safeFabricationLossPercent={lossConfig.safeFabricationLossPercent}
              onTransferPurpose={handleTransferPurpose}
              onOpenTransferModal={() => setIsTransferModalOpen(true)}
              onOpenEditPlanModal={(id) => {
                setEditPlanItemId(id || null);
                setIsEditPlanModalOpen(true);
              }}
            />
          )}

          {/* VIEW 3.5: Closing Rencana Potong (Mandatory Photo Upload & Physical Sisa Stock) */}
          {activeTab === 'closing_butcher' && (
            <ButcherClosingView
              currentUser={currentUser}
              currentStore={currentStore}
              stores={stores}
              selectedStoreIdForMd={selectedStoreIdForMd}
              onSelectStoreForMd={setSelectedStoreIdForMd}
              segments={storeSegments}
              items={storeItems}
              adjustments={storeAdjustments}
              onSaveClosingRecord={handleSaveClosingRecord}
              existingClosingRecords={storeClosingRecords}
              onDailyResetAndCarryover={handleDailyResetAndCarryover}
              onManualSync={() => fetchAllData(false)}
              isSyncing={isCloudSyncing}
              lastSyncTime={lastCloudSync}
            />
          )}

          {/* VIEW 4: Update Sales */}
          {activeTab === 'sales' && (
            <UpdateSales
              segments={storeSegments}
              items={storeItems}
              closingRecords={storeClosingRecords}
              adjustments={storeAdjustments}
              onUpdateSales={handleUpdateSales}
              onTransferPurpose={handleTransferPurpose}
              onOpenTransferModal={() => setIsTransferModalOpen(true)}
            />
          )}

          {/* VIEW 5: Rekapitulasi Summary */}
          {activeTab === 'summary' && (
            <Summary
              items={storeItems}
              segments={storeSegments}
              pastReports={storeReports}
              closingRecords={storeClosingRecords}
              adjustments={storeAdjustments}
              safeThawingLossPercent={lossConfig.safeThawingLossPercent}
              safeFabricationLossPercent={lossConfig.safeFabricationLossPercent}
            />
          )}

          {/* VIEW 7: Riwayat Harian */}
          {activeTab === 'riwayat' && (
            <RiwayatHarian
              items={storeItems}
              segments={storeSegments}
              reports={storeReports}
              closingRecords={storeClosingRecords}
              currentStore={currentStore}
              onCloseDay={handleSaveDailyReport}
            />
          )}

          {/* VIEW 8: Admin Toko & Adjust */}
          {activeTab === 'admin_toko' && (
            <AdminTokoView
              currentUser={currentUser}
              currentStore={currentStore}
              items={storeItems}
              segments={storeSegments}
              closingRecords={storeClosingRecords}
              adjustments={storeAdjustments}
              cogsList={cogsList}
              onUpdateCogs={handleUpdateCogs}
              onAddAdjustment={handleAddAdjustment}
              onDeleteAdjustment={handleDeleteAdjustment}
              onDeleteClosingRecord={handleDeleteClosingRecord}
              onPurgeDate={handlePurgeDate}
              safeThawingLossPercent={lossConfig.safeThawingLossPercent}
            />
          )}

          {/* VIEW 9: MD / Helicopter View */}
          {activeTab === 'md' && (
            <MdHelicopterView
              currentUser={currentUser}
              stores={stores}
              users={users}
              cogsList={cogsList}
              allReports={reports}
              currentStoreItems={storeItems}
              currentStoreSegments={storeSegments}
              currentStoreClosingRecords={storeClosingRecords}
              allItems={items}
              allSegments={segments}
              allAdjustments={adjustments}
              allClosingRecords={closingRecords}
              onAddStore={handleAddStore}
              onUpdateCogs={handleUpdateCogs}
              onSelectStoreForDrilldown={(storeId) => {
                setSelectedStoreIdForMd(storeId);
                setActiveTab('admin_toko');
              }}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              TDN Meat Production Tracker © 2026 • Petugas Aktif:{' '}
              <strong className="text-slate-800">{currentUser.fullName}</strong> ({currentUser.role.toUpperCase()}) • {currentStore.name}
            </div>
            <button
              onClick={handleResetData}
              className="text-slate-400 hover:text-red-600 transition flex items-center gap-1.5 cursor-pointer"
              title="Kembalikan data ke contoh default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Data Lokal
            </button>
          </div>
        </footer>
      </div>

      {/* MODAL 1: Transfer Purpose (Pesanan <-> Display) */}
      <TransferPurposeModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        items={items}
        segments={segments}
        onTransferPurpose={handleTransferPurpose}
      />

      {/* MODAL 2: Edit Rencana Potong */}
      <EditRencanaPotongModal
        isOpen={isEditPlanModalOpen}
        onClose={() => setIsEditPlanModalOpen(false)}
        items={items}
        segments={segments}
        onUpdatePlan={handleUpdatePlan}
        preselectedItemId={editPlanItemId}
      />

      {/* MODAL 3: PENGATURAN AKUN & MANAJEMEN TOKO */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Manajemen Toko & Akun SQL
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tambah toko cabang baru dan akun Butcher & Admin Toko dengan password masing-masing.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAccountModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Akun Terdaftar per Toko */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Daftar Pengguna di Database SQL:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {users.map((u) => {
                  const isCurrent = currentUser.id === u.id;
                  return (
                    <div
                      key={u.id}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        isCurrent
                          ? 'border-emerald-600 bg-emerald-50/80 shadow-xs'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white ${
                            u.role === 'butcher'
                              ? 'bg-red-700'
                              : u.role === 'admin'
                              ? 'bg-blue-700'
                              : 'bg-emerald-700'
                          }`}
                        >
                          {u.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            {u.fullName}
                            {isCurrent && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {u.role.toUpperCase()} • {u.storeName || 'Pusat'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {u.username}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Tambah Toko Cabang Baru */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                + Daftarkan Toko Baru & Buat Kredensial SQL:
              </span>

              {addStoreSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Toko baru dan 2 akun (Butcher & Admin) berhasil didaftarkan ke SQL!
                </div>
              )}

              <form onSubmit={handleModalAddStore} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Kode:
                    </label>
                    <input
                      type="text"
                      placeholder="SMG"
                      maxLength={4}
                      value={newStoreCode}
                      onChange={(e) => setNewStoreCode(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold uppercase"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Toko:
                    </label>
                    <input
                      type="text"
                      placeholder="TDN Semarang"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kota / Wilayah:
                  </label>
                  <input
                    type="text"
                    placeholder="Semarang"
                    value={newStoreCity}
                    onChange={(e) => setNewStoreCity(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Nama Butcher:
                    </label>
                    <input
                      type="text"
                      placeholder="Joko Butcher"
                      value={newButcherName}
                      onChange={(e) => setNewButcherName(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg mb-1.5"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password Butcher"
                      value={newButcherPassword}
                      onChange={(e) => setNewButcherPassword(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Nama Admin:
                    </label>
                    <input
                      type="text"
                      placeholder="Anita Admin"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg mb-1.5"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password Admin"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow transition mt-2 cursor-pointer"
                >
                  + Simpan & Buat 2 Akun
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: GOOGLE SPREADSHEET CLOUD SETUP (Multi-Device Sync) */}
      <GoogleSheetsSetupModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        onDataSynced={() => {
          fetchAllData();
          setCloudConnected(Boolean(getGoogleAppsScriptUrl()));
        }}
        currentAllData={{
          stores,
          users,
          cogsMaster: cogsList,
          thawingItems: items,
          fabricationSegments: segments,
          closingPlanRecords: closingRecords,
          dailyClosingReports: reports,
          stockAdjustments: adjustments,
          lossConfig
        }}
      />
    </div>
  );
}
