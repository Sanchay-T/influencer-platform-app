'use client';

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
                console.log('Subscription Status:', data);
                alert(JSON.stringify(data, null, 2));
              } catch (error) {
                console.error('Error:', error);
                alert('Error fetching subscription status');
              }
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Fetch Subscription Status
          </button>
        </div>
      </div>
    </div>
  );
}