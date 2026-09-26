import React, { useState } from 'react';
import {
  ClosingPlanRecord,
  GrnRecord,
  StockAdjustment,
  Store,
  ReportCategory,
} from '../types';
import {
  CatalogProduct,
  SOSIS_KENTANG_CATALOG,
  FILLET_DORI_CATALOG,
  PARTING_AYAM_CATALOG,
} from '../utils/productCatalog';
import { getPreviousDateStr, getHMinus1ClosingStock } from '../utils/dateUtils';
import { isMatchPlan } from '../utils/storeHelper';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Package,
  Eye,
  Info,
  TrendingUp,
  Percent,
  Layers,
  Scale,
  Sparkles,
  Edit3,
  BarChart3,
  Table as TableIcon,
} from 'lucide-react';
import { exportSosisKentangDoriExcel, exportPartingAyamExcel } from '../utils/excelExport';

interface NonMeatReportTableProps {
  category: ReportCategory;
  subCategory?: 'SOSIS & KENTANG' | 'FILLET DORI' | 'PARTING AYAM' | 'ALL';
  currentStore: Store;
  selectedDate: string; // YYYY-MM-DD
  closingRecords: ClosingPlanRecord[];
  grnRecords: GrnRecord[];
  adjustments: StockAdjustment[];
  onOpenClosingModal?: (product: CatalogProduct, existingRec?: ClosingPlanRecord) => void;
  onViewPhoto?: (photoUrl: string, caption?: string) => void;
  onExportExcel?: () => void;
  readOnly?: boolean;
}

