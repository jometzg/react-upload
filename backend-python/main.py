import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

# Load environment variables first
load_dotenv()

from config import ensure_uploads_container
from upload_controller import create_upload_sas

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Set up rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    try:
        ensure_uploads_container()
        logger.info("Backend startup successful")
    except Exception as e:
        logger.error(f"Backend startup failed: {e}")
        raise
    yield
    logger.info("Backend shutdown")


# Create FastAPI app
app = FastAPI(lifespan=lifespan)

# Apply rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda request, exc: HTTPException(
    status_code=429,
    detail="Rate limit exceeded"
))

# Configure CORS
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/upload/sas")
@limiter.limit("30/minute")
async def upload_sas(request: Request):
    """Generate a short-lived SAS token for blob upload."""
    try:
        body = await request.json()
        result = create_upload_sas(body)
        return result
    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating SAS: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
