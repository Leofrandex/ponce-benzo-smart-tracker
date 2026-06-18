import type { Store, User, Route, RouteStoreItem, CompetitorBrand } from './types';

export const mockStores: Store[] = [
  { store_id: 'store-001', name: 'Farmatodo Las Mercedes',    address: 'Av. Las Mercedes, Caracas',                   master_lat: 10.4920, master_lng: -66.8557, active: true,  created_at: '2024-01-01T00:00:00Z', contact_name: 'Mónica Rubio',      contact_phone: '(212) 949-8188', contact_email: 'proveedores@farmatodo.com',        estado: null, municipio: null, urbanizacion: null, business_channel: 'farmacia',     classification: 'A' },
  { store_id: 'store-002', name: 'Farmatodo Chacao',           address: 'Calle Mohedano, El Rosal',                    master_lat: 10.4904, master_lng: -66.8541, active: true,  created_at: '2024-01-01T00:00:00Z', contact_name: 'Dayana Villalobos', contact_phone: '(212) 949-8200', contact_email: 'dayana.villalobos@farmatodo.com',  estado: null, municipio: null, urbanizacion: null, business_channel: 'farmacia',     classification: 'A' },
  { store_id: 'store-003', name: 'Farmatodo La Trinidad',      address: 'C.C. La Trinidad, Caracas',                   master_lat: 10.4751, master_lng: -66.8367, active: true,  created_at: '2024-01-01T00:00:00Z', contact_name: 'Andrea Meserón',    contact_phone: '(212) 944-4454', contact_email: 'compras.trinidad@farmatodo.com',   estado: null, municipio: null, urbanizacion: null, business_channel: 'farmacia',     classification: 'B' },
  { store_id: 'store-g01', name: 'Gama Los Palos Grandes',     address: 'Av. Francisco de Miranda, Los Palos Grandes', master_lat: 10.4994, master_lng: -66.8439, active: true,  created_at: '2024-01-01T00:00:00Z', contact_name: 'Yanelvis Noria',    contact_phone: '(212) 205-4322', contact_email: 'jfrontado@excelsiorgama.com',      estado: null, municipio: null, urbanizacion: null, business_channel: 'supermercado', classification: 'A' },
  { store_id: 'store-l01', name: 'Locatel El Rosal',           address: 'Calle La Guairita, El Rosal',                 master_lat: 10.4897, master_lng: -66.8530, active: true,  created_at: '2024-01-01T00:00:00Z', contact_name: 'Laris Locatel',     contact_phone: '(212) 203-4565', contact_email: 'compras2.elparaiso@locatelve.com', estado: null, municipio: null, urbanizacion: null, business_channel: 'drogueria',    classification: 'A' },
  { store_id: 'store-s01', name: 'Farmacias SAAS Macaracuay',  address: 'Av. Principal de Macaracuay',                 master_lat: 10.5041, master_lng: -66.8298, active: true,  created_at: '2024-01-01T00:00:00Z', contact_name: 'Angie Labrador',    contact_phone: '(424) 218-6022', contact_email: null,                               estado: null, municipio: null, urbanizacion: null, business_channel: 'farmacia',     classification: 'C' },
];

export const mockMerchandisers: User[] = [
  { id: 'merc-001', full_name: 'Carlos Rodríguez', email: 'carlos@poncebenzo.com', role: 'merchandiser', active: true, created_at: '2024-01-01T00:00:00Z', supervisor_id: null },
  { id: 'merc-002', full_name: 'Luis Pérez',        email: 'luis@poncebenzo.com',   role: 'merchandiser', active: true, created_at: '2024-01-01T00:00:00Z', supervisor_id: null },
  { id: 'merc-003', full_name: 'María González',    email: 'maria@poncebenzo.com',  role: 'merchandiser', active: true, created_at: '2024-01-01T00:00:00Z', supervisor_id: null },
  { id: 'merc-004', full_name: 'Andrés Ramírez',    email: 'andres@poncebenzo.com', role: 'merchandiser', active: true, created_at: '2024-01-01T00:00:00Z', supervisor_id: null },
];

export const mockRoute: Route = {
  route_id: 'route-demo-001',
  user_id: 'merc-001',
  route_date: new Date().toISOString().split('T')[0],
  store_ids: mockStores.map((s) => s.store_id),
  created_at: new Date().toISOString(),
  is_special: false,
};

export const getMockRouteItems = (): RouteStoreItem[] =>
  mockRoute.store_ids.map((storeId, index) => ({
    store: mockStores.find((s) => s.store_id === storeId)!,
    order: index + 1,
    status: 'pending',
  }));

// UUIDs reales sembrados en competitor_brands (Supabase). Sirven de respaldo
// offline: si el fetch falla, los reportes igual referencian un brand_id válido
// (la columna es uuid y tiene FK → competitor_brands).
export const mockCompetitorBrands: CompetitorBrand[] = [
  { brand_id: 'a1000000-0000-4000-8000-000000000001', name: 'Genomma Lab',         active: true },
  { brand_id: 'a1000000-0000-4000-8000-000000000002', name: 'Bayer',               active: true },
  { brand_id: 'a1000000-0000-4000-8000-000000000003', name: 'Calox',               active: true },
  { brand_id: 'a1000000-0000-4000-8000-000000000004', name: 'Leti',                active: true },
  { brand_id: 'ea058b2e-3eb1-4126-9a6a-d4e03b7b40f5', name: 'Genérico / Sin marca', active: true },
];
