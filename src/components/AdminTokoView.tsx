import React, { useState, useMemo } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  StockAdjustment,
  CogsMaster,
  UserAccount,
  Store,
  DailyClosingReport,
  ReportPhotoAttachment
} from '../types';
import ExcelReportViewer from './ExcelReportViewer';
import AdminTrainingAndTargetView from './AdminTrainingAndTargetView';
import SavedDataViewerModal from './SavedDataViewerModal';
import { matchStoreEntity } from '../utils/reportCalculations';
import { processHighResImage } from '../utils/imageCompressor';
import { getDeterministicClosingRecordId, isMatchPlan } from '../utils/storeHelper';
import {
  exportStoreDailyLaporanExcel,
  exportStoreDailyLaporanCSV,
  downloadCSV
} from '../utils/excelExport';
import { upsertRecordToSheets } from '../utils/sheetsApi';
import { deduplicateThawingItems } from '../utils/db';

export interface UnifiedBahanRow {
  id: string;
  bahan: string;
  tally: string; // berat awal beku [Kg]
  netto: string; // berat setelah thaw [Kg]
  foto: string;  // foto timbangan netto
  isOptimizingPhoto?: boolean;
}
import {
  Building2,
  TrendingDown,
  TrendingUp,
  Scale,
  DollarSign,
  FileSpreadsheet,
  Download,
  Plus,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Package,
  Layers,
  Image as ImageIcon,
  Calculator,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Lock,
  Trash2,
  RotateCcw,
  Edit2,
  Save,
  FileCheck,
  GraduationCap,
  Cpu,
  Camera,
  Upload,
  X,
  ZoomIn,
  Beef,
  Database,
} from 'lucide-react';

interface AdminTokoViewProps {
  currentUser: UserAccount;
  currentStore: Store;
  items: ThawingItem[];
  segments: FabricationSegment[];
  closingRecords: ClosingPlanRecord[];
  adjustments: StockAdjustment[];
  cogsList: CogsMaster[];
  reports?: DailyClosingReport[];
  onAddAdjustment: (adj: Omit<StockAdjustment, 'id' | 'createdAt'>) => void;
  onDeleteAdjustment?: (id: string) => void;
  onDeleteClosingRecord?: (id: string) => void;
  onSaveClosingRecord?: (record: Omit<ClosingPlanRecord, 'id' | 'timestamp'> & { id?: string }) => void;
  onAddItem?: (newItem: Omit<ThawingItem, 'id' | 'createdAt' | 'butcherId' | 'butcherName'> & { createdAt?: string }) => void;
  onAddItems?: (newItems: Array<Omit<ThawingItem, 'id' | 'createdAt' | 'butcherId' | 'butcherName'> & { createdAt?: string }>) => void;
  onDeleteItem?: (id: string) => void;
  onSaveDailyReport?: (report: DailyClosingReport) => void;
  onPurgeDate?: (date: string) => void;
  onUpdateItemSales?: (itemId: string, salesKg: number) => void;
  onUpdateItemSusutJual?: (itemId: string, susutJualKg: number) => void;
  onUpdateCogs?: (updatedCogs: CogsMaster[]) => void;
  safeThawingLossPercent: number;
  onUpdateSalesPrediction?: (newTargetKg: number) => void;
}

