"""AI-powered transcript summarization service.

Uses GPT-4o-mini to convert long video transcripts into structured
narrative summaries. Cost-efficient (~$0.003-0.01 per video).
"""

from typing import Optional
import openai

from app.config import get_settings


SUMMARIZATION_PROMPT = """Analyze this video transcript and create a comprehensive narrative summary.

Video: {title}
Description: {description}

Transcript:
{transcript}

Create a structured summary (max {max_chars} characters) including:
1. PARTICIPANTS: Who is speaking, their roles/expertise (if identifiable)
2. MAIN TOPICS: Key themes discussed (bullet points)
3. KEY INSIGHTS: Most important points and takeaways
4. NOTABLE QUOTES: 2-3 memorable quotes with attribution (if available)
5. STRUCTURE: How the conversation flows (intro -> topics -> conclusion)

Rules:
- Output in the same language as the transcript
- Be concise but comprehensive
- Focus on actionable insights and key information
- Preserve important details, names, numbers, dates
- If it's a tutorial/educational video, highlight the steps/lessons
- If it's an interview, capture the main questions and answers"""


async def summarize_transcript(
    transcript: str,
    video_title: str = "",
    video_description: str = "",
    max_output_chars: int = 3000,
    language: str = "auto"
) -> Optional[str]:
    """Summarize a full video transcript into a structured narrative.

    Uses GPT-4o-mini for cost efficiency (~$0.002-0.01 per request).

    Args:
        transcript: Full transcript text (can be very long)
        video_title: Video title for context
        video_description: Video description for context
        max_output_chars: Maximum characters for output summary
        language: Output language ('ru', 'en', 'auto' to match transcript)

    Returns:
        Structured summary string or None if summarization fails
    """
    settings = get_settings()

    if not settings.openai_api_key:
        print("[summarization] No OpenAI API key configured, skipping summarization")
        return None

    if not settings.enable_transcript_summarization:
        print("[summarization] Summarization disabled in settings")
        return None

    if not transcript or len(transcript) < 500:
        # Transcript too short, no need to summarize
        print(f"[summarization] Transcript too short ({len(transcript)} chars), skipping")
        return None

    # Use configured max output chars if not specified
    if max_output_chars <= 0:
        max_output_chars = settings.summarization_max_output_chars

    # Build the prompt
    prompt = SUMMARIZATION_PROMPT.format(
        title=video_title or "Unknown",
        description=video_description[:500] if video_description else "Not provided",
        transcript=transcript,
        max_chars=max_output_chars
    )

    try:
        from .retry import retry_async

        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

        async def _call_openai():
            return await client.chat.completions.create(
                model=settings.summarization_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert content analyst. Create clear, structured summaries of video transcripts that preserve key information while being concise."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=settings.summarization_max_tokens,
                temperature=0.3  # Lower temperature for more consistent output
            )

        response = await retry_async(
            _call_openai,
            max_retries=3,
            retry_on=(openai.APIError, openai.APITimeoutError, openai.RateLimitError),
        )

        summary = response.choices[0].message.content

        if summary:
            summary = summary.strip()
            # Log token usage for cost monitoring
            usage = response.usage
            if usage:
                input_tokens = usage.prompt_tokens
                output_tokens = usage.completion_tokens
                # GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
                cost_estimate = (input_tokens * 0.15 + output_tokens * 0.60) / 1_000_000
                print(f"[summarization] Generated narrative: {len(summary)} chars from {len(transcript)} chars transcript")
                print(f"[summarization] Tokens: {input_tokens} in, {output_tokens} out, est. cost: ${cost_estimate:.4f}")

            return summary

        print("[summarization] Empty response from OpenAI")
        return None

    except (openai.APIError, openai.APITimeoutError, openai.RateLimitError) as e:
        print(f"[summarization] OpenAI API error after retries: {e}")
        return None
    except Exception as e:
        print(f"[summarization] Unexpected error: {e}")
        return None
