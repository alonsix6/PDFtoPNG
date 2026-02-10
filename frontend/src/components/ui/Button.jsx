import Spinner from './Spinner';

const variants = {
  primary:
    'bg-brand-green text-black font-semibold hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-surface-mid text-white border border-surface-border hover:bg-surface-dark disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed',
};

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        px-6 py-3 rounded-lg
        text-sm font-body font-medium
        transition-all duration-200
        ${variants[variant] || variants.primary}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="w-4 h-4" />}
      {children}
    </button>
  );
}
