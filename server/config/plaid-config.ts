import { Configuration, PlaidEnvironments } from 'plaid';

/**
 * Plaid configuration for different environments
 */
export class PlaidConfig {
  /**
   * Get Plaid environment based on NODE_ENV
   */
  static getEnvironment() {
    const env = process.env.PLAID_ENV || process.env.NODE_ENV;
    
    switch (env) {
      case 'production':
        return PlaidEnvironments.production;
      case 'development':
        return PlaidEnvironments.development;
      case 'sandbox':
      default:
        return PlaidEnvironments.sandbox;
    }
  }

  /**
   * Get Plaid configuration
   */
  static getConfiguration(): Configuration {
    return new Configuration({
      basePath: this.getEnvironment(),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': this.getPlaidSecret(),
          'Plaid-Version': '2020-09-14', // API version
        },
        timeout: 30000, // 30 second timeout
      },
    });
  }

  /**
   * Get appropriate Plaid secret based on environment
   */
  static getPlaidSecret(): string {
    const env = process.env.PLAID_ENV || process.env.NODE_ENV;
    
    switch (env) {
      case 'production':
        return process.env.PLAID_SECRET_PRODUCTION || '';
      case 'development':
        return process.env.PLAID_SECRET_DEVELOPMENT || '';
      case 'sandbox':
      default:
        return process.env.PLAID_SECRET || process.env.PLAID_SECRET_SANDBOX || '';
    }
  }

  /**
   * Get webhook URL based on environment
   */
  static getWebhookUrl(): string {
    const env = process.env.NODE_ENV;
    
    if (env === 'production') {
      return process.env.PLAID_WEBHOOK_URL || 'https://app.affluvia.com/api/plaid/webhook';
    } else if (env === 'development') {
      // For development, you might use ngrok or similar
      return process.env.PLAID_WEBHOOK_URL || 'https://your-dev-domain.ngrok.io/api/plaid/webhook';
    } else {
      // Sandbox doesn't require real webhook URL
      return process.env.PLAID_WEBHOOK_URL || 'http://localhost:3004/api/plaid/webhook';
    }
  }

  /**
   * Get redirect URI for OAuth institutions
   */
  static getRedirectUri(): string {
    const env = process.env.NODE_ENV;
    
    if (env === 'production') {
      return 'https://app.affluvia.com/plaid-oauth';
    } else {
      return 'http://localhost:3000/plaid-oauth';
    }
  }

  /**
   * Validate environment configuration
   */
  static validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!process.env.PLAID_CLIENT_ID) {
      errors.push('PLAID_CLIENT_ID is not set');
    }
    
    const secret = this.getPlaidSecret();
    if (!secret) {
      errors.push('PLAID_SECRET is not set for current environment');
    }
    
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.PLAID_WEBHOOK_URL) {
        errors.push('PLAID_WEBHOOK_URL should be set for production');
      }
      if (!process.env.ENCRYPTION_KEY) {
        errors.push('ENCRYPTION_KEY must be set for production');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get country codes for Plaid Link
   */
  static getCountryCodes(): string[] {
    // Add more country codes as Plaid expands
    return ['US', 'CA', 'GB', 'FR', 'ES', 'IE', 'NL'];
  }

  /**
   * Get supported products based on environment
   */
  static getSupportedProducts() {
    const baseProducts = [
      'accounts',
      'transactions',
      'investments',
      'liabilities'
    ];
    
    if (this.getEnvironment() === PlaidEnvironments.production) {
      // Add production-only products
      return [...baseProducts, 'assets', 'income_verification'];
    }
    
    return baseProducts;
  }
}

export default PlaidConfig;