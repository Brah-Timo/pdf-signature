import {
  FileSignature,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

interface StatsCardsProps {
  totalSignatures: number;
  monthlyUsed: number;
  monthlyLimit: number;
  pendingSignatures: number;
  completedSignatures: number;
}

function StatCard({
  title,
  value,
  sub,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full
              ${trend.value >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
          >
            <TrendingUp className="w-3 h-3" />
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
        <p className="text-sm text-slate-500 mt-0.5">{title}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
          <div className="w-10 h-10 bg-slate-100 rounded-xl" />
          <div className="mt-3 space-y-2">
            <div className="h-7 bg-slate-100 rounded w-16" />
            <div className="h-4 bg-slate-100 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsCards({
  totalSignatures,
  monthlyUsed,
  monthlyLimit,
  pendingSignatures,
  completedSignatures,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total signatures"
        value={totalSignatures}
        icon={<FileSignature className="w-5 h-5 text-blue-600" />}
        trend={{ value: 12, label: 'vs last month' }}
      />
      <StatCard
        title="This month"
        value={monthlyUsed}
        sub={`of ${monthlyLimit} limit`}
        icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
      />
      <StatCard
        title="Pending"
        value={pendingSignatures}
        sub="awaiting signature"
        icon={<Clock className="w-5 h-5 text-amber-500" />}
      />
      <StatCard
        title="Completed"
        value={completedSignatures}
        sub="all time"
        icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
        trend={{ value: 8, label: 'vs last month' }}
      />
    </div>
  );
}

StatsCards.Skeleton = Skeleton;
