import { requirementTopics } from '../data/knowledge'
import type { BuildingAsset, GeneratedFinding, ProjectCase } from '../types/domain'

function hasUse(building: BuildingAsset, use: BuildingAsset['uses'][number]) {
  return building.uses.includes(use)
}

export function getFindingsForProject(project: ProjectCase): GeneratedFinding[] {
  const findings = new Map(requirementTopics.map((topic) => [topic.id, topic]))

  const factories = project.buildings.filter((building) => hasUse(building, 'factory'))
  const publicBuildings = project.buildings.filter(
    (building) => building.hasPublicAccess || building.uses.some((use) => ['headquarters-office', 'cafeteria', 'exhibition'].includes(use)),
  )
  const sleepingBuildings = project.buildings.filter((building) => building.hasSleeping)
  const factoriesWithUnknownFireHazard = factories.filter((building) => building.fireHazard === 'unknown')

  if (project.region !== 'zhongshan') {
    findings.delete('zs-industrial-upstairs-local-policy')
  }

  if (project.projectType !== 'industrial-upstairs') {
    findings.delete('logistics-and-vertical-transport')
    findings.delete('zs-industrial-upstairs-local-policy')
  }

  if (factoriesWithUnknownFireHazard.length === 0) {
    findings.delete('factory-fire-hazard-unknown')
  }

  if (publicBuildings.length === 0 || factories.length === 0) {
    findings.delete('mixed-fire-systems')
  }

  if (!sleepingBuildings.some((building) => hasUse(building, 'cafeteria'))) {
    findings.delete('dormitory-cafeteria-separation')
  }

  if (!project.buildings.some((building) => hasUse(building, 'exhibition'))) {
    findings.delete('exhibition-public-access')
  }

  return Array.from(findings.values()).sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })
}

export function getUnknownsForProject(project: ProjectCase) {
  return project.buildings.flatMap((building) =>
    building.knownUnknowns.map((unknown) => ({
      buildingId: building.id,
      buildingName: building.name,
      item: unknown,
    })),
  )
}

export function getSourceIdsForProject(project: ProjectCase) {
  return Array.from(
    new Set(
      getFindingsForProject(project)
        .flatMap((finding) => finding.sourceIds)
        .concat(project.region === 'zhongshan' ? ['zhongshan-planning-technical-standards-2023'] : []),
    ),
  )
}
