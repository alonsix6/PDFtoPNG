import { useState, useCallback } from 'react';
import { submitRenderJob } from '../api/client';

function classifyError(err) {
  if (!err.response && err.message === 'Network Error') {
    return {
      type: 'network',
      message: 'Cannot reach the server. Check your connection or try again later.',
    };
  }
  if (err.code === 'ECONNABORTED') {
    return {
      type: 'network',
      message: 'Upload timed out. The file may be too large or the connection too slow.',
    };
  }
  const status = err.response?.status;
  const serverMsg = err.response?.data?.error;
  if (status === 413) {
    return { type: 'upload', message: serverMsg || 'File is too large. Maximum is 50MB.' };
  }
  if (status === 503) {
    return { type: 'upload', message: serverMsg || 'Server is busy. Please try again in a moment.' };
  }
  if (status === 400) {
    return { type: 'upload', message: serverMsg || 'Invalid file. Please upload a ZIP file.' };
  }
  return {
    type: 'upload',
    message: serverMsg || err.message || 'Upload failed. Please try again.',
  };
}

export function useUpload() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);

  const upload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setErrorType(null);

    console.log('[SlideForge] Starting upload:', file.name, `(${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    try {
      const data = await submitRenderJob(file, (pct) => {
        setUploadProgress(pct);
      });
      console.log('[SlideForge] Job created:', data.jobId);
      setJobId(data.jobId);
    } catch (err) {
      const classified = classifyError(err);
      console.error('[SlideForge] Upload error:', classified.type, classified.message, err);
      setError(classified.message);
      setErrorType(classified.type);
    } finally {
      setUploading(false);
    }
  }, [file]);

  const reset = useCallback(() => {
    console.log('[SlideForge] Reset');
    setFile(null);
    setJobId(null);
    setUploading(false);
    setUploadProgress(0);
    setError(null);
    setErrorType(null);
  }, []);

  return {
    file,
    setFile,
    jobId,
    uploading,
    uploadProgress,
    error,
    errorType,
    upload,
    reset,
  };
}
