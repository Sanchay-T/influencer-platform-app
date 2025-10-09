[Skip to main content](https://docs.perplexity.ai/guides/structured-outputs#content-area)

[Perplexity home page![light logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=78a7baffae224c1a8db2616f1547ff5d)![dark logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=d20039b09af08a25f5bf6c497f549e2e)](https://docs.perplexity.ai/getting-started/overview)

[Docs](https://docs.perplexity.ai/getting-started/overview) [Examples](https://docs.perplexity.ai/cookbook) [API Reference](https://docs.perplexity.ai/api-reference/search-post)

Search...

Navigation

Prompting & Output Control

Structured Outputs Guide

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

## [​](https://docs.perplexity.ai/guides/structured-outputs\#overview)  Overview

Structured outputs enable you to enforce specific response formats from Perplexity’s models, ensuring consistent, machine-readable data that can be directly integrated into your applications without manual parsing.We currently support two types of structured outputs: **JSON Schema** and **Regex**. LLM responses will work to match the specified format, except for the following cases:

- The output exceeds `max_tokens`

Enabling the structured outputs can be done by adding a `response_format` field in the request:**JSON Schema**

- `response_format: { type: "json_schema", json_schema: {"schema": object} }` .
- The schema should be a valid JSON schema object.

**Regex** (only available for `sonar` right now)

- `response_format: { type: "regex", regex: {"regex": str} }` .
- The regex is a regular expression string.

**Improve Schema Compliance**: Give the LLM some hints about the output format in your prompts to improve adherence to the structured format.For example, include phrases like “Please return the data as a JSON object with the following structure…” or “Extract the information and format it as specified in the schema.”

The first request with a new JSON Schema or Regex expects to incur delay on the first token. Typically, it takes 10 to 30 seconds to prepare the new schema, and may result in timeout errors. Once the schema has been prepared, the subsequent requests will not see such delay.

## [​](https://docs.perplexity.ai/guides/structured-outputs\#examples)  Examples

### [​](https://docs.perplexity.ai/guides/structured-outputs\#1-financial-analysis-with-json-schema)  1\. Financial Analysis with JSON Schema

Python

TypeScript

cURL

Copy

Ask AI

```
from perplexity import Perplexity
from typing import List, Optional
from pydantic import BaseModel

class FinancialMetrics(BaseModel):
    company: str
    quarter: str
    revenue: float
    net_income: float
    eps: float
    revenue_growth_yoy: Optional[float] = None
    key_highlights: Optional[List[str]] = None

client = Perplexity()

completion = client.chat.completions.create(
    model="sonar-pro",
    messages=[\
        {\
            "role": "user",\
            "content": "Analyze the latest quarterly earnings report for Apple Inc. Extract key financial metrics."\
        }\
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "schema": FinancialMetrics.model_json_schema()
        }
    }
)

metrics = FinancialMetrics.model_validate_json(completion.choices[0].message.content)
print(f"Revenue: ${metrics.revenue}B")

```

### [​](https://docs.perplexity.ai/guides/structured-outputs\#2-extract-contact-information-with-regex)  2\. Extract Contact Information with Regex

Python

TypeScript

cURL

Copy

Ask AI

```
from perplexity import Perplexity

client = Perplexity()

completion = client.chat.completions.create(
    model="sonar",
    messages=[\
        {\
            "role": "user",\
            "content": "Find the direct email address for the investor relations contact at Tesla Inc."\
        }\
    ],
    response_format={
        "type": "regex",
        "regex": {
            "regex": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
        }
    }
)

email = completion.choices[0].message.content
print(f"Investor Relations Email: {email}")

```

## [​](https://docs.perplexity.ai/guides/structured-outputs\#best-practices)  Best Practices

### [​](https://docs.perplexity.ai/guides/structured-outputs\#generating-responses-in-a-json-format)  Generating responses in a JSON Format

For Python users, we recommend using the Pydantic library to [generate JSON schema](https://docs.pydantic.dev/latest/api/base_model/#pydantic.BaseModel.model_json_schema).**Unsupported JSON Schemas**Recursive JSON schema is not supported. As a result of that, unconstrained objects are not supported either. Here’s a few example of unsupported schemas:

Copy

Ask AI

```
# UNSUPPORTED!

from typing import Any

class UnconstrainedDict(BaseModel):
   unconstrained: dict[str, Any]

class RecursiveJson(BaseModel):
   value: str
   child: list["RecursiveJson"]

```

**Links in JSON Responses**: Requesting links as part of a JSON response may not always work reliably and can result in hallucinations or broken links. Models may generate invalid URLs when forced to include links directly in structured outputs.To ensure all links are valid, use the links returned in the `citations` or `search_results` fields from the API response. Never count on the model to return valid links directly as part of the JSON response content.

### [​](https://docs.perplexity.ai/guides/structured-outputs\#generating-responses-using-a-regex)  Generating responses using a regex

**Supported Regex**

- Characters: `\d`, `\w`, `\s` , `.`
- Character classes: `[0-9A-Fa-f]` , `[^x]`
- Quantifiers: `*`, `?` , `+`, `{3}`, `{2,4}` , `{3,}`
- Alternation: `|`
- Group: `( ... )`
- Non-capturing group: `(?: ... )`

**Unsupported Regex**

- Contents of group: `\1`
- Anchors: `^`, `$`, `\b`
- Positive lookahead: `(?= ... )`
- Negative lookahead: `(?! ... )`
- Positive look-behind: `(?<= ... )`
- Negative look-behind: `(?<! ... )`
- Recursion: `(?R)`

## [​](https://docs.perplexity.ai/guides/structured-outputs\#perplexity%E2%80%99s-json-schema-implementation)  Perplexity’s JSON Schema Implementation

Perplexity’s structured outputs implementation has several key differences compared to other providers:

### [​](https://docs.perplexity.ai/guides/structured-outputs\#simplified-schema-definition)  Simplified Schema Definition

- **Optional naming**: Unlike other providers that require explicit schema names, Perplexity automatically handles schema naming with sensible defaults
- **Flexible strictness**: Schema validation is handled automatically without requiring manual strictness configuration
- **Streamlined syntax**: You only need to provide the core schema object without additional wrapper fields

**Other Providers:**

Copy

Ask AI

```
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "financial_data",
      "strict": true,
      "schema": { /* your schema */ }
    }
  }
}

```

**Perplexity:**

Copy

Ask AI

```
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "schema": { /* your schema */ }
    }
  }
}

```

### [​](https://docs.perplexity.ai/guides/structured-outputs\#enhanced-error-handling)  Enhanced Error Handling

- **Clear error messages**: When schemas fail validation, you’ll receive specific, actionable error messages
- **Recursion protection**: Built-in safeguards prevent infinite recursion in complex nested schemas
- **Constraint validation**: Automatic detection and clear messaging for unsupported features like unconstrained objects

### [​](https://docs.perplexity.ai/guides/structured-outputs\#schema-compatibility)  Schema Compatibility

While Perplexity supports standard JSON Schema syntax, some advanced features may not be available:

- Recursive schemas are not supported for performance and reliability reasons
- Unconstrained objects (like `dict[str, Any]`) are automatically detected and rejected
- Complex reference patterns may require simplification

This approach prioritizes reliability and performance while maintaining compatibility with most common JSON Schema use cases.

## [​](https://docs.perplexity.ai/guides/structured-outputs\#structured-outputs-for-reasoning-models)  Structured Outputs for Reasoning Models

When using structured outputs with reasoning models like `sonar-reasoning-pro`, the response will include a `<think>` section containing reasoning tokens, immediately followed by the structured output. The `response_format` parameter does not remove these reasoning tokens from the output, so the final response will need to be parsed manually.**Sample Response:**

Copy

Ask AI

```
<think>
I need to provide information about France in a structured JSON format with specific fields: country, capital, population, official_language.

For France:
- Country: France
- Capital: Paris
- Population: About 67 million (as of 2023)
- Official Language: French

Let me format this information as required.
</think>
{"country":"France","capital":"Paris","population":67750000,"official_language":"French"}

```

For a reusable implementation to extract JSON from reasoning model outputs, see our [example utility on GitHub](https://github.com/ppl-ai/api-discussion/blob/main/utils/extract_json_reasoning_models.py).

Was this page helpful?

YesNo

[Prompt Guide\\
\\
Previous](https://docs.perplexity.ai/guides/prompt-guide) [Streaming Responses\\
\\
Next](https://docs.perplexity.ai/guides/streaming-responses)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.