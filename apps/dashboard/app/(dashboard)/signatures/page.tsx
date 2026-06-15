'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  FileSignature,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiClient } from '@/lib/api';

type SignatureStatus = 'PENDING' | 'SIGNED' | 'EXPIRED' | 'DECLINED' | 'CANCELLED';

interface SignatureRequest {
  id: string;
  signerEmail: string;
  signerName: string | null;
  status: SignatureStatus;
  createdAt: string;
  signedAt: string | null;
  expiresAt: string;
  legalStandard: string;
  signedFileKey: string | null;
}

const STATUS_CONFIG: Record<SignatureStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  PENDING: {
    label: 'Pending',
    icon: <Clock className="w-3.5 h-3.5" />,
    classes: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  SIGNED: {
    label: 'Signed',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    classes: 'bg-green-50 text-green-700 border-green-200',
  },
  EXPIRED: {
    label: 'Expired',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    classes: 'bg-slate-50 text-slate-600 border-slate-200',
  },
  DECLINED: {
    label: 'Declined',
    icon: <XCircle className="w-3.5 h-3.5" />,
    classes: 'bg-red-50 text-red-700 border-red-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: <XCircle className="w-3.5 h-3.5" />,
    classes: 'bg-slate-50 text-slate-500 border-slate-200',
  },
};

function StatusBadge({ status }: { status: SignatureStatus }) {
  const { label, icon, classes } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${classes}`}>
      {icon}
      {label}
    </span>
  );
}

export default function SignaturesPage() {
  const { data: session } = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SignatureStatus | 'ALL'>('ALL');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['signatures', page, search, statusFilter, session?.user],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(search && { search }),
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
      });
      const res = await apiClient.get(`/signatures?${params}`);
      return res.data as { signatures: SignatureRequest[]; total: number; pages: number };
    },
    enabled: !!session,
  });

  const signatures = data?.signatures ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Signatures</h1>
          <p className="text-slate-500 mt-1">Manage all your signature requests</p>
        </div>
        <a
          href="/api/signatures/export"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
            text-slate-700 bg-white border border-slate-300 rounded-lg
            hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email or ID…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as SignatureStatus | 'ALL'); setPage(1); }}
            className="pl-9 pr-8 py-2.5 border border-slate-300 rounded-lg text-sm
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            <option value="ALL">All statuses</option>
            {Object.keys(STATUS_CONFIG).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s as SignatureStatus].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
            Failed to load signatures. Please try again.
          </div>
        ) : signatures.length === 0 ? (
          <div className="p-12 text-center">
            <FileSignature className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">No signatures found</p>
            <p className="text-slate-400 text-sm mt-1">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your filters'
                : 'Send your first signature request using the API'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Signer</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Legal Standard</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Sent</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Signed At</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {signatures.map((sig) => (
                <tr key={sig.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-900">{sig.signerName ?? '—'}</div>
                    <div className="text-slate-500 text-xs">{sig.signerEmail}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={sig.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {sig.legalStandard}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {formatDistanceToNow(new Date(sig.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {sig.signedAt
                      ? formatDistanceToNow(new Date(sig.signedAt), { addSuffix: true })
                      : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50
                          rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {sig.signedFileKey && (
                        <a
                          href={`/api/signatures/${sig.id}/download`}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50
                            rounded-lg transition-colors"
                          title="Download signed PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} — {data?.total ?? 0} total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
