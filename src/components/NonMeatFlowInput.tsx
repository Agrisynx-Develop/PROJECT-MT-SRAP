import React, { useState, useEffect, useRef } from 'react';
import {
  ReportCategory,
  Store,
  GrnRecord,
  ClosingPlanRecord,
  StockAdjustment,
} from '../types';
import {
  CatalogProduct,
  SOSIS_KENTANG_CATALOG,
  FILLET_DORI_CATALOG,
  PARTING_AYAM_CATALOG,
} from '../utils/productCatalog';
import { getHMinus1ClosingStock } from '../utils/dateUtils';
import { isMatchPlan } from '../utils/storeHelper';
import { processHighResImage } from '../utils/imageCompressor';
import {
  PackagePlus,
  ShoppingCart,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Scale,
  Save,
  Truck,
  FileText,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Camera,
  Upload,
  Eye,
  Image as ImageIcon,
  Trash2,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

interface NonMeatFlowInputProps {
  category: ReportCategory;
  currentStore: Store;
  selectedDate: string; // YYYY-MM-DD
  grnRecords: GrnRecord[];
  closingRecords: ClosingPlanRecord[];
  adjustments: StockAdjustment[];
  onSaveGrn: (records: GrnRecord[]) => void;
  onSaveSales: (itemsSales: { planName: string; salesKg: number }[]) => void;
  onNavigateToClosing: (cat: ReportCategory) => void;
}

interface PartingItemEntry {
  tally: string;
  bruto: string;
  netto: string;
  photoUrl: string;
}

export default function NonMeatFlowInput({
  category,
  currentStore,
  selectedDate,
  grnRecords,
  closingRecords,
  adjustments,
  onSaveGrn,
  onSaveSales,
  onNavigateToClosing,
}: NonMeatFlowInputProps) {
  // Current active step in the flow: 1 = Display / Penerimaan, 2 = Sales
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Sub-category tabs for Kentang Sosis Dori
  const [subTab, setSubTab] = useState<'SOSIS_KENTANG' | 'FILLET_DORI'>('SOSIS_KENTANG');

  // Products for the current category
  const products: CatalogProduct[] =
    category === 'PARTING_AYAM'
      ? PARTING_AYAM_CATALOG
      : subTab === 'SOSIS_KENTANG'
      ? SOSIS_KENTANG_CATALOG
      : FILLET_DORI_CATALOG;

  // General GRN Form State (for Kentang, Sosis & Dori)
  const [grnInputs, setGrnInputs] = useState<Record<string, string>>({});
  const [supplierInput, setSupplierInput] = useState('');
  const [noSuratJalanInput, setNoSuratJalanInput] = useState('');

  // Parting Ayam Specific Entry: Tally, Bruto, Netto, Foto Timbangan Display
  const [partingEntries, setPartingEntries] = useState<Record<string, PartingItemEntry>>({});

  // Sales Form State: map of product name/code -> salesKg input
  const [salesInputs, setSalesInputs] = useState<Record<string, string>>({});

  const [notification, setNotification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Photo Upload / Camera Modal State
  const [activePhotoModal, setActivePhotoModal] = useState<{
    productName: string;
    itemCode?: string;
  } | null>(null);
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string>('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fullscreen Photo Preview Modal
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string } | null>(null);

  // Populate existing GRN and Sales values for today
  useEffect(() => {
    const todayGrns = grnRecords.filter((g) => (g.date || '').split('T')[0] === selectedDate);

    // Initial GRN inputs for Sosis / Kentang / Dori
    const initialGrn: Record<string, string> = {};
    todayGrns.forEach((g) => {
      if (g.weightKg > 0) {
        initialGrn[g.productName] = g.weightKg.toString();
      }
    });
    setGrnInputs(initialGrn);

    // Initial Parting Entries (Tally, Bruto, Netto, Photo)
    const initialParting: Record<string, PartingItemEntry> = {};
    todayGrns.forEach((g) => {
      if (g.reportCategory === 'PARTING_AYAM' || category === 'PARTING_AYAM') {
        initialParting[g.productName] = {
          tally: typeof g.tallyKg === 'number' && g.tallyKg > 0 ? String(g.tallyKg) : g.weightKg > 0 ? String(g.weightKg) : '',
          bruto: typeof g.brutoKg === 'number' && g.brutoKg > 0 ? String(g.brutoKg) : '',
          netto: typeof g.nettoKg === 'number' && g.nettoKg > 0 ? String(g.nettoKg) : g.weightKg > 0 ? String(g.weightKg) : '',
          photoUrl: g.photoUrl || '',
        };
      }
    });

    // Also check closing records for today if already closed
    closingRecords
      .filter((c) => (c.date || '').split('T')[0] === selectedDate)
      .forEach((c) => {
        if (!initialParting[c.planName]) {
          initialParting[c.planName] = {
            tally: typeof c.tallyKg === 'number' && c.tallyKg > 0 ? String(c.tallyKg) : '',
            bruto: typeof c.brutoKg === 'number' && c.brutoKg > 0 ? String(c.brutoKg) : '',
            netto: typeof c.nettoKg === 'number' && c.nettoKg > 0 ? String(c.nettoKg) : '',
            photoUrl: c.displayPhotoUrl || c.photoUrl || '',
          };
        }
      });

    setPartingEntries(initialParting);

    // Populate existing sales values for today
    const initialSales: Record<string, string> = {};
    closingRecords
      .filter((c) => (c.date || '').split('T')[0] === selectedDate)
      .forEach((c) => {
        if (c.salesKg > 0) {
          initialSales[c.planName] = c.salesKg.toString();
        }
      });
    setSalesInputs(initialSales);
  }, [category, selectedDate, grnRecords, closingRecords]);

  // Update a field for Parting Ayam
  const handleUpdatePartingField = (
    productName: string,
    field: 'tally' | 'bruto' | 'netto',
    value: string
  ) => {
    setPartingEntries((prev) => {
      const current = prev[productName] || { tally: '', bruto: '', netto: '', photoUrl: '' };
      return {
        ...prev,
        [productName]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  // Handle Photo File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setErrorMsg(null);

    try {
      const optimized = await processHighResImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
      });
      setTempPhotoUrl(optimized);
    } catch (err) {
      console.error('Gagal memproses foto timbangan:', err);
      setErrorMsg('Gagal memproses foto timbangan. Harap pilih foto lain atau coba lagi.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Save photo to active item
  const handleSavePhotoModal = () => {
    if (!activePhotoModal) return;
    if (!tempPhotoUrl) {
      setErrorMsg('Foto timbangan wajib dipilih atau diambil!');
      return;
    }

    setPartingEntries((prev) => {
      const current = prev[activePhotoModal.productName] || { tally: '', bruto: '', netto: '', photoUrl: '' };
      return {
        ...prev,
        [activePhotoModal.productName]: {
          ...current,
          photoUrl: tempPhotoUrl,
        },
      };
    });

    setActivePhotoModal(null);
    setTempPhotoUrl('');
    setErrorMsg(null);
  };

  // Apply single photo to all filled parting products (Batch apply)
  const handleApplyPhotoToAllFilled = () => {
    if (!tempPhotoUrl) {
      setErrorMsg('Harap pilih foto terlebih dahulu.');
      return;
    }

    setPartingEntries((prev) => {
      const updated = { ...prev };
      PARTING_AYAM_CATALOG.forEach((p) => {
        const item = updated[p.name] || { tally: '', bruto: '', netto: '', photoUrl: '' };
        if (item.tally || item.netto || item.bruto) {
          updated[p.name] = {
            ...item,
            photoUrl: tempPhotoUrl,
          };
        }
      });
      return updated;
    });

    setNotification('✓ Foto timbangan berhasil diterapkan ke semua item yang memiliki data timbangan!');
    setActivePhotoModal(null);
    setTempPhotoUrl('');
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle GRN / Display submission and proceed to Step 2
  const handleSaveGrnAndProceed = () => {
    const recordsToSave: GrnRecord[] = [];

    if (category === 'PARTING_AYAM') {
      PARTING_AYAM_CATALOG.forEach((prod) => {
        const entry = partingEntries[prod.name];
        if (entry) {
          const t = parseFloat((entry.tally || '').replace(',', '.')) || 0;
          const b = parseFloat((entry.bruto || '').replace(',', '.')) || 0;
          const n = parseFloat((entry.netto || '').replace(',', '.')) || 0;

          // Only save if at least one weight is entered
          if (t > 0 || n > 0 || b > 0) {
            const susutBeli = t > 0 && n > 0 ? Math.max(0, t - n) : 0;
            const susutReal = b > 0 && n > 0 ? Math.max(0, b - n) : 0;
            const susutPercent = t > 0 && n > 0 ? ((t - n) / t) * 100 : 0;

            recordsToSave.push({
              id: `grn_${currentStore.id}_${selectedDate}_${prod.itemCode || prod.name.replace(/\s+/g, '_')}`,
              storeId: currentStore.id,
              date: selectedDate,
              reportCategory: 'PARTING_AYAM',
              subCategory: 'PARTING AYAM',
              itemCode: prod.itemCode,
              plu: prod.plu,
              productName: prod.name,
              weightKg: n > 0 ? n : t, // Netto masuk sebagai stok display yang tersedia
              tallyKg: t > 0 ? t : undefined,
              brutoKg: b > 0 ? b : undefined,
              nettoKg: n > 0 ? n : undefined,
              susutBeliKg: susutBeli,
              susutRealKg: susutReal,
              susutPercent: susutPercent,
              photoUrl: entry.photoUrl || undefined,
              supplier: supplierInput.trim() || undefined,
              noSuratJalan: noSuratJalanInput.trim() || undefined,
              receivedBy: 'Petugas Butcher',
              createdAt: new Date().toISOString(),
            });
          }
        }
      });
    } else {
      const allProducts = [...SOSIS_KENTANG_CATALOG, ...FILLET_DORI_CATALOG];
      allProducts.forEach((prod) => {
        const valStr = grnInputs[prod.name];
        if (valStr) {
          const w = parseFloat(valStr.replace(',', '.'));
          if (!isNaN(w) && w >= 0) {
            recordsToSave.push({
              id: `grn_${currentStore.id}_${selectedDate}_${prod.itemCode || prod.name.replace(/\s+/g, '_')}`,
              storeId: currentStore.id,
              date: selectedDate,
              reportCategory: prod.reportCategory,
              subCategory: prod.subCategory,
              itemCode: prod.itemCode,
              plu: prod.plu,
              productName: prod.name,
              weightKg: w,
              supplier: supplierInput.trim() || undefined,
              noSuratJalan: noSuratJalanInput.trim() || undefined,
              receivedBy: 'Petugas Butcher',
              createdAt: new Date().toISOString(),
            });
          }
        }
      });
    }

    if (recordsToSave.length > 0) {
      onSaveGrn(recordsToSave);
      setNotification(`✓ Berhasil menyimpan ${recordsToSave.length} data timbangan display!`);
    } else {
      setNotification('✓ Dilanjutkan ke Update Penjualan Sales.');
    }

    setTimeout(() => setNotification(null), 3000);
    setCurrentStep(2);
  };

  // Handle Sales submission and proceed to Closing
  const handleSaveSalesAndProceedToClosing = () => {
    const salesList: { planName: string; salesKg: number }[] = [];
    const allProducts =
      category === 'PARTING_AYAM'
        ? PARTING_AYAM_CATALOG
        : [...SOSIS_KENTANG_CATALOG, ...FILLET_DORI_CATALOG];

    allProducts.forEach((prod) => {
      const valStr = salesInputs[prod.name];
      if (valStr) {
        const s = parseFloat(valStr.replace(',', '.'));
        if (!isNaN(s) && s >= 0) {
          salesList.push({
            planName: prod.name,
            salesKg: s,
          });
        }
      }
    });

    if (salesList.length > 0) {
      onSaveSales(salesList);
      setNotification(`✓ Berhasil menyimpan data penjualan untuk ${salesList.length} item!`);
    }

    setTimeout(() => {
      setNotification(null);
      onNavigateToClosing(category);
    }, 600);
  };

  // Calculations for Step 1 Parting Ayam Summary Bar
  let totalPartingTally = 0;
  let totalPartingBruto = 0;
  let totalPartingNetto = 0;
  let totalPartingSusutBeli = 0;
  let countPhotos = 0;

  if (category === 'PARTING_AYAM') {
    PARTING_AYAM_CATALOG.forEach((p) => {
      const entry = partingEntries[p.name];
      if (entry) {
        const t = parseFloat((entry.tally || '').replace(',', '.')) || 0;
        const b = parseFloat((entry.bruto || '').replace(',', '.')) || 0;
        const n = parseFloat((entry.netto || '').replace(',', '.')) || 0;
        totalPartingTally += t;
        totalPartingBruto += b;
        totalPartingNetto += n;
        if (t > 0 && n > 0) {
          totalPartingSusutBeli += Math.max(0, t - n);
        }
        if (entry.photoUrl) {
          countPhotos += 1;
        }
      }
    });
  }

  const avgSusutBeliPercent =
    totalPartingTally > 0 ? (totalPartingSusutBeli / totalPartingTally) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Progress Flow Banner (Display -> Sales -> Closing) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-md text-white ${category === 'PARTING_AYAM' ? 'bg-emerald-700' : 'bg-amber-500'}`}>
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Alur Input {category === 'PARTING_AYAM' ? 'Parting Ayam Fresh' : 'Kentang, Sosis & Fillet Dori'}
              </h2>
              <p className="text-xs text-slate-500">
                {category === 'PARTING_AYAM'
                  ? 'Alur Display & Kontrol Susut: Input Timbangan Display (Tally, Bruto, Netto & Foto) ➔ Update Sales ➔ Closing Fisik Malam (Susut Jual)'
                  : 'Alur Cepat: Input GRN Masuk ➔ Update Sales Kasir ➔ Closing Fisik Malam'}
              </p>
            </div>
          </div>

          {/* Stepper buttons */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setCurrentStep(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                currentStep === 1
                  ? category === 'PARTING_AYAM'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              <span>{category === 'PARTING_AYAM' ? 'Timbangan Display' : 'Input GRN'}</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setCurrentStep(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                currentStep === 2
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              <span>Update Sales</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => onNavigateToClosing(category)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-rose-600 flex items-center gap-1.5 transition"
            >
              <span className="w-4 h-4 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[10px]">3</span>
              <span>Menu Closing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Subcategory Filter for Kentang Sosis Dori */}
      {category === 'KENTANG_SOSIS_DORI' && (
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setSubTab('SOSIS_KENTANG')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              subTab === 'SOSIS_KENTANG'
                ? 'bg-amber-500 text-slate-900 shadow-md font-black'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>🌭🍟 Laporan Stock Sosis & Kentang (15 Item)</span>
          </button>
          <button
            onClick={() => setSubTab('FILLET_DORI')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              subTab === 'FILLET_DORI'
                ? 'bg-orange-600 text-white shadow-md font-black'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>🐟 Laporan Stock Fillet Dori (4 Item)</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: INPUT TIMBANGAN DISPLAY (PARTING AYAM) vs GRN (NON-MEAT)          */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Info */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>
                  {category === 'PARTING_AYAM'
                    ? 'Langkah 1: Input Timbangan Ayam Parting Saat Akan Didisplay'
                    : 'Langkah 1: Input Penerimaan Barang Masuk (GRN Hari Ini)'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {category === 'PARTING_AYAM'
                  ? 'Input Tally Label, Bruto, dan Netto hasil timbangan sebelum didisplay ke showcase beserta Foto Timbangan. Susut Beli = Tally - Netto dihitung otomatis.'
                  : 'Catat berat timbangan barang masuk dari supplier atau gudang hari ini.'}
              </p>
            </div>

            {/* Optional Metadata Supplier & No Surat Jalan */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Supplier (Opsional)"
                value={supplierInput}
                onChange={(e) => setSupplierInput(e.target.value)}
                className="text-xs py-1.5 px-3 border border-slate-300 rounded-lg bg-white"
              />
              <input
                type="text"
                placeholder="No. Surat Jalan / Nota"
                value={noSuratJalanInput}
                onChange={(e) => setNoSuratJalanInput(e.target.value)}
                className="text-xs py-1.5 px-3 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          {/* Executive Stat Bar for Parting Ayam */}
          {category === 'PARTING_AYAM' && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-emerald-50/50 border-b border-emerald-100 text-xs">
              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Tally Masuk</span>
                <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  {totalPartingTally.toFixed(3)} Kg
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Bruto</span>
                <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  {totalPartingBruto.toFixed(3)} Kg
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Netto Display</span>
                <div className="text-sm font-black text-emerald-800 font-mono mt-0.5">
                  {totalPartingNetto.toFixed(3)} Kg
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs">
                <span className="text-[10px] font-bold text-rose-700 uppercase block">Total Susut Beli</span>
                <div className="text-sm font-black text-rose-700 font-mono mt-0.5">
                  {totalPartingSusutBeli.toFixed(3)} Kg{' '}
                  <span className="text-[11px] font-semibold text-rose-600">({avgSusutBeliPercent.toFixed(2)}%)</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Foto Timbangan Display</span>
                <div className="text-sm font-black text-blue-800 font-mono mt-0.5 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>{countPhotos} / {PARTING_AYAM_CATALOG.length} Terlampir</span>
                </div>
              </div>
            </div>
          )}

          {/* TABLE INPUT STEP 1 */}
          <div className="overflow-x-auto">
            {category === 'PARTING_AYAM' ? (
              /* PARTING AYAM SPECIFIC TABLE (Tally, Bruto, Netto, Susut Beli, Foto Timbangan) */
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-200 text-[11px]">
                  <tr className="divide-x divide-slate-200">
                    <th className="py-2.5 px-2.5 w-10 text-center">NO</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Item Produk Parting</th>
                    <th className="py-2.5 px-3 w-28 text-right bg-slate-50">Stok Kemarin</th>
                    <th className="py-2.5 px-3 w-32 text-right bg-yellow-100 text-slate-950">
                      Tally Label (Kg)
                    </th>
                    <th className="py-2.5 px-3 w-32 text-right bg-yellow-50 text-slate-900">
                      Bruto (Kg)
                    </th>
                    <th className="py-2.5 px-3 w-32 text-right bg-emerald-100 text-emerald-950 font-black">
                      Netto Display (Kg)
                    </th>
                    <th className="py-2.5 px-3 w-28 text-right bg-rose-50 text-rose-800 font-bold">
                      Susut Beli (Kg)
                    </th>
                    <th className="py-2.5 px-2.5 w-24 text-right bg-rose-50 text-rose-800 font-bold">
                      % Susut
                    </th>
                    <th className="py-2.5 px-3 w-40 text-center bg-blue-50 text-blue-900">
                      Foto Timbangan Display
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PARTING_AYAM_CATALOG.map((p, idx) => {
                    const h1Stock = getHMinus1ClosingStock(closingRecords, currentStore, p.name, selectedDate) || 0;
                    const entry = partingEntries[p.name] || { tally: '', bruto: '', netto: '', photoUrl: '' };

                    const t = parseFloat((entry.tally || '').replace(',', '.')) || 0;
                    const b = parseFloat((entry.bruto || '').replace(',', '.')) || 0;
                    const n = parseFloat((entry.netto || '').replace(',', '.')) || 0;

                    const susutBeli = t > 0 && n > 0 ? Math.max(0, t - n) : 0;
                    const susutPercent = t > 0 && n > 0 ? ((t - n) / t) * 100 : 0;
                    const hasPhoto = Boolean(entry.photoUrl);

                    return (
                      <tr key={p.itemCode || idx} className="hover:bg-slate-50/80 transition divide-x divide-slate-100">
                        <td className="py-2 px-2 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            PLU: {p.plu || '-'} &bull; Code: {p.itemCode}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500 bg-slate-50/50">
                          {h1Stock > 0 ? h1Stock.toFixed(3) : '0.000'}
                        </td>

                        {/* TALLY LABEL */}
                        <td className="py-1.5 px-2.5 text-right bg-yellow-50/40">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            value={entry.tally}
                            onChange={(e) => handleUpdatePartingField(p.name, 'tally', e.target.value)}
                            className="w-24 py-1 px-2 border border-yellow-300 rounded-md text-right font-mono font-bold text-xs bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                          />
                        </td>

                        {/* BRUTO */}
                        <td className="py-1.5 px-2.5 text-right bg-yellow-50/20">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            value={entry.bruto}
                            onChange={(e) => handleUpdatePartingField(p.name, 'bruto', e.target.value)}
                            className="w-24 py-1 px-2 border border-slate-300 rounded-md text-right font-mono text-xs bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                          />
                        </td>

                        {/* NETTO DISPLAY */}
                        <td className="py-1.5 px-2.5 text-right bg-emerald-50/60">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            value={entry.netto}
                            onChange={(e) => handleUpdatePartingField(p.name, 'netto', e.target.value)}
                            className="w-24 py-1 px-2 border border-emerald-400 rounded-md text-right font-mono font-black text-xs bg-white text-emerald-950 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </td>

                        {/* SUSUT BELI */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 bg-rose-50/30">
                          {susutBeli > 0 ? susutBeli.toFixed(3) : '-'}
                        </td>

                        {/* % SUSUT BELI */}
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-rose-700 bg-rose-50/30">
                          {susutPercent > 0 ? `${susutPercent.toFixed(2)}%` : '-'}
                        </td>

                        {/* FOTO TIMBANGAN DISPLAY */}
                        <td className="py-1.5 px-2.5 text-center bg-blue-50/20">
                          <div className="flex items-center justify-center gap-1.5">
                            {hasPhoto ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto({ title: `Foto Timbangan Display: ${p.name}`, url: entry.photoUrl })}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md text-[10px] font-bold border border-emerald-300 transition cursor-pointer"
                                  title="Lihat Foto Bukti Timbangan Display"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Ada Foto</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePhotoModal({ productName: p.name, itemCode: p.itemCode });
                                    setTempPhotoUrl(entry.photoUrl);
                                  }}
                                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                                  title="Ubah Foto"
                                >
                                  <Camera className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePhotoModal({ productName: p.name, itemCode: p.itemCode });
                                  setTempPhotoUrl('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold shadow-2xs transition cursor-pointer"
                                title="Upload / Ambil Foto Timbangan Display"
                              >
                                <Camera className="w-3 h-3" />
                                <span>+ Foto</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* STANDARD GRN TABLE FOR SOSIS, KENTANG & DORI */
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">NO</th>
                    <th className="py-2.5 px-3 w-24">Item Code</th>
                    <th className="py-2.5 px-3 w-20">PLU</th>
                    <th className="py-2.5 px-4">Nama Produk</th>
                    <th className="py-2.5 px-3 w-32 text-right">Stok Kemarin (H-1)</th>
                    <th className="py-2.5 px-4 w-44 text-right bg-yellow-100 text-slate-900">
                      Input GRN Masuk (Kg)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p, idx) => {
                    const h1Stock = getHMinus1ClosingStock(closingRecords, currentStore, p.name, selectedDate) || 0;
                    const currentVal = grnInputs[p.name] || '';

                    return (
                      <tr key={p.itemCode || idx} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{p.itemCode}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{p.plu}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {h1Stock > 0 ? h1Stock.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-4 text-right bg-yellow-50">
                          <div className="relative flex items-center justify-end">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder="0.000"
                              value={currentVal}
                              onChange={(e) =>
                                setGrnInputs((prev) => ({
                                  ...prev,
                                  [p.name]: e.target.value,
                                }))
                              }
                              className="w-32 py-1.5 px-2.5 border border-yellow-300 rounded-lg text-right font-mono font-bold text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <span className="ml-1 text-[11px] font-bold text-slate-500">Kg</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Tips: Item tanpa barang masuk hari ini dapat dikosongkan. Data Netto otomatis menjadi stok yang siap dijual.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Lewati ke Sales ➜
              </button>
              <button
                type="button"
                onClick={handleSaveGrnAndProceed}
                className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer ${
                  category === 'PARTING_AYAM'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Simpan Timbangan & Lanjut ke Update Sales ➜</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: UPDATE DATA PENJUALAN (SALES)                                     */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-emerald-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <span>Langkah 2: Update Data Penjualan (Sales Kasir Harian)</span>
              </h3>
              <p className="text-xs text-emerald-700">
                Masukkan total penjualan kasir hari ini ({selectedDate}). Stok Sistem akan otomatis terhitung: Total Real - Penjualan.
              </p>
            </div>

            <button
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Timbangan</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">NO</th>
                  <th className="py-2.5 px-4">Nama Produk</th>
                  <th className="py-2.5 px-3 w-28 text-right">Stok Kemarin</th>
                  <th className="py-2.5 px-3 w-28 text-right bg-yellow-50 text-slate-800">
                    {category === 'PARTING_AYAM' ? 'Netto Display' : 'GRN Hari Ini'}
                  </th>
                  {category === 'PARTING_AYAM' && (
                    <th className="py-2.5 px-3 w-24 text-right bg-rose-50 text-rose-700">Susut Beli</th>
                  )}
                  <th className="py-2.5 px-3 w-24 text-right">adj (+/-)</th>
                  <th className="py-2.5 px-3 w-28 text-right bg-yellow-100 text-slate-900 font-black">Total Real</th>
                  <th className="py-2.5 px-4 w-40 text-right bg-emerald-100 text-emerald-900">
                    Input Penjualan (Kg)
                  </th>
                  <th className="py-2.5 px-3 w-32 text-right font-bold text-slate-700">Stok By Sistem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p, idx) => {
                  const h1Stock = getHMinus1ClosingStock(closingRecords, currentStore, p.name, selectedDate) || 0;

                  // Read incoming display / GRN weight
                  let grnVal = 0;
                  let susutBeliVal = 0;

                  if (category === 'PARTING_AYAM') {
                    const pe = partingEntries[p.name];
                    const t = parseFloat((pe?.tally || '').replace(',', '.')) || 0;
                    const n = parseFloat((pe?.netto || '').replace(',', '.')) || 0;
                    grnVal = n > 0 ? n : t;
                    if (t > 0 && n > 0) {
                      susutBeliVal = Math.max(0, t - n);
                    }
                  } else {
                    grnVal = parseFloat((grnInputs[p.name] || '0').replace(',', '.')) || 0;
                  }

                  // Adjustments
                  const pAdjs = adjustments.filter(
                    (a) =>
                      (a.date || '').split('T')[0] === selectedDate &&
                      (isMatchPlan(a.planName, p.name) || isMatchPlan(a.meatName, p.name))
                  );
                  const netAdj =
                    pAdjs.filter((a) => a.type === 'IN').reduce((sum, a) => sum + (a.weightKg || 0), 0) -
                    pAdjs.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + (a.weightKg || 0), 0);

                  const totalReal = h1Stock + grnVal + netAdj;
                  const currentSalesStr = salesInputs[p.name] || '';
                  const salesNum = parseFloat(currentSalesStr.replace(',', '.')) || 0;
                  const stokBySistem = Math.max(0, totalReal - salesNum);

                  return (
                    <tr key={p.itemCode || idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {h1Stock > 0 ? h1Stock.toFixed(3) : '0.000'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold bg-yellow-50 text-slate-800">
                        {grnVal > 0 ? grnVal.toFixed(3) : '-'}
                      </td>
                      {category === 'PARTING_AYAM' && (
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 bg-rose-50/40">
                          {susutBeliVal > 0 ? susutBeliVal.toFixed(3) : '-'}
                        </td>
                      )}
                      <td className={`py-2.5 px-3 text-right font-mono ${netAdj !== 0 ? (netAdj > 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'}`}>
                        {netAdj !== 0 ? netAdj.toFixed(3) : '0.000'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black bg-yellow-100 text-slate-900">
                        {totalReal.toFixed(3)}
                      </td>
                      <td className="py-2 px-4 text-right bg-emerald-50">
                        <div className="relative flex items-center justify-end">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            value={currentSalesStr}
                            onChange={(e) =>
                              setSalesInputs((prev) => ({
                                ...prev,
                                [p.name]: e.target.value,
                              }))
                            }
                            className="w-28 py-1.5 px-2 border border-emerald-300 rounded-lg text-right font-mono font-bold text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="ml-1 text-[11px] font-bold text-slate-500">Kg</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                        {stokBySistem.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Setelah menyimpan sales, sistem akan membuka <strong>Menu Closing</strong> untuk input sisa stock fisik malam dengan foto timbangan closing &amp; menghitung <strong>Susut Jual</strong>.
            </div>
            <button
              type="button"
              onClick={handleSaveSalesAndProceedToClosing}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Sales &amp; Masuk ke Menu Closing (Timbang Malam) ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL UPLOAD / AMBIL FOTO TIMBANGAN DISPLAY                              */}
      {/* ========================================================================= */}
      {activePhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-sm">Foto Timbangan Display</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePhotoModal(null);
                  setTempPhotoUrl('');
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="text-xs text-slate-500 font-semibold">Produk:</div>
                <div className="text-sm font-black text-slate-900">{activePhotoModal.productName}</div>
                {activePhotoModal.itemCode && (
                  <div className="text-[11px] font-mono text-slate-500">Code: {activePhotoModal.itemCode}</div>
                )}
              </div>

              {/* Photo Area */}
              <div className="space-y-2">
                {tempPhotoUrl ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 max-h-64 flex items-center justify-center">
                    <img
                      src={tempPhotoUrl}
                      alt="Timbangan Display"
                      className="w-full h-auto max-h-60 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setTempPhotoUrl('')}
                      className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-md transition cursor-pointer"
                      title="Hapus foto ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer transition flex flex-col items-center justify-center gap-2"
                  >
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-bold text-slate-700">Klik untuk Ambil / Upload Foto Timbangan</div>
                    <div className="text-[11px] text-slate-400">Dukung kamera HP / Tablet & upload galeri foto</div>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {isProcessingPhoto && (
                  <div className="flex items-center justify-center gap-2 text-xs text-blue-600 font-bold py-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengoptimalkan resolusi foto...</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{tempPhotoUrl ? 'Ganti Foto' : 'Ambil Foto'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePhotoModal}
                    disabled={!tempPhotoUrl}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Foto Item Ini</span>
                  </button>
                </div>

                {/* Batch Button */}
                <button
                  type="button"
                  onClick={handleApplyPhotoToAllFilled}
                  disabled={!tempPhotoUrl}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Gunakan foto timbangan yang sama untuk semua item yang sudah terisi"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Gunakan Foto Ini untuk Semua Item Terisi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FULLSCREEN PHOTO PREVIEW MODAL                                            */}
      {/* ========================================================================= */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-700">
            <div className="p-3 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300">{previewPhoto.title}</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/40">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
