export function Icon({
  name = 'arrow',
}: {
  name?: 'arrow' | 'back' | 'check' | 'cross' | 'star' | 'info' | 'circle' | 'chevron';
}) {
  const paths = {
    chevron: 'm6 9 6 6 6-6',
    arrow: 'M5 19 19 5M5 5h14v14',
    back: 'm11 5-7 7 7 7M4 12h16',
    check: 'm4 12 5 5L20 6',
    cross: 'm5 5 14 14M5 19 19 5',
    star: 'm12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z',
    info: 'M12 10v7M12 6v1',
    circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  };
  return (
    <svg
      className="ink-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function ShareText({ text }: { text: string }) {
  return (
    <>
      {[...text].map((ch, i) =>
        ch === '■' || ch === '□' ? (
          <span
            key={i}
            className={'share-box ' + (ch === '■' ? 'filled' : '')}
            aria-label={ch === '■' ? 'dibs' : 'strike'}
          />
        ) : ch === '★' ? (
          <Icon key={i} name="star" />
        ) : (
          ch
        ),
      )}
    </>
  );
}
