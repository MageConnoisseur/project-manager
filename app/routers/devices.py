"""Register and remove a phone's Firebase token."""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select

from app.core.dependencies import get_current_user, get_db
from app.models import Device, User
from app.schemas.device import DeviceDeleteRequest, DeviceRegisterRequest, DeviceResponse
from app.utils.time import utc_now

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("", response_model=DeviceResponse)
def register_device(
    body: DeviceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeviceResponse:
    """Save or replace the Firebase token for this phone."""
    existing = db.exec(
        select(Device).where(
            Device.user_id == current_user.id,
            Device.device_id == body.device_id,
        )
    ).first()

    if existing is None:
        existing = Device(
            user_id=current_user.id,
            device_id=body.device_id,
            fcm_token=body.fcm_token,
            platform=body.platform,
        )
    else:
        existing.fcm_token = body.fcm_token
        existing.platform = body.platform
        existing.updated_at = utc_now()

    db.add(existing)
    db.commit()
    return DeviceResponse(device_id=existing.device_id, platform=existing.platform)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    body: DeviceDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Forget this phone. Later website saves will not push to it."""
    existing = db.exec(
        select(Device).where(
            Device.user_id == current_user.id,
            Device.device_id == body.device_id,
        )
    ).first()
    if existing is not None:
        db.delete(existing)
        db.commit()
