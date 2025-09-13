# Algorithmic Blueprint for a Dynamic Tax Bracket Filling Roth Conversion Strategy

## Section 1: Foundational Data Structures and System Assumptions

The efficacy and accuracy of any long-term financial projection engine are predicated entirely on the integrity of its foundational data architecture. This section specifies the complete data schema required to model the complex interactions of income, assets, taxes, and time. It is divided into three core components: user-defined inputs, system-level static data, and the capital market assumptions that drive asset growth. This architecture is designed with modularity and legislative adaptability in mind, particularly acknowledging the scheduled expiration of key Tax Cuts and Jobs Act (TCJA) provisions at the end of 2025.

### 1.1. User-Defined Input Variables (The "Intake Form" Schema)

The following data points constitute the minimum required inputs from the end-user to initialize a projection. These variables form the personalized financial profile upon which all simulations are based.

**Table 1.1: Master Input Schema**

| Variable Name | Data Type | Description |
|---------------|-----------|-------------|
| user_dob | Date | User's date of birth |
| spouse_dob | Date | Spouse's date of birth |
| user_retirement_age | Integer | User's desired age at the start of retirement |
| spouse_retirement_age | Integer | Spouse's desired age at the start of retirement |
| user_ss_claim_age | Integer | User's intended age to begin Social Security benefits |
| spouse_ss_claim_age | Integer | Spouse's intended age to begin Social Security benefits |
| longevity_age | Integer | Assumed age of death for projection endpoint. Default: 90 |
| user_gross_income | Currency | User's current annual pre-tax, pre-deduction income |
| spouse_gross_income | Currency | Spouse's current annual pre-tax, pre-deduction income |
| user_deductions | Currency | User's annual pre-tax deductions (e.g., 401(k), HSA) |
| spouse_deductions | Currency | Spouse's annual pre-tax deductions (e.g., 401(k), HSA) |
| filing_status | String | Tax filing status (e.g., 'MFJ', 'Single') |
| state_of_residence | String | Two-letter state code for state tax calculations (e.g., 'MA') |
| desired_monthly_retirement_expense | Currency | Desired monthly spending in retirement, in today's dollars |
| accounts | Array[Object] | Array of all financial accounts |

The accounts array is a critical structure, composed of objects where each object represents a single financial account. This granular detail is necessary to model tax-specific withdrawal consequences and asset growth correctly. Each account object must contain:

- **account_type**: String (e.g., 'Taxable', 'Savings', 'Traditional IRA', 'Roth IRA', '401k', '403b')
- **owner**: String ('User', 'Spouse', 'Joint')
- **balance**: Currency (Current market value)
- **cost_basis**: Currency (Applicable only to 'Taxable' accounts for capital gains calculations)
- **asset_allocation_model**: String (e.g., 'Aggressive Growth', 'Balanced', 'Conservative'). This links to the Capital Market Assumptions module

### 1.2. System-Level Static Data & Core Assumptions

This data is maintained by the system, not the user, and must be architected for annual updates to reflect new legislation and economic data. A key architectural feature must be the ability to handle a "tax regime" shift. The model must apply one set of rules for years up to and including 2025, and a different, pre-TCJA based set of rules for 2026 and beyond, when major provisions are scheduled to sunset. This bifurcation is fundamental, as it creates the primary rationale for executing Roth conversions before 2026—to lock in today's potentially lower tax rates before they revert to higher levels.

**Table 1.2: System Assumptions & Economic Data**

| Parameter | Value/Source | Description |
|-----------|--------------|-------------|
| inflation_rate | 2.5% (Example) | Long-term average annual inflation rate. Used to adjust expenses, tax brackets, etc. Based on forecasts from sources like Vanguard |
| social_security_cola | 2.0% (Example) | Assumed annual Social Security Cost-of-Living Adjustment |
| Tax Code Tables | (See Appendix) | Multi-year, multi-dimensional arrays for: Federal income tax brackets & rates (pre/post-2026), Federal standard deductions (pre/post-2026), LTCG brackets, State tax rules |
| SS Taxation Tables | (See Appendix) | Provisional income thresholds for 0%, 50%, 85% taxability |
| Medicare IRMAA Tables | (See Appendix) | Multi-year brackets for Part B & D premium surcharges |
| RMD Uniform Lifetime Table | (See Appendix) | IRS factors for calculating Required Minimum Distributions |
| Estate & Gift Tax Tables | (See Appendix) | Federal & State exemption amounts and rates (pre/post-2026) |

### 1.3. Capital Market Assumptions (CMA) Module

