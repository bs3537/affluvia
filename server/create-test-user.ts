import { db } from './db';
import { users, financialProfiles } from '../shared/schema';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function createTestUser() {
  try {
    console.log('Creating test user and financial profile...\n');
    
    // Create test user
    async function hashPassword(password: string) {
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      return `${buf.toString("hex")}.${salt}`;
    }
    
    const hashedPassword = await hashPassword('testpass123');
    
    const [newUser] = await db.insert(users).values({
      email: 'test@example.com',
      password: hashedPassword
    }).returning();
    
    console.log('✅ User created:', newUser.email);
    
    // Create comprehensive financial profile
    const testProfile = {
      userId: newUser.id,
      
      // Personal Information
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1974-01-01',
      maritalStatus: 'married',
      dependents: 2,
      spouseName: 'Jane Doe',
      spouseDateOfBirth: '1974-01-01',
      state: 'CA',
      
      // Employment & Income
      employmentStatus: 'employed',
      annualIncome: '60000',
      spouseAnnualIncome: '450000',
      
      // Assets
      assets: JSON.stringify([
        { type: '401k', value: 400000, owner: 'user' },
        { type: 'savings', value: 32000, owner: 'user' },
        { type: 'checking', value: 50000, owner: 'user' },
        { type: 'other', value: 120000, owner: 'user' }
      ]),
      
      // Retirement Planning
      desiredRetirementAge: 65,
      spouseDesiredRetirementAge: 65,
      userLifeExpectancy: 85,
      spouseLifeExpectancy: 88,
      socialSecurityBenefit: '2000',
      spouseSocialSecurityBenefit: '3200',
      socialSecurityClaimAge: 67,
      spouseSocialSecurityClaimAge: 67,
      expectedMonthlyExpensesRetirement: '8000',
      
      // Monthly Contributions
      monthlyContribution401k: '1500',
      monthlyContributionIRA: '500',
      monthlyContributionRothIRA: '500',
      monthlyContributionBrokerage: '500',
      
      // Investment
      expectedRealReturn: '7',
      
      // Insurance
      hasLongTermCareInsurance: true,
      
      // Risk Profile
      riskTolerance: 'moderate',
      
      // Mark as complete
      isComplete: true,
      
      // Additional fields for calculations
      gender: 'male',
      spouseGender: 'female',
      userGender: 'male',
      userHealthStatus: 'good',
      spouseHealthStatus: 'good',
      
      // Monthly expenses breakdown
      monthlyExpenses: JSON.stringify({
        housing: 3000,
        food: 1000,
        transportation: 500,
        healthcare: 500,
        utilities: 300,
        entertainment: 500,
        other: 2200
      }),
      
      // Estate planning
      hasWill: true,
      hasTrust: false,
      hasPowerOfAttorney: true,
      hasHealthcareProxy: true,
      hasBeneficiaries: true,
      
      // Goals
      goals: JSON.stringify([
        {
          type: 'retirement',
          description: 'Comfortable retirement',
          targetAmount: 2000000,
          targetDate: '2039-01-01',
          priority: 1
        },
        {
          type: 'college',
          description: 'College for kids',
          targetAmount: 200000,
          targetDate: '2035-01-01',
          priority: 2
        }
      ])
    };
    
    const [newProfile] = await db.insert(financialProfiles).values(testProfile).returning();
    
    console.log('✅ Financial profile created for user ID:', newProfile.userId);
    
    console.log('\n' + '='.repeat(50));
    console.log('Test user created successfully!');
    console.log('Email: test@example.com');
    console.log('Password: testpass123');
    console.log('\nProfile summary:');
    console.log('- Married couple, both age 50');
    console.log('- Combined income: $510,000');
    console.log('- Total assets: $602,000');
    console.log('- Monthly retirement expenses: $8,000');
    console.log('- Monthly contributions: $3,000');
    console.log('- Has LTC insurance: Yes');
    console.log('\nYou can now:');
    console.log('1. Login at http://localhost:5173');
    console.log('2. View the dashboard with all calculations');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();