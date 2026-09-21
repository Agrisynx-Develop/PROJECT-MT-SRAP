import React, { useState, useMemo } from 'react';
import {
  ClosingPlanRecord,
  ThawingItem,
  DailyClosingReport,
  Store,
  UserAccount
} from '../types';
import {
  X,
  Database,
  Calendar,
  Search,
  Filter,
  Trash2,
  Edit2,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  Maximize2,
  RefreshCw,
  Package,
  Beef,
  FileText
} from 'lucide-react';
import { matchStoreEntity } from '../utils/storeHelper';

interface SavedDataViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore: Store;
  currentUser: UserAccount;
  closingRecords: ClosingPlanRecord[];
  items: ThawingItem[];
  reports?: DailyClosingReport[];
  initialDate?: string;
  onEditClosingRecord?: (record: ClosingPlanRecord) => void;
  onDeleteClosingRecord?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
}

export default function SavedDataViewerModal({
  isOpen,
  onClose,
  currentStore,
  currentUser,
  closingRecords = [],
  items = [],
  reports = [],
  initialDate,
  onEditClosingRecord,
  onDeleteClosingRecord,
  onDeleteItem,
}: SavedDataViewerModalProps) {
  const [activeTab, setActiveTab] = useState<'closing' | 'bahan' | 'laporan'>('closing');
  const [filterDate, setFilterDate] = useState<string>(initialDate || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomedPhoto, setZoomedPhoto] = useState<{ url: string; title: string } | null>(null);

  // Available unique dates from saved data
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    closingRecords.forEach((c) => {
      const d = (c.date || c.timestamp || '').split('T')[0];
      if (d && d !== '2026-08-29') set.add(d);
    });
    items.forEach((i) => {
      const d = (i.createdAt || i.thawingStartTime || '').split('T')[0];
      if (d && d !== '2026-08-29') set.add(d);
    });
    reports.forEach((r) => {
      const d = (r.date || '').split('T')[0];
      if (d && d !== '2026-08-29') set.add(d);
    });
    return Array.from(set).sort().reverse();
  }, [closingRecords, items, reports]);

  // Filter Closing Records
  const filteredClosingRecords = useMemo(() => {
    return closingRecords.filter((r) => {
      if (!matchStoreEntity(r.storeId, currentStore)) return false;
      const recDate = (r.date || r.timestamp || '').split('T')[0];
      if (recDate === '2026-08-29') return false;
      if (filterDate !== 'ALL' && recDate !== filterDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const plan = (r.planName || '').toLowerCase();
        const cat = (r.category || '').toLowerCase();
        const note = (r.note || '').toLowerCase();
        const butcher = (r.butcherName || '').toLowerCase();
        if (!plan.includes(q) && !cat.includes(q) && !note.includes(q) && !butcher.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [closingRecords, currentStore, filterDate, searchQuery]);

  // Filter Raw Materials / Thawing Items
  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (!matchStoreEntity(i.storeId, currentStore)) return false;
      const itemDate = (i.createdAt || i.thawingStartTime || '').split('T')[0];
      if (itemDate === '2026-08-29') return false;
      if (filterDate !== 'ALL' && itemDate !== filterDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (i.name || '').toLowerCase();
        const plan = (i.plannedFabrication || '').toLowerCase();
        const cat = (i.pabrikasiCategory || '').toLowerCase();
        const butcher = (i.butcherName || '').toLowerCase();
        if (!name.includes(q) && !plan.includes(q) && !cat.includes(q) && !butcher.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [items, currentStore, filterDate, searchQuery]);

  // Filter Daily Reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (!matchStoreEntity(r.storeId, currentStore)) return false;
      const repDate = (r.date || '').split('T')[0];
      if (repDate === '2026-08-29') return false;
      if (filterDate !== 'ALL' && repDate !== filterDate) return false;
      return true;
    });
  }, [reports, currentStore, filterDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header Window */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Window Data Tersimpan di Database</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500 text-white uppercase tracking-wider">
                  {currentStore.code} - {currentStore.name}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Audit log lengkap seluruh transaksi closing fisik, bahan baku masuk terlewat, dan rekap harian yang tersimpan di sistem.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Tutup Window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('closing')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'closing'
                  ? 'bg-white text-blue-900 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4 text-blue-600" />
              <span>Data Closing</span>
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black">
                {filteredClosingRecords.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('bahan')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'bahan'
                  ? 'bg-white text-blue-900 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Beef className="w-4 h-4 text-emerald-600" />
              <span>Bahan Masuk / Terlewat</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                {filteredItems.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('laporan')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'laporan'
                  ? 'bg-white text-blue-900 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Rekap Harian</span>
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-black">
                {filteredReports.length}
              </span>
            </button>
          </div>

          {/* Controls: Date Filter & Search */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Tanggal ({availableDates.length})</option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari data..."
                className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* TAB 1: CLOSING PLAN RECORDS */}
          {activeTab === 'closing' && (
            <div className="space-y-4">
              {filteredClosingRecords.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Package className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Tidak ada data closing tersimpan</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {filterDate !== 'ALL'
                      ? `Belum ada record closing untuk tanggal ${filterDate}. Pilih "Semua Tanggal" atau input closing baru.`
                      : 'Belum ada data closing fisik yang disimpan di database.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Rencana Potong</th>
                        <th className="p-3">Kategori</th>
                        <th className="p-3 text-right">Sisa Kemarin (Kg)</th>
                        <th className="p-3 text-right">Diolah Hari Ini (Kg)</th>
                        <th className="p-3 text-right">Penjualan (Kg)</th>
                        <th className="p-3 text-right">Sisa Sistem (Kg)</th>
                        <th className="p-3 text-right bg-blue-50/80 text-blue-950 font-black">
                          Sisa Fisik Real (Kg)
                        </th>
                        <th className="p-3 text-right text-red-700">Susut Jual (Kg)</th>
                        <th className="p-3 text-center">Foto Timbangan</th>
                        <th className="p-3">Petugas</th>
                        <th className="p-3">Catatan</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredClosingRecords.map((rec) => {
                        const recDate = (rec.date || rec.timestamp || '').split('T')[0];
                        return (
                          <tr key={rec.id} className="hover:bg-blue-50/40 transition">
                            <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                              {recDate}
                            </td>
                            <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                              {rec.planName}
                            </td>
                            <td className="p-3 text-slate-600">
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700">
                                {rec.category}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600">
                              {(Number(rec.openingStockKg) || 0).toFixed(3)}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-700 font-bold">
                              {(Number(rec.newProcessedKg) || 0).toFixed(3)}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-700 font-bold">
                              {(Number(rec.salesKg) || 0).toFixed(3)}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-700">
                              {(Number(rec.closingStockBySystemKg) || 0).toFixed(3)}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-blue-900 bg-blue-50/50">
                              {(Number(rec.actualClosingStockKg) || 0).toFixed(3)} Kg
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-red-700">
                              {(Number(rec.susutJualKg) || 0).toFixed(3)}
                            </td>
                            <td className="p-3 text-center">
                              {rec.photoUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setZoomedPhoto({
                                      url: rec.photoUrl!,
                                      title: `Bukti Fisik Closing: ${rec.planName} (${recDate})`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-bold bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition cursor-pointer"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <span>Lihat Foto</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700 whitespace-nowrap text-[11px]">
                              {rec.butcherName || 'Petugas'}
                            </td>
                            <td className="p-3 text-slate-600 max-w-xs truncate text-[11px]" title={rec.note}>
                              {rec.note || '-'}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {onEditClosingRecord && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onEditClosingRecord(rec);
                                      onClose();
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                    title="Koreksi / Edit data closing ini di Form"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onDeleteClosingRecord && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Hapus data closing "${rec.planName}" tanggal ${recDate}?`
                                        )
                                      ) {
                                        onDeleteClosingRecord(rec.id);
                                      }
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                    title="Hapus data closing"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RAW MATERIALS / THAWING ITEMS */}
          {activeTab === 'bahan' && (
            <div className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Beef className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Tidak ada data bahan masuk</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {filterDate !== 'ALL'
                      ? `Belum ada bahan baku untuk tanggal ${filterDate}.`
                      : 'Belum ada bahan baku masuk yang tersimpan.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Nama Bahan Baku</th>
                        <th className="p-3">Rencana Potong</th>
                        <th className="p-3">Kategori</th>
                        <th className="p-3 text-right">Tally / Sebelum (Kg)</th>
                        <th className="p-3 text-right">Netto / Sesudah (Kg)</th>
                        <th className="p-3 text-right text-amber-700">Susut Thawing (Kg)</th>
                        <th className="p-3 text-right text-amber-700">Susut (%)</th>
                        <th className="p-3 text-center">Foto Timbangan</th>
                        <th className="p-3">Petugas</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredItems.map((item) => {
                        const itemDate = (item.createdAt || item.thawingStartTime || '').split('T')[0];
                        const wBefore = Number(item.weightBeforeThawing) || 0;
                        const wAfter = Number(item.weightAfterThawing) || wBefore;
                        const lossKg = Math.max(0, wBefore - wAfter);
                        const lossPct = wBefore > 0 ? (lossKg / wBefore) * 100 : 0;

                        return (
                          <tr key={item.id} className="hover:bg-emerald-50/40 transition">
                            <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                              {itemDate}
                            </td>
                            <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                              {item.name}
                            </td>
                            <td className="p-3 text-blue-900 font-semibold whitespace-nowrap">
                              {item.plannedFabrication || '-'}
                            </td>
                            <td className="p-3 text-slate-600">
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700">
                                {item.pabrikasiCategory || 'DAGING FRESH'}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-700 font-bold">
                              {wBefore.toFixed(3)}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-800 font-bold bg-emerald-50/40">
                              {wAfter.toFixed(3)}
                            </td>
                            <td className="p-3 text-right font-mono text-amber-700 font-bold">
                              {lossKg.toFixed(3)}
                            </td>
                            <td className="p-3 text-right font-mono text-amber-700 font-bold">
                              {lossPct.toFixed(2)}%
                            </td>
                            <td className="p-3 text-center">
                              {item.image && item.image !== 'placeholder' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setZoomedPhoto({
                                      url: item.image!,
                                      title: `Timbangan Bahan: ${item.name} (${itemDate})`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition cursor-pointer"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <span>Lihat Foto</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700 whitespace-nowrap text-[11px]">
                              {item.butcherName || 'Petugas'}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {onDeleteItem && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Hapus data bahan baku "${item.name}" tanggal ${itemDate}?`
                                      )
                                    ) {
                                      onDeleteItem(item.id);
                                    }
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Hapus data bahan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DAILY CLOSING REPORTS */}
          {activeTab === 'laporan' && (
            <div className="space-y-4">
              {filteredReports.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Tidak ada rekap laporan harian</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Laporan harian otomatis terisi saat data closing disimpan.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3">Tanggal Laporan</th>
                        <th className="p-3 text-right">Total Diolah (Kg)</th>
                        <th className="p-3 text-right">Total Susut Proses (Kg)</th>
                        <th className="p-3 text-right">Total Susut Jual (Kg)</th>
                        <th className="p-3 text-right">Total Sales (Kg)</th>
                        <th className="p-3 text-right bg-blue-50/80 font-black text-blue-950">
                          Sisa Stok Closing (Kg)
                        </th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Admin In Charge</th>
                        <th className="p-3">Butcher In Charge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredReports.map((rep) => (
                        <tr key={rep.id} className="hover:bg-indigo-50/40 transition">
                          <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {rep.date}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-700 font-bold">
                            {(rep.totalWeightBeforeThawing || 0).toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-mono text-amber-700 font-bold">
                            {(rep.totalProcessLoss || 0).toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-mono text-red-700 font-bold">
                            {(rep.totalSusutJual || 0).toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-700 font-bold">
                            {(rep.totalSalesKg || 0).toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-blue-900 bg-blue-50/50">
                            {(rep.currentClosingStockKg || 0).toFixed(3)} Kg
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Finalized
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 whitespace-nowrap text-[11px]">
                            {rep.adminInCharge || '-'}
                          </td>
                          <td className="p-3 text-slate-700 whitespace-nowrap text-[11px]">
                            {rep.butcherInCharge || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Window */}
        <div className="bg-slate-100 border-t border-slate-200 p-3.5 px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total Record Closing:{' '}
              <strong className="text-slate-900 font-black">{filteredClosingRecords.length}</strong>
            </span>
            <span>
              Total Bahan Masuk:{' '}
              <strong className="text-slate-900 font-black">{filteredItems.length}</strong>
            </span>
            <span>
              Toko Aktif: <strong className="text-blue-900 font-bold">{currentStore.name}</strong>
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer shadow-xs"
          >
            Tutup Window
          </button>
        </div>
      </div>

      {/* Lightbox Zoom Photo */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setZoomedPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">{zoomedPhoto.title}</span>
              <button
                onClick={() => setZoomedPhoto(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/50 max-h-[75vh] overflow-auto">
              <img
                src={zoomedPhoto.url}
                alt={zoomedPhoto.title}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
