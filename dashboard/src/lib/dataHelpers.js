/**
 * Data helper functions for the rent control dashboard.
 */

const POLICY_META = {
  blanket_rent_reduction: {
    title: "Blanket rent reduction",
    shortTitle: "Rent cut",
    description: "Simulates an immediate 10% cut to all private rents and measures the impact on Housing Benefit and Universal Credit spending.",
    fiscalDirection: "saving",
  },
  lha_unfreeze: {
    title: "LHA unfreeze",
    shortTitle: "LHA unfreeze",
    description: "Restores Local Housing Allowance rates to the 30th percentile of local market rents, reversing the current freeze that has left rates below actual rents.",
    fiscalDirection: "cost",
  },
  sar_abolition: {
    title: "SAR abolition",
    shortTitle: "SAR reform",
    description: "Abolishes the Shared Accommodation Rate from age 18, so all single adults receive the full one-bedroom LHA rate instead of a lower shared-room rate.",
    fiscalDirection: "cost",
  },
  social_rent_cap: {
    title: "Social rent cap",
    shortTitle: "Social rent cap",
    description: "Caps council and housing association rent increases at 5%, reducing costs for social tenants and lowering government benefit spending.",
    fiscalDirection: "saving",
  },
  rent_control_cpi: {
    title: "Rent control (CPI+1% cap)",
    shortTitle: "Rent control",
    description: "Caps annual private rent increases at CPI+1%, modelling rents falling 5%, 10%, or 15% below market over 2–5 years.",
    fiscalDirection: "saving",
  },
};

export function getPolicyOptions(data) {
  if (!data?.policies) return [];
  return Object.entries(data.policies).map(([id, policy]) => ({
    id,
    ...POLICY_META[id],
    shortDescription: POLICY_META[id]?.description || "",
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

export function getDynamicAdjustment(data, policyId, scenarioId) {
  return data?.policies?.[policyId]?.scenarios?.[scenarioId]?.dynamic || null;
}
