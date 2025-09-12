import { pool } from './db';

/**
 * Wraps database operations with retry logic and better error handling
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Log the error
      console.log(`Database operation attempt ${attempt + 1}/${maxRetries} failed:`, {
        message: error.message,
        code: error.code,
        severity: error.severity,
        attempt: attempt + 1
      });
      
      // Enhanced retryable error detection
      const isRetryable = 
        // Timeout errors
        error.code === '57014' || // statement_timeout
        error.message?.includes('timeout') ||
        error.message?.includes('Query read timeout') ||
        // Lock conflicts
        error.code === '40001' || // serialization_failure
        error.code === '40P01' || // deadlock_detected
        error.code === '55P03' || // lock_not_available
        // Connection issues
        error.code === '53300' || // too_many_connections
        error.code === '57P03' || // cannot_connect_now
        error.code === '08006' || // connection_failure
        error.code === '08003' || // connection_does_not_exist
        // Network errors
        error?.message?.includes('fetch failed') ||
        error.message?.includes('EPIPE') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.code === 'EPIPE' ||
        error.code === 'ECONNRESET';
      
      if (!isRetryable) {
        // Non-retryable error, throw immediately
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        // Calculate exponential backoff delay with jitter
        const backoffDelay = delayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.log(`Retrying database operation in ${Math.round(backoffDelay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  // All retries exhausted
  throw new Error(
    `Database operation failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Check if database is healthy by running a simple query
 */
export async function checkDatabaseHealth(sql: any): Promise<boolean> {
  try {
    if (sql && typeof sql.query === 'function') {
      await sql.query('SELECT 1');
    } else if (typeof sql === 'function') {
      await sql('SELECT 1');
    } else {
      throw new Error('Unsupported sql client passed to checkDatabaseHealth');
    }
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
