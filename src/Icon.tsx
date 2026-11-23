export function Icon({
  name = 'arrow',
}: {
  name?:
    | 'play'
    | 'board'
    | 'archive'
    | 'rules'
    | 'arrow'
    | 'back'
    | 'check'
    | 'cross'
    | 'star'
    | 'info'
    | 'circle'
    | 'chevron';
}) {
  const paths = {
    play: 'M7 4h10v5H7zM9 9v6m6-6v6M5 15h14v5H5z',
    board: 'M4 20V12h5v8m1 0V5h5v15m1 0v-9h4v9M3 20h18',
    archive: 'M4 4h16v4H4zM6 8v12h12V8M10 12h4',
    rules: 'M4 4h7l1 2 1-2h7v15h-7l-1 1-1-1H4zM12 6v14',
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
      strokeWidth="1.75"
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
