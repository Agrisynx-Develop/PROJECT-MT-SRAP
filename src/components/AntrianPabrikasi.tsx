import React, { useState, useEffect } from 'react';
import { ThawingItem } from '../types';
import { processHighResImage } from '../utils/imageCompressor';
import { Clock, Scale, ArrowRight, Play, AlertCircle, Sparkles, Upload, ArrowRightLeft, Camera, Check, Loader2, Plus } from 'lucide-react';

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
  onAddItem?: (newItem: any) => void;
  onNavigateToSegmentasi?: () => void;
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
  onAddItem,
  onNavigateToSegmentasi,
}: AntrianPabrikasiProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [weightAfter, setWeightAfter] = useState('');
  const [thawingImage, setThawingImage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Quick Add Item State for Butcher
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('DAGING FRESH');
  const [addPlan, setAddPlan] = useState('D.sapi pot. rdang');
  const [addWeight, setAddWeight] = useState('');
  const [addPurpose, setAddPurpose] = useState<'UNTUK DISPLAY' | 'UNTUK PESANAN'>('UNTUK DISPLAY');
  const [addImage, setAddImage] = useState('');
  const [addError, setAddError] = useState('');

  const COMMON_TEMPLATES = [
    { name: 'HQ 41/42/44/45', category: 'DAGING FRESH', plan: 'D.sapi pot. rdang' },
    { name: 'FQ SHANK / 60', category: 'DAGING FRESH', plan: 'Daging Rendang Shankle' },
    { name: 'DG RNDG BEKU 1kg', category: 'DAGING FRESH', plan: 'D.sapi pot. rdang' },
    { name: 'D Premium lokal', category: 'DAGING PREMIUM', plan: 'D Premium lokal' },
    { name: 'FRIBOY / Prem 2', category: 'DAGING PREMIUM', plan: 'FRIBOY / Daging Prem 2' },
    { name: 'Rawon Curah (FQ 106/105)', category: 'RAWON FRESH', plan: 'Rawon Curah' },
  ];

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      setAddError('Nama bahan wajib diisi!');
      return;
    }
    const w = parseFloat(addWeight);
    if (isNaN(w) || w <= 0) {
      setAddError('Berat bahan awal harus berupa angka positif!');
      return;
    }
    if (onAddItem) {
      onAddItem({
        name: addName.trim(),
        pabrikasiCategory: addCategory,
        weightBeforeThawing: w,
        weightAfterThawing: w,
        plannedFabrication: addPlan,
        openingPurpose: addPurpose,
        image: addImage || 'placeholder',
        status: 'thawing',
      });
      setIsAddModalOpen(false);
      setAddName('');
      setAddWeight('');
      setAddImage('');
      setAddError('');
    }
  };

  const isThawingStatus = (s?: string) => {
    if (!s) return true;
    const lower = s.toLowerCase().trim();
    return lower === 'thawing' || lower === 'sedang thawing' || lower === 'antrian' || lower === 'proses thawing';
  };
  const isReadyStatus = (s?: string) => {
    if (!s) return false;
    const lower = s.toLowerCase().trim();
    return lower === 'pabrikasi_ready' || lower === 'siap potong' || lower === 'ready';
  };
  const isDoneStatus = (s?: string) => {
    if (!s) return false;
    const lower = s.toLowerCase().trim();
    return lower === 'pabrikasi_done' || lower === 'selesai' || lower === 'done';
  };

  const thawingItems = items.filter((i) => isThawingStatus(i.status));
  const readyItems = items.filter((i) => isReadyStatus(i.status) || isDoneStatus(i.status));

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            ⏳ Antrian & Thawing Daging
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Daftar daging yang sedang dilarutkan (cairkan es) sebelum proses pemotongan atau pabrikasi dimulai.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onAddItem && (
            <button
              id="btn-add-thawing-item"
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Input Bahan Thawing Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner for items ready to segment */}
      {readyItems.filter((i) => isReadyStatus(i.status)).length > 0 && onNavigateToSegmentasi && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-950">
                {readyItems.filter((i) => isReadyStatus(i.status)).length} Bahan Selesai Thawing & Siap Masuk Segmentasi Potong!
              </p>
              <p className="text-[11px] text-emerald-700 font-medium">
                Daging siap ditimbang potongan segmennya dan dimasukkan ke rencana display/pesanan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToSegmentasi}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <span>Lanjut ke Segmentasi Potong</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

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
                        <span className="text-[11px] bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-md inline-block border border-red-200">
                          🏬 {item.storeName || (item.storeId === '1' ? 'TDN CKR' : item.storeId) || 'TDN CKR'}
                        </span>
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

      {/* Quick Input Bahan Thawing Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 text-red-700 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Input Bahan Daging Thawing</h3>
                  <p className="text-[11px] text-slate-500">Bahan akan langsung masuk ke antrian thawing pada semua akun.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Templates */}
            <div className="mb-4">
              <span className="text-xs font-bold text-slate-600 block mb-2">Pilih Cepat Template Bahan:</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAddName(tmpl.name);
                      setAddCategory(tmpl.category);
                      setAddPlan(tmpl.plan);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                      addName === tmpl.name
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300'
                    }`}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {addError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Bahan Daging *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: HQ 41/42/44/45, Tenderloin, dll"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-red-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-red-500"
                  >
                    <option value="DAGING FRESH">DAGING FRESH</option>
                    <option value="DAGING PREMIUM">DAGING PREMIUM</option>
                    <option value="RAWON FRESH">RAWON FRESH</option>
                    <option value="SHANKLE">SHANKLE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rencana Potong Target</label>
                  <input
                    type="text"
                    value={addPlan}
                    onChange={(e) => setAddPlan(e.target.value)}
                    placeholder="Contoh: D.sapi pot. rdang"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Berat Bahan Awal (Kg) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={addWeight}
                      onChange={(e) => setAddWeight(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:border-red-500"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">Kg</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tujuan Distribusi</label>
                  <select
                    value={addPurpose}
                    onChange={(e) => setAddPurpose(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-red-500"
                  >
                    <option value="UNTUK DISPLAY">UNTUK DISPLAY (Toko)</option>
                    <option value="UNTUK PESANAN">UNTUK PESANAN (Khusus)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Foto Timbangan Awal (Opsional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-red-400 bg-slate-50 py-3 px-2 rounded-xl cursor-pointer transition">
                    <Camera className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="text-[11px] text-slate-600 font-bold">Unggah Bukti Timbangan Awal</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          try {
                            const opt = await processHighResImage(f, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
                            setAddImage(opt);
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {addImage && (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      <img src={addImage} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAddImage('')}
                        className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Mulai Thawing Bahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
