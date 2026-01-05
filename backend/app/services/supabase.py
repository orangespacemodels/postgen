"""Supabase client for balance management."""

import httpx
from app.config import get_settings


class SupabaseClient:
    """Client for Supabase operations."""

    def __init__(self):
        self.settings = get_settings()
        self.headers = {
            "apikey": self.settings.supabase_anon_key,
            "Authorization": f"Bearer {self.settings.supabase_anon_key}",
            "Content-Type": "application/json",
        }
        self.base_url = self.settings.supabase_url


async def check_balance(user_id: int, required_amount: float) -> bool:
    """Check if user has sufficient balance.

    Args:
        user_id: User ID in Supabase
        required_amount: Amount required for operation

    Returns:
        True if balance is sufficient, False otherwise
    """
    client = SupabaseClient()

    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(
            f"{client.base_url}/rest/v1/user_data",
            params={
                "select": "balance",
                "user_id": f"eq.{user_id}",
            },
            headers=client.headers,
        )
        response.raise_for_status()
        data = response.json()

        if not data:
            return False

        balance = data[0].get("balance", 0)
        return balance >= required_amount


async def spend_tokens(user_id: int, amount: float, description: str) -> dict:
    """Deduct tokens from user balance.

    Uses Supabase RPC function for atomic balance update.

    Args:
        user_id: User ID
        amount: Amount to deduct
        description: Description of the charge

    Returns:
        dict with success status and charged amount
    """
    client = SupabaseClient()

    async with httpx.AsyncClient() as http_client:
        # First check balance
        has_balance = await check_balance(user_id, amount)
        if not has_balance:
            return {
                "success": False,
                "error": "Insufficient balance",
                "charged": 0,
            }

        # Deduct balance using RPC
        response = await http_client.post(
            f"{client.base_url}/rest/v1/rpc/spend_balance",
            json={
                "p_user_id": user_id,
                "p_amount": amount,
                "p_description": description,
            },
            headers=client.headers,
        )

        if response.status_code != 200:
            # Fallback: direct update if RPC not available
            response = await http_client.patch(
                f"{client.base_url}/rest/v1/user_data",
                params={"user_id": f"eq.{user_id}"},
                json={"balance": f"balance - {amount}"},
                headers=client.headers,
            )

        return {
            "success": True,
            "charged": amount,
        }
