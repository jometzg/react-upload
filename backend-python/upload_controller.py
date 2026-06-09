import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from azure.storage.blob import BlobSasPermissions, generate_blob_sas
from config import blob_service_client, max_file_size_bytes, uploads_container_name


def sanitize_base_name(file_name: str) -> str:
    """Remove path components and replace invalid characters."""
    import re
    # Get just the filename without any path
    base_name = file_name.split("\\")[-1].split("/")[-1] if file_name else "upload.bin"
    # Replace invalid characters with underscores
    return re.sub(r"[^a-zA-Z0-9._-]", "_", base_name)


def build_blob_name(file_name: str) -> str:
    """Build a unique blob name with timestamp and UUID."""
    clean_name = sanitize_base_name(file_name)
    timestamp = datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    unique_id = uuid4()
    return f"{timestamp}-{unique_id}-{clean_name}"


def create_upload_sas(request_body: dict) -> dict:
    """Generate a User Delegation SAS token for blob upload."""
    file_name = request_body.get("fileName")
    file_size = request_body.get("fileSize")
    content_type = request_body.get("contentType", "application/octet-stream")

    # Validate inputs
    if not file_name or not isinstance(file_name, str):
        raise ValueError("fileName is required and must be a string")

    if not isinstance(file_size, (int, float)) or file_size <= 0:
        raise ValueError("fileSize must be a positive number")

    if file_size > max_file_size_bytes:
        max_mb = max_file_size_bytes // (1024 * 1024)
        raise ValueError(f"fileSize exceeds MAX_FILE_SIZE_MB ({max_mb} MB)")

    account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
    blob_name = build_blob_name(file_name)

    sas_lifetime_minutes = int(os.getenv("SAS_EXPIRY_MINUTES", 20))

    # Create a User Delegation SAS
    starts_on = datetime.now(timezone.utc) - timedelta(minutes=5)
    expires_on = datetime.now(timezone.utc) + timedelta(minutes=sas_lifetime_minutes)

    # Get user delegation key
    delegation_key = blob_service_client.get_user_delegation_key(starts_on, expires_on)

    # Generate SAS token
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=uploads_container_name,
        blob_name=blob_name,
        user_delegation_key=delegation_key,
        permission=BlobSasPermissions(create=True, write=True),
        start=starts_on,
        expiry=expires_on,
    )

    upload_url = f"https://{account_name}.blob.core.windows.net/{uploads_container_name}/{blob_name}?{sas_token}"

    return {
        "uploadUrl": upload_url,
        "blobName": blob_name,
        "containerName": uploads_container_name,
        "expiresOn": expires_on.isoformat(),
    }
