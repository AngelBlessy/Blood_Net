import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiGet, apiPost, apiErrorMessage, API_BASE_URL } from '@/lib/api';
import type { AdminUserListItem, ManageableRole, UserAccountStatus } from '@/types/domain';

const SEARCH_DEBOUNCE_MS = 350;

// What the table actually shows and acts on -- a single merged status per
// row, so a hospital/bloodbank awaiting approval reads as "Pending" instead
// of the misleading "Active" that user.status alone would show (that field
// only tracks OTP verification, not admin approval).
type EffectiveStatus = 'active' | 'pending' | 'rejected' | 'suspended';

function effectiveStatus(user: AdminUserListItem): EffectiveStatus {
  if (user.status === 'suspended') return 'suspended';
  if (user.approvalStatus === 'pending') return 'pending';
  if (user.approvalStatus === 'rejected') return 'rejected';
  // Approved hospital/bloodbank, or a donor (no approval workflow at all) --
  // fall back to the raw account status (active, or pending OTP verification).
  return user.status;
}

const ROLE_LABEL_KEYS: Record<ManageableRole, 'usersRoleDonor' | 'usersRoleHospital' | 'usersRoleBloodBank'> = {
  donor: 'usersRoleDonor',
  hospital: 'usersRoleHospital',
  bloodbank: 'usersRoleBloodBank',
};

const STATUS_LABEL_KEYS: Record<
  EffectiveStatus,
  'usersStatusActive' | 'usersStatusPending' | 'usersStatusSuspended' | 'statusRejected'
> = {
  active: 'usersStatusActive',
  pending: 'usersStatusPending',
  suspended: 'usersStatusSuspended',
  rejected: 'statusRejected',
};

function StatusBadge({ status }: { status: EffectiveStatus }) {
  const { t } = useTranslation();
  if (status === 'active') {
    return (
      <Badge variant="outline" className="border-success/40 text-success">
        {t(STATUS_LABEL_KEYS[status])}
      </Badge>
    );
  }
  if (status === 'suspended' || status === 'rejected') {
    return <Badge variant="destructive">{t(STATUS_LABEL_KEYS[status])}</Badge>;
  }
  return <Badge variant="secondary">{t(STATUS_LABEL_KEYS[status])}</Badge>;
}

