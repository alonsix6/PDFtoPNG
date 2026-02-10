import { motion } from 'framer-motion';
import { Layers, Package, FileSearch, Archive } from 'lucide-react';
import Card from './ui/Card';
import Spinner from './ui/Spinner';

const PHASE_INFO = {
  extracting: { label: 'Extracting files...', icon: Archive },
  detecting: { label: 'Analyzing slides...', icon: FileSearch },
  rendering: { label: 'Rendering slides', icon: Layers },
  packaging: { label: 'Packaging PNGs...', icon: Package },
};

export default function JobProgress({ job }) {
  const { progress, phase } = job;
  const current = progress?.current || 0;
  const total = progress?.total || 0;
  const isRendering = phase === 'rendering' && total > 0;
  const percent = isRendering ? Math.round((current / total) * 100) : 0;

  const phaseInfo = PHASE_INFO[phase] || PHASE_INFO.extracting;
  const PhaseIcon = phaseInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <Card className="space-y-6">
        <div className="flex items-center gap-3">
          <Spinner className="w-5 h-5 text-brand-green" />
          <h2 className="text-white font-semibold">Processing your slides</h2>
        </div>

        <div className="space-y-3">
          {/* Progress bar */}
          <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden">
            {isRendering ? (
              <motion.div
                className="h-full bg-brand-green rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            ) : (
              <motion.div
                className="h-full bg-brand-green/60 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: ['0%', '70%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>

          {/* Phase + progress text */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary flex items-center gap-2">
              <PhaseIcon className="w-4 h-4" />
              {isRendering
                ? `Rendering slide ${current} of ${total}`
                : phaseInfo.label}
            </span>
            {isRendering && (
              <span className="text-brand-green font-medium">{percent}%</span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
