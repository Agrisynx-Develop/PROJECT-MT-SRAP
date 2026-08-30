import React, { useState, useEffect } from 'react';
import { ThawingItem, FabricationSegment, Store } from '../types';
import { predictDailySales } from '../utils/mlPrediction';
import { processHighResImage } from '../utils/imageCompressor';
import {
  calculateTotalShrinkage,
  aggregateShrinkageByPabrikasi,
  aggregateShrinkageByRencanaPotong,
  DEFAULT_PABRIKASI_CATEGORIES,
  DEFAULT_NAMA_BAHAN_LIST,
} from '../utils/shrinkage';
import {
  Plus,
  TrendingUp,
  Scale,
  Clipboard,
  Upload,
  Clock,
  AlertTriangle,
  Target,
  ChevronRight,
  PackageCheck,
  Edit2,
  X,
  CheckCircle2,
  Layers,
  Beef,
  Flame,
  Sparkles,
  Cpu,
  Check,
  FolderPlus,
  Calculator,
  RefreshCw,
  Info,
  Trash2,
  ShoppingBag,
  Store as StoreIcon,
  ArrowRightLeft,
} from 'lucide-react';

interface DashboardProps {
  items: ThawingItem[];
  segments: FabricationSegment[];
  currentStore?: Store;
  onAddItem: (newItem: Omit<ThawingItem, 'id' | 'status' | 'thawingStartTime' | 'createdAt' | 'butcherId' | 'butcherName'>) => void;
  onUpdateItem?: (updatedItem: ThawingItem) => void;
  onDeleteItem?: (itemIdOrIds: string | string[]) => void;
  safeThawingLossPercent: number;
  safeFabricationLossPercent: number;
  salesPredictionKg: number;
  onUpdateSalesPrediction: (newTargetKg: number) => void;
  onTransferPurpose?: (
    id: string,
    isSegment: boolean,
    targetPurpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY',
    transferWeightKg?: number
  ) => void;
  onOpenTransferModal?: () => void;
  onOpenEditPlanModal?: (itemId?: string) => void;
  isButcherView?: boolean;
}

// Default template list matching user requested items
const COMMON_MEATS = [
  { name: 'HQ 41/42/44/45', category: 'DAGING FRESH', plan: 'DAGING RENDANG PREMIUM', icon: '🥩' },
  { name: 'DG RNDG BEKU 1kg', category: 'DAGING FRESH', plan: 'RENDANG POT FRESH', icon: '🥩' },
  { name: 'DAGING KHUSUS', category: 'DAGING FRESH', plan: 'RENDANG SHANKLE', icon: '🥩' },
  { name: 'DG Prem 2', category: 'DAGING PREMIUM', plan: 'DAGING RENDANG PREMIUM', icon: '🍖' },
  { name: 'FRIBOY', category: 'DAGING PREMIUM', plan: 'DAGING RENDANG PREMIUM', icon: '🍖' },
  { name: 'FQ 106/105/18/16', category: 'RAWON FRESH', plan: 'RAWON', icon: '🥘' },
  { name: 'RAWON FRESH 2', category: 'RAWON FRESH', plan: 'RAWON', icon: '🥘' },
  { name: 'FQ 60 /SHANK', category: 'DAGING FRESH', plan: 'RENDANG SHANKLE', icon: '🥩' },
];

