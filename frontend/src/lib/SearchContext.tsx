/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { SearchRequest, SearchResponse } from './types';

interface SearchState {
  body: 'moon' | 'mars';
  setBody: (b: 'moon' | 'mars') => void;
  targetId: string | null;
  setTargetId: (id: string | null) => void;
  lastRequest: SearchRequest | null;
  lastResponse: SearchResponse | null;
  setResult: (req: SearchRequest, res: SearchResponse) => void;
  clearResult: () => void;
  compareIds: string[];
  toggleCompare: (id: string) => void;
}

const Ctx = createContext<SearchState | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [body, setBody] = useState<'moon' | 'mars'>('moon');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [lastRequest, setReq] = useState<SearchRequest | null>(null);
  const [lastResponse, setRes] = useState<SearchResponse | null>(null);
  const [compareIds, setCompare] = useState<string[]>([]);
  return (
    <Ctx.Provider
      value={{
        body,
        setBody,
        targetId,
        setTargetId,
        lastRequest,
        lastResponse,
        setResult: (req, res) => {
          setReq(req);
          setRes(res);
          setCompare((ids) => ids.filter((id) => res.results.some((r) => r.id === id)));
        },
        clearResult: () => {
          setReq(null);
          setRes(null);
          setCompare([]);
        },
        compareIds,
        toggleCompare: (id) =>
          setCompare((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-3))),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSearch(): SearchState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSearch must be used inside SearchProvider');
  return v;
}
