// tools/ingesta/supabase.ts
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function makeServiceClient(): SupabaseClient {
  const envPath = path.join(__dirname, "../../hub/.env.local");
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en hub/.env.local",
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
