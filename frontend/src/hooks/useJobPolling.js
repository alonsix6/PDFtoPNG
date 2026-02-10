import { useState, useEffect, useRef } from 'react';
import { getJobStatus } from '../api/client';

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 150;
const INITIAL_DELAY = 1000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF = [2000, 4000, 8000];

export function useJobPolling(jobId) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const attemptsRef = useRef(0);
  const retriesRef = useRef(0);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      attemptsRef.current = 0;
      retriesRef.current = 0;
      return;
    }

    let active = true;

    const poll = async () => {
      if (!active) return;

      try {
        const data = await getJobStatus(jobId);
        if (!active) return;

        retriesRef.current = 0;
        setJob(data);
        attemptsRef.current++;

        console.log('[SlideForge] Poll:', data.status, data.phase || '', data.progress?.current || 0, '/', data.progress?.total || 0);

        if (data.status === 'completed') {
          console.log('[SlideForge] Job completed');
          return;
        }
        if (data.status === 'failed') {
          console.error('[SlideForge] Job failed:', data.error);
          return;
        }

        if (attemptsRef.current >= MAX_ATTEMPTS) {
          console.error('[SlideForge] Polling timed out after', MAX_ATTEMPTS, 'attempts');
          setError('Rendering timed out. Please try again.');
          return;
        }

        setTimeout(poll, POLL_INTERVAL);
      } catch (err) {
        if (!active) return;

        retriesRef.current++;
        console.warn('[SlideForge] Poll error (retry', retriesRef.current, '/', MAX_RETRIES, '):', err.message);

        if (retriesRef.current <= MAX_RETRIES) {
          const delay = RETRY_BACKOFF[retriesRef.current - 1] || 8000;
          setTimeout(poll, delay);
        } else {
          console.error('[SlideForge] Polling failed after', MAX_RETRIES, 'retries');
          setError('Lost connection to the server. Please check your connection and try again.');
        }
      }
    };

    console.log('[SlideForge] Starting polling for job:', jobId);
    setTimeout(poll, INITIAL_DELAY);

    return () => {
      active = false;
    };
  }, [jobId]);

  return { job, error };
}
