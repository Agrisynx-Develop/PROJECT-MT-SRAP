export type UserRole = 'butcher' | 'admin' | 'md';

export interface Store {
  id: string;
  code: string;
  name: string;
  city: string;
  createdAt: string;
}export type UserRole = 'butcher' | 'admin' | 'md';

export interface Store {
  id: string;
  code: string;
  name: string;
  city: string;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  username: string;
  role: UserRole;
  storeId?: string; // required for butcher & admin
  storeName?: string;
  fullName: string;
  pin?: string;
  linkedAccountId?: string; // Butcher linked with Store Admin
  createdAt: string;
}

export interface CogsMaster {
  id: string;
  itemCode: string;
  itemName: string;
  category: 'DAGING FRESH' | 'DAGING PREMIUM' | 'RAWON' | 'SHANKLE' | string;
  cogsPerKg: number; // Harga Pokok / Modal (Rp / Kg)
  defaultPricePerKg?: number; // Harga Jual Acuan (Rp / Kg)
  updatedAt: string;
  updatedBy: string;
}

export interface StockAdjustment {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  meatName: string;
  planName: string;
  type: 'IN' | 'OUT';
  weightKg: number;
  reason: string; // e.g., 'Mutasi Antar Cabang', 'Retur Supplier', 'Koreksi Timbangan', 'Kerusakan Fisik'
  createdBy: string;
  createdAt: string;
}

export interface ClosingPlanRecord {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  planName: string;
  category: string;
  openingStockKg: number; // Sisa kemarin (Carryover)
  newProcessedKg: number; // Bahan baru diolah hari ini
  salesKg: number; // Penjualan tercatat
  adjustInKg?: number;
  adjustOutKg?: number;
  closingStockBySystemKg: number;
  actualClosingStockKg: number; // Input fisik butcher
  susutJualKg: number;
  photoUrl: string; // MANDATORY Foto bukti timbangan / fisik
  photoCaption?: string;
  note?: string;
  butcherName: string;
  timestamp: string;
}

export interface ThawingItem {
  id: string;
  storeId?: string;
  image: string; // Base64 or local placeholder URL (MANDATORY on confirm)
  name: string; // Nama bahan (e.g., HQ 41/42/44/45)
  pricePerKg?: number; // Harga per Kg spesifik bahan (Rp)
  cogsPerKg?: number; // Modal COGS dari Master MD
  weightBeforeThawing: number; // Berat sebelum thawing (Kg)
  weightAfterThawing?: number; // Berat setelah thawing (Kg)
  plannedFabrication: string; // Rencana pabrikasi (e.g., DAGING RENDANG PREMIUM)
  status: 'thawing' | 'pabrikasi_ready' | 'pabrikasi_done';
  thawingStartTime: string; // ISO String
  thawingEndTime?: string; // ISO String
  butcherId?: string;
  butcherName?: string;
  createdAt: string;
  shrinkageThawing?: number; // Berat susut thawing (Kg)
  shrinkageThawingPercent?: number; // Persentase susut thawing (%)
  pabrikasiCategory?: string; // Kategori Pabrikasi (e.g. DAGING FRESH, DAGING PREMIUM, RAWON)
  openingPurpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY' | string;
  susutJualKg?: number; // Susut Jual (Kg) per bahan
  salesKg?: number; // Total Penjualan / Sales (Kg)
  isCarryover?: boolean; // If true, this is stock from previous days (EXCLUDED from daily processing loss)
  isTransferred?: boolean;
  originalPurpose?: string;
  transferTimestamp?: string;
}

