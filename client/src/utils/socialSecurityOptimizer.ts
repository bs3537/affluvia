interface SocialSecurityAnalysis {
  optimalClaimingAge: number;
  breakEvenAge: number;
  lifetimeBenefitAtOptimal: number;
  monthlyBenefitAtOptimal: number;
  analysisDetails: {
    age62Benefit: number;
    fullRetirementAgeBenefit: number;
    age70Benefit: number;
    lifetimeBenefitAt62: number;
    lifetimeBenefitAtFRA: number;
    lifetimeBenefitAt70: number;
  };
}

export function calculateOptimalSocialSecurityAge(
  currentAge: number,
  fullRetirementAge: number,
  primaryInsuranceAmount: number,
  lifeExpectancy: number,
  discountRate: number = 0.03
): SocialSecurityAnalysis {
  // Calculate benefits at different claiming ages
  const benefitAt62 = calculateBenefitAtAge(62, fullRetirementAge, primaryInsuranceAmount);
  const benefitAtFRA = primaryInsuranceAmount;
  const benefitAt70 = calculateBenefitAtAge(70, fullRetirementAge, primaryInsuranceAmount);
  
  // Calculate lifetime benefits for each claiming age
  const lifetimeAt62 = calculateLifetimeBenefit(62, lifeExpectancy, benefitAt62, discountRate);
  const lifetimeAtFRA = calculateLifetimeBenefit(fullRetirementAge, lifeExpectancy, benefitAtFRA, discountRate);
  const lifetimeAt70 = calculateLifetimeBenefit(70, lifeExpectancy, benefitAt70, discountRate);
  
  // Find optimal claiming age by testing each month from 62 to 70
  let optimalAge = 62;
  let maxLifetimeBenefit = lifetimeAt62;
  let optimalMonthlyBenefit = benefitAt62;
  
  for (let age = 62; age <= 70; age += 1/12) {
    const monthlyBenefit = calculateBenefitAtAge(age, fullRetirementAge, primaryInsuranceAmount);
    const lifetimeBenefit = calculateLifetimeBenefit(age, lifeExpectancy, monthlyBenefit, discountRate);
    
    if (lifetimeBenefit > maxLifetimeBenefit) {
      maxLifetimeBenefit = lifetimeBenefit;
      optimalAge = age;
      optimalMonthlyBenefit = monthlyBenefit;
    }
  }
  
  // Calculate break-even age between claiming at 62 vs FRA
  const breakEvenAge = calculateBreakEvenAge(62, fullRetirementAge, benefitAt62, benefitAtFRA);
  
  return {
    optimalClaimingAge: Math.round(optimalAge * 12) / 12, // Round to nearest month
    breakEvenAge: Math.round(breakEvenAge * 12) / 12,
    lifetimeBenefitAtOptimal: Math.round(maxLifetimeBenefit),
    monthlyBenefitAtOptimal: Math.round(optimalMonthlyBenefit),
    analysisDetails: {
      age62Benefit: Math.round(benefitAt62),
      fullRetirementAgeBenefit: Math.round(benefitAtFRA),
      age70Benefit: Math.round(benefitAt70),
      lifetimeBenefitAt62: Math.round(lifetimeAt62),
      lifetimeBenefitAtFRA: Math.round(lifetimeAtFRA),
      lifetimeBenefitAt70: Math.round(lifetimeAt70)
    }
  };
}

export function calculateBenefitAtAge(claimingAge: number, fullRetirementAge: number, primaryInsuranceAmount: number): number {
  if (claimingAge < 62) return 0;
  if (claimingAge > 70) claimingAge = 70;
  
  // 2025 maximum monthly benefits per SSA
  const maxBenefits: { [key: number]: number } = {
    62: 2831,
    63: 3012,
    64: 3209,
    65: 3423,
    66: 3712,
    67: 4043,  // Full retirement age for those born 1960 or later
    68: 4366,
    69: 4712,
    70: 5108
  };
  
  let benefit: number;
  
  if (claimingAge < fullRetirementAge) {
    // Early retirement reduction
    const monthsEarly = (fullRetirementAge - claimingAge) * 12;
    let reduction = 0;
    
    if (monthsEarly <= 36) {
      // 5/9 of 1% per month for first 36 months
      reduction = monthsEarly * (5/9) / 100;
    } else {
      // 5/9 of 1% for first 36 months, then 5/12 of 1% for additional months
      reduction = 36 * (5/9) / 100 + (monthsEarly - 36) * (5/12) / 100;
    }
    
    benefit = primaryInsuranceAmount * (1 - reduction);
  } else if (claimingAge > fullRetirementAge) {
    // Delayed retirement credits: 8% per year (2/3% per month)
    const monthsDelayed = Math.min((claimingAge - fullRetirementAge) * 12, (70 - fullRetirementAge) * 12);
    const increase = monthsDelayed * (2/3) / 100;
    
    benefit = primaryInsuranceAmount * (1 + increase);
  } else {
    benefit = primaryInsuranceAmount;
  }
  
  // Apply maximum benefit cap based on claiming age
  const roundedAge = Math.round(claimingAge);
  const maxBenefit = maxBenefits[roundedAge] || maxBenefits[70];
  
  return Math.min(benefit, maxBenefit);
}