Projecting the growth of user assets requires a robust and defensible set of long-term capital market assumptions. These assumptions translate an account's asset_allocation_model into tangible growth. The model will synthesize forecasts from multiple institutional sources to create a balanced outlook.

The strategy of this module is to map high-level allocation styles (which are user-friendly) to specific return and yield characteristics. For instance, an "Aggressive Growth" portfolio will have a higher expected return but also a higher allocation to equities, which influences its dividend yield.

**Table 1.3: Capital Market Assumptions (Illustrative)**

| Asset Allocation Model | Asset Class | % Allocation | Expected Annual Return | Expected Dividend Yield | Source Snippets |
|------------------------|-------------|--------------|------------------------|---------------------|-----------------|
| Conservative | Equities | 20% | 4.5% | 1.5% | 5 |
| | Bonds | 50% | 4.5% | 3.0% | |
| | Cash | 30% | 3.0% | 3.0% | |
| Balanced | Equities | 60% | 6.4% | 1.5% | 20 |
| | Bonds | 40% | 4.8% | 3.5% | |
| Aggressive Growth | Equities | 85% | 7.5% | 1.5% | 21 |
| | Bonds | 10% | 5.0% | 4.0% | |
| | Cash | 5% | 3.0% | 3.0% | |

These return figures are synthesized from a variety of sources. For example, J.P. Morgan's 2025 forecast projects a 6.4% return for a 60/40 USD portfolio, with U.S. large-cap equities at 6.7%. Vanguard projects a more modest 3.8%–5.8% for U.S. equities but a strong 4.2%–5.2% for U.S. bonds. BlackRock remains constructive on U.S. equities, while Amundi notes the renewed appeal of bonds. The model uses a blended, reasonable long-term expectation based on this institutional consensus. Each year, an account's balance will be grown by its Expected Annual Return, with distributions for dividends calculated based on the Expected Dividend Yield.

## Section 2: The Core Projection Engine: Modeling the "No Conversion" Baseline

To quantify the value of the Roth conversion strategy, it is essential to first construct a detailed, dynamic simulation of the user's financial life without the strategy. This "No Conversion" baseline serves as the control scenario. It is not a static projection but a dynamic model designed to reveal the latent tax pressures that build over a lifetime, particularly the "tax torpedo" that occurs when Required Minimum Distributions (RMDs) begin. The accuracy of this baseline is paramount, as all subsequent comparisons depend on it.

### 2.1. The Annual Simulation Loop: Order of Operations

The projection engine operates on an annual loop, iterating from the current year until the user's specified longevity_age. The order of operations within this loop is critical to ensure that calculations are based on the correct inputs (e.g., taxes are calculated after all income for the year is known).

**Annual Loop Logic (Year Y):**

1. **Start of Year State Update:**
   - Increment user_age and spouse_age by 1
   - Apply inflation to desired_monthly_retirement_expense to get the annual expense target for year Y
   - Apply inflation and other adjustments to system-level data (tax brackets, deductions, etc.) as per their respective rules

2. **Income Determination:** Calculate all non-discretionary income for year Y. This includes wages, pensions, Social Security, investment income from taxable accounts, and mandatory RMDs.

3. **Expense & Withdrawal Calculation:**
   - Determine total_cash_need for year Y (living expenses + taxes + Medicare premiums)
   - Subtract post-tax income sources to find net_cash_need
   - Execute withdrawals from accounts to cover net_cash_need according to the defined withdrawal hierarchy

4. **Tax Calculation:** Based on the sum of all income events and deductions, calculate the comprehensive federal and state tax liability for year Y.

5. **Tax Payment:** Debit the tax liability from the appropriate accounts, which may itself be a taxable event if assets are sold from a taxable account.

6. **End of Year Asset Growth:** Apply the Capital Market Assumptions to the end-of-year balances of all accounts to determine their value at the start of year Y+1.

7. **Data Logging:** Record all key financial metrics for year Y into an output data structure for final analysis and display.

### 2.2. Modeling Income Streams (Pre-Withdrawal)

In each year of the simulation, the model aggregates income from all potential sources.

- **Wages/Earned Income:** If current_year is before a user's specified retirement age, their user_gross_income (and/or spouse_gross_income) is added to the total income for the year.

- **Pension Income:** Any fixed, user-defined pension payments are added.

- **Social Security Benefits:** If user_age is greater than or equal to user_ss_claim_age, the annual benefit is calculated and added. This is a dynamic calculation based on claiming age, not a static input. The benefit amount is then adjusted annually by the social_security_cola.

