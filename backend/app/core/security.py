from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: str,
    role: str,
    restaurant_id: str,
    name: str = "",
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode = {
        "sub": subject,
        "role": role,
        "restaurant_id": restaurant_id,
        "name": name,
        "token_type": "staff",
        "exp": expire,
    }
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_session_token(
    session_id: str,
    restaurant_id: str,
    table_id: str,
    table_number: int,
    qr_token: str,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=12)
    to_encode = {
        "sub": session_id,
        "session_id": session_id,
        "restaurant_id": restaurant_id,
        "table_id": table_id,
        "table_number": table_number,
        "qr_token": qr_token,
        "role": "customer",
        "token_type": "table_session",
        "exp": expire,
    }
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        ) from exc


async def get_current_claims(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization bearer token",
        )
    return decode_token(credentials.credentials)


def require_roles(allowed_roles: List[str]):
    async def role_checker(claims: dict = Depends(get_current_claims)) -> dict:
        role = claims.get("role")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not authorized. Required: {allowed_roles}",
            )
        return claims

    return role_checker


def validate_ws_token(token: Optional[str], restaurant_id: str) -> Tuple[bool, Optional[dict]]:
    """Validate WebSocket query token (must be valid staff JWT or table_session token for restaurant_id)."""
    if not token:
        return False, None
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        token_rest_id = payload.get("restaurant_id")
        role = payload.get("role")
        if role == "super_admin" or token_rest_id == restaurant_id:
            return True, payload
        return False, None
    except JWTError:
        return False, None
