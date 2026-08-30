import React, { useState } from 'react';
import {
  Store,
  UserAccount,
  CogsMaster,
  DailyClosingReport,
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  StockAdjustment
} from '../types';
import { matchStoreEntity } from '../utils/storeHelper';
import MdExcelReportView from './MdExcelReportView';
import {
  exportRekapSusutMultiStoreExcel,
  exportRekapSusutCSV,
  downloadCSV
} from '../utils/excelExport';
import {
  Compass,
  Building,
  DollarSign,
  Users,
  FileSpreadsheet,
  Download,
  Plus,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Eye,
  Edit2,
  Save,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowUpDown,
  Building2,
  Scale,
  Sheet
} from 'lucide-react';

interface MdHelicopterViewProps {
  currentUser: UserAccount;
  stores: Store[];
  users: UserAccount[];
  cogsList: CogsMaster[];
  allReports: DailyClosingReport[];
  currentStoreItems: ThawingItem[];
  currentStoreSegments: FabricationSegment[];
  currentStoreClosingRecords: ClosingPlanRecord[];
  allItems?: ThawingItem[];
  allSegments?: FabricationSegment[];
  allAdjustments?: StockAdjustment[];
  allClosingRecords?: ClosingPlanRecord[];
  onAddStore: (store: Omit<Store, 'id' | 'createdAt'>, butcherName: string, adminName: string) => void;
  onUpdateCogs: (cogs: CogsMaster[]) => void;
  onSelectStoreForDrilldown?: (storeId: string) => void;
}