- **Taxable Investment Income:** For accounts designated as 'Taxable', the model calculates income from dividends and interest. Investment_Income = previous_year_end_balance * dividend_yield_from_CMA. This income is added to gross income.

- **Required Minimum Distributions (RMDs):** This is a critical income event that the Roth strategy seeks to mitigate. The SECURE 2.0 Act raised the RMD starting age to 73 for those born between 1951 and 1959, and to 75 for those born in 1960 or later. The algorithm must check if user_age has reached the applicable RMD age. If so:

For each tax-deferred account (Traditional IRA, 401k, etc.), the RMD is calculated:

$$\text{RMD amount} = \frac{\text{Account Balance as of Dec 31 of Prior Year}}{\text{Distribution Period from IRS Uniform Lifetime Table}}$$

The Distribution Period is looked up from the stored IRS table based on the user's age for that year. The total RMD amount from all tax-deferred accounts is a forced withdrawal and is added to the year's gross income.

### 2.3. Modeling Expenses and Withdrawal Hierarchy

Once gross income is known, the model calculates the total cash needed for the year and withdraws funds to meet that need.

**Calculate Total Cash Need:**
$$\text{Total Cash Need} = (\text{Inflated Annual Living Expenses}) + (\text{Total Taxes Owed}) + (\text{Medicare IRMAA Premiums})$$

**Calculate Net Cash Need:**
$$\text{Net Cash Need} = \text{Total Cash Need} - (\text{Post-Tax Income})$$

Where Post-Tax Income includes net salary (if working), pensions, and the non-taxable portion of Social Security.

**Execute Withdrawals:** The model withdraws the Net Cash Need from accounts according to a tax-efficient hierarchy designed to defer taxes as long as possible in this baseline scenario.

1. **Tier 1: Cash Accounts:** Withdraw from 'Savings' accounts first, as these withdrawals have no tax consequence.

2. **Tier 2: Taxable Brokerage Accounts:** If cash is depleted, withdraw from 'Taxable' accounts. This is a taxable event. The model must calculate the capital gain on the withdrawal: 
   $$\text{Realized Gain} = \text{Withdrawal Amount} \times \left(1 - \frac{\text{Cost Basis}}{\text{Market Value}}\right)$$
   This gain is added to the year's income for tax calculation purposes.

3. **Tier 3: Tax-Deferred Accounts:** If taxable accounts are depleted, withdraw from 'Traditional IRA' and '401k' accounts. The entire withdrawal amount is treated as ordinary income.

4. **Tier 4: Tax-Free Accounts:** As a last resort, withdraw from 'Roth IRA' accounts. Qualified withdrawals are tax-free.

This hierarchy, while conventional, tends to maximize the balance in tax-deferred accounts, which in turn leads to larger RMDs later in life. This exacerbates the "tax torpedo" and makes the baseline scenario a powerful illustration of the problem that Roth conversions solve.

### 2.4. Calculating Annual Tax Liability (Federal & State)

This multi-step module is executed in every year of the simulation.

**Calculate Adjusted Gross Income (AGI):**
$$\text{AGI} = (\text{Wages} + \text{Taxable Interest} + \text{Dividends} + \text{Pensions} + \text{RMDs} + \text{Other Withdrawals} + \text{Taxable SS} + \text{Capital Gains}) - \text{Deductions}$$

**Calculate Taxable Social Security:** This is a crucial sub-calculation. The model computes "provisional income":
$$\text{Provisional Income} = (\text{AGI excluding SS}) + (\text{Tax-Exempt Interest}) + (0.5 \times \text{Gross SS Benefits})$$

Based on this figure and the user's filing status, the model applies the IRS thresholds (e.g., for MFJ, income between $32,000 and $44,000 makes up to 50% of benefits taxable; over $44,000 makes up to 85% taxable) to determine the Taxable_Portion_of_SS_Benefits.

**Calculate Federal Taxable Income:**
$$\text{Taxable Income} = \text{AGI} - \text{Standard Deduction}$$

The model must use the correct standard deduction for the year, including any additional amounts for being age 65 or older. This requires referencing the pre- or post-2026 tax regime tables.

**Calculate Federal Income Tax:** The model applies the progressive federal tax brackets for the given year and filing status to the Taxable Income to compute the final tax liability.

**Calculate State Income Tax:** The model applies state-specific rules. For the specified example of Massachusetts, the calculation is:
$$\text{MA Tax} = (\text{MA Taxable Income} - \text{MA Personal Exemption}) \times 0.05$$

The model must also check for the 4% surtax on income over the state threshold (e.g., $1,083,150 for 2025).

