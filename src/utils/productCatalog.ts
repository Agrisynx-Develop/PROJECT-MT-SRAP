import { ReportCategory } from '../types';

export interface CatalogProduct {
  itemCode: string;
  plu: string;
  name: string;
  category: string;
  reportCategory: ReportCategory;
  subCategory: string; // 'DAGING' | 'SOSIS & KENTANG' | 'FILLET DORI' | 'PARTING AYAM'
  unit?: string;
  cogsPerKg?: number;
  sellingPricePerKg?: number;
  rawItemCode?: string;
  rawBarcode?: string;
  rawName?: string;
  vendor?: string;
  tdnSection?: number;
}

// 1. DAGING
export const DAGING_CATALOG: CatalogProduct[] = [
  { itemCode: 'DF-01', plu: '01001', name: 'D.sapi pot. rdang', category: 'DAGING FRESH', reportCategory: 'DAGING', subCategory: 'DAGING', unit: 'Kg', cogsPerKg: 102000, sellingPricePerKg: 125000 },
  { itemCode: 'SH-01', plu: '01002', name: 'Daging Rendang Shankle', category: 'SHANKLE', reportCategory: 'DAGING', subCategory: 'DAGING', unit: 'Kg', cogsPerKg: 85200, sellingPricePerKg: 105000 },
  { itemCode: 'DP-01', plu: '01003', name: 'D Premium lokal', category: 'DAGING PREMIUM', reportCategory: 'DAGING', subCategory: 'DAGING', unit: 'Kg', cogsPerKg: 127000, sellingPricePerKg: 155000 },
  { itemCode: 'RW-01', plu: '01004', name: 'Rawon Curah', category: 'RAWON', reportCategory: 'DAGING', subCategory: 'DAGING', unit: 'Kg', cogsPerKg: 86500, sellingPricePerKg: 110000 },
  { itemCode: 'DF-02', plu: '01005', name: 'D.r. fresh member', category: 'DAGING FRESH', reportCategory: 'DAGING', subCategory: 'DAGING', unit: 'Kg', cogsPerKg: 102000, sellingPricePerKg: 125000 },
  { itemCode: 'DP-02', plu: '01006', name: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM', reportCategory: 'DAGING', subCategory: 'DAGING', unit: 'Kg', cogsPerKg: 103000, sellingPricePerKg: 135000 },
];

// 2. SOSIS & KENTANG (Exact from Image 1: LAPORAN STOCK SOSIS & KENTANG)
export const SOSIS_KENTANG_CATALOG: CatalogProduct[] = [
  { itemCode: '101177', plu: '02610', name: 'Suri Beef Cocktail', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 78000, sellingPricePerKg: 95000 },
  { itemCode: '101260', plu: '02611', name: 'Suri Chicken', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 65000, sellingPricePerKg: 80000 },
  { itemCode: '101477', plu: '03444', name: 'SURI BAKSO PREMIUM CURAH 1 KG', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 82000, sellingPricePerKg: 100000 },
  { itemCode: '101503', plu: '03600', name: 'SURI SHOESTRING CURAH', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 38000, sellingPricePerKg: 48000 },
  { itemCode: '103947', plu: '04551', name: 'SURI SHOESTRING KG MEMBER', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 36000, sellingPricePerKg: 45000 },
  { itemCode: '101504', plu: '03601', name: 'SURI STRAIGHT CUT CURAH', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 38000, sellingPricePerKg: 48000 },
  { itemCode: '103948', plu: '04552', name: 'SURI STRAIGHT CUT KG MEMBER', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 36000, sellingPricePerKg: 45000 },
  { itemCode: '103821', plu: '04466', name: 'SURI BATTER COATED KG', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 42000, sellingPricePerKg: 52000 },
  { itemCode: '103822', plu: '04479', name: 'SURI CRINKLE CUT KG', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 39000, sellingPricePerKg: 49000 },
  { itemCode: '103949', plu: '04553', name: 'SURI CRINKLE CUT KG MEMBER', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 37000, sellingPricePerKg: 46000 },
  { itemCode: '101331', plu: '03134', name: 'GM Nugget stick  1KG', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 52000, sellingPricePerKg: 64000 },
  { itemCode: '101332', plu: '03133', name: 'GM Nugget Coin  1KG', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 52000, sellingPricePerKg: 64000 },
  { itemCode: '101337', plu: '03167', name: 'GM chicken strip 1KG', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 55000, sellingPricePerKg: 68000 },
  { itemCode: '103541', plu: '04264', name: 'GM CHICKEN NUGGET MIX', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 48000, sellingPricePerKg: 59000 },
  { itemCode: '103946', plu: '04550', name: 'GM CHICKEN NUGGET MIX MEMBER', category: 'SOSIS & KENTANG', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'SOSIS & KENTANG', unit: 'Kg', cogsPerKg: 46000, sellingPricePerKg: 57000 },
];

// 3. FILLET DORI (Exact from Image 2: LAPORAN STOCK FILLET DORI)
export const FILLET_DORI_CATALOG: CatalogProduct[] = [
  { itemCode: '100002', plu: '00001', name: 'DG GILING 1 1KG', category: 'FILLET DORI', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'FILLET DORI', unit: 'Kg', cogsPerKg: 95000, sellingPricePerKg: 115000 },
  { itemCode: '100891', plu: '11151', name: 'FILLET DORI EKONOMIS', category: 'FILLET DORI', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'FILLET DORI', unit: 'Kg', cogsPerKg: 46000, sellingPricePerKg: 58000 },
  { itemCode: '103795', plu: '04454', name: 'FILLET DORI PREMIUM', category: 'FILLET DORI', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'FILLET DORI', unit: 'Kg', cogsPerKg: 58000, sellingPricePerKg: 72000 },
  { itemCode: '100890', plu: '00551', name: 'FILLET DORI REG B BL', category: 'FILLET DORI', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'FILLET DORI', unit: 'Kg', cogsPerKg: 50000, sellingPricePerKg: 62000 },
  { itemCode: '103902', plu: '04514', name: 'DG TETELAN CURAH', category: 'FILLET DORI', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'FILLET DORI', unit: 'Kg', cogsPerKg: 68000, sellingPricePerKg: 85000 },
  { itemCode: '100154', plu: '04406', name: 'DG GILING REGULER 1KG', category: 'FILLET DORI', reportCategory: 'KENTANG_SOSIS_DORI', subCategory: 'FILLET DORI', unit: 'Kg', cogsPerKg: 92000, sellingPricePerKg: 112000 },
];

export const KENTANG_SOSIS_DORI_CATALOG: CatalogProduct[] = [
  ...SOSIS_KENTANG_CATALOG,
  ...FILLET_DORI_CATALOG,
];
export const SOSIS_KENTANG_DORI_CATALOG = KENTANG_SOSIS_DORI_CATALOG;

// 4. PARTING AYAM (Exact from Images 2, 3, 4, 5, 6)
export const PARTING_AYAM_CATALOG: CatalogProduct[] = [
  {
    itemCode: '100314',
    plu: '03801',
    name: 'FILLET DADA FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 54900,
    sellingPricePerKg: 61500,
    rawItemCode: '10200419300003',
    rawBarcode: '03884',
    rawName: 'BAHAN FZ FILLET DADA',
    vendor: 'PT PNDESIA',
    tdnSection: 1,
  },
  {
    itemCode: '100312',
    plu: '03799',
    name: 'PAHA BAWAH FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 44900,
    sellingPricePerKg: 54900,
    rawItemCode: '10200419300001',
    rawBarcode: '03882',
    rawName: 'BAHAN FZ PAHA BAWAH',
    vendor: 'PT PNDESIA',
    tdnSection: 2,
  },
  {
    itemCode: '100313',
    plu: '03800',
    name: 'SAYAP UTUH FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 61500,
    sellingPricePerKg: 44900,
    rawItemCode: '10200419300002',
    rawBarcode: '03883',
    rawName: 'BAHAN FZ SAYAP UTUH',
    vendor: 'PT PNDESIA',
    tdnSection: 3,
  },
  {
    itemCode: '100318',
    plu: '03805',
    name: 'KAKI AYAM FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 41900,
    sellingPricePerKg: 34500,
    rawItemCode: '10200419300007',
    rawBarcode: '03888',
    rawName: 'BAHAN FZ KAKI AYAM',
    vendor: 'PT PNDESIA',
    tdnSection: 4,
  },
  {
    itemCode: '100317',
    plu: '03804',
    name: 'AMPELA AYAM FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 33500,
    sellingPricePerKg: 36900,
    rawItemCode: '10200419300006',
    rawBarcode: '03887',
    rawName: 'BAHAN FZ AMPELA AYAM',
    vendor: 'PT PNDESIA',
    tdnSection: 5,
  },
  {
    itemCode: '100316',
    plu: '03803',
    name: 'HATI AYAM FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 36900,
    sellingPricePerKg: 33500,
    rawItemCode: '10200419300005',
    rawBarcode: '03886',
    rawName: 'BAHAN FZ HATI AYAM',
    vendor: 'PT PNDESIA',
    tdnSection: 6,
  },
  {
    itemCode: '100315',
    plu: '03802',
    name: 'KULIT AYAM FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 34500,
    sellingPricePerKg: 41900,
    rawItemCode: '10200419300004',
    rawBarcode: '03885',
    rawName: 'BAHAN FZ KULIT AYAM',
    vendor: 'PT PNDESIA',
    tdnSection: 7,
  },
  {
    itemCode: '100319',
    plu: '03806',
    name: 'USUS AYAM FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 19900,
    sellingPricePerKg: 19900,
    rawItemCode: '10200419300008',
    rawBarcode: '03889',
    rawName: 'BAHAN FZ USUS AYAM',
    vendor: 'PT PNDESIA',
    tdnSection: 8,
  },
  {
    itemCode: '100329',
    plu: '03873',
    name: 'PAHA ATAS FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 52500,
    sellingPricePerKg: 52500,
    rawItemCode: '10200419300009',
    rawBarcode: '03890',
    rawName: 'BAHAN FZ PAHA ATAS',
    vendor: 'PT PNDESIA',
    tdnSection: 9,
  },
  {
    itemCode: '100330',
    plu: '03874',
    name: 'PAHA UTUH FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 53900,
    sellingPricePerKg: 53900,
    rawItemCode: '10200419300010',
    rawBarcode: '03891',
    rawName: 'BAHAN FZ PAHA UTUH',
    vendor: 'PT PNDESIA',
    tdnSection: 10,
  },
  {
    itemCode: '100331',
    plu: '03875',
    name: 'BONELESS DADA FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 58500,
    sellingPricePerKg: 58500,
    rawItemCode: '10200419300011',
    rawBarcode: '03892',
    rawName: 'BAHAN FZ BONELESS DADA',
    vendor: 'PT PNDESIA',
    tdnSection: 11,
  },
  {
    itemCode: '100357',
    plu: '03898',
    name: 'BONELESS PAHA FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 57500,
    sellingPricePerKg: 57500,
    rawItemCode: '10200419300012',
    rawBarcode: '03893',
    rawName: 'BAHAN FZ BONELESS PAHA',
    vendor: 'PT PNDESIA',
    tdnSection: 12,
  },
  {
    itemCode: '100358',
    plu: '03899',
    name: 'SAYAP TENGAH FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 52900,
    sellingPricePerKg: 52900,
    rawItemCode: '10200419300013',
    rawBarcode: '03894',
    rawName: 'BAHAN FZ SAYAP TENGAH',
    vendor: 'PT PNDESIA',
    tdnSection: 13,
  },
  {
    itemCode: '100359',
    plu: '03900',
    name: 'SAYAP TULIP FRESH',
    category: 'PARTING AYAM',
    reportCategory: 'PARTING_AYAM',
    subCategory: 'PARTING AYAM',
    unit: 'Kg',
    cogsPerKg: 52900,
    sellingPricePerKg: 52900,
    rawItemCode: '10200419300014',
    rawBarcode: '03895',
    rawName: 'BAHAN FZ SAYAP TULIP',
    vendor: 'PT PNDESIA',
    tdnSection: 14,
  },
];

export const ALL_CATALOG_PRODUCTS: CatalogProduct[] = [
  ...DAGING_CATALOG,
  ...SOSIS_KENTANG_CATALOG,
  ...FILLET_DORI_CATALOG,
  ...PARTING_AYAM_CATALOG,
];

export const getProductByCodeOrName = (identifier: string): CatalogProduct | undefined => {
  if (!identifier) return undefined;
  const clean = identifier.toLowerCase().trim();
  return ALL_CATALOG_PRODUCTS.find(
    (p) =>
      p.itemCode.toLowerCase() === clean ||
      p.plu.toLowerCase() === clean ||
      p.name.toLowerCase() === clean ||
      p.name.toLowerCase().includes(clean) ||
      clean.includes(p.name.toLowerCase())
  );
};

export const getProductsForCategory = (
  category: ReportCategory,
  subCategory?: string
): CatalogProduct[] => {
  if (category === 'DAGING') return DAGING_CATALOG;
  if (category === 'PARTING_AYAM') return PARTING_AYAM_CATALOG;
  if (category === 'KENTANG_SOSIS_DORI') {
    if (subCategory === 'SOSIS & KENTANG') return SOSIS_KENTANG_CATALOG;
    if (subCategory === 'FILLET DORI') return FILLET_DORI_CATALOG;
    return KENTANG_SOSIS_DORI_CATALOG;
  }
  return [];
};
