# Plaid Sandbox Testing Guide for Affluvia

## 🚀 Quick Start

Your Plaid integration is now ready for testing in Sandbox mode! Follow this guide to test the complete Plaid functionality.

## 📋 Prerequisites

### Environment Setup
Ensure your `.env` file has these values:
```env
PLAID_CLIENT_ID=68acc6a52d98f300233d5de6
PLAID_SECRET=851c2f99aa2566ed4b7ae1443e5602
PLAID_ENV=sandbox
PLAID_WEBHOOK_URL=http://localhost:3004/api/plaid/webhook
```

### Start the Application
```bash
# Start the development server
npm run dev

# The app will be available at:
# Frontend: http://localhost:3000
# Backend: http://localhost:3004
```

## 🧪 Testing Steps

### 1. Navigate to Settings
1. Log into your Affluvia account
2. Go to **Settings** from the dashboard
3. Click on the **Connected Accounts** tab

### 2. Connect a Test Bank Account

#### Test Credentials for Sandbox
When Plaid Link opens, use these test credentials:

**For a successful connection with all account types:**
- Username: `user_good`
- Password: `pass_good`

**For testing specific scenarios:**

| Scenario | Username | Password | Description |
|----------|----------|----------|-------------|
| Good credentials | `user_good` | `pass_good` | All products supported |
| No accounts | `user_empty` | `pass_good` | No accounts returned |
| Account locked | `user_locked` | `pass_good` | Account locked error |
| Wrong password | `user_good` | `pass_bad` | Invalid credentials error |
| MFA required | `user_mfa` | `pass_good` | Tests MFA flow |
| Custom accounts | `user_custom` | `{}` JSON | Create custom accounts |

#### Steps to Connect:
1. Click **"Connect Bank Account"** button
2. In the Plaid Link modal:
   - Select any bank (e.g., "Chase" or "Bank of America")
   - Enter username: `user_good`
   - Enter password: `pass_good`
   - Select accounts you want to connect
   - Click "Continue"
3. You'll be redirected back to Affluvia
4. Your accounts will appear in the Connected Accounts list

### 3. Test Account Types

The sandbox `user_good` credentials provide these test accounts:

#### Banking Accounts
- **Plaid Checking** - Checking account with $110 balance
- **Plaid Savings** - Savings account with $210 balance

#### Credit Cards
- **Plaid Credit Card** - Credit card with $410 balance

#### Investment Accounts
- **Plaid IRA** - Retirement account with holdings
- **Plaid 401k** - 401k retirement account
- **Plaid Investment** - Taxable investment account

#### Loans & Mortgages
- **Plaid Mortgage** - Mortgage account
- **Plaid Student Loan** - Student loan account

### 4. Test Data Sync

#### Manual Sync
1. In Connected Accounts, find your connected institution
2. Click the **Refresh** icon
3. Watch the sync status indicator
4. Verify updated balances

**Note**: You're limited to 3 manual syncs per day

#### Automatic Monthly Sync
- Configured for monthly updates
- Runs automatically at 2 AM on scheduled days
- Check Settings > Connected Accounts > Sync Settings

### 5. Test Different Sections

#### Dashboard
- Check if Net Worth includes Plaid accounts
- Verify Monthly Cash Flow shows Plaid transactions
- Confirm Financial Health Score uses Plaid data

#### Retirement Planning
- Navigate to Retirement Planning section
- Verify 401k/IRA accounts from Plaid appear
- Check if Monte Carlo simulations include Plaid retirement accounts

#### Debt Management
- Go to Debt Management Center
- Verify credit cards and loans from Plaid appear
- Check if balances match

#### Education Funding
- Navigate to Education Funding
- Check if any 529 accounts are detected
- Verify contribution detection

### 6. Test Update Mode (Re-authentication)

To test re-authentication flow:
1. Wait for an account to show "Needs Update" status
2. Or simulate by clicking the account that needs updating
3. Click **"Update Connection"** button
4. Re-enter credentials in Plaid Link
5. Verify connection is restored

### 7. Test Webhooks

Webhooks are automatically handled. To test:
1. Make changes in Plaid Dashboard (if you have access)
2. Or wait for scheduled updates
3. Check webhook logs in console

### 8. Test Error Scenarios

#### Connection Error
1. Use username: `user_locked`
2. Observe error handling
3. Check error message display

#### Invalid Credentials
1. Use password: `pass_bad`
2. Verify error feedback
3. Test retry functionality

## 📊 Verify Data Integration

### Check These Areas:

1. **Net Worth Calculation**
   - Should include all Plaid account balances
   - Assets: Checking, Savings, Investments
   - Liabilities: Credit Cards, Loans, Mortgages

2. **Cash Flow Analysis**
   - Income from Plaid transactions
   - Expenses categorized by type
   - Monthly trends

3. **Investment Holdings**
   - Portfolio allocation from Plaid
   - Individual holdings display
   - Performance metrics

4. **Retirement Accounts**
   - 401k and IRA balances
   - Contribution tracking
   - Projection calculations

## 🔍 Troubleshooting

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| "Failed to create link token" | Check PLAID_CLIENT_ID and PLAID_SECRET in .env |
| "No accounts found" | Ensure you selected accounts during Plaid Link |
| Sync not working | Check webhook URL configuration |
| Balances not updating | Try manual sync or check rate limits |
| Can't connect account | Verify you're using sandbox credentials |

### Check Logs
```bash
# Backend logs
# Look for [PlaidService], [PlaidWebhook], [PlaidSyncScheduler] messages

# Check browser console for frontend errors
```

## 🛡️ Security Features to Test

1. **Consent Management**
   - Grant consent before connecting accounts
   - Revoke consent removes all data

2. **Encryption**
   - All tokens encrypted at rest
   - Check database - no plain text tokens

3. **Audit Logging**
   - All operations logged
   - Check audit_logs table in database

4. **Rate Limiting**
   - 3 manual syncs per day
   - Test exceeding limit

## 📈 Data Validation

### Expected Data from Sandbox

With `user_good` credentials, you should see:

- **Total Assets**: ~$320 (Checking + Savings)
- **Total Liabilities**: ~$410 (Credit Card)
- **Net Worth**: ~-$90
- **Transactions**: Last 2 years of test transactions
- **Investment Holdings**: Sample stocks and bonds

## 🎯 Success Criteria

Your Plaid integration is working correctly if:

✅ Can connect accounts using sandbox credentials
✅ Account balances appear in dashboard
✅ Manual sync updates data
✅ Different account types are categorized correctly
✅ Retirement accounts show in retirement planning
✅ Debts appear in debt management
✅ Transactions are categorized
✅ Update mode works for re-authentication
✅ Security features (encryption, consent) work

## 🚀 Next Steps

Once sandbox testing is complete:

1. **Test all user flows** thoroughly
2. **Verify data accuracy** in calculations
3. **Test error scenarios** and edge cases
4. **Monitor performance** with multiple accounts
5. **Prepare for production** migration

## 📝 Notes for Production

When ready for production:

1. Update `.env`:
   ```env
   PLAID_ENV=production
   PLAID_SECRET=<production-secret>
   PLAID_WEBHOOK_URL=https://your-domain.com/api/plaid/webhook
   ```

2. Update webhook URL in Plaid Dashboard
3. Test with real bank accounts (carefully!)
4. Monitor initial production connections
5. Set up alerting for errors

---

**Support**: If you encounter issues, check:
- Console logs for errors
- Network tab for API failures
- Database for encrypted tokens
- Webhook events table for processing status

**Happy Testing! 🎉**