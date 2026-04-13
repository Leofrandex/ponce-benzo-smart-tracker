/**
 * One-time import script: reads "data para supabase.xlsx" and inserts stores + routes into Supabase.
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in hub/.env.local or as env vars.
 *   - Run from the tools/ directory:
 *       npx tsx tools/import-data.ts
 *
 * Notes:
 *   - The Excel file has NO lat/lng coordinates. All stores are given a default location
 *     near the center of Caracas (10.4806, -66.9036). Update with real coordinates afterward.
 *   - Routes are created for TODAY's date, one per unique salesperson.
 *   - Salesperson accounts must already exist in Supabase Auth + users table.
 *     Match is done by full_name — edit SELLER_EMAIL_MAP below to map Excel names → emails.
 */

import * as xlsx from "xlsx";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load env from hub/.env.local
const envPath = path.join(__dirname, "../hub/.env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
    "Add SUPABASE_SERVICE_ROLE_KEY to hub/.env.local (get it from Supabase Dashboard > Settings > API > service_role key)"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Map seller names (from Excel) to their Supabase user emails ─────────────
// Edit this map to match the real email accounts you created in Supabase Auth.
const SELLER_EMAIL_MAP: Record<string, string> = {
  "MILAGROS FERNANDEZ 10":  "milagros.f10@ponce-benzo.com",
  "MILAGROS FERNANDEZ 30":  "milagros.f30@ponce-benzo.com",
  "BETSY CASTRO":           "betsy.castro@ponce-benzo.com",
  "EDUWARD MARTÍNEZ":       "eduward.martinez@ponce-benzo.com",
  "WILLIAN FERMIN":         "willian.fermin@ponce-benzo.com",
  "JONATHAN FERNÁNDEZ":     "jonathan.fernandez@ponce-benzo.com",
  "CARLOS ZURITA":          "carlos.zurita@ponce-benzo.com",
  "ELVIS RONDON":           "elvis.rondon@ponce-benzo.com",
};

// Default Caracas center coordinates (no lat/lng in Excel)
const DEFAULT_LAT = 10.4806;
const DEFAULT_LNG = -66.9036;

interface ExcelRow {
  sellerId: number;
  sellerName: string;
  clientNumber: string;
  clientName: string;
  shortName: string;
  addressCode: number;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  inactive: string;
}

async function main() {
  const excelPath = path.join(__dirname, "../data para supabase.xlsx");
  if (!fs.existsSync(excelPath)) {
    console.error(`Excel file not found at: ${excelPath}`);
    process.exit(1);
  }

  // ── 1. Parse Excel ──────────────────────────────────────────────────────────
  const wb = xlsx.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
  const dataRows = rawData.slice(1) as unknown[][];

  const rows: ExcelRow[] = dataRows
    .filter((r) => r[0] != null) // skip blank rows
    .map((r) => ({
      sellerId:     Number(r[0]),
      sellerName:   String(r[1] ?? "").trim(),
      clientNumber: String(r[3] ?? "").trim(),
      clientName:   String(r[4] ?? "").trim(),
      shortName:    String(r[5] ?? "").trim(),
      addressCode:  Number(r[8]),
      address1:     String(r[10] ?? "").trim(),
      address2:     String(r[11] ?? "").trim(),
      address3:     String(r[12] ?? "").trim(),
      city:         String(r[13] ?? "").trim(),
      state:        String(r[14] ?? "").trim(),
      inactive:     String(r[16] ?? "").trim(),
    }));

  console.log(`Parsed ${rows.length} store rows from Excel.`);

  // ── 2. Build store records ──────────────────────────────────────────────────
  const storeRecords = rows.map((r) => {
    const addressParts = [r.address1, r.address2, r.address3]
      .filter(Boolean)
      .join(", ");
    const fullAddress = [addressParts, r.city, r.state]
      .filter(Boolean)
      .join(", ");

    return {
      name:        r.shortName || r.clientName,
      address:     fullAddress || null,
      master_lat:  DEFAULT_LAT,
      master_lng:  DEFAULT_LNG,
      active:      r.inactive.toUpperCase() !== "INACTIVO",
      // Store the address code as a reference for deduplication
      _address_code: r.addressCode,
      _seller_name:  r.sellerName,
    };
  });

  // ── 3. Insert stores ────────────────────────────────────────────────────────
  console.log("Inserting stores into Supabase...");
  const { data: insertedStores, error: storeError } = await supabase
    .from("stores")
    .insert(
      storeRecords.map(({ _address_code: _ac, _seller_name: _sn, ...s }) => s)
    )
    .select("store_id, name, address");

  if (storeError) {
    console.error("Store insert error:", storeError.message);
    process.exit(1);
  }

  console.log(`✓ Inserted ${insertedStores!.length} stores.`);

  // Map address code → store_id for route building
  const storeIdByIndex: Record<number, string> = {};
  insertedStores!.forEach((s, i) => {
    storeIdByIndex[i] = s.store_id;
  });

  // ── 4. Fetch user IDs by email ──────────────────────────────────────────────
  const uniqueSellers = [...new Set(rows.map((r) => r.sellerName))];
  const sellerUserIds: Record<string, string> = {};

  for (const sellerName of uniqueSellers) {
    const email = SELLER_EMAIL_MAP[sellerName];
    if (!email) {
      console.warn(`⚠  No email mapped for seller: "${sellerName}" — skipping their route.`);
      continue;
    }
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !userData) {
      console.warn(`⚠  User not found in DB for email: ${email} — skipping their route.`);
    } else {
      sellerUserIds[sellerName] = userData.id;
    }
  }

  // ── 5. Build and insert routes ──────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const routesBySeller: Record<string, string[]> = {};

  rows.forEach((row, i) => {
    const userId = sellerUserIds[row.sellerName];
    if (!userId) return;
    if (!routesBySeller[row.sellerName]) routesBySeller[row.sellerName] = [];
    routesBySeller[row.sellerName].push(storeIdByIndex[i]);
  });

  const routeRecords = Object.entries(routesBySeller).map(([sellerName, storeIds]) => ({
    user_id:    sellerUserIds[sellerName],
    route_date: today,
    store_ids:  storeIds,
  }));

  if (routeRecords.length === 0) {
    console.warn("No routes to insert — ensure SELLER_EMAIL_MAP is filled and users exist in the DB.");
  } else {
    const { data: insertedRoutes, error: routeError } = await supabase
      .from("routes")
      .insert(routeRecords)
      .select("route_id, user_id");

    if (routeError) {
      console.error("Route insert error:", routeError.message);
    } else {
      console.log(`✓ Inserted ${insertedRoutes!.length} routes for ${today}.`);
    }
  }

  console.log("\nDone! Next steps:");
  console.log("  1. Update master_lat/master_lng for each store with real GPS coordinates.");
  console.log("  2. Verify data in Supabase Dashboard > Table Editor.");
}

main().catch(console.error);
