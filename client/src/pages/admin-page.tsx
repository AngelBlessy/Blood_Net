import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { apiGet, apiPost, apiErrorMessage } from '@/lib/api';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { PRIORITY_LABEL_KEYS } from '@/lib/request-labels';
import type { AdminStats, BloodGroup, RequestPriority } from '@/types/domain';

const REQUEST_PRIORITIES: RequestPriority[] = ['Critical', 'Urgent', 'Routine'];
const RECENT_LIMIT_OPTIONS = [10, 20, 50, 100];

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

  const [limit, setLimit] = useState(20);
  const [bloodGroupFilter, setBloodGroupFilter] = useState<BloodGroup | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | 'all'>('all');

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
    refresh().catch((error) => toast.error(apiErrorMessage(error, t('toastAdminLoadError'))));
  }, [t]);

  // All request activity, unrestricted by raiser — this is the admin's
  // full-visibility view, narrowed only by the filters below (not by who
  // raised each request, unlike the hospital/blood-bank dashboards).
  useEffect(() => {
    fetchRequests({
      limit,
      bloodGroup: bloodGroupFilter === 'all' ? undefined : bloodGroupFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    });
  }, [fetchRequests, limit, bloodGroupFilter, priorityFilter, statusFilter]);

  async function decideHospital(id: string, decision: 'approve' | 'reject') {
    try {
      await apiPost(`/admin/hospitals/${id}/${decision}`);
      setPendingHospitals((prev) => prev.filter((hospital) => hospital.id !== id));
      toast.success(t(decision === 'approve' ? 'toastHospitalApproved' : 'toastHospitalRejected'));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastHospitalUpdateError')));
    }
  }

  async function decideBloodBank(id: string, decision: 'approve' | 'reject') {
    try {
      await apiPost(`/admin/bloodbanks/${id}/${decision}`);
      setPendingBloodBanks((prev) => prev.filter((bank) => bank.id !== id));
      toast.success(t(decision === 'approve' ? 'toastBloodBankApproved' : 'toastBloodBankRejected'));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastBloodBankUpdateError')));
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
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
          <Card className="gap-3 p-6">
            <span className="text-sm font-medium text-primary">{t('approvalsEyebrow')}</span>
            <h2 className="mb-4 text-lg font-semibold">{t('pendingHospitalsTitle')}</h2>
            <div className="space-y-3">
              {pendingHospitals.length === 0 ? (
                <EmptyState>{t('noPendingHospitals')}</EmptyState>
              ) : (
                pendingHospitals.map((hospital) => (
                  <Card key={hospital.id} className="flex-row items-center justify-between gap-3 p-4">
                    <div>
                      <h4 className="font-semibold">{hospital.hospitalName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('licenseContactLine', { license: hospital.licenseNumber, email: hospital.email })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideHospital(hospital.id, 'approve')}>
                        {t('approveButton')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decideHospital(hospital.id, 'reject')}>
                        {t('rejectButton')}
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>

          <Card className="gap-3 p-6">
            <span className="text-sm font-medium text-primary">{t('approvalsEyebrow')}</span>
            <h2 className="mb-4 text-lg font-semibold">{t('pendingBloodBanksTitle')}</h2>
            <div className="space-y-3">
              {pendingBloodBanks.length === 0 ? (
                <EmptyState>{t('noPendingBloodBanks')}</EmptyState>
              ) : (
                pendingBloodBanks.map((bank) => (
                  <Card key={bank.id} className="flex-row items-center justify-between gap-3 p-4">
                    <div>
                      <h4 className="font-semibold">{bank.bankName}</h4>
                      <p className="text-sm text-muted-foreground">{bank.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideBloodBank(bank.id, 'approve')}>
                        {t('approveButton')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decideBloodBank(bank.id, 'reject')}>
                        {t('rejectButton')}
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <Card className="gap-3 p-6">
          <span className="text-sm font-medium text-primary">{t('adminAlertsEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('adminAlertsTitle')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                </Card>
              ))
            )}
          </div>
        </Card>

        <Card className="gap-3 p-6">
          <span className="text-sm font-medium text-primary">{t('adminActivityEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('adminActivityTitle')}</h2>

          <div className="grid gap-3 sm:grid-cols-4">
            <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECENT_LIMIT_OPTIONS.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {t('recentCountOption', { count })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={bloodGroupFilter} onValueChange={(value) => setBloodGroupFilter(value as BloodGroup | 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allBloodGroupsOption')}</SelectItem>
                {BLOOD_GROUPS.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'pending' | 'completed')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatusesOption')}</SelectItem>
                <SelectItem value="pending">{t('statusPending')}</SelectItem>
                <SelectItem value="completed">{t('statusCompleted')}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(value) => setPriorityFilter(value as RequestPriority | 'all')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allPrioritiesOption')}</SelectItem>
                {REQUEST_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {t(PRIORITY_LABEL_KEYS[priority])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">{t('showingCountLabel', { count: requests.length })}</p>

          <div className="mt-3 grid max-h-[42rem] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {requests.length === 0 ? (
              <EmptyState>{t('adminNoRequests')}</EmptyState>
            ) : (
              requests.map((request) => <HospitalRequestCard key={request.id} request={request} />)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
