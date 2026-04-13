"use client";

interface TimePeriodSelectorProps {
  value: number;
  onChange: (days: number) => void;
}

const OPTIONS = [
  { label: "7 días", value: 7 },
  { label: "14 días", value: 14 },
  { label: "30 días", value: 30 },
];

export default function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`filter-chip${value === opt.value ? " active" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
