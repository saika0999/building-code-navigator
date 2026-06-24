import { getFindingsForProject } from './ruleEngine'
import type { GroundedAnswer, ProjectCase } from '../types/domain'

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

export function answerProjectQuestion(project: ProjectCase, rawQuestion: string, loadedSourceIds: string[] = []): GroundedAnswer {
  const question = rawQuestion.trim()
  const findings = getFindingsForProject(project)

  if (loadedSourceIds.length === 0) {
    return {
      question,
      conclusion:
        '当前尚未加载规范包，因此系统不会给出规范结论。请先根据项目所在地和楼栋组成点击“加载推荐规范包”，或手动加载相关资料源后再提问。',
      appliesTo: project.buildings.length > 0 ? project.buildings.map((building) => building.name) : ['项目尚未录入楼栋'],
      assumptions: ['规范包未加载', '回答不得脱离已加载资料源和引用索引'],
      nextChecks: [
        '先录入项目所在地、项目类型和楼栋组成。',
        '点击“加载推荐规范包”。',
        '确认问题对应的资料源已处于 loaded 状态。',
      ],
      sourceIds: [],
      referenceIds: [],
      uncertainty: '未加载规范包时，系统只能提示工作流，不能回答具体规范问题。',
    }
  }

  if (includesAny(question, ['前期风险', '风险清单', '有哪些风险', '提示需求'])) {
    const highFindings = findings.filter((finding) => finding.severity === 'high')

    return {
      question,
      conclusion: `当前中山工业上楼样例项目已触发 ${findings.length} 个主要提示，其中 ${highFindings.length} 个为高风险。高风险集中在中山工业上楼地方口径、混合功能消防路径、厂房火灾危险性、宿舍食堂、以及仓储/配电房关系等主题。`,
      appliesTo: ['项目整体', '四栋厂房', '总部大楼', '宿舍楼（底层食堂）', '展厅'],
      assumptions: project.assumptions,
      nextChecks: findings.slice(0, 6).map((finding) => finding.title),
      sourceIds: Array.from(new Set(findings.flatMap((finding) => finding.sourceIds))).slice(0, 6),
      referenceIds: Array.from(new Set(findings.flatMap((finding) => finding.referenceIds ?? []))).slice(0, 8),
      uncertainty: '风险清单会随项目条件快调变化。若把厂房火灾类别、仓储、配电房、展厅开放状态等条件补齐，系统会收敛提示范围。',
    }
  }

  if (includesAny(question, ['厂房', '火灾危险性', '火灾类别', '四栋厂房'])) {
    const factories = project.buildings.filter((building) => building.uses.includes('factory'))
    const unknownFactories = factories.filter((building) => building.fireHazard === 'unknown')

    return {
      question,
      conclusion:
        unknownFactories.length > 0
          ? `当前仍有 ${unknownFactories.length} 栋厂房火灾危险性类别待确认。该条件会影响防火分区、安全疏散、耐火等级、防火间距、是否允许上楼以及是否允许与仓储/配套功能混合布置。`
          : '当前四栋厂房均已录入火灾危险性类别，系统可继续按每栋厂房类别收敛防火分区、疏散、耐火等级和防火间距提示。',
      appliesTo: factories.map((building) => building.name),
      assumptions: factories.map((building) => `${building.name}：${building.fireHazard === 'unknown' ? '火灾危险性待确认' : building.fireHazard}`),
      nextChecks: [
        '要求甲方提供生产工艺、原辅料、成品、包装材料、储量和危险化学品清单。',
        '由工艺、消防、安全专业共同判定每栋或每个防火分区的火灾危险性类别。',
        '如果存在甲乙类生产或仓储，优先判断是否允许进入工业上楼建筑。',
      ],
      sourceIds: ['gb-55037-2022', 'gb-50016-2014-2018'],
      referenceIds: ['gb-fire-industrial-civil-path', 'zs-5-9-7-industrial-design', 'zs-4-2-3-industrial-intensity'],
      uncertainty: '没有工艺和储存物品清单时，不能替代专业判定火灾危险性类别。',
    }
  }

  if (includesAny(question, ['甲类', '仓库', '配电房', '变配电', '间距'])) {
    const factoryNames = project.buildings
      .filter((building) => building.hasProduction || building.hasStorage)
      .map((building) => building.name)
    const warehouseLabel =
      project.siteConditions.hasIndependentWarehouse && project.siteConditions.warehouseFireHazard !== 'unknown'
        ? `${project.siteConditions.warehouseFireHazard === 'class_a' ? '甲类' : project.siteConditions.warehouseFireHazard === 'class_b' ? '乙类' : '非甲乙类'}仓储`
        : '仓储类别待确认'

    return {
      question,
      conclusion:
        project.siteConditions.hasIndependentWarehouse && project.siteConditions.hasSubstation
          ? `当前项目条件显示存在${warehouseLabel}和配电房/变配电设施，因此已触发“仓储与配电房关系”专项校核。现阶段仍不能直接给固定间距，因为还缺少仓库规模、储量、耐火等级、配电房性质和总平面相对位置。`
          : '当前项目尚未同时确认“独立仓库/中间仓库”和“配电房/变配电设施”，不能直接套用甲类仓库与配电房间距问题。应先补齐是否存在甲类仓储、配电房性质和总平面关系。',
      appliesTo: project.siteConditions.hasIndependentWarehouse ? ['仓储功能', '配电房/变配电设施'] : factoryNames.length > 0 ? factoryNames : ['项目整体'],
      assumptions: [
        `独立仓库/中间仓库：${project.siteConditions.hasIndependentWarehouse ? '已勾选' : '未确认'}`,
        `仓储火灾危险性：${warehouseLabel}`,
        `配电房/变配电设施：${project.siteConditions.hasSubstation ? '已勾选' : '未确认'}`,
        '如果只是厂房内普通配电间，判断路径不同于独立变配电站与甲类仓库之间的总平面间距。',
      ],
      nextChecks: [
        '补充是否有甲类仓库、甲类中间仓库或甲乙类生产工艺。',
        '补充配电房位置、服务对象、电压等级、是否独立建筑。',
        '按 GB 55037、GB 50016 复核防火间距、防火墙替代条件和不允许布置情形。',
      ],
      sourceIds: ['gb-55037-2022', 'gb-50016-2014-2018'],
      referenceIds: ['gb-fire-warehouse-substation-path', 'zs-3-4-logistics-warehouse', 'zs-5-9-8-warehouse-design'],
      uncertainty: '缺少仓库规模、储量、耐火等级、配电房性质和总平面关系，不能输出确定数值。',
    }
  }

  if (includesAny(question, ['灰空间', '计容', '建筑面积', '架空', '连廊', '雨棚', '面积'])) {
    return {
      question,
      conclusion:
        '中山项目应按“国家建筑面积计算规则 + 中山市规划技术标准”的双层口径处理。系统建议先把总部、宿舍食堂、展厅、厂房架空层、连廊、雨棚、设备平台分别建表，区分建筑面积、计容面积、不计容面积和配套面积。',
      appliesTo: ['项目整体', '总部大楼', '宿舍楼（底层食堂）', '展厅', '四栋厂房'],
      assumptions: [
        '问题发生在中山市项目，不应套用深圳灰空间口径。',
        '灰空间的具体类型尚未明确。',
      ],
      nextChecks: [
        '确认灰空间类型：架空层、骑楼/连廊、雨棚、设备平台、开放空间或避难空间。',
        '按中山规划技术标准确认计容、不计容和配套面积口径。',
        '按单体和功能建立面积台账，避免总部、宿舍、食堂、展厅挤占工业配套比例。',
      ],
      sourceIds: ['zhongshan-planning-technical-standards-2023', 'gbt-50353-2013'],
      referenceIds: ['zs-3-6-3-compatible-use', 'zs-4-3-5-industrial-far', 'zs-7-4-2-parking'],
      uncertainty: '未明确空间类型和地方规划条件前，只能给出查阅路径和建表方法。',
    }
  }

  if (includesAny(question, ['宿舍', '食堂', '厨房', '底层'])) {
    return {
      question,
      conclusion:
        '宿舍楼底层设置食堂是本项目的高优先级消防和运营风险点。应把宿舍的睡眠功能、食堂的人员聚集功能、厨房明火和排油烟系统分开校核，并重点确认防火分隔、独立疏散、燃料类型和排油烟井道。',
      appliesTo: ['宿舍楼（底层食堂）'],
      assumptions: ['宿舍和食堂位于同一单体内', '食堂可能服务园区员工，是否对外开放未知'],
      nextChecks: [
        '确认食堂就餐人数、厨房燃料和厨房面积。',
        '确认食堂与宿舍门厅、楼梯、电梯、管井的防火关系。',
        '确认宿舍人数、疏散宽度和安全出口数量。',
      ],
      sourceIds: ['gb-55037-2022', 'gb-50016-2014-2018', 'gb-55031-2022', 'jgj-36-2016', 'jgj-64-2017'],
      referenceIds: [
        'gb-fire-industrial-civil-path',
        'zs-5-9-4-dormitory-design',
        'zs-5-7-2-dormitory-spacing',
        'jgj-dormitory-design-path',
        'jgj-dietetic-building-path',
      ],
      uncertainty: '需要食堂规模、厨房条件和宿舍人数后才能进入条文级校核。',
    }
  }

  if (includesAny(question, ['展厅', '展览', '参观', '公众'])) {
    return {
      question,
      conclusion:
        '展厅不能只按厂区附属空间处理。若对外开放或有较大参观人数，应按公共建筑/展览空间思路核对疏散、装修材料、防火分区、可燃展品和与厂房之间的防火分隔。',
      appliesTo: ['展厅'],
      assumptions: ['展厅是否对公众开放尚未确认', '最大同时参观人数尚未确认'],
      nextChecks: [
        '确认是否对外开放和最大同时人数。',
        '确认是否有临时展陈、可燃展品或大空间装修。',
        '确认展厅与厂房、总部、停车库的连通方式。',
      ],
      sourceIds: ['gb-55037-2022', 'gb-50016-2014-2018', 'jgj-218-2010'],
      referenceIds: ['gb-fire-industrial-civil-path', 'zs-5-9-6-commercial-exhibition', 'zs-7-4-2-parking', 'jgj-exhibition-building-path'],
      uncertainty: '展厅使用模式和人数决定后，才能判断是否触发更严格公共建筑控制。',
    }
  }

  if (includesAny(question, ['工业上楼', '中山', '政策', '产业', '配套'])) {
    return {
      question,
      conclusion:
        '这个项目的首要问题是确认中山市是否对该地块或园区有工业上楼专项政策、产业准入和配套比例要求。系统不能把深圳工业上楼通则直接套到中山，只能作为对照清单。',
      appliesTo: ['项目整体'],
      assumptions: ['项目在中山市', '项目拟按工业上楼或多层工业园区组织'],
      nextChecks: [
        '向属地园区、自然资源、住建、工信部门确认专项政策。',
        '核对总部、宿舍、食堂、展厅是否属于行政办公及生活服务配套设施。',
        '核对产业监管协议、分割转让、层高荷载和货运组织要求。',
      ],
      sourceIds: ['zhongshan-planning-technical-standards-2023', 'zhongshan-industrial-policy-entry'],
      referenceIds: ['zs-3-3-1-industrial-layout', 'zs-3-3-2-service-facilities', 'zs-3-6-3-compatible-use', 'zs-4-2-3-industrial-intensity'],
      uncertainty: '尚未固化中山专门工业上楼设计导则，必须以当地主管部门和地块文件为准。',
    }
  }

  return {
    question,
    conclusion:
      '当前问题没有命中专门问答模板。系统先返回该中山项目已触发的主要风险，并提示需要补齐条件后再进入条文级回答。',
    appliesTo: ['项目整体'],
    assumptions: project.assumptions,
    nextChecks: findings.slice(0, 4).map((finding) => finding.title),
    sourceIds: Array.from(new Set(findings.flatMap((finding) => finding.sourceIds))).slice(0, 5),
    referenceIds: Array.from(new Set(findings.flatMap((finding) => finding.referenceIds ?? []))).slice(0, 8),
    uncertainty: '需要补充问题主题或接入本地全文规范库后，才能生成更精确的条文级答案。',
  }
}
