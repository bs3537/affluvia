import React from 'react';
import { TrendingUp } from 'lucide-react';

interface RetirementIncomeSourcesWidgetProps {
  profileData: any;
}

export function RetirementIncomeSourcesWidget({ profileData }: RetirementIncomeSourcesWidgetProps) {
  // Force static rendering - no conditional logic, no external dependencies
  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-[#8A00C4] flex-shrink-0" />
        <span className="text-xs text-gray-300">Income Sources Preview</span>
      </div>
      
      {/* Simple static bars instead of complex chart */}
      <div className="flex-1 flex flex-col justify-center space-y-2 max-h-[180px] overflow-hidden">
        
        {/* Social Security Bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 w-20 flex-shrink-0">Age 65</span>
          <div className="flex-1 mx-2 h-6 bg-gray-700 rounded-sm overflow-hidden">
            <div className="flex h-full">
              <div className="bg-[#8A00C4] flex-1" style={{ width: '45%' }} title="Social Security: $30K"></div>
              <div className="bg-[#4F46E5] flex-1" style={{ width: '30%' }} title="Pension: $20K"></div>
              <div className="bg-[#EF4444] flex-1" style={{ width: '25%' }} title="Withdrawals: $15K"></div>
            </div>
          </div>
          <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">$65K</span>
        </div>

        {/* Age 66 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 w-20 flex-shrink-0">Age 66</span>
          <div className="flex-1 mx-2 h-6 bg-gray-700 rounded-sm overflow-hidden">
            <div className="flex h-full">
              <div className="bg-[#8A00C4]" style={{ width: '44%' }} title="Social Security: $30K"></div>
              <div className="bg-[#4F46E5]" style={{ width: '29%' }} title="Pension: $20K"></div>
              <div className="bg-[#EF4444]" style={{ width: '27%' }} title="Withdrawals: $18K"></div>
            </div>
          </div>
          <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">$68K</span>
        </div>

        {/* Age 67 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 w-20 flex-shrink-0">Age 67</span>
          <div className="flex-1 mx-2 h-6 bg-gray-700 rounded-sm overflow-hidden">
            <div className="flex h-full">
              <div className="bg-[#8A00C4]" style={{ width: '43%' }} title="Social Security: $30K"></div>
              <div className="bg-[#4F46E5]" style={{ width: '28%' }} title="Pension: $20K"></div>
              <div className="bg-[#EF4444]" style={{ width: '29%' }} title="Withdrawals: $20K"></div>
            </div>
          </div>
          <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">$70K</span>
        </div>

        {/* Age 68 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 w-20 flex-shrink-0">Age 68</span>
          <div className="flex-1 mx-2 h-6 bg-gray-700 rounded-sm overflow-hidden">
            <div className="flex h-full">
              <div className="bg-[#8A00C4]" style={{ width: '42%' }} title="Social Security: $30K"></div>
              <div className="bg-[#4F46E5]" style={{ width: '28%' }} title="Pension: $20K"></div>
              <div className="bg-[#EF4444]" style={{ width: '30%' }} title="Withdrawals: $22K"></div>
            </div>
          </div>
          <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">$72K</span>
        </div>

        {/* Age 70 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 w-20 flex-shrink-0">Age 70</span>
          <div className="flex-1 mx-2 h-6 bg-gray-700 rounded-sm overflow-hidden">
            <div className="flex h-full">
              <div className="bg-[#8A00C4]" style={{ width: '50%' }} title="Social Security: $40K (delayed)"></div>
              <div className="bg-[#4F46E5]" style={{ width: '25%' }} title="Pension: $20K"></div>
              <div className="bg-[#EF4444]" style={{ width: '25%' }} title="Withdrawals: $20K"></div>
            </div>
          </div>
          <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">$80K</span>
        </div>
        
      </div>
      
      {/* Simple legend */}
      <div className="flex justify-center gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[#8A00C4] rounded-sm flex-shrink-0"></div>
          <span className="text-xs text-gray-400">Social Security</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[#4F46E5] rounded-sm flex-shrink-0"></div>
          <span className="text-xs text-gray-400">Pension</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[#EF4444] rounded-sm flex-shrink-0"></div>
          <span className="text-xs text-gray-400">Withdrawals</span>
        </div>
      </div>
      
      <div className="text-center mt-2">
        <div className="text-xs text-gray-400">(Optimized Plan)</div>
      </div>
    </div>
  );
}