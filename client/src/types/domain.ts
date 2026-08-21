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
  state?: string | null;
  coordinates?: Coordinates | null;
}

export interface HospitalUser extends BaseUser {
  role: 'hospital';
  hospitalId: string;
  hospitalName: string;
  licenseNumber: string;
  address?: string;
  city?: string;
  state?: string | null;
  contactNumber?: string;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
  coordinates?: Coordinates | null;
}

export interface BloodBankUser extends BaseUser {
  role: 'bloodbank';
  bankId: string;
  bankName: string;
  licenseNumber: string;
  address?: string;
  city?: string;
  state?: string | null;
  contactNumber?: string;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
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

export interface BloodBankResponseEntry {
  bankId: string;
  bankName: string;
  bankPhone: string | null;
  response: DonorResponse;
  unitsCommitted: number;
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
  raisedByUserId: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  responses: DonorResponseEntry[];
  bankResponses: BloodBankResponseEntry[];
  // Only present on the blood-bank "incoming requests" feed (GET ?forBloodBank=true).
  myBankResponse?: DonorResponse | null;
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

export interface BloodGroupDemandPoint {
  group: BloodGroup;
  count: number;
}

export interface TopHospitalPoint {
  hospitalName: string;
  count: number;
}

export interface InventoryLevelPoint {
  group: BloodGroup;
  units: number;
}

export interface RequestPriorityPoint {
  priority: RequestPriority;
  count: number;
}

export interface DonorAvailabilityBreakdown {
  available: number;
  traveling: number;
  unavailable: number;
}

export interface CityCountPoint {
  city: string;
  count: number;
}

export type TrendGranularity = 'day' | 'month';

export interface NetworkTrendPoint {
  key: string; // 'YYYY-MM-DD' when granularity is 'day', 'YYYY-MM' when 'month'
  donations: number;
  newDonors: number;
}

export interface NetworkTrends {
  granularity: TrendGranularity;
  points: NetworkTrendPoint[];
}

export interface AdminAnalytics {
  donorCount: number;
  hospitalsCount: number;
  bloodBanksCount: number;
  openRequests: number;
  totalDonations: number;
  lowStockGroups: BloodGroup[];
  inventoryLevels: InventoryLevelPoint[];
  bloodGroupDemand: BloodGroupDemandPoint[];
  donorsByBloodGroup: BloodGroupDemandPoint[];
  requestsByPriority: RequestPriorityPoint[];
  donorAvailability: DonorAvailabilityBreakdown;
  topCities: CityCountPoint[];
  topHospitals: TopHospitalPoint[];
  fulfillment: {
    avgMinutes: number | null;
    completedCount: number;
  };
  retention: {
    registered: number;
    donatedOnce: number;
    donatedAgain: number;
    loyalDonors: number;
  };
}

export type ManageableRole = 'donor' | 'hospital' | 'bloodbank';
export type UserAccountStatus = 'pending' | 'active' | 'suspended';

export interface AdminLicenseDocument {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface AdminUserListItem {
  id: string;
  name: string | null;
  city: string | null;
  role: ManageableRole;
  email: string;
  phone: string;
  status: UserAccountStatus;
  approvalStatus: ApprovalStatus | null;
  rejectionReason: string | null;
  // HospitalProfile/BloodBankProfile _id, distinct from `id` (the User
  // _id) -- the approve/reject/license-document endpoints key off this.
  approvalId: string | null;
  licenseDocument: AdminLicenseDocument | null;
  reactivationRequestedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
}
