import {
  getAgeCatchUpEligibility,
  getContributionLimit,
  validateContribution,
  validateCombinedContributions,
  CONTRIBUTION_LIMITS_2025
} from '../retirement-contribution-limits';

describe('Retirement Contribution Limits', () => {
  describe('getAgeCatchUpEligibility', () => {
    it('should return no catch-up for age under 50', () => {
      const birthDate = new Date('1980-01-01'); // 45 years old in 2025
      const eligibility = getAgeCatchUpEligibility(birthDate);
      
      expect(eligibility.isEligibleForCatchUp).toBe(false);
      expect(eligibility.isEligibleForEnhancedCatchUp).toBe(false);
      expect(eligibility.catchUpAmount).toBe(0);
    });
    
    it('should return standard catch-up for ages 50-59', () => {
      const birthDate = new Date('1970-01-01'); // 55 years old in 2025
      const eligibility = getAgeCatchUpEligibility(birthDate);
      
      expect(eligibility.isEligibleForCatchUp).toBe(true);
      expect(eligibility.isEligibleForEnhancedCatchUp).toBe(false);
      expect(eligibility.catchUpAmount).toBe(7500);
    });
    
    it('should return enhanced catch-up for ages 60-63', () => {
      const birthDate = new Date('1963-01-01'); // 62 years old in 2025
      const eligibility = getAgeCatchUpEligibility(birthDate);
      
      expect(eligibility.isEligibleForCatchUp).toBe(true);
      expect(eligibility.isEligibleForEnhancedCatchUp).toBe(true);
      expect(eligibility.catchUpAmount).toBe(11250);
    });
    
    it('should return standard catch-up for age 64+', () => {
      const birthDate = new Date('1960-01-01'); // 65 years old in 2025
      const eligibility = getAgeCatchUpEligibility(birthDate);
      
      expect(eligibility.isEligibleForCatchUp).toBe(true);
      expect(eligibility.isEligibleForEnhancedCatchUp).toBe(false);
      expect(eligibility.catchUpAmount).toBe(7500);
    });
  });
  
  describe('getContributionLimit', () => {
    it('should return correct limit for 401k under 50', () => {
      const birthDate = new Date('1980-01-01');
      const limit = getContributionLimit('401k', birthDate);
      expect(limit).toBe(23500);
    });
    
    it('should return correct limit for 401k age 50+', () => {
      const birthDate = new Date('1970-01-01');
      const limit = getContributionLimit('401k', birthDate);
      expect(limit).toBe(31000); // 23500 + 7500
    });
    
    it('should return correct limit for 401k age 60-63', () => {
      const birthDate = new Date('1963-01-01');
      const limit = getContributionLimit('401k', birthDate);
      expect(limit).toBe(34750); // 23500 + 11250
    });
    
    it('should return correct limit for Traditional IRA', () => {
      const birthDate = new Date('1980-01-01');
      const limit = getContributionLimit('traditional-ira', birthDate);
      expect(limit).toBe(7000);
    });
    
    it('should return correct limit for Traditional IRA age 50+', () => {
      const birthDate = new Date('1970-01-01');
      const limit = getContributionLimit('traditional-ira', birthDate);
      expect(limit).toBe(8000); // 7000 + 1000
    });
    
    it('should return total limit when including employer contributions', () => {
      const birthDate = new Date('1980-01-01');
      const limit = getContributionLimit('401k', birthDate, true);
      expect(limit).toBe(70000);
    });
  });
  
  describe('validateContribution', () => {
    it('should validate valid contribution', () => {
      const birthDate = new Date('1980-01-01');
      const result = validateContribution(20000, '401k', birthDate);
      
      expect(result.isValid).toBe(true);
      expect(result.limit).toBe(23500);
    });
    
    it('should reject contribution exceeding limit', () => {
      const birthDate = new Date('1980-01-01');
      const result = validateContribution(25000, '401k', birthDate);
      
      expect(result.isValid).toBe(false);
      expect(result.limit).toBe(23500);
      expect(result.message).toContain('exceeds the 2025 limit');
    });
    
    it('should validate monthly contributions correctly', () => {
      const birthDate = new Date('1980-01-01');
      const monthlyAmount = 2000; // $24,000 annually
      const result = validateContribution(monthlyAmount, '401k', birthDate, false);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('24,000');
      expect(result.message).toContain('exceeds the 2025 limit of $23,500');
    });
    
    it('should provide helpful message for those approaching catch-up age', () => {
      const birthDate = new Date('1977-01-01'); // 48 years old
      const result = validateContribution(25000, '401k', birthDate);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("You'll be eligible for catch-up contributions at age 50 (in 2 years)");
    });
  });
  
  describe('validateCombinedContributions', () => {
    it('should validate combined 401k and 403b contributions', () => {
      const birthDate = new Date('1980-01-01');
      const accounts = [
        { type: '401k', employeeContribution: 1000 }, // $12,000/year
        { type: '403b', employeeContribution: 1000 }  // $12,000/year
      ];
      
      const result = validateCombinedContributions(accounts, birthDate);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].total).toBe(24000);
      expect(result.violations[0].limit).toBe(23500);
      expect(result.violations[0].message).toContain('Combined annual employee contributions to 401(k), 403(b), and 457(b)');
    });
    
    it('should validate combined Traditional and Roth IRA contributions', () => {
      const birthDate = new Date('1980-01-01');
      const accounts = [
        { type: 'traditional-ira', employeeContribution: 400 }, // $4,800/year
        { type: 'roth-ira', employeeContribution: 300 }        // $3,600/year
      ];
      
      const result = validateCombinedContributions(accounts, birthDate);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].total).toBe(8400);
      expect(result.violations[0].limit).toBe(7000);
      expect(result.violations[0].message).toContain('Combined annual contributions to Traditional and Roth IRAs');
    });
    
    it('should pass validation when within limits', () => {
      const birthDate = new Date('1980-01-01');
      const accounts = [
        { type: '401k', employeeContribution: 1500, employerContribution: 500 }, // $18,000 employee + $6,000 employer
        { type: 'traditional-ira', employeeContribution: 500 } // $6,000/year
      ];
      
      const result = validateCombinedContributions(accounts, birthDate);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});