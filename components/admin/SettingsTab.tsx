'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase/client';

interface BusinessSettings {
  timezone: string;
  workStartHour: number; // 24-hour format
  workEndHour: number;   // 24-hour format
  workDays: number[];    // 0=Sunday, 1=Monday, etc.
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`
}));

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export default function SettingsTab() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings>({
    timezone: 'America/Denver',
    workStartHour: 8,  // 8 AM
    workEndHour: 17,   // 5 PM
    workDays: [1, 2, 3, 4, 5], // Monday-Friday
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const token = await user.getIdToken();
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (e: any) {
      console.error('[Settings Tab] Error:', e);
      toast.error(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const token = await user.getIdToken();
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      toast.success('Settings saved successfully');
    } catch (e: any) {
      console.error('[Settings Tab] Error:', e);
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day].sort()
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Business Settings</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure timezone and business hours for accurate pace tracking
        </p>
      </div>

      {/* Timezone */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">Timezone</h3>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select your timezone
          </label>
          <select
            value={settings.timezone}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Business Hours */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">Business Hours</h3>
        </div>

        <div className="space-y-4">
          {/* Work Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <select
                value={settings.workStartHour}
                onChange={(e) => setSettings({ ...settings, workStartHour: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {HOURS.map(hour => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <select
                value={settings.workEndHour}
                onChange={(e) => setSettings({ ...settings, workEndHour: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {HOURS.map(hour => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Work Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleWorkDay(day.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    settings.workDays.includes(day.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Current Settings</h4>
        <div className="text-sm text-blue-700 space-y-1">
          <p>
            <strong>Timezone:</strong> {TIMEZONES.find(tz => tz.value === settings.timezone)?.label}
          </p>
          <p>
            <strong>Work Hours:</strong> {HOURS.find(h => h.value === settings.workStartHour)?.label} - {HOURS.find(h => h.value === settings.workEndHour)?.label}
          </p>
          <p>
            <strong>Work Days:</strong> {settings.workDays.map(d => DAYS.find(day => day.value === d)?.label).join(', ')}
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
