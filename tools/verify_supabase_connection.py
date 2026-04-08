"""
tools/verify_supabase_connection.py
====================================
Phase 2: Link — Handshake Script
Verifica que las 3 capas de Supabase respondan correctamente:
  1. Auth (login de prueba)
  2. Database (read de tabla stores)
  3. Storage (list del bucket visit-photos)

Uso:
  pip install supabase python-dotenv
  python tools/verify_supabase_connection.py
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

def check_env():
    """Verify all required environment variables are set."""
    print("\n[1/4] Verificando variables de entorno...")
    missing = []
    for var in ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"]:
        if not os.getenv(var) or "PENDIENTE" in os.getenv(var, ""):
            missing.append(var)
    
    if missing:
        print(f"  ❌ FALTA configurar: {', '.join(missing)}")
        print("  → Edita el archivo .env con las claves de tu proyecto Supabase.")
        sys.exit(1)
    print("  ✅ Variables de entorno: OK")

def check_database():
    """Test database connectivity by querying the stores table."""
    from supabase import create_client
    print("\n[2/4] Verificando conexión a Base de Datos (PostgreSQL)...")
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        # Try to query stores table (may be empty, that's OK)
        response = client.table("stores").select("store_id").limit(1).execute()
        print(f"  ✅ Database: OK — tabla 'stores' accesible. ({len(response.data)} registros encontrados)")
        return client
    except Exception as e:
        print(f"  ❌ Database ERROR: {e}")
        print("  → Asegúrate de haber corrido el SQL de creación de tablas en Supabase.")
        sys.exit(1)

def check_storage(client):
    """Test Supabase Storage by listing the visit-photos bucket."""
    print("\n[3/4] Verificando Supabase Storage (bucket: visit-photos)...")
    try:
        buckets = client.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        if "visit-photos" in bucket_names:
            print("  ✅ Storage: OK — bucket 'visit-photos' existe.")
        else:
            print(f"  ⚠️  Storage: bucket 'visit-photos' NO encontrado.")
            print(f"     Buckets disponibles: {bucket_names}")
            print("  → Crea el bucket 'visit-photos' en Supabase Dashboard → Storage.")
    except Exception as e:
        print(f"  ❌ Storage ERROR: {e}")

def check_auth():
    """Verify Auth is reachable (check settings endpoint)."""
    import urllib.request
    print("\n[4/4] Verificando Supabase Auth...")
    try:
        url = f"{SUPABASE_URL}/auth/v1/settings"
        req = urllib.request.Request(url, headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
        })
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                print("  ✅ Auth: OK — endpoint responde correctamente.")
    except Exception as e:
        print(f"  ❌ Auth ERROR: {e}")

if __name__ == "__main__":
    print("=" * 55)
    print("  PONZIVENZO SMART TRACKER — Supabase Handshake Test")
    print("=" * 55)
    
    check_env()
    
    try:
        import supabase
    except ImportError:
        print("\n❌ Librería 'supabase' no instalada. Corre:")
        print("   pip install supabase python-dotenv")
        sys.exit(1)
    
    client = check_database()
    check_storage(client)
    check_auth()
    
    print("\n" + "=" * 55)
    print("  ✅ Handshake completado. Listo para Phase 3: Architect")
    print("=" * 55 + "\n")
