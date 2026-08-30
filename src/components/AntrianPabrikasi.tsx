import React, { useState, useEffect } from 'react';
import { ThawingItem } from '../types';
import { processHighResImage } from '../utils/imageCompressor';
import { Clock, Scale, ArrowRight, Play, AlertCircle, Sparkles, Upload, ArrowRightLeft, Camera, Check, Loader2 } from 'lucide-react';

interface AntrianPabrikasiProps {
  items: ThawingItem[];
  onStartFabrication: (id: string, weightAfter: number, photoImage?: string) => void;
  safeThawingLossPercent: number;
  onTransferPurpose?: (
    id: string,
    isSegment: boolean,
    targetPurpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY',
    transferWeightKg?: number
  ) => void;
  onOpenTransferModal?: () => void;
}

// Custom running timer for each item that is in "thawing" state
function ThawingTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;

      if (diffMs < 0) return '00j 00m 00d';

      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      const pad = (num: number) => String(num).padStart(2, '0');
      return `${pad(hours)}j ${pad(minutes)}m ${pad(seconds)}d`;
    };

    setElapsed(calculateElapsed());
    const interval = setInterval(() => {
      setElapsed(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 border border-emerald-100">
      <Clock className="w-4 h-4 text-emerald-600 animate-spin-slow" />
      {elapsed}
    </span>
  );
}

export default function AntrianPabrikasi({
  items,
  onStartFabrication,
  safeThawingLossPercent,
  onTransferPurpose,
  onOpenTransferModal,
}: AntrianPabrikasiProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [weightAfter, setWeightAfter] = useState('');
  const [thawingImage, setThawingImage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const thawingItems = items.filter((i) => i.status === 'thawing');
  const readyItems = items.filter((i) => i.status === 'pabrikasi_ready' || i.status === 'pabrikasi_done');

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const handleOpenFabricate = (id: string) => {
    const found = items.find((i) => i.id === id);
    setSelectedItemId(id);
    setWeightAfter('');
    setThawingImage(found?.image && found.image !== 'placeholder' ? found.image : '');
    setErrorMsg('');
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMsg('');
      try {
        const optimized = await processHighResImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
        });
        setThawingImage(optimized);
      } catch (err) {
        console.error('Error optimizing photo in AntrianPabrikasi:', err);
        setErrorMsg('Gagal memproses foto.');
      }
    }
  };

  const handleConfirmFabricate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !selectedItem) return;

    const parsedWeight = parseFloat(weightAfter);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setErrorMsg('Harap masukkan angka berat yang valid!');
      return;
    }

    if (parsedWeight > selectedItem.weightBeforeThawing) {
      setErrorMsg(`Berat setelah thawing tidak boleh lebih besar dari berat awal (${selectedItem.weightBeforeThawing} Kg)!`);
      return;
    }

    // MANDATORY PHOTO VALIDATION
    if (!thawingImage) {
      setErrorMsg('⚠️ Foto bukti timbangan hasil thawing WAJIB diunggah (MANDATORY)!');
      return;
    }

    onStartFabrication(selectedItemId, parsedWeight, thawingImage);
    setSelectedItemId(null);
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          ⏳ Antrian & Thawing Daging
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Daftar daging yang sedang dilarutkan (cairkan es) sebelum proses pemotongan atau pabrikasi dimulai.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Thawing Queue (Col-8) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
            <span className="font-semibold text-slate-700">Daftar Thawing Berjalan ({thawingItems.length} Bahan)</span>
            <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-full border border-amber-200">
              Butuh Pengawasan Suhu
            </span>
          </div>

          {thawingItems.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-bold">Tidak ada bahan yang sedang thawing.</p>
              <p className="text-slate-400 text-xs mt-1">Silakan tambah bahan daging baru di menu Dashboard.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {thawingItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 hover:border-emerald-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail / Image preview */}
                    {item.image && item.image !== 'placeholder' ? (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-3xl shrink-0">
                        🥩
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{item.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5" /> Berat Awal: <strong>{item.weightBeforeThawing.toFixed(2)} Kg</strong>
                        </span>
                        <span>Operator: <strong className="text-slate-700">{item.butcherName}</strong></span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-1 rounded-md inline-block">
                          📋 Rencana: {item.plannedFabrication || 'PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                    {/* Dynamic clock timer */}
                    <ThawingTimer startTime={item.thawingStartTime} />

                    <button
                      onClick={() => handleOpenFabricate(item.id)}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Pabrikasi Sekarang
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thawing Loss Display Window (Col-4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-1.5">
              <Scale className="text-emerald-600 w-5 h-5" />
              Window Susut Thawing
            </h3>
            <p className="text-slate-500 text-xs mb-4">
              Susut pencairan es (Drip loss) idealnya berkisar antara <strong>2% - 4%</strong>. Jika lebih dari itu, daging dapat kehilangan terlalu banyak jus alami.
            </p>

            <div className="space-y-3">
              {readyItems.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                  Belum ada laporan susut thawing untuk hari ini.
                </p>
              ) : (
                readyItems.map((item) => {
                  const loss = typeof item.shrinkageThawing === 'number' && !isNaN(item.shrinkageThawing) ? item.shrinkageThawing : 0;
                  const lossPercent = typeof item.shrinkageThawingPercent === 'number' && !isNaN(item.shrinkageThawingPercent) ? item.shrinkageThawingPercent : 0;
                  const threshold = typeof safeThawingLossPercent === 'number' && safeThawingLossPercent > 0 ? safeThawingLossPercent : 2;
                  const isSafe = lossPercent <= threshold;
                  const rawBarWidth = threshold > 0 ? (lossPercent / (threshold * 2)) * 100 : 0;
                  const safeBarWidth = isNaN(rawBarWidth) || !isFinite(rawBarWidth) ? 0 : Math.min(100, Math.max(0, rawBarWidth));
                  const weightAwal = typeof item.weightBeforeThawing === 'number' && !isNaN(item.weightBeforeThawing) ? item.weightBeforeThawing : 0;
                  const weightKering = typeof item.weightAfterThawing === 'number' && !isNaN(item.weightAfterThawing) ? item.weightAfterThawing : weightAwal;

                  return (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span className="truncate max-w-[150px]">{item.name}</span>
                        <span className={isSafe ? 'text-emerald-600' : 'text-red-600'}>
                          -{loss.toFixed(2)} Kg ({lossPercent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Awal: {weightAwal.toFixed(1)} Kg</span>
                        <span>Kering: {weightKering.toFixed(1)} Kg</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${isSafe ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${safeBarWidth.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- PABRIKASI SEKARANG ACTION DIALOG MODAL --- */}
      {selectedItemId && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5">
              <span className="text-xs bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded-md mb-1.5 inline-block">
                Langkah 2: Timbang Daging Kering
              </span>
              <h3 className="text-lg font-bold">{selectedItem.name}</h3>
              <p className="text-slate-300 text-xs mt-1">Berat Timbangan Sebelum: {selectedItem.weightBeforeThawing.toFixed(2)} Kg</p>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmFabricate} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-xs flex items-start gap-2 border border-amber-100">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong>Instruksi untuk Butcher:</strong>
                  <p className="text-slate-600 mt-0.5">Tiriskan daging dari air es, keringkan dengan lap bersih, lalu letakkan di timbangan. Masukkan berat bersihnya di bawah ini.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Berat Hasil Thawing (Kg) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    placeholder="Contoh: 14.85"
                    value={weightAfter}
                    onChange={(e) => setWeightAfter(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 rounded-xl focus:bg-white focus:outline-hidden text-slate-900 text-lg font-bold"
                  />
                  <span className="absolute right-4 top-3 text-slate-400 font-bold text-lg">Kg</span>
                </div>
              </div>

              {/* Foto Daging / Timbangan Thawing */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-extrabold text-red-700 flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-red-600" />
                    Foto Hasil Thawing (Wajib / MANDATORY) *
                  </label>
                  <span className="text-[10px] font-black text-red-800 bg-red-100 px-2 py-0.5 rounded-md border border-red-300">
                    Mandatory
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/40 hover:bg-red-50 py-3 px-2 rounded-xl cursor-pointer transition-all">
                    <Upload className="w-5 h-5 text-red-500 mb-1" />
                    <span className="text-xs text-red-900 text-center font-bold">Ambil Foto / Unggah Bukti Timbangan *</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  {thawingImage && (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-2xs shrink-0">
                      <img src={thawingImage} alt="Foto Thawing" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setThawingImage('')}
                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Estimate Preview */}
              {weightAfter && parseFloat(weightAfter) > 0 && parseFloat(weightAfter) <= selectedItem.weightBeforeThawing && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between items-center border border-slate-100">
                  <span className="text-slate-500">Estimasi Susut Thawing:</span>
                  <span className="font-bold text-slate-800">
                    {(selectedItem.weightBeforeThawing - parseFloat(weightAfter)).toFixed(2)} Kg (
                    {(((selectedItem.weightBeforeThawing - parseFloat(weightAfter)) / selectedItem.weightBeforeThawing) * 100).toFixed(1)}%)
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemId(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  Proses & Potong <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
