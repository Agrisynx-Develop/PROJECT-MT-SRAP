import React, { useState, useMemo } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  StockAdjustment,
  CogsMaster,
  Store,
  UserAccount
} from '../types';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Printer,
  Table,
  Eye,
  DollarSign,
  Lock,
  ShieldCheck,
  Calculator,
  X,
  Info
} from 'lucide-react';
import { exportStoreDailyLaporanExcel, exportStoreDailyLaporanCSV } from '../utils/excelExport';
import { matchStoreEntity, getCogsForCategory, getThawingItemColumn } from '../utils/reportCalculations';

interface ExcelReportViewerProps {
  currentStore: Store;
  selectedDate: string;
  onDateChange?: (date: string) => void;
  items: ThawingItem[];
  segments: FabricationSegment[];
  closingRecords: ClosingPlanRecord[];
  adjustments: StockAdjustment[];
  cogsList: CogsMaster[];
  currentUser?: UserAccount;
  onUpdateCogs?: (cogs: CogsMaster[]) => void;
}

export default function ExcelReportViewer({
  currentStore,
  selectedDate,
  onDateChange,
  items,
  segments,
  closingRecords,
  adjustments,
  cogsList,
  currentUser,
  onUpdateCogs,
}: ExcelReportViewerProps) {
  const isMdUser = currentUser?.role === 'md';
  const [activeSheet, setActiveSheet] = useState<'LAP.DAGING' | 'PROSES' | 'SALES DAGING'>('LAP.DAGING');
  const [selectedCell, setSelectedCell] = useState<string>('I28');
  const [cellFormula, setCellFormula] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showCogsQuickModal, setShowCogsQuickModal] = useState<boolean>(false);
  const [editingCatCogs, setEditingCatCogs] = useState<{ category: string; name: string; price: number } | null>(null);
  const [editPriceInput, setEditPriceInput] = useState<string>('');

  // Format date helper
  const formattedDateString = React.useMemo(() => {
    try {
      const d = new Date(selectedDate);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).toUpperCase();
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const dateShort = React.useMemo(() => {
    try {
      const d = new Date(selectedDate);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return '20-Aug';
    }
  }, [selectedDate]);

  const priorDateShort = React.useMemo(() => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return '19-Aug';
    }
  }, [selectedDate]);

  const fullDayDateString = React.useMemo(() => {
    try {
      const d = new Date(selectedDate);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Thursday, August 20, 2026';
    }
  }, [selectedDate]);

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

  // Separate Today's items vs Carryover
  const todayItems = useMemo(() => currentStoreItems.filter((i) => !i.isCarryover), [currentStoreItems]);
  const carryoverItems = useMemo(() => currentStoreItems.filter((i) => i.isCarryover), [currentStoreItems]);

  // Partition today items strictly into 8 columns (mutually exclusive)
  const col1Items = useMemo(() => todayItems.filter((i) => getThawingItemColumn(i) === 1), [todayItems]);
  const col2Items = useMemo(() => todayItems.filter((i) => getThawingItemColumn(i) === 2), [todayItems]);
  const col3Items = useMemo(() => todayItems.filter((i) => getThawingItemColumn(i) === 3), [todayItems]);
  const col4Items = useMemo(() => todayItems.filter((i) => getThawingItemColumn(i) === 4), [todayItems]);
  const col5Items = useMemo(() => todayItems.filter((i) => getThawingItemColumn(i) === 5), [todayItems]);
  const col6Items = useMemo(() => todayItems.filter((i) => getThawingItemColumn(i) === 6), [todayItems]);
  const col7Items = useMemo(() => todayItems.filter((i) => getThawingItemColumn(i) === 7), [todayItems]);
  const col8Items = useMemo(() => todayItems.filter((i) => getThawingItemColumn(i) === 8), [todayItems]);

  const getColTotals = (subItems: ThawingItem[]) => {
    const bahan = subItems.reduce((s, i) => s + (i.weightBeforeThawing || 0), 0);
    const hasil = subItems.reduce((s, i) => s + (i.weightAfterThawing !== null && i.weightAfterThawing !== undefined ? i.weightAfterThawing : i.weightBeforeThawing), 0);
    const susut = Math.max(0, bahan - hasil);
    return { bahan, hasil, susut };
  };

  const col1Totals = useMemo(() => getColTotals(col1Items), [col1Items]);
  const col2Totals = useMemo(() => getColTotals(col2Items), [col2Items]);
  const col3Totals = useMemo(() => getColTotals(col3Items), [col3Items]);
  const col4Totals = useMemo(() => getColTotals(col4Items), [col4Items]);
  const col5Totals = useMemo(() => getColTotals(col5Items), [col5Items]);
  const col6Totals = useMemo(() => getColTotals(col6Items), [col6Items]);
  const col7Totals = useMemo(() => getColTotals(col7Items), [col7Items]);
  const col8Totals = useMemo(() => getColTotals(col8Items), [col8Items]);

  // Group items by 4 main categories for Section 2
  const dgFreshItems = useMemo(() => [...col1Items, ...col2Items, ...col3Items], [col1Items, col2Items, col3Items]);
  const dgPremItems = useMemo(() => [...col4Items, ...col5Items], [col4Items, col5Items]);
  const rawonItems = useMemo(() => [...col6Items, ...col7Items], [col6Items, col7Items]);
  const shankleItems = useMemo(() => [...col8Items], [col8Items]);

  // COGS helper connected directly to Master COGS with no hardcoded dummy fallbacks
  const getCogs = (name?: string, cat?: string, specificItems?: ThawingItem[]) => {
    if (specificItems && specificItems.length > 0) {
      const withCogs = specificItems.find((i) => typeof i.cogsPerKg === 'number' && i.cogsPerKg > 0);
      if (withCogs && withCogs.cogsPerKg) return withCogs.cogsPerKg;
      const withPrice = specificItems.find((i) => typeof i.pricePerKg === 'number' && i.pricePerKg > 0);
      if (withPrice && withPrice.pricePerKg) return withPrice.pricePerKg;
    }
    const catQuery = cat || name || '';
    const masterVal = getCogsForCategory(cogsList, catQuery);
    if (masterVal > 0) return masterVal;

    const sName = String(name || '').toLowerCase().trim();
    const sCat = String(cat || '').toLowerCase().trim();
    const exact = (cogsList || []).find((c) => {
      const cName = String(c.itemName || (c as any).planName || '').toLowerCase().trim();
      const cCode = String(c.itemCode || '').toLowerCase().trim();
      return (sName && (cName === sName || cCode === sName)) || (sCat && String(c.category || '').toLowerCase().trim() === sCat);
    });
    if (exact && exact.cogsPerKg > 0) return exact.cogsPerKg;

    return 0;
  };

  // Category Weights & COGS connected directly to Master COGS
  const dgFreshBahan = dgFreshItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
  const dgFreshHasil = dgFreshItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
  const dgFreshName = dgFreshItems[0]?.name || 'HQ 41/44/45 FQ 65';
  const dgFreshCogs = getCogs(dgFreshName, 'DAGING FRESH', dgFreshItems);
  const dgFreshBahanModal = dgFreshBahan * dgFreshCogs;
  const dgFreshHasilModal = dgFreshHasil * dgFreshCogs;
  const dgFreshSusutProses = Math.max(0, dgFreshBahan - dgFreshHasil);
  const dgFreshClosing = closingRecords.find((c) => (c.planName || '').toLowerCase().includes('rdang') || (c.category || '').toUpperCase().includes('FRESH'));
  const dgFreshSusutJual = dgFreshClosing ? dgFreshClosing.susutJualKg : 0;
  const dgFreshTotalSusut = dgFreshSusutProses + dgFreshSusutJual;
  const dgFreshModalSusutJual = dgFreshHasil > 0 ? (dgFreshBahanModal + dgFreshSusutJual * dgFreshCogs) / dgFreshHasil : dgFreshCogs;

  const dgPremBahan = dgPremItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
  const dgPremHasil = dgPremItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
  const dgPremName = dgPremItems[0]?.name || 'Daging Premium Lokal';
  const dgPremCogs = getCogs(dgPremName, 'DAGING PREMIUM', dgPremItems);
  const dgPremBahanModal = dgPremBahan * dgPremCogs;
  const dgPremHasilModal = dgPremHasil * dgPremCogs;
  const dgPremSusutProses = Math.max(0, dgPremBahan - dgPremHasil);
  const dgPremClosing = closingRecords.find((c) => (c.planName || '').toLowerCase().includes('prem') || (c.category || '').toUpperCase().includes('PREMIUM'));
  const dgPremSusutJual = dgPremClosing ? dgPremClosing.susutJualKg : 0;
  const dgPremTotalSusut = dgPremSusutProses + dgPremSusutJual;
  const dgPremModalSusutJual = dgPremHasil > 0 ? (dgPremBahanModal + dgPremSusutJual * dgPremCogs) / dgPremHasil : dgPremCogs;

  const rawonBahan = rawonItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
  const rawonHasil = rawonItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
  const rawonName = rawonItems[0]?.name || 'RAWON FRESH A';
  const rawonCogs = getCogs(rawonName, 'RAWON', rawonItems);
  const rawonBahanModal = rawonBahan * rawonCogs;
  const rawonHasilModal = rawonHasil * rawonCogs;
  const rawonSusutProses = Math.max(0, rawonBahan - rawonHasil);
  const rawonClosing = closingRecords.find((c) => (c.planName || '').toLowerCase().includes('rawon') || (c.category || '').toUpperCase().includes('RAWON'));
  const rawonSusutJual = rawonClosing ? rawonClosing.susutJualKg : 0;
  const rawonTotalSusut = rawonSusutProses + rawonSusutJual;
  const rawonModalSusutJual = rawonHasil > 0 ? (rawonBahanModal + rawonSusutJual * rawonCogs) / rawonHasil : rawonCogs;

  const shankBahan = shankleItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
  const shankHasil = shankleItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
  const shankName = shankleItems[0]?.name || 'FQ 60 / SHANK';
  const shankCogs = getCogs(shankName, 'SHANKLE', shankleItems);
  const shankBahanModal = shankBahan * shankCogs;
  const shankHasilModal = shankHasil * shankCogs;
  const shankSusutProses = Math.max(0, shankBahan - shankHasil);
  const shankClosing = closingRecords.find((c) => (c.planName || '').toLowerCase().includes('shank') || (c.category || '').toUpperCase().includes('SHANK'));
  const shankSusutJual = shankClosing ? shankClosing.susutJualKg : 0;
  const shankTotalSusut = shankSusutProses + shankSusutJual;
  const shankModalSusutJual = shankHasil > 0 ? (shankBahanModal + shankSusutJual * shankCogs) / shankHasil : shankCogs;

  // Grand Totals with Dynamic Category-Specific COGS Multipliers
  const totalGrandBahan = dgFreshBahan + dgPremBahan + rawonBahan + shankBahan;
  const totalGrandHasil = dgFreshHasil + dgPremHasil + rawonHasil + shankHasil;
  const totalGrandBahanModal = dgFreshBahanModal + dgPremBahanModal + rawonBahanModal + shankBahanModal;
  const totalGrandHasilModal = dgFreshHasilModal + dgPremHasilModal + rawonHasilModal + shankHasilModal;
  const totalGrandSusutProses = dgFreshSusutProses + dgPremSusutProses + rawonSusutProses + shankSusutProses;
  const totalGrandSusutJual = dgFreshSusutJual + dgPremSusutJual + rawonSusutJual + shankSusutJual;
  const totalGrandSusut = totalGrandSusutProses + totalGrandSusutJual;
  const grandSusutProsesVal = (dgFreshSusutProses * dgFreshCogs) + (dgPremSusutProses * dgPremCogs) + (rawonSusutProses * rawonCogs) + (shankSusutProses * shankCogs);
  const grandSusutJualVal = (dgFreshSusutJual * dgFreshCogs) + (dgPremSusutJual * dgPremCogs) + (rawonSusutJual * rawonCogs) + (shankSusutJual * shankCogs);
  const grandSelisihVal = totalGrandBahanModal - totalGrandHasilModal;
  const grandSelisihPct = totalGrandBahan > 0 ? (totalGrandSusutProses / totalGrandBahan) * 100 : 0;

  // Handler for quick editing COGS from the report (Strictly MD only)
  const handleSaveQuickCogs = (cat: string, name: string, price: number) => {
    if (!isMdUser) {
      alert('Akses Ditolak: Hanya akun MD (Merchandising Pusat) yang memiliki wewenang untuk mengatur dan mengubah Master COGS.');
      return;
    }
    if (!onUpdateCogs || price <= 0) return;
    const existingIdx = (cogsList || []).findIndex(
      (c) => (c.category || '').toUpperCase() === cat.toUpperCase() || (c.itemName || (c as any).planName || '').toLowerCase().includes(name.toLowerCase())
    );
    let updated: CogsMaster[];
    if (existingIdx >= 0) {
      updated = cogsList.map((c, i) => (i === existingIdx ? { ...c, cogsPerKg: price, updatedAt: new Date().toISOString().split('T')[0], updatedBy: currentUser?.fullName || 'MD Pusat' } : c));
    } else {
      const newItem: CogsMaster = {
        id: `cogs_${Date.now()}`,
        itemCode: `MTR-${cogsList.length + 1}`,
        itemName: name,
        category: cat as any,
        cogsPerKg: price,
        defaultPricePerKg: price * 1.25,
        updatedAt: new Date().toISOString().split('T')[0],
        updatedBy: currentUser?.fullName || 'MD Pusat',
      };
      updated = [...cogsList, newItem];
    }
    onUpdateCogs(updated);
    setEditingCatCogs(null);
    setEditPriceInput('');
    setShowCogsQuickModal(false);
  };

  // Available dates for current store
  const availableDatesWithData = useMemo(() => {
    const datesSet = new Set<string>();
    (items || []).forEach((i) => {
      if (!i.storeId || matchStoreEntity(i.storeId, currentStore)) {
        const d = (i.createdAt || i.thawingStartTime || '').split('T')[0];
        if (d) datesSet.add(d);
      }
    });
    (closingRecords || []).forEach((c) => {
      if (!c.storeId || matchStoreEntity(c.storeId, currentStore)) {
        const d = (c.date || c.timestamp || '').split('T')[0];
        if (d) datesSet.add(d);
      }
    });
    return Array.from(datesSet).sort().reverse();
  }, [items, closingRecords, currentStore]);

  // Standard 5 cuts rows for Sheet "SALES DAGING" (Default dynamic with 0.000 fallback)
  const standardCutCategories = [
    { name: 'Daging Rendang Shankle', category: 'SHANKLE' },
    { name: 'D.sapi pot. rdang', category: 'DAGING FRESH' },
    { name: 'D premium lokal', category: 'DAGING PREMIUM' },
    { name: 'D.r. fresh member', category: 'DAGING FRESH' },
    { name: 'Rawon Curah', category: 'RAWON' },
  ];

  const dynamicSalesRows = standardCutCategories.map((cut, idx) => {
    const rec = currentStoreClosing.find(
      (c) =>
        (c.planName || '').toLowerCase().includes(cut.name.toLowerCase()) ||
        cut.name.toLowerCase().includes((c.planName || '').toLowerCase())
    );

    // Calculate live processed results for this cut category
    let liveHasil = 0;
    if (cut.category === 'SHANKLE') liveHasil = shankHasil;
    else if (cut.name.includes('rdang') || cut.name.includes('Rendang')) liveHasil = dgFreshHasil;
    else if (cut.category === 'DAGING PREMIUM') liveHasil = dgPremHasil;
    else if (cut.category === 'RAWON') liveHasil = rawonHasil;

    const sAwal = rec && typeof rec.openingStockKg === 'number' && !isNaN(rec.openingStockKg) ? rec.openingStockKg : 0;
    const sHasil = rec && typeof rec.newProcessedKg === 'number' && !isNaN(rec.newProcessedKg) && rec.newProcessedKg > 0
      ? rec.newProcessedKg
      : (typeof liveHasil === 'number' && !isNaN(liveHasil) ? liveHasil : 0);
    const sSales = rec && typeof rec.salesKg === 'number' && !isNaN(rec.salesKg) ? rec.salesKg : 0;
    const sReal = rec && typeof rec.actualClosingStockKg === 'number' && !isNaN(rec.actualClosingStockKg) ? rec.actualClosingStockKg : 0;
    const sTotalReal = sAwal + sHasil;
    const sSistem = Math.max(0, sTotalReal - sSales);
    const sSusut = Math.max(0, sSistem - sReal);

    return {
      tglAwal: idx === 0 ? priorDateShort : '',
      stokAwal: sAwal,
      ketAwal: cut.name,
      tglToko: idx === 0 ? dateShort : '',
      bahanProduksi: totalGrandBahan,
      masukToko: totalGrandHasil,
      adjIn: 0,
      adjOut1: idx === 1 || idx === 2 || idx === 4 ? 0 : '',
      adjOut2: '',
      hasil: sHasil,
      ketHasil: cut.name,
      totalReal: sTotalReal,
      sales: sSales,
      ketSales: cut.name,
      stokSistem: sSistem,
      tglAkhir: idx === 0 ? dateShort : '',
      stokReal: sReal,
      ketAkhir: cut.name,
      susut: sSusut,
    };
  });

  const sumStokAwal = dynamicSalesRows.reduce((s, r) => s + (typeof r.stokAwal === 'number' && !isNaN(r.stokAwal) ? r.stokAwal : 0), 0);
  const sumHasil = dynamicSalesRows.reduce((s, r) => s + (typeof r.hasil === 'number' && !isNaN(r.hasil) ? r.hasil : 0), 0);
  const sumTotalReal = dynamicSalesRows.reduce((s, r) => s + (typeof r.totalReal === 'number' && !isNaN(r.totalReal) ? r.totalReal : 0), 0);
  const sumSales = dynamicSalesRows.reduce((s, r) => s + (typeof r.sales === 'number' && !isNaN(r.sales) ? r.sales : 0), 0);
  const sumStokSistem = dynamicSalesRows.reduce((s, r) => s + (typeof r.stokSistem === 'number' && !isNaN(r.stokSistem) ? r.stokSistem : 0), 0);
  const sumStokReal = dynamicSalesRows.reduce((s, r) => s + (typeof r.stokReal === 'number' && !isNaN(r.stokReal) ? r.stokReal : 0), 0);
  const sumSusut = dynamicSalesRows.reduce((s, r) => s + (typeof r.susut === 'number' && !isNaN(r.susut) ? r.susut : 0), 0);

  const handleCellClick = (cellRef: string, formula: string) => {
    setSelectedCell(cellRef);
    setCellFormula(formula);
  };

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

  return (
    <div className="w-full bg-[#f3f4f6] border border-slate-300 rounded-lg shadow-xl overflow-hidden font-sans text-xs">
      {/* Top Excel Application Header Bar */}
      <div className="bg-[#107c41] text-white px-4 py-2 flex items-center justify-between border-b border-[#0d6535]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-sm tracking-wide">
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>LAPORAN DAGING {formattedDateString} - Excel</span>
          </div>
          <span className="bg-[#0b542c] text-emerald-100 text-[10px] px-2 py-0.5 rounded font-mono">
            {currentStore.name} ({currentStore.code})
          </span>
        </div>

        {/* Date Selector & Export Actions */}
        <div className="flex items-center gap-2">
          {onDateChange && (
            <div className="flex items-center gap-1 bg-[#0b542c] px-2 py-1 rounded text-white text-xs border border-emerald-700">
              <Calendar className="w-3 h-3 text-emerald-300" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent text-white border-none focus:outline-none text-[11px]"
              />
            </div>
          )}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-white text-[#107c41] hover:bg-emerald-50 px-3 py-1 rounded font-bold text-xs shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download Excel (.XLSX)
          </button>
        </div>
      </div>

      {/* Excel Ribbon / Formula Bar */}
      <div className="bg-[#f3f4f6] px-3 py-1.5 border-b border-slate-300 flex items-center gap-2 text-slate-700">
        <div className="w-16 bg-white border border-slate-300 px-2 py-0.5 text-center font-mono font-bold text-[11px] text-slate-800 rounded">
          {selectedCell}
        </div>
        <div className="font-serif italic text-slate-500 font-bold px-1 select-none">
          fx
        </div>
        <div className="flex-1 bg-white border border-slate-300 px-3 py-0.5 text-[11px] font-mono text-slate-900 rounded overflow-x-auto whitespace-nowrap min-h-[22px]">
          {cellFormula || (selectedCell === 'I28' ? '' : selectedCell === 'AG35' ? '=AU31' : '=SUM(N4:N8)')}
        </div>
      </div>

      {/* Date Switcher & No-data notice banner */}
      {currentStoreItems.length === 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Belum ada data proses daging pada tanggal <strong>{selectedDate}</strong> untuk cabang {currentStore.name}.
            </span>
          </div>
          {availableDatesWithData.length > 0 && onDateChange && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-600 font-semibold">Beralih ke tanggal aktif:</span>
              {availableDatesWithData.slice(0, 4).map((d) => (
                <button
                  key={d}
                  onClick={() => onDateChange(d)}
                  className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded shadow-xs text-[11px] transition flex items-center gap-1"
                >
                  <Calendar className="w-3 h-3 text-amber-700" />
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spreadsheet Main Grid Area */}
      <div className="bg-white overflow-auto max-h-[700px] p-4 relative" style={{ zoom: `${zoomLevel}%` }}>
        
        {/* ========================================================================= */}
        {/* SHEET 1: SALES DAGING (Exact Match with Image 1 & 2) */}
        {/* ========================================================================= */}
        {activeSheet === 'SALES DAGING' && (
          <div className="min-w-[1200px] border border-black bg-white select-none">
            {/* Title Header: Row 1 - Navy Blue #1F4E78 matching Excel */}
            <div className="w-full bg-[#1F4E78] border-b-2 border-black py-2 px-4 text-center">
              <h1 className="text-sm font-black tracking-wide text-white uppercase font-sans">
                LAPORAN STOCK DAGING TDN {currentStore.name.toUpperCase()} TGL {formattedDateString}
              </h1>
            </div>

            {/* Table Matrix: Rows 2-8 */}
            <table className="w-full border-collapse text-[11px] text-center border-black font-sans">
              <thead>
                <tr className="bg-[#D9E1F2] text-black font-bold h-9 border-b border-black">
                  <th className="border border-black px-2 py-1">Tanggal</th>
                  <th className="border border-black px-2 py-1">Stock Awal<br />(Pagi)</th>
                  <th className="border border-black px-3 py-1">Keterangan</th>
                  <th className="border border-black px-2 py-1">Tanggal</th>
                  <th className="border border-black px-2 py-1">BAHAN<br />PRODUKSI</th>
                  <th className="border border-black px-2 py-1">Masuk ke<br />Toko</th>
                  <th className="border border-black px-2 py-1">ADJ IN</th>
                  <th className="border border-black px-2 py-1">ADJ OUT</th>
                  <th className="border border-black px-2 py-1">Hasil</th>
                  <th className="border border-black px-3 py-1">Keterangan</th>
                  <th className="border border-black px-2 py-1">Total Real<br />( Kg )</th>
                  <th className="border border-black px-2 py-1">Penjualan</th>
                  <th className="border border-black px-3 py-1">Keterangan</th>
                  <th className="border border-black px-2 py-1">Stock Akhir by<br />Sistem</th>
                  <th className="border border-black px-2 py-1">Tanggal</th>
                  <th className="border border-black px-2 py-1">Stock Akhir<br />Real (Kg)</th>
                  <th className="border border-black px-3 py-1">Keterangan</th>
                  <th className="border border-black px-2 py-1">Penyusutan</th>
                </tr>
              </thead>
              <tbody>
                {dynamicSalesRows.map((row, idx) => (
                  <tr key={idx} className="h-7 hover:bg-slate-50 transition-colors">
                    {/* Tanggal Awal */}
                    <td className="border border-black font-sans text-slate-700 bg-white">
                      {row.tglAwal}
                    </td>

                    {/* Stock Awal (Pagi) - Light Green */}
                    <td
                      onClick={() => handleCellClick(`C${idx + 3}`, String(row.stokAwal))}
                      className={`border border-black px-2 font-mono font-medium text-right cursor-pointer ${
                        typeof row.stokAwal === 'number' ? 'bg-[#C6EFCE] text-[#006100]' : 'bg-white'
                      }`}
                    >
                      {typeof row.stokAwal === 'number' ? row.stokAwal.toFixed(2) : row.stokAwal}
                    </td>

                    {/* Keterangan Awal */}
                    <td className="border border-black px-2 text-left text-slate-900 font-sans">
                      {row.ketAwal}
                    </td>

                    {/* Tanggal Toko */}
                    <td className="border border-black font-sans text-slate-700 bg-white">
                      {row.tglToko}
                    </td>

                    {/* BAHAN PRODUKSI (Merged vertical block on first row) */}
                    {idx === 0 ? (
                      <td
                        rowSpan={5}
                        className="border border-black px-2 font-mono font-bold text-center bg-white align-middle"
                      >
                        {totalGrandBahan.toFixed(2)}
                      </td>
                    ) : null}

                    {/* Masuk ke Toko (Merged vertical block on first row) */}
                    {idx === 0 ? (
                      <td
                        rowSpan={5}
                        className="border border-black px-2 font-mono font-bold text-center bg-white align-middle"
                      >
                        {totalGrandHasil.toFixed(2)}
                      </td>
                    ) : null}

                    {/* ADJ IN - Soft Yellow on first row */}
                    <td
                      onClick={() => handleCellClick(`H${idx + 3}`, '=0.00')}
                      className="border border-black px-2 font-mono text-center bg-[#FFF2CC] cursor-pointer"
                    >
                      0.00
                    </td>

                    {/* ADJ OUT - Yellow for certain rows */}
                    <td
                      onClick={() => handleCellClick(`I${idx + 3}`, idx === 1 ? '0.00' : '')}
                      className={`border border-black px-2 font-mono text-center cursor-pointer ${
                        idx === 1 || idx === 2 || idx === 4 ? 'bg-[#FFFF00] text-black font-medium' : 'bg-white'
                      }`}
                    >
                      {idx === 1 || idx === 2 || idx === 4 ? '0.00' : ''}
                    </td>

                    {/* Hasil */}
                    <td
                      onClick={() => handleCellClick(`J${idx + 3}`, typeof row.hasil === 'number' ? String(row.hasil) : '')}
                      className="border border-black px-2 font-mono text-right bg-white font-medium cursor-pointer"
                    >
                      {typeof row.hasil === 'number' ? row.hasil.toFixed(2) : row.hasil}
                    </td>

                    {/* Keterangan Hasil */}
                    <td className="border border-black px-2 text-left text-slate-900 font-sans">
                      {row.ketHasil}
                    </td>

                    {/* Total Real (Kg) */}
                    <td
                      onClick={() => handleCellClick(`L${idx + 3}`, `=C${idx + 3}+H${idx + 3}-I${idx + 3}+J${idx + 3}`)}
                      className="border border-black px-2 font-mono text-right bg-white font-bold cursor-pointer"
                    >
                      {typeof row.totalReal === 'number' ? row.totalReal.toFixed(2) : row.totalReal}
                    </td>

                    {/* Penjualan (Sales) - Vibrant Light Green */}
                    <td
                      onClick={() => handleCellClick(`M${idx + 3}`, String(row.sales))}
                      className="border border-black px-2 font-mono text-right bg-[#92D050] text-black font-semibold cursor-pointer"
                    >
                      {typeof row.sales === 'number' ? row.sales.toFixed(2) : row.sales}
                    </td>

                    {/* Keterangan Sales */}
                    <td className="border border-black px-2 text-left text-slate-900 font-sans">
                      {row.ketSales}
                    </td>

                    {/* Stock Akhir by Sistem */}
                    <td
                      onClick={() => handleCellClick(`O${idx + 3}`, `=MAX(0, L${idx + 3}-M${idx + 3})`)}
                      className="border border-black px-2 font-mono text-right bg-white font-bold cursor-pointer"
                    >
                      {typeof row.stokSistem === 'number' ? row.stokSistem.toFixed(2) : row.stokSistem}
                    </td>

                    {/* Tanggal Akhir */}
                    <td className="border border-black font-sans text-slate-700 bg-white">
                      {row.tglAkhir}
                    </td>

                    {/* Stock Akhir Real (Kg) - Light Green */}
                    <td
                      onClick={() => handleCellClick(`Q${idx + 3}`, String(row.stokReal))}
                      className="border border-black px-2 font-mono text-right bg-[#C6EFCE] text-[#006100] font-bold cursor-pointer"
                    >
                      {typeof row.stokReal === 'number' ? row.stokReal.toFixed(2) : row.stokReal}
                    </td>

                    {/* Keterangan Akhir */}
                    <td className="border border-black px-2 text-left text-slate-900 font-sans">
                      {row.ketAkhir}
                    </td>

                    {/* Penyusutan */}
                    <td
                      onClick={() => handleCellClick(`S${idx + 3}`, `=MAX(0, O${idx + 3}-Q${idx + 3})`)}
                      className="border border-black px-2 font-mono text-right bg-white font-bold text-[#C00000] cursor-pointer"
                    >
                      {typeof row.susut === 'number' ? row.susut.toFixed(2) : row.susut}
                    </td>
                  </tr>
                ))}

                {/* ROW 8: TOTAL / SELISIH SUMMARY ROW (Solid Yellow `#FFFF00`) */}
                <tr className="bg-[#FFFF00] text-black font-black h-8 border-t-2 border-b-2 border-black">
                  <td className="border border-black font-sans text-center">TOTAL</td>
                  <td className="border border-black px-2 font-mono text-right">
                    {sumStokAwal.toFixed(2)}
                  </td>
                  <td className="border border-black"></td>
                  <td className="border border-black font-sans text-center">SELISIH</td>
                  <td className="border border-black px-2 font-mono text-right text-[#C00000]">
                    {totalGrandSusutProses.toFixed(2)}
                  </td>
                  <td className="border border-black"></td>
                  <td className="border border-black px-2 font-mono text-right">0.00</td>
                  <td className="border border-black px-2 font-mono text-right">0.00</td>
                  <td className="border border-black px-2 font-mono text-right">
                    {sumHasil.toFixed(2)}
                  </td>
                  <td className="border border-black"></td>
                  <td className="border border-black px-2 font-mono text-right">
                    {sumTotalReal.toFixed(2)}
                  </td>
                  <td className="border border-black px-2 font-mono text-right">
                    {sumSales.toFixed(2)}
                  </td>
                  <td className="border border-black"></td>
                  <td className="border border-black px-2 font-mono text-right">
                    {sumStokSistem.toFixed(2)}
                  </td>
                  <td className="border border-black"></td>
                  <td className="border border-black px-2 font-mono text-right text-[#006100]">
                    {sumStokReal.toFixed(2)}
                  </td>
                  <td className="border border-black"></td>
                  <td className="border border-black px-2 font-mono text-right text-[#C00000]">
                    {sumSusut.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Notes Section underneath */}
            <div className="p-4 bg-white text-[11px] font-mono space-y-1 text-slate-800 border-t border-slate-200">
              <div className="font-bold">NOTE :</div>
              <div className="pl-6 grid grid-cols-[380px_100px_40px] items-center">
                <span>ITEM DAGING SAPI POT RENDANG TERJUAL KE DG PREM LOKAL</span>
                <span>: 0.000</span>
                <span>KG</span>
              </div>
              <div className="pl-6 grid grid-cols-[380px_100px_40px] items-center">
                <span>ITEM DAGING PREM LOKAL TERJUAL KE DAGING SAPI POT RENDANG</span>
                <span>: 0.000</span>
                <span>KG</span>
              </div>
              <div className="pl-6 grid grid-cols-[380px_100px_40px] items-center">
                <span>ITEM DAGING SAPI POT RENDANG TERJUAL KE DG FRESH MEMBER</span>
                <span>: 0.000</span>
                <span>KG</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SHEET 2: PROSES (Exact Match with User's Excel Screenshot: FORM PROSES PRODUKSI) */}
        {/* ========================================================================= */}
        {activeSheet === 'PROSES' && (
          <div className="min-w-[1050px] border border-slate-300 bg-white p-6 select-none font-sans text-xs">
            {/* Title Header: FORM PROSES PRODUKSI */}
            <div className="w-[680px] bg-[#FFC000] border-2 border-black py-2 text-center font-black text-base tracking-wider uppercase mb-3 shadow-sm">
              FORM PROSES PRODUKSI
            </div>

            {/* Date and Day Header Box */}
            <div className="w-[200px] border border-black mb-4 bg-white text-xs">
              <div className="grid grid-cols-[65px_15px_1fr] border-b border-black px-2 py-0.5 items-center font-medium">
                <span>Hari</span>
                <span>:</span>
                <span className="font-bold uppercase tracking-wider">
                  {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long' }) || 'KAMIS'}
                </span>
              </div>
              <div className="grid grid-cols-[65px_15px_1fr] px-2 py-0.5 items-center font-medium">
                <span>Tanggal</span>
                <span>:</span>
                <span className="font-semibold">
                  {new Date(selectedDate).toLocaleDateString('en-US') || '8/20/2026'}
                </span>
              </div>
            </div>

            {/* Main Process Table with Side Summary */}
            <div className="flex items-start gap-8">
              {/* Main Matrix Table */}
              <div className="w-[680px]">
                <table className="w-full border-collapse border border-black text-xs text-center font-sans">
                  <thead>
                    <tr className="bg-[#D9D9D9] font-bold">
                      <th className="border border-black px-2 py-1 text-left w-[130px]">Nomor</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">1</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">2</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">3</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">4</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">5</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">6</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">7</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">8</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">9</th>
                      <th className="border border-black px-1.5 py-1 w-[45px]">16</th>
                      <th className="border border-black px-2 py-1 w-[70px] bg-[#BFBFBF]">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {/* Row 1: Bahan */}
                    <tr className="hover:bg-amber-50">
                      <td className="border border-black px-2 py-1 font-sans text-left font-semibold">Bahan</td>
                      <td className="border border-black px-1 py-1">{dgFreshBahan > 0 ? dgFreshBahan.toFixed(2) : '0.00'}</td>
                      <td className="border border-black px-1 py-1">0.00</td>
                      <td className="border border-black px-1 py-1">0.00</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1">0.00</td>
                      <td className="border border-black px-1 py-1">{rawonBahan > 0 ? rawonBahan.toFixed(2) : '0.00'}</td>
                      <td className="border border-black px-1 py-1">0.00</td>
                      <td className="border border-black px-1 py-1">{dgPremBahan > 0 ? dgPremBahan.toFixed(2) : '0.00'}</td>
                      <td className="border border-black px-1 py-1">{shankBahan > 0 ? shankBahan.toFixed(2) : '0.00'}</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-2 py-1 font-bold bg-[#F2F2F2]">{totalGrandBahan.toFixed(3)}</td>
                    </tr>

                    {/* Row 2: D.sapi p. rdang */}
                    <tr className="hover:bg-amber-50">
                      <td className="border border-black px-2 py-1 font-sans text-left">D.sapi p. rdang</td>
                      <td className="border border-black px-1 py-1">{dgFreshHasil > 0 ? dgFreshHasil.toFixed(2) : '0.00'}</td>
                      <td className="border border-black px-1 py-1">0.00</td>
                      <td className="border border-black px-1 py-1">0.00</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-2 py-1 font-bold bg-[#F2F2F2]">{dgFreshHasil.toFixed(3)}</td>
                    </tr>

                    {/* Row 3: D premium lokal */}
                    <tr className="hover:bg-amber-50">
                      <td className="border border-black px-2 py-1 font-sans text-left">D premium lokal</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1">0.00</td>
                      <td className="border border-black px-1 py-1">{dgPremHasil > 0 ? dgPremHasil.toFixed(2) : '0.00'}</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-2 py-1 font-bold bg-[#F2F2F2]">{dgPremHasil.toFixed(3)}</td>
                    </tr>

                    {/* Row 4: Empty row with dash */}
                    <tr className="hover:bg-amber-50">
                      <td className="border border-black px-2 py-1 font-sans text-left"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-2 py-1 bg-[#F2F2F2]">-</td>
                    </tr>

                    {/* Row 5: D fresh ekonomis */}
                    <tr className="hover:bg-amber-50">
                      <td className="border border-black px-2 py-1 font-sans text-left">D fresh ekonomis</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1">{shankHasil > 0 ? shankHasil.toFixed(2) : '0.00'}</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-2 py-1 font-bold bg-[#F2F2F2]">{shankHasil.toFixed(3)}</td>
                    </tr>

                    {/* Row 6: Rawon Curah */}
                    <tr className="hover:bg-amber-50">
                      <td className="border border-black px-2 py-1 font-sans text-left">Rawon Curah</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1">0.000</td>
                      <td className="border border-black px-1 py-1">{rawonHasil > 0 ? rawonHasil.toFixed(3) : '0.000'}</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-2 py-1 font-bold bg-[#F2F2F2]">{rawonHasil.toFixed(3)}</td>
                    </tr>

                    {/* Row 7: Urat Triming */}
                    <tr className="hover:bg-amber-50">
                      <td className="border border-black px-2 py-1 font-sans text-left">Urat Triming</td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-1 py-1"></td>
                      <td className="border border-black px-2 py-1 bg-[#F2F2F2]">-</td>
                    </tr>

                    {/* Row 8: Solid Yellow Row with Susut Total */}
                    <tr className="bg-[#FFFF00] font-bold border-2 border-black">
                      <td colSpan={11} className="border border-black py-1"></td>
                      <td className="border border-black px-2 py-1 text-black font-black">{totalGrandSusutProses.toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Side Summary Block (TOTAL BAHAN / TOTAL BERSIH) */}
              <div className="space-y-4 pt-1 font-sans">
                <div className="grid grid-cols-[110px_75px_50px] items-center text-xs">
                  <span className="font-bold text-slate-800">TOTAL BAHAN</span>
                  <span className="font-mono font-bold text-right">{totalGrandBahan.toFixed(3)}</span>
                  <span className="font-mono text-right text-slate-700">{totalGrandSusutProses.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-[110px_75px] items-center text-xs">
                  <span className="font-bold text-slate-800">TOTAL BERSIH</span>
                  <span className="font-mono font-bold text-right">{totalGrandHasil.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Middle Section: Summary Calculations Text */}
            <div className="my-6 space-y-1 font-sans text-xs">
              <div className="grid grid-cols-[240px_30px_100px] items-center font-bold text-slate-900">
                <span>HASIL PRODUKSI RENDANG FRESH</span>
                <span className="text-center">=</span>
                <span className="font-mono">{dgFreshHasil.toFixed(2)} KG</span>
              </div>
              <div className="grid grid-cols-[240px_30px_100px] items-center font-bold text-slate-900">
                <span className="pl-14">DAGING PREMIUM</span>
                <span className="text-center">=</span>
                <span className="font-mono">{dgPremHasil.toFixed(2)} KG</span>
              </div>
              <div className="grid grid-cols-[240px_30px_100px] items-center font-bold text-slate-900">
                <span>BERSIH DAGING RENDANG FRESH</span>
                <span className="text-center">=</span>
                <span className="font-mono">{dgFreshHasil.toFixed(2)} KG</span>
              </div>
            </div>

            {/* Bottom Summary Table matching exact Excel Screenshot */}
            <div className="w-[680px] border border-black font-sans text-xs">
              <div className="divide-y divide-black">
                <div className="grid grid-cols-[550px_1fr] bg-white">
                  <div className="text-right pr-4 py-1 font-bold text-slate-800">Total Bahan</div>
                  <div className="border-l border-black px-3 py-1 font-mono font-bold text-right">{totalGrandBahan.toFixed(3)}</div>
                </div>
                <div className="grid grid-cols-[550px_1fr] bg-white">
                  <div className="text-right pr-4 py-1 font-semibold text-slate-800">Total D. Sapi pot Rendang</div>
                  <div className="border-l border-black px-3 py-1 font-mono text-right">{dgFreshHasil.toFixed(3)}</div>
                </div>
                <div className="grid grid-cols-[550px_1fr] bg-white">
                  <div className="text-right pr-4 py-1 font-semibold text-slate-800">Tot D Premium lokal</div>
                  <div className="border-l border-black px-3 py-1 font-mono text-right">{dgPremHasil.toFixed(3)}</div>
                </div>
                <div className="grid grid-cols-[550px_1fr] bg-white">
                  <div className="text-right pr-4 py-1 font-semibold text-slate-800">Total Sankle</div>
                  <div className="border-l border-black px-3 py-1 font-mono text-right">{shankHasil > 0 ? shankHasil.toFixed(3) : '-'}</div>
                </div>
                <div className="grid grid-cols-[550px_1fr] bg-white">
                  <div className="text-right pr-4 py-1 font-semibold text-slate-800">D fresh ekonomis</div>
                  <div className="border-l border-black px-3 py-1 font-mono text-right">{shankHasil.toFixed(3)}</div>
                </div>
                <div className="grid grid-cols-[550px_1fr] bg-white">
                  <div className="text-right pr-4 py-1 font-semibold text-slate-800">Total Rawon</div>
                  <div className="border-l border-black px-3 py-1 font-mono text-right">{rawonHasil.toFixed(3)}</div>
                </div>
                <div className="grid grid-cols-[550px_1fr] bg-white">
                  <div className="text-right pr-4 py-1 font-semibold text-slate-800">Total Urat triming</div>
                  <div className="border-l border-black px-3 py-1 font-mono text-right">-</div>
                </div>
                {/* Yellow Susut Bar */}
                <div className="grid grid-cols-[550px_1fr] bg-[#FFFF00] font-bold border-t-2 border-black">
                  <div className="text-center py-1 font-black tracking-widest text-black">SUSUT</div>
                  <div className="border-l border-black px-3 py-1 font-mono font-black text-right text-black">{totalGrandSusutProses.toFixed(3)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SHEET 1: LAP.DAGING (Contains BOTH: 1. Matriks Tally/Susut Daging & 2. Laporan Modal COGS) */}
        {/* ========================================================================= */}
        {activeSheet === 'LAP.DAGING' && (
          <div className="min-w-[1350px] border border-slate-300 bg-white p-5 select-none font-sans text-xs space-y-8">
            {/* Quick Section Navigation Bar */}
            <div className="flex items-center justify-between bg-slate-100 p-2.5 border border-slate-300 rounded text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Sheet LAP.DAGING:</span>
                <span className="text-slate-600 text-[11px]">Memuat 2 bagian lengkap (Matriks Proses Produksi Tally/Susut & Laporan Finansial Modal/COGS)</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="#bagian-matriks"
                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-blue-700 hover:text-blue-900 transition shadow-sm"
                >
                  ↓ Bagian 1: Matriks Proses Tally & Susut Daging
                </a>
                <a
                  href="#bagian-kalkulasi"
                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-emerald-700 hover:text-emerald-900 transition shadow-sm"
                >
                  ↓ Bagian 2: Laporan Modal & Susut Jual
                </a>
              </div>
            </div>

            {/* ======================================================================= */}
            {/* BAGIAN 1: PROSES TDN CIKARANG UTARA (MATRIKS TALLY / SUSUT / NETTO) */}
            {/* ======================================================================= */}
            <div id="bagian-matriks" className="border border-black bg-white select-none">
              {/* Title Header */}
              <div className="w-full bg-white py-1 px-4 text-center font-bold text-xs uppercase border-b border-black">
                PROSES TDN {currentStore.name.toUpperCase()}
              </div>

              {/* Side-by-side grouped multi-column matrix */}
              <div className="p-3 overflow-x-auto">
                <table className="border-collapse text-[10px] text-center border-black font-sans">
                  <thead>
                    {/* Top Level Category Banner */}
                    <tr>
                      {/* DAGING PRESH Group */}
                      <th colSpan={9} className="bg-[#FF0000] text-white border border-black py-1 font-bold">
                        DAGING PRESH
                      </th>
                      <th className="w-4 border-none bg-white"></th>
                      {/* DAGING PREMIUM Group */}
                      <th colSpan={3} className="bg-[#FF0000] text-white border border-black py-1 font-bold">
                        DAGING PREMIUM
                      </th>
                      <th colSpan={3} className="bg-[#FF0000] text-white border border-black py-1 font-bold">
                        DAGING PREMIUM
                      </th>
                      <th className="w-4 border-none bg-white"></th>
                      {/* RAWON FRESH Group */}
                      <th colSpan={6} className="bg-[#FF0000] text-white border border-black py-1 font-bold">
                        RAWON FRESH
                      </th>
                      <th className="w-4 border-none bg-white"></th>
                      {/* DAGING FRESH (SHANKLE) Group */}
                      <th colSpan={3} className="bg-[#FF0000] text-white border border-black py-1 font-bold">
                        DAGING FRESH
                      </th>
                    </tr>

                    {/* Sub-Category Names */}
                    <tr className="font-bold">
                      {/* Sub Daging Fresh */}
                      <th colSpan={3} className="bg-[#B4C6E7] border border-black py-0.5">HQ 41/42/44/45</th>
                      <th colSpan={3} className="bg-[#B4C6E7] border border-black py-0.5">DG RNDG BEKU 1kg</th>
                      <th colSpan={3} className="bg-[#B4C6E7] border border-black py-0.5">DAGING HUSUS</th>
                      <th className="border-none bg-white"></th>
                      {/* Sub Daging Premium */}
                      <th colSpan={3} className="bg-[#FCE4D6] border border-black py-0.5">DG Prem 2</th>
                      <th colSpan={3} className="bg-[#FCE4D6] border border-black py-0.5">FRIBOY</th>
                      <th className="border-none bg-white"></th>
                      {/* Sub Rawon Fresh */}
                      <th colSpan={3} className="bg-[#FFF2CC] border border-black py-0.5">RAWON BEKU</th>
                      <th colSpan={3} className="bg-[#FFF2CC] border border-black py-0.5">RAWON FRESH A</th>
                      <th className="border-none bg-white"></th>
                      {/* Sub Shankle */}
                      <th colSpan={3} className="bg-[#E2EFDA] border border-black py-0.5">FQ 60 /SHANK</th>
                    </tr>

                    {/* Column Metrics: SUSUT | TALLY | NETTO */}
                    <tr className="bg-slate-100 font-semibold text-[9px]">
                      {/* Group 1 */}
                      <th className="border border-black px-1.5 py-0.5">SUSUT</th>
                      <th className="border border-black px-1.5 py-0.5">TALLY</th>
                      <th className="border border-black px-1.5 py-0.5">NETTO</th>
                      <th className="border border-black px-1.5 py-0.5">SUSUT</th>
                      <th className="border border-black px-1.5 py-0.5">TALLY</th>
                      <th className="border border-black px-1.5 py-0.5">NETTO</th>
                      <th className="border border-black px-1.5 py-0.5">SUSUT</th>
                      <th className="border border-black px-1.5 py-0.5">TALLY</th>
                      <th className="border border-black px-1.5 py-0.5">NETTO</th>
                      <th className="border-none bg-white"></th>

                      {/* Group 2 */}
                      <th className="border border-black px-1.5 py-0.5">SUSUT</th>
                      <th className="border border-black px-1.5 py-0.5">TALLY</th>
                      <th className="border border-black px-1.5 py-0.5">NETTO</th>
                      <th className="border border-black px-1.5 py-0.5">SUSUT</th>
                      <th className="border border-black px-1.5 py-0.5">TALLY</th>
                      <th className="border border-black px-1.5 py-0.5">NETTO</th>
                      <th className="border-none bg-white"></th>

                      {/* Group 3 */}
                      <th className="border border-black px-1.5 py-0.5">SUSUT</th>
                      <th className="border border-black px-1.5 py-0.5">TALLY</th>
                      <th className="border border-black px-1.5 py-0.5">NETTO</th>
                      <th className="border border-black px-1.5 py-0.5">SUSUT</th>
                      <th className="border border-black px-1.5 py-0.5">TALLY</th>
                      <th className="border border-black px-1.5 py-0.5">NETTO</th>
                      <th className="border-none bg-white"></th>

                      {/* Group 4 */}
                      <th className="border border-black px-1.5 py-0.5">SUSUT</th>
                      <th className="border border-black px-1.5 py-0.5">TALLY</th>
                      <th className="border border-black px-1.5 py-0.5">NETTO</th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* Dynamic Thawing Data Rows mapped to 8 sub-columns */}
                    {(() => {
                      const maxItemsCount = Math.max(
                        col1Items.length,
                        col2Items.length,
                        col3Items.length,
                        col4Items.length,
                        col5Items.length,
                        col6Items.length,
                        col7Items.length,
                        col8Items.length,
                        0
                      );
                      const rowCount = Math.max(16, maxItemsCount);

                      return Array.from({ length: rowCount }).map((_, rIdx) => {
                        const renderCells = (colArr: ThawingItem[], bgClass: string = '') => {
                          const item = colArr[rIdx];
                          if (item) {
                            const bahan = item.weightBeforeThawing || 0;
                            const hasil = item.weightAfterThawing !== null && item.weightAfterThawing !== undefined ? item.weightAfterThawing : bahan;
                            const susut = Math.max(0, bahan - hasil);
                            return (
                              <>
                                <td className={`border border-black px-1 text-right ${bgClass}`}>{susut > 0 ? susut.toFixed(2) : '0.00'}</td>
                                <td className={`border border-black px-1 text-right ${bgClass}`}>{bahan > 0 ? bahan.toFixed(2) : ''}</td>
                                <td className={`border border-black px-1 text-right ${bgClass}`}>{hasil > 0 ? hasil.toFixed(2) : ''}</td>
                              </>
                            );
                          }
                          return (
                            <>
                              <td className={`border border-black px-1 text-right text-slate-400 ${bgClass}`}>0.00</td>
                              <td className={`border border-black px-1 text-right ${bgClass}`}></td>
                              <td className={`border border-black px-1 text-right ${bgClass}`}></td>
                            </>
                          );
                        };

                        return (
                          <tr key={rIdx} className="font-mono text-[10px] h-4 bg-white hover:bg-slate-50 transition-colors">
                            {/* HQ 41/42/44/45 */}
                            {renderCells(col1Items, col1Items[rIdx] ? 'bg-[#DDEBF7]' : '')}
                            {/* DG RNDG BEKU 1kg */}
                            {renderCells(col2Items, col2Items[rIdx] ? 'bg-[#DDEBF7]' : '')}
                            {/* DAGING HUSUS */}
                            {renderCells(col3Items, col3Items[rIdx] ? 'bg-[#DDEBF7]' : '')}

                            {/* Gap */}
                            <td className="border-none bg-white"></td>

                            {/* DG Prem 2 */}
                            {renderCells(col4Items, col4Items[rIdx] ? 'bg-[#FCE4D6]' : '')}
                            {/* FRIBOY */}
                            {renderCells(col5Items, col5Items[rIdx] ? 'bg-[#FCE4D6]' : '')}

                            {/* Gap */}
                            <td className="border-none bg-white"></td>

                            {/* RAWON BEKU */}
                            {renderCells(col6Items, col6Items[rIdx] ? 'bg-[#FFF2CC]' : '')}
                            {/* RAWON FRESH A */}
                            {renderCells(col7Items, col7Items[rIdx] ? 'bg-[#FFF2CC]' : '')}

                            {/* Gap */}
                            <td className="border-none bg-white"></td>

                            {/* FQ 60 /SHANK */}
                            {renderCells(col8Items, col8Items[rIdx] ? 'bg-[#E2EFDA]' : '')}
                          </tr>
                        );
                      });
                    })()}

                    {/* Yellow Summary Row (Row 30) */}
                    <tr className="bg-[#FFFF00] font-mono font-bold text-black border-t-2 border-b-2 border-black">
                      <td className="border border-black px-1 text-right">{col1Totals.susut.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col1Totals.bahan.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col1Totals.hasil.toFixed(2)}</td>

                      <td className="border border-black px-1 text-right">{col2Totals.susut.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col2Totals.bahan.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col2Totals.hasil.toFixed(2)}</td>

                      <td className="border border-black px-1 text-right">{col3Totals.susut.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col3Totals.bahan.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col3Totals.hasil.toFixed(2)}</td>

                      <td className="border-none bg-white"></td>

                      <td className="border border-black px-1 text-right">{col4Totals.susut.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col4Totals.bahan.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col4Totals.hasil.toFixed(2)}</td>

                      <td className="border border-black px-1 text-right">{col5Totals.susut.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col5Totals.bahan.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col5Totals.hasil.toFixed(2)}</td>

                      <td className="border-none bg-white"></td>

                      <td className="border border-black px-1 text-right">{col6Totals.susut.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col6Totals.bahan.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col6Totals.hasil.toFixed(2)}</td>

                      <td className="border border-black px-1 text-right">{col7Totals.susut.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col7Totals.bahan.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col7Totals.hasil.toFixed(2)}</td>

                      <td className="border-none bg-white"></td>

                      <td className="border border-black px-1 text-right">{col8Totals.susut.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col8Totals.bahan.toFixed(2)}</td>
                      <td className="border border-black px-1 text-right">{col8Totals.hasil.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Bottom Summary Cards matching User's Image 1 */}
                <div className="grid grid-cols-4 gap-6 mt-4 text-[11px] font-sans border-t border-slate-300 pt-3">
                  {/* Under Daging Fresh (3 cards: HQ, DG RNDG BEKU, DAGING KHUSUS) */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-700">Bahan : {col1Totals.bahan > 0 ? col1Totals.bahan.toFixed(2) : '-'}</div>
                      <div className="text-slate-600">Hasil 1 : {col1Totals.hasil > 0 ? col1Totals.hasil.toFixed(2) : '-'}</div>
                      <div className="font-bold text-amber-700">Susut : {col1Totals.susut > 0 ? col1Totals.susut.toFixed(3) : '0.000'}</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">Bahan : {col2Totals.bahan > 0 ? col2Totals.bahan.toFixed(2) : '-'}</div>
                      <div className="text-slate-600">Hasil 1 : {col2Totals.hasil > 0 ? col2Totals.hasil.toFixed(2) : '-'}</div>
                      <div className="font-bold text-amber-700">Susut : {col2Totals.susut > 0 ? col2Totals.susut.toFixed(3) : '0.000'}</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">Bahan : {col3Totals.bahan > 0 ? col3Totals.bahan.toFixed(2) : '-'}</div>
                      <div className="text-slate-600">Hasil 1 : {col3Totals.hasil > 0 ? col3Totals.hasil.toFixed(2) : '-'}</div>
                      <div className="font-bold text-amber-700">Susut : {col3Totals.susut > 0 ? col3Totals.susut.toFixed(3) : '0.000'}</div>
                    </div>
                  </div>

                  {/* Under Daging Premium (2 cards: DG Prem 2, FRIBOY) */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-700">Bahan : {col4Totals.bahan > 0 ? col4Totals.bahan.toFixed(2) : '-'}</div>
                      <div className="text-slate-600">Hasil 1 : {col4Totals.hasil > 0 ? col4Totals.hasil.toFixed(2) : '-'}</div>
                      <div className="font-bold text-amber-700">Susut : {col4Totals.susut > 0 ? col4Totals.susut.toFixed(3) : '0.000'}</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">Bahan : {col5Totals.bahan > 0 ? col5Totals.bahan.toFixed(2) : '-'}</div>
                      <div className="text-slate-600">Hasil 1 : {col5Totals.hasil > 0 ? col5Totals.hasil.toFixed(2) : '-'}</div>
                      <div className="font-bold text-amber-700">Susut : {col5Totals.susut > 0 ? col5Totals.susut.toFixed(3) : '0.000'}</div>
                    </div>
                  </div>

                  {/* Under Rawon (2 cards: RAWON BEKU, RAWON FRESH A) */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-700">Bahan : {col6Totals.bahan > 0 ? col6Totals.bahan.toFixed(2) : '-'}</div>
                      <div className="text-slate-600">Hasil 1 : {col6Totals.hasil > 0 ? col6Totals.hasil.toFixed(2) : '-'}</div>
                      <div className="font-bold text-amber-700">Susut : {col6Totals.susut > 0 ? col6Totals.susut.toFixed(3) : '0.000'}</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">Bahan : {col7Totals.bahan > 0 ? col7Totals.bahan.toFixed(2) : '-'}</div>
                      <div className="text-slate-600">Hasil 1 : {col7Totals.hasil > 0 ? col7Totals.hasil.toFixed(2) : '-'}</div>
                      <div className="font-bold text-amber-700">Susut : {col7Totals.susut > 0 ? col7Totals.susut.toFixed(3) : '0.000'}</div>
                    </div>
                  </div>

                  {/* Under Shankle (1 card: FQ 60 / SHANK) */}
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div className="font-bold text-slate-700">Bahan : {col8Totals.bahan > 0 ? col8Totals.bahan.toFixed(2) : '-'}</div>
                    <div className="text-slate-600">Hasil 1 : {col8Totals.hasil > 0 ? col8Totals.hasil.toFixed(2) : '-'}</div>
                    <div className="font-bold text-amber-700">Susut : {col8Totals.susut > 0 ? col8Totals.susut.toFixed(3) : '0.000'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ======================================================================= */}
            {/* BAGIAN 2: LAPORAN DAGING DAN RAWON FRESH TDN (KALKULASI MODAL & COGS) */}
            {/* ======================================================================= */}
            <div id="bagian-kalkulasi" className="border border-black bg-white p-6 select-none font-sans text-xs">
              {/* Top Green Banner */}
              <div className="bg-[#00B050] text-white py-1.5 px-4 text-center font-bold text-sm tracking-wide mb-3 border border-black">
                LAPORAN DAGING DAN RAWON FRESH TDN {currentStore.name.toUpperCase()}
              </div>

              {/* Date & Master COGS Connectivity Status Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-emerald-50/80 border border-emerald-200 p-3 rounded-lg">
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>{fullDayDateString}</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 font-medium mt-0.5">
                    ✓ Seluruh kolom harga & perhitungan modal terhubung dinamis ke Master Data COGS
                  </div>
                </div>

                  {/* Quick Badges & Edit Action */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px] bg-white border border-emerald-300 px-2.5 py-1 rounded shadow-xs">
                      <span className="font-semibold text-slate-600">Fresh:</span>
                      <span className="font-mono font-bold text-emerald-800">Rp {dgFreshCogs.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] bg-white border border-emerald-300 px-2.5 py-1 rounded shadow-xs">
                      <span className="font-semibold text-slate-600">Prem:</span>
                      <span className="font-mono font-bold text-emerald-800">Rp {dgPremCogs.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] bg-white border border-emerald-300 px-2.5 py-1 rounded shadow-xs">
                      <span className="font-semibold text-slate-600">Rawon:</span>
                      <span className="font-mono font-bold text-emerald-800">Rp {rawonCogs.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] bg-white border border-emerald-300 px-2.5 py-1 rounded shadow-xs">
                      <span className="font-semibold text-slate-600">Shank:</span>
                      <span className="font-mono font-bold text-emerald-800">Rp {shankCogs.toLocaleString('id-ID')}</span>
                    </div>

                    {isMdUser && onUpdateCogs ? (
                      <button
                        onClick={() => setShowCogsQuickModal(true)}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                        title="Atur harga pokok COGS (Wewenang Khusus Akun MD)"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Ubah COGS (MD)
                      </button>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 text-[11px] bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded border border-slate-300 select-none"
                        title="Harga Pokok (COGS) diatur dan dikunci secara terpusat oleh akun MD Pusat"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>COGS Diatur MD (Read-Only)</span>
                      </div>
                    )}
                  </div>
                </div>

            {/* Formula Reference Card / Keterangan Rumus Susut */}
            <div className="mb-6 p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-300 rounded-md text-xs shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200 mb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-700 font-bold" />
                  <span className="font-bold text-emerald-900 text-xs tracking-wide">
                    FORMULA & DATA PERHITUNGAN SUSUT (LAP.DAGING & PROSES)
                  </span>
                </div>
                <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                  Excel Formula Mode Active
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div className="bg-white/80 p-2 rounded border border-emerald-200">
                  <div className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>% Persentase Susut Total</span>
                  </div>
                  <div className="font-mono text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded text-[10px] mb-1 font-semibold">
                    =((TotalBahan - (TotalHasil + SusutJual)) / TotalBahan)
                  </div>
                  <p className="text-slate-600 text-[10px]">
                    Menghitung total kehilangan bobot (susut proses + susut jual) relatif terhadap bahan baku awal.
                  </p>
                </div>

                <div className="bg-white/80 p-2 rounded border border-emerald-200">
                  <div className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>% Susut Jual & Susut Proses</span>
                  </div>
                  <div className="font-mono text-amber-800 bg-amber-100/60 px-1.5 py-0.5 rounded text-[10px] mb-1 font-semibold">
                    % SJ = |SusutJual| / TotalBahan | % SP = |SP| / TotalBahan
                  </div>
                  <p className="text-slate-600 text-[10px]">
                    Susut Proses = Hasil - Bahan (Kg). Susut Jual = Selisih stok sistem vs fisik counter penjualan.
                  </p>
                </div>

                <div className="bg-white/80 p-2 rounded border border-emerald-200">
                  <div className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Modal Baru & Selisih Nilai</span>
                  </div>
                  <div className="font-mono text-blue-800 bg-blue-100/60 px-1.5 py-0.5 rounded text-[10px] mb-1 font-semibold">
                    Modal Baru = Nilai Bahan / (Hasil + SusutJual)
                  </div>
                  <p className="text-slate-600 text-[10px]">
                    Selisih Nilai = (Nilai Hasil + Nilai Susut Jual) - Nilai Bahan Baku.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 1: DAGING FRESH */}
            <div className="space-y-2 mb-6 p-2 rounded hover:bg-slate-50/50 transition">
              {/* Bahan */}
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px_70px_70px] items-center text-[11px]">
                <span className="font-bold text-slate-900">BAHAN</span>
                <span className="bg-[#BDD7EE] px-2 py-0.5 font-medium border border-slate-300 truncate">{dgFreshName}</span>
                <span className="text-center font-bold">:</span>
                <span
                  onClick={() => handleCellClick('E3', `=SUM(B5:B21) = ${dgFreshBahan.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                  title="Klik untuk melihat formula sel Bahan"
                >
                  {dgFreshBahan.toFixed(3)}
                </span>
                <span className="text-center font-bold">x</span>
                <span
                  onClick={() => handleCellClick('G3', `=COGS_MASTER("${dgFreshName}") = ${dgFreshCogs.toLocaleString('id-ID')}`)}
                  className="font-mono text-right hover:bg-emerald-100 hover:text-emerald-900 px-1 rounded cursor-pointer transition font-medium text-slate-900"
                  title="Klik untuk melihat formula COGS Master"
                >
                  {dgFreshCogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">=</span>
                <span
                  onClick={() => handleCellClick('I3', `=E3*G3 = ${dgFreshBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right font-semibold cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgFreshBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-right text-slate-500 font-mono text-[10px]">100.00%</span>
                <span className="text-right text-slate-500 font-mono text-[10px]">100%</span>
              </div>

              {/* Total Bahan */}
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center font-bold text-[11px] border-t border-slate-300 pt-1">
                <span></span>
                <span>TOTAL</span>
                <span></span>
                <span
                  onClick={() => handleCellClick('E4', `=E3 = ${dgFreshBahan.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgFreshBahan.toFixed(3)}
                </span>
                <span></span>
                <span></span>
                <span></span>
                <span
                  onClick={() => handleCellClick('I4', `=I3 = ${dgFreshBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgFreshBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Hasil Daging Fresh */}
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center text-[11px] pt-2">
                <span className="font-bold text-slate-900">HASIL DAGING FRESH</span>
                <span className="bg-[#BDD7EE] px-2 py-0.5 font-medium border border-slate-300 truncate">{dgFreshName}</span>
                <span className="text-center font-bold">:</span>
                <span
                  onClick={() => handleCellClick('E6', `=SUM(C5:C21) = ${dgFreshHasil.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgFreshHasil.toFixed(3)}
                </span>
                <span className="text-center font-bold">x</span>
                <span
                  onClick={() => handleCellClick('G6', `=G3 = ${dgFreshCogs.toLocaleString('id-ID')}`)}
                  className="font-mono text-right hover:bg-emerald-100 hover:text-emerald-900 px-1 rounded cursor-pointer transition font-medium text-slate-900"
                >
                  {dgFreshCogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">=</span>
                <span
                  onClick={() => handleCellClick('I6', `=E6*G6 = ${dgFreshHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right font-semibold cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgFreshHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Total Hasil */}
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center font-bold text-[11px] border-t border-slate-300 pt-1">
                <span></span>
                <span>TOTAL</span>
                <span></span>
                <span
                  onClick={() => handleCellClick('E7', `=E6 = ${dgFreshHasil.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgFreshHasil.toFixed(3)}
                </span>
                <span></span>
                <span></span>
                <span></span>
                <span
                  onClick={() => handleCellClick('I7', `=I6 = ${dgFreshHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgFreshHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Modal Banner Yellow */}
              <div className="bg-[#FFFF00] p-1.5 font-bold text-black grid grid-cols-[360px_140px_70px] items-center text-xs my-2 border border-black shadow-sm">
                <span>MODAL DG FRESH - SUSUT JUAL</span>
                <span
                  onClick={() => handleCellClick('I8', `=IF((E7+E10)>0, I4/(E7+E10), G3) = ${dgFreshModalSusutJual.toFixed(2)}`)}
                  className="font-mono text-right cursor-pointer hover:underline"
                >
                  {dgFreshModalSusutJual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  onClick={() => handleCellClick('J8', `=ABS(E10)/E4 = ${dgFreshBahan > 0 ? (Math.abs(dgFreshSusutJual) / dgFreshBahan * 100).toFixed(2) + '%' : '0.00%'}`)}
                  className="text-right font-mono text-[10px] bg-amber-300/80 px-1.5 py-0.5 rounded cursor-pointer ml-auto"
                  title="Persentase Susut Jual"
                >
                  {dgFreshBahan > 0 ? (Math.abs(dgFreshSusutJual) / dgFreshBahan * 100).toFixed(2) + '%' : '0.00%'}
                </span>
              </div>

              {/* Susut Details */}
              <div className="pl-48 space-y-1 text-[11px]">
                {/* Susut Proses */}
                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center">
                  <span>SUSUT PROSES</span>
                  <span
                    onClick={() => handleCellClick('E9', `=E7-E4 = ${-dgFreshSusutProses.toFixed(3)}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {-dgFreshSusutProses.toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I9', `=E9*G3 = ${(-dgFreshSusutProses * dgFreshCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {(-dgFreshSusutProses * dgFreshCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-right text-slate-500 font-mono text-[10px]">
                    {dgFreshBahan > 0 ? ((dgFreshSusutProses / dgFreshBahan) * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                {/* Susut Jual */}
                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center">
                  <span>SUSUT JUAL</span>
                  <span
                    onClick={() => handleCellClick('E10', `=CLOSING_RECORD("${dgFreshName}") = ${-Math.abs(dgFreshSusutJual).toFixed(3)}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {-Math.abs(dgFreshSusutJual).toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I10', `=E10*G3 = ${(-Math.abs(dgFreshSusutJual) * dgFreshCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {(-Math.abs(dgFreshSusutJual) * dgFreshCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    onClick={() => handleCellClick('J10', `=ABS(E10)/E4 = ${dgFreshBahan > 0 ? (Math.abs(dgFreshSusutJual) / dgFreshBahan * 100).toFixed(2) + '%' : '0.00%'}`)}
                    className="text-right text-amber-700 font-mono text-[10px] font-bold bg-amber-100 px-1 py-0.5 rounded cursor-pointer"
                    title="Persentase Susut Jual Relatif Bahan"
                  >
                    {dgFreshBahan > 0 ? (Math.abs(dgFreshSusutJual) / dgFreshBahan * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                {/* Total Susut */}
                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center font-bold border-t border-slate-200 pt-1">
                  <span>TOTAL SUSUT</span>
                  <span
                    onClick={() => handleCellClick('E11', `=E9+E10 = ${-dgFreshTotalSusut.toFixed(3)}`)}
                    className="font-mono text-right text-red-700 cursor-pointer hover:bg-red-100 px-1 rounded"
                  >
                    {-dgFreshTotalSusut.toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I11', `=I9+I10 = ${(-dgFreshTotalSusut * dgFreshCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-700 cursor-pointer hover:bg-red-100 px-1 rounded"
                  >
                    {(-dgFreshTotalSusut * dgFreshCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    onClick={() => handleCellClick('J11', `=((E4-(E7+E10))/E4) = ${dgFreshBahan > 0 ? ((dgFreshTotalSusut / dgFreshBahan) * 100).toFixed(2) + '%' : '0.00%'}`)}
                    className="text-right text-emerald-800 font-mono text-[10px] font-black bg-emerald-100 px-1 py-0.5 rounded cursor-pointer hover:bg-emerald-200 transition"
                    title="Formula Persentase Total Susut: =((Bahan - (Hasil + SusutJual)) / Bahan)"
                  >
                    {dgFreshBahan > 0 ? ((dgFreshTotalSusut / dgFreshBahan) * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                {/* Selisih Bahan dan Hasil */}
                <div className="grid grid-cols-[200px_90px_20px_120px] items-center font-bold text-slate-700 pt-0.5">
                  <span className="text-[10px] text-slate-600">SELISIH BAHAN DAN HASIL</span>
                  <span></span>
                  <span className="text-center">:</span>
                  <span
                    onClick={() => handleCellClick('I12', `=(I7+I10)-I4 = ${(dgFreshHasilModal - dgFreshBahanModal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-slate-100 px-1 rounded text-[10px]"
                  >
                    {(dgFreshHasilModal - dgFreshBahanModal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: DAGING PREMIUM */}
            <div className="space-y-2 mb-6 pt-4 border-t border-slate-200 p-2 rounded hover:bg-slate-50/50 transition">
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px_70px_70px] items-center text-[11px]">
                <span className="font-bold text-slate-900">BAHAN</span>
                <span className="bg-[#FCE4D6] px-2 py-0.5 font-medium border border-slate-300 truncate">{dgPremName}</span>
                <span className="text-center font-bold">:</span>
                <span
                  onClick={() => handleCellClick('E14', `=SUM(K5:K21) = ${dgPremBahan.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgPremBahan.toFixed(3)}
                </span>
                <span className="text-center font-bold">x</span>
                <span
                  onClick={() => handleCellClick('G14', `=COGS_MASTER("${dgPremName}") = ${dgPremCogs.toLocaleString('id-ID')}`)}
                  className="font-mono text-right hover:bg-emerald-100 hover:text-emerald-900 px-1 rounded cursor-pointer transition font-medium text-slate-900"
                  title="Klik untuk melihat formula COGS Master"
                >
                  {dgPremCogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">=</span>
                <span
                  onClick={() => handleCellClick('I14', `=E14*G14 = ${dgPremBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right font-semibold cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgPremBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-right text-slate-500 font-mono text-[10px]">100.00%</span>
                <span className="text-right text-slate-500 font-mono text-[10px]">100%</span>
              </div>

              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center font-bold text-[11px] border-t border-slate-300 pt-1">
                <span></span>
                <span>TOTAL</span>
                <span></span>
                <span
                  onClick={() => handleCellClick('E15', `=E14 = ${dgPremBahan.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgPremBahan.toFixed(3)}
                </span>
                <span></span>
                <span></span>
                <span></span>
                <span
                  onClick={() => handleCellClick('I15', `=I14 = ${dgPremBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgPremBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Hasil */}
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center text-[11px] pt-2">
                <span className="font-bold text-slate-900">HASIL</span>
                <span className="bg-[#FCE4D6] px-2 py-0.5 font-medium border border-slate-300 truncate">{dgPremName}</span>
                <span className="text-center font-bold">:</span>
                <span
                  onClick={() => handleCellClick('E17', `=SUM(M5:M21) = ${dgPremHasil.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgPremHasil.toFixed(3)}
                </span>
                <span className="text-center font-bold">x</span>
                <span
                  onClick={() => handleCellClick('G17', `=G14 = ${dgPremCogs.toLocaleString('id-ID')}`)}
                  className="font-mono text-right hover:bg-emerald-100 hover:text-emerald-900 px-1 rounded cursor-pointer transition font-medium text-slate-900"
                >
                  {dgPremCogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">=</span>
                <span
                  onClick={() => handleCellClick('I17', `=E17*G17 = ${dgPremHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right font-semibold cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgPremHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center font-bold text-[11px] border-t border-slate-300 pt-1">
                <span></span>
                <span>TOTAL</span>
                <span></span>
                <span
                  onClick={() => handleCellClick('E18', `=E17 = ${dgPremHasil.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgPremHasil.toFixed(3)}
                </span>
                <span></span>
                <span></span>
                <span></span>
                <span
                  onClick={() => handleCellClick('I18', `=I17 = ${dgPremHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {dgPremHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-[#FFFF00] p-1.5 font-bold text-black grid grid-cols-[360px_140px_70px] items-center text-xs my-2 border border-black shadow-sm">
                <span>MODAL DAGING PREM</span>
                <span
                  onClick={() => handleCellClick('I19', `=IF((E18+E21)>0, I15/(E18+E21), G14) = ${dgPremModalSusutJual.toFixed(2)}`)}
                  className="font-mono text-right cursor-pointer hover:underline"
                >
                  {dgPremModalSusutJual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  onClick={() => handleCellClick('J19', `=ABS(E21)/E15 = ${dgPremBahan > 0 ? (Math.abs(dgPremSusutJual) / dgPremBahan * 100).toFixed(2) + '%' : '0.00%'}`)}
                  className="text-right font-mono text-[10px] bg-amber-300/80 px-1.5 py-0.5 rounded cursor-pointer ml-auto"
                >
                  {dgPremBahan > 0 ? (Math.abs(dgPremSusutJual) / dgPremBahan * 100).toFixed(2) + '%' : '0.00%'}
                </span>
              </div>

              <div className="pl-48 space-y-1 text-[11px]">
                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center">
                  <span>SUSUT PROSES</span>
                  <span
                    onClick={() => handleCellClick('E20', `=E18-E15 = ${-dgPremSusutProses.toFixed(3)}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {-dgPremSusutProses.toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I20', `=E20*G14 = ${(-dgPremSusutProses * dgPremCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {(-dgPremSusutProses * dgPremCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-right text-slate-500 font-mono text-[10px]">
                    {dgPremBahan > 0 ? ((dgPremSusutProses / dgPremBahan) * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center">
                  <span>SUSUT JUAL</span>
                  <span
                    onClick={() => handleCellClick('E21', `=CLOSING_RECORD("${dgPremName}") = ${-Math.abs(dgPremSusutJual).toFixed(3)}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {-Math.abs(dgPremSusutJual).toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I21', `=E21*G14 = ${(-Math.abs(dgPremSusutJual) * dgPremCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {(-Math.abs(dgPremSusutJual) * dgPremCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    onClick={() => handleCellClick('J21', `=ABS(E21)/E15 = ${dgPremBahan > 0 ? (Math.abs(dgPremSusutJual) / dgPremBahan * 100).toFixed(2) + '%' : '0.00%'}`)}
                    className="text-right text-amber-700 font-mono text-[10px] font-bold bg-amber-100 px-1 py-0.5 rounded cursor-pointer"
                  >
                    {dgPremBahan > 0 ? (Math.abs(dgPremSusutJual) / dgPremBahan * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center font-bold border-t border-slate-200 pt-1">
                  <span>TOTAL SUSUT</span>
                  <span
                    onClick={() => handleCellClick('E22', `=E20+E21 = ${-dgPremTotalSusut.toFixed(3)}`)}
                    className="font-mono text-right text-red-700 cursor-pointer hover:bg-red-100 px-1 rounded"
                  >
                    {-dgPremTotalSusut.toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I22', `=I20+I21 = ${(-dgPremTotalSusut * dgPremCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-700 cursor-pointer hover:bg-red-100 px-1 rounded"
                  >
                    {(-dgPremTotalSusut * dgPremCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    onClick={() => handleCellClick('J22', `=((E15-(E18+E21))/E15) = ${dgPremBahan > 0 ? ((dgPremTotalSusut / dgPremBahan) * 100).toFixed(2) + '%' : '0.00%'}`)}
                    className="text-right text-emerald-800 font-mono text-[10px] font-black bg-emerald-100 px-1 py-0.5 rounded cursor-pointer hover:bg-emerald-200 transition"
                    title="Formula Persentase Total Susut: =((Bahan - (Hasil + SusutJual)) / Bahan)"
                  >
                    {dgPremBahan > 0 ? ((dgPremTotalSusut / dgPremBahan) * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                {/* Selisih Bahan dan Hasil */}
                <div className="grid grid-cols-[200px_90px_20px_120px] items-center font-bold text-slate-700 pt-0.5">
                  <span className="text-[10px] text-slate-600">SELISIH BAHAN DAN HASIL</span>
                  <span></span>
                  <span className="text-center">:</span>
                  <span
                    onClick={() => handleCellClick('I23', `=(I18+I21)-I15 = ${(dgPremHasilModal - dgPremBahanModal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-slate-100 px-1 rounded text-[10px]"
                  >
                    {(dgPremHasilModal - dgPremBahanModal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 3: RAWON FRESH */}
            <div className="space-y-2 mb-6 pt-4 border-t border-slate-200 p-2 rounded hover:bg-slate-50/50 transition">
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px_70px_70px] items-center text-[11px]">
                <span className="font-bold text-slate-900">BAHAN</span>
                <span className="bg-[#FFF2CC] px-2 py-0.5 font-medium border border-slate-300 truncate">{rawonName}</span>
                <span className="text-center font-bold">:</span>
                <span
                  onClick={() => handleCellClick('E25', `=SUM(S5:S21) = ${rawonBahan.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {rawonBahan.toFixed(3)}
                </span>
                <span className="text-center font-bold">x</span>
                <span
                  onClick={() => handleCellClick('G25', `=COGS_MASTER("${rawonName}") = ${rawonCogs.toLocaleString('id-ID')}`)}
                  className="font-mono text-right hover:bg-emerald-100 hover:text-emerald-900 px-1 rounded cursor-pointer transition font-medium text-slate-900"
                  title="Klik untuk melihat formula COGS Master"
                >
                  {rawonCogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">=</span>
                <span
                  onClick={() => handleCellClick('I25', `=E25*G25 = ${rawonBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right font-semibold cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {rawonBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-right text-slate-500 font-mono text-[10px]">100.00%</span>
                <span className="text-right text-slate-500 font-mono text-[10px]">100%</span>
              </div>

              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center font-bold text-[11px] border-t border-slate-300 pt-1">
                <span></span>
                <span>TOTAL</span>
                <span></span>
                <span
                  onClick={() => handleCellClick('E26', `=E25 = ${rawonBahan.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {rawonBahan.toFixed(3)}
                </span>
                <span></span>
                <span></span>
                <span></span>
                <span
                  onClick={() => handleCellClick('I26', `=I25 = ${rawonBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {rawonBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Hasil Rawon Fresh */}
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center text-[11px] pt-2">
                <span className="font-bold text-slate-900">HASIL RAWON FRESH</span>
                <span className="bg-[#FFF2CC] px-2 py-0.5 font-medium border border-slate-300 truncate">{rawonName}</span>
                <span className="text-center font-bold">:</span>
                <span
                  onClick={() => handleCellClick('E28', `=SUM(U5:U21) = ${rawonHasil.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {rawonHasil.toFixed(3)}
                </span>
                <span className="text-center font-bold">x</span>
                <span
                  onClick={() => handleCellClick('G28', `=G25 = ${rawonCogs.toLocaleString('id-ID')}`)}
                  className="font-mono text-right hover:bg-emerald-100 hover:text-emerald-900 px-1 rounded cursor-pointer transition font-medium text-slate-900"
                >
                  {rawonCogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">=</span>
                <span
                  onClick={() => handleCellClick('I28', `=E28*G28 = ${rawonHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right font-semibold cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {rawonHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center font-bold text-[11px] border-t border-slate-300 pt-1">
                <span></span>
                <span>TOTAL</span>
                <span></span>
                <span
                  onClick={() => handleCellClick('E29', `=E28 = ${rawonHasil.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {rawonHasil.toFixed(3)}
                </span>
                <span></span>
                <span></span>
                <span></span>
                <span
                  onClick={() => handleCellClick('I29', `=I28 = ${rawonHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {rawonHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-[#FFFF00] p-1.5 font-bold text-black grid grid-cols-[360px_140px_70px] items-center text-xs my-2 border border-black shadow-sm">
                <span>MODAL RAWON FRESH -SUSUT JUAL</span>
                <span
                  onClick={() => handleCellClick('I30', `=IF((E29+E32)>0, I26/(E29+E32), G25) = ${rawonModalSusutJual.toFixed(2)}`)}
                  className="font-mono text-right cursor-pointer hover:underline"
                >
                  {rawonModalSusutJual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  onClick={() => handleCellClick('J30', `=ABS(E32)/E26 = ${rawonBahan > 0 ? (Math.abs(rawonSusutJual) / rawonBahan * 100).toFixed(2) + '%' : '0.00%'}`)}
                  className="text-right font-mono text-[10px] bg-amber-300/80 px-1.5 py-0.5 rounded cursor-pointer ml-auto"
                >
                  {rawonBahan > 0 ? (Math.abs(rawonSusutJual) / rawonBahan * 100).toFixed(2) + '%' : '0.00%'}
                </span>
              </div>

              <div className="pl-48 space-y-1 text-[11px]">
                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center">
                  <span>SUSUT PROSES</span>
                  <span
                    onClick={() => handleCellClick('E31', `=E29-E26 = ${-rawonSusutProses.toFixed(3)}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {-rawonSusutProses.toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I31', `=E31*G25 = ${(-rawonSusutProses * rawonCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {(-rawonSusutProses * rawonCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-right text-slate-500 font-mono text-[10px]">
                    {rawonBahan > 0 ? ((rawonSusutProses / rawonBahan) * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center">
                  <span>SUSUT JUAL</span>
                  <span
                    onClick={() => handleCellClick('E32', `=CLOSING_RECORD("${rawonName}") = ${-Math.abs(rawonSusutJual).toFixed(3)}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {-Math.abs(rawonSusutJual).toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I32', `=E32*G25 = ${(-Math.abs(rawonSusutJual) * rawonCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {(-Math.abs(rawonSusutJual) * rawonCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    onClick={() => handleCellClick('J32', `=ABS(E32)/E26 = ${rawonBahan > 0 ? (Math.abs(rawonSusutJual) / rawonBahan * 100).toFixed(2) + '%' : '0.00%'}`)}
                    className="text-right text-amber-700 font-mono text-[10px] font-bold bg-amber-100 px-1 py-0.5 rounded cursor-pointer"
                  >
                    {rawonBahan > 0 ? (Math.abs(rawonSusutJual) / rawonBahan * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center font-bold border-t border-slate-200 pt-1">
                  <span>TOTAL SUSUT</span>
                  <span
                    onClick={() => handleCellClick('E33', `=E31+E32 = ${-rawonTotalSusut.toFixed(3)}`)}
                    className="font-mono text-right text-red-700 cursor-pointer hover:bg-red-100 px-1 rounded"
                  >
                    {-rawonTotalSusut.toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I33', `=I31+I32 = ${(-rawonTotalSusut * rawonCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-700 cursor-pointer hover:bg-red-100 px-1 rounded"
                  >
                    {(-rawonTotalSusut * rawonCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    onClick={() => handleCellClick('J33', `=((E26-(E29+E32))/E26) = ${rawonBahan > 0 ? ((rawonTotalSusut / rawonBahan) * 100).toFixed(2) + '%' : '0.00%'}`)}
                    className="text-right text-emerald-800 font-mono text-[10px] font-black bg-emerald-100 px-1 py-0.5 rounded cursor-pointer hover:bg-emerald-200 transition"
                    title="Formula Persentase Total Susut: =((Bahan - (Hasil + SusutJual)) / Bahan)"
                  >
                    {rawonBahan > 0 ? ((rawonTotalSusut / rawonBahan) * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                {/* Selisih Bahan dan Hasil */}
                <div className="grid grid-cols-[200px_90px_20px_120px] items-center font-bold text-slate-700 pt-0.5">
                  <span className="text-[10px] text-slate-600">SELISIH BAHAN DAN HASIL</span>
                  <span></span>
                  <span className="text-center">:</span>
                  <span
                    onClick={() => handleCellClick('I34', `=(I29+I32)-I26 = ${(rawonHasilModal - rawonBahanModal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-slate-100 px-1 rounded text-[10px]"
                  >
                    {(rawonHasilModal - rawonBahanModal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 4: DAGING FRESH EKONOMIS (FQ 60 / SHANK) */}
            <div className="space-y-2 mb-6 pt-4 border-t border-slate-200 p-2 rounded hover:bg-slate-50/50 transition">
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px_70px_70px] items-center text-[11px]">
                <span className="font-bold text-slate-900">BAHAN</span>
                <span className="bg-[#C6EFCE] px-2 py-0.5 font-medium border border-slate-300 truncate">{shankName}</span>
                <span className="text-center font-bold">:</span>
                <span
                  onClick={() => handleCellClick('E36', `=SUM(Y5:Y21) = ${shankBahan.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {shankBahan.toFixed(3)}
                </span>
                <span className="text-center font-bold">x</span>
                <span
                  onClick={() => handleCellClick('G36', `=COGS_MASTER("${shankName}") = ${shankCogs.toLocaleString('id-ID')}`)}
                  className="font-mono text-right hover:bg-emerald-100 hover:text-emerald-900 px-1 rounded cursor-pointer transition font-medium text-slate-900"
                  title="Klik untuk melihat formula COGS Master"
                >
                  {shankCogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">=</span>
                <span
                  onClick={() => handleCellClick('I36', `=E36*G36 = ${shankBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right font-semibold cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {shankBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-right text-slate-500 font-mono text-[10px]">100.00%</span>
                <span className="text-right text-slate-500 font-mono text-[10px]">100%</span>
              </div>

              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center font-bold text-[11px] border-t border-slate-300 pt-1">
                <span></span>
                <span>TOTAL</span>
                <span></span>
                <span
                  onClick={() => handleCellClick('E37', `=E36 = ${shankBahan.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {shankBahan.toFixed(3)}
                </span>
                <span></span>
                <span></span>
                <span></span>
                <span
                  onClick={() => handleCellClick('I37', `=I36 = ${shankBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {shankBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Hasil */}
              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center text-[11px] pt-2">
                <span className="font-bold text-slate-900">HASIL</span>
                <span className="bg-[#C6EFCE] px-2 py-0.5 font-medium border border-slate-300 truncate">{shankName}</span>
                <span className="text-center font-bold">:</span>
                <span
                  onClick={() => handleCellClick('E39', `=SUM(AA5:AA21) = ${shankHasil.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {shankHasil.toFixed(3)}
                </span>
                <span className="text-center font-bold">x</span>
                <span
                  onClick={() => handleCellClick('G39', `=G36 = ${shankCogs.toLocaleString('id-ID')}`)}
                  className="font-mono text-right hover:bg-emerald-100 hover:text-emerald-900 px-1 rounded cursor-pointer transition font-medium text-slate-900"
                >
                  {shankCogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-center font-bold">=</span>
                <span
                  onClick={() => handleCellClick('I39', `=E39*G39 = ${shankHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right font-semibold cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {shankHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-[160px_180px_20px_90px_20px_100px_20px_120px] items-center font-bold text-[11px] border-t border-slate-300 pt-1">
                <span></span>
                <span>TOTAL</span>
                <span></span>
                <span
                  onClick={() => handleCellClick('E40', `=E39 = ${shankHasil.toFixed(3)}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {shankHasil.toFixed(3)}
                </span>
                <span></span>
                <span></span>
                <span></span>
                <span
                  onClick={() => handleCellClick('I40', `=I39 = ${shankHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  className="font-mono text-right cursor-pointer hover:bg-emerald-100 px-1 rounded transition"
                >
                  {shankHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-[#FFFF00] p-1.5 font-bold text-black grid grid-cols-[360px_140px_70px] items-center text-xs my-2 border border-black shadow-sm">
                <span>MODAL DAGING FRESH EKONOMIS-SUSUT JUAL</span>
                <span
                  onClick={() => handleCellClick('I41', `=IF((E40+E43)>0, I37/(E40+E43), G36) = ${shankModalSusutJual.toFixed(2)}`)}
                  className="font-mono text-right cursor-pointer hover:underline"
                >
                  {shankModalSusutJual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  onClick={() => handleCellClick('J41', `=ABS(E43)/E37 = ${shankBahan > 0 ? (Math.abs(shankSusutJual) / shankBahan * 100).toFixed(2) + '%' : '0.00%'}`)}
                  className="text-right font-mono text-[10px] bg-amber-300/80 px-1.5 py-0.5 rounded cursor-pointer ml-auto"
                >
                  {shankBahan > 0 ? (Math.abs(shankSusutJual) / shankBahan * 100).toFixed(2) + '%' : '0.00%'}
                </span>
              </div>

              <div className="pl-48 space-y-1 text-[11px]">
                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center">
                  <span>SUSUT PROSES</span>
                  <span
                    onClick={() => handleCellClick('E42', `=E40-E37 = ${-shankSusutProses.toFixed(3)}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {-shankSusutProses.toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I42', `=E42*G36 = ${(-shankSusutProses * shankCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {(-shankSusutProses * shankCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-right text-slate-500 font-mono text-[10px]">
                    {shankBahan > 0 ? ((shankSusutProses / shankBahan) * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center">
                  <span>SUSUT JUAL</span>
                  <span
                    onClick={() => handleCellClick('E43', `=CLOSING_RECORD("${shankName}") = ${-Math.abs(shankSusutJual).toFixed(3)}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {-Math.abs(shankSusutJual).toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I43', `=E43*G36 = ${(-Math.abs(shankSusutJual) * shankCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-red-50 px-1 rounded"
                  >
                    {(-Math.abs(shankSusutJual) * shankCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    onClick={() => handleCellClick('J43', `=ABS(E43)/E37 = ${shankBahan > 0 ? (Math.abs(shankSusutJual) / shankBahan * 100).toFixed(2) + '%' : '0.00%'}`)}
                    className="text-right text-amber-700 font-mono text-[10px] font-bold bg-amber-100 px-1 py-0.5 rounded cursor-pointer"
                  >
                    {shankBahan > 0 ? (Math.abs(shankSusutJual) / shankBahan * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                <div className="grid grid-cols-[200px_90px_20px_120px_70px] items-center font-bold border-t border-slate-200 pt-1">
                  <span>TOTAL SUSUT</span>
                  <span
                    onClick={() => handleCellClick('E44', `=E42+E43 = ${-shankTotalSusut.toFixed(3)}`)}
                    className="font-mono text-right text-red-700 cursor-pointer hover:bg-red-100 px-1 rounded"
                  >
                    {-shankTotalSusut.toFixed(3)}
                  </span>
                  <span className="text-center font-bold">:</span>
                  <span
                    onClick={() => handleCellClick('I44', `=I42+I43 = ${(-shankTotalSusut * shankCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-700 cursor-pointer hover:bg-red-100 px-1 rounded"
                  >
                    {(-shankTotalSusut * shankCogs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    onClick={() => handleCellClick('J44', `=((E37-(E40+E43))/E37) = ${shankBahan > 0 ? ((shankTotalSusut / shankBahan) * 100).toFixed(2) + '%' : '0.00%'}`)}
                    className="text-right text-emerald-800 font-mono text-[10px] font-black bg-emerald-100 px-1 py-0.5 rounded cursor-pointer hover:bg-emerald-200 transition"
                    title="Formula Persentase Total Susut: =((Bahan - (Hasil + SusutJual)) / Bahan)"
                  >
                    {shankBahan > 0 ? ((shankTotalSusut / shankBahan) * 100).toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>

                {/* Selisih Bahan dan Hasil */}
                <div className="grid grid-cols-[200px_90px_20px_120px] items-center font-bold text-slate-700 pt-0.5">
                  <span className="text-[10px] text-slate-600">SELISIH BAHAN DAN HASIL</span>
                  <span></span>
                  <span className="text-center">:</span>
                  <span
                    onClick={() => handleCellClick('I45', `=(I40+I43)-I37 = ${(shankHasilModal - shankBahanModal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    className="font-mono text-right text-red-600 cursor-pointer hover:bg-slate-100 px-1 rounded text-[10px]"
                  >
                    {(shankHasilModal - shankBahanModal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* GRAND SUMMARY AT BOTTOM */}
            <div className="pt-6 border-t-2 border-black space-y-1 text-xs">
              <div className="grid grid-cols-[260px_90px_20px_130px] items-center font-semibold">
                <span>TOTAL SUSUT PRODUKSI</span>
                <span className="font-mono text-right">{totalGrandSusutProses > 0 ? `-${totalGrandSusutProses.toFixed(3)}` : '0.000'}</span>
                <span className="text-center">:</span>
                <span className="font-mono text-right text-red-600">{grandSusutProsesVal > 0 ? `-${grandSusutProsesVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '0'}</span>
              </div>
              <div className="grid grid-cols-[260px_90px_20px_130px] items-center font-semibold">
                <span>TOTAL SUSUT JUAL</span>
                <span className="font-mono text-right">{totalGrandSusutJual > 0 ? `-${totalGrandSusutJual.toFixed(3)}` : '0.000'}</span>
                <span className="text-center">:</span>
                <span className="font-mono text-right text-red-600">{grandSusutJualVal > 0 ? `-${grandSusutJualVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '0'}</span>
              </div>
              <div className="grid grid-cols-[260px_90px_20px_130px] items-center font-bold">
                <span></span>
                <span className="font-mono text-right text-red-700">{totalGrandSusut > 0 ? `-${totalGrandSusut.toFixed(3)}` : '0.000'}</span>
                <span></span>
                <span className="font-mono text-right text-red-700">{(grandSusutProsesVal + grandSusutJualVal) > 0 ? `-${(grandSusutProsesVal + grandSusutJualVal).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '0'}</span>
              </div>

              <div className="pt-4"></div>

              <div className="grid grid-cols-[260px_90px_20px_130px] items-center font-bold">
                <span>TOTAL BAHAN</span>
                <span className="font-mono text-right">{totalGrandBahan.toFixed(3)}</span>
                <span></span>
                <span className="font-mono text-right">{totalGrandBahanModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="grid grid-cols-[260px_90px_20px_130px] items-center font-bold">
                <span>TOTAL HASIL</span>
                <span className="font-mono text-right">{totalGrandHasil.toFixed(3)}</span>
                <span></span>
                <span className="font-mono text-right">{totalGrandHasilModal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="grid grid-cols-[260px_90px_20px_130px_60px] items-center font-black text-red-600">
                <span>SELISIH</span>
                <span className="font-mono text-right">{totalGrandSusutProses > 0 ? `-${totalGrandSusutProses.toFixed(3)}` : '0.000'}</span>
                <span></span>
                <span className="font-mono text-right">{grandSelisihVal !== 0 ? `-${Math.abs(grandSelisihVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '0.00'}</span>
                <span className="text-right text-slate-700 font-bold">{grandSelisihPct.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Excel Bottom Workbook Sheet Tabs Bar */}
      <div className="bg-[#e6e6e6] border-t border-slate-300 px-3 py-1 flex items-center justify-between text-xs select-none">
        {/* Sheet Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSheet('LAP.DAGING')}
            className={`px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 transition border-t-2 ${
              activeSheet === 'LAP.DAGING'
                ? 'bg-white text-[#107c41] border-[#107c41] shadow-sm'
                : 'bg-[#e6e6e6] text-slate-600 border-transparent hover:bg-slate-200'
            }`}
          >
            LAP.DAGING
          </button>

          <button
            onClick={() => setActiveSheet('PROSES')}
            className={`px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 transition border-t-2 ${
              activeSheet === 'PROSES'
                ? 'bg-white text-[#107c41] border-[#107c41] shadow-sm'
                : 'bg-[#e6e6e6] text-slate-600 border-transparent hover:bg-slate-200'
            }`}
          >
            PROSES
          </button>

          <button
            onClick={() => setActiveSheet('SALES DAGING')}
            className={`px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 transition border-t-2 ${
              activeSheet === 'SALES DAGING'
                ? 'bg-white text-[#107c41] border-[#107c41] shadow-sm'
                : 'bg-[#e6e6e6] text-slate-600 border-transparent hover:bg-slate-200'
            }`}
          >
            SALES DAGING
          </button>
        </div>

        {/* Excel Status Bar & Zoom Slider */}
        <div className="flex items-center gap-4 text-slate-500 text-[11px]">
          <span className="font-semibold text-slate-600">Ready</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
              className="px-1.5 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-bold"
              title="Zoom out"
            >
              -
            </button>
            <span className="w-10 text-center font-mono font-bold text-slate-700">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="px-1.5 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-bold"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Quick Modal for MD user to update COGS prices */}
      {showCogsQuickModal && isMdUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Atur Master COGS (Otoritas MD)</h3>
                  <p className="text-xs text-slate-500">Ubah harga acuan pokok per Kg untuk perhitungan finansial toko.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCogsQuickModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-2 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Perubahan harga ini akan otomatis tersinkronisasi dan mengupdate kalkulasi seluruh laporan toko.</span>
              </div>

              <div className="space-y-2.5">
                {[
                  { cat: 'DAGING FRESH', name: dgFreshName, price: dgFreshCogs },
                  { cat: 'DAGING PREMIUM', name: dgPremName, price: dgPremCogs },
                  { cat: 'RAWON', name: rawonName, price: rawonCogs },
                  { cat: 'SHANKLE', name: shankName, price: shankCogs }
                ].map((item) => (
                  <div key={item.cat} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{item.cat}</span>
                      <span className="text-xs font-bold text-slate-900">{item.name}</span>
                    </div>

                    {editingCatCogs?.category === item.cat ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={editPriceInput}
                          onChange={(e) => setEditPriceInput(e.target.value)}
                          placeholder="Rp / Kg"
                          className="w-28 text-xs font-mono font-bold p-1.5 border border-emerald-400 rounded bg-white focus:outline-emerald-600"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            const val = parseFloat(editPriceInput);
                            if (val > 0) handleSaveQuickCogs(item.cat, item.name, val);
                          }}
                          className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold cursor-pointer"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => {
                            setEditingCatCogs(null);
                            setEditPriceInput('');
                          }}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-100/60 px-2 py-1 rounded">
                          Rp {item.price.toLocaleString('id-ID')}/Kg
                        </span>
                        <button
                          onClick={() => {
                            setEditingCatCogs({ category: item.cat, name: item.name, price: item.price });
                            setEditPriceInput(item.price.toString());
                          }}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded text-xs font-bold transition cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowCogsQuickModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
