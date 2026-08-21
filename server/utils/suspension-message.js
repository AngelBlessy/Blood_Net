// Shared with login (auth.controller.js), the suspend notification
// (admin.controller.js), and the live session check (middleware/auth.js) so
// the wording never drifts between the three places a user can learn they've
// been suspended.
function suspensionMessage(reason) {
  const reasonText = reason ? ` because ${reason}.` : '.';
  return `Your account has been suspended by the admin${reasonText} Please ask the admin for approval again.`;
}

module.exports = { suspensionMessage };
