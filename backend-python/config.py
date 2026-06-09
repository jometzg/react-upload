import os
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

# Load environment variables first
load_dotenv()

account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
if not account_name:
    raise ValueError("Missing AZURE_STORAGE_ACCOUNT_NAME in environment")

service_url = f"https://{account_name}.blob.core.windows.net"
credential = DefaultAzureCredential()

blob_service_client = BlobServiceClient(service_url, credential=credential)
uploads_container_name = os.getenv("AZURE_STORAGE_BLOB_CONTAINER_NAME", "uploads")
max_file_size_bytes = int(os.getenv("MAX_FILE_SIZE_MB", 1024)) * 1024 * 1024


def ensure_uploads_container():
    """Create the uploads container if it doesn't exist."""
    try:
        container_client = blob_service_client.get_container_client(uploads_container_name)
        container_client.create_container()
    except Exception as e:
        # Container might already exist (409 Conflict), which is fine
        if "ContainerAlreadyExists" not in str(e) and "AlreadyExists" not in str(e):
            raise
