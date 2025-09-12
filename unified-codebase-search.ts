#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SearchResult {
  engine: 'zoekt' | 'enhanced' | 'grep';
  file: string;
  line?: number;
  content: string;
  context?: string[];
}

interface SearchConfig {
  query: string;
  fileTypes?: string[];
  context?: number;
  maxResults?: number;
  engine?: 'zoekt' | 'enhanced' | 'grep' | 'all';
}

class UnifiedCodebaseSearch {
  private basePath: string;
  private zoektIndexDir: string;

  constructor(basePath: string = '.', zoektIndexDir: string = '~/.zoekt') {
    this.basePath = basePath;
    this.zoektIndexDir = zoektIndexDir.replace('~', process.env.HOME || '');
  }

  /**
   * Search using Zoekt (fastest for exact matches)
   */
  async searchWithZoekt(query: string, maxResults: number = 50): Promise<SearchResult[]> {
    try {
      const zoektPath = `${process.env.HOME}/go/bin/zoekt`;
      if (!fs.existsSync(zoektPath)) {
        console.warn('Zoekt not found, skipping...');
        return [];
      }

      const cmd = `"${zoektPath}" -index_dir "${this.zoektIndexDir}" "${query}"`;
      const output = execSync(cmd, { 
        encoding: 'utf-8', 
        maxBuffer: 5 * 1024 * 1024,
        timeout: 30000
      });

      const results: SearchResult[] = [];
      const lines = output.split('\\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (results.length >= maxResults) break;
        
        const match = line.match(/^(.+?):(\d+):(.+)$/);
        if (match) {
          const [, file, lineNum, content] = match;
          results.push({
            engine: 'zoekt',
            file: file,
            line: parseInt(lineNum, 10),
            content: content.trim()
          });
        } else if (line.includes(':')) {
          const [file, ...contentParts] = line.split(':');
          results.push({
            engine: 'zoekt',
            file: file,
            content: contentParts.join(':').trim()
          });
        }
      }

      return results;
    } catch (error) {
      console.warn('Zoekt search failed:', error);
      return [];
    }
  }

  /**
   * Search using grep (good fallback)
   */
  async searchWithGrep(query: string, fileTypes: string[] = ['ts', 'tsx', 'js', 'jsx'], maxResults: number = 50): Promise<SearchResult[]> {
    try {
      const typeArgs = fileTypes.map(ext => `--include="*.${ext}"`).join(' ');
      const cmd = `grep -rn ${typeArgs} --max-count=${maxResults} "${query}" ${this.basePath}`;
      
      const output = execSync(cmd, { 
        encoding: 'utf-8', 
        maxBuffer: 5 * 1024 * 1024,
        timeout: 30000
      });

      const results: SearchResult[] = [];
      const lines = output.split('\\n').filter(line => line.trim());
      
      for (const line of lines) {
        const match = line.match(/^(.+?):(\d+):(.+)$/);
        if (match) {
          const [, file, lineNum, content] = match;
          results.push({
            engine: 'grep',
            file: file.replace(this.basePath + '/', ''),
            line: parseInt(lineNum, 10),
            content: content.trim()
          });
        }
      }

      return results;
    } catch (error) {
      console.warn('Grep search failed:', error);
      return [];
    }
  }

  /**
   * Enhanced semantic search with categories
   */
  async searchFinancialFunctions(query: string): Promise<SearchResult[]> {
    const financialPatterns = [
      'MonteCarloSimulation',
      'runEnhanced.*Simulation',
      'retirement.*calculation',
      'optimization.*variable',
      'tax.*optimization',
      'estate.*planning'
    ];

    const results: SearchResult[] = [];
    
    for (const pattern of financialPatterns) {
      if (pattern.toLowerCase().includes(query.toLowerCase()) || 
          query.toLowerCase().includes(pattern.toLowerCase())) {
        const zoektResults = await this.searchWithZoekt(pattern);
        results.push(...zoektResults);
      }
    }

    return this.deduplicateResults(results);
  }

  /**
   * Search React components
   */
  async searchComponents(query: string): Promise<SearchResult[]> {
    const componentPatterns = [
      `function ${query}`,
      `const ${query}.*=.*=>`,
      `<${query}`,
      `export.*${query}`,
      `${query}.*tsx`
    ];

    const results: SearchResult[] = [];
    
    for (const pattern of componentPatterns) {
      const zoektResults = await this.searchWithZoekt(pattern);
      results.push(...zoektResults);
    }

    return this.deduplicateResults(results);
  }

