import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';
import type { BloodGroup, DonorResponse, HospitalRequest, RequestPriority } from '@/types/domain';

interface HospitalRequestsState {
  requests: HospitalRequest[];
  addRequest: (
    patient: string,
    bloodGroup: BloodGroup,
    units: number,
    priority: RequestPriority,
    contactName: string,
    contactPhone: string
  ) => HospitalRequest;
  updateRequest: (id: string, updates: Partial<HospitalRequest>) => void;
  recordResponse: (id: string, userKey: string, response: DonorResponse) => void;
}

export const useHospitalRequestsStore = create<HospitalRequestsState>()(
  persist(
    (set, get) => ({
      requests: [],
      addRequest: (patient, bloodGroup, units, priority, contactName, contactPhone) => {
        const request: HospitalRequest = {
          id: crypto.randomUUID(),
          patient,
          bloodGroup,
          units,
          priority,
          contactName,
          contactPhone,
          matches: 0,
          status: i18n.t('statusNewRequest'),
          createdAt: i18n.t('justNow'),
        };
        set((state) => ({ requests: [request, ...state.requests] }));
        return request;
      },
      updateRequest: (id, updates) =>
        set((state) => ({
          requests: state.requests.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)),
        })),
      recordResponse: (id, userKey, response) => {
        const request = get().requests.find((entry) => entry.id === id);
        if (!request) return;
        set((state) => ({
          requests: state.requests.map((entry) =>
            entry.id === id ? { ...entry, responses: { ...(entry.responses || {}), [userKey]: response } } : entry
          ),
        }));
      },
    }),
    { name: 'bloodnet.hospital-requests.v1' }
  )
);
