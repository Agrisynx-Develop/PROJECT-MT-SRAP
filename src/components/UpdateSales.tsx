import React, { useState } from 'react';
import { ThawingItem, FabricationSegment, ClosingPlanRecord, StockAdjustment } from '../types';
import { ShoppingBag, ShoppingCart, Scale, Save, AlertCircle, Sparkles, CheckCircle2, Layers, ArrowRightLeft, ShieldCheck, Check, Clock } from 'lucide-react';

interface UpdateSalesProps {
  segments: FabricationSegment[];
  items?: ThawingItem[];
  closingRecords?: ClosingPlanRecord[];
  adjustments?: StockAdjustment[];
  onUpdateSales: (planNameOrSegmentId: string, salesAmountKg: number, overridePhysicalClosingKg?: number) => void;
  onTransferPurpose?: (
    id: string,
    isSegment: boolean,
    targetPurpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY',
    transferWeightKg?: number
  ) => void;
  onOpenTransferModal?: () => void;
}

interface PlanSalesGroup {
  planName: string;
  category: string;
  stockAwalKg: number; // Opening/Available (Carryover + Processed Today + AdjIn - AdjOut)
  carryoverKg: number;
  todayProcessedKg: number;
  adjInKg: number;
  adjOutKg: number;
  totalSalesKg: number; // Accumulation of sales
  stokSistemKg: number; // Theoretical system stock = stockAwalKg - totalSalesKg
  actualPhysicalStockKg?: number; // Physical closing weight if entered
  totalShrinkageKg: number; // Display shrinkage = MAX(0, stokSistemKg - actualPhysicalStockKg)
  isClosed: boolean;
  segmentCount: number;
}

