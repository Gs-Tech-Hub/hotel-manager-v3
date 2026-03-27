'use client';

import { EmployeeDetailData } from '../../hooks/useEmployee';

interface EmploymentInfoProps {
  employee: EmployeeDetailData;
}

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return 'N/A';
  }
};

export function EmploymentInfo({ employee }: EmploymentInfoProps) {
  if (!employee.employmentData) {
    return null;
  }

  const salary = employee.employmentData?.salary ? Number(employee.employmentData.salary) : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Employment Information</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <div>
          <p className="text-sm font-medium text-gray-600 uppercase">Position</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {employee.employmentData.position}
          </p>
        </div>

        {employee.employmentData.department && (
          <div>
            <p className="text-sm font-medium text-gray-600 uppercase">Department</p>
            <p className="text-lg font-semibold text-gray-900 mt-2">
              {employee.employmentData.department}
            </p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-600 uppercase">Employment Status</p>
          <p className="text-lg font-semibold text-gray-900 mt-2 capitalize">
            {employee.employmentData.employmentStatus.replace('_', ' ')}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 uppercase">Monthly Salary</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            ₦{salary.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {employee.employmentData.salaryType} / {employee.employmentData.salaryFrequency}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 uppercase">Employed Since</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {formatDate(employee.employmentData.employmentDate)}
          </p>
        </div>

        {employee.employmentData.contractType && (
          <div>
            <p className="text-sm font-medium text-gray-600 uppercase">Contract Type</p>
            <p className="text-lg font-semibold text-gray-900 mt-2">
              {employee.employmentData.contractType}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
