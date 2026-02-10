import { AnimatePresence, motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import Layout from './components/Layout';
import UploadZone from './components/UploadZone';
import JobProgress from './components/JobProgress';
import DownloadResult from './components/DownloadResult';
import ErrorDisplay from './components/ErrorDisplay';
import Button from './components/ui/Button';
import Card from './components/ui/Card';
import Spinner from './components/ui/Spinner';
import { useUpload } from './hooks/useUpload';
import { useJobPolling } from './hooks/useJobPolling';

export default function App() {
  const {
    file,
    setFile,
    jobId,
    uploading,
    uploadProgress,
    error: uploadError,
    errorType: uploadErrorType,
    upload,
    reset,
  } = useUpload();

  const { job, error: pollError } = useJobPolling(jobId);

  // Determine current error and its type
  let currentError = null;
  let currentErrorType = null;
  if (uploadError) {
    currentError = uploadError;
    currentErrorType = uploadErrorType || 'upload';
  } else if (pollError) {
    currentError = pollError;
    currentErrorType = 'network';
  } else if (job?.status === 'failed') {
    currentError = job.error;
    currentErrorType = 'render';
  }

  const showUpload = !jobId && !currentError;
  const showUploading = uploading;
  const showConnecting = jobId && !job && !currentError;
  const showProgress = job?.status === 'processing' || job?.status === 'pending';
  const showComplete = job?.status === 'completed';

  return (
    <Layout>
      <AnimatePresence mode="wait">
        {currentError && (
          <ErrorDisplay
            key="error"
            error={currentError}
            errorType={currentErrorType}
            onRetry={reset}
          />
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

            {showUploading && uploadProgress > 0 ? (
              <div className="space-y-3">
                <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-green rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                <p className="text-text-secondary text-sm text-center">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            ) : (
              <Button
                onClick={upload}
                disabled={!file || uploading}
                loading={uploading}
                className="w-full"
              >
                <Zap className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Render Slides'}
              </Button>
            )}
          </motion.div>
        )}

        {showConnecting && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <Card className="flex items-center justify-center gap-3 py-12">
              <Spinner className="w-5 h-5 text-brand-green" />
              <p className="text-text-secondary text-sm">Connecting to server...</p>
            </Card>
          </motion.div>
        )}

        {showProgress && (
          <JobProgress key="progress" job={job || { progress: {}, phase: null }} />
        )}

        {showComplete && (
          <DownloadResult key="done" jobId={jobId} onReset={reset} />
        )}
      </AnimatePresence>
    </Layout>
  );
}