export interface FabricationSegment {
  id: string;
  storeId?: string;
  itemId: string; // Relasi ke ThawingItem
  itemName: string;
  segmentName: string; // Nama segmen
  targetWeight: number; // Rencana berat (Kg)
  actualWeight: number; // Berat realisasi / Sisa Stok Aktif (Kg)
  periodicShrinkage: number; // Total susut berkala yang diupdate (Kg)
  salesKg?: number; // Total Sales / Penjualan yang sudah dicatat (Kg)
  plannedFabrication?: string; // Terhubung dengan Rencana Potong & Pabrikasi
  openingPurpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY' | string;
  isTransferred?: boolean;
  originalPurpose?: string;
  transferTimestamp?: string;
  createdAt: string;
  isCarryover?: boolean;
}

export interface ReportPhotoAttachment {
  id: string;
  url: string; // Base64 or image URL
  caption: string; // Keterangan foto
  category?: 'Timbangan' | 'Kebersihan Area' | 'Hasil Packaging' | 'Berita Acara' | 'Closing Stock' | 'Lainnya';
  uploadedAt: string;
}

export interface DailyClosingReport {
  id: string;
  storeId?: string;
  storeName?: string;
  date: string; // YYYY-MM-DD
  totalThawingQty: number; // Jumlah bahan yang dithawing
  totalProcessedQty: number; // Jumlah yang sudah dipabrikasi
  totalWeightBeforeThawing: number; // Total berat awal (Hanya bahan baru hari ini)
  totalWeightAfterThawing: number; // Total berat setelah thawing
  totalWeightAfterFabrication: number; // Total berat hasil segmen
  totalThawingLoss: number; // Total susut thawing
  totalFabricationLoss: number; // Total susut pabrikasi
  totalProcessLoss?: number; // Total susut proses (Thaw + Fab)
  totalSusutJual?: number; // Total susut jual (Update Susut)
  totalSalesKg?: number; // Total sales penjualan harian (Kg)
  carryoverOpeningStockKg?: number; // Sisa stok carryover dari hari kemarin
  currentClosingStockKg?: number; // Sisa stok fisik closing hari ini
  financialLossRupiah?: number; // Valuasi kerugian rupiah
  butcherInCharge: string;
  adminInCharge?: string;
  itemsProcessed: {
    id: string;
    name: string;
    plannedFabrication?: string;
    pabrikasiCategory?: string;
    openingPurpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY' | string;
    pricePerKg?: number;
    cogsPerKg?: number;
    weightBefore: number;
    weightAfter: number;
    finalWeight: number;
    thawingLossPercent: number;
    fabLossPercent: number;
    processLossKg?: number;
    processLossPercent?: number;
    susutJualKg?: number;
    susutJualPercent?: number;
    salesKg?: number;
    openingStockKg?: number;
    closingStockKg?: number;
    isCarryover?: boolean;
    fabricatedSegments?: {
      segmentName: string;
      actualWeight: number;
      targetWeight?: number;
      periodicShrinkage?: number;
      salesKg?: number;
    }[];
  }[];
  closingPlanRecords?: ClosingPlanRecord[];
  isClosed: boolean;
  closedAt?: string;
  closingPhotoUrl?: string;
  photos?: ReportPhotoAttachment[];
}

export interface LossAlertConfig {
  maxProcessLossPercent: number;
  maxSalesLossPercent: number;
  maxDailyLossPercent: number;
  safeThawingLossPercent: number;
  safeFabricationLossPercent: number;
  salesPredictionKg?: number;
}

