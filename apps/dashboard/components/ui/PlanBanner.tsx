import Link from 'next/link';
import { Zap, ArrowRight } from 'lucide-react';

interface PlanBannerProps {
  used: number;
  limit: number;
}

export function PlanBanner({ used, limit }: PlanBannerProps) {
  const remaining = limit - used;
  const isAlmostOut = remaining <= 3;

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border
        ${isAlmostOut
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
        }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
        ${isAlmostOut ? 'bg-red-100' : 'bg-amber-100'}`}>
        <Zap className={`w-5 h-5 ${isAlmostOut ? 'text-red-600' : 'text-amber-600'}`} />
      </div>

      <div className="flex-1">
        <p className={`text-sm font-medium ${isAlmostOut ? 'text-red-800' : 'text-amber-800'}`}>
          {isAlmostOut
            ? `Only ${remaining} free signature${remaining !== 1 ? 's' : ''} remaining this month`
            : `${remaining} of ${limit} free signatures remaining this month`}
        </p>
        <p className={`text-xs mt-0.5 ${isAlmostOut ? 'text-red-600' : 'text-amber-600'}`}>
          Upgrade to Pro for unlimited signatures — $22/month
        </p>
      </div>

      <Link
        href="/billing"
        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg
          transition-colors flex-shrink-0
          ${isAlmostOut
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
      >
        Upgrade
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
