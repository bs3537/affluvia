import type { 
  EstatePlan, 
  EstateDocument, 
  EstateBeneficiary, 
  EstateTrust, 
  EstateScenario 
} from '@shared/schema';

class EstatePlanningService {
  // Estate Plan
  async getEstatePlan(): Promise<EstatePlan | null> {
    const response = await fetch('/api/estate-plan', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch estate plan');
    }
    
    return response.json();
  }

  async createEstatePlan(plan: Partial<EstatePlan>): Promise<EstatePlan> {
    const response = await fetch('/api/estate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(plan),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create estate plan');
    }
    
    return response.json();
  }

  async updateEstatePlan(planId: number, updates: Partial<EstatePlan>): Promise<EstatePlan> {
    const response = await fetch(`/api/estate-plan/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update estate plan');
    }
    
    return response.json();
  }

  // Estate Documents
  async getEstateDocuments(estatePlanId?: number): Promise<EstateDocument[]> {
    const url = estatePlanId 
      ? `/api/estate-documents?estatePlanId=${estatePlanId}`
      : '/api/estate-documents';
      
    const response = await fetch(url, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    
    return response.json();
  }

  async createEstateDocument(document: Partial<EstateDocument>): Promise<EstateDocument> {
    const response = await fetch('/api/estate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(document),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create document');
    }
    
    return response.json();
  }

  async updateEstateDocument(documentId: number, updates: Partial<EstateDocument>): Promise<EstateDocument> {
    const response = await fetch(`/api/estate-documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update document');
    }
    
    return response.json();
  }

  async deleteEstateDocument(documentId: number): Promise<void> {
    const response = await fetch(`/api/estate-documents/${documentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete document');
    }
  }

  // Estate Beneficiaries
  async getEstateBeneficiaries(estatePlanId?: number): Promise<EstateBeneficiary[]> {
    const url = estatePlanId 
      ? `/api/estate-beneficiaries?estatePlanId=${estatePlanId}`
      : '/api/estate-beneficiaries';
      
    const response = await fetch(url, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch beneficiaries');
    }
    
    return response.json();
  }

  async createEstateBeneficiary(beneficiary: Partial<EstateBeneficiary>): Promise<EstateBeneficiary> {
    const response = await fetch('/api/estate-beneficiaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(beneficiary),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create beneficiary');
    }
    
    return response.json();
  }

  async updateEstateBeneficiary(beneficiaryId: number, updates: Partial<EstateBeneficiary>): Promise<EstateBeneficiary> {
    const response = await fetch(`/api/estate-beneficiaries/${beneficiaryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update beneficiary');
    }
    
    return response.json();
  }

  async deleteEstateBeneficiary(beneficiaryId: number): Promise<void> {
    const response = await fetch(`/api/estate-beneficiaries/${beneficiaryId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete beneficiary');
    }
  }

  // Estate Trusts
  async getEstateTrusts(estatePlanId?: number): Promise<EstateTrust[]> {
    const url = estatePlanId 
      ? `/api/estate-trusts?estatePlanId=${estatePlanId}`
      : '/api/estate-trusts';
      
    const response = await fetch(url, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch trusts');
    }
    
    return response.json();
  }

  async createEstateTrust(trust: Partial<EstateTrust>): Promise<EstateTrust> {
    const response = await fetch('/api/estate-trusts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(trust),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create trust');
    }
    
    return response.json();
  }

  async updateEstateTrust(trustId: number, updates: Partial<EstateTrust>): Promise<EstateTrust> {
    const response = await fetch(`/api/estate-trusts/${trustId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update trust');
    }
    
    return response.json();
  }

  async deleteEstateTrust(trustId: number): Promise<void> {
    const response = await fetch(`/api/estate-trusts/${trustId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete trust');
    }
  }

  // Estate Scenarios
  async getEstateScenarios(estatePlanId?: number): Promise<EstateScenario[]> {
    const url = estatePlanId 
      ? `/api/estate-scenarios?estatePlanId=${estatePlanId}`
      : '/api/estate-scenarios';
      
    const response = await fetch(url, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch scenarios');
    }
    
    return response.json();
  }

  async createEstateScenario(scenario: Partial<EstateScenario>): Promise<EstateScenario> {
    const response = await fetch('/api/estate-scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(scenario),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create scenario');
    }
    
    return response.json();
  }

  async updateEstateScenario(scenarioId: number, updates: Partial<EstateScenario>): Promise<EstateScenario> {
    const response = await fetch(`/api/estate-scenarios/${scenarioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update scenario');
    }
    
    return response.json();
  }

  async generateEstateInsights(): Promise<{ insights: any }> {
    const response = await fetch('/api/estate-plan/insights', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to generate estate insights');
    }

    return response.json();
  }

  async deleteEstateScenario(scenarioId: number): Promise<void> {
    const response = await fetch(`/api/estate-scenarios/${scenarioId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete scenario');
    }
  }

  // Helper function to create initial estate plan from intake form data
  async createInitialEstatePlanFromProfile(profile: any): Promise<EstatePlan | null> {
    if (!profile) return null;

    // Calculate total estate value
    const assets = Array.isArray(profile.assets) ? profile.assets : [];
    const totalAssets = assets.reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
    
    const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
    const totalLiabilities = liabilities.reduce((sum: number, liability: any) => sum + (liability.balance || 0), 0);
    
    const homeEquity = profile.primaryResidence ? 
      (profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0) : 0;
    
    const totalEstateValue = totalAssets + homeEquity - totalLiabilities;

    // Create initial estate plan
    const charitableGoal = Number(profile?.legacyGoal || 0) || 0;
    const estatePlan = await this.createEstatePlan({
      totalEstateValue: totalEstateValue.toString(),
      liquidAssets: totalAssets.toString(),
      illiquidAssets: homeEquity.toString(),
      // Seed charitable plan from intake legacy goal when available
      ...(charitableGoal > 0 ? {
        charitableGifts: {
          plannedTotal: charitableGoal,
          source: 'intake',
          note: 'Seeded from intake charitable goal (future dollars)'
        }
      } : {})
    });

    // Create initial documents based on intake form (best-effort; don't fail plan creation if these fail)
    try {
      if (profile.hasWill) {
        await this.createEstateDocument({
          estatePlanId: estatePlan.id,
          documentType: 'will',
          documentName: 'Last Will and Testament',
          status: 'executed',
          description: 'Current will on file',
        });
      }
      if (profile.hasTrust) {
        await this.createEstateDocument({
          estatePlanId: estatePlan.id,
          documentType: 'trust',
          documentName: 'Revocable Living Trust',
          status: 'executed',
          description: 'Current trust on file',
        });
      }
      if (profile.hasPowerOfAttorney) {
        await this.createEstateDocument({
          estatePlanId: estatePlan.id,
          documentType: 'poa',
          documentName: 'Financial Power of Attorney',
          status: 'executed',
          description: 'Current POA on file',
        });
      }
      if (profile.hasHealthcareProxy) {
        await this.createEstateDocument({
          estatePlanId: estatePlan.id,
          documentType: 'healthcare_directive',
          documentName: 'Healthcare Directive/Living Will',
          status: 'executed',
          description: 'Current healthcare directive on file',
        });
      }
    } catch (e) {
      console.warn('[Estate] Optional document creation failed:', (e as any)?.message || e);
    }

    // Create spouse as primary beneficiary if married (best-effort)
    try {
      if (profile.maritalStatus === 'married' && profile.spouseName) {
        await this.createEstateBeneficiary({
          estatePlanId: estatePlan.id,
          beneficiaryType: 'individual',
          name: profile.spouseName,
          relationship: 'spouse',
          distributionType: 'percentage',
          distributionPercentage: '100',
          isPrimary: true,
        });
      }
    } catch (e) {
      console.warn('[Estate] Optional beneficiary creation failed:', (e as any)?.message || e);
    }

    return estatePlan;
  }
}

// Export singleton instance
export const estatePlanningService = new EstatePlanningService();
