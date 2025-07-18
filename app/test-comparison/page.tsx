'use client';

import { useState, useEffect } from 'react';
import { useSubscription } from '@/lib/hooks/use-subscription';

export default function TestComparisonPage() {
  const modernData = useSubscription();
  const [oldData, setOldData] = useState<any>(null);

  useEffect(() => {
    // Fetch old billing status
    fetch('/api/billing/status')
      .then(res => res.json())
      .then(data => setOldData(data))
      .catch(err => console.error('Error fetching old data:', err));
  }, []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">Old vs New Comparison</h1>
      
      <div className="grid grid-cols-2 gap-8">
        {/* Old System */}
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-red-800">
            ❌ Old System (Database)
          </h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(oldData, null, 2)}
          </pre>
          <div className="mt-4 text-sm text-red-700">
            <p>Problems:</p>
            <ul className="list-disc list-inside">
              <li>Stored in database</li>
              <li>Can get out of sync</li>
              <li>Hardcoded trial status</li>
              <li>Manual calculations</li>
            </ul>
          </div>
        </div>

        {/* New System */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-green-800">
            ✅ New System (Stripe API)
          </h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({
              status: modernData.status,
              isTrialing: modernData.isTrialing,
              trialDaysRemaining: modernData.trialDaysRemaining,
              hasAccess: modernData.hasAccess,
              isActive: modernData.isActive,
              nextPaymentDate: modernData.nextPaymentDate
            }, null, 2)}
          </pre>
          <div className="mt-4 text-sm text-green-700">
            <p>Benefits:</p>
            <ul className="list-disc list-inside">
              <li>Real-time from Stripe</li>
              <li>Always accurate</li>
              <li>No sync issues</li>
              <li>Professional approach</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-4">Test Actions</h3>
        <div className="space-x-4">
          <button
            onClick={() => modernData.refresh()}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Refresh Modern Data
          </button>
          
          <button
            onClick={() => {
              console.log('Modern subscription data:', {
                raw: modernData.subscription,
                computed: {
                  isTrialing: modernData.isTrialing,
                  isActive: modernData.isActive,
                  hasAccess: modernData.hasAccess
                }
              });
            }}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Log to Console
          </button>
        </div>
      </div>
    </div>
  );
}