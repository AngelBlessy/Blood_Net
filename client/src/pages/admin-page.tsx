import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { apiGet, apiPost, apiErrorMessage } from '@/lib/api';
import type { AdminStats } from '@/types/domain';

interface PendingHospital {
  id: string;
  hospitalName: string;
  licenseNumber: string;
  city?: string;
  email?: string;
  phone?: string;
}

interface PendingBloodBank {
  id: string;
  bankName: string;
  city?: string;
  email?: string;
  phone?: string;
}

export function AdminPage() {
  const { t } = useTranslation();
  const requests = useHospitalRequestsStore((state) => state.requests);
  const fetchRequests = useHospitalRequestsStore((state) => state.fetchRequests);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingHospitals, setPendingHospitals] = useState<PendingHospital[]>([]);
  const [pendingBloodBanks, setPendingBloodBanks] = useState<PendingBloodBank[]>([]);

  async function refresh() {
    const [statsData, hospitalsData, banksData] = await Promise.all([
      apiGet<AdminStats>('/admin/stats'),
      apiGet<{ hospitals: PendingHospital[] }>('/admin/hospitals/pending'),
      apiGet<{ bloodBanks: PendingBloodBank[] }>('/admin/bloodbanks/pending'),
    ]);
    setStats(statsData);
    setPendingHospitals(hospitalsData.hospitals);
    setPendingBloodBanks(banksData.bloodBanks);
  }

  useEffect(() => {
    refresh().catch((error) => toast.error(apiErrorMessage(error, 'Could not load admin data.')));
    fetchRequests();
  }, [fetchRequests]);

  async function decideHospital(id: string, decision: 'approve' | 'reject') {
    try {
      await apiPost(`/admin/hospitals/${id}/${decision}`);
      setPendingHospitals((prev) => prev.filter((hospital) => hospital.id !== id));
      toast.success(`Hospital ${decision === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not update the hospital.'));
    }
  }

  async function decideBloodBank(id: string, decision: 'approve' | 'reject') {
    try {
      await apiPost(`/admin/bloodbanks/${id}/${decision}`);
      setPendingBloodBanks((prev) => prev.filter((bank) => bank.id !== id));
      toast.success(`Blood bank ${decision === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not update the blood bank.'));
    }
  }

  const lowStock = stats?.inventory.filter((item) => stats.lowStockGroups.includes(item.group)) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader eyebrow={t('adminEyebrow')} title={t('adminTitle')} description={t('adminDesc')} />

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label={t('statDonorsRegistered')} value={stats?.donorCount ?? 0} />
        <StatCard label={t('statOpenEmergencies')} value={stats?.openRequests ?? 0} />
        <StatCard label={t('statLowStockGroups')} value={stats?.lowStockGroups.length ?? 0} />
      </div>

      {(pendingHospitals.length > 0 || pendingBloodBanks.length > 0) && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <span className="text-sm font-medium text-primary">Approvals</span>
            <h2 className="mb-4 text-lg font-semibold">Pending hospitals</h2>
            <div className="space-y-3">
              {pendingHospitals.length === 0 ? (
                <EmptyState>No hospital registrations awaiting approval.</EmptyState>
              ) : (
                pendingHospitals.map((hospital) => (
                  <Card key={hospital.id} className="flex-row items-center justify-between gap-3 p-4">
                    <div>
                      <h4 className="font-semibold">{hospital.hospitalName}</h4>
                      <p className="text-sm text-muted-foreground">
                        License {hospital.licenseNumber} — {hospital.email}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideHospital(hospital.id, 'approve')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decideHospital(hospital.id, 'reject')}>
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <span className="text-sm font-medium text-primary">Approvals</span>
            <h2 className="mb-4 text-lg font-semibold">Pending blood banks</h2>
            <div className="space-y-3">
              {pendingBloodBanks.length === 0 ? (
                <EmptyState>No blood bank registrations awaiting approval.</EmptyState>
              ) : (
                pendingBloodBanks.map((bank) => (
                  <Card key={bank.id} className="flex-row items-center justify-between gap-3 p-4">
                    <div>
                      <h4 className="font-semibold">{bank.bankName}</h4>
                      <p className="text-sm text-muted-foreground">{bank.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideBloodBank(bank.id, 'approve')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decideBloodBank(bank.id, 'reject')}>
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('adminAlertsEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('adminAlertsTitle')}</h2>
          <div className="space-y-3">
            {lowStock.length === 0 ? (
              <EmptyState>{t('adminAllStocked')}</EmptyState>
            ) : (
              lowStock.map((item) => (
                <Card key={item.group} className="flex-row items-center justify-between gap-3 p-4">
                  <div>
                    <h4 className="font-semibold">{t('adminGroupLow', { group: item.group })}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('adminUnitsAcrossBanks', { units: item.units })}
                    </p>
                  </div>
                  <Badge variant="destructive">{t('adminActionBadge')}</Badge>
                </Card>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('adminActivityEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('adminActivityTitle')}</h2>
          <div className="space-y-3">
            {requests.length === 0 ? (
              <EmptyState>{t('adminNoRequests')}</EmptyState>
            ) : (
              requests.slice(0, 6).map((request) => <HospitalRequestCard key={request.id} request={request} />)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
