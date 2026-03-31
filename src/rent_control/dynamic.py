"""Stage 2 dynamic behavioural adjustments for rent control scenarios.

Applies reduced-form elasticities from the empirical literature to
adjust the static PolicyEngine fiscal impact for supply-side responses.

This module has zero coupling to PolicyEngine — it operates entirely
on scalar summary values from Stage 1.
"""

from __future__ import annotations

# ── Parameters with low/central/high bands ──────────────────────────────

DYNAMIC_PARAMS = {
    "low": {
        "supply_elasticity": 0.2,
        "displacement_cost_per_hh": 15_000,
        "pct_displaced_to_ta": 0.10,
        "prs_to_social_transition_rate": 0.08,
        "avg_social_benefit_per_hh": 5_094,
        # Channel C: labour market feedback
        "pct_tenure_switchers_unemployed": 0.05,
        "avg_unemployment_benefit_per_hh": 6_000,
    },
    "central": {
        "supply_elasticity": 0.4,
        "displacement_cost_per_hh": 20_000,
        "pct_displaced_to_ta": 0.20,
        "prs_to_social_transition_rate": 0.11,
        "avg_social_benefit_per_hh": 5_094,
        "pct_tenure_switchers_unemployed": 0.10,
        "avg_unemployment_benefit_per_hh": 7_000,
    },
    "high": {
        "supply_elasticity": 0.8,
        "displacement_cost_per_hh": 25_000,
        "pct_displaced_to_ta": 0.40,
        "prs_to_social_transition_rate": 0.15,
        "avg_social_benefit_per_hh": 5_094,
        "pct_tenure_switchers_unemployed": 0.20,
        "avg_unemployment_benefit_per_hh": 8_000,
    },
}

SCENARIO_RENT_REDUCTION = {
    "cpi1_5pct": 0.05,
    "cpi1_10pct": 0.10,
    "cpi1_15pct": 0.15,
}


# ── Channel A: Supply exit → displacement costs ─────────────────────────


def compute_supply_exit(
    rent_reduction_pct: float,
    n_private_renters: int,
    params: dict,
) -> dict:
    """Estimate landlord exit and temporary accommodation costs.

    1. supply_reduction = elasticity × rent_reduction
    2. units_lost = n_private_renters × supply_reduction
    3. displaced_to_ta = units_lost × pct_displaced_to_ta
    4. cost = displaced_to_ta × cost_per_hh
    """
    supply_reduction_pct = params["supply_elasticity"] * rent_reduction_pct
    units_lost = round(n_private_renters * supply_reduction_pct)
    displaced_to_ta = round(units_lost * params["pct_displaced_to_ta"])
    cost_bn = displaced_to_ta * params["displacement_cost_per_hh"] / 1e9

    return {
        "units_lost": units_lost,
        "displaced_to_ta": displaced_to_ta,
        "supply_exit_cost_bn": round(cost_bn, 2),
    }


# ── Channel B: Tenure transition → additional benefit dependency ────────


def compute_tenure_shift(
    units_lost: int,
    params: dict,
) -> dict:
    """Estimate additional social housing benefit costs from displaced renters.

    1. additional_social = units_lost × prs_to_social_transition_rate
    2. cost = additional_social × avg_social_benefit_per_hh
    """
    additional_social = round(units_lost * params["prs_to_social_transition_rate"])
    cost_bn = additional_social * params["avg_social_benefit_per_hh"] / 1e9

    return {
        "additional_social_tenants": additional_social,
        "tenure_shift_cost_bn": round(cost_bn, 2),
    }


# ── Channel C: Labour market feedback → additional unemployment costs ──


def compute_labour_market_cost(
    additional_social_tenants: int,
    displaced_to_ta: int,
    params: dict,
) -> dict:
    """Estimate additional unemployment benefit costs from constrained job search.

    Social housing tenants have lower re-employment rates in distant
    labour markets (Battu, Ma & Phimister 2008). Displaced households
    — both those entering social housing and temporary accommodation —
    face disrupted employment, with some entering longer-term unemployment.

    1. total_displaced = additional_social_tenants + displaced_to_ta
    2. newly_unemployed = total_displaced × pct_tenure_switchers_unemployed
    3. cost = newly_unemployed × avg_unemployment_benefit_per_hh
    """
    total_displaced = additional_social_tenants + displaced_to_ta
    newly_unemployed = round(total_displaced * params["pct_tenure_switchers_unemployed"])
    cost_bn = newly_unemployed * params["avg_unemployment_benefit_per_hh"] / 1e9

    return {
        "newly_unemployed": newly_unemployed,
        "labour_market_cost_bn": round(cost_bn, 2),
    }


# ── Main entry point ────────────────────────────────────────────────────


def compute_dynamic_adjustment(
    rent_reduction_pct: float,
    static_summary: dict,
    n_private_renters: int,
) -> dict:
    """Compute dynamic adjustments for all three parameter bands.

    Returns a dict with:
    - bands: {low, central, high} each containing cost breakdowns
    - static_fiscal_saving_bn: absolute value of the Stage 1 saving
    - waterfall: {low, central, high} each a list of waterfall steps
    """
    static_saving = abs(static_summary["total_fiscal_bn"])

    bands = {}
    waterfall = {}

    for band_name, params in DYNAMIC_PARAMS.items():
        supply = compute_supply_exit(rent_reduction_pct, n_private_renters, params)
        tenure = compute_tenure_shift(supply["units_lost"], params)
        labour = compute_labour_market_cost(
            tenure["additional_social_tenants"], supply["displaced_to_ta"], params
        )

        total_dynamic_cost = round(
            supply["supply_exit_cost_bn"]
            + tenure["tenure_shift_cost_bn"]
            + labour["labour_market_cost_bn"],
            2,
        )
        net_fiscal = round(static_saving - total_dynamic_cost, 2)

        bands[band_name] = {
            "supply_exit_cost_bn": supply["supply_exit_cost_bn"],
            "tenure_shift_cost_bn": tenure["tenure_shift_cost_bn"],
            "labour_market_cost_bn": labour["labour_market_cost_bn"],
            "total_dynamic_cost_bn": total_dynamic_cost,
            "net_fiscal_bn": net_fiscal,
            "units_lost": supply["units_lost"],
            "displaced_to_ta": supply["displaced_to_ta"],
            "additional_social_tenants": tenure["additional_social_tenants"],
            "newly_unemployed": labour["newly_unemployed"],
        }

        waterfall[band_name] = [
            {"label": "Static fiscal saving", "value": static_saving},
            {"label": "Supply exit cost", "value": -supply["supply_exit_cost_bn"]},
            {"label": "Tenure shift cost", "value": -tenure["tenure_shift_cost_bn"]},
            {"label": "Labour market cost", "value": -labour["labour_market_cost_bn"]},
            {"label": "Net dynamic impact", "value": net_fiscal},
        ]

    return {
        "bands": bands,
        "static_fiscal_saving_bn": static_saving,
        "waterfall": waterfall,
    }
