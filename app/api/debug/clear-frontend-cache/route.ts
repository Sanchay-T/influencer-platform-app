import { NextResponse } from 'next/server';

export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Clear Frontend Cache</title>
        <style>
            body { font-family: Arial; padding: 20px; max-width: 600px; margin: 0 auto; }
            .button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .success { color: green; }
            .info { background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1>🔧 Complete Frontend Reset</h1>
        <div class="info">
            <strong>Current Issue:</strong> Onboarding not showing despite database reset
        </div>
        
        <h2>Step 1: Clear All Frontend Cache</h2>
        <button class="button" onclick="clearAll()">Clear All Cache & Storage</button>
        <div id="result"></div>
        
        <h2>Step 2: Reset User Profile</h2>
        <button class="button" onclick="resetProfile()">Reset Database Profile</button>
        <div id="profileResult"></div>
        
        <h2>Step 3: Navigate</h2>
        <button class="button" onclick="goToOnboarding()">Go to Onboarding</button>
        <button class="button" onclick="goToHome()">Go to Home</button>
        
        <script>
            async function clearAll() {
                try {
                    // Clear localStorage
                    localStorage.clear();
                    console.log('✅ localStorage cleared');
                    
                    // Clear sessionStorage
                    sessionStorage.clear();
                    console.log('✅ sessionStorage cleared');
                    
                    // Clear indexedDB
                    if ('indexedDB' in window) {
                        const databases = await indexedDB.databases();
                        databases.forEach(db => {
                            indexedDB.deleteDatabase(db.name);
                        });
                        console.log('✅ indexedDB cleared');
                    }
                    
                    // Clear caches
                    if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map(name => caches.delete(name)));
                        console.log('✅ Service Worker caches cleared');
                    }
                    
                    document.getElementById('result').innerHTML = 
                        '<div class="success">✅ All frontend storage cleared!</div>';
                        
                } catch (error) {
                    console.error('❌ Error clearing cache:', error);
                    document.getElementById('result').innerHTML = 
                        '<div style="color: red;">❌ Error: ' + error.message + '</div>';
                }
            }
            
            async function resetProfile() {
                try {
                    const response = await fetch('/api/debug/complete-reset', { 
                        method: 'POST' 
                    });
                    const data = await response.json();
                    
                    if (data.success) {
                        document.getElementById('profileResult').innerHTML = 
                            '<div class="success">✅ Profile reset complete!</div>';
                    } else {
                        throw new Error(data.error || 'Reset failed');
                    }
                } catch (error) {
                    console.error('❌ Error resetting profile:', error);
                    document.getElementById('profileResult').innerHTML = 
                        '<div style="color: red;">❌ Error: ' + error.message + '</div>';
                }
            }
            
            function goToOnboarding() {
                window.location.href = '/onboarding';
            }
            
            function goToHome() {
                window.location.href = '/';
            }
        </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}