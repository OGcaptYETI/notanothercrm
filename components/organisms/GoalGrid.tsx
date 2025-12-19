"use client";

import React from "react";
import { Goal, GoalPeriod, GoalType } from "@/types";
import GoalCard from "@/components/molecules/GoalCard";
import { Plus } from "lucide-react";

interface GoalGridProps {
  goalTypes: GoalType[];
  goals: Goal[];
  selectedPeriod: GoalPeriod;
  onAddGoal: (type: GoalType) => void;
  onEditGoal: (type: GoalType) => void;
  hideActions?: boolean; // Hide edit/add buttons
}

export default function GoalGrid({ goalTypes, goals, selectedPeriod, onAddGoal, onEditGoal, hideActions = false }: GoalGridProps) {
  const toTitle = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {goalTypes.map((type) => {
        const goal = goals.find((g) => g.type === type);
        if (goal) {
          return <GoalCard key={type} goal={goal} onEdit={hideActions ? undefined : () => onEditGoal(type)} />;
        }
        return (
          <button
            key={type}
            onClick={() => onAddGoal(type)}
            className="bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-kanva-green hover:bg-kanva-lightGreen p-6 transition-colors group"
          >
            <div className="text-center">
              <Plus className="w-8 h-8 text-gray-400 group-hover:text-kanva-green mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600 group-hover:text-gray-900">Set {toTitle(type)} Goal</p>
              <p className="text-xs text-gray-500 mt-1">{selectedPeriod} target</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
