import fetch from 'node-fetch';

async function testDeleteAPI() {
  const DEBT_ID = 15; // The test debt ID we created
  const API_URL = `http://localhost:3002/api/debts/${DEBT_ID}/delete-with-sync`;
  
  console.log("🔧 Testing debt deletion API...\n");
  console.log("API Endpoint:", API_URL);
  console.log("Method: DELETE");
  console.log("Debt ID:", DEBT_ID);
  console.log("\n" + "=".repeat(60));
  
  try {
    // You'll need to get a valid session cookie from your browser
    // Open DevTools > Application > Cookies and copy the session cookie value
    const SESSION_COOKIE = 'YOUR_SESSION_COOKIE_HERE'; // Replace this
    
    console.log("⚠️  NOTE: You need to update the SESSION_COOKIE in this script");
    console.log("   1. Open your browser DevTools (F12)");
    console.log("   2. Go to Application > Cookies");
    console.log("   3. Copy the 'connect.sid' cookie value");
    console.log("   4. Replace 'YOUR_SESSION_COOKIE_HERE' in this script");
    console.log("\nAlternatively, test deletion through the UI:");
    console.log("   1. Go to http://localhost:5173/debt-management-center");
    console.log("   2. Click the checkbox next to 'TEST Credit Card - DELETE ME'");
    console.log("   3. Confirm deletion in the popup");
    console.log("\n" + "=".repeat(60));
    
    if (SESSION_COOKIE === 'YOUR_SESSION_COOKIE_HERE') {
      console.log("\n❌ Please update SESSION_COOKIE first!");
      console.log("Or test through the UI as described above.");
      process.exit(1);
    }
    
    console.log("\n📡 Sending DELETE request...");
    const response = await fetch(API_URL, {
      method: 'DELETE',
      headers: {
        'Cookie': `connect.sid=${SESSION_COOKIE}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = responseText;
    }
    
    console.log("\n📨 Response Status:", response.status);
    console.log("Response:", result);
    
    if (response.ok && result.success) {
      console.log("\n✅ Debt deleted successfully!");
      console.log("   Deleted debt:", result.debtName || "TEST Credit Card - DELETE ME");
      console.log("\n🔍 Run 'npx tsx verify-debt-deletion.ts' to verify the deletion");
    } else {
      console.log("\n❌ Deletion failed!");
      console.log("   Error:", result.error || "Unknown error");
    }
    
  } catch (error) {
    console.error("\n❌ Request failed:", error);
    console.log("\n💡 Make sure:");
    console.log("   1. The server is running (npm run dev)");
    console.log("   2. You're logged in to the app");
    console.log("   3. The SESSION_COOKIE is valid");
  }
  
  process.exit(0);
}

testDeleteAPI();