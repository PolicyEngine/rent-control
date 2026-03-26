"""Analysis functions for rent control policy dashboard.

Uses microdf MicroSeries/MicroDataFrame for all weighted calculations.
No manual weight arithmetic.
"""

from __future__ import annotations

import numpy as np
from microdf import MicroDataFrame, MicroSeries


# ── Baseline builders ────────────────────────────────────────────────────


def build_baseline_summary(df: MicroDataFrame) -> dict:
    """Aggregate baseline housing stats."""
    is_private = (df.tenure == "RENT_PRIVATELY").values
    is_council = (df.tenure == "RENT_FROM_COUNCIL").values
    is_ha = (df.tenure == "RENT_FROM_HA").values
    is_social = is_council | is_ha
    is_renter = is_private | is_social

    result = {
        "n_private_renters": round(MicroSeries(is_private, weights=df.weights).sum()),
        "n_social_renters": round(MicroSeries(is_social, weights=df.weights).sum()),
        "total_private_rent_bn": round(
            MicroSeries(df.rent.values * is_private, weights=df.weights).sum() / 1e9, 1
        ),
        "total_social_rent_bn": round(
            MicroSeries(df.rent.values * is_social, weights=df.weights).sum() / 1e9, 1
        ),
        "avg_private_rent": round(
            MicroSeries(df.rent.values, weights=df.weights * is_private).mean()
        ),
        "avg_social_rent": round(
            MicroSeries(df.rent.values, weights=df.weights * is_social).mean()
        ),
        "hb_spending_bn": round(df.hb.sum() / 1e9, 1),
        "uc_housing_spending_bn": round(df.uc_housing.sum() / 1e9, 1),
        "total_housing_benefit_bn": round(
            (df.hb.sum() + df.uc_housing.sum()) / 1e9, 1
        ),
        "total_housing_costs_bn": round(df.housing_costs.sum() / 1e9, 1),
        "avg_housing_costs": round(df.housing_costs.mean()),
        "total_council_tax_bn": round(df.council_tax.sum() / 1e9, 1),
        "avg_council_tax": round(df.council_tax.mean()),
    }

    if is_renter.any():
        renter_rent = MicroSeries(df.rent.values, weights=df.weights * is_renter)
        renter_inc = MicroSeries(df.hh_income.values, weights=df.weights * is_renter)
        result["avg_rent_to_income_pct"] = round(
            renter_rent.mean() / max(renter_inc.mean(), 1) * 100, 1
        )

    return result


def build_baseline_by_tenure(df: MicroDataFrame) -> list[dict]:
    """HB and UC spending breakdown by tenure type."""
    TENURE_MAP = [
        ("Council", "RENT_FROM_COUNCIL"),
        ("Housing Association", "RENT_FROM_HA"),
        ("Private", "RENT_PRIVATELY"),
    ]
    rows = []
    for label, filter_val in TENURE_MAP:
        mask = (df.tenure == filter_val).values
        w_mask = df.weights * mask
        n = MicroSeries(mask.astype(float), weights=df.weights).sum()
        row = {
            "tenure": label,
            "total_rent_bn": round(MicroSeries(df.rent.values * mask, weights=df.weights).sum() / 1e9, 1),
            "avg_rent": round(MicroSeries(df.rent.values, weights=w_mask).mean()) if n > 0 else 0,
            "hb_bn": round(MicroSeries(df.hb.values * mask, weights=df.weights).sum() / 1e9, 1),
            "uc_housing_bn": round(MicroSeries(df.uc_housing.values * mask, weights=df.weights).sum() / 1e9, 1),
        }
        if n > 0:
            avg_inc = MicroSeries(df.hh_income.values, weights=w_mask).mean()
            avg_r = MicroSeries(df.rent.values, weights=w_mask).mean()
            row["avg_income"] = round(avg_inc)
            row["rent_to_income_pct"] = round(avg_r / max(avg_inc, 1) * 100, 1) if avg_r > 0 else 0
        rows.append(row)
    return rows


