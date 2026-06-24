export type RegionId = 'shenzhen' | 'zhongshan'

export type ProjectType =
  | 'factory'
  | 'warehouse'
  | 'rd-factory'
  | 'industrial-upstairs'
  | 'mixed-industrial'

export type BuildingUse =
  | 'factory'
  | 'warehouse'
  | 'headquarters-office'
  | 'dormitory'
  | 'cafeteria'
  | 'exhibition'
  | 'substation'
  | 'basement'
  | 'parking'

export type FireHazard = 'unknown' | 'class_a' | 'class_b' | 'class_c' | 'class_d' | 'class_e' | 'civil'

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

export interface BuildingAsset {
  id: string
  name: string
  uses: BuildingUse[]
  floors?: number
  heightMeters?: number
  grossAreaSqm?: number
  fireHazard: FireHazard
  hasPublicAccess?: boolean
  hasCooking?: boolean
  hasSleeping?: boolean
  hasProduction?: boolean
  hasStorage?: boolean
  hasPowerEquipment?: boolean
  knownUnknowns: string[]
}

export interface ProjectCase {
  id: string
  name: string
  region: RegionId
  projectType: ProjectType
  stage: 'pre_design' | 'concept' | 'scheme'
  description: string
  assumptions: string[]
  siteConditions: {
    hasIndependentWarehouse: boolean
    warehouseFireHazard: FireHazard
    hasSubstation: boolean
    hasGraySpace: boolean
    exhibitionOpenToPublic: boolean
    industrialUpstairsPolicyKnown: boolean
  }
  buildings: BuildingAsset[]
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

export interface SourceReference {
  id: string
  sourceId: string
  label: string
  pdfPages?: number[]
  topics: string[]
  summary: string
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

export interface GeneratedFinding {
  id: string
  title: string
  severity: 'high' | 'medium' | 'low'
  category: 'fire' | 'planning' | 'area' | 'operation' | 'documents'
  appliesTo: string[]
  why: string
  checks: string[]
  sourceIds: string[]
  referenceIds?: string[]
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

export interface GroundedAnswer {
  question: string
  conclusion: string
  appliesTo: string[]
  assumptions: string[]
  nextChecks: string[]
  sourceIds: string[]
  referenceIds?: string[]
  uncertainty: string
}
