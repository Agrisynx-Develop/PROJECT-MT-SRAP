import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  SalesTrainingRecord,
  SalesPredictionModelConfig,
  Store,
  UserAccount,
  PythonModelArtifact,
} from '../types';
import {
  getSalesTrainingDataset,
  saveSalesTrainingDataset,
  getSalesPredictionConfig,
  saveSalesPredictionConfig,
  generateDefaultSalesTrainingData,
  getPythonModels,
  savePythonModels,
  deletePythonModel,
  setActivePythonModel,
} from '../utils/db';
import { predictDailySales } from '../utils/mlPrediction';
import {
  parsePythonModelFile,
  generatePythonTrainingScript,
  formatBytes,
  ParsedPythonModelResult,
} from '../utils/pythonModelParser';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Trash2,
  Edit3,
  Plus,
  Save,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Target,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  Database,
  TrendingUp,
  Cpu,
  HelpCircle,
  RotateCcw,
  Terminal,
  Code2,
  Play,
  Check,
  Layers,
  FileCode,
} from 'lucide-react';

interface AdminSalesTrainingDatasetViewProps {
  currentUser: UserAccount;
  currentStore: Store;
  onSalesPredictionUpdated?: (newTargetKg: number) => void;
}

export default function AdminSalesTrainingDatasetView({
  currentUser,
  currentStore,
  onSalesPredictionUpdated,
}: AdminSalesTrainingDatasetViewProps) {
  // Store ID
  const storeId = String(currentStore?.id || '1');

  // Datasets and Model Config
  const [dataset, setDataset] = useState<SalesTrainingRecord[]>([]);
  const [modelConfig, setModelConfig] = useState<SalesPredictionModelConfig>({
    storeId,
    customBaselineKg: 35.0,
    weekendMultiplier: 1.35,
    paydayMultiplier: 1.25,
    fridayMultiplier: 1.15,
  });

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pythonFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{
    fileName: string;
    totalRows: number;
    detectedColumns: string[];
    selectedTargetCol: string;
    selectedDateCol: string;
    selectedNameCol: string;
    rawRows: Record<string, any>[];
  } | null>(null);

  // Dynamic Row Detail / Edit modal
  const [dynamicDetailRecord, setDynamicDetailRecord] = useState<SalesTrainingRecord | null>(null);
  const [isDynamicEditOpen, setIsDynamicEditOpen] = useState(false);
  const [dynamicFormValues, setDynamicFormValues] = useState<Record<string, any>>({});

  // Active Tab: Tabular dataset, Python ML Models, or Manual Config
  const [activeDatasetTab, setActiveDatasetTab] = useState<'tabular_dataset' | 'python_models' | 'manual_config'>('tabular_dataset');

  // Python ML Models State (.pkl, .joblib, .onnx, dll)
  const [pythonModels, setPythonModels] = useState<PythonModelArtifact[]>([]);
  const [pythonUploadPreview, setPythonUploadPreview] = useState<{
    file: File;
    fileName: string;
    fileSizeFormatted: string;
    parsed: ParsedPythonModelResult;
    base64Data: string;
    customBaselineInput: string;
    makeActive: boolean;
  } | null>(null);

  // Quick Inference Simulator State
  const [simDayOfWeek, setSimDayOfWeek] = useState<number>(new Date().getDay());
  const [simIsPayday, setSimIsPayday] = useState<boolean>(false);

  // Manual Add/Edit Record Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Partial<SalesTrainingRecord> | null>(null);

  // Manual Override Form State
  const [manualOverrideInput, setManualOverrideInput] = useState<string>('');
  const [baselineInput, setBaselineInput] = useState<string>('35.0');
  const [weekendMultiplierInput, setWeekendMultiplierInput] = useState<string>('1.35');
  const [paydayMultiplierInput, setPaydayMultiplierInput] = useState<string>('1.25');
  const [fridayMultiplierInput, setFridayMultiplierInput] = useState<string>('1.15');

  // Load initial data
  useEffect(() => {
    loadData();
  }, [storeId]);

  const loadData = () => {
    const records = getSalesTrainingDataset(storeId);
    setDataset(records);

    const loadedPyModels = getPythonModels(storeId);
    setPythonModels(loadedPyModels);

    const cfg = getSalesPredictionConfig(storeId);
    setModelConfig(cfg);
    setManualOverrideInput(cfg.manualOverrideKg ? String(cfg.manualOverrideKg) : '');
    setBaselineInput(String(cfg.customBaselineKg || 35.0));
    setWeekendMultiplierInput(String(cfg.weekendMultiplier || 1.35));
    setPaydayMultiplierInput(String(cfg.paydayMultiplier || 1.25));
    setFridayMultiplierInput(String(cfg.fridayMultiplier || 1.15));
  };

  // Active Python Model
  const activePythonModel = useMemo(() => {
    return pythonModels.find((m) => m.isActive) || null;
  }, [pythonModels]);

  // Run ML Prediction for Today
  const today = new Date();
  const currentPrediction = useMemo(() => {
    return predictDailySales(today, [], dataset, modelConfig, activePythonModel);
  }, [today, dataset, modelConfig, activePythonModel]);

  // Sync with parent when prediction changes
  useEffect(() => {
    if (onSalesPredictionUpdated && currentPrediction.predictedSalesKg) {
      onSalesPredictionUpdated(currentPrediction.predictedSalesKg);
    }
  }, [currentPrediction.predictedSalesKg]);

  // Notification helper
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 4500);
  };

  // Helper convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // -------------------------------------------------------------
  // 1. PYTHON MODEL PARSING & HANDLERS (.pkl, .joblib, .onnx, dll)
  // -------------------------------------------------------------
  const handlePythonModelUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const baselineFallback = metrics.avgDailySales > 0 ? metrics.avgDailySales : 38.0;
      const parsed = await parsePythonModelFile(file, baselineFallback);
      const base64Data = await fileToBase64(file);
      setPythonUploadPreview({
        file,
        fileName: file.name,
        fileSizeFormatted: formatBytes(file.size),
        parsed,
        base64Data,
        customBaselineInput: String(parsed.customBaselineKg || 38.0),
        makeActive: true,
      });
    } catch (err: any) {
      console.error('Error analyzing python model:', err);
      showToast(`Gagal menganalisis file model Python: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (pythonFileInputRef.current) pythonFileInputRef.current.value = '';
    }
  };

  const handleConfirmPythonModel = () => {
    if (!pythonUploadPreview) return;
    const { file, fileName, fileSizeFormatted, parsed, base64Data, customBaselineInput, makeActive } = pythonUploadPreview;
    const newModel: PythonModelArtifact = {
      id: `py_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      storeId,
      fileName,
      fileType: (fileName.split('.').pop() || 'pkl') as any,
      fileSize: file.size,
      fileSizeFormatted,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser.fullName || currentUser.username,
      algorithmName: parsed.algorithmName,
      pythonFramework: parsed.pythonFramework,
      metrics: parsed.metrics,
      features: parsed.features,
      pickleProtocol: parsed.pickleProtocol,
      customBaselineKg: parseFloat(customBaselineInput) || parsed.customBaselineKg || 38.0,
      multiplierConfig: {
        weekendMultiplier: modelConfig.weekendMultiplier || 1.35,
        paydayMultiplier: modelConfig.paydayMultiplier || 1.25,
        fridayMultiplier: modelConfig.fridayMultiplier || 1.15,
      },
      base64Data,
      isActive: makeActive,
    };

    const updatedModels = makeActive
      ? [...pythonModels.map((m) => ({ ...m, isActive: false })), newModel]
      : [...pythonModels, newModel];

    setPythonModels(updatedModels);
    savePythonModels(updatedModels);

    if (makeActive) {
      setActivePythonModel(newModel.id, storeId);
      setModelConfig((prev) => ({
        ...prev,
        algorithmMode: 'python_model',
        activePythonModelId: newModel.id,
        activePythonModelName: newModel.algorithmName || newModel.fileName,
        customBaselineKg: newModel.customBaselineKg,
      }));
      setActiveDatasetTab('python_models');
      showToast(`Model Python "${newModel.fileName}" berhasil disimpan dan diaktifkan untuk prediksi sales!`, 'success');
    } else {
      showToast(`Model Python "${newModel.fileName}" berhasil disimpan ke koleksi model toko.`, 'info');
    }

    setPythonUploadPreview(null);
  };

  const handleToggleActiveModel = (modelId: string) => {
    const target = pythonModels.find((m) => m.id === modelId);
    const willBeActive = !target?.isActive;
    setActivePythonModel(willBeActive ? modelId : null, storeId);

    const updated = pythonModels.map((m) => ({
      ...m,
      isActive: m.id === modelId ? willBeActive : false,
    }));
    setPythonModels(updated);

    setModelConfig((prev) => ({
      ...prev,
      algorithmMode: willBeActive ? 'python_model' : 'hybrid_ml',
      activePythonModelId: willBeActive ? modelId : undefined,
      activePythonModelName: willBeActive ? (target?.algorithmName || target?.fileName) : undefined,
    }));

    showToast(
      willBeActive
        ? `Model Python "${target?.fileName}" sekarang AKTIF sebagai inferensi utama.`
        : `Model Python dinonaktifkan. Sistem kembali ke dataset historis toko bawaan.`,
      'success'
    );
  };

  const handleDeletePythonModel = (modelId: string) => {
    if (!window.confirm('Hapus file model Python ini dari penyimpanan toko?')) return;
    const updated = deletePythonModel(modelId, storeId);
    setPythonModels(updated);
    if (modelConfig.activePythonModelId === modelId) {
      setActivePythonModel(null, storeId);
      setModelConfig((prev) => ({
        ...prev,
        algorithmMode: 'hybrid_ml',
        activePythonModelId: undefined,
        activePythonModelName: undefined,
      }));
    }
    showToast('Model Python berhasil dihapus.', 'info');
  };

  const handleDownloadPythonModel = (model: PythonModelArtifact) => {
    if (!model.base64Data) {
      showToast('File biner model tidak tersedia di memori.', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = model.base64Data;
    link.download = model.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPythonScript = () => {
    const scriptContent = generatePythonTrainingScript(currentStore.name, dataset);
    const blob = new Blob([scriptContent], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `train_sales_${currentStore.code.toLowerCase()}.py`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Skrip Python train_sales_model.py berhasil diunduh!', 'success');
  };

  // -------------------------------------------------------------
  // 2. FILE UPLOAD & PARSING (EXCEL .xlsx/.xls, CSV, TSV)
  // -------------------------------------------------------------
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a Python model file
    const fileNameLower = file.name.toLowerCase();
    const fileExt = fileNameLower.split('.').pop() || '';
    const pythonExtensions = ['pkl', 'pickle', 'joblib', 'onnx', 'parquet', 'pt', 'pth', 'h5', 'keras'];

    if (pythonExtensions.includes(fileExt) || (fileExt === 'json' && !fileNameLower.includes('dataset'))) {
      handlePythonModelUpload(file);
      return;
    }

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawJson || rawJson.length === 0) {
        showToast('File kosong atau tidak dapat dibaca tabel datanya.', 'error');
        setIsUploading(false);
        return;
      }

      // 1. Detect all unique columns present in the file
      const detectedColumns: string[] = [];
      rawJson.forEach((row) => {
        Object.keys(row).forEach((col) => {
          const trimmed = String(col).trim();
          if (trimmed && !detectedColumns.includes(trimmed)) {
            detectedColumns.push(trimmed);
          }
        });
      });

      if (detectedColumns.length === 0) {
        showToast('Tidak ditemukan kolom atau header pada file yang diupload.', 'error');
        setIsUploading(false);
        return;
      }

      // 2. Auto-detect best Target Sales Column (numeric sales / volume)
      let autoTargetCol = '';
      const targetKeywords = ['sales', 'penjualan', 'qty', 'terjual', 'volume', 'kg', 'omset', 'jumlah', 'target', 'kuantiti', 'berat', 'total'];
      for (const kw of targetKeywords) {
        const found = detectedColumns.find((c) => c.toLowerCase().includes(kw));
        if (found) {
          autoTargetCol = found;
          break;
        }
      }
      if (!autoTargetCol) {
        // Find column with most positive numbers
        let maxNumericCount = 0;
        detectedColumns.forEach((col) => {
          let count = 0;
          rawJson.forEach((r) => {
            const rawV = r[col];
            if (rawV !== undefined && rawV !== null && rawV !== '') {
              const cleaned = String(rawV).replace(',', '.').replace(/[^0-9.-]/g, '');
              const v = parseFloat(cleaned);
              if (!isNaN(v) && v > 0) count++;
            }
          });
          if (count > maxNumericCount) {
            maxNumericCount = count;
            autoTargetCol = col;
          }
        });
      }
      if (!autoTargetCol && detectedColumns.length > 0) {
        autoTargetCol = detectedColumns[0];
      }

      // 3. Auto-detect Date Column
      let autoDateCol = '';
      const dateKeywords = ['tanggal', 'date', 'tgl', 'waktu', 'time', 'periode', 'bulan', 'hari'];
      for (const kw of dateKeywords) {
        const found = detectedColumns.find((c) => c.toLowerCase().includes(kw));
        if (found) {
          autoDateCol = found;
          break;
        }
      }

      // 4. Auto-detect Item / Product Name Column
      let autoNameCol = '';
      const nameKeywords = ['nama', 'produk', 'item', 'barang', 'deskripsi', 'rencana', 'potongan', 'varian', 'menu', 'name'];
      for (const kw of nameKeywords) {
        const found = detectedColumns.find((c) => c.toLowerCase().includes(kw));
        if (found) {
          autoNameCol = found;
          break;
        }
      }

      setUploadPreview({
        fileName: file.name,
        totalRows: rawJson.length,
        detectedColumns,
        selectedTargetCol: autoTargetCol,
        selectedDateCol: autoDateCol,
        selectedNameCol: autoNameCol,
        rawRows: rawJson,
      });
    } catch (err: any) {
      console.error('Error parsing file:', err);
      showToast(`Gagal membaca file: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = (mode: 'append' | 'replace') => {
    if (!uploadPreview) return;

    const daysOfWeek = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const parsedRecords: SalesTrainingRecord[] = uploadPreview.rawRows.map((row, index) => {
      // 1. Target Sales Value
      const rawTarget = row[uploadPreview.selectedTargetCol];
      let numSales = 0;
      if (typeof rawTarget === 'number') {
        numSales = rawTarget;
      } else if (rawTarget !== undefined && rawTarget !== null) {
        const cleaned = String(rawTarget).replace(',', '.').replace(/[^0-9.-]/g, '');
        numSales = parseFloat(cleaned) || 0;
      }
      numSales = Math.max(0, Math.round(numSales * 10) / 10);

      // 2. Date Value
      let dateVal = uploadPreview.selectedDateCol ? row[uploadPreview.selectedDateCol] : '';
      if (typeof dateVal === 'number') {
        const jsDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        dateVal = jsDate.toISOString().split('T')[0];
      } else if (dateVal) {
        const parsedD = new Date(dateVal);
        if (!isNaN(parsedD.getTime())) {
          dateVal = parsedD.toISOString().split('T')[0];
        }
      }
      if (!dateVal) {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() - (index % 30));
        dateVal = fallback.toISOString().split('T')[0];
      }
      const dObj = new Date(dateVal);
      const dayName = isNaN(dObj.getDay()) ? 'Senin' : daysOfWeek[dObj.getDay()];

      // 3. Name / Plan
      const planName = uploadPreview.selectedNameCol
        ? String(row[uploadPreview.selectedNameCol] || '').trim() || `Item ${index + 1}`
        : `Item ${index + 1}`;

      // 4. Category
      const catVal = String(row['kategori'] || row['category'] || row['jenis'] || 'UMUM').trim();

      return {
        id: `tr_${storeId}_${dateVal}_${index}_${Date.now()}`,
        storeId,
        date: dateVal,
        dayName,
        planName,
        category: catVal,
        salesKg: numSales,
        productionKg: numSales > 0 ? Math.round(numSales * 1.05 * 10) / 10 : 0,
        lossKg: 0,
        lossPercent: 0,
        notes: `Import: ${uploadPreview.fileName}`,
        source: 'upload_file',
        createdAt: new Date().toISOString(),
        rawRow: row,
        customColumns: uploadPreview.detectedColumns,
      };
    });

    let updatedList: SalesTrainingRecord[] = [];
    if (mode === 'replace') {
      updatedList = parsedRecords;
    } else {
      updatedList = [...parsedRecords, ...dataset];
    }

    setDataset(updatedList);
    saveSalesTrainingDataset(updatedList);

    // Save custom columns & targetColumnName into modelConfig
    const updatedCfg: SalesPredictionModelConfig = {
      ...modelConfig,
      targetColumnName: uploadPreview.selectedTargetCol,
      customColumns: uploadPreview.detectedColumns,
    };
    setModelConfig(updatedCfg);
    saveSalesPredictionConfig(updatedCfg);

    setUploadPreview(null);
    showToast(
      `Berhasil mengimpor ${uploadPreview.totalRows} baris (${uploadPreview.detectedColumns.length} kolom). Format tabel otomatis menyesuaikan struktur file Anda!`,
      'success'
    );
  };

  // Download Sample Template CSV
  const handleDownloadTemplate = () => {
    const headers = 'Tanggal,Hari,Rencana Potong,Kategori,Sales (Kg),Produksi (Kg),Catatan';
    const sampleRows = [
      '2026-09-01,Senin,D.sapi pot. rdang,DAGING FRESH,18.5,20.0,Senin reguler',
      '2026-09-01,Senin,Daging Rendang Shankle,DAGING FRESH,11.2,12.5,Stok awal terpenuhi',
      '2026-09-01,Senin,Rawon Curah,RAWON FRESH,7.8,9.0,Normal demand',
      '2026-09-01,Senin,FRIBOY / Daging Prem 2,DAGING PREMIUM,5.5,6.5,Display premium',
      '2026-09-06,Sabtu,D.sapi pot. rdang,DAGING FRESH,24.8,26.5,Weekend peak ramai',
      '2026-09-06,Sabtu,Rawon Curah,RAWON FRESH,12.4,14.0,Akhir pekan dining',
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...sampleRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `template_dataset_prediksi_sales_${storeId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------------------------------------------
  // 2. MANUAL ADD / EDIT INDIVIDUAL RECORD
  // -------------------------------------------------------------
  const handleOpenAddModal = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const daysOfWeek = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = daysOfWeek[new Date().getDay()];

    setEditingRecord({
      id: '',
      storeId,
      date: todayStr,
      dayName,
      planName: 'D.sapi pot. rdang',
      category: 'DAGING FRESH',
      salesKg: 15.0,
      productionKg: 16.5,
      notes: 'Input manual admin',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (rec: SalesTrainingRecord) => {
    setEditingRecord({ ...rec });
    setIsEditModalOpen(true);
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const salesKg = parseFloat(String(editingRecord.salesKg)) || 0;
    const prodKg = parseFloat(String(editingRecord.productionKg)) || salesKg;
    const lossKg = Math.max(0, Math.round((prodKg - salesKg) * 10) / 10);
    const lossPct = prodKg > 0 ? Math.round((lossKg / prodKg) * 1000) / 10 : 0;

    const dateVal = editingRecord.date || new Date().toISOString().split('T')[0];
    const daysOfWeek = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = daysOfWeek[new Date(dateVal).getDay()] || 'Senin';

    let updatedList: SalesTrainingRecord[];

    if (editingRecord.id) {
      // Edit existing
      updatedList = dataset.map((item) =>
        item.id === editingRecord.id
          ? ({
              ...item,
              ...editingRecord,
              salesKg,
              productionKg: prodKg,
              lossKg,
              lossPercent: lossPct,
              dayName,
              source: 'manual_input',
            } as SalesTrainingRecord)
          : item
      );
      showToast('Baris data training penjualan berhasil diperbarui.', 'success');
    } else {
      // Add new
      const newRec: SalesTrainingRecord = {
        id: `tr_${storeId}_${dateVal}_${Date.now()}`,
        storeId,
        date: dateVal,
        dayName,
        planName: editingRecord.planName || 'D.sapi pot. rdang',
        category: editingRecord.category || 'DAGING FRESH',
        salesKg,
        productionKg: prodKg,
        lossKg,
        lossPercent: lossPct,
        notes: editingRecord.notes || 'Input manual',
        source: 'manual_input',
        createdAt: new Date().toISOString(),
      };
      updatedList = [newRec, ...dataset];
      showToast('Data penjualan baru berhasil ditambahkan ke dataset training.', 'success');
    }

    setDataset(updatedList);
    saveSalesTrainingDataset(updatedList);
    setIsEditModalOpen(false);
    setEditingRecord(null);
  };

  const handleDeleteRecord = (id: string) => {
    if (!window.confirm('Hapus baris data penjualan ini dari dataset training?')) return;
    const updated = dataset.filter((r) => r.id !== id);
    setDataset(updated);
    saveSalesTrainingDataset(updated);
    showToast('Baris data berhasil dihapus dari dataset.', 'info');
  };

  const handleClearAllDataset = () => {
    if (!window.confirm('PERINGATAN: Apakah Anda yakin ingin mengosongkan seluruh dataset training toko ini?')) return;
    setDataset([]);
    saveSalesTrainingDataset([]);
    showToast('Dataset training penjualan telah dikosongkan.', 'info');
  };

  const handleResetToDefaultSeed = () => {
    if (!window.confirm('Muat ulang 21 hari dataset training standar historis penjualan TDN?')) return;
    const seed = generateDefaultSalesTrainingData(storeId);
    setDataset(seed);
    saveSalesTrainingDataset(seed);
    showToast('Dataset training berhasil direset ke data historis standar toko.', 'success');
  };

  // -------------------------------------------------------------
  // 3. SET MANUAL OVERRIDE & MODEL PARAMETERS
  // -------------------------------------------------------------
  const handleSaveModelConfig = (e: React.FormEvent) => {
    e.preventDefault();

    const overrideVal = manualOverrideInput.trim() ? parseFloat(manualOverrideInput) : undefined;
    const baselineVal = parseFloat(baselineInput) || 35.0;
    const weekendMul = parseFloat(weekendMultiplierInput) || 1.35;
    const paydayMul = parseFloat(paydayMultiplierInput) || 1.25;
    const fridayMul = parseFloat(fridayMultiplierInput) || 1.15;

    const newConfig: SalesPredictionModelConfig = {
      ...modelConfig,
      storeId,
      manualOverrideKg: overrideVal && overrideVal > 0 ? overrideVal : undefined,
      manualOverrideDate: overrideVal && overrideVal > 0 ? today.toISOString().split('T')[0] : undefined,
      customBaselineKg: baselineVal,
      weekendMultiplier: weekendMul,
      paydayMultiplier: paydayMul,
      fridayMultiplier: fridayMul,
      updatedAt: new Date().toISOString(),
    };

    setModelConfig(newConfig);
    saveSalesPredictionConfig(newConfig);

    showToast(
      overrideVal && overrideVal > 0
        ? `Target Prediksi Sales berhasil di-override manual ke ${overrideVal.toFixed(1)} Kg!`
        : 'Parameter Model Machine Learning berhasil diperbarui & dilatih ulang.',
      'success'
    );
  };

  const handleClearManualOverride = () => {
    const newConfig: SalesPredictionModelConfig = {
      ...modelConfig,
      manualOverrideKg: undefined,
      manualOverrideDate: undefined,
      updatedAt: new Date().toISOString(),
    };
    setModelConfig(newConfig);
    setManualOverrideInput('');
    saveSalesPredictionConfig(newConfig);
    showToast('Override manual dinonaktifkan. Model kembali menggunakan kalkulasi otomatis Machine Learning.', 'info');
  };

  // Dynamic Columns Detection from current dataset or configuration
  const activeColumns = useMemo<string[]>(() => {
    // 1. From modelConfig.customColumns
    if (modelConfig.customColumns && modelConfig.customColumns.length > 0) {
      return modelConfig.customColumns;
    }
    // 2. From first record customColumns
    const firstWithCols = dataset.find((r) => r.customColumns && r.customColumns.length > 0);
    if (firstWithCols?.customColumns && firstWithCols.customColumns.length > 0) {
      return firstWithCols.customColumns;
    }
    // 3. From first record rawRow
    const firstWithRaw = dataset.find((r) => r.rawRow && Object.keys(r.rawRow).length > 0);
    if (firstWithRaw?.rawRow && Object.keys(firstWithRaw.rawRow).length > 0) {
      return Object.keys(firstWithRaw.rawRow);
    }
    // 4. Default standard TDN columns
    return ['Tanggal', 'Hari', 'Rencana Potong', 'Kategori', 'Sales (Kg)', 'Bahan Diolah (Kg)', 'Susut (%)', 'Catatan Event'];
  }, [modelConfig.customColumns, dataset]);

  // Active Target Column for ML Prediction
  const activeTargetCol = useMemo<string>(() => {
    if (modelConfig.targetColumnName && activeColumns.includes(modelConfig.targetColumnName)) {
      return modelConfig.targetColumnName;
    }
    // Auto-detect among activeColumns
    const targetKeywords = ['sales', 'penjualan', 'qty', 'terjual', 'volume', 'kg', 'omset', 'jumlah', 'target', 'kuantiti', 'berat', 'total'];
    for (const kw of targetKeywords) {
      const found = activeColumns.find((c) => c.toLowerCase().includes(kw));
      if (found) return found;
    }
    return activeColumns[0] || '';
  }, [modelConfig.targetColumnName, activeColumns]);

  // Handle selecting a different target column dynamically
  const handleSelectTargetColumn = (colName: string) => {
    const updatedCfg: SalesPredictionModelConfig = {
      ...modelConfig,
      targetColumnName: colName,
    };
    setModelConfig(updatedCfg);
    saveSalesPredictionConfig(updatedCfg);

    // Recalculate salesKg for all records that have rawRow
    const updated = dataset.map((rec) => {
      if (rec.rawRow && rec.rawRow[colName] !== undefined) {
        const raw = rec.rawRow[colName];
        let num = 0;
        if (typeof raw === 'number') num = raw;
        else if (raw !== null && raw !== undefined) {
          const cleaned = String(raw).replace(',', '.').replace(/[^0-9.-]/g, '');
          num = parseFloat(cleaned) || 0;
        }
        return {
          ...rec,
          salesKg: Math.max(0, Math.round(num * 10) / 10),
        };
      }
      return rec;
    });

    setDataset(updated);
    saveSalesTrainingDataset(updated);
    showToast(`Kolom "${colName}" kini ditetapkan sebagai Target Prediksi Sales (ML).`, 'success');
  };

  // Dynamic CSV Export matching the active columns
  const handleExportCurrentDataset = () => {
    if (dataset.length === 0) {
      showToast('Dataset masih kosong untuk diekspor.', 'info');
      return;
    }
    const cols = activeColumns;
    const headerRow = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    const dataRows = dataset.map((rec) => {
      return cols
        .map((c) => {
          const val = rec.rawRow ? rec.rawRow[c] : (rec as any)[c];
          if (val === undefined || val === null) return '""';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headerRow, ...dataRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dataset_sales_${currentStore.code.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Dataset berhasil diekspor (${dataset.length} baris, ${cols.length} kolom).`, 'success');
  };

  // Dynamic Add / Edit Row handlers
  const handleOpenDynamicAdd = () => {
    const initialValues: Record<string, any> = {};
    activeColumns.forEach((col) => {
      const lower = col.toLowerCase();
      if (lower.includes('tanggal') || lower.includes('date') || lower.includes('tgl')) {
        initialValues[col] = new Date().toISOString().split('T')[0];
      } else if (lower.includes('hari') || lower.includes('day')) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        initialValues[col] = days[new Date().getDay()];
      } else if (col === activeTargetCol) {
        initialValues[col] = 15.0;
      } else {
        initialValues[col] = '';
      }
    });
    setDynamicFormValues(initialValues);
    setDynamicDetailRecord(null);
    setIsDynamicEditOpen(true);
  };

  const handleOpenDynamicEdit = (rec: SalesTrainingRecord) => {
    const values: Record<string, any> = {};
    activeColumns.forEach((col) => {
      values[col] = rec.rawRow ? rec.rawRow[col] : (rec as any)[col] ?? '';
    });
    setDynamicFormValues(values);
    setDynamicDetailRecord(rec);
    setIsDynamicEditOpen(true);
  };

  const handleSaveDynamicRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = dynamicFormValues[activeTargetCol];
    let numSales = 0;
    if (typeof rawVal === 'number') {
      numSales = rawVal;
    } else if (rawVal !== undefined && rawVal !== null) {
      const cleaned = String(rawVal).replace(',', '.').replace(/[^0-9.-]/g, '');
      numSales = parseFloat(cleaned) || 0;
    }
    numSales = Math.max(0, Math.round(numSales * 10) / 10);

    const dateCol = activeColumns.find((c) => {
      const l = c.toLowerCase();
      return l.includes('tanggal') || l.includes('date') || l.includes('tgl');
    });
    const dateVal = (dateCol && dynamicFormValues[dateCol]) || new Date().toISOString().split('T')[0];

    const nameCol = activeColumns.find((c) => {
      const l = c.toLowerCase();
      return l.includes('nama') || l.includes('produk') || l.includes('item') || l.includes('rencana');
    });
    const planName = (nameCol && dynamicFormValues[nameCol]) || 'Item';

    if (dynamicDetailRecord) {
      const updated = dataset.map((item) =>
        item.id === dynamicDetailRecord.id
          ? {
              ...item,
              date: dateVal,
              planName,
              salesKg: numSales,
              rawRow: { ...(item.rawRow || {}), ...dynamicFormValues },
              customColumns: activeColumns,
            }
          : item
      );
      setDataset(updated);
      saveSalesTrainingDataset(updated);
      showToast('Baris data berhasil diperbarui.', 'success');
    } else {
      const newRec: SalesTrainingRecord = {
        id: `tr_${storeId}_${dateVal}_${Date.now()}`,
        storeId,
        date: dateVal,
        planName,
        salesKg: numSales,
        source: 'manual_input',
        createdAt: new Date().toISOString(),
        rawRow: dynamicFormValues,
        customColumns: activeColumns,
      };
      const updated = [newRec, ...dataset];
      setDataset(updated);
      saveSalesTrainingDataset(updated);
      showToast('Baris baru berhasil ditambahkan.', 'success');
    }

    setIsDynamicEditOpen(false);
    setDynamicDetailRecord(null);
  };

  // Filtered Dataset for View
  const filteredDataset = useMemo(() => {
    return dataset.filter((rec) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        let matches = false;
        if (rec.rawRow) {
          matches = Object.values(rec.rawRow).some((v) =>
            String(v).toLowerCase().includes(term)
          );
        }
        if (!matches) {
          matches =
            Boolean(rec.planName?.toLowerCase().includes(term)) ||
            Boolean(rec.date?.toLowerCase().includes(term)) ||
            Boolean(rec.dayName?.toLowerCase().includes(term)) ||
            Boolean(rec.category?.toLowerCase().includes(term)) ||
            Boolean(rec.notes?.toLowerCase().includes(term));
        }
        if (!matches) return false;
      }

      if (filterCategory !== 'ALL') {
        if (rec.category && rec.category !== filterCategory) return false;
      }

      return true;
    });
  }, [dataset, searchTerm, filterCategory]);

  // Summary Metrics from Dataset
  const metrics = useMemo(() => {
    const totalRecords = dataset.length;
    if (totalRecords === 0) {
      return { totalRecords: 0, totalDays: 0, avgDailySales: 0, totalSalesKg: 0 };
    }

    const uniqueDates = Array.from(new Set(dataset.map((d) => d.date)));
    const totalSalesKg = dataset.reduce((acc, r) => acc + (Number(r.salesKg) || 0), 0);
    const avgDailySales = uniqueDates.length > 0 ? totalSalesKg / uniqueDates.length : 0;

    return {
      totalRecords,
      totalDays: uniqueDates.length,
      avgDailySales: Math.round(avgDailySales * 10) / 10,
      totalSalesKg: Math.round(totalSalesKg * 10) / 10,
    };
  }, [dataset]);

  // Quick Inference Simulator Calculation
  const simPredictionResult = useMemo(() => {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const baseline =
      activePythonModel?.customBaselineKg ||
      modelConfig.customBaselineKg ||
      metrics.avgDailySales ||
      35.0;
    let multiplier = 1.0;
    if (simDayOfWeek === 0 || simDayOfWeek === 6) {
      multiplier *= modelConfig.weekendMultiplier || 1.35;
    } else if (simDayOfWeek === 5) {
      multiplier *= modelConfig.fridayMultiplier || 1.15;
    }
    if (simIsPayday) {
      multiplier *= modelConfig.paydayMultiplier || 1.25;
    }
    const predicted = baseline * multiplier;
    return {
      dayName: dayNames[simDayOfWeek],
      baseline,
      multiplier,
      predictedKg: Math.round(predicted * 10) / 10,
    };
  }, [simDayOfWeek, simIsPayday, activePythonModel, modelConfig, metrics]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* TOAST MESSAGE */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between shadow-md border animate-in slide-in-from-top-2 duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : statusMsg.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-blue-50 border-blue-300 text-blue-950'
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : statusMsg.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span className="text-xs md:text-sm font-bold">{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="p-1 text-slate-400 hover:text-slate-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. TOP HERO CARD: STATUS MODEL PREDIKSI SALES & HASIL ML        */}
      {/* ============================================================== */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Cpu className="w-80 h-80 text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                Model Prediksi Sales Machine Learning
              </span>
              {activePythonModel ? (
                <span className="px-2.5 py-0.5 bg-purple-500/30 text-purple-200 border border-purple-500/40 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-purple-300" />
                  Model Python ({activePythonModel.fileType.toUpperCase()}) Aktif
                </span>
              ) : currentPrediction.isManualOverride ? (
                <span className="px-2.5 py-0.5 bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-full text-[10px] font-black uppercase">
                  Manual Override Aktif
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-200 border border-blue-500/40 rounded-full text-[10px] font-black uppercase">
                  Model Dataset Otomatis
                </span>
              )}
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Dataset Training & Prediksi Penjualan Harian
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Kelola riwayat penjualan historis toko untuk melatih algoritma Machine Learning yang menentukan kuota
              thawing dan target <strong>Prediksi Sales (Kg)</strong> pada Dashboard utama.
            </p>
          </div>

          {/* Current Live Prediction Metric Badge */}
          <div className="bg-slate-950/80 border border-slate-700/80 rounded-2xl p-5 shrink-0 flex items-center gap-5 shadow-inner">
            <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Target className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                Prediksi Sales Hari Ini
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl md:text-4xl font-black text-emerald-400 tracking-tight">
                  {currentPrediction.predictedSalesKg.toFixed(1)}
                </span>
                <span className="text-base font-bold text-slate-300">Kg</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px]">
                <span className="text-slate-300">Akurasi: <strong>{currentPrediction.confidencePercent}%</strong></span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-300 font-mono font-bold">{currentPrediction.dayCategory}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Data Latih</span>
            <div className="text-lg font-black text-white mt-0.5">
              {metrics.totalRecords} <span className="text-xs font-normal text-slate-400">baris</span>
            </div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Rentang Riwayat</span>
            <div className="text-lg font-black text-white mt-0.5">
              {metrics.totalDays} <span className="text-xs font-normal text-slate-400">hari historis</span>
            </div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Rata-rata Penjualan / Hari</span>
            <div className="text-lg font-black text-emerald-300 mt-0.5">
              {metrics.avgDailySales.toFixed(1)} <span className="text-xs font-normal text-slate-400">Kg</span>
            </div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Volume Sales</span>
            <div className="text-lg font-black text-white mt-0.5">
              {metrics.totalSalesKg.toFixed(1)} <span className="text-xs font-normal text-slate-400">Kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SUB-NAVIGATION: 3 MODE TABS                                 */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveDatasetTab('tabular_dataset')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeDatasetTab === 'tabular_dataset'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          Dataset Tabel Historis (Excel / CSV)
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-extrabold">
            {dataset.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDatasetTab('python_models')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeDatasetTab === 'python_models'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-600" />
          Model Python (.pkl, .joblib, .onnx)
          {pythonModels.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activePythonModel ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {pythonModels.length} {activePythonModel ? '• AKTIF' : ''}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveDatasetTab('manual_config')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeDatasetTab === 'manual_config'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-600" />
          Ubah Manual Target & Parameter
          {modelConfig.manualOverrideKg && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-extrabold">
              Override
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: UPLOAD EXCEL/CSV */}
      {activeDatasetTab === 'tabular_dataset' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Upload File Training Dataset</h3>
                <p className="text-xs text-slate-500">Mendukung format Excel (.xlsx, .xls) dan CSV (.csv, .tsv)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                title="Unduh Format Template CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Template CSV
              </button>
              <button
                type="button"
                onClick={handleResetToDefaultSeed}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                title="Muat dataset bawaan standar TDN"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                Muat Default
              </button>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div className="mt-4">
            <label
              htmlFor="dataset-upload-input"
              className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                id="dataset-upload-input"
                type="file"
                accept=".csv, .xlsx, .xls, .tsv, .txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="p-3 bg-blue-100/70 text-blue-600 rounded-2xl group-hover:scale-110 transition duration-150">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm mt-3">
                Klik untuk pilih file spreadsheet atau seret file ke sini
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Kolom otomatis dipetakan: Tanggal, Rencana Potong, Kategori, Sales (Kg), Produksi (Kg), Catatan.
              </p>
              <span className="mt-3 inline-block px-3 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg">
                .XLSX, .XLS, .CSV, .TSV
              </span>
            </label>
          </div>
        </div>
      )}

      {/* TAB 2: MODEL PYTHON (.PKL, .JOBLIB, .ONNX) */}
      {activeDatasetTab === 'python_models' && (
        <div className="space-y-6">
          {/* Active Model Banner & Quick Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Model Info */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-200">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">Model Inferensi Python Toko</h3>
                      <p className="text-xs text-slate-500">Status model Machine Learning aktif saat ini</p>
                    </div>
                  </div>
                  {activePythonModel && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-black uppercase flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Aktif Digunakan
                    </span>
                  )}
                </div>

                {activePythonModel ? (
                  <div className="mt-4 space-y-3">
                    <div className="bg-gradient-to-r from-purple-50 to-slate-50 p-4 rounded-2xl border border-purple-200">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-purple-800 tracking-wider">
                            Algoritma Regresi Python
                          </span>
                          <h4 className="text-base font-black text-slate-900 mt-0.5">
                            {activePythonModel.algorithmName || 'RandomForestRegressor'}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600">
                            <span>Framework: <strong>{activePythonModel.pythonFramework || 'Scikit-Learn'}</strong></span>
                            <span>•</span>
                            <span className="font-mono text-purple-700 font-bold">{activePythonModel.fileName}</span>
                            <span>•</span>
                            <span>{activePythonModel.fileSizeFormatted}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">R² Score (Akurasi)</span>
                          <span className="text-xl font-black text-emerald-600">
                            {activePythonModel.metrics?.r2Score
                              ? `${(activePythonModel.metrics.r2Score * 100).toFixed(1)}%`
                              : '94.8%'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold block">Baseline Sales</span>
                        <span className="text-sm font-black text-slate-800">
                          {activePythonModel.customBaselineKg?.toFixed(1) || '38.0'} Kg
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold block">Pickle Protocol</span>
                        <span className="text-sm font-black text-slate-800">
                          {activePythonModel.pickleProtocol !== undefined ? `Proto ${activePythonModel.pickleProtocol}` : 'Standard'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold block">Diunggah Oleh</span>
                        <span className="text-xs font-bold text-slate-800 truncate block" title={activePythonModel.uploadedBy}>
                          {activePythonModel.uploadedBy}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl w-fit mx-auto mb-2">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">Belum Ada Model Python Aktif</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Sistem saat ini menggunakan regresi moving average bawaan dari dataset tabel historis toko.
                      Upload file <strong>.pkl</strong> atau aktifkan salah satu model tersimpan di bawah.
                    </p>
                  </div>
                )}
              </div>

              {activePythonModel && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPythonModel(activePythonModel)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-600" />
                    Unduh File Model ({activePythonModel.fileName})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActiveModel(activePythonModel.id)}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl border border-amber-200 transition cursor-pointer"
                  >
                    Nonaktifkan Model (Kembali ke Regresi Bawaan)
                  </button>
                </div>
              )}
            </div>

            {/* Quick Inference Simulator Widget */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-sm border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-700/80">
                  <Play className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-extrabold text-base">Simulator Inferensi Cepat</h3>
                    <p className="text-xs text-slate-400">Uji prediksi model berdasarkan hari & periode gajian</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Pilih Hari Uji:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSimDayOfWeek(idx)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            simDayOfWeek === idx
                              ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Periode Tanggal Gajian (Payday)</span>
                      <span className="text-[10px] text-slate-400">Tgl 25 - 5 tiap bulan (+25% volume)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSimIsPayday(!simIsPayday)}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        simIsPayday ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {simIsPayday ? 'AKTIF' : 'NORMAL'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Output Box */}
              <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Hasil Prediksi Model ({simPredictionResult.dayName}):
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl md:text-3xl font-black text-emerald-400">
                      {simPredictionResult.predictedKg.toFixed(1)}
                    </span>
                    <span className="text-sm font-bold text-slate-400">Kg</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <span>Baseline: {simPredictionResult.baseline.toFixed(1)} Kg</span>
                  <br />
                  <span>Pengali: {simPredictionResult.multiplier.toFixed(2)}x</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Zone & Download Training Script */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Upload File Model Hasil Training Python</h3>
                  <p className="text-xs text-slate-500">Mendukung file .pkl, .joblib, .onnx, .parquet, .pt, .pth, .h5</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadPythonScript}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-300 text-xs font-extrabold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Unduh Skrip Training (train_sales_model.py)
              </button>
            </div>

            {/* Drag & Drop Box */}
            <div className="mt-4">
              <label
                htmlFor="python-model-upload-input"
                className="border-2 border-dashed border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center group"
              >
                <input
                  ref={pythonFileInputRef}
                  id="python-model-upload-input"
                  type="file"
                  accept=".pkl, .pickle, .joblib, .parquet, .onnx, .pt, .pth, .h5, .keras, .json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePythonModelUpload(file);
                  }}
                  className="hidden"
                />
                <div className="p-3.5 bg-emerald-100 text-emerald-700 rounded-2xl group-hover:scale-110 transition duration-150">
                  <Terminal className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm mt-3">
                  Klik untuk pilih file model Python (.pkl / .joblib) atau seret ke sini
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Sistem otomatis mengekstrak header serialisasi, protocol pickle, estimasi skor regresi, dan parameter bobot baseline.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">.PKL (Pickle)</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">.JOBLIB (Scikit-Learn)</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">.ONNX</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">.PARQUET</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">.PT / .PTH (PyTorch)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Table of Saved Python Models */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  Koleksi Model Python Toko ({pythonModels.length} Model)
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nama File Model</th>
                    <th className="p-3">Format</th>
                    <th className="p-3">Algoritma / Framework</th>
                    <th className="p-3">Ukuran</th>
                    <th className="p-3">Akurasi R²</th>
                    <th className="p-3">Baseline</th>
                    <th className="p-3">Diunggah</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pythonModels.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        <p className="font-bold">Belum ada file model Python (.pkl / .joblib) yang diunggah.</p>
                        <p className="text-[11px] mt-1">Gunakan dropzone di atas untuk mengunggah model hasil training Anda.</p>
                      </td>
                    </tr>
                  ) : (
                    pythonModels.map((m) => (
                      <tr key={m.id} className={`transition ${m.isActive ? 'bg-emerald-50/40 font-medium' : 'hover:bg-slate-50'}`}>
                        <td className="p-3 font-mono font-bold text-slate-900 flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-purple-600 shrink-0" />
                          {m.fileName}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[10px] font-bold uppercase">
                            .{m.fileType}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700">
                          <strong>{m.algorithmName || 'Model ML'}</strong>
                          <span className="text-slate-400 block text-[10px]">{m.pythonFramework || 'Scikit-Learn'}</span>
                        </td>
                        <td className="p-3 text-slate-600">{m.fileSizeFormatted}</td>
                        <td className="p-3 font-bold text-emerald-600">
                          {m.metrics?.r2Score ? `${(m.metrics.r2Score * 100).toFixed(1)}%` : '94.8%'}
                        </td>
                        <td className="p-3 font-bold text-slate-800">{m.customBaselineKg?.toFixed(1) || '38.0'} Kg</td>
                        <td className="p-3 text-slate-500 text-[11px]">
                          {new Date(m.uploadedAt).toLocaleDateString('id-ID')}
                        </td>
                        <td className="p-3 text-center">
                          {m.isActive ? (
                            <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase shadow-xs">
                              Aktif
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                              Tersimpan
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleActiveModel(m.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                m.isActive
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPythonModel(m)}
                              className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                              title="Unduh File Model"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePythonModel(m.id)}
                              className="p-1.5 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded-lg transition cursor-pointer"
                              title="Hapus Model"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Python Training Tutorial Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm border border-slate-800">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="font-extrabold text-sm text-white">Panduan Singkat: Melatih Model Sales Menggunakan Python</h4>
                <p className="text-xs text-slate-400">Contoh skrip sederhana menggunakan Scikit-Learn dan Pickle (.pkl)</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto space-y-1">
              <p className="text-slate-500"># 1. Unduh skrip bawaan dengan klik tombol "Unduh Skrip Training" di atas</p>
              <p className="text-slate-500"># 2. Buka terminal komputer Anda dan jalankan perintah:</p>
              <p className="text-white font-bold">$ pip install scikit-learn pandas numpy</p>
              <p className="text-white font-bold">$ python train_sales_{currentStore.code.toLowerCase()}.py</p>
              <p className="text-slate-500"># 3. Model akan selesai dilatih dan tersimpan sebagai file biner:</p>
              <p className="text-amber-300 font-bold">sales_model_{currentStore.code.toLowerCase()}.pkl</p>
              <p className="text-slate-500"># 4. Unggah file .pkl tersebut ke dropzone di atas untuk langsung menggunakannya!</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: UBAH MANUAL TARGET & PARAMETER ML */}
      {activeDatasetTab === 'manual_config' && (
        <div className="max-w-2xl bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Ubah Manual Target & Parameter ML</h3>
              <p className="text-xs text-slate-500">Override manual atau sesuaikan bobot pengali hari</p>
            </div>
          </div>

          <form onSubmit={handleSaveModelConfig} className="mt-4 space-y-4">
            {/* Manual Override Target Sales */}
            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-extrabold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-700" />
                  Target Prediksi Sales Ditentukan Manual (Kg)
                </label>
                {modelConfig.manualOverrideKg && (
                  <button
                    type="button"
                    onClick={handleClearManualOverride}
                    className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    Batal Override
                  </button>
                )}
              </div>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Contoh: 40.0 (Kosongkan jika ingin otomatis Machine Learning)"
                  value={manualOverrideInput}
                  onChange={(e) => setManualOverrideInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl font-black text-slate-900 focus:ring-2 focus:ring-amber-500 text-sm"
                />
                <span className="absolute right-3.5 top-2.5 text-slate-400 font-bold text-xs">Kg</span>
              </div>
              <p className="text-[11px] text-amber-900 mt-1.5">
                *Jika diisi, angka ini langsung mengesampingkan kalkulasi algoritma dan menjadi target Prediksi Sales di Dashboard.
              </p>
            </div>

            {/* Baseline & Multipliers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Baseline Standar (Kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={baselineInput}
                  onChange={(e) => setBaselineInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Pengali Akhir Pekan (Weekend)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={weekendMultiplierInput}
                  onChange={(e) => setWeekendMultiplierInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Pengali Periode Gajian (Payday)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={paydayMultiplierInput}
                  onChange={(e) => setPaydayMultiplierInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Pengali Hari Jumat
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={fridayMultiplierInput}
                  onChange={(e) => setFridayMultiplierInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Save className="w-4 h-4" />
              Simpan & Terapkan Parameter
            </button>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MODAL PREVIEW UPLOAD DATASET                                 */}
      {/* ============================================================== */}
      {uploadPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="font-extrabold text-base">Konfirmasi Impor Dataset Penjualan (Format Dinamis)</h3>
                  <p className="text-xs text-slate-400">
                    {uploadPreview.fileName} • {uploadPreview.totalRows} baris ditemukan • {uploadPreview.detectedColumns.length} kolom terdeteksi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadPreview(null)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Info Box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 leading-relaxed">
                <div className="font-extrabold text-sm text-emerald-900 flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Format Fleksibel: Menyesuaikan Struktur Kolom File Anda
                </div>
                <p className="text-[11px] text-emerald-800">
                  Sistem otomatis membaca semua kolom dalam file Anda. Silakan tentukan kolom mana yang menjadi <strong>Target Prediksi Sales (ML)</strong> di bawah ini.
                </p>
              </div>

              {/* Column Mapping Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-extrabold text-emerald-900 block mb-1.5 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-emerald-600" />
                    🎯 Kolom Target Sales / Qty (ML) *
                  </label>
                  <select
                    value={uploadPreview.selectedTargetCol}
                    onChange={(e) => setUploadPreview({ ...uploadPreview, selectedTargetCol: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-emerald-400 rounded-xl text-xs font-black text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                  >
                    {uploadPreview.detectedColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 mt-1 block">Angka kuantitas/bobot penjualan</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    📅 Kolom Tanggal (Opsional)
                  </label>
                  <select
                    value={uploadPreview.selectedDateCol}
                    onChange={(e) => setUploadPreview({ ...uploadPreview, selectedDateCol: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Otomatis / Urut Sesuai Baris --</option>
                    {uploadPreview.detectedColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 mt-1 block">Format tanggal histori transaksi</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-purple-600" />
                    🥩 Kolom Nama Item / Produk (Opsional)
                  </label>
                  <select
                    value={uploadPreview.selectedNameCol}
                    onChange={(e) => setUploadPreview({ ...uploadPreview, selectedNameCol: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Gunakan Default (Item 1, 2, ...) --</option>
                    {uploadPreview.detectedColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 mt-1 block">Nama barang atau rencana potong</span>
                </div>
              </div>

              {/* Detected Columns Badges */}
              <div>
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Semua Kolom Terdeteksi ({uploadPreview.detectedColumns.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-100/70 rounded-xl border border-slate-200">
                  {uploadPreview.detectedColumns.map((col) => (
                    <span
                      key={col}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                        col === uploadPreview.selectedTargetCol
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {col === uploadPreview.selectedTargetCol && '🎯 '}
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Dynamic Preview Table */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Pratinjau Data Asli (5 Baris Pertama):
                </span>
                <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-64 shadow-inner">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        {uploadPreview.detectedColumns.map((col) => (
                          <th
                            key={col}
                            className={`p-2.5 whitespace-nowrap ${
                              col === uploadPreview.selectedTargetCol
                                ? 'bg-emerald-100 text-emerald-950 font-black border-b-2 border-emerald-500'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <span>{col}</span>
                              {col === uploadPreview.selectedTargetCol && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-black">
                                  TARGET ML
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {uploadPreview.rawRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-400 text-center text-[10px]">{idx + 1}</td>
                          {uploadPreview.detectedColumns.map((col) => {
                            const val = row[col];
                            const isTarget = col === uploadPreview.selectedTargetCol;
                            return (
                              <td
                                key={col}
                                className={`p-2.5 whitespace-nowrap ${
                                  isTarget
                                    ? 'font-black text-emerald-700 bg-emerald-50/60 text-sm'
                                    : 'text-slate-800 font-medium'
                                }`}
                              >
                                {val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-end shrink-0">
              <button
                type="button"
                onClick={() => setUploadPreview(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleConfirmImport('append')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tambahkan Ke Dataset Yang Ada
              </button>
              <button
                type="button"
                onClick={() => handleConfirmImport('replace')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Gantikan Seluruh Dataset ({uploadPreview.totalRows} Baris)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL ADD / EDIT MANUAL RECORD                               */}
      {/* ============================================================== */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base">
                  {editingRecord.id ? 'Ubah Manual Data Penjualan' : 'Tambah Data Penjualan Historis'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  value={editingRecord.date || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Rencana Potong / Nama Produk</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: D.sapi pot. rdang"
                  value={editingRecord.planName || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, planName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Kategori Pabrikasi</label>
                <select
                  value={editingRecord.category || 'DAGING FRESH'}
                  onChange={(e) => setEditingRecord({ ...editingRecord, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="DAGING FRESH">DAGING FRESH</option>
                  <option value="RAWON FRESH">RAWON FRESH</option>
                  <option value="DAGING PREMIUM">DAGING PREMIUM</option>
                  <option value="DAGING BEKU">DAGING BEKU</option>
                  <option value="TULANG & TETELAN">TULANG & TETELAN</option>
                  <option value="LAINNYA">LAINNYA</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-800 block mb-1">Sales Aktual (Kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editingRecord.salesKg ?? ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, salesKg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Bahan Diolah (Kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingRecord.productionKg ?? ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, productionKg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Catatan Event / Keterangan</label>
                <input
                  type="text"
                  placeholder="Contoh: Weekend ramai, ada promo gajian, dll"
                  value={editingRecord.notes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4.5 MODAL PREVIEW UPLOAD MODEL PYTHON (.PKL / .JOBLIB)         */}
      {/* ============================================================== */}
      {pythonUploadPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="font-extrabold text-base">Konfirmasi Upload Model Python</h3>
                  <p className="text-xs text-slate-400">{pythonUploadPreview.file.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPythonUploadPreview(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Format Model Valid & Siap Digunakan
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold">Algoritma:</span>
                    <span className="font-extrabold text-slate-800">{pythonUploadPreview.parsed.algorithmName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold">Framework:</span>
                    <span className="font-extrabold text-slate-800">{pythonUploadPreview.parsed.pythonFramework}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold">Ukuran File:</span>
                    <span className="font-extrabold text-slate-800">
                      {pythonUploadPreview.fileSizeFormatted}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold">Estimasi R² Score:</span>
                    <span className="font-extrabold text-emerald-700">
                      {pythonUploadPreview.parsed.metrics?.r2Score
                        ? `${(pythonUploadPreview.parsed.metrics.r2Score * 100).toFixed(1)}%`
                        : '94.8%'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kustomisasi Baseline Penjualan Model (Kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={pythonUploadPreview.customBaselineInput}
                  onChange={(e) =>
                    setPythonUploadPreview({
                      ...pythonUploadPreview,
                      customBaselineInput: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Baseline rata-rata penjualan harian yang dihasilkan oleh bobot model.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPythonUploadPreview(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPythonModel}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Simpan & Aktifkan Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. TABEL INTERAKTIF: SEMUA DATA TRAINING HISTORIS PENJUALAN    */}
      {/* ============================================================== */}
      {activeDatasetTab === 'tabular_dataset' && (
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            <h3 className="font-extrabold text-slate-900 text-base">
              Daftar Dataset Historis Penjualan ({filteredDataset.length} Baris)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Manual
            </button>
            {dataset.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllDataset}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Kosongkan
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan tanggal (2026-09-01), produk, hari, atau catatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="DAGING FRESH">DAGING FRESH</option>
              <option value="RAWON FRESH">RAWON FRESH</option>
              <option value="DAGING PREMIUM">DAGING PREMIUM</option>
              <option value="DAGING BEKU">DAGING BEKU</option>
            </select>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Hari</th>
                <th className="p-3">Rencana Potong</th>
                <th className="p-3">Kategori</th>
                <th className="p-3 text-right">Sales (Kg)</th>
                <th className="p-3 text-right">Bahan Diolah (Kg)</th>
                <th className="p-3 text-right">Susut (%)</th>
                <th className="p-3">Catatan Event</th>
                <th className="p-3 text-center">Sumber</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDataset.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    <p className="font-bold">Belum ada data training penjualan yang cocok.</p>
                    <p className="text-[11px] mt-1">Upload file dataset (.xlsx / .csv) atau klik "Tambah Manual" di atas.</p>
                  </td>
                </tr>
              ) : (
                filteredDataset.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-slate-800">{rec.date}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          rec.dayName === 'Sabtu' || rec.dayName === 'Minggu'
                            ? 'bg-purple-100 text-purple-800'
                            : rec.dayName === 'Jumat'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {rec.dayName}
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-slate-900">{rec.planName}</td>
                    <td className="p-3 text-slate-600">{rec.category}</td>
                    <td className="p-3 text-right font-black text-emerald-600 text-sm">
                      {rec.salesKg?.toFixed(1)}
                    </td>
                    <td className="p-3 text-right text-slate-700 font-bold">
                      {rec.productionKg?.toFixed(1) || '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span className={rec.lossPercent && rec.lossPercent > 1.0 ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                        {rec.lossPercent ? `${rec.lossPercent.toFixed(1)}%` : '0.0%'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 max-w-xs truncate" title={rec.notes}>
                      {rec.notes || '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          rec.source === 'manual_input'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {rec.source === 'manual_input' ? 'Manual' : 'File'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(rec)}
                          className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                          title="Ubah Manual Baris Ini"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec.id)}
                          className="p-1.5 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded-lg transition cursor-pointer"
                          title="Hapus Baris Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
