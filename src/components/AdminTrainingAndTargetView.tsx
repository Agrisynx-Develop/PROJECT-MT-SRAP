import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrainingFileRecord,
  DailyTargetManualConfig,
  ClosingPlanRecord,
  ThawingItem,
  FabricationSegment,
  StockAdjustment,
  CogsMaster,
  UserAccount,
  Store,
} from '../types';
import {
  getTrainingFiles,
  saveTrainingFiles,
  getDailyTargetConfigs,
  saveDailyTargetConfigs,
} from '../utils/db';
import { matchStoreEntity } from '../utils/reportCalculations';
import AdminSalesTrainingDatasetView from './AdminSalesTrainingDatasetView';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  Users,
  Award,
  Target,
  Sliders,
  Search,
  Filter,
  Plus,
  Save,
  File as FileIcon,
  Video,
  Image as ImageIcon,
  Archive,
  Clock,
  Building2,
  Scale,
  X,
  GraduationCap,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Cpu,
  Database,
} from 'lucide-react';

interface AdminTrainingAndTargetViewProps {
  currentUser: UserAccount;
  currentStore: Store;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  closingRecords: ClosingPlanRecord[];
  items: ThawingItem[];
  segments: FabricationSegment[];
  adjustments: StockAdjustment[];
  cogsList?: CogsMaster[];
  onSaveClosingRecord?: (record: Omit<ClosingPlanRecord, 'id' | 'timestamp'> & { id?: string }) => void;
  onDeleteClosingRecord?: (id: string) => void;
  onSalesPredictionUpdated?: (newTargetKg: number) => void;
}

const TRAINING_CATEGORIES = [
  'SOP & Standard Potong',
  'Evaluasi Hasil Praktik',
  'Sanitasi & Hygiene',
  'Sertifikasi Butcher',
  'Pelatihan Alat & Timbangan',
  'Lainnya',
];

const STANDARD_PLANS = [
  'D.sapi pot. rdang',
  'Daging Rendang Shankle',
  'D Premium lokal',
  'Rawon Curah',
  'D.r. fresh member',
  'FRIBOY / Daging Prem 2',
];

