[Skip to main content](https://docs.perplexity.ai/guides/perplexity-sdk#content-area)

[Perplexity home page![light logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=78a7baffae224c1a8db2616f1547ff5d)![dark logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=d20039b09af08a25f5bf6c497f549e2e)](https://docs.perplexity.ai/getting-started/overview)

[Docs](https://docs.perplexity.ai/getting-started/overview) [Examples](https://docs.perplexity.ai/cookbook) [API Reference](https://docs.perplexity.ai/api-reference/search-post)

Search...

Navigation

Perplexity SDK

Quickstart

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

- [Overview](https://docs.perplexity.ai/guides/perplexity-sdk#overview)
- [Available APIs](https://docs.perplexity.ai/guides/perplexity-sdk#available-apis)
- [Installation](https://docs.perplexity.ai/guides/perplexity-sdk#installation)
- [Authentication](https://docs.perplexity.ai/guides/perplexity-sdk#authentication)
- [Using Environment Variables](https://docs.perplexity.ai/guides/perplexity-sdk#using-environment-variables)
- [Resources](https://docs.perplexity.ai/guides/perplexity-sdk#resources)

## [​](https://docs.perplexity.ai/guides/perplexity-sdk\#overview)  Overview

The official Perplexity SDKs provide convenient access to the Perplexity APIs from Python 3.8+ and Node.js applications. Both SDKs include type definitions for all request parameters and response fields, with both synchronous and asynchronous clients.

## [​](https://docs.perplexity.ai/guides/perplexity-sdk\#available-apis)  Available APIs

[**Chat Completions** \\
\\
AI responses with web-grounded knowledge, conversation context, and streaming support.](https://docs.perplexity.ai/guides/chat-completions-sdk) [**Search** \\
\\
Ranked web search results with filtering, multi-query support, and domain controls.](https://docs.perplexity.ai/guides/perplexity-sdk-search)

## [​](https://docs.perplexity.ai/guides/perplexity-sdk\#installation)  Installation

Install the SDK for your preferred language:

Python

TypeScript/JavaScript

Copy

Ask AI

```
pip install perplexityai

```

## [​](https://docs.perplexity.ai/guides/perplexity-sdk\#authentication)  Authentication

[**Get your Perplexity API Key** \\
\\
Navigate to the **API Keys** tab in the API Portal and generate a new key.\\
\\
Click here](https://perplexity.ai/account/api) After generating the key, set it as an environment variable in your terminal:

- Windows

- MacOS/Linux


Copy

Ask AI

```
setx PERPLEXITY_API_KEY "your_api_key_here"

```

### [​](https://docs.perplexity.ai/guides/perplexity-sdk\#using-environment-variables)  Using Environment Variables

You can use the environment variable directly:

Python

TypeScript/JavaScript

Copy

Ask AI

```
import os
from perplexity import Perplexity

client = Perplexity() # Automatically uses PERPLEXITY_API_KEY

```

Or use [python-dotenv](https://pypi.org/project/python-dotenv/) (Python) or [dotenv](https://www.npmjs.com/package/dotenv) (Node.js) to load the environment variable from a `.env` file:

Python

TypeScript/JavaScript

Copy

Ask AI

```
import os
from dotenv import load_dotenv
from perplexity import Perplexity

load_dotenv()

client = Perplexity() # Uses PERPLEXITY_API_KEY from .env file

```

Now you’re ready to start using the Perplexity APIs! Choose your API below for step-by-step usage guides.

[**Chat Completions** \\
\\
Get started with AI responses](https://docs.perplexity.ai/guides/chat-completions-sdk) [**Search** \\
\\
Get started with web search](https://docs.perplexity.ai/guides/perplexity-sdk-search)

## [​](https://docs.perplexity.ai/guides/perplexity-sdk\#resources)  Resources

[**Python Package** \\
\\
Install from PyPI with pip](https://pypi.org/project/perplexityai/) [**Node.js Package** \\
\\
Install from npm registry](https://www.npmjs.com/package/@perplexity-ai/perplexity_ai)

Was this page helpful?

YesNo

[Pricing\\
\\
Previous](https://docs.perplexity.ai/getting-started/pricing) [Error Handling\\
\\
Next](https://docs.perplexity.ai/guides/perplexity-sdk-error-handling)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.