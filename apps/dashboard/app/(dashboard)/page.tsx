import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { StatsCards } from '@/components/ui/StatsCards';
import { RecentSignatures } from '@/components/ui/RecentSignatures';
import { UsageChart } from '@/components/ui/UsageChart';
import { PlanBanner } from '@/components/ui/PlanBanner';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Overview',
};

async function getDashboardData(userId: string) {
  try {
    const [stats, recent] = await Promise.all([
      apiClient.get(`/users/${userId}/stats`),
      apiClient.get(`/signatures?limit=5&userId=${userId}`),
    ]);
    return { stats: stats.data, recent: recent.data };
  } catch {
    return {
      stats: {
        totalSignatures: 0,
        monthlyUsed: 0,
        monthlyLimit: 20,
        pendingSignatures: 0,
        completedSignatures: 0,
        plan: 'FREE',
      },
      recent: { signatures: [] },
    };
  }
}

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id ?? '';
  const { stats, recent } = await getDashboardData(userId);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-slate-500 mt-1">
          Welcome back, {session?.user?.name ?? 'there'} — here&apos;s your signature activity.
        </p>
      </div>

      {/* Free plan upsell banner */}
      {stats.plan === 'FREE' && (
        <PlanBanner used={stats.monthlyUsed} limit={stats.monthlyLimit} />
      )}

      {/* KPI cards */}
      <Suspense fallback={<StatsCards.Skeleton />}>
        <StatsCards
          totalSignatures={stats.totalSignatures}
          monthlyUsed={stats.monthlyUsed}
          monthlyLimit={stats.monthlyLimit}
          pendingSignatures={stats.pendingSignatures}
          completedSignatures={stats.completedSignatures}
        />
      </Suspense>

      {/* Charts + recent table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-80 bg-white rounded-xl animate-pulse" />}>
            <UsageChart userId={userId} />
          </Suspense>
        </div>

        <div>
          <Suspense fallback={<div className="h-80 bg-white rounded-xl animate-pulse" />}>
            <RecentSignatures signatures={recent.signatures} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
