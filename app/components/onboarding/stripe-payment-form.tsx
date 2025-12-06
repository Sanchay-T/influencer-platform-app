'use client';

import { structuredConsole } from '@/lib/logging/console-proxy';

import { useState, useEffect } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  CreditCard, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Lock
} from 'lucide-react';

interface StripePaymentFormProps {
  selectedPlan: string;
  onSuccess: (paymentMethodId: string) => void;
  onError: (error: string) => void;
}

export default function StripePaymentForm({ selectedPlan, onSuccess, onError }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardError, setCardError] = useState('');

  // Card element styling
  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
        padding: '12px',
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: false,
  };

  // Create setup intent when component mounts
  useEffect(() => {
    const createSetupIntent = async () => {
      try {
        const response = await fetch('/api/stripe/setup-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to create setup intent');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (err) {
        structuredConsole.error('Error creating setup intent:', err);
        setError('Failed to initialize payment form');
      }
    };

    createSetupIntent();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    if (!stripe || !elements || !clientSecret) {
      setError('Payment system not ready');
      setIsLoading(false);
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      setIsLoading(false);
      return;
    }

    if (!cardholderName.trim()) {
      setError('Please enter the cardholder name');
      setIsLoading(false);
      return;
    }

    try {
      // Confirm the setup intent
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: cardholderName.trim(),
            },
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (setupIntent?.payment_method) {
        // Save payment method to backend
        const response = await fetch('/api/stripe/save-payment-method', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethodId: setupIntent.payment_method.id,
            selectedPlan,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save payment method');
        }

        const result = await response.json();
        onSuccess(setupIntent.payment_method.id);
      }
    } catch (err) {
      structuredConsole.error('Payment error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardChange = (event: any) => {
    if (event.error) {
      setCardError(event.error.message);
    } else {
      setCardError('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Security Notice */}
      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-pink-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-zinc-100 mb-1">
              Secure Payment Processing
            </h3>
            <p className="text-sm text-zinc-300">
              Your payment information is encrypted and processed securely by Stripe. We don't store your full card details.
            </p>
          </div>
        </div>
      </div>

      {/* Cardholder Name */}
      <div className="space-y-2">
        <Label htmlFor="cardholderName">Cardholder Name</Label>
        <Input
          id="cardholderName"
          type="text"
          placeholder="John Doe"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          className="h-12"
          disabled={isLoading}
        />
      </div>

      {/* Card Element */}
      <div className="space-y-2">
        <Label>Card Information</Label>
        <div className="border rounded-lg p-4 bg-white">
          <CardElement
            options={cardElementOptions}
            onChange={handleCardChange}
          />
        </div>
        {cardError && (
          <p className="text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {cardError}
          </p>
        )}
      </div>

      {/* Trial Information */}
      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-pink-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-zinc-100 mb-1">
              7-Day Free Trial
            </h3>
            <ul className="text-sm text-zinc-300 space-y-1">
              <li>• Your trial starts immediately after setup</li>
              <li>• No charge for 7 days</li>
              <li>• Cancel anytime during trial</li>
              <li>• Full access to all features</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-12 text-lg font-semibold"
        disabled={!stripe || isLoading || !clientSecret}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            Processing...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Secure Payment Method
          </div>
        )}
      </Button>

      {/* Security Footer */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          <Lock className="inline h-3 w-3 mr-1" />
          Secured by Stripe • Industry-standard encryption
        </p>
      </div>
    </form>
  );
}
