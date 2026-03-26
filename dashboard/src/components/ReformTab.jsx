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
  getFiscalDirection,
  getPolicyMeta,
  getPolicyOptions,
  getPublishedComparison,
  getScenarioOptions,
} from "../lib/dataHelpers";
import {
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

      {/* Policy selector */}
      <div className="section-card">
        <SectionHeading
          title="Choose a policy"
          description="Four rent control policies, each with multiple scenarios."
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                {option.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scenario selector — only show when multiple scenarios exist */}
      {scenarioOptions.length > 1 && (
        <div className="section-card">
          <SectionHeading
            title={`${policyMeta.title} scenarios`}
            description={data.policies[selectedPolicy]?.description || ""}
          />
          <div className="flex flex-wrap gap-2">
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

      {/* Metric cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="metric-card">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {fiscalDir === "cost" ? "Government cost" : "Government saving"}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatSignedBn(summary.total_fiscal_bn)}
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

      {/* Supply-side caveat */}
      <div className="note-card rounded-xl px-5 py-4">
        <div className="note-eyebrow text-xs font-semibold uppercase tracking-[0.08em] mb-1">
          Supply-side caveat
        </div>
        <div className="note-body text-sm leading-relaxed space-y-2">
          <p>
            The results in this tab are <strong>static</strong>, but
            behavioural responses could be incorporated using supply
            elasticities. For example, England&apos;s long-run price elasticity
            of new housing supply is estimated at around 0.4 on average,
            though it varies sharply by
            region (<a href="https://doi.org/10.1111/ecoj.12213" target="_blank" rel="noopener noreferrer">Hilber &amp; Vermeulen 2016</a>).
          </p>
              <p>The UK and international evidence consistently finds that rent controls:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Reduce rental supply</strong> — in San
                  Francisco, controlled properties saw a 15% decline in rental
                  supply (<a href="https://doi.org/10.1257/aer.20181289" target="_blank" rel="noopener noreferrer">Diamond, McQuade &amp; Qian 2019</a>). Scotland&apos;s 2022
                  rent freeze coincided with rental stock reaching historic lows,
                  with the Scottish Association of Landlords reporting roughly
                  22,000 properties withdrawn from the sector.
                </li>
                <li>
                  <strong>Depress neighbouring property values</strong> — rent
                  control creates negative spillovers via deferred maintenance
                  and reduced neighbourhood amenity. When Cambridge MA ended
                  controls in 1995, nearby never-controlled properties rose
                  ~13% in value, accounting for over half the total value gain
                  from decontrol (<a href="https://doi.org/10.1086/675536" target="_blank" rel="noopener noreferrer">Autor, Palmer &amp; Pathak 2014</a>).
                </li>
                <li>
                  <strong>Reduce tenant mobility</strong> — tenants in controlled
                  units stay longer than optimal, reducing turnover and
                  misallocating housing. Stockholm&apos;s rent-controlled housing
                  queue averages around 9 years city-wide and up to 18 years in
                  the inner city (<a href="https://bostad.stockholm.se/language/english/how-long-does-it-take/" target="_blank" rel="noopener noreferrer">Bostadsformedlingen 2023</a>).
                </li>
              </ul>
              <p>
                Long-run fiscal effects may be negative once displacement costs
                (temporary accommodation costs councils an estimated ~£2.3bn/yr
                for ~117,000 households — <a href="https://www.local.gov.uk/about/news/price-tag-temporary-accommodation-councils-set-balloon-almost-ps4-billion-202930-without" target="_blank" rel="noopener noreferrer">LGA 2024</a>)
                and reduced property tax receipts are accounted for.
              </p>
        </div>
      </div>

      {/* Published comparison */}
      {published && published.estimates.length > 0 && (
        <div className="section-card">
          <SectionHeading
            title="Comparison with published estimates"
            description={published.description}
          />
          <div className="overflow-x-auto">
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
                    <td className="font-medium">{est.source}</td>
                    <td>{est.metric}</td>
                    <td>{est.value}</td>
                    <td>{est.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
