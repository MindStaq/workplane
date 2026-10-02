export function hasRequiredCapabilities(
  nodeCapabilities: string[],
  requiredCapabilities: string[],
): boolean {
  const capabilitySet = new Set(nodeCapabilities);
  return requiredCapabilities.every((capability) => capabilitySet.has(capability));
}

