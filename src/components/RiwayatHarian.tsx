import React, { useState, useEffect, useMemo } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  DailyClosingReport,
  ReportPhotoAttachment,
  Store,
  ClosingPlanRecord,
  StockAdjustment,
  CogsMaster,
} from '../types';
import { exportStoreDailyLaporanExcel } from '../utils/excelExport';
import {
  Camera,
  Trash2,
  Image as ImageIcon,
  Tag,
  Maximize2,
  X,
  Calendar,
  Download,
  Clock,
  Building2,
  FileSpreadsheet,
  Weight,
  Scale,
} from 'lucide-react';

interface RiwayatHarianProps {
  items: ThawingItem[];
  segments: FabricationSegment[];
  reports: DailyClosingReport[];
  closingRecords?: ClosingPlanRecord[];
  adjustments?: StockAdjustment[];
  cogsList?: CogsMaster[];
  currentStore?: Store;
  onCloseDay?: (closedReport: DailyClosingReport) => void;
  onDeleteReport?: (id: string) => void;
}

export default function RiwayatHarian({
  items,
  segments,
  reports = [],
  closingRecords = [],
  adjustments = [],
  cogsList = [],
  currentStore,
  onCloseDay,
  onDeleteReport,
}: RiwayatHarianProps) {
  // Store name display
  const cleanStoreName = currentStore?.name
    ? String(currentStore.name).replace(/^TDN\s*/i, '').trim()
    : 'CKR';
  const todanusDisplay = `TODANUS ${cleanStoreName.toUpperCase()}`;

  // State: selected report or viewing today's draft
  const [viewingTodayDraft, setViewingTodayDraft] = useState<boolean>(true);
  const [selectedReport, setSelectedReport] = useState<DailyClosingReport | null>(null);

  // Today string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Storage key for IDs of deleted/hidden photos
  const deletedStorageKey = `tdn_photos_deleted_${currentStore?.id || 'default'}`;

  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(deletedStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist deleted IDs
  useEffect(() => {
    try {
      localStorage.setItem(deletedStorageKey, JSON.stringify(deletedPhotoIds));
    } catch (e) {
      console.warn('Gagal menyimpan deletedPhotoIds:', e);
    }
  }, [deletedPhotoIds, deletedStorageKey]);

  // Lightbox modal state
  const [previewPhoto, setPreviewPhoto] = useState<ReportPhotoAttachment | null>(null);

  // Active viewing date
  const activeDate = viewingTodayDraft
    ? todayStr
    : selectedReport?.date || todayStr;

  // Formatted date label for current selection
  const formattedActiveDate = useMemo(() => {
    try {
      const d = new Date(activeDate);
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return activeDate;
    }
  }, [activeDate]);

  // 1. Photos from Thawing Items (Timbangan Awal Thawing)
  const dashboardItemPhotos: ReportPhotoAttachment[] = useMemo(() => {
    return items
      .filter((item) => {
        if (!item.image || item.image === 'placeholder' || !item.image.trim()) return false;
        if (viewingTodayDraft) return true;
        const itemDate = (item.createdAt || '').split('T')[0];
        return itemDate === activeDate;
      })
      .map((item) => {
        const weightStr = (item.weightBeforeThawing || 0).toFixed(2);
        const weightAfterStr =
          typeof item.weightAfterThawing === 'number' && item.weightAfterThawing > 0
            ? ` | Thawing: ${item.weightAfterThawing.toFixed(2)} Kg`
            : '';
        const rencanaStr = item.plannedFabrication ? ` [${item.plannedFabrication}]` : '';

        return {
          id: `photo_item_${item.id}`,
          url: item.image,
          caption: `Timbangan Raw/Thawing: ${item.name} (${weightStr} Kg)${weightAfterStr}${rencanaStr}`,
          category: 'Timbangan' as const,
          uploadedAt: item.createdAt || new Date().toISOString(),
        };
      });
  }, [items, viewingTodayDraft, activeDate]);

  // 2. Photos from Closing Fisik per Rencana Potong
  const closingPhotos: ReportPhotoAttachment[] = useMemo(() => {
    // Collect from current closingRecords
    const currentList = (closingRecords || []).filter((rec) => {
      if (!rec.photoUrl || rec.photoUrl === 'placeholder' || !rec.photoUrl.trim()) return false;
      if (viewingTodayDraft) return true;
      const recDate = (rec.timestamp || '').split('T')[0];
      return recDate === activeDate;
    });

    // Also collect from selectedReport.closingPlanRecords if viewing past report
    const pastClosingList =
      !viewingTodayDraft && selectedReport?.closingPlanRecords
        ? selectedReport.closingPlanRecords.filter(
            (rec) => rec.photoUrl && rec.photoUrl !== 'placeholder' && rec.photoUrl.trim()
          )
        : [];

    const combinedClosing = [...currentList, ...pastClosingList];

    return combinedClosing.map((rec) => {
      const weightVal =
        typeof rec.actualClosingStockKg === 'number' && !isNaN(rec.actualClosingStockKg)
          ? rec.actualClosingStockKg
          : 0;
      return {
        id: `photo_closing_${rec.id}`,
        url: rec.photoUrl!,
        caption:
          rec.photoCaption ||
          `Timbangan Fisik Sisa Closing: ${rec.planName} (${weightVal.toFixed(2)} Kg)`,
        category: 'Closing Stock' as const,
        uploadedAt: rec.timestamp || new Date().toISOString(),
      };
    });
  }, [closingRecords, viewingTodayDraft, activeDate, selectedReport]);

  // 3. Photos from historical daily closing reports
  const reportSpecificPhotos: ReportPhotoAttachment[] = useMemo(() => {
    if (viewingTodayDraft) return [];
    if (!selectedReport || !selectedReport.photos) return [];
    return selectedReport.photos.filter(
      (p) => p.url && p.url !== 'placeholder' && !deletedPhotoIds.includes(p.id)
    );
  }, [viewingTodayDraft, selectedReport, deletedPhotoIds]);

  // 4. Combine all inputted photos for current active selection
  const currentPhotos: ReportPhotoAttachment[] = useMemo(() => {
    const photoMap = new Map<string, ReportPhotoAttachment>();

    [...reportSpecificPhotos, ...dashboardItemPhotos, ...closingPhotos].forEach((p) => {
      if (p.id && !deletedPhotoIds.includes(p.id)) {
        photoMap.set(p.id, p);
      }
    });

    return Array.from(photoMap.values()).sort((a, b) => {
      const timeA = new Date(a.uploadedAt || 0).getTime();
      const timeB = new Date(b.uploadedAt || 0).getTime();
      return timeB - timeA; // newest first
    });
  }, [reportSpecificPhotos, dashboardItemPhotos, closingPhotos, deletedPhotoIds]);

  // Delete photo
  const handleDeletePhoto = (photoId: string) => {
    if (window.confirm('Hapus tampilan foto dokumentasi ini?')) {
      setDeletedPhotoIds((prev) => [...prev, photoId]);
      if (previewPhoto?.id === photoId) {
        setPreviewPhoto(null);
      }
    }
  };

  // Download photo file
  const handleDownloadPhoto = (photo: ReportPhotoAttachment) => {
    try {
      const link = document.createElement('a');
      link.href = photo.url;
      const cleanCap = (photo.caption || 'dokumentasi')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30);
      link.download = `foto_${photo.category || 'doc'}_${cleanCap}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Gagal mengunduh foto:', e);
    }
  };

  // Export excel for active report/date
  const handleExportExcelForActiveDate = () => {
    if (!currentStore) return;
    try {
      exportStoreDailyLaporanExcel(
        currentStore,
        activeDate,
        items,
        segments,
        adjustments,
        closingRecords,
        cogsList
      );
    } catch (e) {
      console.error('Gagal mengunduh Excel:', e);
      alert('Gagal mengekspor laporan Excel.');
    }
  };

  // Sorted reports descending
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      return timeB - timeA;
    });
  }, [reports]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Riwayat Harian & List Laporan Excel
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-0.5">
              Arsip laporan harian Excel {todanusDisplay} dan dokumentasi foto hasil input operasional.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs font-black px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            {todanusDisplay}
          </span>
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            {reports.length} Laporan Closing
          </span>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout: Left = List Laporan Excel, Right = Riwayat Foto */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: List Laporan Excel & Draft Hari Ini */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Left Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-white">
                  List Laporan Excel Harian
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-md">
                {reports.length + 1} Periode
              </span>
            </div>

            <div className="p-3 space-y-2.5 max-h-[calc(100vh-260px)] overflow-y-auto">
              {/* Draft Operasional Hari Ini Card */}
              <div
                onClick={() => {
                  setViewingTodayDraft(true);
                  setSelectedReport(null);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                  viewingTodayDraft
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-extrabold text-slate-900">
                      Draft Operasional Hari Ini
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Aktif
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  {new Date().toLocaleDateString('id-ID', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                  <span>{items.length} Item Bahan</span>
                  <span className="font-bold text-purple-700 flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    {viewingTodayDraft ? currentPhotos.length : '-'} Foto
                  </span>
                </div>
              </div>

              {/* Separator / Title */}
              <div className="pt-2 pb-1 px-1 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Arsip Laporan Closing
                </span>
                <span className="text-[10px] text-slate-400">Terbaru di atas</span>
              </div>

              {/* List of past closing reports */}
              {sortedReports.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Belum ada arsip closing. Silakan segarkan closing harian untuk membekukan laporan.
                </div>
              ) : (
                sortedReports.map((rep) => {
                  const isSelected = !viewingTodayDraft && selectedReport?.id === rep.id;
                  const repDateFormatted = (() => {
                    try {
                      return new Date(rep.date).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });
                    } catch {
                      return rep.date;
                    }
                  })();

                  const repPhotosCount = (rep.photos || []).length;

                  return (
                    <div
                      key={rep.id}
                      onClick={() => {
                        setViewingTodayDraft(false);
                        setSelectedReport(rep);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                        isSelected
                          ? 'bg-purple-50/80 border-purple-500 shadow-xs ring-2 ring-purple-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900">
                          {repDateFormatted}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          Closing Resmi
                        </span>
                      </div>

                      {/* Metrics summary */}
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Susut Proses</span>
                          <span className="font-bold text-slate-800">
                            {(rep.totalProcessLoss || 0).toFixed(2)} Kg
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Susut Jual</span>
                          <span className="font-bold text-slate-800">
                            {(rep.totalSusutJual || 0).toFixed(2)} Kg
                          </span>
                        </div>
                      </div>

                      {/* Bottom row actions */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] text-purple-700 font-bold">
                          <Camera className="w-3 h-3" />
                          <span>{repPhotosCount} Foto</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Download Excel button for this report */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentStore) {
                                exportStoreDailyLaporanExcel(
                                  currentStore,
                                  rep.date,
                                  items,
                                  segments,
                                  adjustments,
                                  closingRecords,
                                  cogsList
                                );
                              }
                            }}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Unduh Laporan Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete report button */}
                          {onDeleteReport && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    `Yakin ingin menghapus arsip closing tanggal ${repDateFormatted}?`
                                  )
                                ) {
                                  onDeleteReport(rep.id);
                                  if (selectedReport?.id === rep.id) {
                                    setViewingTodayDraft(true);
                                    setSelectedReport(null);
                                  }
                                }
                              }}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus Laporan Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Riwayat Foto & Keterangan (Hanya Menampilkan Foto Yang Diinput) */}
        <div className="lg:col-span-8 xl:col-span-8 space-y-4">
          {/* Top Bar with Riwayat Foto Pill & Unduh Excel Action */}
          <div className="bg-slate-900 text-white p-4 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-1.5 rounded-full bg-purple-600 text-white text-xs font-black flex items-center gap-1.5 shadow-xs">
                <Camera className="w-4 h-4" />
                <span>Riwayat Foto & Keterangan ({currentPhotos.length})</span>
              </div>
              <span className="text-xs font-bold text-slate-300 hidden md:inline">
                • {formattedActiveDate}
              </span>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={handleExportExcelForActiveDate}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                title="Unduh Laporan Excel Tanggal Ini (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Unduh Laporan Excel</span>
              </button>
            </div>
          </div>

          {/* Photo Gallery Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-purple-600" />
                Foto Yang Diinput ({currentPhotos.length} Foto)
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                *Rasio asli tidak terpotong (contain)
              </span>
            </div>

            {currentPhotos.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-slate-400 space-y-2">
                <div className="p-3 bg-purple-50 text-purple-400 rounded-full inline-block">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <p className="text-xs font-black text-slate-700">
                  Belum ada foto yang diinput pada periode {formattedActiveDate}.
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Foto yang diinput saat timbangan awal thawing atau penimbangan fisik closing akan otomatis ditampilkan di sini dengan keterangan lengkap.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {currentPhotos.map((photo) => {
                  const photoDateObj = photo.uploadedAt ? new Date(photo.uploadedAt) : null;
                  const formattedDate = photoDateObj
                    ? photoDateObj.toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '-';
                  const formattedTime = photoDateObj
                    ? photoDateObj.toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  const isTimbangan =
                    photo.category === 'Timbangan' ||
                    photo.caption.toLowerCase().includes('raw') ||
                    photo.caption.toLowerCase().includes('thawing');

                  return (
                    <div
                      key={photo.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all group"
                    >
                      {/* Photo Frame (contain, uncropped) */}
                      <div className="relative w-full h-56 bg-slate-950 flex items-center justify-center p-2 overflow-hidden">
                        <img
                          src={photo.url}
                          alt={photo.caption}
                          className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-102"
                          loading="lazy"
                        />

                        {/* Zoom Button */}
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto(photo)}
                          className="absolute top-2.5 right-2.5 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg transition cursor-pointer backdrop-blur-xs shadow-md"
                          title="Perbesar Layar Penuh"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Category Tag */}
                        <span
                          className={`absolute top-2.5 left-2.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 border ${
                            isTimbangan
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              : 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                          }`}
                        >
                          {isTimbangan ? (
                            <Scale className="w-2.5 h-2.5 text-amber-400" />
                          ) : (
                            <Tag className="w-2.5 h-2.5 text-purple-400" />
                          )}
                          {photo.category || (isTimbangan ? 'Timbangan' : 'Closing Stock')}
                        </span>
                      </div>

                      {/* Metadata & Caption */}
                      <div className="p-3.5 space-y-2.5 bg-white flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formattedDate}
                            </span>
                            {formattedTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formattedTime}
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-bold text-slate-900 leading-snug">
                            {photo.caption}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto(photo)}
                              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Maximize2 className="w-3 h-3" /> Zoom
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPhoto(photo)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Unduh foto"
                            >
                              <Download className="w-3 h-3" /> Unduh
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Hapus foto dari tampilan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Zoom Modal (Uncropped Fullscreen View) */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 md:p-6 animate-in fade-in duration-150">
          <div className="w-full max-w-5xl flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-black uppercase bg-purple-600 text-white px-2.5 py-1 rounded-md">
                {previewPhoto.category || 'Dokumentasi'}
              </span>
              <h3 className="text-xs md:text-sm font-bold text-white truncate max-w-xl">
                {previewPhoto.caption}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadPhoto(previewPhoto)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="Download Foto"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Unduh</span>
              </button>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl transition cursor-pointer"
                title="Tutup Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Uncropped Full View */}
          <div className="my-auto max-w-5xl max-h-[75vh] w-full flex items-center justify-center p-2">
            <img
              src={previewPhoto.url}
              alt={previewPhoto.caption}
              className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          <div className="w-full max-w-5xl text-center text-slate-400 text-xs pt-3 border-t border-white/10 flex items-center justify-between">
            <span>
              {previewPhoto.uploadedAt
                ? new Date(previewPhoto.uploadedAt).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : ''}
            </span>
            <span className="text-[11px] text-slate-500">
              *Foto resolusi penuh tanpa terpotong.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
