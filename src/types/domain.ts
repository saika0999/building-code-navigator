export type RegionId = 'shenzhen' | 'zhongshan'

export type ProjectType =
  | 'factory'
  | 'warehouse'
  | 'rd-factory'
  | 'industrial-upstairs'
  | 'mixed-industrial'

export type SourceAccess =
  | 'downloadable'
  | 'online_reading'
  | 'metadata_only'
  | 'restricted'

export type Redistribution = 'allowed' | 'metadata_only' | 'local_only' | 'unknown'

export type ReviewStatus = 'seed' | 'needs_verification' | 'verified'

export interface ProjectProfile {
  region: RegionId
  projectType: ProjectType
  stage: 'pre_design' | 'concept' | 'scheme'
  fireHazard: 'unknown' | 'class_a' | 'class_b' | 'class_c' | 'class_d_e'
  hasWarehouse: boolean
  hasSubstation: boolean
  isHighRise: boolean
  hasBasement: boolean
  clientBriefQuality: 'unclear' | 'partial' | 'clear'
}

export interface SourceManifest {
  id: string
  title: string
  code?: string
  jurisdiction: string
  authority: string
  sourceUrl: string
  downloadUrl?: string
  access: SourceAccess
  redistribution: Redistribution
  topics: string[]
  projectTypes: ProjectType[]
  effectiveDate?: string
  reviewStatus: ReviewStatus
  notes: string
}

export interface RiskItem {
  id: string
  title: string
  severity: 'high' | 'medium' | 'low'
  regions: RegionId[]
  projectTypes: ProjectType[]
  triggers: Array<keyof ProjectProfile>
  description: string
  actions: string[]
  sourceIds: string[]
}

export interface IntakeQuestion {
  id: string
  label: string
  helper: string
  field: keyof ProjectProfile
}

export interface QaExample {
  id: string
  question: string
  answer: string
  assumptions: string[]
  sourceIds: string[]
  uncertainty: string
}
