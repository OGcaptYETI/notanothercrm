"use client";

import React from "react";
import { Goal, GoalType } from "@/types";
import { TrendingUp } from "lucide-react";

interface TeamPerformanceProps {
  goals: Goal[];
}

export default function TeamPerformance({ goals }: TeamPerformanceProps) {
  // Placeholder: rank calculation not yet based on team data
  const calculateTeamRank = (goalType: GoalType): number => Math.floor(Math.random() * 10) + 1;
  const toTitle = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="mt-8 bg-white rounded-xl shadow-kanva p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-kanva-green" /> Team Performance
      </h3>
      <div className="divide-y divide-gray-100">
        {goals.map((goal) => {
          const rank = calculateTeamRank(goal.type);
          const top = rank <= 3;
          const pct = Math.min((goal.current / goal.target) * 100, 100);
          return (
            <div key={goal.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  top ? "bg-kanva-lightGreen text-kanva-green" : "bg-gray-200 text-gray-700"
                }`}>
                  {rank}
                </span>
                <span className="text-sm text-gray-700">{toTitle(goal.type)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${top ? "text-kanva-green" : "text-gray-900"}`}>{pct.toFixed(0)}%</span>
                {top && <TrendingUp className="w-4 h-4 text-kanva-green" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
