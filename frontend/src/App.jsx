import { AnimatePresence, motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import Layout from './components/Layout';
import UploadZone from './components/UploadZone';
import ResolutionPicker from './components/ResolutionPicker';
import JobProgress from './components/JobProgress';
import DownloadResult from './components/DownloadResult';
import ErrorDisplay from './components/ErrorDisplay';
import Button from './components/ui/Button';
import { useUpload } from './hooks/useUpload';
import { useJobPolling } from './hooks/useJobPolling';

export default function App() {
  const {
    file,
    setFile,
    resolution,
    setResolution,
    jobId,
    uploading,
    error: uploadError,
    upload,
    reset,
  } = useUpload();

  const { job, error: pollError } = useJobPolling(jobId);

  const currentError =
    uploadError ||
    pollError ||
    (job?.status === 'failed' ? job.error : null);

  const showUpload = !jobId && !currentError;
  const showProgress = job?.status === 'processing' || job?.status === 'pending';
  const showComplete = job?.status === 'completed';

  return (
    <Layout>
      <AnimatePresence mode="wait">
        {currentError && (
          <ErrorDisplay key="error" error={currentError} onRetry={reset} />
        )}

        {showUpload && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-8"
          >
            <UploadZone
              file={file}
              onFileSelect={setFile}
              onFileRemove={() => setFile(null)}
            />

            <ResolutionPicker value={resolution} onChange={setResolution} />

            <Button
              onClick={upload}
              disabled={!file || uploading}
              loading={uploading}
              className="w-full"
            >
              <Zap className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Render Slides'}
            </Button>
          </motion.div>
        )}

        {showProgress && <JobProgress key="progress" job={job || { progress: {} }} />}

        {showComplete && (
          <DownloadResult key="done" jobId={jobId} onReset={reset} />
        )}
      </AnimatePresence>
    </Layout>
  );
}
