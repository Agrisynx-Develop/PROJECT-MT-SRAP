import React, { useState, useEffect } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  StockAdjustment,
  UserAccount,
  Store,
  GrnRecord,
  ReportCategory,
} from '../types';
import NonMeatReportTable from './NonMeatReportTable';
import { CatalogProduct, SOSIS_KENTANG_DORI_CATALOG, PARTING_AYAM_CATALOG } from '../utils/productCatalog';
import { exportSosisKentangDoriExcel, exportPartingAyamExcel } from '../utils/excelExport';
import { processHighResImage, ensureCloudSafeImage } from '../utils/imageCompressor';
import { isMatchPlan, getDeterministicClosingRecordId } from '../utils/storeHelper';
import { getPreviousDateStr, findHMinus1ClosingRecord, getHMinus1ClosingStock } from '../utils/dateUtils';
import SavedDataViewerModal from './SavedDataViewerModal';
import {
  CheckSquare,
  Scale,
  Camera,
  AlertCircle,
  CheckCircle2,
  Lock,
  Clock,
  ArrowRight,
  Upload,
  Loader2,
  Save,
  FileCheck,
  RefreshCw,
  Eye,
  X,
  Info,
  ShieldCheck,
  Sparkles,
  Building2,
  RotateCcw,
  Trash2,
  Calendar,
  Database,
  Grid,
  Table
} from 'lucide-react';

