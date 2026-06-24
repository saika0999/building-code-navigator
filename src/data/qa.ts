import type { QaExample } from '../types/domain'

export const qaExamples: QaExample[] = [
  {
    id: 'qa-class-a-warehouse-substation',
    question: '甲类仓库和配电房之间间距多少？',
    answer: '第一版不会直接给一个固定数字。应先确认甲类仓库的储存物品类别、规模、耐火等级，配电房是否为独立建筑、其电压等级和防火分隔条件。确认前，系统会把它列为高风险总平面控制项，并引导用户查消防通用规范和建筑设计防火规范的防火间距章节。',
    assumptions: ['项目含仓库', '火灾危险性可能为甲类', '项目存在配电房或变配电设施'],
    sourceIds: ['gb-55037-2022', 'gb-50016-2014-2018'],
    uncertainty: '需要接入并复核现行规范全文后，才能按条文号输出具体间距和例外条件。',
  },
  {
    id: 'qa-gray-space-area',
    question: '建筑灰空间面积怎么计算？',
    answer: '灰空间面积计算具有明显地方口径。深圳项目应优先查深圳市建筑设计规则中关于建筑面积、计容面积、架空空间、公共开放空间等条款；中山项目应查中山市国土空间规划技术标准与准则中的面积和规划指标规则。第一版会先按地区推荐资料源，并把具体空间类型列为待判定项。',
    assumptions: ['问题涉及建筑面积或计容面积', '项目位于深圳或中山'],
    sourceIds: ['shenzhen-building-design-rules-2024', 'zhongshan-planning-technical-standards-2023'],
    uncertainty: '不同空间类型可能适用不同条款，需要用户明确是架空层、连廊、雨棚、设备平台还是公共开放空间。',
  },
  {
    id: 'qa-industrial-upstairs',
    question: '深圳工业上楼和普通厂房有什么前期差异？',
    answer: '深圳工业上楼应额外关注产业准入、货运垂直交通、层高和荷载、消防救援、卸货组织、公共服务配套、产权和产业用房管理等内容。普通厂房可先按一般工业建筑梳理，但只要项目被认定为工业上楼，就应纳入专项通则和地方政策。',
    assumptions: ['项目位于深圳', '项目类型可能属于工业上楼'],
    sourceIds: ['shenzhen-industrial-upstairs-design-general-rules'],
    uncertainty: '需要结合具体地块产业监管协议、规划条件和主管部门口径确认。',
  },
]
