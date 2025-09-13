# Investments Center Feature

## Overview
The Investments Center is a five-tab dashboard that surfaces data-driven investment ideas for users' tactical equity sleeves. It provides curated investment opportunities across different market sectors with a focus on companies with strong free cash flow (FCF) growth.

## Features

### 1. U.S. Market Outlook Tab
- **Market Direction Forecast**: Headline prediction for SPX movement over the next 3-4 weeks
- **Upcoming Events**: Table of macro events in the coming 7 days with consensus expectations
- **Market Breadth Indicators**: 
  - A/D Line visualization
  - Percentage of SPX stocks above 50-DMA
  - VIX term structure status

### 2. Sector-Specific Investment Tabs
Four specialized tabs focusing on high-growth sectors:
- **AI Infrastructure**: Semiconductors, servers, networking, datacenter REITs
- **AI Software**: Application software companies with Gen-AI leverage
- **Cloud & SaaS**: Cloud infrastructure and platform companies
- **Cybersecurity**: Pure-play security companies with AI integration

Each sector tab displays:
- Top 10 investment opportunities
- Ranked by FCF year-over-year growth
- One-line pitch highlighting company moat
- Visual rank indicator and FCF growth percentage
- Yellow warning icon for backfill companies (positive but lower growth)

## Technical Implementation

### Frontend Components
- `InvestmentsCenter.tsx`: Main page component with tab navigation
- `InvestmentCard.tsx`: Reusable card component for stock display
- `MarketOutlookTab.tsx`: Specialized component for market overview data
- `useInvestments.ts`: Custom React Query hook for data fetching

### Backend API
- **Endpoint**: `/api/investments/:category`
- **Categories**: `market`, `ai_infra`, `ai_software`, `cloud_saas`, `cybersec`
- **Authentication**: Requires authenticated user session
- **Caching**: 6-hour cache for API responses

### Loading Experience
- Minimum 10-second loading animation with counting timer
- Smooth fade-in transitions using Framer Motion
- Loading state persists even if data arrives early (perceived depth)

## Data Sources & Licensing

### Current Implementation
The feature currently uses mock data for demonstration purposes. Production implementation would require:

1. **Market Data APIs**
   - FRED API for macro time series (free, requires API key)
   - Yahoo Finance for market breadth data
   - NBER calendar or Econoday RSS for economic events

2. **Company Fundamentals**
   - FinancialModelingPrep API (paid tiers for real-time data)
   - IEX Cloud as alternative (usage-based pricing)
   - SEC EDGAR for filing data (free but requires parsing)

3. **News & Sentiment**
   - NewsAPI for headline aggregation (free tier available)
   - Google Gemini API for pitch generation (pay-per-use)

### Licensing Considerations
- Ensure compliance with data provider terms of service
- Real-time market data may require exchange agreements
- Cache appropriately to minimize API costs
- Display required attributions for data sources

## Setup Instructions

### Environment Variables
Add the following to your `.env` file when implementing real data sources:
```env
FRED_API_KEY=your_fred_api_key
FMP_API_KEY=your_financialmodelingprep_key
IEX_API_KEY=your_iex_cloud_key
NEWS_API_KEY=your_news_api_key
```

### Installation
No additional dependencies required for the mock implementation. For production:
```bash
npm install axios node-cache
```

### Testing
1. Navigate to the Investments Center from the sidebar
2. Verify all 5 tabs load with appropriate data
3. Check that loading animation runs for exactly 10 seconds
4. Confirm responsive design on mobile devices
5. Test error states by disconnecting network

## Future Enhancements

1. **Real-time Data Integration**
   - Implement LangChain agents for intelligent data aggregation
   - Add WebSocket support for live price updates
   - Include after-hours trading indicators

2. **Advanced Analytics**
   - Add technical indicators and chart visualizations
   - Include analyst consensus ratings
   - Show insider trading activity

3. **Personalization**
   - Filter by user's risk profile
   - Suggest investments based on existing portfolio
   - Track watchlist and send alerts

4. **Export Features**
   - Download investment ideas as PDF report
   - Export to CSV for further analysis
   - Share functionality for specific stocks