The output of this baseline simulation is a year-by-year ledger of income, expenses, taxes, and growing account balances, which starkly illustrates the future tax burden awaiting the user under a "do nothing" strategy.

## Section 3: The "Bracket Filling" Roth Conversion Strategy: Algorithmic Implementation

This section details the logic for the active strategy, which is overlaid onto the baseline projection engine. The core principle is to strategically recognize income via Roth conversions during low-income years—the "gap years" between retirement and the start of Social Security and RMDs—to minimize lifetime tax liability. This is a form of tax rate arbitrage: paying taxes at known, lower rates today to avoid unknown, likely higher rates in the future.

### 3.1. Identifying the Conversion Window

The algorithm first identifies the years in which the conversion strategy is applicable. This window is defined by the user's "gap years," a period of intentionally suppressed income that creates the ideal opportunity for conversions.

The logic is enabled for any year where the following condition is met:

```
is_conversion_year = TRUE if (user_age >= user_retirement_age AND user_age < user_ss_claim_age) 
                          OR (spouse_age >= spouse_retirement_age AND spouse_age < spouse_ss_claim_age)
```

This condition ensures the strategy is active if at least one spouse has retired (stopping earned income) but has not yet started claiming Social Security. The logic also implicitly assumes the user is below the RMD age of 73/75. The system must also verify that there is a positive balance in one or more tax-deferred accounts.

### 3.2. Calculating the Annual Conversion Amount

This is the central calculation of the strategy, performed within the annual loop only if is_conversion_year is true. The goal is to "fill" the current marginal tax bracket with conversion income without spilling into the next, higher bracket.

1. **Determine Baseline Income:** First, calculate the user's baseline_taxable_income for the current year. This includes all non-conversion income sources like pensions, taxable account interest/dividends, and any part-time work from a non-retired spouse.

2. **Identify Target Tax Bracket:** Using the federal tax tables for the current year, find the marginal tax bracket that baseline_taxable_income falls into. Let this be target_bracket.

3. **Find Upper Limit of Target Bracket:** From the tax tables, retrieve the upper_income_limit for the target_bracket and the user's filing_status. For example, for MFJ in 2025, the top of the 22% bracket is $206,700.

4. **Calculate Available Headroom:** The algorithm calculates the amount of additional income that can be recognized before hitting the next bracket, with a built-in safety margin.
   $$\text{Tax Bracket Headroom} = (\text{upper_income_limit} \times 0.95) - \text{baseline_taxable_income}$$
   
   The 95% factor is a crucial parameter to prevent small miscalculations or unexpected income from pushing the user into a higher bracket.

5. **Determine Maximum Possible Conversion:** This is simply the sum of all balances in the user's and spouse's tax-deferred accounts (total_tax_deferred_balance).

6. **Set the Final Conversion Amount:** The amount to convert is the lesser of the available headroom and the total available funds.
   $$\text{annual_conversion_amount} = \min(\text{Tax Bracket Headroom}, \text{total_tax_deferred_balance})$$
   
   If this value is less than or equal to zero, no conversion is performed for that year.

### 3.3. The Conversion Tax Payment Cascade

A core tenet of an effective Roth conversion strategy is to pay the resulting income tax with funds from outside the retirement account. Using funds from the conversion itself reduces the amount that benefits from future tax-free growth and can trigger penalties if the account owner is under 59.5. The algorithm must model a specific hierarchy for paying this tax.

**Calculate the Conversion Tax:**
$$\text{conversion_tax_liability} = \text{TaxOn}(\text{baseline_taxable_income} + \text{annual_conversion_amount}) - \text{TaxOn}(\text{baseline_taxable_income})$$

Where TaxOn() is a function that applies the full progressive federal and state tax schedules. This is more precise than simply multiplying by the marginal rate.

**Execute Payment Cascade:** The algorithm attempts to pay the conversion_tax_liability from the following sources in order:

1. **Tier 1: Savings Accounts:** Debit from 'Savings' account balances.

2. **Tier 2: Taxable Brokerage Accounts:** If savings are depleted, withdraw the remaining amount needed from 'Taxable' accounts.

A critical complexity arises here. Withdrawing from a taxable account generates its own capital gain, which is new taxable income. This creates a feedback loop. A robust algorithm must handle this iteratively:

- **Pass 1:** Calculate the initial conversion_tax_liability.
- **Pass 2:** Determine the withdrawal needed from the taxable account to pay that tax. Calculate the capital gain from that withdrawal.
- **Pass 3:** Add this capital gain to the year's total income and recalculate the total tax bill. The difference between this new total tax and the initial conversion_tax_liability is the additional tax created by the payment itself.
- **Pass 4:** Withdraw this small additional tax amount from the taxable account (which creates a minuscule additional gain, but can often be ignored after one iteration for practical purposes) or use a solver to find the stable, final tax amount.