interface ButcherClosingViewProps {
  currentUser: UserAccount;
  currentStore?: Store;
  stores?: Store[];
  selectedStoreIdForMd?: string;
  onSelectStoreForMd?: (id: string) => void;
  items: ThawingItem[];
  segments: FabricationSegment[];
  adjustments?: StockAdjustment[];
  closingRecords?: ClosingPlanRecord[];
  existingClosingRecords?: ClosingPlanRecord[];
  onSaveClosingRecord: (record: Omit<ClosingPlanRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
  onDeleteClosingRecord?: (id: string) => void;
  onDailyResetAndCarryover?: () => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
  onNavigateToRiwayat?: () => void;
  grnRecords?: GrnRecord[];
  onSaveGrn?: (records: GrnRecord[] | GrnRecord) => void;
  activeReportCategory?: ReportCategory;
  onCategoryChange?: (category: ReportCategory) => void;
}

export default function ButcherClosingView({
  currentUser,
  currentStore,
  stores = [],
  selectedStoreIdForMd,
  onSelectStoreForMd,
  items,
  segments,
  adjustments = [],
  closingRecords = [],
  existingClosingRecords,
  onSaveClosingRecord,
  onDeleteClosingRecord,
  onDailyResetAndCarryover,
  onManualSync,
  isSyncing = false,
  lastSyncTime = null,
  onNavigateToRiwayat,
  grnRecords = [],
  onSaveGrn,
  activeReportCategory = 'DAGING',
  onCategoryChange,
}: ButcherClosingViewProps) {
  const records = existingClosingRecords ?? closingRecords ?? [];
  
  // Category Navigation State
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>(activeReportCategory || 'DAGING');

  useEffect(() => {
    if (activeReportCategory) {
      setSelectedCategory(activeReportCategory);
    }
  }, [activeReportCategory]);

  const handleCategoryTabChange = (cat: ReportCategory) => {
    setSelectedCategory(cat);
    onCategoryChange?.(cat);
  };

  // State for non-meat modal (Physical Weighing)
  const [activeNonMeatModal, setActiveNonMeatModal] = useState<{
    mode: 'WEIGH';
    product: CatalogProduct;
    rowData: any;
  } | null>(null);
  const [nonMeatWeighedKg, setNonMeatWeighedKg] = useState('');
  const [nonMeatPhoto, setNonMeatPhoto] = useState('');
  const [nonMeatNote, setNonMeatNote] = useState('');
  const [nonMeatError, setNonMeatError] = useState<string | null>(null);
  const [isCompressingNonMeatPhoto, setIsCompressingNonMeatPhoto] = useState(false);

  // Dedicated states for Parting Ayam
  const [partingTallyKg, setPartingTallyKg] = useState('');
  const [partingBrutoKg, setPartingBrutoKg] = useState('');
  const [partingNettoKg, setPartingNettoKg] = useState('');
  const [partingCostPerKg, setPartingCostPerKg] = useState('');
  const [partingSalePerKg, setPartingSalePerKg] = useState('');

  // Helper for matching plan name
  const isPlanMatch = (a?: string, b?: string) => isMatchPlan(a, b);

  // Closing date selection (defaults to today, but can be set to past dates)
  const [closingDate, setClosingDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [undoToast, setUndoToast] = useState<{ record: ClosingPlanRecord; planName: string } | null>(null);
  const [isSavedDataModalOpen, setIsSavedDataModalOpen] = useState(false);

  // View mode for Non-Meat (Kentang, Sosis & Dori / Parting Ayam)
  const [nonMeatViewMode, setNonMeatViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [sosisFilter, setSosisFilter] = useState<'ALL' | 'SOSIS_KENTANG' | 'FILLET_DORI'>('ALL');
  const [partingFilter, setPartingFilter] = useState<'ALL' | 'PAHA' | 'DADA' | 'LAINNYA'>('ALL');

  // Date-aware record lookup: ensures reports from past dates (Laporan Terlewat) don't collide with today's closing
  const getRecordForPlan = (planName: string, targetDate: string = closingDate): ClosingPlanRecord | undefined => {
    return records.find(
      (r) =>
        isPlanMatch(r.planName, planName) &&
        ((r.date || r.timestamp || '').split('T')[0] === targetDate)
    );
  };

  // Standard Rencana Potong list
  const STANDARD_PLANS = [
    { name: 'D.sapi pot. rdang', category: 'DAGING FRESH', icon: '🥩' },
    { name: 'Daging Rendang Shankle', category: 'SHANKLE', icon: '🥩' },
    { name: 'D Premium lokal', category: 'DAGING PREMIUM', icon: '🍖' },
    { name: 'Rawon Curah', category: 'RAWON', icon: '🥘' },
    { name: 'D.r. fresh member', category: 'DAGING FRESH', icon: '🥩' },
    { name: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM', icon: '🍖' },
  ];

  // Also include any dynamically added plans from items
  const allUniquePlans = [...STANDARD_PLANS];
  items.forEach((item) => {
    if (item.plannedFabrication && !allUniquePlans.some((p) => isPlanMatch(p.name, item.plannedFabrication))) {
      allUniquePlans.push({
        name: item.plannedFabrication,
        category: (item.pabrikasiCategory || 'DAGING FRESH') as string,
        icon: '🥩',
      });
    }
  });

  // Modal State for Active Input
  const [selectedPlan, setSelectedPlan] = useState<typeof STANDARD_PLANS[0] | null>(null);
  const [physicalWeight, setPhysicalWeight] = useState('');
  const [closingPhoto, setClosingPhoto] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [isOptimizingPhoto, setIsOptimizingPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State for Viewing Locked Plan Details
  const [viewLockedPlan, setViewLockedPlan] = useState<{
    plan: typeof STANDARD_PLANS[0];
    record: ClosingPlanRecord;
    openingKg: number;
    processedKg: number;
    adjIn: number;
    adjOut: number;
    totalTersedia: number;
    currentSales: number;
    stokSistem: number;
    susutJual: number;
  } | null>(null);

  // Confirmation Modal for Daily Reset / Carryover
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Zoom photo modal
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);

  // Parse input string safely with comma support (e.g. "0,5" -> 0.5)
  const parseSafeFloat = (val: string): number => {
    if (!val) return 0;
    const clean = val.toString().replace(',', '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Handle opening active input modal for an unlocked plan or for editing
  const handleOpenClosingModal = (planObj: typeof STANDARD_PLANS[0], existingRecordToEdit?: ClosingPlanRecord) => {
    const existingRec = existingRecordToEdit || getRecordForPlan(planObj.name);

    setSelectedPlan(planObj);
    if (existingRec) {
      setPhysicalWeight(existingRec.actualClosingStockKg !== undefined ? existingRec.actualClosingStockKg.toString() : '');
      setClosingPhoto(existingRec.photoUrl || '');
      setClosingNote(existingRec.note || '');
    } else {
      setPhysicalWeight('');
      setClosingPhoto('');
      setClosingNote('');
    }
    setErrorMsg('');
  };

  // Handle opening locked details modal
  const handleOpenLockedDetails = (planObj: typeof STANDARD_PLANS[0], record: ClosingPlanRecord) => {
    const todayPlanItems = items.filter(
      (i) => !i.isCarryover && isPlanMatch(i.plannedFabrication, planObj.name)
    );
    const carryoverPlanItems = items.filter(
      (i) => i.isCarryover && isPlanMatch(i.plannedFabrication, planObj.name)
    );
    const planSegments = segments.filter(
      (s) => isPlanMatch(s.plannedFabrication, planObj.name)
    );
    const planAdj = adjustments.filter((a) => isPlanMatch(a.planName, planObj.name));
    const adjIn = planAdj.filter((a) => a.type === 'IN').reduce((sum, a) => sum + (a.weightKg || 0), 0);
    const adjOut = planAdj.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + (a.weightKg || 0), 0);

    const h1Closing = getHMinus1ClosingStock(records || [], currentStore || { id: currentUser.storeId }, planObj.name, record.date || closingDate);
    const openingKg = (carryoverPlanItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0)) ||
      (typeof record.openingStockKg === 'number' && record.openingStockKg > 0 ? record.openingStockKg : (h1Closing ?? (record.openingStockKg || 0)));
    const processedKg = (todayPlanItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing || 0), 0)) || (typeof record.newProcessedKg === 'number' ? record.newProcessedKg : 0);
    const totalTersedia = openingKg + processedKg + adjIn - adjOut;
    
    // Adaptive sales from segments or items
    const segmentSales = planSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0);
    const itemSales = todayPlanItems.concat(carryoverPlanItems).reduce((sum, i) => sum + (i.salesKg || 0), 0);
    const currentSales = Math.max(segmentSales, itemSales, (typeof record.salesKg === 'number' ? record.salesKg : 0));
    const stokSistem = Math.max(0, totalTersedia - currentSales);
    const actualClosing = typeof record.actualClosingStockKg === 'number' ? record.actualClosingStockKg : 0;
    const susutJual = Math.max(0, stokSistem - actualClosing);

    setViewLockedPlan({
      plan: planObj,
      record,
      openingKg,
      processedKg,
      adjIn,
      adjOut,
      totalTersedia,
      currentSales,
      stokSistem,
      susutJual,
    });
  };

  // Handle Photo File Upload with High Resolution Support
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsOptimizingPhoto(true);
      setErrorMsg('');
      try {
        const optimized = await processHighResImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
        });
        setClosingPhoto(optimized);
      } catch (err) {
        console.error('Error optimizing photo:', err);
        setErrorMsg('Gagal memproses resolusi foto. Coba pilih foto kembali.');
      } finally {
        setIsOptimizingPhoto(false);
      }
    }
  };

  // Handle Submit Closing
  const handleSubmitClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const actualStock = parseSafeFloat(physicalWeight);
    if (isNaN(actualStock) || actualStock < 0 || !physicalWeight.trim()) {
      setErrorMsg('Harap masukkan angka timbangan sisa stok fisik closing yang valid (≥ 0)!');
      return;
    }

    // MANDATORY PHOTO VALIDATION
    if (!closingPhoto) {
      setErrorMsg('⚠️ FOTO TIMBANGAN FISIK SISA STOK WAJIB DIUNGGAH (MANDATORY)!');
      return;
    }

    // Retrieve sales for this plan from segments
    const planSegments = segments.filter((s) => isPlanMatch(s.plannedFabrication, selectedPlan.name));
    const segmentSales = planSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0);

    // Filter items processed today vs carryover
    const todayPlanItems = items.filter(
      (i) => !i.isCarryover && isPlanMatch(i.plannedFabrication, selectedPlan.name)
    );
    const carryoverPlanItems = items.filter(
      (i) => i.isCarryover && isPlanMatch(i.plannedFabrication, selectedPlan.name)
    );

    // Adjustments for this plan
    const planAdj = adjustments.filter((a) => isPlanMatch(a.planName, selectedPlan.name));
    const adjIn = planAdj.filter((a) => a.type === 'IN').reduce((sum, a) => sum + a.weightKg, 0);
    const adjOut = planAdj.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + a.weightKg, 0);

    const existingRec = getRecordForPlan(selectedPlan.name, closingDate);
    const h1Closing = getHMinus1ClosingStock(records || [], currentStore || { id: currentUser.storeId }, selectedPlan.name, closingDate);
    const carryoverKg = carryoverPlanItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
    const openingStockKg = carryoverKg || (existingRec && existingRec.openingStockKg !== undefined && existingRec.openingStockKg > 0 ? existingRec.openingStockKg : (h1Closing ?? (existingRec?.openingStockKg || 0)));
    const newProcessedKg = (todayPlanItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0)) || (existingRec ? (Number(existingRec.newProcessedKg) || 0) : 0);
    const itemSales = todayPlanItems.concat(carryoverPlanItems).reduce((sum, i) => sum + (i.salesKg || 0), 0);
    const calculatedSales = Math.max(segmentSales, itemSales, (existingRec ? (Number(existingRec.salesKg) || 0) : 0));
    const totalTersedia = openingStockKg + newProcessedKg + adjIn - adjOut;
    const closingBySystem = Math.max(0, totalTersedia - calculatedSales);
    const susutJualKg = Math.max(0, closingBySystem - actualStock);

    const effectiveStoreId = currentStore?.id || currentUser.storeId || '1';
    const recId = existingRec?.id || getDeterministicClosingRecordId(effectiveStoreId, selectedPlan.name, closingDate);

    // Sanitize note
    const sanitizedNote = closingNote.replace(/[<>]/g, '').trim();

    // Ensure photo size is safe for cloud sync
    let safePhoto = closingPhoto;
    if (closingPhoto && closingPhoto.length > 35000) {
      safePhoto = await ensureCloudSafeImage(closingPhoto, 35000);
    }

    onSaveClosingRecord({
      id: recId,
      storeId: effectiveStoreId,
      date: closingDate,
      planName: selectedPlan.name,
      category: selectedPlan.category,
      openingStockKg: parseFloat(openingStockKg.toFixed(3)),
      newProcessedKg: parseFloat(newProcessedKg.toFixed(3)),
      adjustInKg: parseFloat(adjIn.toFixed(3)),
      adjustOutKg: parseFloat(adjOut.toFixed(3)),
      salesKg: parseFloat(calculatedSales.toFixed(3)),
      closingStockBySystemKg: parseFloat(closingBySystem.toFixed(3)),
      actualClosingStockKg: parseFloat(actualStock.toFixed(3)),
      susutJualKg: parseFloat(susutJualKg.toFixed(3)),
      photoUrl: safePhoto,
      photoCaption: `Foto Timbangan Closing: ${selectedPlan.name}`,
      note: sanitizedNote,
      butcherName: currentUser.fullName || currentUser.username,
      timestamp: `${closingDate}T17:00:00.000Z`,
    });

    setSuccessMsg(`✓ Status rencana "${selectedPlan.name}" kini SUDAH CLOSING (Terlock). Timbangan fisik ${actualStock.toFixed(3)} Kg disimpan & terintegrasi sebagai calon Stok Awal besok!`);
    setTimeout(() => setSuccessMsg(''), 6000);
    setSelectedPlan(null);
  };

  // Undo / Cancel closing handler
  const handleUndoClosing = (rec: ClosingPlanRecord, planName: string) => {
    if (!rec?.id) return;
    if (window.confirm(`Batalkan / Hapus closing untuk rencana "${planName}"? Status akan kembali terbuka untuk diinput ulang timbangan fisik.`)) {
      if (onDeleteClosingRecord) {
        onDeleteClosingRecord(rec.id);
      }
      setUndoToast({ record: rec, planName });
      setSuccessMsg(`Closing "${planName}" berhasil dibatalkan (Undo). Anda dapat mengisi kembali timbangan.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setViewLockedPlan(null);
      setSelectedPlan(null);
    }
  };

  const handleRestoreClosing = () => {
    if (undoToast?.record) {
      onSaveClosingRecord(undoToast.record);
      setSuccessMsg(`Closing "${undoToast.planName}" berhasil dikembalikan!`);
      setUndoToast(null);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  // Perform daily reset and carryover
  const handleConfirmResetAndCarryover = () => {
    if (onDailyResetAndCarryover) {
      onDailyResetAndCarryover();
      setIsResetConfirmOpen(false);
      setSuccessMsg('✓ Berhasil melakukan Refresh Closing Harian! Sisa stok fisik closing telah terintegrasi menjadi Stok Awal (Sisa Kemarin) untuk hari baru.');
      setTimeout(() => setSuccessMsg(''), 6000);
    }
  };

  // --- Handler for Non-Meat Closing (Physical Weighing) ---

  const handleOpenWeighModal = (product: CatalogProduct, rowData: any) => {
    setActiveNonMeatModal({ mode: 'WEIGH', product, rowData });
    const existingRec = rowData?.closingRec || (rowData?.actualClosingStockKg !== undefined ? rowData : undefined);
    setNonMeatWeighedKg(typeof existingRec?.actualClosingStockKg === 'number' ? String(existingRec.actualClosingStockKg) : '');
    setNonMeatPhoto(existingRec?.photoUrl || '');
    setNonMeatNote(existingRec?.note || '');
    setNonMeatError(null);

    const isParting = product.category === 'PARTING_AYAM' || product.reportCategory === 'PARTING_AYAM' || selectedCategory === 'PARTING_AYAM';
    if (isParting) {
      setPartingTallyKg(
        typeof existingRec?.tallyKg === 'number' && existingRec.tallyKg > 0
          ? String(existingRec.tallyKg)
          : typeof rowData?.tally === 'number' && rowData.tally > 0
          ? String(rowData.tally)
          : typeof rowData?.grnKg === 'number' && rowData.grnKg > 0
          ? String(rowData.grnKg)
          : ''
      );
      setPartingBrutoKg(
        typeof existingRec?.brutoKg === 'number' && existingRec.brutoKg > 0
          ? String(existingRec.brutoKg)
          : typeof rowData?.bruto === 'number' && rowData.bruto > 0
          ? String(rowData.bruto)
          : ''
      );
      setPartingNettoKg(
        typeof existingRec?.nettoKg === 'number' && existingRec.nettoKg > 0
          ? String(existingRec.nettoKg)
          : typeof existingRec?.actualClosingStockKg === 'number' && existingRec.actualClosingStockKg > 0
          ? String(existingRec.actualClosingStockKg)
          : typeof rowData?.netto === 'number' && rowData.netto > 0
          ? String(rowData.netto)
          : ''
      );
      setPartingCostPerKg(
        String(existingRec?.costPerKg || rowData?.cost || product.cogsPerKg || 0)
      );
      setPartingSalePerKg(
        String(existingRec?.sellingPricePerKg || rowData?.sale || product.sellingPricePerKg || 0)
      );
    }
  };

  const handleNonMeatPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressingNonMeatPhoto(true);
      try {
        const compressed = await processHighResImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.75 });
        const cloudSafe = await ensureCloudSafeImage(compressed, 35000);
        setNonMeatPhoto(cloudSafe);
        setNonMeatError(null);
      } catch (err) {
        setNonMeatError('Gagal memproses foto. Silakan coba lagi.');
      } finally {
        setIsCompressingNonMeatPhoto(false);
      }
    }
  };

  const handleSaveNonMeatClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNonMeatModal) return;
    const { product, rowData } = activeNonMeatModal;

    if (!nonMeatPhoto) {
      setNonMeatError('Foto fisik timbangan real wajib diunggah untuk validasi sistem!');
      return;
    }

    const effectiveStoreId = currentStore?.id || currentUser.storeId || '1';
    const isParting = product.category === 'PARTING_AYAM' || product.reportCategory === 'PARTING_AYAM' || selectedCategory === 'PARTING_AYAM';

    let actualWeight = 0;
    let susutJual = 0;

    // Parting Ayam Specific Metrics (from User Prompts)
    let pTally = 0;
    let pBruto = 0;
    let pNetto = 0;
    let pCost = 0;
    let pSale = 0;
    let pBeratSusut = 0;
    let pValueReal = 0;
    let pValueProcess = 0;
    let pCostReal = 0;
    let pSusutPercent = 0;
    let pSusutReal = 0;
    let pGpPercent = 0;

    if (isParting) {
      pTally = parseFloat(partingTallyKg) || 0;
      pBruto = parseFloat(partingBrutoKg) || 0;
      pNetto = parseFloat(partingNettoKg) || 0;
      pCost = parseFloat(partingCostPerKg) || product.cogsPerKg || 0;
      pSale = parseFloat(partingSalePerKg) || product.sellingPricePerKg || 0;

      if (pNetto <= 0 && pTally <= 0) {
        setNonMeatError('Harap masukkan angka Netto (Kg) atau Tally (Kg) yang valid!');
        return;
      }

      actualWeight = pNetto > 0 ? pNetto : pTally;
      // 1. berat susut didapat dari tally di ambil netto
      pBeratSusut = pTally > 0 ? Math.max(0, pTally - pNetto) : 0;
      // 2. cost didapat dari data cogs (pCost)
      // 3. value real didapat dari tally di kali cost
      pValueReal = pTally * pCost;
      // 4. value process netto di kali cost
      pValueProcess = pNetto * pCost;
      // 5. cost real didapat dari value real dibagi netto
      pCostReal = pNetto > 0 ? pValueReal / pNetto : 0;
      // 6. persentase susut didapat dari ((tally - netto)/tally)
      pSusutPercent = pTally > 0 ? ((pTally - pNetto) / pTally) * 100 : 0;
      // 7. susut real didapat dari bruto diambil netto
      pSusutReal = Math.max(0, pBruto - pNetto);
      // 8. sale didapat dari lampiran harga sales (pSale)
      // 9. GP didapatkan dari(((sale-cost real)/sale)*100%)
      pGpPercent = pSale > 0 && pCostReal > 0 ? ((pSale - pCostReal) / pSale) * 100 : 0;
      susutJual = Math.max(0, rowData.stockBySistem - actualWeight);
    } else {
      const parsed = parseFloat(nonMeatWeighedKg);
      if (isNaN(parsed) || parsed < 0) {
        setNonMeatError('Harap masukkan angka berat timbangan fisik (Kg) yang valid!');
        return;
      }
      actualWeight = parsed;
      susutJual = Math.max(0, rowData.stockBySistem - parsed);
    }

    let safePhoto = nonMeatPhoto;
    if (safePhoto.length > 35000) {
      safePhoto = await ensureCloudSafeImage(safePhoto, 35000);
    }

    onSaveClosingRecord({
      id: getDeterministicClosingRecordId(effectiveStoreId, product.name, closingDate),
      storeId: effectiveStoreId,
      date: closingDate,
      planName: product.name,
      itemCode: product.itemCode,
      category: product.category,
      openingStockKg: parseFloat(rowData.openingStockKg.toFixed(3)),
      newProcessedKg: 0,
      grnKg: parseFloat(rowData.grnKg.toFixed(3)),
      adjustInKg: rowData.netAdj > 0 ? parseFloat(rowData.netAdj.toFixed(3)) : 0,
      adjustOutKg: rowData.netAdj < 0 ? parseFloat(Math.abs(rowData.netAdj).toFixed(3)) : 0,
      salesKg: parseFloat(rowData.salesKg.toFixed(3)),
      closingStockBySystemKg: parseFloat(rowData.stockBySistem.toFixed(3)),
      actualClosingStockKg: parseFloat(actualWeight.toFixed(3)),
      susutJualKg: parseFloat(susutJual.toFixed(3)),
      isUnopened: false,
      // Parting ayam fields
      tallyKg: pTally,
      brutoKg: pBruto,
      nettoKg: pNetto,
      costPerKg: pCost,
      sellingPricePerKg: pSale,
      valueReal: pValueReal,
      valueProcess: pValueProcess,
      costReal: pCostReal,
      susutPercent: pSusutPercent,
      susutRealKg: pSusutReal,
      gpPercent: pGpPercent,
      photoUrl: safePhoto,
      photoCaption: `Closing Fisik: ${product.name}`,
      note: nonMeatNote,
      butcherName: currentUser.fullName || currentUser.username,
      timestamp: `${closingDate}T17:00:00.000Z`,
    });

    setSuccessMsg(
      `✓ Closing fisik "${product.name}" berhasil disimpan! Sisa fisik ${actualWeight.toFixed(3)} Kg terintegrasi sebagai calon Stok Awal besok.`
    );
    setTimeout(() => setSuccessMsg(''), 6000);

    setActiveNonMeatModal(null);
    setNonMeatPhoto('');
    setNonMeatWeighedKg('');
    setNonMeatNote('');
  };

  const closedCount = allUniquePlans.filter((p) => Boolean(getRecordForPlan(p.name, closingDate))).length;
  const isAllClosed = closedCount === allUniquePlans.length && allUniquePlans.length > 0;

  return (
    <div className="space-y-6">
      {/* MD Multi-Store Selector Bar (if user is MD) */}
      {currentUser.role === 'md' && stores && stores.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">Pilih Toko Cabang (MD Multi-Store Closing Monitor):</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {stores.map((s) => {
              const isSelected = (currentStore?.id === s.id) || (selectedStoreIdForMd === s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectStoreForMd && onSelectStoreForMd(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Title & Instructions Header */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 space-y-4">
        {/* Ribbon Meta */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-red-600 text-white shadow-xs">
              Menu Closing Butcher
            </span>
            <span className="text-xs text-slate-200 font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
              {currentStore?.name || 'TDN Cikarang Utara'}
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
              Role: <strong className="text-white uppercase">{currentUser.role}</strong> ({currentUser.fullName || currentUser.username})
            </span>
          </div>
          <div className="text-xs font-mono text-emerald-400 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800">
            Tanggal Closing: <strong>{closingDate}</strong>
          </div>
        </div>

        {/* Title & Instructions */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <CheckSquare className="w-6 h-6 text-red-400 shrink-0" />
            <span>Closing Fisik & Validasi Sisa Stok Malam</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-4xl leading-relaxed">
            Timbang sisa fisik di chiller/display. Data tersinkron otomatis secara real-time ke akun Butcher, Admin Toko, dan MD. Sisa fisiknya terintegrasi sebagai <strong>Stok Awal (Sisa Kemarin)</strong> hari berikutnya.
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          {/* Status Indicator */}
          <div className={`px-3.5 py-2 rounded-xl flex items-center gap-3 border ${
            isAllClosed
              ? 'bg-emerald-950/90 border-emerald-600 text-emerald-100 shadow-sm'
              : 'bg-slate-800/90 border-slate-700 text-white'
          }`}>
            <div className={`p-1.5 rounded-lg ${isAllClosed ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}>
              {isAllClosed ? <CheckCircle2 className="w-4 h-4 text-emerald-200" /> : <Camera className="w-4 h-4" />}
            </div>
            <div className="text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Status Closing:</span>
              <strong className={`font-bold ${isAllClosed ? 'text-emerald-300' : 'text-white'}`}>
                {closedCount} dari {allUniquePlans.length} Selesai {isAllClosed ? '✓ (Lengkap)' : ''}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Refresh Data Button */}
            {onManualSync && (
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer border shadow-xs ${
                  isSyncing
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200 cursor-wait'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 active:scale-95'
                }`}
                title="Muat ulang & segarkan data closing dari server sistem"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
                <span>{isSyncing ? 'Memuat Data...' : 'Segarkan Data'}</span>
              </button>
            )}

            {onNavigateToRiwayat && (
              <button
                type="button"
                onClick={onNavigateToRiwayat}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                title="Buka Riwayat Harian untuk melihat rekap closing dan foto dokumentasi"
              >
                <FileCheck className="w-4 h-4" />
                <span>Lihat Riwayat Harian</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {onDailyResetAndCarryover && (
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer border border-amber-400/40"
                title="Tutup siklus operasional hari ini dan integrasikan sisa fisik timbangan menjadi Stok Awal (Sisa Kemarin) hari besok"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Closing Harian (Carryover)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CATEGORY SWITCHER TABS (Daging, Kentang Sosis & Dori, Parting Ayam) */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Kategori Laporan Closing:
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleCategoryTabChange('DAGING')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                selectedCategory === 'DAGING'
                  ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="text-base">🥩</span>
              <span>Laporan Daging</span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryTabChange('KENTANG_SOSIS_DORI')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                selectedCategory === 'KENTANG_SOSIS_DORI'
                  ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="text-base">🌭🍟</span>
              <span>Laporan Kentang, Sosis & Dori</span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryTabChange('PARTING_AYAM')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                selectedCategory === 'PARTING_AYAM'
                  ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="text-base">🍗</span>
              <span>Laporan Parting Ayam</span>
            </button>
          </div>
        </div>

        {selectedCategory !== 'DAGING' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (currentStore) {
                  if (selectedCategory === 'KENTANG_SOSIS_DORI') {
                    exportSosisKentangDoriExcel(currentStore, closingDate, records, grnRecords, adjustments);
                  } else {
                    exportPartingAyamExcel(currentStore, closingDate, records, grnRecords, adjustments);
                  }
                }
              }}
              className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>Download Excel (XLSX)</span>
            </button>
          </div>
        )}
      </div>

      {/* Date Filter & Past Date Input Selector (Universal for All Categories) */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-red-50 text-red-700 rounded-xl">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">Tanggal Operasional / Laporan Closing:</span>
            <span className="text-[11px] text-slate-500">Anda dapat memilih tanggal hari ini atau tanggal yang sudah terlewat untuk mengisi laporan.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsSavedDataModalOpen(true)}
            className="text-xs px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
            title="Buka Window Data Tersimpan di Database"
          >
            <Database className="w-4 h-4 text-indigo-200" />
            Window Data Tersimpan
          </button>
          <input
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-600 focus:outline-none"
          />
          {closingDate !== new Date().toISOString().split('T')[0] && (
            <button
              type="button"
              onClick={() => setClosingDate(new Date().toISOString().split('T')[0])}
              className="text-[11px] px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition"
            >
              Reset ke Hari Ini
            </button>
          )}
        </div>
      </div>

      {selectedCategory !== 'DAGING' ? (
        <div className="space-y-4">
          {/* Sub-Header Toolbar: View Mode & Filter Tabs */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setNonMeatViewMode('GRID')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  nonMeatViewMode === 'GRID'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5 text-red-600" />
                <span>Tampilan Kartu Closing</span>
              </button>

              <button
                type="button"
                onClick={() => setNonMeatViewMode('TABLE')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  nonMeatViewMode === 'TABLE'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5 text-blue-600" />
                <span>Tabel Detail Laporan (MD / Excel)</span>
              </button>
            </div>

            {/* Sub-Category Filter Pills */}
            {selectedCategory === 'KENTANG_SOSIS_DORI' ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSosisFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    sosisFilter === 'ALL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Semua ({SOSIS_KENTANG_DORI_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSosisFilter('SOSIS_KENTANG')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    sosisFilter === 'SOSIS_KENTANG'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>🌭🍟</span> Sosis & Kentang (15)
                </button>
                <button
                  type="button"
                  onClick={() => setSosisFilter('FILLET_DORI')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    sosisFilter === 'FILLET_DORI'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>🐟</span> Fillet Dori (6)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPartingFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    partingFilter === 'ALL'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Semua ({PARTING_AYAM_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPartingFilter('PAHA')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    partingFilter === 'PAHA'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>🍗</span> Paha (4)
                </button>
                <button
                  type="button"
                  onClick={() => setPartingFilter('DADA')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    partingFilter === 'DADA'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>🥩</span> Dada (3)
                </button>
                <button
                  type="button"
                  onClick={() => setPartingFilter('LAINNYA')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    partingFilter === 'LAINNYA'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>🍗</span> Sayap & Lainnya (7)
                </button>
              </div>
            )}
          </div>

          {/* MODE 1: GRID OF CLOSING CARDS (EXACT MATCH TO USER SCREENSHOT) */}
          {nonMeatViewMode === 'GRID' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const targetCatalog =
                  selectedCategory === 'KENTANG_SOSIS_DORI'
                    ? SOSIS_KENTANG_DORI_CATALOG.filter((p) => {
                        if (sosisFilter === 'SOSIS_KENTANG') return p.subCategory === 'SOSIS & KENTANG';
                        if (sosisFilter === 'FILLET_DORI') return p.subCategory === 'FILLET DORI';
                        return true;
                      })
                    : PARTING_AYAM_CATALOG.filter((p) => {
                        const lower = p.name.toLowerCase();
                        if (partingFilter === 'PAHA') return lower.includes('paha');
                        if (partingFilter === 'DADA') return lower.includes('dada');
                        if (partingFilter === 'LAINNYA') return !lower.includes('paha') && !lower.includes('dada');
                        return true;
                      });

                return targetCatalog.map((prod) => {
                  const existingRec = records.find(
                    (r) =>
                      (isMatchPlan(r.planName, prod.name) || (prod.itemCode && r.itemCode === prod.itemCode)) &&
                      ((r.date || r.timestamp || '').split('T')[0] === closingDate)
                  );

                  const h1Stock =
                    getHMinus1ClosingStock(records || [], currentStore || { id: currentUser.storeId }, prod.name, closingDate) || 0;
                  const openingStock =
                    typeof existingRec?.openingStockKg === 'number' && existingRec.openingStockKg > 0
                      ? existingRec.openingStockKg
                      : h1Stock;

                  const productGrns = grnRecords.filter(
                    (g) =>
                      (g.date || '').split('T')[0] === closingDate &&
                      (isMatchPlan(g.productName, prod.name) || (prod.itemCode && g.itemCode === prod.itemCode))
                  );
                  const grnKg = productGrns.reduce((sum, g) => sum + (g.weightKg || 0), 0) || (existingRec?.grnKg || 0);

                  const productAdjs = adjustments.filter(
                    (a) =>
                      (a.date || '').split('T')[0] === closingDate &&
                      (isMatchPlan(a.planName, prod.name) || (prod.itemCode && a.itemCode === prod.itemCode))
                  );
                  const adjIn = productAdjs.filter((a) => a.type === 'IN').reduce((sum, a) => sum + (a.weightKg || 0), 0);
                  const adjOut = productAdjs.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + (a.weightKg || 0), 0);
                  const netAdj = adjIn - adjOut;

                  const totalReal = openingStock + grnKg + netAdj;
                  const salesKg = existingRec?.salesKg || 0;
                  const stokSistem = Math.max(0, totalReal - salesKg);

                  const isClosed = Boolean(existingRec && typeof existingRec.actualClosingStockKg === 'number');
                  const actualClosingStock = isClosed ? existingRec!.actualClosingStockKg : 0;
                  const susutJualKg = isClosed
                    ? typeof existingRec?.susutJualKg === 'number'
                      ? existingRec.susutJualKg
                      : Math.max(0, stokSistem - actualClosingStock)
                    : 0;

                  const latestGrn = productGrns[0];
                  const tally =
                    typeof existingRec?.tallyKg === 'number' && existingRec.tallyKg > 0
                      ? existingRec.tallyKg
                      : typeof latestGrn?.tallyKg === 'number' && latestGrn.tallyKg > 0
                      ? latestGrn.tallyKg
                      : grnKg;
                  const bruto =
                    typeof existingRec?.brutoKg === 'number' && existingRec.brutoKg > 0
                      ? existingRec.brutoKg
                      : typeof latestGrn?.brutoKg === 'number' && latestGrn.brutoKg > 0
                      ? latestGrn.brutoKg
                      : tally;
                  const netto =
                    typeof existingRec?.nettoKg === 'number' && existingRec.nettoKg > 0
                      ? existingRec.nettoKg
                      : typeof latestGrn?.nettoKg === 'number' && latestGrn.nettoKg > 0
                      ? latestGrn.nettoKg
                      : grnKg;

                  const rowData = {
                    openingStockKg: openingStock,
                    grnKg,
                    netAdj,
                    salesKg,
                    stockBySistem: stokSistem,
                    closingRec: existingRec,
                    actualClosingStockKg: actualClosingStock,
                    photoUrl: existingRec?.photoUrl,
                    note: existingRec?.note,
                    tally,
                    bruto,
                    netto,
                    cost: prod.cogsPerKg || 0,
                    sale: prod.sellingPricePerKg || 0,
                  };

                  const getProductIcon = (name: string, category: string = '') => {
                    const lower = (name + ' ' + category).toLowerCase();
                    if (lower.includes('ayam') || lower.includes('paha') || lower.includes('dada') || lower.includes('sayap') || lower.includes('ati') || lower.includes('ampela') || lower.includes('kerangka')) return '🍗';
                    if (lower.includes('dori') || lower.includes('ikan') || lower.includes('fillet dori')) return '🐟';
                    if (lower.includes('kentang') || lower.includes('shoestring') || lower.includes('crinkle') || lower.includes('straight')) return '🍟';
                    if (lower.includes('sosis') || lower.includes('cocktail') || lower.includes('bakso') || lower.includes('nugget') || lower.includes('strip')) return '🌭';
                    return '📦';
                  };

                  return (
                    <div
                      key={prod.itemCode || prod.name}
                      className={`bg-white rounded-2xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                        isClosed
                          ? 'border-emerald-400 bg-emerald-50/20 ring-2 ring-emerald-300/70 shadow-sm'
                          : 'border-slate-200 hover:border-red-400'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Category & Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                              {prod.category || prod.subCategory}
                            </span>
                            <h3 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                              <span>{getProductIcon(prod.name, prod.category)}</span>
                              <span className="truncate">{prod.name}</span>
                            </h3>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              PLU: {prod.plu || '-'} &bull; Code: {prod.itemCode}
                            </div>
                          </div>

                          {isClosed ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[11px] font-black flex items-center gap-1.5 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              Sudah Closing (Terlock)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-[11px] font-bold flex items-center gap-1.5 shrink-0">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Belum Closing
                            </span>
                          )}
                        </div>

                        {/* Metrics Breakdown Box (3 Columns) */}
                        <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Sisa Kemarin</span>
                            <strong className="text-slate-800 font-mono text-xs">{openingStock.toFixed(2)} Kg</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">
                              {selectedCategory === 'PARTING_AYAM' ? 'Netto Display' : 'Barang Masuk'}
                            </span>
                            <strong className="text-red-700 font-mono text-xs">
                              {(selectedCategory === 'PARTING_AYAM' ? (netto > 0 ? netto : grnKg) : grnKg).toFixed(2)} Kg
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-700 font-bold block">Sales Real</span>
                            <strong className="text-emerald-700 font-mono text-xs">{salesKg.toFixed(2)} Kg</strong>
                          </div>
                        </div>

                        {/* Sisa Stok Fisik & Susut Jual Result (when closed) */}
                        {isClosed && existingRec ? (
                          <div className="bg-emerald-50/90 border border-emerald-300 p-3 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">
                                  ✓ Timbangan Fisik Closing (Sisa Real):
                                </span>
                                <span className="text-base font-black text-emerald-950 font-mono">
                                  {(Number(existingRec.actualClosingStockKg) || 0).toFixed(3)} Kg
                                </span>
                              </div>
                              {existingRec.photoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setZoomedPhotoUrl(existingRec.photoUrl)}
                                  className="w-12 h-12 rounded-lg overflow-hidden border-2 border-emerald-400 shadow-xs hover:opacity-90 cursor-pointer relative group"
                                  title="Klik untuk memperbesar foto HD"
                                >
                                  <img src={existingRec.photoUrl} alt="Foto Closing" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </button>
                              )}
                            </div>

                            <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs">
                              <span className="text-slate-600 font-medium">Susut Jual (Display):</span>
                              <span className="font-mono font-black text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                                {susutJualKg.toFixed(3)} Kg
                              </span>
                            </div>

                            <div className="text-[10px] text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1.5 font-bold">
                              <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Timbangan ini terintegrasi sebagai Stok Awal Sisa Kemarin</span>
                            </div>

                            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-0.5">
                              <span>Oleh: <strong>{existingRec.butcherName || 'Butcher'}</strong></span>
                              <span>
                                {existingRec.timestamp
                                  ? new Date(existingRec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-dashed border-slate-300 p-2.5 rounded-xl flex items-center justify-between text-xs text-slate-500">
                            <span>Sisa Stok Sistem:</span>
                            <strong className="text-blue-900 font-mono font-bold">{stokSistem.toFixed(2)} Kg</strong>
                          </div>
                        )}
                      </div>

                      {/* Action Button at Bottom */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        {isClosed && existingRec ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenWeighModal(prod, rowData)}
                              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                              <span className="truncate">Ubah Closing</span>
                              <Eye className="w-3.5 h-3.5 ml-auto text-emerald-200 shrink-0" />
                            </button>
                            {onDeleteClosingRecord && (
                              <button
                                type="button"
                                onClick={() => handleUndoClosing(existingRec, prod.name)}
                                className="py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 active:scale-95 shrink-0"
                                title="Batalkan / Hapus Input Closing (Undo)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Undo</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenWeighModal(prod, rowData)}
                            className="w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-red-700 hover:bg-red-800 active:scale-95 text-white"
                          >
                            <Scale className="w-4 h-4" />
                            <span>Timbang & Closing Rencana Ini</span>
                            <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            /* MODE 2: DETAILED TABLE REPORT (NON-MEAT REPORT TABLE) */
            <NonMeatReportTable
              category={selectedCategory}
              currentStore={currentStore}
              selectedDate={closingDate}
              closingRecords={records}
              grnRecords={grnRecords}
              adjustments={adjustments}
              onOpenClosingModal={handleOpenWeighModal}
              onExportExcel={() => {
                if (currentStore) {
                  if (selectedCategory === 'KENTANG_SOSIS_DORI') {
                    exportSosisKentangDoriExcel(currentStore, closingDate, records, grnRecords, adjustments);
                  } else {
                    exportPartingAyamExcel(currentStore, closingDate, records, grnRecords, adjustments);
                  }
                }
              }}
            />
          )}
        </div>
      ) : (
        <>
      {/* Parallel Workflow Assurance Banner */}
      <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-emerald-950 flex items-center gap-2">
              <span>Mode Closing Paralel Aktif</span>
              <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-600 text-white rounded-md">
                Bebas Input Tanpa Antre
              </span>
            </h4>
            <p className="text-[11px] text-emerald-900 font-medium mt-0.5">
              Butcher dapat langsung menimbang sisa stok fisik closing dan mengunggah foto timbangan tanpa perlu menunggu Admin selesai input sales. Rekonsiliasi susut jual akan dihitung otomatis saat data sales masuk.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 bg-white px-3 py-2 rounded-xl border border-emerald-200 shrink-0">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Real-time Tersimpan ke Riwayat Harian</span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-900 rounded-xl flex items-center gap-3 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold">{successMsg}</span>
        </div>
      )}

      {/* Undo Toast Notification */}
      {undoToast && (
        <div className="bg-amber-900 text-amber-50 px-4 py-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-lg border border-amber-600 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-300 shrink-0" />
            <div>
              <span>Closing untuk <strong>"{undoToast.planName}"</strong> telah dibatalkan / dihapus (Undo).</span>
              <p className="text-[11px] text-amber-200">Rencana ini kini terbuka kembali untuk diinput timbangan fisik baru.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRestoreClosing}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition shadow-sm shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Kembalikan Data Closing
          </button>
        </div>
      )}

      {/* Grid of Rencana Potong Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allUniquePlans.map((plan) => {
          const existingRec = getRecordForPlan(plan.name, closingDate);

          // Get items for this plan and date
          const todayPlanItems = items.filter(
            (i) => !i.isCarryover && isPlanMatch(i.plannedFabrication, plan.name) &&
            ((i.createdAt || i.thawingStartTime || '').split('T')[0] === closingDate || !(i.createdAt || i.thawingStartTime))
          );
          const carryoverPlanItems = items.filter(
            (i) => i.isCarryover && isPlanMatch(i.plannedFabrication, plan.name) &&
            ((i.createdAt || i.thawingStartTime || '').split('T')[0] === closingDate || !(i.createdAt || i.thawingStartTime))
          );
          const planSegments = segments.filter(
            (s) => isPlanMatch(s.plannedFabrication, plan.name) &&
            ((s.createdAt || s.transferTimestamp || '').split('T')[0] === closingDate || !(s.createdAt || s.transferTimestamp))
          );
          const planAdj = adjustments.filter((a) => isPlanMatch(a.planName, plan.name) &&
            ((a.date || a.createdAt || '').split('T')[0] === closingDate || !(a.date || a.createdAt))
          );
          const adjIn = planAdj.filter((a) => a.type === 'IN').reduce((sum, a) => sum + a.weightKg, 0);
          const adjOut = planAdj.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + a.weightKg, 0);

          const h1Closing = getHMinus1ClosingStock(records || [], currentStore || { id: currentUser.storeId }, plan.name, closingDate);
          const carryoverKg = carryoverPlanItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0);
          const openingKg = carryoverKg || (existingRec && existingRec.openingStockKg !== undefined && existingRec.openingStockKg > 0 ? existingRec.openingStockKg : (h1Closing ?? (existingRec?.openingStockKg || 0)));
          const processedKg = (todayPlanItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing || 0), 0)) || (existingRec ? (Number(existingRec.newProcessedKg) || 0) : 0);
          const totalTersedia = openingKg + processedKg + adjIn - adjOut;

          // Adaptive Sales (recalculates whenever segments change)
          const segmentSales = planSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0);
          const salesKg = segmentSales > 0 ? segmentSales : (existingRec ? (Number(existingRec.salesKg) || 0) : 0);
          const stokSistem = Math.max(0, totalTersedia - salesKg);

          // Susut Jual = (Stok Sistem - Sisa Fisik)
          const existingActual = existingRec ? (Number(existingRec.actualClosingStockKg) || 0) : 0;
          const susutJualKg = existingRec ? Math.max(0, stokSistem - existingActual) : 0;

          return (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                existingRec
                  ? 'border-emerald-400 bg-emerald-50/20 ring-2 ring-emerald-300/70 shadow-sm'
                  : 'border-slate-200 hover:border-red-400'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                      {plan.category}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                      <span>{plan.icon}</span>
                      <span>{plan.name}</span>
                    </h3>
                  </div>

                  {existingRec ? (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[11px] font-black flex items-center gap-1.5 shrink-0 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      Sudah Closing (Terlock)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-[11px] font-bold flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Belum Closing
                    </span>
                  )}
                </div>

                {/* Metrics Breakdown Box */}
                <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Sisa Kemarin</span>
                    <strong className="text-slate-800 font-mono text-xs">{(openingKg || 0).toFixed(2)} Kg</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Diolah Baru</span>
                    <strong className="text-red-700 font-mono text-xs">{(processedKg || 0).toFixed(2)} Kg</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-700 font-bold block">Sales Real</span>
                    <strong className="text-emerald-700 font-mono text-xs">{(salesKg || 0).toFixed(2)} Kg</strong>
                  </div>
                </div>

                {/* Sisa Stok Fisik & Susut Jual Result (when closed) */}
                {existingRec ? (
                  <div className="bg-emerald-50/90 border border-emerald-300 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">
                          ✓ Timbangan Fisik Closing (Sisa Real):
                        </span>
                        <span className="text-base font-black text-emerald-950 font-mono">
                          {(Number(existingRec.actualClosingStockKg) || 0).toFixed(3)} Kg
                        </span>
                      </div>
                      {existingRec.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setZoomedPhotoUrl(existingRec.photoUrl)}
                          className="w-12 h-12 rounded-lg overflow-hidden border-2 border-emerald-400 shadow-xs hover:opacity-90 cursor-pointer relative group"
                          title="Klik untuk memperbesar foto HD"
                        >
                          <img src={existingRec.photoUrl} alt="Foto Closing" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </button>
                      )}
                    </div>

                    <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Susut Jual (Display):</span>
                      <span className="font-mono font-black text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                        {(susutJualKg || 0).toFixed(3)} Kg
                      </span>
                    </div>

                    <div className="text-[10px] text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Timbangan ini terintegrasi sebagai Stok Awal Sisa Kemarin</span>
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center justify-between pt-0.5">
                      <span>Oleh: <strong>{existingRec.butcherName || 'Butcher'}</strong></span>
                      <span>{existingRec.timestamp ? new Date(existingRec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-300 p-2.5 rounded-xl flex items-center justify-between text-xs text-slate-500">
                    <span>Sisa Stok Sistem:</span>
                    <strong className="text-blue-900 font-mono font-bold">{(stokSistem || 0).toFixed(2)} Kg</strong>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                {existingRec ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenLockedDetails(plan, existingRec)}
                      className="flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                      <span className="truncate">Rincian Closing</span>
                      <Eye className="w-3.5 h-3.5 ml-auto text-emerald-200 shrink-0" />
                    </button>
                    {onDeleteClosingRecord && (
                      <button
                        type="button"
                        onClick={() => handleUndoClosing(existingRec, plan.name)}
                        className="py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 active:scale-95 shrink-0"
                        title="Batalkan / Hapus Input Closing (Undo)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Undo</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenClosingModal(plan)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-red-700 hover:bg-red-800 active:scale-95 text-white"
                  >
                    <Scale className="w-4 h-4" />
                    <span>Timbang & Closing Rencana Ini</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recap Table of Recorded Closings */}
      {records.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-red-700" />
              Rekapitulasi Closing Fisik Terkunci Hari Ini ({records.length} Rencana)
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Tersimpan sebagai Susut Jual & Calon Stok Awal Besok
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <th className="p-3">Rencana Potong</th>
                  <th className="p-3 text-right">Sisa Kemarin</th>
                  <th className="p-3 text-right">Diolah Baru</th>
                  <th className="p-3 text-right">Sales Real</th>
                  <th className="p-3 text-right">Stok Sistem</th>
                  <th className="p-3 text-right">Timbangan Fisik (Akhir)</th>
                  <th className="p-3 text-right">Susut Jual (Kg)</th>
                  <th className="p-3 text-center">Foto Bukti</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {records.map((r) => {
                  const matchingPlanObj = allUniquePlans.find((p) => isPlanMatch(p.name, r.planName));
                  const planSegs = segments.filter((s) => isPlanMatch(s.plannedFabrication, r.planName));
                  const segSales = planSegs.reduce((sum, s) => sum + (s.salesKg || 0), 0);
                  const realSales = segSales > 0 ? segSales : (Number(r.salesKg) || 0);
                  const opening = Number(r.openingStockKg) || 0;
                  const processed = Number(r.newProcessedKg) || 0;
                  const actualClosing = Number(r.actualClosingStockKg) || 0;
                  const totalTersedia = opening + processed + (Number(r.adjustInKg) || 0) - (Number(r.adjustOutKg) || 0);
                  const dynamicStokSistem = Math.max(0, totalTersedia - realSales);
                  const dynamicSusut = Math.max(0, dynamicStokSistem - actualClosing);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{matchingPlanObj?.icon || '🥩'}</span>
                        <span>{r.planName}</span>
                      </td>
                      <td className="p-3 text-right font-mono">{opening.toFixed(2)} Kg</td>
                      <td className="p-3 text-right font-mono text-red-700">{processed.toFixed(2)} Kg</td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">{realSales.toFixed(2)} Kg</td>
                      <td className="p-3 text-right font-mono text-blue-800 font-semibold">{dynamicStokSistem.toFixed(2)} Kg</td>
                      <td className="p-3 text-right font-mono font-black text-emerald-950 bg-emerald-50/40">
                        {actualClosing.toFixed(3)} Kg
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-700">
                        {dynamicSusut.toFixed(3)} Kg
                      </td>
                      <td className="p-3 text-center">
                        {r.photoUrl ? (
                          <button
                            type="button"
                            onClick={() => setZoomedPhotoUrl(r.photoUrl)}
                            className="inline-block w-8 h-8 rounded-lg overflow-hidden border border-slate-300 hover:scale-105 transition shadow-2xs cursor-pointer"
                            title="Klik perbesar foto"
                          >
                            <img src={r.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center justify-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-700" /> Terlock
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ACTIVE CLOSING INPUT MODAL (FOR UNLOCKED PLANS) --- */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800">
                  Input Closing Fisik Butcher
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                  <span>{selectedPlan.icon}</span>
                  <span>{selectedPlan.name}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-xl flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitClosing} className="space-y-4">
              {/* Instructions */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Petunjuk Butcher:</strong>
                  Timbang seluruh sisa daging untuk rencana &quot;{selectedPlan.name}&quot; di chiller/display, lalu upload foto timbangan fisik real sebagai bukti wajib. Setelah disimpan, data akan <strong>terkunci</strong> sebagai susut jual.
                </div>
              </div>

              {/* Live Calculation Preview Card */}
              {(() => {
                const safeSelName = (selectedPlan.name || '').toLowerCase();
                const selectedPlanTodayItems = items.filter(i => !i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(safeSelName));
                const selectedPlanCarryoverItems = items.filter(i => i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(safeSelName));
                const selectedPlanSegments = segments.filter(s => (s.plannedFabrication || '').toLowerCase().includes(safeSelName));
                const selectedPlanAdj = adjustments.filter(a => (a.planName || '').toLowerCase().includes(safeSelName));

                const modalPrevDate = getPreviousDateStr(closingDate);
                const modalH1Closing = getHMinus1ClosingStock(records || [], currentStore || { id: currentUser.storeId }, selectedPlan.name, closingDate);
                const modalCarryoverKg = selectedPlanCarryoverItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
                const modalOpening = modalCarryoverKg || (modalH1Closing ?? 0);
                const modalProcessed = selectedPlanTodayItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);
                const modalAdjIn = selectedPlanAdj.filter(a => a.type === 'IN').reduce((sum, a) => sum + a.weightKg, 0);
                const modalAdjOut = selectedPlanAdj.filter(a => a.type === 'OUT').reduce((sum, a) => sum + a.weightKg, 0);
                const modalTotalTersedia = modalOpening + modalProcessed + modalAdjIn - modalAdjOut;
                const modalSales = selectedPlanSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0);
                const modalStokSistem = Math.max(0, modalTotalTersedia - modalSales);
                
                // Comma-safe parse
                const modalInputWeight = parseSafeFloat(physicalWeight);
                const modalLiveSusut = physicalWeight ? Math.max(0, modalStokSistem - modalInputWeight) : 0;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                      <span>Perhitungan Stok Sistem:</span>
                      <span className="text-blue-900 font-mono font-black">{modalStokSistem.toFixed(3)} Kg</span>
                    </div>

                    {/* H-1 Source Status Banner */}
                    <div className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                      modalH1Closing !== null
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}>
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {modalH1Closing !== null
                          ? `✓ Sisa kemarin terhitung otomatis dari closing H-1 (${modalPrevDate}): ${modalH1Closing.toFixed(3)} Kg`
                          : `Data H-1 (${modalPrevDate}) belum ada closing (0.000 Kg). Terisolasi per hari.`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Sisa Kemarin (H-1):</span>
                        <strong className="text-amber-700 font-mono">{modalOpening.toFixed(3)} Kg</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Diolah Baru:</span>
                        <strong className="text-red-700 font-mono">{modalProcessed.toFixed(3)} Kg</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Total Tersedia:</span>
                        <strong className="text-slate-800 font-mono">{modalTotalTersedia.toFixed(3)} Kg</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Sales (Jual):</span>
                        <strong className="text-emerald-700 font-mono">{modalSales.toFixed(3)} Kg</strong>
                      </div>
                    </div>

                    {physicalWeight && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-red-900 font-bold text-[11px]">
                          Nilai Susut Otomatis (Sistem - Fisik):
                        </span>
                        <span className="font-mono font-black text-sm text-red-700">
                          {modalLiveSusut.toFixed(3)} Kg
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Timbangan Sisa Stok Fisik (Supports comma & dot) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Timbangan Sisa Stok Fisik Akhir (Kg) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    placeholder="Contoh: 19.450 atau 0,5"
                    value={physicalWeight}
                    onChange={(e) => setPhysicalWeight(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-red-600 rounded-xl focus:bg-white focus:outline-hidden text-slate-900 text-lg font-black"
                    required
                  />
                  <span className="absolute right-4 top-3 text-slate-400 font-bold text-lg">Kg</span>
                </div>
              </div>

              {/* MANDATORY PHOTO UPLOAD */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-red-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-red-600" />
                    Foto Timbangan Fisik Real (Wajib / MANDATORY) *
                  </label>
                  <span className="text-[10px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded-md border border-red-300">
                    Mandatory
                  </span>
                </div>

                <div className="border-2 border-dashed border-red-300 bg-red-50/40 hover:bg-red-50 rounded-2xl p-4 text-center cursor-pointer transition relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isOptimizingPhoto}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {isOptimizingPhoto ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                      <p className="text-xs font-bold text-red-900">Memproses resolusi tinggi foto timbangan...</p>
                    </div>
                  ) : closingPhoto ? (
                    <div className="space-y-2">
                      <img
                        src={closingPhoto}
                        alt="Bukti Foto Closing"
                        className="h-28 w-auto mx-auto object-cover rounded-xl shadow-sm border border-red-300"
                      />
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Foto Resolusi HD Siap (Ketuk untuk ganti)
                      </span>
                    </div>
                  ) : (
                    <div className="py-3 space-y-1">
                      <Upload className="w-8 h-8 text-red-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-red-950">
                        Ketuk untuk Ambil Foto Kamera / Unggah File (High-Res)
                      </p>
                      <p className="text-[10px] text-red-700">
                        Foto angka display timbangan atau kondisi sisa daging
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Catatan Butcher */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Catatan Butcher (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Daging sudah diwrap rapi dan disimpan di chiller 2"
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-red-700 hover:bg-red-800 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan & Kunci Closing</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- LOCKED DETAILS READ-ONLY MODAL --- */}
      {viewLockedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-700" />
                  Status Terlock (Sudah Closing)
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                  <span>{viewLockedPlan.plan.icon}</span>
                  <span>{viewLockedPlan.plan.name}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewLockedPlan(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lock Notice Banner */}
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3.5 text-xs text-emerald-950 flex items-start gap-2.5 shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Data Closing Terkunci Permanen:</strong>
                Data timbangan fisik untuk rencana ini telah terkunci dan tersimpan sebagai <strong>Susut Jual</strong>. Data tidak dapat diinput ulang hingga tombol <em>Refresh Closing Harian</em> dijalankan untuk pembukaan stok besok.
              </div>
            </div>

            {/* Detailed Numerical Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-3">
                <div>
                  <span className="text-slate-400 text-[10px] block font-semibold">Sisa Kemarin (Stok Awal):</span>
                  <strong className="text-slate-800 font-mono text-sm">{(viewLockedPlan.openingKg || 0).toFixed(3)} Kg</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-semibold">Diolah Baru Hari Ini:</span>
                  <strong className="text-red-700 font-mono text-sm">{(viewLockedPlan.processedKg || 0).toFixed(3)} Kg</strong>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Total Tersedia:</span>
                  <strong className="text-slate-800 font-mono">{(viewLockedPlan.totalTersedia || 0).toFixed(3)} Kg</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Realisasi Sales:</span>
                  <strong className="text-emerald-700 font-mono">{(viewLockedPlan.currentSales || 0).toFixed(3)} Kg</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Sisa Stok Sistem:</span>
                  <strong className="text-blue-700 font-mono">{(viewLockedPlan.stokSistem || 0).toFixed(3)} Kg</strong>
                </div>
              </div>

              <div className="bg-emerald-100/70 border border-emerald-300 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 font-bold block">Timbangan Sisa Fisik Akhir:</span>
                  <span className="text-base font-black text-emerald-950 font-mono">
                    {(Number(viewLockedPlan.record.actualClosingStockKg) || 0).toFixed(3)} Kg
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-amber-800 font-bold block">Susut Jual (Display):</span>
                  <span className="text-base font-black text-amber-900 font-mono">
                    {(Number(viewLockedPlan.susutJual) || 0).toFixed(3)} Kg
                  </span>
                </div>
              </div>
            </div>

            {/* Photo Preview in Full Quality */}
            {viewLockedPlan.record.photoUrl && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Foto Bukti Timbangan Fisik HD:
                </label>
                <div
                  onClick={() => setZoomedPhotoUrl(viewLockedPlan.record.photoUrl)}
                  className="rounded-2xl overflow-hidden border-2 border-slate-200 cursor-pointer shadow-xs hover:opacity-95 transition relative group"
                >
                  <img
                    src={viewLockedPlan.record.photoUrl}
                    alt="Bukti Foto Closing"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold gap-1.5 transition">
                    <Eye className="w-4 h-4" /> Ketuk untuk Perbesar Layar Penuh
                  </div>
                </div>
              </div>
            )}

            {viewLockedPlan.record.note && (
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700">
                <span className="font-bold block text-slate-500 text-[10px]">Catatan Butcher:</span>
                <p className="mt-0.5">{viewLockedPlan.record.note}</p>
              </div>
            )}

            <div className="text-[11px] text-slate-400 text-right">
              Dicatat oleh: <strong>{viewLockedPlan.record.butcherName}</strong> pada {viewLockedPlan.record.timestamp ? new Date(viewLockedPlan.record.timestamp).toLocaleTimeString('id-ID') : '-'}
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  const p = viewLockedPlan.plan;
                  const r = viewLockedPlan.record;
                  setViewLockedPlan(null);
                  handleOpenClosingModal(p, r);
                }}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
              >
                <Scale className="w-4 h-4" />
                <span>Koreksi / Update</span>
              </button>
              {onDeleteClosingRecord && (
                <button
                  type="button"
                  onClick={() => handleUndoClosing(viewLockedPlan.record, viewLockedPlan.plan.name)}
                  className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                  title="Batalkan / Hapus Data Closing (Undo)"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus (Undo)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewLockedPlan(null)}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DAILY REFRESH / CARRYOVER MODAL --- */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">
                Refresh Closing Harian & Buka Hari Baru?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tindakan ini akan mengunci operasional hari ini dan secara otomatis memindahkan <strong>timbangan sisa stok fisik closing</strong> menjadi <strong>Stok Awal (Sisa Kemarin)</strong> untuk operasional hari besok.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-xs space-y-1.5 text-slate-700">
              <div className="font-bold text-slate-900 flex items-center justify-between">
                <span>Rencana yang sudah diclosing:</span>
                <span className="text-emerald-700 font-mono font-black">{records.length} Item</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Antrian input closing akan di-refresh bersih untuk hari baru dengan sisa fisik kemarin sebagai opening balance.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetAndCarryover}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ya, Refresh & Buka Hari Baru</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PHOTO ZOOM MODAL --- */}
      {zoomedPhotoUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomedPhotoUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setZoomedPhotoUrl(null)}
              className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full hover:bg-black cursor-pointer z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={zoomedPhotoUrl}
              alt="Bukti Foto Timbangan HD"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border-2 border-white/20"
            />
            <p className="text-xs font-semibold text-slate-300 mt-2 text-center">
              Foto Bukti Resolusi Tinggi (High-Res) • Ketuk di mana saja untuk menutup
            </p>
          </div>
        </div>
      )}
        </>
      )}

      {/* MODAL CLOSING NON-MEAT (Timbang Fisik / Produk Tidak Dibuka) */}
      {activeNonMeatModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-5 text-white flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl">
                  <Scale className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-white">
                    Timbang Sisa Fisik Malam
                  </span>
                  <h3 className="text-lg font-black mt-0.5">
                    {activeNonMeatModal.product.name}
                  </h3>
                  <span className="text-xs text-white/80 font-mono">
                    Kode: {activeNonMeatModal.product.itemCode}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveNonMeatModal(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSaveNonMeatClosing} className="p-6 space-y-4">
              {nonMeatError && (
                <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{nonMeatError}</span>
                </div>
              )}

              {/* Info Card */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block">Stok Awal</span>
                  <strong className="text-slate-800 font-mono text-sm">
                    {activeNonMeatModal.rowData.openingStockKg.toFixed(3)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block">GRN + Adj</span>
                  <strong className="text-slate-800 font-mono text-sm">
                    {(activeNonMeatModal.rowData.grnKg + activeNonMeatModal.rowData.netAdj).toFixed(3)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block">Stok Sistem</span>
                  <strong className="text-emerald-700 font-mono text-sm">
                    {activeNonMeatModal.rowData.stockBySistem.toFixed(3)} Kg
                  </strong>
                </div>
              </div>

              {activeNonMeatModal.product.category === 'PARTING_AYAM' || selectedCategory === 'PARTING_AYAM' ? (
                /* PARTING AYAM SPECIFIC WEIGHING INPUTS & DYNAMIC PREVIEW */
                <div className="space-y-3.5">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs">
                    <span className="font-black text-emerald-950 block mb-1">
                      🍗 Input Parameter Parting Ayam Fresh:
                    </span>
                    <p className="text-[11px] text-emerald-900 leading-snug">
                      Masukkan data <strong>Tally Label</strong>, <strong>Bruto</strong>, dan <strong>Netto</strong> timbangan. Nilai Susut, Cost Real, dan Gross Profit (GP) akan terkalkulasi seketika.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Tally Label */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        Tally Label (Kg) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={partingTallyKg}
                        onChange={(e) => setPartingTallyKg(e.target.value)}
                        placeholder="Contoh: 31.850"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                      />
                    </div>

                    {/* Bruto */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        Bruto (Kg)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={partingBrutoKg}
                        onChange={(e) => setPartingBrutoKg(e.target.value)}
                        placeholder="Contoh: 31.850"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                      />
                    </div>

                    {/* Netto */}
                    <div>
                      <label className="block text-[11px] font-black text-emerald-800 mb-1">
                        Netto (Kg) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        required
                        value={partingNettoKg}
                        onChange={(e) => {
                          setPartingNettoKg(e.target.value);
                          setNonMeatWeighedKg(e.target.value);
                        }}
                        placeholder="Contoh: 30.850"
                        className="w-full px-3 py-2 bg-emerald-50/50 border-2 border-emerald-500 rounded-xl text-xs font-black text-emerald-950 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Cost COGS */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        Cost COGS (Rp / Kg)
                      </label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={partingCostPerKg}
                        onChange={(e) => setPartingCostPerKg(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                      />
                    </div>

                    {/* Sale Price */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        Harga Jual / Sale (Rp / Kg)
                      </label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={partingSalePerKg}
                        onChange={(e) => setPartingSalePerKg(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                      />
                    </div>
                  </div>

                  {/* Live Formula Preview Card */}
                  {(() => {
                    const t = parseFloat(partingTallyKg) || 0;
                    const b = parseFloat(partingBrutoKg) || 0;
                    const n = parseFloat(partingNettoKg) || 0;
                    const c = parseFloat(partingCostPerKg) || 0;
                    const s = parseFloat(partingSalePerKg) || 0;

                    const beratSusut = t > 0 ? Math.max(0, t - n) : 0;
                    const valReal = t * c;
                    const valProc = n * c;
                    const costReal = n > 0 ? valReal / n : 0;
                    const susutPct = t > 0 ? ((t - n) / t) * 100 : 0;
                    const susutReal = Math.max(0, b - n);
                    const gp = s > 0 && costReal > 0 ? ((s - costReal) / s) * 100 : 0;

                    return (
                      <div className="p-3 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Hasil Kalkulasi Formula:</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${gp < 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-slate-950'}`}>
                            GP: {gp.toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div className="bg-slate-800/80 p-1.5 rounded-lg">
                            <span className="text-slate-400 block">Berat Susut</span>
                            <strong className="text-rose-300 font-mono text-xs">{beratSusut.toFixed(3)} Kg</strong>
                          </div>
                          <div className="bg-slate-800/80 p-1.5 rounded-lg">
                            <span className="text-slate-400 block">Cost Real</span>
                            <strong className="text-blue-300 font-mono text-xs">Rp {Math.round(costReal).toLocaleString('id-ID')}</strong>
                          </div>
                          <div className="bg-slate-800/80 p-1.5 rounded-lg">
                            <span className="text-slate-400 block">% Susut</span>
                            <strong className="text-amber-300 font-mono text-xs">{susutPct.toFixed(2)}%</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700">
                    Hasil Timbangan Sisa Fisik Nyata (Kg) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      required
                      value={nonMeatWeighedKg}
                      onChange={(e) => setNonMeatWeighedKg(e.target.value)}
                      placeholder="Contoh: 12.450"
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                    <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">Kg</span>
                  </div>
                  {nonMeatWeighedKg && !isNaN(parseFloat(nonMeatWeighedKg)) && (
                    <div className="flex items-center justify-between text-xs px-2 pt-1">
                      <span className="text-slate-500 font-medium">Kalkulasi Susut Jual:</span>
                      <strong className={`font-mono ${
                        activeNonMeatModal.rowData.stockBySistem - parseFloat(nonMeatWeighedKg) > 0.01
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        {Math.max(0, activeNonMeatModal.rowData.stockBySistem - parseFloat(nonMeatWeighedKg)).toFixed(3)} Kg
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Mandatory Photo Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-800">
                  Foto Timbangan Fisik Real (Wajib untuk Verifikasi Sistem) <span className="text-red-500">*</span>
                </label>

                {nonMeatPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 max-h-48 bg-slate-950 flex items-center justify-center">
                    <img
                      src={nonMeatPhoto}
                      alt="Foto Closing"
                      className="max-h-48 w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setNonMeatPhoto('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer shadow-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                    isCompressingNonMeatPhoto
                      ? 'bg-slate-100 border-slate-300 pointer-events-none'
                      : 'border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50'
                  }`}>
                    {isCompressingNonMeatPhoto ? (
                      <>
                        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                        <span className="text-xs font-bold text-slate-600">Mengompres foto HD...</span>
                      </>
                    ) : (
                      <>
                        <div className="p-2.5 bg-white rounded-full shadow-xs border border-slate-200">
                          <Camera className="w-6 h-6 text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Ambil Foto Kamera / Unggah Bukti</span>
                        <span className="text-[10px] text-slate-400">Format JPEG/PNG otomatis dioptimalkan</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleNonMeatPhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Note input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600">Catatan Closing (Opsional)</label>
                <input
                  type="text"
                  value={nonMeatNote}
                  onChange={(e) => setNonMeatNote(e.target.value)}
                  placeholder="Contoh: 1 nampan display chiller"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveNonMeatModal(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={!nonMeatPhoto || isCompressingNonMeatPhoto}
                  className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition ${
                    !nonMeatPhoto || isCompressingNonMeatPhoto
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Closing Fisik Malam</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WINDOW / MODAL UNTUK MENAMPILKAN DATA TERSIMPAN */}
      {currentStore && (
        <SavedDataViewerModal
          isOpen={isSavedDataModalOpen}
          onClose={() => setIsSavedDataModalOpen(false)}
          currentStore={currentStore}
          currentUser={currentUser}
          closingRecords={records}
          items={items}
          initialDate={closingDate}
          onEditClosingRecord={(rec) => {
            setIsSavedDataModalOpen(false);
            if (rec.date) setClosingDate(rec.date.split('T')[0]);
            const targetPlanObj = allUniquePlans.find((p) => isPlanMatch(p.name, rec.planName)) || {
              name: rec.planName,
              category: rec.category || 'DAGING FRESH',
              icon: '🥩',
            };
            handleOpenClosingModal(targetPlanObj, rec);
          }}
          onDeleteClosingRecord={(id) => {
            const targetRec = records.find((r) => r.id === id);
            if (targetRec) {
              handleUndoClosing(targetRec, targetRec.planName);
            }
          }}
        />
      )}
    </div>
  );
}