export default function AdminTokoView({
  currentUser,
  currentStore,
  items,
  segments,
  closingRecords,
  adjustments,
  cogsList,
  reports = [],
  onAddAdjustment,
  onDeleteAdjustment,
  onDeleteClosingRecord,
  onSaveClosingRecord,
  onAddItem,
  onAddItems,
  onDeleteItem,
  onSaveDailyReport,
  onPurgeDate,
  onUpdateItemSales,
  onUpdateItemSusutJual,
  onUpdateCogs,
  safeThawingLossPercent,
  onUpdateSalesPrediction,
}: AdminTokoViewProps) {
  const [activeTab, setActiveTab] = useState<'excel' | 'overview' | 'input_laporan' | 'training' | 'adjust' | 'stock' | 'cogs' | 'export'>('excel');
  const [isSavedDataModalOpen, setIsSavedDataModalOpen] = useState(false);
  
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Available dates that contain items or closing records for the current store
  const availableDatesWithData = useMemo(() => {
    const datesSet = new Set<string>();
    (items || []).forEach((i) => {
      const d = (i.createdAt || i.thawingStartTime || '').split('T')[0];
      if (d && d !== '2026-08-29') datesSet.add(d);
    });
    (closingRecords || []).forEach((c) => {
      const d = (c.date || c.timestamp || '').split('T')[0];
      if (d && d !== '2026-08-29') datesSet.add(d);
    });
    return Array.from(datesSet).sort().reverse();
  }, [items, closingRecords]);

  // Initialize selectedDate to today or the latest available date with data
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (availableDatesWithData.includes(todayIso)) return todayIso;
    if (availableDatesWithData.length > 0) return availableDatesWithData[0];
    return todayIso;
  });

  // Standard Cuts List
  const STANDARD_PLANS = [
    { name: 'D.sapi pot. rdang', category: 'DAGING FRESH', defaultCogs: 102000 },
    { name: 'Daging Rendang Shankle', category: 'SHANKLE', defaultCogs: 85200 },
    { name: 'D Premium lokal', category: 'DAGING PREMIUM', defaultCogs: 127000 },
    { name: 'Rawon Curah', category: 'RAWON', defaultCogs: 86500 },
    { name: 'D.r. fresh member', category: 'DAGING FRESH', defaultCogs: 102000 },
    { name: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM', defaultCogs: 103000 },
  ];

  // Unified Input Form State
  const [unifiedPlanSelect, setUnifiedPlanSelect] = useState('D.sapi pot. rdang');
  const [unifiedCustomPlan, setUnifiedCustomPlan] = useState('');
  const [unifiedCategory, setUnifiedCategory] = useState('DAGING FRESH');

  const [unifiedBahanList, setUnifiedBahanList] = useState<UnifiedBahanRow[]>([
    { id: 'b_init_1', bahan: '', tally: '', netto: '', foto: '' }
  ]);

  const [unifiedSisaKemarin, setUnifiedSisaKemarin] = useState('');
  const [unifiedPenjualanSales, setUnifiedPenjualanSales] = useState('');
  const [unifiedTimbanganSisaFisik, setUnifiedTimbanganSisaFisik] = useState('');
  const [unifiedFotoClosing, setUnifiedFotoClosing] = useState('');
  const [isOptimizingClosingPhoto, setIsOptimizingClosingPhoto] = useState<boolean>(false);
  const [unifiedNotes, setUnifiedNotes] = useState('');
  const [editingClosingId, setEditingClosingId] = useState<string | null>(null);
  const [closingInputMsg, setClosingInputMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Derived Live Calculations for Unified Form (Semua Otomatis Terisi)
  const totalTally = useMemo(() => {
    return unifiedBahanList.reduce((acc, b) => acc + (parseFloat(b.tally) || 0), 0);
  }, [unifiedBahanList]);

  const totalNetto = useMemo(() => {
    return unifiedBahanList.reduce((acc, b) => acc + (parseFloat(b.netto) || 0), 0);
  }, [unifiedBahanList]);

  const susutProsesKg = useMemo(() => {
    return Math.max(0, totalTally - totalNetto);
  }, [totalTally, totalNetto]);

  const susutProsesPct = useMemo(() => {
    return totalTally > 0 ? (susutProsesKg / totalTally) * 100 : 0;
  }, [totalTally, susutProsesKg]);

  const sisaKemarinNum = parseFloat(unifiedSisaKemarin) || 0;
  const totalTersediaKg = useMemo(() => {
    return sisaKemarinNum + totalNetto;
  }, [sisaKemarinNum, totalNetto]);

  const salesNum = parseFloat(unifiedPenjualanSales) || 0;
  const sisaSistemKg = useMemo(() => {
    return Math.max(0, totalTersediaKg - salesNum);
  }, [totalTersediaKg, salesNum]);

  const sisaFisikNum = parseFloat(unifiedTimbanganSisaFisik) || 0;
  const susutJualKg = useMemo(() => {
    return Math.max(0, sisaSistemKg - sisaFisikNum);
  }, [sisaSistemKg, sisaFisikNum]);

  const susutJualPct = useMemo(() => {
    return sisaSistemKg > 0 ? (susutJualKg / sisaSistemKg) * 100 : 0;
  }, [sisaSistemKg, susutJualKg]);

  // Dynamic Bahan Row Handlers
  const handleAddBahanRow = () => {
    setUnifiedBahanList((prev) => [
      ...prev,
      { id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, bahan: '', tally: '', netto: '', foto: '' }
    ]);
  };

  const handleRemoveBahanRow = (id: string) => {
    if (unifiedBahanList.length <= 1) {
      setUnifiedBahanList([{ id: `b_${Date.now()}`, bahan: '', tally: '', netto: '', foto: '' }]);
      return;
    }
    setUnifiedBahanList((prev) => prev.filter((b) => b.id !== id));
  };

  const handleUpdateBahanRow = (id: string, field: keyof UnifiedBahanRow, value: any) => {
    setUnifiedBahanList((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const handleBahanPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleUpdateBahanRow(id, 'isOptimizingPhoto', true);
    try {
      const compressed = await processHighResImage(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
        format: 'image/jpeg',
      });
      handleUpdateBahanRow(id, 'foto', compressed);
    } catch (err) {
      console.error('Gagal memproses foto bahan:', err);
    } finally {
      handleUpdateBahanRow(id, 'isOptimizingPhoto', false);
      e.target.value = '';
    }
  };

  // Lightbox Zoom Modal State
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<{ url: string; title: string } | null>(null);

  // Undo Deleted Closing Record State
  const [undoClosingRecord, setUndoClosingRecord] = useState<ClosingPlanRecord | null>(null);
  const [finalizedReportMsg, setFinalizedReportMsg] = useState('');

  // Adjustment Form State
  const [adjMeatName, setAdjMeatName] = useState('D.sapi pot. rdang');
  const [adjType, setAdjType] = useState<'IN' | 'OUT'>('IN');
  const [adjWeight, setAdjWeight] = useState('');
  const [adjReason, setAdjReason] = useState('Mutasi Antar Cabang');
  const [customReason, setCustomReason] = useState('');
  const [adjSuccess, setAdjSuccess] = useState(false);
  const [adjError, setAdjError] = useState('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Helper: Get COGS
  const getCogs = (itemName?: string, category?: string) => {
    const safeItem = (itemName || '').toLowerCase();
    const safeCat = (category || '').toLowerCase();
    const found = (cogsList || []).find(
      (c) =>
        (c.itemName || (c as any).planName || '').toLowerCase() === safeItem ||
        (c.category || '').toLowerCase() === safeCat
    );
    if (found) return found.cogsPerKg;
    const planObj = STANDARD_PLANS.find((p) => p.name.toLowerCase() === safeItem);
    return planObj ? planObj.defaultCogs : 102000;
  };

  // Filter items and closing records for the current store & selected date
  const matchDate = (dateStr?: string) => {
    if (!selectedDate || !dateStr) return true;
    return dateStr.startsWith(selectedDate);
  };

  const currentStoreItems = useMemo(() => {
    return (items || []).filter((i) => {
      if (!i) return false;
      const storeMatch = !i.storeId || matchStoreEntity(i.storeId, currentStore);
      const dateMatch = matchDate(i.createdAt || i.thawingStartTime);
      return storeMatch && dateMatch;
    });
  }, [items, currentStore, selectedDate]);

  const currentStoreClosing = useMemo(() => {
    return (closingRecords || []).filter((c) => {
      if (!c) return false;
      const storeMatch = !c.storeId || matchStoreEntity(c.storeId, currentStore);
      const dateMatch = matchDate(c.date || c.timestamp);
      return storeMatch && dateMatch;
    });
  }, [closingRecords, currentStore, selectedDate]);

  const currentStoreAdjustments = useMemo(() => {
    return (adjustments || []).filter((a) => {
      if (!a) return false;
      const storeMatch = !a.storeId || matchStoreEntity(a.storeId, currentStore);
      const dateMatch = matchDate(a.date || a.createdAt);
      return storeMatch && dateMatch;
    });
  }, [adjustments, currentStore, selectedDate]);

  // Filter items: Separate TODAY'S PROCESSED from PREVIOUS CARRYOVER
  const todayItems = useMemo(() => currentStoreItems.filter((i) => !i.isCarryover), [currentStoreItems]);
  const carryoverItems = useMemo(() => currentStoreItems.filter((i) => i.isCarryover), [currentStoreItems]);

  // Totals for today's processed items ONLY
  const totalBahanHariIni = useMemo(() => todayItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0), [todayItems]);
  const totalHasilHariIni = useMemo(() => todayItems.reduce((sum, i) => sum + (i.weightAfterThawing !== undefined && i.weightAfterThawing !== null ? i.weightAfterThawing : i.weightBeforeThawing), 0), [todayItems]);
  const totalSusutProsesHariIni = Math.max(0, totalBahanHariIni - totalHasilHariIni);
  const susutProsesPctHariIni = totalBahanHariIni > 0 ? (totalSusutProsesHariIni / totalBahanHariIni) * 100 : 0;

  // Carryover & Stock Totals
  const totalCarryoverStock = useMemo(() => carryoverItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0), [carryoverItems]);
  const totalAdjIn = useMemo(() => currentStoreAdjustments.filter((a) => a.type === 'IN').reduce((sum, a) => sum + a.weightKg, 0), [currentStoreAdjustments]);
  const totalAdjOut = useMemo(() => currentStoreAdjustments.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + a.weightKg, 0), [currentStoreAdjustments]);

  // Sales & Susut Jual Totals
  const totalSalesKg = useMemo(() => currentStoreClosing.reduce(
    (sum, r) => sum + r.salesKg,
    segments.reduce((sum, s) => sum + (s.salesKg || 0), 0)
  ), [currentStoreClosing, segments]);
  const totalSusutJualKg = useMemo(() => currentStoreClosing.reduce(
    (sum, r) => sum + r.susutJualKg,
    todayItems.reduce((sum, i) => sum + (i.susutJualKg || 0), 0)
  ), [currentStoreClosing, todayItems]);

  // Stock Balance by System vs Butcher Real Closing
  const totalStokRealClosing = useMemo(() => currentStoreClosing.reduce((sum, r) => sum + r.actualClosingStockKg, 0), [currentStoreClosing]);
  const totalStokTersedia = totalCarryoverStock + totalHasilHariIni + totalAdjIn - totalAdjOut;
  const totalStokSistem = Math.max(0, totalStokTersedia - totalSalesKg);

  // Financial COGS Valuations
  const totalNilaiModalBahan = useMemo(() => todayItems.reduce(
    (sum, i) => sum + i.weightBeforeThawing * getCogs(i.name, i.pabrikasiCategory || ''),
    0
  ), [todayItems, cogsList]);
  const totalKerugianRupiahSusutProses = totalSusutProsesHariIni * 102000;
  const totalKerugianRupiahSusutJual = totalSusutJualKg * 102000;

  // Submit Adjustment
  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(adjWeight);
    if (isNaN(w) || w <= 0) {
      setAdjError('Harap masukkan angka berat penyesuaian (Kg) yang valid.');
      return;
    }

    const finalReason = adjReason === 'LAINNYA' ? customReason.trim() : adjReason;
    if (!finalReason) {
      setAdjError('Harap isi alasan penyesuaian.');
      return;
    }

    onAddAdjustment({
      storeId: currentStore.id,
      date: selectedDate,
      meatName: adjMeatName,
      planName: adjMeatName,
      type: adjType,
      weightKg: w,
      reason: finalReason,
      createdBy: currentUser.fullName,
    });

    setAdjWeight('');
    setCustomReason('');
    setAdjError('');
    setAdjSuccess(true);
    setTimeout(() => setAdjSuccess(false), 3000);
  };

  // Handle Photo Upload with Compression
  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setPhoto: (url: string) => void,
    setIsLoading: (val: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsLoading(true);
      const compressed = await processHighResImage(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
        format: 'image/jpeg',
      });
      setPhoto(compressed);
    } catch (err) {
      console.error('Gagal mengompres dan memproses foto:', err);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  // Submit Unified Input Form (Rencana Potong + Bahan + Closing)
  const handleUnifiedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveClosingRecord) {
      setClosingInputMsg({ type: 'error', text: 'Handler penyimpanan closing belum tersedia.' });
      return;
    }

    const effectivePlan =
      unifiedPlanSelect === 'CUSTOM'
        ? unifiedCustomPlan.trim() || 'D.sapi pot. rdang'
        : unifiedPlanSelect;
    const effectiveCategory = unifiedCategory || 'DAGING FRESH';
    const timestampStr = `${selectedDate}T08:00:00.000Z`;

    // 1. Filter dan proses semua bahan yang diinput
    const validBahan = unifiedBahanList.filter(
      (b) => b.bahan.trim() || (parseFloat(b.tally) || 0) > 0 || (parseFloat(b.netto) || 0) > 0
    );

    // If updating or re-saving, find previous unified items for this plan and clean them up
    const previousUnifiedItemIds = (items || [])
      .filter(
        (i) =>
          matchStoreEntity(i.storeId, currentStore) &&
          (i.createdAt || i.thawingStartTime || '').startsWith(selectedDate) &&
          isMatchPlan(i.plannedFabrication, effectivePlan)
      )
      .map((i) => i.id);

    if (previousUnifiedItemIds.length > 0 && onDeleteItem) {
      previousUnifiedItemIds.forEach((id) => onDeleteItem(id));
    }

    const newlyAddedItems: ThawingItem[] = [];

    if (validBahan.length > 0) {
      validBahan.forEach((b, idx) => {
        const wBefore = parseFloat(b.tally) || 0;
        const wAfter = parseFloat(b.netto) || wBefore;
        const bLossKg = Math.max(0, wBefore - wAfter);
        const bLossPct = wBefore > 0 ? (bLossKg / wBefore) * 100 : 0;

        const newItem: ThawingItem = {
          id: `meat_unified_${currentStore.id}_${selectedDate}_${idx}_${Date.now()}`,
          name: b.bahan.trim() || `Bahan ${effectivePlan} ${idx + 1}`,
          pabrikasiCategory: effectiveCategory,
          plannedFabrication: effectivePlan,
          weightBeforeThawing: wBefore,
          weightAfterThawing: wAfter,
          shrinkageThawing: bLossKg,
          shrinkageThawingPercent: bLossPct,
          openingPurpose: 'UNTUK DISPLAY',
          status: 'pabrikasi_done',
          thawingStartTime: timestampStr,
          thawingEndTime: `${selectedDate}T09:00:00.000Z`,
          createdAt: timestampStr,
          storeId: currentStore.id,
          isCarryover: false,
          image: b.foto || '',
          butcherName: `${currentUser.fullName} (Input Terpadu)`,
        };

        newlyAddedItems.push(newItem);
      });

      if (onAddItems) {
        onAddItems(newlyAddedItems);
      } else if (onAddItem) {
        newlyAddedItems.forEach((it) => onAddItem(it));
      }
    }

    // 2. Simpan Data Closing Fisik Rencana Potong
    const recId = editingClosingId || getDeterministicClosingRecordId(currentStore.id, effectivePlan, selectedDate);
    const recordToSave: ClosingPlanRecord = {
      id: recId,
      storeId: currentStore.id,
      date: selectedDate,
      planName: effectivePlan,
      category: effectiveCategory,
      openingStockKg: sisaKemarinNum,
      newProcessedKg: parseFloat(totalNetto.toFixed(3)),
      adjustInKg: 0,
      adjustOutKg: 0,
      salesKg: salesNum,
      closingStockBySystemKg: parseFloat(sisaSistemKg.toFixed(3)),
      actualClosingStockKg: sisaFisikNum,
      susutJualKg: parseFloat(susutJualKg.toFixed(3)),
      butcherName: `${currentUser.fullName} (Input Terpadu)`,
      note:
        unifiedNotes ||
        `Input terpadu: ${validBahan.length} bahan (${validBahan.map((b) => b.bahan || 'Bahan').join(', ') || 'Tanpa bahan'})`,
      photoUrl: unifiedFotoClosing || (validBahan[0]?.foto || ''),
      photoCaption: `Bukti Fisik Closing: ${effectivePlan}`,
      timestamp: `${selectedDate}T17:00:00.000Z`,
    };

    onSaveClosingRecord(recordToSave);
    upsertRecordToSheets('closing_plan_records', recordToSave);

    // 3. Compile & Finalize DailyClosingReport agar Riwayat Harian & Laporan Excel auto-terisi
    const currentStoreClosings = (closingRecords || []).filter(
      (c) => matchStoreEntity(c.storeId, currentStore) && (c.date || c.timestamp || '').startsWith(selectedDate) && c.id !== recId
    );
    const allClosingsForDate = [recordToSave, ...currentStoreClosings];

    const currentStoreItems = (items || []).filter(
      (i) =>
        matchStoreEntity(i.storeId, currentStore) &&
        (i.createdAt || i.thawingStartTime || '').startsWith(selectedDate) &&
        !previousUnifiedItemIds.includes(i.id)
    );
    const allItemsForDate = deduplicateThawingItems([...newlyAddedItems, ...currentStoreItems]);

    const storeSegsForDate = (segments || []).filter(
      (s) => matchStoreEntity(s.storeId, currentStore) && (s.createdAt || s.transferTimestamp || '').startsWith(selectedDate)
    );

    const totalRaw = allItemsForDate.filter((i) => !i.isCarryover).reduce((s, i) => s + (i.weightBeforeThawing || 0), 0);
    const totalThawed = allItemsForDate.filter((i) => !i.isCarryover).reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing || 0), 0);
    const totalFab = storeSegsForDate.reduce((s, seg) => s + seg.actualWeight, 0);
    const totalThawLoss = Math.max(0, totalRaw - totalThawed);
    // CRITICAL: Susut proses adalah strictly Tally - Netto jika tidak ada segmen pabrikasi terpisah
    const totalFabLoss = (storeSegsForDate.length > 0 && totalFab > 0) ? Math.max(0, totalThawed - totalFab) : 0;
    const allProcessLoss = totalThawLoss + totalFabLoss;
    const allSusutJual = allClosingsForDate.reduce((s, c) => s + (c.susutJualKg || 0), 0);
    const totalSales = allClosingsForDate.reduce((s, c) => s + (c.salesKg || 0), 0) + storeSegsForDate.reduce((s, seg) => s + (seg.salesKg || 0), 0);
    const carryoverOpening = allItemsForDate.filter((i) => i.isCarryover).reduce((s, i) => s + (i.weightBeforeThawing || 0), 0);
    const currentClosing = allClosingsForDate.reduce((s, c) => s + (c.actualClosingStockKg || 0), 0);

    // Kumpulkan seluruh foto (Bahan-bahan + Closing Fisik) tanpa duplikasi URL gambar
    const seenPhotoUrls = new Set<string>();
    const allPhotos: ReportPhotoAttachment[] = [];

    // A. Foto Closing Fisik
    if (unifiedFotoClosing && unifiedFotoClosing.trim() && unifiedFotoClosing !== 'placeholder') {
      const url = unifiedFotoClosing.trim();
      seenPhotoUrls.add(url);
      allPhotos.push({
        id: `photo_close_unified_${Date.now()}`,
        url,
        caption: `Bukti Closing Fisik: ${effectivePlan} (${sisaFisikNum.toFixed(2)} Kg)`,
        category: 'Closing Stock',
        uploadedAt: `${selectedDate}T17:00:00.000Z`,
      });
    }

    allClosingsForDate.filter((c) => c.photoUrl && c.photoUrl.trim() && c.photoUrl !== 'placeholder').forEach((c, idx) => {
      const url = c.photoUrl!.trim();
      if (!seenPhotoUrls.has(url)) {
        seenPhotoUrls.add(url);
        allPhotos.push({
          id: `photo_close_${c.id || idx}`,
          url,
          caption: c.photoCaption || `Bukti Closing Fisik: ${c.planName}`,
          category: 'Closing Stock',
          uploadedAt: c.timestamp || new Date().toISOString(),
        });
      }
    });

    // B. Foto Bahan yang diinput langsung dari baris validBahan
    validBahan.forEach((b, idx) => {
      if (b.foto && b.foto.trim() && b.foto !== 'placeholder') {
        const url = b.foto.trim();
        if (!seenPhotoUrls.has(url)) {
          seenPhotoUrls.add(url);
          const tallyVal = parseFloat(b.tally) || 0;
          const nettoVal = parseFloat(b.netto) || tallyVal;
          allPhotos.push({
            id: `photo_bahan_${b.id || idx}_${Date.now()}`,
            url,
            caption: `Timbangan Raw/Thawing: ${b.bahan.trim() || `Bahan ${effectivePlan}`} (${tallyVal.toFixed(2)} Kg) | Thawing: ${nettoVal.toFixed(2)} Kg [${effectivePlan}]`,
            category: 'Timbangan',
            uploadedAt: timestampStr,
          });
        }
      }
    });

    // C. Foto dari allItemsForDate
    allItemsForDate.filter((i) => i.image && i.image.trim() && i.image !== 'placeholder').forEach((i, idx) => {
      const url = i.image!.trim();
      if (!seenPhotoUrls.has(url)) {
        seenPhotoUrls.add(url);
        allPhotos.push({
          id: `photo_item_${i.id || idx}`,
          url,
          caption: `Timbangan Raw/Thawing: ${i.name} (${(i.weightBeforeThawing || 0).toFixed(2)} Kg) | Thawing: ${(i.weightAfterThawing || i.weightBeforeThawing || 0).toFixed(2)} Kg [${i.plannedFabrication || ''}]`,
          category: 'Timbangan',
          uploadedAt: i.createdAt || new Date().toISOString(),
        });
      }
    });

    const finalizedReport: DailyClosingReport = {
      id: `rep_${currentStore.id}_${selectedDate}`,
      storeId: currentStore.id,
      storeName: currentStore.name,
      date: selectedDate,
      totalThawingQty: allItemsForDate.length,
      totalProcessedQty: storeSegsForDate.length,
      totalWeightBeforeThawing: totalRaw,
      totalWeightAfterThawing: totalThawed,
      totalWeightAfterFabrication: totalFab,
      totalThawingLoss: totalThawLoss,
      totalFabricationLoss: totalFabLoss,
      totalProcessLoss: allProcessLoss,
      totalSusutJual: allSusutJual,
      totalSalesKg: totalSales,
      carryoverOpeningStockKg: carryoverOpening,
      currentClosingStockKg: currentClosing,
      financialLossRupiah: (allProcessLoss + allSusutJual) * 102000,
      butcherInCharge: 'Petugas Butcher',
      adminInCharge: currentUser.fullName,
      isClosed: true,
      closedAt: new Date().toISOString(),
      closingPlanRecords: allClosingsForDate,
      closingPhotoUrl: unifiedFotoClosing || recordToSave.photoUrl || undefined,
      itemsProcessed: allItemsForDate.map((i) => ({
        id: i.id,
        name: i.name,
        plannedFabrication: i.plannedFabrication,
        pabrikasiCategory: i.pabrikasiCategory,
        weightBefore: i.weightBeforeThawing,
        weightAfter: i.weightAfterThawing || i.weightBeforeThawing,
        finalWeight: i.weightAfterThawing || i.weightBeforeThawing,
        thawingLossPercent: i.shrinkageThawingPercent || 0,
        fabLossPercent: 0,
        salesKg: i.salesKg || 0,
        image: i.image,
        photoUrl: i.image,
        openingStockKg: i.isCarryover ? i.weightBeforeThawing : 0,
        isCarryover: i.isCarryover,
      })),
      photos: allPhotos,
    };

    if (onSaveDailyReport) {
      onSaveDailyReport(finalizedReport);
    }
    upsertRecordToSheets('daily_closing_reports', finalizedReport);

    setClosingInputMsg({
      type: 'success',
      text: `Data terpadu "${effectivePlan}" tanggal ${selectedDate} berhasil disimpan! Data bahan (${validBahan.length} item), closing fisik (${sisaFisikNum.toFixed(3)} Kg), susut proses (${susutProsesKg.toFixed(3)} Kg) & susut jual (${susutJualKg.toFixed(3)} Kg) otomatis tersimpan dan terhubung ke Riwayat Harian, Laporan Excel & Google Spreadsheet!`,
    });

    // Reset Form
    setEditingClosingId(null);
    setUnifiedBahanList([{ id: `b_${Date.now()}`, bahan: '', tally: '', netto: '', foto: '' }]);
    setUnifiedSisaKemarin('');
    setUnifiedPenjualanSales('');
    setUnifiedTimbanganSisaFisik('');
    setUnifiedFotoClosing('');
    setUnifiedNotes('');
  };

  // Handle Edit Closing Record from Saved Data Modal
  const handleEditClosing = (rec: ClosingPlanRecord) => {
    setActiveTab('input_laporan');
    if (rec.date) {
      setSelectedDate(rec.date.split('T')[0]);
    }
    setEditingClosingId(rec.id);

    // Check if plan matches standard plans
    const standardMatch = STANDARD_PLANS.find((p) => isMatchPlan(p.name, rec.planName));
    if (standardMatch) {
      setUnifiedPlanSelect(standardMatch.name);
      setUnifiedCustomPlan('');
      setUnifiedCategory(standardMatch.category);
    } else {
      setUnifiedPlanSelect('CUSTOM');
      setUnifiedCustomPlan(rec.planName);
      setUnifiedCategory(rec.category || 'DAGING FRESH');
    }

    setUnifiedSisaKemarin(rec.openingStockKg !== undefined ? String(rec.openingStockKg) : '');
    setUnifiedPenjualanSales(rec.salesKg !== undefined ? String(rec.salesKg) : '');
    setUnifiedTimbanganSisaFisik(rec.actualClosingStockKg !== undefined ? String(rec.actualClosingStockKg) : '');
    setUnifiedFotoClosing(rec.photoUrl || '');
    setUnifiedNotes(rec.note || '');

    // Load related items if any
    const relatedItems = (items || []).filter(
      (i) =>
        matchStoreEntity(i.storeId, currentStore) &&
        isMatchPlan(i.plannedFabrication, rec.planName) &&
        (rec.date ? (i.createdAt || i.thawingStartTime || '').startsWith(rec.date.split('T')[0]) : true)
    );

    if (relatedItems.length > 0) {
      setUnifiedBahanList(
        relatedItems.map((item, idx) => ({
          id: item.id || `b_${Date.now()}_${idx}`,
          bahan: item.name || '',
          tally: String(item.weightBeforeThawing || ''),
          netto: String(item.weightAfterThawing || item.weightBeforeThawing || ''),
          foto: item.image || '',
        }))
      );
    }
  };

  // Delete Closing Record with Undo
  const handleDeleteClosingWithUndo = (rec: ClosingPlanRecord) => {
    if (window.confirm(`Hapus data closing "${rec.planName}" tanggal ${rec.date || selectedDate}?`)) {
      setUndoClosingRecord(rec);
      if (onDeleteClosingRecord) {
        onDeleteClosingRecord(rec.id);
      }
    }
  };

  // Undo Restore Closing Record
  const handleRestoreClosingRecord = () => {
    if (undoClosingRecord && onSaveClosingRecord) {
      onSaveClosingRecord({
        id: undoClosingRecord.id,
        storeId: undoClosingRecord.storeId,
        date: undoClosingRecord.date,
        planName: undoClosingRecord.planName,
        category: undoClosingRecord.category,
        openingStockKg: undoClosingRecord.openingStockKg,
        newProcessedKg: undoClosingRecord.newProcessedKg,
        adjustInKg: undoClosingRecord.adjustInKg,
        adjustOutKg: undoClosingRecord.adjustOutKg,
        salesKg: undoClosingRecord.salesKg,
        closingStockBySystemKg: undoClosingRecord.closingStockBySystemKg,
        actualClosingStockKg: undoClosingRecord.actualClosingStockKg,
        susutJualKg: undoClosingRecord.susutJualKg,
        butcherName: undoClosingRecord.butcherName,
        note: undoClosingRecord.note,
        photoUrl: undoClosingRecord.photoUrl,
      });
      setClosingInputMsg({
        type: 'success',
        text: `Data closing "${undoClosingRecord.planName}" berhasil dikembalikan (Undo)!`,
      });
      setUndoClosingRecord(null);
      setTimeout(() => setClosingInputMsg(null), 4000);
    }
  };

  // Finalize / Refresh Report to Daily History
  const handleFinalizeReportForDate = () => {
    if (!onSaveDailyReport) return;
    const storeClosingsForDate = (closingRecords || []).filter(
      (c) => matchStoreEntity(c.storeId, currentStore) && (c.date || c.timestamp || '').startsWith(selectedDate)
    );
    const storeItemsForDate = (items || []).filter(
      (i) => matchStoreEntity(i.storeId, currentStore) && (i.createdAt || i.thawingStartTime || '').startsWith(selectedDate)
    );
    const storeSegsForDate = (segments || []).filter(
      (s) => matchStoreEntity(s.storeId, currentStore) && (s.createdAt || s.transferTimestamp || '').startsWith(selectedDate)
    );

    const totalRaw = storeItemsForDate.filter((i) => !i.isCarryover).reduce((s, i) => s + i.weightBeforeThawing, 0);
    const totalThawed = storeItemsForDate.filter((i) => !i.isCarryover).reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
    const totalFab = storeSegsForDate.reduce((s, seg) => s + seg.actualWeight, 0);
    const totalSales = storeSegsForDate.reduce((s, seg) => s + (seg.salesKg || 0), 0) + storeClosingsForDate.reduce((s, c) => s + (c.salesKg || 0), 0);
    const carryoverOpening = storeItemsForDate.filter((i) => i.isCarryover).reduce((s, i) => s + i.weightBeforeThawing, 0);
    const currentClosing = storeClosingsForDate.reduce((s, c) => s + (c.actualClosingStockKg || 0), 0);
    const totalThawLoss = Math.max(0, totalRaw - totalThawed);
    const totalFabLoss = (storeSegsForDate.length > 0 && totalFab > 0) ? Math.max(0, totalThawed - totalFab) : 0;
    const totalProcessLoss = totalThawLoss + totalFabLoss;
    const totalSusutJual = storeClosingsForDate.reduce((s, c) => s + (c.susutJualKg || 0), 0);

    const report: DailyClosingReport = {
      id: `rep_manual_${currentStore.id}_${selectedDate}_${Date.now()}`,
      storeId: currentStore.id,
      storeName: currentStore.name,
      date: selectedDate,
      totalThawingQty: storeItemsForDate.length,
      totalProcessedQty: storeSegsForDate.length,
      totalWeightBeforeThawing: totalRaw,
      totalWeightAfterThawing: totalThawed,
      totalWeightAfterFabrication: totalFab,
      totalThawingLoss: totalThawLoss,
      totalFabricationLoss: totalFabLoss,
      totalProcessLoss: totalProcessLoss,
      totalSusutJual: totalSusutJual,
      totalSalesKg: totalSales,
      carryoverOpeningStockKg: carryoverOpening,
      currentClosingStockKg: currentClosing,
      financialLossRupiah: (totalProcessLoss + totalSusutJual) * 102000,
      butcherInCharge: 'Petugas Butcher',
      adminInCharge: currentUser.fullName,
      isClosed: true,
      closedAt: new Date().toISOString(),
      closingPlanRecords: storeClosingsForDate,
      itemsProcessed: storeItemsForDate.map((i) => ({
        id: i.id,
        name: i.name,
        plannedFabrication: i.plannedFabrication,
        pabrikasiCategory: i.pabrikasiCategory,
        weightBefore: i.weightBeforeThawing,
        weightAfter: i.weightAfterThawing || i.weightBeforeThawing,
        finalWeight: i.weightAfterThawing || i.weightBeforeThawing,
        thawingLossPercent: i.shrinkageThawingPercent || 0,
        fabLossPercent: 0,
        salesKg: i.salesKg || 0,
        openingStockKg: i.isCarryover ? i.weightBeforeThawing : 0,
        isCarryover: i.isCarryover,
      })),
      photos: [
        ...storeClosingsForDate
          .filter((c) => c.photoUrl)
          .map((c, idx) => ({
            id: `photo_close_${idx}_${Date.now()}`,
            url: c.photoUrl!,
            caption: c.photoCaption || `Bukti Closing Fisik: ${c.planName}`,
            category: 'Timbangan' as const,
            uploadedAt: c.timestamp,
          })),
        ...storeItemsForDate
          .filter((i) => i.image)
          .map((i, idx) => ({
            id: `photo_thaw_${idx}_${Date.now()}`,
            url: i.image,
            caption: `Bukti Timbangan Thawing: ${i.name} (${i.plannedFabrication})`,
            category: 'Timbangan' as const,
            uploadedAt: i.createdAt,
          })),
      ],
    };

    onSaveDailyReport(report);
    setFinalizedReportMsg(`Laporan Excel Daging untuk tanggal ${selectedDate} berhasil disegarkan & disimpan ke Riwayat Harian!`);
    setTimeout(() => setFinalizedReportMsg(''), 5000);
  };

  // Export to Excel
  const handleExportExcel = () => {
    exportStoreDailyLaporanExcel(
      currentStore,
      selectedDate,
      items,
      segments,
      adjustments,
      closingRecords,
      cogsList
    );
  };

  // Export to CSV
  const handleExportCSV = () => {
    exportStoreDailyLaporanCSV(
      currentStore,
      selectedDate,
      items,
      segments,
      adjustments,
      closingRecords,
      cogsList
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header for Store Admin */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-blue-800 text-blue-100 text-xs font-semibold uppercase tracking-wider">
              Akun Store Admin
            </span>
            <span className="text-xs text-blue-200">
              {currentStore.name} ({currentStore.code})
            </span>
          </div>
          <h1 className="text-2xl font-black mt-1">Administrasi & Kontrol Toko</h1>
          <p className="text-xs text-blue-200 mt-0.5">
            Admin in Charge: <strong className="text-white">{currentUser.fullName}</strong> • Terhubung dengan Butcher & MD Pusat
          </p>
        </div>

        {/* Date Selector & Export Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-700/50 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-300" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white border-none focus:outline-none text-xs"
            />
          </div>
          {availableDatesWithData.length > 0 && (
            <div className="flex items-center gap-1">
              {availableDatesWithData.slice(0, 3).map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                    selectedDate === d
                      ? 'bg-blue-500 text-white shadow-xs'
                      : 'bg-blue-900/60 text-blue-200 hover:bg-blue-800'
                  }`}
                >
                  {d === todayIso ? 'Hari Ini' : d}
                </button>
              ))}
            </div>
          )}
          {onPurgeDate && availableDatesWithData.includes(selectedDate) && (
            <button
              onClick={() => {
                if (window.confirm(`Hapus seluruh data transaksi untuk tanggal ${selectedDate}?`)) {
                  onPurgeDate(selectedDate);
                  setSelectedDate(todayIso);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-950/60 hover:bg-red-800 text-red-200 border border-red-700/50 rounded-lg text-xs font-bold transition active:scale-95"
              title={`Hapus seluruh data pada tanggal ${selectedDate}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              Hapus Data Tgl
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSavedDataModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow transition active:scale-95 cursor-pointer"
            title="Buka Window / Jendela Data Tersimpan di Database"
          >
            <Database className="w-4 h-4 text-indigo-200" />
            Window Data Tersimpan
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow transition active:scale-95"
            title="Download Format Excel persis LAPORAN DAGING 02 AGUSTUS 2026.xlsx"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow transition"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('excel')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-black transition ${
            activeTab === 'excel'
              ? 'bg-[#107c41] text-white shadow-md ring-2 ring-emerald-600/30'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
          Format Excel Asli
        </button>

        <button
          onClick={() => setActiveTab('input_laporan')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'input_laporan'
              ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-500/30'
              : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Edit2 className="w-4 h-4 text-amber-600" />
          Input Laporan Terlewat
        </button>

        <button
          onClick={() => setActiveTab('training')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
            activeTab === 'training'
              ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-600/30'
              : 'bg-emerald-50 text-emerald-950 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <Cpu className="w-4 h-4 text-emerald-600" />
          Training Dataset Prediksi Sales
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'overview' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-blue-700" />
          Ringkasan Toko
        </button>

        <button
          onClick={() => setActiveTab('adjust')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'adjust' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4 text-blue-700" />
          Adjust ({adjustments.length})
        </button>

        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'stock' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 text-blue-700" />
          Closing ({closingRecords.length})
        </button>

        <button
          onClick={() => setActiveTab('cogs')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'cogs' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-blue-700" />
          COGS MD
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'export' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Download className="w-4 h-4 text-blue-700" />
          Download
        </button>
      </div>

      {/* UNDO DELETED CLOSING BANNER */}
      {undoClosingRecord && (
        <div className="bg-slate-900 border-2 border-amber-400 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-white shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                Data closing rencana <span className="text-amber-300 font-mono font-black">"{undoClosingRecord.planName}"</span> tanggal {undoClosingRecord.date || selectedDate} berhasil dihapus.
              </p>
              <p className="text-[11px] text-slate-400">
                Salah hapus data butcher? Klik tombol Undo untuk mengembalikan data closing ini seketika.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreClosingRecord}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Kembalikan (Undo)
            </button>
            <button
              type="button"
              onClick={() => setUndoClosingRecord(null)}
              className="p-2 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              title="Tutup"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* FINALIZED REPORT SUCCESS BANNER */}
      {finalizedReportMsg && (
        <div className="bg-emerald-900 border-2 border-emerald-400 p-4 rounded-2xl flex items-center gap-3 text-white shadow-lg animate-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <div className="flex-1 text-xs font-bold">
            {finalizedReportMsg}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: INPUT LAPORAN TERLEWAT (ADMIN INPUT & KOREKSI TANGGAL LALU) */}
      {/* ========================================================================= */}
      {activeTab === 'input_laporan' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  Fitur Input Susulan Admin
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-amber-600" />
                  Input / Koreksi Laporan Tanggal Terlewat
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admin dapat menginput data closing atau bahan baku untuk tanggal kapanpun yang belum terisi atau terlewat.
                </p>
              </div>

              {/* Actions & Date Selection Widget */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsSavedDataModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  title="Buka Window Data Tersimpan"
                >
                  <Database className="w-4 h-4 text-indigo-200" />
                  Window Data Tersimpan
                </button>
                <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-xl border border-amber-200">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-amber-950">Tanggal Laporan:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          {closingInputMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                closingInputMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                  : 'bg-red-50 text-red-900 border border-red-300'
              }`}
            >
              {closingInputMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{closingInputMsg.text}</span>
            </div>
          )}



          {/* UNIFIED INPUT FORM (Rencana Potong + Bahan + Closing) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs">
            {/* Form Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Layers className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    {editingClosingId ? 'Koreksi Data Rencana Potong, Bahan & Closing' : 'Input Rencana Potong, Bahan & Closing'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Alur satu pintu: Rencana potong, bahan baku (tally & netto), sisa kemarin, penjualan, dan timbangan fisik closing.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-lg">
                  Tanggal: {selectedDate}
                </span>
                {editingClosingId && (
                  <span className="text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg animate-pulse">
                    Mode Koreksi
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleUnifiedSubmit} className="space-y-5">
              {/* STEP 1: INPUT RENCANA POTONG */}
              <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <Package className="w-4 h-4 text-blue-700" />
                    Input Rencana Potong
                  </label>
                  <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                    Kategori: <strong className="text-blue-700">{unifiedCategory}</strong>
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Rencana Potong
                    </label>
                    <select
                      value={unifiedPlanSelect}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUnifiedPlanSelect(val);
                        if (val !== 'CUSTOM') {
                          const std = STANDARD_PLANS.find((p) => p.name === val);
                          if (std) setUnifiedCategory(std.category);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-blue-500"
                    >
                      {STANDARD_PLANS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} ({p.category})
                        </option>
                      ))}
                      <option value="CUSTOM">-- Item Kustom Lainnya --</option>
                    </select>
                  </div>

                  {unifiedPlanSelect === 'CUSTOM' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Ketik Rencana Potong Kustom
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: TETELAN SPESIAL"
                          value={unifiedCustomPlan}
                          onChange={(e) => setUnifiedCustomPlan(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Kategori Pabrikasi
                        </label>
                        <select
                          value={unifiedCategory}
                          onChange={(e) => setUnifiedCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-xs"
                        >
                          <option value="DAGING FRESH">DAGING FRESH</option>
                          <option value="SHANKLE">SHANKLE</option>
                          <option value="DAGING PREMIUM">DAGING PREMIUM</option>
                          <option value="RAWON">RAWON</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: INPUT BAHAN */}
              <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <Beef className="w-4 h-4 text-emerald-700" />
                    Input Bahan
                  </label>
                  <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    {unifiedBahanList.length} Bahan
                  </span>
                </div>

                <div className="space-y-4">
                  {unifiedBahanList.map((bItem, idx) => {
                    const bTally = parseFloat(bItem.tally) || 0;
                    const bNetto = parseFloat(bItem.netto) || 0;
                    const bSusut = Math.max(0, bTally - bNetto);
                    const bSusutPct = bTally > 0 ? (bSusut / bTally) * 100 : 0;

                    return (
                      <div
                        key={bItem.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative"
                      >
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            Bahan {idx + 1}
                          </span>

                          {unifiedBahanList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBahanRow(bItem.id)}
                              className="text-[11px] text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus Bahan
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Bahan (Nama Bahan Baku / Thawing)
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: HQ 41/42/44/45 atau FRIBOY"
                              value={bItem.bahan}
                              onChange={(e) => handleUpdateBahanRow(bItem.id, 'bahan', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Tally (Berat Awal Beku) [Kg]
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                placeholder="0.000"
                                value={bItem.tally}
                                onChange={(e) => handleUpdateBahanRow(bItem.id, 'tally', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Netto (Berat Setelah Thaw) [Kg]
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                placeholder="0.000"
                                value={bItem.netto}
                                onChange={(e) => handleUpdateBahanRow(bItem.id, 'netto', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Susut (Otomatis: Tally - Netto)
                              </label>
                              <div className="w-full px-3 py-2 bg-amber-50/70 border border-amber-200 rounded-xl text-xs font-mono font-bold text-amber-900 flex items-center justify-between">
                                <span>{bSusut.toFixed(3)} Kg</span>
                                <span className="text-[10px] text-amber-700">({bSusutPct.toFixed(2)}%)</span>
                              </div>
                            </div>
                          </div>

                          {/* Input Foto Bahan */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                                Input Foto (Timbangan Netto / Thaw)
                              </label>
                              {bItem.foto && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBahanRow(bItem.id, 'foto', '')}
                                  className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                                >
                                  <X className="w-3 h-3" /> Hapus Foto
                                </button>
                              )}
                            </div>

                            <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-xl p-3 text-center relative transition">
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleBahanPhotoUpload(e, bItem.id)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={bItem.isOptimizingPhoto}
                              />
                              {bItem.isOptimizingPhoto ? (
                                <div className="py-2 flex items-center justify-center gap-2 text-emerald-700 text-xs font-bold">
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Mengompres Foto...
                                </div>
                              ) : bItem.foto ? (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 text-left">
                                    <img
                                      src={bItem.foto}
                                      alt="Bukti Thawing"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setZoomedPhotoUrl({ url: bItem.foto, title: `Bukti Timbangan Thaw: ${bItem.bahan || unifiedPlanSelect}` });
                                      }}
                                      className="h-12 w-12 object-cover rounded-lg border border-emerald-300 shadow-xs cursor-pointer hover:opacity-85"
                                      title="Klik untuk perbesar"
                                    />
                                    <div>
                                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> Foto Timbangan Terlampir
                                      </span>
                                      <span className="text-[10px] text-slate-500 block">Klik untuk ganti atau perbesar</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomedPhotoUrl({ url: bItem.foto, title: `Bukti Timbangan Thaw: ${bItem.bahan || unifiedPlanSelect}` });
                                    }}
                                    className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 shadow-xs z-20 cursor-pointer flex items-center gap-1"
                                  >
                                    <ZoomIn className="w-3 h-3" /> Perbesar
                                  </button>
                                </div>
                              ) : (
                                <div className="py-1.5">
                                  <Upload className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                                  <p className="text-xs font-bold text-slate-800">Tambahkan Foto Timbangan Netto</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">Ambil foto timbangan daging setelah thawing (Kamera / Galeri)</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* (tambah bahan) button */}
                  <button
                    type="button"
                    onClick={handleAddBahanRow}
                    className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 border-2 border-dashed border-emerald-300 text-emerald-800 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    (Tambah Bahan)
                  </button>
                </div>
              </div>

              {/* STEP 3: SISA KEMARIN & PENJUALAN (SALES) */}
              <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-900 mb-1 uppercase tracking-wide">
                      Sisa Kemarin (Stok Awal) [Kg]
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={unifiedSisaKemarin}
                      onChange={(e) => setUnifiedSisaKemarin(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Stok sisa display atau carryover dari hari kemarin.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 mb-1 uppercase tracking-wide">
                      Penjualan (Sales) [Kg]
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={unifiedPenjualanSales}
                      onChange={(e) => setUnifiedPenjualanSales(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-800 shadow-xs focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Total berat daging yang terjual riil kepada pelanggan.
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 4: TIMBANGAN SISA FISIK CLOSING & INPUT FOTO */}
              <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-slate-900 mb-1 uppercase tracking-wide">
                      Timbangan Sisa Fisik Closing [Kg]
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={unifiedTimbanganSisaFisik}
                      onChange={(e) => setUnifiedTimbanganSisaFisik(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-blue-900 shadow-xs focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Hasil timbang fisik nyata di chiller display saat penutupan (closing).
                    </p>
                  </div>

                  {/* Input Foto Closing */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        Input Foto (Timbangan Sisa Fisik Closing)
                      </label>
                      {unifiedFotoClosing && (
                        <button
                          type="button"
                          onClick={() => setUnifiedFotoClosing('')}
                          className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                        >
                          <X className="w-3 h-3" /> Hapus Foto
                        </button>
                      )}
                    </div>

                    <div className="border-2 border-dashed border-blue-200 bg-blue-50/40 hover:bg-blue-50/70 rounded-xl p-3 text-center relative transition">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, setUnifiedFotoClosing, setIsOptimizingClosingPhoto)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={isOptimizingClosingPhoto}
                      />
                      {isOptimizingClosingPhoto ? (
                        <div className="py-2 flex items-center justify-center gap-2 text-blue-700 text-xs font-bold">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Mengompres Foto Closing...
                        </div>
                      ) : unifiedFotoClosing ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 text-left">
                            <img
                              src={unifiedFotoClosing}
                              alt="Bukti Closing"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedPhotoUrl({ url: unifiedFotoClosing, title: `Bukti Fisik Closing: ${unifiedPlanSelect}` });
                              }}
                              className="h-12 w-12 object-cover rounded-lg border border-blue-300 shadow-xs cursor-pointer hover:opacity-85"
                              title="Klik untuk perbesar"
                            />
                            <div>
                              <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> Foto Closing Terlampir
                              </span>
                              <span className="text-[10px] text-slate-500 block">Klik untuk ganti atau perbesar</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedPhotoUrl({ url: unifiedFotoClosing, title: `Bukti Fisik Closing: ${unifiedPlanSelect}` });
                            }}
                            className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-[10px] font-bold text-blue-700 hover:bg-blue-50 shadow-xs z-20 cursor-pointer flex items-center gap-1"
                          >
                            <ZoomIn className="w-3 h-3" /> Perbesar
                          </button>
                        </div>
                      ) : (
                        <div className="py-1.5">
                          <Upload className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                          <p className="text-xs font-bold text-slate-800">Tambahkan Foto Timbangan Sisa Fisik</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Ambil foto timbangan jarum/digital sisa fisik closing (Kamera / Galeri)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CATATAN TAMBAHAN (OPSIONAL) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Tambahan potongan dadu dari sisa display kemarin"
                  value={unifiedNotes}
                  onChange={(e) => setUnifiedNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              {/* STEP 5: PERHITUNGAN OTOMATIS (LIVE REAL-TIME) */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-400" />
                    Perhitungan Otomatis (Live Real-Time)
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Otomatis Terisi
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Total Tersedia */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Total Tersedia
                    </span>
                    <span className="text-base sm:text-lg font-mono font-black text-white block mt-0.5">
                      {totalTersediaKg.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Sisa Kemarin + Netto
                    </span>
                  </div>

                  {/* Sisa Sistem */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Sisa Sistem
                    </span>
                    <span className="text-base sm:text-lg font-mono font-black text-blue-300 block mt-0.5">
                      {sisaSistemKg.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Total Tersedia - Sales
                    </span>
                  </div>

                  {/* Susut Proses */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Susut Proses (Tally - Netto)
                    </span>
                    <span className="text-base sm:text-lg font-mono font-black text-amber-300 block mt-0.5">
                      {susutProsesKg.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                    </span>
                    <span className="text-[10px] text-amber-400/90 block mt-1 font-bold">
                      {susutProsesPct.toFixed(2)}% dari total tally ({totalTally.toFixed(3)} Kg)
                    </span>
                  </div>

                  {/* Susut Jual */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Susut Jual
                    </span>
                    <span className="text-base sm:text-lg font-mono font-black text-red-300 block mt-0.5">
                      {susutJualKg.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                    </span>
                    <span className="text-[10px] text-red-400/90 block mt-1 font-bold">
                      {susutJualPct.toFixed(2)}% dari sisa sistem
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 6: SIMPAN ACTION */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="w-full sm:flex-1 py-3 px-6 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {editingClosingId ? 'Simpan Perubahan Closing & Bahan' : 'Simpan'}
                </button>

                {editingClosingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClosingId(null);
                      setUnifiedBahanList([{ id: `b_${Date.now()}`, bahan: '', tally: '', netto: '', foto: '' }]);
                      setUnifiedSisaKemarin('');
                      setUnifiedPenjualanSales('');
                      setUnifiedTimbanganSisaFisik('');
                      setUnifiedFotoClosing('');
                      setUnifiedNotes('');
                    }}
                    className="w-full sm:w-auto py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Batal Koreksi
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 0: EXCEL REPORT VIEWER (EXACT REPLICA OF USER SPREADSHEET) */}
      {/* ========================================================================= */}
      {activeTab === 'excel' && (
        <div className="space-y-4">
          <ExcelReportViewer
            currentStore={currentStore}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            items={items}
            segments={segments}
            closingRecords={closingRecords}
            adjustments={adjustments}
            cogsList={cogsList}
            currentUser={currentUser}
            onUpdateCogs={currentUser?.role === 'md' ? onUpdateCogs : undefined}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: FILE HASIL TRAINING & SET MANUAL JUMLAH HARIAN                      */}
      {/* ========================================================================= */}
      {activeTab === 'training' && (
        <AdminTrainingAndTargetView
          currentUser={currentUser}
          currentStore={currentStore}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          closingRecords={closingRecords}
          items={items}
          segments={segments}
          adjustments={adjustments}
          cogsList={cogsList}
          onSaveClosingRecord={onSaveClosingRecord}
          onDeleteClosingRecord={onDeleteClosingRecord}
          onSalesPredictionUpdated={onUpdateSalesPrediction}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW TOKO */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bahan Hari Ini (Bahan Baru) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Bahan Diolah Hari Ini
              </span>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                {totalBahanHariIni.toFixed(2)} Kg
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Hasil Bersih: <strong className="text-slate-800">{totalHasilHariIni.toFixed(2)} Kg</strong>
              </span>
            </div>

            {/* Susut Proses Hari Berjalan (Isolated from Carryover!) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Susut Proses Hari Ini
              </span>
              <div className="text-xl font-black text-amber-700 mt-1 font-mono">
                {totalSusutProsesHariIni.toFixed(3)} Kg ({susutProsesPctHariIni.toFixed(2)}%)
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                ✓ Sisa stok kemarin dikecualikan dari hitung susut
              </span>
            </div>

            {/* Penjualan (Sales) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Penjualan (Sales)
              </span>
              <div className="text-xl font-black text-emerald-700 mt-1 font-mono">
                {totalSalesKg.toFixed(2)} Kg
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Susut Jual: <strong className="text-red-700">{totalSusutJualKg.toFixed(3)} Kg</strong>
              </span>
            </div>

            {/* Sisa Stok Closing Fisik Real */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Sisa Stok Real (Closing)
              </span>
              <div className="text-xl font-black text-blue-900 mt-1 font-mono">
                {totalStokRealClosing > 0 ? totalStokRealClosing.toFixed(2) : totalStokSistem.toFixed(2)} Kg
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Stok Sistem: {totalStokSistem.toFixed(2)} Kg
              </span>
            </div>
          </div>

          {/* Table: Matrix Stok & Penjualan Hari Berjalan */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Laporan Stok & Pergerakan Daging (Per Rencana Potong)
                </h2>
                <p className="text-xs text-slate-500">
                  Data sinkron otomatis dari proses thawing, segmentasi, adjust in/out, dan closing butcher.
                </p>
              </div>
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Unduh Laporan
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3">Rencana Potong</th>
                    <th className="p-3 text-right">Stok Awal (Pagi)</th>
                    <th className="p-3 text-right">Bahan Diolah</th>
                    <th className="p-3 text-right">Adj In</th>
                    <th className="p-3 text-right">Adj Out</th>
                    <th className="p-3 text-right font-bold text-slate-800">Hasil Potong</th>
                    <th className="p-3 text-right font-bold text-blue-900">Total Tersedia</th>
                    <th className="p-3 text-right font-bold text-emerald-700">Sales (Kg)</th>
                    <th className="p-3 text-right">Stok Sistem</th>
                    <th className="p-3 text-right bg-blue-50/50 font-bold text-slate-900">Stok Real Butcher</th>
                    <th className="p-3 text-right text-red-700">Susut Jual (Kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {STANDARD_PLANS.map((plan) => {
                    const rec = closingRecords.find((c) =>
                      (c.planName || '').toLowerCase().includes(plan.name.toLowerCase())
                    );
                    const planItems = todayItems.filter((i) =>
                      (i.plannedFabrication || '').toLowerCase().includes(plan.name.toLowerCase())
                    );
                    const carryItems = carryoverItems.filter((i) =>
                      (i.plannedFabrication || '').toLowerCase().includes(plan.name.toLowerCase())
                    );
                    const planAdj = adjustments.filter((a) =>
                      (a.planName || '').toLowerCase().includes(plan.name.toLowerCase())
                    );
                    const planSegs = segments.filter((s) =>
                      (s.plannedFabrication || '').toLowerCase().includes(plan.name.toLowerCase())
                    );

                    const stockAwal = rec
                      ? (typeof rec.openingStockKg === 'number' && !isNaN(rec.openingStockKg) ? rec.openingStockKg : 0)
                      : carryItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0);
                    const bahanDiolah = planItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0);
                    const adjIn = planAdj.filter((a) => a.type === 'IN').reduce((sum, a) => sum + (a.weightKg || 0), 0);
                    const adjOut = planAdj.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + (a.weightKg || 0), 0);
                    const hasilPotong = planItems.reduce(
                      (sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing || 0),
                      0
                    );
                    const totalTersedia = stockAwal + hasilPotong + adjIn - adjOut;
                    const sales = rec
                      ? (typeof rec.salesKg === 'number' && !isNaN(rec.salesKg) ? rec.salesKg : 0)
                      : planSegs.reduce((sum, s) => sum + (s.salesKg || 0), 0);
                    const stokSistem = Math.max(0, totalTersedia - sales);
                    const stokReal = rec
                      ? (typeof rec.actualClosingStockKg === 'number' && !isNaN(rec.actualClosingStockKg) ? rec.actualClosingStockKg : 0)
                      : planSegs.reduce((sum, s) => sum + (s.actualWeight || 0), 0);
                    const susutJual = rec
                      ? (typeof rec.susutJualKg === 'number' && !isNaN(rec.susutJualKg) ? rec.susutJualKg : 0)
                      : Math.max(0, stokSistem - stokReal);

                    return (
                      <tr key={plan.name} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{plan.name}</td>
                        <td className="p-3 text-right font-mono">{stockAwal.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono text-slate-700">{bahanDiolah.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono text-blue-600">+{adjIn.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono text-red-600">-{adjOut.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">{hasilPotong.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono font-bold text-blue-900">{totalTersedia.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">{sales.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono text-slate-600">{stokSistem.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono font-black text-slate-900 bg-blue-50/50">
                          {stokReal.toFixed(3)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-red-700">{susutJual.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ADJUST IN / OUT DAGING */}
      {/* ========================================================================= */}
      {activeTab === 'adjust' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Input Adjust */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-700" />
                Input Adjust IN / OUT Daging
              </h2>
              <p className="text-xs text-slate-500">
                Penyesuaian stok untuk mutasi antar cabang, retur supplier, atau koreksi fisik.
              </p>
            </div>

            {adjSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Penyesuaian stok berhasil dicatat!
              </div>
            )}

            {adjError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                {adjError}
              </div>
            )}

            <form onSubmit={handleSaveAdjustment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jenis Penyesuaian:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType('IN')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      adjType === 'IN'
                        ? 'bg-blue-800 text-white border-blue-800 shadow'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 text-emerald-300" />
                    ADJUST IN (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('OUT')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      adjType === 'OUT'
                        ? 'bg-red-800 text-white border-red-800 shadow'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-amber-300" />
                    ADJUST OUT (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Daging / Rencana Potong:
                </label>
                <select
                  value={adjMeatName}
                  onChange={(e) => setAdjMeatName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {STANDARD_PLANS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Berat Penyesuaian (Kg):
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Contoh: 5.250"
                  value={adjWeight}
                  onChange={(e) => setAdjWeight(e.target.value)}
                  className="w-full text-sm font-bold p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Penyesuaian:
                </label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Mutasi Antar Cabang (Penerimaan)">Mutasi Antar Cabang (Penerimaan)</option>
                  <option value="Mutasi Antar Cabang (Pengiriman)">Mutasi Antar Cabang (Pengiriman)</option>
                  <option value="Retur Supplier / Afkir">Retur Supplier / Afkir</option>
                  <option value="Koreksi Fisik Timbangan">Koreksi Fisik Timbangan</option>
                  <option value="Kerusakan Kemasan / Chiller">Kerusakan Kemasan / Chiller</option>
                  <option value="LAINNYA">+ Ketik Alasan Lainnya</option>
                </select>
              </div>

              {adjReason === 'LAINNYA' && (
                <div>
                  <input
                    type="text"
                    placeholder="Masukkan alasan penyesuaian..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow transition"
              >
                + Simpan Penyesuaian Stok
              </button>
            </form>
          </div>

          {/* Audit Log Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Audit Log Penyesuaian Stok Toko ({adjustments.length})
            </h3>

            {adjustments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada penyesuaian stok (Adjust In / Out) yang dicatat.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Jenis</th>
                      <th className="p-3">Daging / Rencana</th>
                      <th className="p-3 text-right">Berat (Kg)</th>
                      <th className="p-3">Alasan</th>
                      <th className="p-3">Petugas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-600">{adj.date}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              adj.type === 'IN'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            ADJUST {adj.type}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-800">{adj.meatName}</td>
                        <td className="p-3 text-right font-mono font-bold">
                          {adj.type === 'IN' ? '+' : '-'}
                          {adj.weightKg.toFixed(3)} Kg
                        </td>
                        <td className="p-3 text-slate-600">{adj.reason}</td>
                        <td className="p-3 text-slate-500">{adj.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SISA STOCK CLOSING & CARRYOVER AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Data Sisa Stock Closing dari Butcher
                </h2>
                <p className="text-xs text-slate-500">
                  Data hasil inputan closing butcher per rencana potong beserta foto timbangan fisik real.
                </p>
              </div>
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-md">
                Prinsip: Sisa Stok Kemarin TIDAK diikutkan hitung susut proses hari ini
              </span>
            </div>

            {(() => {
              const displayClosing = currentStoreClosing.length > 0 ? currentStoreClosing : closingRecords;
              return (
                <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3">Rencana Potong</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3 text-right">Sisa Kemarin (Kg)</th>
                    <th className="p-3 text-right">Diolah Hari Ini (Kg)</th>
                    <th className="p-3 text-right">Penjualan (Kg)</th>
                    <th className="p-3 text-right bg-blue-50/60 font-bold text-slate-900">Sisa Fisik Real</th>
                    <th className="p-3 text-right text-red-700">Susut Jual (Kg)</th>
                    <th className="p-3 text-center">Foto Bukti</th>
                    <th className="p-3">Catatan Butcher</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayClosing.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{rec.planName}</td>
                      <td className="p-3 text-slate-600">{rec.category}</td>
                      <td className="p-3 text-right font-mono">{(Number(rec.openingStockKg) || 0).toFixed(3)}</td>
                      <td className="p-3 text-right font-mono">{(Number(rec.newProcessedKg) || 0).toFixed(3)}</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{(Number(rec.salesKg) || 0).toFixed(3)}</td>
                      <td className="p-3 text-right font-mono font-black text-blue-900 bg-blue-50/60">
                        {(Number(rec.actualClosingStockKg) || 0).toFixed(3)} Kg
                      </td>
                      <td className="p-3 text-right font-mono text-red-700 font-bold">{(Number(rec.susutJualKg) || 0).toFixed(3)}</td>
                      <td className="p-3 text-center">
                        {rec.photoUrl ? (
                          <a
                            href={rec.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold"
                          >
                            <ImageIcon className="w-3.5 h-3.5" /> Lihat Bukti
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{rec.note || '-'}</td>
                      <td className="p-3 text-center">
                        {onDeleteClosingRecord && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus catatan closing fisik "${rec.planName}"?`)) {
                                onDeleteClosingRecord(rec.id);
                              }
                            }}
                            title="Hapus data closing ini"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: KETERANGAN COGS (TERHUBUNG KE MD PUSAT) */}
      {/* ========================================================================= */}
      {activeTab === 'cogs' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Keterangan Master COGS & Valuasi Finansial
                </h2>
                <p className="text-xs text-slate-500">
                  Harga Pokok (COGS) diatur secara terpusat oleh akun MD Pusat. Admin Toko hanya memiliki akses baca (Read-Only).
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Otoritas: MD Pusat (Read-Only Toko)</span>
              </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold">Total Valuasi Modal Bahan Diolah:</span>
                <div className="text-lg font-black text-slate-900 font-mono mt-1">
                  Rp {totalNilaiModalBahan.toLocaleString('id-ID')}
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">
                  {totalBahanHariIni.toFixed(2)} Kg @ harga COGS
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold">Kerugian Finansial Susut Proses:</span>
                <div className="text-lg font-black text-amber-700 font-mono mt-1">
                  Rp {totalKerugianRupiahSusutProses.toLocaleString('id-ID')}
                </div>
                <span className="text-[11px] text-amber-700 block mt-1">
                  {totalSusutProsesHariIni.toFixed(3)} Kg susut pabrikasi
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold">Kerugian Finansial Susut Jual:</span>
                <div className="text-lg font-black text-red-700 font-mono mt-1">
                  Rp {totalKerugianRupiahSusutJual.toLocaleString('id-ID')}
                </div>
                <span className="text-[11px] text-red-700 block mt-1">
                  {totalSusutJualKg.toFixed(3)} Kg susut display & closing
                </span>
              </div>
            </div>

            {/* Master COGS Reference Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3">Kode Item</th>
                    <th className="p-3">Nama Bahan / Daging</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3 text-right">COGS (Rp / Kg)</th>
                    <th className="p-3 text-right">Harga Jual Acuan (Rp)</th>
                    <th className="p-3">Update Terakhir</th>
                    <th className="p-3">Diinput Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cogsList.map((c, idx) => {
                    const catUpper = (c.category || 'DAGING FRESH').toUpperCase();
                    const catCode = catUpper.includes('PREM') ? 'DP' : catUpper.includes('SHANK') ? 'SH' : catUpper.includes('RAWON') ? 'RW' : 'DF';
                    const itemCode = c.itemCode || `${catCode}-${String(idx + 1).padStart(2, '0')}`;
                    const itemName = c.itemName || (c as any).planName || `Bahan ${catUpper} #${idx + 1}`;
                    const sellingPrice = c.defaultPricePerKg || (c as any).sellingPricePerKg || Math.round(Number(c.cogsPerKg || 100000) * 1.25);
                    const updatedBy = c.updatedBy || 'MD Pusat';
                    return (
                      <tr key={c.id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-slate-700 bg-slate-50/50">{itemCode}</td>
                        <td className="p-3 font-bold text-slate-900">{itemName}</td>
                        <td className="p-3 text-slate-700 font-medium">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 border border-slate-200">
                            {c.category}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-800 text-sm">
                          Rp {Number(c.cogsPerKg || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-800 font-semibold">
                          Rp {Number(sellingPrice).toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 font-mono text-slate-500">{c.updatedAt || '2026-08-01'}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-blue-700 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {updatedBy}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: EXPORT LAPORAN TOKO */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5 max-w-2xl mx-auto">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Download & Export Laporan Toko
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ekspor laporan harian toko persis dengan format sheet <strong className="text-slate-800">LAPORAN DAGING 02 AGUSTUS 2026.xlsx</strong>.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800">Struktur Sheet Excel yang Dihasilkan:</h3>
            <ul className="list-disc list-inside space-y-1.5 text-slate-600">
              <li><strong className="text-slate-900">Sheet 1 (LAP.DAGING):</strong> Rincian modal bahan vs hasil daging fresh, harga pokok COGS per kg, dan valuasi susut proses & susut jual.</li>
              <li><strong className="text-slate-900">Sheet 2 (PROSES):</strong> Form proses produksi, bahan masuk, hasil bersih per rencana potong, dan % susut proses.</li>
              <li><strong className="text-slate-900">Sheet 3 (SALES DAGING):</strong> Rekapitulasi pergerakan stok (Stok Awal, Bahan Masuk, Adjust IN/OUT, Total Tersedia, Sales, Stok Sistem, Stok Real Closing, dan % Susut Jual).</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleExportExcel}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Download Format Excel (.XLSX)
            </button>
            <button
              onClick={handleExportCSV}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Format CSV (.CSV)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL ZOOM PHOTO PREVIEW (High-Resolution Visual Verification) */}
      {/* ========================================================================= */}
      {zoomedPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setZoomedPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black truncate">{zoomedPhotoUrl.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setZoomedPhotoUrl(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center bg-black/50 max-h-[75vh] overflow-auto">
              <img
                src={zoomedPhotoUrl.url}
                alt={zoomedPhotoUrl.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="px-4 py-2.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between text-[11px] text-slate-300">
              <span>Foto bukti timbangan fisik resolusi penuh terlampir</span>
              <button
                type="button"
                onClick={() => setZoomedPhotoUrl(null)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* WINDOW / MODAL UNTUK MENAMPILKAN DATA TERSIMPAN */}
      <SavedDataViewerModal
        isOpen={isSavedDataModalOpen}
        onClose={() => setIsSavedDataModalOpen(false)}
        currentStore={currentStore}
        currentUser={currentUser}
        closingRecords={closingRecords}
        items={items}
        reports={reports}
        initialDate={selectedDate}
        onEditClosingRecord={handleEditClosing}
        onDeleteClosingRecord={onDeleteClosingRecord}
        onDeleteItem={onDeleteItem}
      />
    </div>
  );
}
