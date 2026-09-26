import React, { useState, useEffect, useMemo } from 'react';
import {
  ClosingPlanRecord,
  GrnRecord,
  StockAdjustment,
  Store,
  UserAccount,
} from '../types';
import {
  SOSIS_KENTANG_DORI_CATALOG,
  SOSIS_KENTANG_CATALOG,
  FILLET_DORI_CATALOG,
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
} from 'lucide-react';

interface MissedSosisKentangFormProps {
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

export default function MissedSosisKentangForm({
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
}: MissedSosisKentangFormProps) {
  // Sub-category filter
  const [subFilter, setSubFilter] = useState<'ALL' | 'SOSIS & KENTANG' | 'FILLET DORI'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered product catalog
  const filteredCatalog = useMemo(() => {
    let list = SOSIS_KENTANG_DORI_CATALOG;
    if (subFilter === 'SOSIS & KENTANG') {
      list = SOSIS_KENTANG_CATALOG;
    } else if (subFilter === 'FILLET DORI') {
      list = FILLET_DORI_CATALOG;
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
  const [selectedProductName, setSelectedProductName] = useState<string>(SOSIS_KENTANG_DORI_CATALOG[0].name);

  const selectedProduct = useMemo(() => {
    return SOSIS_KENTANG_DORI_CATALOG.find((p) => p.name === selectedProductName) || SOSIS_KENTANG_DORI_CATALOG[0];
  }, [selectedProductName]);

  // Form inputs
  const [openingStock, setOpeningStock] = useState<string>('');
  const [grnKg, setGrnKg] = useState<string>('');
  const [adjInKg, setAdjInKg] = useState<string>('');
  const [adjOutKg, setAdjOutKg] = useState<string>('');
  const [salesKg, setSalesKg] = useState<string>('');
  const [closingStock, setClosingStock] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isOptimizingPhoto, setIsOptimizingPhoto] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // H-1 Lookup
  const h1DateStr = useMemo(() => getPreviousDateStr(selectedDate), [selectedDate]);
  const h1Record = useMemo(() => {
    return findHMinus1ClosingRecord(closingRecords, currentStore, selectedProduct.name, selectedDate);
  }, [closingRecords, currentStore, selectedProduct.name, selectedDate]);

  // Auto-sync when selectedDate or selectedProduct changes
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
      setGrnKg(existingForDate.grnKg !== undefined && existingForDate.grnKg > 0 ? String(existingForDate.grnKg) : (existingGrn?.weightKg ? String(existingGrn.weightKg) : ''));
      setAdjInKg(existingForDate.adjustInKg ? String(existingForDate.adjustInKg) : (adjIn > 0 ? String(adjIn) : ''));
      setAdjOutKg(existingForDate.adjustOutKg ? String(existingForDate.adjustOutKg) : (adjOut > 0 ? String(adjOut) : ''));
      setSalesKg(existingForDate.salesKg !== undefined ? String(existingForDate.salesKg) : '');
      setClosingStock(existingForDate.actualClosingStockKg !== undefined ? String(existingForDate.actualClosingStockKg) : '');
      setPhotoUrl(existingForDate.photoUrl || '');
      setNote(existingForDate.note || '');
      return;
    }

    // Direct isolation from H-1
    if (h1Record && typeof h1Record.actualClosingStockKg === 'number') {
      setOpeningStock(String(h1Record.actualClosingStockKg));
    } else {
      setOpeningStock('0');
    }

    setGrnKg(existingGrn?.weightKg ? String(existingGrn.weightKg) : '');
    setAdjInKg(adjIn > 0 ? String(adjIn) : '');
    setAdjOutKg(adjOut > 0 ? String(adjOut) : '');
    setSalesKg('');
    setClosingStock('');
    setPhotoUrl('');
    setNote('');
  }, [selectedDate, selectedProduct.name, closingRecords, grnRecords, adjustments, currentStore.id, editingId, h1Record]);

