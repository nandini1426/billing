import { create } from 'zustand';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderStore {
  currentOrder: OrderItem[];
  meta: { mode: string; tableId: string | null };
  setMeta: (meta: Partial<{ mode: string; tableId: string | null }>) => void;
  addItem: (item: Omit<OrderItem, 'quantity'>) => void;
  addItemWithQty: (item: OrderItem) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearOrder: () => void;
  calcBill: (
    discountPct?: number,
    discountFixed?: number,
    gstEnabled?: boolean,
    deliveryFee?: number
  ) => {
    subtotal: number;
    afterDiscount: number;
    cgst: number;
    sgst: number;
    grandTotal: number;
  };
}

const useOrderStore = create<OrderStore>((set, get) => ({
  currentOrder: [],
  meta: { mode: 'table', tableId: null },

  setMeta: (meta) => set({ meta: { ...get().meta, ...meta } }),

  addItem: (item) => set((state) => {
    const existing = state.currentOrder.find(i => i.id === item.id);
    if (existing) {
      return {
        currentOrder: state.currentOrder.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      };
    }
    return {
      currentOrder: [...state.currentOrder, { ...item, quantity: 1 }]
    };
  }),

  addItemWithQty: (item) => set((state) => {
    const existing = state.currentOrder.find(i => i.id === item.id);
    if (existing) {
      return {
        currentOrder: state.currentOrder.map(i =>
          i.id === item.id ? { ...i, quantity: item.quantity } : i
        )
      };
    }
    return {
      currentOrder: [...state.currentOrder, item]
    };
  }),

  removeItem: (id) => set((state) => ({
    currentOrder: state.currentOrder.filter(i => i.id !== id)
  })),

  updateQty: (id, qty) => set((state) => ({
    currentOrder: state.currentOrder
      .map(i => i.id === id ? { ...i, quantity: Math.max(0, qty) } : i)
      .filter(i => i.quantity > 0)
  })),

  clearOrder: () => set({
    currentOrder: [],
    meta: { mode: 'table', tableId: null }
  }),

  calcBill: (
    discountPct = 0,
    discountFixed = 0,
    gstEnabled = true,
    deliveryFee = 0
  ) => {
    const { currentOrder } = get();
    const subtotal = currentOrder.reduce(
      (s, i) => s + i.price * i.quantity, 0
    );
    const afterFixed = subtotal - Number(discountFixed);
    const afterPct   = afterFixed * (1 - Number(discountPct) / 100);
    const cgst       = gstEnabled
      ? Math.round(afterPct * 0.025 * 100) / 100 : 0;
    const sgst       = gstEnabled
      ? Math.round(afterPct * 0.025 * 100) / 100 : 0;
    const grandTotal = Math.round(
      afterPct + cgst + sgst + Number(deliveryFee)
    );
    return {
      subtotal:      Math.round(subtotal * 100) / 100,
      afterDiscount: Math.round(afterPct * 100) / 100,
      cgst,
      sgst,
      grandTotal,
    };
  },
}));

export default useOrderStore;