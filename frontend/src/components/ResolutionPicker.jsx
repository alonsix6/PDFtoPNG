import { motion } from 'framer-motion';
import { Maximize2 } from 'lucide-react';

const options = [
  { value: 'hd', label: 'HD', detail: '1920 x 1080' },
  { value: '4k', label: '4K', detail: '3840 x 2160' },
];

export default function ResolutionPicker({ value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-text-secondary font-medium flex items-center gap-2">
        <Maximize2 className="w-4 h-4" />
        Resolution
      </label>
      <div className="flex gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="relative flex-1 py-3 px-4 rounded-lg border transition-all duration-200 text-left"
            style={{
              borderColor:
                value === opt.value ? '#00FF85' : '#333333',
              backgroundColor:
                value === opt.value
                  ? 'rgba(0, 255, 133, 0.05)'
                  : '#1A1A1A',
            }}
          >
            {value === opt.value && (
              <motion.div
                layoutId="resolution-indicator"
                className="absolute inset-0 rounded-lg border-2 border-brand-green"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative block text-white font-semibold text-sm">
              {opt.label}
            </span>
            <span className="relative block text-text-secondary text-xs mt-0.5">
              {opt.detail}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
