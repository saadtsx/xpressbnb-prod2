import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import {
  fetchRecentPropertyReports,
  subscribeToPropertyReports,
  type OpsPropertyReport,
} from '../../lib/opsReports';
import { REPORT_REASONS } from '../../lib/propertyReport';

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

/** Live guest reports for the Ops session (admin-only via RLS; realtime INSERT feed). */
export default function OpsLiveReports({ titleById }: { titleById: Record<string, string> }) {
  const [reports, setReports] = useState<OpsPropertyReport[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchRecentPropertyReports().then((rows) => {
      if (!cancelled) setReports(rows);
    });
    const unsubscribe = subscribeToPropertyReports((row) =>
      setReports((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, 50))),
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <Flag className="w-5 h-5 text-red-600" />
        Guest reports <span className="text-xs font-semibold text-emerald-700">● live</span>
      </h2>
      {reports.length === 0 ? (
        <p className="text-sm text-slate-500">No reports yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {reports.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <p className="font-semibold text-slate-900">
                {titleById[r.property_id] ?? r.property_id} · {reasonLabel(r.reason)}
              </p>
              {r.details && <p className="mt-0.5 text-slate-600">{r.details}</p>}
              <p className="mt-0.5 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
