import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database, Key, Link2, Calendar, Hash, Type, CheckSquare } from 'lucide-react';

interface CollectionNodeData {
  label: string;
  collectionName: string;
  documentCount: string;
  fields?: Array<{
    fieldName: string;
    type: string;
    isLookup?: boolean;
    lookupTarget?: string;
    sampleValue?: any;
  }>;
  expanded?: boolean;
  connectedFields?: string[]; // Fields that are part of relationships
  onFieldDragStart?: (collectionId: string, fieldName: string) => void;
  onFieldDrop?: (collectionId: string, fieldName: string) => void;
}

export function CollectionNode({ data, selected, id }: NodeProps<CollectionNodeData>) {
  const [isExpanded, setIsExpanded] = React.useState(data.expanded || false);
  const [dragOverField, setDragOverField] = React.useState<string | null>(null);
  
  const getFieldIcon = (type: string) => {
    if (type.includes('number')) return <Hash className="w-3 h-3" />;
    if (type.includes('date') || type.includes('timestamp')) return <Calendar className="w-3 h-3" />;
    if (type.includes('boolean')) return <CheckSquare className="w-3 h-3" />;
    return <Type className="w-3 h-3" />;
  };

  const handleFieldDragStart = (e: React.DragEvent, fieldName: string) => {
    e.stopPropagation();
    const dragData = {
      collectionId: id,
      fieldName: fieldName,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'link';
    if (data.onFieldDragStart) {
      data.onFieldDragStart(id as string, fieldName);
    }
  };

  const handleFieldDragOver = (e: React.DragEvent, fieldName: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'link';
    setDragOverField(fieldName);
  };

  const handleFieldDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(null);
  };

  const handleFieldDrop = (e: React.DragEvent, fieldName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(null);
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
      if (dragData.collectionId !== id && data.onFieldDrop) {
        data.onFieldDrop(fieldName, dragData);
      }
    } catch (err) {
      console.error('Error handling field drop:', err);
    }
  };

  const isFieldConnected = (fieldName: string) => {
    return data.connectedFields?.includes(fieldName) || false;
  };

  const lookupFields = data.fields?.filter(f => f.isLookup) || [];
  const regularFields = data.fields?.filter(f => !f.isLookup) || [];

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border-2 transition-all ${
        selected ? 'border-indigo-500 shadow-xl' : 'border-gray-300'
      }`}
      style={{ minWidth: 280, maxWidth: 400 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-3 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <div>
              <div className="font-semibold text-sm">{data.label}</div>
              <div className="text-xs opacity-90">{data.documentCount} docs</div>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white hover:bg-white/20 rounded px-2 py-1 text-xs"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {/* Fields List */}
      {isExpanded && data.fields && (
        <div className="max-h-96 overflow-y-auto">
          {/* Lookup Fields Section */}
          {lookupFields.length > 0 && (
            <div className="border-b border-gray-200">
              <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 flex items-center gap-1">
                <Link2 className="w-3 h-3" />
                Lookup Fields ({lookupFields.length})
              </div>
              {lookupFields.map((field, idx) => {
                const isConnected = isFieldConnected(field.fieldName);
                const isDragOver = dragOverField === field.fieldName;
                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleFieldDragStart(e, field.fieldName)}
                    onDragOver={(e) => handleFieldDragOver(e, field.fieldName)}
                    onDragLeave={handleFieldDragLeave}
                    onDrop={(e) => handleFieldDrop(e, field.fieldName)}
                    className={`px-3 py-2 border-b border-amber-100 hover:bg-amber-50 transition-all cursor-move ${
                      isConnected ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                    } ${isDragOver ? 'bg-indigo-100 border-2 border-indigo-400' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Key className={`w-3 h-3 flex-shrink-0 ${isConnected ? 'text-green-600' : 'text-amber-600'}`} />
                        <span className={`text-xs font-mono font-medium truncate ${isConnected ? 'text-green-900 font-bold' : 'text-gray-900'}`}>
                          {field.fieldName}
                        </span>
                        {isConnected && (
                          <Link2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">{field.type}</span>
                    </div>
                    {field.lookupTarget && (
                      <div className="text-xs text-amber-700 mt-1 ml-5">
                        → {field.lookupTarget}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Regular Fields Section */}
          {regularFields.length > 0 && (
            <div>
              <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                Fields ({regularFields.length})
              </div>
              {regularFields.slice(0, 20).map((field, idx) => {
                const isConnected = isFieldConnected(field.fieldName);
                const isDragOver = dragOverField === field.fieldName;
                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleFieldDragStart(e, field.fieldName)}
                    onDragOver={(e) => handleFieldDragOver(e, field.fieldName)}
                    onDragLeave={handleFieldDragLeave}
                    onDrop={(e) => handleFieldDrop(e, field.fieldName)}
                    className={`px-3 py-2 border-b border-gray-100 hover:bg-gray-50 transition-all cursor-move ${
                      isConnected ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                    } ${isDragOver ? 'bg-indigo-100 border-2 border-indigo-400' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={isConnected ? 'text-green-600' : 'text-gray-400'}>{getFieldIcon(field.type)}</span>
                        <span className={`text-xs font-mono truncate ${isConnected ? 'text-green-900 font-bold' : 'text-gray-700'}`}>
                          {field.fieldName}
                        </span>
                        {isConnected && (
                          <Link2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">{field.type}</span>
                    </div>
                  </div>
                );
              })}
              {regularFields.length > 20 && (
                <div className="px-3 py-2 text-xs text-gray-500 text-center">
                  + {regularFields.length - 20} more fields
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsed Summary */}
      {!isExpanded && data.fields && (
        <div className="px-3 py-2 text-xs text-gray-600">
          {lookupFields.length > 0 && (
            <div className="flex items-center gap-1 text-amber-700 font-medium">
              <Link2 className="w-3 h-3" />
              {lookupFields.length} lookup field{lookupFields.length !== 1 ? 's' : ''}
            </div>
          )}
          <div className="text-gray-500 mt-1">
            {data.fields.length} total fields
          </div>
        </div>
      )}

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-indigo-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-indigo-500 border-2 border-white"
      />
    </div>
  );
}
