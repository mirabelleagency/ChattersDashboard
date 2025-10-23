"""
Initial schema for of-chatters

Revision ID: 0001
Revises: 
Create Date: 2025-10-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # teams
    op.create_table(
        'teams',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False, unique=True),
    )

    # chatters
    op.create_table(
        'chatters',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('external_id', sa.String(length=255)),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('handle', sa.String(length=255)),
        sa.Column('email', sa.String(length=255)),
        sa.Column('phone', sa.String(length=50)),
        sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id', ondelete='SET NULL')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('hired_at', sa.DateTime(timezone=True)),
        sa.Column('left_at', sa.DateTime(timezone=True)),
        sa.Column('deleted_at', sa.DateTime(timezone=True)),
    )

    # shifts
    op.create_table(
        'shifts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('chatter_id', sa.Integer(), sa.ForeignKey('chatters.id'), nullable=False),
        sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id')),
        sa.Column('shift_date', sa.Date(), nullable=False),
        sa.Column('shift_day', sa.String(length=20)),
        sa.Column('scheduled_start', sa.DateTime(timezone=True)),
        sa.Column('scheduled_end', sa.DateTime(timezone=True)),
        sa.Column('actual_start', sa.DateTime(timezone=True)),
        sa.Column('actual_end', sa.DateTime(timezone=True)),
        sa.Column('scheduled_hours', sa.Numeric(6, 2)),
        sa.Column('actual_hours', sa.Numeric(6, 2)),
        sa.Column('remarks', sa.Text()),
        sa.Column('deleted_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_shifts_chatter_date', 'shifts', ['chatter_id', 'shift_date'])

    # performance_daily
    op.create_table(
        'performance_daily',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('chatter_id', sa.Integer(), sa.ForeignKey('chatters.id'), nullable=False),
        sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id')),
        sa.Column('shift_date', sa.Date(), nullable=False),
        sa.Column('sales_amount', sa.Numeric(12, 2)),
        sa.Column('sold_count', sa.Integer()),
        sa.Column('retention_count', sa.Integer()),
        sa.Column('unlock_count', sa.Integer()),
        sa.Column('total_sales', sa.Numeric(12, 2)),
        sa.Column('sph', sa.Numeric(10, 2)),
        sa.Column('art_interval', sa.Interval()),
        sa.Column('golden_ratio', sa.Numeric(10, 4)),
        sa.Column('hinge_top_up', sa.Numeric(12, 2)),
        sa.Column('tricks_tsf', sa.Numeric(12, 2)),
        sa.Column('conversion_rate', sa.Numeric(10, 4)),
        sa.Column('unlock_ratio', sa.Numeric(10, 4)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True)),
        sa.UniqueConstraint('chatter_id', 'shift_date', name='uq_perf_chatter_date'),
    )
    op.create_index('ix_perf_shift_date', 'performance_daily', ['shift_date'])
    op.create_index('ix_perf_chatter_date', 'performance_daily', ['chatter_id', 'shift_date'])

    # offenses
    op.create_table(
        'offenses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('chatter_id', sa.Integer(), sa.ForeignKey('chatters.id'), nullable=False),
        sa.Column('offense_type', sa.String(length=100)),
        sa.Column('offense', sa.Text()),
        sa.Column('offense_date', sa.Date()),
        sa.Column('details', sa.Text()),
        sa.Column('sanction', sa.Text()),
        sa.Column('deleted_at', sa.DateTime(timezone=True)),
    )

    # rankings_daily
    op.create_table(
        'rankings_daily',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('shift_date', sa.Date(), nullable=False),
        sa.Column('metric', sa.String(length=50), nullable=False),
        sa.Column('chatter_id', sa.Integer(), sa.ForeignKey('chatters.id'), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('metric_value', sa.Numeric(14, 4), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('shift_date', 'metric', 'chatter_id', name='uq_ranking_date_metric_chatter'),
    )

    # users, roles, permissions, audit_logs, attachments, saved_reports
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('full_name', sa.String(length=255)),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=50), unique=True, nullable=False),
    )

    op.create_table(
        'user_roles',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id'), primary_key=True),
    )

    op.create_table(
        'permissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(length=100), unique=True),
        sa.Column('description', sa.Text()),
    )

    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id'), primary_key=True),
        sa.Column('permission_id', sa.Integer(), sa.ForeignKey('permissions.id'), primary_key=True),
    )

    op.create_table(
        'audit_logs',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('action', sa.Text(), nullable=False),
        sa.Column('entity', sa.Text(), nullable=False),
        sa.Column('entity_id', sa.Text()),
        sa.Column('before_json', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('after_json', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('ip', sa.String(length=100)),
        sa.Column('user_agent', sa.Text()),
    )

    op.create_table(
        'attachments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('entity', sa.Text(), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.Text(), nullable=False),
        sa.Column('mime_type', sa.Text()),
        sa.Column('storage_url', sa.Text(), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'saved_reports',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('owner_user_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('config_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_public', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # helpful view v_chatter_daily
    op.execute(
        """
        CREATE OR REPLACE VIEW v_chatter_daily AS
        SELECT
            p.shift_date,
            c.id AS chatter_id,
            c.name AS chatter_name,
            t.name AS team_name,
            p.sales_amount,
            p.sold_count,
            p.retention_count,
            p.unlock_count,
            p.total_sales,
            p.sph,
            p.art_interval,
            p.golden_ratio,
            p.hinge_top_up,
            p.tricks_tsf,
            p.conversion_rate,
            p.unlock_ratio
        FROM performance_daily p
        LEFT JOIN chatters c ON c.id = p.chatter_id
        LEFT JOIN teams t ON t.id = p.team_id;
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_chatter_daily")
    op.drop_table('saved_reports')
    op.drop_table('attachments')
    op.drop_table('audit_logs')
    op.drop_table('role_permissions')
    op.drop_table('permissions')
    op.drop_table('user_roles')
    op.drop_table('roles')
    op.drop_table('users')
    op.drop_table('rankings_daily')
    op.drop_table('offenses')
    op.drop_index('ix_perf_chatter_date', table_name='performance_daily')
    op.drop_index('ix_perf_shift_date', table_name='performance_daily')
    op.drop_table('performance_daily')
    op.drop_index('ix_shifts_chatter_date', table_name='shifts')
    op.drop_table('shifts')
    op.drop_table('chatters')
    op.drop_table('teams')
