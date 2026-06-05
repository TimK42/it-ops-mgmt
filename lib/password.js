// Password complexity rules: min 8 chars, uppercase, lowercase, digit, special char
function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters, with uppercase, lowercase, digit, and special character';
  if (!/[A-Z]/.test(password)) return 'Password must be at least 8 characters, with uppercase, lowercase, digit, and special character';
  if (!/[a-z]/.test(password)) return 'Password must be at least 8 characters, with uppercase, lowercase, digit, and special character';
  if (!/[0-9]/.test(password)) return 'Password must be at least 8 characters, with uppercase, lowercase, digit, and special character';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must be at least 8 characters, with uppercase, lowercase, digit, and special character';
  return null; // valid
}

module.exports = { validatePassword };
