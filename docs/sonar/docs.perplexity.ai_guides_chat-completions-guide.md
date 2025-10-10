[Skip to main content](https://docs.perplexity.ai/guides/chat-completions-guide#content-area)

[Perplexity home page![light logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=78a7baffae224c1a8db2616f1547ff5d)![dark logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=d20039b09af08a25f5bf6c497f549e2e)](https://docs.perplexity.ai/getting-started/overview)

[Docs](https://docs.perplexity.ai/getting-started/overview) [Examples](https://docs.perplexity.ai/cookbook) [API Reference](https://docs.perplexity.ai/api-reference/search-post)

Search...

Navigation

Grounded LLM

OpenAI Compatibility

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

- [OpenAI compatibility at a glance](https://docs.perplexity.ai/guides/chat-completions-guide#openai-compatibility-at-a-glance)
- [Configuring OpenAI SDKs to call Sonar](https://docs.perplexity.ai/guides/chat-completions-guide#configuring-openai-sdks-to-call-sonar)
- [API compatibility](https://docs.perplexity.ai/guides/chat-completions-guide#api-compatibility)
- [Standard OpenAI parameters](https://docs.perplexity.ai/guides/chat-completions-guide#standard-openai-parameters)
- [Perplexity-specific parameters](https://docs.perplexity.ai/guides/chat-completions-guide#perplexity-specific-parameters)
- [Examples with OpenAI’s client libraries](https://docs.perplexity.ai/guides/chat-completions-guide#examples-with-openai%E2%80%99s-client-libraries)
- [Basic Usage](https://docs.perplexity.ai/guides/chat-completions-guide#basic-usage)
- [Advanced Examples](https://docs.perplexity.ai/guides/chat-completions-guide#advanced-examples)
- [Response structure](https://docs.perplexity.ai/guides/chat-completions-guide#response-structure)
- [Standard OpenAI Fields](https://docs.perplexity.ai/guides/chat-completions-guide#standard-openai-fields)
- [Perplexity-Specific Fields](https://docs.perplexity.ai/guides/chat-completions-guide#perplexity-specific-fields)
- [Unsupported and notable differences](https://docs.perplexity.ai/guides/chat-completions-guide#unsupported-and-notable-differences)
- [Technical notes](https://docs.perplexity.ai/guides/chat-completions-guide#technical-notes)
- [Next steps](https://docs.perplexity.ai/guides/chat-completions-guide#next-steps)

## [​](https://docs.perplexity.ai/guides/chat-completions-guide\#openai-compatibility-at-a-glance)  OpenAI compatibility at a glance

Perplexity’s Sonar API was designed with OpenAI compatibility in mind, matching the Chat Completions API interface. You can seamlessly use your existing OpenAI client libraries by simply changing the base URL and providing your Perplexity API key.

Keep using your existing OpenAI SDKs to get started fast; switch to our [native SDKs](https://docs.perplexity.ai/guides/perplexity-sdk) later as needed.

## [​](https://docs.perplexity.ai/guides/chat-completions-guide\#configuring-openai-sdks-to-call-sonar)  Configuring OpenAI SDKs to call Sonar

To start using Sonar with OpenAI’s client libraries, pass your Perplexity API key and change the base\_url to `https://api.perplexity.ai`:

- Python

- TypeScript


Copy

Ask AI

```
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.perplexity.ai"
)

resp = client.chat.completions.create(
    model="sonar-pro",
    messages=[\
        {"role": "user", "content": "Hello!"}\
    ]
)
print(resp.choices[0].message.content)

```

Your responses will match OpenAI’s format exactly. See the [response structure](https://docs.perplexity.ai/guides/chat-completions-guide#response-structure) section below for complete field details.

## [​](https://docs.perplexity.ai/guides/chat-completions-guide\#api-compatibility)  API compatibility

### [​](https://docs.perplexity.ai/guides/chat-completions-guide\#standard-openai-parameters)  Standard OpenAI parameters

These parameters work exactly the same as OpenAI’s API:

- `model` \- Model name (use Perplexity model names)
- `messages` \- Chat messages array
- `temperature` \- Sampling temperature (0-2)
- `max_tokens` \- Maximum tokens in response
- `top_p` \- Nucleus sampling parameter
- `frequency_penalty` \- Frequency penalty (-2.0 to 2.0)
- `presence_penalty` \- Presence penalty (-2.0 to 2.0)
- `stream` \- Enable streaming responses

### [​](https://docs.perplexity.ai/guides/chat-completions-guide\#perplexity-specific-parameters)  Perplexity-specific parameters

These Perplexity-specific parameters are also included:

- `search_domain_filter` \- Limit or exclude specific domains
- `search_recency_filter` \- Filter by content recency
- `return_images` \- Include image URLs in response
- `return_related_questions` \- Include related questions
- `search_mode` \- “web” (default) or “academic” mode selector.

See [API Reference](https://docs.perplexity.ai/api-reference) for parameter details and models.

## [​](https://docs.perplexity.ai/guides/chat-completions-guide\#examples-with-openai%E2%80%99s-client-libraries)  Examples with OpenAI’s client libraries

### [​](https://docs.perplexity.ai/guides/chat-completions-guide\#basic-usage)  Basic Usage

Start with these simple examples to make your first API calls:

- Python

- TypeScript


Copy

Ask AI

```
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.perplexity.ai"
)

response = client.chat.completions.create(
    model="sonar-pro",
    messages=[\
        {"role": "user", "content": "What are the latest developments in AI?"}\
    ]
)

print(response.choices[0].message.content)

```

### [​](https://docs.perplexity.ai/guides/chat-completions-guide\#advanced-examples)  Advanced Examples

For more control over search behavior and response generation:

- Python

- TypeScript


Search Filtering

Full Configuration

Copy

Ask AI

```
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.perplexity.ai"
)

response = client.chat.completions.create(
    model="sonar-pro",
    messages=[\
        {"role": "user", "content": "Latest climate research findings"}\
    ],
    extra_body={
        "search_domain_filter": ["nature.com", "science.org"],
        "search_recency_filter": "month"
    }
)

print(response.choices[0].message.content)
print(f"Sources: {len(response.search_results)} articles found")

```

## [​](https://docs.perplexity.ai/guides/chat-completions-guide\#response-structure)  Response structure

Perplexity API responses include both standard OpenAI fields and additional search metadata:

### [​](https://docs.perplexity.ai/guides/chat-completions-guide\#standard-openai-fields)  Standard OpenAI Fields

- `choices[0].message.content` \- The AI-generated response
- `model` \- The model name used
- `usage` \- Token consumption details
- `id`, `created`, `object` \- Standard response metadata

### [​](https://docs.perplexity.ai/guides/chat-completions-guide\#perplexity-specific-fields)  Perplexity-Specific Fields

- `search_results` \- Array of web sources with titles, URLs, and dates
- `usage.search_context_size` \- Search context setting used

- Python

- TypeScript


Copy

Ask AI

```
# Access the main response
content = response.choices[0].message.content
print(content)

# Access search sources
for result in response.search_results:
    print(f"Source: {result['title']}")
    print(f"URL: {result['url']}")
    print(f"Date: {result['date']}")
    print("---")

# Check token usage
print(f"Tokens used: {response.usage.total_tokens}")

```

Search results are returned even when streaming is enabled, but they arrive in the final chunk of the stream. See the [Streaming Guide](https://docs.perplexity.ai/guides/streaming-responses) for details.

## [​](https://docs.perplexity.ai/guides/chat-completions-guide\#unsupported-and-notable-differences)  Unsupported and notable differences

While compatibility is high, note the following differences from OpenAI:

- **Model names**: Use Perplexity models like `sonar-pro`, `sonar-reasoning`.
- **Search controls**: Perplexity adds web/academic search parameters via `extra_body` (Python) or root fields (TypeScript) as shown above.

If you previously used OpenAI-only fields that aren’t applicable to Perplexity search controls, remove or ignore them. Check the API Reference for the current list of supported fields.

## [​](https://docs.perplexity.ai/guides/chat-completions-guide\#technical-notes)  Technical notes

- **Error format**: Same as OpenAI’s API for compatibility
- **Rate limiting**: Apply standard rate limiting practices
- **Model names**: Use Perplexity model names ( `sonar-pro`, `sonar-reasoning`, etc.)
- **Authentication**: Use `Bearer` token format in Authorization header

## [​](https://docs.perplexity.ai/guides/chat-completions-guide\#next-steps)  Next steps

[**Explore Models** \\
\\
Browse available Sonar models and their capabilities.](https://docs.perplexity.ai/getting-started/models) [**Search Controls** \\
\\
Learn to fine-tune search behavior with filters and parameters.](https://docs.perplexity.ai/guides/search-control-guide) [**Streaming Guide** \\
\\
Implement real-time streaming responses in your application.](https://docs.perplexity.ai/guides/streaming-responses) [**API Reference** \\
\\
View complete endpoint documentation and parameter details.](https://docs.perplexity.ai/api-reference)

Was this page helpful?

YesNo

[Chat Completions SDK\\
\\
Previous](https://docs.perplexity.ai/guides/chat-completions-sdk) [Prompt Guide\\
\\
Next](https://docs.perplexity.ai/guides/prompt-guide)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.