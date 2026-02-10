import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 120_000,
});

export async function submitRenderJob(file, resolution, onUploadProgress) {
  const formData = new FormData();
  formData.append('zipFile', file);
  formData.append('resolution', resolution);

  console.log('[SlideForge] Uploading:', file.name, `(${(file.size / 1024 / 1024).toFixed(1)}MB)`, resolution);

  const { data } = await api.post('/api/render', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total && onUploadProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onUploadProgress(pct);
      }
    },
  });

  console.log('[SlideForge] Upload complete, jobId:', data.jobId);
  return data;
}

export async function getJobStatus(jobId) {
  const { data } = await api.get(`/api/jobs/${jobId}`, {
    params: { t: Date.now() },
  });
  return data;
}

export function getDownloadUrl(jobId) {
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}/api/jobs/${jobId}/download`;
}
