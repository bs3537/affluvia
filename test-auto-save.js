#!/usr/bin/env node

/**
 * Test script to verify auto-save functionality
 * Run this after filling some data in Step 1 of the intake form
 */

async function testAutoSave() {
  console.log('🧪 Testing auto-save functionality...\n');
  
  // You'll need to get these values from your browser session
  // 1. Open browser dev tools
  // 2. Go to Application/Storage tab
  // 3. Find the session cookie value
  const SESSION_COOKIE = 'YOUR_SESSION_COOKIE_HERE';
  
  try {
    // Test fetching saved profile
    console.log('📥 Fetching saved financial profile...');
    const response = await fetch('http://localhost:3004/api/financial-profile', {
      headers: {
        'Cookie': `connect.sid=${SESSION_COOKIE}`
      }
    });
    
    if (!response.ok) {
      console.error('❌ Failed to fetch profile:', response.status);
      return;
    }
    
    const profile = await response.json();
    
    // Check if personal info from Step 1 is saved
    console.log('\n✅ Saved Profile Data:');
    console.log('- First Name:', profile.firstName || '(empty)');
    console.log('- Last Name:', profile.lastName || '(empty)');
    console.log('- Date of Birth:', profile.dateOfBirth || '(empty)');
    console.log('- Marital Status:', profile.maritalStatus || '(empty)');
    console.log('- State:', profile.state || '(empty)');
    
    if (profile.firstName || profile.lastName) {
      console.log('\n✅ AUTO-SAVE IS WORKING! Data is persisted in database.');
    } else {
      console.log('\n❌ No data found. Auto-save might not be working.');
    }
    
    // Check for other step data
    if (profile.annualIncome) {
      console.log('\n📊 Step 2 Data Found:');
      console.log('- Annual Income:', profile.annualIncome);
      console.log('- Employment Status:', profile.employmentStatus);
    }
    
  } catch (error) {
    console.error('❌ Error testing auto-save:', error);
  }
}

// Instructions for manual testing
console.log('='.repeat(60));
console.log('AUTO-SAVE TESTING INSTRUCTIONS');
console.log('='.repeat(60));
console.log('\n1. Open the intake form in your browser');
console.log('2. Fill in Step 1 (Personal Information) with test data');
console.log('3. Wait 3-5 seconds for auto-save to trigger');
console.log('4. Open browser dev tools (F12)');
console.log('5. Go to Console tab');
console.log('6. Look for "Auto-save successful at step 1" message');
console.log('7. Go to Network tab');
console.log('8. Look for PUT request to /api/financial-profile');
console.log('9. Check the request payload - it should include:');
console.log('   - isPartialSave: true');
console.log('   - skipCalculations: true');
console.log('   - currentStep: 1');
console.log('   - Your form data');
console.log('\n10. To verify data is saved:');
console.log('    - Refresh the page or navigate away');
console.log('    - Return to intake form');
console.log('    - Check if your data is still there');
console.log('\n='.repeat(60));

// If you want to run the automated test, update SESSION_COOKIE above
// testAutoSave();