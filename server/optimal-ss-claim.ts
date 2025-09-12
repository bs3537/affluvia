// Calculate optimal Social Security claiming ages for user and spouse separately
// based on intake form data, maximizing lifetime benefits using discounted NPV.

import { calculateSocialSecurityBenefit } from './social-security-calculator.js';

// Helper function to calculate Full Retirement Age (FRA) based on birth year
function calculateFRA(birthYear: number): number {
  if (birthYear <= 1937) return 65;
  if (birthYear === 1938) return 65 + 2/12;
  if (birthYear === 1939) return 65 + 4/12;
  if (birthYear === 1940) return 65 + 6/12;
  if (birthYear === 1941) return 65 + 8/12;
  if (birthYear === 1942) return 65 + 10/12;
  if (birthYear >= 1943 && birthYear <= 1954) return 66;
  if (birthYear === 1955) return 66 + 2/12;
  if (birthYear === 1956) return 66 + 4/12;
  if (birthYear === 1957) return 66 + 6/12;
  if (birthYear === 1958) return 66 + 8/12;
  if (birthYear === 1959) return 66 + 10/12;
  return 67; // For 1960 and later
}

// Helper to calculate current age from dateOfBirth string (format YYYY-MM-DD)
function calculateCurrentAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Function to calculate monthly benefit based on claiming age
function calculateMonthlyBenefit(pia: number, fra: number, claimAge: number): number {
  const monthsFromFRA = (claimAge - fra) * 12;

  if (monthsFromFRA < 0) {
    // Early claiming reduction
    const absMonths = Math.abs(monthsFromFRA);
    let reduction = 0;
    if (absMonths <= 36) {
      reduction = (5/9 / 100) * absMonths;
    } else {
      reduction = (5/9 / 100) * 36 + (5/12 / 100) * (absMonths - 36);
    }
    return pia * (1 - reduction);
  } else if (monthsFromFRA > 0) {
    // Delayed credits up to age 70
    const maxMonths = (70 - fra) * 12;
    const creditMonths = Math.min(monthsFromFRA, maxMonths);
    const credit = (8 / 100 / 12) * creditMonths; // 8% per year = 2/3% per month
    return pia * (1 + credit);
  }
  return pia;
}

// Function to calculate lifetime benefit NPV
function calculateLifetimeBenefit(
  claimingAge: number,
  lifeExpectancy: number,
  monthlyBenefit: number,
  discountRate: number = 0.03 // Default real discount rate
): number {
  const yearsReceiving = Math.max(0, lifeExpectancy - claimingAge);
  let npv = 0;
  for (let year = 0; year < yearsReceiving; year++) {
    const annualBenefit = monthlyBenefit * 12;
    npv += annualBenefit / Math.pow(1 + discountRate, year);
  }
  return npv;
}

