import { useState } from "react";
import { motion } from "framer-motion";
import { useAdmin } from "@/hooks/use-admin";
import { EmailDrawer } from "@/components/EmailDrawer";
import { AdminEmailButton } from "@/components/AdminEmailButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  Activity,
  BarChart3,
  Calendar,
  DollarSign,
  Eye,
  Target,
  Shield,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Clock,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Download
} from "lucide-react";

export function InvestmentsCenter() {
  const [activeTab, setActiveTab] = useState("market-outlook");
  const { isAdmin } = useAdmin();
  const [emailDrawerOpen, setEmailDrawerOpen] = useState(false);
  const [emailTabContext, setEmailTabContext] = useState("");

  // Helper function to get tab display name
  const getTabDisplayName = (tabValue: string) => {
    const tabNames: Record<string, string> = {
      "market-outlook": "Market Outlook",
      "tech-picks": "Tech Picks",
      "biotech-picks": "Biotech Picks",
      "momentum-picks": "Momentum Picks",
      "etf-picks": "ETF Picks",
      "dividend-picks": "Dividend Picks"
    };
    return tabNames[tabValue] || tabValue;
  };

  const handleOpenEmailDrawer = (tabName: string) => {
    setEmailTabContext(getTabDisplayName(tabName));
    setEmailDrawerOpen(true);
  };

  // Tech portfolio data
  const techPortfolio = [
    { company: "Palantir", symbol: "PLTR", allocation: 10 },
    { company: "Amazon", symbol: "AMZN", allocation: 9 },
    { company: "Axon", symbol: "AXON", allocation: 7 },
    { company: "Cloudflare", symbol: "NET", allocation: 7 },
    { company: "DigitalOcean", symbol: "DOCN", allocation: 5 },
    { company: "MercadoLibre", symbol: "MELI", allocation: 5 },
    { company: "Snowflake", symbol: "SNOW", allocation: 5 },
    { company: "CrowdStrike", symbol: "CRWD", allocation: 5 },
    { company: "Rocket Lab", symbol: "RKLB", allocation: 5 },
    { company: "Astera Labs", symbol: "ALAB", allocation: 4 },
    { company: "Tesla", symbol: "TSLA", allocation: 4 },
    { company: "Tempus AI", symbol: "TEM", allocation: 3 },
    { company: "Databricks", symbol: "DATA", allocation: 3 },
    { company: "Rubrik", symbol: "RBRK", allocation: 3 },
    { company: "TransMedics", symbol: "TMDX", allocation: 3 },
    { company: "MongoDB", symbol: "MDB", allocation: 3 },
    { company: "Global-e", symbol: "GLBE", allocation: 2 },
    { company: "Unity", symbol: "U", allocation: 2 },
    { company: "IonQ", symbol: "IONQ", allocation: 1 },
    { company: "Eos Energy", symbol: "EOSE", allocation: 1 },
    { company: "Navitas", symbol: "NVTS", allocation: 1 },
  ];

  // Biotech portfolio data - sorted by allocation (highest first)
  const biotechPortfolio = [
    { company: "Syndax Pharmaceuticals", symbol: "SNDX", allocation: 14.41 },
    { company: "Harrow", symbol: "HROW", allocation: 10.56 },
    { company: "Amicus Therapeutics", symbol: "FOLD", allocation: 10.41 },
    { company: "Tarsus Pharmaceuticals", symbol: "TARS", allocation: 10.27 },
    { company: "Arcutis Biotherapeutics", symbol: "ARQT", allocation: 9.73 },
    { company: "Ascendis Pharma A/S", symbol: "ASND", allocation: 7.46 },
    { company: "scPharmaceuticals", symbol: "SCPH", allocation: 6.65 },
    { company: "Wave Life Sciences", symbol: "WVE", allocation: 6.11 },
    { company: "Corvus Pharmaceuticals", symbol: "CRVS", allocation: 5.57 },
    { company: "Arrowhead Pharmaceuticals", symbol: "ARWR", allocation: 5.45 },
    { company: "Kura Oncology", symbol: "KURA", allocation: 5.44 },
    { company: "Biohaven", symbol: "BHVN", allocation: 4.16 },
    { company: "Nuvation Bio", symbol: "NUVB", allocation: 3.76 },
  ];

  // Dividend portfolio data (top 30 holdings sorted by yield)
  const dividendPortfolio = [
    { symbol: "OXLC", name: "Oxford Lane Capital Corp.", yield: "28.1%", allocation: 2.00 },
    { symbol: "ECC", name: "Eagle Point Credit Co, Inc.", yield: "24.9%", allocation: 1.33 },
    { symbol: "XFLT", name: "XAI Octagon Floating Rate & Alternative Income Trust", yield: "15.4%", allocation: 1.33 },
    { symbol: "TPVG", name: "TriplePoint Venture Growth", yield: "15.2%", allocation: 1.00 },
    { symbol: "AGNC", name: "AGNC Investment Corp.", yield: "15.0%", allocation: 1.00 },
    { symbol: "PDI", name: "PIMCO Dynamic Income Fund", yield: "13.8%", allocation: 2.00 },
    { symbol: "ACRE", name: "Ares Commercial Real Estate Corporation", yield: "13.7%", allocation: 1.00 },
    { symbol: "NLY", name: "Annaly Capital Management, Inc", yield: "13.6%", allocation: 1.00 },
    { symbol: "HQH", name: "abrdn Healthcare Investors", yield: "13.5%", allocation: 2.00 },
    { symbol: "THQ", name: "abrdn Healthcare Opportunities Fund", yield: "12.8%", allocation: 2.00 },
    { symbol: "THW", name: "abrdn World Healthcare Fund", yield: "12.2%", allocation: 2.00 },
    { symbol: "AWP", name: "abrdn Global Premier Properties Fund", yield: "12.2%", allocation: 2.00 },
    { symbol: "SACH-A", name: "Sachem Capital 7.75% Series A Preferred", yield: "11.8%", allocation: 0.58 },
    { symbol: "BRSP", name: "BrightSpire Capital, Inc.", yield: "11.6%", allocation: 1.00 },
    { symbol: "CCD", name: "Calamos Dynamic Convertible & Income Fund", yield: "11.4%", allocation: 2.00 },
    { symbol: "PDO", name: "PIMCO Dynamic Income Opportunities Fund", yield: "11.2%", allocation: 2.00 },
    { symbol: "BIZD", name: "VanEck BDC Income ETF", yield: "11.1%", allocation: 2.00 },
    { symbol: "NYMTM", name: "N.Y. Mortgage Trust 7.875% Series E Preferred", yield: "11.1%", allocation: 0.58 },
    { symbol: "GHI", name: "Greystone Housing Impact Investors, LP", yield: "11.0%", allocation: 1.00 },
    { symbol: "BPYPP", name: "Brookfield Property Partners L.P., 6.50% Preferred", yield: "10.8%", allocation: 0.58 },
    { symbol: "LTSAP", name: "Osaic Financial Services 8.0% Series A Preferred", yield: "10.5%", allocation: 0.58 },
    { symbol: "CSWC", name: "Capital Southwest Corp.", yield: "10.5%", allocation: 1.00 },
    { symbol: "OBDC", name: "Blue Owl Capital Corp", yield: "10.5%", allocation: 1.00 },
    { symbol: "LYB", name: "LyondellBasell Industries NV", yield: "10.3%", allocation: 1.00 },
    { symbol: "USA", name: "Liberty All-Star Equity Fund", yield: "10.2%", allocation: 1.33 },
    { symbol: "PTY", name: "PIMCO Corporate & Income Opportunity Fund", yield: "10.2%", allocation: 2.00 },
    { symbol: "CIM-D", name: "Chimera Invmt. Corp. 8.0% Series D Preferred", yield: "10.1%", allocation: 0.58 },
    { symbol: "ARI", name: "Apollo Commercial Real Estate Finance", yield: "10.0%", allocation: 1.00 },
    { symbol: "SLRC", name: "SLR Investment Corp.", yield: "10.0%", allocation: 1.00 },
    { symbol: "CODI-C", name: "Compass Diversified Holdings, 7.875% Preferred", yield: "9.9%", allocation: 0.58 },
  ];

  // ETF portfolio data
  const etfPortfolio = {
    sectorETFs: [
      { name: "Information Technology", ticker: "XLK", allocation: 31.0, category: "Cyclical" },
      { name: "Financials", ticker: "XLF", allocation: 11.8, category: "Near-cyclical" },
      { name: "Communication Services", ticker: "XLC", allocation: 10.6, category: "Cyclical" },
      { name: "Consumer Discretionary", ticker: "XLY", allocation: 9.4, category: "Cyclical" },
      { name: "Industrials", ticker: "XLI", allocation: 7.6, category: "Cyclical" },
      { name: "Health Care", ticker: "XLV", allocation: 5.6, category: "Defensive" },
      { name: "Utilities", ticker: "XLU", allocation: 3.9, category: "Defensive" },
      { name: "Consumer Staples", ticker: "XLP", allocation: 3.0, category: "Defensive" },
      { name: "Real Estate", ticker: "XLRE", allocation: 1.7, category: "Near-cyclical" },
      { name: "Energy", ticker: "XLE", allocation: 0.5, category: "Near-cyclical" },
      { name: "Materials", ticker: "XLB", allocation: 0.0, category: "Cyclical" },
    ],
    individualETFs: [
      { name: "ARK Next Generation Internet ETF", ticker: "ARKW", allocation: 3.0 },
      { name: "iShares U.S. Aerospace & Defense", ticker: "ITA", allocation: 3.0 },
      { name: "iShares Blockchain and Tech ETF", ticker: "IBLC", allocation: 3.0 },
      { name: "Bitwise Bitcoin ETF", ticker: "BITB", allocation: 3.0 },
      { name: "Global X Social Media ETF", ticker: "SOCL", allocation: 3.0 },
    ]
  };

  // Momentum portfolio data - sorted by allocation (highest first)
  const momentumPortfolio = [
    { company: "AppLovin", symbol: "APP", allocation: 10.81 },
    { company: "Celestica", symbol: "CLS", allocation: 8.58 },
    { company: "Sterling Infrastructure", symbol: "STRL", allocation: 6.13 },
    { company: "Powell Industries", symbol: "POWL", allocation: 5.61 },
    { company: "Brinker International", symbol: "EAT", allocation: 3.47 },
    { company: "Uber Technologies", symbol: "UBER", allocation: 3.44 },
    { company: "Royal Caribbean Cruises", symbol: "RCL", allocation: 3.35 },
    { company: "Corporación América Airports", symbol: "CAAP", allocation: 3.07 },
    { company: "Celestica", symbol: "CLS", allocation: 2.80 },
    { company: "T-Mobile US", symbol: "TMUS", allocation: 2.75 },
    { company: "Manulife Financial", symbol: "MFC", allocation: 2.66 },
    { company: "Adtalem Global Education", symbol: "ATGE", allocation: 2.46 },
    { company: "Green Brick Partners", symbol: "GRBK", allocation: 2.46 },
    { company: "Argan", symbol: "AGX", allocation: 2.41 },
    { company: "Twilio", symbol: "TWLO", allocation: 2.35 },
    { company: "SkyWest", symbol: "SKYW", allocation: 2.23 },
    { company: "Credo Technology Group", symbol: "CRDO", allocation: 2.23 },
    { company: "Blue Bird", symbol: "BLBD", allocation: 2.16 },
    { company: "General Motors", symbol: "GM", allocation: 2.07 },
    { company: "Synchrony Financial", symbol: "SYF", allocation: 1.99 },
    { company: "Berkshire Hathaway", symbol: "BRK.B", allocation: 1.84 },
    { company: "Carnival", symbol: "CCL", allocation: 1.81 },
    { company: "Sprouts Farmers Market", symbol: "SFM", allocation: 1.77 },
    { company: "Okta", symbol: "OKTA", allocation: 1.74 },
    { company: "Powell Industries", symbol: "POWL", allocation: 1.69 },
    { company: "Pilgrim's Pride", symbol: "PPC", allocation: 1.66 },
    { company: "LendingClub", symbol: "LC", allocation: 1.40 },
    { company: "The Allstate", symbol: "ALL", allocation: 1.37 },
    { company: "Willdan Group", symbol: "WLDN", allocation: 1.23 },
    { company: "PayPal Holdings", symbol: "PYPL", allocation: 1.08 },
    { company: "Ituran Location and Control", symbol: "ITRN", allocation: 1.06 },
    { company: "Q2 Holdings", symbol: "QTWO", allocation: 1.02 },
    { company: "Wells Fargo", symbol: "WFC", allocation: 1.01 },
    { company: "Arcutis Biotherapeutics", symbol: "ARQT", allocation: 0.96 },
    { company: "EZCORP", symbol: "EZPW", allocation: 0.96 },
    { company: "Brinker International", symbol: "EAT", allocation: 0.95 },
    { company: "Manulife Financial", symbol: "MFC", allocation: 0.90 },
    { company: "SSR Mining", symbol: "SSRM", allocation: 0.86 },
    { company: "DXP Enterprises", symbol: "DXPE", allocation: 0.83 },
    { company: "Stride", symbol: "LRN", allocation: 0.77 },
    { company: "Sterling Infrastructure", symbol: "STRL", allocation: 0.74 },
    { company: "United Natural Foods", symbol: "UNFI", allocation: 0.67 },
    { company: "CommScope Holding", symbol: "COMM", allocation: 0.64 },
  ];

  // Market data
  const marketData = {
    spy: {
      price: 642.8,
      status: "At Resistance",
      rsi: 65,
      macd: "Positive (Flattening)",
      sma5: { value: 642, status: "flat" },
      ema20: 635,
      sma50: 622,
      sma200: 589,
    },
    support: {
      s1: { range: "618-620", label: "S1 (Must Hold)" },
      s2: { range: "622", label: "50-day SMA" },
      s3: { range: "589", label: "200-day SMA" },
    },
    resistance: {
      r1: { range: "642-643", label: "R1 (Current)" },
      r2: { range: "653-655", label: "R2 (Next Target)" },
      r3: { range: "660+", label: "Breakout Zone" },
    },
    macro: {
      cpi: { value: "2.7%", label: "CPI Y/Y" },
      coreCpi: { value: "3.1%", label: "Core CPI" },
      ppi: { value: "+0.9%", label: "PPI M/M" },
      unemployment: { value: "4.2%", label: "Unemployment" },
      ismMfg: { value: "48", label: "ISM Manufacturing" },
      ismServices: { value: "50.1", label: "ISM Services" },
      fedCutOdds: { value: "80-85%", label: "Sept Cut Odds" },
    },
    outlook: {
      oneWeek: { direction: "Sideways", description: "Sideways to slightly lower while above 635" },
      sixWeeks: { direction: "Bullish", description: "Modestly higher toward 653-660" },
      sixMonths: { direction: "Bullish", description: "Higher with intermittent 5-10% air-pockets" },
    },
    keyEvents: [
      { date: "Wed", event: "FOMC Minutes", impact: "high" },
      { date: "Thu-Sat", event: "Powell at Jackson Hole", impact: "critical" },
      { date: "Aug 29", event: "PCE Data", impact: "high" },
    ],
    risks: [
      { type: "Policy", description: "Tariff policy uncertainty" },
      { type: "Market", description: "Yen carry-trade wobble" },
      { type: "Geopolitical", description: "Ukraine situation" },
    ],
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === "Bullish") return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (direction === "Bearish") return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Activity className="w-4 h-4 text-yellow-400" />;
  };

  const getImpactColor = (impact: string) => {
    if (impact === "critical") return "bg-red-600";
    if (impact === "high") return "bg-orange-600";
    return "bg-blue-600";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* SEC Compliance Disclaimer */}
      <Alert className="mb-6 bg-amber-900/20 border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-sm text-amber-200">
          <strong>Important Disclosure:</strong> The information provided is for educational purposes only and does not constitute investment advice, 
          recommendations, or a solicitation to buy or sell any securities. Past performance does not guarantee future results. 
          All investments carry risk, including potential loss of principal. Please consult with a qualified financial advisor 
          before making any investment decisions. This content is not endorsed by the SEC or any regulatory body.
        </AlertDescription>
      </Alert>

      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-purple-600 rounded-full">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">
              Investment Picks
            </h1>
          </div>
          <p className="text-gray-400 text-lg ml-14">
            Data-driven investment ideas
          </p>
        </motion.div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-gray-900 p-0 h-auto border border-gray-800 grid grid-cols-6">
          <TabsTrigger
            value="market-outlook"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-900 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-800 data-[state=inactive]:hover:text-gray-300 rounded-none py-3 px-6 transition-all duration-200"
          >
            U.S. Market Outlook
          </TabsTrigger>
          <TabsTrigger
            value="tech-picks"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-900 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-800 data-[state=inactive]:hover:text-gray-300 rounded-none py-3 px-6 transition-all duration-200"
          >
            Tech Picks
          </TabsTrigger>
          <TabsTrigger
            value="momentum-picks"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-900 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-800 data-[state=inactive]:hover:text-gray-300 rounded-none py-3 px-6 transition-all duration-200"
          >
            Momentum Picks
          </TabsTrigger>
          <TabsTrigger
            value="biotech-picks"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-900 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-800 data-[state=inactive]:hover:text-gray-300 rounded-none py-3 px-6 transition-all duration-200"
          >
            Biotech Picks
          </TabsTrigger>
          <TabsTrigger
            value="etf-picks"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-900 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-800 data-[state=inactive]:hover:text-gray-300 rounded-none py-3 px-6 transition-all duration-200"
          >
            ETF Picks
          </TabsTrigger>
          <TabsTrigger
            value="dividend-picks"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-900 data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:bg-gray-800 data-[state=inactive]:hover:text-gray-300 rounded-none py-3 px-6 transition-all duration-200"
          >
            Dividend Picks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="market-outlook" className="mt-6 space-y-6">
          
          {/* Market Status Banner */}
          <Card className="bg-gradient-to-r from-purple-900 to-purple-950 border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    US Equities — Near-term pause at resistance; uptrend intact
                  </h2>
                  <div className="flex items-center gap-4">
                    <Badge className="bg-green-600/20 text-green-400 border-green-600">
                      Confirmed Uptrend
                    </Badge>
                    <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600">
                      Hold - Buy Dips
                    </Badge>
                    <span className="text-gray-400 text-sm">
                      <Clock className="inline w-3 h-3 mr-1" />
                      Last updated: August 18, 2025
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">SPY ~642.8</div>
                  <div className="text-sm text-purple-400">At Monthly R1 Resistance</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Technical Indicators */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  Technical Indicators
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">RSI</span>
                    <div className="flex items-center gap-2">
                      <Progress value={65} className="w-20 h-2" />
                      <span className="text-white font-semibold">65</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">MACD</span>
                    <Badge className="bg-green-600/20 text-green-400 border-green-600">
                      Positive
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">5-Day SMA</span>
                    <span className="text-white">642 (Flat)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">20-Day EMA</span>
                    <span className="text-white">635</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">50-Day SMA</span>
                    <span className="text-white">622</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">200-Day SMA</span>
                    <span className="text-white">589</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Support & Resistance */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Key Levels
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-2 flex items-center gap-1">
                    <ChevronUp className="w-4 h-4 text-red-400" />
                    Resistance
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">R3</span>
                      <Badge variant="outline" className="text-red-400 border-red-800">660+</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">R2</span>
                      <Badge variant="outline" className="text-orange-400 border-orange-800">653-655</Badge>
                    </div>
                    <div className="flex justify-between items-center bg-purple-900/20 px-2 py-1 rounded">
                      <span className="text-xs text-gray-400">R1 (Current)</span>
                      <Badge className="bg-purple-600/20 text-purple-400 border-purple-600">642-643</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-2 flex items-center gap-1">
                    <ChevronDown className="w-4 h-4 text-green-400" />
                    Support
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">S1 (Must Hold)</span>
                      <Badge variant="outline" className="text-green-400 border-green-800">618-620</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">S2 (50-DMA)</span>
                      <Badge variant="outline" className="text-blue-400 border-blue-800">622</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">S3 (200-DMA)</span>
                      <Badge variant="outline" className="text-gray-400 border-gray-700">589</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Macro Indicators */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  Macro Backdrop
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-xs text-gray-400">CPI Y/Y</div>
                    <div className="text-lg font-bold text-white">2.7%</div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-xs text-gray-400">Core CPI</div>
                    <div className="text-lg font-bold text-white">3.1%</div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-xs text-gray-400">PPI M/M</div>
                    <div className="text-lg font-bold text-white">+0.9%</div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-xs text-gray-400">Unemployment</div>
                    <div className="text-lg font-bold text-white">4.2%</div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-xs text-gray-400">ISM Mfg</div>
                    <div className="text-lg font-bold text-yellow-400">48</div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-xs text-gray-400">ISM Services</div>
                    <div className="text-lg font-bold text-green-400">50.1</div>
                  </div>
                  <div className="col-span-2 bg-purple-900/20 rounded p-2 border border-purple-800">
                    <div className="text-xs text-gray-400">Sept Rate Cut Odds</div>
                    <div className="text-xl font-bold text-purple-400">80-85%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Market Outlook Timeline */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-400" />
                Market Outlook & Direction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-400">1 Week</span>
                    {getDirectionIcon("Sideways")}
                  </div>
                  <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600 mb-2">
                    Sideways
                  </Badge>
                  <p className="text-sm text-gray-300">
                    Sideways to slightly lower while above 635
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-400">6-8 Weeks</span>
                    {getDirectionIcon("Bullish")}
                  </div>
                  <Badge className="bg-green-600/20 text-green-400 border-green-600 mb-2">
                    Bullish
                  </Badge>
                  <p className="text-sm text-gray-300">
                    Modestly higher toward 653-660; breakout targets mid-660s
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-400">6-12 Months</span>
                    {getDirectionIcon("Bullish")}
                  </div>
                  <Badge className="bg-green-600/20 text-green-400 border-green-600 mb-2">
                    Bullish
                  </Badge>
                  <p className="text-sm text-gray-300">
                    Higher with intermittent 5-10% air-pockets as policy normalizes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Events & Action Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Events */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  Key Upcoming Events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {marketData.keyEvents.map((event, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-400">{event.date}</div>
                      <div className="text-white font-medium">{event.event}</div>
                    </div>
                    <Badge className={`${getImpactColor(event.impact)} text-white`}>
                      {event.impact}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Action Items */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Action Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-green-900/20 rounded-lg border border-green-800">
                  <div className="flex items-start gap-2">
                    <ArrowUpRight className="w-4 h-4 text-green-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-green-400 mb-1">Core Portfolio</div>
                      <p className="text-xs text-gray-300">Stay 80-90% long; add near 635-629 with stops below 620</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-800">
                  <div className="flex items-start gap-2">
                    <Activity className="w-4 h-4 text-yellow-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-yellow-400 mb-1">At Resistance (653-655)</div>
                      <p className="text-xs text-gray-300">Trim strength or raise 10-20% cash</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-800">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-purple-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-purple-400 mb-1">Hedge Strategy</div>
                      <p className="text-xs text-gray-300">2-3% notional via Sep SPX puts (3-5% OTM)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Factors */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                Black Swan Watch - Risk Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {marketData.risks.map((risk, index) => (
                  <div key={index} className="bg-red-900/10 rounded-lg p-4 border border-red-900/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-semibold text-red-400">{risk.type}</span>
                    </div>
                    <p className="text-sm text-gray-300">{risk.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-gray-500 text-sm mt-6">
            <div className="flex items-center justify-center gap-2">
              <Info className="w-4 h-4" />
              <span>Last updated: August 18, 2025</span>
            </div>
          </div>
          
          {/* Admin Email Button - End of Tab */}
          {isAdmin && (
            <AdminEmailButton onClick={() => handleOpenEmailDrawer("market-outlook")} />
          )}
        </TabsContent>

        {/* Tech Picks Tab */}
        <TabsContent value="tech-picks" className="mt-6 space-y-6">
          {/* Performance Banner */}
          <Card className="bg-gradient-to-r from-purple-900 to-purple-950 border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-3">
                    Growth Portfolio Performance
                  </h2>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Since Inception (Jan 2023)</p>
                      <p className="text-3xl font-bold text-green-400">+202%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Annualized Return</p>
                      <p className="text-3xl font-bold text-cyan-400">+73.7%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Year to Date</p>
                      <p className="text-3xl font-bold text-green-400">+47.5%</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-600">
                      73.7% Annualized
                    </Badge>
                  </div>
                  <Badge className="bg-green-600/20 text-green-400 border-green-600 mb-2">
                    Outperforming S&P 500
                  </Badge>
                  <p className="text-sm text-gray-400">
                    Last Updated: August 15, 2025
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Holdings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Portfolio Holdings
              </CardTitle>
              <CardDescription className="text-gray-400">
                Diversified technology growth portfolio optimized for long-term appreciation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Company</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Symbol</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {techPortfolio.map((stock, index) => (
                      <tr 
                        key={index} 
                        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              stock.allocation >= 7 ? 'bg-purple-500' : 
                              stock.allocation >= 4 ? 'bg-blue-500' : 
                              'bg-gray-500'
                            }`} />
                            <span className="text-white font-medium">{stock.company}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-700">
                            {stock.symbol}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-gray-800 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
                                style={{ width: `${(stock.allocation / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-white font-semibold min-w-[3rem] text-right">
                              {stock.allocation}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Portfolio Stats */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Total Positions</p>
                  <p className="text-2xl font-bold text-white">21</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Top 5 Holdings</p>
                  <p className="text-2xl font-bold text-purple-400">38%</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Portfolio Focus</p>
                  <p className="text-2xl font-bold text-blue-400">Tech Growth</p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300">
                      Returns shown are <span className="text-yellow-400">pre-tax, pre-fees, after commissions</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Past performance does not guarantee future results. This is not investment advice.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investment Philosophy Card */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Investment Philosophy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Growth Focus
                  </h4>
                  <p className="text-sm text-gray-300">
                    Targeting companies with strong revenue growth, expanding TAM, and disruptive technology
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Risk Management
                  </h4>
                  <p className="text-sm text-gray-300">
                    Diversified across sectors with position sizing based on conviction and volatility
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    Long-term Horizon
                  </h4>
                  <p className="text-sm text-gray-300">
                    Minimum 3-5 year holding period to capture transformative growth cycles
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-yellow-400" />
                    Active Management
                  </h4>
                  <p className="text-sm text-gray-300">
                    Regular rebalancing and position adjustments based on fundamental changes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Admin Email Button - End of Tab */}
          {isAdmin && (
            <AdminEmailButton onClick={() => handleOpenEmailDrawer("tech-picks")} />
          )}
        </TabsContent>

        {/* Biotech Picks Tab */}
        <TabsContent value="biotech-picks" className="mt-6 space-y-6">
          {/* Performance Banner */}
          <Card className="bg-gradient-to-r from-purple-900 to-purple-950 border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-3">
                    Biotech Portfolio Performance
                  </h2>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Since Inception (Oct 2021)</p>
                      <p className="text-3xl font-bold text-green-400">+70.0%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Annualized Return</p>
                      <p className="text-3xl font-bold text-cyan-400">+14.5%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Year to Date</p>
                      <p className="text-3xl font-bold text-green-400">+23.4%</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-600">
                      14.5% Annualized
                    </Badge>
                  </div>
                  <Badge className="bg-green-600/20 text-green-400 border-green-600 mb-2">
                    Outperforming XBI
                  </Badge>
                  <p className="text-sm text-gray-400">
                    Last Updated: August 18, 2025
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Holdings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Portfolio Holdings
              </CardTitle>
              <CardDescription className="text-gray-400">
                High-conviction biotech and pharmaceutical growth portfolio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Company</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Symbol</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biotechPortfolio.map((stock, index) => (
                      <tr 
                        key={index} 
                        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              stock.allocation >= 10 ? 'bg-purple-500' : 
                              stock.allocation >= 7 ? 'bg-blue-500' : 
                              stock.allocation >= 5 ? 'bg-cyan-500' :
                              'bg-gray-500'
                            }`} />
                            <span className="text-white font-medium">{stock.company}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-700">
                            {stock.symbol}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-gray-800 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
                                style={{ width: `${(stock.allocation / 15) * 100}%` }}
                              />
                            </div>
                            <span className="text-white font-semibold min-w-[3rem] text-right">
                              {stock.allocation.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Portfolio Stats */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Total Positions</p>
                  <p className="text-2xl font-bold text-white">13</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Top 5 Holdings</p>
                  <p className="text-2xl font-bold text-purple-400">52%</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Portfolio Focus</p>
                  <p className="text-2xl font-bold text-blue-400">Biotech Growth</p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300">
                      Returns shown are <span className="text-yellow-400">pre-tax, pre-fees, after commissions</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Past performance does not guarantee future results. This is not investment advice.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investment Philosophy Card */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Biotech Investment Philosophy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Clinical Catalysts
                  </h4>
                  <p className="text-sm text-gray-300">
                    Focus on companies with near-term clinical trial readouts and FDA approval decisions
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Risk Diversification
                  </h4>
                  <p className="text-sm text-gray-300">
                    Balanced across development stages from pre-clinical to commercial-stage companies
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Therapeutic Areas
                  </h4>
                  <p className="text-sm text-gray-300">
                    Diversified across oncology, rare diseases, neurology, and emerging cell therapies
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-yellow-400" />
                    M&A Potential
                  </h4>
                  <p className="text-sm text-gray-300">
                    Emphasis on acquisition targets with validated platforms and strategic assets
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Admin Email Button - End of Tab */}
          {isAdmin && (
            <AdminEmailButton onClick={() => handleOpenEmailDrawer("biotech-picks")} />
          )}
        </TabsContent>

        {/* Momentum Picks Tab */}
        <TabsContent value="momentum-picks" className="mt-6 space-y-6">
          {/* Performance Banner */}
          <Card className="bg-gradient-to-r from-purple-900 to-purple-950 border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-3">
                    Momentum Portfolio Performance
                  </h2>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Since Inception (July 2022)</p>
                      <p className="text-3xl font-bold text-green-400">+210.0%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Annualized Return</p>
                      <p className="text-3xl font-bold text-cyan-400">+45.6%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Year to Date</p>
                      <p className="text-3xl font-bold text-green-400">+19.6%</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-600">
                      45.6% Annualized
                    </Badge>
                  </div>
                  <Badge className="bg-green-600/20 text-green-400 border-green-600 mb-2">
                    High-Conviction Momentum
                  </Badge>
                  <p className="text-sm text-gray-400">
                    Last Updated: August 18, 2025
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Holdings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Portfolio Holdings
              </CardTitle>
              <CardDescription className="text-gray-400">
                Alpha-generating momentum stocks with strong technical and fundamental characteristics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Company</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Symbol</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {momentumPortfolio.map((stock, index) => (
                      <tr 
                        key={index} 
                        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              stock.allocation >= 8 ? 'bg-purple-500' : 
                              stock.allocation >= 5 ? 'bg-blue-500' : 
                              stock.allocation >= 3 ? 'bg-cyan-500' :
                              stock.allocation >= 2 ? 'bg-green-500' :
                              'bg-gray-500'
                            }`} />
                            <span className="text-white font-medium">{stock.company}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-700">
                            {stock.symbol}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-gray-800 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
                                style={{ width: `${(stock.allocation / 11) * 100}%` }}
                              />
                            </div>
                            <span className="text-white font-semibold min-w-[3rem] text-right">
                              {stock.allocation.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Portfolio Stats */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Total Positions</p>
                  <p className="text-2xl font-bold text-white">44</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Top 5 Holdings</p>
                  <p className="text-2xl font-bold text-purple-400">34.7%</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Portfolio Focus</p>
                  <p className="text-2xl font-bold text-blue-400">Momentum Alpha</p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300">
                      Returns shown are <span className="text-yellow-400">pre-tax, pre-fees, after commissions</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Past performance does not guarantee future results. This is not investment advice.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investment Philosophy Card */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Momentum Investment Philosophy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Momentum Factors
                  </h4>
                  <p className="text-sm text-gray-300">
                    Focus on stocks with strong price momentum, earnings momentum, and volume confirmation
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Technical Analysis
                  </h4>
                  <p className="text-sm text-gray-300">
                    Systematic screening for breakouts, relative strength leaders, and trend continuation
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    Risk Controls
                  </h4>
                  <p className="text-sm text-gray-300">
                    Strict position sizing, stop-loss discipline, and portfolio diversification
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-yellow-400" />
                    Alpha Generation
                  </h4>
                  <p className="text-sm text-gray-300">
                    Seeking market outperformance through systematic momentum strategies
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Admin Email Button - End of Tab */}
          {isAdmin && (
            <AdminEmailButton onClick={() => handleOpenEmailDrawer("momentum-picks")} />
          )}
        </TabsContent>

        {/* ETF Picks Tab */}
        <TabsContent value="etf-picks" className="mt-6 space-y-6">
          {/* Performance Banner */}
          <Card className="bg-gradient-to-r from-purple-900 to-purple-950 border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-3">
                    ETF Portfolio Performance
                  </h2>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Since Inception (Oct 2023)</p>
                      <p className="text-3xl font-bold text-green-400">+60.85%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Annualized Return</p>
                      <p className="text-3xl font-bold text-cyan-400">+29.0%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Year to Date</p>
                      <p className="text-3xl font-bold text-green-400">+10.2%</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-600">
                      29.0% Annualized
                    </Badge>
                  </div>
                  <Badge className="bg-green-600/20 text-green-400 border-green-600 mb-2">
                    Beating S&P 500
                  </Badge>
                  <p className="text-sm text-gray-400">
                    Last Updated: August 6, 2025
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sector ETFs Section */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Sector ETFs (85%)
              </CardTitle>
              <CardDescription className="text-gray-400">
                Strategic sector allocation optimized for market cycles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Sector</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Ticker</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Category</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Current Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfPortfolio.sectorETFs.map((etf, index) => (
                      <tr 
                        key={index} 
                        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              etf.category === 'Cyclical' ? 'bg-purple-500' : 
                              etf.category === 'Near-cyclical' ? 'bg-blue-500' : 
                              'bg-green-500'
                            }`} />
                            <span className="text-white font-medium">{etf.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-700">
                            {etf.ticker}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`${
                            etf.category === 'Cyclical' ? 'bg-purple-600/20 text-purple-400 border-purple-600' :
                            etf.category === 'Near-cyclical' ? 'bg-blue-600/20 text-blue-400 border-blue-600' :
                            'bg-green-600/20 text-green-400 border-green-600'
                          }`}>
                            {etf.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-gray-800 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
                                style={{ width: `${(etf.allocation / 31) * 100}%` }}
                              />
                            </div>
                            <span className="text-white font-bold min-w-[3rem] text-right">
                              {etf.allocation.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Sector Summary Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800">
                  <p className="text-sm text-gray-400 mb-1">Cyclical</p>
                  <p className="text-2xl font-bold text-purple-400">58.6%</p>
                </div>
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-800">
                  <p className="text-sm text-gray-400 mb-1">Near-cyclical</p>
                  <p className="text-2xl font-bold text-blue-400">14.0%</p>
                </div>
                <div className="bg-green-900/20 rounded-lg p-4 border border-green-800">
                  <p className="text-sm text-gray-400 mb-1">Defensive</p>
                  <p className="text-2xl font-bold text-green-400">12.5%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual ETFs Section */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-400" />
                Individual ETFs (15%)
              </CardTitle>
              <CardDescription className="text-gray-400">
                High-conviction thematic and sector-specific ETFs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">ETF Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Ticker</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfPortfolio.individualETFs.map((etf, index) => (
                      <tr 
                        key={index} 
                        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-white font-medium">{etf.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-700">
                            {etf.ticker}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-white font-bold">
                            {etf.allocation.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Portfolio Stats */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Total ETFs</p>
                  <p className="text-2xl font-bold text-white">16</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Sector ETFs</p>
                  <p className="text-2xl font-bold text-purple-400">85%</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Individual ETFs</p>
                  <p className="text-2xl font-bold text-yellow-400">15%</p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300">
                      Returns shown are <span className="text-yellow-400">pre-tax, pre-fees, after commissions</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Past performance does not guarantee future results. This is not investment advice.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investment Philosophy Card */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                ETF Investment Philosophy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Tactical Allocation
                  </h4>
                  <p className="text-sm text-gray-300">
                    Dynamic sector rotation based on market cycles and economic conditions
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Risk-Adjusted Returns
                  </h4>
                  <p className="text-sm text-gray-300">
                    Balanced exposure across cyclical and defensive sectors for optimal risk/reward
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Growth Tilt
                  </h4>
                  <p className="text-sm text-gray-300">
                    Overweight technology and growth sectors while maintaining defensive anchors
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-yellow-400" />
                    Thematic Exposure
                  </h4>
                  <p className="text-sm text-gray-300">
                    Targeted allocation to high-conviction themes through specialized ETFs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Admin Email Button - End of Tab */}
          {isAdmin && (
            <AdminEmailButton onClick={() => handleOpenEmailDrawer("etf-picks")} />
          )}
        </TabsContent>

        {/* Dividend Picks Tab */}
        <TabsContent value="dividend-picks" className="mt-6 space-y-6">
          {/* Performance Banner */}
          <Card className="bg-gradient-to-r from-purple-900 to-purple-950 border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-3">
                    Dividend Portfolio Performance
                  </h2>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Total Return Since Inception (Jan 2016)</p>
                      <p className="text-3xl font-bold text-green-400">+137.0%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Annualized Total Return</p>
                      <p className="text-3xl font-bold text-cyan-400">+9.2%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">YTD Total Return</p>
                      <p className="text-3xl font-bold text-green-400">+14.0%</p>
                    </div>
                    <div className="border-l border-purple-700 pl-6">
                      <p className="text-sm text-gray-400 mb-1">Portfolio Yield</p>
                      <p className="text-3xl font-bold text-yellow-400">9.7%</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-600">
                      9.2% Annualized + 9.7% Yield
                    </Badge>
                  </div>
                  <Badge className="bg-green-600/20 text-green-400 border-green-600 mb-2">
                    High-Yield Income
                  </Badge>
                  <p className="text-sm text-gray-400">
                    Last Updated: July 15, 2025
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Holdings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                High-Yield Dividend Holdings
              </CardTitle>
              <CardDescription className="text-gray-400">
                Top dividend funds, stocks, and preferred securities sorted by yield (Showing top 30 of 100+ holdings)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Symbol</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Name</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Dividend Yield</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dividendPortfolio.map((stock, index) => (
                      <tr 
                        key={index} 
                        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-700">
                            {stock.symbol}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              parseFloat(stock.yield) >= 9 ? 'bg-green-500' : 
                              parseFloat(stock.yield) >= 7 ? 'bg-yellow-500' : 
                              'bg-blue-500'
                            }`} />
                            <span className="text-white font-medium text-sm">{stock.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={`${
                            parseFloat(stock.yield) >= 9 ? 'bg-green-600/20 text-green-400 border-green-600' :
                            parseFloat(stock.yield) >= 7 ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600' :
                            'bg-blue-600/20 text-blue-400 border-blue-600'
                          }`}>
                            {stock.yield}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-white font-semibold">
                            {stock.allocation.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Download Link */}
              <div className="mt-6 flex justify-center">
                <a 
                  href="/Dividend_Portfolio_AUG_2025.xlsx" 
                  download="Dividend_Portfolio_AUG_2025.xlsx"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download Complete Portfolio (100+ Holdings)
                </a>
              </div>

              {/* Portfolio Stats */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Total Holdings</p>
                  <p className="text-2xl font-bold text-white">100+</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Portfolio Yield</p>
                  <p className="text-2xl font-bold text-yellow-400">9.7%</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Avg Position Size</p>
                  <p className="text-2xl font-bold text-purple-400">0.6%</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Focus</p>
                  <p className="text-2xl font-bold text-blue-400">Income</p>
                </div>
              </div>

              {/* Yield Distribution */}
              <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Yield Distribution</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-300">9%+ Yield: ~25%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-gray-300">7-9% Yield: ~50%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-gray-300">&lt;7% Yield: ~25%</span>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300">
                      Total returns shown are <span className="text-yellow-400">pre-tax, pre-fees, after commissions</span> and include dividend reinvestment
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Past performance does not guarantee future results. Preferred stocks carry interest rate and credit risk. This is not investment advice.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investment Philosophy Card */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Dividend Investment Philosophy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    Income Generation
                  </h4>
                  <p className="text-sm text-gray-300">
                    Focus on high-quality preferred stocks and income securities with sustainable yields
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Risk Mitigation
                  </h4>
                  <p className="text-sm text-gray-300">
                    Diversification across 100+ holdings to minimize single-issuer risk
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Total Return Focus
                  </h4>
                  <p className="text-sm text-gray-300">
                    Combination of high current income with capital appreciation potential
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Active Management
                  </h4>
                  <p className="text-sm text-gray-300">
                    Regular monitoring and rebalancing to optimize risk-adjusted returns
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Admin Email Button - End of Tab */}
          {isAdmin && (
            <AdminEmailButton onClick={() => handleOpenEmailDrawer("dividend-picks")} />
          )}
        </TabsContent>
      </Tabs>
      
      {/* Email Drawer for Admin */}
      {isAdmin && (
        <EmailDrawer
          isOpen={emailDrawerOpen}
          onClose={() => setEmailDrawerOpen(false)}
          tabName={emailTabContext}
        />
      )}
    </div>
  );
}