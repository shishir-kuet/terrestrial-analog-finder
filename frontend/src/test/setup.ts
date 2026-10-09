import '@testing-library/jest-dom/vitest';

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = RO;
