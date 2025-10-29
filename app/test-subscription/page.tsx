'use client';

import { structuredConsole } from '@/lib/logging/console-proxy';

import { SubscriptionStatusModern } from '@/app/components/subscription-status-modern';

export default function TestSubscriptionPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">Test Modern Subscription System</h1>
      
      <div className="grid gap-8">
        {/* Modern component that uses real Stripe data */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Real-Time Stripe Status</h2>
          <SubscriptionStatusModern />
        </div>
        
        {/* Raw API test */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Test API Directly</h2>
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/subscription/status');
                const data = await response.json();
                structuredConsole.log('Subscription Status:', data);
                alert(JSON.stringify(data, null, 2));
              } catch (error) {
                structuredConsole.error('Error:', error);
                alert('Error fetching subscription status');
              }
            }}
            className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-500"
          >
            Fetch Subscription Status
          </button>
        </div>
      </div>
    </div>
  );
}
