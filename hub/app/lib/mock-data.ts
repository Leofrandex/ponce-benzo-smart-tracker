// Mock data — to be replaced with Supabase queries in Phase 3: Link

export const mockUser = {
  id: "mock-user-001",
  full_name: "Carlos Rodríguez",
  email: "demo@ponzivenzo.com",
  role: "merchandiser",
};

export const mockStores = [
  {
    store_id: "store-001",
    name: "Farmatodo Las Mercedes",
    address: "Av. Las Mercedes, Caracas",
    master_lat: 10.4932,
    master_lng: -66.8531,
    status: "pending" as const,
  },
  {
    store_id: "store-002",
    name: "Farmatodo Chacao",
    address: "Calle Mohedano, El Rosal",
    master_lat: 10.5012,
    master_lng: -66.8461,
    status: "pending" as const,
  },
  {
    store_id: "store-003",
    name: "Farmatodo La Trinidad",
    address: "C.C. La Trinidad, Caracas",
    master_lat: 10.4788,
    master_lng: -66.8401,
    status: "pending" as const,
  },
  {
    store_id: "store-004",
    name: "Farmatodo Altamira",
    address: "Av. Luis Roche, Altamira",
    master_lat: 10.5056,
    master_lng: -66.8524,
    status: "pending" as const,
  },
  {
    store_id: "store-005",
    name: "Farmatodo Chuao",
    address: "Av. Río de Janeiro, Chuao",
    master_lat: 10.4881,
    master_lng: -66.8618,
    status: "pending" as const,
  },
];

export const mockRoute = {
  route_id: "route-001",
  route_date: new Date().toISOString().split("T")[0],
  store_ids: mockStores.map((s) => s.store_id),
};

export type StoreStatus = "pending" | "completed" | "skipped" | "anomaly";

export interface VisitRecord {
  visit_id: string;
  store_id: string;
  check_in_time: string;
  check_in_location: { lat: number; lng: number } | null;
  observations: string;
  status: StoreStatus;
  synced: boolean;
}
