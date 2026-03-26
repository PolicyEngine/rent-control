export default function MethodologyTab({ data }) {
  return (
    <div className="space-y-8">
      <div className="section-card">
        <div className="eyebrow text-slate-500">Overview</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          How the model works
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This dashboard uses PolicyEngine UK, a static microsimulation model
          built on the Family Resources Survey, to estimate the first-round
          fiscal and distributional effects of four rent control policies. All
          figures are for the {data.year} fiscal year. Each policy is modelled
          as a direct change to rents or benefit parameters; the model then
          recalculates housing benefit, Universal Credit housing costs, and
          household net income.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="section-card">
          <div className="eyebrow text-slate-500">Included</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            What the model captures
          </h3>
          <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
            <li>Housing Benefit and UC housing cost element responses to rent changes</li>
            <li>Distributional impact by household income decile</li>
            <li>Fiscal impact on government benefit spending</li>
            <li>Tenant net gain (rent saved minus benefit lost)</li>
            <li>LHA parameter modifications (unfreeze, percentile, SAR threshold)</li>
          </ul>
        </div>

        <div className="section-card">
          <div className="eyebrow text-slate-500">Excluded</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            What the dashboard omits
          </h3>
          <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
            <li>Supply-side responses (reduced housebuilding, landlord exit)</li>
            <li>Behavioural responses (tenant mobility, landlord rent-setting)</li>
            <li>Housing market equilibrium effects</li>
            <li>Quality deterioration or maintenance reduction</li>
            <li>Second-round effects on wages or employment</li>
            <li>Long-run rent dynamics and market adjustment</li>
          </ul>
        </div>

        <div className="section-card">
          <div className="eyebrow text-slate-500">Sources</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            Data and references
          </h3>
          <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-slate-600 space-y-1">
            <li>Enhanced Family Resources Survey 2023-24 via PolicyEngine UK</li>
            <li>BRMA/LHA rates from DWP Stat-Xplore</li>
            <li>ONS private rent indices</li>
            <li>Resolution Foundation: Housing Outlook Q4 2025</li>
            <li>DWP: LHA unfreeze and SAR impact assessments</li>
            <li>JRF: LHA freeze impact estimates</li>
            <li>LGA/Savills: Social rent cap analysis</li>
          </ul>
        </div>
      </div>

      <div className="section-card">
        <div className="eyebrow text-slate-500">Caveats</div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">
          Important limitations
        </h3>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Static analysis</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              All estimates are static, first-round effects. They show what would
              happen if rents changed today with no behavioural or market response.
              Real-world outcomes would differ as landlords, tenants, and the housing
              market adjust.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800">UC rollout assumption</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              The model assumes the current state of UC rollout. Published estimates
              from earlier years (e.g., DWP 2012 SAR figures) reflect a pre-UC world,
              which explains some differences between PE and published numbers.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Rent growth projections</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              PE uses its own rent index for uprating. Differences in assumed rent
              growth partly explain gaps with Resolution Foundation and other estimates
              that may use different rent data sources.
            </p>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="eyebrow text-slate-500">Replication</div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">
          Code and data pipeline
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          A Python pipeline generates <code>rent_control_results.json</code>,
          which the dashboard consumes at build time. All source code, data
          processing scripts, and configuration are available in the{" "}
          <a
            href="https://github.com/PolicyEngine/rent-control"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            public repository
          </a>.
        </p>
      </div>
    </div>
  );
}
