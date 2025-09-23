import { chatComplete } from "./services/xai-client";
import dotenv from "dotenv";

dotenv.config();

interface Investment {
  ticker: string;
  name: string;
  pitch: string;
  fcfYoyGrowth: number;
  marketCap?: string;
  sector?: string;
}

interface MarketEvent {
  event: string;
  date: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  impact?: string;
}

interface MarketOutlookData {
  marketSummary: string;
  recentData: MarketEvent[];
  upcomingData: MarketEvent[];
  marketDirection?: {
    trend: string;
    sentiment: string;
    keyDrivers: string[];
  };
}

// Use XAI Grok model via chatComplete wrapper

async function searchMarketOutlook(): Promise<MarketOutlookData> {
  try {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const prompt = `
    You are a financial analyst with access to current market data. Today is ${currentDate}.
    
    Please search and analyze the following:
    
    1. Current US market direction and sentiment - provide a ONE LINE summary (max 15 words)
    
    2. Recent US macroeconomic data from the PAST WEEK:
       - Include: GDP, CPI, PPI, Jobless Claims, Retail Sales, PMI, Consumer Sentiment
       - Format: Event name, date, actual value, forecast, previous value, market impact
    
    3. Upcoming US macroeconomic events for the NEXT WEEK:
       - Include major economic releases scheduled
       - Format: Event name, date, forecast (if available), expected impact
    
    Use only real, current data. Search financial websites like Bloomberg, CNBC, MarketWatch, Fed websites.
    
    Return ONLY valid JSON in this format:
    {
      "marketSummary": "One line market outlook summary",
      "recentData": [
        {
          "event": "Event Name",
          "date": "Nov 28, 2024",
          "actual": "3.2%",
          "forecast": "3.0%",
          "previous": "2.8%",
          "impact": "Positive/Negative/Neutral"
        }
      ],
      "upcomingData": [
        {
          "event": "Event Name",
          "date": "Dec 3, 2024",
          "forecast": "Expected value",
          "impact": "High/Medium/Low"
        }
      ],
      "marketDirection": {
        "trend": "Bullish/Bearish/Neutral",
        "sentiment": "Risk-on/Risk-off/Mixed",
        "keyDrivers": ["Driver 1", "Driver 2", "Driver 3"]
      }
    }
    `;

    const text = await chatComplete([
      { role: 'user', content: prompt }
    ], { temperature: 0.7, stream: false });
    
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/({[\s\S]*})/);
      const marketData = JSON.parse(jsonMatch?.[1] || text);
      
      return {
        marketSummary: marketData.marketSummary || "Markets await key economic data releases this week",
        recentData: marketData.recentData?.slice(0, 7) || [],
        upcomingData: marketData.upcomingData?.slice(0, 7) || [],
        marketDirection: marketData.marketDirection
      };
    } catch (e) {
      console.error("Failed to parse market outlook:", e);
      return {
        marketSummary: "Markets trade mixed amid economic uncertainty",
        recentData: [],
        upcomingData: []
      };
    }
  } catch (error) {
    console.error("Error fetching market outlook:", error);
    return {
      marketSummary: "Unable to fetch current market data",
      recentData: [],
      upcomingData: []
    };
  }
}

async function searchInvestmentStocks(category: string): Promise<Investment[]> {
  try {
    const categoryPrompts = {
      ai_infra: {
        sector: "AI Infrastructure, Semiconductors, Data Centers",
        criteria: "small to mid-cap stocks ($1B-$50B market cap) with strong FCF growth in AI infrastructure"
      },
      ai_software: {
        sector: "AI Software, Machine Learning Platforms",
        criteria: "small to mid-cap AI software companies with positive FCF growth"
      },
      cloud_saas: {
        sector: "Cloud Computing, SaaS, Infrastructure Software",
        criteria: "small to mid-cap cloud/SaaS companies with strong FCF growth"
      },
      cybersec: {
        sector: "Cybersecurity",
        criteria: "small to mid-cap cybersecurity companies with positive FCF growth"
      }
    };

    const categoryInfo = categoryPrompts[category as keyof typeof categoryPrompts];
    if (!categoryInfo) {
      throw new Error("Invalid category");
    }

    const prompt = `
    You are a financial analyst researching US publicly traded stocks.
    
    Task: Find the TOP 5 ${categoryInfo.sector} stocks that meet these criteria:
    - ${categoryInfo.criteria}
    - US publicly traded (NYSE or NASDAQ)
    - Market cap between $1 billion and $50 billion
    - Positive free cash flow growth year-over-year
    
    For each stock provide:
    1. Ticker symbol
    2. Company name
    3. Current market cap
    4. FCF growth rate (YoY %)
    5. One-line investment pitch (why it's compelling)
    6. Sector/subsector
    
    Search current financial data from reliable sources.
    Prioritize companies with the HIGHEST FCF growth rates.
    
    Return ONLY valid JSON in this format:
    {
      "stocks": [
        {
          "ticker": "SYMBOL",
          "name": "Company Name",
          "marketCap": "$X.XB",
          "fcfYoyGrowth": 85.5,
          "pitch": "Leading AI chip designer with 85% FCF growth",
          "sector": "Semiconductors"
        }
      ]
    }
    
    List exactly 5 stocks, ordered by FCF growth rate (highest first).
    `;

    const text = await chatComplete([
      { role: 'user', content: prompt }
    ], { temperature: 0.7, stream: false });
    
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/({[\s\S]*})/);
      const stockData = JSON.parse(jsonMatch?.[1] || text);
      
      return stockData.stocks?.slice(0, 5).map((stock: any) => ({
        ticker: stock.ticker,
        name: stock.name,
        pitch: stock.pitch,
        fcfYoyGrowth: stock.fcfYoyGrowth || 0,
        marketCap: stock.marketCap,
        sector: stock.sector
      })) || [];
    } catch (e) {
      console.error("Failed to parse stock data:", e);
      return getDefaultStocks(category);
    }
  } catch (error) {
    console.error("Error searching stocks:", error);
    return getDefaultStocks(category);
  }
}

