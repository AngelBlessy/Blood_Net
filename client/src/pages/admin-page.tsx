import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HospitalRequestCard } from '@/components/hospital/hospital-request-card';
import { useHospitalRequestsStore } from '@/store/hospital-requests-store';
import { apiGet, apiPost, apiErrorMessage, API_BASE_URL } from '@/lib/api';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { PRIORITY_LABEL_KEYS } from '@/lib/request-labels';
import type { AdminStats, BloodGroup, RequestPriority } from '@/types/domain';

const REQUEST_PRIORITIES: RequestPriority[] = ['Critical', 'Urgent', 'Routine'];
const RECENT_LIMIT_OPTIONS = [10, 20, 50, 100];

interface LicenseDocument {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface PendingHospital {
  id: string;
  hospitalName: string;
  licenseNumber: string;
  licenseDocument: LicenseDocument | null;
  city?: string;
  email?: string;
  phone?: string;
}

interface PendingBloodBank {
  id: string;
  bankName: string;
  licenseNumber: string;
  licenseDocument: LicenseDocument | null;
  city?: string;
  email?: string;
  phone?: string;
}

interface ApprovalDecisionEntry {
  id: string;
  role: 'hospital' | 'bloodbank';
  entityName: string;
  decision: 'approved' | 'rejected';
  reason: string | null;
  decidedByEmail: string;
  createdAt: string;
}

interface RejectTarget {
  type: 'hospital' | 'bloodbank';
  id: string;
  name: string;
}

export function AdminPage() {
  const { t } = useTranslation();
  const requests = useHospitalRequestsStore((state) => state.requests);
  const fetchRequests = useHospitalRequestsStore((state) => state.fetchRequests);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingHospitals, setPendingHospitals] = useState<PendingHospital[]>([]);
  const [pendingBloodBanks, setPendingBloodBanks] = useState<PendingBloodBank[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalDecisionEntry[]>([]);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [limit, setLimit] = useState(20);
  const [bloodGroupFilter, setBloodGroupFilter] = useState<BloodGroup | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | 'all'>('all');

  async function refresh() {
    const [statsData, hospitalsData, banksData, historyData] = await Promise.all([
      apiGet<AdminStats>('/admin/stats'),
      apiGet<{ hospitals: PendingHospital[] }>('/admin/hospitals/pending'),
      apiGet<{ bloodBanks: PendingBloodBank[] }>('/admin/bloodbanks/pending'),
      apiGet<{ decisions: ApprovalDecisionEntry[] }>('/admin/approval-history'),
    ]);
    setStats(statsData);
    setPendingHospitals(hospitalsData.hospitals);
    setPendingBloodBanks(banksData.bloodBanks);
    setApprovalHistory(historyData.decisions);
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

  async function decideHospital(id: string, decision: 'approve' | 'reject', reason?: string) {
    try {
      await apiPost(`/admin/hospitals/${id}/${decision}`, reason ? { reason } : undefined);
      setPendingHospitals((prev) => prev.filter((hospital) => hospital.id !== id));
      toast.success(t(decision === 'approve' ? 'toastHospitalApproved' : 'toastHospitalRejected'));
      refresh().catch(() => {});
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastHospitalUpdateError')));
    }
  }

  async function decideBloodBank(id: string, decision: 'approve' | 'reject', reason?: string) {
    try {
      await apiPost(`/admin/bloodbanks/${id}/${decision}`, reason ? { reason } : undefined);
      setPendingBloodBanks((prev) => prev.filter((bank) => bank.id !== id));
      toast.success(t(decision === 'approve' ? 'toastBloodBankApproved' : 'toastBloodBankRejected'));
      refresh().catch(() => {});
    } catch (error) {
      toast.error(apiErrorMessage(error, t('toastBloodBankUpdateError')));
    }
  }

  function openRejectDialog(target: RejectTarget) {
    setRejectTarget(target);
    setRejectReason('');
  }

  async function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejectSubmitting(true);
    if (rejectTarget.type === 'hospital') {
      await decideHospital(rejectTarget.id, 'reject', rejectReason.trim());
    } else {
      await decideBloodBank(rejectTarget.id, 'reject', rejectReason.trim());
    }
    setRejectSubmitting(false);
    setRejectTarget(null);
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
                      {hospital.licenseDocument ? (
                        <a
                          href={`${API_BASE_URL}/api/admin/hospitals/${hospital.id}/license-document`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary underline underline-offset-2"
                        >
                          {t('viewDocumentLink')}
                        </a>
                      ) : (
                        <p className="text-sm text-destructive">{t('noDocumentUploadedLabel')}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideHospital(hospital.id, 'approve')}>
                        {t('approveButton')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectDialog({ type: 'hospital', id: hospital.id, name: hospital.hospitalName })}
                      >
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
                      <p className="text-sm text-muted-foreground">
                        {t('licenseContactLine', { license: bank.licenseNumber, email: bank.email })}
                      </p>
                      {bank.licenseDocument ? (
                        <a
                          href={`${API_BASE_URL}/api/admin/bloodbanks/${bank.id}/license-document`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary underline underline-offset-2"
                        >
                          {t('viewDocumentLink')}
                        </a>
                      ) : (
                        <p className="text-sm text-destructive">{t('noDocumentUploadedLabel')}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideBloodBank(bank.id, 'approve')}>
                        {t('approveButton')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectDialog({ type: 'bloodbank', id: bank.id, name: bank.bankName })}
                      >
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

        <Card className="gap-3 p-6">
          <span className="text-sm font-medium text-primary">{t('approvalsEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('approvalHistoryTitle')}</h2>
          {approvalHistory.length === 0 ? (
            <EmptyState>{t('noApprovalHistory')}</EmptyState>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t('approvalHistoryDateHeader')}</th>
                    <th className="pb-2 pr-3 font-medium">{t('approvalHistoryEntityHeader')}</th>
                    <th className="pb-2 pr-3 font-medium">{t('approvalHistoryDecisionHeader')}</th>
                    <th className="pb-2 pr-3 font-medium">{t('approvalHistoryReasonHeader')}</th>
                    <th className="pb-2 font-medium">{t('approvalHistoryAdminHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalHistory.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        {entry.entityName}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t(entry.role === 'hospital' ? 'profileRoleHospital' : 'profileRoleBloodbank')})
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={entry.decision === 'approved' ? 'default' : 'destructive'}>
                          {t(entry.decision === 'approved' ? 'statusApproved' : 'statusRejected')}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{entry.reason || '—'}</td>
                      <td className="py-2 text-muted-foreground">{entry.decidedByEmail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('rejectAccountTitle', { name: rejectTarget?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('rejectAccountDesc')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('rejectReasonPlaceholder')}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {t('cancelButton')}
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectSubmitting}
              onClick={confirmReject}
            >
              {rejectSubmitting ? t('savingEllipsis') : t('confirmRejectButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
