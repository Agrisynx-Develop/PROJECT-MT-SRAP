import { pgTable, text, serial, integer, varchar, real, boolean } from 'drizzle-orm/pg-core';

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).default(''),
  createdAt: text('created_at').default(''),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'butcher' | 'admin_toko' | 'admin' | 'md_pusat' | 'md'
  fullName: varchar('full_name', { length: 100 }).notNull(),
  storeId: integer('store_id'),
  storeName: varchar('store_name', { length: 100 }),
  createdAt: text('created_at').default(''),
});

export const cogsMaster = pgTable('cogs_master', {
  id: text('id').primaryKey(),
  planName: text('plan_name').notNull(),
  cogsPerKg: real('cogs_per_kg').notNull(),
  sellingPricePerKg: real('selling_price_per_kg').notNull(),
  category: text('category').notNull(),
  updatedAt: text('updated_at').notNull(),
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
  displayClosingKg: real('display_closing_kg').notNull(),
  pesananClosingKg: real('pesanan_closing_kg').notNull(),
  totalPhysicalClosingKg: real('total_physical_closing_kg').notNull(),
  photoDisplayUrl: text('photo_display_url'),
  photoPesananUrl: text('photo_pesanan_url'),
  timestamp: text('timestamp').notNull(),
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
  createdAt: text('created_at').notNull(),
});
