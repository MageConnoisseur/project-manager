"""Register a phone so website saves can wake it."""

from pydantic import BaseModel, Field


class DeviceRegisterRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    fcm_token: str = Field(min_length=1, max_length=512)
    platform: str = Field(default="android", max_length=32)


class DeviceDeleteRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)


class DeviceResponse(BaseModel):
    device_id: str
    platform: str
