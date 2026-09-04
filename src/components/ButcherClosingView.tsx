import React, { useState } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  StockAdjustment,
  UserAccount,
  Store
} from '../types';
import { processHighResImage, ensureCloudSafeImage } from '../utils/imageCompressor';
import { isMatchPlan } from '../utils/storeHelper';
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
  Building2
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
  onSaveClosingRecord: (record: Omit<ClosingPlanRecord, 'id' | 'timestamp'> & { id?: string }) => void;
  onDailyResetAndCarryover?: () => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
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
  onDailyResetAndCarryover,
  onManualSync,
  isSyncing = false,
  lastSyncTime = null,
}: ButcherClosingViewProps) {
  const records = existingClosingRecords ?? closingRecords ?? [];
  
  // Helper for matching plan name
  const isPlanMatch = (a?: string, b?: string) => isMatchPlan(a, b);

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
    const existingRec = existingRecordToEdit || records.find((r) => isPlanMatch(r.planName, planObj.name));

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

    const openingKg = (carryoverPlanItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0)) || (typeof record.openingStockKg === 'number' ? record.openingStockKg : 0);
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

    const existingRec = records.find((r) => isPlanMatch(r.planName, selectedPlan.name));
    const openingStockKg = (carryoverPlanItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0)) || (existingRec ? (Number(existingRec.openingStockKg) || 0) : 0);
    const newProcessedKg = (todayPlanItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0)) || (existingRec ? (Number(existingRec.newProcessedKg) || 0) : 0);
    const itemSales = todayPlanItems.concat(carryoverPlanItems).reduce((sum, i) => sum + (i.salesKg || 0), 0);
    const calculatedSales = Math.max(segmentSales, itemSales, (existingRec ? (Number(existingRec.salesKg) || 0) : 0));
    const totalTersedia = openingStockKg + newProcessedKg + adjIn - adjOut;
    const closingBySystem = Math.max(0, totalTersedia - calculatedSales);
    const susutJualKg = Math.max(0, closingBySystem - actualStock);

    const effectiveStoreId = currentStore?.id || currentUser.storeId || '1';

    // Sanitize note
    const sanitizedNote = closingNote.replace(/[<>]/g, '').trim();

    // Ensure photo size is safe for cloud sync
    let safePhoto = closingPhoto;
    if (closingPhoto && closingPhoto.length > 35000) {
      safePhoto = await ensureCloudSafeImage(closingPhoto, 35000);
    }

    onSaveClosingRecord({
      id: existingRec?.id,
      storeId: effectiveStoreId,
      date: existingRec?.date || new Date().toISOString().split('T')[0],
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
    });

    setSuccessMsg(`✓ Status rencana "${selectedPlan.name}" kini SUDAH CLOSING (Terlock). Timbangan fisik ${actualStock.toFixed(3)} Kg disimpan & terintegrasi sebagai calon Stok Awal besok!`);
    setTimeout(() => setSuccessMsg(''), 6000);
    setSelectedPlan(null);
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

  const closedCount = allUniquePlans.filter((p) => records.some((r) => isPlanMatch(r.planName, p.name))).length;
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
      <div className="bg-gradient-to-r from-red-900 via-red-800 to-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-700/80 text-red-100 border border-red-500/30">
              Menu Closing Butcher
            </span>
            <span className="text-xs text-red-200 font-semibold">
              {currentStore?.name || 'TDN Cikarang Utara'}
            </span>
            <span className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
              Role: <strong className="text-white uppercase">{currentUser.role}</strong> ({currentUser.fullName || currentUser.username})
            </span>
          </div>
          <h1 className="text-2xl font-black mt-1 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-red-300" />
            Closing Fisik Per Rencana Potong
          </h1>
          <p className="text-xs text-red-200 mt-1">
            Timbang sisa fisik di chiller/display. Data tersinkron otomatis secara real-time ke akun Butcher, Admin Toko, dan MD. Sisa fisiknya terintegrasi sebagai <strong>Stok Awal (Sisa Kemarin)</strong> hari berikutnya.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Cloud Synchronization Button */}
          {onManualSync && (
            <button
              type="button"
              onClick={onManualSync}
              disabled={isSyncing}
              className={`px-3.5 py-3 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer border shadow-xs ${
                isSyncing
                  ? 'bg-blue-950/80 border-blue-500 text-blue-200 cursor-wait'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-white border-slate-700 active:scale-95'
              }`}
              title="Sinkronkan & tarik closing terbaru langsung dari Cloud / Google Spreadsheet"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
              <span>{isSyncing ? 'Sinkronisasi Cloud...' : 'Sinkronkan Cloud'}</span>
            </button>
          )}

          <div className={`p-3 rounded-xl flex items-center gap-3 border ${
            isAllClosed
              ? 'bg-emerald-950/90 border-emerald-600 text-emerald-100 shadow-sm'
              : 'bg-red-950/70 border-red-700/60'
          }`}>
            <div className={`p-1.5 rounded-lg ${isAllClosed ? 'bg-emerald-700 text-white' : 'bg-red-800 text-red-200'}`}>
              {isAllClosed ? <CheckCircle2 className="w-4 h-4 text-emerald-200" /> : <Camera className="w-4 h-4 animate-pulse" />}
            </div>
            <div className="text-xs">
              <span className="text-slate-300 block font-medium">Status Closing:</span>
              <strong className={`font-bold ${isAllClosed ? 'text-emerald-300' : 'text-white'}`}>
                {closedCount} dari {allUniquePlans.length} Selesai {isAllClosed ? '✓ (Lengkap)' : ''}
              </strong>
            </div>
          </div>

          {onDailyResetAndCarryover && (
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-extrabold px-3.5 py-3 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer border border-amber-400/40"
              title="Tutup siklus operasional hari ini dan integrasikan sisa fisik timbangan menjadi Stok Awal (Sisa Kemarin) hari besok"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Closing Harian (Carryover)</span>
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-900 rounded-xl flex items-center gap-3 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold">{successMsg}</span>
        </div>
      )}

      {/* Grid of Rencana Potong Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allUniquePlans.map((plan) => {
          const existingRec = records.find((r) => isPlanMatch(r.planName, plan.name));

          // Get items for this plan
          const todayPlanItems = items.filter(
            (i) => !i.isCarryover && isPlanMatch(i.plannedFabrication, plan.name)
          );
          const carryoverPlanItems = items.filter(
            (i) => i.isCarryover && isPlanMatch(i.plannedFabrication, plan.name)
          );
          const planSegments = segments.filter(
            (s) => isPlanMatch(s.plannedFabrication, plan.name)
          );
          const planAdj = adjustments.filter((a) => isPlanMatch(a.planName, plan.name));
          const adjIn = planAdj.filter((a) => a.type === 'IN').reduce((sum, a) => sum + a.weightKg, 0);
          const adjOut = planAdj.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + a.weightKg, 0);

          const openingKg = (carryoverPlanItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0)) || (existingRec ? (Number(existingRec.openingStockKg) || 0) : 0);
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
                  <button
                    type="button"
                    onClick={() => handleOpenLockedDetails(plan, existingRec)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Sudah Closing (Lihat Rincian / Koreksi)</span>
                    <Eye className="w-3.5 h-3.5 ml-auto text-emerald-200" />
                  </button>
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

                const modalOpening = selectedPlanCarryoverItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
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
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                      <span>Perhitungan Stok Sistem:</span>
                      <span className="text-blue-900 font-mono font-black">{modalStokSistem.toFixed(3)} Kg</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400 block">Tersedia:</span>
                        <strong className="text-slate-700 font-mono">{modalTotalTersedia.toFixed(3)} Kg</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Sales (Jual):</span>
                        <strong className="text-emerald-700 font-mono">{modalSales.toFixed(3)} Kg</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Stok Sistem:</span>
                        <strong className="text-blue-700 font-mono">{modalStokSistem.toFixed(3)} Kg</strong>
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

            <div className="flex gap-3 pt-2">
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
                <span>Koreksi / Update Timbangan</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLockedPlan(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Tutup Rincian
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
    </div>
  );
}
