const BASE = import.meta.env.VITE_API_BASE || '/api';

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('stp_admin_token');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = await res.json();
        detail = j.message || detail;
      } catch { /* non-JSON */ }
      throw new Error(`Admin API ${path} → ${res.status}: ${detail}`);
    }

    const text = await res.text();
    try {
      return text ? (JSON.parse(text) as T) : (null as unknown as T);
    } catch {
      return text as unknown as T;
    }
  } finally {
    clearTimeout(timeout);
  }
}

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}
const unwrap = <T>(p: Promise<Envelope<T>>): Promise<T> => p.then((e) => e.data);

export const adminApi = {
  login: (username: string, password: string) =>
    unwrap<{ token: string; username: string; role: string }>(
      adminRequest(`/admin/login`, { method: 'POST', body: JSON.stringify({ username, password }) })
    ),

  getOverview: () => unwrap<any>(adminRequest('/admin/overview')),
  getPlayers: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return unwrap<any>(adminRequest(`/admin/players${qs}`));
  },
  getPlayerProfile: (playerId: string) => unwrap<any>(adminRequest(`/admin/players/${playerId}`)),
  getStimuli: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return unwrap<any>(adminRequest(`/admin/stimuli${qs}`));
  },
  updateStimulusStatus: (stimulusId: string, status: string) =>
    unwrap<any>(adminRequest(`/admin/stimuli/${stimulusId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })),
  bulkUpdateStatus: (stimulusIds: string[], status: string) =>
    unwrap<any>(adminRequest('/admin/stimuli/bulk-status', { method: 'POST', body: JSON.stringify({ stimulusIds, status }) })),
  setAllStatus: (status: string) =>
    unwrap<any>(adminRequest('/admin/stimuli/all-status', { method: 'POST', body: JSON.stringify({ status }) })),
  getGameAnalytics: () => unwrap<any>(adminRequest('/admin/analytics/games')),
  getStimulusAnalytics: () => unwrap<any>(adminRequest('/admin/analytics/stimuli')),
  getActivity: (limit?: number) => unwrap<any>(adminRequest(`/admin/activity${limit ? `?limit=${limit}` : ''}`)),
  getLeaderboard: () => unwrap<any>(adminRequest('/admin/leaderboard')),
  getHealth: () => unwrap<any>(adminRequest('/admin/health')),
  getLearningInsights: () => unwrap<any>(adminRequest('/admin/learning-insights')),

  // Full Stimuli CRUD
  getFullStimuli: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return unwrap<{ stimuli: any[]; total: number }>(adminRequest(`/admin/stimuli/full${qs}`));
  },
  getFullStimulus: (stimulusId: string) => unwrap<any>(adminRequest(`/admin/stimuli/full/${stimulusId}`)),
  updateFullStimulus: (stimulusId: string, body: Record<string, unknown>) =>
    unwrap<any>(adminRequest(`/admin/stimuli/full/${stimulusId}`, { method: 'PUT', body: JSON.stringify(body) })),

  exportCsv: async (type: string): Promise<void> => {
    const token = localStorage.getItem('stp_admin_token');
    const res = await fetch(`${BASE}/admin/export/${type}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
