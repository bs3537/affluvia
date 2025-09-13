import { useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';

interface UseDebouncedSaveOptions {
  onSave: (data: any) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

export function useDebouncedSave({ 
  onSave, 
  delay = 2000, 
  enabled = true 
}: UseDebouncedSaveOptions) {
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isSavingRef = useRef(false);
  const pendingDataRef = useRef<any>(null);

  // Create debounced save function
  const debouncedSave = useCallback(
    debounce(async (data: any) => {
      if (!enabled || isSavingRef.current) {
        pendingDataRef.current = data;
        return;
      }

      try {
        isSavingRef.current = true;
        await onSave(data);
        
        // Check if there's pending data to save
        if (pendingDataRef.current) {
          const pendingData = pendingDataRef.current;
          pendingDataRef.current = null;
          debouncedSave(pendingData);
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        isSavingRef.current = false;
      }
    }, delay),
    [onSave, delay, enabled]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debouncedSave]);

  return {
    debouncedSave,
    isSaving: isSavingRef.current
  };
}