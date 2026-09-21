import React, { useState, useEffect } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  UserAccount,
  Store
} from '../types';
import { processHighResImage } from '../utils/imageCompressor';
import {
  Beef,
  Scale,
  Clock,
  Play,
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Plus,
  ArrowRight,
  Sparkles,
  Scissors,
  CheckSquare,
  FileCheck,
  Image as ImageIcon,
  Lock,
  Save,
  AlertCircle
} from 'lucide-react';

interface ButcherViewProps {
  currentUser: UserAccount;
  currentStore?: Store;
  items: ThawingItem[];
  segments: FabricationSegment[];
  closingRecords: ClosingPlanRecord[];
  onAddItem: (newItem: Omit<ThawingItem, 'id' | 'status' | 'thawingStartTime' | 'createdAt'>) => void;
  onStartFabrication: (id: string, weightAfter: number, photoImage?: string) => void;
  onAddSegment: (segment: Omit<FabricationSegment, 'id' | 'createdAt'>) => void;
  onSaveClosingRecord: (record: Omit<ClosingPlanRecord, 'id' | 'timestamp'>) => void;
  safeThawingLossPercent: number;
}

// Running timer for thawing items
function ThawingTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calc = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - start);
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(hours)}j ${pad(minutes)}m ${pad(seconds)}d`;
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-mono text-xs font-semibold">
      <Clock className="w-3.5 h-3.5 animate-spin-slow text-amber-600" />
      {elapsed}
    </span>
  );
}

export default function ButcherView({
  currentUser,
  currentStore,
  items,
  segments,
  closingRecords,
  onAddItem,
  onStartFabrication,
  onAddSegment,
  onSaveClosingRecord,
  safeThawingLossPercent,
}: ButcherViewProps) {
  // Navigation Tabs for Butcher
  const [activeTab, setActiveTab] = useState<'antrian' | 'segmentasi' | 'closing' | 'tambah'>('antrian');

  // Add Item State
  const [namaBahan, setNamaBahan] = useState('');
  const [customNamaBahan, setCustomNamaBahan] = useState('');
  const [pabrikasiCat, setPabrikasiCat] = useState<'DAGING FRESH' | 'DAGING PREMIUM' | 'RAWON' | 'SHANKLE'>('DAGING FRESH');
  const [beratAwal, setBeratAwal] = useState('');
  const [rencanaPotong, setRencanaPotong] = useState('D.sapi pot. rdang');
  const [addPhoto, setAddPhoto] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  // Thawing Completion Modal State
  const [selectedThawId, setSelectedThawId] = useState<string | null>(null);
  const [beratSetelahThawing, setBeratSetelahThawing] = useState('');
  const [thawPhoto, setThawPhoto] = useState('');
  const [thawError, setThawError] = useState('');

  // Segmentasi Form State
  const [selectedItemForSeg, setSelectedItemForSeg] = useState<string>('');
  const [segName, setSegName] = useState('');
  const [targetWeightSeg, setTargetWeightSeg] = useState('');
  const [actualWeightSeg, setActualWeightSeg] = useState('');
  const [segSuccess, setSegSuccess] = useState(false);

  // Closing Form State (Per Rencana Potong)
  const [selectedPlanForClosing, setSelectedPlanForClosing] = useState('D.sapi pot. rdang');
  const [closingPhysicalWeight, setClosingPhysicalWeight] = useState('');
  const [closingPhoto, setClosingPhoto] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [closingError, setClosingError] = useState('');
  const [closingSuccess, setClosingSuccess] = useState(false);

  const selectedThawItem = items.find((i) => i.id === selectedThawId);
  const thawingItems = items.filter((i) => i.status === 'thawing' && !i.isCarryover);
  const readyItems = items.filter((i) => (i.status === 'pabrikasi_ready' || i.status === 'pabrikasi_done') && !i.isCarryover);

  // Common cuts list
  const STANDARD_PLANS = [
    { name: 'D.sapi pot. rdang', category: 'DAGING FRESH' },
    { name: 'Daging Rendang Shankle', category: 'SHANKLE' },
    { name: 'D Premium lokal', category: 'DAGING PREMIUM' },
    { name: 'Rawon Curah', category: 'RAWON' },
    { name: 'D.r. fresh member', category: 'DAGING FRESH' },
    { name: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM' },
  ];

  // Handle image upload from input file with High-Res Optimizer
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (s: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const optimized = await processHighResImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
        });
        setter(optimized);
      } catch (err) {
        console.error('Error optimizing photo:', err);
      }
    }
  };

  // Submit Add Thawing
  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = namaBahan === '__CUSTOM__' ? customNamaBahan.trim() : namaBahan;
    if (!finalName) {
      setAddError('Harap pilih atau isi nama bahan baku.');
      return;
    }
    const weight = parseFloat(beratAwal);
    if (isNaN(weight) || weight <= 0) {
      setAddError('Harap masukkan angka berat awal yang valid.');
      return;
    }

    onAddItem({
      name: finalName,
      pabrikasiCategory: pabrikasiCat,
      weightBeforeThawing: weight,
      plannedFabrication: rencanaPotong,
      image: addPhoto || '',
      pricePerKg: pabrikasiCat === 'DAGING PREMIUM' ? 155000 : pabrikasiCat === 'RAWON' ? 110000 : 125000,
    });

    setNamaBahan('');
    setCustomNamaBahan('');
    setBeratAwal('');
    setAddPhoto('');
    setAddError('');
    setAddSuccess(true);
    setTimeout(() => setAddSuccess(false), 3000);
    setActiveTab('antrian');
  };

  // Submit Confirm Thawing (MANDATORY PHOTO ENFORCEMENT)
  const handleConfirmThaw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThawId || !selectedThawItem) return;

    const parsedWeight = parseFloat(beratSetelahThawing);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setThawError('Harap masukkan angka berat timbangan setelah thawing.');
      return;
    }

    if (parsedWeight > selectedThawItem.weightBeforeThawing) {
      setThawError(`Berat setelah thawing tidak boleh melebihi berat awal (${selectedThawItem.weightBeforeThawing} Kg)!`);
      return;
    }

    // MANDATORY PHOTO REQUIREMENT FOR BUTCHER
    if (!thawPhoto) {
      setThawError('Wajib melampirkan / mengupload foto bukti timbangan setelah thawing!');
      return;
    }

    onStartFabrication(selectedThawId, parsedWeight, thawPhoto);
    setSelectedThawId(null);
    setBeratSetelahThawing('');
    setThawPhoto('');
    setThawError('');
  };

  // Submit Segmentasi
  const handleSaveSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForSeg) return;
    const parentItem = items.find((i) => i.id === selectedItemForSeg);
    if (!parentItem) return;

    const actual = parseFloat(actualWeightSeg);
    const target = parseFloat(targetWeightSeg) || actual;
    if (isNaN(actual) || actual <= 0) return;

    onAddSegment({
      itemId: parentItem.id,
      itemName: parentItem.name,
      segmentName: segName.trim() || `${parentItem.plannedFabrication} (Potongan)`,
      targetWeight: target,
      actualWeight: actual,
      periodicShrinkage: 0,
      plannedFabrication: parentItem.plannedFabrication,
      openingPurpose: 'UNTUK DISPLAY',
    });

    setSegName('');
    setTargetWeightSeg('');
    setActualWeightSeg('');
    setSegSuccess(true);
    setTimeout(() => setSegSuccess(false), 3000);
  };

  // Submit Closing Record per Plan (MANDATORY PHOTO ENFORCEMENT)
  const handleSaveClosing = (e: React.FormEvent) => {
    e.preventDefault();
    const actualStock = parseFloat(closingPhysicalWeight);
    if (isNaN(actualStock) || actualStock < 0) {
      setClosingError('Harap masukkan angka sisa stok fisik closing yang valid.');
      return;
    }

    // MANDATORY PHOTO REQUIREMENT FOR CLOSING
    if (!closingPhoto) {
      setClosingError('Wajib melampirkan foto timbangan/display fisik sisa stok closing!');
      return;
    }

    // Calculate system stock for this plan
    const todayPlanItems = items.filter(
      (i) => !i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(selectedPlanForClosing.toLowerCase())
    );
    const carryoverPlanItems = items.filter(
      (i) => i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(selectedPlanForClosing.toLowerCase())
    );
    const planSegs = segments.filter(
      (s) => (s.plannedFabrication || '').toLowerCase().includes(selectedPlanForClosing.toLowerCase())
    );

    const openingStockKg = carryoverPlanItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
    const newProcessedKg = todayPlanItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);
    const salesKg = planSegs.reduce((sum, s) => sum + (s.salesKg || 0), 0);
    const closingBySystem = Math.max(0, openingStockKg + newProcessedKg - salesKg);
    const susutJualKg = Math.max(0, closingBySystem - actualStock);

    const planObj = STANDARD_PLANS.find((p) => p.name === selectedPlanForClosing);

    onSaveClosingRecord({
      storeId: currentUser.storeId || 'store_ckr',
      date: new Date().toISOString().split('T')[0],
      planName: selectedPlanForClosing,
      category: planObj?.category || 'DAGING FRESH',
      openingStockKg: parseFloat(openingStockKg.toFixed(3)),
      newProcessedKg: parseFloat(newProcessedKg.toFixed(3)),
      salesKg: parseFloat(salesKg.toFixed(3)),
      closingStockBySystemKg: parseFloat(closingBySystem.toFixed(3)),
      actualClosingStockKg: parseFloat(actualStock.toFixed(3)),
      susutJualKg: parseFloat(susutJualKg.toFixed(3)),
      photoUrl: closingPhoto,
      photoCaption: `Foto Timbangan Closing: ${selectedPlanForClosing}`,
      note: closingNote.trim(),
      butcherName: currentUser.fullName,
    });

    setClosingPhysicalWeight('');
    setClosingPhoto('');
    setClosingNote('');
    setClosingError('');
    setClosingSuccess(true);
    setTimeout(() => setClosingSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner for Butcher: Clean, Direct, Action-focused */}
      <div className="bg-gradient-to-r from-red-800 to-red-950 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-red-700 text-red-100 text-xs font-semibold uppercase tracking-wider">
              Akun Butcher
            </span>
            <span className="text-xs text-red-200">
              {currentStore?.name || 'TDN Cikarang Utara'}
            </span>
          </div>
          <h1 className="text-2xl font-black mt-1">Stasiun Kerja Butcher</h1>
          <p className="text-xs text-red-200 mt-0.5">
            Petugas: <strong className="text-white">{currentUser.fullName}</strong> • Fokus operasional: Thawing, Segmentasi & Closing Harian
          </p>
        </div>

        {/* Action Button: Tambah Thawing Baru */}
        <button
          onClick={() => setActiveTab('tambah')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-red-900 hover:bg-red-50 rounded-lg font-bold text-sm shadow transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Mulai Thawing Daging Baru
        </button>
      </div>

      {/* Navigation Pills - 4 Direct Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('antrian')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-bold transition ${
            activeTab === 'antrian'
              ? 'bg-white text-red-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-red-700" />
          Antrian Thawing ({thawingItems.length})
        </button>

        <button
          onClick={() => setActiveTab('segmentasi')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-bold transition ${
            activeTab === 'segmentasi'
              ? 'bg-white text-red-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Scissors className="w-4 h-4 text-red-700" />
          Segmentasi Potong
        </button>

        <button
          onClick={() => setActiveTab('closing')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-bold transition ${
            activeTab === 'closing'
              ? 'bg-white text-red-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-red-700" />
          Closing Harian ({closingRecords.length}/{STANDARD_PLANS.length})
        </button>

        <button
          onClick={() => setActiveTab('tambah')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-bold transition ${
            activeTab === 'tambah'
              ? 'bg-white text-red-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Plus className="w-4 h-4 text-red-700" />
          Input Thawing Baru
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ANTRIAN THAWING (Mandatory Photo on Start Fabrication) */}
      {/* ========================================================================= */}
      {activeTab === 'antrian' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-700" />
                Antrian Thawing Berjalan
              </h2>
              <p className="text-xs text-slate-500">
                Wajib menimbang dan mengunggah foto timbangan setelah proses thawing selesai.
              </p>
            </div>
            <span className="text-xs font-semibold bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-200">
              {thawingItems.length} bahan sedang thawing
            </span>
          </div>

          {thawingItems.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <Beef className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700">Tidak ada antrian thawing aktif</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Semua bahan telah diproses atau belum ada bahan baru yang dimasukkan ke chiller thawing.
              </p>
              <button
                onClick={() => setActiveTab('tambah')}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold transition"
              >
                + Mulai Thawing Bahan Baru
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {thawingItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-red-300 transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {item.pabrikasiCategory || 'DAGING FRESH'}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{item.name}</h3>
                      </div>
                      <ThawingTimer startTime={item.thawingStartTime} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg text-xs">
                      <div>
                        <span className="text-slate-500 block">Berat Awal:</span>
                        <strong className="text-slate-800 text-sm font-mono">{item.weightBeforeThawing.toFixed(3)} Kg</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Rencana Potong:</span>
                        <strong className="text-red-700 font-semibold">{item.plannedFabrication}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-amber-600" /> Foto Wajib di Konfirmasi
                    </span>
                    <button
                      onClick={() => {
                        setSelectedThawId(item.id);
                        setBeratSetelahThawing(item.weightBeforeThawing.toString());
                        setThawPhoto('');
                        setThawError('');
                      }}
                      className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Konfirmasi Selesai
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selesai Thawing / Ready for Fabrication list */}
          {readyItems.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                Daftar Bahan Siap / Telah Dipabrikasi ({readyItems.length})
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="p-3">Nama Bahan</th>
                      <th className="p-3">Rencana Potong</th>
                      <th className="p-3 text-right">Berat Awal</th>
                      <th className="p-3 text-right">Setelah Thawing</th>
                      <th className="p-3 text-right">Susut (%)</th>
                      <th className="p-3 text-center">Foto Bukti</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {readyItems.map((item) => {
                      const after = item.weightAfterThawing || item.weightBeforeThawing;
                      const susutKg = Math.max(0, item.weightBeforeThawing - after);
                      const susutPct = item.weightBeforeThawing > 0 ? (susutKg / item.weightBeforeThawing) * 100 : 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{item.name}</td>
                          <td className="p-3 text-slate-600">{item.plannedFabrication}</td>
                          <td className="p-3 text-right font-mono">{item.weightBeforeThawing.toFixed(3)} Kg</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">{after.toFixed(3)} Kg</td>
                          <td className="p-3 text-right font-mono text-red-700 font-semibold">{susutPct.toFixed(2)}%</td>
                          <td className="p-3 text-center">
                            {item.image ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Terlampir
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                              {item.status === 'pabrikasi_done' ? 'Selesai Potong' : 'Siap Potong'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SEGMENTASI POTONG */}
      {/* ========================================================================= */}
      {activeTab === 'segmentasi' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form input segmentasi */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-red-700" />
                Catat Potongan Segmen
              </h2>
              <p className="text-xs text-slate-500">
                Pilih bahan yang sudah selesai thawing dan masukkan potongan hasil timbangan.
              </p>
            </div>

            {segSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Segmen potongan berhasil dicatat!
              </div>
            )}

            <form onSubmit={handleSaveSegment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Bahan Induk:
                </label>
                <select
                  value={selectedItemForSeg}
                  onChange={(e) => setSelectedItemForSeg(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-red-600"
                  required
                >
                  <option value="">-- Pilih Bahan --</option>
                  {readyItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.plannedFabrication}) - Sisa: {(item.weightAfterThawing || item.weightBeforeThawing).toFixed(3)} Kg
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Potongan / Segmen:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Daging Rendang Display Utama"
                  value={segName}
                  onChange={(e) => setSegName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target (Kg):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={targetWeightSeg}
                    onChange={(e) => setTargetWeightSeg(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hasil Real (Kg):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={actualWeightSeg}
                    onChange={(e) => setActualWeightSeg(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedItemForSeg}
                className="w-full py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow transition"
              >
                + Simpan Segmen Potong
              </button>
            </form>
          </div>

          {/* List Segments */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-700" />
              Daftar Segmen Potong Tercatat ({segments.length})
            </h3>
            {segments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada segmen potong yang dicatat hari ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Segmen</th>
                      <th className="p-2.5">Bahan Induk</th>
                      <th className="p-2.5">Rencana</th>
                      <th className="p-2.5 text-right">Hasil (Kg)</th>
                      <th className="p-2.5 text-right">Sales Terjual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {segments.map((seg) => (
                      <tr key={seg.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-800">{seg.segmentName}</td>
                        <td className="p-2.5 text-slate-600">{seg.itemName}</td>
                        <td className="p-2.5 text-red-700">{seg.plannedFabrication || '-'}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{seg.actualWeight.toFixed(3)} Kg</td>
                        <td className="p-2.5 text-right font-mono text-emerald-700">{(seg.salesKg || 0).toFixed(3)} Kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CLOSING HARIAN BUTCHER (Mandatory Photo per Rencana Potong) */}
      {/* ========================================================================= */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-red-700" />
                  Closing Fisik Harian Butcher
                </h2>
                <p className="text-xs text-slate-500">
                  Input sisa stok fisik per rencana potong daging. <strong className="text-red-700 font-bold">Wajib melampirkan foto timbangan display/chiller!</strong>
                </p>
              </div>
              <span className="text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-md">
                Toko: {currentStore?.name || 'TDN Cikarang Utara'}
              </span>
            </div>

            {closingSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Data closing untuk rencana potong ini berhasil disimpan bersama foto bukti!
              </div>
            )}

            {closingError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                {closingError}
              </div>
            )}

            {/* Closing Form Grid */}
            <form onSubmit={handleSaveClosing} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Rencana Potong:
                  </label>
                  <select
                    value={selectedPlanForClosing}
                    onChange={(e) => setSelectedPlanForClosing(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                  >
                    {STANDARD_PLANS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sisa Stok Fisik Real (Kg):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Contoh: 136.881"
                    value={closingPhysicalWeight}
                    onChange={(e) => setClosingPhysicalWeight(e.target.value)}
                    className="w-full text-sm font-bold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Timbang seluruh daging sisa pada chiller & display untuk rencana potong ini.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Butcher:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kondisi daging segar, sudah di-wrap dan masuk chiller"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* MANDATORY PHOTO UPLOAD SECTION */}
              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-red-600" />
                    Upload Foto Timbangan Fisik (MANDATORY *):
                  </label>

                  <div className="border-2 border-dashed border-red-300 bg-red-50/50 hover:bg-red-50 rounded-xl p-4 text-center cursor-pointer transition relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setClosingPhoto)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {closingPhoto ? (
                      <div className="space-y-2">
                        <img
                          src={closingPhoto}
                          alt="Bukti Closing"
                          className="h-28 w-auto mx-auto object-cover rounded-lg shadow-sm border border-red-200"
                        />
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Foto Berhasil Dipilih (Klik ganti)
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1 py-3">
                        <Upload className="w-8 h-8 text-red-500 mx-auto" />
                        <p className="text-xs font-bold text-red-900">
                          Klik untuk ambil / upload foto timbangan
                        </p>
                        <p className="text-[10px] text-red-600">
                          Format JPG, PNG dari kamera HP atau timbangan
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Simpan Closing Rencana Potong
                </button>
              </div>
            </form>
          </div>

          {/* Table of Recorded Closings */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-red-700" />
              Rekap Closing Fisik Butcher Hari Ini ({closingRecords.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3">Rencana Potong</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3 text-right">Sisa Kemarin</th>
                    <th className="p-3 text-right">Diolah Baru</th>
                    <th className="p-3 text-right bg-red-50/50">Stok Fisik Real</th>
                    <th className="p-3 text-right">Susut Jual (Kg)</th>
                    <th className="p-3 text-center">Foto Bukti</th>
                    <th className="p-3">Butcher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {closingRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{rec.planName}</td>
                      <td className="p-3 text-slate-600">{rec.category}</td>
                      <td className="p-3 text-right font-mono">{rec.openingStockKg.toFixed(3)}</td>
                      <td className="p-3 text-right font-mono">{rec.newProcessedKg.toFixed(3)}</td>
                      <td className="p-3 text-right font-mono font-bold text-red-900 bg-red-50/50">
                        {rec.actualClosingStockKg.toFixed(3)} Kg
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700">{rec.susutJualKg.toFixed(3)}</td>
                      <td className="p-3 text-center">
                        {rec.photoUrl ? (
                          <a
                            href={rec.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold"
                          >
                            <ImageIcon className="w-3.5 h-3.5" /> Lihat Foto
                          </a>
                        ) : (
                          <span className="text-red-500 font-bold">Tidak Ada</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{rec.butcherName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TAMBAH THAWING BARU */}
      {/* ========================================================================= */}
      {activeTab === 'tambah' && (
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-red-700" />
              Input Bahan Thawing Baru
            </h2>
            <p className="text-xs text-slate-500">
              Masukkan bahan baku beku yang dikeluarkan dari freezer ke chiller thawing.
            </p>
          </div>

          {addError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              {addError}
            </div>
          )}

          <form onSubmit={handleAddNewItem} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Bahan:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['DAGING FRESH', 'DAGING PREMIUM', 'RAWON', 'SHANKLE'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPabrikasiCat(cat)}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition ${
                      pabrikasiCat === cat
                        ? 'bg-red-800 text-white border-red-800 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Bahan Baku:
              </label>
              <select
                value={namaBahan}
                onChange={(e) => setNamaBahan(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-semibold"
                required
              >
                <option value="">-- Pilih Bahan Baku --</option>
                <option value="HQ 41/42/44/45">HQ 41/42/44/45 (Rendang)</option>
                <option value="DG RNDG BEKU 1kg">DG RNDG BEKU 1kg</option>
                <option value="DAGING KHUSUS">DAGING KHUSUS</option>
                <option value="D premium lokal">D premium lokal</option>
                <option value="FRIBOY / Daging Prem 2">FRIBOY / Daging Prem 2</option>
                <option value="FQ 106/105/18/16 / Rawon Curah">FQ 106/105/18/16 / Rawon Curah</option>
                <option value="FQ 60 /SHANK / D fresh ekonomis">FQ 60 /SHANK / D fresh ekonomis</option>
                <option value="__CUSTOM__">+ Input Nama Manual Lainnya</option>
              </select>
            </div>

            {namaBahan === '__CUSTOM__' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ketik Nama Bahan Manual:
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama bahan baku..."
                  value={customNamaBahan}
                  onChange={(e) => setCustomNamaBahan(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Berat Awal (Kg):
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Contoh: 120.000"
                  value={beratAwal}
                  onChange={(e) => setBeratAwal(e.target.value)}
                  className="w-full text-sm font-bold p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rencana Potong / Pabrikasi:
                </label>
                <select
                  value={rencanaPotong}
                  onChange={(e) => setRencanaPotong(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="D.sapi pot. rdang">D.sapi pot. rdang</option>
                  <option value="Daging Rendang Shankle">Daging Rendang Shankle</option>
                  <option value="D Premium lokal">D Premium lokal</option>
                  <option value="Rawon Curah">Rawon Curah</option>
                  <option value="D.r. fresh member">D.r. fresh member</option>
                  <option value="FRIBOY / Daging Prem 2">FRIBOY / Daging Prem 2</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-xs font-bold shadow transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Mulai Thawing Bahan Ini
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KONFIRMASI SELESAI THAWING (Mandatory Photo) */}
      {/* ========================================================================= */}
      {selectedThawId && selectedThawItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Scale className="w-5 h-5 text-red-700" />
                Konfirmasi Selesai Thawing
              </h3>
              <button
                onClick={() => setSelectedThawId(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {thawError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                {thawError}
              </div>
            )}

            <form onSubmit={handleConfirmThaw} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bahan:</span>
                  <strong className="text-slate-900">{selectedThawItem.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Berat Awal:</span>
                  <strong className="text-slate-900 font-mono">{selectedThawItem.weightBeforeThawing.toFixed(3)} Kg</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rencana:</span>
                  <strong className="text-red-700">{selectedThawItem.plannedFabrication}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Berat Timbangan Setelah Thawing (Kg):
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={beratSetelahThawing}
                  onChange={(e) => setBeratSetelahThawing(e.target.value)}
                  className="w-full text-base font-bold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600"
                  required
                />
              </div>

              {/* MANDATORY PHOTO UPLOAD */}
              <div>
                <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                  <Camera className="w-4 h-4 text-red-600" />
                  Foto Timbangan Setelah Thawing (MANDATORY *):
                </label>

                <div className="border-2 border-dashed border-red-300 bg-red-50/50 hover:bg-red-50 rounded-xl p-3 text-center cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setThawPhoto)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {thawPhoto ? (
                    <div className="space-y-1">
                      <img
                        src={thawPhoto}
                        alt="Timbangan"
                        className="h-20 w-auto mx-auto object-cover rounded shadow border border-red-200"
                      />
                      <span className="text-[11px] font-bold text-emerald-700 block">
                        ✓ Foto Timbangan Terlampir (Klik untuk ganti)
                      </span>
                    </div>
                  ) : (
                    <div className="py-2">
                      <Upload className="w-6 h-6 text-red-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-red-900">Upload Foto Timbangan</p>
                      <p className="text-[10px] text-red-600">Wajib melampirkan foto timbangan sebelum pabrikasi</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedThawId(null)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-xs font-bold shadow"
                >
                  Konfirmasi & Mulai Potong
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
