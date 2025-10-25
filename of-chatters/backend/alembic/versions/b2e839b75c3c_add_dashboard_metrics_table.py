"""add dashboard_metrics table

Revision ID: b2e839b75c3c
Revises: a6d07adc10ea
Create Date: 2025-10-25 10:05:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2e839b75c3c"
down_revision: Union[str, None] = "a6d07adc10ea"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dashboard_metrics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("chatter_name", sa.String(length=255), nullable=False),
    sa.Column("total_sales", sa.Numeric(12, 2), nullable=True, server_default=sa.text("0")),
    sa.Column("worked_hours", sa.Numeric(10, 2), nullable=True, server_default=sa.text("0")),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("sph", sa.Numeric(10, 2), nullable=True),
        sa.Column("art", sa.String(length=50), nullable=True),
        sa.Column("gr", sa.Numeric(10, 2), nullable=True),
        sa.Column("ur", sa.Numeric(10, 2), nullable=True),
        sa.Column("ranking", sa.Integer(), nullable=True),
        sa.Column("shift", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_dashboard_metrics_chatter_name", "dashboard_metrics", ["chatter_name"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_dashboard_metrics_chatter_name", table_name="dashboard_metrics")
    op.drop_table("dashboard_metrics")
