"use client";

import { useMemo, useState } from "react";
import { colors } from "../lib/colors";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SectionHeading from "./SectionHeading";
import {
  deriveDecileBreakdown,
  deriveImpactSummary,
  getDynamicAdjustment,
  getFiscalDirection,
  getPolicyMeta,
  getPolicyOptions,
  getPublishedComparison,
  getScenarioOptions,
} from "../lib/dataHelpers";
import {
  formatBn,
  formatCompactCurrency,
  formatCount,
  formatCurrency,
  formatMn,
  formatSignedBn,
  formatSignedMn,
} from "../lib/formatters";
import { getNiceTicks, getTickDomain } from "../lib/chartUtils";
import ChartLogo from "./ChartLogo";

const PALETTE = {
  border: colors.border.light,
  grid: colors.border.light,
  text: colors.gray[700],
  muted: colors.gray[500],
  gain: colors.primary[700],
  loss: colors.error,
  rentSaved: "#4CAF50",
  benefitLost: "#f44336",
  netGain: colors.primary[600],
  hb: "#2196F3",
  uc: "#FF9800",
};

const AXIS_STYLE = {
  fontSize: 12,
  fill: colors.gray[500],
};

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg">
      {label !== undefined ? (
        <div className="mb-2 font-semibold text-slate-800">{label}</div>
      ) : null}
      {payload.map((entry) => (
        <div className="flex items-center justify-between gap-4" key={entry.name}>
          <span className="flex items-center gap-2 text-slate-600">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-medium text-slate-800">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ReformTab({ data }) {
  const policyOptions = useMemo(() => getPolicyOptions(data), [data]);
  const [selectedPolicy, setSelectedPolicy] = useState(
    policyOptions[0]?.id || "blanket_rent_reduction",
  );

  const scenarioOptions = useMemo(
    () => getScenarioOptions(data, selectedPolicy),
    [data, selectedPolicy],
  );
  const [selectedScenario, setSelectedScenario] = useState(
    scenarioOptions[0]?.id || "",
  );
  const [impactMode, setImpactMode] = useState("abs");

  // Reset scenario when policy changes
  const handlePolicyChange = (policyId) => {
    setSelectedPolicy(policyId);
    const scenarios = getScenarioOptions(data, policyId);
    setSelectedScenario(scenarios[0]?.id || "");
  };

  const summary = useMemo(
    () => deriveImpactSummary(data, selectedPolicy, selectedScenario),
    [data, selectedPolicy, selectedScenario],
  );
  const decileData = useMemo(
    () => deriveDecileBreakdown(data, selectedPolicy, selectedScenario),
    [data, selectedPolicy, selectedScenario],
  );
  const published = useMemo(
    () => getPublishedComparison(data, selectedPolicy),
    [data, selectedPolicy],
  );
  const fiscalDir = getFiscalDirection(selectedPolicy);
  const policyMeta = getPolicyMeta(selectedPolicy);
  const dynamic = useMemo(
    () => getDynamicAdjustment(data, selectedPolicy, selectedScenario),
    [data, selectedPolicy, selectedScenario],
  );

  const PUBLISHED_BENCHMARKS = {
    lha_unfreeze: {
      fiscal: "£1.3–1.7bn (Res Foundation)",
      households: "1.6m (DWP)",
      avgGain: "£785/yr (DWP)",
    },
    sar_abolition: {
      fiscal: "£135m (DWP 2012)",
      households: "63,000 (DWP 2012)",
      avgGain: "£2,132/yr (DWP 2012)",
    },
    social_rent_cap: {
      fiscal: "£0.6bn revenue loss (LGA/Savills)",
    },
  };
  const bench = PUBLISHED_BENCHMARKS[selectedPolicy];

  const decileTicks = useMemo(() => {
    if (!decileData.length) return [0];
    const allValues = decileData.map((r) => r.avg_net_gain);
    return getNiceTicks([Math.min(0, ...allValues), Math.max(0, ...allValues)]);
  }, [decileData]);

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Rent control policy analysis"
        description="Select a policy to see fiscal impact, distributional effects, and comparison with published estimates where available. All figures are static first-round estimates for a single year."
      />

      {/* Policy & scenario selector */}
      <div className="section-card">
        <SectionHeading
          title="Choose a policy"
          description="Five housing policies, each with multiple scenarios."
        />
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {policyOptions.map((option) => (
            <button
              key={option.id}
              className={`selector-chip ${selectedPolicy === option.id ? "active" : ""}`}
              onClick={() => handlePolicyChange(option.id)}
            >
              <div className="text-sm font-semibold text-slate-900">
                {option.title}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {option.shortDescription}
              </div>
            </button>
          ))}
        </div>
        {scenarioOptions.length > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600 mb-4">
              {data.policies[selectedPolicy]?.description || ""}
            </p>
            <div className="flex flex-wrap gap-3">
              {scenarioOptions.map((option) => (
                <button
                  key={option.id}
                  className={`toggle-button ${selectedScenario === option.id ? "active" : ""}`}
                  onClick={() => setSelectedScenario(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metric cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="metric-card">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {fiscalDir === "cost" ? "Government cost" : "Government saving"}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatBn(Math.abs(summary.total_fiscal_bn))}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              HB/UC spending change.
            </div>
            {bench?.fiscal && (
              <div className="mt-2 text-xs text-slate-400">
                Published: {bench.fiscal}
              </div>
            )}
          </div>
          <div className="metric-card">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Households gaining
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatCount(summary.n_gaining)}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              Avg gain: {formatCurrency(summary.avg_gain_per_hh)}/yr.
            </div>
            {bench?.households && (
              <div className="mt-2 text-xs text-slate-400">
                Published: {bench.households}{bench.avgGain ? `, ${bench.avgGain}` : ""}
              </div>
            )}
          </div>
          <div className="metric-card">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Tenant net gain
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatSignedBn(summary.tenant_net_gain_bn)}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              Rent saved minus benefit lost.
            </div>
          </div>
        </div>
      )}

      {/* Dynamic assumptions caveat */}
      <details className="note-card rounded-xl px-5 py-4">
        <summary className="note-eyebrow text-xs font-semibold uppercase tracking-[0.08em] cursor-pointer select-none">
          Dynamic assumptions caveat
        </summary>
        <div className="note-body text-sm leading-relaxed mt-2">
          <p>
            The results in this tab are <strong>static</strong>, but
            behavioural responses could be incorporated using supply
            elasticities. Long-run fiscal effects may be negative once
            displacement costs (temporary accommodation costs councils an
            estimated ~£2.3bn/yr for ~117,000
            households — <a href="https://www.local.gov.uk/about/news/price-tag-temporary-accommodation-councils-set-balloon-almost-ps4-billion-202930-without" target="_blank" rel="noopener noreferrer">LGA 2024</a>)
            and reduced property tax receipts are accounted for.
            The following table summarises the key empirical estimates from the literature that could parameterise a dynamic extension of this model.
          </p>
          <div className="overflow-x-auto mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Category</th>
                  <th>Key finding</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><a href="https://doi.org/10.1111/ecoj.12213" target="_blank" rel="noopener noreferrer">Hilber &amp; Vermeulen (2016)</a></td>
                  <td>Supply Elasticity</td>
                  <td>Long-run price elasticity of new housing supply in England averages <strong>0.4</strong>, with sharp regional variation</td>
                </tr>
                <tr>
                  <td><a href="https://doi.org/10.1111/j.1080-8620.2003.00060.x" target="_blank" rel="noopener noreferrer">Andrew &amp; Meen (2003)</a></td>
                  <td>Tenure Elasticities</td>
                  <td>Income elasticity of housing demand is <strong>1.27</strong> — a 10% rise in income increases housing consumption by 12.7%</td>
                </tr>
                <tr>
                  <td><a href="https://doi.org/10.1016/j.jpubeco.2005.08.003" target="_blank" rel="noopener noreferrer">Gibbons &amp; Manning (2006)</a></td>
                  <td>Tenure Elasticities</td>
                  <td><strong>67%</strong> of Housing Benefit cuts were absorbed by landlords through lower rents, not passed to tenants</td>
                </tr>
                <tr>
                  <td><a href="https://www.understandingsociety.ac.uk/" target="_blank" rel="noopener noreferrer">Understanding Society (UKHLS)</a></td>
                  <td>Transition Probabilities</td>
                  <td>Among movers, <strong>11%</strong> move from private rented to social housing and <strong>26%</strong> from social to private rented; 66-67% stay in the same tenure</td>
                </tr>
                <tr>
                  <td><a href="https://doi.org/10.1257/aer.20181289" target="_blank" rel="noopener noreferrer">Diamond, McQuade &amp; Qian (2019)</a></td>
                  <td>Rent Control Effects</td>
                  <td>Rental supply fell <strong>15%</strong> in controlled properties; tenant mobility fell <strong>20%</strong> due to lock-in effects (San Francisco)</td>
                </tr>
                <tr>
                  <td><a href="https://bostad.stockholm.se/language/english/how-long-does-it-take/" target="_blank" rel="noopener noreferrer">Bostadsformedlingen (2023)</a></td>
                  <td>Rent Control Effects</td>
                  <td>Average wait for rent-controlled housing is <strong>9 years</strong> city-wide and up to <strong>18 years</strong> in the inner city (Stockholm)</td>
                </tr>
                <tr>
                  <td><a href="https://scottishlandlords.com/news-and-campaigns/news/landlord-portfolio-and-investment-survey-2025/" target="_blank" rel="noopener noreferrer">Scottish Association of Landlords</a></td>
                  <td>Rent Control Effects</td>
                  <td>Roughly <strong>22,000 properties</strong> withdrawn from the private rental sector following Scotland&apos;s 2022 rent freeze</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {/* Published comparison */}
      {published && published.estimates.length > 0 && (
        <details className="section-card group">
          <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              <span className="inline-block transition-transform group-open:rotate-90 mr-1">▸</span>
              Comparison with published estimates
            </h2>
          </summary>
          {published.description && (
            <p className="mt-2 mb-3 text-sm leading-6 text-slate-600">{published.description}</p>
          )}
          <div className="overflow-x-auto mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Metric</th>
                  <th>Published value</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {published.estimates.map((est, i) => (
                  <tr key={i}>
                    <td className="font-medium">{est.url ? <a href={est.url} target="_blank" rel="noopener noreferrer">{est.source}</a> : est.source}</td>
                    <td>{est.metric}</td>
                    <td>{est.value}</td>
                    <td>{est.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Dynamic behavioural adjustment */}
      {dynamic && (() => {
        const band = dynamic.bands["central"];
        const staticSaving = dynamic.static_fiscal_saving_bn;

        return (
          <details className="section-card group">
            <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-2">
                <span className="inline-block transition-transform group-open:rotate-90 mr-1">▸</span>
                Dynamic behavioural adjustment
              </h2>
            </summary>
            <div className="mb-5 text-sm leading-6 text-slate-600">
              <p>The static analysis above assumes rents fall but nothing else changes. In practice, rent controls trigger second-round behavioural responses that carry their own fiscal costs. We model three channels:</p>
              <ul className="mt-2 list-disc pl-5 space-y-2">
                <li><strong>Channel A — Supply exit:</strong> A rent cap of CPI+1% reduces landlord returns, causing some to sell or convert their properties. Using a housing supply elasticity of <strong>0.4</strong> (<a href="https://doi.org/10.1111/ecoj.12213" target="_blank" rel="noopener noreferrer">Hilber &amp; Vermeulen 2016</a>), we estimate the number of rental units withdrawn from the market. Of those displaced, <strong>20%</strong> are assumed to enter temporary accommodation at a cost of <strong>£20,000 per household per year</strong> (<a href="https://www.local.gov.uk/about/news/price-tag-temporary-accommodation-councils-set-balloon-almost-ps4-billion-202930-without" target="_blank" rel="noopener noreferrer">LGA 2024</a>).</li>
                <li><strong>Channel B — Tenure shift:</strong> Of the households displaced from the private rented sector, <strong>11%</strong> transition into social housing (<a href="https://www.understandingsociety.ac.uk/" target="_blank" rel="noopener noreferrer">Understanding Society</a>), adding to Housing Benefit caseloads at an average cost of roughly £5,100 per household per year.</li>
                <li><strong>Channel C — Labour market:</strong> Displaced households face disrupted employment. Social housing tenants have lower re-employment rates in distant labour markets (<a href="https://doi.org/10.1111/j.1468-0297.2007.02122.x" target="_blank" rel="noopener noreferrer">Battu, Ma &amp; Phimister 2008</a>), and those in temporary accommodation face acute barriers to work. We estimate that <strong>10%</strong> of all displaced households enter longer-term unemployment, claiming an additional <strong>£7,000 per household per year</strong> in Universal Credit or Jobseeker&apos;s Allowance.</li>
              </ul>
              <p className="mt-2">These three costs are subtracted from the static fiscal saving to produce the net dynamic fiscal impact shown below.</p>
            </div>

            {/* Metric cards */}
            <div className="mt-6 grid gap-4 sm:grid-cols-5">
              <div className="metric-card rounded-xl px-5 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  Static fiscal saving
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  {formatBn(staticSaving)}
                </div>
              </div>
              <div className="metric-card rounded-xl px-5 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  A: Supply exit cost
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-red-600">
                  {formatBn(band.supply_exit_cost_bn)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {band.units_lost.toLocaleString()} units lost, {band.displaced_to_ta.toLocaleString()} to temporary accommodation
                </div>
              </div>
              <div className="metric-card rounded-xl px-5 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  B: Tenure shift cost
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-red-600">
                  {formatBn(band.tenure_shift_cost_bn)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {band.additional_social_tenants.toLocaleString()} additional social housing tenants
                </div>
              </div>
              <div className="metric-card rounded-xl px-5 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  C: Labour market cost
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-red-600">
                  {formatBn(band.labour_market_cost_bn)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {band.newly_unemployed.toLocaleString()} households entering longer-term unemployment
                </div>
              </div>
              <div className="metric-card rounded-xl px-5 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  {band.net_fiscal_bn >= 0 ? "Net dynamic saving" : "Net dynamic cost"}
                </div>
                <div className={`mt-2 text-2xl font-bold tracking-tight ${band.net_fiscal_bn >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatBn(Math.abs(band.net_fiscal_bn))}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  After behavioural response
                </div>
              </div>
            </div>

          </details>
        );
      })()}

      {/* Decile chart + Winners and losers — side by side */}
      {decileData.length > 0 && (
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="section-card">
            <div className="flex items-start justify-between">
              <SectionHeading
                title="Average renter impact by income decile"
                description={impactMode === "abs" ? "Average annual net gain per renter household (rent saved minus benefit lost)." : "Average net gain as a share of renter household income."}
              />
              <div className="flex rounded-md border border-slate-200 text-xs font-medium overflow-hidden shrink-0 ml-4">
                <button
                  className={`px-3 py-1.5 ${impactMode === "abs" ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                  onClick={() => setImpactMode("abs")}
                >£</button>
                <button
                  className={`px-3 py-1.5 ${impactMode === "pct" ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                  onClick={() => setImpactMode("pct")}
                >%</button>
              </div>
            </div>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={decileData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                  <XAxis
                    dataKey="decile"
                    tick={AXIS_STYLE}
                    tickLine={false}
                    label={{
                      value: "Income decile",
                      position: "insideBottom",
                      offset: -12,
                      style: AXIS_STYLE,
                    }}
                  />
                  <YAxis
                    ticks={impactMode === "abs" ? decileTicks : undefined}
                    domain={impactMode === "abs" ? getTickDomain(decileTicks) : undefined}
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={impactMode === "abs" ? (v) => formatCurrency(v) : (v) => `${v}%`}
                  />
                  <ReferenceLine y={0} stroke={colors.gray[400]} strokeWidth={1} />
                  <Tooltip
                    content={
                      <CustomTooltip
                        formatter={impactMode === "abs" ? (value) => `${formatCurrency(value)}/yr` : (value) => `${Number(value).toFixed(2)}%`}
                      />
                    }
                  />
                  <Bar
                    dataKey={impactMode === "abs" ? "avg_net_gain" : "avg_net_gain_pct"}
                    name="Net gain"
                    radius={[6, 6, 0, 0]}
                  >
                    {decileData.map((row, i) => (
                      <Cell
                        key={`ng-${i}`}
                        fill={(impactMode === "abs" ? row.avg_net_gain : row.avg_net_gain_pct) >= 0 ? PALETTE.gain : PALETTE.loss}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLogo />
          </div>

          <div className="section-card">
            <SectionHeading
              title="Winners and losers"
              description="Share of renters that are better off, worse off, or unaffected in each income decile."
            />
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={decileData} margin={{ top: 10, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                  <XAxis
                    dataKey="decile"
                    tick={AXIS_STYLE}
                    tickLine={false}
                  />
                  <YAxis
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                    ticks={[0, 25, 50, 75, 100]}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        formatter={(value) => `${Number(value).toFixed(1)}%`}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconSize={10} verticalAlign="bottom" />
                  <Bar
                    dataKey="pct_winners"
                    name="Better off"
                    stackId="wl"
                    fill={PALETTE.gain}
                  />
                  <Bar
                    dataKey="pct_unchanged"
                    name="No change"
                    stackId="wl"
                    fill={colors.gray[300]}
                  />
                  <Bar
                    dataKey="pct_losers"
                    name="Worse off"
                    stackId="wl"
                    fill={PALETTE.loss}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLogo />
          </div>
        </div>
      )}
    </div>
  );
}