  /**
   * Search API endpoints
   */
  async searchAPI(query: string): Promise<SearchResult[]> {
    const apiPatterns = [
      `app\\.(get|post|put|delete).*${query}`,
      `router\\..*${query}`,
      `/api.*${query}`,
      `endpoint.*${query}`
    ];

    const results: SearchResult[] = [];
    
    for (const pattern of apiPatterns) {
      const zoektResults = await this.searchWithZoekt(pattern);
      results.push(...zoektResults);
    }

    return this.deduplicateResults(results);
  }

  /**
   * Unified search across all engines
   */
  async search(config: SearchConfig): Promise<SearchResult[]> {
    const { query, engine = 'all', maxResults = 50 } = config;
    let results: SearchResult[] = [];

    if (engine === 'zoekt' || engine === 'all') {
      console.log('🔍 Searching with Zoekt...');
      const zoektResults = await this.searchWithZoekt(query, maxResults);
      results.push(...zoektResults);
      console.log(`  Found ${zoektResults.length} results with Zoekt`);
    }

    if ((engine === 'grep' || engine === 'all') && results.length < maxResults) {
      console.log('🔍 Searching with Grep...');
      const grepResults = await this.searchWithGrep(query, config.fileTypes, maxResults - results.length);
      results.push(...grepResults);
      console.log(`  Found ${grepResults.length} results with Grep`);
    }

    // Enhanced semantic searches
    if (engine === 'enhanced' || engine === 'all') {
      console.log('🔍 Enhanced semantic search...');
      
      // Financial functions
      const financialResults = await this.searchFinancialFunctions(query);
      results.push(...financialResults);
      
      // Components
      const componentResults = await this.searchComponents(query);
      results.push(...componentResults);
      
      // API endpoints
      const apiResults = await this.searchAPI(query);
      results.push(...apiResults);
      
      console.log(`  Found ${financialResults.length + componentResults.length + apiResults.length} enhanced results`);
    }

    return this.deduplicateResults(results).slice(0, maxResults);
  }

  /**
   * Remove duplicate results
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = `${result.file}:${result.line}:${result.content.substring(0, 50)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Display search results nicely
   */
  displayResults(results: SearchResult[], query: string) {
    console.log(`\\n🎯 Search Results for "${query}" (${results.length} found)\\n`);

    // Group by file
    const byFile = new Map<string, SearchResult[]>();
    for (const result of results) {
      if (!byFile.has(result.file)) {
        byFile.set(result.file, []);
      }
      byFile.get(result.file)!.push(result);
    }

    // Display grouped results
    for (const [file, fileResults] of byFile.entries()) {
      console.log(`📁 ${file} (${fileResults.length} matches)`);
      
      for (const result of fileResults.slice(0, 3)) {
        const engine = result.engine === 'zoekt' ? '⚡' : 
                      result.engine === 'grep' ? '🔍' : '🧠';
        const line = result.line ? `:${result.line}` : '';
        const content = result.content.length > 80 ? 
                       result.content.substring(0, 80) + '...' : 
                       result.content;
        
        console.log(`  ${engine} ${line}: ${content}`);
      }
      
      if (fileResults.length > 3) {
        console.log(`  ... and ${fileResults.length - 3} more matches`);
      }
      console.log('');
    }
  }

  /**
   * Quick search with automatic categorization
   */
  async quickSearch(query: string) {
    console.log(`\\n🚀 Quick Search: "${query}"\\n`);
    
    const results = await this.search({
      query,
      engine: 'all',
      maxResults: 30
    });

    this.displayResults(results, query);
    return results;
  }
}

// Export for use in other scripts
export { UnifiedCodebaseSearch, SearchResult, SearchConfig };

// CLI interface when run directly
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx unified-codebase-search.ts <query> [engine]');
    console.log('Engines: zoekt, grep, enhanced, all (default)');
    console.log('\\nExamples:');
    console.log('  npx tsx unified-codebase-search.ts "runEnhancedMonteCarloSimulation"');
    console.log('  npx tsx unified-codebase-search.ts "OptimizationCenter" zoekt');
    console.log('  npx tsx unified-codebase-search.ts "/api/financial-profile" enhanced');
    return;
  }

  const [query, engine = 'all'] = args;
  const searcher = new UnifiedCodebaseSearch('/Users/bhavneesh/Desktop/affluviaV2/affluvia');
  
  await searcher.quickSearch(query);
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
