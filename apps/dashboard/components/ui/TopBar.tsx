'use client';

import { Bell, Search } from 'lucide-react';

interface TopBarProps {
  user?: { name?: string | null; email?: string | null };
}

export function TopBar({ user: _user }: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search signatures, keys…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
        />
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
        </button>

        <a
          href="https://docs.pdf-signature.dev/quickstart"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100
            rounded-lg transition-colors border border-blue-200"
        >
          Quick start guide →
        </a>
      </div>
    </header>
  );
}