function calculateLifetimeBenefit(
  claimingAge: number,
  lifeExpectancy: number,
  monthlyBenefit: number,
  discountRate: number
): number {
  if (claimingAge >= lifeExpectancy) return 0;
  
  const monthsOfBenefits = (lifeExpectancy - claimingAge) * 12;
  let presentValue = 0;
  const monthlyDiscountRate = discountRate / 12;
  
  for (let month = 0; month < monthsOfBenefits; month++) {
    // Apply 2.6% annual COLA (25-year historical average)
    const colaAdjustedBenefit = monthlyBenefit * Math.pow(1.026, month / 12);
    const discountFactor = Math.pow(1 + monthlyDiscountRate, month);
    presentValue += colaAdjustedBenefit / discountFactor;
  }
  
  return presentValue;
}

function calculateBreakEvenAge(
  earlyAge: number,
  laterAge: number,
  earlyBenefit: number,
  laterBenefit: number
): number {
  // Calculate cumulative benefits until they equal
  const monthsHeadStart = (laterAge - earlyAge) * 12;
  const cumulativeEarlyBenefits = monthsHeadStart * earlyBenefit;
  
  // How many months of the higher benefit to catch up
  const monthlyDifference = laterBenefit - earlyBenefit;
  const monthsToBreakEven = cumulativeEarlyBenefits / monthlyDifference;
  
  return laterAge + (monthsToBreakEven / 12);
}

// Helper function to calculate PIA from earnings history
export function calculatePrimaryInsuranceAmount(averageIndexedMonthlyEarnings: number): number {
  // 2025 bend points
  const firstBendPoint = 1226;
  const secondBendPoint = 7391;
  
  // Note: Maximum PIA for 2025 is approximately $4,194/month at full retirement age
  // This assumes maximum taxable earnings for 35+ years
  
  let pia = 0;
  
  if (averageIndexedMonthlyEarnings <= firstBendPoint) {
    pia = averageIndexedMonthlyEarnings * 0.90;
  } else if (averageIndexedMonthlyEarnings <= secondBendPoint) {
    pia = firstBendPoint * 0.90 + (averageIndexedMonthlyEarnings - firstBendPoint) * 0.32;
  } else {
    pia = firstBendPoint * 0.90 + (secondBendPoint - firstBendPoint) * 0.32 + (averageIndexedMonthlyEarnings - secondBendPoint) * 0.15;
  }
  
  return pia;
}

// Calculate AIME from annual income
export function calculateAIME(currentIncome: number, currentAge: number, retirementAge: number = 67): number {
  // AIME is based on average monthly earnings over highest 35 years
  // For simplification, we'll use current income as a proxy for career average
  // and apply a factor to account for typical career earnings progression
  
  // Career progression factor: people typically earn less early in career
  // Using age-based adjustment: younger people's current income likely represents
  // a higher percentile of their career average
  let careerAverageFactor = 1.0;
  
  if (currentAge < 30) {
    careerAverageFactor = 0.7; // Early career typically lower earnings
  } else if (currentAge < 40) {
    careerAverageFactor = 0.85; // Mid-career progression
  } else if (currentAge < 50) {
    careerAverageFactor = 0.95; // Peak earning years
  } else {
    careerAverageFactor = 1.0; // Plateau/peak maintained
  }
  
  // Calculate estimated average annual income over career
  const estimatedCareerAverageIncome = currentIncome * careerAverageFactor;
  
  // Convert to monthly (AIME is Average Indexed MONTHLY Earnings)
  const aime = estimatedCareerAverageIncome / 12;
  
  // Cap at Social Security wage base (2025: $176,100/year = $14,675/month)
  const ssWageBase = 176100;
  const maxAIME = ssWageBase / 12;
  
  return Math.min(aime, maxAIME);
}