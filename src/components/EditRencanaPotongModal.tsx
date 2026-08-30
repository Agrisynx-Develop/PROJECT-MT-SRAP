import React, { useState, useEffect } from 'react';
import { ThawingItem, FabricationSegment } from '../types';
import { X, Edit3, CheckCircle2, AlertCircle, RefreshCw, Scissors, Layers, Plus, Trash2 } from 'lucide-react';

interface EditRencanaPotongModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ThawingItem[];
  segments: FabricationSegment[];
  onUpdatePlan: (itemId: string, newPlanName: string, updateSegmentNames: boolean) => void;
  preselectedItemId?: string | null;
}

export default function EditRencanaPotongModal({
  isOpen,
  onClose,
  items,
  segments,
  onUpdatePlan,
  preselectedItemId,
}: EditRencanaPotongModalProps) {
  // Filter items that are completed or ready
  const completedItems = items.filter(
    (item) => item.status === 'pabrikasi_done' || item.status === 'pabrikasi_ready'
  );

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [newPlanName, setNewPlanName] = useState<string>('');
  const [customPlanInput, setCustomPlanInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [updateSegmentNames, setUpdateSegmentNames] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Standard Plan List
  const DEFAULT_PLANS = [
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

  const allAvailablePlans = Array.from(
    new Set([...DEFAULT_PLANS, ...customPlans, ...completedItems.map((i) => i.plannedFabrication)].filter(Boolean))
  );

  // Sync preselected item or reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setIsCustomMode(false);
      setCustomPlanInput('');

      if (preselectedItemId && completedItems.some((i) => i.id === preselectedItemId)) {
        setSelectedItemId(preselectedItemId);
      } else if (completedItems.length > 0) {
        setSelectedItemId(completedItems[0].id);
      } else {
        setSelectedItemId('');
      }
    }
  }, [isOpen, preselectedItemId, items]);

  // Sync current plan when selectedItemId changes
  const activeItem = completedItems.find((i) => i.id === selectedItemId);
  useEffect(() => {
    if (activeItem) {
      setNewPlanName(activeItem.plannedFabrication || DEFAULT_PLANS[0]);
    }
  }, [selectedItemId]);

  if (!isOpen) return null;

  const childSegments = segments.filter((s) => s.itemId === selectedItemId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedItemId || !activeItem) {
      setErrorMsg('Pilih daging / bahan yang ingin diubah Rencana Potongnya!');
      return;
    }

    const targetPlan = isCustomMode ? customPlanInput.trim().toUpperCase() : newPlanName.trim().toUpperCase();

    if (!targetPlan) {
      setErrorMsg('Nama Rencana Potong baru tidak boleh kosong!');
      return;
    }

    if (targetPlan === (activeItem.plannedFabrication || '').trim().toUpperCase()) {
      setErrorMsg(`Bahan ini sudah terdaftar dengan Rencana Potong "${targetPlan}". Tidak ada perubahan.`);
      return;
    }

    // Save custom plan if new
    if (isCustomMode && targetPlan) {
      if (!customPlans.includes(targetPlan) && !DEFAULT_PLANS.includes(targetPlan)) {
        const updatedCustom = [...customPlans, targetPlan];
        setCustomPlans(updatedCustom);
        try {
          localStorage.setItem('butcher_custom_plans', JSON.stringify(updatedCustom));
        } catch (err) {
          console.error('Failed to save custom plan:', err);
        }
      }
    }

    // Trigger update
    onUpdatePlan(selectedItemId, targetPlan, updateSegmentNames);

    setSuccessMsg(`Berhasil mengubah Rencana Potong "${activeItem.name}" menjadi "${targetPlan}"!`);
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Koreksi Rencana Potong</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono border border-amber-500/30">
                  Antisipasi Error
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Ubah target Rencana Potong pada bahan yang telah melewati / menyelesaikan segmentasi potong.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3 shrink-0 text-xs text-amber-950">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Guna Fitur Ini:</strong> Jika terjadi <em>human error</em> (butcher salah pilih rencana potong saat segmentasi/thawing), gunakan menu ini untuk memindahkan item dan seluruh segmen turunannya ke Rencana Potong yang benar secara otomatis.
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {completedItems.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Scissors className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">Belum ada bahan yang dipabrikasi/dipotong.</p>
              <p className="text-xs text-slate-400 mt-1">Lakukan segmentasi potong terlebih dahulu pada menu Segmentasi Potong.</p>
            </div>
          ) : (
            <>
              {/* Select Item to Correct */}
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-700 tracking-wider mb-1.5">
                  1. Pilih Bahan Daging / Batch Selesai Segmentasi *
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {completedItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ➔ Currently: {item.plannedFabrication} ({item.weightAfterThawing?.toFixed(2) || item.weightBeforeThawing.toFixed(2)} Kg)
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Item Overview Card */}
              {activeItem && (
                <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Nama Bahan Daging:</span>
                      <strong className="text-sm text-emerald-400 font-extrabold">{activeItem.name}</strong>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-black uppercase">
                      Status: {activeItem.status === 'pabrikasi_done' ? 'Selesai Pabrikasi' : 'Siap Potong'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-slate-300">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Berat Bahan Baku:</span>
                      <strong className="text-white text-xs">
                        {(activeItem.weightAfterThawing || activeItem.weightBeforeThawing).toFixed(2)} Kg
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Rencana Potong Saat Ini:</span>
                      <strong className="text-amber-400 text-xs font-black uppercase">
                        {activeItem.plannedFabrication}
                      </strong>
                    </div>
                  </div>

                  {childSegments.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">
                        Daftar Segmen Hasil Potongan Terhubung ({childSegments.length} Segmen):
                      </span>
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {childSegments.map((seg, idx) => (
                          <div key={seg.id} className="p-1.5 bg-slate-950 rounded border border-slate-800 flex justify-between text-[11px]">
                            <span className="text-slate-200 truncate max-w-[280px]">
                              {idx + 1}. {seg.segmentName}
                            </span>
                            <span className="text-emerald-400 font-mono font-bold">
                              {seg.actualWeight.toFixed(2)} Kg
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Target New Rencana Potong Input */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold uppercase text-slate-700 tracking-wider">
                    2. Ubah Ke Rencana Potong Baru *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                  >
                    {isCustomMode ? '← Pilih dari Daftar Standard' : '+ Buat Rencana Potong Baru (Kustom)'}
                  </button>
                </div>

                {!isCustomMode ? (
                  <select
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-amber-300 focus:border-amber-500 rounded-xl text-sm font-black text-slate-900 uppercase focus:outline-hidden"
                  >
                    {allAvailablePlans.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="Masukkan nama rencana potong baru..."
                      value={customPlanInput}
                      onChange={(e) => setCustomPlanInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-emerald-400 focus:border-emerald-600 rounded-xl text-sm font-black text-slate-900 uppercase focus:outline-hidden"
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-500">
                      Rencana potong baru ini akan disimpan secara otomatis ke dalam pilihan menu kustom.
                    </p>
                  </div>
                )}
              </div>

              {/* Checkbox for auto-updating segment names */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                  <input
                    type="checkbox"
                    checked={updateSegmentNames}
                    onChange={(e) => setUpdateSegmentNames(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">
                      Perbarui Nama Segmen Potongan Turunan Otomatis
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      Jika dicentang, nama segmen potongan yang mengandung rencana lama akan otomatis disesuaikan dengan nama rencana baru.
                    </span>
                  </div>
                </label>
              </div>
            </>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={completedItems.length === 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Simpan Perubahan Rencana Potong
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
