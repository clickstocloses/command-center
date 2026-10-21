// The logo lockup: cursor mark plus "CLICKS TO CLOSES" with CLOSES in Spark Green.
export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Clicks to Closes">
      <CursorMark />
      <span>
        Clicks to <em>Closes</em>
      </span>
    </span>
  );
}

// The cursor is the brand signature. Solid Spark Green via CSS, never outlined.
export function CursorMark() {
  return (
    <svg className="cursor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 2l16 7.5-7 2.1-2.1 7z" />
    </svg>
  );
}
