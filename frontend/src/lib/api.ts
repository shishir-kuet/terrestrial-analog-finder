import type {
  DatasetCatalog,
  FeatureDef,
  LocationDetail,
  LocationSummary,
  SearchRequest,
  SearchResponse,
  SurveyRegion,
  Target,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError('Cannot reach the analysis server. Is the backend running?', 0);
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg: string }) => d.msg).join('; ');
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string; locations: number; built_at: string }>('/api/health'),
  features: () => request<{ features: FeatureDef[]; scales: Record<string, number> }>('/api/features'),
  targets: (body?: 'moon' | 'mars') =>
    request<{ targets: Target[] }>(`/api/targets${body ? `?body=${body}` : ''}`).then((r) => r.targets),
  earth: () => request<{ count: number; candidates: LocationSummary[] }>('/api/earth-candidates').then((r) => r.candidates),
  regions: () => request<{ regions: SurveyRegion[] }>('/api/regions').then((r) => r.regions),
  location: (id: string) => request<LocationDetail>(`/api/locations/${encodeURIComponent(id)}`),
  datasets: () => request<DatasetCatalog>('/api/datasets'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methodology: () => request<Record<string, any>>('/api/methodology'),
  search: (req: SearchRequest) =>
    request<SearchResponse>('/api/similarity/search', { method: 'POST', body: JSON.stringify(req) }),
};

export const hillshadeUrl = (id: string) => `${BASE}/api/hillshade/${encodeURIComponent(id)}.png`;
