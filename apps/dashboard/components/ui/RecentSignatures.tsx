import { formatDistanceToNow } from 'date-fns';
import { FileSignature, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Signature {
  id: string;
  signerEmail: string;
  status: 'PENDING' | 'SIGNED' | 'EXPIRED' | 'DECLINED';
  createdAt: string;
}

export function RecentSignatures({ signatures }: { signatures: Signature[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-full">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
        <Link href="/signatures" className="text-xs text-blue-600 hover:underline">
          View all →
        </Link>
      </div>

      <div className="divide-y divide-slate-100">
        {signatures.length === 0 ? (
          <div className="p-8 text-center">
            <FileSignature className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            <p className="text-sm text-slate-400">No signatures yet</p>
          </div>
        ) : (
          signatures.map((sig) => (
            <div key={sig.id} className="px-5 py-3.5 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${sig.status === 'SIGNED' ? 'bg-green-50'
                : sig.status === 'PENDING' ? 'bg-amber-50'
                : 'bg-slate-50'}`}
              >
                {sig.status === 'SIGNED' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : sig.status === 'PENDING' ? (
                  <Clock className="w-4 h-4 text-amber-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{sig.signerEmail}</p>
                <p className="text-xs text-slate-400">
                  {formatDistanceToNow(new Date(sig.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
