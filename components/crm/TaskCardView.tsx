'use client';

import { CheckCircle2, Clock, Calendar, User, Building2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { Task } from '@/lib/crm/types-crm';

interface TaskCardViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onToggleComplete: (taskId: string, currentStatus: string) => void;
  expandedTasks: Set<string>;
  onToggleExpand: (taskId: string) => void;
}

export function TaskCardView({ 
  tasks, 
  onTaskClick, 
  onToggleComplete,
  expandedTasks,
  onToggleExpand
}: TaskCardViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {tasks.map((task) => {
        const isCompleted = task.status === 'completed' || task.status === 'Completed';
        const isExpanded = expandedTasks.has(task.id);
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const isPastDue = dueDate ? dueDate < new Date() : false;
        const isToday = dueDate ? dueDate.toDateString() === new Date().toDateString() : false;

        const priorityColors: Record<string, string> = {
          high: 'border-red-500 bg-red-50',
          medium: 'border-yellow-500 bg-yellow-50',
          low: 'border-blue-500 bg-blue-50',
          urgent: 'border-purple-500 bg-purple-50',
        };

        const priorityBorder = task.priority 
          ? priorityColors[task.priority.toLowerCase()] || 'border-gray-200 bg-white'
          : 'border-gray-200 bg-white';

        return (
          <div
            key={task.id}
            className={`border-l-4 ${priorityBorder} rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
          >
            {/* Card Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-start gap-3">
                {/* Completion Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(task.id, task.status || 'pending');
                  }}
                  className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    isCompleted 
                      ? 'bg-green-500 border-green-500' 
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                  title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                >
                  {isCompleted && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </button>

                {/* Task Content */}
                <div 
                  className="flex-1 min-w-0"
                  onClick={() => onTaskClick(task)}
                >
                  <h3 className={`font-semibold text-gray-900 mb-1 ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                    {task.name}
                  </h3>
                  
                  {task.details && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {task.details}
                    </p>
                  )}

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}

                    {task.priority && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        task.priority.toLowerCase() === 'high' ? 'bg-red-100 text-red-700' :
                        task.priority.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        task.priority.toLowerCase() === 'low' ? 'bg-blue-100 text-blue-700' :
                        task.priority.toLowerCase() === 'urgent' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-3">
              {/* Due Date */}
              {dueDate && (
                <div className={`flex items-center gap-2 text-sm ${
                  isPastDue ? 'text-red-600 font-medium' : 
                  isToday ? 'text-orange-600 font-medium' : 
                  'text-gray-600'
                }`}>
                  <Calendar className="w-4 h-4" />
                  <span>Due: {dueDate.toLocaleDateString()}</span>
                </div>
              )}

              {/* Related To */}
              {task.related_to_type && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {task.related_to_type === 'person' ? (
                    <User className="w-4 h-4" />
                  ) : task.related_to_type === 'account' ? (
                    <Building2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span className="capitalize">{task.related_to_type}</span>
                </div>
              )}

              {/* Owner */}
              {task.owner && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{task.owner}</span>
                </div>
              )}

              {/* Subtasks Toggle (if any exist) */}
              {/* TODO: This will be populated when we add subtask data */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(task.id);
                }}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span>Subtasks (0)</span>
              </button>

              {/* Expanded Subtasks */}
              {isExpanded && (
                <div className="ml-6 space-y-2 pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-500">No subtasks yet</p>
                </div>
              )}
            </div>

            {/* Card Footer */}
            {task.created_at && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                Created {new Date(task.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
        );
      })}

      {tasks.length === 0 && (
        <div className="col-span-full text-center py-12 text-gray-500">
          No tasks to display
        </div>
      )}
    </div>
  );
}
