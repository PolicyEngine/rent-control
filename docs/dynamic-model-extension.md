# Dynamic model extension: rent controls with behavioural responses

## Context

The current model runs **static** microsimulations via PolicyEngine UK. Each reform scenario modifies rents or benefit parameters, then PE recalculates household incomes and government spending. Households do not change behaviour — no one moves tenure, leaves the labour market, or exits the rental sector.

This document outlines a two-stage approach to extend the model with **dynamic behavioural responses**, using elasticities from the empirical literature.

---

## Stage 1: Static rent control reform (implemented)

A true rent control policy directly caps how much private landlords can charge. In PolicyEngine terms this means overwriting the `rent` input variable for private tenure households.

### What Stage 1 does

1. Apply a rent cap to private renters (e.g. CPI+1% annual increase cap, modelled as a percentage reduction from current market rents)
2. PE recalculates Housing Benefit and Universal Credit housing element at the new lower rent
3. Compute first-round fiscal impact: government saves on housing subsidies, tenants keep more income

### What Stage 1 does NOT do

- Model landlords exiting the private rented sector
- Model tenants switching between private and social housing
- Model labour market effects of tenure changes
- Estimate displacement or temporary accommodation costs

---

## Stage 2: Behavioural responses (future work)

Stage 2 wraps the Stage 1 PE output with a post-processing layer that applies empirical elasticities.

### 2a. Supply response

Using the rent cap magnitude and supply elasticity, estimate how many landlords exit the private rented sector.

| Parameter | Source | Value |
|---|---|---|
| Price elasticity of new housing supply | Hilber & Vermeulen (2016) | **0.4** |
| Landlord incidence share of benefit cuts | Gibbons & Manning (2006) | **67%** |
| Supply reduction under rent control | Diamond, McQuade & Qian (2019) | **15%** |

### 2b. Tenure transitions

Displaced tenants must go somewhere. The UKHLS tenure flow data provides baseline transition rates.

| Parameter | Source | Value |
|---|---|---|
| Private rented to social housing | Understanding Society (UKHLS) | **11%** of movers |
| Social housing to private rented | Understanding Society (UKHLS) | **26%** of movers |
| Mobility reduction under rent control | Diamond, McQuade & Qian (2019) | **20%** |

Under rent controls, the PRS-to-social transition rate would increase (as supply shrinks and some tenants are displaced) while mobility overall falls (lock-in effect).

### 2c. Labour market feedback

Tenure transitions affect employment outcomes, creating fiscal feedback loops.

| Parameter | Source | Value |
|---|---|---|
| Employment hazard for social renters | Battu, Ma & Phimister (2008) | Lower than private renters |
| Residential mobility by employment status | Boheim & Taylor (2002) | Unemployed more mobile |

Households displaced from PRS into social housing face constrained job search, potentially increasing benefit dependency.

### 2d. Fiscal cost of displacement

| Parameter | Source | Value |
|---|---|---|
| Temporary accommodation cost per household | LGA (2024) | **~£20,000/yr** |
| Total temporary accommodation spending | LGA (2024) | **£2.3bn/yr** for 117,000 households |
| Waiting list queue time (Stockholm benchmark) | Bostadsformedlingen (2023) | **9-18 years** |

### Computation flow

```
Stage 1 (PolicyEngine):
  Baseline simulation → Reform simulation (rent capped) → fiscal delta A

Stage 2 (post-processing):
  fiscal delta A
  → Apply supply elasticity → estimate X landlords exit PRS
  → Apply transition probabilities → estimate Y households displaced
  → Y × displacement cost per household = fiscal cost B
  → Labour market feedback → estimate Z additional benefit claims = fiscal cost C

  Net fiscal impact = A - B - C
```

### Implementation approach

Stage 2 does not require changes to PolicyEngine itself. It would be a Python post-processing module that:

1. Takes the Stage 1 reform summary (rent saved, benefit change, number affected)
2. Applies elasticity parameters as multipliers
3. Outputs adjusted fiscal impact with confidence intervals based on parameter ranges
4. Feeds adjusted results into the same JSON structure consumed by the dashboard

---

## Policy scenarios

### Currently implemented (static)

| Policy | Type | Mechanism |
|---|---|---|
| Blanket rent reduction | Hypothetical | Direct rent override (-10%) |
| LHA unfreeze | Subsidy reform | PE parameter change (LHA.freeze) |
| SAR abolition | Subsidy reform | PE parameter change (LHA.shared_accommodation_age_threshold) |
| Social rent cap | Rent control (social) | Direct rent override (-5%) |

### Added in Stage 1

| Policy | Type | Mechanism |
|---|---|---|
| Rent control (CPI+1% cap) | Rent control (private) | Direct rent override, modelling the gap between market rent growth and a CPI+1% cap |

This is the first genuine private-sector rent control scenario. The blanket rent reduction is a counterfactual ("what if rents were lower?"). The CPI+1% cap models an actual policy: limiting annual private rent increases to CPI inflation plus 1 percentage point.

---

## Key literature

| Paper | Category | Key finding |
|---|---|---|
| Hilber & Vermeulen (2016) | Supply elasticity | England's long-run price elasticity of new housing supply averages **0.4** |
| Andrew & Meen (2003) | Tenure elasticities | Income elasticity of housing demand is **1.27** |
| Gibbons & Manning (2006) | Tenure elasticities | **67%** of Housing Benefit cuts absorbed by landlords |
| Understanding Society (UKHLS) | Transition probabilities | **11%** of PRS movers go to social housing, **26%** of social movers go to PRS |
| Diamond, McQuade & Qian (2019) | Rent control effects | **15%** supply reduction, **20%** mobility reduction |
| Battu, Ma & Phimister (2008) | Labour market & tenure | Social housing constrains job search for unemployed |
| Boheim & Taylor (2002) | Labour market & tenure | Tenure type conditions residential mobility |
| Bostadsformedlingen (2023) | Rent control effects | **9-18 year** queue for rent-controlled housing (Stockholm) |
| Scottish Association of Landlords | Rent control effects | **22,000 properties** withdrawn after Scotland's 2022 rent freeze |
| LGA (2024) | Fiscal costs | Temporary accommodation costs **£2.3bn/yr** for 117,000 households |
