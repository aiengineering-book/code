// #book ch20-version-compat

// ch20-mcp-client/server/src/lib/mcp/version-compat.ts
const SUPPORTED_VERSIONS = ['2024-11-05'] as const;
type SupportedVersion = (typeof SUPPORTED_VERSIONS)[number];

export interface VersionNegotiationResult {
  version: string;
  compatible: boolean;
  warnings: string[];
}

export function negotiateVersion(
  serverVersion: string,
): VersionNegotiationResult {
  const warnings: string[] = [];

  // 完全匹配：最佳情况
  if (SUPPORTED_VERSIONS.includes(serverVersion as SupportedVersion)) {
    return { version: serverVersion, compatible: true, warnings };
  }

  // 解析版本日期
  const serverDate = new Date(serverVersion);
  const latestDate = new Date(
    SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1]!,
  );

  if (Number.isNaN(serverDate.getTime())) {
    return {
      version: serverVersion,
      compatible: false,
      warnings: [`无法解析版本格式：${serverVersion}`],
    };
  }

  if (serverDate > latestDate) {
    // Server 版本更新：我们可能缺少新特性，但基本功能应该兼容
    warnings.push(
      `Server 使用更新的协议版本（${serverVersion}），` +
        `部分新特性可能不可用`,
    );
    return {
      version: SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1]!,
      compatible: true,
      warnings,
    };
  }

  if (serverDate < new Date('2024-01-01')) {
    // 太老的版本
    return {
      version: serverVersion,
      compatible: false,
      warnings: [`Server 版本过旧（${serverVersion}），不再支持`],
    };
  }

  // 较老但可能兼容的版本
  warnings.push(`Server 版本（${serverVersion}）比当前版本旧，建议升级`);
  return { version: serverVersion, compatible: true, warnings };
}
// #endbook