// Main algorithm function
export function calculateOptimalSSClaimAges(intakeData: any): {
  user: { optimalAge: number; maxLifetimeBenefit: number };
  spouse?: { optimalAge: number; maxLifetimeBenefit: number };
} {
  console.log('=== CALCULATING OPTIMAL SS CLAIM AGES (UPDATED) ===');
  console.log('User annual income:', intakeData.annualIncome);
  console.log('Spouse annual income:', intakeData.spouseAnnualIncome);
  
  // User calculations
  const userBirthYear = new Date(intakeData.dateOfBirth).getFullYear();
  const userFRA = calculateFRA(userBirthYear);
  const userCurrentAge = calculateCurrentAge(intakeData.dateOfBirth);
  const userLifeExp = intakeData.userLifeExpectancy || 93; // Use 93 as standard
  
  // CRITICAL FIX: Calculate PIA from income using corrected algorithm
  let userPIA = 0;
  if (intakeData.annualIncome && intakeData.annualIncome > 0) {
    // Calculate benefit at FRA (67) to get base PIA
    const monthlyIncome = intakeData.annualIncome / 12;
    userPIA = calculateSocialSecurityBenefit(monthlyIncome, userCurrentAge, 67);
    console.log('Recalculated user PIA from income:', userPIA, '(was:', intakeData.socialSecurityBenefit || 0, ')');
  } else if (intakeData.socialSecurityBenefit) {
    // Fallback to stored value only if no income data
    userPIA = intakeData.socialSecurityBenefit;
    console.log('Using stored user PIA (no income data):', userPIA);
  }

  // Find optimal claiming age for user
  let userMaxNPV = 0;
  let userOptimalAge = 67;
  
  for (let age = Math.max(62, userCurrentAge); age <= 70; age++) {
    // Recalculate benefit for each claiming age
    const monthlyIncome = intakeData.annualIncome / 12;
    const monthlyBenefit = calculateSocialSecurityBenefit(monthlyIncome, userCurrentAge, age);
    const npv = calculateLifetimeBenefit(age, userLifeExp, monthlyBenefit);
    
    console.log(`User age ${age}: monthly=$${monthlyBenefit}, annual=$${monthlyBenefit * 12}, NPV=$${npv.toFixed(0)}`);
    
    if (npv > userMaxNPV) {
      userMaxNPV = npv;
      userOptimalAge = age;
    }
  }

  const result: any = {
    user: { 
      optimalAge: userOptimalAge, 
      maxLifetimeBenefit: Math.round(userMaxNPV)
    }
  };

  console.log('>>> User optimal age:', userOptimalAge, 'with NPV:', Math.round(userMaxNPV));

  // Spouse calculations if married
  if (intakeData.maritalStatus === 'married' && intakeData.spouseDateOfBirth) {
    const spouseBirthYear = new Date(intakeData.spouseDateOfBirth).getFullYear();
    const spouseFRA = calculateFRA(spouseBirthYear);
    const spouseCurrentAge = calculateCurrentAge(intakeData.spouseDateOfBirth);
    const spouseLifeExp = intakeData.spouseLifeExpectancy || 93; // Use 93 as standard
    
    // CRITICAL FIX: Calculate spouse PIA from income using corrected algorithm
    let spousePIA = 0;
    if (intakeData.spouseAnnualIncome && intakeData.spouseAnnualIncome > 0) {
      // Calculate benefit at FRA (67) to get base PIA
      const spouseMonthlyIncome = intakeData.spouseAnnualIncome / 12;
      spousePIA = calculateSocialSecurityBenefit(spouseMonthlyIncome, spouseCurrentAge, 67);
      console.log('Recalculated spouse PIA from income:', spousePIA, '(was:', intakeData.spouseSocialSecurityBenefit || 0, ')');
    } else if (intakeData.spouseSocialSecurityBenefit) {
      // Fallback to stored value only if no income data
      spousePIA = intakeData.spouseSocialSecurityBenefit;
      console.log('Using stored spouse PIA (no income data):', spousePIA);
    }

    if (spousePIA > 0 || intakeData.spouseAnnualIncome > 0) {
      let spouseMaxNPV = 0;
      let spouseOptimalAge = 67;
      
      for (let age = Math.max(62, spouseCurrentAge); age <= 70; age++) {
        // Recalculate benefit for each claiming age
        const spouseMonthlyIncome = intakeData.spouseAnnualIncome / 12;
        const monthlyBenefit = calculateSocialSecurityBenefit(spouseMonthlyIncome, spouseCurrentAge, age);
        const npv = calculateLifetimeBenefit(age, spouseLifeExp, monthlyBenefit);
        
        console.log(`Spouse age ${age}: monthly=$${monthlyBenefit}, annual=$${monthlyBenefit * 12}, NPV=$${npv.toFixed(0)}`);
        
        if (npv > spouseMaxNPV) {
          spouseMaxNPV = npv;
          spouseOptimalAge = age;
        }
      }

      result.spouse = { 
        optimalAge: spouseOptimalAge, 
        maxLifetimeBenefit: Math.round(spouseMaxNPV)
      };
      
      console.log('>>> Spouse optimal age:', spouseOptimalAge, 'with NPV:', Math.round(spouseMaxNPV));
    }
  }

  // Log combined results
  if (result.spouse) {
    const combinedNPV = result.user.maxLifetimeBenefit + result.spouse.maxLifetimeBenefit;
    console.log('>>> Combined household NPV:', Math.round(combinedNPV));
  }

  console.log('=== END SS OPTIMIZATION (UPDATED) ===');
  return result;
}