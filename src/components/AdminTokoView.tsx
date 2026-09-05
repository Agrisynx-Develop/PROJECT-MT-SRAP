import React, { useState, useMemo } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  StockAdjustment,
  CogsMaster,
  UserAccount,
  Store,
  DailyClosingReport
} from '../types';
import ExcelReportViewer from './ExcelReportViewer';
import { matchStoreEntity } from '../utils/reportCalculations';
import {
  exportStoreDailyLaporanExcel,
  exportStoreDailyLaporanCSV,
  downloadCSV
} from '../utils/excelExport';
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
  Trash2
} from 'lucide-react';

interface AdminTokoViewProps {
  currentUser: UserAccount;
  currentStore: Store;
  items: ThawingItem[];
  segments: FabricationSegment[];
  closingRecords: ClosingPlanRecord[];
  adjustments: StockAdjustment[];
  cogsList: CogsMaster[];
  onAddAdjustment: (adj: Omit<StockAdjustment, 'id' | 'createdAt'>) => void;
  onDeleteAdjustment?: (id: string) => void;
  onDeleteClosingRecord?: (id: string) => void;
  onPurgeDate?: (date: string) => void;
  onUpdateItemSales?: (itemId: string, salesKg: number) => void;
  onUpdateItemSusutJual?: (itemId: string, susutJualKg: number) => void;
  onUpdateCogs?: (updatedCogs: CogsMaster[]) => void;
  safeThawingLossPercent: number;
}

export default function AdminTokoView({
  currentUser,
  currentStore,
  items,
  segments,
  closingRecords,
  adjustments,
  cogsList,
  onAddAdjustment,
  onDeleteAdjustment,
  onDeleteClosingRecord,
  onPurgeDate,
  onUpdateItemSales,
  onUpdateItemSusutJual,
  onUpdateCogs,
  safeThawingLossPercent,
}: AdminTokoViewProps) {
  const [activeTab, setActiveTab] = useState<'excel' | 'overview' | 'adjust' | 'stock' | 'cogs' | 'export'>('excel');
  
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

  // Standard Cuts List
  const STANDARD_PLANS = [
    { name: 'D.sapi pot. rdang', category: 'DAGING FRESH', defaultCogs: 102000 },
    { name: 'Daging Rendang Shankle', category: 'SHANKLE', defaultCogs: 85200 },
    { name: 'D Premium lokal', category: 'DAGING PREMIUM', defaultCogs: 127000 },
    { name: 'Rawon Curah', category: 'RAWON', defaultCogs: 86500 },
    { name: 'D.r. fresh member', category: 'DAGING FRESH', defaultCogs: 102000 },
    { name: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM', defaultCogs: 103000 },
  ];

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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
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
    </div>
  );
}
