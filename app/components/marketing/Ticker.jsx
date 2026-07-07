// Port de Ticker.astro (gi-website-final/src/components/Ticker.astro).
// Static band: a single centered row that wraps instead of scrolling, so no
// word (e.g. "Promotional Workshop") is ever clipped at the container edge.
import {TICKER_WORDS} from '~/lib/site-content';

export function Ticker() {
  const words = TICKER_WORDS;
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-marquee">
        {words.map((w, i) => (
          <span className="ticker-item" key={w}>
            {w}
            {i < words.length - 1 && <b className="ticker-dot"> · </b>}
          </span>
        ))}
      </div>
    </div>
  );
}
