import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Property } from '../../lib/database.types';
import ConversionPropertyCard from '../ConversionPropertyCard';

/** Native scrolling keeps every card focusable and avoids cloned, partially empty slides. */
export default function HomepageStaysRail({ properties, distanceByPropertyId }: {
  properties: Property[];
  distanceByPropertyId?: Record<string, number>;
}) {
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const update = () => setEdges({ start: node.scrollLeft <= 2, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener('scroll', update, { passive: true });
    return () => { observer.disconnect(); node.removeEventListener('scroll', update); };
  }, [properties]);
  const advance = (direction: number) => {
    const node = rail.current;
    if (!node) return;
    const cardWidth = node.firstElementChild?.getBoundingClientRect().width ?? node.clientWidth;
    node.scrollBy({ left: direction * (cardWidth + 16), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <div className="hp-stays-rail">
    <ul ref={rail} className="hp-stays-track" aria-label="Featured stays">
      {properties.map(property => <li key={property.id}><ConversionPropertyCard property={property} className="mx-0 h-full w-full max-w-none md:mx-0" nearbyDistanceKm={distanceByPropertyId?.[property.id]} nearbySource="nearby_carousel" /></li>)}
    </ul>
    {(!edges.start || !edges.end) && <div className="hp-rail-controls">
      <span>More places to feel at home</span>
      <button type="button" aria-label="Previous featured stay" disabled={edges.start} onClick={() => advance(-1)}><ChevronLeft size={18} /></button>
      <button type="button" aria-label="Next featured stay" disabled={edges.end} onClick={() => advance(1)}><ChevronRight size={18} /></button>
    </div>}
  </div>;
}