### 3.4. Integrating the Conversion into the Annual Loop

The "With Conversion" scenario follows the same annual loop structure as the baseline, with the following modifications integrated into the process:

- **During the Income Determination step:** If is_conversion_year is true, the annual_conversion_amount is calculated.

- **Income and Tax Adjustment:** The annual_conversion_amount is added to the AGI for the year. The conversion_tax_liability (including the tax on the capital gain from the payment) is added to the Total Taxes Owed.

- **Account Balance Adjustment:** The balances of the involved accounts are immediately updated:
  - tax_deferred_balance -= annual_conversion_amount
  - roth_account_balance += annual_conversion_amount
  - savings_balance and/or taxable_account_balance are reduced by the amount of the tax payment. The cost basis of the taxable account is also adjusted accordingly.

The rest of the annual loop (paying expenses, growing assets) proceeds as normal, but now with altered account balances and a higher tax bill in the conversion years.

## Section 4: Advanced Modeling: Capturing Critical Tax and Surcharge Nuances

A sophisticated financial model must account for the second- and third-order effects of major financial decisions. A Roth conversion significantly increases Modified Adjusted Gross Income (MAGI) in the year of conversion, which has a domino effect on various income-tested surcharges and taxes. Failing to model these interconnected effects would present an incomplete and potentially misleading picture of the strategy's true cost and benefit.

### 4.1. Dynamic Social Security Taxation Module

The taxable portion of Social Security benefits is directly linked to "provisional income," which is heavily influenced by AGI. A Roth conversion can turn otherwise tax-free benefits into taxable income.

**Algorithmic Logic:** In every year of the simulation for both scenarios, the taxable portion of Social Security is calculated.

- **"No Conversion" Scenario:** In the gap years, with low AGI, provisional income is also low, and a small portion (0% or 50%) of Social Security benefits may be taxable. When RMDs begin, AGI skyrockets, and typically 85% of benefits become taxable.

- **"With Conversion" Scenario:** During the conversion years, the annual_conversion_amount is added to the AGI used in the provisional income formula. This will almost certainly cause 85% of Social Security benefits to be taxable in those years. However, in the post-conversion retirement years, AGI will be significantly lower because RMDs from the depleted traditional IRA are small or nonexistent. This can lead to a smaller portion of Social Security benefits being taxed for the remainder of the user's life compared to the baseline. The model must quantify this long-term tax reduction on benefits as a key advantage of the strategy.

### 4.2. Medicare IRMAA Surcharge Module

The Income-Related Monthly Adjustment Amount (IRMAA) is a surcharge on Medicare Part B and Part D premiums for higher-income beneficiaries. This is a critical, time-lagged cost that must be modeled.

**Algorithmic Logic:** The IRMAA calculation for a given year Y is based on the MAGI from tax year Y-2.

