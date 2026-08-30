import uuid
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("parcelpilot")

class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = req_id
        
        # Log Request (safe fields only)
        logger.info(f"REQUEST method={request.method} path={request.url.path} request_id={req_id}")
        
        start_time = time.time()
        try:
            response = await call_next(request)
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log Response
            logger.info(f"RESPONSE method={request.method} path={request.url.path} status_code={response.status_code} duration_ms={duration_ms} request_id={req_id}")
            
            # Attach X-Request-ID to response headers
            response.headers["X-Request-ID"] = req_id
            return response
        except Exception as exc:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"RESPONSE method={request.method} path={request.url.path} status_code=500 duration_ms={duration_ms} request_id={req_id}")
            raise
