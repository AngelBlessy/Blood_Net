function toDeliveryError(error) {
  if (error.code === 21211) {
    return { status: 400, message: 'The mobile number is invalid. Enter a valid 10-digit Indian mobile number.' };
  }
  if (error.code === 21608) {
    return {
      status: 500,
      message: 'This Twilio trial account can send SMS only to verified phone numbers. Verify the recipient in Twilio or upgrade the account.',
    };
  }
  return { status: error.status || 500, message: error.message || 'Something went wrong' };
}

module.exports = { toDeliveryError };
