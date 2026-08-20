/**
 * GTS — demonstration data vocabulary.
 *
 * The names, sites and people the screens are populated with. Kept in one
 * place so a client called on the dashboard is the same client on the
 * ledger, and so replacing fixtures with database queries later means
 * deleting this file rather than hunting through fourteen pages.
 *
 * NOTHING here is business logic. Money is illustrative, at Egyptian
 * market scale — a company of this size bills in hundreds of thousands
 * of pounds, not tens of thousands.
 */

/* ============================================================
   CLIENTS — real Egyptian corporates, as counterparties would be
   ============================================================ */

export const CLIENTS = {
  palmHills: { name: 'Palm Hills Developments', trn: '317604882' },
  orascom: { name: 'Orascom Construction', trn: '203558741' },
  elsewedy: { name: 'Elsewedy Electric', trn: '446120935' },
  juhayna: { name: 'Juhayna Food Industries', trn: '512873064' },
  tmg: { name: 'Talaat Moustafa Group', trn: '698441207' },
  hassanAllam: { name: 'Hassan Allam Properties', trn: '774193508' },
} as const;

/* ============================================================
   PEOPLE — Egyptian naming, no Gulf tribal surnames
   ============================================================ */

export const PEOPLE = {
  foreman: { name: 'Omar Abdel Rahman', role: 'Site foreman' },
  qs: { name: 'Sara Mahmoud', role: 'Quantity surveyor' },
  driver: { name: 'Mohamed Nasser', role: 'Driver' },
  storekeeper: { name: 'Mariam Fouad', role: 'Storekeeper' },
  electrician: { name: 'Kareem El-Sayed', role: 'Electrician' },
  procurement: { name: 'Youssef Ibrahim', role: 'Procurement lead' },
  admin: { name: 'Nadia Shalaby', role: 'System administrator' },
  accountant: { name: 'Ahmed Zaki', role: 'Financial controller' },
} as const;

/* ============================================================
   WAREHOUSES — the real industrial geography
   ============================================================ */

export const WAREHOUSES = [
  {
    name: 'Sixth of October Depot',
    nameAr: 'مستودع السادس من أكتوبر',
    governorate: 21, // Giza
    lat: 29.9668,
    lng: 30.9364,
  },
  {
    name: 'Alexandria Yard',
    nameAr: 'ساحة الإسكندرية',
    governorate: 2,
    lat: 31.1975,
    lng: 29.8925,
  },
  {
    name: 'Tenth of Ramadan Store',
    nameAr: 'مخزن العاشر من رمضان',
    governorate: 13, // Sharqia
    lat: 30.2965,
    lng: 31.7417,
  },
] as const;

/* ============================================================
   PROJECTS
   ============================================================ */

export const PROJECTS = [
  {
    code: 'PRJ-0142',
    name: 'Palm Hills New Cairo — Phase 2 fit-out',
    client: CLIENTS.palmHills.name,
    address: 'Palm Hills New Cairo, Third Settlement, Cairo',
    governorate: 1,
    lat: 30.0131,
    lng: 31.4914,
    radius: 300,
  },
  {
    code: 'PRJ-0138',
    name: 'Tenth of Ramadan warehouse racking',
    client: CLIENTS.elsewedy.name,
    address: 'Industrial Zone A1, 10th of Ramadan City, Sharqia',
    governorate: 13,
    lat: 30.2965,
    lng: 31.7417,
    radius: 200,
  },
  {
    code: 'PRJ-0151',
    name: 'New Alamein showroom',
    client: CLIENTS.tmg.name,
    address: 'New Alamein City, Matrouh',
    governorate: 33,
    lat: 30.8418,
    lng: 28.9536,
    radius: 400,
  },
] as const;

/* ============================================================
   PRODUCTS — Egyptian construction supply, with local brands
   ============================================================ */

export const PRODUCTS = [
  { code: 'CEM-42.5N', name: 'Portland cement 42.5N — 50kg', brand: 'Suez Cement', unit: 'BG', price: 232.5 },
  { code: 'STL-B12', name: 'Reinforcement bar B12 — 12m', brand: 'Ezz Steel', unit: 'EA', price: 810.0 },
  { code: 'AGG-20', name: 'Coarse aggregate 20mm', brand: 'Suez quarry', unit: 'MTQ', price: 1_450.0 },
  { code: 'CBL-4C16', name: 'Power cable 4C×16mm²', brand: 'Elsewedy', unit: 'MTR', price: 486.0 },
  { code: 'TIL-60', name: 'Porcelain floor tile 60×60', brand: 'Cleopatra', unit: 'MTK', price: 312.0 },
  { code: 'PNT-EMU', name: 'Emulsion paint — 9L', brand: 'Jotun Egypt', unit: 'EA', price: 1_240.0 },
] as const;

/* ============================================================
   BANKING
   ============================================================ */

export const BANK = {
  name: 'Commercial International Bank (CIB)',
  nameAr: 'البنك التجاري الدولي',
  /** Egyptian IBANs are 29 characters and begin EG. Masked for display. */
  ibanMasked: 'EG•• •••• •••• •••• •••• 4021',
  currency: 'EGP',
} as const;