- The projection engine must maintain a rolling two-year history of MAGI for both the user and spouse.
- In year Y of the simulation, the model retrieves the MAGI from year Y-2.
- This Y-2 MAGI is compared against the IRMAA income brackets for year Y (which are stored in the system's static data tables).
- If the MAGI exceeds the base threshold, the corresponding monthly surcharge for Part B and Part D is identified.
- This monthly surcharge is multiplied by 12 (and by 2 if both spouses are on Medicare) and added to the Total Cash Need for year Y.

A large Roth conversion in year Y will inflate the MAGI for that year. Two years later, in year Y+2, this will trigger IRMAA surcharges. This future, recurring cost is a direct consequence of the conversion and must be meticulously tracked and included in the total cost of the strategy.

### 4.3. Net Investment Income Tax (NIIT) Module

The 3.8% NIIT is another potential indirect cost of a Roth conversion. While the conversion itself is not subject to NIIT, it can push the user's MAGI over the threshold, causing the tax to apply to other investment income.

**Algorithmic Logic:**

- **Exclusion Rule:** The algorithm must recognize that distributions from qualified retirement plans, including IRA conversions, are explicitly excluded from the definition of Net Investment Income (NII).

- **MAGI Impact:** However, the conversion amount is included in the MAGI calculation.

- **Annual Calculation:** In each year, the model performs the following check:
  - Calculate NII = (Taxable Interest) + (Dividends) + (Realized Capital Gains)
  - Calculate MAGI = AGI + Tax-Exempt Interest
  - Check if MAGI exceeds the NIIT threshold (e.g., $250,000 for MFJ)
  - If it does, the NIIT is calculated as:
    $$\text{NIIT} = 0.038 \times \min(\text{NII}, \text{MAGI} - \text{NIIT Threshold})$$
  - This tax is added to the total federal tax liability for the year.

This module demonstrates how a conversion can trigger a tax on income that would have otherwise been exempt from NIIT, adding another layer to the cost-benefit analysis.

### 4.4. State-Specific Tax Regime Framework (Example: Massachusetts)

The projection engine must be architected to accommodate diverse state tax laws. Using Massachusetts as a detailed example:

- **Income Tax:** A flat 5% rate applies to ordinary income, which includes IRA distributions and Roth conversions.

- **Surtax:** A 4% surtax is levied on income exceeding a high threshold ($1,083,150 in 2025). The conversion amount must be added to other income to test against this threshold.

- **Capital Gains:** The model must apply Massachusetts' distinct capital gains rates when calculating the tax on withdrawals from taxable accounts to fund conversion taxes. Short-term gains are taxed at 8.5%, and long-term gains on collectibles at 12%.

- **Deductions:** Massachusetts uses personal exemptions instead of a standard deduction. The model must apply the correct exemption based on filing status.

- **Estate Tax:** This is a critical modeling point for the terminal year analysis. Massachusetts has a $2 million estate tax exemption. Crucially, it is a "cliff" exemption: if the taxable estate is $2,000,001, the tax is calculated on the entire $2,000,001, not just the $1 over the exemption. The progressive state estate tax rates must be applied correctly in the final estate calculation.

This framework of pluggable state tax modules allows the software to be scaled to serve clients in any state by simply defining a new set of state-specific rules.

## Section 5: Terminal Year Calculations and Comparative Output Metrics

The culmination of the dual simulations is a set of clear, concise metrics calculated at the specified longevity_age. These outputs provide the definitive answer to the user's core questions about the long-term impact of the Roth conversion strategy.

### 5.1. Calculating Total Lifetime Taxes Paid

This metric aggregates the total tax burden over the entire projection period for both scenarios, providing a direct measure of tax efficiency.

**Calculation:** For both the "No Conversion" baseline and the "With Conversion" scenarios, the algorithm will sum the total_annual_tax for every year of the simulation.

$$\text{Lifetime Taxes} = \sum_{year=\text{start}}^{\text{longevity_age}} (\text{Annual Federal Tax} + \text{Annual State Tax} + \text{Annual NIIT})$$

**Primary Output:** The final reported metric is the difference between the two totals.

$$\text{Lifetime Tax Savings} = (\text{Lifetime Taxes}_{\text{Baseline}}) - (\text{Lifetime Taxes}_{\text{Conversion}})$$

A positive value indicates that the conversion strategy resulted in lower overall taxes paid throughout the user's lifetime. This figure must also implicitly include the impact of IRMAA surcharges, as they are a cash outflow that reduces the final estate value, even if not a direct tax.

### 5.2. Calculating Final Tax-Adjusted Estate Value

This metric measures the impact of the strategy on the total wealth available at the end of the projection, after all estate taxes have been paid.

**Gross Estate Value:** At longevity_age, the model sums the final balance of all accounts (Taxable, Savings, Tax-Deferred, Roth) for each scenario to arrive at the Gross_Estate_Value.

**Estate Tax Calculation:** The model then subjects this gross value to both federal and state estate taxes.

- **Federal Estate Tax:** A critical feature of the model is its recognition of the scheduled "sunset" of the high TCJA estate tax exemption. For deaths occurring in 2026 or later, the exemption is projected to revert to approximately $7 million per person, adjusted for inflation. The algorithm must use this lower, post-2025 exemption level.

$$\text{Federal Estate Tax} = \max(0, (\text{Gross Estate Value} - \text{Federal Exemption})) \times 0.40$$

- **State Estate Tax:** The model applies the relevant state rules. For Massachusetts, it checks if the Gross_Estate_Value exceeds the $2 million cliff threshold and, if so, applies the state's progressive rates to the entire estate value.

**Final Tax-Adjusted Estate Value:**
$$\text{Tax-Adjusted Estate} = \text{Gross Estate Value} - (\text{Federal Estate Tax} + \text{State Estate Tax})$$

**Primary Output:** The report will present the Tax-Adjusted Estate Value for both scenarios, allowing the user to see the net impact on their legacy.

### 5.3. Modeling the Heir's Tax Liability (The SECURE Act Module)

Perhaps the most compelling argument for Roth conversions in the modern estate planning context is the effect of the SECURE Act's 10-year rule on non-spouse beneficiaries. This module quantifies the dramatic difference in the tax burden passed on to heirs.

**Baseline Scenario (Inheriting a Traditional IRA):**
- The heir inherits the remaining Traditional_IRA_balance. Under the 10-year rule, this entire pre-tax amount must be withdrawn and recognized as ordinary income within 10 years of the original owner's death.
- This forces a massive income realization into a compressed timeframe, very likely pushing the heir into their highest marginal tax brackets.
- The algorithm models this by assuming the heir withdraws 1/10th of the inherited balance each year for 10 years, adds this amount to a default assumed heir's income, and calculates the resulting federal and state income tax.
- Heir_Tax_Burden_Baseline is the sum of these 10 years of additional taxes.

**Conversion Scenario (Inheriting a Roth IRA):**
- The heir inherits the remaining Roth_IRA_balance. While the 10-year rule still requires the account to be emptied, qualified distributions from an inherited Roth IRA are entirely tax-free to the beneficiary.
- Heir_Tax_Burden_Conversion = 0.

**Primary Output:** The difference, Heir_Tax_Savings = Heir_Tax_Burden_Baseline - Heir_Tax_Burden_Conversion, represents the wealth preserved for the next generation, a powerful and often decisive factor in favor of the conversion strategy.

## Section 6: The Comprehensive Cash Flow Statement: Structure and Content

The primary deliverable for the end-user is a detailed, year-by-year cash flow statement that transparently illustrates the mechanics and consequences of the implemented Roth conversion strategy. This table is not merely a data dump; it is a narrative tool that tells the financial story of the user's retirement, making the cause-and-effect relationships of the strategy clear and intuitive. It will be generated for the "With Conversion" scenario.

**Table 6.1: Annual Cash Flow Projection (With Roth Conversion Strategy)**

| Year | Age (U/S) | **Inflows** ||||||| **Outflows** ||||||| Net Flow | Conversion Details | **End-of-Year Balances** ||||
|------|-----------|--------|--------|-----|---------|------|-----------|---------|------------|-------------|-------------|---------|------|-----------|----------|-----------|----------|-------------|---------|
| | | Wages | Pension | SS | Inv. Inc. | RMDs | Discr. W/D | Total | Expenses | Fed Tax (Inc) | Fed Tax (Conv) | State Tax | NIIT | IRMAA | Total | | Conv. Amt | Taxable | Savings | Trad. IRA | Roth IRA |
| 2026 | 66/64 | $0 | $20k | $0 | $5k | $0 | $40k | $65k | $60k | $500 | $8.8k | $3k | $0 | $0 | $72.3k | ($7.3k) | $40k | $450k | $10k | $1.46M | $240k |
| 2027 | 67/65 | $0 | $20k | $0 | $6k | $0 | $42k | $68k | $61.5k | $600 | $9.2k | $3.1k | $0 | $0 | $74.4k | ($6.4k) | $40k | $410k | $0 | $1.42M | $285k |
| 2028 | 68/66 | $0 | $20k | $35k | $7k | $0 | $10k | $72k | $63k | $2k | $0 | $3.5k | $0 | $2.1k | $70.6k | $1.4k | $0 | $375k | $0 | $1.43M | $290k |

### Column Descriptions:

**Year & Age:** The timeline of the projection.

**Inflows (Sources of Cash):**
- **Wages & Earned Income:** Income from work, typically zero after retirement
- **Pension Income:** Fixed pension payments
- **Social Security Benefits (Gross):** Gross annual SS benefit before any taxation
- **Taxable Account Income:** Dividends and interest generated by taxable accounts
- **RMDs:** Forced withdrawals from tax-deferred accounts (will be low/zero in this scenario)
- **Discretionary Withdrawals:** Shows which accounts are being tapped to fund living expenses and taxes

**Outflows (Uses of Cash):**
- **Living Expenses:** The user's desired spending, adjusted for inflation
- **Federal Income Tax (on regular income):** Tax on all income except the conversion
- **Federal Income Tax (on Roth Conversion):** This is a separate, explicit line item for transparency. It shows the direct cost of the strategy each year
- **State Income Tax, NIIT:** Other tax liabilities
- **Medicare IRMAA Surcharges:** The lagged cost of higher income years, appearing two years after a large conversion

**Net Cash Flow:** The annual surplus or deficit.

**Conversion Details:**
- **Roth Conversion Amount:** The amount moved from Traditional to Roth

**End-of-Year Account Balances:**
Shows the year-end value of each major account bucket after all inflows, outflows, and market growth have been applied. This allows the user to see the direct impact of the strategy (e.g., Traditional IRA balance decreasing, Roth IRA balance increasing, and Savings/Taxable balances decreasing to pay the tax).

**Total Net Worth:** The sum of all account balances.

By reviewing this table, a user can trace the entire strategy. They can see the large tax payments in the early "gap years" and directly link them to the reduction in their savings and taxable accounts. They can then observe the benefits in later years: minimal RMDs, lower overall tax outflows, and the steady growth of a large, tax-free Roth IRA balance. This detailed transparency is essential for building user trust and justifying the significant upfront tax cost of the strategy.

## Conclusion

The algorithmic framework detailed in this report provides a comprehensive and robust methodology for evaluating a tax bracket filling Roth conversion strategy. By constructing two parallel, lifelong financial simulations—one baseline and one with the active strategy—the engine can quantify the precise long-term benefits across three critical dimensions: total lifetime taxes paid, final tax-adjusted estate value, and the tax burden inherited by heirs.

The model's sophistication lies in its ability to capture the complex, interacting, and often time-lagged consequences of a Roth conversion. It moves beyond a simple tax calculation to incorporate the downstream effects on Social Security taxation, Medicare IRMAA surcharges, and the Net Investment Income Tax. Furthermore, by building in a "tax regime" shift to account for the scheduled 2026 sunset of TCJA provisions, the model correctly frames the strategic urgency and value of executing conversions in the current, potentially more favorable, tax environment.

The final outputs—a direct comparison of lifetime tax savings, estate values, and heir tax burdens, supplemented by a transparent, year-by-year cash flow statement—are designed to provide a clear, defensible, and actionable recommendation. This blueprint serves as a complete technical specification for developing a powerful financial planning tool capable of navigating one of the most effective tax and estate planning strategies available to retirees today.

## Appendix: Reference Data Tables

### A.1: Federal Income Tax Brackets & Rates (2025, MFJ)

| Tax Rate | Taxable Income Bracket (Married Filing Jointly) |
|----------|--------------------------------------------------|
| 10% | $0 to $23,850 |
| 12% | $23,851 to $96,950 |
| 22% | $96,951 to $206,700 |
| 24% | $206,701 to $394,600 |
| 32% | $394,601 to $501,050 |
| 35% | $501,051 to $751,600 |
| 37% | $751,601 or more |

*Note: The model will contain tables for all filing statuses and will use projected post-2025 brackets based on pre-TCJA law, adjusted for inflation.*

### A.2: Federal Standard Deduction (2025)

| Filing Status | Standard Deduction | Additional (Age 65+/Blind) |
|---------------|-------------------|---------------------------|
| Single | $15,750 | $2,000 |
| Married Filing Jointly | $31,500 | $1,600 per person |
| Head of Household | $23,625 | $2,000 |

### A.3: State Tax Parameters (Massachusetts Example)

| Parameter | Value |
|-----------|-------|
| Income Tax Rate | 5.0% |
| Surtax Rate | 4.0% |
| Surtax Threshold (2025) | $1,083,150 |
| Personal Exemption (MFJ) | $8,800 |
| Estate Tax Exemption | $2,000,000 (Cliff) |

### A.4: IRS Uniform Lifetime Table for RMDs (Excerpt)

| Age | Distribution Period |
|-----|-------------------|
| 73 | 26.5 |
| 74 | 25.5 |
| 75 | 24.6 |
| 80 | 20.2 |
| 85 | 16.0 |
| 90 | 12.2 |

### A.5: Medicare IRMAA Surcharge Brackets (2025, MFJ)

| 2023 MAGI (MFJ) | Part B Surcharge (Monthly) | Part D Surcharge (Monthly) |
|-----------------|---------------------------|---------------------------|
| ≤ $212,000 | $0.00 | $0.00 |
| > $212,000 to ≤ $266,000 | $74.00 | $13.70 |
| > $266,000 to ≤ $334,000 | $185.00 | $35.30 |
| > $334,000 to ≤ $400,000 | $295.90 | $57.00 |
| > $400,000 to < $750,000 | $406.90 | $78.60 |
| ≥ $750,000 | $443.90 | $85.80 |

*Note: Assumes a standard Part B premium of $185.00.*

### A.6: Federal Estate Tax Exemption

| Year | Basic Exclusion Amount |
|------|----------------------|
| 2025 | $13,990,000 |
| 2026 (Projected) | ~$7,000,000 (inflation-adjusted) |