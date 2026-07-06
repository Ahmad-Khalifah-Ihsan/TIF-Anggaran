"""
Login Rate Limiter - Brute Force Protection
"""
import time
import logging
from collections import defaultdict
from threading import Lock
from typing import Dict, Tuple
from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)

# Global rate limiter for general endpoints
global_rate_limiter = Limiter(key_func=get_remote_address)


class LoginRateLimiter:
    """
    In-memory rate limiter for login attempts to prevent brute force attacks.
    
    Features:
    - Track failed login attempts per IP
    - Track failed login attempts per username
    - Temporary lockout after threshold exceeded
    - Automatic cleanup of old entries
    """
    
    def __init__(
        self,
        max_attempts: int = 5,
        lockout_duration: int = 900,  # 15 minutes in seconds
        window_duration: int = 900     # 15 minutes window
    ):
        self.max_attempts = max_attempts
        self.lockout_duration = lockout_duration
        self.window_duration = window_duration
        
        # Track attempts: {"ip": [(timestamp, username), ...]}
        self._ip_attempts: Dict[str, list] = defaultdict(list)
        # Track username attempts: {"username": [(timestamp, ip), ...]}
        self._username_attempts: Dict[str, list] = defaultdict(list)
        # Track lockouts: {"ip": unlock_timestamp}
        self._ip_lockouts: Dict[str, float] = {}
        # Track username lockouts
        self._username_lockouts: Dict[str, float] = {}
        
        self._lock = Lock()
    
    def _cleanup_old_attempts(self, attempts_list: list, current_time: float) -> list:
        """Remove attempts older than window_duration"""
        cutoff = current_time - self.window_duration
        return [attempt for attempt in attempts_list if attempt[0] > cutoff]
    
    def _cleanup_expired_lockouts(self, lockouts_dict: dict, current_time: float):
        """Remove expired lockouts"""
        expired_keys = [
            key for key, unlock_time in lockouts_dict.items() 
            if unlock_time <= current_time
        ]
        for key in expired_keys:
            del lockouts_dict[key]
    
    def _is_locked(self, identifier: str, lockouts: dict, current_time: float) -> Tuple[bool, int]:
        """Check if identifier is locked and return remaining lockout time"""
        if identifier in lockouts:
            unlock_time = lockouts[identifier]
            if unlock_time > current_time:
                remaining = int(unlock_time - current_time)
                return True, remaining
            else:
                # Lockout expired, remove it
                del lockouts[identifier]
        return False, 0
    
    def check_ip(self, ip: str) -> Tuple[bool, int]:
        """Check if IP is locked out. Returns (is_locked, remaining_seconds)"""
        with self._lock:
            current_time = time.time()
            self._cleanup_expired_lockouts(self._ip_lockouts, current_time)
            return self._is_locked(ip, self._ip_lockouts, current_time)
    
    def check_username(self, username: str) -> Tuple[bool, int]:
        """Check if username is locked out. Returns (is_locked, remaining_seconds)"""
        with self._lock:
            current_time = time.time()
            self._cleanup_expired_lockouts(self._username_lockouts, current_time)
            return self._is_locked(username, self._username_lockouts, current_time)
    
    def record_failed_attempt(self, ip: str, username: str) -> Tuple[bool, int]:
        """
        Record a failed login attempt.
        Returns (is_now_locked, remaining_lockout_seconds)
        """
        with self._lock:
            current_time = time.time()
            
            # Cleanup old attempts
            self._ip_attempts[ip] = self._cleanup_old_attempts(self._ip_attempts[ip], current_time)
            self._username_attempts[username] = self._cleanup_old_attempts(
                self._username_attempts[username], current_time
            )
            
            # Add new attempt
            self._ip_attempts[ip].append((current_time, username))
            self._username_attempts[username].append((current_time, ip))
            
            # Count recent attempts
            ip_attempt_count = len(self._ip_attempts[ip])
            username_attempt_count = len(self._username_attempts[username])
            
            logger.warning(
                f"Failed login attempt - IP: {ip}, Username: {username}, "
                f"IP attempts: {ip_attempt_count}/{self.max_attempts}, "
                f"Username attempts: {username_attempt_count}/{self.max_attempts}"
            )
            
            # Check if should lock IP
            if ip_attempt_count >= self.max_attempts:
                self._ip_lockouts[ip] = current_time + self.lockout_duration
                logger.warning(f"IP {ip} has been locked out for {self.lockout_duration} seconds")
                return True, self.lockout_duration
            
            # Check if should lock username
            if username_attempt_count >= self.max_attempts:
                self._username_lockouts[username] = current_time + self.lockout_duration
                logger.warning(
                    f"Username {username} has been locked out for {self.lockout_duration} seconds"
                )
                return True, self.lockout_duration
            
            return False, 0
    
    def record_successful_login(self, ip: str, username: str):
        """Clear failed attempts after successful login"""
        with self._lock:
            if ip in self._ip_attempts:
                del self._ip_attempts[ip]
            if username in self._username_attempts:
                del self._username_attempts[username]
            logger.info(f"Successful login - Cleared attempt tracking for IP: {ip}, Username: {username}")
    
    def get_attempt_info(self, ip: str, username: str) -> dict:
        """Get current attempt information for monitoring"""
        with self._lock:
            current_time = time.time()
            self._cleanup_old_attempts(self._ip_attempts.get(ip, []), current_time)
            self._cleanup_old_attempts(self._username_attempts.get(username, []), current_time)
            
            ip_locked, ip_remaining = self._is_locked(ip, self._ip_lockouts, current_time)
            username_locked, username_remaining = self._is_locked(
                username, self._username_lockouts, current_time
            )
            
            return {
                "ip_attempts": len(self._ip_attempts.get(ip, [])),
                "username_attempts": len(self._username_attempts.get(username, [])),
                "ip_locked": ip_locked,
                "ip_lockout_remaining": ip_remaining,
                "username_locked": username_locked,
                "username_lockout_remaining": username_remaining
            }


# Global instance
login_rate_limiter = LoginRateLimiter(
    max_attempts=5,
    lockout_duration=900,  # 15 minutes
    window_duration=900   # 15 minutes
)
