export default function Card({ children, className = '' }) {
  return (
    <div
      className={`bg-surface-dark border border-surface-border rounded-card p-6 ${className}`}
    >
      {children}
    </div>
  );
}
