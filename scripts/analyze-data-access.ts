/**
 * Codebase Data Access Pattern Analyzer
 * Scans entire codebase to find data access patterns that need migration
 */

import * as fs from 'fs';
import * as path from 'path';

interface DataAccessPattern {
  file: string;
  line: number;
  pattern: string;
  collection: string;
  type: 'direct_query' | 'getDocs' | 'getDoc' | 'where_clause' | 'collection_ref';
  code: string;
  suggestedReplacement?: string;
}

interface MigrationReport {
  totalFiles: number;
  filesWithDataAccess: number;
  totalPatterns: number;
  patternsByType: Record<string, number>;
  patternsByCollection: Record<string, number>;
  patterns: DataAccessPattern[];
  priorityMigrations: DataAccessPattern[];
}

// Collections to track
const TRACKED_COLLECTIONS = [
  'copper_companies',
  'copper_people',
  'fishbowl_sales_orders',
  'fishbowl_sales_order_items',
  'users',
  'monthly_commissions',
  'commission_details',
  'customer_sales_summary',
];

// Patterns to detect
const PATTERNS = [
  {
    regex: /collection\(db,\s*['"`]([^'"`]+)['"`]\)/g,
    type: 'collection_ref' as const,
  },
  {
    regex: /getDocs\(/g,
    type: 'getDocs' as const,
  },
  {
    regex: /getDoc\(/g,
    type: 'getDoc' as const,
  },
  {
    regex: /where\(['"`]([^'"`]+)['"`],\s*['"`]==['"`],/g,
    type: 'where_clause' as const,
  },
  {
    regex: /query\(collection\(db,\s*['"`]([^'"`]+)['"`]\)/g,
    type: 'direct_query' as const,
  },
];

function scanFile(filePath: string): DataAccessPattern[] {
  const patterns: DataAccessPattern[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check each pattern
      PATTERNS.forEach(({ regex, type }) => {
        const matches = line.matchAll(new RegExp(regex.source, regex.flags));
        
        for (const match of matches) {
          const collection = match[1] || 'unknown';
          
          // Only track if it's one of our collections
          if (TRACKED_COLLECTIONS.includes(collection) || type === 'getDocs' || type === 'getDoc') {
            patterns.push({
              file: filePath,
              line: index + 1,
              pattern: type,
              collection,
              type,
              code: line.trim(),
            });
          }
        }
      });
    });
  } catch (err) {
    console.error(`Error scanning ${filePath}:`, err);
  }
  
  return patterns;
}

function scanDirectory(dir: string, patterns: DataAccessPattern[] = []): DataAccessPattern[] {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        scanDirectory(filePath, patterns);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      // Skip the relationships file itself
      if (!filePath.includes('lib/data/relationships')) {
        const filePatterns = scanFile(filePath);
        patterns.push(...filePatterns);
      }
    }
  });
  
  return patterns;
}

function generateSuggestions(pattern: DataAccessPattern): string {
  const { collection, type, code } = pattern;
  
  // Suggest replacements based on pattern
  if (collection === 'copper_companies') {
    if (code.includes('fishbowl_sales_orders') || code.includes('customerId')) {
      return 'Use: getCompanyWithOrders(companyId)';
    }
    if (code.includes('copper_people') || code.includes('company_id')) {
      return 'Use: getCompanyWithContacts(companyId)';
    }
    return 'Use: getCompanyWithAllRelations(companyId)';
  }
  
  if (collection === 'fishbowl_sales_orders') {
    if (code.includes('fishbowl_sales_order_items')) {
      return 'Use: getOrderWithLineItems(orderId)';
    }
    return 'Use: getOrderWithCustomerAndItems(orderId)';
  }
  
  if (collection === 'users') {
    return 'Use: getUserWithAssignments(userId)';
  }
  
  return 'Use: getDocumentWithRelations() or getRelated()';
}

function analyzePriority(pattern: DataAccessPattern): number {
  let priority = 0;
  
  // High priority: Direct queries with relationships
  if (pattern.type === 'direct_query') priority += 3;
  if (pattern.type === 'where_clause') priority += 2;
  
  // High priority: Critical collections
  if (pattern.collection === 'copper_companies') priority += 2;
  if (pattern.collection === 'fishbowl_sales_orders') priority += 2;
  
  // High priority: Files in main app directory
  if (pattern.file.includes('/app/')) priority += 1;
  if (pattern.file.includes('page.tsx')) priority += 1;
  
  return priority;
}

function generateReport(patterns: DataAccessPattern[]): MigrationReport {
  const filesWithDataAccess = new Set(patterns.map(p => p.file)).size;
  
  const patternsByType: Record<string, number> = {};
  const patternsByCollection: Record<string, number> = {};
  
  patterns.forEach(pattern => {
    patternsByType[pattern.type] = (patternsByType[pattern.type] || 0) + 1;
    patternsByCollection[pattern.collection] = (patternsByCollection[pattern.collection] || 0) + 1;
    
    // Add suggestion
    pattern.suggestedReplacement = generateSuggestions(pattern);
  });
  
  // Sort by priority
  const priorityMigrations = patterns
    .map(p => ({ ...p, priority: analyzePriority(p) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20);
  
  return {
    totalFiles: 0, // Will be set by caller
    filesWithDataAccess,
    totalPatterns: patterns.length,
    patternsByType,
    patternsByCollection,
    patterns,
    priorityMigrations,
  };
}

function generateMarkdownReport(report: MigrationReport): string {
  let md = '# Data Access Migration Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += '---\n\n';
  
  md += '## Summary\n\n';
  md += `- **Total Files Scanned:** ${report.totalFiles}\n`;
  md += `- **Files with Data Access:** ${report.filesWithDataAccess}\n`;
  md += `- **Total Patterns Found:** ${report.totalPatterns}\n\n`;
  
  md += '## Patterns by Type\n\n';
  Object.entries(report.patternsByType).forEach(([type, count]) => {
    md += `- **${type}:** ${count}\n`;
  });
  md += '\n';
  
  md += '## Patterns by Collection\n\n';
  Object.entries(report.patternsByCollection).forEach(([collection, count]) => {
    md += `- **${collection}:** ${count}\n`;
  });
  md += '\n';
  
  md += '---\n\n';
  md += '## Priority Migrations (Top 20)\n\n';
  md += 'These should be migrated first:\n\n';
  
  report.priorityMigrations.forEach((pattern, index) => {
    md += `### ${index + 1}. ${path.basename(pattern.file)}:${pattern.line}\n\n`;
    md += `**File:** \`${pattern.file}\`\n`;
    md += `**Collection:** \`${pattern.collection}\`\n`;
    md += `**Type:** \`${pattern.type}\`\n\n`;
    md += `**Current Code:**\n\`\`\`typescript\n${pattern.code}\n\`\`\`\n\n`;
    md += `**Suggested Replacement:**\n\`\`\`typescript\n${pattern.suggestedReplacement}\n\`\`\`\n\n`;
    md += '---\n\n';
  });
  
  md += '## All Patterns by File\n\n';
  
  const patternsByFile: Record<string, DataAccessPattern[]> = {};
  report.patterns.forEach(pattern => {
    if (!patternsByFile[pattern.file]) {
      patternsByFile[pattern.file] = [];
    }
    patternsByFile[pattern.file].push(pattern);
  });
  
  Object.entries(patternsByFile).forEach(([file, patterns]) => {
    md += `### ${file}\n\n`;
    md += `**Patterns:** ${patterns.length}\n\n`;
    patterns.forEach(pattern => {
      md += `- Line ${pattern.line}: \`${pattern.type}\` on \`${pattern.collection}\`\n`;
    });
    md += '\n';
  });
  
  return md;
}

// Main execution
function main() {
  console.log('🔍 Scanning codebase for data access patterns...\n');
  
  const projectRoot = path.resolve(__dirname, '..');
  const patterns = scanDirectory(projectRoot);
  
  // Count total files
  let totalFiles = 0;
  function countFiles(dir: string): void {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
          countFiles(filePath);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        totalFiles++;
      }
    });
  }
  countFiles(projectRoot);
  
  const report = generateReport(patterns);
  report.totalFiles = totalFiles;
  
  console.log('✅ Scan complete!\n');
  console.log(`📊 Results:`);
  console.log(`   - Total files scanned: ${report.totalFiles}`);
  console.log(`   - Files with data access: ${report.filesWithDataAccess}`);
  console.log(`   - Total patterns found: ${report.totalPatterns}\n`);
  
  // Generate markdown report
  const markdown = generateMarkdownReport(report);
  const reportPath = path.join(projectRoot, 'docs', 'migration-report.md');
  fs.writeFileSync(reportPath, markdown);
  
  console.log(`📄 Report saved to: ${reportPath}\n`);
  
  // Also save JSON for programmatic access
  const jsonPath = path.join(projectRoot, 'docs', 'migration-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  
  console.log(`📄 JSON report saved to: ${jsonPath}\n`);
}

if (require.main === module) {
  main();
}

export { scanDirectory, generateReport, generateMarkdownReport };
