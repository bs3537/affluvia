# AI Recommendations Alignment with Monte Carlo Results

## Changes Made

### 1. Updated AI Chat Instructions (lines 5670-5687)
Added critical instructions to ensure the AI assistant aligns with the Monte Carlo simulation results:

- **Instruction #6**: CRITICAL requirement that AI must reference the exact Monte Carlo success probability shown in the dashboard widget
- **Instruction #7**: Guidance on how to frame recommendations based on success rate:
  - High success (>80%): Focus on optimization strategies
  - Low success (<65%): Provide actionable improvement steps
- **Instruction #8**: Clear distinction between "retirement success" (meeting stated goals) and "lifestyle maintenance" (maintaining current income)

### 2. Updated Dashboard Recommendations (lines 5063-5164)
Modified the retirement planning recommendations to directly use Monte Carlo results:

- **Calculates Monte Carlo success rate** when generating recommendations
- **Three-tier recommendation system**:
  - **Low Success (<65%)**: "Improve Your Retirement Outlook" - urgent action needed
  - **Moderate Success (65-80%)**: "Strengthen Your Retirement Plan" - improvements recommended  
  - **High Success (>80%)**: "Optimize Your Strong Retirement Position" - focus on tax optimization

- **Recommendations now reference the exact Monte Carlo percentage** in the description
- **Action steps are tailored** to the success probability level

## Key Benefits

1. **Consistency**: Users will see the same retirement success probability across all touchpoints
2. **Clarity**: Clear distinction between different types of retirement metrics
3. **Actionable Insights**: Recommendations are now directly tied to the Monte Carlo results
4. **Trust**: Eliminates confusing contradictions between different parts of the app

## Example Output

If Monte Carlo shows 100% success, the AI will now say:
> "Excellent news! Your Monte Carlo simulation shows a 100% probability of meeting your retirement goals. With $692,000 saved, you're well-positioned. Focus on tax optimization and legacy planning."

Instead of contradicting with:
> "Critical Retirement Shortfall of 58.6%"

## Technical Implementation

Both the dashboard recommendations and AI chat now:
1. Use `runEnhancedMonteCarloSimulation` with the same parameters
2. Reference the exact probability percentage
3. Provide consistent, aligned guidance based on the success rate

This ensures users receive coherent, trustworthy financial advice throughout the application.