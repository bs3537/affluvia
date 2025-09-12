import { useEffect, useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';

interface UseFormPersistenceOptions {
  formKey: string;
  watch: UseFormReturn['watch'];
  reset: UseFormReturn['reset'];
  setValue: UseFormReturn['setValue'];
  storageType?: 'localStorage' | 'sessionStorage';
  debounceMs?: number;
  excludeFields?: string[];
}

export function useFormPersistence({
  formKey,
  watch,
  reset,
  setValue,
  storageType = 'sessionStorage',
  debounceMs = 1000,
  excludeFields = []
}: UseFormPersistenceOptions) {
  const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isRestoringRef = useRef(false);

  // Save form data to storage
  const saveToStorage = useCallback((data: any) => {
    try {
      // Remove excluded fields
      const dataToSave = { ...data };
      excludeFields.forEach(field => {
        delete dataToSave[field];
      });
      
      storage.setItem(formKey, JSON.stringify({
        data: dataToSave,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save form data to storage:', error);
    }
  }, [formKey, storage, excludeFields]);

  // Load form data from storage
  const loadFromStorage = useCallback(() => {
    try {
      const stored = storage.getItem(formKey);
      if (!stored) return null;

      const { data, timestamp } = JSON.parse(stored);
      
      // Check if data is less than 24 hours old
      const dayInMs = 24 * 60 * 60 * 1000;
      if (Date.now() - timestamp > dayInMs) {
        storage.removeItem(formKey);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to load form data from storage:', error);
      return null;
    }
  }, [formKey, storage]);

  // Clear storage
  const clearStorage = useCallback(() => {
    storage.removeItem(formKey);
  }, [formKey, storage]);

  // Restore form data on mount
  useEffect(() => {
    const storedData = loadFromStorage();
    if (storedData && !isRestoringRef.current) {
      isRestoringRef.current = true;
      
      // Use setValue for each field to maintain form state properly
      Object.entries(storedData).forEach(([key, value]) => {
        if (!excludeFields.includes(key)) {
          setValue(key as any, value, { shouldDirty: false, shouldValidate: false });
        }
      });
      
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    }
  }, []);

  // Watch for form changes and save with debounce
  useEffect(() => {
    if (isRestoringRef.current) return;

    const subscription = watch((data) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveToStorage(data);
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [watch, saveToStorage, debounceMs]);

  return {
    clearStorage,
    loadFromStorage,
    saveToStorage
  };
}