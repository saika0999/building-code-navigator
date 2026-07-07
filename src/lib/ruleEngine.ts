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
  const hasHazardousWarehouse =
    project.siteConditions.hasIndependentWarehouse &&
    ['class_a', 'class_b', 'unknown'].includes(project.siteConditions.warehouseFireHazard)

  if (project.region !== 'zhongshan') {
    findings.delete('zs-industrial-upstairs-local-policy')
  }

  if (project.siteConditions.industrialUpstairsPolicyKnown) {
    findings.delete('zs-industrial-upstairs-local-policy')
  }

  if (project.projectType !== 'industrial-upstairs') {
    findings.delete('logistics-and-vertical-transport')
    findings.delete('zs-industrial-upstairs-local-policy')
  }

  if (!hasHazardousWarehouse || !project.siteConditions.hasSubstation) {
    findings.delete('warehouse-substation-fire-distance')
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

  if (!project.buildings.some((building) => hasUse(building, 'exhibition')) || !project.siteConditions.exhibitionOpenToPublic) {
    findings.delete('exhibition-public-access')
  }

  if (!project.siteConditions.hasGraySpace) {
    findings.delete('area-calculation-and-quota')
  }

  return Array.from(findings.values()).sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })
}

export function getUnknownsForProject(project: ProjectCase) {
  const buildingUnknowns = project.buildings.flatMap((building) =>
    building.knownUnknowns.map((unknown) => ({
      buildingId: building.id,
      buildingName: building.name,
      item: unknown,
    })),
  )

  const conditionUnknowns = [
    project.siteConditions.hasIndependentWarehouse && {
      buildingId: 'site-warehouse',
      buildingName: '仓储条件',
      item: '独立仓库或中间仓库的位置、类别、储量和防火分隔',
    },
    project.siteConditions.hasSubstation && {
      buildingId: 'site-substation',
      buildingName: '配电房/变配电',
      item: '配电房性质、电压等级、是否独立建筑和服务对象',
    },
    project.siteConditions.hasGraySpace && {
      buildingId: 'site-area',
      buildingName: '面积指标',
      item: '灰空间、架空层、连廊、雨棚、设备平台的地方计容口径',
    },
    !project.siteConditions.industrialUpstairsPolicyKnown && {
      buildingId: 'site-policy',
      buildingName: '中山工业上楼政策',
      item: '属地园区和主管部门是否有工业上楼专项审查要求',
    },
  ].filter(Boolean) as Array<{ buildingId: string; buildingName: string; item: string }>

  return buildingUnknowns.concat(conditionUnknowns)
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
