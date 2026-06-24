import { getFindingsForProject } from './ruleEngine'
import type { GroundedAnswer, ProjectCase } from '../types/domain'

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

export function answerProjectQuestion(project: ProjectCase, rawQuestion: string): GroundedAnswer {
  const question = rawQuestion.trim()
  const findings = getFindingsForProject(project)

  if (includesAny(question, ['甲类', '仓库', '配电房', '变配电', '间距'])) {
    const factoryNames = project.buildings
      .filter((building) => building.hasProduction || building.hasStorage)
      .map((building) => building.name)

    return {
      question,
      conclusion:
        '不能在当前条件下直接给出一个固定间距。对这个中山项目，应先确认是否真的存在甲类仓库、甲类中间仓库或甲类生产工艺，再确认配电房是独立建筑、附设用房还是厂房内配套设备用房。确认后再按消防规范的防火间距、防火分隔和变配电设施条款校核。',
      appliesTo: factoryNames.length > 0 ? factoryNames : ['项目整体'],
      assumptions: [
        '当前样例项目四栋厂房的火灾危险性类别仍为未知。',
        '项目尚未录入独立仓库或独立配电房单体。',
        '如果只是厂房内普通配电间，判断路径不同于独立变配电站与甲类仓库之间的总平面间距。',
      ],
      nextChecks: [
        '补充是否有甲类仓库、甲类中间仓库或甲乙类生产工艺。',
        '补充配电房位置、服务对象、电压等级、是否独立建筑。',
        '按 GB 55037、GB 50016 复核防火间距、防火墙替代条件和不允许布置情形。',
      ],
      sourceIds: ['gb-55037-2022', 'gb-50016-2014-2018'],
      uncertainty: '缺少火灾危险性类别、仓库规模、配电房性质和总平面关系，不能输出确定数值。',
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
      sourceIds: ['gb-55037-2022', 'gb-50016-2014-2018', 'gb-55031-2022'],
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
      sourceIds: ['gb-55037-2022', 'gb-50016-2014-2018'],
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
    uncertainty: '需要补充问题主题或接入本地全文规范库后，才能生成更精确的条文级答案。',
  }
}
