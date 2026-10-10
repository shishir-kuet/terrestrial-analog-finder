import { useEffect, useRef, useState } from 'react';

/** Honour the OS setting once, at mount: these are all decorative effects. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** IntersectionObserver is missing in jsdom and in older browsers. */
function canObserve(): boolean {
  return typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function';
}

/**
 * Reveal-on-scroll. Returns a ref to attach and whether the element has come
 * into view yet. It latches on: content never fades back out, so a reader
 * scrolling up is not punished for it.
 *
 * Where the effect cannot run — reduced motion, no IntersectionObserver, a
 * test renderer — it reports visible from the first frame, so the page is
 * complete rather than blank.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(() => prefersReducedMotion() || !canObserve());

  useEffect(() => {
    if (shown || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      // Fire a little before the element reaches the viewport edge, so the
      // animation is finishing by the time it is properly on screen.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return [ref, shown];
}

/**
 * Which of `ids` is the section currently being read. Used to light up an
 * in-page nav. Returns the first id until something is observed.
 */
export function useScrollSpy(ids: string[], topOffset = 140): string {
  const [active, setActive] = useState(ids[0] ?? '');
  const key = ids.join(',');

  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) return;

    const pick = () => {
      // The active section is the last one whose top has passed the nav.
      let current = sections[0].id;
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= topOffset) current = s.id;
      }
      // At the very bottom the last section may never reach the line.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        current = sections[sections.length - 1].id;
      }
      setActive(current);
    };

    pick();
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    return () => {
      window.removeEventListener('scroll', pick);
      window.removeEventListener('resize', pick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, topOffset]);

  return active;
}

/** How far down the document the reader is, 0–1, for a progress bar. */
export function useScrollProgress(): number {
  const [p, setP] = useState(0);

  useEffect(() => {
    const update = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return p;
}
