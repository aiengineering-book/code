// #book-ref ch20-mcp-permissions

export type RiskLevel = 'safe' | 'moderate' | 'dangerous';

export interface PermissionRule {
  pattern: RegExp | string; // 工具名匹配规则
  riskLevel: RiskLevel;
  requireConfirmation: boolean;
  description: string; // 向用户展示的说明
}

// 默认权限规则（按优先级排列）
const DEFAULT_RULES: PermissionRule[] = [
  // 危险操作：总是需要确认
  {
    pattern: /delete|remove|destroy|drop|truncate/i,
    riskLevel: 'dangerous',
    requireConfirmation: true,
    description: '此操作将永久删除数据',
  },
  {
    pattern: /send_email|send_message|post_/i,
    riskLevel: 'dangerous',
    requireConfirmation: true,
    description: '此操作将向外部发送消息',
  },
  {
    pattern: /execute|run_command|shell/i,
    riskLevel: 'dangerous',
    requireConfirmation: true,
    description: '此操作将执行系统命令',
  },

  // 中等风险：写操作，可配置是否确认
  {
    pattern: /create|update|write|save|push/i,
    riskLevel: 'moderate',
    requireConfirmation: false, // 默认不需要确认，可在用户设置中修改
    description: '此操作将修改数据',
  },

  // 安全：只读操作，不需要确认
  {
    pattern: /get|list|read|search|query|fetch/i,
    riskLevel: 'safe',
    requireConfirmation: false,
    description: '此操作只读取数据，不会修改任何内容',
  },
];

export function assessRisk(
  toolName: string,
  customRules?: PermissionRule[],
): {
  riskLevel: RiskLevel;
  requireConfirmation: boolean;
  reason: string;
} {
  const rules = [...(customRules ?? []), ...DEFAULT_RULES];

  for (const rule of rules) {
    const matches =
      typeof rule.pattern === 'string'
        ? toolName.includes(rule.pattern)
        : rule.pattern.test(toolName);

    if (matches) {
      return {
        riskLevel: rule.riskLevel,
        requireConfirmation: rule.requireConfirmation,
        reason: rule.description,
      };
    }
  }

  // 默认：中等风险，需要确认
  return {
    riskLevel: 'moderate',
    requireConfirmation: true,
    reason: '未知工具，需要用户确认',
  };
}

/**
 * 权限检查结果：是否允许执行
 */
export interface PermissionCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
  reason: string;
}

export function checkPermission(
  toolName: string,
  userRole: 'viewer' | 'editor' | 'admin',
  customRules?: PermissionRule[],
): PermissionCheckResult {
  const risk = assessRisk(toolName, customRules);

  // viewer 只能使用安全工具
  if (userRole === 'viewer' && risk.riskLevel !== 'safe') {
    return {
      allowed: false,
      requiresConfirmation: false,
      riskLevel: risk.riskLevel,
      reason: `权限不足：viewer 只能使用只读工具`,
    };
  }

  // editor 不能使用危险工具
  if (userRole === 'editor' && risk.riskLevel === 'dangerous') {
    return {
      allowed: false,
      requiresConfirmation: false,
      riskLevel: risk.riskLevel,
      reason: `权限不足：需要 admin 权限才能执行此操作`,
    };
  }

  return {
    allowed: true,
    requiresConfirmation: risk.requireConfirmation,
    riskLevel: risk.riskLevel,
    reason: risk.reason,
  };
}
// #endbook-ref
