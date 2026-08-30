import os
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ParcelPilot"
    DATABASE_URL: str = "postgresql://user:password@localhost/parcelpilot"
    SECRET_KEY: str 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    POSTGRES_USER: str = "user"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "parcelpilot"

    model_config = ConfigDict(env_file='.env', extra='ignore')

settings = Settings()