export default function NonMeatReportTable({
  category,
  subCategory = 'ALL',
  currentStore,
  selectedDate,
  closingRecords,
  grnRecords,
  adjustments,
  onOpenClosingModal,
  onViewPhoto,
  readOnly = false,
}: NonMeatReportTableProps) {
  // Parting Ayam view mode: 'YIELD_SUSUT_GP' (Image 3 & 4) vs 'STOCK_SALES' (Image 2)
  const [partingViewMode, setPartingViewMode] = useState<'YIELD_SUSUT_GP' | 'STOCK_SALES'>('YIELD_SUSUT_GP');

  const prevDate = getPreviousDateStr(selectedDate);
  const formatDateLabel = (d: string) => {
    try {
      const parts = d.split('-');
      if (parts.length === 3) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${parseInt(parts[2], 10)}-${monthNames[parseInt(parts[1], 10) - 1]}`;
      }
    } catch {}
    return d;
  };

  const prevDateLabel = formatDateLabel(prevDate);
  const curDateLabel = formatDateLabel(selectedDate);

  const handleExportExcel = () => {
    if (category === 'PARTING_AYAM') {
      exportPartingAyamExcel(currentStore, selectedDate, closingRecords, grnRecords, adjustments);
    } else {
      exportSosisKentangDoriExcel(currentStore, selectedDate, closingRecords, grnRecords, adjustments);
    }
  };

  // Format IDR Currency
  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  // -------------------------------------------------------------
  // PARTING AYAM SPECIFIC CALCULATIONS & VIEW (Images 2, 3, 4, 5, 6)
  // -------------------------------------------------------------
  if (category === 'PARTING_AYAM') {
    // Calculate full parting dataset
    let sumTally = 0;
    let sumBruto = 0;
    let sumBeratSusut = 0;
    let sumNetto = 0;
    let sumSusutReal = 0;
    let sumValueReal = 0;
    let sumValueProcess = 0;
    let sumOpening = 0;
    let sumAdjIn = 0;
    let sumAdjOut = 0;
    let sumGrn = 0;
    let sumTotalReal = 0;
    let sumSales = 0;
    let sumStokSistem = 0;
    let sumStokReal = 0;
    let sumSusutRetur = 0;

    const partingRows = PARTING_AYAM_CATALOG.map((prod, idx) => {
      const closingRec = closingRecords.find(
        (r) =>
          (r.date || '').split('T')[0] === selectedDate &&
          (isMatchPlan(r.planName, prod.name) || (prod.itemCode && r.itemCode === prod.itemCode))
      );

      // Opening Stock H-1
      const h1Stock = getHMinus1ClosingStock(closingRecords, currentStore, prod.name, selectedDate);
      const openingStock =
        typeof closingRec?.openingStockKg === 'number' && closingRec.openingStockKg > 0
          ? closingRec.openingStockKg
          : typeof h1Stock === 'number'
          ? h1Stock
          : 0;

      // GRN
      const productGrns = grnRecords.filter(
        (g) =>
          (g.date || '').split('T')[0] === selectedDate &&
          (isMatchPlan(g.productName, prod.name) || (prod.itemCode && g.itemCode === prod.itemCode))
      );
      const grnKg = productGrns.reduce((sum, g) => sum + (g.weightKg || 0), 0) || (closingRec?.grnKg || 0);

      // Adjustments
      const productAdjs = adjustments.filter(
        (a) =>
          (a.date || '').split('T')[0] === selectedDate &&
          (isMatchPlan(a.planName, prod.name) || (prod.itemCode && a.itemCode === prod.itemCode))
      );
      const adjIn = productAdjs.filter((a) => a.type === 'IN').reduce((sum, a) => sum + (a.weightKg || 0), 0);
      const adjOut = productAdjs.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + (a.weightKg || 0), 0);
      const netAdj = adjIn - adjOut;

      const totalReal = openingStock + netAdj + grnKg;
      const salesKg = closingRec?.salesKg || 0;
      const stockBySistem = Math.max(0, totalReal - salesKg);
      const isClosed = Boolean(closingRec && typeof closingRec.actualClosingStockKg === 'number');
      const stockReal = isClosed ? closingRec!.actualClosingStockKg : 0;
      const susutRetur = isClosed ? Math.max(0, stockBySistem - stockReal) : 0;

      // ---------------- USER DEFINED FORMULAS (From prompt) ----------------
      const latestGrn = productGrns[0];

      // Tally
      const tally =
        typeof closingRec?.tallyKg === 'number' && closingRec.tallyKg > 0
          ? closingRec.tallyKg
          : typeof latestGrn?.tallyKg === 'number' && latestGrn.tallyKg > 0
          ? latestGrn.tallyKg
          : grnKg > 0
          ? grnKg
          : totalReal > 0
          ? totalReal
          : isClosed
          ? stockReal
          : 0;

      // Bruto
      const bruto =
        typeof closingRec?.brutoKg === 'number' && closingRec.brutoKg > 0
          ? closingRec.brutoKg
          : typeof latestGrn?.brutoKg === 'number' && latestGrn.brutoKg > 0
          ? latestGrn.brutoKg
          : tally;

      // Netto
      const netto =
        typeof closingRec?.nettoKg === 'number' && closingRec.nettoKg > 0
          ? closingRec.nettoKg
          : typeof latestGrn?.nettoKg === 'number' && latestGrn.nettoKg > 0
          ? latestGrn.nettoKg
          : grnKg > 0
          ? grnKg
          : isClosed && stockReal > 0
          ? stockReal
          : 0;

      // 1. berat susut (Susut Beli) didapat dari tally di ambil netto
      const beratSusut = tally > 0 && netto > 0 ? Math.max(0, tally - netto) : 0;

      // 2. cost didapat dari data cogs
      const cost = closingRec?.costPerKg || prod.cogsPerKg || 0;

      // 3. value real didapat dari tally di kali cost
      const valueReal = tally > 0 ? tally * cost : 0;

      // 4. value process netto di kali cost
      const valueProcess = netto > 0 ? netto * cost : 0;

      // 5. cost real didapat dari value real dibagi netto
      const costReal = netto > 0 && valueReal > 0 ? valueReal / netto : 0;

      // 6. persentase susut didapat dari ((tally - netto)/tally)
      const persentaseSusut = tally > 0 && netto > 0 ? ((tally - netto) / tally) * 100 : 0;

      // 7. susut real didapat dari bruto diambil netto
      const susutReal = bruto > 0 && netto > 0 ? Math.max(0, bruto - netto) : 0;

      // 8. sale didapat dari lampiran harga sales
      const sale = closingRec?.sellingPricePerKg || prod.sellingPricePerKg || 0;

      // 9. GP didapatkan dari(((sale-cost real)/sale)*100%)
      const gpPercent = sale > 0 && costReal > 0 ? ((sale - costReal) / sale) * 100 : 0;

      // Accumulations
      sumTally += tally;
      sumBruto += bruto;
      sumBeratSusut += beratSusut;
      sumNetto += netto;
      sumSusutReal += susutReal;
      sumValueReal += valueReal;
      sumValueProcess += valueProcess;

      sumOpening += openingStock;
      sumAdjIn += adjIn;
      sumAdjOut += adjOut;
      sumGrn += grnKg;
      sumTotalReal += totalReal;
      sumSales += salesKg;
      sumStokSistem += stockBySistem;
      sumStokReal += stockReal;
      sumSusutRetur += susutRetur;

      return {
        prod,
        idx,
        closingRec,
        isClosed,
        tally,
        bruto,
        beratSusut,
        netto,
        cost,
        valueReal,
        valueProcess,
        costReal,
        persentaseSusut,
        susutReal,
        sale,
        gpPercent,
        openingStock,
        adjIn,
        adjOut,
        grnKg,
        totalReal,
        salesKg,
        stockBySistem,
        stockReal,
        susutRetur,
      };
    });

    const avgSusutPct = sumTally > 0 ? (sumBeratSusut / sumTally) * 100 : 0;
    const avgCostReal = sumNetto > 0 ? sumValueReal / sumNetto : 0;
    const totalPotentialSales = partingRows.reduce((s, r) => s + r.netto * r.sale, 0);
    const avgGpPercent =
      totalPotentialSales > 0 ? ((totalPotentialSales - sumValueReal) / totalPotentialSales) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-2xl border border-slate-700 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Laporan Ayam Parting Fresh
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Cabang: <strong className="text-white">{currentStore.name}</strong>
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Tanggal: <strong className="text-white">{selectedDate}</strong>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
                <span>🍗</span>
                <span>Report Chicken Parting Fresh & Yield Analysis</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Menghitung otomatis <strong>Berat Susut</strong> (Tally - Netto), <strong>Value Real & Process</strong>, <strong>Cost Real</strong>, <strong>% Susut</strong>, <strong>Susut Real</strong>, dan <strong>Margin GP</strong> sesuai master COGS dan harga jual.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer border border-emerald-400/30"
              >
                <Download className="w-4 h-4" />
                <span>Download Report Excel (3 Sheet)</span>
              </button>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPartingViewMode('YIELD_SUSUT_GP')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                partingViewMode === 'YIELD_SUSUT_GP'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Report Parting Fresh (Yield, Susut & GP) - Format Foto 3 & 4</span>
            </button>

            <button
              type="button"
              onClick={() => setPartingViewMode('STOCK_SALES')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                partingViewMode === 'STOCK_SALES'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Laporan Stock & Penjualan (Stock Akhir & Susut Retur) - Format Foto 2</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Tally</span>
            <div className="text-base font-black text-slate-900 mt-0.5 font-mono">
              {sumTally.toFixed(2)} <span className="text-xs font-normal text-slate-500">Kg</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Netto</span>
            <div className="text-base font-black text-emerald-700 mt-0.5 font-mono">
              {sumNetto.toFixed(2)} <span className="text-xs font-normal text-slate-500">Kg</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/30 shadow-xs">
            <span className="text-[10px] font-bold text-rose-700 block uppercase">Susut Beli</span>
            <div className="text-base font-black text-rose-700 mt-0.5 font-mono">
              {sumBeratSusut.toFixed(2)} <span className="text-xs font-normal text-rose-500">Kg</span>
            </div>
            <span className="text-[10px] font-semibold text-rose-600 block mt-0.5">Tally - Netto ({avgSusutPct.toFixed(2)}%)</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs">
            <span className="text-[10px] font-bold text-amber-800 block uppercase">Susut Jual</span>
            <div className="text-base font-black text-amber-700 mt-0.5 font-mono">
              {sumSusutRetur.toFixed(2)} <span className="text-xs font-normal text-amber-600">Kg</span>
            </div>
            <span className="text-[10px] font-semibold text-amber-600 block mt-0.5">Sistem - Fisik Closing</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Value Real</span>
            <div className="text-xs font-black text-slate-900 mt-1 font-mono truncate" title={formatRp(sumValueReal)}>
              {formatRp(sumValueReal)}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Value Process</span>
            <div className="text-xs font-black text-emerald-700 mt-1 font-mono truncate" title={formatRp(sumValueProcess)}>
              {formatRp(sumValueProcess)}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Cost Real Avg</span>
            <div className="text-xs font-black text-blue-900 mt-1 font-mono truncate">
              {avgCostReal > 0 ? `Rp ${Math.round(avgCostReal).toLocaleString('id-ID')}` : '-'}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Rata-rata GP</span>
            <div className={`text-base font-black mt-0.5 font-mono ${avgGpPercent < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {avgGpPercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* VIEW 1: YIELD, SUSUT & GP TABLE (PERSIS FOTO 3 & 4) */}
        {partingViewMode === 'YIELD_SUSUT_GP' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
            {/* Banner Header */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                  REPORT CHICKEN PARTING FRESH &bull; TDN {currentStore.name.replace(/^TDN\s*/i, '').toUpperCase()}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
                14 Kategori Parting Ayam
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  {/* Master Header Row 1 */}
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-center divide-x divide-slate-300">
                    <th rowSpan={2} className="py-2.5 px-2 w-10 bg-slate-200">TDN</th>
                    <th rowSpan={2} className="py-2.5 px-3 min-w-[200px] text-left bg-slate-200 text-red-700">BAHAN</th>
                    <th colSpan={5} className="py-1.5 px-2 bg-blue-50 text-red-700 border-b border-blue-200">
                      QUANTITY (KG)
                    </th>
                    <th rowSpan={2} className="py-2.5 px-2 w-24 bg-purple-50 text-purple-900">COST</th>
                    <th colSpan={2} className="py-1.5 px-2 bg-blue-50 text-red-700 border-b border-blue-200">
                      VALUE (RP)
                    </th>
                    <th rowSpan={2} className="py-2.5 px-2 w-24 bg-blue-50 text-red-700">COST REAL</th>
                    <th rowSpan={2} className="py-2.5 px-2 w-20 bg-blue-50 text-red-700">% SUSUT</th>
                    <th rowSpan={2} className="py-2.5 px-2 w-20 bg-blue-50 text-red-700">SUSUT REAL</th>
                    <th rowSpan={2} className="py-2.5 px-2 w-16 bg-slate-200">GP</th>
                    <th rowSpan={2} className="py-2.5 px-2 w-24 bg-slate-200">SALE</th>
                    {!readOnly && <th rowSpan={2} className="py-2.5 px-3 w-28 bg-slate-200">AKSI / CLOSING</th>}
                  </tr>

                  {/* Sub-Header Row 2 */}
                  <tr className="bg-blue-50/70 text-red-700 font-bold border-b-2 border-slate-300 text-center divide-x divide-slate-300 text-[10px]">
                    <th className="py-1.5 px-1.5 w-16">TALLY LABEL</th>
                    <th className="py-1.5 px-1.5 w-16">BRUTO</th>
                    <th className="py-1.5 px-1.5 w-16">SUSUT</th>
                    <th className="py-1.5 px-1.5 w-16">NETTO</th>
                    <th className="py-1.5 px-1.5 w-16">SUSUT</th>
                    <th className="py-1.5 px-2 w-24">REAL</th>
                    <th className="py-1.5 px-2 w-24">PROCESS</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {partingRows.map((row) => {
                    const hasPhoto = Boolean(row.closingRec?.photoUrl);

                    return (
                      <tr
                        key={row.prod.itemCode || row.idx}
                        className={`hover:bg-slate-50 divide-x divide-slate-200 transition text-[11px] ${
                          row.isClosed ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        {/* TDN # */}
                        <td className="py-2 px-2 text-center font-bold text-slate-600">
                          {row.prod.tdnSection || row.idx + 1}
                        </td>

                        {/* BAHAN */}
                        <td className="py-2 px-3 text-left">
                          <div className="font-bold text-slate-900">{row.prod.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                            <span>PLU: {row.prod.plu}</span>
                            <span>&bull;</span>
                            <span>{row.prod.vendor || 'PT PNDESIA'}</span>
                          </div>
                        </td>

                        {/* TALLY LABEL */}
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {row.tally > 0 ? row.tally.toFixed(3) : '-'}
                        </td>

                        {/* BRUTO */}
                        <td className="py-2 px-2 text-right font-mono font-medium text-slate-700">
                          {row.bruto > 0 ? row.bruto.toFixed(3) : '-'}
                        </td>

                        {/* BERAT SUSUT (Tally - Netto) */}
                        <td className="py-2 px-2 text-right font-mono font-bold text-rose-600 bg-rose-50/40">
                          {row.beratSusut > 0 ? row.beratSusut.toFixed(3) : '-'}
                        </td>

                        {/* NETTO */}
                        <td className="py-2 px-2 text-right font-mono font-black text-emerald-800 bg-emerald-50/50">
                          {row.netto > 0 ? row.netto.toFixed(3) : '-'}
                        </td>

                        {/* SUSUT REAL (Bruto - Netto) */}
                        <td className="py-2 px-2 text-right font-mono font-medium text-slate-600">
                          {row.susutReal > 0 ? row.susutReal.toFixed(3) : '-'}
                        </td>

                        {/* COST (COGS) */}
                        <td className="py-2 px-2 text-right font-mono text-purple-900 font-medium bg-purple-50/30">
                          {row.cost.toLocaleString('id-ID')}
                        </td>

                        {/* VALUE REAL (Tally * Cost) */}
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {row.valueReal > 0 ? Math.round(row.valueReal).toLocaleString('id-ID') : '-'}
                        </td>

                        {/* VALUE PROCESS (Netto * Cost) */}
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">
                          {row.valueProcess > 0 ? Math.round(row.valueProcess).toLocaleString('id-ID') : '-'}
                        </td>

                        {/* COST REAL (Value Real / Netto) */}
                        <td className="py-2 px-2 text-right font-mono font-extrabold text-blue-900 bg-blue-50/30">
                          {row.costReal > 0 ? Math.round(row.costReal).toLocaleString('id-ID') : '-'}
                        </td>

                        {/* % SUSUT ((Tally - Netto)/Tally) */}
                        <td className="py-2 px-2 text-right font-mono font-bold text-amber-700">
                          {row.tally > 0 && row.netto > 0 ? `${row.persentaseSusut.toFixed(2)}%` : '-'}
                        </td>

                        {/* SUSUT REAL */}
                        <td className="py-2 px-2 text-right font-mono font-medium text-slate-700">
                          {row.susutReal > 0 ? row.susutReal.toFixed(2) : '-'}
                        </td>

                        {/* GP (((Sale - Cost Real)/Sale)*100%) */}
                        <td className={`py-2 px-2 text-right font-mono font-black ${
                          row.costReal > 0
                            ? row.gpPercent < 0
                              ? 'text-rose-600 bg-rose-50/50'
                              : 'text-emerald-700 bg-emerald-50/50'
                            : 'text-slate-400'
                        }`}>
                          {row.sale > 0 && row.costReal > 0 ? `${row.gpPercent.toFixed(0)}%` : '-'}
                        </td>

                        {/* SALE */}
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {row.sale.toLocaleString('id-ID')}
                        </td>

                        {/* AKSI / CLOSING */}
                        {!readOnly && (
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {row.isClosed ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenClosingModal && onOpenClosingModal(row.prod, row.closingRec)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold shadow-xs cursor-pointer transition"
                                  title="Closing Sudah Diinput. Klik untuk ubah / edit data."
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Selesai</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOpenClosingModal && onOpenClosingModal(row.prod, row.closingRec)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[10px] font-bold shadow-xs cursor-pointer transition"
                                  title="Timbang & Catat Closing Parting Ayam"
                                >
                                  <Scale className="w-3 h-3" />
                                  <span>Timbang</span>
                                </button>
                              )}

                              {hasPhoto && onViewPhoto && (
                                <button
                                  type="button"
                                  onClick={() => onViewPhoto(row.closingRec!.photoUrl, row.closingRec?.note || `Bukti Timbang ${row.prod.name}`)}
                                  className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                  title="Lihat Foto Bukti Timbangan"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer Total */}
                <tfoot>
                  <tr className="bg-slate-200 text-slate-950 font-black border-t-2 border-slate-400 divide-x divide-slate-300 text-xs">
                    <td colSpan={2} className="py-2.5 px-3 text-center">TOTAL PARTING AYAM FRESH</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumTally.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumBruto.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-rose-700">{sumBeratSusut.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-800">{sumNetto.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumSusutReal.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-center">-</td>
                    <td className="py-2.5 px-2 text-right font-mono">{Math.round(sumValueReal).toLocaleString('id-ID')}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-800">{Math.round(sumValueProcess).toLocaleString('id-ID')}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-blue-900">{Math.round(avgCostReal).toLocaleString('id-ID')}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{avgSusutPct.toFixed(2)}%</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumSusutReal.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-800">{avgGpPercent.toFixed(1)}%</td>
                    <td className="py-2.5 px-2 text-center">-</td>
                    {!readOnly && <td className="py-2.5 px-2 text-center">&bull;</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: STOCK & PENJUALAN TABLE (PERSIS FOTO 2) */}
        {partingViewMode === 'STOCK_SALES' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
            {/* Banner Header (Green from Image 2) */}
            <div className="p-3.5 bg-[#70AD47] text-white text-center font-black tracking-wider uppercase text-sm border-b border-[#5B8D39]">
              LAPORAN STOCK AYAM PARTING FRESH TDN {currentStore.name.replace(/^TDN\s*/i, '').toUpperCase()} TGL {selectedDate}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FFC000] text-slate-900 font-bold border-b border-slate-300 text-center divide-x divide-slate-300 text-[11px]">
                    <th className="py-2 px-2 w-16">TGL</th>
                    <th className="py-2 px-2 w-24 bg-[#FFFF00]">Stock Akhir ( Malam )</th>
                    <th className="py-2 px-2 w-20">item code</th>
                    <th className="py-2 px-2 w-16">code</th>
                    <th className="py-2 px-3 text-left min-w-[200px]">Item Produk</th>
                    <th className="py-2 px-2 w-20">Harga</th>
                    <th className="py-2 px-2 w-16">Tanggal</th>
                    <th className="py-2 px-2 w-20">STOCK AWAL</th>
                    <th className="py-2 px-2 w-16">Adj In</th>
                    <th className="py-2 px-2 w-16">Adj Out</th>
                    <th className="py-2 px-2 w-20">In By SPB</th>
                    <th className="py-2 px-2 w-24 bg-[#F8CBAD]">Total Real</th>
                    <th className="py-2 px-2 w-20">Penjualan</th>
                    <th className="py-2 px-2 w-24 bg-[#FFFF00]">Stock Akhir By Sistem</th>
                    <th className="py-2 px-2 w-24 bg-[#FFFF00]">Stock Akhir Real</th>
                    <th className="py-2 px-2 w-24 bg-[#FFFF00]" title="Susut Jual: Selisih Stock Sistem dikurangi Stock Fisik Closing Malam">
                      SUSUT JUAL (RETUR)
                    </th>
                    {!readOnly && <th className="py-2 px-3 w-28 bg-slate-200">Aksi / Status</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-slate-800 text-[11px]">
                  {partingRows.map((row) => {
                    const hasPhoto = Boolean(row.closingRec?.photoUrl);

                    return (
                      <tr
                        key={row.prod.itemCode || row.idx}
                        className={`hover:bg-slate-50 divide-x divide-slate-200 transition ${
                          row.isClosed ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <td className="py-2 px-2 text-center text-slate-600 font-mono">{prevDateLabel}</td>
                        <td className="py-2 px-2 text-right font-mono bg-yellow-50 font-medium">
                          {row.openingStock > 0 ? row.openingStock.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-600">{row.prod.itemCode}</td>
                        <td className="py-2 px-2 text-center font-mono text-slate-600">{row.prod.plu}</td>
                        <td className="py-2 px-3 text-left font-bold text-slate-900">{row.prod.name}</td>
                        <td className="py-2 px-2 text-right font-mono">{row.prod.sellingPricePerKg?.toLocaleString('id-ID')}</td>
                        <td className="py-2 px-2 text-center text-slate-600 font-mono">{curDateLabel}</td>
                        <td className="py-2 px-2 text-right font-mono font-medium">
                          {row.openingStock > 0 ? row.openingStock.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-700">
                          {row.adjIn > 0 ? row.adjIn.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-rose-700">
                          {row.adjOut > 0 ? row.adjOut.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {row.grnKg > 0 ? row.grnKg.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-black bg-amber-50/60 text-slate-950">
                          {row.totalReal.toFixed(3)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-medium">
                          {row.salesKg > 0 ? row.salesKg.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold bg-yellow-50 text-slate-800">
                          {row.stockBySistem.toFixed(3)}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-black ${
                          row.isClosed ? 'text-emerald-700 bg-emerald-50/40' : 'text-slate-400'
                        }`}>
                          {row.isClosed ? row.stockReal.toFixed(3) : '0.000'}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-black ${
                          row.susutRetur > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-600'
                        }`}>
                          {row.susutRetur > 0 ? row.susutRetur.toFixed(3) : '0.000'}
                        </td>
                        {!readOnly && (
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {row.isClosed ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenClosingModal && onOpenClosingModal(row.prod, row.closingRec)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer transition"
                                >
                                  Selesai
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOpenClosingModal && onOpenClosingModal(row.prod, row.closingRec)}
                                  className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer transition"
                                >
                                  Timbang
                                </button>
                              )}
                              {hasPhoto && onViewPhoto && (
                                <button
                                  type="button"
                                  onClick={() => onViewPhoto(row.closingRec!.photoUrl, row.closingRec?.note || `Bukti ${row.prod.name}`)}
                                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                  title="Lihat Foto Bukti"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-200 text-slate-950 font-black border-t-2 border-slate-400 divide-x divide-slate-300 text-xs">
                    <td colSpan={1} className="py-2.5 px-2 text-center">TOTAL</td>
                    <td className="py-2.5 px-2 text-right font-mono bg-yellow-100">{sumOpening.toFixed(3)}</td>
                    <td colSpan={3} className="py-2.5 px-3 text-left">TOTAL AYAM PARTING FRESH</td>
                    <td className="py-2.5 px-2 text-center">-</td>
                    <td className="py-2.5 px-2 text-center">-</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumOpening.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-700">{sumAdjIn.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-rose-700">{sumAdjOut.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumGrn.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono bg-amber-100">{sumTotalReal.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumSales.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono bg-yellow-100">{sumStokSistem.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono bg-yellow-100 text-emerald-800">{sumStokReal.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono bg-yellow-100 text-rose-700">{sumSusutRetur.toFixed(3)}</td>
                    {!readOnly && <td className="py-2.5 px-2 text-center">&bull;</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // KENTANG, SOSIS & FILLET DORI VIEW (Existing Multi-sheet layout)
  // -------------------------------------------------------------
  const sheets: { title: string; headerBg: string; products: CatalogProduct[]; subCat: string }[] = [];
  if (subCategory === 'ALL' || subCategory === 'SOSIS & KENTANG') {
    sheets.push({
      title: `LAPORAN STOCK SOSIS & KENTANG ${currentStore.name.toUpperCase()} ${selectedDate}`,
      headerBg: 'bg-amber-500 text-slate-900',
      products: SOSIS_KENTANG_CATALOG,
      subCat: 'SOSIS & KENTANG',
    });
  }
  if (subCategory === 'ALL' || subCategory === 'FILLET DORI') {
    sheets.push({
      title: `LAPORAN STOCK FILLET DORI ${currentStore.name.toUpperCase()} ${selectedDate}`,
      headerBg: 'bg-orange-600 text-white',
      products: FILLET_DORI_CATALOG,
      subCat: 'FILLET DORI',
    });
  }

  return (
    <div className="space-y-8">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Laporan Stock Kentang, Sosis & Fillet Dori
            </h3>
            <p className="text-xs text-slate-500">
              Format persis sesuai lembar kerja toko &bull; Cabang: <strong>{currentStore.name}</strong> &bull; Tanggal: <strong>{selectedDate}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Unduh Excel (XLSX)</span>
        </button>
      </div>

      {sheets.map((sheet, sIdx) => {
        let sumOpening = 0;
        let sumGrn = 0;
        let sumAdj = 0;
        let sumTotalReal = 0;
        let sumSales = 0;
        let sumStokSistem = 0;
        let sumStokReal = 0;
        let sumSusut = 0;

        return (
          <div key={sIdx} className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
            {/* Sheet Banner Header */}
            <div className={`p-3.5 text-center font-black tracking-wider uppercase text-sm border-b border-slate-300 ${sheet.headerBg}`}>
              {sheet.title}
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-center divide-x divide-slate-300">
                    <th className="py-2.5 px-2 w-10">NO</th>
                    <th className="py-2.5 px-2 w-24">item code</th>
                    <th className="py-2.5 px-2 w-20">PLU</th>
                    <th className="py-2.5 px-2 w-20">Tanggal</th>
                    <th className="py-2.5 px-2 w-28">Stock Akhir ( Malam )</th>
                    <th className="py-2.5 px-3 text-left min-w-[200px]">Item Produk</th>
                    <th className="py-2.5 px-2 w-20">Tanggal</th>
                    <th className="py-2.5 px-2 w-24 bg-yellow-200 text-slate-900 border-x border-yellow-300">GRN</th>
                    <th className="py-2.5 px-2 w-20">adj</th>
                    <th className="py-2.5 px-2 w-28 bg-yellow-200 text-slate-900 border-x border-yellow-300">Total Real</th>
                    <th className="py-2.5 px-2 w-24">Penjualan</th>
                    <th className="py-2.5 px-2 w-28">Stock Akhir By Sistem</th>
                    <th className="py-2.5 px-2 w-20">Tanggal</th>
                    <th className="py-2.5 px-2 w-28">Stock Akhir Real</th>
                    <th className="py-2.5 px-2 w-28">Penyusutan</th>
                    {!readOnly && <th className="py-2.5 px-3 w-40 text-center">Aksi / Status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {sheet.products.map((prod, pIdx) => {
                    const closingRec = closingRecords.find(
                      (r) =>
                        (r.date || '').split('T')[0] === selectedDate &&
                        (isMatchPlan(r.planName, prod.name) || (prod.itemCode && r.itemCode === prod.itemCode))
                    );

                    const h1Stock = getHMinus1ClosingStock(closingRecords, currentStore, prod.name, selectedDate);
                    const openingStock =
                      typeof closingRec?.openingStockKg === 'number' && closingRec.openingStockKg > 0
                        ? closingRec.openingStockKg
                        : typeof h1Stock === 'number'
                        ? h1Stock
                        : 0;

                    const productGrns = grnRecords.filter(
                      (g) =>
                        (g.date || '').split('T')[0] === selectedDate &&
                        (isMatchPlan(g.productName, prod.name) || (prod.itemCode && g.itemCode === prod.itemCode))
                    );
                    const grnKg = productGrns.reduce((sum, g) => sum + (g.weightKg || 0), 0) || (closingRec?.grnKg || 0);

                    const productAdjs = adjustments.filter(
                      (a) =>
                        (a.date || '').split('T')[0] === selectedDate &&
                        (isMatchPlan(a.planName, prod.name) || (prod.itemCode && a.itemCode === prod.itemCode))
                    );
                    const adjIn = productAdjs.filter((a) => a.type === 'IN').reduce((sum, a) => sum + (a.weightKg || 0), 0);
                    const adjOut = productAdjs.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + (a.weightKg || 0), 0);
                    const netAdj = adjIn - adjOut;

                    const totalReal = openingStock + grnKg + netAdj;
                    const salesKg = closingRec?.salesKg || 0;
                    const stockBySistem = Math.max(0, totalReal - salesKg);
                    const isClosed = Boolean(closingRec && typeof closingRec.actualClosingStockKg === 'number');
                    const stockReal = isClosed ? closingRec!.actualClosingStockKg : 0;
                    const penyusutan = isClosed ? Math.max(0, stockBySistem - stockReal) : 0;

                    sumOpening += openingStock;
                    sumGrn += grnKg;
                    sumAdj += netAdj;
                    sumTotalReal += totalReal;
                    sumSales += salesKg;
                    sumStokSistem += stockBySistem;
                    sumStokReal += stockReal;
                    sumSusut += penyusutan;

                    const hasPhoto = Boolean(closingRec?.photoUrl);
                    const isUnopened = Boolean(closingRec?.isUnopened);

                    return (
                      <tr
                        key={prod.itemCode || pIdx}
                        className={`hover:bg-slate-50 divide-x divide-slate-200 transition ${
                          isClosed ? (isUnopened ? 'bg-blue-50/30' : 'bg-emerald-50/20') : ''
                        }`}
                      >
                        <td className="py-2 px-2 text-center font-bold text-slate-500">{pIdx + 1}</td>
                        <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-600">{prod.itemCode || '-'}</td>
                        <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-600">{prod.plu || '-'}</td>
                        <td className="py-2 px-2 text-center text-slate-500">{prevDateLabel}</td>
                        <td className="py-2 px-2 text-right font-mono font-medium">
                          {openingStock > 0 ? openingStock.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{prod.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500">{curDateLabel}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold bg-yellow-50 text-slate-900 border-x border-yellow-200">
                          {grnKg > 0 ? grnKg.toFixed(3) : '-'}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-medium ${netAdj < 0 ? 'text-rose-600' : netAdj > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {netAdj !== 0 ? netAdj.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold bg-yellow-50 text-slate-900 border-x border-yellow-200">
                          {totalReal.toFixed(3)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-medium">
                          {salesKg > 0 ? salesKg.toFixed(3) : '0.000'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-700">
                          {stockBySistem.toFixed(3)}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500">{curDateLabel}</td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${isClosed ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-400'}`}>
                          {isClosed ? stockReal.toFixed(3) : '0.000'}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-black ${penyusutan > 0 ? 'text-red-600 bg-red-50' : 'text-slate-600'}`}>
                          {penyusutan > 0 ? penyusutan.toFixed(3) : '0.000'}
                        </td>

                        {!readOnly && (
                          <td className="py-2 px-3 text-center">
                            {isClosed ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Closing
                                </span>
                                {hasPhoto && onViewPhoto && (
                                  <button
                                    onClick={() => onViewPhoto(closingRec!.photoUrl, closingRec?.note || `Bukti ${prod.name}`)}
                                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                    title="Lihat Foto Bukti"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => onOpenClosingModal && onOpenClosingModal(prod, closingRec)}
                                  className="text-[10px] text-blue-600 hover:underline ml-1 font-semibold"
                                >
                                  Ubah
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={() => onOpenClosingModal && onOpenClosingModal(prod)}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shadow-xs transition cursor-pointer"
                                >
                                  Timbang
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 divide-x divide-slate-300">
                    <td colSpan={4} className="py-2.5 px-3 text-center">TOTAL</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumOpening.toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-left">TOTAL {sheet.subCat}</td>
                    <td className="py-2.5 px-2 text-center">-</td>
                    <td className="py-2.5 px-2 text-right font-mono bg-yellow-100">{sumGrn.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumAdj.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono bg-yellow-100">{sumTotalReal.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumSales.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{sumStokSistem.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-center">-</td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-700">{sumStokReal.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-red-600">{sumSusut.toFixed(3)}</td>
                    {!readOnly && <td className="py-2.5 px-2 text-center">-</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
