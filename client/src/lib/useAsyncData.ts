import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';

// Loads data when the component mounts and whenever `loader` changes.
// Wrap `loader` in useCallback so it only changes when its inputs change.
export function useAsyncData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loader()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(getErrorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loader, version]);

  return { data, error, loading, reload: () => setVersion((current) => current + 1) };
}
