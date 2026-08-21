import { create } from 'zustand';
import type { BloodGroup, DonorResponse, HospitalRequest, RequestPriority } from '@/types/domain';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSessionStore } from '@/store/session-store';

interface CreateRequestInput {
  patient: string;
  bloodGroup: BloodGroup;
  units: number;
  priority: RequestPriority;
  contactName: string;
  contactPhone: string;
}

function upsert(list: HospitalRequest[], updated: HospitalRequest) {
  return list.some((entry) => entry.id === updated.id)
    ? list.map((entry) => (entry.id === updated.id ? updated : entry))
    : [updated, ...list];
}

// A request can live in several of these lists at once (e.g. respondedRequests
// for a bank that accepted it, requests for the public feed) — updates it
// wherever it's already present rather than assuming it's only ever in
// requests/myRequests. Used for both a raiser's own edits and a responding
// blood bank's "Mark completed" (see canCloseAsRespondingBank server-side),
// so respondedRequests has to be covered here too or that card would keep
// showing stale status until the next poll.
function replaceEverywhere(state: HospitalRequestsState, id: string, updated: HospitalRequest) {
  const replace = (list: HospitalRequest[]) => list.map((entry) => (entry.id === id ? updated : entry));
  return {
    requests: replace(state.requests),
    myRequests: replace(state.myRequests),
    incomingRequests: replace(state.incomingRequests),
    respondedRequests: replace(state.respondedRequests),
  };
}

function upsertInBoth(state: HospitalRequestsState, updated: HospitalRequest) {
  const myUserId = useSessionStore.getState().session?.user.id;
  // incomingRequests is specifically "requests raised by someone else" — a
  // live push for a request the current user themselves raised (their own
  // room echoing back their own edit) must never land in their own incoming
  // feed, even though it's correct for requests/myRequests.
  const isMine = myUserId != null && updated.raisedByUserId === myUserId;
  return {
    requests: upsert(state.requests, updated),
    myRequests: upsert(state.myRequests, updated),
    incomingRequests: isMine ? state.incomingRequests : upsert(state.incomingRequests, updated),
  };
}

interface HospitalRequestsState {
  requests: HospitalRequest[];
  myRequests: HospitalRequest[];
  incomingRequests: HospitalRequest[];
  respondedRequests: HospitalRequest[];
  loading: boolean;
  fetchRequests: (options?: {
    mine?: boolean;
    limit?: number;
    bloodGroup?: BloodGroup;
    priority?: RequestPriority;
    status?: 'pending' | 'completed';
  }) => Promise<void>;
  // Separate from `requests` (the public/homepage feed) so a background poll for
  // the logged-in raiser's own requests never clobbers what the homepage shows.
  fetchMyRequests: () => Promise<HospitalRequest[]>;
  // Hospital-raised requests visible to every approved blood bank — separate
  // state so it never mixes with a blood bank's own raised requests (myRequests).
  fetchIncomingRequests: () => Promise<HospitalRequest[]>;
  // Requests this blood bank has accepted (from fetchIncomingRequests above),
  // at any status -- unlike incomingRequests, this doesn't drop off once a
  // request is completed, so the dashboard can keep showing it through to
  // "Completed" instead of it just vanishing.
  fetchRespondedRequests: () => Promise<HospitalRequest[]>;
  createRequest: (input: CreateRequestInput) => Promise<{ ok: boolean; message: string }>;
  updateRequest: (id: string, updates: { patient?: string; units?: number; status?: 'Completed' }) => Promise<void>;
  notifyDonors: (id: string) => Promise<{ ok: boolean; message: string }>;
  notifyAllDonors: (id: string) => Promise<{ ok: boolean; message: string }>;
  respond: (id: string, response: DonorResponse) => Promise<void>;
  respondAsBloodBank: (id: string, response: DonorResponse) => Promise<void>;
}

export const useHospitalRequestsStore = create<HospitalRequestsState>((set) => ({
  requests: [],
  myRequests: [],
  incomingRequests: [],
  respondedRequests: [],
  loading: false,

  async fetchRequests(options) {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (options?.mine) params.set('mine', 'true');
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.bloodGroup) params.set('bloodGroup', options.bloodGroup);
      if (options?.priority) params.set('priority', options.priority);
      if (options?.status) params.set('status', options.status);
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

  async fetchIncomingRequests() {
    const data = await apiGet<{ requests: HospitalRequest[] }>('/hospital-requests?forBloodBank=true');
    set({ incomingRequests: data.requests });
    return data.requests;
  },

  async fetchRespondedRequests() {
    const data = await apiGet<{ requests: HospitalRequest[] }>('/hospital-requests?respondedByBank=true');
    set({ respondedRequests: data.requests });
    return data.requests;
  },

  async createRequest(input) {
    const data = await apiPost<{ ok: boolean; message: string; request: HospitalRequest }>('/hospital-requests', input);
    set((state) => ({ myRequests: [data.request, ...state.myRequests] }));
    return { ok: data.ok, message: data.message };
  },

  async updateRequest(id, updates) {
    const data = await apiPatch<{ ok: boolean; request: HospitalRequest }>(`/hospital-requests/${id}`, updates);
    set((state) => replaceEverywhere(state, id, data.request));
  },

  async notifyDonors(id) {
    const data = await apiPost<{ ok: boolean; message: string; request: HospitalRequest }>(
      `/hospital-requests/${id}/notify`
    );
    set((state) => replaceEverywhere(state, id, data.request));
    return { ok: data.ok, message: data.message };
  },

  async notifyAllDonors(id) {
    const data = await apiPost<{ ok: boolean; message: string; request: HospitalRequest }>(
      `/hospital-requests/${id}/notify-all`
    );
    set((state) => replaceEverywhere(state, id, data.request));
    return { ok: data.ok, message: data.message };
  },

  async respond(id, response) {
    await apiPost(`/hospital-requests/${id}/respond`, { response });
  },

  async respondAsBloodBank(id, response) {
    const data = await apiPost<{ ok: boolean; request: HospitalRequest }>(`/hospital-requests/${id}/respond-bank`, {
      response,
    });
    // /respond-bank's response doesn't carry myBankResponse (only the list
    // endpoint computes that field) -- stamp it on here ourselves, or
    // upserting data.request as-is would wipe out the "you responded" state
    // this same action just set, flipping the card straight back to showing
    // Accept/Reject until the next poll.
    const updated = { ...data.request, myBankResponse: response };
    set((state) => ({
      incomingRequests: upsert(state.incomingRequests, updated),
      // Accepting should show up in live tracking immediately rather than
      // waiting on the next 30s poll (see fetchRespondedRequests).
      respondedRequests: response === 'Accepted' ? upsert(state.respondedRequests, updated) : state.respondedRequests,
    }));
  },
}));

// Live updates (donor/bloodbank accept/decline, hospital edits, radius
// escalation) — the server only ever emits this for requests belonging to
// the connected user's own hospital/account (see server/realtime/socket.js
// room scoping), so it's always safe to merge into these lists here. A slow
// poll elsewhere (see hospital-page.tsx, blood-bank-page.tsx) is kept as a
// fallback in case the socket drops, and covers requests this user didn't
// raise (e.g. a blood bank's incoming-requests feed).
getSocket().on('request:update', (updated: HospitalRequest) => {
  useHospitalRequestsStore.setState((state) => upsertInBoth(state, updated));
});
