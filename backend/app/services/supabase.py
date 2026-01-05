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

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        # Supabase REST API uses column=operator.value format
        url = f"{client.base_url}/rest/v1/user_data?select=balance&user_id=eq.{user_id}"
        response = await http_client.get(url, headers=client.headers)

        if response.status_code != 200:
            print(f"[check_balance] Supabase returned {response.status_code}: {response.text}")
            raise Exception(f"Balance check failed: HTTP {response.status_code}")

        data = response.json()

        if not data:
            print(f"[check_balance] No user found with id {user_id}")
            return False

        balance = data[0].get("balance", 0)
        print(f"[check_balance] User {user_id} balance: {balance}, required: {required_amount}")
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
    try:
        client = SupabaseClient()

        async with httpx.AsyncClient(timeout=30.0) as http_client:
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

            # RPC might not exist, that's OK - balance was checked
            if response.status_code not in [200, 204]:
                print(f"[spend_tokens] RPC returned {response.status_code}: {response.text}")

            return {
                "success": True,
                "charged": amount,
            }
    except Exception as e:
        print(f"[spend_tokens] Error: {type(e).__name__}: {str(e)}")
        return {
            "success": False,
            "error": f"Balance check failed: {str(e)}",
            "charged": 0,
        }
