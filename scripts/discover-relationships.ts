/**
 * Comprehensive Relationship Discovery
 * Scans codebase to find ALL existing field-to-field mappings
 * Discovers: where clauses, subcollections, nested queries, field references
 */

import * as fs from 'fs';
import * as path from 'path';

interface DiscoveredRelationship {
  sourceCollection: string;
  sourceField: string;
  targetCollection: string;
  targetField: string;
  type: 'where_clause' | 'subcollection' | 'field_reference' | 'nested_query';
  confidence: 'high' | 'medium' | 'low';
  locations: Array<{
    file: string;
    line: number;
    code: string;
  }>;
}

interface SubcollectionMapping {
  parentCollection: string;
  subcollectionPath: string;
  locations: Array<{
    file: string;
    line: number;
    code: string;
  }>;
}

interface DiscoveryReport {
  relationships: DiscoveredRelationship[];
  subcollections: SubcollectionMapping[];
  collections: Set<string>;
  fields: Map<string, Set<string>>; // collection -> fields
  summary: {
    totalRelationships: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    subcollectionsFound: number;
    collectionsFound: number;
  };
}

// Enhanced patterns for relationship discovery
const RELATIONSHIP_PATTERNS = [
  // where('field', '==', value) patterns
  {
    regex: /where\(['"`]([^'"`]+)['"`],\s*['"`]==?['"`],\s*([^)]+)\)/g,
    extract: (match: RegExpMatchArray, context: string) => {
      const field = match[1];
      const value = match[2].trim();
      
      // Try to find source of value (e.g., account.cf_698467)
      const valueMatch = value.match(/(\w+)\.(\w+)/);
      if (valueMatch) {
        return {
          targetField: field,
          sourceField: valueMatch[2],
          sourceHint: valueMatch[1],
        };
      }
      return { targetField: field, sourceField: null, sourceHint: null };
    },
  },
  
  // collection(db, 'collection').doc(id) patterns
  {
    regex: /collection\(db,\s*['"`]([^'"`]+)['"`]\)\.doc\(([^)]+)\)/g,
    extract: (match: RegExpMatchArray) => ({
      collection: match[1],
      idSource: match[2].trim(),
    }),
  },
  
  // Subcollection patterns: doc().collection('subcollection')
  {
    regex: /doc\([^)]+\)\.collection\(['"`]([^'"`]+)['"`]\)/g,
    extract: (match: RegExpMatchArray) => ({
      subcollection: match[1],
    }),
  },
  
  // Field access patterns: data.field or doc.field
  {
    regex: /(\w+)\.(\w+)\s*===?\s*(\w+)\.(\w+)/g,
    extract: (match: RegExpMatchArray) => ({
      leftObj: match[1],
      leftField: match[2],
      rightObj: match[3],
      rightField: match[4],
    }),
  },
];

class RelationshipDiscoverer {
  private relationships: Map<string, DiscoveredRelationship> = new Map();
  private subcollections: SubcollectionMapping[] = [];
  private collections: Set<string> = new Set();
  private fields: Map<string, Set<string>> = new Map();
  
  scanFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        this.analyzeLine(line, filePath, index + 1, content);
      });
    } catch (err) {
      console.error(`Error scanning ${filePath}:`, err);
    }
  }
  
  private analyzeLine(line: string, file: string, lineNum: number, fullContent: string): void {
    // Find collection references
    const collectionMatches = line.matchAll(/collection\(db,\s*['"`]([^'"`]+)['"`]\)/g);
    for (const match of collectionMatches) {
      this.collections.add(match[1]);
    }
    
    // Find where clauses with field relationships
    this.findWhereClauseRelationships(line, file, lineNum, fullContent);
    
    // Find subcollections
    this.findSubcollections(line, file, lineNum);
    
    // Find field comparisons
    this.findFieldComparisons(line, file, lineNum, fullContent);
    
    // Find field accesses to build field map
    this.findFieldAccesses(line, fullContent);
  }
  
  private findWhereClauseRelationships(line: string, file: string, lineNum: number, fullContent: string): void {
    // Pattern: where('targetField', '==', source.sourceField)
    const whereMatches = line.matchAll(/where\(['"`]([^'"`]+)['"`],\s*['"`]==?['"`],\s*([^)]+)\)/g);
    
    for (const match of whereMatches) {
      const targetField = match[1];
      const valueExpr = match[2].trim();
      
      // Find the collection this where clause is on
      const targetCollection = this.findCollectionInContext(line, fullContent, lineNum);
      
      // Try to extract source field
      const sourceMatch = valueExpr.match(/(\w+)\.(\w+)/);
      if (sourceMatch && targetCollection) {
        const sourceHint = sourceMatch[1];
        const sourceField = sourceMatch[2];
        
        // Try to determine source collection from variable name or context
        const sourceCollection = this.inferSourceCollection(sourceHint, fullContent, file);
        
        if (sourceCollection) {
          this.addRelationship({
            sourceCollection,
            sourceField,
            targetCollection,
            targetField,
            type: 'where_clause',
            confidence: 'high',
            file,
            line: lineNum,
            code: line.trim(),
          });
        }
      }
    }
  }
  
  private findSubcollections(line: string, file: string, lineNum: number): void {
    // Pattern: doc(id).collection('subcollection')
    const subcollectionMatches = line.matchAll(/collection\(['"`]([^'"`]+)['"`]\)\.doc\([^)]+\)\.collection\(['"`]([^'"`]+)['"`]\)/g);
    
    for (const match of subcollectionMatches) {
      const parentCollection = match[1];
      const subcollectionPath = match[2];
      
      const existing = this.subcollections.find(
        s => s.parentCollection === parentCollection && s.subcollectionPath === subcollectionPath
      );
      
      if (existing) {
        existing.locations.push({ file, line: lineNum, code: line.trim() });
      } else {
        this.subcollections.push({
          parentCollection,
          subcollectionPath,
          locations: [{ file, line: lineNum, code: line.trim() }],
        });
      }
    }
  }
  
  private findFieldComparisons(line: string, file: string, lineNum: number, fullContent: string): void {
    // Pattern: obj1.field1 === obj2.field2
    const comparisonMatches = line.matchAll(/(\w+)\.(\w+)\s*===?\s*(\w+)\.(\w+)/g);
    
    for (const match of comparisonMatches) {
      const leftObj = match[1];
      const leftField = match[2];
      const rightObj = match[3];
      const rightField = match[4];
      
      const leftCollection = this.inferSourceCollection(leftObj, fullContent, file);
      const rightCollection = this.inferSourceCollection(rightObj, fullContent, file);
      
      if (leftCollection && rightCollection && leftCollection !== rightCollection) {
        this.addRelationship({
          sourceCollection: leftCollection,
          sourceField: leftField,
          targetCollection: rightCollection,
          targetField: rightField,
          type: 'field_reference',
          confidence: 'medium',
          file,
          line: lineNum,
          code: line.trim(),
        });
      }
    }
  }
  
  private findFieldAccesses(line: string, fullContent: string): void {
    // Pattern: object.field to build field map
    const fieldMatches = line.matchAll(/(\w+)\.(\w+)/g);
    
    for (const match of fieldMatches) {
      const obj = match[1];
      const field = match[2];
      
      // Try to infer collection
      const collection = this.inferSourceCollection(obj, fullContent, '');
      if (collection) {
        if (!this.fields.has(collection)) {
          this.fields.set(collection, new Set());
        }
        this.fields.get(collection)!.add(field);
      }
    }
  }
  
  private findCollectionInContext(line: string, fullContent: string, lineNum: number): string | null {
    // Look backwards from current line to find collection reference
    const lines = fullContent.split('\n');
    for (let i = lineNum - 1; i >= Math.max(0, lineNum - 20); i--) {
      const match = lines[i].match(/collection\(db,\s*['"`]([^'"`]+)['"`]\)/);
      if (match) {
        return match[1];
      }
    }
    
    // Try to find in current line
    const match = line.match(/collection\(db,\s*['"`]([^'"`]+)['"`]\)/);
    return match ? match[1] : null;
  }
  
  private inferSourceCollection(varName: string, fullContent: string, file: string): string | null {
    // Common variable name patterns
    const patterns: Record<string, string> = {
      company: 'copper_companies',
      account: 'copper_companies',
      customer: 'copper_companies',
      order: 'fishbowl_sales_orders',
      contact: 'copper_people',
      person: 'copper_people',
      user: 'users',
      item: 'fishbowl_sales_order_items',
      commission: 'commission_details',
    };
    
    const lowerVar = varName.toLowerCase();
    for (const [key, collection] of Object.entries(patterns)) {
      if (lowerVar.includes(key)) {
        return collection;
      }
    }
    
    // Try to find variable declaration
    const declPattern = new RegExp(`(const|let|var)\\s+${varName}\\s*=.*collection\\(db,\\s*['"\`]([^'"\`]+)['"\`]\\)`, 'g');
    const match = declPattern.exec(fullContent);
    if (match) {
      return match[2];
    }
    
    // Check if it's a known collection name
    if (this.collections.has(varName)) {
      return varName;
    }
    
    return null;
  }
  
  private addRelationship(data: {
    sourceCollection: string;
    sourceField: string;
    targetCollection: string;
    targetField: string;
    type: DiscoveredRelationship['type'];
    confidence: DiscoveredRelationship['confidence'];
    file: string;
    line: number;
    code: string;
  }): void {
    const key = `${data.sourceCollection}.${data.sourceField}->${data.targetCollection}.${data.targetField}`;
    
    const existing = this.relationships.get(key);
    if (existing) {
      existing.locations.push({
        file: data.file,
        line: data.line,
        code: data.code,
      });
      // Upgrade confidence if we see it multiple times
      if (existing.locations.length > 2 && existing.confidence === 'medium') {
        existing.confidence = 'high';
      }
    } else {
      this.relationships.set(key, {
        sourceCollection: data.sourceCollection,
        sourceField: data.sourceField,
        targetCollection: data.targetCollection,
        targetField: data.targetField,
        type: data.type,
        confidence: data.confidence,
        locations: [{
          file: data.file,
          line: data.line,
          code: data.code,
        }],
      });
    }
  }
  
  scanDirectory(dir: string): void {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
          this.scanDirectory(filePath);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        this.scanFile(filePath);
      }
    });
  }
  
  generateReport(): DiscoveryReport {
    const relationships = Array.from(this.relationships.values());
    
    return {
      relationships,
      subcollections: this.subcollections,
      collections: this.collections,
      fields: this.fields,
      summary: {
        totalRelationships: relationships.length,
        highConfidence: relationships.filter(r => r.confidence === 'high').length,
        mediumConfidence: relationships.filter(r => r.confidence === 'medium').length,
        lowConfidence: relationships.filter(r => r.confidence === 'low').length,
        subcollectionsFound: this.subcollections.length,
        collectionsFound: this.collections.size,
      },
    };
  }
}

function generateMarkdownReport(report: DiscoveryReport): string {
  let md = '# Discovered Relationships Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += '**This is your CURRENT SETUP - what exists in your codebase right now**\n\n';
  md += '---\n\n';
  
  md += '## Summary\n\n';
  md += `- **Collections Found:** ${report.summary.collectionsFound}\n`;
  md += `- **Relationships Discovered:** ${report.summary.totalRelationships}\n`;
  md += `  - High Confidence: ${report.summary.highConfidence}\n`;
  md += `  - Medium Confidence: ${report.summary.mediumConfidence}\n`;
  md += `  - Low Confidence: ${report.summary.lowConfidence}\n`;
  md += `- **Subcollections Found:** ${report.summary.subcollectionsFound}\n\n`;
  
  md += '---\n\n';
  md += '## Discovered Collections\n\n';
  Array.from(report.collections).sort().forEach(collection => {
    const fields = report.fields.get(collection);
    md += `### ${collection}\n\n`;
    if (fields && fields.size > 0) {
      md += `**Fields found:** ${Array.from(fields).sort().join(', ')}\n\n`;
    }
  });
  
  md += '---\n\n';
  md += '## Discovered Relationships\n\n';
  md += '### High Confidence\n\n';
  
  report.relationships
    .filter(r => r.confidence === 'high')
    .forEach((rel, index) => {
      md += `#### ${index + 1}. ${rel.sourceCollection}.${rel.sourceField} → ${rel.targetCollection}.${rel.targetField}\n\n`;
      md += `**Type:** \`${rel.type}\`\n`;
      md += `**Found in ${rel.locations.length} location(s):**\n\n`;
      rel.locations.slice(0, 3).forEach(loc => {
        md += `- \`${loc.file}:${loc.line}\`\n`;
        md += `  \`\`\`typescript\n  ${loc.code}\n  \`\`\`\n`;
      });
      if (rel.locations.length > 3) {
        md += `- ...and ${rel.locations.length - 3} more locations\n`;
      }
      md += '\n';
    });
  
  md += '### Medium Confidence\n\n';
  report.relationships
    .filter(r => r.confidence === 'medium')
    .forEach((rel, index) => {
      md += `#### ${index + 1}. ${rel.sourceCollection}.${rel.sourceField} → ${rel.targetCollection}.${rel.targetField}\n\n`;
      md += `**Type:** \`${rel.type}\`\n`;
      md += `**Found in:** \`${rel.locations[0].file}:${rel.locations[0].line}\`\n\n`;
    });
  
  md += '---\n\n';
  md += '## Subcollections\n\n';
  report.subcollections.forEach((sub, index) => {
    md += `### ${index + 1}. ${sub.parentCollection} → ${sub.subcollectionPath}\n\n`;
    md += `**Found in ${sub.locations.length} location(s):**\n\n`;
    sub.locations.forEach(loc => {
      md += `- \`${loc.file}:${loc.line}\`\n`;
    });
    md += '\n';
  });
  
  return md;
}

function generateSchemaMapperConfig(report: DiscoveryReport): any {
  // Generate config that can be loaded into the schema mapper
  return {
    collections: Array.from(report.collections).map(name => ({
      id: name,
      name,
      fields: Array.from(report.fields.get(name) || []),
    })),
    relationships: report.relationships
      .filter(r => r.confidence === 'high' || r.confidence === 'medium')
      .map(r => ({
        id: `${r.sourceCollection}-${r.targetCollection}`,
        source: r.sourceCollection,
        target: r.targetCollection,
        sourceField: r.sourceField,
        targetField: r.targetField,
        type: r.type,
        confidence: r.confidence,
      })),
    subcollections: report.subcollections.map(s => ({
      parent: s.parentCollection,
      path: s.subcollectionPath,
    })),
  };
}

// Main execution
function main() {
  console.log('🔍 Discovering existing relationships in codebase...\n');
  console.log('This will find ALL current field-to-field mappings\n');
  
  const projectRoot = path.resolve(__dirname, '..');
  const discoverer = new RelationshipDiscoverer();
  
  console.log('📂 Scanning codebase...');
  discoverer.scanDirectory(projectRoot);
  
  console.log('📊 Generating report...');
  const report = discoverer.generateReport();
  
  console.log('\n✅ Discovery complete!\n');
  console.log(`📊 Results:`);
  console.log(`   - Collections found: ${report.summary.collectionsFound}`);
  console.log(`   - Relationships discovered: ${report.summary.totalRelationships}`);
  console.log(`   - High confidence: ${report.summary.highConfidence}`);
  console.log(`   - Medium confidence: ${report.summary.mediumConfidence}`);
  console.log(`   - Subcollections: ${report.summary.subcollectionsFound}\n`);
  
  // Save markdown report
  const markdown = generateMarkdownReport(report);
  const reportPath = path.join(projectRoot, 'docs', 'discovered-relationships.md');
  fs.writeFileSync(reportPath, markdown);
  console.log(`📄 Report saved to: ${reportPath}\n`);
  
  // Save JSON report
  const jsonPath = path.join(projectRoot, 'docs', 'discovered-relationships.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`📄 JSON saved to: ${jsonPath}\n`);
  
  // Save schema mapper config
  const config = generateSchemaMapperConfig(report);
  const configPath = path.join(projectRoot, 'docs', 'current-schema-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`📄 Schema mapper config saved to: ${configPath}\n`);
  
  console.log('🎯 Next steps:');
  console.log('   1. Review discovered-relationships.md');
  console.log('   2. Load current-schema-config.json into Schema Mapper');
  console.log('   3. Fix/update relationships on the canvas');
  console.log('   4. Save corrected schema\n');
}

if (require.main === module) {
  main();
}

export { RelationshipDiscoverer, generateMarkdownReport, generateSchemaMapperConfig };