def build_baseline_by_decile(df: MicroDataFrame) -> list[dict]:
    """HB + UC spending by income decile, plus affordability and receipt rates."""
    rows = []
    for d in range(1, 11):
        mask = (df.decile == d).values
        w = df.weights * mask

        rent_s = MicroSeries(df.rent.values, weights=w)
        hb_s = MicroSeries(df.hb.values, weights=w)
        uc_s = MicroSeries(df.uc_housing.values, weights=w)
        inc_s = MicroSeries(df.hh_income.values, weights=w)
        hc_s = MicroSeries(df.housing_costs.values, weights=w)

        n_total = MicroSeries(mask.astype(float), weights=df.weights).sum()
        if n_total == 0:
            rows.append({"decile": d})
            continue

        # Average rent among renters only (rent > 0) in this decile
        renter_mask = mask & (df.rent.values > 0)
        w_renters = df.weights * renter_mask
        n_renters = MicroSeries(renter_mask.astype(float), weights=df.weights).sum()
        avg_rent_renters = round(
            MicroSeries(df.rent.values, weights=w_renters).mean()
        ) if n_renters > 0 else 0
        avg_inc_renters = round(
            MicroSeries(df.hh_income.values, weights=w_renters).mean()
        ) if n_renters > 0 else 0

        pct_hb = round(
            MicroSeries((df.hb_raw.values > 0).astype(float), weights=w).sum()
            / n_total * 100, 1
        )
        pct_uc = round(
            MicroSeries((df.uc_raw.values > 0).astype(float), weights=w).sum()
            / n_total * 100, 1
        )

        avg_inc = inc_s.mean()

        row = {
            "decile": d,
            "total_rent_bn": round(MicroSeries(df.rent.values * mask, weights=df.weights).sum() / 1e9, 1),
            "hb_bn": round(MicroSeries(df.hb.values * mask, weights=df.weights).sum() / 1e9, 1),
            "uc_housing_bn": round(MicroSeries(df.uc_housing.values * mask, weights=df.weights).sum() / 1e9, 1),
            "avg_rent": avg_rent_renters,
            "avg_hb": round(hb_s.mean()),
            "avg_uc_housing": round(uc_s.mean()),
            "pct_receiving_hb": pct_hb,
            "pct_receiving_uc_housing": pct_uc,
            "avg_income": round(avg_inc),
            "rent_to_income_pct": round(avg_rent_renters / max(avg_inc_renters, 1) * 100, 1) if n_renters > 0 else 0,
            "avg_housing_costs": round(hc_s.mean()),
            "housing_costs_to_income_pct": round(hc_s.mean() / max(avg_inc, 1) * 100, 1),
        }
        rows.append(row)
    return rows


def build_distributional_impact(df: MicroDataFrame) -> dict:
    """Distributional impact of HB and UC housing element by income decile.

    Uses counterfactual deciles: households are ranked by income EXCLUDING
    the benefit being analysed, avoiding circularity where the benefit
    itself pushes recipients into higher deciles.

    Returns dict with 'hb' and 'uc_housing' keys, each a list of
    {decile, pct_of_income} dicts.
    """
    people = df.people.values
    pw_base = df.weights * people

    result = {"hb": [], "uc_housing": []}
    for d in range(1, 11):
        # HB: decile from income excluding HB
        hb_mask = (df.decile_ex_hb == d).values
        pw_hb = pw_base * hb_mask
        total_hb = MicroSeries(df.hb.values, weights=pw_hb).sum()
        total_inc_ex_hb = MicroSeries(
            df.hh_income.values - df.hb.values, weights=pw_hb
        ).sum()
        result["hb"].append({
            "decile": d,
            "pct_of_income": round(total_hb / max(total_inc_ex_hb, 1) * 100, 1),
        })

        # UC housing: decile from income excluding UC housing
        uc_mask = (df.decile_ex_uc == d).values
        pw_uc = pw_base * uc_mask
        total_uc = MicroSeries(df.uc_housing.values, weights=pw_uc).sum()
        total_inc_ex_uc = MicroSeries(
            df.hh_income.values - df.uc_housing.values, weights=pw_uc
        ).sum()
        result["uc_housing"].append({
            "decile": d,
            "pct_of_income": round(total_uc / max(total_inc_ex_uc, 1) * 100, 1),
        })

    return result


