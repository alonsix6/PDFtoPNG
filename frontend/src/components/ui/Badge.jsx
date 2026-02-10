const variants = {
  success: 'bg-brand-green/10 text-brand-green border-brand-green/20',
  error: 'bg-brand-error/10 text-brand-error border-brand-error/20',
  processing: 'bg-brand-violet/10 text-brand-violet border-brand-violet/20 animate-pulse',
  neutral: 'bg-surface-mid text-text-secondary border-surface-border',
};

export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        px-2.5 py-0.5 rounded-full
        text-xs font-medium border
        ${variants[variant] || variants.neutral}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