export default function Dashboard({
  items,
  segments,
  currentStore,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  safeThawingLossPercent,
  safeFabricationLossPercent,
  salesPredictionKg,
  onUpdateSalesPrediction,
  onTransferPurpose,
  onOpenTransferModal,
  onOpenEditPlanModal,
  isButcherView = false,
}: DashboardProps) {
  // Real-time Clock State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Dynamic store & Todanus name
  const cleanStoreName = currentStore?.name ? String(currentStore.name).replace(/^TDN\s*/i, '').trim() : 'CIKUT';
  const todanusDisplay = `TODANUS ${cleanStoreName.toUpperCase()}`;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Machine Learning Sales Prediction automatically based on target date & historical items
  const mlPrediction = predictDailySales(currentTime, items);

  // Custom Categories state
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const stored = localStorage.getItem('pabrikasi_custom_categories');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((c: string) => c && !['DAGING PRESH', 'D.R. FRESH MEMBER', 'DR FRESH MEMBER'].includes(c.toUpperCase()));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_PABRIKASI_CATEGORIES;
  });

  // Save custom categories to local storage whenever changed
  useEffect(() => {
    localStorage.setItem('pabrikasi_custom_categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // Form State for Adding Meat (Simplified as requested)
  const [name, setName] = useState('');
  const [category, setCategory] = useState('DAGING FRESH');
  const [weightBefore, setWeightBefore] = useState('');
  const [plan, setPlan] = useState('DAGING RENDANG PREMIUM');
  const [openingPurpose, setOpeningPurpose] = useState<'UNTUK PESANAN' | 'UNTUK DISPLAY'>('UNTUK DISPLAY');
  const [image, setImage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals State
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [isIssuedModalOpen, setIsIssuedModalOpen] = useState(false);
  const [isShrinkageModalOpen, setIsShrinkageModalOpen] = useState(false);
  const [targetInput, setTargetInput] = useState(String(salesPredictionKg || 40));

  // State for Add Category / Add Material in Modal
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddMaterialInput, setShowAddMaterialInput] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState('DAGING FRESH');
  const [newMatPlan, setNewMatPlan] = useState('DAGING RENDANG PREMIUM');
  const [newMatOpeningPurpose, setNewMatOpeningPurpose] = useState<'UNTUK PESANAN' | 'UNTUK DISPLAY'>('UNTUK DISPLAY');
  const [newMatBahanAwal, setNewMatBahanAwal] = useState('');
  const [newMatSetelahThaw, setNewMatSetelahThaw] = useState('');
  const [newMatSusutJual, setNewMatSusutJual] = useState('');

  // Custom Fabrication Plans State (persisted in localStorage)
  const [customPlans, setCustomPlans] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('butcher_custom_plans');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State for adding custom plans inline
  const [showAddPlanInput, setShowAddPlanInput] = useState(false);
  const [showManagePlans, setShowManagePlans] = useState(false);
  const [newPlanInput, setNewPlanInput] = useState('');
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [newPlanInputModal, setNewPlanInputModal] = useState('');

  // Editing Item inside Modal state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSusutJual, setEditSusutJual] = useState('');
  const [editHasilThaw, setEditHasilThaw] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editOpeningPurpose, setEditOpeningPurpose] = useState<'UNTUK PESANAN' | 'UNTUK DISPLAY'>('UNTUK DISPLAY');

  // List of available fabrication plans (dynamic + default + custom)
  const availablePlans = Array.from(
    new Set([
      'DAGING RENDANG PREMIUM',
      'RENDANG POT FRESH',
      'RAWON',
      'RENDANG SHANKLE',
      ...(Array.isArray(customPlans) ? customPlans.map((p) => String(p || '').trim().toUpperCase()) : []),
      ...items.map((i) => String(i.plannedFabrication || '').trim().toUpperCase()).filter(Boolean),
    ])
  ).filter(Boolean);

  // Helper to save a new custom plan
  const handleSaveNewCustomPlan = (planName: string, selectTarget: 'main' | 'modal') => {
    const trimmed = planName.trim().toUpperCase();
    if (!trimmed) return;

    if (!customPlans.includes(trimmed)) {
      const updated = [...customPlans, trimmed];
      setCustomPlans(updated);
      try {
        localStorage.setItem('butcher_custom_plans', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save custom plan:', e);
      }
    }

    if (selectTarget === 'main') {
      setPlan(trimmed);
      setNewPlanInput('');
      setShowAddPlanInput(false);
    } else {
      setNewMatPlan(trimmed);
      setNewPlanInputModal('');
      setShowAddPlanModal(false);
    }
  };

  // Helper to remove a custom plan
  const handleRemoveCustomPlan = (planToRemove: string) => {
    const updated = customPlans.filter((p) => p !== planToRemove);
    setCustomPlans(updated);
    try {
      localStorage.setItem('butcher_custom_plans', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update custom plans:', e);
    }
  };

  // Sync targetInput when salesPredictionKg prop changes
  useEffect(() => {
    setTargetInput(String(salesPredictionKg || 40));
  }, [salesPredictionKg]);

  // Handle template click
  const applyTemplate = (meat: { name: string; category: string; plan: string }) => {
    setName(meat.name);
    setCategory(meat.category);
  };

  // Image upload handler with High-Resolution processing
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadProgress(true);
      try {
        const optimized = await processHighResImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
        });
        setImage(optimized);
      } catch (err) {
        console.error('Error optimizing image:', err);
      } finally {
        setUploadProgress(false);
      }
    }
  };

  // Submit new meat entry (Simplified)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama bahan tidak boleh kosong!');
      return;
    }
    const parsedWeight = parseFloat(weightBefore);
    const weight = isNaN(parsedWeight) || parsedWeight < 0 ? 0 : parsedWeight;

    if (weight <= 0) {
      setErrorMsg('Harap masukkan berat bahan awal yang valid!');
      return;
    }

    onAddItem({
      name: name.trim(),
      pabrikasiCategory: category,
      weightBeforeThawing: weight,
      weightAfterThawing: weight,
      susutJualKg: 0,
      plannedFabrication: 'PENDING',
      openingPurpose: 'UNTUK DISPLAY',
      image: 'placeholder',
    });

    // Reset Form
    setName('');
    setCategory('DAGING FRESH');
    setWeightBefore('');
    setErrorMsg('');
    setSuccessMsg('Bahan berhasil dimasukkan ke daftar Thawing!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSaveSalesTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(targetInput);
    if (!isNaN(val) && val > 0) {
      onUpdateSalesPrediction(val);
      setIsSalesModalOpen(false);
    }
  };

  // Handle Add New Pabrikasi Category
  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryName.trim().toUpperCase();
    if (!clean) return;
    if (clean === 'D.R. FRESH MEMBER' || clean === 'DR FRESH MEMBER') {
      setErrorMsg('Pabrikasi D.r fresh member sudah tidak digunakan!');
      return;
    }
    if (!customCategories.includes(clean)) {
      setCustomCategories([...customCategories, clean]);
    }
    setNewCategoryName('');
    setShowAddCategoryInput(false);
  };

  // Handle Add New Material Item directly from Modal
  const handleAddNewMaterialFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim()) {
      setErrorMsg('Harap isi nama bahan!');
      return;
    }

    const bAwalParsed = parseFloat(newMatBahanAwal);
    const bAwal = isNaN(bAwalParsed) || bAwalParsed < 0 ? 0 : bAwalParsed;

    const sThawParsed = parseFloat(newMatSetelahThaw);
    const sThaw = isNaN(sThawParsed) || sThawParsed < 0 ? bAwal : sThawParsed;

    const sJualParsed = parseFloat(newMatSusutJual);
    const sJual = isNaN(sJualParsed) || sJualParsed < 0 ? 0 : sJualParsed;

    const targetCategory = newMatCategory || 'DAGING FRESH';
    const targetPlan = (newMatPlan || 'DAGING RENDANG PREMIUM').trim().toUpperCase();

    onAddItem({
      name: newMatName.trim(),
      pabrikasiCategory: targetCategory,
      weightBeforeThawing: bAwal,
      weightAfterThawing: sThaw,
      susutJualKg: sJual,
      plannedFabrication: targetPlan,
      openingPurpose: newMatOpeningPurpose,
      image: 'placeholder',
    });

    setSuccessMsg(`Bahan "${newMatName.trim()}" berhasil disimpan & terhubung dengan rencana ${targetPlan}!`);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 4000);

    setNewMatName('');
    setNewMatBahanAwal('');
    setNewMatSetelahThaw('');
    setNewMatSusutJual('');
    setNewMatPlan('DAGING RENDANG PREMIUM');
    setNewMatOpeningPurpose('UNTUK DISPLAY');
    setShowAddMaterialInput(false);
  };

  // Handle Save Inline Item Edit
  const handleSaveInlineEdit = (item: ThawingItem) => {
    if (!onUpdateItem) return;
    const newSJual = parseFloat(editSusutJual);
    const newHThaw = parseFloat(editHasilThaw);

    onUpdateItem({
      ...item,
      susutJualKg: isNaN(newSJual) ? (item.susutJualKg || 0) : Math.abs(newSJual),
      weightAfterThawing: isNaN(newHThaw) ? item.weightAfterThawing : newHThaw,
      plannedFabrication: editPlan.trim().toUpperCase() || item.plannedFabrication,
      openingPurpose: editOpeningPurpose || item.openingPurpose || 'UNTUK DISPLAY',
    });
    setEditingItemId(null);
  };

  // Handle Delete Single Item
  const handleDeleteItemClick = (item: ThawingItem) => {
    if (onDeleteItem) {
      onDeleteItem(item.id);
    }
    setSuccessMsg(`Bahan "${item.name}" berhasil dihapus!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Handle Delete Entire Category (Caption & Group)
  const handleDeleteCategoryClick = (categoryName: string) => {
    const target = categoryName.trim().toUpperCase();

    // Find all items in this category or matching plan/category/name
    const itemIdsToDelete = items
      .filter((i) => {
        const cat = (i.pabrikasiCategory || 'DAGING FRESH').trim().toUpperCase();
        const plan = (i.plannedFabrication || '').trim().toUpperCase();
        const name = (i.name || '').trim().toUpperCase();
        return (
          cat === target ||
          (target === 'DAGING FRESH' && cat === 'DAGING PRESH') ||
          plan === target ||
          name === target
        );
      })
      .map((i) => i.id);

    // Batch delete matching items
    if (itemIdsToDelete.length > 0 && onDeleteItem) {
      onDeleteItem(itemIdsToDelete);
    }

    // Permanently remove category caption from list
    setCustomCategories((prev) => {
      const next = prev.filter((c) => c.trim().toUpperCase() !== target);
      if (category.trim().toUpperCase() === target) {
        setCategory(next.length > 0 ? next[0] : '');
      }
      return next;
    });

    setSuccessMsg(`Kelompok pabrikasi "${categoryName}" beserta seluruh bahan didalamnya berhasil dihapus!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Handle Delete Items for a specific Rencana Potongan / Pabrikasi
  const handleDeletePlanItemsClick = (categoryName: string, planName: string) => {
    const targetCat = categoryName.trim().toUpperCase();
    const targetPlan = planName.trim().toUpperCase();

    const itemIdsToDelete = items
      .filter((i) => {
        const cat = (i.pabrikasiCategory || 'DAGING FRESH').trim().toUpperCase();
        const plan = (i.plannedFabrication || '').trim().toUpperCase();
        const matchesCat = cat === targetCat || (targetCat === 'DAGING FRESH' && cat === 'DAGING PRESH');
        const matchesPlan = plan === targetPlan;
        return matchesCat && matchesPlan;
      })
      .map((i) => i.id);

    if (itemIdsToDelete.length > 0 && onDeleteItem) {
      onDeleteItem(itemIdsToDelete);
    }

    setSuccessMsg(`Bahan untuk rencana "${planName}" berhasil dihapus!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- OVERALL SHRINKAGE METRICS CALCULATION ---
  const totalBahanAwalOverall = items.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0);
  const totalSetelahThawingOverall = items.reduce(
    (sum, i) => sum + (i.weightAfterThawing !== undefined ? i.weightAfterThawing : i.weightBeforeThawing),
    0
  );
  const totalSusutJualOverall = items.reduce((sum, i) => sum + (i.susutJualKg || 0), 0);

  // Exact Business Logic Function Calculation
  const overallShrinkage = calculateTotalShrinkage(
    totalBahanAwalOverall,
    totalSetelahThawingOverall,
    totalSusutJualOverall
  );

  // Accumulated Category Summaries
  const categorySummaries = aggregateShrinkageByPabrikasi(items, customCategories, segments);
  const rencanaShrinkageData = aggregateShrinkageByRencanaPotong(items, customPlans, segments);

  // Grouping view mode inside shrinkage modal ('kategori' = Per Kategori Pabrikasi, 'rencana' = Per Rencana Potong)
  const [shrinkageViewMode, setShrinkageViewMode] = useState<'kategori' | 'rencana'>('rencana');

  // Compute total weight of raw meat issued
  const totalWeightIssued = totalBahanAwalOverall;

  // Alert condition
  const exceedsSalesPrediction = totalWeightIssued > salesPredictionKg;
  const overageKg = Math.max(0, totalWeightIssued - salesPredictionKg);

  // Fabrication Segments total
  const totalProcessedSegmentsWeight = segments.reduce((sum, s) => sum + s.actualWeight, 0);

  // Formatted date and time strings
  const formattedDayDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTimeStr = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                {todanusDisplay}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {todanusDisplay}
            </h1>
            <p className="text-slate-300 mt-1 text-xs md:text-sm">
              Sistem kontrol timbangan bahan baku, prediksi sales & monitoring susut pabrikasi.
            </p>
          </div>

          {/* Date & Time Widget */}
          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-3.5 shrink-0 shadow-inner">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">
                {formattedDayDate}
              </span>
              <span className="text-xl font-black font-mono tracking-tight text-emerald-400">
                {formattedTimeStr} <span className="text-xs font-normal text-slate-400">WIB</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ALERT BANNER IF OVERALL SHRINKAGE EXCEEDS 2% */}
      {overallShrinkage.shrinkageRatePercent > 2.0 && (
        <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl flex items-start gap-3.5 text-amber-950 shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
            <AlertTriangle className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm uppercase tracking-wide text-amber-950">
                🚨 ALERT: SUSUT KESELURUHAN SUDAH MELEBIHI 2.00%! ({overallShrinkage.shrinkageRateFormatted})
              </h4>
              <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                {overallShrinkage.shrinkageRateFormatted} (&gt; 2.00%)
              </span>
            </div>
            <p className="text-xs mt-1 text-amber-900 leading-relaxed">
              Tingkat penyusutan daging keseluruhan telah mencapai <strong>{overallShrinkage.shrinkageRateFormatted}</strong> (Total Susut: <strong>{overallShrinkage.totalSusutBeratKg.toFixed(2)} Kg</strong> dari {overallShrinkage.bahanAwalKg.toFixed(1)} Kg bahan awal). Angka ini melampaui batas toleransi maksimum standar pabrikasi <strong>2.00%</strong>. Segera lakukan pengecekan suhu thawing, kelembaban chiller, atau timbangan bahan.
            </p>
          </div>
        </div>
      )}

      {/* ALERT BANNER IF MEAT ISSUED EXCEEDS SALES PREDICTION */}
      {exceedsSalesPrediction && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl flex items-start gap-3.5 text-rose-900 shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="p-2 bg-rose-500 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
            <AlertTriangle className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm uppercase tracking-wide text-rose-950">
                ⚠️ PERINGATAN: TOTAL DAGING DIKELUARKAN MELEBIHI PREDIKSI SALES!
              </h4>
              <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                + {overageKg.toFixed(1)} Kg
              </span>
            </div>
            <p className="text-xs mt-1 text-rose-800 leading-relaxed">
              Total bahan baku yang dikeluarkan (<strong>{totalWeightIssued.toFixed(1)} Kg</strong>) melampaui target Prediksi Sales Produk Pabrikasi (<strong>{salesPredictionKg.toFixed(1)} Kg</strong>). Ketuk jendela di bawah untuk melihat rincian item & evaluasi stok.
            </p>
          </div>
        </div>
      )}

      {/* --- STATS GRID WINDOWS (HIDDEN FOR BUTCHER) --- */}
      {!isButcherView && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* WINDOW 1: Prediksi Sales Produk Pabrikasi */}
          <div
            onClick={() => setIsSalesModalOpen(true)}
            className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600" /> Prediksi Sales
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                <Sparkles className="w-3 h-3 text-emerald-600 animate-pulse" />
                ML Prediction
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-1">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                  {salesPredictionKg.toFixed(1)}
                </h3>
                <span className="text-sm font-bold text-slate-500">Kg</span>
              </div>
              <div className="mt-2.5 bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-[11px] text-slate-600 space-y-1">
                <div className="font-extrabold text-emerald-800 flex items-center justify-between">
                  <span>🤖 {mlPrediction.dayCategory}</span>
                  <span className="font-mono text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-black">
                    {mlPrediction.confidencePercent}% Acc
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate">
                  Faktor: {mlPrediction.dayTypeLabel} ({mlPrediction.totalMultiplier.toFixed(2)}x)
                </p>
              </div>
            </div>
          </div>

          {/* WINDOW 2: Total Bahan Daging Yang Dikeluarkan */}
          <div
            onClick={() => setIsIssuedModalOpen(true)}
            className={`bg-white p-5 rounded-2xl shadow-xs border transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden ${
              exceedsSalesPrediction
                ? 'border-rose-300 bg-rose-50/30 hover:border-rose-500 hover:shadow-md'
                : 'border-slate-200 hover:border-emerald-500 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-emerald-600" /> Daging Dikeluarkan
              </span>
              <div
                className={`p-2 rounded-xl transition-all ${
                  exceedsSalesPrediction
                    ? 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white'
                    : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-1">
                <h3
                  className={`text-3xl font-black tracking-tight ${
                    exceedsSalesPrediction ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {totalWeightIssued.toFixed(1)}
                </h3>
                <span className="text-sm font-bold text-slate-500">Kg</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500 font-medium">
                  {items.length} item bahan baku
                </span>
                {exceedsSalesPrediction && (
                  <span className="text-[10px] font-extrabold bg-rose-600 text-white px-1.5 py-0.5 rounded-md">
                    MELEBIHI TARGET
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* WINDOW 3: JENDELA SUSUT KESELURUHAN (RATE & LOSS VALUE) */}
          <div
            onClick={() => setIsShrinkageModalOpen(true)}
            className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Susut Keseluruhan
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <h3 className={`text-3xl font-black tracking-tight ${overallShrinkage.shrinkageRatePercent > 2.0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {overallShrinkage.shrinkageRateFormatted}
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  ({overallShrinkage.totalSusutBeratKg.toFixed(2)} Kg)
                </span>
              </div>
              <div className="mt-2.5 bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-[11px] text-slate-600 space-y-1">
                <div className="font-extrabold text-slate-800 flex items-center justify-between">
                  <span>Batas Maks: 2.00%</span>
                  <span className={overallShrinkage.shrinkageRatePercent > 2.0 ? 'text-amber-600 font-bold' : 'text-emerald-700 font-bold'}>
                    {overallShrinkage.shrinkageRatePercent > 2.0 ? '⚠️ Melebihi 2%' : '✅ Normal'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium flex items-center justify-between pt-0.5">
                  <span>Awal: {overallShrinkage.bahanAwalKg.toFixed(1)} Kg</span>
                  <span className="underline group-hover:text-emerald-900">(Tap Detail)</span>
                </p>
              </div>
            </div>
          </div>

          {/* WINDOW 4: Segmen Hasil Potong Pabrikasi */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Hasil Pabrikasi</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                {totalProcessedSegmentsWeight.toFixed(2)} <span className="text-sm font-bold text-slate-500">Kg</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Dari {segments.length} potongan segmen
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- FORM & QUICK MEAT SECTION --- */}
      <div className={`grid grid-cols-1 ${isButcherView ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-6`}>
        {/* Main Input Form */}
        <div className={`${isButcherView ? 'w-full' : 'lg:col-span-7'} bg-white rounded-2xl p-6 border border-slate-200 shadow-xs`}>
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Catat Bahan Daging Baru</h2>
              <p className="text-xs text-slate-500">Pilih bahan, kategori & masukkan timbangan bahan awal.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-center gap-2">
                ⚠️ <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-sm rounded-xl border border-emerald-100 flex items-center gap-2">
                ✅ <span>{successMsg}</span>
              </div>
            )}

            {/* Quick Autofill Selector */}
            <div>
              <span className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                Pilih Cepat Nama Bahan:
              </span>
              <div className="flex flex-wrap gap-2">
                {COMMON_MEATS.map((meat, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyTemplate(meat)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs rounded-xl border border-slate-200 transition-all cursor-pointer font-medium"
                  >
                    <span>{meat.icon}</span>
                    <span>{meat.name}</span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                      {meat.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nama Bahan */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Nama Bahan Daging *</label>
                <input
                  type="text"
                  placeholder="Contoh: HQ 41/42/44/45"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900 text-sm font-bold"
                />
              </div>

              {/* Kategori Bahan */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Kategori Bahan *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900 text-sm font-bold"
                >
                  {customCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bahan Awal (Kg) */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Bahan Awal (Kg) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  placeholder="Contoh: 120.00"
                  value={weightBefore}
                  onChange={(e) => setWeightBefore(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900 text-sm font-bold"
                />
                <span className="absolute right-4 top-3 text-slate-400 font-bold text-xs">Kg</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Simpan & Tambah Bahan ke Thawing
            </button>
          </form>
        </div>

        {/* Right Info Section (Col-5 - Hidden for Butcher) */}
        {!isButcherView && (
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-emerald-950 text-white rounded-2xl p-5 border border-emerald-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Batas Toleransi Susut Keseluruhan
                </span>
                <span className="text-[10px] bg-emerald-900 text-emerald-200 font-mono px-2 py-0.5 rounded font-bold">
                  Maksimal 2.00%
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Koleransi susut maksimal untuk seluruh kelompok bahan baku pabrikasi ditetapkan di angka <strong>2.00%</strong>. Nilai susut melebihi 2.00% akan ditandai secara otomatis.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Beef className="w-4 h-4 text-emerald-600" /> Ringkasan Kategori Bahan ({categorySummaries.length})
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {categorySummaries.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Belum ada kelompok pabrikasi. Ketuk &quot;Rincian Susut Keseluruhan&quot; untuk menambah kelompok.
                  </p>
                ) : (
                  categorySummaries.map((cat) => (
                  <div key={cat.categoryName} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div>
                          <span className="font-extrabold text-slate-900 block">{cat.categoryName}</span>
                          <span className="text-[10px] text-slate-500">
                            {cat.itemCount} bahan • Awal: {cat.totalBahanAwalKg.toFixed(1)}kg
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategoryClick(cat.categoryName)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer ml-1"
                          title={`Hapus kelompok ${cat.categoryName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <span className={`font-black font-mono block ${cat.shrinkageRatePercent > 2.0 ? 'text-amber-600' : 'text-emerald-800'}`}>
                          {cat.shrinkageRateFormatted}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Susut: {cat.totalSusutBeratKg.toFixed(2)}kg
                        </span>
                      </div>
                    </div>

                    {/* Connected Rencana Potongan / Pabrikasi Breakdown */}
                    {cat.rencanaBreakdown && cat.rencanaBreakdown.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/80 space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                          🎯 Rencana Potongan / Pabrikasi Terhubung:
                        </span>
                        <div className="flex flex-col gap-1">
                          {cat.rencanaBreakdown.map((plan) => (
                            <div
                              key={plan.planName}
                              className="px-2 py-1 bg-white border border-slate-200/90 rounded-md text-[10px] font-extrabold text-slate-800 flex items-center justify-between gap-1.5 shadow-2xs"
                            >
                              <span className="truncate">{plan.planName}</span>
                              {plan.itemCount > 0 ? (
                                <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded text-[9px] shrink-0 font-mono">
                                  {plan.totalBahanAwalKg.toFixed(1)} kg ({plan.itemCount})
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal text-[9px] shrink-0">(0 kg)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL 1: PREDIKSI SALES DETAIL & ML ENGINE ADJUSTMENT --- */}
      {isSalesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Prediksi Sales Produk Pabrikasi</h3>
                  <p className="text-xs text-slate-400">Analisis Otomatis Machine Learning (ML) & Kategori Hari</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSalesModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 text-slate-800 overflow-y-auto">
              {/* MACHINE LEARNING AI AUTOMATIC PREDICTION ENGINE CARD */}
              <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 p-5 rounded-2xl text-white space-y-3.5 border border-emerald-500/30 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      Machine Learning ML Engine
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Akurasi: {mlPrediction.confidencePercent}%
                  </span>
                </div>

                <div className="flex items-baseline justify-between border-t border-b border-slate-800 py-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Hasil Prediksi Otomatis ML:
                    </span>
                    <h4 className="text-3xl font-black text-emerald-400 tracking-tight">
                      {mlPrediction.predictedSalesKg} <span className="text-sm font-bold text-slate-300">Kg</span>
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetInput(String(mlPrediction.predictedSalesKg));
                      onUpdateSalesPrediction(mlPrediction.predictedSalesKg);
                    }}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Terapkan Hasil ML
                  </button>
                </div>

                {/* Factors Matrix */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                    Parameter Algoritma Hari Berlangsung:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {mlPrediction.factors.map((f, idx) => (
                      <div key={idx} className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block">{f.label}</span>
                        <span className="font-bold text-white block mt-0.5 text-[11px]">{f.value}</span>
                        <span className="text-[9px] text-emerald-400 font-medium block mt-0.5">{f.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation Tips */}
                <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-500/20 text-[11px] text-emerald-200 leading-relaxed">
                  <strong>💡 Rekomendasi ML & Training Dataset:</strong> Data historis penjualan beberapa bulan ke belakang akan otomatis ditraining ke model ML ini untuk presisi optimal.
                </div>
              </div>

              {/* MANUAL ADJUSTMENT FORM */}
              <form onSubmit={handleSaveSalesTarget} className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Target Prediksi Sales Ditentukan (Kg)
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">Dapat Diubah Manual</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-4 top-3.5 text-slate-400 font-bold text-sm">Kg</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSalesModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md cursor-pointer"
                  >
                    Simpan Target
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: RINCIAN TOTAL BAHAN DAGING DIKELUARKAN & SEGMEN --- */}
      {isIssuedModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <PackageCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Rincian Total Daging Dikeluarkan & Segmen</h3>
                  <p className="text-xs text-slate-400">{todanusDisplay} • Rincian lengkap item & hasil potong</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIssuedModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
              {/* SECTION 1: BAHAN BAKU DIKELUARKAN */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Beef className="w-4 h-4 text-emerald-600" />
                    1. Rincian Masing-Masing Bahan Baku Dikeluarkan ({items.length} Item)
                  </h4>
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border">
                    Total: {totalWeightIssued.toFixed(1)} Kg
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center bg-slate-50 rounded-xl">
                    Belum ada bahan daging dikeluarkan hari ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-extrabold text-slate-900 block text-sm">
                            {idx + 1}. {item.name}
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            Kategori: <strong>{item.pabrikasiCategory || 'DAGING PRESH'}</strong> • Rencana: {item.plannedFabrication}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-900 text-sm block font-mono">
                            {item.weightBeforeThawing.toFixed(2)} Kg
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold block">
                            Susut Jual: {(item.susutJualKg || 0).toFixed(3)} Kg
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setIsIssuedModalOpen(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Tutup Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: RINCIAN SUSUT KESELURUHANS PER PABRIKASI (DETAILED CATEGORY BREAKDOWN) --- */}
      {isShrinkageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Rincian Susut Keseluruhan per Pabrikasi</h3>
                  <p className="text-xs text-slate-400">Total Shrinkage Rate (%) & Nilai Kerugian Berat Daging per Kelompok Pabrikasi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShrinkageModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content Stage */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
              {/* Notification Banners inside Modal */}
              {successMsg && (
                <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl text-xs font-extrabold shadow-md flex items-center justify-between animate-in fade-in">
                  <span className="flex items-center gap-2">
                    <span>✅</span> {successMsg}
                  </span>
                  <button type="button" onClick={() => setSuccessMsg('')} className="text-white hover:text-emerald-200 font-bold ml-2">✕</button>
                </div>
              )}
              {errorMsg && (
                <div className="bg-rose-600 text-white px-4 py-3 rounded-2xl text-xs font-extrabold shadow-md flex items-center justify-between animate-in fade-in">
                  <span className="flex items-center gap-2">
                    <span>⚠️</span> {errorMsg}
                  </span>
                  <button type="button" onClick={() => setErrorMsg('')} className="text-white hover:text-rose-200 font-bold ml-2">✕</button>
                </div>
              )}
              {/* Formula & Rule Card */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-4 rounded-2xl text-white space-y-2 border border-emerald-500/30 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4" /> Toleransi Maksimal Susut Harian: 2.0% per Kategori Potongan
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                    1.0% Susut Proses + 1.0% Susut Jual
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px]">
                    <span className="text-slate-400 block font-sans text-[10px] font-bold">1. Susut Proses (Max 1.0%):</span>
                    <span className="text-rose-300 font-bold block">
                      Thawing + Pabrikasi / Potong
                    </span>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px]">
                    <span className="text-slate-400 block font-sans text-[10px] font-bold">2. Susut Jual (Max 1.0%):</span>
                    <span className="text-amber-300 font-bold block">
                      Update Susut Berkala / Display
                    </span>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px]">
                    <span className="text-slate-400 block font-sans text-[10px] font-bold">3. Formulasi Total:</span>
                    <span className="text-emerald-300 font-bold block">
                      Total Susut % = (Process_Kg + Sales_Kg) / Bahan_Awal * 100
                    </span>
                  </div>
                </div>
              </div>

              {/* OVERALL ACCUMULATED BANNER */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider block">
                    AKUMULASI SUSUT KESELURUHANS SEMUA PABRIKASI
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-emerald-900 font-mono">
                      {overallShrinkage.shrinkageRateFormatted}
                    </span>
                    <span className="text-sm font-bold text-emerald-800">
                      (Total Susut Berat: {overallShrinkage.totalSusutBeratKg.toFixed(3)} Kg)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-700 bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Bahan Awal</span>
                    <span className="font-extrabold font-mono text-sm">{overallShrinkage.bahanAwalKg.toFixed(2)} Kg</span>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Setelah Thaw</span>
                    <span className="font-extrabold font-mono text-sm">{overallShrinkage.setelahThawingKg.toFixed(2)} Kg</span>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Susut Jual</span>
                    <span className="font-extrabold font-mono text-sm text-emerald-700">{overallShrinkage.susutJualKg.toFixed(3)} Kg</span>
                  </div>
                </div>
              </div>

              {/* TOOLBAR FOR ADDING PABRIKASI CATEGORY & MATERIAL */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mr-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Tampilan Grouping:
                  </h4>
                  <div className="inline-flex bg-slate-200/80 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setShrinkageViewMode('kategori')}
                      className={`px-3 py-1.5 font-extrabold text-xs rounded-lg transition-all cursor-pointer ${
                        shrinkageViewMode === 'kategori'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      🥩 Per Kategori Pabrikasi (Fresh, Premium, Rawon)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShrinkageViewMode('rencana')}
                      className={`px-3 py-1.5 font-extrabold text-xs rounded-lg transition-all cursor-pointer ${
                        shrinkageViewMode === 'rencana'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      ✂️ Per Rencana Potong
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenEditPlanModal && (
                    <button
                      type="button"
                      onClick={() => onOpenEditPlanModal()}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Koreksi Rencana Potong jika terjadi kesalahan input / human error"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Ubah Rencana Potong</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategoryInput(!showAddCategoryInput);
                      setShowAddMaterialInput(false);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    + Tambah Nama Pabrikasi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMaterialInput(!showAddMaterialInput);
                      setShowAddCategoryInput(false);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Tambah Nama Bahan Baru
                  </button>
                </div>
              </div>

              {/* LIST RENCANA POTONG CUSTOM PERSISTEN */}
              {customPlans.length > 0 && (
                <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold text-emerald-950 text-[11px] uppercase flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-emerald-600" />
                    Rencana Potong Custom ({customPlans.length}):
                  </span>
                  {customPlans.map((planName) => (
                    <span
                      key={planName}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-emerald-950 font-extrabold text-[11px] rounded-lg border border-emerald-300 shadow-2xs"
                    >
                      {planName}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomPlan(planName)}
                        className="hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                        title={`Hapus rencana ${planName}`}
                      >
                        <X className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* INPUT FORM: TAMBAH NAMA PABRIKASI BARU */}
              {showAddCategoryInput && (
                <form onSubmit={handleAddNewCategory} className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-300 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-950 uppercase">
                      Tambah Kategori Pabrikasi Baru
                    </span>
                    <button type="button" onClick={() => setShowAddCategoryInput(false)} className="text-xs text-slate-500 hover:text-slate-800">
                      ✕ Batal
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Masukkan nama pabrikasi (Contoh: MARINATED CUTS, SPECIAL ITEM)"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-3.5 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold uppercase focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:bg-emerald-800"
                    >
                      Simpan Pabrikasi
                    </button>
                  </div>
                </form>
              )}

              {/* INPUT FORM: TAMBAH NAMA BAHAN BARU */}
              {showAddMaterialInput && (
                <form onSubmit={handleAddNewMaterialFromModal} className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold text-emerald-400 uppercase">
                      Tambah Bahan Baru ke Pabrikasi
                    </span>
                    <button type="button" onClick={() => setShowAddMaterialInput(false)} className="text-xs text-slate-400 hover:text-white">
                      ✕ Batal
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Nama Bahan</label>
                      <input
                        type="text"
                        placeholder="Contoh: Wagyu Slice"
                        value={newMatName}
                        onChange={(e) => setNewMatName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Kelompok Pabrikasi</label>
                      <select
                        value={newMatCategory}
                        onChange={(e) => setNewMatCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold"
                      >
                        {customCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] text-slate-400 font-bold">Rencana Potongan *</label>
                        <button
                          type="button"
                          onClick={() => setShowAddPlanModal(!showAddPlanModal)}
                          className="p-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-700/60 rounded-md cursor-pointer transition-colors"
                          title="Tambah Rencana Potong Baru (+)"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {showAddPlanModal ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Rencana Baru..."
                            value={newPlanInputModal}
                            onChange={(e) => setNewPlanInputModal(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-950 border border-emerald-500 rounded text-xs text-white uppercase font-bold"
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveNewCustomPlan(newPlanInputModal, 'modal')}
                              className="px-2 py-1 bg-emerald-500 text-slate-950 font-extrabold text-[10px] rounded cursor-pointer"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAddPlanModal(false)}
                              className="px-1.5 py-1 bg-slate-800 text-slate-300 text-[10px] rounded cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <select
                          value={newMatPlan}
                          onChange={(e) => setNewMatPlan(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold text-xs"
                        >
                          {availablePlans.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Bahan Awal (Kg)</label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="120.0"
                        value={newMatBahanAwal}
                        onChange={(e) => setNewMatBahanAwal(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Setelah Thaw (Kg)</label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="119.05"
                        value={newMatSetelahThaw}
                        onChange={(e) => setNewMatSetelahThaw(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Tujuan Buka</label>
                      <select
                        value={newMatOpeningPurpose}
                        onChange={(e) => setNewMatOpeningPurpose(e.target.value as any)}
                        className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 font-bold text-xs"
                      >
                        <option value="UNTUK DISPLAY">🏪 UNTUK DISPLAY</option>
                        <option value="UNTUK PESANAN">🛍️ UNTUK PESANAN</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Susut Jual (Kg)</label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="1.617"
                        value={newMatSusutJual}
                        onChange={(e) => setNewMatSusutJual(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-xs"
                    >
                      + Simpan & Masukkan Bahan
                    </button>
                  </div>
                </form>
              )}

              {/* LIST OF RENCANA POTONG / PABRIKASI AKUMULASI SUSUT */}
              <div className="space-y-6">
                {shrinkageViewMode === 'kategori' ? (
                  categorySummaries.map((cat) => (
                    <div
                      key={cat.categoryName}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0"
                    >
                      {/* Header Title Bar */}
                      <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full bg-emerald-400" />
                          <h4 className="font-black text-sm md:text-base tracking-wide text-white uppercase font-sans">
                            {cat.categoryName}
                          </h4>
                          <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                            {cat.itemCount} Item
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-xl shadow-2xs ${
                            cat.isAlertExceeded ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-slate-950'
                          }`}>
                            {cat.shrinkageRateFormatted}
                          </span>
                        </div>
                      </div>

                      {/* Alert Banner inside card if > 2% */}
                      {cat.isAlertExceeded && (
                        <div className="mx-4 mt-4 p-3 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-center justify-between gap-3 text-rose-950 shadow-2xs">
                          <div className="flex items-center gap-2">
                            <span className="p-1 bg-rose-600 text-white rounded-lg text-xs font-black">🚨</span>
                            <div>
                              <h5 className="font-extrabold text-xs uppercase text-rose-950">
                                🚨 ALERT: PERSENTASE SUSUT MELEBIHI 2.00%!
                              </h5>
                              <p className="text-[11px] text-rose-800">
                                Persentase susut <strong>{cat.shrinkageRateFormatted}</strong> telah melampaui batas aman standar 2.00%.
                              </p>
                            </div>
                          </div>
                          <span className="bg-rose-600 text-white text-[11px] font-black font-mono px-2 py-0.5 rounded-full uppercase">
                            {cat.shrinkageRateFormatted} (&gt; 2.0%)
                          </span>
                        </div>
                      )}

                      <div className="p-4 space-y-4">
                        {/* SECTION 1: SUSUT PROSES (TOTAL SUSUT) (PERSENTASE) */}
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                              <Scale className="w-3.5 h-3.5 text-emerald-600" />
                              SUSUT PROSES (TOTAL SUSUT)
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">Rincian Bahan Baku</span>
                          </div>

                          {/* Items Breakdown List */}
                          {cat.items.length === 0 ? (
                            <div className="py-2 text-center text-xs text-slate-400 italic">
                              (Belum ada data bahan dibuka untuk kategori ini)
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {cat.items.map((item) => {
                                const bAwal = item.weightBeforeThawing || 0;
                                const bThaw = item.weightAfterThawing !== undefined ? item.weightAfterThawing : bAwal;
                                const itemLoss = bAwal - bThaw;
                                const isEditing = editingItemId === item.id;

                                return (
                                  <div key={item.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-slate-900 font-sans">{item.name}</span>
                                      <span className="text-[10px] text-slate-500 font-sans font-semibold">({item.plannedFabrication || 'Rencana Potong'})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {isEditing ? (
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            step="0.001"
                                            value={editHasilThaw}
                                            onChange={(e) => setEditHasilThaw(e.target.value)}
                                            className="w-20 px-1 py-0.5 border border-emerald-400 rounded bg-white font-mono text-xs font-bold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleSaveInlineEdit(item)}
                                            className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold text-[10px]"
                                          >
                                            Simpan
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-slate-700 font-bold">
                                            {bAwal.toFixed(2)} - {bThaw.toFixed(2)}
                                          </span>
                                          <span className="bg-rose-50 text-rose-700 border border-rose-200 font-black px-2 py-0.5 rounded text-[11px]">
                                            SUSUT {itemLoss.toFixed(2)} Kg
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingItemId(item.id);
                                                setEditSusutJual(String(item.susutJualKg || 0));
                                                setEditHasilThaw(String(bThaw));
                                                setEditPlan(item.plannedFabrication || '');
                                                setEditOpeningPurpose(item.openingPurpose === 'UNTUK PESANAN' ? 'UNTUK PESANAN' : 'UNTUK DISPLAY');
                                              }}
                                              className="text-slate-400 hover:text-emerald-700 p-0.5 cursor-pointer"
                                              title="Edit Item"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteItemClick(item)}
                                              className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                              title="Hapus Item"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Process Loss Summary Lines */}
                          <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-600">TOTAL BAHAN SEBELUM THAWING</span>
                              <span className="font-black font-mono text-slate-900">{cat.totalBahanAwalKg.toFixed(2)} Kg</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-600">TOTAL BAHAN SETELAH THAWING</span>
                              <span className="font-black font-mono text-slate-900">{cat.totalSetelahThawingKg.toFixed(2)} Kg</span>
                            </div>
                            <div className="flex items-center justify-between bg-rose-50/70 p-1.5 rounded-md border border-rose-100">
                              <span className="font-extrabold text-rose-900 uppercase">SELISIH (HARUS -XX)</span>
                              <span className="font-black font-mono text-rose-700">
                                {cat.selisihProsesKg === 0 ? '0.00' : cat.selisihProsesKg.toFixed(2)} Kg
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* SECTION 2: SUSUT JUAL */}
                        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-amber-950 uppercase block">SUSUT JUAL</span>
                            <span className="text-[10px] text-amber-800 italic block">Ambil dari data update susut (output -xx)</span>
                          </div>
                          <span className="font-black font-mono text-amber-800 text-sm bg-white px-3 py-1 rounded-lg border border-amber-300">
                            {-cat.totalSusutJualKg === 0 ? '0.00' : (-cat.totalSusutJualKg).toFixed(2)} Kg
                          </span>
                        </div>

                        {/* SECTION 3: PERSENTASE SUSUT */}
                        <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="font-black text-emerald-950 uppercase block">PERSENTASE SUSUT</span>
                            <span className="text-[10px] text-emerald-800 block font-mono">
                              ( total bahan sebelum thawing - (total bahan setelah thawing + susut jual) / total bahan sebelum thaw )
                            </span>
                          </div>
                          <span className={`font-mono font-black text-base px-3 py-1 rounded-xl shadow-2xs ${
                            cat.isAlertExceeded ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            {cat.shrinkageRateFormatted}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  rencanaShrinkageData.planSummaries.map((plan) => (
                    <div
                      key={plan.planName}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0"
                    >
                      {/* Header Title Bar */}
                      <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full bg-emerald-400" />
                          <h4 className="font-black text-sm md:text-base tracking-wide text-white uppercase font-sans">
                            {plan.planName}
                          </h4>
                          <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                            {plan.itemCount} Item
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-xl shadow-2xs ${
                            plan.isAlertExceeded ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-slate-950'
                          }`}>
                            {plan.shrinkageRateFormatted}
                          </span>
                        </div>
                      </div>

                      {/* Alert Banner inside card if > 2% */}
                      {plan.isAlertExceeded && (
                        <div className="mx-4 mt-4 p-3 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-center justify-between gap-3 text-rose-950 shadow-2xs">
                          <div className="flex items-center gap-2">
                            <span className="p-1 bg-rose-600 text-white rounded-lg text-xs font-black">🚨</span>
                            <div>
                              <h5 className="font-extrabold text-xs uppercase text-rose-950">
                                🚨 ALERT: PERSENTASE SUSUT MELEBIHI 2.00%!
                              </h5>
                              <p className="text-[11px] text-rose-800">
                                Persentase susut <strong>{plan.shrinkageRateFormatted}</strong> telah melampaui batas aman standar 2.00%.
                              </p>
                            </div>
                          </div>
                          <span className="bg-rose-600 text-white text-[11px] font-black font-mono px-2 py-0.5 rounded-full uppercase">
                            {plan.shrinkageRateFormatted} (&gt; 2.0%)
                          </span>
                        </div>
                      )}

                      <div className="p-4 space-y-4">
                        {/* SECTION 1: SUSUT PROSES (TOTAL SUSUT) (PERSENTASE) */}
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                              <Scale className="w-3.5 h-3.5 text-emerald-600" />
                              SUSUT PROSES (TOTAL SUSUT)
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">Rincian Bahan Baku</span>
                          </div>

                          {/* Items Breakdown List */}
                          {plan.items.length === 0 ? (
                            <div className="py-2 text-center text-xs text-slate-400 italic">
                              (Belum ada data bahan dibuka untuk rencana potong ini)
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {plan.items.map((item) => {
                                const bAwal = item.weightBeforeThawing || 0;
                                const bThaw = item.weightAfterThawing !== undefined ? item.weightAfterThawing : bAwal;
                                const itemLoss = bAwal - bThaw;
                                const isEditing = editingItemId === item.id;

                                return (
                                  <div key={item.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-slate-900 font-sans">{item.name}</span>
                                      <span className="text-[10px] text-slate-500 font-sans font-semibold">({item.pabrikasiCategory || 'DAGING FRESH'})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {isEditing ? (
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            step="0.001"
                                            value={editHasilThaw}
                                            onChange={(e) => setEditHasilThaw(e.target.value)}
                                            className="w-20 px-1 py-0.5 border border-emerald-400 rounded bg-white font-mono text-xs font-bold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleSaveInlineEdit(item)}
                                            className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold text-[10px]"
                                          >
                                            Simpan
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-slate-700 font-bold">
                                            {bAwal.toFixed(2)} - {bThaw.toFixed(2)}
                                          </span>
                                          <span className="bg-rose-50 text-rose-700 border border-rose-200 font-black px-2 py-0.5 rounded text-[11px]">
                                            SUSUT {itemLoss.toFixed(2)} Kg
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingItemId(item.id);
                                                setEditSusutJual(String(item.susutJualKg || 0));
                                                setEditHasilThaw(String(bThaw));
                                                setEditPlan(item.plannedFabrication || plan.planName);
                                                setEditOpeningPurpose(item.openingPurpose === 'UNTUK PESANAN' ? 'UNTUK PESANAN' : 'UNTUK DISPLAY');
                                              }}
                                              className="text-slate-400 hover:text-emerald-700 p-0.5 cursor-pointer"
                                              title="Edit Item"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteItemClick(item)}
                                              className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                              title="Hapus Item"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Process Loss Summary Lines */}
                          <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-600">TOTAL BAHAN SEBELUM THAWING</span>
                              <span className="font-black font-mono text-slate-900">{plan.totalBahanSebelumThawingKg.toFixed(2)} Kg</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-600">TOTAL BAHAN SETELAH THAWING</span>
                              <span className="font-black font-mono text-slate-900">{plan.totalBahanSetelahThawingKg.toFixed(2)} Kg</span>
                            </div>
                            <div className="flex items-center justify-between bg-rose-50/70 p-1.5 rounded-md border border-rose-100">
                              <span className="font-extrabold text-rose-900 uppercase">SELISIH</span>
                              <span className="font-black font-mono text-rose-700">
                                {plan.selisihProsesKg === 0 ? '0.00' : plan.selisihProsesKg.toFixed(2)} Kg
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* SECTION 2: SUSUT JUAL */}
                        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-amber-950 uppercase block">SUSUT JUAL</span>
                            <span className="text-[10px] text-amber-800 italic block">Ambil dari data update susut</span>
                          </div>
                          <span className="font-black font-mono text-amber-800 text-sm bg-white px-3 py-1 rounded-lg border border-amber-300">
                            {-plan.susutJualKg === 0 ? '0.00' : (-plan.susutJualKg).toFixed(2)} Kg
                          </span>
                        </div>

                        {/* SECTION 3: PERSENTASE SUSUT */}
                        <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="font-black text-emerald-950 uppercase block">PERSENTASE SUSUT</span>
                            <span className="text-[10px] text-emerald-800 block font-mono">
                              ( total bahan sebelum thawing - (total bahan setelah thawing + susut jual) / total bahan sebelum thaw )
                            </span>
                          </div>
                          <span className={`font-mono font-black text-base px-3 py-1 rounded-xl shadow-2xs ${
                            plan.isAlertExceeded ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            {plan.shrinkageRateFormatted}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* TOTAL KESELURUHAN BLOCK */}
                <div className="bg-slate-950 text-white rounded-2xl border-2 border-emerald-500/40 p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                        <TrendingUp className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="font-black text-base tracking-wider text-white uppercase">TOTAL KESELURUHAN</h3>
                        <p className="text-[11px] text-slate-400">Akumulasi seluruh rencana potong &amp; pabrikasi</p>
                      </div>
                    </div>
                    <span className={`font-mono font-black text-lg px-3 py-1 rounded-xl ${
                      rencanaShrinkageData.grandTotal.isAlertExceeded ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-slate-950'
                    }`}>
                      {rencanaShrinkageData.grandTotal.shrinkageRateFormatted}
                    </span>
                  </div>

                  {/* ALERT BANNER IF GRAND TOTAL > 2% */}
                  {rencanaShrinkageData.grandTotal.isAlertExceeded && (
                    <div className="bg-rose-950/90 border border-rose-500/80 p-3.5 rounded-xl flex items-center justify-between gap-3 text-rose-200">
                      <div className="flex items-center gap-2">
                        <span className="p-1 bg-rose-600 text-white rounded-md text-xs font-black">🚨</span>
                        <div>
                          <h5 className="font-extrabold text-xs uppercase text-rose-100">
                            🚨 ALERT KESELURUHAN: PERSENTASE SUSUT TOTAL MELEBIHI 2.00%!
                          </h5>
                          <p className="text-[11px] text-rose-300">
                            Seluruh akumulasi susut (<strong>{rencanaShrinkageData.grandTotal.shrinkageRateFormatted}</strong>) telah melewati ambang toleransi aman 2.00%.
                          </p>
                        </div>
                      </div>
                      <span className="bg-rose-600 text-white font-black text-xs px-2.5 py-1 rounded-full font-mono">
                        {rencanaShrinkageData.grandTotal.shrinkageRateFormatted} (&gt; 2.0%)
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>TOTAL BAHAN SEBELUM THAWING</span>
                        <strong className="text-white text-sm">{rencanaShrinkageData.grandTotal.totalBahanSebelumThawingKg.toFixed(2)} Kg</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>TOTAL BAHAN SETELAH THAWING</span>
                        <strong className="text-white text-sm">{rencanaShrinkageData.grandTotal.totalBahanSetelahThawingKg.toFixed(2)} Kg</strong>
                      </div>
                      <div className="flex items-center justify-between text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-900/60 font-bold">
                        <span>SELISIH PROSES</span>
                        <span className="text-sm font-black">
                          {rencanaShrinkageData.grandTotal.selisihProsesKg === 0 ? '0.00' : rencanaShrinkageData.grandTotal.selisihProsesKg.toFixed(2)} Kg
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-900/60 font-bold">
                        <div>
                          <span className="block">SUSUT JUAL</span>
                          <span className="text-[10px] text-amber-400/80 font-normal block font-sans">Ambil dari seluruh rencana potong</span>
                        </div>
                        <span className="text-sm font-black">
                          {-rencanaShrinkageData.grandTotal.susutJualKg === 0 ? '0.00' : (-rencanaShrinkageData.grandTotal.susutJualKg).toFixed(2)} Kg
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-emerald-300 bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/60 font-bold">
                        <div>
                          <span className="block">PERSENTASE SUSUT TOTAL</span>
                          <span className="text-[9px] text-emerald-400/80 font-normal block font-sans">
                            (seluruh total sebelum - (seluruh total setelah + susut jual)) / total sebelum
                          </span>
                        </div>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          {rencanaShrinkageData.grandTotal.shrinkageRateFormatted}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <Info className="w-4 h-4 text-emerald-600" /> Semua data akumulasi akan langsung dikalkulasikan secara real-time.
              </span>
              <button
                onClick={() => setIsShrinkageModalOpen(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Tutup Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
