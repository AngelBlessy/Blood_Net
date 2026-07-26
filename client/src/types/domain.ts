export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';

export type RequestPriority = 'Critical' | 'Urgent' | 'Routine';

export type DonorResponse = 'Accepted' | 'Declined';

export interface User {
  key: string;
  role: 'Donor';
  name: string;
  age: number;
  phone: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  bloodGroup: BloodGroup;
  donatedEver: 'yes' | 'no';
  lastDonationDate: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  traveling: boolean;
}

export interface Session {
  userKey: string;
  user: User;
}

export interface HospitalRequest {
  id: string;
  patient: string;
  bloodGroup: BloodGroup;
  units: number;
  priority: RequestPriority;
  contactName: string;
  contactPhone: string;
  matches: number;
  status: string;
  createdAt: string;
  responses?: Record<string, DonorResponse>;
}

export interface InventoryItem {
  group: BloodGroup;
  units: number;
  expiry: string;
  location: string;
}
