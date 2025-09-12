import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { financialProfiles } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    
    // Fetch financial profile
    const profile = await db.query.financialProfiles.findFirst({
      where: eq(financialProfiles.userId, userId),
    });

    if (!profile) {
      return res.json({ assets: [], summary: {} });
    }

    const assets = [];
    
    // Process bank accounts
    if (profile.bankAccounts && Array.isArray(profile.bankAccounts)) {
      for (const account of profile.bankAccounts) {
        assets.push({
          type: 'bank',
          name: account.institutionName || 'Bank Account',
          value: account.balance || 0,
          ownership: account.ownership || 'individual',
          requiresBeneficiary: account.accountType === 'payable_on_death',
          hasBeneficiary: account.podBeneficiary ? true : false,
          beneficiary: account.podBeneficiary || null,
        });
      }
    }

    // Process investment accounts
    if (profile.investmentAccounts && Array.isArray(profile.investmentAccounts)) {
      for (const account of profile.investmentAccounts) {
        assets.push({
          type: 'investment',
          name: account.institutionName || 'Investment Account',
          value: account.balance || 0,
          ownership: account.ownership || 'individual',
          requiresBeneficiary: account.accountType === 'tod',
          hasBeneficiary: account.todBeneficiary ? true : false,
          beneficiary: account.todBeneficiary || null,
        });
      }
    }

    // Process retirement accounts - always require beneficiaries
    if (profile.retirementAccounts && Array.isArray(profile.retirementAccounts)) {
      for (const account of profile.retirementAccounts) {
        assets.push({
          type: 'retirement',
          name: `${account.accountType?.toUpperCase() || 'Retirement'} - ${account.institutionName || 'Unknown'}`,
          value: account.balance || 0,
          ownership: 'individual', // Retirement accounts are always individual
          requiresBeneficiary: true,
          hasBeneficiary: account.beneficiaries && account.beneficiaries.primary ? true : false,
          beneficiary: account.beneficiaries?.primary || null,
        });
      }
    }

    // Process real estate
    if (profile.primaryResidence) {
      assets.push({
        type: 'real_estate',
        name: 'Primary Residence',
        value: (profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0),
        ownership: profile.primaryResidence.ownership || 'individual',
        requiresBeneficiary: false,
        hasBeneficiary: false,
      });
    }

    // Process life insurance - always requires beneficiaries
    if (profile.lifeInsurance?.hasPolicy) {
      assets.push({
        type: 'life_insurance',
        name: `Life Insurance - ${profile.lifeInsurance.policyType || 'Unknown Type'}`,
        value: profile.lifeInsurance.coverageAmount || 0,
        ownership: 'individual',
        requiresBeneficiary: true,
        hasBeneficiary: profile.lifeInsurance.beneficiaries?.primary ? true : false,
        beneficiary: profile.lifeInsurance.beneficiaries?.primary || null,
      });
    }

    // Calculate summary statistics
    const summary = {
      totalAssets: assets.reduce((sum, asset) => sum + asset.value, 0),
      assetsRequiringBeneficiaries: assets.filter(a => a.requiresBeneficiary).length,
      assetsWithBeneficiaries: assets.filter(a => a.requiresBeneficiary && a.hasBeneficiary).length,
      assetsMissingBeneficiaries: assets.filter(a => a.requiresBeneficiary && !a.hasBeneficiary).length,
      probateAssets: assets.filter(a => a.ownership === 'individual' && !a.requiresBeneficiary).length,
      nonProbateAssets: assets.filter(a => a.ownership !== 'individual' || a.requiresBeneficiary).length,
    };

    res.json({ assets, summary });
  } catch (error) {
    console.error('Error fetching ownership data:', error);
    res.status(500).json({ error: 'Failed to fetch ownership data' });
  }
});

export default router;