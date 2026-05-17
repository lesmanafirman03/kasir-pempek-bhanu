import { create } from 'zustand'

// Definisikan struktur data item dalam keranjang
interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

// Definisikan fungsi-fungsi yang bisa dilakukan keranjang belanja
interface CartStore {
  items: CartItem[];
  addItem: (item: any) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  // State awal: keranjang kosong
  items: [],

  // Fungsi Tambah Menu ke Keranjang
  addItem: (item) => set((state) => {
    const existing = state.items.find(i => i.id === item.id);
    
    // Jika menu sudah ada di keranjang, tambah jumlahnya (qty + 1)
    if (existing) {
      return { 
        items: state.items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) 
      }
    }
    
    // Jika menu belum ada, masukkan sebagai item baru dengan qty = 1
    return { 
      items: [...state.items, { id: item.id, name: item.name, price: item.price, qty: 1 }] 
    }
  }),

  // Fungsi Hapus Menu dari Keranjang
  removeItem: (id) => set((state) => ({ 
    items: state.items.filter(i => i.id !== id) 
  })),

  // Fungsi Mengosongkan Keranjang (setelah sukses checkout)
  clearCart: () => set({ items: [] }),

  // Fungsi Menghitung Total Belanjaan Kasir
  getTotal: () => get().items.reduce((total, item) => total + (item.price * item.qty), 0)
}))