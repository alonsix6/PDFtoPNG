import { motion } from 'framer-motion';
import { CheckCircle, Download, RotateCcw } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import { getDownloadUrl } from '../api/client';

export default function DownloadResult({ jobId, onReset }) {
  const downloadUrl = getDownloadUrl(jobId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <Card className="space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-brand-green/10 rounded-full p-4">
            <CheckCircle className="w-10 h-10 text-brand-green" />
          </div>
          <h2 className="text-white font-semibold text-lg">
            Render complete
          </h2>
          <p className="text-text-secondary text-sm">
            Your slides have been rendered as PNG images and packaged into a ZIP
            file.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <a href={downloadUrl} download>
            <Button className="w-full">
              <Download className="w-4 h-4" />
              Download ZIP
            </Button>
          </a>
          <Button variant="secondary" onClick={onReset} className="w-full">
            <RotateCcw className="w-4 h-4" />
            Render another
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
