import { create } from 'zustand';
import type { BloodGroup, DonorResponse, HospitalRequest, RequestPriority } from '@/types/domain';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

interface CreateRequestInput {
  patient: string;
  bloodGroup: BloodGroup;
  units: number;
  priority: RequestPriority;
  contactName: string;
  contactPhone: string;
}

interface HospitalRequestsState {
  requests: HospitalRequest[];
  loading: boolean;
  fetchRequests: (options?: { mine?: boolean; limit?: number }) => Promise<void>;
  createRequest: (input: CreateRequestInput) => Promise<{ ok: boolean; message: string }>;
  updateRequest: (id: string, updates: { patient?: string; units?: number; status?: 'Completed' }) => Promise<void>;
  notifyDonors: (id: string) => Promise<{ ok: boolean; message: string }>;
  respond: (id: string, response: DonorResponse) => Promise<void>;
}

export const useHospitalRequestsStore = create<HospitalRequestsState>((set) => ({
  requests: [],
  loading: false,

  async fetchRequests(options) {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (options?.mine) params.set('mine', 'true');
      if (options?.limit) params.set('limit', String(options.limit));
      const query = params.toString();
      const data = await apiGet<{ requests: HospitalRequest[] }>(`/hospital-requests${query ? `?${query}` : ''}`);
      set({ requests: data.requests });
    } finally {
      set({ loading: false });
    }
  },

  async createRequest(input) {
    const data = await apiPost<{ ok: boolean; message: string; request: HospitalRequest }>('/hospital-requests', input);
    set((state) => ({ requests: [data.request, ...state.requests] }));
    return { ok: data.ok, message: data.message };
  },

  async updateRequest(id, updates) {
    const data = await apiPatch<{ ok: boolean; request: HospitalRequest }>(`/hospital-requests/${id}`, updates);
    set((state) => ({ requests: state.requests.map((entry) => (entry.id === id ? data.request : entry)) }));
  },

  async notifyDonors(id) {
    const data = await apiPost<{ ok: boolean; message: string; request: HospitalRequest }>(
      `/hospital-requests/${id}/notify`
    );
    set((state) => ({ requests: state.requests.map((entry) => (entry.id === id ? data.request : entry)) }));
    return { ok: data.ok, message: data.message };
  },

  async respond(id, response) {
    await apiPost(`/hospital-requests/${id}/respond`, { response });
  },
}));
