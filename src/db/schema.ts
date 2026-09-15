import { pgTable, text, varchar, real, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const stores = pgTable('stores', {
  id: text('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).default(''),
  createdAt: text('created_at').default(''),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'butcher' | 'admin_toko' | 'admin' | 'md_pusat' | 'md'
  fullName: varchar('full_name', { length: 100 }).notNull(),
  storeId: text('store_id'),
  storeName: varchar('store_name', { length: 100 }),
  createdAt: text('created_at').default(''),
});

export const cogsMaster = pgTable('cogs_master', {
  id: text('id').primaryKey(),
  itemCode: text('item_code'),
  itemName: text('item_name'),
  planName: text('plan_name').notNull(),
  cogsPerKg: real('cogs_per_kg').notNull(),
  defaultPricePerKg: real('default_price_per_kg').default(0),
  sellingPricePerKg: real('selling_price_per_kg').default(0),
  category: text('category').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').default('MD Pusat'),
});

export const thawingItems = pgTable('thawing_items', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  weightBeforeThawing: real('weight_before_thawing').notNull(),
  weightAfterThawing: real('weight_after_thawing'),
  shrinkageThawing: real('shrinkage_thawing'),
  shrinkageThawingPercent: real('shrinkage_thawing_percent'),
  thawingStartTime: text('thawing_start_time').notNull(),
  thawingEndTime: text('thawing_end_time'),
  durationMinutes: integer('duration_minutes').default(0),
  photoEvidence: text('photo_evidence'),
  image: text('image'),
  plannedFabrication: text('planned_fabrication'),
  openingPurpose: text('opening_purpose'),
  butcherName: text('butcher_name'),
  isCarryover: boolean('is_carryover').default(false),
  isTransferred: boolean('is_transferred').default(false),
  originalPurpose: text('original_purpose'),
  transferTimestamp: text('transfer_timestamp'),
  createdAt: text('created_at').notNull(),
});

export const fabricationSegments = pgTable('fabrication_segments', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull(),
  itemId: text('item_id').notNull(),
  itemName: text('item_name').notNull(),
  segmentName: text('segment_name').notNull(),
  targetWeight: real('target_weight').notNull(),
  actualWeight: real('actual_weight').notNull(),
  periodicShrinkage: real('periodic_shrinkage').default(0),
  salesKg: real('sales_kg').default(0),
  plannedFabrication: text('planned_fabrication'),
  openingPurpose: text('opening_purpose'),
  isTransferred: boolean('is_transferred').default(false),
  originalPurpose: text('original_purpose'),
  transferTimestamp: text('transfer_timestamp'),
  createdAt: text('created_at').notNull(),
});

export const stockAdjustments = pgTable('stock_adjustments', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull(),
  planName: text('plan_name').notNull(),
  type: text('type').notNull(), // 'IN' | 'OUT'
  weightKg: real('weight_kg').notNull(),
  reason: text('reason').notNull(),
  adminName: text('admin_name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const closingPlanRecords = pgTable('closing_plan_records', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull(),
  planName: text('plan_name').notNull(),
  date: text('date').notNull(),
  category: text('category').default(''),
  openingStockKg: real('opening_stock_kg').default(0),
  newProcessedKg: real('new_processed_kg').default(0),
  salesKg: real('sales_kg').default(0),
  adjustInKg: real('adjust_in_kg').default(0),
  adjustOutKg: real('adjust_out_kg').default(0),
  closingStockBySystemKg: real('closing_stock_by_system_kg').default(0),
  actualClosingStockKg: real('actual_closing_stock_kg').default(0),
  susutJualKg: real('susut_jual_kg').default(0),
  photoUrl: text('photo_url'),
  photoCaption: text('photo_caption'),
  note: text('note'),
  butcherName: text('butcher_name'),
  timestamp: text('timestamp').notNull(),
  // Kolom legacy untuk kompatibilitas riwayat lama
  displayClosingKg: real('display_closing_kg').default(0),
  pesananClosingKg: real('pesanan_closing_kg').default(0),
  totalPhysicalClosingKg: real('total_physical_closing_kg').default(0),
  photoDisplayUrl: text('photo_display_url'),
  photoPesananUrl: text('photo_pesanan_url'),
});

export const dailyClosingReports = pgTable('daily_closing_reports', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull(),
  storeName: text('store_name').notNull(),
  date: text('date').notNull(),
  totalWeightRaw: real('total_weight_raw').notNull(),
  totalWeightAfterThawing: real('total_weight_after_thawing').notNull(),
  totalWeightFabricated: real('total_weight_fabricated').notNull(),
  totalPeriodicShrinkage: real('total_periodic_shrinkage').notNull(),
  totalSales: real('total_sales').notNull(),
  totalEndStock: real('total_end_stock').notNull(),
  thawingLossPercent: real('thawing_loss_percent').notNull(),
  fabricationLossPercent: real('fabrication_loss_percent').notNull(),
  salesLossPercent: real('sales_loss_percent').notNull(),
  overallLossPercent: real('overall_loss_percent').notNull(),
  statusAlert: text('status_alert').notNull(),
  closingPhotoUrl: text('closing_photo_url'),
  butcherName: text('butcher_name').notNull(),
  reportData: jsonb('report_data'),
  createdAt: text('created_at').notNull(),
});

export const lossConfig = pgTable('loss_config', {
  id: text('id').primaryKey(),
  maxProcessLossPercent: real('max_process_loss_percent').notNull(),
  maxSalesLossPercent: real('max_sales_loss_percent').notNull(),
  maxDailyLossPercent: real('max_daily_loss_percent').notNull(),
  safeThawingLossPercent: real('safe_thawing_loss_percent').notNull(),
  safeFabricationLossPercent: real('safe_fabrication_loss_percent').notNull(),
  salesPredictionKg: real('sales_prediction_kg').notNull(),
});

export const dataSusut = pgTable('data_susut', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  storeName: text('store_name').notNull(),
  storeId: text('store_id').notNull(),
  planName: text('plan_name').notNull(),
  susutProses: real('susut_proses').notNull(),
  susutJual: real('susut_jual').notNull(),
  createdAt: text('created_at').notNull(),
});

