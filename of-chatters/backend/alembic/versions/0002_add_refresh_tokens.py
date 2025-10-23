"""
add refresh_tokens table

Revision ID: 0002
Revises: 0001
Create Date: 2025-10-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('jti', sa.String(length=128), nullable=False, unique=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=True)),
        sa.Column('revoked', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )
    op.create_index('ix_refresh_tokens_jti', 'refresh_tokens', ['jti'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_refresh_tokens_jti', table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
