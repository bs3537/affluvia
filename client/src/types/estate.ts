export interface EstateProfile {
  id: string
  userId: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  spouseDetails?: {
    firstName?: string
    lastName?: string
    dateOfBirth?: string
  }
  maritalStatus: string
  state: string
  // Add other relevant fields from the estate profile
}

export interface EstateAssumptions {
  yearOfDeath?: number
  portability?: boolean
  strategies?: string[]
  [key: string]: any
}

export interface EstateScenario {
  id: number
  userId?: number
  estatePlanId?: number | null
  scenarioName: string
  scenarioType: string
  description?: string | null
  assumptions?: EstateAssumptions
  results?: any
  totalTaxes: string | null
  netToHeirs: string | null
  isBaseline?: boolean | null
  comparisonToBaseline?: any
  createdAt?: Date | null
  updatedAt?: Date | null
}

export interface ScenarioResult {
  scenarioId: string
  title: string
  summary: string
  metrics: { [key: string]: string | number }
  actionItem?: string
  savings?: number
  recommendation?: string
  assumptions?: string[]
  visualData?: {
    chartType: string
    data: any
  }
}