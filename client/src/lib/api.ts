import type { BloodGroup, RequestPriority } from '@/types/domain';

export interface DeliveryResult {
  delivered: boolean;
  error?: string;
}

interface SendOtpOptions {
  channel: 'email' | 'sms';
  target: string;
  otp: string;
  subject?: string;
  body?: string;
}

export async function sendOtp(options: SendOtpOptions): Promise<DeliveryResult> {
  try {
    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}) as { error?: string });
      throw new Error(details.error || 'OTP provider unavailable');
    }
    return { delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`OTP delivery failed (${options.channel}):`, message);
    return { delivered: false, error: message };
  }
}

export function otpFailureMessage(...channelLabels: Array<string | false | undefined>): string {
  const failed = channelLabels.filter((label): label is string => Boolean(label));
  if (!failed.length) return 'Something went wrong sending the OTP. Use Resend OTP to try again.';
  return `We couldn't send the OTP by ${failed.join(' and ')} right now. Use Resend OTP to try again.`;
}

interface EmergencyAlertRecipient {
  name: string;
  email: string;
  phone: string;
}

interface EmergencyAlertRequest {
  patient: string;
  bloodGroup: BloodGroup;
  units: number;
  priority: RequestPriority;
  contactName: string;
  contactPhone: string;
}

interface EmergencyAlertResult {
  ok: boolean;
  emailSent: number;
  smsSent: number;
}

export async function sendEmergencyAlerts(
  request: EmergencyAlertRequest,
  recipients: EmergencyAlertRecipient[]
): Promise<EmergencyAlertResult> {
  const response = await fetch('/api/send-emergency-alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request, recipients }),
  });
  const result = await response.json().catch(() => ({}) as { error?: string });
  if (!response.ok) {
    throw new Error(result.error || 'Alert delivery failed');
  }
  return result as EmergencyAlertResult;
}
