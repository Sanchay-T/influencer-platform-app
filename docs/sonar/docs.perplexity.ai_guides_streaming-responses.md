[Skip to main content](https://docs.perplexity.ai/guides/streaming-responses#content-area)

[Perplexity home page![light logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=78a7baffae224c1a8db2616f1547ff5d)![dark logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=d20039b09af08a25f5bf6c497f549e2e)](https://docs.perplexity.ai/getting-started/overview)

[Docs](https://docs.perplexity.ai/getting-started/overview) [Examples](https://docs.perplexity.ai/cookbook) [API Reference](https://docs.perplexity.ai/api-reference/search-post)

Search...

Navigation

Prompting & Output Control

Streaming Responses

Search docs

Ctrl K

- [Forum](https://community.perplexity.ai/)
- [Blog](https://perplexity.ai/blog)
- [Changelog](https://docs.perplexity.ai/changelog/changelog)

##### Getting Started

- [Overview](https://docs.perplexity.ai/getting-started/overview)
- [Pricing](https://docs.perplexity.ai/getting-started/pricing)

##### Perplexity SDK

- [Quickstart](https://docs.perplexity.ai/guides/perplexity-sdk)
- Guides


##### Search

- [Quickstart](https://docs.perplexity.ai/guides/search-quickstart)
- [Best Practices](https://docs.perplexity.ai/guides/search-best-practices)

##### Grounded LLM

- [Quickstart](https://docs.perplexity.ai/getting-started/quickstart)
- [Models](https://docs.perplexity.ai/getting-started/models)
- [Chat Completions SDK](https://docs.perplexity.ai/guides/chat-completions-sdk)
- [OpenAI Compatibility](https://docs.perplexity.ai/guides/chat-completions-guide)
- Prompting & Output Control

  - [Prompt Guide](https://docs.perplexity.ai/guides/prompt-guide)
  - [Structured Outputs Guide](https://docs.perplexity.ai/guides/structured-outputs)
  - [Streaming Responses](https://docs.perplexity.ai/guides/streaming-responses)
- Search & Filtering

- Working with Attachments

- Integration & Extensibility


##### Admin

- [API Groups & Billing](https://docs.perplexity.ai/getting-started/api-groups)
- [API Key Management](https://docs.perplexity.ai/guides/api-key-management)
- [Rate Limits & Usage Tiers](https://docs.perplexity.ai/guides/rate-limits-usage-tiers)

##### Help & Resources

- [Changelog](https://docs.perplexity.ai/changelog/changelog)
- [Get in Touch](https://docs.perplexity.ai/discussions/discussions)
- [API Roadmap](https://docs.perplexity.ai/feature-roadmap)
- [Frequently Asked Questions](https://docs.perplexity.ai/faq/faq)
- [System Status](https://docs.perplexity.ai/status/status)
- [Privacy & Security](https://docs.perplexity.ai/guides/privacy-security)
- [Perplexity Crawlers](https://docs.perplexity.ai/guides/bots)

On this page

- [Overview](https://docs.perplexity.ai/guides/streaming-responses#overview)
- [Quick Start](https://docs.perplexity.ai/guides/streaming-responses#quick-start)
- [Search Results and Metadata During Streaming](https://docs.perplexity.ai/guides/streaming-responses#search-results-and-metadata-during-streaming)
- [How Metadata Works with Streaming](https://docs.perplexity.ai/guides/streaming-responses#how-metadata-works-with-streaming)
- [Collecting Metadata During Streaming](https://docs.perplexity.ai/guides/streaming-responses#collecting-metadata-during-streaming)
- [Error Handling](https://docs.perplexity.ai/guides/streaming-responses#error-handling)
- [Proper SSE Parsing](https://docs.perplexity.ai/guides/streaming-responses#proper-sse-parsing)
- [Advanced Streaming Patterns](https://docs.perplexity.ai/guides/streaming-responses#advanced-streaming-patterns)
- [Buffered Streaming](https://docs.perplexity.ai/guides/streaming-responses#buffered-streaming)
- [Stream Processing with Callbacks](https://docs.perplexity.ai/guides/streaming-responses#stream-processing-with-callbacks)
- [Best Practices](https://docs.perplexity.ai/guides/streaming-responses#best-practices)
- [Resources](https://docs.perplexity.ai/guides/streaming-responses#resources)

## [​](https://docs.perplexity.ai/guides/streaming-responses\#overview)  Overview

Streaming allows you to receive partial responses from the Perplexity API as they are generated, rather than waiting for the complete response. This is particularly useful for:

- **Real-time user experiences** \- Display responses as they’re generated
- **Long responses** \- Start showing content immediately for lengthy analyses
- **Interactive applications** \- Provide immediate feedback to users

Streaming is supported across all Perplexity models including Sonar, Sonar Pro, and reasoning models.

## [​](https://docs.perplexity.ai/guides/streaming-responses\#quick-start)  Quick Start

The easiest way to get started is with the Perplexity SDKs, which handle all the streaming parsing automatically.To enable streaming, set `stream=True` (Python) or `stream: true` (TypeScript) when creating completions:

- Python SDK

- TypeScript SDK

- cURL


Copy

Ask AI

```
from perplexity import Perplexity

# Initialize the client (uses PERPLEXITY_API_KEY environment variable)
client = Perplexity()

# Create streaming completion
stream = client.chat.completions.create(
    model="sonar",
    messages=[{"role": "user", "content": "What is the latest in AI research?"}],
    stream=True
)

# Process streaming response
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")

```

## [​](https://docs.perplexity.ai/guides/streaming-responses\#search-results-and-metadata-during-streaming)  Search Results and Metadata During Streaming

Search results and metadata are delivered in the **final chunk(s)** of a streaming response, not progressively during the stream.

### [​](https://docs.perplexity.ai/guides/streaming-responses\#how-metadata-works-with-streaming)  How Metadata Works with Streaming

When streaming, you receive:

1. **Content chunks** which arrive progressively in real-time
2. **Search results** (delivered in the final chunk(s))
3. **Usage stats** and other metadata

### [​](https://docs.perplexity.ai/guides/streaming-responses\#collecting-metadata-during-streaming)  Collecting Metadata During Streaming

- Python SDK

- TypeScript SDK

- Raw HTTP


Copy

Ask AI

```
from perplexity import Perplexity

def stream_with_metadata():
    client = Perplexity()

    stream = client.chat.completions.create(
        model="sonar",
        messages=[{"role": "user", "content": "Explain quantum computing"}],
        stream=True
    )

    content = ""
    search_results = []
    usage_info = None

    for chunk in stream:
        # Process content
        if chunk.choices[0].delta.content:
            content_piece = chunk.choices[0].delta.content
            content += content_piece
            print(content_piece, end='', flush=True)

        # Collect metadata from final chunks
        if hasattr(chunk, 'search_results') and chunk.search_results:
            search_results = chunk.search_results

        if hasattr(chunk, 'usage') and chunk.usage:
            usage_info = chunk.usage

        # Check if streaming is complete
        if chunk.choices[0].finish_reason:
            print(f"\n\nSearch Results: {search_results}")
            print(f"Usage: {usage_info}")

    return content, search_results, usage_info

stream_with_metadata()

```

## [​](https://docs.perplexity.ai/guides/streaming-responses\#error-handling)  Error Handling

Proper error handling is important to ensure your application can recover from errors and provide a good user experience.

- Python SDK

- TypeScript SDK

- Raw HTTP


Copy

Ask AI

```
import perplexity
from perplexity import Perplexity

client = Perplexity()

try:
    stream = client.chat.completions.create(
        model="sonar-pro",
        messages=[\
            {"role": "user", "content": "Explain machine learning concepts"}\
        ],
        stream=True
    )

    content = ""
    for chunk in stream:
        if chunk.choices[0].delta.content:
            content_chunk = chunk.choices[0].delta.content
            content += content_chunk
            print(content_chunk, end="")

except perplexity.APIConnectionError as e:
    print(f"Network connection failed: {e}")
except perplexity.RateLimitError as e:
    print(f"Rate limit exceeded, please retry later: {e}")
except perplexity.APIStatusError as e:
    print(f"API error {e.status_code}: {e.response}")
except Exception as e:
    print(f"Unexpected error: {e}")

```

## [​](https://docs.perplexity.ai/guides/streaming-responses\#proper-sse-parsing)  Proper SSE Parsing

For production use, you should properly parse Server-Sent Events (SSE) format:

- Python with SSE Library

- JavaScript with EventSource

- Manual SSE Parsing


Copy

Ask AI

```
# pip install sseclient-py
import sseclient
import requests
import json

def stream_with_proper_sse():
    url = "https://api.perplexity.ai/chat/completions"
    headers = {
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "sonar",
        "messages": [{"role": "user", "content": "Explain quantum computing"}],
        "stream": True
    }

    response = requests.post(url, headers=headers, json=payload, stream=True)
    client = sseclient.SSEClient(response)

    for event in client.events():
        if event.data == '[DONE]':
            break
        try:
            chunk_data = json.loads(event.data)
            content = chunk_data['choices'][0]['delta'].get('content', '')
            if content:
                print(content, end='')
        except json.JSONDecodeError:
            continue

stream_with_proper_sse()

```

## [​](https://docs.perplexity.ai/guides/streaming-responses\#advanced-streaming-patterns)  Advanced Streaming Patterns

### [​](https://docs.perplexity.ai/guides/streaming-responses\#buffered-streaming)  Buffered Streaming

For applications that need to process chunks in batches:

- Python SDK

- TypeScript SDK


Copy

Ask AI

```
from perplexity import Perplexity
import time

def buffered_streaming(buffer_size=50, flush_interval=1.0):
    client = Perplexity()

    stream = client.chat.completions.create(
        model="sonar",
        messages=[{"role": "user", "content": "Write a detailed explanation of machine learning"}],
        stream=True
    )

    buffer = ""
    last_flush = time.time()

    for chunk in stream:
        if chunk.choices[0].delta.content:
            buffer += chunk.choices[0].delta.content

            # Flush buffer if it's full or enough time has passed
            if len(buffer) >= buffer_size or (time.time() - last_flush) >= flush_interval:
                print(buffer, end='', flush=True)
                buffer = ""
                last_flush = time.time()

    # Flush remaining buffer
    if buffer:
        print(buffer, end='', flush=True)

buffered_streaming()

```

### [​](https://docs.perplexity.ai/guides/streaming-responses\#stream-processing-with-callbacks)  Stream Processing with Callbacks

For applications that need to process chunks with custom logic:

- Python SDK

- TypeScript SDK


Copy

Ask AI

```
from perplexity import Perplexity
from typing import Callable, Optional

def stream_with_callbacks(
    query: str,
    on_content: Optional[Callable[[str], None]] = None,
    on_search_results: Optional[Callable[[list], None]] = None,
    on_complete: Optional[Callable[[str, dict], None]] = None
):
    client = Perplexity()

    stream = client.chat.completions.create(
        model="sonar",
        messages=[{"role": "user", "content": query}],
        stream=True
    )

    full_content = ""
    metadata = {}

    for chunk in stream:
        # Handle content chunks
        if chunk.choices[0].delta.content:
            content_piece = chunk.choices[0].delta.content
            full_content += content_piece
            if on_content:
                on_content(content_piece)

        # Handle search results
        if hasattr(chunk, 'search_results') and chunk.search_results:
            metadata['search_results'] = chunk.search_results
            if on_search_results:
                on_search_results(chunk.search_results)

        # Handle other metadata
        if hasattr(chunk, 'usage') and chunk.usage:
            metadata['usage'] = chunk.usage

        # Handle completion
        if chunk.choices[0].finish_reason:
            if on_complete:
                on_complete(full_content, metadata)

    return full_content, metadata

# Usage example
def print_content(content: str):
    print(content, end='', flush=True)

def handle_search_results(results: list):
    print(f"\n[Found {len(results)} sources]", end='')

def handle_completion(content: str, metadata: dict):
    print(f"\n\nCompleted. Total length: {len(content)} characters")
    if 'usage' in metadata:
        print(f"Token usage: {metadata['usage']}")

stream_with_callbacks(
    "Explain the latest developments in renewable energy",
    on_content=print_content,
    on_search_results=handle_search_results,
    on_complete=handle_completion
)

```

## [​](https://docs.perplexity.ai/guides/streaming-responses\#best-practices)  Best Practices

1

Handle network interruptions

Implement reconnection logic for robust streaming applications.

- Python SDK

- TypeScript SDK


Copy

Ask AI

```
import time
import random
from perplexity import Perplexity
import perplexity

def robust_streaming(query: str, max_retries: int = 3):
    client = Perplexity()

    for attempt in range(max_retries):
        try:
            stream = client.chat.completions.create(
                model="sonar",
                messages=[{"role": "user", "content": query}],
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    print(chunk.choices[0].delta.content, end='', flush=True)

            return  # Success, exit retry loop

        except (perplexity.APIConnectionError, perplexity.APITimeoutError) as e:
            if attempt < max_retries - 1:
                delay = (2 ** attempt) + random.uniform(0, 1)
                print(f"\nConnection error, retrying in {delay:.1f}s...")
                time.sleep(delay)
            else:
                print(f"\nFailed after {max_retries} attempts: {e}")
                raise

robust_streaming("Explain quantum computing")

```

2

Implement proper buffering

Use appropriate buffering strategies for your application’s needs.

Copy

Ask AI

```
# For real-time chat applications
buffer_size = 1  # Character-by-character for immediate display

# For document processing
buffer_size = 100  # Larger chunks for efficiency

# For API responses
buffer_size = 500  # Balance between responsiveness and efficiency

```

3

Handle metadata appropriately

Remember that search results and metadata arrive at the end of the stream.

Copy

Ask AI

```
# Don't expect search results until the stream is complete
if chunk.choices[0].finish_reason == "stop":
    # Now search results and usage info are available
    process_search_results(chunk.search_results)
    log_usage_stats(chunk.usage)

```

4

Optimize for your use case

Choose streaming parameters based on your application requirements.

- Real-time Chat

- Document Generation


Copy

Ask AI

```
# Optimize for immediate response
stream = client.chat.completions.create(
    model="sonar",
    messages=messages,
    stream=True,
    max_tokens=1000,  # Reasonable limit
    temperature=0.7   # Balanced creativity
)

```

**Important**: If you need search results immediately for your user interface, consider using non-streaming requests for use cases where search result display is critical to the real-time user experience.

## [​](https://docs.perplexity.ai/guides/streaming-responses\#resources)  Resources

- [The Perplexity SDK Guide](https://docs.perplexity.ai/guides/perplexity-sdk) \- The Perplexity SDK guide
- [Chat Completions SDK](https://docs.perplexity.ai/guides/chat-completions-sdk) \- Complete chat completions guide
- [API Reference - Chat Completions](https://docs.perplexity.ai/api-reference/chat-completions-post) \- Complete API documentation

Was this page helpful?

YesNo

[Structured Outputs Guide\\
\\
Previous](https://docs.perplexity.ai/guides/structured-outputs) [Sonar Domain Filter Guide\\
\\
Next](https://docs.perplexity.ai/guides/search-domain-filters)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.