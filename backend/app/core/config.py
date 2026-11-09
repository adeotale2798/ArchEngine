import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_TTL_MINUTES = int(os.environ["JWT_TTL_MINUTES"])
CORS_ORIGINS = [o.strip() for o in os.environ["CORS_ORIGINS"].split(",")]
ENGINE_VERSION = "1.0.0"
