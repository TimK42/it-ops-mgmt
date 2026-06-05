// Password complexity rules: min 8 chars, uppercase, lowercase, digit, special char
const MSG =
  'Password must be at least 8 characters, with uppercase, lowercase, digit, and special character';

// Acceptable special characters — excludes whitespace
const SPECIAL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

function validatePassword(password) {
  if (typeof password !== 'string') return MSG;
  if (password.length < 8) return MSG;
  if (!/[A-Z]/.test(password)) return MSG;
  if (!/[a-z]/.test(password)) return MSG;
  if (!/[0-9]/.test(password)) return MSG;
  if (!SPECIAL.test(password)) return MSG;
  return null; // valid
}

module.exports = { validatePassword };
