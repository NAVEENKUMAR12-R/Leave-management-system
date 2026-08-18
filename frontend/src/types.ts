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
}

export interface LeavePolicyInfo {
  id?: number;
  leaveType: string;
  defaultDays: number;
  isCarryForwardAllowed: boolean;
  maxCarryForwardDays: number;
}

export interface DashboardStats {
  totalEmployees: number;
  employeesOnLeave: number;
  employeesPresent: number;
  onLeaveNames: string[];
}