def build_baseline_by_region(df: MicroDataFrame) -> list[dict]:
    """Average rent and benefit spending by region."""
    REGION_LABELS = {
        "NORTH_EAST": "North East",
        "NORTH_WEST": "North West",
        "YORKSHIRE": "Yorkshire and the Humber",
        "EAST_MIDLANDS": "East Midlands",
        "WEST_MIDLANDS": "West Midlands",
        "EAST_OF_ENGLAND": "East of England",
        "LONDON": "London",
        "SOUTH_EAST": "South East",
        "SOUTH_WEST": "South West",
        "WALES": "Wales",
        "SCOTLAND": "Scotland",
        "NORTHERN_IRELAND": "Northern Ireland",
    }
    is_renter = np.isin(
        df.tenure.values, ["RENT_PRIVATELY", "RENT_FROM_COUNCIL", "RENT_FROM_HA"]
    )

    rows = []
    for code, label in REGION_LABELS.items():
        r_mask = (df.region == code).values
        renter_mask = r_mask & is_renter
        w_renter = df.weights * renter_mask
        n_renters = MicroSeries(renter_mask.astype(float), weights=df.weights).sum()
        if n_renters == 0:
            continue

        w_all = df.weights * r_mask
        row = {
            "region": label,
            "n_renters": round(n_renters),
            "avg_rent": round(MicroSeries(df.rent.values, weights=w_renter).mean()),
            "avg_hb": round(MicroSeries(df.hb.values, weights=w_renter).mean()),
            "avg_uc_housing": round(MicroSeries(df.uc_housing.values, weights=w_renter).mean()),
        }
        avg_inc = MicroSeries(df.hh_income.values, weights=w_all).mean()
        avg_r = MicroSeries(df.rent.values, weights=w_renter).mean()
        row["avg_income"] = round(avg_inc)
        row["rent_to_income_pct"] = round(avg_r / max(avg_inc, 1) * 100, 1)
        rows.append(row)
    return rows


def build_tenure_distribution(df: MicroDataFrame) -> list[dict]:
    """Tenure type distribution for pie/bar chart."""
    TENURE_LABELS = {
        "RENT_PRIVATELY": "Private renter",
        "RENT_FROM_COUNCIL": "Council tenant",
        "RENT_FROM_HA": "Housing association",
        "OWNED_OUTRIGHT": "Owned outright",
        "OWNED_WITH_MORTGAGE": "Owned with mortgage",
    }
    total = df.rent.count()
    rows = []
    for code, label in TENURE_LABELS.items():
        n = MicroSeries((df.tenure == code).values.astype(float), weights=df.weights).sum()
        rows.append({
            "tenure": label,
            "n_households": round(n),
            "pct": round(n / max(total, 1) * 100, 1),
        })
    return rows


# ── Reform impact builders ───────────────────────────────────────────────


def build_reform_summary(
    bl: MicroDataFrame,
    rf: MicroDataFrame,
    target_mask: np.ndarray,
) -> dict:
    """Compute aggregate reform impact metrics."""
    w = bl.weights

    hb_change = MicroSeries(rf.hb.values - bl.hb.values, weights=w).sum() / 1e9
    uc_change = MicroSeries(rf.uc_housing.values - bl.uc_housing.values, weights=w).sum() / 1e9
    total_fiscal = hb_change + uc_change

    rent_saved_hh = bl.rent.values - rf.rent.values
    benefit_lost_hh = bl.hh_income.values - rf.hh_income.values
    hh_net_gain = rent_saved_hh - benefit_lost_hh

    gaining = hh_net_gain > 0
    gaining_s = MicroSeries(gaining.astype(float), weights=w)
    w_gaining = gaining_s.sum()
    n_gaining = round(w_gaining)
    avg_gain = (
        MicroSeries(hh_net_gain * gaining, weights=w).sum() / w_gaining
        if w_gaining > 0
        else 0
    )

    rent_saved_bn = MicroSeries(rent_saved_hh * target_mask, weights=w).sum() / 1e9
    benefit_lost_bn = MicroSeries(benefit_lost_hh * target_mask, weights=w).sum() / 1e9
    tenant_net = rent_saved_bn - benefit_lost_bn

    return {
        "hb_change_bn": round(hb_change, 1),
        "uc_change_bn": round(uc_change, 1),
        "total_fiscal_bn": round(total_fiscal, 1),
        "n_gaining": n_gaining,
        "avg_gain_per_hh": round(avg_gain),
        "rent_saved_bn": round(rent_saved_bn, 1),
        "benefit_lost_bn": round(benefit_lost_bn, 1),
        "tenant_net_gain_bn": round(tenant_net, 1),
    }


