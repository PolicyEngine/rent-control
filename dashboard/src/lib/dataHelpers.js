/**
 * Data helper functions for the rent control dashboard.
 */

const POLICY_META = {
  blanket_rent_reduction: {
    title: "Blanket rent reduction",
    shortTitle: "Rent cut",
    description: "What if private rents were X% lower?",
    fiscalDirection: "saving",
  },
  lha_unfreeze: {
    title: "LHA unfreeze",
    shortTitle: "LHA unfreeze",
    description: "Re-link LHA to market rent percentiles",
    fiscalDirection: "cost",
  },
  sar_abolition: {
    title: "SAR abolition",
    shortTitle: "SAR reform",
    description: "Lower or abolish the Shared Accommodation Rate age threshold",
    fiscalDirection: "cost",
  },
  social_rent_cap: {
    title: "Social rent cap",
    shortTitle: "Social rent cap",
    description: "Tighter caps on council and HA rents",
    fiscalDirection: "saving",
  },
};

export function getPolicyOptions(data) {
  if (!data?.policies) return [];
  return Object.entries(data.policies).map(([id, policy]) => ({
    id,
    ...POLICY_META[id],
    description: policy.description || POLICY_META[id]?.description || "",
  }));
}

export function getScenarioOptions(data, policyId) {
  if (!data?.policies?.[policyId]?.scenarios) return [];
  return Object.entries(data.policies[policyId].scenarios).map(
    ([id, scenario]) => ({
      id,
      label: scenario.label,
    }),
  );
}

export function getScenarioData(data, policyId, scenarioId) {
  return data?.policies?.[policyId]?.scenarios?.[scenarioId] || null;
}

export function deriveImpactSummary(data, policyId, scenarioId) {
  const scenario = getScenarioData(data, policyId, scenarioId);
  if (!scenario) return null;
  return scenario.summary;
}

export function deriveDecileBreakdown(data, policyId, scenarioId) {
  const scenario = getScenarioData(data, policyId, scenarioId);
  if (!scenario) return [];
  return scenario.by_decile;
}

export function getPublishedComparison(data, policyId) {
  return data?.policies?.[policyId]?.published_comparison || null;
}

export function getFiscalDirection(policyId) {
  return POLICY_META[policyId]?.fiscalDirection || "saving";
}

export function getPolicyMeta(policyId) {
  return POLICY_META[policyId] || { title: policyId, shortTitle: policyId };
}
