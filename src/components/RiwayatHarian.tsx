import React, { useState } from 'react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { ThawingItem, FabricationSegment, DailyClosingReport, ReportPhotoAttachment, Store, ClosingPlanRecord } from '../types';
import { processHighResImage } from '../utils/imageCompressor';
import {
  FileText,
  CheckSquare,
  Calendar,
  User,
  Printer,
  CheckCircle,
  Camera,
  Plus,
  Trash2,
  Image as ImageIcon,
  Tag,
  Maximize2,
  X,
  FileCheck,
  Loader2,
} from 'lucide-react';

interface RiwayatHarianProps {
  items: ThawingItem[];
  segments: FabricationSegment[];
  reports: DailyClosingReport[];
  closingRecords?: ClosingPlanRecord[];
  currentStore?: Store;
  onCloseDay: (closedReport: DailyClosingReport) => void;
}

export default function RiwayatHarian({
  items,
  segments,
  reports,
  closingRecords = [],
  currentStore,
  onCloseDay,
}: RiwayatHarianProps) {
  const [selectedReport, setSelectedReport] = useState<DailyClosingReport | null>(null);
  const [viewingTodayDraft, setViewingTodayDraft] = useState(true);
  const [isClosingConfirm, setIsClosingConfirm] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isOptimizingPhoto, setIsOptimizingPhoto] = useState(false);

  // Dynamic store name
  const cleanStoreName = currentStore?.name ? String(currentStore.name).replace(/^TDN\s*/i, '').trim() : 'CIKUT';
  const todanusDisplay = `TODANUS ${cleanStoreName.toUpperCase()}`;

  // Photo Attachments State for Today's Draft
  const [draftPhotos, setDraftPhotos] = useState<ReportPhotoAttachment[]>([]);

  // Attachment upload form state
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newCategory, setNewCategory] = useState<'Timbangan' | 'Kebersihan Area' | 'Hasil Packaging' | 'Berita Acara' | 'Lainnya'>('Timbangan');
  const [uploadError, setUploadError] = useState('');

  // Lightbox Modal state
  const [previewPhoto, setPreviewPhoto] = useState<ReportPhotoAttachment | null>(null);

  // Active view tab: 'report' or 'lampiran'
  const [reportTab, setReportTab] = useState<'report' | 'lampiran'>('report');

  const isPlanMatch = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const cleanA = a.toLowerCase().trim();
    const cleanB = b.toLowerCase().trim();
    return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
  };

  // --- COMPILE TODAY'S OPERATION DRAFT ---
  const compileTodayDraft = (): DailyClosingReport => {
    const now = new Date();
    const finishedItems = items.filter((i) => i.status === 'pabrikasi_done');
    const totalThawingQty = items.length;
    const totalProcessedQty = finishedItems.length;

    const totalWeightBeforeThawing = items.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
    const totalWeightAfterThawing = items.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);
    const totalWeightAfterFabrication = segments.reduce((sum, s) => sum + s.actualWeight, 0);

    const totalThawingLoss = Math.max(0, totalWeightBeforeThawing - totalWeightAfterThawing);
    const totalFabricationLoss = Math.max(0, totalWeightAfterThawing - totalWeightAfterFabrication);
    const totalProcessLoss = Math.max(0, totalWeightBeforeThawing - totalWeightAfterFabrication);

    // Derived from Closing Rencana Potong (closingRecords) as requested
    const totalSusutJual = closingRecords && closingRecords.length > 0
      ? closingRecords.reduce((sum, r) => sum + (r.susutJualKg || 0), 0)
      : segments.reduce((sum, s) => sum + (s.periodicShrinkage || 0), 0);

    const totalSalesKg = segments.reduce((sum, s) => sum + (s.salesKg || 0), 0);

    const itemsProcessedList = items.map((item) => {
      const itemSegments = segments.filter((s) => s.itemId === item.id);
      const finalWeight = itemSegments.reduce((sum, s) => sum + s.actualWeight, 0);
      const weightAfter = item.weightAfterThawing || item.weightBeforeThawing;

      const thawingLoss = Math.max(0, item.weightBeforeThawing - weightAfter);
      const thawingLossPercent = item.weightBeforeThawing > 0 ? (thawingLoss / item.weightBeforeThawing) * 100 : 0;

      const fabLoss = Math.max(0, weightAfter - finalWeight);
      const fabLossPercent = weightAfter > 0 ? (fabLoss / weightAfter) * 100 : 0;

      const processLossKg = Math.max(0, item.weightBeforeThawing - (itemSegments.length > 0 ? finalWeight : weightAfter));
      const processLossPercent = item.weightBeforeThawing > 0 ? (processLossKg / item.weightBeforeThawing) * 100 : 0;

      // Find matching closing record for this item's plan
      const matchingClosing = closingRecords?.find(
        (c) => isPlanMatch(c.planName, item.plannedFabrication) || isPlanMatch(c.planName, item.name)
      );

      const susutJualKg = matchingClosing
        ? matchingClosing.susutJualKg
        : itemSegments.reduce((sum, s) => sum + (s.periodicShrinkage || 0), 0);

      const susutJualPercent = (finalWeight + susutJualKg) > 0 ? (susutJualKg / (finalWeight + susutJualKg)) * 100 : 0;

      const itemSalesKg = itemSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0);
      const openingStockKg = finalWeight + susutJualKg + itemSalesKg;
      const closingStockKg = finalWeight;

      const purpose = item.openingPurpose || 'UNTUK DISPLAY';

      const fabricatedSegments = itemSegments.map((s) => ({
        segmentName: s.segmentName,
        actualWeight: s.actualWeight,
        targetWeight: s.targetWeight,
        periodicShrinkage: s.periodicShrinkage || 0,
        salesKg: s.salesKg || 0,
      }));

      return {
        id: item.id,
        name: item.name,
        pabrikasiCategory: item.pabrikasiCategory || 'DAGING FRESH',
        plannedFabrication: item.plannedFabrication || 'DAGING RENDANG PREMIUM',
        openingPurpose: purpose,
        pricePerKg: item.pricePerKg,
        weightBefore: item.weightBeforeThawing,
        weightAfter: weightAfter,
        finalWeight: finalWeight,
        thawingLossPercent,
        fabLossPercent,
        processLossKg,
        processLossPercent,
        susutJualKg,
        susutJualPercent,
        salesKg: itemSalesKg,
        openingStockKg,
        closingStockKg,
        fabricatedSegments,
      };
    });

    const uniqueOperators = Array.from(new Set(items.map((i) => i.butcherName).filter(Boolean))).join(', ') || 'Tim Butcher Outlet';

    // Extract photos directly uploaded from Dashboard ("Foto Daging")
    const dashboardItemPhotos: ReportPhotoAttachment[] = items
      .filter((item) => item.image && item.image !== 'placeholder' && item.image !== '')
      .map((item) => ({
        id: `photo_item_${item.id}`,
        url: item.image,
        caption: `Foto Daging (Timbangan Dashboard): ${item.name} (${(item.weightBeforeThawing || 0).toFixed(2)} Kg)`,
        category: 'Timbangan' as const,
        uploadedAt: item.createdAt || new Date().toISOString(),
      }));

    // Extract photos from Closing Fisik per Rencana Potong
    const closingPhotos: ReportPhotoAttachment[] = (closingRecords || [])
      .filter((rec) => rec.photoUrl && rec.photoUrl !== 'placeholder' && rec.photoUrl !== '')
      .map((rec) => ({
        id: `photo_closing_${rec.id}`,
        url: rec.photoUrl,
        caption: rec.photoCaption || `Foto Timbangan Closing: ${rec.planName} (${(typeof rec.actualClosingStockKg === 'number' && !isNaN(rec.actualClosingStockKg) ? rec.actualClosingStockKg : 0).toFixed(2)} Kg)`,
        category: 'Closing Stock' as const,
        uploadedAt: rec.timestamp || new Date().toISOString(),
      }));

    // Combine dashboard photos, closing photos, and user-uploaded draft photos cleanly
    const combinedPhotosMap = new Map<string, ReportPhotoAttachment>();
    [...dashboardItemPhotos, ...closingPhotos, ...draftPhotos].forEach((p) => {
      combinedPhotosMap.set(p.id, p);
    });
    const combinedPhotos = Array.from(combinedPhotosMap.values());

    return {
      id: 'today_draft',
      date: now.toISOString().split('T')[0],
      totalThawingQty,
      totalProcessedQty,
      totalWeightBeforeThawing,
      totalWeightAfterThawing,
      totalWeightAfterFabrication,
      totalThawingLoss,
      totalFabricationLoss,
      totalProcessLoss,
      totalSusutJual,
      totalSalesKg,
      butcherInCharge: uniqueOperators,
      itemsProcessed: itemsProcessedList,
      isClosed: false,
      photos: combinedPhotos,
    };
  };

  const todayDraft = compileTodayDraft();
  const activeReportView = selectedReport || (viewingTodayDraft ? todayDraft : null);

  // Handle Photo Upload with High-Res Optimizer
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsOptimizingPhoto(true);
      setUploadError('');
      try {
        const optimized = await processHighResImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
        });
        setNewPhotoUrl(optimized);
      } catch (err) {
        console.error('Error optimizing photo attachment:', err);
        setUploadError('Gagal memproses resolusi foto.');
      } finally {
        setIsOptimizingPhoto(false);
      }
    }
  };

  const handleAddPhotoAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl) {
      setUploadError('Silakan pilih foto terlebih dahulu!');
      return;
    }
    if (!newCaption.trim()) {
      setUploadError('Keterangan foto tidak boleh kosong!');
      return;
    }

    const newPhoto: ReportPhotoAttachment = {
      id: `photo_${Date.now()}`,
      url: newPhotoUrl,
      caption: newCaption.trim(),
      category: newCategory,
      uploadedAt: new Date().toISOString(),
    };

    if (selectedReport) {
      // Modify selected historical report photo list locally
      selectedReport.photos = [...(selectedReport.photos || []), newPhoto];
      setSelectedReport({ ...selectedReport });
    } else {
      setDraftPhotos((prev) => [...prev, newPhoto]);
    }

    // Reset Form
    setNewPhotoUrl('');
    setNewCaption('');
    setUploadError('');
  };

  const handleDeletePhoto = (photoId: string) => {
    if (selectedReport) {
      selectedReport.photos = (selectedReport.photos || []).filter((p) => p.id !== photoId);
      setSelectedReport({ ...selectedReport });
    } else {
      setDraftPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  // Trigger Daily Closing
  const handleConfirmClosing = () => {
    const finalReport: DailyClosingReport = {
      ...todayDraft,
      id: `rep_${Date.now()}`,
      isClosed: true,
      closedAt: new Date().toISOString(),
      photos: draftPhotos,
    };
    onCloseDay(finalReport);
    setIsClosingConfirm(false);
    setViewingTodayDraft(false);
    setSelectedReport(finalReport);
  };

  const handlePrint = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      if (reportTab !== 'report') {
        setReportTab('report');
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const element = document.getElementById('pdf-report-canvas');
      if (!element) {
        window.print();
        return;
      }

      const dateStr = activeReportView?.date || new Date().toISOString().split('T')[0];
      const filename = `Laporan_Fabrikasi_Daging_${dateStr}.pdf`;

      // Helper to convert oklch colors to rgb/rgba for html2canvas
      const convertOklchToRgb = (str: string): string => {
        if (!str || !str.includes('oklch')) return str;
        return str.replace(/oklch\(\s*([\d.%]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)/gi, (match, lStr, cStr, hStr, aStr) => {
          try {
            let l = parseFloat(lStr);
            if (lStr.includes('%')) l = l / 100;
            const c = parseFloat(cStr) || 0;
            const h = parseFloat(hStr) || 0;
            let a = 1;
            if (aStr !== undefined && aStr !== null && aStr !== '') {
              a = aStr.includes('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
            }

            const hRad = (h * Math.PI) / 180;
            const aLab = c * Math.cos(hRad);
            const bLab = c * Math.sin(hRad);

            const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
            const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
            const s_ = l - 0.0894841775 * aLab - 1.291485548 * bLab;

            const l3 = l_ * l_ * l_;
            const m3 = m_ * m_ * m_;
            const s3 = s_ * s_ * s_;

            let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
            let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
            let b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

            const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
            r = Math.min(255, Math.max(0, Math.round(gamma(r) * 255)));
            g = Math.min(255, Math.max(0, Math.round(gamma(g) * 255)));
            b = Math.min(255, Math.max(0, Math.round(gamma(b) * 255)));

            if (a < 1) {
              return `rgba(${r}, ${g}, ${b}, ${a})`;
            }
            return `rgb(${r}, ${g}, ${b})`;
          } catch {
            return 'rgb(0, 0, 0)';
          }
        });
      };

      const opt = {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          onclone: (clonedDoc: Document) => {
            // 1. Sanitize all <style> tags
            const styleTags = clonedDoc.querySelectorAll('style');
            styleTags.forEach((styleTag) => {
              if (styleTag.textContent) {
                styleTag.textContent = convertOklchToRgb(styleTag.textContent);
              }
            });

            // 2. Sanitize document.styleSheets
            try {
              const sheets = Array.from(clonedDoc.styleSheets);
              sheets.forEach((sheet) => {
                try {
                  const rules = Array.from(sheet.cssRules || []);
                  rules.forEach((rule) => {
                    if (rule.cssText && rule.cssText.includes('oklch')) {
                      const styleRule = rule as CSSStyleRule;
                      if (styleRule.style) {
                        for (let i = 0; i < styleRule.style.length; i++) {
                          const prop = styleRule.style[i];
                          const val = styleRule.style.getPropertyValue(prop);
                          if (val && val.includes('oklch')) {
                            styleRule.style.setProperty(prop, convertOklchToRgb(val));
                          }
                        }
                      }
                    }
                  });
                } catch {
                  // Ignore cross-origin stylesheet errors
                }
              });
            } catch {
              // Ignore
            }

            // 3. Convert all elements inside pdf-report-canvas computed styles & inline styles
            const reportEl = clonedDoc.getElementById('pdf-report-canvas');
            if (reportEl) {
              const defaultView = clonedDoc.defaultView || window;
              const allNodes = [reportEl, ...Array.from(reportEl.querySelectorAll('*'))];

              allNodes.forEach((node) => {
                const htmlEl = node as HTMLElement;
                if (htmlEl.style && htmlEl.style.cssText && htmlEl.style.cssText.includes('oklch')) {
                  htmlEl.style.cssText = convertOklchToRgb(htmlEl.style.cssText);
                }

                try {
                  const computed = defaultView.getComputedStyle(htmlEl);
                  const colorProps = [
                    'color',
                    'background-color',
                    'border-color',
                    'border-top-color',
                    'border-right-color',
                    'border-bottom-color',
                    'border-left-color',
                    'outline-color',
                    'fill',
                    'stroke',
                  ];

                  colorProps.forEach((prop) => {
                    const val = computed.getPropertyValue(prop);
                    if (val && val.includes('oklch')) {
                      htmlEl.style.setProperty(prop, convertOklchToRgb(val), 'important');
                    }
                  });
                } catch {
                  // Ignore
                }
              });
            }
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      // @ts-ignore
      const exporter = typeof html2pdf === 'function' ? html2pdf : html2pdf?.default;
      if (typeof exporter === 'function') {
        await exporter().set(opt).from(element).save();
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Download PDF error:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const currentPhotos = activeReportView?.photos || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            📋 Riwayat Laporan & Riwayat Foto Harian
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1">
            Laporan pertanggungjawaban pengerjaan daging harian {todanusDisplay} serta riwayat foto dokumentasi berketerangan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reports Directory & Actions (Col-5) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Today's Draft Actions Block */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-lg border border-slate-800">
            <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
              Hari Berjalan (Draft Operasional)
            </span>
            <h3 className="text-lg font-extrabold mt-2 text-white">{todanusDisplay} Hari Ini</h3>
            <p className="text-slate-300 text-xs mt-1">
              Ada <strong>{todayDraft.totalThawingQty} bahan</strong> dimasukkan, dan <strong>{todayDraft.totalProcessedQty} selesai</strong> dipabrikasi.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => {
                  setViewingTodayDraft(true);
                  setSelectedReport(null);
                }}
                className={`py-2.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewingTodayDraft
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                View Laporan Hari Ini
              </button>

              <button
                onClick={() => setIsClosingConfirm(true)}
                disabled={todayDraft.totalThawingQty === 0}
                className={`py-2.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  todayDraft.totalThawingQty === 0
                    ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                Closing Harian
              </button>
            </div>
          </div>

          {/* Historical List */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">
              Arsip Laporan Closing ({reports.length})
            </h3>

            {reports.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 italic bg-slate-50 rounded-2xl">
                Belum ada arsip laporan closing sebelumnya.
              </p>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {reports.map((rep) => (
                  <button
                    key={rep.id}
                    onClick={() => {
                      setSelectedReport(rep);
                      setViewingTodayDraft(false);
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      selectedReport?.id === rep.id
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-xs font-black block text-slate-900">
                          {new Date(rep.date).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Operator: {rep.butcherInCharge} • {rep.photos?.length || 0} Foto
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold bg-white px-2 py-1 rounded-lg border text-slate-700 shadow-2xs">
                      {rep.totalThawingQty} Pcs
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DYNAMIC REPORT & ATTACHMENTS DISPLAY (Col-7) */}
        <div className="lg:col-span-7">
          {activeReportView ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
              {/* Header Toolbar & Tab Nav */}
              <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReportTab('report')}
                    className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      reportTab === 'report'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Laporan Resmi PDF
                  </button>

                  <button
                    onClick={() => setReportTab('lampiran')}
                    className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      reportTab === 'lampiran'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Riwayat Foto & Keterangan ({currentPhotos.length})
                  </button>
                </div>

                <button
                  onClick={handlePrint}
                  disabled={isGeneratingPdf}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Unduh file PDF resmi ke perangkat"
                >
                  {isGeneratingPdf ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                      Mendownload PDF...
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5" />
                      Unduh PDF / Cetak
                    </>
                  )}
                </button>
              </div>

              {/* TAB 1: OFFICIAL PDF REPORT CANVAS (BLACK & WHITE FORMAL) */}
              {reportTab === 'report' && (
                <div id="pdf-report-canvas" className="p-8 bg-white text-slate-900 space-y-6 print:p-0">
                  {/* Formal Letterhead (KOP SURAT) */}
                  <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-700 font-mono tracking-widest uppercase">
                      <span>FORM-QA-BUTCHER-001</span>
                      <span>REVISI: 02 / 2026</span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase pt-1">
                      LAPORAN HARIAN FABRIKASI & SUSUT DAGING
                    </h2>
                    <p className="text-xs text-slate-900 font-black tracking-widest uppercase">
                      OUTLET {todanusDisplay} • INTEGRATED BUTCHER & QUALITY ASSURANCE
                    </p>
                    <p className="text-[10px] text-slate-600 italic">
                      Dokumen Resmi Pertanggungjawaban Proses Thawing, Cutting, Pabrikasi, dan Akumulasi Susut Daging.
                    </p>
                  </div>

                  {/* Document Reference & Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white p-3 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-600 font-bold block uppercase">Nomor Dokumen:</span>
                      <span className="font-mono font-black text-slate-900">
                        LAP/TOD/{activeReportView.date.replace(/-/g, '')}/01
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-600 font-bold block uppercase">Tanggal Operasional:</span>
                      <span className="font-extrabold text-slate-900">
                        {new Date(activeReportView.date).toLocaleDateString('id-ID', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-600 font-bold block uppercase">Operator Butcher:</span>
                      <span className="font-extrabold text-slate-900">{activeReportView.butcherInCharge}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-600 font-bold block uppercase">Status Dokumen:</span>
                      <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border border-slate-800 text-slate-900 bg-white">
                        {activeReportView.isClosed ? 'RESMI TERTUTUP (FINAL)' : 'DRAFT OPERASIONAL'}
                      </span>
                    </div>
                  </div>

                  {/* Operational Summary KPI Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-slate-800 print-break-inside-avoid">
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 block">
                        Total Susut Proses
                      </span>
                      <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5 font-mono">
                        {(
                          activeReportView.totalProcessLoss ??
                          activeReportView.totalThawingLoss + activeReportView.totalFabricationLoss
                        ).toFixed(2)}{' '}
                        Kg
                        <span className="text-[10px] font-bold text-slate-700 block font-sans">
                          (
                          {activeReportView.totalWeightBeforeThawing > 0
                            ? (
                                ((activeReportView.totalProcessLoss ??
                                  activeReportView.totalThawingLoss + activeReportView.totalFabricationLoss) /
                                  activeReportView.totalWeightBeforeThawing) *
                                100
                              ).toFixed(1)
                            : '0.0'}
                          %)
                        </span>
                      </p>
                    </div>
                    <div className="text-center border-x border-slate-800">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 block">
                        Total Susut Jual
                      </span>
                      <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5 font-mono">
                        {(activeReportView.totalSusutJual ?? 0).toFixed(2)} Kg
                      </p>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 block">
                        Rasio Hasil Daging
                      </span>
                      <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5 font-mono">
                        {activeReportView.totalWeightBeforeThawing > 0
                          ? (
                              (activeReportView.totalWeightAfterFabrication /
                                activeReportView.totalWeightBeforeThawing) *
                              100
                            ).toFixed(1)
                          : '100.0'}
                        %
                      </p>
                    </div>
                  </div>

                  {/* MAIN REPORT SECTIONS: ACCUMULATED RAW MATERIALS & SEPARATED ACCUMULATED SEGMENTS */}
                  {/* ---------------------------------------------------- */}
                  {/* SECTION 1: AKUMULASI BAHAN BAKU (PER RENCANA POTONG) */}
                  {/* ---------------------------------------------------- */}
                  <div className="space-y-3 print-break-inside-avoid">
                    <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        1. AKUMULASI BAHAN BAKU DIPROSES (TERHUBUNG RENCANA POTONG)
                      </h4>
                      <span className="text-[10px] text-slate-700 font-bold border border-slate-400 px-2 py-0.5 rounded font-mono">
                        {activeReportView.itemsProcessed.length} Item Bahan Baku
                      </span>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const defaultPlans = [
                          'DAGING RENDANG PREMIUM',
                          'RENDANG POT FRESH',
                          'RENDANG SHANKLE',
                          'RAWON FRESH',
                          'RAWON',
                        ];
                        const items = activeReportView.itemsProcessed || [];
                        const presentPlans: string[] = Array.from(
                          new Set(items.map((i) => (i.plannedFabrication || 'DAGING RENDANG PREMIUM').toUpperCase()))
                        );
                        const allPlansToDisplay: string[] = Array.from(new Set([...defaultPlans, ...presentPlans]));

                        let grandSebelum = 0;
                        let grandSetelah = 0;
                        let grandSelisih = 0;
                        let grandSusutJual = 0;

                        return (
                          <>
                            {allPlansToDisplay.map((planName) => {
                              const planItems = items.filter((item) => {
                                const p = (item.plannedFabrication || 'DAGING RENDANG PREMIUM').toUpperCase();
                                return p === planName.toUpperCase();
                              });

                              const totalSebelum = planItems.reduce((acc, i) => acc + (i.weightBefore || 0), 0);
                              const totalSetelah = planItems.reduce((acc, i) => acc + (i.weightAfter || 0), 0);
                              const selisihProses = -(totalSebelum - totalSetelah); // negative value
                              const matchingPlanClosing = closingRecords?.find(
                                (c) => isPlanMatch(c.planName, planName)
                              );
                              const susutJual = (matchingPlanClosing && typeof matchingPlanClosing.susutJualKg === 'number' && !isNaN(matchingPlanClosing.susutJualKg))
                                ? matchingPlanClosing.susutJualKg
                                : planItems.reduce((acc, i) => acc + (i.susutJualKg || 0), 0);
                              const totalSusutKg = Math.max(0, totalSebelum - totalSetelah) + Math.abs(susutJual);
                              const shrinkageRatePct = totalSebelum > 0 ? (totalSusutKg / totalSebelum) * 100 : 0;
                              const isAlertExceeded = shrinkageRatePct > 2.0;

                              grandSebelum += totalSebelum;
                              grandSetelah += totalSetelah;
                              grandSelisih += selisihProses;
                              grandSusutJual += susutJual;

                              return (
                                <div
                                  key={planName}
                                  className="border border-slate-800 rounded-lg bg-white overflow-hidden text-xs"
                                >
                                  {/* Plan Title Header */}
                                  <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between font-bold">
                                    <div className="flex items-center gap-2">
                                      <span className="uppercase text-xs tracking-wider">{planName}</span>
                                      <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                                        {planItems.length} Item
                                      </span>
                                    </div>
                                    <span
                                      className={`font-mono text-xs px-2 py-0.5 rounded font-black ${
                                        isAlertExceeded ? 'bg-black text-white border border-slate-700' : 'bg-slate-100 text-slate-900 border border-slate-400'
                                      }`}
                                    >
                                      {shrinkageRatePct.toFixed(2)}%
                                    </span>
                                  </div>

                                  {isAlertExceeded && (
                                    <div className="bg-slate-100 border-b border-slate-800 p-2 text-slate-900 flex items-center justify-between font-bold text-[10px]">
                                      <span className="flex items-center gap-1 text-slate-900">
                                        🚨 ALERT: PERSENTASE SUSUT MELEBIHI 2.00%! (Maksimal Toleransi 2.00%)
                                      </span>
                                      <span className="bg-black text-white font-mono px-1.5 py-0.5 rounded">
                                        {shrinkageRatePct.toFixed(2)}% (&gt; 2.0%)
                                      </span>
                                    </div>
                                  )}

                                  <div className="p-2.5 space-y-2">
                                    {/* SUSUT PROSES Breakdown */}
                                    <div>
                                      <span className="font-extrabold text-[10px] text-slate-800 uppercase block mb-1">
                                        SUSUT PROSES (TOTAL SUSUT) (PERSENTASE)
                                      </span>
                                      {planItems.length === 0 ? (
                                        <p className="text-[10px] text-slate-500 italic">
                                          (Belum ada data bahan dibuka untuk rencana potong ini)
                                        </p>
                                      ) : (
                                        <div className="space-y-1">
                                          {planItems.map((item, idx) => {
                                            const bAwal = item.weightBefore || 0;
                                            const bThaw = item.weightAfter || 0;
                                            const itemSusut = bAwal - bThaw;
                                            return (
                                              <div
                                                key={idx}
                                                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 flex items-center justify-between font-mono text-[11px]"
                                              >
                                                <span>
                                                  <strong className="font-sans text-slate-900">{item.name}</strong>{' '}
                                                  <span className="text-slate-600 font-sans text-[10px]">
                                                    ({item.pabrikasiCategory || 'DAGING FRESH'})
                                                  </span>
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                  {bAwal.toFixed(2)} - {bThaw.toFixed(2)}{' '}
                                                  <span className="text-slate-900 bg-slate-200 border border-slate-300 px-1 py-0.5 rounded text-[10px] ml-1 font-black">
                                                    SUSUT {itemSusut.toFixed(2)} Kg
                                                  </span>
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    {/* Sub-totals: Thawing, Selisih, Susut Jual */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-200 font-mono text-[11px]">
                                      <div className="bg-slate-100 p-1.5 rounded border border-slate-300">
                                        <span className="block text-[8px] font-sans font-bold text-slate-700 uppercase">
                                          TOTAL BAHAN SEBELUM THAWING
                                        </span>
                                        <strong className="text-slate-900 text-xs font-black">
                                          {totalSebelum.toFixed(2)} Kg
                                        </strong>
                                      </div>
                                      <div className="bg-slate-100 p-1.5 rounded border border-slate-300">
                                        <span className="block text-[8px] font-sans font-bold text-slate-700 uppercase">
                                          TOTAL BAHAN SETELAH THAWING
                                        </span>
                                        <strong className="text-slate-900 text-xs font-black">
                                          {totalSetelah.toFixed(2)} Kg
                                        </strong>
                                      </div>
                                      <div className="bg-slate-100 p-1.5 rounded border border-slate-300">
                                        <span className="block text-[8px] font-sans font-extrabold text-slate-900 uppercase">
                                          SELISIH
                                        </span>
                                        <strong className="text-slate-900 text-xs font-black">
                                          {selisihProses === 0 ? '0.00' : selisihProses.toFixed(2)} Kg
                                        </strong>
                                      </div>
                                      <div className="bg-slate-100 p-1.5 rounded border border-slate-300">
                                        <span className="block text-[8px] font-sans font-extrabold text-slate-900 uppercase">
                                          SUSUT JUAL
                                        </span>
                                        <strong className="text-slate-900 text-xs font-black">
                                          {-susutJual === 0 ? '0.00' : (-susutJual).toFixed(2)} Kg
                                        </strong>
                                      </div>
                                    </div>

                                    {/* Percentage Formula Line */}
                                    <div className="bg-slate-50 border border-slate-300 p-1.5 rounded flex items-center justify-between text-[11px]">
                                      <div>
                                        <span className="font-extrabold text-slate-900 uppercase block text-[9px]">
                                          PERSENTASE SUSUT
                                        </span>
                                        <span className="text-[8px] text-slate-600 font-mono block">
                                          ( total bahan sebelum thawing - (total bahan setelah thawing + susut jual) / total bahan sebelum thaw )
                                        </span>
                                      </div>
                                      <span
                                        className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                                          isAlertExceeded ? 'bg-black text-white' : 'bg-slate-800 text-white'
                                        }`}
                                      >
                                        {shrinkageRatePct.toFixed(2)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* TOTAL KESELURUHAN IN REPORT */}
                            {(() => {
                              const grandTotalSusutKg = Math.max(0, grandSebelum - grandSetelah) + Math.abs(grandSusutJual);
                              const grandRatePct = grandSebelum > 0 ? (grandTotalSusutKg / grandSebelum) * 100 : 0;
                              const grandAlert = grandRatePct > 2.0;

                              return (
                                <div className="border-2 border-slate-900 rounded-lg bg-slate-900 text-white p-3 space-y-2 text-xs font-mono">
                                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                                    <div>
                                      <h5 className="font-black text-xs uppercase text-white tracking-wider">
                                        TOTAL KESELURUHAN
                                      </h5>
                                      <span className="text-[9px] text-slate-300 font-sans block">
                                        Akumulasi seluruh rencana potong &amp; pabrikasi
                                      </span>
                                    </div>
                                    <span
                                      className={`font-mono font-black text-xs px-2.5 py-0.5 rounded ${
                                        grandAlert ? 'bg-white text-slate-950 font-black' : 'bg-slate-800 text-white border border-slate-700'
                                      }`}
                                    >
                                      {grandRatePct.toFixed(2)}%
                                    </span>
                                  </div>

                                  {grandAlert && (
                                    <div className="bg-slate-800 border border-slate-600 p-1.5 rounded text-white flex items-center justify-between font-bold text-[10px]">
                                      <span>🚨 ALERT KESELURUHAN: PERSENTASE SUSUT TOTAL MELEBIHI 2.00%!</span>
                                      <span className="bg-white text-slate-950 px-2 py-0.5 rounded font-mono font-black">
                                        {grandRatePct.toFixed(2)}% (&gt; 2.0%)
                                      </span>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 pt-1">
                                    <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                                      <span className="block text-[8px] font-sans text-slate-300 font-bold uppercase">
                                        TOTAL BAHAN SEBELUM THAWING
                                      </span>
                                      <strong className="text-white text-xs font-black">{grandSebelum.toFixed(2)} Kg</strong>
                                    </div>
                                    <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                                      <span className="block text-[8px] font-sans text-slate-300 font-bold uppercase">
                                        TOTAL BAHAN SETELAH THAWING
                                      </span>
                                      <strong className="text-white text-xs font-black">{grandSetelah.toFixed(2)} Kg</strong>
                                    </div>
                                    <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                                      <span className="block text-[8px] font-sans text-slate-200 font-extrabold uppercase">
                                        SELISIH
                                      </span>
                                      <strong className="text-white text-xs font-black">
                                        {grandSelisih === 0 ? '0.00' : grandSelisih.toFixed(2)} Kg
                                      </strong>
                                    </div>
                                    <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                                      <span className="block text-[8px] font-sans text-slate-200 font-extrabold uppercase">
                                        SUSUT JUAL
                                      </span>
                                      <strong className="text-white text-xs font-black">
                                        {-grandSusutJual === 0 ? '0.00' : (-grandSusutJual).toFixed(2)} Kg
                                      </strong>
                                    </div>
                                  </div>

                                  <div className="bg-slate-800 border border-slate-700 p-1.5 rounded flex items-center justify-between">
                                    <div>
                                      <span className="font-extrabold text-white uppercase block text-[9px]">
                                        PERSENTASE SUSUT TOTAL
                                      </span>
                                      <span className="text-[8px] text-slate-300 font-sans block">
                                        ( seluruh total sebelum - (seluruh total setelah + susut jual) / total sebelum )
                                      </span>
                                    </div>
                                    <span className="font-mono font-black text-xs text-white">
                                      {grandRatePct.toFixed(2)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ---------------------------------------------------- */}
                  {/* SECTION 2: AKUMULASI HASIL SEGMEN PABRIKASI           */}
                  {/* ---------------------------------------------------- */}
                  <div className="space-y-3 pt-2 print-break-inside-avoid">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-800 pb-1">
                      2. AKUMULASI HASIL SEGMEN PABRIKASI (DIPISAH BERDASARKAN TUJUAN)
                    </h4>

                    {/* Compile accumulated segments by purpose */}
                    {(() => {
                      const pesananMap = new Map<string, number>();
                      const displayMap = new Map<string, { initialWeight: number; susutJualKg: number; netWeight: number }>();

                      activeReportView.itemsProcessed.forEach((item) => {
                        const itemPurpose = item.openingPurpose || 'UNTUK DISPLAY';
                        if (item.fabricatedSegments && item.fabricatedSegments.length > 0) {
                          item.fabricatedSegments.forEach((seg) => {
                            const segPurpose = (seg as any).openingPurpose || itemPurpose;
                            const name = seg.segmentName.toUpperCase();
                            const netW = seg.actualWeight || 0;
                            const shrinkKg = seg.periodicShrinkage || 0;

                            if (segPurpose === 'UNTUK PESANAN') {
                              const current = pesananMap.get(name) || 0;
                              pesananMap.set(name, current + netW);
                            } else {
                              const initW = netW + shrinkKg;
                              const current = displayMap.get(name) || { initialWeight: 0, susutJualKg: 0, netWeight: 0 };
                              displayMap.set(name, {
                                initialWeight: current.initialWeight + initW,
                                susutJualKg: current.susutJualKg + shrinkKg,
                                netWeight: current.netWeight + netW,
                              });
                            }
                          });
                        }
                      });

                      const pesananList = Array.from(pesananMap.entries()).map(([segmentName, totalWeight]) => ({
                        segmentName,
                        totalWeight,
                      }));

                      const displayList = Array.from(displayMap.entries()).map(([segmentName, data]) => ({
                        segmentName,
                        ...data,
                      }));

                      const totalPesananKg = pesananList.reduce((acc, p) => acc + p.totalWeight, 0);
                      const totalDisplayInitialKg = displayList.reduce((acc, d) => acc + d.initialWeight, 0);
                      const totalDisplaySusutJualKg = displayList.reduce((acc, d) => acc + d.susutJualKg, 0);
                      const totalDisplayNetKg = displayList.reduce((acc, d) => acc + d.netWeight, 0);

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* SUB-SECTION 2A: UNTUK PESANAN */}
                          <div className="border border-slate-800 rounded-lg bg-white overflow-hidden space-y-0">
                            <div className="bg-slate-100 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                A. AKUMULASI SEGMEN UNTUK PESANAN
                              </span>
                              <span className="text-[10px] border border-slate-800 font-black px-2 py-0.5 rounded text-slate-900 bg-white">
                                {pesananList.length} Jenis Segmen
                              </span>
                            </div>

                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-900 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                                  <th className="p-2">Rencana / Segmen Potong</th>
                                  <th className="p-2 text-right">Hasil Segmen (Kg)</th>
                                  <th className="p-2 text-right">Susut Jual</th>
                                  <th className="p-2 text-right">Berat Bersih (Kg)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-300 text-slate-900">
                                {pesananList.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-500 italic text-xs">
                                      Belum ada segmen untuk pesanan.
                                    </td>
                                  </tr>
                                ) : (
                                  pesananList.map((p, idx) => (
                                    <tr key={idx}>
                                      <td className="p-2 font-black text-slate-900">{p.segmentName}</td>
                                      <td className="p-2 text-right font-mono font-bold">{p.totalWeight.toFixed(2)}</td>
                                      <td className="p-2 text-right font-mono text-slate-500 font-semibold">0.00 Kg</td>
                                      <td className="p-2 text-right font-mono font-black text-slate-900">{p.totalWeight.toFixed(2)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              {pesananList.length > 0 && (
                                <tfoot>
                                  <tr className="bg-slate-100 font-black border-t border-slate-800 text-slate-900">
                                    <td className="p-2 uppercase text-[10px]">TOTAL SEGMEN PESANAN</td>
                                    <td className="p-2 text-right font-mono">{totalPesananKg.toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono text-slate-500">0.00 Kg</td>
                                    <td className="p-2 text-right font-mono text-slate-900">{totalPesananKg.toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>

                          {/* SUB-SECTION 2B: UNTUK DISPLAY */}
                          <div className="border border-slate-800 rounded-lg bg-white overflow-hidden space-y-0">
                            <div className="bg-slate-100 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                B. AKUMULASI SEGMEN UNTUK DISPLAY
                              </span>
                              <span className="text-[10px] border border-slate-800 font-black px-2 py-0.5 rounded text-slate-900 bg-white">
                                {displayList.length} Jenis Segmen
                              </span>
                            </div>

                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-900 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                                  <th className="p-2">Rencana / Segmen Potong</th>
                                  <th className="p-2 text-right">Berat Awal</th>
                                  <th className="p-2 text-right">Susut Jual (Kg)</th>
                                  <th className="p-2 text-right">Sisa Stok (Kg)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-300 text-slate-900">
                                {displayList.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-500 italic text-xs">
                                      Belum ada segmen untuk display.
                                    </td>
                                  </tr>
                                ) : (
                                  displayList.map((d, idx) => (
                                    <tr key={idx}>
                                      <td className="p-2 font-black text-slate-900">{d.segmentName}</td>
                                      <td className="p-2 text-right font-mono font-semibold">{d.initialWeight.toFixed(2)}</td>
                                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                                        {d.susutJualKg > 0 ? `-${d.susutJualKg.toFixed(2)} Kg` : '0.00 Kg'}
                                      </td>
                                      <td className="p-2 text-right font-mono font-black text-slate-900">{d.netWeight.toFixed(2)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              {displayList.length > 0 && (
                                <tfoot>
                                  <tr className="bg-slate-100 font-black border-t border-slate-800 text-slate-900">
                                    <td className="p-2 uppercase text-[10px]">TOTAL SEGMEN DISPLAY</td>
                                    <td className="p-2 text-right font-mono">{totalDisplayInitialKg.toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono text-slate-900">
                                      {totalDisplaySusutJualKg > 0 ? `-${totalDisplaySusutJualKg.toFixed(2)} Kg` : '0.00 Kg'}
                                    </td>
                                    <td className="p-2 text-right font-mono text-slate-900">{totalDisplayNetKg.toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ---------------------------------------------------- */}
                  {/* SECTION 3: REALISASI SALES (KATEGORI MANDIRI)        */}
                  {/* ---------------------------------------------------- */}
                  <div className="border border-slate-800 rounded-lg p-3 bg-slate-50 space-y-1 print-break-inside-avoid">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 uppercase">
                      <span>3. REALISASI SALES / PENJUALAN (KATEGORI MANDIRI)</span>
                      <span className="font-mono text-slate-900 font-black">{(activeReportView.totalSalesKg ?? 0).toFixed(2)} Kg</span>
                    </div>
                    <p className="text-[10px] text-slate-700 leading-relaxed font-medium">
                      📌 <strong>Keterangan Reduksi Stok:</strong> Pengurangan stok dari transaksi penjualan kasir dicatat secara mandiri sebagai <strong>Realisasi Sales (Penjualan)</strong> dan <strong>TIDAK dimasukkan sebagai Susut Daging</strong> (susut thawing, pabrikasi, maupun susut display).
                    </p>
                  </div>

                  {/* ---------------------------------------------------- */}
                  {/* SECTION 4: PETUGAS ON-DUTY                            */}
                  {/* ---------------------------------------------------- */}
                  <div className="pt-6 border-t-2 border-slate-900 flex items-end justify-between text-xs print-break-inside-avoid">
                    <div className="text-[10px] text-slate-600 space-y-1">
                      <p className="font-mono">Dokumen dicetak dari Sistem Laporan Fabrikasi Meat Tracker.</p>
                      <p className="italic font-medium">Outlet {todanusDisplay} — Butcher & Quality Assurance</p>
                    </div>

                    <div className="text-center min-w-[200px] space-y-12">
                      <p className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                        Butcher / Stock Keeper On-Duty
                      </p>
                      <div className="space-y-0.5">
                        <p className="font-black text-slate-900 underline uppercase text-sm">
                          {activeReportView.butcherInCharge}
                        </p>
                        <p className="text-[10px] text-slate-600 font-medium">Petugas Operasional</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: RIWAYAT FOTO & KETERANGAN DOKUMENTASI */}
              {reportTab === 'lampiran' && (
                <div className="p-6 bg-slate-50 space-y-6">
                  {/* Photo Upload Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900">Tambah Foto Dokumentasi / Keterangan</h3>
                        <p className="text-xs text-slate-500">
                          Unggah foto timbangan, hasil packaging, atau dokumentasi area lengkap dengan keterangan.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleAddPhotoAttachment} className="space-y-4">
                      {uploadError && (
                        <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 font-bold">
                          ⚠️ {uploadError}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* File Selector */}
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            Pilih File Foto *
                          </label>
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50 py-3 px-3 rounded-xl cursor-pointer transition-all">
                            <ImageIcon className="w-5 h-5 text-slate-400 mb-1" />
                            <span className="text-xs font-bold text-slate-600 text-center">
                              {newPhotoUrl ? '✓ Foto Terpilih (Ketuk ganti)' : 'Ketuk untuk ambil / upload foto'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Category Selector */}
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">Kategori Foto</label>
                          <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value as any)}
                            className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="Timbangan">Timbangan Raw / Thawing</option>
                            <option value="Hasil Packaging">Hasil Potong & Packaging</option>
                            <option value="Kebersihan Area">Kebersihan Area Cutting</option>
                            <option value="Berita Acara">Berita Acara / Susut</option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                        </div>
                      </div>

                      {/* Caption Input */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 mb-1">
                          Keterangan Foto yang Jelas *
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Foto Timbangan Sirloin Australia Sebelum Thawing (20.0 Kg)"
                          value={newCaption}
                          onChange={(e) => setNewCaption(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Simpan ke Riwayat Foto
                      </button>
                    </form>
                  </div>

                  {/* Photo Attachments Grid Display */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Camera className="w-4 h-4 text-emerald-600" />
                        Daftar Riwayat Foto & Keterangan ({currentPhotos.length} Foto)
                      </h3>
                      <span className="text-[11px] text-slate-500">
                        *Foto tidak terpotong (tampilan utuh/contain)
                      </span>
                    </div>

                    {currentPhotos.length === 0 ? (
                      <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 space-y-2">
                        <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-600">Belum ada riwayat foto dokumentasi.</p>
                        <p className="text-[11px] text-slate-400">Gunakan form di atas untuk menambahkan foto bukti timbangan dan keterangan.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {currentPhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between group hover:border-emerald-400 transition-all"
                          >
                            {/* Photo Container Frame (ENSURES NO PHOTO IS CROPPED) */}
                            <div className="relative w-full h-56 bg-slate-950/90 flex items-center justify-center p-2">
                              <img
                                src={photo.url}
                                alt={photo.caption}
                                className="max-h-full max-w-full object-contain rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => setPreviewPhoto(photo)}
                                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg transition-all cursor-pointer"
                                title="Perbesar Foto Fullscreen"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Caption & Category Footer */}
                            <div className="p-4 space-y-2 bg-white">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Tag className="w-3 h-3 text-emerald-600" />
                                  {photo.category || 'Dokumentasi'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(photo.uploadedAt).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>

                              <p className="text-xs font-bold text-slate-900 leading-relaxed">
                                {photo.caption}
                              </p>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto(photo)}
                                  className="text-[11px] font-extrabold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Maximize2 className="w-3 h-3" /> Zoom Utuh
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePhoto(photo.id)}
                                  className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" /> Hapus
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center text-slate-400">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-extrabold text-slate-700">Pratinjau Laporan Kosong</p>
              <p className="text-xs mt-1">
                Silakan ketuk "View Laporan Hari Ini" atau pilih arsip laporan di sebelah kiri.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- LIGHTBOX FULLSCREEN ZOOM MODAL (Uncropped Photo Inspector) --- */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 md:p-8 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl flex items-center justify-between text-white pb-4 border-b border-white/10">
            <div>
              <span className="text-[10px] font-black uppercase bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md">
                {previewPhoto.category || 'Dokumentasi'}
              </span>
              <h3 className="text-sm md:text-base font-extrabold text-white mt-1">
                {previewPhoto.caption}
              </h3>
            </div>
            <button
              onClick={() => setPreviewPhoto(null)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Uncropped Full View */}
          <div className="my-auto max-w-4xl max-h-[75vh] w-full flex items-center justify-center p-2">
            <img
              src={previewPhoto.url}
              alt={previewPhoto.caption}
              className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          <div className="text-center text-slate-400 text-xs pb-2">
            *Foto ditampilkan dalam resolusi rasio utuh (tidak terpotong).
          </div>
        </div>
      )}

      {/* --- CONFIRM CLOSING DIALOG MODAL --- */}
      {isClosingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <CheckSquare className="text-emerald-400" />
                Konfirmasi Closing Harian?
              </h3>
              <p className="text-slate-300 text-xs mt-1">
                Langkah ini akan mengunci data timbangan & {draftPhotos.length} foto lampiran hari ini ke dalam arsip.
              </p>
            </div>

            <div className="p-5 space-y-4 text-slate-800">
              <div className="bg-slate-50 p-4 rounded-2xl text-xs text-slate-700 space-y-2 border border-slate-200">
                <p className="font-extrabold text-slate-900">⚠️ PENTING UNTUK DIPERHATIKAN:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Proses pencairan es (Thawing) berjalan akan ditutup.</li>
                  <li>Draft laporan & foto lampiran akan disimpan ke arsip resmi.</li>
                  <li>Daftar kerja aktif akan di-reset kosong untuk shift selanjutnya.</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsClosingConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmClosing}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  Ya, Lakukan Closing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
