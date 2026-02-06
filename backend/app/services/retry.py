"""Reusable async retry utility with exponential backoff."""

import asyncio
from typing import Tuple, Type


async def retry_async(
    coro_factory,
    max_retries: int = 3,
    retry_on: Tuple[Type[BaseException], ...] = (Exception,),
    base_delay: float = 1.0,
):
    """Execute an async callable with retry and exponential backoff.

    Args:
        coro_factory: A callable that returns a coroutine (called on each attempt).
        max_retries: Maximum number of attempts.
        retry_on: Tuple of exception types to retry on.
        base_delay: Base delay in seconds (doubles each retry).

    Returns:
        The result of the successful call.

    Raises:
        The last exception if all retries are exhausted.
    """
    last_exception = None
    for attempt in range(1, max_retries + 1):
        try:
            return await coro_factory()
        except retry_on as e:
            last_exception = e
            if attempt == max_retries:
                print(f"[retry_async] All {max_retries} attempts failed: {e}")
                raise
            delay = base_delay * (2 ** (attempt - 1))
            print(f"[retry_async] Attempt {attempt}/{max_retries} failed ({type(e).__name__}: {e}), retrying in {delay}s...")
            await asyncio.sleep(delay)
    raise last_exception  # type: ignore[misc]
