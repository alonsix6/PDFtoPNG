import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

export async function submitRenderJob(file, resolution) {
  const formData = new FormData();
  formData.append('zipFile', file);
  formData.append('resolution', resolution);

  const { data } = await api.post('/api/render', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function getJobStatus(jobId) {
  const { data } = await api.get(`/api/jobs/${jobId}`);
  return data;
}

export function getDownloadUrl(jobId) {
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}/api/jobs/${jobId}/download`;
}
