import React, { useState } from 'react';
import { ThawingItem, FabricationSegment } from '../types';
import { Play, Plus, Trash2, CheckCircle2, Info, AlertTriangle, Scale, ArrowRightLeft, Edit3 } from 'lucide-react';

interface SegmentasiPabrikasiProps {
  items: ThawingItem[];
  existingSegments: FabricationSegment[];
  onSaveSegments: (
    itemId: string,
    segments: { segmentName: string; targetWeight: number; actualWeight: number }[],
    updatedPlan?: string,
    updatedPurpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY'
  ) => void;
  onUpdateItem?: (updatedItem: ThawingItem) => void;
  safeFabricationLossPercent: number;
  onTransferPurpose?: (
    id: string,
    isSegment: boolean,
    targetPurpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY',
    transferWeightKg?: number
  ) => void;
  onOpenTransferModal?: () => void;
  onOpenEditPlanModal?: (itemId?: string) => void;
}

interface TempSegment {
  segmentName: string;
  targetWeight: string;
  actualWeight: string;
  purpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY';
}

export default function SegmentasiPabrikasi({
  items,
  existingSegments,
  onSaveSegments,
  onUpdateItem,
  safeFabricationLossPercent,
  onTransferPurpose,
  onOpenTransferModal,
  onOpenEditPlanModal,
}: SegmentasiPabrikasiProps) {
  const readyItems = items.filter((i) => i.status === 'pabrikasi_ready');

  // Group existing segments by itemId for Window Susut Pabrikasi display
  const completedBatchGroups = React.useMemo(() => {
    const map = new Map<string, FabricationSegment[]>();
    existingSegments.forEach((seg) => {
      const list = map.get(seg.itemId) || [];
      list.push(seg);
      map.set(seg.itemId, list);
    });

    return Array.from(map.entries()).map(([itemId, segs]) => {
      const first = segs[0];
      const itemName = first?.itemName || 'Daging';
      const plannedFabrication = first?.plannedFabrication || 'Pabrikasi';
      const totalActual = segs.reduce((sum, s) => sum + (s.actualWeight || 0), 0);
      const totalTarget = segs.reduce((sum, s) => sum + (s.targetWeight || 0), 0);
      const loss = Math.max(0, totalTarget - totalActual);
      const lossPercent = totalTarget > 0 ? (loss / totalTarget) * 100 : 0;
      const lossPerSeg = segs.length > 0 ? loss / segs.length : 0;

      return {
        itemId,
        itemName,
        plannedFabrication,
        totalActual,
        totalTarget,
        loss,
        lossPercent,
        lossPerSeg,
        numSegments: segs.length,
      };
    });
  }, [existingSegments]);

  // State for item currently being fabricated
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState('D.sapi pot. rdang');
  const [activePurpose, setActivePurpose] = useState<'UNTUK PESANAN' | 'UNTUK DISPLAY'>('UNTUK DISPLAY');
  const [tempSegments, setTempSegments] = useState<TempSegment[]>([
    { segmentName: 'D.sapi pot. rdang', targetWeight: '', actualWeight: '' },
  ]);
  const [errorMsg, setErrorMsg] = useState('');

  // Custom Cutting Plans State
  const defaultPlans = [
    'D.sapi pot. rdang',
    'Daging Rendang Shankle',
    'D Premium lokal',
    'Rawon Curah',
    'D.r. fresh member',
    'FRIBOY / Daging Prem 2',
  ];
  const [customPlans, setCustomPlans] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('butcher_custom_plans');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlanText, setNewPlanText] = useState('');
  const [showDeletePlanList, setShowDeletePlanList] = useState(false);

  const allPlans = Array.from(new Set([...defaultPlans, ...customPlans, activePlan].filter(Boolean)));

  const handleAddCustomPlan = () => {
    const trimmed = newPlanText.trim().toUpperCase();
    if (!trimmed) return;

    if (!customPlans.includes(trimmed) && !defaultPlans.includes(trimmed)) {
      const updated = [...customPlans, trimmed];
      setCustomPlans(updated);
      try {
        localStorage.setItem('butcher_custom_plans', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save custom plan:', e);
      }
    }

    setActivePlan(trimmed);
    if (tempSegments.length === 1) {
      setTempSegments([{ ...tempSegments[0], segmentName: trimmed }]);
    }
    setNewPlanText('');
    setShowAddPlan(false);
  };

  const handleDeleteCustomPlan = (planToDelete: string) => {
    const updated = customPlans.filter((p) => p !== planToDelete);
    setCustomPlans(updated);
    try {
      localStorage.setItem('butcher_custom_plans', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete custom plan:', e);
    }

    if (activePlan === planToDelete) {
      const fallback = defaultPlans[0];
      setActivePlan(fallback);
      if (tempSegments.length === 1) {
        setTempSegments([{ ...tempSegments[0], segmentName: fallback }]);
      }
    }
  };

  const activeItem = items.find((i) => i.id === activeItemId);

  // Open fabrication screen for an item
  const handleStartFabrication = (item: ThawingItem) => {
    setActiveItemId(item.id);
    setErrorMsg('');
    
    const planName = (item.plannedFabrication && item.plannedFabrication !== 'PENDING')
      ? String(item.plannedFabrication).trim()
      : 'DAGING RENDANG PREMIUM';
    const purpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY' = item.openingPurpose === 'UNTUK PESANAN' ? 'UNTUK PESANAN' : 'UNTUK DISPLAY';

    setActivePlan(planName);
    setActivePurpose(purpose);
    
    const defaultWeight = item.weightAfterThawing || 0;
    setTempSegments([
      { segmentName: planName, targetWeight: defaultWeight > 0 ? defaultWeight.toFixed(1) : '', actualWeight: '' },
    ]);
  };

  // Add a new segment row manually
  const handleAddSegmentRow = () => {
    setTempSegments([
      ...tempSegments,
      { segmentName: `Segmen Manual ${tempSegments.length + 1}`, targetWeight: '', actualWeight: '' },
    ]);
  };

  // Remove a segment row
  const handleRemoveSegmentRow = (idx: number) => {
    if (tempSegments.length <= 1) {
      setErrorMsg('Minimal harus ada 1 segmen potongan!');
      return;
    }
    const updated = [...tempSegments];
    updated.splice(idx, 1);
    setTempSegments(updated);
  };

  // Handle value changes in the temporary segments
  const handleSegmentChange = (idx: number, field: keyof TempSegment, value: any) => {
    const updated = [...tempSegments];
    (updated[idx] as any)[field] = value;
    setTempSegments(updated);
  };

  // Submit and save the segment division
  const handleSaveFabrication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItemId || !activeItem) return;

    // Validate
    let totalActualWeight = 0;
    const cleanSegments: { segmentName: string; targetWeight: number; actualWeight: number; purpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY' }[] = [];

    for (let i = 0; i < tempSegments.length; i++) {
      const seg = tempSegments[i];
      if (!seg.segmentName.trim()) {
        setErrorMsg(`Nama segmen ke-${i + 1} tidak boleh kosong!`);
        return;
      }
      const actual = parseFloat(seg.actualWeight);

      if (isNaN(actual) || actual < 0) {
        setErrorMsg(`Realisasi berat segmen "${seg.segmentName}" harus angka positif!`);
        return;
      }

      totalActualWeight += actual;
      cleanSegments.push({
        segmentName: seg.segmentName,
        targetWeight: actual,
        actualWeight: actual,
        purpose: seg.purpose || activePurpose,
      });
    }

    const weightAfterThawing = activeItem.weightAfterThawing || 0;
    if (totalActualWeight > weightAfterThawing) {
      setErrorMsg(
        `Total berat hasil segmentasi (${totalActualWeight.toFixed(2)} Kg) melebihi berat bahan baku (${weightAfterThawing.toFixed(2)} Kg)! Periksa kembali timbangan.`
      );
      return;
    }

    // Call save callback
    onSaveSegments(activeItemId, cleanSegments, activePlan, activePurpose);
    setActiveItemId(null);
  };

  // Calculate live preview metrics for the active item
  const calculateLiveMetrics = () => {
    if (!activeItem) return { totalActual: 0, loss: 0, lossPercent: 0, lossPerSegment: 0 };
    const weightAfterThawing = activeItem.weightAfterThawing || 0;
    
    const totalActual = tempSegments.reduce((sum, s) => {
      const val = parseFloat(s.actualWeight);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const loss = Math.max(0, weightAfterThawing - totalActual);
    const lossPercent = weightAfterThawing > 0 ? (loss / weightAfterThawing) * 100 : 0;
    const numSegments = tempSegments.length;
    const lossPerSegment = numSegments > 0 ? loss / numSegments : 0;

    return { totalActual, loss, lossPercent, lossPerSegment };
  };

  const live = calculateLiveMetrics();

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          🔪 Segmentasi & Pemotongan Daging
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Bagi daging utuh (prime subprimal) menjadi bagian-bagian porsi retail (Steak, Slice, Fat Trim).
        </p>
      </div>

      {/* ALERT BANNER IF LIVE FABRICATION SHRINKAGE EXCEEDS 2% */}
      {live.lossPercent > 2.0 && activeItemId && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl flex items-start gap-3.5 text-rose-900 shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="p-2 bg-rose-500 text-white rounded-xl shrink-0 mt-0.5 shadow-xs font-black text-sm">
            🚨
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm uppercase tracking-wide text-rose-950">
                🚨 ALERT: SUSUT PEMOTONGAN SAAT INI MELEBIHI 2.00%! ({live.lossPercent.toFixed(2)}%)
              </h4>
              <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                {live.lossPercent.toFixed(2)}% (&gt; 2.00%)
              </span>
            </div>
            <p className="text-xs mt-1 text-rose-800 leading-relaxed">
              Penyusutan dari proses pemotongan aktif saat ini ({live.loss.toFixed(2)} Kg) telah mencapai <strong>{live.lossPercent.toFixed(2)}%</strong> dari total bahan baku ({activeItem?.weightAfterThawing?.toFixed(2)} Kg). Angka ini telah melampaui toleransi standar <strong>2.00%</strong>.
            </p>
          </div>
        </div>
      )}

      {activeItemId && activeItem ? (
        /* --- ACTIVE FABRICATION INTERACTIVE SCREEN --- */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-250">
          <div className="bg-slate-900 text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs bg-emerald-500 text-slate-950 font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                Tahap 3: Pemotongan (Segmentasi)
              </span>
              <h2 className="text-xl font-bold">{activeItem.name}</h2>
              <p className="text-slate-300 text-sm mt-1">
                Berat Bahan Baku untuk Dipotong: <strong className="text-white text-base">{activeItem.weightAfterThawing?.toFixed(2)} Kg</strong>
              </p>
            </div>
            
            {/* Interactive plan & purpose options for butcher */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 max-w-md w-full space-y-3">
              <div>
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  📋 Rencana Potongan / Pabrikasi:
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={activePlan}
                    onChange={(e) => {
                      const newPlan = e.target.value;
                      setActivePlan(newPlan);
                      if (tempSegments.length === 1) {
                        setTempSegments([{ ...tempSegments[0], segmentName: newPlan }]);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {allPlans.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>

                  {/* Plus button to add custom plan */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPlan(!showAddPlan);
                      setShowDeletePlanList(false);
                    }}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      showAddPlan
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                        : 'bg-slate-900 text-emerald-400 border-slate-700 hover:bg-slate-800'
                    }`}
                    title="Tambah Rencana Potong Baru"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {/* Trash button to delete custom plan */}
                  <button
                    type="button"
                    onClick={() => {
                      if (customPlans.includes(activePlan)) {
                        handleDeleteCustomPlan(activePlan);
                      } else if (customPlans.length > 0) {
                        setShowDeletePlanList(!showDeletePlanList);
                        setShowAddPlan(false);
                      } else {
                        alert('Belum ada rencana potong kustom yang ditambahkan. Rencana default bawaan tidak dapat dihapus.');
                      }
                    }}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      customPlans.includes(activePlan)
                        ? 'bg-rose-950/80 text-rose-300 border-rose-700 hover:bg-rose-900'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-rose-400'
                    }`}
                    title={
                      customPlans.includes(activePlan)
                        ? `Hapus rencana kustom "${activePlan}"`
                        : 'Hapus Rencana Potong Kustom'
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline input for adding custom plan */}
                {showAddPlan && (
                  <div className="mt-2.5 p-2 bg-slate-900 rounded-lg border border-emerald-500/50 flex items-center gap-1.5 animate-in fade-in duration-150">
                    <input
                      type="text"
                      placeholder="Nama rencana potong baru..."
                      value={newPlanText}
                      onChange={(e) => setNewPlanText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomPlan();
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-white text-xs rounded-md focus:outline-hidden font-bold uppercase"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPlan}
                      className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer"
                      title="Simpan"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Inline deletion list if clicked Trash on non-custom activePlan */}
                {showDeletePlanList && customPlans.length > 0 && (
                  <div className="mt-2.5 p-2 bg-slate-900 rounded-lg border border-slate-700 space-y-1.5 text-xs animate-in fade-in duration-150">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block px-1">
                      Pilih Rencana Kustom yang Dihapus:
                    </span>
                    {customPlans.map((cp) => (
                      <div key={cp} className="flex items-center justify-between p-1.5 bg-slate-950 rounded border border-slate-800">
                        <span className="font-bold text-white uppercase text-[11px]">{cp}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomPlan(cp)}
                          className="text-rose-400 hover:text-rose-200 p-1 hover:bg-rose-950 rounded cursor-pointer"
                          title={`Hapus ${cp}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-slate-700/80">
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                  🎯 Tujuan Buka Daging (Peruntukan):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePurpose('UNTUK PESANAN')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activePurpose === 'UNTUK PESANAN'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-2xs font-extrabold'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    🛍️ Untuk Pesanan
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePurpose('UNTUK DISPLAY')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activePurpose === 'UNTUK DISPLAY'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-2xs font-extrabold'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    🏪 Untuk Display
                  </button>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveFabrication} className="p-6 space-y-6">
            {errorMsg && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-2 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-slate-700">Daftar Segmen Hasil Potongan</span>
                <button
                  type="button"
                  onClick={handleAddSegmentRow}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-emerald-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Segmen Potongan Manual
                </button>
              </div>

              {/* Segment rows */}
              <div className="space-y-3">
                {tempSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center"
                  >
                    <span className="flex-none flex items-center justify-center w-8 h-8 bg-slate-200 text-slate-700 font-bold rounded-full text-sm">
                      {idx + 1}
                    </span>

                    {/* Segment Name */}
                    <div className="flex-1 w-full">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                          Nama Hasil Potongan
                        </label>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Terhubung: {activeItem.plannedFabrication}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder={`Contoh: ${activeItem.plannedFabrication}`}
                        value={seg.segmentName}
                        onChange={(e) => handleSegmentChange(idx, 'segmentName', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                      {/* Quick presets for butcher */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => handleSegmentChange(idx, 'segmentName', activeItem.plannedFabrication)}
                          className="text-[10px] px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded font-semibold transition-all cursor-pointer"
                        >
                          + {activeItem.plannedFabrication}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSegmentChange(idx, 'segmentName', `Tetelan / Sisa ${activeItem.plannedFabrication}`)}
                          className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold transition-all cursor-pointer"
                        >
                          + Tetelan / Sisa {activeItem.plannedFabrication}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSegmentChange(idx, 'segmentName', 'Fat Trim / Lemak')}
                          className="text-[10px] px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-semibold transition-all cursor-pointer"
                        >
                          + Fat Trim / Lemak
                        </button>

                        {/* Per-segment purpose toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const current = seg.purpose || activePurpose;
                            const next = current === 'UNTUK PESANAN' ? 'UNTUK DISPLAY' : 'UNTUK PESANAN';
                            const updated = [...tempSegments];
                            updated[idx] = { ...updated[idx], purpose: next };
                            setTempSegments(updated);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded font-black border transition-all cursor-pointer ml-auto flex items-center gap-1 ${
                            (seg.purpose || activePurpose) === 'UNTUK PESANAN'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold'
                              : 'bg-emerald-600 text-white border-emerald-500 font-extrabold'
                          }`}
                          title="Klik untuk ubah peruntukan khusus segmen ini"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Peruntukan: {(seg.purpose || activePurpose) === 'UNTUK PESANAN' ? '🛍️ Pesanan' : '🏪 Display'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Actual weight */}
                    <div className="w-full md:w-48">
                      <label className="block text-[10px] font-semibold text-amber-700 uppercase mb-1">Berat Real Timbangan (Kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Masukkan berat real"
                        value={seg.actualWeight}
                        onChange={(e) => handleSegmentChange(idx, 'actualWeight', e.target.value)}
                        className="w-full px-3 py-2 bg-amber-50 border-2 border-amber-300 focus:border-amber-500 rounded-lg text-sm font-bold text-slate-900"
                      />
                    </div>

                    {/* Trash */}
                    <button
                      type="button"
                      onClick={() => handleRemoveSegmentRow(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg self-end md:self-center transition-all cursor-pointer"
                      title="Hapus Segmen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SISA BAHAN & ALIKAN KE DISPLAY CARD */}
            {live.loss > 0.01 && (
              <div className="bg-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-950 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-black shrink-0 shadow-xs">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span>Terdapat Sisa Bahan Belum Diprofilkan:</span>
                      <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-mono text-base font-black border border-amber-300">
                        {live.loss.toFixed(2)} Kg
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Bahan baku ({activeItem.weightAfterThawing?.toFixed(2)} Kg) baru terpakai {live.totalActual.toFixed(2)} Kg ({activePurpose}). Sisa <strong>{live.loss.toFixed(2)} Kg</strong> dapat langsung dialihkan sebagai Stok Display toko agar tidak tercatat sebagai susut pemotongan.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const sisaName = activePurpose === 'UNTUK PESANAN'
                      ? `Sisa Potong / Tetelan Display (${activePlan})`
                      : `Potongan Display Tambahan (${activePlan})`;
                    setTempSegments([
                      ...tempSegments,
                      {
                        segmentName: sisaName,
                        targetWeight: live.loss.toFixed(2),
                        actualWeight: live.loss.toFixed(2),
                        purpose: 'UNTUK DISPLAY',
                      },
                    ]);
                  }}
                  className="px-4 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 border border-amber-400"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Alihkan Sisa ({live.loss.toFixed(2)} Kg) ke Display 🏪</span>
                </button>
              </div>
            )}

            {/* LIVE PREVIEW SHRINAKGE CALCULATOR */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-900 text-white rounded-xl">
              <div>
                <span className="text-slate-400 text-xs">Total Berat Tercatat:</span>
                <p className="text-xl font-bold">{live.totalActual.toFixed(2)} / {activeItem.weightAfterThawing?.toFixed(2)} Kg</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Total Susut Pemotongan:</span>
                <p className={`text-xl font-bold ${live.lossPercent <= safeFabricationLossPercent ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {live.loss.toFixed(2)} Kg ({live.lossPercent.toFixed(1)}%)
                </p>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-amber-400 text-xs flex items-center gap-1 font-semibold">
                  <Info className="w-3.5 h-3.5" /> Susut Rata-Rata per Segmen:
                </span>
                <p className="text-xl font-bold text-amber-300">{live.lossPerSegment.toFixed(3)} Kg / Segmen</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => setActiveItemId(null)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer"
              >
                Batal & Kembali
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Simpan & Selesaikan Pabrikasi
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* --- MAIN LIST VIEW OF READY ITEMS --- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* List of pending fabrications (Col-8) */}
          <div className="lg:col-span-8 space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Bahan Siap Potong ({readyItems.length})</h3>

            {readyItems.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-slate-600 font-bold">Semua daging telah dipabrikasi!</p>
                <p className="text-slate-400 text-xs mt-1">Belum ada daging baru yang selesai dithawing dari antrian.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {readyItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-md border border-amber-200">
                          Siap Potong
                        </span>
                        <span className="text-xs text-slate-400">Thawing Selesai: {new Date(item.thawingEndTime || '').toLocaleTimeString()}</span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mt-1.5">{item.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>Berat Bersih (Kering): <strong>{item.weightAfterThawing?.toFixed(2)} Kg</strong></span>
                        <span>•</span>
                        <span>Rencana: <strong>{item.plannedFabrication}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartFabrication(item)}
                      className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer text-base shrink-0 self-end md:self-auto"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Gas Potong 🔪
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fabrication Shrinkage Stats Window (Col-4) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-1.5">
                <Scale className="text-amber-500 w-5 h-5" />
                Window Susut Pabrikasi
              </h3>
              <p className="text-slate-500 text-xs mb-4">
                Susut pabrikasi diakibatkan oleh serpihan potongan, lemak terbuang, atau serat daging kering. Batas maksimal toleransi adalah <strong>{safeFabricationLossPercent}%</strong>.
              </p>

              <div className="space-y-3">
                {completedBatchGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenEditPlanModal?.()}
                    className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Ubah Rencana Potong (Error Correction)</span>
                  </button>
                )}

                {completedBatchGroups.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                    Belum ada data pabrikasi yang diselesaikan hari ini.
                  </p>
                ) : (
                  completedBatchGroups.map((group) => {
                    const isSafe = group.lossPercent <= safeFabricationLossPercent;

                    return (
                      <div key={group.itemId} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded-md border border-emerald-200 shrink-0">
                              SELESAI
                            </span>
                            <span className="truncate">{group.itemName}</span>
                          </div>
                          <span className={isSafe ? 'text-emerald-600' : 'text-red-600'}>
                            -{group.loss.toFixed(2)} Kg ({group.lossPercent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[10px]">
                          <span>Bahan: {group.totalTarget.toFixed(1)} Kg</span>
                          <span>Hasil Segmen: {group.totalActual.toFixed(1)} Kg</span>
                        </div>
                        
                        {/* Display custom division from user's formula */}
                        <div className="bg-slate-100 p-1.5 rounded-md text-[10px] text-slate-600 flex justify-between items-center">
                          <span>Jumlah Segmen: <strong>{group.numSegments} Bagian</strong></span>
                          <span>Beban Susut/Segmen: <strong className="text-amber-700">{group.lossPerSeg.toFixed(3)} Kg</strong></span>
                        </div>

                        {/* Rencana Potong & Edit Button */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                          <span className="text-[10px] text-slate-500 font-medium truncate max-w-[170px]">
                            Rencana: <strong className="text-slate-800 uppercase">{group.plannedFabrication}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenEditPlanModal?.(group.itemId)}
                            className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded text-[10px] flex items-center gap-1 transition-all cursor-pointer border border-amber-300 shrink-0"
                            title="Ubah Rencana Potong jika terjadi human error"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Ubah Rencana</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
