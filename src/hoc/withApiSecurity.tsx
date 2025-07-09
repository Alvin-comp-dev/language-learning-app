import React, { ComponentType } from 'react';
import apiSecurity from '../middleware/apiSecurity';
import { useAuth } from '../store/AuthStore';
import monitoring from '../config/monitoring';

interface ApiSecurityProps {
  secureApi: {
    call: <T>(
      endpoint: string,
      method: string,
      data?: any,
      validationRules?: any
    ) => Promise<T>;
  };
}

export function withApiSecurity<P extends ApiSecurityProps>(
  WrappedComponent: ComponentType<P>
) {
  return function WithApiSecurityComponent(props: Omit<P, keyof ApiSecurityProps>) {
    const { session } = useAuth();

    const secureApi = {
      call: async <T,>(
        endpoint: string,
        method: string,
        data?: any,
        validationRules?: any
      ): Promise<T> => {
        try {
          // Check API access
          const hasAccess = await apiSecurity.checkApiAccess(
            endpoint,
            session?.access_token || '',
          );

          if (!hasAccess) {
            throw new Error('Unauthorized access');
          }

          // Validate request data if rules provided
          if (data && validationRules) {
            const { isValid, errors } = await apiSecurity.validateRequest(
              endpoint,
              method,
              data,
              validationRules
            );

            if (!isValid) {
              throw new Error(`Validation failed: ${errors?.join(', ')}`);
            }
          }

          // Sanitize input data
          const sanitizedData = data ? apiSecurity.sanitizeInput(data) : undefined;

          // Make the API call
          const response = await fetch(`/api${endpoint}`, {
            method,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: sanitizedData ? JSON.stringify(sanitizedData) : undefined,
          });

          if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
          }

          const result = await response.json();

          // Log successful API call
          monitoring.trackEvent('api_call_success', {
            endpoint,
            method,
            statusCode: response.status,
          });

          return result as T;
        } catch (error) {
          console.error('Secure API call failed:', error);
          monitoring.trackError(error as Error, {
            context: 'secureApi.call',
            endpoint,
            method,
          });
          throw error;
        }
      },
    };

    return <WrappedComponent {...(props as P)} secureApi={secureApi} />;
  };
} 