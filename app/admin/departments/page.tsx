import React from 'react';
import DepartmentList from '../../../components/admin/DepartmentList';

export const metadata = {
  title: 'Admin - Departments',
};

export default function Page() {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <DepartmentList />
    </div>
  );
}
