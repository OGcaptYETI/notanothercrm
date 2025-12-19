"use client";

import React from "react";
import { RefreshCw, Users } from "lucide-react";
import { GoalPeriod } from "@/types";

interface MetricsToolbarProps {
  period: GoalPeriod;
  onChangePeriod: (p: GoalPeriod) => void;
  onRefresh: () => void;
  teamView: boolean;
  onToggleTeamView: () => void;
}

const periods: GoalPeriod[] = ["daily", "weekly", "monthly"];

export default function MetricsToolbar({
  period,
  onChangePeriod,
  onRefresh,
  teamView,
  onToggleTeamView,
}: MetricsToolbarProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      {/* Period Selector */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => onChangePeriod(p)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              period === p ? "bg-white text-kanva-green shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleTeamView}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
            teamView ? "bg-kanva-green text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <Users className="w-4 h-4" /> Team
        </button>

        <button onClick={onRefresh} className="p-2 text-gray-600 hover:text-gray-900 transition-colors" aria-label="Refresh">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
