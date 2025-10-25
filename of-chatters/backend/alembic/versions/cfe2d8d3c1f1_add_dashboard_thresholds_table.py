"""add dashboard_thresholds table

Revision ID: cfe2d8d3c1f1
Revises: b2e839b75c3c
Create Date: 2025-10-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "cfe2d8d3c1f1"
down_revision: Union[str, None] = "b2e839b75c3c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	op.create_table(
		"dashboard_thresholds",
		sa.Column("id", sa.Integer(), primary_key=True),
		sa.Column("excellent_min", sa.Numeric(10, 2), nullable=False, server_default=sa.text("100")),
		sa.Column("review_max", sa.Numeric(10, 2), nullable=False, server_default=sa.text("40")),
		sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
	)
	# seed a singleton row with defaults
	op.execute("INSERT INTO dashboard_thresholds (id, excellent_min, review_max) VALUES (1, 100, 40)")


def downgrade() -> None:
	op.drop_table("dashboard_thresholds")

