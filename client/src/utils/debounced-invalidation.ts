import { QueryClient } from '@tanstack/react-query';

// Debounced cache invalidation to prevent cascading updates
class DebouncedInvalidation {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  invalidateQueries(queryKey: string[], delay: number = 300) {
    const key = queryKey.join('|');
    
    // Clear existing timeout for this query key
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key)!);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.queryClient.invalidateQueries({ queryKey });
      this.timeouts.delete(key);
    }, delay);

    this.timeouts.set(key, timeout);
  }

  // Immediate invalidation for critical updates
  invalidateQueriesImmediate(queryKey: string[]) {
    const key = queryKey.join('|');
    
    // Clear any pending timeout
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key)!);
      this.timeouts.delete(key);
    }

    // Invalidate immediately
    this.queryClient.invalidateQueries({ queryKey });
  }

  // Clear all pending invalidations
  clearAll() {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }
}

export default DebouncedInvalidation;
