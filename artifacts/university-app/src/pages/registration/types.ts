import React from "react";

export type StatusFilterType = "PENDING" | "APPROVED" | "REJECTED" | "ALL";
export type ViewModeType = "table" | "cards";

export interface StatusBadgeConfig {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  className: string;
  dotClass: string;
}

export interface DepartmentInfo {
  id: number | string;
  name: string;
  nameAr?: string;
  collegeId?: number | string;
  college?: {
    id: number | string;
    name: string;
    nameAr?: string;
  };
}

export interface RegistrationRequestItem {
  id: number | string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  studentId?: string | null;
  year?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  rejectionReason?: string | null;
  createdAt: string;
  departmentId?: number | string | null;
  department?: DepartmentInfo | null;
}

export interface CollegeOption {
  id: number | string;
  name: string;
  nameAr?: string | null;
}

export interface RegistrationKpiCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}
