from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..db import get_db
from ..security.auth import get_current_user, require_roles
from .. import models
import tempfile
import os

router = APIRouter()


@router.post("/import/excel")
def import_excel_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("admin", "manager"))
):
    """
    Upload and process Excel file (Sheet3 format).
    Returns summary of import: teams/chatters/records created/updated.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Only Excel or CSV files (.xlsx, .xls, .csv) are supported")

    # Save uploaded file to temp location
    tmp_path = None
    try:
        ext = os.path.splitext(file.filename or '')[1] or '.xlsx'
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = file.file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Import using extended logic that supports both Excel and CSV
        from ..import_excel import import_from_file
        stats = import_from_file(db, tmp_path)

        return {
            "status": "success",
            "filename": file.filename,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