export interface TrainingFileRecord {
  id: string;
  storeId: string;
  storeName?: string;
  title: string;
  category?: 'SOP & Standard Potong' | 'Evaluasi Hasil Praktik' | 'Sanitasi & Hygiene' | 'Sertifikasi Butcher' | 'Pelatihan Alat & Timbangan' | 'Lainnya' | string;
  trainerName?: string;
  participantNames?: string;
  date: string; // YYYY-MM-DD
  fileName: string;
  fileSizeFormatted: string;
  fileType: string;
  fileDataUrl: string; // Base64 data url for download & preview
  scoreNotes?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface DailyTargetManualConfig {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  // Target / Jumlah Operasional Harian Toko
  targetProduksiKg?: number; // Target total olah / produksi daging harian (Kg)
  targetSalesKg?: number; // Target penjualan harian (Kg)
  targetToleransiSusutPercent?: number; // Target batas susut harian (%)
  // Training harian
  targetTrainingSesiHarian?: number; // Target jumlah sesi training per hari
  targetPesertaTrainingHarian?: number; // Target jumlah butcher yang ditraining per hari
  // Catatan instruksi harian admin
  catatanHarian?: string;
  updatedBy: string;
  updatedAt: string;
}

/**
 * Record dataset historis penjualan untuk Training Model Prediksi Sales Machine Learning
 */
export interface SalesTrainingRecord {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  dayName?: string; // Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu
  planName?: string; // Rencana Potong / Nama Produk
  category?: string; // Kategori Pabrikasi
  salesKg: number; // Jumlah penjualan historis (Kg)
  productionKg?: number; // Jumlah olah / potong (Kg)
  lossKg?: number; // Susut (Kg)
  lossPercent?: number; // Susut (%)
  notes?: string; // Catatan promo, cuaca, libur, event
  source?: 'upload_file' | 'manual_input' | 'system_closing';
  createdAt?: string;
  // DUKUNGAN DATA DINAMIS TIDAK BAKU:
  rawRow?: Record<string, any>; // Seluruh kolom asli dari file yang di-upload
  customColumns?: string[]; // Daftar header kolom asli dari file
}

/**
 * Konfigurasi & Parameter Model ML Prediksi Sales
 */
export interface SalesPredictionModelConfig {
  storeId: string;
  targetColumnName?: string; // Nama kolom yang dijadikan target penjualan (ML)
  customColumns?: string[]; // Daftar kolom yang sedang aktif ditampilkan
  customBaselineKg?: number; // Baseline default olah/sales (Kg)
  weekendMultiplier?: number; // Pengali akhir pekan (default: 1.35)
  paydayMultiplier?: number; // Pengali tanggal gajian (default: 1.25)
  fridayMultiplier?: number; // Pengali hari jumat (default: 1.15)
  manualOverrideKg?: number; // Override manual target sales
  manualOverrideDate?: string; // Tanggal override aktif
  algorithmMode?: 'dataset_moving_average' | 'day_of_week_regression' | 'hybrid_ml' | 'python_model';
  activePythonModelId?: string; // ID Model Python (.pkl, .joblib, dll) yang sedang aktif
  activePythonModelName?: string;
  updatedAt?: string;
}

/**
 * Metadata & File Artifact Model Machine Learning hasil training Python (.pkl, .joblib, .onnx, dll)
 */
export interface PythonModelArtifact {
  id: string;
  storeId: string;
  fileName: string;
  fileType: 'pkl' | 'joblib' | 'onnx' | 'parquet' | 'pt' | 'h5' | 'json' | 'pickle' | 'other';
  fileSize: number; // bytes
  fileSizeFormatted: string;
  algorithmName?: string; // e.g. RandomForestRegressor, XGBoost, LinearRegression, PyTorch LSTM, Scikit-Learn Pipeline
  pythonFramework?: string; // e.g. Scikit-Learn, XGBoost, PyTorch, Statsmodels, Pandas Parquet
  pickleProtocol?: number; // e.g. 2, 3, 4, 5
  detectedModules?: string[]; // Module / package yang terdeteksi dari binary dump
  features?: string[];
  metrics?: {
    r2Score?: number; // Nilai R-squared (0.00 - 1.00)
    mae?: number; // Mean Absolute Error
    rmse?: number; // Root Mean Squared Error
    accuracy?: number; // Persentase akurasi 
  };
  customBaselineKg?: number; // Baseline prediksi yang dihasilkan model (Kg)
  multiplierConfig?: {
    weekendMultiplier?: number;
    paydayMultiplier?: number;
    fridayMultiplier?: number;
  };
  isActive: boolean; // Apakah model ini yang sedang aktif digunakan untuk prediksi sales
  notes?: string;
  base64Data?: string; // Data file untuk didownload kembali
  uploadedAt: string;
  uploadedBy: string;
}



export interface UserAccount {
  id: string;
  username: string;
  role: UserRole;
  storeId?: string; // required for butcher & admin
  storeName?: string;
  fullName: string;
  pin?: string;
  linkedAccountId?: string; // Butcher linked with Store Admin
  createdAt: string;
}

export interface CogsMaster {
  id: string;
  itemCode: string;
  itemName: string;
  category: 'DAGING FRESH' | 'DAGING PREMIUM' | 'RAWON' | 'SHANKLE' | string;
  cogsPerKg: number; // Harga Pokok / Modal (Rp / Kg)
  defaultPricePerKg?: number; // Harga Jual Acuan (Rp / Kg)
  updatedAt: string;
  updatedBy: string;
}

export interface StockAdjustment {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  meatName: string;
  planName: string;
  type: 'IN' | 'OUT';
  weightKg: number;
  reason: string; // e.g., 'Mutasi Antar Cabang', 'Retur Supplier', 'Koreksi Timbangan', 'Kerusakan Fisik'
  createdBy: string;
  createdAt: string;
}

export interface ClosingPlanRecord {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  planName: string;
  category: string;
  openingStockKg: number; // Sisa kemarin (Carryover)
  newProcessedKg: number; // Bahan baru diolah hari ini
  salesKg: number; // Penjualan tercatat
  adjustInKg?: number;
  adjustOutKg?: number;
  closingStockBySystemKg: number;
  actualClosingStockKg: number; // Input fisik butcher
  susutJualKg: number;
  photoUrl: string; // MANDATORY Foto bukti timbangan / fisik
  photoCaption?: string;
  note?: string;
  butcherName: string;
  timestamp: string;
}

export interface ThawingItem {
  id: string;
  storeId?: string;
  image: string; // Base64 or local placeholder URL (MANDATORY on confirm)
  name: string; // Nama bahan (e.g., HQ 41/42/44/45)
  pricePerKg?: number; // Harga per Kg spesifik bahan (Rp)
  cogsPerKg?: number; // Modal COGS dari Master MD
  weightBeforeThawing: number; // Berat sebelum thawing (Kg)
  weightAfterThawing?: number; // Berat setelah thawing (Kg)
  plannedFabrication: string; // Rencana pabrikasi (e.g., DAGING RENDANG PREMIUM)
  status: 'thawing' | 'pabrikasi_ready' | 'pabrikasi_done';
  thawingStartTime: string; // ISO String
  thawingEndTime?: string; // ISO String
  butcherId?: string;
  butcherName?: string;
  createdAt: string;
  shrinkageThawing?: number; // Berat susut thawing (Kg)
  shrinkageThawingPercent?: number; // Persentase susut thawing (%)
  pabrikasiCategory?: string; // Kategori Pabrikasi (e.g. DAGING FRESH, DAGING PREMIUM, RAWON)
  openingPurpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY' | string;
  susutJualKg?: number; // Susut Jual (Kg) per bahan
  salesKg?: number; // Total Penjualan / Sales (Kg)
  isCarryover?: boolean; // If true, this is stock from previous days (EXCLUDED from daily processing loss)
  isTransferred?: boolean;
  originalPurpose?: string;
  transferTimestamp?: string;
}

export interface FabricationSegment {
  id: string;
  storeId?: string;
  itemId: string; // Relasi ke ThawingItem
  itemName: string;
  segmentName: string; // Nama segmen
  targetWeight: number; // Rencana berat (Kg)
  actualWeight: number; // Berat realisasi / Sisa Stok Aktif (Kg)
  periodicShrinkage: number; // Total susut berkala yang diupdate (Kg)
  salesKg?: number; // Total Sales / Penjualan yang sudah dicatat (Kg)
  plannedFabrication?: string; // Terhubung dengan Rencana Potong & Pabrikasi
  openingPurpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY' | string;
  isTransferred?: boolean;
  originalPurpose?: string;
  transferTimestamp?: string;
  createdAt: string;
  isCarryover?: boolean;
}

export interface ReportPhotoAttachment {
  id: string;
  url: string; // Base64 or image URL
  caption: string; // Keterangan foto
  category?: 'Timbangan' | 'Kebersihan Area' | 'Hasil Packaging' | 'Berita Acara' | 'Closing Stock' | 'Lainnya';
  uploadedAt: string;
}

export interface DailyClosingReport {
  id: string;
  storeId?: string;
  storeName?: string;
  date: string; // YYYY-MM-DD
  totalThawingQty: number; // Jumlah bahan yang dithawing
  totalProcessedQty: number; // Jumlah yang sudah dipabrikasi
  totalWeightBeforeThawing: number; // Total berat awal (Hanya bahan baru hari ini)
  totalWeightAfterThawing: number; // Total berat setelah thawing
  totalWeightAfterFabrication: number; // Total berat hasil segmen
  totalThawingLoss: number; // Total susut thawing
  totalFabricationLoss: number; // Total susut pabrikasi
  totalProcessLoss?: number; // Total susut proses (Thaw + Fab)
  totalSusutJual?: number; // Total susut jual (Update Susut)
  totalSalesKg?: number; // Total sales penjualan harian (Kg)
  carryoverOpeningStockKg?: number; // Sisa stok carryover dari hari kemarin
  currentClosingStockKg?: number; // Sisa stok fisik closing hari ini
  financialLossRupiah?: number; // Valuasi kerugian rupiah
  butcherInCharge: string;
  adminInCharge?: string;
  itemsProcessed: {
    id: string;
    name: string;
    plannedFabrication?: string;
    pabrikasiCategory?: string;
    openingPurpose?: 'UNTUK PESANAN' | 'UNTUK DISPLAY' | string;
    pricePerKg?: number;
    cogsPerKg?: number;
    weightBefore: number;
    weightAfter: number;
    finalWeight: number;
    thawingLossPercent: number;
    fabLossPercent: number;
    processLossKg?: number;
    processLossPercent?: number;
    susutJualKg?: number;
    susutJualPercent?: number;
    salesKg?: number;
    openingStockKg?: number;
    closingStockKg?: number;
    isCarryover?: boolean;
    fabricatedSegments?: {
      segmentName: string;
      actualWeight: number;
      targetWeight?: number;
      periodicShrinkage?: number;
      salesKg?: number;
    }[];
  }[];
  closingPlanRecords?: ClosingPlanRecord[];
  isClosed: boolean;
  closedAt?: string;
  photos?: ReportPhotoAttachment[];
}

export interface LossAlertConfig {
  maxProcessLossPercent: number;
  maxSalesLossPercent: number;
  maxDailyLossPercent: number;
  safeThawingLossPercent: number;
  safeFabricationLossPercent: number;
  salesPredictionKg?: number;
}

export interface TrainingFileRecord {
  id: string;
  storeId: string;
  storeName?: string;
  title: string;
  category?: 'SOP & Standard Potong' | 'Evaluasi Hasil Praktik' | 'Sanitasi & Hygiene' | 'Sertifikasi Butcher' | 'Pelatihan Alat & Timbangan' | 'Lainnya' | string;
  trainerName?: string;
  participantNames?: string;
  date: string; // YYYY-MM-DD
  fileName: string;
  fileSizeFormatted: string;
  fileType: string;
  fileDataUrl: string; // Base64 data url for download & preview
  scoreNotes?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface DailyTargetManualConfig {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  // Target / Jumlah Operasional Harian Toko
  targetProduksiKg?: number; // Target total olah / produksi daging harian (Kg)
  targetSalesKg?: number; // Target penjualan harian (Kg)
  targetToleransiSusutPercent?: number; // Target batas susut harian (%)
  // Training harian
  targetTrainingSesiHarian?: number; // Target jumlah sesi training per hari
  targetPesertaTrainingHarian?: number; // Target jumlah butcher yang ditraining per hari
  // Catatan instruksi harian admin
  catatanHarian?: string;
  updatedBy: string;
  updatedAt: string;
}

/**
 * Record dataset historis penjualan untuk Training Model Prediksi Sales Machine Learning
 */
export interface SalesTrainingRecord {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  dayName?: string; // Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu
  planName?: string; // Rencana Potong / Nama Produk
  category?: string; // Kategori Pabrikasi
  salesKg: number; // Jumlah penjualan historis (Kg)
  productionKg?: number; // Jumlah olah / potong (Kg)
  lossKg?: number; // Susut (Kg)
  lossPercent?: number; // Susut (%)
  notes?: string; // Catatan promo, cuaca, libur, event
  source?: 'upload_file' | 'manual_input' | 'system_closing';
  createdAt?: string;
  // DUKUNGAN DATA DINAMIS TIDAK BAKU:
  rawRow?: Record<string, any>; // Seluruh kolom asli dari file yang di-upload
  customColumns?: string[]; // Daftar header kolom asli dari file
}

/**
 * Konfigurasi & Parameter Model ML Prediksi Sales
 */
export interface SalesPredictionModelConfig {
  storeId: string;
  targetColumnName?: string; // Nama kolom yang dijadikan target penjualan (ML)
  customColumns?: string[]; // Daftar kolom yang sedang aktif ditampilkan
  customBaselineKg?: number; // Baseline default olah/sales (Kg)
  weekendMultiplier?: number; // Pengali akhir pekan (default: 1.35)
  paydayMultiplier?: number; // Pengali tanggal gajian (default: 1.25)
  fridayMultiplier?: number; // Pengali hari jumat (default: 1.15)
  manualOverrideKg?: number; // Override manual target sales
  manualOverrideDate?: string; // Tanggal override aktif
  algorithmMode?: 'dataset_moving_average' | 'day_of_week_regression' | 'hybrid_ml' | 'python_model';
  activePythonModelId?: string; // ID Model Python (.pkl, .joblib, dll) yang sedang aktif
  activePythonModelName?: string;
  updatedAt?: string;
}

/**
 * Metadata & File Artifact Model Machine Learning hasil training Python (.pkl, .joblib, .onnx, dll)
 */
export interface PythonModelArtifact {
  id: string;
  storeId: string;
  fileName: string;
  fileType: 'pkl' | 'joblib' | 'onnx' | 'parquet' | 'pt' | 'h5' | 'json' | 'pickle' | 'other';
  fileSize: number; // bytes
  fileSizeFormatted: string;
  algorithmName?: string; // e.g. RandomForestRegressor, XGBoost, LinearRegression, PyTorch LSTM, Scikit-Learn Pipeline
  pythonFramework?: string; // e.g. Scikit-Learn, XGBoost, PyTorch, Statsmodels, Pandas Parquet
  pickleProtocol?: number; // e.g. 2, 3, 4, 5
  detectedModules?: string[]; // Module / package yang terdeteksi dari binary dump
  features?: string[];
  metrics?: {
    r2Score?: number; // Nilai R-squared (0.00 - 1.00)
    mae?: number; // Mean Absolute Error
    rmse?: number; // Root Mean Squared Error
    accuracy?: number; // Persentase akurasi 
  };
  customBaselineKg?: number; // Baseline prediksi yang dihasilkan model (Kg)
  multiplierConfig?: {
    weekendMultiplier?: number;
    paydayMultiplier?: number;
    fridayMultiplier?: number;
  };
  isActive: boolean; // Apakah model ini yang sedang aktif digunakan untuk prediksi sales
  notes?: string;
  base64Data?: string; // Data file untuk didownload kembali
  uploadedAt: string;
  uploadedBy: string;
}

