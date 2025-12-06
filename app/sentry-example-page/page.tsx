"use client";

import { structuredConsole } from '@/lib/logging/console-proxy';

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Sentry Test Page</h1>
      
      <div className="space-y-4">
        <button
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => {
            throw new Error("Sentry Frontend Error Test");
          }}
        >
          Throw Frontend Error
        </button>
        
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => {
            Sentry.captureMessage("Test message from Sentry!", "info");
            alert("Test message sent to Sentry!");
          }}
        >
          Send Test Message
        </button>
        
        <button
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => {
            Sentry.startSpan(
              {
                op: "ui.click",
                name: "Test Button Click",
              },
              (span) => {
                span.setAttribute("test", "manual-test");
                span.setAttribute("timestamp", new Date().toISOString());
                
                structuredConsole.log("Performance span test completed");
                alert("Performance span tracked!");
              }
            );
          }}
        >
          Test Performance Tracking
        </button>
        
        <button
          className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => {
            // Call a function that doesn't exist to test error handling
            (window as any).myUndefinedFunction();
          }}
        >
          Test Undefined Function Error
        </button>
      </div>
      
      <div className="mt-8 text-sm text-gray-600">
        <p>This page is for testing Sentry integration:</p>
        <ul className="list-disc list-inside mt-2">
          <li>Red button: Throws a manual error</li>
          <li>Blue button: Sends a test message</li>
          <li>Green button: Tests performance tracking</li>
          <li>Orange button: Tests undefined function error</li>
        </ul>
      </div>
    </div>
  );
}