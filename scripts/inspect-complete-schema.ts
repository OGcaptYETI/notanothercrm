/**
 * Complete Schema Inspector
 * Queries Firestore directly to get REAL document fields
 * Then combines with code analysis to find relationships
 */

import * as fs from 'fs';
import * as path from 'path';

interface RealSchema {
  collections: Array<{
    name: string;
    documentCount: number;
    fields: Array<{
      name: string;
      type: string;
      occurrences: number;
      sampleValues: any[];
    }>;
    subcollections: string[];
  }>;
  relationships: Array<{
    source: string;
    sourceField: string;
    target: string;
    targetField: string;
    confidence: string;
    locations: string[];
  }>;
}

async function main() {
  console.log('🔍 Complete Schema Inspection\n');
  console.log('This will query Firestore directly to get REAL fields\n');
  
  const projectRoot = path.resolve(__dirname, '..');
  
  // Step 1: Get all collections from Firestore
  console.log('📂 Step 1: Fetching collections from Firestore...');
  const collectionsResponse = await fetch('http://localhost:3000/api/inspect-firestore-schema');
  
  if (!collectionsResponse.ok) {
    console.error('❌ Failed to fetch collections. Make sure dev server is running!');
    console.error('   Run: npm run dev');
    process.exit(1);
  }
  
  const collectionsData: any = await collectionsResponse.json();
  const collections = collectionsData.collections as string[];
  
  console.log(`   Found ${collections.length} collections\n`);
  
  // Step 2: Inspect each collection
  console.log('📊 Step 2: Inspecting each collection (this may take a minute)...\n');
  
  const schemasResponse = await fetch('http://localhost:3000/api/inspect-firestore-schema', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collections,
      sampleSize: 50,
    }),
  });
  
  if (!schemasResponse.ok) {
    console.error('❌ Failed to inspect collections');
    process.exit(1);
  }
  
  const schemasData: any = await schemasResponse.json();
  
  console.log('\n✅ Schema inspection complete!\n');
  
  // Step 3: Load code analysis relationships
  console.log('📂 Step 3: Loading code analysis...');
  const codeAnalysisPath = path.join(projectRoot, 'docs', 'discovered-relationships.json');
  let codeRelationships = [];
  
  if (fs.existsSync(codeAnalysisPath)) {
    const codeData = JSON.parse(fs.readFileSync(codeAnalysisPath, 'utf-8'));
    codeRelationships = codeData.relationships || [];
    console.log(`   Found ${codeRelationships.length} relationships from code\n`);
  }
  
  // Step 4: Combine and generate report
  console.log('📊 Step 4: Generating complete schema report...\n');
  
  const completeSchema: RealSchema = {
    collections: schemasData.schemas,
    relationships: codeRelationships.map((rel: any) => ({
      source: rel.sourceCollection,
      sourceField: rel.sourceField,
      target: rel.targetCollection,
      targetField: rel.targetField,
      confidence: rel.confidence,
      locations: rel.locations.map((loc: any) => `${loc.file}:${loc.line}`),
    })),
  };
  
  // Generate markdown report
  let md = '# Complete Firestore Schema Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += '**This shows REAL Firestore document fields from your database**\n\n';
  md += '---\n\n';
  
  md += '## Summary\n\n';
  md += `- **Collections:** ${completeSchema.collections.length}\n`;
  md += `- **Total Documents:** ${completeSchema.collections.reduce((sum, col) => sum + col.documentCount, 0)}\n`;
  md += `- **Relationships Found:** ${completeSchema.relationships.length}\n\n`;
  
  md += '---\n\n';
  md += '## Collections\n\n';
  
  completeSchema.collections.forEach(collection => {
    md += `### ${collection.name}\n\n`;
    md += `**Documents:** ${collection.documentCount}\n`;
    md += `**Fields:** ${collection.fields.length}\n`;
    
    if (collection.subcollections.length > 0) {
      md += `**Subcollections:** ${collection.subcollections.join(', ')}\n`;
    }
    
    md += '\n#### Fields\n\n';
    md += '| Field | Type | Occurrences | Sample Value |\n';
    md += '|-------|------|-------------|-------------|\n';
    
    collection.fields.forEach(field => {
      const sample = field.sampleValues[0] || '';
      const sampleStr = typeof sample === 'string' ? sample.substring(0, 50) : JSON.stringify(sample).substring(0, 50);
      md += `| \`${field.name}\` | ${field.type} | ${field.occurrences} | ${sampleStr} |\n`;
    });
    
    md += '\n';
  });
  
  md += '---\n\n';
  md += '## Discovered Relationships\n\n';
  
  if (completeSchema.relationships.length === 0) {
    md += '*No explicit relationships found in code. Use the Visual Schema Mapper to define them.*\n\n';
  } else {
    completeSchema.relationships.forEach((rel, index) => {
      md += `### ${index + 1}. ${rel.source}.${rel.sourceField} → ${rel.target}.${rel.targetField}\n\n`;
      md += `**Confidence:** ${rel.confidence}\n\n`;
      md += `**Found in:**\n`;
      rel.locations.forEach(loc => {
        md += `- \`${loc}\`\n`;
      });
      md += '\n';
    });
  }
  
  // Save reports to docs (for reference)
  const reportPath = path.join(projectRoot, 'docs', 'complete-schema.md');
  fs.writeFileSync(reportPath, md);
  console.log(`📄 Report saved to: ${reportPath}\n`);
  
  const jsonPath = path.join(projectRoot, 'docs', 'complete-schema.json');
  fs.writeFileSync(jsonPath, JSON.stringify(completeSchema, null, 2));
  console.log(`📄 JSON saved to: ${jsonPath}\n`);
  
  // Generate schema mapper config
  const mapperConfig = {
    collections: completeSchema.collections.map(col => ({
      id: col.name,
      name: col.name,
      documentCount: col.documentCount,
      fields: col.fields.map(f => ({
        name: f.name,
        type: f.type,
        sampleValue: f.sampleValues[0],
      })),
      subcollections: col.subcollections,
    })),
    relationships: completeSchema.relationships,
  };
  
  // Save to PUBLIC folder so it's web-accessible
  const publicPath = path.join(projectRoot, 'public', 'schema-mapper-config.json');
  fs.writeFileSync(publicPath, JSON.stringify(mapperConfig, null, 2));
  console.log(`📄 Schema Mapper config saved to: ${publicPath} (web-accessible)\n`);
  
  console.log('✅ Complete schema inspection finished!\n');
  console.log('📊 Statistics:');
  completeSchema.collections.forEach(col => {
    console.log(`   - ${col.name}: ${col.documentCount} docs, ${col.fields.length} fields`);
  });
  
  console.log('\n🎯 Next steps:');
  console.log('   1. Review complete-schema.md');
  console.log('   2. Load schema-mapper-config.json into Visual Schema Mapper');
  console.log('   3. Define missing relationships on the canvas');
  console.log('   4. Save and implement corrected schema\n');
  
  // Initialize schema in Firestore DB
  console.log('📤 Initializing schema in Firestore DB...');
  try {
    const initResponse = await fetch('http://localhost:3000/api/schema-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapperConfig),
    });
    
    if (initResponse.ok) {
      const result: any = await initResponse.json();
      console.log(`✅ Schema saved to Firestore!`);
      console.log(`   - ${result.stats?.collections || 0} collections`);
      console.log(`   - ${result.stats?.relationships || 0} relationships`);
      console.log(`   - ${result.stats?.nodes || 0} nodes auto-positioned\n`);
      console.log('🎨 Open Visual Schema Mapper to see your schema with relationships!\n');
    } else {
      console.error('⚠️  Failed to initialize DB. Schema saved to files only.');
    }
  } catch (err) {
    console.error('⚠️  Could not connect to API. Make sure dev server is running.');
    console.error('   Schema saved to files. You can manually load it later.\n');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
