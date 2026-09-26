import React, { useState, useEffect, useMemo } from 'react';
import {
  ClosingPlanRecord,
  GrnRecord,
  StockAdjustment,
  Store,
  UserAccount,
} from '../types';
import {
  PARTING_AYAM_CATALOG,
  CatalogProduct,
} from '../utils/productCatalog';
import { matchStoreEntity } from '../utils/reportCalculations';
import { processHighResImage } from '../utils/imageCompressor';
import { getDeterministicClosingRecordId, isMatchPlan } from '../utils/storeHelper';
import { getPreviousDateStr, findHMinus1ClosingRecord } from '../utils/dateUtils';
import {
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Camera,
  Upload,
  RefreshCw,
  X,
  ZoomIn,
  Save,
  Calculator,
  Trash2,
  Edit2,
  Search,
  Filter,
  Eye,
  Scale,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface MissedPartingAyamFormProps {
  currentStore: Store;
  currentUser: UserAccount;
  selectedDate: string; // YYYY-MM-DD
  closingRecords: ClosingPlanRecord[];
  grnRecords?: GrnRecord[];
  adjustments?: StockAdjustment[];
  onSaveClosingRecord: (record: Omit<ClosingPlanRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
  onSaveGrn?: (records: GrnRecord[] | GrnRecord) => void;
  onDeleteClosingRecord?: (id: string) => void;
  onViewPhoto?: (url: string, title: string) => void;
  onNotifyMsg?: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export default function MissedPartingAyamForm({
  currentStore,
  currentUser,
  selectedDate,
  closingRecords = [],
  grnRecords = [],
  adjustments = [],
  onSaveClosingRecord,
  onSaveGrn,
  onDeleteClosingRecord,
  onViewPhoto,
  onNotifyMsg,
}: MissedPartingAyamFormProps) {
  // Sub-category filter
  const [subFilter, setSubFilter] = useState<'ALL' | 'PAHA' | 'DADA' | 'SAYAP_LAINNYA'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Categorize parting products
  const filteredCatalog = useMemo(() => {
    let list = PARTING_AYAM_CATALOG;
    if (subFilter === 'PAHA') {
      list = list.filter((p) => p.name.toUpperCase().includes('PAHA'));
    } else if (subFilter === 'DADA') {
      list = list.filter((p) => p.name.toUpperCase().includes('DADA') || p.name.toUpperCase().includes('FILLET AYAM'));
    } else if (subFilter === 'SAYAP_LAINNYA') {
      list = list.filter(
        (p) =>
          !p.name.toUpperCase().includes('PAHA') &&
          !p.name.toUpperCase().includes('DADA') &&
          !p.name.toUpperCase().includes('FILLET AYAM')
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.itemCode?.toLowerCase().includes(q) ||
          p.plu?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [subFilter, searchQuery]);

  // Selected product
  const [selectedProductName, setSelectedProductName] = useState<string>(PARTING_AYAM_CATALOG[0].name);

  const selectedProduct = useMemo(() => {
    return PARTING_AYAM_CATALOG.find((p) => p.name === selectedProductName) || PARTING_AYAM_CATALOG[0];
  }, [selectedProductName]);

  // Form inputs
  const [openingStock, setOpeningStock] = useState<string>('');
  const [tallyKg, setTallyKg] = useState<string>('');
  const [brutoKg, setBrutoKg] = useState<string>('');
  const [nettoKg, setNettoKg] = useState<string>('');
  const [displayPhotoUrl, setDisplayPhotoUrl] = useState<string>('');
  const [isOptimizingDisplayPhoto, setIsOptimizingDisplayPhoto] = useState<boolean>(false);

  const [adjInKg, setAdjInKg] = useState<string>('');
  const [adjOutKg, setAdjOutKg] = useState<string>('');
  const [salesKg, setSalesKg] = useState<string>('');
  const [closingStock, setClosingStock] = useState<string>('');
  const [closingPhotoUrl, setClosingPhotoUrl] = useState<string>('');
  const [isOptimizingClosingPhoto, setIsOptimizingClosingPhoto] = useState<boolean>(false);

  const [costPerKg, setCostPerKg] = useState<string>('');
  const [salePricePerKg, setSalePricePerKg] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // H-1 Lookup
  const h1DateStr = useMemo(() => getPreviousDateStr(selectedDate), [selectedDate]);
  const h1Record = useMemo(() => {
    return findHMinus1ClosingRecord(closingRecords, currentStore, selectedProduct.name, selectedDate);
  }, [closingRecords, currentStore, selectedProduct.name, selectedDate]);

  // Auto-fill when selectedDate or selectedProduct changes
  useEffect(() => {
    if (editingId) return;

    const existingForDate = (closingRecords || []).find(
      (c) =>
        matchStoreEntity(c.storeId, currentStore) &&
        (c.date || c.timestamp || '').startsWith(selectedDate) &&
        (isMatchPlan(c.planName, selectedProduct.name) || (selectedProduct.itemCode && c.itemCode === selectedProduct.itemCode))
    );

    const existingGrn = (grnRecords || []).find(
      (g) =>
        (g.date || '').split('T')[0] === selectedDate &&
        (isMatchPlan(g.productName, selectedProduct.name) || (selectedProduct.itemCode && g.itemCode === selectedProduct.itemCode))
    );

    const existingAdjs = (adjustments || []).filter(
      (a) =>
        (a.date || '').split('T')[0] === selectedDate &&
        (isMatchPlan(a.planName, selectedProduct.name) || (selectedProduct.itemCode && a.itemCode === selectedProduct.itemCode))
    );
    const adjIn = existingAdjs.filter((a) => a.type === 'IN').reduce((s, a) => s + (a.weightKg || 0), 0);
    const adjOut = existingAdjs.filter((a) => a.type === 'OUT').reduce((s, a) => s + (a.weightKg || 0), 0);

    if (existingForDate) {
      const effectiveOpening =
        existingForDate.openingStockKg !== undefined && existingForDate.openingStockKg > 0
          ? existingForDate.openingStockKg
          : h1Record?.actualClosingStockKg !== undefined
          ? h1Record.actualClosingStockKg
          : (existingForDate.openingStockKg ?? 0);

      setOpeningStock(String(effectiveOpening));
      setTallyKg(existingForDate.tallyKg ? String(existingForDate.tallyKg) : (existingGrn?.tallyKg ? String(existingGrn.tallyKg) : ''));
      setBrutoKg(existingForDate.brutoKg ? String(existingForDate.brutoKg) : (existingGrn?.brutoKg ? String(existingGrn.brutoKg) : ''));
      setNettoKg(existingForDate.nettoKg ? String(existingForDate.nettoKg) : (existingGrn?.nettoKg ? String(existingGrn.nettoKg) : (existingForDate.grnKg ? String(existingForDate.grnKg) : '')));
      setDisplayPhotoUrl(existingForDate.displayPhotoUrl || existingGrn?.photoUrl || '');
      setAdjInKg(existingForDate.adjustInKg ? String(existingForDate.adjustInKg) : (adjIn > 0 ? String(adjIn) : ''));
      setAdjOutKg(existingForDate.adjustOutKg ? String(existingForDate.adjustOutKg) : (adjOut > 0 ? String(adjOut) : ''));
      setSalesKg(existingForDate.salesKg !== undefined ? String(existingForDate.salesKg) : '');
      setClosingStock(existingForDate.actualClosingStockKg !== undefined ? String(existingForDate.actualClosingStockKg) : '');
      setClosingPhotoUrl(existingForDate.photoUrl || '');
      setCostPerKg(String(existingForDate.costPerKg || selectedProduct.cogsPerKg || 0));
      setSalePricePerKg(String(existingForDate.sellingPricePerKg || selectedProduct.sellingPricePerKg || 0));
      setNote(existingForDate.note || '');
      return;
    }

    // Direct isolation from H-1
    if (h1Record && typeof h1Record.actualClosingStockKg === 'number') {
      setOpeningStock(String(h1Record.actualClosingStockKg));
    } else {
      setOpeningStock('0');
    }

    setTallyKg(existingGrn?.tallyKg ? String(existingGrn.tallyKg) : '');
    setBrutoKg(existingGrn?.brutoKg ? String(existingGrn.brutoKg) : '');
    setNettoKg(existingGrn?.nettoKg ? String(existingGrn.nettoKg) : '');
    setDisplayPhotoUrl(existingGrn?.photoUrl || '');
    setAdjInKg(adjIn > 0 ? String(adjIn) : '');
    setAdjOutKg(adjOut > 0 ? String(adjOut) : '');
    setSalesKg('');
    setClosingStock('');
    setClosingPhotoUrl('');
    setCostPerKg(String(selectedProduct.cogsPerKg || 0));
    setSalePricePerKg(String(selectedProduct.sellingPricePerKg || 0));
    setNote('');
  }, [selectedDate, selectedProduct.name, closingRecords, grnRecords, adjustments, currentStore.id, editingId, h1Record]);

  // Derived Calculations
  const openingNum = parseFloat(openingStock) || 0;
  const tallyNum = parseFloat(tallyKg) || 0;
  const brutoNum = parseFloat(brutoKg) || 0;
  const nettoNum = parseFloat(nettoKg) || 0;
  const adjInNum = parseFloat(adjInKg) || 0;
  const adjOutNum = parseFloat(adjOutKg) || 0;
  const netAdjNum = adjInNum - adjOutNum;

  // 1. Susut Beli (Berat Susut) = Tally - Netto
  const susutBeliNum = tallyNum > 0 && nettoNum > 0 ? Math.max(0, tallyNum - nettoNum) : 0;
  const susutPercentNum = tallyNum > 0 ? (susutBeliNum / tallyNum) * 100 : 0;

  // 2. Susut Real (Bruto - Netto)
  const susutRealNum = brutoNum > 0 && nettoNum > 0 ? Math.max(0, brutoNum - nettoNum) : 0;

  // 3. Total Real = Sisa Kemarin + Netto + (Adj In - Adj Out)
  const totalRealNum = openingNum + nettoNum + netAdjNum;

  // 4. Sales & Sisa Sistem
  const salesNum = parseFloat(salesKg) || 0;
  const stockBySistemNum = Math.max(0, totalRealNum - salesNum);

  // 5. Timbangan Fisik Closing & Susut Jual
  const closingStockNum = parseFloat(closingStock) || 0;
  const susutJualNum = Math.max(0, stockBySistemNum - closingStockNum);
  const susutJualPct = stockBySistemNum > 0 ? (susutJualNum / stockBySistemNum) * 100 : 0;

  // 6. Cost, Value Real, Value Process, Cost Real, and GP%
  const costNum = parseFloat(costPerKg) || selectedProduct.cogsPerKg || 0;
  const saleNum = parseFloat(salePricePerKg) || selectedProduct.sellingPricePerKg || 0;

  const valueRealNum = tallyNum * costNum;
  const valueProcessNum = nettoNum * costNum;
  const costRealNum = nettoNum > 0 && valueRealNum > 0 ? valueRealNum / nettoNum : costNum;
  const gpPercentNum = saleNum > 0 && costRealNum > 0 ? ((saleNum - costRealNum) / saleNum) * 100 : 0;

  // Photo Handlers
  const handleDisplayPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsOptimizingDisplayPhoto(true);
      const compressed = await processHighResImage(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
        format: 'image/jpeg',
      });
      setDisplayPhotoUrl(compressed);
    } catch (err) {
      console.error('Gagal mengompres foto timbangan display:', err);
    } finally {
      setIsOptimizingDisplayPhoto(false);
      e.target.value = '';
    }
  };

  const handleClosingPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsOptimizingClosingPhoto(true);
      const compressed = await processHighResImage(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
        format: 'image/jpeg',
      });
      setClosingPhotoUrl(compressed);
    } catch (err) {
      console.error('Gagal mengompres foto timbangan closing:', err);
    } finally {
      setIsOptimizingClosingPhoto(false);
      e.target.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isNaN(closingStockNum) || closingStockNum < 0 || !closingStock.trim()) {
      onNotifyMsg?.({ type: 'error', text: 'Harap masukkan angka Timbangan Sisa Fisik Closing yang valid (≥ 0)!' });
      return;
    }

    if (!closingPhotoUrl && !displayPhotoUrl) {
      onNotifyMsg?.({ type: 'error', text: '⚠️ Foto bukti timbangan fisik closing wajib diunggah!' });
      return;
    }

    const recId = editingId || `cpr_${currentStore.id}_parting_ayam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const recordToSave: ClosingPlanRecord = {
      id: recId,
      storeId: currentStore.id,
      date: selectedDate,
      planName: selectedProduct.name,
      itemCode: selectedProduct.itemCode,
      plu: selectedProduct.plu,
      category: 'PARTING_AYAM',
      reportCategory: 'PARTING_AYAM',
      subCategory: selectedProduct.subCategory,
      openingStockKg: parseFloat(openingNum.toFixed(3)),
      newProcessedKg: 0,
      grnKg: parseFloat(nettoNum.toFixed(3)),
      adjustInKg: parseFloat(adjInNum.toFixed(3)),
      adjustOutKg: parseFloat(adjOutNum.toFixed(3)),
      salesKg: parseFloat(salesNum.toFixed(3)),
      closingStockBySystemKg: parseFloat(stockBySistemNum.toFixed(3)),
      actualClosingStockKg: parseFloat(closingStockNum.toFixed(3)),
      susutJualKg: parseFloat(susutJualNum.toFixed(3)),
      // Parting ayam specific fields
      tallyKg: parseFloat(tallyNum.toFixed(3)),
      brutoKg: parseFloat(brutoNum.toFixed(3)),
      nettoKg: parseFloat(nettoNum.toFixed(3)),
      susutBeliKg: parseFloat(susutBeliNum.toFixed(3)),
      susutRealKg: parseFloat(susutRealNum.toFixed(3)),
      susutPercent: parseFloat(susutPercentNum.toFixed(2)),
      costPerKg: costNum,
      sellingPricePerKg: saleNum,
      valueReal: valueRealNum,
      valueProcess: valueProcessNum,
      costReal: costRealNum,
      gpPercent: gpPercentNum,
      displayPhotoUrl: displayPhotoUrl,
      photoUrl: closingPhotoUrl || displayPhotoUrl,
      photoCaption: `Closing Parting Ayam: ${selectedProduct.name} (${closingStockNum.toFixed(3)} Kg)`,
      note: note || '',
      butcherName: `${currentUser.fullName} (Input Susulan)`,
      timestamp: `${selectedDate}T17:00:00.000Z`,
    };

    onSaveClosingRecord(recordToSave);

    if ((nettoNum > 0 || tallyNum > 0) && onSaveGrn) {
      onSaveGrn({
        id: `grn_${currentStore.id}_${selectedProduct.itemCode || selectedProduct.name}_${selectedDate}`,
        storeId: currentStore.id,
        date: selectedDate,
        reportCategory: 'PARTING_AYAM',
        subCategory: selectedProduct.subCategory,
        itemCode: selectedProduct.itemCode,
        plu: selectedProduct.plu,
        productName: selectedProduct.name,
        weightKg: nettoNum > 0 ? nettoNum : tallyNum,
        tallyKg: tallyNum,
        brutoKg: brutoNum,
        nettoKg: nettoNum,
        susutBeliKg: susutBeliNum,
        susutRealKg: susutRealNum,
        susutPercent: susutPercentNum,
        photoUrl: displayPhotoUrl,
        receivedBy: currentUser.fullName,
        createdAt: `${selectedDate}T08:00:00.000Z`,
      });
    }

    onNotifyMsg?.({
      type: 'success',
      text: `✓ Data Parting Ayam "${selectedProduct.name}" tanggal ${selectedDate} berhasil disimpan! Tally: ${tallyNum.toFixed(3)} Kg, Netto: ${nettoNum.toFixed(3)} Kg, Susut Beli: ${susutBeliNum.toFixed(3)} Kg, Susut Jual: ${susutJualNum.toFixed(3)} Kg, Cost Real: Rp ${Math.round(costRealNum).toLocaleString('id-ID')}, GP: ${gpPercentNum.toFixed(1)}%.`,
    });

    setEditingId(null);
  };

  // Saved Parting Records for this date
  const savedRecordsForDate = useMemo(() => {
    return (closingRecords || []).filter(
      (c) =>
        matchStoreEntity(c.storeId, currentStore) &&
        (c.date || c.timestamp || '').startsWith(selectedDate) &&
        (c.reportCategory === 'PARTING_AYAM' ||
          c.category === 'PARTING_AYAM' ||
          PARTING_AYAM_CATALOG.some(
            (p) => isMatchPlan(p.name, c.planName) || (p.itemCode && c.itemCode === p.itemCode)
          ))
    );
  }, [closingRecords, currentStore, selectedDate]);

  const handleEditRecord = (rec: ClosingPlanRecord) => {
    setEditingId(rec.id);
    const matched = PARTING_AYAM_CATALOG.find((p) => isMatchPlan(p.name, rec.planName)) || PARTING_AYAM_CATALOG[0];
    setSelectedProductName(matched.name);
    setOpeningStock(rec.openingStockKg !== undefined ? String(rec.openingStockKg) : '');
    setTallyKg(rec.tallyKg !== undefined ? String(rec.tallyKg) : '');
    setBrutoKg(rec.brutoKg !== undefined ? String(rec.brutoKg) : '');
    setNettoKg(rec.nettoKg !== undefined ? String(rec.nettoKg) : (rec.grnKg ? String(rec.grnKg) : ''));
    setDisplayPhotoUrl(rec.displayPhotoUrl || '');
    setAdjInKg(rec.adjustInKg ? String(rec.adjustInKg) : '');
    setAdjOutKg(rec.adjustOutKg ? String(rec.adjustOutKg) : '');
    setSalesKg(rec.salesKg !== undefined ? String(rec.salesKg) : '');
    setClosingStock(rec.actualClosingStockKg !== undefined ? String(rec.actualClosingStockKg) : '');
    setClosingPhotoUrl(rec.photoUrl || '');
    setCostPerKg(String(rec.costPerKg || matched.cogsPerKg || 0));
    setSalePricePerKg(String(rec.sellingPricePerKg || matched.sellingPricePerKg || 0));
    setNote(rec.note || '');
  };

  const handleDeleteRecord = (id: string, name: string) => {
    if (window.confirm(`Hapus data closing terlewat Parting Ayam "${name}" pada tanggal ${selectedDate}?`)) {
      onDeleteClosingRecord?.(id);
      onNotifyMsg?.({ type: 'success', text: `Data "${name}" tanggal ${selectedDate} berhasil dihapus.` });
      if (editingId === id) setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form Container */}
      <div className="bg-white border border-emerald-200 rounded-2xl p-5 md:p-6 shadow-xs">
        {/* Form Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-emerald-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <Layers className="w-5 h-5" />
              </span>
              <h3 className="text-base font-black text-slate-900">
                {editingId ? 'Koreksi Laporan Terlewat: Parting Ayam' : 'Input Laporan Terlewat: Parting Ayam'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Catat sisa kemarin, display (tally, bruto, netto & foto timbangan), sales, serta closing fisik malam lengkap dengan susut beli & susut jual.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1 rounded-lg">
              Tanggal: {selectedDate}
            </span>
            {editingId && (
              <span className="text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg animate-pulse">
                Mode Koreksi
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* STEP 1: PILIH PRODUK PARTING AYAM */}
          <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <Package className="w-4 h-4 text-emerald-700" />
                1. Pilih Produk Parting Ayam
              </label>

              {/* Sub-category Filter Tabs */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-emerald-200">
                <button
                  type="button"
                  onClick={() => setSubFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    subFilter === 'ALL'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua (14)
                </button>
                <button
                  type="button"
                  onClick={() => setSubFilter('PAHA')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    subFilter === 'PAHA'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🍗 Paha (4)
                </button>
                <button
                  type="button"
                  onClick={() => setSubFilter('DADA')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    subFilter === 'DADA'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🥩 Dada (3)
                </button>
                <button
                  type="button"
                  onClick={() => setSubFilter('SAYAP_LAINNYA')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    subFilter === 'SAYAP_LAINNYA'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🍗 Sayap & Lainnya (7)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nama Item Parting Ayam
                </label>
                <select
                  value={selectedProductName}
                  onChange={(e) => setSelectedProductName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-emerald-500"
                >
                  {filteredCatalog.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} - PLU: {p.plu || '-'} (Item Code: {p.itemCode || '-'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Info Badge */}
              <div className="bg-white border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Item Code / PLU</span>
                  <span className="font-mono font-black text-slate-800">
                    {selectedProduct.itemCode || '-'} / {selectedProduct.plu || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Modal Acuan</span>
                  <span className="font-mono font-bold text-slate-700">
                    Rp {selectedProduct.cogsPerKg?.toLocaleString('id-ID') || '-'}/Kg
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Harga Jual Acuan</span>
                  <span className="font-mono font-bold text-emerald-700">
                    Rp {selectedProduct.sellingPricePerKg?.toLocaleString('id-ID') || '-'}/Kg
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: SISA KEMARIN (STOK AWAL) */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <Scale className="w-4 h-4 text-blue-700" />
                2. Sisa Kemarin (Stok Awal H-1) [Kg]
              </label>
              {h1Record && typeof h1Record.actualClosingStockKg === 'number' && (
                <button
                  type="button"
                  onClick={() => setOpeningStock(String(h1Record.actualClosingStockKg))}
                  className="text-[11px] text-blue-700 hover:underline font-bold cursor-pointer"
                  title="Klik untuk sync ulang dari closing H-1"
                >
                  Sync ({h1DateStr}: {h1Record.actualClosingStockKg.toFixed(3)} Kg)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-[11px] text-slate-500">
                {h1Record && typeof h1Record.actualClosingStockKg === 'number'
                  ? `✓ Otomatis terambil dari closing H-1 (${h1DateStr}) sebesar ${h1Record.actualClosingStockKg.toFixed(3)} Kg.`
                  : `H-1 (${h1DateStr}) belum ada data closing = 0.000 Kg.`}
              </span>
            </div>
          </div>

          {/* STEP 3: INPUT SAAT DIDISPLAY (TALLY, BRUTO, NETTO & FOTO TIMBANGAN) */}
          <div className="bg-emerald-50/50 border border-emerald-300 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                <Camera className="w-4 h-4 text-emerald-700" />
                3. Input Saat Akan Didisplay (Thawing / Penerimaan)
              </label>
              <span className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-300 px-2 py-0.5 rounded">
                Untuk Hitung Susut Beli
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Tally (Berat Awal Beku) [Kg]
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={tallyKg}
                  onChange={(e) => setTallyKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Angka label tally supplier</span>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Bruto (Berat Kotor) [Kg]
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={brutoKg}
                  onChange={(e) => setBrutoKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Berat kotor sebelum susut</span>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Netto (Berat Bersih Display) [Kg]
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={nettoKg}
                  onChange={(e) => setNettoKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-900 shadow-xs focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Berat bersih masuk chiller</span>
              </div>
            </div>

            {/* Display Auto Susut Beli Pill */}
            <div className="bg-white border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Susut Beli (Tally - Netto)</span>
                <span className="font-mono font-black text-amber-800 text-sm">
                  {susutBeliNum.toFixed(3)} Kg <span className="text-xs text-amber-700">({susutPercentNum.toFixed(2)}%)</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Susut Real (Bruto - Netto)</span>
                <span className="font-mono font-black text-slate-800 text-sm">
                  {susutRealNum.toFixed(3)} Kg
                </span>
              </div>
            </div>

            {/* Upload Foto Timbangan Saat Display */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-700" />
                  Foto Timbangan Saat Display (Netto)
                </label>
                {displayPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setDisplayPhotoUrl('')}
                    className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                  >
                    <X className="w-3 h-3" /> Hapus Foto
                  </button>
                )}
              </div>

              <div className="border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50/50 rounded-xl p-3 text-center relative transition">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleDisplayPhotoChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isOptimizingDisplayPhoto}
                />
                {isOptimizingDisplayPhoto ? (
                  <div className="py-2 flex items-center justify-center gap-2 text-emerald-700 text-xs font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Mengompres Foto Display...
                  </div>
                ) : displayPhotoUrl ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-left">
                      <img
                        src={displayPhotoUrl}
                        alt="Bukti Display"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPhoto?.(displayPhotoUrl, `Foto Timbangan Display: ${selectedProduct.name}`);
                        }}
                        className="h-12 w-12 object-cover rounded-lg border border-emerald-300 shadow-xs cursor-pointer hover:opacity-85"
                        title="Klik untuk perbesar"
                      />
                      <div>
                        <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> Foto Timbangan Display Terlampir
                        </span>
                        <span className="text-[10px] text-slate-500 block">Klik untuk ganti atau perbesar</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPhoto?.(displayPhotoUrl, `Foto Timbangan Display: ${selectedProduct.name}`);
                      }}
                      className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 shadow-xs z-20 cursor-pointer flex items-center gap-1"
                    >
                      <ZoomIn className="w-3 h-3" /> Perbesar
                    </button>
                  </div>
                ) : (
                  <div className="py-1.5">
                    <Upload className="w-4 h-4 text-emerald-700 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-800">Tambahkan Foto Timbangan Saat Display</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Ambil foto timbangan jarum / timbangan display netto (Kamera / Galeri)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 4: PENJUALAN (SALES) & TIMBANGAN CLOSING */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 space-y-3">
            <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
              <Scale className="w-4 h-4 text-blue-700" />
              4. Penjualan & Timbangan Fisik Closing Malam
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Penjualan (Sales) */}
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Penjualan (Sales) [Kg]
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={salesKg}
                  onChange={(e) => setSalesKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-800 shadow-xs focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Total penjualan riil di kasir</span>
              </div>

              {/* Adj In / Out */}
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Penyesuaian (Adj In / Out) [Kg]
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="+ In"
                    value={adjInKg}
                    onChange={(e) => setAdjInKg(e.target.value)}
                    className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-emerald-800 font-bold"
                  />
                  <input
                    type="number"
                    step="0.001"
                    placeholder="- Out"
                    value={adjOutKg}
                    onChange={(e) => setAdjOutKg(e.target.value)}
                    className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-rose-800 font-bold"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Net: {netAdjNum >= 0 ? `+${netAdjNum.toFixed(3)}` : netAdjNum.toFixed(3)} Kg
                </span>
              </div>

              {/* Timbangan Sisa Fisik Closing */}
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Timbangan Sisa Fisik Closing [Kg] <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={closingStock}
                  onChange={(e) => setClosingStock(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-blue-900 shadow-xs focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Hasil timbang chiller closing</span>
              </div>
            </div>

            {/* Upload Foto Closing */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  Foto Timbangan Sisa Fisik Closing <span className="text-red-500">*</span>
                </label>
                {closingPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setClosingPhotoUrl('')}
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
                  onChange={handleClosingPhotoChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isOptimizingClosingPhoto}
                />
                {isOptimizingClosingPhoto ? (
                  <div className="py-2 flex items-center justify-center gap-2 text-blue-700 text-xs font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Mengompres Foto Closing...
                  </div>
                ) : closingPhotoUrl ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-left">
                      <img
                        src={closingPhotoUrl}
                        alt="Bukti Closing"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPhoto?.(closingPhotoUrl, `Bukti Closing: ${selectedProduct.name}`);
                        }}
                        className="h-12 w-12 object-cover rounded-lg border border-blue-300 shadow-xs cursor-pointer hover:opacity-85"
                        title="Klik untuk perbesar"
                      />
                      <div>
                        <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> Foto Timbangan Closing Terlampir
                        </span>
                        <span className="text-[10px] text-slate-500 block">Klik untuk ganti atau perbesar</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPhoto?.(closingPhotoUrl, `Bukti Closing: ${selectedProduct.name}`);
                      }}
                      className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-[10px] font-bold text-blue-700 hover:bg-blue-50 shadow-xs z-20 cursor-pointer flex items-center gap-1"
                    >
                      <ZoomIn className="w-3 h-3" /> Perbesar
                    </button>
                  </div>
                ) : (
                  <div className="py-1.5">
                    <Upload className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-800">Tambahkan Foto Timbangan Sisa Fisik Closing</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Ambil foto timbangan jarum / digital sisa closing (Kamera / Galeri)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 5: HARGA MODAL (COGS) & HARGA JUAL (SALE) */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
            <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide mb-3">
              <DollarSign className="w-4 h-4 text-emerald-700" />
              5. Modal (COGS) & Harga Jual (Sale) Parting Ayam
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Cost Modal (COGS Acuan) [Rp / Kg]
                </label>
                <input
                  type="number"
                  step="100"
                  placeholder="0"
                  value={costPerKg}
                  onChange={(e) => setCostPerKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Default katalog: Rp {selectedProduct.cogsPerKg?.toLocaleString('id-ID') || '0'}/Kg
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Harga Jual (Sale Acuan) [Rp / Kg]
                </label>
                <input
                  type="number"
                  step="100"
                  placeholder="0"
                  value={salePricePerKg}
                  onChange={(e) => setSalePricePerKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-800 shadow-xs focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Default katalog: Rp {selectedProduct.sellingPricePerKg?.toLocaleString('id-ID') || '0'}/Kg
                </span>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Parting paha utuh dipotong dari karkas ayam segar"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
              />
            </div>
          </div>

          {/* STEP 6: PERHITUNGAN OTOMATIS (LIVE REAL-TIME DASHBOARD) */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                Perhitungan Otomatis Parting Ayam (Live Real-Time)
              </h4>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                Formula Sesuai SOP
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Susut Beli */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Susut Beli (Tally - Netto)</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-300 block mt-0.5">
                  {susutBeliNum.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                </span>
                <span className="text-[10px] text-amber-400/90 block mt-1 font-bold">
                  {susutPercentNum.toFixed(2)}% dari tally ({tallyNum.toFixed(3)} Kg)
                </span>
              </div>

              {/* Total Real */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Real</span>
                <span className="text-base sm:text-lg font-mono font-black text-white block mt-0.5">
                  {totalRealNum.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Sisa Kemarin + Netto</span>
              </div>

              {/* Sisa Sistem */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Sisa Stok Sistem</span>
                <span className="text-base sm:text-lg font-mono font-black text-blue-300 block mt-0.5">
                  {stockBySistemNum.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Total Real - Sales ({salesNum.toFixed(3)} Kg)</span>
              </div>

              {/* Susut Jual */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Susut Jual (Sistem - Fisik)</span>
                <span className={`text-base sm:text-lg font-mono font-black block mt-0.5 ${
                  susutJualNum > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {susutJualNum.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">({susutJualPct.toFixed(2)}% dari sistem)</span>
              </div>
            </div>

            {/* Financial Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-xs">
              <div className="bg-slate-800/50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Value Real</span>
                <span className="font-mono font-bold text-slate-200">Rp {Math.round(valueRealNum).toLocaleString('id-ID')}</span>
              </div>
              <div className="bg-slate-800/50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Value Process</span>
                <span className="font-mono font-bold text-slate-200">Rp {Math.round(valueProcessNum).toLocaleString('id-ID')}</span>
              </div>
              <div className="bg-slate-800/50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Cost Real (Modal Sebenarnya)</span>
                <span className="font-mono font-bold text-amber-300">Rp {Math.round(costRealNum).toLocaleString('id-ID')}/Kg</span>
              </div>
              <div className="bg-slate-800/50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Gross Profit (GP%)</span>
                <span className={`font-mono font-black ${gpPercentNum >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {gpPercentNum.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* STEP 7: ACTIONS */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              className="w-full sm:flex-1 py-3 px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'Simpan Perubahan Laporan Parting Ayam' : 'Simpan Laporan Parting Ayam'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setOpeningStock('');
                  setTallyKg('');
                  setBrutoKg('');
                  setNettoKg('');
                  setDisplayPhotoUrl('');
                  setAdjInKg('');
                  setAdjOutKg('');
                  setSalesKg('');
                  setClosingStock('');
                  setClosingPhotoUrl('');
                  setNote('');
                }}
                className="w-full sm:w-auto py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal Koreksi
              </button>
            )}
          </div>
        </form>
      </div>

      {/* DAFTAR LAPORAN TERSIMPAN TANGGAL INI */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Daftar Laporan Parting Ayam Tersimpan ({selectedDate})
            </h4>
            <p className="text-xs text-slate-500">
              Menampilkan {savedRecordsForDate.length} item Parting Ayam yang tercatat pada tanggal {selectedDate}.
            </p>
          </div>
        </div>

        {savedRecordsForDate.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Belum ada data closing Parting Ayam yang tersimpan untuk tanggal {selectedDate}. Gunakan formulir di atas untuk mengisi laporan terlewat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <th className="py-2.5 px-3">Produk</th>
                  <th className="py-2.5 px-2 text-right">Tally</th>
                  <th className="py-2.5 px-2 text-right">Netto</th>
                  <th className="py-2.5 px-2 text-right">Susut Beli</th>
                  <th className="py-2.5 px-2 text-right">Sales</th>
                  <th className="py-2.5 px-2 text-right">Sisa Sistem</th>
                  <th className="py-2.5 px-2 text-right">Sisa Fisik</th>
                  <th className="py-2.5 px-2 text-right">Susut Jual</th>
                  <th className="py-2.5 px-2 text-right">Cost Real</th>
                  <th className="py-2.5 px-2 text-right">GP%</th>
                  <th className="py-2.5 px-2 text-center">Foto Display</th>
                  <th className="py-2.5 px-2 text-center">Foto Closing</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {savedRecordsForDate.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-2 px-3 font-bold text-slate-900">
                      <div>{rec.planName}</div>
                      <span className="text-[10px] text-slate-400 font-mono">PLU: {rec.plu || '-'}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{rec.tallyKg?.toFixed(3) || '-'}</td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-800 font-bold">{rec.nettoKg?.toFixed(3) || rec.grnKg?.toFixed(3) || '-'}</td>
                    <td className="py-2 px-2 text-right font-mono text-amber-800">{rec.susutBeliKg?.toFixed(3) || '-'}</td>
                    <td className="py-2 px-2 text-right font-mono">{rec.salesKg?.toFixed(3) || '0.000'}</td>
                    <td className="py-2 px-2 text-right font-mono text-blue-800">{rec.closingStockBySystemKg?.toFixed(3) || '0.000'}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">{rec.actualClosingStockKg?.toFixed(3) || '0.000'}</td>
                    <td className={`py-2 px-2 text-right font-mono font-bold ${
                      (rec.susutJualKg || 0) > 0 ? 'text-rose-600' : 'text-slate-600'
                    }`}>
                      {rec.susutJualKg?.toFixed(3) || '0.000'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">
                      {rec.costReal ? `Rp ${Math.round(rec.costReal).toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className={`py-2 px-2 text-right font-mono font-bold ${
                      (rec.gpPercent || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {rec.gpPercent !== undefined ? `${rec.gpPercent.toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {rec.displayPhotoUrl ? (
                        <button
                          type="button"
                          onClick={() => onViewPhoto?.(rec.displayPhotoUrl!, `Timbangan Display: ${rec.planName}`)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-emerald-700 cursor-pointer transition"
                          title="Lihat Foto Display"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {rec.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => onViewPhoto?.(rec.photoUrl, `Bukti Closing: ${rec.planName}`)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-blue-700 cursor-pointer transition"
                          title="Lihat Foto Closing"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditRecord(rec)}
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition cursor-pointer"
                          title="Koreksi / Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec.id, rec.planName)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
