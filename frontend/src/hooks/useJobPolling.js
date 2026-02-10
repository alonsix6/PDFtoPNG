import { useState, useEffect, useRef } from 'react';
import { getJobStatus } from '../api/client';

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 150;

export function useJobPolling(jobId) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      attemptsRef.current = 0;
      return;
    }

    let active = true;

    const poll = async () => {
      if (!active) return;

      try {
        const data = await getJobStatus(jobId);
        if (!active) return;

        setJob(data);
        attemptsRef.current++;

        if (data.status === 'completed' || data.status === 'failed') {
          return;
        }

        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setError('Rendering timed out. Please try again.');
          return;
        }

        setTimeout(poll, POLL_INTERVAL);
      } catch (err) {
        if (!active) return;
        setError('Lost connection to server. Please check and try again.');
      }
    };

    poll();

    return () => {
      active = false;
    };
  }, [jobId]);

  return { job, error };
}
