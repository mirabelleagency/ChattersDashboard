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
    if not file.filename or not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")

    # Save uploaded file to temp location
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            content = file.file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Import using existing logic (we'll adapt import_excel.main to return stats)
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