def build_reform_by_decile(
    bl: MicroDataFrame,
    rf: MicroDataFrame,
    target_mask: np.ndarray,
) -> list[dict]:
    """Per-decile breakdown: rent saved, benefit lost, net gain."""
    w = bl.weights
    decile = bl.decile.values

    rent_saved = bl.rent.values - rf.rent.values
    benefit_lost = bl.hh_income.values - rf.hh_income.values
    net_gain = rent_saved - benefit_lost

    renter_mask = bl.rent.values > 0

    rows = []
    for d in range(1, 11):
        d_mask = (decile == d)
        d_target = d_mask & target_mask
        d_renters = d_mask & renter_mask
        dw = w * d_target
        # Renters in this decile (for averages and winner/loser %)
        n_renters = MicroSeries(d_renters.astype(float), weights=w).sum()
        total_w = MicroSeries(d_target.astype(float), weights=w).sum()

        if total_w == 0:
            rows.append({
                "decile": d,
                "rent_saved_mn": 0,
                "benefit_lost_mn": 0,
                "net_gain_mn": 0,
                "avg_rent_saved": 0,
                "avg_benefit_lost": 0,
                "avg_net_gain": 0,
                "pct_winners": 0,
                "pct_losers": 0,
                "pct_unchanged": 100,
            })
            continue

        # Averages among renters in this decile
        rw = w * d_renters
        rs = MicroSeries(rent_saved, weights=rw)
        bl_s = MicroSeries(benefit_lost, weights=rw)

        rent_saved_mn = MicroSeries(rent_saved, weights=dw).sum() / 1e6
        benefit_lost_mn = MicroSeries(benefit_lost, weights=dw).sum() / 1e6
        net_gain_mn = rent_saved_mn - benefit_lost_mn

        # Winners/losers among renters in this decile
        pct_winners = round(
            MicroSeries((net_gain > 0).astype(float) * d_renters, weights=w).sum()
            / max(n_renters, 1) * 100, 1
        )
        pct_losers = round(
            MicroSeries((net_gain < 0).astype(float) * d_renters, weights=w).sum()
            / max(n_renters, 1) * 100, 1
        )
        pct_unchanged = round(100 - pct_winners - pct_losers, 1)

        avg_inc_renters = MicroSeries(bl.hh_income.values, weights=rw).mean()
        avg_net = rs.mean() - bl_s.mean()

        rows.append({
            "decile": d,
            "rent_saved_mn": round(rent_saved_mn, 1),
            "benefit_lost_mn": round(benefit_lost_mn, 1),
            "net_gain_mn": round(net_gain_mn, 1),
            "avg_rent_saved": round(rs.mean()),
            "avg_benefit_lost": round(bl_s.mean()),
            "avg_net_gain": round(avg_net),
            "avg_net_gain_pct": round(avg_net / max(avg_inc_renters, 1) * 100, 2),
            "pct_winners": pct_winners,
            "pct_losers": pct_losers,
            "pct_unchanged": pct_unchanged,
        })
    return rows


# ── Comparison table ─────────────────────────────────────────────────────

PUBLISHED_ESTIMATES = {
    "blanket_rent_reduction": {
        "description": "No published microsimulation estimates exist for blanket private rent reductions.",
        "estimates": [],
    },
    "lha_unfreeze": {
        "description": "Unfreezing LHA to 30th percentile of market rents.",
        "estimates": [
            {
                "source": "Resolution Foundation",
                "metric": "Total government cost",
                "value": "\u00A31.7bn",
                "year": "2024-25",
            },
            {
                "source": "DWP",
                "metric": "Households gaining",
                "value": "1.6m",
                "year": "2024",
            },
            {
                "source": "DWP",
                "metric": "Average gain per household",
                "value": "\u00A3785/yr",
                "year": "2024",
            },
            {
                "source": "JRF",
                "metric": "Average loss from freeze",
                "value": "~\u00A3700/yr",
                "year": "2024",
            },
        ],
    },
    "sar_abolition": {
        "description": "Abolishing or lowering the Shared Accommodation Rate age threshold.",
        "estimates": [
            {
                "source": "DWP",
                "metric": "Affected people",
                "value": "63,000",
                "year": "2012",
            },
            {
                "source": "DWP",
                "metric": "Average loss per person",
                "value": "\u00A341/week (\u00A32,132/yr)",
                "year": "2012",
            },
            {
                "source": "DWP",
                "metric": "Estimated cost to reverse",
                "value": "~\u00A3135m/yr",
                "year": "2012",
            },
        ],
    },
    "social_rent_cap": {
        "description": "Tighter caps on council and housing association rents.",
        "estimates": [
            {
                "source": "LGA/Savills",
                "metric": "Council revenue loss from 5% cap",
                "value": "\u00A33bn over 5 years (\u00A30.6bn/yr)",
                "year": "2023",
            },
            {
                "source": "LGA/Savills",
                "metric": "CPI+1% vs CPI-only gap",
                "value": "\u00A31.1bn/yr by 2035",
                "year": "2023",
            },
        ],
    },
}


def get_published_estimates(policy_id: str) -> dict:
    return PUBLISHED_ESTIMATES.get(policy_id, {"description": "", "estimates": []})
