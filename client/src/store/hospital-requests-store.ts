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

function replaceInBoth(requests: HospitalRequest[], myRequests: HospitalRequest[], id: string, updated: HospitalRequest) {
  return {
    requests: requests.map((entry) => (entry.id === id ? updated : entry)),
    myRequests: myRequests.map((entry) => (entry.id === id ? updated : entry)),
  };
}

interface HospitalRequestsState {
  requests: HospitalRequest[];
  myRequests: HospitalRequest[];
  loading: boolean;
  fetchRequests: (options?: { mine?: boolean; limit?: number }) => Promise<void>;
  // Separate from `requests` (the public/homepage feed) so a background poll for
  // the logged-in raiser's own requests never clobbers what the homepage shows.
  fetchMyRequests: () => Promise<HospitalRequest[]>;
  createRequest: (input: CreateRequestInput) => Promise<{ ok: boolean; message: string }>;
  updateRequest: (id: string, updates: { patient?: string; units?: number; status?: 'Completed' }) => Promise<void>;
  notifyDonors: (id: string) => Promise<{ ok: boolean; message: string }>;
  respond: (id: string, response: DonorResponse) => Promise<void>;
}

export const useHospitalRequestsStore = create<HospitalRequestsState>((set) => ({
  requests: [],
  myRequests: [],
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

  async fetchMyRequests() {
    const data = await apiGet<{ requests: HospitalRequest[] }>('/hospital-requests?mine=true');
    set({ myRequests: data.requests });
    return data.requests;
  },

  async createRequest(input) {
    const data = await apiPost<{ ok: boolean; message: string; request: HospitalRequest }>('/hospital-requests', input);
    set((state) => ({ myRequests: [data.request, ...state.myRequests] }));
    return { ok: data.ok, message: data.message };
  },

  async updateRequest(id, updates) {
    const data = await apiPatch<{ ok: boolean; request: HospitalRequest }>(`/hospital-requests/${id}`, updates);
    set((state) => replaceInBoth(state.requests, state.myRequests, id, data.request));
  },

  async notifyDonors(id) {
    const data = await apiPost<{ ok: boolean; message: string; request: HospitalRequest }>(
      `/hospital-requests/${id}/notify`
    );
    set((state) => replaceInBoth(state.requests, state.myRequests, id, data.request));
    return { ok: data.ok, message: data.message };
  },

  async respond(id, response) {
    await apiPost(`/hospital-requests/${id}/respond`, { response });
  },
}));
