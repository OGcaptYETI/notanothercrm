'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Panel,
  ReactFlowProvider,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Database, Save, Download, Upload, Plus, Trash2, GitBranch, Link2 } from 'lucide-react';
import { CollectionNode } from './components/CollectionNode';

function SchemaMapperContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [allCollections, setAllCollections] = useState<any[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collectionFields, setCollectionFields] = useState<Record<string, any[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});

  const loadCompleteSchema = useCallback(async () => {
    setLoading(true);
    try {
      // Load schema from Firestore DB (production-ready)
      const response = await fetch('/api/schema-config');
      if (response.ok) {
        const result = await response.json();
        const config = result.schema;
        
        // Transform to collection list format
        const collections = config.collections.map((col: any) => ({
          id: col.id,
          name: col.name,
          countNote: `${col.documentCount} docs`,
          fieldCount: col.fields?.length || 0,
          fields: col.fields || [],
          subcollections: col.subcollections || [],
        }));
        
        setAllCollections(collections);
        
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
        
        // Auto-load nodes and edges from saved schema
        // Only show collections that have relationships
        if (config.edges && config.edges.length > 0) {
          setEdges(config.edges);
          
          // Get unique collection IDs that are part of relationships
          const collectionsWithRelationships = new Set<string>();
          config.edges.forEach((edge: any) => {
            collectionsWithRelationships.add(edge.source);
            collectionsWithRelationships.add(edge.target);
          });
          
          // Filter nodes to only those with relationships
          const filteredNodes = config.nodes?.filter((node: any) => 
            collectionsWithRelationships.has(node.id)
          ) || [];
          
          setNodes(filteredNodes);
          console.log(`✅ Loaded ${filteredNodes.length} collections with relationships`);
          console.log(`✅ Loaded ${config.edges.length} relationships`);
        } else if (config.nodes && config.nodes.length > 0) {
          // Fallback: if no edges but nodes exist, show first 10 collections
          setNodes(config.nodes.slice(0, 10));
          console.log(`⚠️ No relationships found. Showing first 10 collections.`);
        }
        
        console.log(`✅ Loaded ${collections.length} collections from Firestore DB`);
        console.log(`   Last updated: ${result.lastUpdated || 'Never'}`);
      } else {
        console.error('Schema not found in DB. Run: npm run inspect-schema');
      }
    } catch (err) {
      console.error('Error loading schema:', err);
      console.error('Make sure dev server is running and schema is initialized');
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
        expanded: true,
        connectedFields: connectedFields[collection.id] || [],
        onFieldDrop: handleFieldDrop,
      },
    };

    // Fields are already loaded from schema config
    if (collectionFields[collection.id]) {
      newNode.data.fields = collectionFields[collection.id];
    }
    
    setNodes((nds) => [...nds, newNode]);
  };

  // Define custom node types
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      collectionNode: CollectionNode,
    }),
    []
  );

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

  // Save schema configuration to Firestore DB
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
          
          <div className="flex items-center gap-2">
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

      <div className="flex-1 flex">
        {/* Collections Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Collections ({allCollections.length})
              </h2>
              <button
                onClick={loadCompleteSchema}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="space-y-2">
              {allCollections.map((collection) => {
                const isOnCanvas = nodes.some((node) => node.id === collection.id);
                return (
                  <div
                    key={collection.id}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isOnCanvas
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium text-gray-900 truncate">
                          {collection.id}
                        </div>
                        <div className="text-xs text-gray-500">
                          {collection.countNote} documents
                        </div>
                      </div>
                      {!isOnCanvas && (
                        <button
                          onClick={() => addCollectionToCanvas(collection)}
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
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
            
            <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Legend</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-green-500"></div>
                    <span>1:1 Relationship</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-indigo-500"></div>
                    <span>1:Many Relationship</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-orange-500"></div>
                    <span>Many:Many Relationship</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <p className="text-xs text-gray-600">
                    <strong>Phase 3:</strong> Connect collections, then map specific fields in the relationship modal.
                  </p>
                </div>
              </div>
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

              {/* Field Mapping - PHASE 3 FEATURE */}
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
                        value={selectedEdge.data?.fromField || ''}
                        onChange={(e) => {
                          const fromField = e.target.value;
                          updateRelationship(selectedEdge.id, { fromField });
                          setSelectedEdge({ ...selectedEdge, data: { ...selectedEdge.data, fromField } });
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
                        value={selectedEdge.data?.toField || ''}
                        onChange={(e) => {
                          const toField = e.target.value;
                          updateRelationship(selectedEdge.id, { toField });
                          setSelectedEdge({ ...selectedEdge, data: { ...selectedEdge.data, toField } });
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
