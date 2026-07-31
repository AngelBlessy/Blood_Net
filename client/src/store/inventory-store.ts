import { create } from 'zustand';
import type { BloodGroup, InventoryItem } from '@/types/domain';
import { apiGet, apiPut } from '@/lib/api';

export const LOW_STOCK_THRESHOLD = 5;

interface UpdateItemInput {
  units: number;
  expiry?: string;
  location?: string;
}

interface InventoryState {
  items: InventoryItem[];
  loading: boolean;
  fetchItems: (options?: { mine?: boolean }) => Promise<void>;
  updateItem: (group: BloodGroup, updates: UpdateItemInput) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  loading: false,

  async fetchItems(options) {
    set({ loading: true });
    try {
      const query = options?.mine ? '?mine=true' : '';
      const data = await apiGet<{ items: InventoryItem[] }>(`/inventory${query}`);
      set({ items: data.items });
    } finally {
      set({ loading: false });
    }
  },

  async updateItem(group, updates) {
    const data = await apiPut<{ ok: boolean; item: InventoryItem }>(`/inventory/${group}`, updates);
    set((state) => {
      const exists = state.items.some((item) => item.group === group);
      return {
        items: exists
          ? state.items.map((item) => (item.group === group ? data.item : item))
          : [...state.items, data.item],
      };
    });
  },
}));
