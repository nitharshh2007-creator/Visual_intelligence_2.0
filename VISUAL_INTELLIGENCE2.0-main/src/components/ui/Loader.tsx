// Shared loading state — a quiet spinner + label, replacing the blank
// screens some client-gated pages showed while hydrating. Pure markup,
// so it renders identically on the server and the first client pass.
export default function Loader({ label = "Loading", tone = "light" }: { label?: string; tone?: "light" | "dark" }) {
  return (
    <div className={`vi-loader ${tone === "dark" ? "vi-loader-dark" : ""}`} role="status" aria-live="polite">
      <span className="vi-loader-ring" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
