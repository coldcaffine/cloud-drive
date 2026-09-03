from supabase import create_client
from google.auth.transport import requests
from google.oauth2 import id_token
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_id,
)
from models import User, Folder, File, Share, LinkShare
from database import Base, engine, SessionLocal
from sqlalchemy.orm import Session
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, UploadFile
from datetime import datetime, timezone, timedelta
import os
import secrets

from dotenv import load_dotenv

load_dotenv()


# ============================================================
# SUPABASE
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


# ============================================================
# GOOGLE LOGIN
# ============================================================

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "https://cloud-drive-frontend.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ============================================================
# FILE PERMISSION HELPER
# ============================================================

def get_file_permission(
    file_id: int,
    user_id: int,
    db: Session
):
    file = db.query(File).filter(
        File.id == file_id,
        File.is_deleted == False
    ).first()

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    if file.owner_id == user_id:
        return file, "owner"

    share = db.query(Share).filter(
        Share.resource_type == "file",
        Share.resource_id == file_id,
        Share.shared_with_id == user_id
    ).first()

    if not share:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    return file, share.role


# ============================================================
# REQUEST MODELS
# ============================================================

class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


class FolderCreateRequest(BaseModel):
    name: str
    parent_id: int | None = None


class FileMoveRequest(BaseModel):
    folder_id: int | None = None


class ShareCreateRequest(BaseModel):
    resource_type: str
    resource_id: int
    shared_with_email: str
    role: str = "viewer"


class PublicLinkRequest(BaseModel):
    resource_type: str
    resource_id: int
    expires_in_hours: int | None = 24


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "message": "CloudDrive backend is running"
    }


# ============================================================
# AUTH — REGISTER
# ============================================================

@app.post("/auth/register")
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(
        User.email == payload.email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": new_user.id,
        "email": new_user.email
    }


# ============================================================
# AUTH — EMAIL LOGIN
# ============================================================

