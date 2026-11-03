import { useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Swipeable photo strip (native scroll-snap, so it feels right on phones) with arrows, dots and optional thumbnails.
//   arrows: 'hover' shows them on mouse devices when hovering, 'always' keeps them visible
// Position it inside a box that has a size: it fills its parent.
export default function ImageCarousel({ images, alt, arrows = 'hover', thumbs = false, placeholder = null }) {
  const scroller = useRef(null);
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState({});
  const count = images.length;

  const go = useCallback((i) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.max(0, Math.min(count - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    setIndex(next);
  }, [count]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  };

  if (!count) return placeholder;

  return (
    <div
      className={`carousel carousel-arrows-${arrows}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={count > 1 ? `${alt}, ${count} photos` : alt}
      tabIndex={count > 1 ? 0 : undefined}
      onKeyDown={count > 1 ? onKeyDown : undefined}
    >
      <div ref={scroller} className="carousel-track" onScroll={onScroll}>
        {images.map((src, i) => (
          <div className="carousel-slide" key={src} aria-hidden={i !== index}>
            {broken[src]
              ? placeholder
              : (
                <img
                  src={src}
                  alt={count > 1 ? `${alt}, photo ${i + 1} of ${count}` : alt}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  draggable={false}
                  onError={() => setBroken((b) => ({ ...b, [src]: true }))}
                />
              )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button type="button" className="carousel-arrow carousel-prev" aria-label="Previous photo"
            style={{ visibility: index === 0 ? 'hidden' : 'visible' }}
            onClick={(e) => { e.stopPropagation(); go(index - 1); }}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="carousel-arrow carousel-next" aria-label="Next photo"
            style={{ visibility: index === count - 1 ? 'hidden' : 'visible' }}
            onClick={(e) => { e.stopPropagation(); go(index + 1); }}>
            <ChevronRight size={18} />
          </button>

          {thumbs ? (
            <div className="carousel-thumbs">
              {images.map((src, i) => (
                <button key={src} type="button" aria-label={`Show photo ${i + 1}`} aria-current={i === index}
                  className={i === index ? 'active' : ''} onClick={() => go(i)}>
                  <img src={src} alt="" draggable={false} />
                </button>
              ))}
            </div>
          ) : (
            <div className="carousel-dots" aria-hidden="true">
              {images.map((src, i) => <span key={src} className={i === index ? 'active' : ''} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
