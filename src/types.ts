export type UserRole = 'butcher' | 'admin' | 'md';

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
