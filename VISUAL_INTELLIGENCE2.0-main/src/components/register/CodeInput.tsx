"use client";

import { normalizeTeamCode } from "@/lib/registration";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

// Big monospace "DUM-XXXX" code field. Auto-uppercases, auto-inserts
// the dash, strips spaces, and is paste-friendly — typing or pasting
// "dum1234", "DUM 1234" or "dum-1234" all land on the same "DUM-1234".
export default function CodeInput({ value, onChange, onSubmit, disabled, autoFocus }: Props) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(normalizeTeamCode(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit?.();
        }
      }}
      placeholder="DUM-XXXX"
      maxLength={8}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      aria-label="Team code"
      className="w-full px-5 py-4 rounded-xl bg-brand-light border-2 border-brand-fg/15 text-center font-mono text-3xl md:text-4xl tracking-[0.25em] text-brand-fg placeholder:text-brand-fg/20 focus:outline-none focus:border-brand-accent/60 transition-colors disabled:opacity-50"
    />
  );
}
