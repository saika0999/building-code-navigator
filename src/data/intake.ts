import type { IntakeQuestion } from '../types/domain'

export const intakeQuestions: IntakeQuestion[] = [
  {
    id: 'region',
    field: 'region',
    label: '项目所在城市',
    helper: '第一版先支持深圳市和中山市，两地的规划、面积、专项政策口径不同。',
  },
  {
    id: 'projectType',
    field: 'projectType',
    label: '工业建筑类型',
    helper: '区分普通厂房、仓库、研发厂房、工业上楼或混合工业项目。',
  },
  {
    id: 'fireHazard',
    field: 'fireHazard',
    label: '生产或储存火灾危险性类别',
    helper: '不知道时应标记为未知，并列入甲方/工艺/消防顾问确认事项。',
  },
  {
    id: 'hasWarehouse',
    field: 'hasWarehouse',
    label: '是否包含仓储功能',
    helper: '仓库类别会影响防火分区、防火间距、疏散和功能混合限制。',
  },
  {
    id: 'hasSubstation',
    field: 'hasSubstation',
    label: '是否有配电房或变配电设施',
    helper: '配电房与甲乙类仓库、厂房、地下室等关系需要前置核对。',
  },
  {
    id: 'isHighRise',
    field: 'isHighRise',
    label: '是否可能属于高层工业建筑',
    helper: '如果高度口径不明确，应把建筑高度计算规则列入待确认。',
  },
  {
    id: 'clientBriefQuality',
    field: 'clientBriefQuality',
    label: '甲方任务书完整度',
    helper: '任务书越不完整，越需要系统输出待确认清单而不是直接下结论。',
  },
]
