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
      <h1 className="text-2xl font-bold mb-8 text-zinc-100">Old vs New Comparison</h1>
      
      <div className="grid grid-cols-2 gap-8">
        {/* Old System */}
        <div className="bg-zinc-800/60 border border-zinc-700/50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-zinc-100">
            ❌ Old System (Database)
          </h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(oldData, null, 2)}
          </pre>
          <div className="mt-4 text-sm text-zinc-300">
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
        <div className="bg-zinc-800/60 border border-zinc-700/50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-zinc-100">
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
          <div className="mt-4 text-sm text-zinc-300">
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
      <div className="mt-8 p-6 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
        <h3 className="font-semibold mb-4 text-zinc-100">Test Actions</h3>
        <div className="space-x-4">
          <button
            onClick={() => modernData.refresh()}
            className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-500"
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
            className="bg-zinc-700 text-white px-4 py-2 rounded hover:bg-zinc-600"
          >
            Log to Console
          </button>
        </div>
      </div>
    </div>
  );
}
