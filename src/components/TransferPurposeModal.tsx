import React, { useState } from 'react';
import { ThawingItem, FabricationSegment } from '../types';
import { ArrowRightLeft, X, Check, AlertCircle, ShoppingBag, Store, Scale, Sparkles, Split } from 'lucide-react';

interface TransferPurposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ThawingItem[];
  segments: FabricationSegment[];
  onTransferPurpose: (
    id: string,
    isSegment: boolean,
    targetPurpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY',
    transferWeightKg?: number
  ) => void;
}

export default function TransferPurposeModal({
  isOpen,
  onClose,
  items,
  segments,
  onTransferPurpose,
}: TransferPurposeModalProps) {
  if (!isOpen) return null;

  const [selectedType, setSelectedType] = useState<'item' | 'segment'>('item');
  const [selectedId, setSelectedId] = useState<string>('');
  const [transferMode, setTransferMode] = useState<'full' | 'partial'>('partial');
  const [transferWeightInput, setTransferWeightInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active items & segments
  const activeItems = items.filter((i) => i.status !== 'pabrikasi_done');
  const activeSegments = segments.filter((s) => s.actualWeight > 0);

  const selectedItem = activeItems.find((i) => i.id === selectedId);
  const selectedSegment = activeSegments.find((s) => s.id === selectedId);

  const currentPurpose = selectedType === 'item'
    ? selectedItem?.openingPurpose || 'UNTUK DISPLAY'
    : selectedSegment?.openingPurpose || 'UNTUK DISPLAY';

  const currentWeight = selectedType === 'item'
    ? (selectedItem?.weightAfterThawing ?? selectedItem?.weightBeforeThawing ?? 0)
    : (selectedSegment?.actualWeight ?? 0);

  const currentName = selectedType === 'item'
    ? selectedItem?.name || ''
    : selectedSegment?.segmentName || '';

  const targetPurpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY' =
    currentPurpose === 'UNTUK PESANAN' ? 'UNTUK DISPLAY' : 'UNTUK PESANAN';

  const handleSelectTarget = (type: 'item' | 'segment', id: string) => {
    setSelectedType(type);
    setSelectedId(id);
    setErrorMsg('');
    setSuccessMsg('');
    setTransferWeightInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedId) {
      setErrorMsg('Harap pilih salah satu bahan atau segmen daging yang akan dialihkan!');
      return;
    }

    if (currentWeight <= 0) {
      setErrorMsg('Stok berat bahan yang dipilih 0 Kg, tidak dapat dialihkan!');
      return;
    }

    let transferWeight: number | undefined = undefined;

    if (transferMode === 'partial') {
      const parsed = parseFloat(transferWeightInput);
      if (isNaN(parsed) || parsed <= 0) {
        setErrorMsg('Harap masukkan jumlah berat kelebihan (Kg) yang valid!');
        return;
      }
      if (parsed >= currentWeight) {
        setErrorMsg(
          `Jumlah alihan (${parsed} Kg) sama dengan/melebihi total berat (${currentWeight.toFixed(2)} Kg). Gunakan opsi "Alihkan Seluruhnya" untuk memindahkan total stok.`
        );
        return;
      }
      transferWeight = parsed;
    }

    onTransferPurpose(selectedId, selectedType === 'segment', targetPurpose, transferWeight);

    const weightText = transferWeight ? `${transferWeight.toFixed(2)} Kg` : `${currentWeight.toFixed(2)} Kg`;
    const fromText = currentPurpose === 'UNTUK PESANAN' ? 'UNTUK PESANAN' : 'UNTUK DISPLAY';
    const toText = targetPurpose === 'UNTUK PESANAN' ? 'UNTUK PESANAN' : 'UNTUK DISPLAY';

    setSuccessMsg(
      `Berhasil mengalihkan ${weightText} daging "${currentName}" dari ${fromText} ➔ ${toText}!`
    );
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Alihkan Peruntukan Daging (Pesanan ⇆ Display)
              </h2>
              <p className="text-xs text-slate-400">
                Pindahkan kelebihan bahan dari pesanan ke display toko, atau sebaliknya dari display ke pesanan.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-2xl border border-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 text-xs rounded-2xl border border-emerald-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              1. Pilih Jenis Daging yang Dialihkan
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setSelectedType('item');
                  setSelectedId('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedType === 'item'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>🥩 Bahan Daging / Thawing ({activeItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('segment');
                  setSelectedId('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedType === 'segment'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>🔪 Hasil Segmen Potongan ({activeSegments.length})</span>
              </button>
            </div>
          </div>

          {/* Target Item Selection */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              2. Pilih Daging / Segmen *
            </label>

            {selectedType === 'item' ? (
              activeItems.length === 0 ? (
                <div className="p-4 bg-slate-50 text-slate-500 text-xs rounded-xl text-center border border-dashed border-slate-200">
                  Tidak ada bahan daging aktif saat ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                  {activeItems.map((item) => {
                    const isSelected = selectedId === item.id;
                    const purpose = item.openingPurpose || 'UNTUK DISPLAY';
                    const weight = item.weightAfterThawing ?? item.weightBeforeThawing;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectTarget('item', item.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-slate-900 line-clamp-1">{item.name}</span>
                          {purpose === 'UNTUK PESANAN' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                              🛍️ PESANAN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                              🏪 DISPLAY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium pt-1 border-t border-slate-100">
                          <span>Rencana: {item.plannedFabrication || 'PENDING'}</span>
                          <span className="font-bold text-slate-900">{weight.toFixed(2)} Kg</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : activeSegments.length === 0 ? (
              <div className="p-4 bg-slate-50 text-slate-500 text-xs rounded-xl text-center border border-dashed border-slate-200">
                Belum ada segmen potongan aktif saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                {activeSegments.map((seg) => {
                  const isSelected = selectedId === seg.id;
                  const purpose = seg.openingPurpose || 'UNTUK DISPLAY';

                  return (
                    <div
                      key={seg.id}
                      onClick={() => handleSelectTarget('segment', seg.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-slate-900 line-clamp-1">{seg.segmentName}</span>
                        {purpose === 'UNTUK PESANAN' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                            🛍️ PESANAN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                            🏪 DISPLAY
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium pt-1 border-t border-slate-100">
                        <span>Pabrikasi: {seg.plannedFabrication}</span>
                        <span className="font-bold text-slate-900">{seg.actualWeight.toFixed(2)} Kg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Item Preview & Transfer Target */}
          {selectedId && (
            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-medium">Status & Peruntukan Saat Ini:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{currentName}</span>
                  <span className="font-mono text-emerald-400 font-black">({currentWeight.toFixed(2)} Kg)</span>
                </div>
              </div>

              {/* Transition Banner */}
              <div className="flex items-center justify-center gap-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-lg text-xs font-extrabold">
                  {currentPurpose === 'UNTUK PESANAN' ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5" /> UNTUK PESANAN
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" /> UNTUK DISPLAY
                    </span>
                  )}
                </div>

                <ArrowRightLeft className="w-4 h-4 text-slate-400 animate-pulse" />

                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-slate-950 rounded-lg text-xs font-black shadow-xs">
                  {targetPurpose === 'UNTUK DISPLAY' ? (
                    <span className="flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" /> ALIHKAN KE DISPLAY 🏪
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5" /> ALIHKAN KE PESANAN 🛍️
                    </span>
                  )}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                  3. Berapa Banyak Daging yang Dialihkan?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferMode('partial')}
                    className={`p-3 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                      transferMode === 'partial'
                        ? 'bg-emerald-600 border-emerald-400 text-white font-bold shadow-xs'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-extrabold mb-0.5">
                      <Split className="w-3.5 h-3.5" /> Alihkan Kelebihan / Sebagian (Kg)
                    </div>
                    <p className="text-[10px] opacity-80">Pecah stok & alihkan kelebihan pesanan saja</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferMode('full')}
                    className={`p-3 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                      transferMode === 'full'
                        ? 'bg-emerald-600 border-emerald-400 text-white font-bold shadow-xs'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-extrabold mb-0.5">
                      <Check className="w-3.5 h-3.5" /> Alihkan Seluruh Stok ({currentWeight.toFixed(2)} Kg)
                    </div>
                    <p className="text-[10px] opacity-80">Ubah peruntukan total seluruh bahan ini</p>
                  </button>
                </div>

                {/* Partial Input Field */}
                {transferMode === 'partial' && (
                  <div className="mt-3 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <label className="block text-xs font-bold text-emerald-400">
                      Masukkan Berat Kelebihan yang Dialihkan (Kg) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        placeholder={`Contoh: 2.5 (Maksimal ${currentWeight.toFixed(2)} Kg)`}
                        value={transferWeightInput}
                        onChange={(e) => setTransferWeightInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-sm focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold text-xs">Kg</span>
                    </div>

                    {transferWeightInput && !isNaN(parseFloat(transferWeightInput)) && parseFloat(transferWeightInput) > 0 && parseFloat(transferWeightInput) < currentWeight && (
                      <div className="p-2 bg-slate-900 rounded-lg text-[11px] text-slate-300 space-y-1 font-mono border border-slate-800">
                        <div className="flex justify-between">
                          <span>Sisa di {currentPurpose === 'UNTUK PESANAN' ? 'PESANAN' : 'DISPLAY'}:</span>
                          <span className="font-bold text-amber-300">
                            {(currentWeight - parseFloat(transferWeightInput)).toFixed(2)} Kg
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pindah ke {targetPurpose === 'UNTUK PESANAN' ? 'PESANAN' : 'DISPLAY'}:</span>
                          <span className="font-bold text-emerald-400">
                            {parseFloat(transferWeightInput).toFixed(2)} Kg
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!selectedId}
              className={`flex-1 py-3 font-extrabold text-white rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !selectedId
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Proses Alihkan Peruntukan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