export default function MdHelicopterView({
  currentUser,
  stores,
  users,
  cogsList,
  allReports,
  currentStoreItems,
  currentStoreSegments,
  currentStoreClosingRecords,
  allItems = [],
  allSegments = [],
  allAdjustments = [],
  allClosingRecords = [],
  onAddStore,
  onUpdateCogs,
  onSelectStoreForDrilldown,
}: MdHelicopterViewProps) {
  const [activeTab, setActiveTab] = useState<'excel_report' | 'helicopter' | 'cogs' | 'stores' | 'export' | 'drilldown'>('excel_report');

  // Multi-Store Date Filter (From - To)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Helper date range label
  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
    } catch {
      return dateStr;
    }
  };

  const dateRangeLabel = startDate && endDate
    ? `${formatDateIndo(startDate)} - ${formatDateIndo(endDate)}`
    : startDate
    ? `Mulai ${formatDateIndo(startDate)}`
    : endDate
    ? `Sampai ${formatDateIndo(endDate)}`
    : 'Semua Periode';

  // Filter historical reports within the selected date range
  const filteredReports = allReports.filter((r) => {
    if (!r.date) return true;
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    return true;
  });

  // Search & Filter
  const [searchStore, setSearchStore] = useState('');
  const [sortField, setSortField] = useState<'totalSusutPct' | 'totalBahanKg' | 'totalSalesKg'>('totalSusutPct');
  const [sortAsc, setSortAsc] = useState(false);

  // Drilldown Selected Store
  const [drilldownStoreId, setDrilldownStoreId] = useState(stores[0]?.id || '1');

  // Add Store Form State
  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('');
  const [newButcherName, setNewButcherName] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [storeAddSuccess, setStoreAddSuccess] = useState(false);
  const [storeAddError, setStoreAddError] = useState('');

  // COGS Edit State
  const [editingCogsId, setEditingCogsId] = useState<string | null>(null);
  const [editCogsValue, setEditCogsValue] = useState('');
  const [newCogsName, setNewCogsName] = useState('');
  const [newCogsCategory, setNewCogsCategory] = useState<'DAGING FRESH' | 'DAGING PREMIUM' | 'RAWON' | 'SHANKLE'>('DAGING FRESH');
  const [newCogsPrice, setNewCogsPrice] = useState('');
  const [cogsSuccess, setCogsSuccess] = useState(false);

  // --- STORE PERFORMANCE AGGREGATION (REAL DATA ONLY - NO DUMMY VALUES) ---
  const storePerformanceList = stores.map((store) => {
    // Check if there are real items or reports for this store in filteredReports
    const storeReports = filteredReports.filter((r) => matchStoreEntity(r.storeId, store) || (r.storeName && matchStoreEntity(r.storeName, store)));
    let tally = 0;
    let netto = 0;
    let susutJual = 0;
    let sales = 0;

    // Aggregate from historical daily reports if present
    storeReports.forEach((rep) => {
      rep.itemsProcessed?.forEach((item) => {
        tally += item.weightBefore || 0;
        netto += item.weightAfter || item.finalWeight || 0;
        susutJual += item.susutJualKg || 0;
      });
      sales += rep.totalSalesKg || 0;
    });

    // Also include live operational items for this specific store
    const todayStr = new Date().toISOString().split('T')[0];
    const isTodayInRange = (!startDate || todayStr >= startDate) && (!endDate || todayStr <= endDate);

    const storeLiveItems = (allItems.length > 0 ? allItems : currentStoreItems).filter(
      (i) => matchStoreEntity(i.storeId, store) && !i.isCarryover
    );
    const storeLiveSegments = (allSegments.length > 0 ? allSegments : currentStoreSegments).filter(
      (s) => matchStoreEntity(s.storeId, store)
    );
    const storeLiveClosing = (allClosingRecords.length > 0 ? allClosingRecords : currentStoreClosingRecords).filter(
      (r) => matchStoreEntity(r.storeId, store)
    );

    if (storeLiveItems.length > 0 && isTodayInRange) {
      const activeTally = storeLiveItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
      const activeNetto = storeLiveItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);
      const activeSusutJual = storeLiveClosing.reduce(
        (sum, r) => sum + (r.susutJualKg || 0),
        storeLiveItems.reduce((sum, i) => sum + (i.susutJualKg || 0), 0)
      );
      const activeSales = storeLiveClosing.reduce(
        (sum, r) => sum + (r.salesKg || 0),
        storeLiveSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0)
      );

      tally += activeTally;
      netto += activeNetto;
      susutJual += activeSusutJual;
      sales += activeSales;
    }

    const susutProsesKg = Math.max(0, tally - netto);
    const totalSusutKg = susutProsesKg + susutJual;
    const susutProsesPct = tally > 0 ? (susutProsesKg / tally) * 100 : 0;
    const susutJualPct = tally > 0 ? (susutJual / tally) * 100 : 0;
    const totalSusutPct = tally > 0 ? (totalSusutKg / tally) * 100 : 0;

    const modalValuation = tally * 102000;

    return {
      store,
      tally,
      netto,
      susutProsesKg,
      susutProsesPct,
      susutJual,
      susutJualPct,
      totalSusutKg,
      totalSusutPct,
      sales,
      modalValuation,
      isHighLoss: totalSusutPct > 2.0,
    };
  });

  // Filtered & Sorted Stores
  const filteredStores = storePerformanceList
    .filter((sp) => {
      const name = (sp?.store?.name || '').toLowerCase();
      const city = (sp?.store?.city || '').toLowerCase();
      const query = (searchStore || '').toLowerCase();
      return name.includes(query) || city.includes(query);
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      return sortAsc ? valA - valB : valB - valA;
    });

  // Corporate Aggregates across ALL STORES
  const grandTotalBahan = storePerformanceList.reduce((sum, sp) => sum + sp.tally, 0);
  const grandTotalNetto = storePerformanceList.reduce((sum, sp) => sum + sp.netto, 0);
  const grandTotalSusutProses = storePerformanceList.reduce((sum, sp) => sum + sp.susutProsesKg, 0);
  const grandTotalSusutJual = storePerformanceList.reduce((sum, sp) => sum + sp.susutJual, 0);
  const grandTotalSales = storePerformanceList.reduce((sum, sp) => sum + sp.sales, 0);
  const grandTotalSusutKg = grandTotalSusutProses + grandTotalSusutJual;
  const grandAvgSusutPct = grandTotalBahan > 0 ? (grandTotalSusutKg / grandTotalBahan) * 100 : 0;
  const grandTotalModal = storePerformanceList.reduce((sum, sp) => sum + sp.modalValuation, 0);

  // Submit Add Store
  const handleAddNewStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreCode.trim() || !newStoreName.trim() || !newStoreCity.trim()) {
      setStoreAddError('Harap lengkapi semua kolom toko.');
      return;
    }
    if (!newButcherName.trim() || !newAdminName.trim()) {
      setStoreAddError('Harap isi nama Butcher dan nama Admin untuk toko ini.');
      return;
    }

    onAddStore(
      {
        code: newStoreCode.trim().toUpperCase(),
        name: newStoreName.trim().startsWith('TDN ') ? newStoreName.trim() : `TDN ${newStoreName.trim()}`,
        city: newStoreCity.trim(),
      },
      newButcherName.trim(),
      newAdminName.trim()
    );

    setNewStoreCode('');
    setNewStoreName('');
    setNewStoreCity('');
    setNewButcherName('');
    setNewAdminName('');
    setStoreAddError('');
    setStoreAddSuccess(true);
    setTimeout(() => setStoreAddSuccess(false), 3000);
  };

  // Save / Update COGS
  const handleSaveCogsItem = (id: string) => {
    const parsed = parseFloat(editCogsValue);
    if (isNaN(parsed) || parsed <= 0) return;

    const updated = cogsList.map((c) => (c.id === id ? { ...c, cogsPerKg: parsed, updatedAt: new Date().toISOString().split('T')[0], updatedBy: 'MD Pusat' } : c));
    onUpdateCogs(updated);
    setEditingCogsId(null);
    setEditCogsValue('');
    setCogsSuccess(true);
    setTimeout(() => setCogsSuccess(false), 3000);
  };

  // Add New COGS Master Item
  const handleAddNewCogsMaster = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newCogsPrice);
    if (!newCogsName.trim() || isNaN(parsed) || parsed <= 0) return;

    const newItem: CogsMaster = {
      id: `cogs_${Date.now()}`,
      itemCode: `MTR-${cogsList.length + 1}`,
      itemName: newCogsName.trim(),
      category: newCogsCategory,
      cogsPerKg: parsed,
      defaultPricePerKg: parsed * 1.25,
      updatedAt: new Date().toISOString().split('T')[0],
      updatedBy: 'MD Pusat',
    };

    onUpdateCogs([...cogsList, newItem]);
    setNewCogsName('');
    setNewCogsPrice('');
    setCogsSuccess(true);
    setTimeout(() => setCogsSuccess(false), 3000);
  };

  // Export Rekap Susut Multi-Store (Exact 9 Sheets Excel)
  const handleExportMultiStoreExcel = () => {
    exportRekapSusutMultiStoreExcel(
      stores,
      dateRangeLabel,
      allReports,
      cogsList,
      allItems,
      allClosingRecords,
      startDate,
      endDate
    );
  };

  const handleExportMultiStoreCSV = () => {
    exportRekapSusutCSV(
      stores,
      dateRangeLabel,
      filteredReports
    );
  };

  const drilldownStore = stores.find((s) => s.id === drilldownStoreId) || stores[0];

  return (
    <div className="space-y-6">
      {/* Top Banner for MD (Helicopter View) */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-emerald-800 text-emerald-100 text-xs font-semibold uppercase tracking-wider">
              MD / Helicopter View
            </span>
            <span className="text-xs text-emerald-200">
              Monitoring Seluruh Toko ({stores.length} Cabang Aktif)
            </span>
          </div>
          <h1 className="text-2xl font-black mt-1">Dashboard Merchandising Pusat</h1>
          <p className="text-xs text-emerald-200 mt-0.5">
            Petugas: <strong className="text-white">{currentUser.fullName}</strong> • Kontrol Sentral COGS, Multi-Toko & Rekap Susut Nasional
          </p>
        </div>

        {/* Date Filter (From - To) & Export Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-700/60 text-xs shadow-inner">
            <Calendar className="w-4 h-4 text-emerald-300 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Dari</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-emerald-900/90 text-white px-2 py-1 rounded border border-emerald-600/70 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-xs font-mono font-bold cursor-pointer"
              />
            </div>
            <span className="text-emerald-400 font-bold px-0.5">-</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Sampai</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-emerald-900/90 text-white px-2 py-1 rounded border border-emerald-600/70 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-xs font-mono font-bold cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={handleExportMultiStoreExcel}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Download Format Excel persis SUSUT MULTI CABANG"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Rekap Susut (.XLSX)
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('excel_report')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'excel_report' ? 'bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-600' : 'text-slate-700 hover:text-slate-900 bg-white/70'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          Laporan Excel MD (9 Sheet)
        </button>

        <button
          onClick={() => setActiveTab('helicopter')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'helicopter' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Compass className="w-4 h-4 text-emerald-700" />
          Helicopter Matrix ({stores.length})
        </button>

        <button
          onClick={() => setActiveTab('cogs')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'cogs' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-700" />
          Master Data COGS ({cogsList.length})
        </button>

        <button
          onClick={() => setActiveTab('stores')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'stores' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-700" />
          Manajemen Toko & Akun
        </button>

        <button
          onClick={() => setActiveTab('drilldown')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'drilldown' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Eye className="w-4 h-4 text-emerald-700" />
          Detail per Toko
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'export' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          Download Rekap
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: EXCEL REPORT VIEW (EXACT 9 SHEETS AS REQUESTED) */}
      {/* ========================================================================= */}
      {activeTab === 'excel_report' && (
        <div className="space-y-4">
          <MdExcelReportView
            stores={stores}
            cogsList={cogsList}
            allReports={allReports}
            allItems={allItems}
            allSegments={allSegments}
            allAdjustments={allAdjustments}
            allClosingRecords={allClosingRecords}
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: HELICOPTER MATRIX (ALL STORES COMPARISON) */}
      {/* ========================================================================= */}
      {activeTab === 'helicopter' && (
        <div className="space-y-6">
          {/* Grand Corporate Highlights */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Bahan Masuk (Nasional)
              </span>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                {grandTotalBahan.toFixed(1)} Kg
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Hasil Bersih: <strong className="text-slate-800">{grandTotalNetto.toFixed(1)} Kg</strong>
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Rata-rata Total Susut Nasional
              </span>
              <div className="text-xl font-black text-amber-700 mt-1 font-mono">
                {grandAvgSusutPct.toFixed(2)}%
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Total Susut: <strong className="text-red-700">{grandTotalSusutKg.toFixed(2)} Kg</strong>
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Penjualan Daging (Sales)
              </span>
              <div className="text-xl font-black text-emerald-700 mt-1 font-mono">
                {grandTotalSales.toFixed(1)} Kg
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Dari {stores.length} gerai toko
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Valuasi Modal Bahan
              </span>
              <div className="text-xl font-black text-blue-900 mt-1 font-mono">
                Rp {(grandTotalModal / 1000000).toFixed(1)} Jt
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Perhitungan COGS Terpusat
              </span>
            </div>
          </div>

          {/* Search & Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari toko atau kota..."
                  value={searchStore}
                  onChange={(e) => setSearchStore(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Urutkan:</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  className="text-xs p-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="totalSusutPct">Susut Terbesar (%)</option>
                  <option value="totalBahanKg">Bahan Masuk (Kg)</option>
                  <option value="totalSalesKg">Penjualan (Sales Kg)</option>
                </select>
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
                  title="Balik Urutan"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3">Kode</th>
                    <th className="p-3">Nama Toko & Cabang</th>
                    <th className="p-3">Kota</th>
                    <th className="p-3 text-right">Bahan Tally (Kg)</th>
                    <th className="p-3 text-right">Netto (Kg)</th>
                    <th className="p-3 text-right">Susut 1 (Proses)</th>
                    <th className="p-3 text-right">Susut Jual (Kg)</th>
                    <th className="p-3 text-right font-bold text-red-900 bg-red-50/50">Total Susut (%)</th>
                    <th className="p-3 text-right font-bold text-emerald-700">Sales (Kg)</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStores.map((sp) => (
                    <tr key={sp.store.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-500">{sp.store.code}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {sp.store.name}
                        {sp.isHighLoss && (
                          <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-black uppercase">
                            Susut Tinggi
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{sp.store.city}</td>
                      <td className="p-3 text-right font-mono">{sp.tally.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono">{sp.netto.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-amber-700">
                        {sp.susutProsesKg.toFixed(3)} ({sp.susutProsesPct.toFixed(2)}%)
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{sp.susutJual.toFixed(3)}</td>
                      <td className="p-3 text-right font-mono font-black text-red-900 bg-red-50/50">
                        {sp.totalSusutPct.toFixed(2)}%
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">{sp.sales.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setDrilldownStoreId(sp.store.id);
                            setActiveTab('drilldown');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 rounded font-semibold text-[11px] border border-slate-200 transition"
                        >
                          Lihat Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER DATA COGS */}
      {/* ========================================================================= */}
      {activeTab === 'cogs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Add / New COGS */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Tambah Master Item COGS
                </h2>
                <p className="text-xs text-slate-500">
                  Tetapkan harga pokok acuan yang berlaku otomatis ke semua Admin Toko.
                </p>
              </div>

              {cogsSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  COGS berhasil diupdate dan tersinkronisasi ke semua toko!
                </div>
              )}

              <form onSubmit={handleAddNewCogsMaster} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Bahan / Item Daging:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Daging Rendang Impor Premium"
                    value={newCogsName}
                    onChange={(e) => setNewCogsName(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori:
                  </label>
                  <select
                    value={newCogsCategory}
                    onChange={(e) => setNewCogsCategory(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="DAGING FRESH">DAGING FRESH</option>
                    <option value="DAGING PREMIUM">DAGING PREMIUM</option>
                    <option value="RAWON">RAWON</option>
                    <option value="SHANKLE">SHANKLE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Pokok / COGS (Rp / Kg):
                  </label>
                  <input
                    type="number"
                    placeholder="Contoh: 102000"
                    value={newCogsPrice}
                    onChange={(e) => setNewCogsPrice(e.target.value)}
                    className="w-full text-sm font-bold p-2.5 border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow transition"
                >
                  + Tambah Master COGS
                </button>
              </form>
            </div>

            {/* Master COGS List */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Daftar Master Data COGS Nasional ({cogsList.length})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="p-3">Kode</th>
                      <th className="p-3">Nama Bahan</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3 text-right">COGS (Rp / Kg)</th>
                      <th className="p-3">Update Terakhir</th>
                      <th className="p-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cogsList.map((c, idx) => {
                      const catUpper = (c.category || 'DAGING FRESH').toUpperCase();
                      const catCode = catUpper.includes('PREM') ? 'DP' : catUpper.includes('SHANK') ? 'SH' : catUpper.includes('RAWON') ? 'RW' : 'DF';
                      const itemCode = c.itemCode || `${catCode}-${String(idx + 1).padStart(2, '0')}`;
                      const itemName = c.itemName || (c as any).planName || `Bahan ${catUpper} #${idx + 1}`;
                      return (
                        <tr key={c.id || idx} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-slate-700 bg-slate-50/50">{itemCode}</td>
                          <td className="p-3 font-bold text-slate-900">{itemName}</td>
                          <td className="p-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 border border-slate-200">
                              {c.category}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-800">
                            {editingCogsId === c.id ? (
                              <input
                                type="number"
                                value={editCogsValue}
                                onChange={(e) => setEditCogsValue(e.target.value)}
                                className="w-24 text-xs p-1 border border-emerald-500 rounded text-right font-bold"
                                autoFocus
                              />
                            ) : (
                              `Rp ${Number(c.cogsPerKg || 0).toLocaleString('id-ID')}`
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-500">{c.updatedAt || '2026-08-01'}</td>
                          <td className="p-3 text-center">
                            {editingCogsId === c.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleSaveCogsItem(c.id)}
                                  className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Simpan
                                </button>
                                <button
                                  onClick={() => setEditingCogsId(null)}
                                  className="px-2 py-0.5 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded text-[10px] cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingCogsId(c.id);
                                  setEditCogsValue(c.cogsPerKg.toString());
                                }}
                                className="px-2.5 py-1 text-blue-700 hover:bg-blue-50 rounded font-bold text-[11px] cursor-pointer"
                              >
                                Ubah Harga
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MANAJEMEN TOKO & GENERASI AKUN */}
      {/* ========================================================================= */}
      {activeTab === 'stores' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Tambah Toko Baru + Auto Buat Akun Berpasangan */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  Tambah Toko & Akun Baru
                </h2>
                <p className="text-xs text-slate-500">
                  Setiap toko baru akan otomatis dibuatkan 2 akun berpasangan: 1 Akun Butcher & 1 Akun Admin Toko.
                </p>
              </div>

              {storeAddSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Toko dan 2 akun berhasil dibuat!
                </div>
              )}

              {storeAddError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  {storeAddError}
                </div>
              )}

              <form onSubmit={handleAddNewStore} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kode:
                    </label>
                    <input
                      type="text"
                      placeholder="SMG"
                      maxLength={4}
                      value={newStoreCode}
                      onChange={(e) => setNewStoreCode(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg uppercase font-mono font-bold"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Toko:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: TDN Semarang"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kota / Wilayah:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Semarang"
                    value={newStoreCity}
                    onChange={(e) => setNewStoreCity(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Nama Petugas Berpasangan:
                  </span>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Nama Lengkap Butcher:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Joko Butcher"
                      value={newButcherName}
                      onChange={(e) => setNewButcherName(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Nama Lengkap Admin Toko:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Anita Admin"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow transition"
                >
                  + Buat Toko & Generate 2 Akun
                </button>
              </form>
            </div>

            {/* List Toko & Akun Terdaftar */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Daftar Toko & Akun Terhubung ({stores.length} Toko)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="p-3">Toko</th>
                      <th className="p-3">Kota</th>
                      <th className="p-3">Akun Butcher</th>
                      <th className="p-3">Akun Admin Toko</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stores.map((store) => {
                      const storeUsers = users.filter((u) => u.storeId === store.id);
                      const butcherAcc = storeUsers.find((u) => u.role === 'butcher');
                      const adminAcc = storeUsers.find((u) => u.role === 'admin');

                      return (
                        <tr key={store.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">
                            {store.name} ({store.code})
                          </td>
                          <td className="p-3 text-slate-600">{store.city}</td>
                          <td className="p-3">
                            {butcherAcc ? (
                              <div>
                                <span className="font-semibold text-slate-800 block">{butcherAcc.fullName}</span>
                                <span className="font-mono text-[10px] text-slate-500">user: {butcherAcc.username}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono">butcher_{store.code.toLowerCase()}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {adminAcc ? (
                              <div>
                                <span className="font-semibold text-slate-800 block">{adminAcc.fullName}</span>
                                <span className="font-mono text-[10px] text-slate-500">user: {adminAcc.username}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono">admin_{store.code.toLowerCase()}</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                              Aktif
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DETAIL DRILLDOWN PER TOKO */}
      {/* ========================================================================= */}
      {activeTab === 'drilldown' && (() => {
        const currentDrillStore = stores.find((s) => s.id === drilldownStoreId || matchStoreEntity(drilldownStoreId, s)) || stores[0];
        
        const drillItems = (allItems.length > 0 ? allItems : currentStoreItems).filter(
          (i) => matchStoreEntity(i.storeId, currentDrillStore)
        );
        const drillTodayItems = drillItems.filter((i) => !i.isCarryover);
        const drillCarryoverItems = drillItems.filter((i) => i.isCarryover);

        const drillSegments = (allSegments.length > 0 ? allSegments : currentStoreSegments).filter(
          (s) => matchStoreEntity(s.storeId, currentDrillStore)
        );
        const drillAdjustments = (allAdjustments.length > 0 ? allAdjustments : []).filter(
          (a) => matchStoreEntity(a.storeId, currentDrillStore)
        );
        const drillClosing = (allClosingRecords.length > 0 ? allClosingRecords : currentStoreClosingRecords).filter(
          (r) => matchStoreEntity(r.storeId, currentDrillStore)
        );

        const STANDARD_DRILLDOWN_PLANS = [
          'HQ 41/42/44/45',
          'DG RNDG BEKU 1kg',
          'FQ 60 /SHANK',
          'D premium lokal',
          'FRIBOY / Daging Prem 2',
          'Rawon Curah (FQ 106/105)',
          'RENDANG BEKU CURAH',
          'DAGING KHUSUS',
        ];

        const allUniquePlanNames = Array.from(
          new Set([
            ...STANDARD_DRILLDOWN_PLANS,
            ...drillTodayItems.map((i) => i.plannedFabrication || i.name).filter(Boolean),
            ...drillSegments.map((s) => s.plannedFabrication || s.segmentName).filter(Boolean),
            ...drillClosing.map((c) => c.planName).filter(Boolean),
          ])
        );

        const totalBahanStore = drillTodayItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
        const totalHasilStore = drillTodayItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);
        const totalSalesStore = drillClosing.reduce(
          (sum, r) => sum + r.salesKg,
          drillSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0)
        );
        const totalSusutProsesStore = Math.max(0, totalBahanStore - totalHasilStore);
        const totalSusutJualStore = drillClosing.reduce(
          (sum, r) => sum + (r.susutJualKg || 0),
          drillTodayItems.reduce((sum, i) => sum + (i.susutJualKg || 0), 0)
        );

        return (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    Inspeksi Detail Laporan Cabang
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pilih toko cabang untuk menarik data detail proses, mutasi stok, dan closing butcher.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-bold">Pilih Cabang:</span>
                    <select
                      value={drilldownStoreId}
                      onChange={(e) => setDrilldownStoreId(e.target.value)}
                      className="text-xs font-bold p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name} ({s.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  {onSelectStoreForDrilldown && (
                    <button
                      onClick={() => onSelectStoreForDrilldown(currentDrillStore.id)}
                      className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                      title="Buka tampilan Admin Toko lengkap untuk cabang ini"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      Tinjau di Admin Toko
                    </button>
                  )}
                </div>
              </div>

              {/* Drilldown Metric Badges */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Gerai & Wilayah</span>
                  <div className="text-sm font-black text-slate-900 mt-1">{currentDrillStore.name} ({currentDrillStore.code})</div>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{currentDrillStore.city} • <span className="text-emerald-700 font-bold">Tersinkronisasi</span></span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Bahan Diolah Hari Ini</span>
                  <div className="text-sm font-black text-slate-900 mt-1 font-mono">{totalBahanStore.toFixed(2)} Kg</div>
                  <span className="text-[11px] text-slate-600 block mt-0.5">Hasil Bersih: <strong className="text-slate-800 font-mono">{totalHasilStore.toFixed(2)} Kg</strong></span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Susut Proses & Jual</span>
                  <div className="text-sm font-black text-amber-700 mt-1 font-mono">{totalSusutProsesStore.toFixed(3)} Kg</div>
                  <span className="text-[11px] text-red-700 font-medium block mt-0.5">Susut Jual: <strong className="font-mono">{totalSusutJualStore.toFixed(3)} Kg</strong></span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Penjualan</span>
                  <div className="text-sm font-black text-emerald-700 mt-1 font-mono">{totalSalesStore.toFixed(2)} Kg</div>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{cogsList.length} Master COGS Terkait</span>
                </div>
              </div>

              {/* Table of plans for this store */}
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="p-3">Rencana Potong</th>
                      <th className="p-3 text-right">Stok Awal (Kg)</th>
                      <th className="p-3 text-right">Bahan Diolah (Kg)</th>
                      <th className="p-3 text-right">Hasil (Kg)</th>
                      <th className="p-3 text-right font-bold text-emerald-700">Sales (Kg)</th>
                      <th className="p-3 text-right bg-emerald-50/50 font-bold text-slate-900">Sisa Closing Real</th>
                      <th className="p-3 text-right text-red-700">Susut Jual (Kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUniquePlanNames.map((planName) => {
                      const safePlan = String(planName || '').toLowerCase().trim();
                      const rec = drillClosing.find((c) => {
                        const cPlan = String(c.planName || '').toLowerCase().trim();
                        return cPlan === safePlan || cPlan.includes(safePlan) || safePlan.includes(cPlan);
                      });
                      const planItems = drillTodayItems.filter((i) => {
                        const iPlan = String(i.plannedFabrication || i.name || '').toLowerCase().trim();
                        return iPlan === safePlan || iPlan.includes(safePlan) || safePlan.includes(iPlan);
                      });
                      const carryItems = drillCarryoverItems.filter((i) => {
                        const iPlan = String(i.plannedFabrication || i.name || '').toLowerCase().trim();
                        return iPlan === safePlan || iPlan.includes(safePlan) || safePlan.includes(iPlan);
                      });
                      const planSegs = drillSegments.filter((s) => {
                        const sPlan = String(s.plannedFabrication || s.segmentName || '').toLowerCase().trim();
                        return sPlan === safePlan || sPlan.includes(safePlan) || safePlan.includes(sPlan);
                      });

                      const stockAwal = rec
                        ? (typeof rec.openingStockKg === 'number' && !isNaN(rec.openingStockKg) ? rec.openingStockKg : 0)
                        : carryItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0);
                      const bahanDiolah = planItems.reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0);
                      const hasilPotong = planItems.reduce(
                        (sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing || 0),
                        0
                      );
                      const sales = rec
                        ? (typeof rec.salesKg === 'number' && !isNaN(rec.salesKg) ? rec.salesKg : 0)
                        : planSegs.reduce((sum, s) => sum + (s.salesKg || 0), 0);
                      const stokSistem = Math.max(0, stockAwal + hasilPotong - sales);
                      const stokReal = rec
                        ? (typeof rec.actualClosingStockKg === 'number' && !isNaN(rec.actualClosingStockKg) ? rec.actualClosingStockKg : 0)
                        : planSegs.reduce((sum, s) => sum + (s.actualWeight || 0), 0);
                      const susutJual = rec
                        ? (typeof rec.susutJualKg === 'number' && !isNaN(rec.susutJualKg) ? rec.susutJualKg : 0)
                        : (bahanDiolah > 0 || sales > 0 ? Math.max(0, stokSistem - stokReal) : 0);

                      return (
                        <tr key={planName} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{planName}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{stockAwal.toFixed(3)}</td>
                          <td className="p-3 text-right font-mono text-slate-700 font-semibold">{bahanDiolah.toFixed(3)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">{hasilPotong.toFixed(3)}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">{sales.toFixed(3)}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900 bg-emerald-50/50">
                            {stokReal.toFixed(3)} Kg
                          </td>
                          <td className="p-3 text-right font-mono text-red-700 font-semibold">{susutJual.toFixed(3)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 5: DOWNLOAD REKAP MULTI-TOKO */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5 max-w-2xl mx-auto">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Download Rekap Susut Nasional ({stores.length} Toko)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ekspor rekapitulasi susut seluruh cabang dengan format multi-sheet persis <strong className="text-slate-800">SUSUT JULI / AGUSTUS 2026.xlsx</strong>.
            </p>
          </div>

          {/* Date Range Selector (From - To) */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 space-y-2">
            <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-700" />
              Rentang Tanggal Rekap (From - To)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1">Dari Tanggal (From):</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1">Sampai Tanggal (To):</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="text-[11px] text-emerald-800 font-medium pt-1">
              Periode Aktif: <strong>{dateRangeLabel}</strong> • Total Laporan Terfilter: <strong>{filteredReports.length}</strong>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800">Daftar Sheet Excel yang Digenerate Otomatis:</h3>
            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div>• <strong>KONSOLIDASI ALL:</strong> Rekap Nasional Semua Toko</div>
              <div>• <strong>SHANKLE 1 & MODAL:</strong> Rekap & Valuasi Shankle</div>
              <div>• <strong>RENDANG 1 & MODAL:</strong> Rekap & Valuasi Rendang</div>
              <div>• <strong>PREM 1 & MODAL:</strong> Rekap & Valuasi Daging Premium</div>
              <div>• <strong>RAWON 1 & MODAL:</strong> Rekap & Valuasi Rawon Fresh</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleExportMultiStoreExcel}
              className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Download Rekap Excel Multi-Sheet (.XLSX)
            </button>
            <button
              onClick={handleExportMultiStoreCSV}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Download className="w-5 h-5" />
              Download CSV Rekap (.CSV)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
