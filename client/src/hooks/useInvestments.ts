import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

interface Investment {
  ticker: string;
  name: string;
  pitch: string;
  fcfYoyGrowth: number;
  marketCap?: string;
  sector?: string;
  isBackfill?: boolean;
}

interface MarketEvent {
  event: string;
  date: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  impact?: string;
}

interface MarketDirection {
  trend: string;
  sentiment: string;
  keyDrivers: string[];
}

interface MarketOutlookData {
  marketSummary: string;
  recentData: MarketEvent[];
  upcomingData: MarketEvent[];
  marketDirection?: MarketDirection;
}

interface InvestmentsResponse {
  investments?: Investment[];
  marketOutlook?: MarketOutlookData;
}

const CATEGORIES = ["market", "ai_infra", "ai_software", "cloud_saas", "cybersec"] as const;
type Category = typeof CATEGORIES[number];

async function fetchInvestments(category: Category, refresh = false): Promise<InvestmentsResponse> {
  // Always refresh market data to ensure we get the new format
  const shouldRefresh = refresh || category === "market";
  const url = shouldRefresh 
    ? `/api/investments/${category}?refresh=true`
    : `/api/investments/${category}`;
    
  console.log(`[useInvestments] Fetching ${category} data from ${url}`);
  
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch investments data");
  }

  const data = await response.json();
  console.log(`[useInvestments] Received data for ${category}:`, data);
  
  return data;
}

export function useInvestments(category: Category) {
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [isManuallyFetching, setIsManuallyFetching] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkCompleteRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ["investments", category],
    queryFn: () => fetchInvestments(category),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't auto-fetch on mount
    refetchOnReconnect: false,
    retry: 1,
    enabled: false, // Disable automatic fetching
  });

  const fetchData = async (refresh = false) => {
    // Clear any existing timers before starting new ones
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (checkCompleteRef.current) {
      clearInterval(checkCompleteRef.current);
      checkCompleteRef.current = null;
    }
    
    startTimeRef.current = Date.now();
    setLoadingSeconds(0);
    setIsManuallyFetching(true);
    
    try {
      // Always fetch data directly since query is disabled
      const freshData = await fetchInvestments(category, refresh);
      queryClient.setQueryData(["investments", category], freshData);
      return { data: freshData };
    } finally {
      // Data is loaded, but keep showing loading until 10 seconds
      // Timer will handle setting isManuallyFetching to false
    }
  };

  useEffect(() => {
    // Clean up timers when component unmounts or category changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (checkCompleteRef.current) {
        clearInterval(checkCompleteRef.current);
        checkCompleteRef.current = null;
      }
      startTimeRef.current = null;
      setLoadingSeconds(0);
      setIsManuallyFetching(false);
    };
  }, [category]);

  useEffect(() => {
    if (isManuallyFetching && startTimeRef.current && !intervalRef.current) {
      console.log(`[useInvestments] Starting timer for ${category}`);

      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setLoadingSeconds(elapsed);
          
          // Stop at 10 seconds
          if (elapsed >= 10) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            startTimeRef.current = null;
            setIsManuallyFetching(false);
          }
        }
      }, 1000);
    }

    return () => {
      // Cleanup is handled in the category change effect
    };
  }, [isManuallyFetching, category]);

  return {
    data: query.data,
    isLoading: isManuallyFetching,
    error: query.error,
    loadingSeconds,
    fetchData,
    refetch: () => fetchData(true), // For backwards compatibility
  };
}