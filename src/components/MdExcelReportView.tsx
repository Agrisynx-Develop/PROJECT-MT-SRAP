import React, { useState, useMemo } from 'react';
import {
  Store,
  DailyClosingReport,
  CogsMaster,
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  StockAdjustment
} from '../types';
import { exportRekapSusutMultiStoreExcel } from '../utils/excelExport';
import {
  calculateCategoryAggregates,
  getCogsForCategory
} from '../utils/reportCalculations';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  Table,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export type ExcelSheetTab =
  | 'REKAP'
  | 'SHANKLE'
  | 'RENDANG'
  | 'PREMIUM'
  | 'RAWON'
  | 'MODAL SHANKLE'
  | 'MODAL RENDANG'
  | 'MODAL PREMIUM'
  | 'MODAL RAWON';

interface MdExcelReportViewProps {
  stores: Store[];
  cogsList: CogsMaster[];
  allReports: DailyClosingReport[];
  allItems?: ThawingItem[];
  allSegments?: FabricationSegment[];
  allAdjustments?: StockAdjustment[];
  allClosingRecords?: ClosingPlanRecord[];
  startDate: string;
  endDate: string;
  onDateChange?: (start: string, end: string) => void;
}

export default function MdExcelReportView({
  stores,
  cogsList,
  allReports,
  allItems = [],
  allSegments = [],
  allAdjustments = [],
  allClosingRecords = [],
  startDate,
  endDate,
  onDateChange,
}: MdExcelReportViewProps) {
  const [activeSheet, setActiveSheet] = useState<ExcelSheetTab>('REKAP');
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string; val: string; formula?: string } | null>({
    row: 1,
    col: 'A',
    val: 'REKAPITULASI LAPORAN SUSUT MULTI CABANG',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // COGS Base Prices using single source of truth
  const cogsShankle = useMemo(() => getCogsForCategory(cogsList, 'SHANKLE'), [cogsList]);
  const cogsRendang = useMemo(() => getCogsForCategory(cogsList, 'RENDANG'), [cogsList]);
  const cogsPremium = useMemo(() => getCogsForCategory(cogsList, 'PREM'), [cogsList]);
  const cogsRawon = useMemo(() => getCogsForCategory(cogsList, 'RAWON'), [cogsList]);

  // Compute data for all 4 meat categories using shared calculation engine
  const shankleData = useMemo(
    () => calculateCategoryAggregates('SHANKLE', stores, allReports, allItems, allClosingRecords, startDate, endDate),
    [allReports, stores, allItems, allClosingRecords, startDate, endDate]
  );
  const rendangData = useMemo(
    () => calculateCategoryAggregates('RENDANG', stores, allReports, allItems, allClosingRecords, startDate, endDate),
    [allReports, stores, allItems, allClosingRecords, startDate, endDate]
  );
  const premiumData = useMemo(
    () => calculateCategoryAggregates('PREMIUM', stores, allReports, allItems, allClosingRecords, startDate, endDate),
    [allReports, stores, allItems, allClosingRecords, startDate, endDate]
  );
  const rawonData = useMemo(
    () => calculateCategoryAggregates('RAWON', stores, allReports, allItems, allClosingRecords, startDate, endDate),
    [allReports, stores, allItems, allClosingRecords, startDate, endDate]
  );

  // Handle Export to Excel (All 9 exact sheets with 100% data parity)
  const handleExportWorkbook = () => {
    const rangeText = `${startDate || 'ALL'} sd ${endDate || 'ALL'}`;
    exportRekapSusutMultiStoreExcel(
      stores,
      rangeText,
      allReports,
      cogsList,
      allItems,
      allClosingRecords,
      startDate,
      endDate
    );
  };

  // Format numbers helper
  const fmtNum = (val: number, decimals: number = 3) => {
    if (val === 0 || isNaN(val) || !val) return '-';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const fmtCurrency = (val: number) => {
    if (val === 0 || isNaN(val) || !val) return '0';
    return Math.round(val).toLocaleString('id-ID');
  };

  const fmtPercent = (val: number, fallbackDiv0: boolean = true) => {
    if (val === 0 || isNaN(val) || !val) {
      return fallbackDiv0 ? '#DIV/0!' : '0.00%';
    }
    return `${val.toFixed(2)}%`;
  };

  // Tab definitions with Excel-like colors
  const sheetTabs: { id: ExcelSheetTab; label: string; colorClass: string; badgeColor: string }[] = [
    { id: 'REKAP', label: 'REKAP', colorClass: 'border-b-2 border-slate-700 bg-slate-100 text-slate-800', badgeColor: 'bg-slate-600' },
    { id: 'SHANKLE', label: 'SHANKLE', colorClass: 'border-b-2 border-emerald-600 bg-emerald-50 text-emerald-800', badgeColor: 'bg-emerald-600' },
    { id: 'RENDANG', label: 'RENDANG', colorClass: 'border-b-2 border-red-600 bg-red-50 text-red-800', badgeColor: 'bg-red-600' },
    { id: 'PREMIUM', label: 'PREMIUM', colorClass: 'border-b-2 border-blue-600 bg-blue-50 text-blue-800', badgeColor: 'bg-blue-600' },
    { id: 'RAWON', label: 'RAWON', colorClass: 'border-b-2 border-amber-500 bg-amber-50 text-amber-800', badgeColor: 'bg-amber-500' },
    { id: 'MODAL SHANKLE', label: 'MODAL SANKLE', colorClass: 'border-b-2 border-emerald-700 bg-emerald-100 text-emerald-900', badgeColor: 'bg-emerald-700' },
    { id: 'MODAL RENDANG', label: 'MODAL RENDANG', colorClass: 'border-b-2 border-red-700 bg-red-100 text-red-900', badgeColor: 'bg-red-700' },
    { id: 'MODAL PREMIUM', label: 'MODAL PREMIUM', colorClass: 'border-b-2 border-blue-700 bg-blue-100 text-blue-900', badgeColor: 'bg-blue-700' },
    { id: 'MODAL RAWON', label: 'MODAL RAWON', colorClass: 'border-b-2 border-amber-600 bg-amber-100 text-amber-900', badgeColor: 'bg-amber-600' },
  ];

  // Helper to render Modal Sheets (Shankle, Rendang, Premium, Rawon)
  const renderModalSheet = (
    titleName: string,
    catData: typeof shankleData,
    baseCogs: number = 102000,
    itemCategoryName: string = ''
  ) => {
    const {
      grandTaly = 0,
      grandNetto = 0,
      grandSusut1 = 0,
      grandSusutJual = 0,
      grandTotalSusut = 0,
      grandPct = 0
    } = catData || {};
    const safeBaseCogs = typeof baseCogs === 'number' && !isNaN(baseCogs) ? baseCogs : 102000;
    const bahanRp = grandTaly * safeBaseCogs;
    const hasilRp = grandNetto * safeBaseCogs;
    const nettoMinusSusutJual = Math.max(0, grandNetto - grandSusutJual);
    const modalBaru = nettoMinusSusutJual > 0 ? bahanRp / nettoMinusSusutJual : safeBaseCogs;

    return (
      <div className="p-6 bg-white space-y-8 font-mono text-xs select-text overflow-x-auto min-w-[900px]">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-base font-black text-slate-800 tracking-wide uppercase">
              CALCULATION MODAL {titleName}
            </h2>
            <p className="text-[11px] text-slate-500 font-sans">
              Formula kalkulasi harga pokok setelah rekonsiliasi susut proses & susut jual
            </p>
          </div>
          <div className="bg-slate-100 px-3 py-1.5 rounded border border-slate-300 font-bold text-slate-700">
            BASE COGS: Rp {baseCogs.toLocaleString('id-ID')} / Kg
          </div>
        </div>

        {/* Top Summary / Right Pivot Block */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-600 font-sans uppercase">
            Ringkasan Akumulasi (Pivot Summary):
          </span>
          <div className="inline-block border border-slate-400 shadow-sm rounded-sm overflow-hidden">
            <table className="border-collapse text-center">
              <thead>
                <tr className="bg-[#BDD7EE] border-b border-slate-400 text-slate-900 font-bold">
                  <th className="px-5 py-2 border-r border-slate-300">Sum of TALY</th>
                  <th className="px-5 py-2 border-r border-slate-300">Sum of NETTO</th>
                  <th className="px-5 py-2 border-r border-slate-300">Sum of SUSUT 1</th>
                  <th className="px-5 py-2">Sum of SUSUT JUAL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white text-slate-900 font-bold">
                  <td className="px-5 py-2 border-r border-slate-300 text-right">{fmtNum(grandTaly, 2)}</td>
                  <td className="px-5 py-2 border-r border-slate-300 text-right">{fmtNum(grandNetto, 2)}</td>
                  <td className="px-5 py-2 border-r border-slate-300 text-right">{fmtNum(grandSusut1, 2)}</td>
                  <td className="px-5 py-2 text-right">{fmtNum(grandSusutJual, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Main Left Calculation Matrix */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-600 font-sans uppercase">
            Matriks Penyesuaian Harga Modal Pokok:
          </span>
          <div className="border border-slate-400 max-w-2xl bg-white shadow-sm">
            <table className="w-full border-collapse">
              <tbody>
                {/* Row 1: BAHAN */}
                <tr className="border-b border-slate-300 hover:bg-slate-50">
                  <td className="py-2 px-4 font-bold text-slate-800 w-44">BAHAN</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">{fmtNum(grandTaly, 2)}</td>
                  <td className="py-2 px-2 text-center text-slate-500 font-bold">X</td>
                  <td className="py-2 px-3 text-right text-slate-700">{fmtCurrency(baseCogs)}</td>
                  <td className="py-2 px-2 text-center text-slate-500 font-bold">=</td>
                  <td className="py-2 px-4 text-right font-bold text-slate-900">{fmtCurrency(bahanRp)}</td>
                </tr>

                {/* Row 2: HASIL */}
                <tr className="border-b border-slate-300 hover:bg-slate-50">
                  <td className="py-2 px-4 font-bold text-slate-800">HASIL</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">{fmtNum(grandNetto, 2)}</td>
                  <td className="py-2 px-2 text-center text-slate-500 font-bold">X</td>
                  <td className="py-2 px-3 text-right text-slate-700">{fmtCurrency(baseCogs)}</td>
                  <td className="py-2 px-2 text-center text-slate-500 font-bold">=</td>
                  <td className="py-2 px-4 text-right font-bold text-slate-900">{fmtCurrency(hasilRp)}</td>
                </tr>

                {/* Spacing Row */}
                <tr className="h-4 bg-slate-50/50">
                  <td colSpan={6}></td>
                </tr>

                {/* Row 4: SUSUT PROSES */}
                <tr className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="py-2 px-4 font-bold text-slate-700">SUSUT PROSES</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-800">{fmtNum(grandSusut1, 2)}</td>
                  <td colSpan={4}></td>
                </tr>

                {/* Row 5: SUSUT JUAL */}
                <tr className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="py-2 px-4 font-bold text-slate-700">SUSUT JUAL</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-800">{fmtNum(grandSusutJual, 2)}</td>
                  <td colSpan={4}></td>
                </tr>

                {/* Row 6: TOTAL SUSUT */}
                <tr className="border-b-2 border-slate-400 hover:bg-slate-50">
                  <td className="py-2 px-4 font-bold text-slate-900">TOTAL SUSUT</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">{fmtNum(grandTotalSusut, 2)}</td>
                  <td colSpan={2}></td>
                  <td colSpan={2} className="py-2 px-4 text-right font-bold text-slate-900">
                    <span className={`px-2 py-0.5 rounded font-mono ${grandPct > 2.0 ? 'text-red-700 bg-red-50' : 'text-emerald-800'}`}>
                      {fmtPercent(grandPct, false)}
                    </span>
                  </td>
                </tr>

                {/* Spacing Row */}
                <tr className="h-4 bg-slate-50/50">
                  <td colSpan={6}></td>
                </tr>

                {/* Row 8: HIGHLIGHTED MODAL BARU */}
                <tr className="bg-[#FFFF00] border-2 border-slate-900 font-bold text-slate-900 text-sm">
                  <td className="py-3 px-4 uppercase tracking-wider font-black">
                    MODAL {titleName} - SUSUT JUAL
                  </td>
                  <td className="py-3 px-3 text-right font-black text-slate-950 font-mono text-base" colSpan={5}>
                    Rp {fmtNum(modalBaru, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] font-sans flex items-start gap-2 max-w-2xl mt-4">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Formula Excel:</strong>{' '}
              <code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded">
                = BAHAN_RP / (SUM_NETTO - SUM_SUSUT_JUAL)
              </code>
              <br />
              Harga modal pokok riil disesuaikan dengan mempertimbangkan total shrinkage dari proses pabrikasi hingga penjualan di toko.
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper to render Category Detail Sheets (Shankle, Rendang, Premium, Rawon)
  const renderCategoryDailySheet = (
    sheetTitle: string,
    catData: typeof shankleData
  ) => {
    const {
      storeAggregates = [],
      grandTaly = 0,
      grandNetto = 0,
      grandSusut1 = 0,
      grandSusutJual = 0,
      grandPct = 0,
    } = catData || {};

    return (
      <div className="p-4 bg-white select-text overflow-x-auto min-w-[800px]">
        {/* Top Header Label */}
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-block bg-slate-800 text-white font-bold text-sm px-4 py-1.5 rounded tracking-wider uppercase font-mono shadow-sm">
            {sheetTitle}
          </div>
          <span className="text-xs text-slate-500 font-sans font-medium">
            31 Hari Transaksi Multi Toko • Nilai '-' berarti tidak ada transaksi pada tanggal tersebut
          </span>
        </div>

        {/* Excel Table Grid */}
        <div className="border border-slate-400 shadow-sm overflow-hidden bg-white">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              {/* Row 1: Merged Title */}
              <tr className="bg-slate-200 border-b border-slate-400">
                <th className="py-1 px-3 border-r border-slate-300 text-left font-bold text-slate-800" colSpan={2}>
                  {sheetTitle}
                </th>
                <th className="py-1 px-3 border-r border-slate-300 text-right font-bold text-slate-800" colSpan={5}>
                  PERIODE: {startDate || 'AWAL'} s/d {endDate || 'AKHIR'}
                </th>
              </tr>

              {/* Row 2: Standard Yellow Header Row (Exact match Image 1-4) */}
              <tr className="bg-[#FFFF00] border-b-2 border-slate-900 text-slate-900 font-bold text-center">
                <th className="py-2 px-3 border-r border-slate-400 w-16">TGL</th>
                <th className="py-2 px-4 border-r border-slate-400 text-left min-w-[140px]">TOKO</th>
                <th className="py-2 px-3 border-r border-slate-400 text-right min-w-[100px]">TALY</th>
                <th className="py-2 px-3 border-r border-slate-400 text-right min-w-[100px]">NETTO</th>
                <th className="py-2 px-3 border-r border-slate-400 text-right min-w-[100px]">SUSUT 1</th>
                <th className="py-2 px-3 border-r border-slate-400 text-right min-w-[100px]">SUSUT JUAL</th>
                <th className="py-2 px-3 text-right min-w-[90px]">%</th>
              </tr>
            </thead>

            <tbody>
              {storeAggregates.flatMap((sa, storeIdx) => {
                const rows = [];
                const storeName = (sa?.store?.name || sa?.store?.code || `Cabang ${storeIdx + 1}`).replace('TDN ', '');
                // Render 31 days per store
                for (let day = 1; day <= 31; day++) {
                  const dayData = sa?.dailyMap?.get ? sa.dailyMap.get(day) : undefined;
                  const taly = dayData?.taly || 0;
                  const netto = dayData?.netto || 0;
                  const susut1 = dayData?.susut1 || 0;
                  const susutJual = dayData?.susutJual || 0;
                  const totalSusut = susut1 + susutJual;
                  const pct = taly > 0 ? (totalSusut / taly) * 100 : null;

                  const isSelected = selectedCell?.row === (storeIdx * 31 + day);

                  rows.push(
                    <tr
                      key={`${sa?.store?.id || storeIdx}-${day}`}
                      onClick={() =>
                        setSelectedCell({
                          row: storeIdx * 31 + day,
                          col: 'C',
                          val: `TALY: ${taly > 0 ? taly : '-'}, SUSUT: ${susut1 > 0 ? susut1 : '-'}`,
                          formula: taly > 0 ? `=C${day}-D${day}` : undefined,
                        })
                      }
                      className={`border-b border-slate-200 hover:bg-emerald-50/50 cursor-pointer transition ${
                        day % 2 === 0 ? 'bg-slate-50/40' : 'bg-white'
                      } ${isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''}`}
                    >
                      <td className="py-1 px-3 border-r border-slate-300 text-center font-bold text-slate-700">
                        {day}
                      </td>
                      <td className="py-1 px-4 border-r border-slate-300 text-left font-bold text-slate-900 uppercase">
                        {storeName}
                      </td>
                      <td className="py-1 px-3 border-r border-slate-300 text-right font-medium text-slate-800">
                        {taly > 0 ? fmtNum(taly, 3) : '-'}
                      </td>
                      <td className="py-1 px-3 border-r border-slate-300 text-right font-medium text-slate-800">
                        {netto > 0 ? fmtNum(netto, 3) : '-'}
                      </td>
                      <td className="py-1 px-3 border-r border-slate-300 text-right font-medium text-slate-800">
                        {susut1 > 0 ? fmtNum(susut1, 3) : '-'}
                      </td>
                      <td className="py-1 px-3 border-r border-slate-300 text-right font-medium text-slate-800">
                        {susutJual > 0 ? fmtNum(susutJual, 3) : '-'}
                      </td>
                      <td
                        className={`py-1 px-3 text-right font-bold ${
                          pct !== null
                            ? pct > 2.0
                              ? 'text-red-600'
                              : 'text-slate-900'
                            : 'text-slate-400'
                        }`}
                      >
                        {pct !== null ? `${pct.toFixed(2)}%` : '#DIV/0!'}
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}

              {/* Bottom Grand Total Row */}
              <tr className="bg-slate-200 border-t-2 border-b-2 border-slate-900 font-bold text-slate-950">
                <td className="py-2.5 px-3 border-r border-slate-400 text-center">TOTAL</td>
                <td className="py-2.5 px-4 border-r border-slate-400 text-left uppercase">SELURUH CABANG</td>
                <td className="py-2.5 px-3 border-r border-slate-400 text-right">{fmtNum(grandTaly, 3)}</td>
                <td className="py-2.5 px-3 border-r border-slate-400 text-right">{fmtNum(grandNetto, 3)}</td>
                <td className="py-2.5 px-3 border-r border-slate-400 text-right">{fmtNum(grandSusut1, 3)}</td>
                <td className="py-2.5 px-3 border-r border-slate-400 text-right">{fmtNum(grandSusutJual, 3)}</td>
                <td
                  className={`py-2.5 px-3 text-right font-black ${
                    grandPct > 2.0 ? 'text-red-700' : 'text-slate-950'
                  }`}
                >
                  {fmtPercent(grandPct, false)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Helper to render REKAP Sheet (Image 9: 4 side-by-side tables for Shankle, Rendang Fresh, Premium, Rawon)
  const renderRekapSheet = () => {
    const renderRekapTable = (
      tableTitle: string,
      catData: typeof shankleData,
      themeColor: string
    ) => {
      // Sort stores descending by %
      const storeAggs = catData?.storeAggregates || [];
      const sortedStores = [...storeAggs].sort((a, b) => (b?.pct || 0) - (a?.pct || 0));

      return (
        <div className="border border-slate-400 shadow-sm bg-white overflow-hidden rounded-none flex-1 min-w-[340px]">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              {/* Category Title (Blue Header) */}
              <tr className="bg-[#8EA9DB] border-b border-slate-400 text-slate-950 font-bold">
                <th colSpan={6} className="py-2 px-3 text-center uppercase tracking-wider text-[11px]">
                  {tableTitle}
                </th>
              </tr>

              {/* Subheaders (Yellow Row - Exact Image 9) */}
              <tr className="bg-[#FFFF00] border-b-2 border-slate-900 text-slate-900 font-bold text-center">
                <th className="py-2 px-3 border-r border-slate-400 text-left">TOKO</th>
                <th className="py-2 px-2 border-r border-slate-400 text-right">TALY</th>
                <th className="py-2 px-2 border-r border-slate-400 text-right">NETTO</th>
                <th className="py-2 px-2 border-r border-slate-400 text-right">SUSUT 1</th>
                <th className="py-2 px-2 border-r border-slate-400 text-right">SUSUT JUAL</th>
                <th className="py-2 px-2 text-right">%</th>
              </tr>
            </thead>

            <tbody>
              {sortedStores.map((item, idx) => {
                const isHigh = (item?.pct || 0) > 2.0;
                const storeName = (item?.store?.name || item?.store?.code || `Cabang ${idx + 1}`).replace('TDN ', '');
                return (
                  <tr
                    key={item?.store?.id || idx}
                    className={`border-b border-slate-200 hover:bg-slate-100/80 transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                    }`}
                  >
                    <td className="py-1.5 px-3 border-r border-slate-300 text-left font-bold text-slate-900 uppercase">
                      {storeName}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-medium text-slate-800">
                      {fmtNum(item?.taly || 0, 2)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-medium text-slate-800">
                      {fmtNum(item?.netto || 0, 2)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-medium text-slate-800">
                      {fmtNum(item?.susut1 || 0, 2)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-medium text-slate-800">
                      {fmtNum(item?.susutJual || 0, 2)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-bold ${
                        isHigh ? 'text-red-600 font-black' : 'text-slate-900'
                      }`}
                    >
                      {(item?.taly || 0) > 0 ? `${(item?.pct || 0).toFixed(2)}%` : '0.00%'}
                    </td>
                  </tr>
                );
              })}

              {/* Total Row */}
              <tr className="bg-slate-200 border-t-2 border-slate-900 font-bold text-slate-950">
                <td className="py-2 px-3 border-r border-slate-400 text-left font-black">TOTAL</td>
                <td className="py-2 px-2 border-r border-slate-400 text-right">{fmtNum(catData?.grandTaly || 0, 2)}</td>
                <td className="py-2 px-2 border-r border-slate-400 text-right">{fmtNum(catData?.grandNetto || 0, 2)}</td>
                <td className="py-2 px-2 border-r border-slate-400 text-right">{fmtNum(catData?.grandSusut1 || 0, 2)}</td>
                <td className="py-2 px-2 border-r border-slate-400 text-right">{fmtNum(catData?.grandSusutJual || 0, 2)}</td>
                <td
                  className={`py-2 px-2 text-right font-black ${
                    (catData?.grandPct || 0) > 2.0 ? 'text-red-700 font-black' : 'text-slate-950'
                  }`}
                >
                  {fmtPercent(catData?.grandPct || 0, false)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    };

    return (
      <div className="p-4 bg-white space-y-4 select-text overflow-x-auto min-w-[1200px]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-wide uppercase font-mono">
              REKAPITULASI SUSUT MULTI CABANG (4 KATEGORI UTAMA)
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Data terurut berdasarkan % Susut tertinggi. Nilai susut melebihi batas toleransi (&gt; 2.00%) disorot dengan warna merah.
            </p>
          </div>
          <button
            onClick={handleExportWorkbook}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs shadow transition active:scale-95 cursor-pointer font-sans"
          >
            <Download className="w-4 h-4" />
            Download Excel (.XLSX)
          </button>
        </div>

        {/* 4 Side-by-side Tables Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {renderRekapTable('DAGING RENDANG SHANKLE', shankleData, 'emerald')}
          {renderRekapTable('DAGING RENDANG FRESH', rendangData, 'red')}
          {renderRekapTable('DAGING PREMIUM', premiumData, 'blue')}
          {renderRekapTable('DAGING RAWON', rawonData, 'amber')}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`bg-slate-100 rounded-xl border border-slate-300 shadow-lg flex flex-col transition-all overflow-hidden ${
        isFullscreen ? 'fixed inset-2 z-50 bg-white' : 'w-full'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. TOP EXCEL TOOLBAR & FORMULA BAR */}
      {/* ========================================================================= */}
      <div className="bg-[#107C41] text-white px-4 py-2.5 flex items-center justify-between border-b border-emerald-800 select-none">
        <div className="flex items-center gap-3">
          <div className="bg-white text-[#107C41] p-1.5 rounded font-black text-xs flex items-center gap-1.5 shadow-sm">
            <FileSpreadsheet className="w-4 h-4" />
            <span>EXCEL WORKBOOK</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">
              LAPORAN MD SUSUT MULTI CABANG.xlsx - [{activeSheet}]
            </h1>
            <p className="text-[11px] text-emerald-100">
              Periode: {startDate || 'Awal'} s/d {endDate || 'Akhir'} • {stores.length} Cabang Aktif
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-sans">
          <button
            onClick={handleExportWorkbook}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
            title="Download file Excel (.xlsx) dengan 9 sheet persis"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export XLSX (9 Sheets)</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded text-xs transition cursor-pointer"
            title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Formula Bar (fx) */}
      <div className="bg-white border-b border-slate-300 px-3 py-1.5 flex items-center gap-3 font-mono text-xs">
        <div className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-slate-700 font-bold w-14 text-center">
          {selectedCell ? `${selectedCell.col}${selectedCell.row}` : 'A1'}
        </div>
        <div className="text-slate-400 font-serif italic text-sm font-bold select-none">fx</div>
        <div className="flex-1 bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-800 truncate">
          {selectedCell?.formula || selectedCell?.val || 'Siap'}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN SHEET VIEWPORT */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-auto bg-slate-50 max-h-[70vh]">
        {activeSheet === 'REKAP' && renderRekapSheet()}
        {activeSheet === 'SHANKLE' && renderCategoryDailySheet('SHANKLE', shankleData)}
        {activeSheet === 'RENDANG' && renderCategoryDailySheet('BAHAN RENDANG', rendangData)}
        {activeSheet === 'PREMIUM' && renderCategoryDailySheet('PREMIUM', premiumData)}
        {activeSheet === 'RAWON' && renderCategoryDailySheet('RAWON', rawonData)}
        {activeSheet === 'MODAL SHANKLE' && renderModalSheet('SHANKLE', shankleData, cogsShankle, 'SHANKLE')}
        {activeSheet === 'MODAL RENDANG' && renderModalSheet('D RENDANG', rendangData, cogsRendang, 'DAGING FRESH')}
        {activeSheet === 'MODAL PREMIUM' && renderModalSheet('PREMIUM', premiumData, cogsPremium, 'DAGING PREMIUM')}
        {activeSheet === 'MODAL RAWON' && renderModalSheet('RAWON', rawonData, cogsRawon, 'RAWON')}
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM EXCEL SHEET TAB BAR (EXACTLY 9 SHEETS AS REQUESTED) */}
      {/* ========================================================================= */}
      <div className="bg-slate-200 border-t border-slate-300 px-2 py-1 flex items-center gap-1 overflow-x-auto select-none font-sans text-xs">
        <div className="flex items-center text-slate-600 px-1 border-r border-slate-300 mr-1">
          <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-slate-900" />
          <ChevronRight className="w-4 h-4 cursor-pointer hover:text-slate-900" />
        </div>

        {sheetTabs.map((tab) => {
          const isActive = activeSheet === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSheet(tab.id);
                setSelectedCell({ row: 1, col: 'A', val: `Sheet ${tab.label}` });
              }}
              className={`px-3 py-1.5 rounded-t font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm border-t-2 border-emerald-600 border-l border-r border-slate-300 -mb-1 pb-2'
                  : 'bg-slate-100 hover:bg-slate-200/90 text-slate-600 border border-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${tab.badgeColor}`} />
              <span className="font-mono text-[11px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
