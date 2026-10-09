import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('turns network failures into a readable ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.health()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Cannot reach') });
  });
  it('surfaces FastAPI error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'all feature weights are zero' }), { status: 422 })));
    const err = await api.search({ target_id: 't', weights: {}, candidate_kinds: ['earth_named'], min_coverage: 1, missing_penalty: 3, limit: 5 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.message).toBe('all feature weights are zero');
  });
  it('joins pydantic validation messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ msg: 'a' }, { msg: 'b' }] }), { status: 422 })));
    await expect(api.targets()).rejects.toThrow('a; b');
  });
  it('posts search requests as JSON', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"results":[]}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await api.search({ target_id: 't', weights: { a: 1 }, candidate_kinds: ['earth_named'], min_coverage: 1, missing_penalty: 3, limit: 5 });
    expect(f.mock.calls[0][0]).toBe('/api/similarity/search');
    expect(JSON.parse(f.mock.calls[0][1].body).weights).toEqual({ a: 1 });
  });
});
