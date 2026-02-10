import { motion } from 'framer-motion';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';

export default function ErrorDisplay({ error, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <Card className="border-brand-error/20 space-y-6">
        <div className="flex items-start gap-4">
          <div className="bg-brand-error/10 rounded-full p-3 shrink-0">
            <AlertTriangle className="w-6 h-6 text-brand-error" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Something went wrong</h2>
            <p className="text-text-secondary text-sm mt-1">{error}</p>
          </div>
        </div>

        <Button variant="secondary" onClick={onRetry} className="w-full">
          <RotateCcw className="w-4 h-4" />
          Try again
        </Button>
      </Card>
    </motion.div>
  );
}
