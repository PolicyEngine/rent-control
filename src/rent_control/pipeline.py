"""Orchestrates PolicyEngine UK microsimulation runs for rent control policies.

Generates rent_control_results.json consumed by the dashboard.
Uses MicroDataFrame for all weighted calculations.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from microdf import MicroDataFrame

from .analysis import (
    build_baseline_by_decile,
    build_baseline_by_region,
    build_baseline_by_tenure,
    build_baseline_summary,
    build_distributional_impact,
    build_reform_by_decile,
    build_reform_summary,
    build_tenure_distribution,
    get_published_estimates,
)

DEFAULT_YEAR = 2026
DEFAULT_OUTPUT_PATH = Path("data/rent_control_results.json")
DEFAULT_DASHBOARD_OUTPUT_PATH = Path("dashboard/public/data/rent_control_results.json")


def _policyengine_classes():
    try:
        from policyengine_uk import Microsimulation
        from policyengine_uk.utils.scenario import Scenario
        from policyengine_uk.variables.household.demographic.tenure_type import (
            TenureType,
        )
        from policyengine_core.periods import instant
    except ImportError as exc:
        raise RuntimeError(
            "Running the simulation requires policyengine-uk. "
            "Install the package with the simulation extra first."
        ) from exc
    return Microsimulation, Scenario, TenureType, instant


# ── Simulation modifiers ─────────────────────────────────────────────────


def make_rent_reduction(pct, TenureType):
    """Reduce private rents by pct."""
    rent_privately_idx = TenureType.RENT_PRIVATELY.index

    def apply(sim):
        rent_holder = sim.get_holder("rent")
        tenure_holder = sim.get_holder("tenure_type")
        for period in rent_holder.get_known_periods():
            rent_array = rent_holder.get_array(period).copy()
            tenure_array = tenure_holder.get_array(str(period))
            if tenure_array is None:
                continue
            is_private = tenure_array == rent_privately_idx
            rent_array[is_private] *= 1 - pct
            sim.set_input("rent", str(period), rent_array)
        sim.reset_calculations()

    return apply


def make_lha_unfreeze(instant_fn, new_percentile=None):
    """Unfreeze LHA, optionally change percentile."""

    def apply(sim):
        lha = sim.tax_benefit_system.parameters.gov.dwp.LHA
        start = instant_fn("2025-01-01")
        stop = instant_fn("2030-12-31")
        lha.freeze.update(start=start, stop=stop, value=False)
        if new_percentile is not None:
            lha.percentile.update(start=start, stop=stop, value=new_percentile)
        sim.tax_benefit_system.reset_parameter_caches()
        sim.reset_calculations()

    return apply


def make_sar_reform(instant_fn, new_age):
    """Lower shared accommodation rate age threshold."""

    def apply(sim):
        p = sim.tax_benefit_system.parameters.gov.dwp.LHA
        start = instant_fn("2025-01-01")
        stop = instant_fn("2030-12-31")
        p.shared_accommodation_age_threshold.update(
            start=start, stop=stop, value=new_age
        )
        sim.tax_benefit_system.reset_parameter_caches()
        sim.reset_calculations()

    return apply


def make_social_rent_cap(pct, TenureType):
    """Reduce social housing rents by pct."""
    council_idx = TenureType.RENT_FROM_COUNCIL.index
    ha_idx = TenureType.RENT_FROM_HA.index

    def apply(sim):
        rent_holder = sim.get_holder("rent")
        tenure_holder = sim.get_holder("tenure_type")
        for period in rent_holder.get_known_periods():
            rent_array = rent_holder.get_array(period).copy()
            tenure_array = tenure_holder.get_array(str(period))
            if tenure_array is None:
                continue
            is_social = (tenure_array == council_idx) | (tenure_array == ha_idx)
            rent_array[is_social] *= 1 - pct
            sim.set_input("rent", str(period), rent_array)
        sim.reset_calculations()

    return apply


# ── Extraction helpers ───────────────────────────────────────────────────


def _compute_prorated_uc_housing(sim, year):
    """Prorate UC housing element by the taper-reduced share of actual UC.

    UC housing element is a pre-taper component. The actual UC paid is
    elements - taper * income. Housing's effective share =
    housing_element / sum_of_all_elements * actual_uc.
    """
    uc = sim.calculate("universal_credit", year, map_to="household").values
    uc_housing = sim.calculate("uc_housing_costs_element", year, map_to="household").values
    uc_standard = sim.calculate("uc_standard_allowance", year, map_to="household").values
    uc_child = sim.calculate("uc_child_element", year, map_to="household").values
    uc_childcare = sim.calculate("uc_childcare_element", year, map_to="household").values
    uc_lcwra = sim.calculate("uc_LCWRA_element", year, map_to="household").values
    uc_carer = sim.calculate("uc_carer_element", year, map_to="household").values

    all_elements = uc_housing + uc_standard + uc_child + uc_childcare + uc_lcwra + uc_carer
    return np.where(
        (uc > 0) & (all_elements > 0),
        uc_housing * (uc / all_elements),
        0,
    )


def _extract_baseline_df(sim, year, Microsimulation, Scenario, instant_fn) -> MicroDataFrame:
    """Extract baseline data into a MicroDataFrame with weights.

    HB = actual housing_benefit (same measure as reform, so diffs are real).
    UC housing = prorated by taper-reduced share of actual UC.

    Includes counterfactual deciles for distributional impact charts:
    decile_ex_hb  = decile based on income excluding HB
    decile_ex_uc  = decile based on income excluding UC housing element
    """
    from microdf import MicroSeries as MS

    weights = sim.calculate("household_weight", year).values
    hh_inc = sim.calculate("household_net_income", year, map_to="household").values
    people = sim.calculate("household_count_people", year).values

    hb = sim.calculate("housing_benefit", year, map_to="household").values
    print("  Computing prorated UC housing...")
    uc_h = _compute_prorated_uc_housing(sim, year)

    # Person-weighted deciles excluding each benefit
    pw = weights * people
    decile_ex_hb = MS(hh_inc - hb, weights=pw).decile_rank().values
    decile_ex_uc = MS(hh_inc - uc_h, weights=pw).decile_rank().values

    # Raw HB and UC for receipt rate charts (not budget figures)
    hb_raw = sim.calculate("housing_benefit", year, map_to="household").values
    uc_raw = sim.calculate("universal_credit", year, map_to="household").values

    df = MicroDataFrame(
        {
            "tenure": sim.calculate("tenure_type", year, map_to="household").values,
            "decile": sim.calculate("household_income_decile", year, map_to="household").values,
            "decile_ex_hb": decile_ex_hb,
            "decile_ex_uc": decile_ex_uc,
            "rent": sim.calculate("rent", year, map_to="household").values,
            "hb": hb,
            "uc_housing": uc_h,
            "hb_raw": hb_raw,
            "uc_raw": uc_raw,
            "hh_income": hh_inc,
            "country": sim.calculate("country", year, map_to="household").values,
            "region": sim.calculate("region", year, map_to="household").values,
            "housing_costs": sim.calculate("housing_costs", year, map_to="household").values,
            "council_tax": sim.calculate("council_tax", year, map_to="household").values,
            "people": people,
        },
        weights=weights,
    )
    return df


def _extract_reform_df(sim, year, baseline_df: MicroDataFrame) -> MicroDataFrame:
    """Extract reform data, reusing baseline weights and decile.

    Both baseline and reform use actual housing_benefit and prorated UC
    housing, so differences represent real policy effects.
    """
    uc = sim.calculate("universal_credit", year, map_to="household").values
    uc_h_raw = sim.calculate("uc_housing_costs_element", year, map_to="household").values
    uc_standard = sim.calculate("uc_standard_allowance", year, map_to="household").values
    uc_child = sim.calculate("uc_child_element", year, map_to="household").values
    uc_childcare = sim.calculate("uc_childcare_element", year, map_to="household").values
    uc_lcwra = sim.calculate("uc_LCWRA_element", year, map_to="household").values
    uc_carer = sim.calculate("uc_carer_element", year, map_to="household").values
    all_elements = uc_h_raw + uc_standard + uc_child + uc_childcare + uc_lcwra + uc_carer
    uc_h = np.where(
        (uc > 0) & (all_elements > 0),
        uc_h_raw * (uc / all_elements),
        0,
    )
    df = MicroDataFrame(
        {
            "hb": sim.calculate("housing_benefit", year, map_to="household").values,
            "uc_housing": uc_h,
            "hh_income": sim.calculate("household_net_income", year, map_to="household").values,
            "rent": sim.calculate("rent", year, map_to="household").values,
            "decile": baseline_df.decile.values,
        },
        weights=baseline_df.weights,
    )
    return df


def _run_scenario(Microsimulation, Scenario, modifier, year, baseline_df):
    """Run a reform scenario and extract results as MicroDataFrame."""
    sim = Microsimulation(scenario=Scenario(simulation_modifier=modifier))
    return _extract_reform_df(sim, year, baseline_df)


def _build_by_hh_type(sim, year):
    """Average rent by household type (benunit-level, renters only)."""
    from microdf import MicroSeries

    ft = sim.calculate("family_type", year, decode_enums=True).values
    eldest = sim.calculate("eldest_adult_age", year).values
    rent = sim.calculate("benunit_rent", year).values
    bw = sim.calculate("benunit_weight", year).values
    is_pensioner = eldest >= 66

    HH_TYPES = [
        ("Pensioner (single)", (ft == "SINGLE") & is_pensioner),
        ("Pensioner (couple)", (ft == "COUPLE_NO_CHILDREN") & is_pensioner),
        ("Single", (ft == "SINGLE") & ~is_pensioner),
        ("Couple, no children", (ft == "COUPLE_NO_CHILDREN") & ~is_pensioner),
        ("Single parent", ft == "LONE_PARENT"),
        ("Couple with children", ft == "COUPLE_WITH_CHILDREN"),
    ]

    rows = []
    for label, mask in HH_TYPES:
        renter_mask = mask & (rent > 0)
        n_renters = MicroSeries(renter_mask.astype(float), weights=bw).sum()
        if n_renters == 0:
            continue
        avg_rent = MicroSeries(rent, weights=bw * renter_mask).mean()
        rows.append({
            "hh_type": label,
            "n_renters": round(n_renters),
            "avg_rent": round(avg_rent),
        })
    return rows


# ── Policy definitions ───────────────────────────────────────────────────


def _build_policy_configs(TenureType, instant_fn):
    """Return dict of policy group -> list of scenario configs.

    Each policy uses a single scenario matching externally published estimates
    where available.
    """
    return {
        "blanket_rent_reduction": {
            "description": "If private rents were 10% lower, how would government housing benefit spending and tenant incomes change?",
            "scenarios": [
                {"id": "10pct", "label": "10% reduction", "modifier": make_rent_reduction(0.10, TenureType), "mask_key": "private"},
            ],
        },
        "lha_unfreeze": {
            "description": "Unfreezing Local Housing Allowance rates to the 30th percentile of market rents.",
            "scenarios": [
                {"id": "30th", "label": "30th percentile", "modifier": make_lha_unfreeze(instant_fn), "mask_key": "private"},
            ],
        },
        "sar_abolition": {
            "description": "Abolishing the Shared Accommodation Rate so all single adults get full LHA from age 18.",
            "scenarios": [
                {"id": "abolish_18", "label": "Abolish (age 18)", "modifier": make_sar_reform(instant_fn, 18), "mask_key": "private"},
            ],
        },
        "social_rent_cap": {
            "description": "A 5% cap on council and housing association rents.",
            "scenarios": [
                {"id": "5pct", "label": "5% reduction", "modifier": make_social_rent_cap(0.05, TenureType), "mask_key": "social"},
            ],
        },
    }


# ── Main pipeline ────────────────────────────────────────────────────────


def build_results(year: int = DEFAULT_YEAR) -> dict:
    Microsimulation, Scenario, TenureType, instant_fn = _policyengine_classes()

    print("Loading baseline simulation...")
    baseline = Microsimulation()
    bl_df = _extract_baseline_df(baseline, year, Microsimulation, Scenario, instant_fn)

    # Tenure masks
    is_private = (bl_df.tenure == "RENT_PRIVATELY").values
    is_council = (bl_df.tenure == "RENT_FROM_COUNCIL").values
    is_ha = (bl_df.tenure == "RENT_FROM_HA").values
    is_social = is_council | is_ha
    mask_map = {
        "private": is_private,
        "social": is_social,
    }

    results = {"year": year}

    # Baseline
    results["baseline"] = {
        "summary": build_baseline_summary(bl_df),
        "by_tenure": build_baseline_by_tenure(bl_df),
        "by_decile": build_baseline_by_decile(bl_df),
        "by_region": build_baseline_by_region(bl_df),
        "by_hh_type": _build_by_hh_type(baseline, year),
        "tenure_distribution": build_tenure_distribution(bl_df),
        "distributional_impact": build_distributional_impact(bl_df),
    }

    # Policies
    policy_configs = _build_policy_configs(TenureType, instant_fn)
    results["policies"] = {}

    for policy_id, config in policy_configs.items():
        print(f"\nRunning policy: {policy_id}")
        policy_result = {
            "description": config["description"],
            "scenarios": {},
            "published_comparison": get_published_estimates(policy_id),
        }

        for scenario in config["scenarios"]:
            label = scenario["label"]
            print(f"  Scenario: {label}...")
            rf_df = _run_scenario(
                Microsimulation, Scenario, scenario["modifier"], year, bl_df
            )
            target_mask = mask_map[scenario["mask_key"]]

            policy_result["scenarios"][scenario["id"]] = {
                "label": label,
                "summary": build_reform_summary(bl_df, rf_df, target_mask),
                "by_decile": build_reform_by_decile(bl_df, rf_df, target_mask),
            }

        results["policies"][policy_id] = policy_result

    return results


def write_results(results: dict, output_path: Path = DEFAULT_OUTPUT_PATH) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2) + "\n")
    return output_path


def sync_dashboard_results(
    source_path: Path = DEFAULT_OUTPUT_PATH,
    dashboard_output_path: Path = DEFAULT_DASHBOARD_OUTPUT_PATH,
) -> Path:
    dashboard_output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, dashboard_output_path)
    return dashboard_output_path


def generate_results_file(
    year: int = DEFAULT_YEAR,
    output_path: Path = DEFAULT_OUTPUT_PATH,
    sync_dashboard: bool = False,
    dashboard_output_path: Path = DEFAULT_DASHBOARD_OUTPUT_PATH,
) -> dict:
    results = build_results(year=year)
    written_output = write_results(results, output_path)
    if sync_dashboard:
        sync_dashboard_results(written_output, dashboard_output_path)
    return results
