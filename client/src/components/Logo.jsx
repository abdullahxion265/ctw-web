// Brand logo images live in /public/brand (transparent PNGs cut from the client's logo).
// "light" = cream, for the dark site. "navy" = the original colour, for light backgrounds.
const MARK = { w: 515, h: 640 };   // CTW monogram only
const FULL = { w: 1400, h: 1132 }; // monogram + CARTER + THE TOWN WEAR

export function LogoMark({ height = 40, tone = 'light', style }) {
  return (
    <img
      src={`/brand/ctw-mark-${tone}.png`}
      width={Math.round((height * MARK.w) / MARK.h)}
      height={height}
      alt=""
      aria-hidden="true"
      decoding="async"
      style={{ display: 'block', ...style }}
    />
  );
}

// `width` can be a number (px) or a CSS length such as "clamp(220px, 44vw, 460px)".
export function LogoFull({ width = 240, tone = 'light', alt = 'Carter The Town Wear', style }) {
  const px = typeof width === 'number' ? width : 440;
  return (
    <img
      src={`/brand/ctw-logo-${tone}.png`}
      width={px}
      height={Math.round((px * FULL.h) / FULL.w)}
      alt={alt}
      decoding="async"
      style={{ display: 'block', width, height: 'auto', ...style }}
    />
  );
}
