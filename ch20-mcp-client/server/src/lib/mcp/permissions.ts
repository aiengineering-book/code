// #book ch20-mcp-permissions
// ch20-mcp-client/server/src/lib/mcp/permissions.ts

export type RiskLevel = 'safe' | 'moderate' | 'dangerous';

export interface PermissionRule {
  pattern: RegExp | string; // Tool name match rule
  riskLevel: RiskLevel;
  requireConfirmation: boolean;
  description: string; // Description shown to the user
}

// Default permission rules (in priority order)
const DEFAULT_RULES: PermissionRule[] = [
  // Dangerous operations: always require confirmation
  {
    pattern: /delete|remove|destroy|drop|truncate/i,
    riskLevel: 'dangerous',
    requireConfirmation: true,
    description: 'This operation will permanently delete data',
  },
  {
    pattern: /send_email|send_message|post_/i,
    riskLevel: 'dangerous',
    requireConfirmation: true,
    description: 'This operation will send a message to an external recipient',
  },
  {
    pattern: /execute|run_command|shell/i,
    riskLevel: 'dangerous',
    requireConfirmation: true,
    description: 'This operation will execute a system command',
  },

  // Moderate risk: write operations, confirmation configurable
  {
    pattern: /create|update|write|save|push/i,
    riskLevel: 'moderate',
    requireConfirmation: false, // No confirmation by default; can be changed in user settings
    description: 'This operation will modify data',
  },

  // Safe: read-only operations, no confirmation needed
  {
    pattern: /get|list|read|search|query|fetch/i,
    riskLevel: 'safe',
    requireConfirmation: false,
    description: 'This operation only reads data and will not modify anything',
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

  // Default: moderate risk, requires confirmation
  return {
    riskLevel: 'moderate',
    requireConfirmation: true,
    reason: 'Unknown tool, requires user confirmation',
  };
}

/**
 * Permission check result: whether execution is allowed
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

  // viewer can only use safe tools
  if (userRole === 'viewer' && risk.riskLevel !== 'safe') {
    return {
      allowed: false,
      requiresConfirmation: false,
      riskLevel: risk.riskLevel,
      reason: `Insufficient permissions: viewer can only use read-only tools`,
    };
  }

  // editor cannot use dangerous tools
  if (userRole === 'editor' && risk.riskLevel === 'dangerous') {
    return {
      allowed: false,
      requiresConfirmation: false,
      riskLevel: risk.riskLevel,
      reason: `Insufficient permissions: admin role required to perform this operation`,
    };
  }

  return {
    allowed: true,
    requiresConfirmation: risk.requireConfirmation,
    riskLevel: risk.riskLevel,
    reason: risk.reason,
  };
}
// #endbook
