'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Users,
  Building2,
  ArrowRight,
  Loader2,
  Receipt,
  CalendarDays,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface BillingInfo {
  plan: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
  monthlyUsed: number;
  monthlyLimit: number;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  cancelAtPeriodEnd: boolean;
}

const PLANS = [
  {
    id: 'FREE' as const,
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out pdf-signature',
    limit: '20 signatures/month',
    icon: <Zap className="w-5 h-5" />,
    color: 'slate',
    features: [
      '20 signatures per month',
      'eIDAS basic compliance',
      'Audit trail',
      'Email delivery',
      '30-day document storage',
    ],
    cta: 'Current plan',
    disabled: true,
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    price: '$22',
    period: '/month',
    description: 'For developers and growing businesses',
    limit: 'Unlimited signatures',
    icon: <CreditCard className="w-5 h-5" />,
    color: 'blue',
    features: [
      'Unlimited signatures',
      'eIDAS AdES-B-LT compliance',
      'Multi-signer workflows',
      'Webhook notifications',
      'Branded signing page',
      'Audit trail PDF export',
      '5-year document storage',
      'Priority email support',
      'Analytics dashboard',
      'SMS notifications',
    ],
    cta: 'Upgrade to Pro',
    disabled: false,
    popular: true,
  },
  {
    id: 'TEAM' as const,
    name: 'Team',
    price: '$99',
    period: '/month',
    description: 'For teams that need more control',
    limit: 'Unlimited + 10 seats',
    icon: <Users className="w-5 h-5" />,
    color: 'violet',
    features: [
      'Everything in Pro',
      'Up to 10 team members',
      'Template library',
      'Bulk signing',
      'SSO / SAML',
      'Dedicated support',
      'SLA 99.9%',
    ],
    cta: 'Coming soon',
    disabled: true,
    comingSoon: true,
  },
  {
    id: 'ENTERPRISE' as const,
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For organisations with special requirements',
    limit: 'Custom volume',
    icon: <Building2 className="w-5 h-5" />,
    color: 'slate',
    features: [
      'Everything in Team',
      'Self-hosted option',
      'Custom CA certificate',
      'QES level (HSM)',
      'Compliance reporting',
      'Custom SLA & DPA',
    ],
    cta: 'Contact sales',
    disabled: false,
  },
] as const;

export default function BillingPage() {
  const { data: session } = useSession();

  const { data: billing, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: async () => {
      const res = await apiClient.get('/billing');
      return res.data as BillingInfo;
    },
    enabled: !!session,
  });

  const upgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiClient.post('/billing/checkout', { plan: planId });
      return res.data as { url: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/billing/portal');
      return res.data as { url: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const currentPlan = billing?.plan ?? 'FREE';
  const usagePercent = billing
    ? Math.min(100, Math.round((billing.monthlyUsed / (billing.monthlyLimit || 20)) * 100))
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing & Plans</h1>
        <p className="text-slate-500 mt-1">Manage your subscription and usage</p>
      </div>

      {/* Current usage */}
      {!isLoading && billing && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Current period usage</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {currentPlan === 'PRO'
                  ? 'Unlimited — no usage cap on Pro plan'
                  : `${billing.monthlyUsed} of ${billing.monthlyLimit} signatures used this month`}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700
              text-sm font-medium rounded-full border border-blue-200">
              <Zap className="w-3.5 h-3.5" />
              {currentPlan}
            </span>
          </div>

          {currentPlan === 'FREE' && (
            <>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {billing.monthlyLimit - billing.monthlyUsed} signatures remaining this month
              </p>
            </>
          )}

          {billing.currentPeriodEnd && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500">
              <CalendarDays className="w-4 h-4" />
              <span>
                {billing.cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}{' '}
                {new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            </div>
          )}

          {billing.stripeCustomerId && (
            <button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600
                hover:text-blue-700 font-medium"
            >
              {portalMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Receipt className="w-4 h-4" />
              )}
              Manage billing &amp; invoices
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-4">Choose your plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isPro = plan.id === 'PRO';

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-xl border-2 p-5 shadow-sm flex flex-col
                  ${isPro
                    ? 'border-blue-500 ring-4 ring-blue-100'
                    : isCurrentPlan
                    ? 'border-slate-300'
                    : 'border-slate-200 hover:border-slate-300'
                  } transition-all`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                      Most popular
                    </span>
                  </div>
                )}

                {'comingSoon' in plan && plan.comingSoon && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-violet-600 text-white text-xs font-semibold rounded-full">
                      Coming soon
                    </span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4
                  ${isPro ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {plan.icon}
                </div>

                <h3 className="font-bold text-slate-900">{plan.name}</h3>
                <p className="text-slate-500 text-xs mt-0.5 mb-3">{plan.description}</p>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (plan.id === 'PRO' && !isCurrentPlan) {
                      upgradeMutation.mutate(plan.id);
                    } else if (plan.id === 'ENTERPRISE') {
                      window.location.href = 'mailto:enterprise@pdf-signature.dev';
                    }
                  }}
                  disabled={
                    isCurrentPlan ||
                    ('comingSoon' in plan && plan.comingSoon === true) ||
                    upgradeMutation.isPending
                  }
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4
                    text-sm font-medium rounded-lg transition-colors
                    ${isCurrentPlan
                      ? 'bg-slate-100 text-slate-500 cursor-default'
                      : isPro
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {upgradeMutation.isPending && plan.id === 'PRO' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {plan.cta}
                  {!isCurrentPlan && !('comingSoon' in plan && plan.comingSoon) && (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
