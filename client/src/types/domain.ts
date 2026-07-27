export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';

export type RequestPriority = 'Critical' | 'Urgent' | 'Routine';

export type DonorResponse = 'Accepted' | 'Declined';

export type Role = 'donor' | 'hospital' | 'bloodbank' | 'admin';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Coordinates {
  lat: number;
  lng: number;
}

interface BaseUser {
  id: string;
  email: string;
  phone: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface DonorUser extends BaseUser {
  role: 'donor';
  donorId: string;
  name: string;
  age: number;
  bloodGroup: BloodGroup;
  donatedEver: 'yes' | 'no';
  lastDonationDate: string | null;
  traveling: boolean;
  availabilityStatus: 'available' | 'unavailable';
  city?: string | null;
  coordinates?: Coordinates | null;
}

export interface HospitalUser extends BaseUser {
  role: 'hospital';
  hospitalId: string;
  hospitalName: string;
  licenseNumber: string;
  address?: string;
  city?: string;
  contactNumber?: string;
  approvalStatus: ApprovalStatus;
  coordinates?: Coordinates | null;
}

export interface BloodBankUser extends BaseUser {
  role: 'bloodbank';
  bankId: string;
  bankName: string;
  address?: string;
  city?: string;
  contactNumber?: string;
  approvalStatus: ApprovalStatus;
  coordinates?: Coordinates | null;
}

export interface AdminUser extends BaseUser {
  role: 'admin';
}

export type User = DonorUser | HospitalUser | BloodBankUser | AdminUser;

export interface Session {
  user: User;
}

export interface DonorResponseEntry {
  donorId: string;
  donorName: string;
  donorPhone: string | null;
  response: DonorResponse;
  respondedAt: string;
}

export interface HospitalRequest {
  id: string;
  patient: string;
  bloodGroup: BloodGroup;
  units: number;
  priority: RequestPriority;
  matches: number;
  status: string;
  createdAt: string;
  hospitalId: string | null;
  raisedBy: 'hospital' | 'guest' | 'donor' | 'bloodbank';
  guestName?: string | null;
  guestPhone?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  responses: DonorResponseEntry[];
}

export interface DonorAlertRequest {
  id: string;
  patient: string;
  bloodGroup: BloodGroup;
  units: number;
  priority: RequestPriority;
  status: string;
  createdAt: string;
  myResponse: DonorResponse | null;
  distanceKm: number | null;
}

export interface InventoryItem {
  group: BloodGroup;
  units: number;
  expiry?: string | null;
  location?: string;
  bankId?: string;
}

export interface Donation {
  id: string;
  donationDate: string;
  unitsDonated: number;
}

export interface DonorSummary {
  profile: {
    id: string;
    name: string;
    age: number;
    bloodGroup: BloodGroup;
    donatedEver: 'yes' | 'no';
    lastDonationDate: string | null;
    traveling: boolean;
    availabilityStatus: 'available' | 'unavailable';
  };
  eligibility: { eligible: boolean; daysRemaining: number };
  badgeLevel: string | null;
  totalDonations: number;
  donations: Donation[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminStats {
  donorCount: number;
  openRequests: number;
  lowStockGroups: BloodGroup[];
  inventory: InventoryItem[];
}
