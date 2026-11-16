import { create } from "zustand";

export type AppRole = "customer" | "kitchen" | "manager" | "owner" | "super_admin" | "waiter";

export interface ActiveTableSession {
  session_id: string;
  restaurant_id: string;
  table_id: string;
  table_number: number;
  qr_token: string;
  status: "empty" | "seated" | "amber";
  guest_count: number;
  source: "qr" | "tablet" | "manager" | "cctv" | "sensor";
  is_phone_verified: boolean;
  dpdp_consent: boolean;
  customer_phone?: string | null;
  customer_name?: string | null;
  occasion?: string | null;
  seated_at: string;
  session_token: string;
}

export interface CartItem {
  menu_item_id: string;
  name: string;
  qty: number;
  display_unit_paise: number;
  notes: string;
  image_url: string;
}

interface AppState {
  activeRestaurantId: string;
  activeRole: AppRole;
  staffToken: string | null;
  staffName: string;
  customerMode: "tablet" | "qr";
  selectedTableNumber: number;
  activeSession: ActiveTableSession | null;
  selectedOccasion: string;
  cart: CartItem[];
  lastAmberAlert: {
    table_number: number;
    guest_count: number;
    source: string;
    message: string;
    timestamp: string;
  } | null;

  setActiveRestaurantId: (id: string) => void;
  setActiveRole: (role: AppRole) => void;
  setStaffAuth: (token: string, name: string, role: AppRole) => void;
  setCustomerMode: (mode: "tablet" | "qr") => void;
  setSelectedTableNumber: (num: number) => void;
  setActiveSession: (sess: ActiveTableSession | null) => void;
  setSelectedOccasion: (occ: string) => void;
  addToCart: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  updateCartQty: (menuItemId: string, qty: number) => void;
  updateCartNotes: (menuItemId: string, notes: string) => void;
  clearCart: () => void;
  setLastAmberAlert: (alert: AppState["lastAmberAlert"]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeRestaurantId: "shree-ram-dhaba",
  activeRole: "customer",
  staffToken: null,
  staffName: "Demo Presenter",
  customerMode: "tablet",
  selectedTableNumber: 1,
  activeSession: null,
  selectedOccasion: "family",
  cart: [],
  lastAmberAlert: null,

  setActiveRestaurantId: (id) =>
    set(() => ({
      activeRestaurantId: id,
      activeSession: null,
      cart: [],
    })),

  setActiveRole: (role) => set({ activeRole: role }),

  setStaffAuth: (token, name, role) =>
    set({
      staffToken: token,
      staffName: name,
      activeRole: role,
    }),

  setCustomerMode: (mode) => set({ customerMode: mode }),

  setSelectedTableNumber: (num) =>
    set({
      selectedTableNumber: num,
      activeSession: null,
    }),

  setActiveSession: (sess) => set({ activeSession: sess }),

  setSelectedOccasion: (occ) => set({ selectedOccasion: occ }),

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.menu_item_id === item.menu_item_id);
      const addQty = item.qty ?? 1;
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.menu_item_id === item.menu_item_id
              ? {
                  ...c,
                  qty: c.qty + addQty,
                  notes: item.notes || c.notes,
                }
              : c
          ),
        };
      }
      return {
        cart: [
          ...state.cart,
          {
            menu_item_id: item.menu_item_id,
            name: item.name,
            qty: addQty,
            display_unit_paise: item.display_unit_paise,
            notes: item.notes || "",
            image_url: item.image_url,
          },
        ],
      };
    }),

  updateCartQty: (menuItemId, qty) =>
    set((state) => ({
      cart:
        qty <= 0
          ? state.cart.filter((c) => c.menu_item_id !== menuItemId)
          : state.cart.map((c) => (c.menu_item_id === menuItemId ? { ...c, qty } : c)),
    })),

  updateCartNotes: (menuItemId, notes) =>
    set((state) => ({
      cart: state.cart.map((c) => (c.menu_item_id === menuItemId ? { ...c, notes } : c)),
    })),

  clearCart: () => set({ cart: [] }),

  setLastAmberAlert: (alert) => set({ lastAmberAlert: alert }),
}));
