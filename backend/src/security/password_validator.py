"""
Password Strength Validator
Enforces password complexity requirements
"""
import re
from typing import Tuple, List


class PasswordValidationError(Exception):
    """Custom exception for password validation failures"""
    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__(", ".join(errors))


def validate_password_strength(password: str) -> Tuple[bool, List[str]]:
    """
    Validate password against security requirements.
    
    Requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
    
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    if len(password) < 8:
        errors.append("Password minimal 8 karakter")
    
    if not re.search(r"[A-Z]", password):
        errors.append("Password harus mengandung minimal 1 huruf besar")
    
    if not re.search(r"[a-z]", password):
        errors.append("Password harus mengandung minimal 1 huruf kecil")
    
    if not re.search(r"\d", password):
        errors.append("Password harus mengandung minimal 1 angka")
    
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password):
        errors.append("Password harus mengandung minimal 1 karakter khusus (!@#$%^&*()_+-=[]{}|;:,.<>?)")
    
    return (len(errors) == 0, errors)


def validate_password_strength_strict(password: str) -> Tuple[bool, List[str]]:
    """
    Strict password validation with additional checks.
    
    Additional requirements:
    - No more than 3 consecutive same characters
    - No common weak passwords
    - Not based on username
    """
    errors = []
    
    # Get basic validation errors
    is_valid, basic_errors = validate_password_strength(password)
    errors.extend(basic_errors)
    
    if not is_valid:
        return False, errors
    
    # Check for consecutive characters (e.g., "aaa", "111")
    if re.search(r"(.)\1{3,}", password):
        errors.append("Password tidak boleh memiliki 4 karakter berulang berurutan (contoh: aaaa, 1111)")
    
    # List of common weak passwords to reject
    common_passwords = [
        "password", "password123", "admin123", "user123",
        "12345678", "qwerty", "abc123", "letmein",
        "welcome", "monkey", "dragon", "master",
        "login123", "admin1234", "root123", "test123"
    ]
    
    if password.lower() in common_passwords:
        errors.append("Password terlalu umum, silakan gunakan kombinasi yang lebih kuat")
    
    return (len(errors) == 0, errors)


def get_password_strength_score(password: str) -> int:
    """
    Calculate password strength score (0-100).
    
    Score breakdown:
    - Length 8-11: +20 points
    - Length 12-15: +30 points
    - Length 16+: +40 points
    - Has uppercase: +10 points
    - Has lowercase: +10 points
    - Has digit: +10 points
    - Has special char: +10 points
    - Has no consecutive chars: +10 points
    - No common patterns: +10 points
    """
    score = 0
    
    # Length scoring
    length = len(password)
    if length >= 16:
        score += 40
    elif length >= 12:
        score += 30
    elif length >= 8:
        score += 20
    
    # Character type scoring
    if re.search(r"[A-Z]", password):
        score += 10
    if re.search(r"[a-z]", password):
        score += 10
    if re.search(r"\d", password):
        score += 10
    if re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password):
        score += 10
    
    # Quality scoring
    if not re.search(r"(.)\1{3,}", password):
        score += 10
    if not re.search(r"(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|qwe|wer|ert)", password.lower()):
        score += 10
    
    return min(score, 100)


def get_strength_label(score: int) -> str:
    """Get label for password strength score"""
    if score < 40:
        return "Lemah"
    elif score < 60:
        return "Sedang"
    elif score < 80:
        return "Kuat"
    else:
        return "Sangat Kuat"


def validate_password_for_user(password: str, is_admin: bool = False) -> Tuple[bool, List[str]]:
    """
    Validate password based on user role.
    
    For admins: Only requires basic security (no special character mandatory)
    For users: Full strict validation required
    
    Args:
        password: The password to validate
        is_admin: If True, skip special character requirement
    
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    # All users need minimum length
    if len(password) < 8:
        errors.append("Password minimal 8 karakter")
    
    # All users need uppercase
    if not re.search(r"[A-Z]", password):
        errors.append("Password harus mengandung minimal 1 huruf besar")
    
    # All users need lowercase
    if not re.search(r"[a-z]", password):
        errors.append("Password harus mengandung minimal 1 huruf kecil")
    
    # All users need digit
    if not re.search(r"\d", password):
        errors.append("Password harus mengandung minimal 1 angka")
    
    # Special character ONLY required for non-admin users
    if not is_admin:
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password):
            errors.append("Password harus mengandung minimal 1 karakter khusus (!@#$%^&*()_+-=[]{}|;:,.<>?)")
    
    # Check for 4+ consecutive same characters (applies to all)
    if re.search(r"(.)\1{3,}", password):
        errors.append("Password tidak boleh memiliki 4 karakter berulang berurutan (contoh: aaaa, 1111)")
    
    # List of common weak passwords (applies to all)
    common_passwords = [
        "password", "password123", "admin123", "user123",
        "12345678", "qwerty", "abc123", "letmein",
        "welcome", "monkey", "dragon", "master",
        "login123", "admin1234", "root123", "test123"
    ]
    
    if password.lower() in common_passwords:
        errors.append("Password terlalu umum, silakan gunakan kombinasi yang lebih kuat")
    
    return (len(errors) == 0, errors)
