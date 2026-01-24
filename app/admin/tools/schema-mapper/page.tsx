'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  Panel,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GitBranch, Save, Upload, Download, Trash2, Maximize2, Link2, Plus, Database, Code, FileCode } from 'lucide-react';
import { CollectionNode } from './components/CollectionNode';
import { CustomOffsetEdge } from './components/CustomEdge';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes: NodeTypes = {
  collectionNode: CollectionNode,
};

const edgeTypes = {
  customOffset: CustomOffsetEdge,
};

function SchemaMapperContent() {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [allCollections, setAllCollections] = useState<any[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collectionFields, setCollectionFields] = useState<Record<string, any[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [selectedFields, setSelectedFields] = useState<Array<{collectionId: string, fieldName: string, collectionName: string}>>([]);
  
  // Right panel state for collection properties (Salesforce-style schema builder)
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [collectionMetadata, setCollectionMetadata] = useState<Record<string, {
    primaryKey?: string;
    description?: string;
    fieldMetadata?: Record<string, {
      type: 'string' | 'number' | 'boolean' | 'timestamp' | 'reference' | 'array' | 'map' | 'geopoint';
      required?: boolean;
      unique?: boolean;
      referenceTarget?: { collection: string; field: string };
      validation?: { min?: number; max?: number; regex?: string };
    }>;
  }>>({});

  // Handle field click for selection - MUST BE DEFINED BEFORE loadCompleteSchema
  const handleFieldClick = useCallback((collectionId: string, fieldName: string, collectionName: string) => {
    console.log('✅ handleFieldClick called:', { collectionId, fieldName, collectionName });
    setSelectedFields(prev => {
      // If clicking same field, deselect it
      const existing = prev.find(f => f.collectionId === collectionId && f.fieldName === fieldName);
      if (existing) {
        console.log('🔄 Deselecting field');
        return prev.filter(f => !(f.collectionId === collectionId && f.fieldName === fieldName));
      }
      
      // If already have 2 fields selected, replace the oldest
      if (prev.length >= 2) {
        console.log('🔄 Replacing oldest selection (max 2 fields)');
        return [prev[1], { collectionId, fieldName, collectionName }];
      }
      
      // Add new selection
      console.log('➕ Adding field to selection. Total selected:', prev.length + 1);
      return [...prev, { collectionId, fieldName, collectionName }];
    });
  }, []);

  const loadCompleteSchema = useCallback(async () => {
    setLoading(true);
    try {
      // Load schema from Firestore DB (production-ready)
      const response = await fetch('/api/schema-config');
      if (response.ok) {
        const result = await response.json();
        const config = result.schema;
        
        console.log('📊 Schema loaded from Firestore:', {
          collections: config.collections?.length,
          nodes: config.nodes?.length,
          edges: config.edges?.length,
          relationships: config.relationships?.length,
        });
        console.log('🔍 Raw first collection from API:', config.collections[0]);
        
        // Transform to collection list format
        const collections = config.collections.map((col: any) => ({
          id: col.id,
          name: col.name || col.id,
          countNote: `${col.documentCount || 0} docs`,
          fieldCount: col.fields?.length || 0,
          fields: col.fields || [],
          subcollections: col.subcollections || [],
        }));
        
        setAllCollections(collections);
        console.log('✅ Collections loaded for sidebar:', collections.length);
        console.log('📋 First 3 collections data:', collections.slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          countNote: c.countNote,
        })));
        
        // Pre-load field data for all collections
        const fieldsMap: Record<string, any[]> = {};
        config.collections.forEach((col: any) => {
          if (col.fields) {
            fieldsMap[col.id] = col.fields.map((f: any) => ({
              fieldName: f.name,
              type: f.type,
              sampleValues: f.sampleValue ? [f.sampleValue] : [],
              isLookup: KNOWN_LOOKUPS[col.id]?.[f.name] !== undefined,
              lookupTarget: KNOWN_LOOKUPS[col.id]?.[f.name],
            }));
          }
        });
        setCollectionFields(fieldsMap);
        
        // Auto-load nodes and edges from saved schema - EACH RELATIONSHIP GETS ITS OWN EDGE WITH VISUAL OFFSET
        if (config.edges && config.edges.length > 0) {
          // Group edges by source-target pair to calculate offsets
          const edgeGroups = new Map<string, number>();
          const edgeCounters = new Map<string, number>();
          
          // First pass: count how many edges between each pair
          config.edges.forEach((edge: any) => {
            const key = `${edge.source}-${edge.target}`;
            edgeGroups.set(key, (edgeGroups.get(key) || 0) + 1);
            edgeCounters.set(key, 0);
          });
          
          // Color palette for multiple relationships
          const edgeColors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
          
          // Load edges with labels, colors, and offsets for visual separation
          const loadedEdges = config.edges.map((edge: any, index: number) => {
            const key = `${edge.source}-${edge.target}`;
            const totalEdges = edgeGroups.get(key) || 1;
            const edgeIndex = edgeCounters.get(key) || 0;
            edgeCounters.set(key, edgeIndex + 1);
            
            // Calculate offset for multiple edges between same nodes
            const offset = totalEdges > 1 ? (edgeIndex - (totalEdges - 1) / 2) * 50 : 0;
            const color = edgeColors[edgeIndex % edgeColors.length];
            
            // Use different stroke patterns to visually distinguish edges
            const strokePatterns = ['', '5,5', '10,5', '15,5', '5,10', '3,3'];
            const strokeDasharray = strokePatterns[edgeIndex % strokePatterns.length];
            
            return {
              ...edge,
              id: edge.id || `edge-${index}-${edge.source}-${edge.target}`, // Unique ID for each relationship
              type: 'customOffset', // Use custom edge for offset support
              animated: edgeIndex % 2 === 0, // Alternate animation for visual distinction
              label: edge.data?.label || `${edge.data?.sourceField || '?'} → ${edge.data?.targetField || '?'}`,
              labelStyle: { fill: color, fontWeight: 600, fontSize: 12 },
              labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.95 },
              labelBgPadding: [6, 3] as [number, number],
              labelBgBorderRadius: 3,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: color,
              },
              style: {
                strokeWidth: 3,
                stroke: color,
                strokeDasharray: strokeDasharray,
              },
              // Add path offset for visual separation when multiple edges exist
              data: {
                ...edge.data,
                offset: offset,
              },
            };
          });
          setEdges(loadedEdges);
          console.log(`✅ Loaded ${loadedEdges.length} relationship edges (each relationship is a separate line with unique color)`);
          
          // Get unique collection IDs that are part of relationships
          const collectionsWithRelationships = new Set<string>();
          config.edges.forEach((edge: any) => {
            collectionsWithRelationships.add(edge.source);
            collectionsWithRelationships.add(edge.target);
          });
          
          // Load nodes with relationships and attach field data AND HANDLERS
          if (config.nodes && config.nodes.length > 0) {
            const filteredNodes = config.nodes
              .filter((node: any) => collectionsWithRelationships.has(node.id))
              .map((node: any) => {
                // Find the collection data to get correct doc count
                const collectionData = collections.find((c: any) => c.id === node.id);
                return {
                  ...node,
                  data: {
                    ...node.data,
                    label: node.id,
                    collectionName: node.id,
                    documentCount: collectionData?.countNote || node.data.documentCount || '0 docs',
                    fields: fieldsMap[node.id] || node.data.fields || [],
                    expanded: false, // Always start collapsed
                    connectedFields: node.data.connectedFields || [],
                    selectedFields: [],
                    onFieldClick: handleFieldClick, // ADD HANDLER HERE
                  },
                };
              });
            
            setNodes(filteredNodes);
            console.log(`✅ Loaded ${filteredNodes.length} collection nodes with relationships`);
            console.log(`✅ All nodes now have onFieldClick handler attached`);
          }
        } else {
          console.log('⚠️ No relationships found in schema. Canvas will be empty.');
          console.log('   Add collections to canvas and create relationships to get started.');
        }
        
        console.log(`✅ Schema load complete. Last updated: ${result.lastUpdated || 'Never'}`);
        
        // Auto-detect if schema needs re-initialization (all collections have 0 docs)
        const needsRefresh = collections.every((c: any) => c.countNote === '0 docs');
        if (needsRefresh && collections.length > 0) {
          console.warn('⚠️ Schema has invalid data (all 0 docs). Run: npm run inspect-schema');
        }
      } else {
        console.error('❌ Schema not found in Firestore DB');
        console.error('   Run: npm run inspect-schema to initialize');
      }
    } catch (err) {
      console.error('❌ Error loading schema:', err);
      console.error('   Make sure dev server is running');
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  // Load complete schema from inspection on mount
  useEffect(() => {
    loadCompleteSchema();
  }, [loadCompleteSchema]);

  // Schema-based lookup detection
  const KNOWN_LOOKUPS: Record<string, Record<string, string>> = {
    copper_companies: {
      cf_698467: 'fishbowl_sales_orders.customerId',
      id: 'copper_people.company_id',
      assignee_id: 'users.copper_user_id',
    },
    copper_people: {
      company_id: 'copper_companies.id',
      assignee_id: 'users.copper_user_id',
    },
    fishbowl_sales_orders: {
      customerId: 'copper_companies.cf_698467',
      salesRep: 'users.email',
    },
    fishbowl_sales_order_items: {
      orderId: 'fishbowl_sales_orders.id',
    },
  };

  // Fields are pre-loaded from schema config, just update node when added
  const loadCollectionFields = async (collectionName: string) => {
    // Fields already loaded from schema config
    if (collectionFields[collectionName]) {
      // Update node with field data
      setNodes((nds) =>
        nds.map((node) =>
          node.id === collectionName
            ? { ...node, data: { ...node.data, fields: collectionFields[collectionName] } }
            : node
        )
      );
    }
  };

  // Track connected fields for highlighting
  const getConnectedFields = useCallback(() => {
    const connected: Record<string, string[]> = {};
    edges.forEach(edge => {
      const sourceField = edge.data?.sourceField || edge.data?.fromField;
      const targetField = edge.data?.targetField || edge.data?.toField;
      
      if (sourceField) {
        if (!connected[edge.source]) connected[edge.source] = [];
        if (!connected[edge.source].includes(sourceField)) {
          connected[edge.source].push(sourceField);
        }
      }
      
      if (targetField) {
        if (!connected[edge.target]) connected[edge.target] = [];
        if (!connected[edge.target].includes(targetField)) {
          connected[edge.target].push(targetField);
        }
      }
    });
    return connected;
  }, [edges]);

  // Update connected fields after edge creation
  const updateConnectedFieldsForNodes = React.useCallback(() => {
    const connected: Record<string, string[]> = {};
    edges.forEach(edge => {
      const sourceField = edge.data?.sourceField || edge.data?.fromField;
      const targetField = edge.data?.targetField || edge.data?.toField;
      
      if (sourceField) {
        if (!connected[edge.source]) connected[edge.source] = [];
        if (!connected[edge.source].includes(sourceField)) {
          connected[edge.source].push(sourceField);
        }
      }
      
      if (targetField) {
        if (!connected[edge.target]) connected[edge.target] = [];
        if (!connected[edge.target].includes(targetField)) {
          connected[edge.target].push(targetField);
        }
      }
    });
    
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          connectedFields: connected[node.id] || [],
        },
      }))
    );
  }, [edges]);


  // Handle field drag-and-drop to create relationships
  const handleFieldDrop = useCallback((targetField: string, dragData: any) => {
    const sourceCollectionId = dragData.collectionId;
    const sourceField = dragData.fieldName;
    const targetCollectionId = nodes.find(n => 
      n.data.fields?.some((f: any) => f.fieldName === targetField)
    )?.id;
    
    if (!targetCollectionId || sourceCollectionId === targetCollectionId) return;
    
    // Create new edge
    const newEdge: Edge = {
      id: `${sourceCollectionId}-${targetCollectionId}-${Date.now()}`,
      source: sourceCollectionId,
      target: targetCollectionId,
      type: 'smoothstep',
      animated: true,
      label: `${sourceField} → ${targetField}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      data: {
        sourceField,
        targetField,
        fromField: sourceField,
        toField: targetField,
        type: '1:many',
      },
      style: {
        stroke: '#4F46E5',
        strokeWidth: 2,
      },
    };
    
    setEdges((eds) => {
      const newEdges = [...eds, newEdge];
      // Update connected fields after adding edge
      setTimeout(() => updateConnectedFieldsForNodes(), 0);
      return newEdges;
    });
    console.log(`✅ Created relationship: ${sourceCollectionId}.${sourceField} → ${targetCollectionId}.${targetField}`);
  }, [nodes, setEdges, updateConnectedFieldsForNodes]);

  // Create relationship from selected fields
  const createRelationshipFromSelection = useCallback(() => {
    if (selectedFields.length !== 2) return;
    
    const [parent, child] = selectedFields;
    
    // Create new edge (parent -> child)
    const newEdge: Edge = {
      id: `${parent.collectionId}-${child.collectionId}-${Date.now()}`,
      source: parent.collectionId,
      target: child.collectionId,
      type: 'smoothstep',
      animated: true,
      label: `${parent.fieldName} → ${child.fieldName}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      data: {
        sourceField: parent.fieldName,
        targetField: child.fieldName,
        fromField: parent.fieldName,
        toField: child.fieldName,
        type: '1:many',
        parentCollection: parent.collectionName,
        childCollection: child.collectionName,
      },
      style: {
        stroke: '#4F46E5',
        strokeWidth: 2,
      },
    };
    
    setEdges((eds) => [...eds, newEdge]);
    setSelectedEdge(newEdge);
    setShowRelationshipModal(true);
    setSelectedFields([]); // Clear selection
    
    console.log(`✅ Created relationship: ${parent.collectionName}.${parent.fieldName} (PARENT) → ${child.collectionName}.${child.fieldName} (CHILD)`);
  }, [selectedFields, setEdges]);

  // Add collection to canvas
  const addCollectionToCanvas = async (collection: any) => {
    const connectedFields = getConnectedFields();
    
    const newNode: Node = {
      id: collection.id,
      type: 'collectionNode',
      position: { 
        x: Math.random() * 500 + 100, 
        y: Math.random() * 300 + 100 
      },
      data: {
        label: collection.id,
        collectionName: collection.id,
        documentCount: collection.countNote,
        fields: [],
        expanded: false,
        connectedFields: connectedFields[collection.id] || [],
        onFieldClick: handleFieldClick,
        selectedFields: selectedFields,
      },
      style: {
        width: 320,
        height: 400,
      },
    };

    // Fields are already loaded from schema config
    if (collectionFields[collection.id]) {
      newNode.data.fields = collectionFields[collection.id];
    }
    
    setNodes((nds) => [...nds, newNode]);
  };

  // Handle edge click to edit relationship
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    console.log('📌 Edge clicked:', edge);
    setSelectedEdge(edge);
    setShowRelationshipModal(true);
  }, []);

  // Add onFieldClick handler to nodes when they're first loaded
  const [handlersAdded, setHandlersAdded] = useState(false);
  
  useEffect(() => {
    if (nodes.length === 0 || handlersAdded) return;
    
    console.log('🔄 Adding onFieldClick handler to', nodes.length, 'nodes');
    
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onFieldClick: handleFieldClick,
          selectedFields: [],
        },
      }))
    );
    
    setHandlersAdded(true);
  }, [nodes.length, handlersAdded, handleFieldClick, setNodes]);
  
  // Update selectedFields in all nodes when selection changes
  useEffect(() => {
    if (!handlersAdded || nodes.length === 0) return;
    
    console.log('🔄 Updating selectedFields in nodes:', selectedFields.length);
    
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selectedFields: selectedFields,
        },
      }))
    );
  }, [selectedFields, handlersAdded, nodes.length, setNodes]);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const newEdge: Edge = {
        id: `${params.source}-${params.target}`,
        source: params.source,
        target: params.target,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        data: {
          type: '1:many',
          fromField: '',
          toField: '',
        },
        style: {
          stroke: '#4F46E5',
          strokeWidth: 2,
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      setSelectedEdge(newEdge);
      setShowRelationshipModal(true);
    },
    [setEdges]
  );

  // Update relationship
  const updateRelationship = (edgeId: string, updates: any) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          const newType = updates.type || edge.data?.type || '1:many';
          const label = updates.fromField && updates.toField 
            ? `${updates.fromField} → ${updates.toField}`
            : newType;

          return {
            ...edge,
            data: { ...edge.data, ...updates },
            label,
            style: {
              ...edge.style,
              stroke: newType === '1:1' ? '#10B981' : newType === '1:many' ? '#4F46E5' : '#F59E0B',
            },
          };
        }
        return edge;
      })
    );
  };

  // Update collection metadata (Salesforce-style)
  const updateCollectionMetadata = (collectionId: string, updates: Partial<typeof collectionMetadata[string]>) => {
    setCollectionMetadata(prev => ({
      ...prev,
      [collectionId]: {
        primaryKey: updates.primaryKey !== undefined ? updates.primaryKey : prev[collectionId]?.primaryKey,
        description: updates.description !== undefined ? updates.description : prev[collectionId]?.description,
        fieldMetadata: updates.fieldMetadata || prev[collectionId]?.fieldMetadata || {},
      }
    }));
  };

  // Update field metadata
  const updateFieldMetadata = (collectionId: string, fieldName: string, updates: Partial<NonNullable<typeof collectionMetadata[string]['fieldMetadata']>[string]>) => {
    const metadata = collectionMetadata[collectionId] || { fieldMetadata: {} };
    const fieldMetadata = metadata.fieldMetadata || {};
    
    setCollectionMetadata(prev => ({
      ...prev,
      [collectionId]: {
        ...prev[collectionId],
        fieldMetadata: {
          ...fieldMetadata,
          [fieldName]: {
            ...fieldMetadata[fieldName],
            ...updates,
          }
        }
      }
    }));
  };

  // Code Generation Functions
  const generateTypeScriptInterfaces = () => {
    let code = `// 🤖 AUTO-GENERATED - DO NOT EDIT\n// Generated from Firebase Schema Builder on ${new Date().toISOString()}\n\n`;
    
    // Generate interface for each collection
    allCollections.forEach((collection: any) => {
      const fields = collectionFields[collection.id] || [];
      const metadata = collectionMetadata[collection.id];
      const description = metadata?.description || `${collection.name} collection`;
      
      code += `/**\n * ${description}\n */\n`;
      code += `export interface ${toPascalCase(collection.name)} {\n`;
      
      fields.forEach((field: any) => {
        const fieldMeta = metadata?.fieldMetadata?.[field.fieldName];
        const type = fieldMeta?.type || field.type || 'string';
        const required = fieldMeta?.required ? '' : '?';
        const tsType = mapFirestoreTypeToTS(type);
        
        code += `  ${field.fieldName}${required}: ${tsType};\n`;
      });
      
      code += `}\n\n`;
    });
    
    return code;
  };
  
  const generateRelationshipHelpers = () => {
    let code = `// 🤖 AUTO-GENERATED - DO NOT EDIT\n// Generated from Firebase Schema Builder on ${new Date().toISOString()}\n\n`;
    code += `import { db } from '@/lib/firebase';\n`;
    code += `import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';\n`;
    
    // Import all interfaces
    const interfaceNames = allCollections.map((col: any) => toPascalCase(col.name)).join(', ');
    code += `import type { ${interfaceNames} } from './types';\n\n`;
    
    code += `export class SchemaHelper {\n`;
    
    // Generate helper methods for each relationship
    edges.forEach((edge: any) => {
      const sourceCollection = allCollections.find((c: any) => c.id === edge.source);
      const targetCollection = allCollections.find((c: any) => c.id === edge.target);
      
      if (!sourceCollection || !targetCollection) return;
      
      const sourceType = toPascalCase(edge.source);
      const targetType = toPascalCase(edge.target);
      const fromField = edge.data?.fromField || edge.data?.sourceField || '';
      const toField = edge.data?.toField || edge.data?.targetField || 'id';
      const relType = edge.data?.type || '1:many';
      
      if (!fromField) return;
      
      // Generate getter method
      const methodName = `get${targetType}For${sourceType}`;
      
      if (relType === '1:1' || relType === '1:many') {
        code += `\n  /**\n   * Get related ${edge.target} for ${edge.source}\n   * Relationship: ${edge.source}.${fromField} → ${edge.target}.${toField}\n   */\n`;
        code += `  static async ${methodName}(${toCamelCase(edge.source)}Id: string) {\n`;
        code += `    const ${toCamelCase(edge.source)}Doc = await getDoc(doc(db, '${edge.source}', ${toCamelCase(edge.source)}Id));\n`;
        code += `    if (!${toCamelCase(edge.source)}Doc.exists()) return null;\n`;
        code += `    const ${toCamelCase(edge.source)} = ${toCamelCase(edge.source)}Doc.data() as ${sourceType};\n`;
        code += `    const ${fromField} = ${toCamelCase(edge.source)}.${fromField};\n`;
        code += `    if (!${fromField}) return null;\n`;
        code += `    const ${toCamelCase(edge.target)}Doc = await getDoc(doc(db, '${edge.target}', ${fromField} as string));\n`;
        code += `    return ${toCamelCase(edge.target)}Doc.exists() ? ${toCamelCase(edge.target)}Doc.data() as ${targetType} : null;\n`;
        code += `  }\n`;
      }
    });
    
    code += `}\n`;
    
    return code;
  };
  
  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const generateAllCode = () => {
    // Generate types.ts
    const typesCode = generateTypeScriptInterfaces();
    downloadFile('schema-types.ts', typesCode);
    
    // Generate helpers.ts
    const helpersCode = generateRelationshipHelpers();
    downloadFile('schema-helpers.ts', helpersCode);
    
    alert('✅ Code generated! Check your downloads folder for:\n\n• schema-types.ts\n• schema-helpers.ts\n\nImport these files into your project to use the generated schema.');
  };
  
  // Helper functions for code generation
  const toPascalCase = (str: string) => {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  };
  
  const toCamelCase = (str: string) => {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  };
  
  const mapFirestoreTypeToTS = (type: string): string => {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'timestamp': 'Date',
      'reference': 'string',
      'array': 'any[]',
      'map': 'Record<string, any>',
      'geopoint': '{ latitude: number; longitude: number }',
    };
    return typeMap[type] || 'any';
  };

  // Autosave function (silent save without alerts)
  const autoSave = useCallback(async () => {
    if (nodes.length === 0 && edges.length === 0) return; // Don't save empty schema
    
    setAutoSaving(true);
    try {
      const schemaData = {
        collections: allCollections,
        relationships: edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          sourceField: edge.data?.sourceField || edge.data?.fromField || '',
          targetField: edge.data?.targetField || edge.data?.toField || '',
          relationshipType: edge.data?.type || '1:many',
        })),
        nodes,
        edges,
        collectionMetadata, // Include field metadata for code generation
      };
      
      const response = await fetch('/api/schema-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schemaData),
      });
      
      if (response.ok) {
        setLastSaved(new Date());
        console.log('💾 Autosaved at', new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Autosave error:', err);
    } finally {
      setAutoSaving(false);
    }
  }, [nodes, edges, allCollections, collectionMetadata]);

  // Autosave on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      autoSave();
    }, 2000); // Save 2 seconds after last change
    
    return () => clearTimeout(timer);
  }, [nodes, edges, autoSave]);

  // Save schema configuration to Firestore DB (manual save with alert)
  const saveSchema = async () => {
    setLoading(true);
    try {
      const schemaData = {
        collections: allCollections,
        relationships: edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          sourceField: edge.data?.sourceField || edge.data?.fromField || '',
          targetField: edge.data?.targetField || edge.data?.toField || '',
          relationshipType: edge.data?.type || '1:many',
        })),
        nodes,
        edges,
      };
      
      const response = await fetch('/api/schema-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schemaData),
      });
      
      if (response.ok) {
        const result = await response.json();
        setLastSaved(new Date());
        alert(`✅ Schema saved to Firestore!\n\nLast updated: ${result.lastUpdated}`);
        console.log('✅ Schema saved successfully');
      } else {
        alert('❌ Failed to save schema');
      }
    } catch (err) {
      console.error('Error saving schema:', err);
      alert('❌ Error saving schema. Check console.');
    } finally {
      setLoading(false);
    }
  };

  // Load schema configuration
  const loadSchema = () => {
    const saved = localStorage.getItem('schema-mapper-config');
    if (saved) {
      const schema = JSON.parse(saved);
      setNodes(schema.nodes || []);
      setEdges(schema.edges || []);
      alert('Schema loaded successfully!');
    } else {
      alert('No saved schema found');
    }
  };

  // Export schema as JSON
  const exportSchema = () => {
    const schema = {
      nodes,
      edges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firestore-schema.json';
    a.click();
  };

  // Clear canvas
  const clearCanvas = () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
      setNodes([]);
      setEdges([]);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Schema Editor</h1>
              <p className="text-sm text-gray-500">
                Drag fields to create relationships between collections
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Autosave Indicator */}
            <div className="flex items-center gap-2 text-sm">
              {autoSaving ? (
                <span className="text-blue-600 flex items-center gap-1">
                  <span className="animate-spin">💾</span>
                  Saving...
                </span>
              ) : lastSaved ? (
                <span className="text-green-600 flex items-center gap-1">
                  ✓ Saved {new Date(lastSaved).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
            
            <div className="flex items-center gap-2">
            <button
              onClick={generateAllCode}
              disabled={allCollections.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Generate TypeScript code from schema"
            >
              <Code className="w-4 h-4" />
              Generate Code
            </button>
            <button
              onClick={saveSchema}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={exportSchema}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Collections Sidebar - Collapsible */}
        <div className={`${sidebarCollapsed ? 'w-12' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Collections ({allCollections.length})
                  </h2>
                  <button
                    onClick={loadCompleteSchema}
                    disabled={loading}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {loading ? '...' : 'Refresh'}
                  </button>
                </>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1 hover:bg-gray-100 rounded text-sm"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? '→' : '←'}
              </button>
            </div>
          </div>

          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-1.5" key={`collections-${allCollections.length}`}>
              {allCollections.map((collection) => {
                const isOnCanvas = nodes.some((node) => node.id === collection.id);
                return (
                  <div
                    key={collection.id}
                    onClick={() => setSelectedCollection(collection)}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedCollection?.id === collection.id
                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                        : isOnCanvas
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs font-medium text-gray-900 truncate">
                          {collection.name}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          {collection.countNote}
                          {collectionMetadata[collection.id]?.type === 'fact' && (
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">📊 Fact</span>
                          )}
                          {collectionMetadata[collection.id]?.type === 'dimension' && (
                            <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">📁 Dim</span>
                          )}
                        </div>
                      </div>
                      {!isOnCanvas && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addCollectionToCanvas(collection);
                          }}
                          className="ml-2 p-1 text-indigo-600 hover:bg-indigo-100 rounded"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={handleEdgeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
            
            <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-md">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Relationships ({edges.length})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {edges.map((edge, idx) => {
                    const color = edge.style?.stroke || '#4F46E5';
                    return (
                      <div
                        key={edge.id}
                        onClick={() => handleEdgeClick({} as React.MouseEvent, edge)}
                        className="p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                        style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                      >
                        <div className="text-xs font-medium text-gray-900">
                          {edge.label || `${edge.source} → ${edge.target}`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {edge.source} → {edge.target}
                        </div>
                        {edge.data?.type && (
                          <div className="text-xs text-gray-400 mt-1">
                            Type: {edge.data.type}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {edges.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">
                      No relationships yet. Click fields to create one.
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            {/* Create Relationship Button - Shows when 2 fields selected */}
            {selectedFields.length === 2 && (
              <Panel position="top-center">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg shadow-2xl border-2 border-white">
                  <div className="text-xs mb-1 opacity-90">
                    {selectedFields[0].collectionName}.{selectedFields[0].fieldName} → {selectedFields[1].collectionName}.{selectedFields[1].fieldName}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={createRelationshipFromSelection}
                      className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      Create Relationship
                    </button>
                    <button
                      onClick={() => setSelectedFields([])}
                      className="text-white hover:bg-white/20 px-3 py-2 rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Panel>
            )}

            {/* Center View Button */}
            <Panel position="bottom-right" className="mb-24">
              <button
                onClick={() => fitView({ padding: 0.2, duration: 400 })}
                className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                title="Center and fit all nodes"
              >
                <Maximize2 className="w-5 h-5 text-gray-700" />
              </button>
            </Panel>
          </ReactFlow>

          {/* Stats Panel */}
          <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">
                  {nodes.length} Collections
                </span>
              </div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">
                  {edges.length} Relationships
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">
                  {edges.filter(e => e.data?.fromField && e.data?.toField).length} Field Mappings
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Field Type Editor (Salesforce Schema Builder Style) */}
        {selectedCollection && (
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Schema Definition
                </h2>
                <button
                  onClick={() => setSelectedCollection(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="font-mono text-xs font-medium text-indigo-600">
                {selectedCollection.name}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {selectedCollection.countNote}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Collection Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  📝 Description
                </label>
                <textarea
                  value={collectionMetadata[selectedCollection.id]?.description || ''}
                  onChange={(e) => updateCollectionMetadata(selectedCollection.id, { description: e.target.value })}
                  placeholder="What is this collection for?"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>

              {/* Primary Key */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  🔑 Primary Key Field
                </label>
                <select
                  value={collectionMetadata[selectedCollection.id]?.primaryKey || ''}
                  onChange={(e) => updateCollectionMetadata(selectedCollection.id, { primaryKey: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select primary key...</option>
                  {(collectionFields[selectedCollection.id] || []).map((field: any) => (
                    <option key={field.fieldName} value={field.fieldName}>
                      {field.fieldName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Unique identifier for documents in this collection
                </p>
              </div>

              {/* Fields List with Type Editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-900">
                    � Fields ({(collectionFields[selectedCollection.id] || []).length})
                  </label>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(collectionFields[selectedCollection.id] || []).map((field: any) => {
                    const fieldMeta = collectionMetadata[selectedCollection.id]?.fieldMetadata?.[field.fieldName] || {};
                    const isReference = fieldMeta.type === 'reference';
                    
                    return (
                      <div key={field.fieldName} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-xs font-semibold text-gray-900 flex-1">
                            {field.fieldName}
                          </span>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={fieldMeta.required || false}
                              onChange={(e) => updateFieldMetadata(selectedCollection.id, field.fieldName, { required: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                            <span className="text-gray-600">Required</span>
                          </label>
                        </div>
                        
                        <div className="space-y-2">
                          <select
                            value={fieldMeta.type || field.type || 'string'}
                            onChange={(e) => updateFieldMetadata(selectedCollection.id, field.fieldName, { type: e.target.value as any })}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                            <option value="timestamp">Timestamp</option>
                            <option value="reference">Reference (Lookup)</option>
                            <option value="array">Array</option>
                            <option value="map">Map (Object)</option>
                            <option value="geopoint">GeoPoint</option>
                          </select>
                          
                          {isReference && (
                            <div className="p-2 bg-white border border-indigo-200 rounded space-y-1">
                              <label className="text-xs text-gray-700 font-medium">References:</label>
                              <select
                                value={fieldMeta.referenceTarget?.collection || ''}
                                onChange={(e) => updateFieldMetadata(selectedCollection.id, field.fieldName, {
                                  referenceTarget: { collection: e.target.value, field: 'id' }
                                })}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              >
                                <option value="">Select collection...</option>
                                {allCollections.map((col: any) => (
                                  <option key={col.id} value={col.id}>
                                    {col.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-500">
                            Sample: {JSON.stringify(field.sampleValues?.[0] || null)?.slice(0, 40)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(collectionFields[selectedCollection.id] || []).length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">
                      No fields detected. Add collection to canvas to analyze.
                    </div>
                  )}
                </div>
              </div>

              {/* Relationships */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  🔗 Relationships ({edges.filter(e => e.source === selectedCollection.id || e.target === selectedCollection.id).length})
                </label>
                <div className="space-y-1">
                  {edges
                    .filter(e => e.source === selectedCollection.id || e.target === selectedCollection.id)
                    .map((edge, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedEdge(edge);
                          setShowRelationshipModal(true);
                        }}
                        className="p-2 bg-gray-50 rounded border border-gray-200 hover:bg-indigo-50 cursor-pointer text-xs"
                      >
                        <div className="font-medium text-gray-900">
                          {edge.source === selectedCollection.id ? '→' : '←'} {edge.source === selectedCollection.id ? edge.target : edge.source}
                        </div>
                        <div className="text-gray-500">
                          {edge.label || edge.data?.type || '1:many'}
                        </div>
                      </div>
                    ))}
                  {edges.filter(e => e.source === selectedCollection.id || e.target === selectedCollection.id).length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-3">
                      No relationships defined
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-2">
              <button
                onClick={() => {
                  if (!nodes.some(n => n.id === selectedCollection.id)) {
                    addCollectionToCanvas(selectedCollection);
                  }
                }}
                disabled={nodes.some(n => n.id === selectedCollection.id)}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {nodes.some(n => n.id === selectedCollection.id) ? '✓ On Canvas' : 'Add to Canvas'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Relationship Modal - PHASE 3 */}
      {showRelationshipModal && selectedEdge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Define Relationship: {selectedEdge.source} → {selectedEdge.target}
            </h3>
            
            <div className="space-y-6">
              {/* Relationship Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1:1', '1:many', 'many:many'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        updateRelationship(selectedEdge.id, { type });
                        setSelectedEdge({ ...selectedEdge, data: { ...selectedEdge.data, type } });
                      }}
                      className={`p-3 text-center rounded-lg border-2 transition-colors ${
                        selectedEdge.data?.type === type
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{type}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Relationship Name */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship Name (for generated code)
                </label>
                <input
                  type="text"
                  value={selectedEdge.data?.relationshipName || ''}
                  onChange={(e) => {
                    const relationshipName = e.target.value;
                    updateRelationship(selectedEdge.id, { relationshipName });
                    setSelectedEdge({ ...selectedEdge, data: { ...selectedEdge.data, relationshipName } });
                  }}
                  placeholder="e.g., customer, salesRep, orders"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: &quot;customer&quot; becomes getCustomerFor{selectedEdge.source}()
                </p>
              </div>

              {/* Field Mapping - FIXED TO PRE-POPULATE */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Field-Level Mapping
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* From Field */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      From: {selectedEdge.source}
                    </label>
                    {loadingFields[selectedEdge.source] ? (
                      <div className="text-xs text-gray-500">Loading fields...</div>
                    ) : (
                      <select
                        value={selectedEdge.data?.fromField || selectedEdge.data?.sourceField || ''}
                        onChange={(e) => {
                          const fromField = e.target.value;
                          updateRelationship(selectedEdge.id, { fromField, sourceField: fromField });
                          setSelectedEdge({ ...selectedEdge, data: { ...selectedEdge.data, fromField, sourceField: fromField } });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Select field...</option>
                        {(collectionFields[selectedEdge.source] || []).map((field: any) => (
                          <option key={field.fieldName} value={field.fieldName}>
                            {field.fieldName} ({field.type})
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedEdge.data?.fromField && collectionFields[selectedEdge.source] && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <div className="font-medium text-gray-700">Sample:</div>
                        <div className="text-gray-600 truncate">
                          {JSON.stringify(
                            collectionFields[selectedEdge.source]
                              .find((f: any) => f.fieldName === selectedEdge.data.fromField)
                              ?.sampleValues[0]
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* To Field */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      To: {selectedEdge.target}
                    </label>
                    {loadingFields[selectedEdge.target] ? (
                      <div className="text-xs text-gray-500">Loading fields...</div>
                    ) : (
                      <select
                        value={selectedEdge.data?.toField || selectedEdge.data?.targetField || ''}
                        onChange={(e) => {
                          const toField = e.target.value;
                          updateRelationship(selectedEdge.id, { toField, targetField: toField });
                          setSelectedEdge({ ...selectedEdge, data: { ...selectedEdge.data, toField, targetField: toField } });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Select field...</option>
                        {(collectionFields[selectedEdge.target] || []).map((field: any) => (
                          <option key={field.fieldName} value={field.fieldName}>
                            {field.fieldName} ({field.type})
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedEdge.data?.toField && collectionFields[selectedEdge.target] && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <div className="font-medium text-gray-700">Sample:</div>
                        <div className="text-gray-600 truncate">
                          {JSON.stringify(
                            collectionFields[selectedEdge.target]
                              .find((f: any) => f.fieldName === selectedEdge.data.toField)
                              ?.sampleValues[0]
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedEdge.data?.fromField && selectedEdge.data?.toField && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm font-medium text-green-900">
                      ✓ Mapping: {selectedEdge.source}.{selectedEdge.data.fromField} → {selectedEdge.target}.{selectedEdge.data.toField}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowRelationshipModal(false)}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Done
                </button>
                <button
                  onClick={() => {
                    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
                    setShowRelationshipModal(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchemaMapperPage() {
  return (
    <ReactFlowProvider>
      <SchemaMapperContent />
    </ReactFlowProvider>
  );
}
