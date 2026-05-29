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

  // Exact match: best case
  if (SUPPORTED_VERSIONS.includes(serverVersion as SupportedVersion)) {
    return { version: serverVersion, compatible: true, warnings };
  }

  // Parse the version date
  const serverDate = new Date(serverVersion);
  const latestDate = new Date(
    SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1]!,
  );

  if (Number.isNaN(serverDate.getTime())) {
    return {
      version: serverVersion,
      compatible: false,
      warnings: [`Cannot parse version format: ${serverVersion}`],
    };
  }

  if (serverDate > latestDate) {
    // Server version is newer: we may lack some new features, but basic functionality should be compatible
    warnings.push(
      `Server uses a newer protocol version (${serverVersion}); ` +
        `some new features may not be available`,
    );
    return {
      version: SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1]!,
      compatible: true,
      warnings,
    };
  }

  if (serverDate < new Date('2024-01-01')) {
    // Version is too old
    return {
      version: serverVersion,
      compatible: false,
      warnings: [`Server version is too old (${serverVersion}), no longer supported`],
    };
  }

  // Older but potentially compatible version
  warnings.push(`Server version (${serverVersion}) is older than current; upgrade recommended`);
  return { version: serverVersion, compatible: true, warnings };
}
// #endbook