export default function UpdateSales({
  segments,
  items = [],
  closingRecords = [],
  adjustments = [],
  onUpdateSales,
  onTransferPurpose,
  onOpenTransferModal,
}: UpdateSalesProps) {
  const [selectedPlanName, setSelectedPlanName] = useState('');
  const [salesInput, setSalesInput] = useState('');
  const [physicalClosingInput, setPhysicalClosingInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Default standard fabrication cut plans
  const DEFAULT_PLANS = [
    { name: 'D.sapi pot. rdang', category: 'DAGING FRESH' },
    { name: 'Daging Rendang Shankle', category: 'SHANKLE' },
    { name: 'D Premium lokal', category: 'DAGING PREMIUM' },
    { name: 'Rawon Curah', category: 'RAWON' },
    { name: 'D.r. fresh member', category: 'DAGING FRESH' },
    { name: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM' },
  ];

  const isPlanMatch = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const cleanA = a.toLowerCase().trim();
    const cleanB = b.toLowerCase().trim();
    return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
  };

  // Extract unique cut plans from standard plans, items, segments, and closing records
  const existingPlanNames: string[] = Array.from(
    new Set([
      ...DEFAULT_PLANS.map((p) => p.name),
      ...items.map((i) => i.plannedFabrication).filter(Boolean) as string[],
      ...segments.map((seg) => {
        const parentItem = items.find((i) => i.id === seg.itemId);
        return seg.plannedFabrication || parentItem?.plannedFabrication || '';
      }).filter(Boolean),
      ...closingRecords.map((r) => r.planName).filter(Boolean) as string[],
    ])
  );

  // Group metrics per plan using unified single source of truth
  const planSalesGroups: PlanSalesGroup[] = existingPlanNames.map((plan) => {
    const itemsForPlan = items.filter((i) => isPlanMatch(i.plannedFabrication, plan));
    const segsForPlan = segments.filter((seg) => {
      const parentItem = items.find((i) => i.id === seg.itemId);
      const segPlan = seg.plannedFabrication || parentItem?.plannedFabrication || '';
      return isPlanMatch(segPlan, plan);
    });
    const closingRec = closingRecords.find((r) => isPlanMatch(r.planName, plan));
    const planAdj = adjustments.filter((a) => isPlanMatch(a.planName, plan));

    const adjInKg = planAdj.filter((a) => a.type === 'IN').reduce((sum, a) => sum + (a.weightKg || 0), 0);
    const adjOutKg = planAdj.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + (a.weightKg || 0), 0);

    const carryoverKg =
      (itemsForPlan.filter((i) => i.isCarryover).reduce((sum, i) => sum + (i.weightBeforeThawing || 0), 0)) ||
      (closingRec ? closingRec.openingStockKg || 0 : 0);

    const todayProcessedKg =
      (itemsForPlan.filter((i) => !i.isCarryover).reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing || 0), 0)) ||
      (closingRec ? closingRec.newProcessedKg || 0 : 0);

    const stockAwalKg = carryoverKg + todayProcessedKg + adjInKg - adjOutKg;

    // Sales accumulation
    const totalSalesFromSegs = segsForPlan.reduce((acc, seg) => acc + (seg.salesKg || 0), 0);
    const totalSalesFromItems = itemsForPlan.reduce((acc, i) => acc + (i.salesKg || 0), 0);
    const totalSalesFromClosing = closingRec?.salesKg || 0;
    const totalSalesKg = Math.max(totalSalesFromSegs, totalSalesFromItems, totalSalesFromClosing);

    // Stok Sistem (Teoretis) = Stok Tersedia - Sales
    const stokSistemKg = Math.max(0, stockAwalKg - totalSalesKg);

    // Timbangan Fisik Real (Closing Butcher)
    const isClosed = Boolean(closingRec && typeof closingRec.actualClosingStockKg === 'number');
    const actualPhysicalStockKg = isClosed ? closingRec!.actualClosingStockKg : undefined;

    // Susut Jual = Selisih Stok Sistem vs Fisik
    const totalShrinkageKg = isClosed && actualPhysicalStockKg !== undefined
      ? Math.max(0, stokSistemKg - actualPhysicalStockKg)
      : 0;

    const defaultDef = DEFAULT_PLANS.find((p) => isPlanMatch(p.name, plan));
    const category = closingRec?.category || (itemsForPlan[0]?.pabrikasiCategory as string) || defaultDef?.category || 'DAGING FRESH';

    return {
      planName: plan,
      category,
      stockAwalKg,
      carryoverKg,
      todayProcessedKg,
      adjInKg,
      adjOutKg,
      totalSalesKg,
      stokSistemKg,
      actualPhysicalStockKg,
      totalShrinkageKg,
      isClosed,
      segmentCount: segsForPlan.length || itemsForPlan.length,
    };
  });

  // Overall Totals
  const overallStockAwal = planSalesGroups.reduce((acc, g) => acc + g.stockAwalKg, 0);
  const overallTotalSales = planSalesGroups.reduce((acc, g) => acc + g.totalSalesKg, 0);
  const overallTotalShrinkage = planSalesGroups.reduce((acc, g) => acc + g.totalShrinkageKg, 0);
  const overallStokSistem = planSalesGroups.reduce((acc, g) => acc + g.stokSistemKg, 0);

  const selectedGroup = planSalesGroups.find((g) => g.planName === selectedPlanName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedPlanName) {
      setErrorMsg('Harap pilih salah satu Rencana Potongan / Pabrikasi!');
      return;
    }

    const salesVal = parseFloat(salesInput || '0');
    const physicalVal = physicalClosingInput.trim() !== '' ? parseFloat(physicalClosingInput) : undefined;

    if (isNaN(salesVal) || salesVal < 0) {
      setErrorMsg('Harap masukkan jumlah sales angka positif yang valid (0 atau lebih)!');
      return;
    }

    if (physicalVal !== undefined && (isNaN(physicalVal) || physicalVal < 0)) {
      setErrorMsg('Harap masukkan angka timbangan fisik closing yang valid (≥ 0)!');
      return;
    }

    if (salesVal === 0 && physicalVal === undefined) {
      setErrorMsg('Harap masukkan nilai sales yang ingin ditambahkan atau nilai timbangan fisik!');
      return;
    }

    // Trigger flexible update
    onUpdateSales(selectedPlanName, salesVal, physicalVal);

    // Reset Form
    setSalesInput('');
    setPhysicalClosingInput('');
    setSuccessMsg(
      `Berhasil memperbarui data untuk "${selectedPlanName}". Sales baru +${salesVal.toFixed(2)} Kg dicatat, Stok Sistem & Susut Jual otomatis disinkronkan!`
    );
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            🛒 Update Jumlah Sales & Stok Daging
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Input penjualan daging (POS/Kasir) secara fleksibel kapan saja — baik sebelum maupun sesudah timbangan closing fisik butcher.
          </p>
        </div>

        {onOpenTransferModal && (
          <button
            type="button"
            onClick={onOpenTransferModal}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto border border-amber-400"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Alihkan Peruntukan (Pesanan ⇆ Display)</span>
          </button>
        )}
      </div>

      {/* Notice Banner: Sales vs Susut Separation */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 font-extrabold text-sm">
          🛍️ SALES & CLOSING
        </div>
        <div>
          <h4 className="text-sm font-extrabold text-emerald-950">
            Perhitungan Stok Seragam & Fleksibilitas Pengisian Sales
          </h4>
          <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
            Data sales dapat diisi kapan saja secara fleksibel. Pengurangan karena penjualan dicatat sebagai <strong>Sales</strong>, sedangkan selisih antara <strong>Stok Sistem (Tersedia - Sales)</strong> dengan <strong>Timbangan Fisik Real</strong> dihitung sebagai <strong>Susut Jual (Display)</strong> yang dibandingkan terhadap total daging yang dibuka hari itu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Stock Awal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            📦 Stock Awal / Tersedia
          </span>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {overallStockAwal.toFixed(2)}
            </h3>
            <span className="text-sm font-bold text-slate-500">Kg</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Total daging dibuka + sisa kemarin ± penyesuaian
          </p>
        </div>

        {/* Card 2: Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-emerald-600" /> Total Sales (Penjualan)
          </span>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-emerald-800 tracking-tight">
              {overallTotalSales.toFixed(2)}
            </h3>
            <span className="text-sm font-bold text-emerald-600">Kg</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-2 font-semibold">
            Akumulasi penjualan tercatat di kasir
          </p>
        </div>

        {/* Card 3: Total Susut Jual */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider block mb-1">
            📉 Total Susut Jual (Fisik)
          </span>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-amber-900 tracking-tight">
              {overallTotalShrinkage.toFixed(2)}
            </h3>
            <span className="text-sm font-bold text-amber-600">Kg</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-2 font-medium">
            Selisih stok teoretis vs timbangan fisik real
          </p>
        </div>

        {/* Card 4: Stok Sistem */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
          <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-400" /> Stok Sistem (Teoretis)
          </span>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-white tracking-tight">
              {overallStokSistem.toFixed(2)}
            </h3>
            <span className="text-sm font-bold text-slate-400">Kg</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-2 font-medium">
            Formula: Stok Tersedia - Total Sales
          </p>
        </div>
      </div>

      {/* Main Input Form & Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form Panel (Col-7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Form Update Jumlah Sales Daging</h2>
                <p className="text-xs text-slate-500">Catat penjualan kasir kapan saja (fleksibel sebelum/setelah closing)</p>
              </div>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg font-extrabold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Sinkronisasi Stok Realtime
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-100 flex items-start gap-1.5">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Select Cut Plan */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Pilih Rencana Potong / Pabrikasi *
              </label>
              <select
                value={selectedPlanName}
                onChange={(e) => setSelectedPlanName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm font-bold"
              >
                <option value="">-- Ketuk Untuk Pilih Rencana Potong --</option>
                {planSalesGroups.map((group) => (
                  <option key={group.planName} value={group.planName}>
                    {group.planName} ➔ Tersedia: {group.stockAwalKg.toFixed(2)} Kg | Sales: {group.totalSalesKg.toFixed(2)} Kg | Stok Sistem: {group.stokSistemKg.toFixed(2)} Kg {group.isClosed ? `| Fisik: ${group.actualPhysicalStockKg?.toFixed(2)} Kg` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Metrics Breakdown Card for selected plan */}
            {selectedGroup && (
              <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-200 space-y-3 text-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Detail Rencana:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white border border-emerald-300 text-emerald-900 rounded-lg font-black text-xs">
                      {selectedGroup.planName}
                    </span>
                    {selectedGroup.isClosed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-700 text-white rounded-md text-[10px] font-black">
                        <Check className="w-3 h-3" /> Sudah Closing Fisik
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-bold">
                        <Clock className="w-3 h-3 text-amber-700" /> Belum Closing Fisik
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Tersedia</span>
                    <span className="text-xs font-black text-slate-900 block mt-0.5">
                      {selectedGroup.stockAwalKg.toFixed(2)} Kg
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 block text-[10px] font-extrabold uppercase">Total Sales</span>
                    <span className="text-xs font-black text-emerald-700 block mt-0.5">
                      {selectedGroup.totalSalesKg.toFixed(2)} Kg
                    </span>
                  </div>
                  <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-2xs">
                    <span className="text-emerald-400 block text-[10px] font-extrabold uppercase">Stok Sistem</span>
                    <span className="text-xs font-black text-white block mt-0.5">
                      {selectedGroup.stokSistemKg.toFixed(2)} Kg
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-600 block text-[10px] font-bold uppercase">Sisa Fisik Real</span>
                    <span className="text-xs font-black text-slate-900 block mt-0.5">
                      {selectedGroup.isClosed && selectedGroup.actualPhysicalStockKg !== undefined
                        ? `${selectedGroup.actualPhysicalStockKg.toFixed(2)} Kg`
                        : '-'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="text-amber-700 block text-[10px] font-extrabold uppercase">Susut Jual</span>
                    <span className="text-xs font-black text-amber-800 block mt-0.5">
                      {selectedGroup.totalShrinkageKg.toFixed(2)} Kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sales Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Jumlah Sales Baru Ditambahkan (+Kg) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  placeholder="Contoh: 2.50 (akan ditambahkan ke total sales)"
                  value={salesInput}
                  onChange={(e) => setSalesInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-lg font-bold"
                />
                <span className="absolute right-4 top-3 text-slate-400 font-bold">Kg</span>
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Sistem akan menambahkan penjualan ini ke total sales dan mengkalkulasi ulang Stok Sistem serta Susut Jual secara otomatis.
              </p>
            </div>

            {/* Physical Closing Override Input (Optional Reconciliation) */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Rekonsiliasi Timbangan Closing Fisik (Opsional)</span>
                <span className="text-[10px] text-slate-400 font-normal">(Hasil timbangan sore/malam)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  placeholder={
                    selectedGroup?.isClosed && selectedGroup.actualPhysicalStockKg !== undefined
                      ? `Timbangan fisik saat ini: ${selectedGroup.actualPhysicalStockKg.toFixed(2)} Kg (isi jika ingin mengubah)`
                      : 'Isi jika ingin mencatat/memperbarui timbangan fisik sisa display'
                  }
                  value={physicalClosingInput}
                  onChange={(e) => setPhysicalClosingInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm font-bold"
                />
                <span className="absolute right-4 top-2.5 text-slate-400 font-bold text-xs">Kg</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
            >
              <Save className="w-5 h-5" />
              Simpan & Update Sales / Stok
            </button>
          </form>
        </div>

        {/* Informative Box (Col-5) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ArrowRightLeft className="text-emerald-400 w-5 h-5" />
                <h3 className="text-base font-bold text-white">Alur Rekonsiliasi Stok Daging</h3>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold">1. Stok Tersedia (Opening)</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono">Daging Dibuka</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Total berat daging dari hasil timbangan thawing & pabrikasi + sisa kemarin.</p>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold">2. Penjualan (Sales Kasir)</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono">Fleksibel Kapan Saja</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Penjualan mengurangi stok teoretis (Stok Sistem = Tersedia - Sales), terpisah penuh dari susut fisik.
                  </p>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold">3. Timbangan Fisik & Susut Jual</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono">Closing Sore/Malam</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Susut Jual dihitung dari selisih Stok Sistem dikurangi Timbangan Fisik Real, dan dibandingkan terhadap total daging dibuka.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Sistem menjaga sinkronisasi data seragam antara Kasir, Butcher & Laporan.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Breakdown Matrix */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Rincian Rekonsiliasi Per Rencana Potong
            </h3>
            <p className="text-xs text-slate-500">Matriks Stok Tersedia, Sales, Stok Sistem, Timbangan Fisik Real & Susut Jual</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Rencana Potongan / Pabrikasi</th>
                <th className="py-3 px-4 text-right">Tersedia (Kg)</th>
                <th className="py-3 px-4 text-right">
                  Sales (Kg)
                  <span className="block text-[9px] text-emerald-600 font-extrabold uppercase">(Penjualan)</span>
                </th>
                <th className="py-3 px-4 text-right">
                  Stok Sistem (Kg)
                  <span className="block text-[9px] text-slate-500 font-extrabold uppercase">(Teoretis)</span>
                </th>
                <th className="py-3 px-4 text-right">
                  Timbangan Fisik (Kg)
                  <span className="block text-[9px] text-indigo-600 font-extrabold uppercase">(Closing Real)</span>
                </th>
                <th className="py-3 px-4 text-right">
                  Susut Jual (Kg)
                  <span className="block text-[9px] text-amber-700 font-extrabold uppercase">(Penguapan/Display)</span>
                </th>
                <th className="py-3 px-4 text-center">Status Closing</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {planSalesGroups.map((group) => {
                return (
                  <tr key={group.planName} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${group.isClosed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <div>
                          <span>{group.planName}</span>
                          <span className="block text-[10px] text-slate-400 font-semibold">{group.category}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                      {group.stockAwalKg.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700">
                      {group.totalSalesKg.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                      {group.stokSistemKg.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-indigo-900">
                      {group.isClosed && group.actualPhysicalStockKg !== undefined ? (
                        <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                          {group.actualPhysicalStockKg.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-amber-800">
                      {group.totalShrinkageKg.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {group.isClosed ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✓ Sudah Closing
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          Belum Closing
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlanName(group.planName);
                          window.scrollTo({ top: 100, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-extrabold rounded-lg text-[11px] transition-all cursor-pointer"
                      >
                        Pilih & Update
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
