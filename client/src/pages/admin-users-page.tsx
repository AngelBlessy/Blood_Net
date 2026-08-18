import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiGet, apiPost, apiErrorMessage } from '@/lib/api';
import type { AdminUserListItem, ManageableRole, UserAccountStatus } from '@/types/domain';

const SEARCH_DEBOUNCE_MS = 350;

const ROLE_LABEL_KEYS: Record<ManageableRole, 'usersRoleDonor' | 'usersRoleHospital' | 'usersRoleBloodBank'> = {
  donor: 'usersRoleDonor',
  hospital: 'usersRoleHospital',
  bloodbank: 'usersRoleBloodBank',
};

const STATUS_LABEL_KEYS: Record<UserAccountStatus, 'usersStatusActive' | 'usersStatusPending' | 'usersStatusSuspended'> = {
  active: 'usersStatusActive',
  pending: 'usersStatusPending',
  suspended: 'usersStatusSuspended',
};

function StatusBadge({ status }: { status: UserAccountStatus }) {
  const { t } = useTranslation();
  if (status === 'active') {
    return (
      <Badge variant="outline" className="border-success/40 text-success">
        {t(STATUS_LABEL_KEYS[status])}
      </Badge>
    );
  }
  if (status === 'suspended') {
    return <Badge variant="destructive">{t(STATUS_LABEL_KEYS[status])}</Badge>;
  }
  return <Badge variant="secondary">{t(STATUS_LABEL_KEYS[status])}</Badge>;
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

  async function toggleStatus(user: AdminUserListItem) {
    const action = user.status === 'suspended' ? 'activate' : 'suspend';
    setPendingId(user.id);
    try {
      await apiPost(`/admin/users/${user.id}/${action}`);
      setUsers((prev) => prev.map((entry) => (entry.id === user.id ? { ...entry, status: action === 'suspend' ? 'suspended' : 'active' } : entry)));
      toast.success(t(action === 'suspend' ? 'usersSuspendedToast' : 'usersReactivatedToast', { name: user.name || user.email }));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('usersUpdateError')));
    } finally {
      setPendingId(null);
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
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="max-w-40 truncate font-medium">{user.name || '—'}</TableCell>
                  <TableCell>{t(ROLE_LABEL_KEYS[user.role])}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{user.email}</div>
                    <div>{user.phone}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.city || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={user.status === 'suspended' ? 'default' : 'outline'}
                      disabled={pendingId === user.id}
                      onClick={() => toggleStatus(user)}
                    >
                      {t(user.status === 'suspended' ? 'usersReactivateButton' : 'usersSuspendButton')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
