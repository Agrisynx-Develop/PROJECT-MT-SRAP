import React from 'react';
import { ThawingItem, FabricationSegment, DailyClosingReport, ClosingPlanRecord, StockAdjustment } from '../types';
import { Scale, AlertTriangle, ShieldCheck, PieChart, Layers, Tag } from 'lucide-react';
import { isMatchPlan } from '../utils/storeHelper';

interface SummaryProps {
  items: ThawingItem[];
  segments: FabricationSegment[];
  pastReports: DailyClosingReport[];
  safeThawingLossPercent: number;
  safeFabricationLossPercent: number;
  closingRecords?: ClosingPlanRecord[];
  adjustments?: StockAdjustment[];
}

export default function Summary({
  items,
  segments,
  safeThawingLossPercent,
  safeFabricationLossPercent,
  closingRecords = [],
  adjustments = [],
}: SummaryProps) {
  // Computed statistics on active items & segments
  const totalWeightBefore = items.reduce((sum, i) => sum + i.weightBeforeThawing, 0);

  // Calculate Process Loss (Susut Proses = Susut Thawing + Susut Pabrikasi) accurately for each item
  const calcItemProcessLoss = (item: ThawingItem) => {
    const itemSegments = segments.filter((s) => s.itemId === item.id);
    const weightAfterThaw = item.weightAfterThawing !== undefined && item.weightAfterThawing !== null ? item.weightAfterThawing : item.weightBeforeThawing;
    const thawingLoss = Math.max(0, item.weightBeforeThawing - weightAfterThaw);
    
    const segTargetTotal = itemSegments.reduce((sum, s) => sum + (s.targetWeight || s.actualWeight || 0), 0);
    const segActualTotal = itemSegments.reduce((sum, s) => sum + (s.actualWeight || 0), 0);
    const fabTrimmingLoss = Math.max(0, segTargetTotal - segActualTotal);

    // If item is completely finished with fabrication and all meat accounted for:
    const isFullyDone = item.status === 'pabrikasi_done' && segActualTotal > 0 && (segActualTotal >= (item.weightAfterThawing || item.weightBeforeThawing) * 0.7);
    const fabLoss = isFullyDone
      ? Math.max(0, weightAfterThaw - segActualTotal)
      : fabTrimmingLoss;

    const totalLossKg = thawingLoss + fabLoss;
    const totalLossPct = item.weightBeforeThawing > 0 ? (totalLossKg / item.weightBeforeThawing) * 100 : 0;

    return {
      thawingLoss,
      fabLoss,
      totalLossKg,
      totalLossPct,
      segActualTotal,
    };
  };

  const totalProcessLossKg = items.reduce((sum, i) => sum + calcItemProcessLoss(i).totalLossKg, 0);
  const totalProcessLossPercent = totalWeightBefore > 0 ? (totalProcessLossKg / totalWeightBefore) * 100 : 0;

  // Susut Jual is derived from Closing Records (Sistem Stock - Actual Butcher Closing)
  const totalSusutJualKg = closingRecords.length > 0
    ? closingRecords.reduce((sum, r) => sum + (r.susutJualKg || 0), 0)
    : segments.reduce((sum, s) => sum + (s.periodicShrinkage || 0), 0);
  const totalSusutJualPercent = totalWeightBefore > 0 ? (totalSusutJualKg / totalWeightBefore) * 100 : 0;

  const totalSalesKg = closingRecords.length > 0
    ? closingRecords.reduce((sum, r) => sum + (r.salesKg || 0), 0)
    : segments.reduce((sum, s) => sum + (s.salesKg || 0), 0);

  const safeTotalLossAllowedPercent = safeThawingLossPercent + safeFabricationLossPercent;
  const isProcessCritical = totalProcessLossPercent > safeTotalLossAllowedPercent;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          📊 Summary & Analisis Pabrikasi
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Ringkasan berat, persentase susut proses (thawing & pabrikasi), susut jual (selisih stok sistem vs closing fisik butcher), serta rincian realisasi sales & harga per kg tiap bahan baku.
        </p>
      </div>

      {/* ALERT BANNER IF OVERALL SHRINKAGE EXCEEDS 2% */}
      {(totalProcessLossPercent > 2.0 || totalSusutJualPercent > 2.0) && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl flex items-start gap-3.5 text-rose-900 shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="p-2 bg-rose-500 text-white rounded-xl shrink-0 mt-0.5 shadow-xs font-black text-sm">
            🚨
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm uppercase tracking-wide text-rose-950">
                🚨 ALERT AUDIT: PERSENTASE SUSUT DAGING MELEBIHI 2.00%!
              </h4>
              <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Susut &gt; 2.00%
              </span>
            </div>
            <p className="text-xs mt-1 text-rose-800 leading-relaxed">
              Hasil analisis menunjukkan persentase penyusutan daging (Susut Proses Thawing/Pabrikasi: <strong>{totalProcessLossPercent.toFixed(2)}%</strong> | Susut Display: <strong>{totalSusutJualPercent.toFixed(2)}%</strong>) telah melampaui batas aman standar <strong>2.00%</strong>. Harap segera evaluasi proses timbangan dan fasilitas penyimpanan.
            </p>
          </div>
        </div>
      )}

      {/* --- NOTICE: SEPARATION OF SALES & SUSUT --- */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-800 flex items-start gap-3">
        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 font-extrabold text-xs uppercase">
          ℹ️ Keterangan Audit
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">
            Pemisahan Pengurangan Stok: Sales (Penjualan) vs Susut (Penyusutan Fisik)
          </h4>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            Pengurangan stok akibat <strong>Sales (Penjualan Kasir)</strong> dicatat dalam keterangan tersendiri sebagai <strong>Realisasi Sales</strong> dan <strong>TIDAK dimasukkan ke dalam Susut Daging</strong> (susut thawing, susut pabrikasi, maupun susut display). Hal ini memastikan audit stok fisik & performa keuangan tetap akurat.
          </p>
        </div>
      </div>

      {/* --- OVERVIEW METRICS BENTO GRID --- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Berat Awal</span>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{totalWeightBefore.toFixed(2)} <span className="text-sm font-normal text-slate-500">Kg</span></h3>
          <p className="text-xs text-slate-500 mt-1">{items.length} Bahan baku tercatat</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Susut Proses (Thaw & Fab)</span>
          <h3 className="text-2xl font-black text-rose-600 mt-2">{totalProcessLossKg.toFixed(2)} <span className="text-sm font-normal text-slate-500">Kg</span></h3>
          <p className="text-xs text-slate-500 mt-1">
            Persentase: <strong className={isProcessCritical ? 'text-rose-600' : 'text-emerald-600'}>{totalProcessLossPercent.toFixed(1)}%</strong>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Susut Jual (Display)</span>
          <h3 className="text-2xl font-black text-amber-600 mt-2">{totalSusutJualKg.toFixed(2)} <span className="text-sm font-normal text-slate-500">Kg</span></h3>
          <p className="text-xs text-slate-500 mt-1">
            Penguapan: <strong className="text-amber-600">{totalSusutJualPercent.toFixed(1)}%</strong>
          </p>
        </div>

        <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider block">Realisasi Sales (Penjualan)</span>
          <h3 className="text-2xl font-black text-emerald-800 mt-2">{totalSalesKg.toFixed(2)} <span className="text-sm font-normal text-emerald-600">Kg</span></h3>
          <p className="text-xs text-emerald-700 mt-1 font-bold">
            (Bukan Susut)
          </p>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Efisiensi Hasil Daging</span>
          <h3 className="text-2xl font-black text-emerald-400 mt-2">
            {totalWeightBefore > 0 ? (((totalWeightBefore - totalProcessLossKg) / totalWeightBefore) * 100).toFixed(1) : '100.0'}%
          </h3>
          <p className="text-xs text-slate-400 mt-1">Hasil Bersih vs Bobot Awal</p>
        </div>
      </div>

      {/* --- LIVE ALERTS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Process Loss Alarm Card */}
        <div className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
          isProcessCritical
            ? 'bg-rose-50 border-rose-200 text-rose-950 shadow-xs'
            : 'bg-emerald-50 border-emerald-100 text-emerald-950'
        }`}>
          <div className={`p-3 rounded-xl shrink-0 ${isProcessCritical ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {isProcessCritical ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-base">Alarm Susut Proses (Thawing & Fab)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Batas aman susut proses: 1.0% (Maksimal Susut Harian: 2.0%)</p>
            <p className="text-sm font-semibold mt-2">
              Tingkat susut proses: <span className={totalProcessLossPercent > 1.0 ? 'text-rose-600 font-extrabold' : 'text-emerald-600'}>{totalProcessLossPercent.toFixed(1)}%</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {totalProcessLossPercent > 1.0
                ? '⚠️ PERINGATAN: Total susut proses melebihi 1.0%! Periksa teknik thawing dan kerapian pemotongan.'
                : '✅ Bagus! Susut proses berada dalam batas aman maksimal 1.0%.'}
            </p>
          </div>
        </div>

        {/* Susut Jual Info Card */}
        <div className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
          totalSusutJualPercent > 1.0
            ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
            : 'bg-emerald-50 border-emerald-100 text-emerald-950'
        }`}>
          <div className={`p-3 rounded-xl shrink-0 ${totalSusutJualPercent > 1.0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600'}`}>
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">Monitoring Susut Jual (Display)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Batas aman susut jual: 1.0% (Maksimal Susut Harian: 2.0%)</p>
            <p className="text-sm font-semibold mt-2 text-slate-900">
              Total susut jual aktif: <span className={totalSusutJualPercent > 1.0 ? 'font-extrabold text-amber-700' : 'font-extrabold text-emerald-600'}>{totalSusutJualKg.toFixed(2)} Kg ({totalSusutJualPercent.toFixed(1)}%)</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {totalSusutJualPercent > 1.0
                ? '⚠️ PERINGATAN: Susut jual melebihi 1.0%! Periksa temperatur chiller display & durasi penyimpanan.'
                : '✅ Bagus! Susut jual berada dalam batas aman maksimal 1.0%.'}
            </p>
          </div>
        </div>
      </div>

      {/* --- ACCUMULATED SEGMENTS SUMMARY (PESANAN VS DISPLAY) --- */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <Layers className="text-emerald-600 w-5 h-5" />
          Akumulasi Hasil Segmen Pabrikasi (Dipisah Pesanan vs Display)
        </h3>

        {(() => {
          const pesananMap = new Map<string, number>();
          const displayMap = new Map<string, { initialWeight: number; susutJualKg: number; netWeight: number }>();

          const isPlanMatch = (a?: string, b?: string) => {
            if (!a || !b) return false;
            const cleanA = a.toLowerCase().trim();
            const cleanB = b.toLowerCase().trim();
            return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
          };

          segments.forEach((seg) => {
            const parentItem = items.find((i) => i.id === seg.itemId);
            const purpose = seg.openingPurpose || parentItem?.openingPurpose || 'UNTUK DISPLAY';
            const name = (seg.plannedFabrication || seg.segmentName || 'SEGMEN LAIN').toUpperCase();
            const netW = seg.actualWeight || 0;
            const shrinkKg = seg.periodicShrinkage || 0;

            if (purpose === 'UNTUK PESANAN') {
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

          // Also merge closingRecords into displayMap if closed via Butcher closing view
          closingRecords.forEach((c) => {
            const name = (c.planName || 'RENCANA').toUpperCase();
            const existing = displayMap.get(name);
            const totalTersedia = c.openingStockKg + c.newProcessedKg + (c.adjustInKg || 0) - (c.adjustOutKg || 0);
            
            if (existing) {
              displayMap.set(name, {
                initialWeight: Math.max(existing.initialWeight, totalTersedia),
                susutJualKg: c.susutJualKg > 0 ? c.susutJualKg : existing.susutJualKg,
                netWeight: c.actualClosingStockKg > 0 ? c.actualClosingStockKg : existing.netWeight,
              });
            } else {
              displayMap.set(name, {
                initialWeight: totalTersedia,
                susutJualKg: c.susutJualKg || 0,
                netWeight: c.actualClosingStockKg || 0,
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
              {/* PESANAN */}
              <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-amber-100/90 px-4 py-3 border-b border-amber-200 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    🛍️ AKUMULASI SEGMEN UNTUK PESANAN
                  </span>
                  <span className="text-[10px] bg-amber-200 text-amber-950 font-black px-2 py-0.5 rounded-full">
                    {pesananList.length} Rencana
                  </span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-50/50 text-amber-900 border-b border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                      <th className="p-3">Nama Segmen</th>
                      <th className="p-3 text-right">Hasil Segmen</th>
                      <th className="p-3 text-right">Susut Jual</th>
                      <th className="p-3 text-right">Berat Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 text-slate-800">
                    {pesananList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                          Belum ada segmen untuk pesanan.
                        </td>
                      </tr>
                    ) : (
                      pesananList.map((p, idx) => (
                        <tr key={idx} className="hover:bg-amber-50/50">
                          <td className="p-3 font-extrabold text-amber-950">{p.segmentName}</td>
                          <td className="p-3 text-right font-mono font-bold">{p.totalWeight.toFixed(2)} Kg</td>
                          <td className="p-3 text-right font-mono text-slate-400">0.00 Kg</td>
                          <td className="p-3 text-right font-mono font-black text-amber-900">{p.totalWeight.toFixed(2)} Kg</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {pesananList.length > 0 && (
                    <tfoot>
                      <tr className="bg-amber-100/70 font-black border-t border-amber-200 text-amber-950">
                        <td className="p-3 uppercase text-[10px]">TOTAL PESANAN</td>
                        <td className="p-3 text-right font-mono">{totalPesananKg.toFixed(2)} Kg</td>
                        <td className="p-3 text-right font-mono text-slate-500">0.00 Kg</td>
                        <td className="p-3 text-right font-mono">{totalPesananKg.toFixed(2)} Kg</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* DISPLAY */}
              <div className="bg-white border border-purple-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-purple-100/90 px-4 py-3 border-b border-purple-200 flex items-center justify-between">
                  <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                    🏪 AKUMULASI SEGMEN UNTUK DISPLAY
                  </span>
                  <span className="text-[10px] bg-purple-200 text-purple-950 font-black px-2 py-0.5 rounded-full">
                    {displayList.length} Rencana
                  </span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-purple-50/50 text-purple-900 border-b border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                      <th className="p-3">Nama Segmen</th>
                      <th className="p-3 text-right">Berat Awal</th>
                      <th className="p-3 text-right">Susut Jual</th>
                      <th className="p-3 text-right">Sisa Stok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100 text-slate-800">
                    {displayList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                          Belum ada segmen untuk display.
                        </td>
                      </tr>
                    ) : (
                      displayList.map((d, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/50">
                          <td className="p-3 font-extrabold text-purple-950">{d.segmentName}</td>
                          <td className="p-3 text-right font-mono font-semibold">{d.initialWeight.toFixed(2)} Kg</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-700">
                            {d.susutJualKg > 0 ? `-${d.susutJualKg.toFixed(2)} Kg` : '0.00 Kg'}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-700">{d.netWeight.toFixed(2)} Kg</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {displayList.length > 0 && (
                    <tfoot>
                      <tr className="bg-purple-100/70 font-black border-t border-purple-200 text-purple-950">
                        <td className="p-3 uppercase text-[10px]">TOTAL DISPLAY</td>
                        <td className="p-3 text-right font-mono">{totalDisplayInitialKg.toFixed(2)} Kg</td>
                        <td className="p-3 text-right font-mono text-amber-700">
                          {totalDisplaySusutJualKg > 0 ? `-${totalDisplaySusutJualKg.toFixed(2)} Kg` : '0.00 Kg'}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-800">{totalDisplayNetKg.toFixed(2)} Kg</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {/* --- DETAILED SUMMARY TABLE --- */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="text-emerald-600 w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-base">Rincian Per Bahan Baku & Harga Masing-Masing</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">{items.length} item aktif</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Bahan Baku Daging & Purpose</th>
                <th className="p-4">Harga / Kg (Rp)</th>
                <th className="p-4">Berat Awal</th>
                <th className="p-4">Berat Thawing</th>
                <th className="p-4">Susut Proses (Kg / %)</th>
                <th className="p-4">Susut Jual (Kg / %)</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {items.map((item) => {
                const itemSegments = segments.filter((s) => s.itemId === item.id);
                const segWeight = itemSegments.reduce((sum, s) => sum + s.actualWeight, 0);
                const price = item.pricePerKg ? `Rp ${item.pricePerKg.toLocaleString('id-ID')}` : 'Belum diatur';

                const { totalLossKg: processLossKg, totalLossPct: processLossPct } = calcItemProcessLoss(item);

                // Check for closing records matching this item / plan
                const matchingClosing = closingRecords.find(
                  (c) => isMatchPlan(c.planName, item.plannedFabrication || item.name)
                );
                const susutJualKg = matchingClosing ? matchingClosing.susutJualKg : itemSegments.reduce((sum, s) => sum + (s.periodicShrinkage || 0), 0);
                const susutJualPct = item.weightBeforeThawing > 0 ? (susutJualKg / item.weightBeforeThawing) * 100 : 0;

                const purpose = item.openingPurpose || 'UNTUK DISPLAY';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{item.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                          purpose === 'UNTUK PESANAN'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-purple-100 text-purple-900 border-purple-300'
                        }`}>
                          {purpose}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Operator: {item.butcherName}</div>
                    </td>
                    <td className="p-4 font-semibold text-emerald-700 bg-emerald-50/50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-emerald-600" />
                        <span>{price}</span>
                      </div>
                    </td>
                    <td className="p-4 font-medium">{item.weightBeforeThawing.toFixed(2)} Kg</td>
                    <td className="p-4 font-medium">{item.weightAfterThawing ? `${item.weightAfterThawing.toFixed(2)} Kg` : '-'}</td>
                    <td className="p-4 font-mono font-bold text-rose-600">
                      {processLossKg.toFixed(2)} Kg
                      <span className="block text-[10px] font-normal text-rose-500">({processLossPct.toFixed(1)}%)</span>
                    </td>
                    <td className="p-4 font-mono font-bold text-amber-600">
                      {susutJualKg.toFixed(2)} Kg
                      <span className="block text-[10px] font-normal text-amber-500">({susutJualPct.toFixed(1)}%)</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        item.status === 'thawing'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : item.status === 'pabrikasi_ready'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {item.status === 'thawing' ? 'Thawing' : item.status === 'pabrikasi_ready' ? 'Siap Potong' : 'Selesai'}
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
  );
}
