from datetime import datetime, timezone, timedelta
import os
import secrets

from fastapi import FastAPI, Depends, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import Base, engine, SessionLocal
from models import User, Folder, File, Share, LinkShare
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_id,
)

from supabase import create_client


# ============================================================
# SUPABASE
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
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
# PERMISSION HELPERS
# ============================================================

def get_file_permission(file_id: int, user_id: int, db: Session):
    file = db.query(File).filter(
        File.id == file_id,
        File.is_deleted == False,
    ).first()

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    # Owner has full access
    if file.owner_id == user_id:
        return file, "owner"

    # Check direct file share
    share = db.query(Share).filter(
        Share.resource_type == "file",
        Share.resource_id == file_id,
        Share.shared_with_id == user_id,
    ).first()

    if not share:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    return file, share.role


def user_has_folder_access(
    folder_id: int,
    user_id: int,
    db: Session,
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.is_deleted == False,
    ).first()

    if not folder:
        return False

    # Owner has access
    if folder.owner_id == user_id:
        return True

    current_folder = folder

    # Check the folder and its parent folders
    while current_folder:

        share = db.query(Share).filter(
            Share.resource_type == "folder",
            Share.resource_id == current_folder.id,
            Share.shared_with_id == user_id,
        ).first()

        if share:
            return True

        if current_folder.parent_id is None:
            break

        current_folder = db.query(Folder).filter(
            Folder.id == current_folder.parent_id,
            Folder.is_deleted == False,
        ).first()

    return False


# ============================================================
# REQUEST MODELS
# ============================================================

class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


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


# FIX:
# React sends rename data as JSON:
# {
#     "name": "new name"
# }
class RenameRequest(BaseModel):
    name: str


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "message": "CloudDrive backend is running",
    }


# ============================================================
# AUTH
# ============================================================

@app.post("/auth/register")
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(
        User.email == payload.email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    new_user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": new_user.id,
        "email": new_user.email,
    }


@app.post("/auth/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.email == payload.email
    ).first()

    if not user or not verify_password(
        payload.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_access_token({
        "sub": str(user.id)
    })

    return {
        "access_token": token,
        "token_type": "bearer",
    }


# ============================================================
# FOLDERS
# ============================================================

@app.post("/folders")
def create_folder(
    payload: FolderCreateRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    # If creating inside another folder,
    # make sure that folder belongs to the user.
    if payload.parent_id is not None:
        parent = db.query(Folder).filter(
            Folder.id == payload.parent_id,
            Folder.owner_id == user_id,
            Folder.is_deleted == False,
        ).first()

        if not parent:
            raise HTTPException(
                status_code=404,
                detail="Parent folder not found",
            )

    new_folder = Folder(
        name=payload.name.strip(),
        owner_id=user_id,
        parent_id=payload.parent_id,
    )

    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)

    return {
        "id": new_folder.id,
        "name": new_folder.name,
    }


@app.get("/folders")
def list_folders(
    parent_id: int | None = None,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    query = db.query(Folder).filter(
        Folder.owner_id == user_id,
        Folder.is_deleted == False,
    )

    query = query.filter(
        Folder.parent_id == parent_id
    )

    return [
        {
            "id": folder.id,
            "name": folder.name,
            "parent_id": folder.parent_id,
        }
        for folder in query.all()
    ]


@app.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id,
        Folder.is_deleted == False,
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Folder not found",
        )

    folder.is_deleted = True

    db.commit()

    return {
        "status": "deleted"
    }


# ============================================================
# FOLDER RENAME
# ============================================================

@app.patch("/folders/{folder_id}/rename")
def rename_folder(
    folder_id: int,
    payload: RenameRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id,
        Folder.is_deleted == False,
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Folder not found",
        )

    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Folder name cannot be empty",
        )

    folder.name = name

    db.commit()
    db.refresh(folder)

    return {
        "id": folder.id,
        "name": folder.name,
    }


# ============================================================
# FOLDER RESTORE
# ============================================================

@app.patch("/folders/{folder_id}/restore")
def restore_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id,
        Folder.is_deleted == True,
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Deleted folder not found",
        )

    folder.is_deleted = False

    db.commit()

    return {
        "id": folder.id,
        "name": folder.name,
        "status": "restored",
    }


# ============================================================
# FILE UPLOAD
# ============================================================