  // Derived Calculations
  const openingNum = parseFloat(openingStock) || 0;
  const grnNum = parseFloat(grnKg) || 0;
  const adjInNum = parseFloat(adjInKg) || 0;
  const adjOutNum = parseFloat(adjOutKg) || 0;
  const netAdjNum = adjInNum - adjOutNum;
  const totalRealNum = openingNum + grnNum + netAdjNum;
  const salesNum = parseFloat(salesKg) || 0;
  const stockBySistemNum = Math.max(0, totalRealNum - salesNum);

  const closingStockNum = parseFloat(closingStock) || 0;
  const susutJualNum = Math.max(0, stockBySistemNum - closingStockNum);
  const susutJualPct = stockBySistemNum > 0 ? (susutJualNum / stockBySistemNum) * 100 : 0;

  // Handle Photo Upload
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsOptimizingPhoto(true);
      const compressed = await processHighResImage(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
        format: 'image/jpeg',
      });
      setPhotoUrl(compressed);
    } catch (err) {
      console.error('Gagal mengompres foto:', err);
    } finally {
      setIsOptimizingPhoto(false);
      e.target.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isNaN(parseFloat(closingStock)) || parseFloat(closingStock) < 0) {
      onNotifyMsg?.({ type: 'error', text: 'Harap masukkan angka Timbangan Sisa Fisik Closing yang valid (≥ 0)!' });
      return;
    }

    if (!photoUrl) {
      onNotifyMsg?.({ type: 'error', text: '⚠️ Foto bukti timbangan fisik closing wajib diunggah!' });
      return;
    }

    const recId = editingId || `cpr_${currentStore.id}_sosis_kentang_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const recordToSave: ClosingPlanRecord = {
      id: recId,
      storeId: currentStore.id,
      date: selectedDate,
      planName: selectedProduct.name,
      itemCode: selectedProduct.itemCode,
      plu: selectedProduct.plu,
      category: selectedProduct.category,
      reportCategory: 'KENTANG_SOSIS_DORI',
      subCategory: selectedProduct.subCategory,
      openingStockKg: parseFloat(openingNum.toFixed(3)),
      newProcessedKg: 0,
      grnKg: parseFloat(grnNum.toFixed(3)),
      adjustInKg: parseFloat(adjInNum.toFixed(3)),
      adjustOutKg: parseFloat(adjOutNum.toFixed(3)),
      salesKg: parseFloat(salesNum.toFixed(3)),
      closingStockBySystemKg: parseFloat(stockBySistemNum.toFixed(3)),
      actualClosingStockKg: parseFloat(closingStockNum.toFixed(3)),
      susutJualKg: parseFloat(susutJualNum.toFixed(3)),
      isUnopened: false,
      photoUrl,
      photoCaption: `Bukti Closing: ${selectedProduct.name} (${closingStockNum.toFixed(3)} Kg)`,
      note: note || '',
      butcherName: `${currentUser.fullName} (Input Susulan)`,
      timestamp: `${selectedDate}T17:00:00.000Z`,
    };

    onSaveClosingRecord(recordToSave);

    if (grnNum > 0 && onSaveGrn) {
      onSaveGrn({
        id: `grn_${currentStore.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        storeId: currentStore.id,
        date: selectedDate,
        reportCategory: 'KENTANG_SOSIS_DORI',
        subCategory: selectedProduct.subCategory,
        itemCode: selectedProduct.itemCode,
        plu: selectedProduct.plu,
        productName: selectedProduct.name,
        weightKg: grnNum,
        receivedBy: currentUser.fullName,
        createdAt: `${selectedDate}T08:00:00.000Z`,
      });
    }

    onNotifyMsg?.({
      type: 'success',
      text: `✓ Data laporan "${selectedProduct.name}" tanggal ${selectedDate} berhasil disimpan! Sisa fisik ${closingStockNum.toFixed(3)} Kg & Susut ${susutJualNum.toFixed(3)} Kg terupdate di sistem.`,
    });

    setEditingId(null);
  };

  // Saved records for this date
  const savedRecordsForDate = useMemo(() => {
    return (closingRecords || []).filter(
      (c) =>
        matchStoreEntity(c.storeId, currentStore) &&
        (c.date || c.timestamp || '').startsWith(selectedDate) &&
        (c.reportCategory === 'KENTANG_SOSIS_DORI' ||
          c.category === 'SOSIS & KENTANG' ||
          c.category === 'FILLET DORI' ||
          SOSIS_KENTANG_DORI_CATALOG.some(
            (p) => isMatchPlan(p.name, c.planName) || (p.itemCode && c.itemCode === p.itemCode)
          ))
    );
  }, [closingRecords, currentStore, selectedDate]);

  const handleEditRecord = (rec: ClosingPlanRecord) => {
    setEditingId(rec.id);
    const matched = SOSIS_KENTANG_DORI_CATALOG.find((p) => isMatchPlan(p.name, rec.planName)) || SOSIS_KENTANG_DORI_CATALOG[0];
    setSelectedProductName(matched.name);
    setOpeningStock(rec.openingStockKg !== undefined ? String(rec.openingStockKg) : '');
    setGrnKg(rec.grnKg !== undefined ? String(rec.grnKg) : '');
    setAdjInKg(rec.adjustInKg ? String(rec.adjustInKg) : '');
    setAdjOutKg(rec.adjustOutKg ? String(rec.adjustOutKg) : '');
    setSalesKg(rec.salesKg !== undefined ? String(rec.salesKg) : '');
    setClosingStock(rec.actualClosingStockKg !== undefined ? String(rec.actualClosingStockKg) : '');
    setPhotoUrl(rec.photoUrl || '');
    setNote(rec.note || '');
  };

  const handleDeleteRecord = (id: string, name: string) => {
    if (window.confirm(`Hapus data closing terlewat untuk "${name}" pada tanggal ${selectedDate}?`)) {
      onDeleteClosingRecord?.(id);
      onNotifyMsg?.({ type: 'success', text: `Data "${name}" tanggal ${selectedDate} berhasil dihapus.` });
      if (editingId === id) setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form Container */}
      <div className="bg-white border border-amber-200 rounded-2xl p-5 md:p-6 shadow-xs">
        {/* Form Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-amber-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                <Layers className="w-5 h-5" />
              </span>
              <h3 className="text-base font-black text-slate-900">
                {editingId ? 'Koreksi Laporan Terlewat: Kentang, Sosis & Dori' : 'Input Laporan Terlewat: Kentang, Sosis & Dori'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Catat sisa kemarin, barang masuk (GRN), penjualan, dan timbangan fisik closing untuk tanggal yang terlewat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-lg">
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
          {/* STEP 1: PILIH PRODUK & SUBKATEGORI */}
          <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <Package className="w-4 h-4 text-amber-700" />
                1. Pilih Produk
              </label>

              {/* Subcategory Filter Tabs */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-amber-200">
                <button
                  type="button"
                  onClick={() => setSubFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    subFilter === 'ALL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({SOSIS_KENTANG_DORI_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubFilter('SOSIS & KENTANG')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    subFilter === 'SOSIS & KENTANG'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sosis & Kentang ({SOSIS_KENTANG_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubFilter('FILLET DORI')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    subFilter === 'FILLET DORI'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fillet Dori ({FILLET_DORI_CATALOG.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nama Item Produk (Katalog Resmi)
                </label>
                <select
                  value={selectedProductName}
                  onChange={(e) => setSelectedProductName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-amber-500"
                >
                  {filteredCatalog.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} [{p.category}] - PLU: {p.plu || '-'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Info Badge */}
              <div className="bg-white border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Item Code / PLU</span>
                  <span className="font-mono font-black text-slate-800">
                    {selectedProduct.itemCode || '-'} / {selectedProduct.plu || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Kategori</span>
                  <span className="font-bold text-amber-700">{selectedProduct.category}</span>
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

          {/* STEP 2: STOK AWAL, BARANG MASUK (GRN) & PENJUALAN */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
            <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide mb-3">
              <Scale className="w-4 h-4 text-blue-700" />
              2. Mutasi Stok & Penjualan
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Sisa Kemarin (Stok Awal) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-black text-slate-800">
                    Sisa Kemarin (H-1) [Kg]
                  </label>
                  {h1Record && typeof h1Record.actualClosingStockKg === 'number' && (
                    <button
                      type="button"
                      onClick={() => setOpeningStock(String(h1Record.actualClosingStockKg))}
                      className="text-[10px] text-blue-700 hover:underline font-bold cursor-pointer"
                      title="Klik untuk sync ulang dari H-1"
                    >
                      Sync ({h1DateStr})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {h1Record && typeof h1Record.actualClosingStockKg === 'number'
                    ? `✓ Sisa closing H-1 (${h1DateStr}): ${h1Record.actualClosingStockKg.toFixed(3)} Kg`
                    : `H-1 (${h1DateStr}) belum ada data = 0.000 Kg`}
                </span>
              </div>

              {/* Barang Masuk (GRN / SPB) */}
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Barang Masuk (GRN) [Kg]
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={grnKg}
                  onChange={(e) => setGrnKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Penerimaan dari SPB / gudang</span>
              </div>

              {/* Penyesuaian (Adj In / Adj Out) */}
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
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-emerald-800 font-bold"
                    title="Penyesuaian Masuk (Adj In)"
                  />
                  <input
                    type="number"
                    step="0.001"
                    placeholder="- Out"
                    value={adjOutKg}
                    onChange={(e) => setAdjOutKg(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-rose-800 font-bold"
                    title="Penyesuaian Keluar (Adj Out)"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Net: {netAdjNum >= 0 ? `+${netAdjNum.toFixed(3)}` : netAdjNum.toFixed(3)} Kg
                </span>
              </div>

              {/* Penjualan (Sales Real) */}
              <div>
                <label className="block text-[11px] font-black text-slate-800 mb-1">
                  Penjualan (Sales Real) [Kg]
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={salesKg}
                  onChange={(e) => setSalesKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-800 shadow-xs focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Total penjualan kasir / POS</span>
              </div>
            </div>
          </div>

          {/* STEP 3: HASIL CLOSING */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                3. Timbangan Fisik Closing Malam
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-800 mb-1">
                Timbangan Sisa Fisik Closing [Kg] <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.000"
                value={closingStock}
                onChange={(e) => setClosingStock(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-blue-900 shadow-xs focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Hasil timbangan nyata pada chiller/freezer saat closing malam.
              </span>
            </div>

            {/* Upload Foto Closing */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  Foto Bukti Timbangan Fisik Closing <span className="text-red-500">*</span>
                </label>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
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
                  onChange={handlePhotoChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isOptimizingPhoto}
                />
                {isOptimizingPhoto ? (
                  <div className="py-2 flex items-center justify-center gap-2 text-blue-700 text-xs font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Mengompres Foto Resolusi Tinggi...
                  </div>
                ) : photoUrl ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-left">
                      <img
                        src={photoUrl}
                        alt="Bukti Closing"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPhoto?.(photoUrl, `Bukti Closing: ${selectedProduct.name}`);
                        }}
                        className="h-12 w-12 object-cover rounded-lg border border-blue-300 shadow-xs cursor-pointer hover:opacity-85"
                        title="Klik untuk perbesar"
                      />
                      <div>
                        <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> Foto Bukti Terlampir
                        </span>
                        <span className="text-[10px] text-slate-500 block">Klik untuk ganti atau perbesar</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPhoto?.(photoUrl, `Bukti Closing: ${selectedProduct.name}`);
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
                    <p className="text-[10px] text-slate-500 mt-0.5">Ambil foto timbangan jarum / timbangan digital closing (Kamera / Galeri)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Catatan Tambahan */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Sisa 3 karton belum dibuka di freezer barat"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
              />
            </div>
          </div>

          {/* STEP 4: PERHITUNGAN OTOMATIS (LIVE REAL-TIME) */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-400" />
                Perhitungan Otomatis (Live Real-Time)
              </h4>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
                Sistem Terpadu
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Real</span>
                <span className="text-base sm:text-lg font-mono font-black text-white block mt-0.5">
                  {totalRealNum.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Stok Awal + GRN + Adj</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Stock Akhir Sistem</span>
                <span className="text-base sm:text-lg font-mono font-black text-blue-300 block mt-0.5">
                  {stockBySistemNum.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Total Real - Sales</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Stock Akhir Real</span>
                <span className="text-base sm:text-lg font-mono font-black text-emerald-300 block mt-0.5">
                  {closingStockNum.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Timbangan Fisik</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Penyusutan (Susut Jual)</span>
                <span className={`text-base sm:text-lg font-mono font-black block mt-0.5 ${
                  susutJualNum > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {susutJualNum.toFixed(3)} <span className="text-xs text-slate-400">Kg</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">({susutJualPct.toFixed(2)}% dari sistem)</span>
              </div>
            </div>
          </div>

          {/* STEP 5: ACTIONS */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              className="w-full sm:flex-1 py-3 px-6 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'Simpan Perubahan Laporan Kentang, Sosis & Dori' : 'Simpan Laporan Kentang, Sosis & Dori'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setOpeningStock('');
                  setGrnKg('');
                  setAdjInKg('');
                  setAdjOutKg('');
                  setSalesKg('');
                  setClosingStock('');
                  setPhotoUrl('');
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
              Daftar Laporan Kentang, Sosis & Dori Tersimpan ({selectedDate})
            </h4>
            <p className="text-xs text-slate-500">
              Menampilkan {savedRecordsForDate.length} item closing yang tercatat pada tanggal {selectedDate}.
            </p>
          </div>
        </div>

        {savedRecordsForDate.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Belum ada data closing Kentang, Sosis & Dori yang tersimpan untuk tanggal {selectedDate}. Gunakan formulir di atas untuk mengisi laporan terlewat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <th className="py-2.5 px-3">Produk</th>
                  <th className="py-2.5 px-2">Kategori</th>
                  <th className="py-2.5 px-2 text-right">Stok Awal</th>
                  <th className="py-2.5 px-2 text-right">GRN</th>
                  <th className="py-2.5 px-2 text-right">Sales</th>
                  <th className="py-2.5 px-2 text-right">Sisa Sistem</th>
                  <th className="py-2.5 px-2 text-right">Sisa Fisik</th>
                  <th className="py-2.5 px-2 text-right">Susut</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-2 text-center">Foto</th>
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
                    <td className="py-2 px-2 text-slate-600 text-[11px]">{rec.category || '-'}</td>
                    <td className="py-2 px-2 text-right font-mono">{rec.openingStockKg?.toFixed(3) || '0.000'}</td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-700">{rec.grnKg?.toFixed(3) || '0.000'}</td>
                    <td className="py-2 px-2 text-right font-mono">{rec.salesKg?.toFixed(3) || '0.000'}</td>
                    <td className="py-2 px-2 text-right font-mono text-blue-800">{rec.closingStockBySystemKg?.toFixed(3) || '0.000'}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">{rec.actualClosingStockKg?.toFixed(3) || '0.000'}</td>
                    <td className={`py-2 px-2 text-right font-mono font-bold ${
                      (rec.susutJualKg || 0) > 0 ? 'text-rose-600' : 'text-slate-600'
                    }`}>
                      {rec.susutJualKg?.toFixed(3) || '0.000'}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Timbang Fisik
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {rec.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => onViewPhoto?.(rec.photoUrl, `Bukti: ${rec.planName}`)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-blue-700 cursor-pointer transition"
                          title="Lihat Foto"
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
