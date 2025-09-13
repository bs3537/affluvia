#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SearchResult {
  file: string;
  line: number;
  content: string;
  context?: string[];
}

interface SearchConfig {
  patterns: string[];
  fileTypes?: string[];
  excludePaths?: string[];
  contextLines?: number;
  maxResults?: number;
}

class EnhancedCodebaseSearch {
  private basePath: string;
  private cache: Map<string, SearchResult[]> = new Map();

  constructor(basePath: string = '.') {
    this.basePath = basePath;
  }

  /**
   * Perform parallel searches for better performance
   */
  async parallelSearch(configs: SearchConfig[]): Promise<SearchResult[]> {
    const searchPromises = configs.map(config => this.search(config));
    const results = await Promise.all(searchPromises);
    return results.flat();
  }

  /**
   * Smart search that understands code context
   */
  async search(config: SearchConfig): Promise<SearchResult[]> {
    const cacheKey = JSON.stringify(config);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const results: SearchResult[] = [];
    
    for (const pattern of config.patterns) {
      try {
        // Build ripgrep command
        let cmd = `rg "${pattern}" --json`;
        
        // Add file type filters
        if (config.fileTypes) {
          config.fileTypes.forEach(type => {
            cmd += ` --type ${type}`;
          });
        }
        
        // Add context lines
        if (config.contextLines) {
          cmd += ` -C ${config.contextLines}`;
        }
        
        // Execute search
        const output = execSync(cmd, { 
          cwd: this.basePath,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        // Parse JSON output
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'match') {
              results.push({
                file: data.data.path.text,
                line: data.data.line_number,
                content: data.data.lines.text,
                context: data.data.submatches
              });
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      } catch (error) {
        // Search might return no results, which is okay
      }
    }
    
    // Cache results
    this.cache.set(cacheKey, results);
    
    // Limit results if specified
    if (config.maxResults) {
      return results.slice(0, config.maxResults);
    }
    
    return results;
  }

  /**
   * Find function definitions
   */
  async findFunction(functionName: string): Promise<SearchResult[]> {
    const patterns = [
      `function ${functionName}`,
      `const ${functionName} = `,
      `export.*${functionName}`,
      `${functionName}:\\s*\\(`
    ];
    
    return this.search({
      patterns,
      fileTypes: ['ts', 'tsx', 'js', 'jsx'],
      contextLines: 10
    });
  }

  /**
   * Find variable usage
   */
  async findVariableUsage(variableName: string): Promise<SearchResult[]> {
    return this.search({
      patterns: [variableName],
      fileTypes: ['ts', 'tsx'],
      contextLines: 5,
      maxResults: 50
    });
  }

  /**
   * Find API endpoints
   */
  async findEndpoints(method?: string, path?: string): Promise<SearchResult[]> {
    const patterns: string[] = [];
    
    if (method && path) {
      patterns.push(`${method}.*${path}`);
    } else if (method) {
      patterns.push(`app\\.${method.toLowerCase()}\\(`);
    } else if (path) {
      patterns.push(`["']${path}["']`);
    } else {
      patterns.push('app\\.(get|post|put|delete|patch)\\(');
    }
    
    return this.search({
      patterns,
      fileTypes: ['ts', 'js'],
      contextLines: 15
    });
  }

  /**
   * Find database queries
   */
  async findDatabaseQueries(table?: string): Promise<SearchResult[]> {
    const patterns = table 
      ? [`from\\s+${table}`, `update\\s+${table}`, `insert\\s+into\\s+${table}`]
      : ['from\\s+\\w+', 'update\\s+\\w+', 'insert\\s+into'];
    
    return this.search({
      patterns,
      fileTypes: ['ts', 'sql'],
      contextLines: 10
    });
  }

  /**
   * Find React components
   */
  async findComponent(componentName: string): Promise<SearchResult[]> {
    const patterns = [
      `function ${componentName}`,
      `const ${componentName}.*=.*=>`,
      `<${componentName}`,
      `export.*${componentName}`
    ];
    
    return this.search({
      patterns,
      fileTypes: ['tsx', 'jsx'],
      contextLines: 20
    });
  }

  /**
   * Trace data flow through the application
   */
  async traceDataFlow(startPoint: string): Promise<Map<string, SearchResult[]>> {
    const flow = new Map<string, SearchResult[]>();
    
    // Find initial definition
    const definitions = await this.findFunction(startPoint);
    flow.set('definition', definitions);
    
    // Find where it's called
    const calls = await this.findVariableUsage(startPoint);
    flow.set('calls', calls);
    
    // Find related API endpoints
    const endpoints = await this.findEndpoints(undefined, startPoint);
    flow.set('endpoints', endpoints);
    
    return flow;
  }

  /**
   * Analyze code relationships
   */
  async analyzeRelationships(entity: string): Promise<any> {
    const results = {
      definitions: await this.findFunction(entity),
      usage: await this.findVariableUsage(entity),
      imports: await this.search({
        patterns: [`import.*${entity}`, `from.*${entity}`],
        fileTypes: ['ts', 'tsx'],
        contextLines: 2
      }),
      exports: await this.search({
        patterns: [`export.*${entity}`],
        fileTypes: ['ts', 'tsx'],
        contextLines: 5
      })
    };
    
    return {
      entity,
      totalReferences: Object.values(results).flat().length,
      breakdown: results
    };
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get file structure
   */
  async getFileStructure(pattern: string = '**/*.{ts,tsx,js,jsx}'): Promise<string[]> {
    try {
      const output = execSync(`find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -100`, {
        cwd: this.basePath,
        encoding: 'utf-8'
      });
      return output.split('\n').filter(line => line.trim());
    } catch (error) {
      return [];
    }
  }
}

// Example usage functions
async function demonstrateSearch() {
  const searcher = new EnhancedCodebaseSearch('/Users/bhavneesh/Desktop/affluvia/affluvia');
  
  console.log('🔍 Enhanced Codebase Search Demo\n');
  
  // 1. Find optimization-related code
  console.log('1️⃣ Searching for optimization variables...');
  const optimizationResults = await searcher.parallelSearch([
    {
      patterns: ['optimizationVariables', 'handleLockToggle'],
      fileTypes: ['ts', 'tsx'],
      contextLines: 10
    }
  ]);
  console.log(`Found ${optimizationResults.length} results\n`);
  
  // 2. Find API endpoints
  console.log('2️⃣ Searching for financial-profile endpoints...');
  const endpoints = await searcher.findEndpoints('PUT', 'financial-profile');
  console.log(`Found ${endpoints.length} endpoints\n`);
  
  // 3. Trace data flow
  console.log('3️⃣ Tracing handleLockToggle data flow...');
  const flow = await searcher.traceDataFlow('handleLockToggle');
  for (const [stage, results] of flow.entries()) {
    console.log(`  ${stage}: ${results.length} occurrences`);
  }
  
  // 4. Analyze relationships
  console.log('\n4️⃣ Analyzing optimizationVariables relationships...');
  const relationships = await searcher.analyzeRelationships('optimizationVariables');
  console.log(`  Total references: ${relationships.totalReferences}`);
  console.log(`  Definitions: ${relationships.breakdown.definitions.length}`);
  console.log(`  Usage: ${relationships.breakdown.usage.length}`);
  console.log(`  Imports: ${relationships.breakdown.imports.length}`);
  console.log(`  Exports: ${relationships.breakdown.exports.length}`);
  
  // 5. Find Monte Carlo functions
  console.log('\n5️⃣ Finding Monte Carlo simulation functions...');
  const monteCarloFuncs = await searcher.search({
    patterns: ['runRightCapitalStyleMonteCarloSimulation', 'calculateMonteCarloWithdrawalSequence'],
    fileTypes: ['ts'],
    contextLines: 5
  });
  console.log(`Found ${monteCarloFuncs.length} Monte Carlo functions`);
  
  return searcher;
}

// Interactive search interface
async function interactiveSearch(query: string) {
  const searcher = new EnhancedCodebaseSearch('/Users/bhavneesh/Desktop/affluvia/affluvia');
  
  console.log(`\n🔍 Searching for: "${query}"\n`);
  
  // Perform multi-pattern search
  const results = await searcher.parallelSearch([
    {
      patterns: [query],
      fileTypes: ['ts', 'tsx', 'js', 'jsx'],
      contextLines: 10
    },
    {
      patterns: [`function.*${query}`, `const.*${query}`, `class.*${query}`],
      fileTypes: ['ts', 'tsx'],
      contextLines: 15
    }
  ]);
  
  // Remove duplicates
  const uniqueResults = Array.from(
    new Map(results.map(r => [`${r.file}:${r.line}`, r])).values()
  );
  
  console.log(`Found ${uniqueResults.length} unique results:\n`);
  
  // Group by file
  const byFile = new Map<string, SearchResult[]>();
  for (const result of uniqueResults) {
    if (!byFile.has(result.file)) {
      byFile.set(result.file, []);
    }
    byFile.get(result.file)!.push(result);
  }
  
  // Display results
  for (const [file, fileResults] of byFile.entries()) {
    console.log(`📁 ${file}`);
    for (const result of fileResults.slice(0, 3)) {
      console.log(`  Line ${result.line}: ${result.content.trim().substring(0, 100)}...`);
    }
    if (fileResults.length > 3) {
      console.log(`  ... and ${fileResults.length - 3} more results`);
    }
    console.log('');
  }
  
  return uniqueResults;
}

// Export for use in other scripts
export { EnhancedCodebaseSearch, SearchResult, SearchConfig };

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    demonstrateSearch().catch(console.error);
  } else {
    interactiveSearch(args.join(' ')).catch(console.error);
  }
}