interface RejectTarget {
  id: string;
  name: string;
  role: 'hospital' | 'bloodbank';
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState<ManageableRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserAccountStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<AdminUserListItem | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);

  // Debounce the search box so every keystroke doesn't fire a request.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const refresh = useCallback(() => {
    const params = new URLSearchParams();
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);

    apiGet<{ users: AdminUserListItem[]; total: number }>(`/admin/users?${params.toString()}`)
      .then((data) => {
        setUsers(data.users);
        setTotal(data.total);
      })
      .catch((error) => toast.error(apiErrorMessage(error, t('usersLoadError'))));
  }, [roleFilter, statusFilter, search, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function reactivateUser(user: AdminUserListItem) {
    setPendingId(user.id);
    try {
      await apiPost(`/admin/users/${user.id}/activate`);
      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === user.id
            ? { ...entry, status: 'active', reactivationRequestedAt: null, suspensionReason: null }
            : entry
        )
      );
      toast.success(t('usersReactivatedToast', { name: user.name || user.email }));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('usersUpdateError')));
    } finally {
      setPendingId(null);
    }
  }

  function openSuspendDialog(user: AdminUserListItem) {
    setSuspendTarget(user);
    setSuspendReason('');
  }

  async function confirmSuspend() {
    if (!suspendTarget || !suspendReason.trim()) return;
    setSuspendSubmitting(true);
    try {
      await apiPost(`/admin/users/${suspendTarget.id}/suspend`, { reason: suspendReason.trim() });
      toast.success(t('usersSuspendedToast', { name: suspendTarget.name || suspendTarget.email }));
      setSuspendTarget(null);
      refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('usersUpdateError')));
    } finally {
      setSuspendSubmitting(false);
    }
  }

  function approvalEndpoint(role: 'hospital' | 'bloodbank') {
    return role === 'hospital' ? 'hospitals' : 'bloodbanks';
  }

  async function approveUser(user: AdminUserListItem) {
    if (user.role === 'donor') return;
    if (!user.approvalId) {
      toast.error(t('usersMissingProfileError'));
      return;
    }
    setPendingId(user.id);
    try {
      await apiPost(`/admin/${approvalEndpoint(user.role)}/${user.approvalId}/approve`);
      toast.success(t('usersApprovedToast', { name: user.name || user.email }));
      refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('usersUpdateError')));
    } finally {
      setPendingId(null);
    }
  }

  function openRejectDialog(user: AdminUserListItem) {
    if (user.role === 'donor') return;
    if (!user.approvalId) {
      toast.error(t('usersMissingProfileError'));
      return;
    }
    setRejectTarget({ id: user.approvalId, name: user.name || user.email, role: user.role });
    setRejectReason('');
  }

  async function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejectSubmitting(true);
    try {
      await apiPost(`/admin/${approvalEndpoint(rejectTarget.role)}/${rejectTarget.id}/reject`, {
        reason: rejectReason.trim(),
      });
      toast.success(t('usersRejectedToast', { name: rejectTarget.name }));
      setRejectTarget(null);
      refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('usersUpdateError')));
    } finally {
      setRejectSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader eyebrow={t('usersEyebrow')} title={t('usersTitle')} description={t('usersDesc')} />

      <Card className="mt-6 gap-4 p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            placeholder={t('usersSearchPlaceholder')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="sm:col-span-2"
          />
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as ManageableRole | 'all')}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('usersAllRolesOption')}</SelectItem>
              <SelectItem value="donor">{t('usersRoleDonor')}</SelectItem>
              <SelectItem value="hospital">{t('usersRoleHospital')}</SelectItem>
              <SelectItem value="bloodbank">{t('usersRoleBloodBank')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as UserAccountStatus | 'all')}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('usersAllStatusesOption')}</SelectItem>
              <SelectItem value="active">{t('usersStatusActive')}</SelectItem>
              <SelectItem value="pending">{t('usersStatusPending')}</SelectItem>
              <SelectItem value="suspended">{t('usersStatusSuspended')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">{t('usersShowingCount', { count: users.length, total })}</p>

        {users.length === 0 ? (
          <EmptyState>{t('usersEmpty')}</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('usersColName')}</TableHead>
                <TableHead>{t('usersColRole')}</TableHead>
                <TableHead>{t('usersColContact')}</TableHead>
                <TableHead>{t('usersColCity')}</TableHead>
                <TableHead>{t('usersColStatus')}</TableHead>
                <TableHead className="text-right">{t('usersColAction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const status = effectiveStatus(user);
                const isApprovalRole = user.role === 'hospital' || user.role === 'bloodbank';
                return (
                  <TableRow key={user.id}>
                    <TableCell className="max-w-40 truncate font-medium">{user.name || '—'}</TableCell>
                    <TableCell>{t(ROLE_LABEL_KEYS[user.role])}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{user.email}</div>
                      <div>{user.phone}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.city || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={status} />
                        {status === 'rejected' && user.rejectionReason && (
                          <span className="max-w-48 text-xs text-muted-foreground">{user.rejectionReason}</span>
                        )}
                        {status === 'suspended' && user.suspensionReason && (
                          <span className="max-w-48 text-xs text-muted-foreground">{user.suspensionReason}</span>
                        )}
                        {isApprovalRole &&
                          user.approvalId &&
                          (user.licenseDocument ? (
                            <a
                              href={`${API_BASE_URL}/api/admin/${approvalEndpoint(user.role as 'hospital' | 'bloodbank')}/${user.approvalId}/license-document`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary underline underline-offset-2"
                            >
                              {t('viewDocumentLink')}
                            </a>
                          ) : (
                            <span className="text-xs text-destructive">{t('noDocumentUploadedLabel')}</span>
                          ))}
                        {user.reactivationRequestedAt && (
                          <span className="text-xs font-medium text-primary">
                            {t('usersReactivationRequestedLabel', {
                              date: new Date(user.reactivationRequestedAt).toLocaleString(),
                            })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isApprovalRole && status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" disabled={pendingId === user.id} onClick={() => approveUser(user)}>
                            {t('approveButton')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingId === user.id}
                            onClick={() => openRejectDialog(user)}
                          >
                            {t('rejectButton')}
                          </Button>
                        </div>
                      ) : isApprovalRole && status === 'rejected' ? (
                        <Button size="sm" disabled={pendingId === user.id} onClick={() => approveUser(user)}>
                          {t('approveButton')}
                        </Button>
                      ) : status === 'suspended' ? (
                        <Button size="sm" disabled={pendingId === user.id} onClick={() => reactivateUser(user)}>
                          {t('usersReactivateButton')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === user.id}
                          onClick={() => openSuspendDialog(user)}
                        >
                          {t('usersSuspendButton')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

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
            <Button variant="destructive" disabled={!rejectReason.trim() || rejectSubmitting} onClick={confirmReject}>
              {rejectSubmitting ? t('savingEllipsis') : t('confirmRejectButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('suspendAccountTitle', { name: suspendTarget?.name || suspendTarget?.email || '' })}</DialogTitle>
            <DialogDescription>{t('suspendAccountDesc')}</DialogDescription>
          </DialogHeader>

          {suspendTarget && (
            <div className="space-y-1 rounded-md border p-3 text-sm text-muted-foreground">
              <div>
                {t('usersColRole')}: {t(ROLE_LABEL_KEYS[suspendTarget.role])}
              </div>
              <div>{suspendTarget.email}</div>
              <div>{suspendTarget.phone}</div>
              {suspendTarget.city && <div>{suspendTarget.city}</div>}
              {(suspendTarget.role === 'hospital' || suspendTarget.role === 'bloodbank') &&
                suspendTarget.approvalId &&
                (suspendTarget.licenseDocument ? (
                  <a
                    href={`${API_BASE_URL}/api/admin/${approvalEndpoint(suspendTarget.role)}/${suspendTarget.approvalId}/license-document`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-primary underline underline-offset-2"
                  >
                    {t('viewDocumentLink')}
                  </a>
                ) : (
                  <div className="text-destructive">{t('noDocumentUploadedLabel')}</div>
                ))}
            </div>
          )}

          <Textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder={t('suspendReasonPlaceholder')}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              {t('cancelButton')}
            </Button>
            <Button variant="destructive" disabled={!suspendReason.trim() || suspendSubmitting} onClick={confirmSuspend}>
              {suspendSubmitting ? t('savingEllipsis') : t('confirmSuspendButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
