export interface UserInfo {
  id: number;
  token: string;
  name: string;
  email: string;
  roles: string[];
}

export interface TimeOffRequest {
  timeOffType: string;
  startDate: string;
  endDate: string;
  reason: string;
  isCompanySponsored?: boolean;
}

export interface TimeOffResponse {
  id: number;
  workerId: string;
  workerName?: string;
  timeOffType: string;
  startDate: string;
  endDate: string;
  dailyQuantity: number;
  totalQuantity: number;
  routingStatus: string;
  isCompanySponsored?: boolean;
  payStatus?: string;
  salaryCredited?: boolean;
  payStatusLabel?: string;
  reason?: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  type: string;
}

export interface LeaveBalanceInfo {
  id: number;
  leaveType: string;
  totalLeaves: number;
  usedLeaves: number;
  accruedLeaves?: number;
  availableLeaves?: number;
  accrualRate?: number;
  accrualFrequency?: string;
}

export interface LeavePolicyInfo {
  id?: number;
  policyName: string;
  leaveType: string;
  effectiveDate?: string;
  endDate?: string;
  isActive?: boolean;
  policyStatus?: string;
  restartedFromId?: number;
  description?: string;

  // Eligibility
  eligibleRole?: string;
  employeeType?: string;
  region?: string;
  tenureMonths?: number;
  department?: string;
  gradeLevel?: string;

  // Accrual & Proration
  accrualRate?: number;
  accrualFrequency?: string;
  defaultDays: number;
  allowNegativeBalance?: boolean;
  maxNegativeLimit?: number;
  isProrated?: boolean;
  prorationBasis?: string;
  prorationRounding?: string;

  // Carryover
  isCarryForwardAllowed: boolean;
  maxCarryForwardDays: number;
  expirationMonths?: number;

  // Approval Workflow Chain
  approvalStep1?: string;
  approvalStep2?: string;
  approvalStep3?: string;

  // Validation Rules
  preventOverlapWith?: string;
  preventExceedingLimit?: boolean;
  allowSpecialExceptions?: boolean;

  // Reporting
  reportFrequency?: string;
}

export interface DashboardStats {
  totalEmployees: number;
  employeesOnLeave: number;
  employeesPresent: number;
  onLeaveNames: string[];
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  roles: string[];
  managerName?: string;
  managerId?: number;
  department?: string;
  designation?: string;
  employeeType?: string;
  hireDate?: string;
  totalPtoAllocated?: number;
  totalPtoUsed?: number;
  totalPtoAvailable?: number;
  totalUnpaidDays?: number;
  leaveBalances?: LeaveBalanceInfo[];
}

export interface OnboardEmployeePayload {
  name: string;
  email: string;
  password?: string;
  roles: string[];
  managerId?: number | null;
  department?: string;
  designation?: string;
  employeeType?: string;
  hireDate?: string;
}

