'use client';

import { useState } from 'react';
import { Calculator, Calendar, RefreshCw, FileText, AlertCircle, CheckCircle, TrendingUp, Users, DollarSign } from 'lucide-react';
import ValidationModal from './modals/ValidationModal';
import ProcessingModal from './modals/ProcessingModal';
import toast from 'react-hot-toast';

interface CalculateTabProps {
  onCalculationComplete?: () => void;
}

interface CommissionSummary {
  month: string;
  year: number;
  commissionsCalculated: number;
  totalCommission: number;
  ordersProcessed: number;
  repBreakdown: Record<string, any>;
}

export default function CalculateTab({ onCalculationComplete }: CalculateTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary | null>(null);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const handleStartCalculation = () => {
    setShowValidationModal(true);
  };

  const handleProceedWithCalculation = async () => {
    setShowValidationModal(false);
    setShowProcessingModal(true);
    setCalculating(true);
    setProcessingStatus('Starting calculation...');
    
    const loadingToast = toast.loading('Calculating commissions...');
    
    try {
      // Start the calculation
      const response = await fetch('/api/calculate-monthly-commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          month: String(selectedMonth).padStart(2, '0'), 
          year: selectedYear 
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start calculation');
      }
      
      const data = await response.json();
      const calcId = data.calcId;
      
      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/commission-progress?calcId=${calcId}`);
          const progress = await progressResponse.json();
          
          if (progress.status === 'processing') {
            const { processed, total } = progress;
            const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
            setProcessingStatus(`Processing: ${processed}/${total} orders (${percentage}%)`);
          } else if (progress.status === 'complete') {
            clearInterval(pollInterval);
            setProcessingStatus('Complete!');
            setCalculating(false);
            
            const { processed, total } = progress;
            
            // Set summary
            setCommissionSummary({
              month: String(selectedMonth).padStart(2, '0'),
              year: selectedYear,
              commissionsCalculated: progress.stats?.commissionsCalculated || 0,
              totalCommission: progress.stats?.totalCommission || 0,
              ordersProcessed: total || 0,
              repBreakdown: progress.stats?.repBreakdown || {}
            });
            
            toast.success(
              `✅ Calculated ${progress.stats?.commissionsCalculated || 0} commissions! Total: $${(progress.stats?.totalCommission || 0).toFixed(2)}`,
              { id: loadingToast, duration: 8000 }
            );
            
            setShowProcessingModal(false);
            
            if (onCalculationComplete) {
              onCalculationComplete();
            }
          } else if (progress.status === 'error') {
            clearInterval(pollInterval);
            throw new Error(progress.error || 'Calculation failed');
          }
        } catch (error: any) {
          clearInterval(pollInterval);
          console.error('Error polling progress:', error);
          toast.error(error.message || 'Failed to get calculation progress', { id: loadingToast });
          setShowProcessingModal(false);
          setCalculating(false);
        }
      }, 2000);
      
      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (calculating) {
          toast.error('Calculation timed out', { id: loadingToast });
          setShowProcessingModal(false);
          setCalculating(false);
        }
      }, 10 * 60 * 1000);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to calculate commissions', { id: loadingToast });
      setShowProcessingModal(false);
      setCalculating(false);
    }
  };

  const handleDeleteMonthCommissions = async () => {
    const confirmDelete = confirm(
      `Are you sure you want to delete ALL commissions for ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}?\n\nThis action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    const loadingToast = toast.loading('Deleting commissions...');
    
    try {
      const response = await fetch('/api/delete-month-commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: String(selectedMonth).padStart(2, '0'),
          year: selectedYear
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete commissions');
      }
      
      const data = await response.json();
      toast.success(`Deleted ${data.deleted} commission records`, { id: loadingToast });
      setCommissionSummary(null);
      
      if (onCalculationComplete) {
        onCalculationComplete();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete commissions', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              <Calculator className="w-8 h-8 mr-3" />
              Calculate Commissions
            </h2>
            <p className="text-blue-100 mt-2">
              Process Fishbowl sales orders and calculate monthly commissions for your team
            </p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-sm text-blue-100">Current Month</div>
            <div className="text-2xl font-bold">
              {months.find(m => m.value === new Date().getMonth() + 1)?.label} {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>

      {/* Month/Year Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-blue-600" />
          Select Calculation Period
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            Calculation will process all Fishbowl orders for this period
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleDeleteMonthCommissions}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
            >
              Delete Month
            </button>
            <button
              onClick={handleStartCalculation}
              disabled={calculating}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculate Commissions
            </button>
          </div>
        </div>
      </div>

      {/* Last Calculation Summary */}
      {commissionSummary && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            Last Calculation Results
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">Commissions</div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">
                    {commissionSummary.commissionsCalculated}
                  </div>
                </div>
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-green-900">Total Payout</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    ${commissionSummary.totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-purple-900">Orders Processed</div>
                  <div className="text-2xl font-bold text-purple-600 mt-1">
                    {commissionSummary.ordersProcessed}
                  </div>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-400" />
              </div>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-orange-900">Active Reps</div>
                  <div className="text-2xl font-bold text-orange-600 mt-1">
                    {Object.keys(commissionSummary.repBreakdown).length}
                  </div>
                </div>
                <Users className="w-8 h-8 text-orange-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How Commission Calculation Works</h3>
        
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-900">Data Validation</h4>
              <p className="text-sm text-gray-600 mt-1">
                System analyzes all sales orders, customer assignments, and rep data to identify any issues before processing
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-900">Order Processing</h4>
              <p className="text-sm text-gray-600 mt-1">
                Each Fishbowl sales order is matched to the assigned sales rep and customer account type
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-900">Commission Calculation</h4>
              <p className="text-sm text-gray-600 mt-1">
                Commission rates are applied based on rep title, customer segment (New/12-Month/Transferred), and account type
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
              4
            </div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-900">Spiff Application</h4>
              <p className="text-sm text-gray-600 mt-1">
                Active spiffs are automatically applied to qualifying line items based on product and quantity rules
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
              5
            </div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-900">Summary Generation</h4>
              <p className="text-sm text-gray-600 mt-1">
                Monthly summaries are created for each rep showing total commission, spiffs, and order counts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ValidationModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        onProceed={handleProceedWithCalculation}
        month={String(selectedMonth).padStart(2, '0')}
        year={selectedYear}
      />
      
      {showProcessingModal && (
        <ProcessingModal
          isOpen={showProcessingModal}
          status={processingStatus}
          progress={0}
          onClose={() => setShowProcessingModal(false)}
        />
      )}
    </div>
  );
}