export default function AdminTrainingAndTargetView({
  currentUser,
  currentStore,
  selectedDate,
  onSelectDate,
  closingRecords,
  items,
  segments,
  adjustments,
  cogsList = [],
  onSaveClosingRecord,
  onDeleteClosingRecord,
  onSalesPredictionUpdated,
}: AdminTrainingAndTargetViewProps) {
  // Active Sub-Tab: 'sales_dataset' (DEFAULT) | 'daily_manual_targets'
  const [subTab, setSubTab] = useState<'sales_dataset' | 'daily_manual_targets'>('sales_dataset');

  // --------------------------------------------------------------------------
  // PART 1: TRAINING FILES STATE
  // --------------------------------------------------------------------------
  const [trainingFiles, setTrainingFiles] = useState<TrainingFileRecord[]>(() => {
    const loaded = getTrainingFiles();
    if (loaded && loaded.length > 0) return loaded;

    // Default sample training record to showcase the feature immediately
    const sampleRecord: TrainingFileRecord = {
      id: `train_sample_${currentStore.id}_1`,
      storeId: currentStore.id,
      storeName: currentStore.name,
      title: 'SOP Pemotongan Daging Fresh & Kontrol Susut Toko',
      category: 'SOP & Standard Potong',
      trainerName: 'MD Pusat / Master Butcher',
      participantNames: `Tim Butcher ${currentStore.code}`,
      date: selectedDate || new Date().toISOString().split('T')[0],
      fileName: 'Modul_Training_SOP_Butcher_TDN.pdf',
      fileSizeFormatted: '1.2 MB',
      fileType: 'application/pdf',
      fileDataUrl: 'data:text/plain;base64,TW9kdWwgVHJhaW5pbmcgU09QIFBlbW90b25nYW4gRGFnaW5nIEZyZXNoICYgS29udHJvbCBTdXN1dCBURE4=',
      scoreNotes: 'Hasil evaluasi: Pemahaman prosedur pisau tajam & timbangan awal mencapai 95%. Susut proses terkendali di bawah 1%.',
      uploadedBy: currentUser.fullName || 'Admin Toko',
      uploadedAt: new Date().toISOString(),
    };
    return [sampleRecord];
  });

  // Upload Form State
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('SOP & Standard Potong');
  const [formTrainer, setFormTrainer] = useState<string>(currentUser.fullName || 'Admin Toko');
  const [formParticipants, setFormParticipants] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(selectedDate || new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter for Training Files
  const [fileSearchQuery, setFileSearchQuery] = useState<string>('');
  const [fileCategoryFilter, setFileCategoryFilter] = useState<string>('all');

  // Preview Modal State
  const [previewFile, setPreviewFile] = useState<TrainingFileRecord | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync training files to persistence
  useEffect(() => {
    saveTrainingFiles(trainingFiles);
  }, [trainingFiles]);

  // Handle file select (accepts ANY file type)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (< 25MB recommended for local storage performance)
    if (file.size > 25 * 1024 * 1024) {
      setUploadMsg({
        type: 'error',
        text: 'Ukuran file melebihi 25 MB. Harap gunakan file berukuran lebih kecil atau kompresi file.',
      });
      return;
    }

    setSelectedFileObj(file);
    if (!formTitle) {
      // Auto populate title from file name without extension
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[_\\-]+/g, ' ');
      setFormTitle(nameWithoutExt);
    }

    // Read as Base64 Data URL
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const result = loadEvt.target?.result as string;
      setFileDataUrl(result || '');
      setUploadMsg(null);
    };
    reader.onerror = () => {
      setUploadMsg({ type: 'error', text: 'Gagal membaca file. Silakan coba kembali.' });
    };
    reader.readAsDataURL(file);
  };

  // Helper format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Submit Training File Upload
  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFileObj && !fileDataUrl) {
      setUploadMsg({ type: 'error', text: 'Silakan pilih file hasil training terlebih dahulu.' });
      return;
    }

    if (!formTitle.trim()) {
      setUploadMsg({ type: 'error', text: 'Judul atau topik materi training wajib diisi.' });
      return;
    }

    setIsUploading(true);

    try {
      const newRecord: TrainingFileRecord = {
        id: `train_${currentStore.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        storeId: currentStore.id,
        storeName: currentStore.name,
        title: formTitle.trim(),
        category: formCategory,
        trainerName: formTrainer.trim() || 'Admin Toko',
        participantNames: formParticipants.trim() || `Tim Butcher ${currentStore.code}`,
        date: formDate || selectedDate,
        fileName: selectedFileObj ? selectedFileObj.name : 'dokumen_training.dat',
        fileSizeFormatted: selectedFileObj ? formatFileSize(selectedFileObj.size) : '1.0 MB',
        fileType: selectedFileObj ? (selectedFileObj.type || 'application/octet-stream') : 'application/octet-stream',
        fileDataUrl: fileDataUrl,
        scoreNotes: formNotes.trim(),
        uploadedBy: currentUser.fullName || 'Admin',
        uploadedAt: new Date().toISOString(),
      };

      setTrainingFiles((prev) => [newRecord, ...prev]);

      setUploadMsg({
        type: 'success',
        text: `File hasil training "${newRecord.title}" (${newRecord.fileName}) berhasil diunggah dan disimpan!`,
      });

      // Reset form
      setSelectedFileObj(null);
      setFileDataUrl('');
      setFormTitle('');
      setFormNotes('');
      setFormParticipants('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setTimeout(() => setUploadMsg(null), 5000);
    } catch (err: any) {
      console.error('Error saving training file:', err);
      setUploadMsg({ type: 'error', text: 'Terjadi kesalahan saat menyimpan file.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Training File
  const handleDeleteTrainingFile = (id: string, title: string) => {
    if (window.confirm(`Hapus file hasil training "${title}"?`)) {
      setTrainingFiles((prev) => prev.filter((f) => f.id !== id));
      if (previewFile?.id === id) {
        setPreviewFile(null);
      }
    }
  };

  // Download Training File
  const handleDownloadTrainingFile = (fileRec: TrainingFileRecord) => {
    try {
      const link = document.createElement('a');
      link.href = fileRec.fileDataUrl;
      link.download = fileRec.fileName || `training_${fileRec.title}.dat`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Download error:', e);
      alert('Gagal mengunduh file.');
    }
  };

  // Filtered Training Files for current store
  const storeTrainingFiles = useMemo(() => {
    return trainingFiles.filter((f) => {
      const storeMatch = !f.storeId || matchStoreEntity(f.storeId, currentStore);
      const catMatch = fileCategoryFilter === 'all' || f.category === fileCategoryFilter;
      const searchMatch =
        !fileSearchQuery.trim() ||
        f.title.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        f.fileName.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        (f.participantNames || '').toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
        (f.trainerName || '').toLowerCase().includes(fileSearchQuery.toLowerCase());
      return storeMatch && catMatch && searchMatch;
    });
  }, [trainingFiles, currentStore, fileCategoryFilter, fileSearchQuery]);

  // Helper File Type Icon & Badge
  const renderFileIcon = (fileType: string, fileName: string) => {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const type = (fileType || '').toLowerCase();

    if (type.includes('pdf') || ext === 'pdf') {
      return (
        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (type.includes('sheet') || type.includes('excel') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
      );
    }
    if (type.includes('word') || ext === 'doc' || ext === 'docx') {
      return (
        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (type.includes('image') || ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp') {
      return (
        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
          <ImageIcon className="w-5 h-5" />
        </div>
      );
    }
    if (type.includes('video') || ext === 'mp4' || ext === 'mov' || ext === 'avi' || ext === 'mkv') {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Video className="w-5 h-5" />
        </div>
      );
    }
    if (type.includes('zip') || type.includes('rar') || type.includes('compressed') || ext === 'zip' || ext === 'rar') {
      return (
        <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
          <Archive className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
        <FileIcon className="w-5 h-5" />
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // PART 2: SET MANUAL JUMLAH HARIAN & TARGET TOKO STATE
  // --------------------------------------------------------------------------
  const [dailyConfigs, setDailyConfigs] = useState<DailyTargetManualConfig[]>(() => {
    return getDailyTargetConfigs();
  });

  // Current store active date config
  const activeDailyConfig = useMemo(() => {
    const found = dailyConfigs.find(
      (c) => matchStoreEntity(c.storeId, currentStore) && c.date === selectedDate
    );
    return (
      found || {
        id: `cfg_${currentStore.id}_${selectedDate}`,
        storeId: currentStore.id,
        date: selectedDate,
        targetProduksiKg: 150,
        targetSalesKg: 130,
        targetToleransiSusutPercent: 1.5,
        targetTrainingSesiHarian: 1,
        targetPesertaTrainingHarian: 2,
        catatanHarian: '',
        updatedBy: currentUser.fullName,
        updatedAt: new Date().toISOString(),
      }
    );
  }, [dailyConfigs, currentStore, selectedDate, currentUser]);

  // Form state for daily targets
  const [targetProduksi, setTargetProduksi] = useState<string>(
    String(activeDailyConfig.targetProduksiKg ?? 150)
  );
  const [targetSales, setTargetSales] = useState<string>(
    String(activeDailyConfig.targetSalesKg ?? 130)
  );
  const [targetSusut, setTargetSusut] = useState<string>(
    String(activeDailyConfig.targetToleransiSusutPercent ?? 1.5)
  );
  const [targetTrainingSesi, setTargetTrainingSesi] = useState<string>(
    String(activeDailyConfig.targetTrainingSesiHarian ?? 1)
  );
  const [targetPeserta, setTargetPeserta] = useState<string>(
    String(activeDailyConfig.targetPesertaTrainingHarian ?? 2)
  );
  const [catatanHarian, setCatatanHarian] = useState<string>(
    activeDailyConfig.catatanHarian || ''
  );
  const [targetSaveMsg, setTargetSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Update form state when selectedDate changes
  useEffect(() => {
    setTargetProduksi(String(activeDailyConfig.targetProduksiKg ?? 150));
    setTargetSales(String(activeDailyConfig.targetSalesKg ?? 130));
    setTargetSusut(String(activeDailyConfig.targetToleransiSusutPercent ?? 1.5));
    setTargetTrainingSesi(String(activeDailyConfig.targetTrainingSesiHarian ?? 1));
    setTargetPeserta(String(activeDailyConfig.targetPesertaTrainingHarian ?? 2));
    setCatatanHarian(activeDailyConfig.catatanHarian || '');
  }, [activeDailyConfig, selectedDate]);

  // Save Daily Target Config
  const handleSaveDailyTarget = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedConfig: DailyTargetManualConfig = {
      id: activeDailyConfig.id,
      storeId: currentStore.id,
      date: selectedDate,
      targetProduksiKg: parseFloat(targetProduksi) || 0,
      targetSalesKg: parseFloat(targetSales) || 0,
      targetToleransiSusutPercent: parseFloat(targetSusut) || 1.5,
      targetTrainingSesiHarian: parseInt(targetTrainingSesi) || 0,
      targetPesertaTrainingHarian: parseInt(targetPeserta) || 0,
      catatanHarian: catatanHarian.trim(),
      updatedBy: currentUser.fullName,
      updatedAt: new Date().toISOString(),
    };

    const newConfigsList = [
      ...dailyConfigs.filter(
        (c) => !(matchStoreEntity(c.storeId, currentStore) && c.date === selectedDate)
      ),
      updatedConfig,
    ];

    setDailyConfigs(newConfigsList);
    saveDailyTargetConfigs(newConfigsList);

    setTargetSaveMsg({
      type: 'success',
      text: `Target & Jumlah Harian toko untuk tanggal ${selectedDate} berhasil disimpan!`,
    });
    setTimeout(() => setTargetSaveMsg(null), 4000);
  };

  // --------------------------------------------------------------------------
  // PART 3: SET MANUAL ANGKA HARIAN PER RENCANA POTONG (DIRECT CLOSING EDIT)
  // --------------------------------------------------------------------------
  // Filter store closings for selected date
  const storeClosingsForDate = useMemo(() => {
    return (closingRecords || []).filter(
      (c) => matchStoreEntity(c.storeId, currentStore) && (c.date || c.timestamp || '').startsWith(selectedDate)
    );
  }, [closingRecords, currentStore, selectedDate]);

  // Form state for editing/setting manual closing numbers per plan
  const [manualPlanName, setManualPlanName] = useState<string>('D.sapi pot. rdang');
  const [manualCategory, setManualCategory] = useState<string>('DAGING FRESH');
  const [manualOpeningStock, setManualOpeningStock] = useState<string>('');
  const [manualNewProcessed, setManualNewProcessed] = useState<string>('');
  const [manualSales, setManualSales] = useState<string>('');
  const [manualAdjustIn, setManualAdjustIn] = useState<string>('');
  const [manualAdjustOut, setManualAdjustOut] = useState<string>('');
  const [manualActualStock, setManualActualStock] = useState<string>('');
  const [manualNote, setManualNote] = useState<string>('');
  const [editingPlanRecordId, setEditingPlanRecordId] = useState<string | null>(null);
  const [manualPlanMsg, setManualPlanMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // When clicking "Edit / Set Manual" on a plan record
  const handleEditPlanRecord = (rec: ClosingPlanRecord) => {
    setEditingPlanRecordId(rec.id);
    setManualPlanName(rec.planName);
    setManualCategory(rec.category || 'DAGING FRESH');
    setManualOpeningStock(String(rec.openingStockKg || 0));
    setManualNewProcessed(String(rec.newProcessedKg || 0));
    setManualSales(String(rec.salesKg || 0));
    setManualAdjustIn(String(rec.adjustInKg || 0));
    setManualAdjustOut(String(rec.adjustOutKg || 0));
    setManualActualStock(String(rec.actualClosingStockKg || 0));
    setManualNote(rec.note || '');

    // Scroll to form smoothly
    const element = document.getElementById('manual_plan_edit_form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Reset manual plan form
  const handleResetManualPlanForm = () => {
    setEditingPlanRecordId(null);
    setManualOpeningStock('');
    setManualNewProcessed('');
    setManualSales('');
    setManualAdjustIn('');
    setManualAdjustOut('');
    setManualActualStock('');
    setManualNote('');
  };

  // Submit manual numbers for a plan
  const handleSaveManualPlanRecord = (e: React.FormEvent) => {
    e.preventDefault();

    if (!onSaveClosingRecord) {
      setManualPlanMsg({ type: 'error', text: 'Handler onSaveClosingRecord tidak tersedia.' });
      return;
    }

    const openKg = parseFloat(manualOpeningStock) || 0;
    const newProcKg = parseFloat(manualNewProcessed) || 0;
    const salesKg = parseFloat(manualSales) || 0;
    const adjIn = parseFloat(manualAdjustIn) || 0;
    const adjOut = parseFloat(manualAdjustOut) || 0;
    const actualKg = parseFloat(manualActualStock) || 0;

    // Calculate system stock and sales loss
    const totalTersedia = openKg + newProcKg + adjIn - adjOut;
    const systemStock = Math.max(0, totalTersedia - salesKg);
    const susutJualKg = Math.max(0, systemStock - actualKg);

    const recordToSave = {
      id: editingPlanRecordId || undefined,
      storeId: currentStore.id,
      date: selectedDate,
      planName: manualPlanName,
      category: manualCategory,
      openingStockKg: openKg,
      newProcessedKg: newProcKg,
      adjustInKg: adjIn,
      adjustOutKg: adjOut,
      salesKg: salesKg,
      closingStockBySystemKg: systemStock,
      actualClosingStockKg: actualKg,
      susutJualKg: susutJualKg,
      butcherName: 'Admin Toko (Set Manual)',
      note: manualNote.trim() || 'Set manual jumlah harian oleh Admin',
      photoUrl: 'placeholder',
      photoCaption: `Set Manual Jumlah Harian - ${manualPlanName}`,
    };

    onSaveClosingRecord(recordToSave);

    setManualPlanMsg({
      type: 'success',
      text: `Jumlah harian rencana "${manualPlanName}" berhasil diperbarui & disimpan!`,
    });

    handleResetManualPlanForm();
    setTimeout(() => setManualPlanMsg(null), 4000);
  };

  // Calculate actual totals for comparison
  const actualTotals = useMemo(() => {
    const storeItemsForDate = (items || []).filter(
      (i) => matchStoreEntity(i.storeId, currentStore) && (i.createdAt || i.thawingStartTime || '').startsWith(selectedDate)
    );
    const todayItems = storeItemsForDate.filter((i) => !i.isCarryover);
    const rawOlahKg = todayItems.reduce((s, i) => s + i.weightBeforeThawing, 0);
    const thawedKg = todayItems.reduce((s, i) => s + (i.weightAfterThawing || i.weightBeforeThawing), 0);
    const susutProsesKg = Math.max(0, rawOlahKg - thawedKg);
    const susutProsesPct = rawOlahKg > 0 ? (susutProsesKg / rawOlahKg) * 100 : 0;

    const totalSalesKg = storeClosingsForDate.reduce((s, c) => s + (c.salesKg || 0), 0);
    const totalActualClosingKg = storeClosingsForDate.reduce((s, c) => s + (c.actualClosingStockKg || 0), 0);
    const totalSusutJualKg = storeClosingsForDate.reduce((s, c) => s + (c.susutJualKg || 0), 0);

    return {
      rawOlahKg,
      totalSalesKg,
      susutProsesPct,
      totalActualClosingKg,
      totalSusutJualKg,
    };
  }, [items, storeClosingsForDate, currentStore, selectedDate]);

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('sales_dataset')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              subTab === 'sales_dataset'
                ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-600/30'
                : 'bg-emerald-50 text-emerald-950 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Dataset Training Prediksi Sales (ML)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('daily_manual_targets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              subTab === 'daily_manual_targets'
                ? 'bg-purple-700 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-300" />
            <span>Set Manual Target Harian & Closing</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Tanggal:</span>
          <span className="font-mono font-bold bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg">
            {selectedDate}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 0: TRAINING DATASET PREDIKSI SALES (MACHINE LEARNING)             */}
      {/* ========================================================================= */}
      {subTab === 'sales_dataset' && (
        <AdminSalesTrainingDatasetView
          currentUser={currentUser}
          currentStore={currentStore}
          onSalesPredictionUpdated={onSalesPredictionUpdated}
        />
      )}

      {/* Berkas Materi Training Butcher removed per user request */}
      {false && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-purple-500/30 text-purple-200 border border-purple-400/30 inline-flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3 h-3 text-purple-300" />
                Dukungan Penuh Semua Format File
              </span>
              <h2 className="text-xl md:text-2xl font-black">
                File Hasil Training Butcher & SOP Toko
              </h2>
              <p className="text-xs md:text-sm text-purple-200 mt-1 leading-relaxed">
                Upload laporan evaluasi, sertifikasi, materi video, lembar nilai praktik, atau dokumen SOP untuk tim butcher {currentStore.name}.
                Mendukung <strong>seluruh format file</strong> (PDF, Word, Excel, PowerPoint, Gambar, Video MP4, File ZIP/Arsip, dan CSV).
              </p>
            </div>
            <div className="absolute right-4 -bottom-6 opacity-15 pointer-events-none">
              <GraduationCap className="w-48 h-48 text-white" />
            </div>
          </div>

          {/* 2-Column Grid: Left = Form Upload, Right = Daftar Dokumen Training */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Upload Form */}
            <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-purple-600" />
                  Upload File Hasil Training Baru
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Semua Tipe File
                </span>
              </div>

              {/* Feedback alert */}
              {uploadMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    uploadMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {uploadMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{uploadMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-3.5">
                {/* File Dropzone / Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Pilih File Hasil Training <span className="text-rose-500">*</span>
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                      selectedFileObj
                        ? 'bg-purple-50/80 border-purple-400 text-purple-900'
                        : 'bg-slate-50 hover:bg-purple-50/40 border-slate-300 hover:border-purple-400 text-slate-600'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="*/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {selectedFileObj ? (
                      <>
                        <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-xs">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="max-w-full truncate">
                          <p className="text-xs font-black text-slate-900 truncate">
                            {selectedFileObj.name}
                          </p>
                          <p className="text-[10px] text-purple-700 font-mono mt-0.5">
                            {formatFileSize(selectedFileObj.size)} • {selectedFileObj.type || 'Berkas Dokumen'}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-purple-600 underline">
                          Klik untuk ganti file
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="p-2.5 bg-white text-purple-600 rounded-xl shadow-xs border border-slate-200">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Klik atau seret file ke sini
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            PDF, Word (.docx), Excel (.xlsx), Foto, Video, ZIP, dsb. (Maks 25MB)
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Judul / Materi Training */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Judul / Topik Materi Training <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Evaluasi Cutting Rendang & Standar Higienitas"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                {/* Kategori & Tanggal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Kategori</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      {TRAINING_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Tanggal Training</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Trainer & Peserta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Nama Trainer / Instruktur</label>
                    <input
                      type="text"
                      placeholder="Contoh: Master Butcher MD"
                      value={formTrainer}
                      onChange={(e) => setFormTrainer(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Peserta Butcher</label>
                    <input
                      type="text"
                      placeholder="Contoh: Budi, Joko, Tim Jagal"
                      value={formParticipants}
                      onChange={(e) => setFormParticipants(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Nilai / Evaluasi / Catatan */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Hasil Nilai / Catatan Kelulusan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Lulus predikat A (95%). Pisau potong rapi dan susut proses 0.8% sesuai standar."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isUploading || !fileDataUrl}
                  className={`w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-98 ${
                    isUploading || !fileDataUrl
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-purple-700 hover:bg-purple-800 text-white'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isUploading ? 'Menyimpan File...' : 'Upload & Simpan Hasil Training'}</span>
                </button>
              </form>
            </div>

            {/* RIGHT COLUMN: List Dokumen Hasil Training */}
            <div className="lg:col-span-7 space-y-4">
              {/* Filter & Search Bar */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari materi, nama file, trainer, peserta..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={fileCategoryFilter}
                    onChange={(e) => setFileCategoryFilter(e.target.value)}
                    className="text-xs font-bold border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Semua Kategori ({trainingFiles.length})</option>
                    {TRAINING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Training Files List */}
              {storeTrainingFiles.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-2">
                  <div className="p-3 bg-purple-50 text-purple-500 rounded-full inline-block">
                    <GraduationCap className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-black text-slate-700">
                    Belum ada file hasil training yang cocok dengan pencarian.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Gunakan formulir di sebelah kiri untuk mengunggah berkas modul, lembar nilai, sertifikat, atau video training butcher.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {storeTrainingFiles.map((fileRec) => (
                    <div
                      key={fileRec.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-purple-300 hover:shadow-md transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        {renderFileIcon(fileRec.fileType, fileRec.fileName)}

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              {fileRec.category || 'Training'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {fileRec.date}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              • {fileRec.fileSizeFormatted}
                            </span>
                          </div>

                          <h4 className="text-xs font-black text-slate-900 truncate">
                            {fileRec.title}
                          </h4>

                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            Berkas: <strong className="text-slate-700">{fileRec.fileName}</strong>
                          </p>

                          {/* Trainer & Participants */}
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5 flex-wrap">
                            {fileRec.trainerName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-purple-600" />
                                Trainer: <strong className="text-slate-700">{fileRec.trainerName}</strong>
                              </span>
                            )}
                            {fileRec.participantNames && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-blue-600" />
                                Peserta: <strong className="text-slate-700">{fileRec.participantNames}</strong>
                              </span>
                            )}
                          </div>

                          {/* Score notes if present */}
                          {fileRec.scoreNotes && (
                            <p className="text-[11px] text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-100 font-medium mt-1">
                              💡 {fileRec.scoreNotes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadTrainingFile(fileRec)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                          title="Download Berkas Asli"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewFile(fileRec)}
                          className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Lihat Detail & Pratinjau"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteTrainingFile(fileRec.id, fileRec.title)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Hapus File Training Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: SET MANUAL JUMLAH HARIAN & TARGET TOKO                         */}
      {/* ========================================================================= */}
      {subTab === 'daily_manual_targets' && (
        <div className="space-y-6">
          {/* SECTION A: Form Set Manual Target Harian Toko */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Set Manual Target Operasional & Training Harian
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tetapkan batas kuota produksi daging, target sales, batas aman susut, dan target pelatihan harian untuk tanggal{' '}
                  <strong className="text-purple-700 font-mono">{selectedDate}</strong>.
                </p>
              </div>

              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 self-start sm:self-center">
                {currentStore.name} ({currentStore.code})
              </span>
            </div>

            {targetSaveMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  targetSaveMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{targetSaveMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveDailyTarget} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Target Produksi Kg */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-purple-600" />
                    Target Olah / Produksi (Kg)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={targetProduksi}
                      onChange={(e) => setTargetProduksi(e.target.value)}
                      className="w-full text-base font-black text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">Kg</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Realisasi saat ini: <strong className="text-slate-700">{actualTotals.rawOlahKg.toFixed(2)} Kg</strong>
                  </p>
                </div>

                {/* Target Sales Kg */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Target Penjualan / Sales (Kg)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={targetSales}
                      onChange={(e) => setTargetSales(e.target.value)}
                      className="w-full text-base font-black text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">Kg</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Realisasi sales: <strong className="text-slate-700">{actualTotals.totalSalesKg.toFixed(2)} Kg</strong>
                  </p>
                </div>

                {/* Target Maks Susut Harian */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    Batas Maks Susut Harian (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={targetSusut}
                      onChange={(e) => setTargetSusut(e.target.value)}
                      className="w-full text-base font-black text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Susut proses saat ini: <strong className="text-slate-700">{actualTotals.susutProsesPct.toFixed(2)}%</strong>
                  </p>
                </div>
              </div>

              {/* Target Training Harian */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-200 space-y-1.5">
                  <label className="text-xs font-black text-purple-950 block flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-purple-700" />
                    Target Sesi Training Butcher Harian
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={targetTrainingSesi}
                      onChange={(e) => setTargetTrainingSesi(e.target.value)}
                      className="w-full text-base font-black text-slate-900 bg-white border border-purple-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-purple-800">Sesi/Hari</span>
                  </div>
                </div>

                <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-200 space-y-1.5">
                  <label className="text-xs font-black text-purple-950 block flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-700" />
                    Target Peserta Butcher Ditraining
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={targetPeserta}
                      onChange={(e) => setTargetPeserta(e.target.value)}
                      className="w-full text-base font-black text-slate-900 bg-white border border-purple-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-purple-800">Orang/Hari</span>
                  </div>
                </div>
              </div>

              {/* Catatan Instruksi Harian */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Instruksi Khusus / Catatan Operasional Harian Admin:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Fokuskan ketelitian pemotongan daging rendang shankle dan pastikan penimbangan fisik closing dilakukan teliti sebelum jam 21:00."
                  value={catatanHarian}
                  onChange={(e) => setCatatanHarian(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Target & Jumlah Harian</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION B: Set Manual Angka Jumlah Harian per Rencana Potong */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-600" />
                  Set Manual Angka Jumlah Harian per Rencana Potong
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Koreksi atau tetapkan manual angka <strong>Stok Awal, Bahan Diolah, Sales, Adjust, dan Stok Fisik Closing</strong> untuk tanggal{' '}
                  <strong className="text-purple-700 font-mono">{selectedDate}</strong>.
                </p>
              </div>

              <span className="text-xs font-bold text-slate-500">
                {storeClosingsForDate.length} Rencana Terdata
              </span>
            </div>

            {/* Edit / Quick Set Form */}
            <div id="manual_plan_edit_form" className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  {editingPlanRecordId ? 'Edit Manual Angka Rencana Potong' : 'Set Manual Rencana Potong Baru'}
                </h4>
                {editingPlanRecordId && (
                  <button
                    onClick={handleResetManualPlanForm}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              {manualPlanMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    manualPlanMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{manualPlanMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveManualPlanRecord} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Rencana Potong</label>
                    <select
                      value={manualPlanName}
                      onChange={(e) => setManualPlanName(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      {STANDARD_PLANS.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Kategori</label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="DAGING FRESH">DAGING FRESH</option>
                      <option value="DAGING PREMIUM">DAGING PREMIUM</option>
                      <option value="RAWON">RAWON</option>
                      <option value="SHANKLE">SHANKLE</option>
                    </select>
                  </div>
                </div>

                {/* 5 Input Angka Manual */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Stok Awal (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualOpeningStock}
                      onChange={(e) => setManualOpeningStock(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Diolah Baru (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualNewProcessed}
                      onChange={(e) => setManualNewProcessed(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Sales Jual (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualSales}
                      onChange={(e) => setManualSales(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Adjust IN (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualAdjustIn}
                      onChange={(e) => setManualAdjustIn(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Stok Fisik Closing (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualActualStock}
                      onChange={(e) => setManualActualStock(e.target.value)}
                      className="w-full text-xs font-bold border border-purple-400 bg-purple-50/50 rounded-xl p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Catatan penyesuaian manual (opsional)..."
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    className="w-full sm:flex-1 text-xs border border-slate-300 rounded-xl p-2 bg-white focus:outline-none"
                  />

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editingPlanRecordId ? 'Perbarui Angka' : 'Simpan Angka Manual'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Tabel Ringkasan Rencana Potong Aktif */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px]">
                    <th className="p-3">Rencana Potong</th>
                    <th className="p-3 text-right">Stok Awal (Kg)</th>
                    <th className="p-3 text-right">Bahan Diolah (Kg)</th>
                    <th className="p-3 text-right">Sales (Kg)</th>
                    <th className="p-3 text-right">Stok Sistem (Kg)</th>
                    <th className="p-3 text-right">Stok Fisik Closing (Kg)</th>
                    <th className="p-3 text-right">Susut Jual (Kg)</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {storeClosingsForDate.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        Belum ada data closing untuk tanggal {selectedDate}. Anda dapat mengisi form di atas untuk menetapkan angka manual.
                      </td>
                    </tr>
                  ) : (
                    storeClosingsForDate.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-900">
                          <div>{rec.planName}</div>
                          <span className="text-[10px] text-slate-400 font-normal">{rec.category}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          {(rec.openingStockKg || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          {(rec.newProcessedKg || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-700 font-bold">
                          {(rec.salesKg || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          {(rec.closingStockBySystemKg || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-purple-900 bg-purple-50/40">
                          {(rec.actualClosingStockKg || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700">
                          {(rec.susutJualKg || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditPlanRecord(rec)}
                              className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition"
                              title="Edit / Set Manual Angka Ini"
                            >
                              Edit
                            </button>
                            {onDeleteClosingRecord && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Hapus data closing rencana "${rec.planName}"?`)) {
                                    onDeleteClosingRecord(rec.id);
                                  }
                                }}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                title="Hapus Data Ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Detail Modal for Training File */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 truncate max-w-sm">
                    {previewFile.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {previewFile.fileName} ({previewFile.fileSizeFormatted})
                  </span>
                </div>
              </div>

              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview image if image file */}
            {previewFile.fileType.includes('image') && (
              <div className="w-full max-h-60 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center p-2">
                <img
                  src={previewFile.fileDataUrl}
                  alt={previewFile.title}
                  className="max-h-56 object-contain rounded-lg"
                />
              </div>
            )}

            {/* Info details */}
            <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Kategori:</span>
                <span className="font-bold text-slate-800">{previewFile.category}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Tanggal Training:</span>
                <span className="font-bold text-slate-800 font-mono">{previewFile.date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Trainer:</span>
                <span className="font-bold text-slate-800">{previewFile.trainerName || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Peserta:</span>
                <span className="font-bold text-slate-800">{previewFile.participantNames || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Diupload Oleh:</span>
                <span className="font-bold text-slate-800">{previewFile.uploadedBy}</span>
              </div>
              {previewFile.scoreNotes && (
                <div className="pt-2">
                  <span className="text-slate-500 block mb-1">Catatan Evaluasi / Skor:</span>
                  <p className="font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    {previewFile.scoreNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDownloadTrainingFile(previewFile)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File ({previewFile.fileName})</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