@app.post("/files/upload")
async def upload_file(
    file: UploadFile,
    folder_id: int | None = None,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    # If uploading into a folder,
    # make sure that folder belongs to the user.
    if folder_id is not None:
        folder = db.query(Folder).filter(
            Folder.id == folder_id,
            Folder.owner_id == user_id,
            Folder.is_deleted == False,
        ).first()

        if not folder:
            raise HTTPException(
                status_code=404,
                detail="Folder not found",
            )

    contents = await file.read()

    path = (
        f"{user_id}/"
        f"{secrets.token_urlsafe(8)}_"
        f"{file.filename}"
    )

    try:
        supabase.storage.from_("files").upload(
            path,
            contents,
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not upload file to storage",
        )

    new_file = File(
        name=file.filename,
        owner_id=user_id,
        folder_id=folder_id,
        storage_path=path,
        size=len(contents),
    )

    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    return {
        "id": new_file.id,
        "name": new_file.name,
    }


# ============================================================
# FILE LIST
# ============================================================

@app.get("/files")
def list_files(
    folder_id: int | None = None,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    query = db.query(File).filter(
        File.owner_id == user_id,
        File.is_deleted == False,
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
            "size": file.size,
        }
        for file in files
    ]


# ============================================================
# FILE DELETE
# ============================================================

@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    file, role = get_file_permission(
        file_id,
        user_id,
        db,
    )

    if role not in ("owner", "editor"):
        raise HTTPException(
            status_code=403,
            detail="Viewer cannot delete files",
        )

    file.is_deleted = True

    db.commit()

    return {
        "status": "deleted"
    }


# ============================================================
# FILE RENAME
# ============================================================

@app.patch("/files/{file_id}/rename")
def rename_file(
    file_id: int,
    payload: RenameRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    file, role = get_file_permission(
        file_id,
        user_id,
        db,
    )

    if role not in ("owner", "editor"):
        raise HTTPException(
            status_code=403,
            detail="Viewer cannot rename files",
        )

    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="File name cannot be empty",
        )

    file.name = name

    db.commit()
    db.refresh(file)

    return {
        "id": file.id,
        "name": file.name,
    }


# ============================================================
# FILE MOVE
# ============================================================

@app.patch("/files/{file_id}/move")
def move_file(
    file_id: int,
    payload: FileMoveRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    file, role = get_file_permission(
        file_id,
        user_id,
        db,
    )

    if role not in ("owner", "editor"):
        raise HTTPException(
            status_code=403,
            detail="Viewer cannot move files",
        )

    if payload.folder_id is not None:
        folder = db.query(Folder).filter(
            Folder.id == payload.folder_id,
            Folder.owner_id == user_id,
            Folder.is_deleted == False,
        ).first()

        if not folder:
            raise HTTPException(
                status_code=404,
                detail="Destination folder not found",
            )

    file.folder_id = payload.folder_id

    db.commit()

    return {
        "id": file.id,
        "folder_id": file.folder_id,
    }


# ============================================================
# FILE DOWNLOAD
# ============================================================

@app.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    file, role = get_file_permission(
        file_id,
        user_id,
        db,
    )

    try:
        result = supabase.storage.from_(
            "files"
        ).create_signed_url(
            file.storage_path,
            3600,
        )

        return {
            "id": file.id,
            "name": file.name,
            "download_url": result["signedURL"],
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not generate download URL",
        )


# ============================================================
# SHARING
# ============================================================

@app.post("/shares")
def create_share(
    payload: ShareCreateRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if payload.resource_type not in (
        "file",
        "folder",
    ):
        raise HTTPException(
            status_code=400,
            detail="resource_type must be 'file' or 'folder'",
        )

    if payload.role not in (
        "viewer",
        "editor",
    ):
        raise HTTPException(
            status_code=400,
            detail="role must be 'viewer' or 'editor'",
        )

    if payload.resource_type == "file":

        resource = db.query(File).filter(
            File.id == payload.resource_id,
            File.owner_id == user_id,
            File.is_deleted == False,
        ).first()

    else:

        resource = db.query(Folder).filter(
            Folder.id == payload.resource_id,
            Folder.owner_id == user_id,
            Folder.is_deleted == False,
        ).first()

    if not resource:
        raise HTTPException(
            status_code=404,
            detail=f"{payload.resource_type} not found",
        )

    target_user = db.query(User).filter(
        User.email == payload.shared_with_email
    ).first()

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="User with that email not found",
        )

    if target_user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot share with yourself",
        )

    # Prevent duplicate share
    existing_share = db.query(Share).filter(
        Share.resource_type == payload.resource_type,
        Share.resource_id == payload.resource_id,
        Share.shared_with_id == target_user.id,
    ).first()

    if existing_share:
        existing_share.role = payload.role

        db.commit()
        db.refresh(existing_share)

        return {
            "id": existing_share.id,
            "resource_type": existing_share.resource_type,
            "resource_id": existing_share.resource_id,
            "shared_with_email": payload.shared_with_email,
            "role": existing_share.role,
        }

    new_share = Share(
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        owner_id=user_id,
        shared_with_id=target_user.id,
        role=payload.role,
    )

    db.add(new_share)
    db.commit()
    db.refresh(new_share)

    return {
        "id": new_share.id,
        "resource_type": new_share.resource_type,
        "resource_id": new_share.resource_id,
        "shared_with_email": payload.shared_with_email,
        "role": new_share.role,
    }


@app.get("/shares/with-me")
def list_shares_with_me(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    shares = db.query(Share).filter(
        Share.shared_with_id == user_id
    ).all()

    result = []

    for share in shares:

        item = {
            "id": share.id,
            "resource_type": share.resource_type,
            "resource_id": share.resource_id,
            "role": share.role,
        }

        if share.resource_type == "file":

            file = db.query(File).filter(
                File.id == share.resource_id,
                File.is_deleted == False,
            ).first()

            if file:
                item["name"] = file.name
                item["size"] = file.size
                item["folder_id"] = file.folder_id
            else:
                continue

        elif share.resource_type == "folder":

            folder = db.query(Folder).filter(
                Folder.id == share.resource_id,
                Folder.is_deleted == False,
            ).first()

            if folder:
                item["name"] = folder.name
                item["parent_id"] = folder.parent_id
            else:
                continue

        result.append(item)

    return result


@app.delete("/shares/{share_id}")
def delete_share(
    share_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    share = db.query(Share).filter(
        Share.id == share_id,
        Share.owner_id == user_id,
    ).first()

    if not share:
        raise HTTPException(
            status_code=404,
            detail="Share not found",
        )

    db.delete(share)
    db.commit()

    return {
        "status": "deleted"
    }


# ============================================================
# SHARED FOLDER ACCESS
# ============================================================

@app.get("/shared/folders/{folder_id}")
def open_shared_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.is_deleted == False,
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Folder not found",
        )

    if not user_has_folder_access(
        folder_id,
        user_id,
        db,
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this folder",
        )

    child_folders = db.query(Folder).filter(
        Folder.parent_id == folder_id,
        Folder.is_deleted == False,
    ).all()

    files = db.query(File).filter(
        File.folder_id == folder_id,
        File.is_deleted == False,
    ).all()

    return {
        "folder": {
            "id": folder.id,
            "name": folder.name,
            "owner_id": folder.owner_id,
        },

        "folders": [
            {
                "id": folder.id,
                "name": folder.name,
                "parent_id": folder.parent_id,
            }
            for folder in child_folders
        ],

        "files": [
            {
                "id": file.id,
                "name": file.name,
                "folder_id": file.folder_id,
                "size": file.size,
            }
            for file in files
        ],
    }


# ============================================================
# TRASH
# ============================================================

@app.get("/trash")
def list_trash(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    files = db.query(File).filter(
        File.owner_id == user_id,
        File.is_deleted == True,
    ).all()

    folders = db.query(Folder).filter(
        Folder.owner_id == user_id,
        Folder.is_deleted == True,
    ).all()

    return {
        "files": [
            {
                "id": file.id,
                "name": file.name,
                "folder_id": file.folder_id,
                "size": file.size,
            }
            for file in files
        ],

        "folders": [
            {
                "id": folder.id,
                "name": folder.name,
                "parent_id": folder.parent_id,
            }
            for folder in folders
        ],
    }


# ============================================================
# SEARCH
# ============================================================

@app.get("/search")
def search_items(
    q: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    search_term = f"%{q}%"

    files = db.query(File).filter(
        File.owner_id == user_id,
        File.is_deleted == False,
        File.name.ilike(search_term),
    ).all()

    folders = db.query(Folder).filter(
        Folder.owner_id == user_id,
        Folder.is_deleted == False,
        Folder.name.ilike(search_term),
    ).all()

    return {
        "files": [
            {
                "id": file.id,
                "name": file.name,
                "folder_id": file.folder_id,
                "size": file.size,
            }
            for file in files
        ],

        "folders": [
            {
                "id": folder.id,
                "name": folder.name,
                "parent_id": folder.parent_id,
            }
            for folder in folders
        ],
    }


# ============================================================
# PUBLIC LINKS
# ============================================================

@app.post("/public-link")
def create_public_link(
    payload: PublicLinkRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if payload.resource_type not in (
        "file",
        "folder",
    ):
        raise HTTPException(
            status_code=400,
            detail="resource_type must be 'file' or 'folder'",
        )

    if payload.resource_type == "file":

        resource = db.query(File).filter(
            File.id == payload.resource_id,
            File.owner_id == user_id,
            File.is_deleted == False,
        ).first()

    else:

        resource = db.query(Folder).filter(
            Folder.id == payload.resource_id,
            Folder.owner_id == user_id,
            Folder.is_deleted == False,
        ).first()

    if not resource:
        raise HTTPException(
            status_code=404,
            detail=f"{payload.resource_type} not found",
        )

    if (
        payload.expires_in_hours is not None
        and payload.expires_in_hours <= 0
    ):
        raise HTTPException(
            status_code=400,
            detail="expires_in_hours must be greater than 0",
        )

    token = secrets.token_urlsafe(32)

    expires_at = None

    if payload.expires_in_hours is not None:
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
        expires_at=expires_at,
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    return {
        "id": link.id,
        "token": link.token,
        "resource_type": link.resource_type,
        "resource_id": link.resource_id,
        "expires_at": link.expires_at,
    }


@app.get("/public/{token}")
def access_public_link(
    token: str,
    db: Session = Depends(get_db),
):
    link = db.query(LinkShare).filter(
        LinkShare.token == token
    ).first()

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Public link not found",
        )

    if (
        link.expires_at is not None
        and link.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=410,
            detail="Public link has expired",
        )

    if link.resource_type == "file":

        resource = db.query(File).filter(
            File.id == link.resource_id,
            File.is_deleted == False,
        ).first()

        if not resource:
            raise HTTPException(
                status_code=404,
                detail="File not found",
            )

        try:
            result = supabase.storage.from_(
                "files"
            ).create_signed_url(
                resource.storage_path,
                3600,
            )

            return {
                "type": "file",
                "id": resource.id,
                "name": resource.name,
                "download_url": result["signedURL"],
            }

        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Could not generate public download URL",
            )

    raise HTTPException(
        status_code=400,
        detail="Public folder links are not supported yet",
    )


# ============================================================
# STARRED
# ============================================================

@app.post("/files/{file_id}/star")
def star_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    file = db.query(File).filter(
        File.id == file_id,
        File.owner_id == user_id,
        File.is_deleted == False,
    ).first()

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    file.is_starred = True

    db.commit()
    db.refresh(file)

    return {
        "id": file.id,
        "is_starred": file.is_starred,
    }


@app.delete("/files/{file_id}/star")
def unstar_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    file = db.query(File).filter(
        File.id == file_id,
        File.owner_id == user_id,
        File.is_deleted == False,
    ).first()

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    file.is_starred = False

    db.commit()
    db.refresh(file)

    return {
        "id": file.id,
        "is_starred": file.is_starred,
    }


@app.post("/folders/{folder_id}/star")
def star_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id,
        Folder.is_deleted == False,
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Folder not found",
        )

    folder.is_starred = True

    db.commit()
    db.refresh(folder)

    return {
        "id": folder.id,
        "is_starred": folder.is_starred,
    }


@app.delete("/folders/{folder_id}/star")
def unstar_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner_id == user_id,
        Folder.is_deleted == False,
    ).first()

    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Folder not found",
        )

    folder.is_starred = False

    db.commit()
    db.refresh(folder)

    return {
        "id": folder.id,
        "is_starred": folder.is_starred,
    }


@app.get("/starred")
def list_starred(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    files = db.query(File).filter(
        File.owner_id == user_id,
        File.is_starred == True,
        File.is_deleted == False,
    ).all()

    folders = db.query(Folder).filter(
        Folder.owner_id == user_id,
        Folder.is_starred == True,
        Folder.is_deleted == False,
    ).all()

    return {
        "files": [
            {
                "id": file.id,
                "name": file.name,
                "folder_id": file.folder_id,
                "size": file.size,
            }
            for file in files
        ],

        "folders": [
            {
                "id": folder.id,
                "name": folder.name,
                "parent_id": folder.parent_id,
            }
            for folder in folders
        ],
    }