function getDefaultStocks(category: string): Investment[] {
  const defaults = {
    ai_infra: [
      { ticker: "SMCI", name: "Super Micro Computer", pitch: "AI server specialist with rapid growth", fcfYoyGrowth: 125.3 },
      { ticker: "ANET", name: "Arista Networks", pitch: "High-speed networking for AI clusters", fcfYoyGrowth: 78.9 },
      { ticker: "MRVL", name: "Marvell Technology", pitch: "Data center interconnects for AI", fcfYoyGrowth: 67.5 },
      { ticker: "PSTG", name: "Pure Storage", pitch: "AI-optimized data storage", fcfYoyGrowth: 54.2 },
      { ticker: "MPWR", name: "Monolithic Power", pitch: "Power management for AI servers", fcfYoyGrowth: 48.7 }
    ],
    ai_software: [
      { ticker: "PLTR", name: "Palantir Technologies", pitch: "Enterprise AI platform leader", fcfYoyGrowth: 187.5 },
      { ticker: "AI", name: "C3.ai", pitch: "Pure-play enterprise AI software", fcfYoyGrowth: 92.3 },
      { ticker: "PATH", name: "UiPath", pitch: "AI-powered automation platform", fcfYoyGrowth: 76.8 },
      { ticker: "SNOW", name: "Snowflake", pitch: "AI-ready data cloud platform", fcfYoyGrowth: 68.4 },
      { ticker: "ESTC", name: "Elastic", pitch: "Search & analytics for AI", fcfYoyGrowth: 52.1 }
    ],
    cloud_saas: [
      { ticker: "DDOG", name: "Datadog", pitch: "Cloud monitoring with AI insights", fcfYoyGrowth: 94.5 },
      { ticker: "NET", name: "Cloudflare", pitch: "Edge computing for AI inference", fcfYoyGrowth: 87.6 },
      { ticker: "MDB", name: "MongoDB", pitch: "Vector database for AI apps", fcfYoyGrowth: 72.3 },
      { ticker: "CFLT", name: "Confluent", pitch: "Real-time data streaming", fcfYoyGrowth: 65.8 },
      { ticker: "GTLB", name: "GitLab", pitch: "DevOps with AI coding assist", fcfYoyGrowth: 58.9 }
    ],
    cybersec: [
      { ticker: "S", name: "SentinelOne", pitch: "AI-native endpoint security", fcfYoyGrowth: 156.7 },
      { ticker: "CRWD", name: "CrowdStrike", pitch: "Cloud-native AI security platform", fcfYoyGrowth: 98.4 },
      { ticker: "ZS", name: "Zscaler", pitch: "Zero trust cloud security", fcfYoyGrowth: 76.5 },
      { ticker: "CYBR", name: "CyberArk", pitch: "Privileged access with AI", fcfYoyGrowth: 62.3 },
      { ticker: "TENB", name: "Tenable", pitch: "AI vulnerability management", fcfYoyGrowth: 54.8 }
    ]
  };

  return defaults[category as keyof typeof defaults] || [];
}

export async function getInvestmentData(category: string) {
  console.log(`[getInvestmentData] Fetching data for category: ${category}`);
  
  if (category === "market") {
    const marketOutlook = await searchMarketOutlook();
    console.log(`[getInvestmentData] Generated market outlook`);
    return { marketOutlook };
  }
  
  const investments = await searchInvestmentStocks(category);
  console.log(`[getInvestmentData] Found ${investments.length} investments for ${category}`);
  return { investments };
}
