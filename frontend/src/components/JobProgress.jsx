import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import Card from './ui/Card';
import Spinner from './ui/Spinner';

export default function JobProgress({ job }) {
  const { progress } = job;
  const current = progress?.current || 0;
  const total = progress?.total || 0;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <Card className="space-y-6">
        <div className="flex items-center gap-3">
          <Spinner className="w-5 h-5 text-brand-green" />
          <h2 className="text-white font-semibold">Rendering slides</h2>
        </div>

        <div className="space-y-3">
          {/* Progress bar */}
          <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-green rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Progress text */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {total > 0
                ? `Rendering slide ${current} of ${total}`
                : 'Preparing slides...'}
            </span>
            {total > 0 && (
              <span className="text-brand-green font-medium">{percent}%</span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
