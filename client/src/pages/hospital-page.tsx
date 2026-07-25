import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { RaiseRequestForm } from '@/components/hospital/raise-request-form';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';

export function HospitalPage() {
  const requests = useHospitalRequestsStore((state) => state.requests);
  const fetchRequests = useHospitalRequestsStore((state) => state.fetchRequests);

  useEffect(() => {
    fetchRequests({ mine: true });
  }, [fetchRequests]);

  const openRequests = requests.filter((request) => request.status !== 'Completed');
  const unitsNeeded = openRequests.reduce((total, request) => total + request.units, 0);
  const donorsMatched = openRequests.reduce((total, request) => total + request.matches, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Workspace"
        title="Hospital Dashboard"
        description="Coordinate urgent blood requests, compatible donors, and response progress from one place."
      />

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Open requests" value={openRequests.length} />
        <StatCard label="Units needed" value={unitsNeeded} />
        <StatCard label="Donors matched" value={donorsMatched} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <span className="text-sm font-medium text-primary">Emergency desk</span>
          <h2 className="mb-4 text-lg font-semibold">Raise a blood request</h2>
          <RaiseRequestForm />
        </Card>

        <Card className="p-6">
          <span className="text-sm font-medium text-primary">Live tracking</span>
          <h2 className="mb-4 text-lg font-semibold">Request status</h2>
          <div className="space-y-3">
            {requests.length === 0 ? (
              <EmptyState>No requests raised yet. Create an emergency request to notify matched donors.</EmptyState>
            ) : (
              requests.slice(0, 8).map((request) => (
                <HospitalRequestCard key={request.id} request={request} showActions />
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
