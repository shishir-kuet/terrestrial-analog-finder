import type { ElementType, ReactNode } from 'react';
import { useReveal } from '../lib/useScroll';

/**
 * Fades and lifts its children in the first time they scroll into view.
 *
 * Purely decorative: where the effect cannot run (reduced motion, no
 * IntersectionObserver, tests) `useReveal` reports visible immediately, so the
 * content is always in the DOM and always readable.
 */
export default function Reveal({ children, delay = 0, as = 'div', className = '', id }: {
  children: ReactNode;
  /** Stagger within a group, in ms. Keep under ~250 or it reads as lag. */
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'article';
  className?: string;
  /** Anchor target, when the section is also a scroll-spy or jump-nav stop. */
  id?: string;
}) {
  const [ref, shown] = useReveal<HTMLElement>();
  // Widening to ElementType keeps one ref type across the tag union; each tag
  // renders a plain HTMLElement, so the cast is sound.
  const Tag = as as ElementType;
  return (
    <Tag
      id={id}
      ref={ref}
      className={`reveal ${shown ? 'reveal-in' : ''} ${className}`}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
