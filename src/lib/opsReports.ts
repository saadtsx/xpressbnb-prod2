import { supabase } from './supabase';

export type OpsPropertyReport = {
  id: string;
  property_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

const SELECT = 'id, property_id, reason, details, status, created_at';

/** Admin-only (RLS): recent reports, newest first. Returns [] for non-admins. */
export async function fetchRecentPropertyReports(limit = 30): Promise<OpsPropertyReport[]> {
  const { data, error } = await supabase
    .from('property_reports')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as OpsPropertyReport[];
}

/** Live feed of new reports for an Ops session. Returns an unsubscribe fn. */
export function subscribeToPropertyReports(onInsert: (row: OpsPropertyReport) => void): () => void {
  const channel = supabase
    .channel('ops-property-reports')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'property_reports' },
      (payload) => onInsert(payload.new as OpsPropertyReport),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
