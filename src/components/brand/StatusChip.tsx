type StatusChipProps = {
  label: string;
};

// Space Mono status chip, as in "SYSTEM OPERATIONAL" on the brand board.
export function StatusChip({ label }: StatusChipProps) {
  return (
    <span className="chip">
      <span className="chip-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
