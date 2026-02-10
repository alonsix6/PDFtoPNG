import { useState, useCallback } from 'react';
import { submitRenderJob } from '../api/client';

export function useUpload() {
  const [file, setFile] = useState(null);
  const [resolution, setResolution] = useState('hd');
  const [jobId, setJobId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const data = await submitRenderJob(file, resolution);
      setJobId(data.jobId);
    } catch (err) {
      const message =
        err.response?.data?.error || err.message || 'Upload failed';
      setError(message);
    } finally {
      setUploading(false);
    }
  }, [file, resolution]);

  const reset = useCallback(() => {
    setFile(null);
    setJobId(null);
    setUploading(false);
    setError(null);
  }, []);

  return {
    file,
    setFile,
    resolution,
    setResolution,
    jobId,
    uploading,
    error,
    upload,
    reset,
  };
}