@app.post("/auth/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == payload.email
    ).first()

    if not user or not verify_password(
        payload.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token({
        "sub": str(user.id)
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# ============================================================
# AUTH — GOOGLE LOGIN
# ============================================================

@app.post("/auth/google")
def google_login(
    payload: GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured"
        )

    try:
        google_data = id_token.verify_oauth2_token(
            payload.credential,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )

    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google credential"
        )

    email = google_data.get("email")

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Google account email not found"
        )

    if not google_data.get("email_verified"):
        raise HTTPException(
            status_code=401,
            detail="Google email is not verified"
        )

    user = db.query(User).filter(
        User.email == email
    ).first()

    if not user:
        user = User(
            email=email,
            hashed_password=hash_password(
                secrets.token_urlsafe(32)
            )
        )

        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({
        "sub": str(user.id)
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# ============================================================
# FOLDERS — CREATE
# ============================================================

@app.post("/folders")
def create_folder(
    payload: FolderCreateRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    new_folder = Folder(
        name=payload.name,
        owner_id=user_id,
        parent_id=payload.parent_id
    )

    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)

    return {
        "id": new_folder.id,
        "name": new_folder.name
    }


# ============================================================
# FOLDERS — LIST
# ============================================================

@app.get("/folders")
def list_folders(
    parent_id: int | None = None,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    query = db.query(Folder).filter(
        Folder.owner_id == user_id,
        Folder.is_deleted == False
    )

    query = query.filter(
        Folder.parent_id == parent_id
    )

    return [
        {
            "id": folder.id,
            "name": folder.name,
            "parent_id": folder.parent_id
        }
        for folder in query.all()
    ]


# ============================================================
# FILES — UPLOAD
# ============================================================

@app.post("/files/upload")
async def upload_file(
    file: UploadFile,
    folder_id: int = None,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    contents = await file.read()

    path = (
        f"{user_id}/"
        f"{secrets.token_urlsafe(8)}_"
        f"{file.filename}"
    )

    supabase.storage.from_("files").upload(
        path,
        contents
    )

    new_file = File(
        name=file.filename,
        owner_id=user_id,
        folder_id=folder_id,
        storage_path=path,
        size=len(contents)
    )

    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    return {
        "id": new_file.id,
        "name": new_file.name
    }


# ============================================================
# FOLDERS — DELETE
# ============================================================

@app.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Folder not found"
        )

    folder.is_deleted = True
    db.commit()

    return {
        "status": "deleted"
    }


# ============================================================
# FILES — DELETE
# ============================================================

@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    file, role = get_file_permission(
        file_id,
        user_id,
        db
    )

    if role not in ("owner", "editor"):
        raise HTTPException(
            status_code=403,
            detail="Viewer cannot delete files"
        )

    file.is_deleted = True
    db.commit()

    return {
        "status": "deleted"
    }


# ============================================================
# FOLDERS — RENAME
# ============================================================

@app.patch("/folders/{folder_id}/rename")
def rename_folder(
    folder_id: int,
    name: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Folder not found"
        )

    folder.name = name
    db.commit()

    return {
        "id": folder.id,
        "name": folder.name
    }


# ============================================================
# FILES — LIST
# ============================================================

@app.get("/files")
def list_files(
    folder_id: int = None,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    query = db.query(File).filter(
        File.owner_id == user_id,
        File.is_deleted == False
    )

    if folder_id is not None:
        query = query.filter(
            File.folder_id == folder_id
        )

    files = query.all()

    return [
        {
            "id": file.id,
            "name": file.name,
            "folder_id": file.folder_id,
            "size": file.size
        }
        for file in files
    ]


# ============================================================
# FILES — MOVE
# ============================================================

@app.patch("/files/{file_id}/move")
def move_file(
    file_id: int,
    payload: FileMoveRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    file, role = get_file_permission(
        file_id,
        user_id,
        db
    )

    if role not in ("owner", "editor"):
        raise HTTPException(
            status_code=403,
            detail="Viewer cannot move files"
        )

    file.folder_id = payload.folder_id
    db.commit()

    return {
        "id": file.id,
        "folder_id": file.folder_id
    }


# ============================================================
# SHARING — CREATE
# ============================================================

@app.post("/shares")
def create_share(
    payload: ShareCreateRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    if payload.resource_type not in ("file", "folder"):
        raise HTTPException(
            status_code=400,
            detail="resource_type must be 'file' or 'folder'"
        )

    if payload.role not in ("viewer", "editor"):
        raise HTTPException(
            status_code=400,
            detail="role must be 'viewer' or 'editor'"
        )

    if payload.resource_type == "file":
        resource = db.query(File).filter(
            File.id == payload.resource_id,
            File.owner_id == user_id
        ).first()

    else:
        resource = db.query(Folder).filter(
            Folder.id == payload.resource_id,
            Folder.owner_id == user_id
        ).first()

    if not resource:
        raise HTTPException(
            status_code=404,
            detail=f"{payload.resource_type} not found"
        )

    target_user = db.query(User).filter(
        User.email == payload.shared_with_email
    ).first()

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="User with that email not found"
        )

    if target_user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot share with yourself"
        )

    new_share = Share(
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        owner_id=user_id,
        shared_with_id=target_user.id,
        role=payload.role
    )

    db.add(new_share)
    db.commit()
    db.refresh(new_share)

    return {
        "id": new_share.id,
        "resource_type": new_share.resource_type,
        "resource_id": new_share.resource_id,
        "shared_with_email": payload.shared_with_email,
        "role": new_share.role
    }


# ============================================================
# SHARING — LIST WITH ME
# ============================================================

@app.get("/shares/with-me")
def list_shares_with_me(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    shares = db.query(Share).filter(
        Share.shared_with_id == user_id
    ).all()

    return [
        {
            "id": share.id,
            "resource_type": share.resource_type,
            "resource_id": share.resource_id,
            "role": share.role
        }
        for share in shares
    ]


# ============================================================
# SHARING — DELETE
# ============================================================

@app.delete("/shares/{share_id}")
def delete_share(
    share_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    share = db.query(Share).filter(
        Share.id == share_id,
        Share.owner_id == user_id
    ).first()

    if not share:
        raise HTTPException(
            status_code=404,
            detail="Share not found"
        )

    db.delete(share)
    db.commit()

    return {
        "status": "deleted"
    }


# ============================================================
# TRASH
# ============================================================

@app.get("/trash")
def list_trash(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    files = db.query(File).filter(
        File.owner_id == user_id,
        File.is_deleted == True
    ).all()

    folders = db.query(Folder).filter(
        Folder.owner_id == user_id,
        Folder.is_deleted == True
    ).all()

    return {
        "files": [
            {
                "id": file.id,
                "name": file.name,
                "folder_id": file.folder_id,
                "size": file.size
            }
            for file in files
        ],
        "folders": [
            {
                "id": folder.id,
                "name": folder.name,
                "parent_id": folder.parent_id
            }
            for folder in folders
        ]
    }


# ============================================================
# FILES — RESTORE
# ============================================================

@app.patch("/files/{file_id}/restore")
def restore_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    file = db.query(File).filter(
        File.id == file_id,
        File.owner_id == user_id,
        File.is_deleted == True
    ).first()

    if not file:
        raise HTTPException(
            status_code=404,
            detail="Deleted file not found"
        )

    file.is_deleted = False
    db.commit()

    return {
        "id": file.id,
        "name": file.name,
        "status": "restored"
    }


# ============================================================
# FOLDERS — RESTORE
# ============================================================

@app.patch("/folders/{folder_id}/restore")
def restore_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id,
        Folder.is_deleted == True
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Deleted folder not found"
        )

    folder.is_deleted = False
    db.commit()

    return {
        "id": folder.id,
        "name": folder.name,
        "status": "restored"
    }


# ============================================================
# SEARCH
# ============================================================

@app.get("/search")
def search_items(
    q: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    search_term = f"%{q}%"

    files = db.query(File).filter(
        File.owner_id == user_id,
        File.is_deleted == False,
        File.name.ilike(search_term)
    ).all()

    folders = db.query(Folder).filter(
        Folder.owner_id == user_id,
        Folder.is_deleted == False,
        Folder.name.ilike(search_term)
    ).all()

    return {
        "files": [
            {
                "id": file.id,
                "name": file.name,
                "folder_id": file.folder_id,
                "size": file.size
            }
            for file in files
        ],
        "folders": [
            {
                "id": folder.id,
                "name": folder.name,
                "parent_id": folder.parent_id
            }
            for folder in folders
        ]
    }


# ============================================================
# FILES — RENAME
# ============================================================

@app.patch("/files/{file_id}/rename")
def rename_file(
    file_id: int,
    name: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    file, role = get_file_permission(
        file_id,
        user_id,
        db
    )

    if role not in ("owner", "editor"):
        raise HTTPException(
            status_code=403,
            detail="Viewer cannot rename files"
        )

    if not name.strip():
        raise HTTPException(
            status_code=400,
            detail="File name cannot be empty"
        )

    file.name = name.strip()
    db.commit()

    return {
        "id": file.id,
        "name": file.name
    }


# ============================================================
# FILES — DOWNLOAD
# ============================================================

@app.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    file, role = get_file_permission(
        file_id,
        user_id,
        db
    )

    try:
        result = supabase.storage.from_(
            "files"
        ).create_signed_url(
            file.storage_path,
            3600
        )

        return {
            "id": file.id,
            "name": file.name,
            "download_url": result["signedURL"]
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not generate download URL"
        )
# STARRED
# ===========================================


@app.post("/files/{file_id}/star")
def toggle_star(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    file = db.query(File).filter(
        File.id == file_id,
        File.owner_id == user_id,
        File.is_deleted == False
    ).first()

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    file.is_starred = not file.is_starred

    db.commit()
    db.refresh(file)

    return {
        "id": file.id,
        "name": file.name,
        "is_starred": file.is_starred
    }


@app.post("/folders/{folder_id}/star")
def toggle_folder_star(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id,
        Folder.is_deleted == False
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Folder not found"
        )

    folder.is_starred = not folder.is_starred

    db.commit()
    db.refresh(folder)

    return {
        "id": folder.id,
        "name": folder.name,
        "is_starred": folder.is_starred
    }


@app.get("/starred")
def get_starred(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    files = db.query(File).filter(
        File.owner_id == user_id,
        File.is_deleted == False,
        File.is_starred == True
    ).all()

    return {
        "files": files,
        "folders": []
    }

# ============================================================
# PUBLIC LINKS — CREATE
# ============================================================


@app.post("/public-link")
def create_public_link(
    payload: PublicLinkRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    if payload.resource_type not in ("file", "folder"):
        raise HTTPException(
            status_code=400,
            detail="resource_type must be 'file' or 'folder'"
        )

    if payload.resource_type == "file":
        resource = db.query(File).filter(
            File.id == payload.resource_id,
            File.owner_id == user_id,
            File.is_deleted == False
        ).first()

    else:
        resource = db.query(Folder).filter(
            Folder.id == payload.resource_id,
            Folder.owner_id == user_id,
            Folder.is_deleted == False
        ).first()

    if not resource:
        raise HTTPException(
            status_code=404,
            detail=f"{payload.resource_type} not found"
        )

    token = secrets.token_urlsafe(32)

    expires_at = None

    if payload.expires_in_hours is not None:

        if payload.expires_in_hours <= 0:
            raise HTTPException(
                status_code=400,
                detail="expires_in_hours must be greater than 0"
            )

        expires_at = (
            datetime.now(timezone.utc)
            + timedelta(
                hours=payload.expires_in_hours
            )
        )

    link = LinkShare(
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        owner_id=user_id,
        token=token,
        expires_at=expires_at
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    return {
        "id": link.id,
        "token": link.token,
        "resource_type": link.resource_type,
        "resource_id": link.resource_id,
        "expires_at": link.expires_at
    }


# ============================================================
# PUBLIC LINKS — ACCESS
# ============================================================

@app.get("/public/{token}")
def access_public_link(
    token: str,
    db: Session = Depends(get_db)
):
    link = (
        db.query(LinkShare)
        .filter(
            LinkShare.token == token
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Public link not found"
        )

    if (
        link.expires_at is not None
        and link.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=410,
            detail="Public link has expired"
        )

    if link.resource_type == "file":

        resource = (
            db.query(File)
            .filter(
                File.id == link.resource_id,
                File.is_deleted == False
            )
            .first()
        )

        if not resource:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        return {
            "resource_type": "file",
            "id": resource.id,
            "name": resource.name,
            "size": resource.size,
            "download_url": (
                supabase
                .storage
                .from_("files")
                .create_signed_url(
                    resource.storage_path,
                    3600
                )["signedURL"]
            )
        }

    resource = (
        db.query(Folder)
        .filter(
            Folder.id == link.resource_id,
            Folder.is_deleted == False
        )
        .first()
    )

    if not resource:
        raise HTTPException(
            status_code=404,
            detail="Folder not found"
        )

    return {
        "resource_type": "folder",
        "id": resource.id,
        "name": resource.name
    }
# STARRED
# ===========================================


@app.post("/files/{file_id}/star")
def toggle_star(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    file = db.query(File).filter(
        File.id == file_id,
        File.owner_id == user_id,
        File.is_deleted == False
    ).first()

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    file.is_starred = not file.is_starred

    db.commit()
    db.refresh(file)

    return {
        "id": file.id,
        "name": file.name,
        "is_starred": file.is_starred
    }


@app.get("/starred")
def get_starred(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    files = db.query(File).filter(
        File.owner_id == user_id,
        File.is_deleted == False,
        File.is_starred == True
    ).all()

    return {
        "files": files,
        "folders": []
    }
