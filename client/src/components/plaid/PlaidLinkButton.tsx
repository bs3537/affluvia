import React, { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onExit?: () => void;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  updateMode?: boolean;
  itemId?: string;
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  className = '',
  variant = 'default',
  size = 'default',
  updateMode = false,
  itemId
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Log component mount
  useEffect(() => {
    console.log('🎨 [PlaidLinkButton] Component mounted');
    console.log('🎨 [PlaidLinkButton] Props:', { updateMode, itemId, variant, size });
    
    // Check if Plaid Link script is loaded
    if (typeof window !== 'undefined' && (window as any).Plaid) {
      console.log('✅ [PlaidLinkButton] Plaid SDK is loaded');
    } else {
      console.warn('⚠️ [PlaidLinkButton] Plaid SDK not detected');
    }
    
    return () => {
      console.log('🎨 [PlaidLinkButton] Component unmounting');
    };
  }, []);

  // Fetch link token on mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      console.log('🔵 [PlaidLinkButton] Starting link token fetch...');
      console.log('🔵 [PlaidLinkButton] Mode:', updateMode ? 'UPDATE' : 'CREATE');
      if (updateMode && itemId) {
        console.log('🔵 [PlaidLinkButton] Item ID for update:', itemId);
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const endpoint = updateMode && itemId 
          ? '/api/plaid/create-update-link-token' 
          : '/api/plaid/create-link-token';
        
        console.log('🔵 [PlaidLinkButton] Fetching from endpoint:', endpoint);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Important: include credentials for authentication
          body: updateMode && itemId ? JSON.stringify({ itemId }) : undefined,
        });

        console.log('🔵 [PlaidLinkButton] Response status:', response.status);
        console.log('🔵 [PlaidLinkButton] Response OK:', response.ok);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('🔴 [PlaidLinkButton] Link token error response:', errorData);
          console.error('🔴 [PlaidLinkButton] Error details:', {
            error: errorData.error,
            message: errorData.message,
            details: errorData.details,
            status: response.status
          });
          throw new Error(errorData.error || errorData.message || 'Failed to initialize Plaid Link');
        }

        const data = await response.json();
        const token = data.link_token || data.linkToken;
        console.log('✅ [PlaidLinkButton] Link token received:', token ? `${token.substring(0, 20)}...` : 'null');
        console.log('✅ [PlaidLinkButton] Link token expiration:', data.expiration);
        setLinkToken(token);
      } catch (error) {
        console.error('🔴 [PlaidLinkButton] Error fetching link token:', error);
        console.error('🔴 [PlaidLinkButton] Error stack:', error instanceof Error ? error.stack : 'No stack');
        setError(error instanceof Error ? error.message : 'Failed to initialize Plaid Link');
      } finally {
        setLoading(false);
        console.log('🔵 [PlaidLinkButton] Loading state set to false');
      }
    };

    fetchLinkToken();
  }, []);

  const onSuccessCallback = useCallback(
    async (publicToken: string, metadata: any) => {
      console.log('✅ [PlaidLinkButton] Link success! Processing...');
      console.log('✅ [PlaidLinkButton] Public token:', publicToken ? `${publicToken.substring(0, 20)}...` : 'null');
      console.log('✅ [PlaidLinkButton] Metadata:', metadata);
      console.log('✅ [PlaidLinkButton] Institution:', metadata.institution);
      console.log('✅ [PlaidLinkButton] Accounts linked:', metadata.accounts?.length || 0);
      
      try {
        setLoading(true);
        
        console.log('🔵 [PlaidLinkButton] Exchanging public token for access token...');
        
        // Exchange public token for access token
        const response = await fetch('/api/plaid/exchange-public-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Important: include credentials for authentication
          body: JSON.stringify({ publicToken }),
        });

        console.log('🔵 [PlaidLinkButton] Exchange response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('🔴 [PlaidLinkButton] Exchange failed:', errorData);
          throw new Error(errorData.error || 'Failed to connect account');
        }

        const data = await response.json();
        console.log('✅ [PlaidLinkButton] Exchange successful:', data);
        console.log('✅ [PlaidLinkButton] Item ID:', data.itemId);
        console.log('✅ [PlaidLinkButton] Request ID:', data.requestId);
        
        toast({
          title: 'Account Connected Successfully',
          description: `Connected ${metadata.institution?.name || 'your account'} with ${metadata.accounts?.length || 0} accounts`,
        });

        // Call the parent's onSuccess callback
        if (onSuccess) {
          console.log('🔵 [PlaidLinkButton] Calling parent onSuccess callback');
          onSuccess();
        }
      } catch (error) {
        console.error('🔴 [PlaidLinkButton] Error exchanging public token:', error);
        console.error('🔴 [PlaidLinkButton] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack'
        });
        toast({
          title: 'Connection Failed',
          description: error instanceof Error ? error.message : 'Failed to connect account',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        console.log('🔵 [PlaidLinkButton] Exchange process complete');
      }
    },
    [onSuccess, toast]
  );

  const onExitCallback = useCallback(
    (err: any, metadata: any) => {
      // Log exit event
      console.log('🟡 [PlaidLinkButton] Plaid Link exited');
      console.log('🟡 [PlaidLinkButton] Exit error:', err);
      console.log('🟡 [PlaidLinkButton] Exit metadata:', metadata);
      console.log('🟡 [PlaidLinkButton] Exit status:', metadata?.status);
      console.log('🟡 [PlaidLinkButton] Link session ID:', metadata?.link_session_id);
      
      if (err) {
        // User encountered an error
        console.error('🔴 [PlaidLinkButton] Link error occurred:', {
          error_type: err.error_type,
          error_code: err.error_code,
          error_message: err.error_message,
          display_message: err.display_message
        });
        
        toast({
          title: 'Connection Error',
          description: err.display_message || err.error_message || 'An error occurred while connecting your account',
          variant: 'destructive',
        });
      } else {
        console.log('🟡 [PlaidLinkButton] User exited without error (cancelled)');
      }
      
      // Call the parent's onExit callback
      if (onExit) {
        console.log('🔵 [PlaidLinkButton] Calling parent onExit callback');
        onExit();
      }
    },
    [onExit, toast]
  );

  const config = {
    token: linkToken,
    onSuccess: onSuccessCallback,
    onExit: onExitCallback,
  };

  const { open, ready } = usePlaidLink(config);
  
  // Log when Plaid Link becomes ready
  useEffect(() => {
    console.log('🔵 [PlaidLinkButton] Plaid Link ready state:', ready);
    console.log('🔵 [PlaidLinkButton] Link token present:', !!linkToken);
    if (ready) {
      console.log('✅ [PlaidLinkButton] Plaid Link is ready to open');
    }
  }, [ready, linkToken]);

  const handleClick = () => {
    console.log('🎯 [PlaidLinkButton] Button clicked!');
    console.log('🎯 [PlaidLinkButton] Current state:', {
      ready,
      loading,
      hasToken: !!linkToken,
      hasError: !!error
    });
    
    if (ready && !loading) {
      console.log('🚀 [PlaidLinkButton] Opening Plaid Link...');
      open();
    } else {
      console.warn('⚠️ [PlaidLinkButton] Cannot open Link:', {
        ready,
        loading,
        reason: !ready ? 'Link not ready' : 'Still loading'
      });
    }
  };

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={!ready || loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Link className="mr-2 h-4 w-4" />
          {updateMode ? 'Update Connection' : 'Connect Bank Account'}
        </>
      )}
    </Button>
  );
}