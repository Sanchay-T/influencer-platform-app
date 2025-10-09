[Skip to main content](https://docs.perplexity.ai/guides/prompt-guide#content-area)

[Perplexity home page![light logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=78a7baffae224c1a8db2616f1547ff5d)![dark logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=d20039b09af08a25f5bf6c497f549e2e)](https://docs.perplexity.ai/getting-started/overview)

[Docs](https://docs.perplexity.ai/getting-started/overview) [Examples](https://docs.perplexity.ai/cookbook) [API Reference](https://docs.perplexity.ai/api-reference/search-post)

Search...

Navigation

Prompting & Output Control

Prompt Guide

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

## [​](https://docs.perplexity.ai/guides/prompt-guide\#system-prompt)  System Prompt

You can use the system prompt to provide instructions related to style, tone, and language of the response.

The real-time search component of our models does not attend to the system prompt.

**Example of a system prompt**

Copy

Ask AI

```
You are a helpful AI assistant.

Rules:
1. Provide only the final answer. It is important that you do not include any explanation on the steps below.
2. Do not show the intermediate steps information.

Steps:
1. Decide if the answer should be a brief sentence or a list of suggestions.
2. If it is a list of suggestions, first, write a brief and natural introduction based on the original query.
3. Followed by a list of suggestions, each suggestion should be split by two newlines.

```

## [​](https://docs.perplexity.ai/guides/prompt-guide\#user-prompt)  User Prompt

You should use the user prompt to pass in the actual query for which you need an answer for. The user prompt will be used to kick off a real-time web search to make sure the answer has the latest and the most relevant information needed.**Example of a user prompt**

Copy

Ask AI

```
What are the best sushi restaurants in the world currently?

```

# [​](https://docs.perplexity.ai/guides/prompt-guide\#web-search-models%3A-general-prompting-guidelines)  Web Search Models: General Prompting Guidelines

Our web search-powered models combine the capabilities of LLMs with real-time web searches. Understanding how they differ from traditional LLMs will help you craft more effective prompts.

## [​](https://docs.perplexity.ai/guides/prompt-guide\#best-practices-for-prompting-web-search-models)  Best Practices for Prompting Web Search Models

## Be Specific and Contextual

Unlike traditional LLMs, our web search models require specificity to retrieve relevant search results. Adding just 2-3 extra words of context can dramatically improve performance.**Good Example**: “Explain recent advances in climate prediction models for urban planning”**Poor Example**: “Tell me about climate models”

## Avoid Few-Shot Prompting

While few-shot prompting works well for traditional LLMs, it confuses web search models by triggering searches for your examples rather than your actual query.**Good Example**: “Summarize the current research on mRNA vaccine technology”**Poor Example**: “Here’s an example of a good summary about vaccines: \[example text\]. Now summarize the current research on mRNA vaccines.”

## Think Like a Web Search User

Craft prompts with search-friendly terms that would appear on relevant web pages. Consider how experts in the field would describe the topic online.**Good Example**: “Compare the energy efficiency ratings of heat pumps vs. traditional HVAC systems for residential use”**Poor Example**: “Tell me which home heating is better”

## Provide Relevant Context

Include critical context to guide the web search toward the most relevant content, but keep prompts concise and focused.**Good Example**: “Explain the impact of the 2023 EU digital markets regulations on app store competition for small developers”**Poor Example**: “What are the rules for app stores?”

## [​](https://docs.perplexity.ai/guides/prompt-guide\#web-search-model-pitfalls-to-avoid)  Web Search Model Pitfalls to Avoid

## Overly Generic Questions

Generic prompts lead to scattered web search results and unfocused responses. Always narrow your scope.**Avoid**: “What’s happening in AI?”**Instead**: “What are the three most significant commercial applications of generative AI in healthcare in the past year?”

## Traditional LLM Techniques

Prompting strategies designed for traditional LLM often don’t work well with web search models. Adapt your approach accordingly.**Avoid**: “Act as an expert chef and give me a recipe for sourdough bread. Start by explaining the history of sourdough, then list ingredients, then…”**Instead**: “What’s a reliable sourdough bread recipe for beginners? Include ingredients and step-by-step instructions.”

## Complex Multi-Part Requests

Complex prompts with multiple unrelated questions can confuse the search component. Focus on one topic per query.**Avoid**: “Explain quantum computing, and also tell me about regenerative agriculture, and provide stock market predictions.”**Instead**: “Explain quantum computing principles that might impact cryptography in the next decade.”

## Assuming Search Intent

Don’t assume the model will search for what you intended without specific direction. Be explicit about exactly what information you need.**Avoid**: “Tell me about the latest developments.”**Instead**: “What are the latest developments in offshore wind energy technology announced in the past 6 months?”

## [​](https://docs.perplexity.ai/guides/prompt-guide\#handling-urls-and-source-information)  Handling URLs and Source Information

**Never ask for URLs or source links in your prompts.** The generative model cannot see the actual URLs from the web search, which means any URLs it provides in the response text are likely to be hallucinated and incorrect.

### [​](https://docs.perplexity.ai/guides/prompt-guide\#the-right-way-to-access-sources)  The Right Way to Access Sources

URLs and source information are automatically returned in the `search_results` field of the API response. This field contains accurate information about the sources used, including:

- `title`: The title of the source page
- `url`: The actual URL of the source
- `date`: The publication date of the content

**Example of incorrect prompting:**

Copy

Ask AI

```
❌ BAD: "From the past 5 days, identify high-potential Canadian news stories...
For each item, include:
- A clear headline
- 1–2 sentence summary
- Include a link to a source"

```

**Example of correct prompting:**

Copy

Ask AI

```
✅ GOOD: "From the past 5 days, identify high-potential Canadian news stories...
For each item, include:
- A clear headline
- 1–2 sentence summary
- Why it matters from a thought-leadership perspective"

// Then parse URLs from the search_results field in the API response

```

### [​](https://docs.perplexity.ai/guides/prompt-guide\#why-this-matters)  Why This Matters

The web search and language generation components work differently:

1. **Web Search Component**: Finds and retrieves content from specific URLs
2. **Language Generation Component**: Processes the retrieved content but doesn’t have access to the original URLs
3. **API Response**: Provides both the generated text and the accurate source URLs separately

When you ask for URLs in your prompt, the language model will attempt to generate them based on patterns it has seen, but these will not be the actual URLs that were searched. Always use the `search_results` field for accurate source information.

## [​](https://docs.perplexity.ai/guides/prompt-guide\#preventing-hallucination-in-search-results)  Preventing Hallucination in Search Results

**LLMs are designed to be “helpful” and may attempt to provide answers even when they lack sufficient information.** This can lead to hallucinated or inaccurate responses, especially when asking about sources that Sonar cannot access.

### [​](https://docs.perplexity.ai/guides/prompt-guide\#understanding-the-helpfulness-problem)  Understanding the Helpfulness Problem

Large Language Models are trained to be assistive and will often try to provide an answer even when they’re not confident about the information. This tendency can be problematic when:

- You request information from sources that Sonar cannot access (e.g., LinkedIn posts, private documents, paywalled content)
- The search doesn’t return relevant results for your specific query
- You ask for very recent information that may not be indexed yet

### [​](https://docs.perplexity.ai/guides/prompt-guide\#common-scenarios-that-lead-to-hallucination)  Common Scenarios That Lead to Hallucination

**Inaccessible Sources:**

Copy

Ask AI

```
❌ PROBLEMATIC: "What did the CEO of XYZ company post on LinkedIn yesterday about their new product launch?"

```

_Sonar may not be able to access LinkedIn content, but the model might still attempt to provide an answer based on general knowledge or patterns._**Overly Specific Recent Events:**

Copy

Ask AI

```
❌ PROBLEMATIC: "What was discussed in the closed-door meeting between Company A and Company B last week?"

```

_Private information that wouldn’t be publicly searchable may still get a fabricated response._

### [​](https://docs.perplexity.ai/guides/prompt-guide\#how-to-prevent-hallucination)  How to Prevent Hallucination

**Use Explicit Instructions:**
Include clear guidance in your prompts about what to do when information isn’t available:

Copy

Ask AI

```
✅ GOOD: "Search for recent developments in quantum computing breakthroughs.
If you are not able to get search results or find relevant information,
please state that clearly rather than providing speculative information."

```

**Set Clear Boundaries:**

Copy

Ask AI

```
✅ GOOD: "Based on publicly available sources from the past week, what are the latest policy changes in Canadian healthcare?
If no recent information is found, please indicate that no recent updates were discovered."

```

**Request Source Transparency:**

Copy

Ask AI

```
✅ GOOD: "Find information about Tesla's latest earnings report.
Only provide information that you can verify from your search results,
and clearly state if certain details are not available."

```

### [​](https://docs.perplexity.ai/guides/prompt-guide\#best-practices-for-reliable-results)  Best Practices for Reliable Results

## Be Explicit About Limitations

Always instruct the model to acknowledge when it cannot find information rather than guessing.**Example**: “If you cannot find reliable sources for this information, please say so explicitly.”

## Focus on Accessible Sources

Stick to information that is likely to be publicly indexed and searchable.**Avoid**: LinkedIn posts, private company documents, closed meetings
**Prefer**: News articles, public reports, official announcements

## Use Conditional Language

Frame requests with conditional statements that give the model permission to say “I don’t know.”**Example**: “If available, provide details about… Otherwise, indicate what information could not be found.”

## Verify with Multiple Queries

For critical information, consider breaking complex requests into smaller, more specific queries to verify consistency.**Strategy**: Ask the same question in different ways and compare results for consistency.

## [​](https://docs.perplexity.ai/guides/prompt-guide\#use-built-in-search-parameters%2C-not-prompts)  Use Built-in Search Parameters, Not Prompts

**Always use Perplexity’s built-in search parameters instead of trying to control search behavior through prompts.** API parameters are guaranteed to work and are much more effective than asking the model to filter results.

### [​](https://docs.perplexity.ai/guides/prompt-guide\#why-built-in-parameters-are-better)  Why Built-in Parameters Are Better

When you want to control search behavior—such as limiting sources, filtering by date, or adjusting search depth—use the API’s built-in parameters rather than prompt instructions. The search component processes these parameters directly, ensuring reliable and consistent results.

### [​](https://docs.perplexity.ai/guides/prompt-guide\#common-mistakes%3A-prompt-based-control)  Common Mistakes: Prompt-Based Control

**❌ Ineffective - Trying to control via prompts:**

Copy

Ask AI

```
{
  "model": "sonar-pro",
  "messages": [\
    {\
      "role": "user",\
      "content": "Search only on Wikipedia and official government sites for information about climate change policies. Make sure to only look at sources from the past month."\
    }\
  ]
}

```

### [​](https://docs.perplexity.ai/guides/prompt-guide\#correct-approach%3A-use-api-parameters)  Correct Approach: Use API Parameters

**✅ Effective - Using built-in parameters:**

Copy

Ask AI

```
{
  "model": "sonar-pro",
  "messages": [\
    {\
      "role": "user",\
      "content": "What are the latest climate change policies?"\
    }\
  ],
  "search_domain_filter": ["wikipedia.org"]
}

```

### [​](https://docs.perplexity.ai/guides/prompt-guide\#available-search-parameters)  Available Search Parameters

### [​](https://docs.perplexity.ai/guides/prompt-guide\#benefits-of-using-built-in-parameters)  Benefits of Using Built-in Parameters

## Guaranteed Execution

Built-in parameters are processed directly by the search engine, ensuring they’re applied correctly every time.

## Better Performance

Parameters filter results before they reach the language model, leading to more focused and relevant responses.

## Cleaner Prompts

Keep your prompts focused on what you want the model to generate, not how to search.

## Consistent Results

API parameters provide predictable behavior across different queries and use cases.

### [​](https://docs.perplexity.ai/guides/prompt-guide\#advanced-techniques)  Advanced Techniques

We recommend for users _not_ to tune language parameters such as `temperature`, as the default settings for these have already been optimized.

## Parameter Optimization

Adjust model parameters based on your specific needs:

- **Search Domain Filter**: Limit results to trusted sources for research-heavy queries.
- **Search Context Size**: Use “high” for comprehensive research questions and “low” for simple factual queries.

Example configuration for technical documentation:

Copy

Ask AI

```
{
  "search_domain_filter": ["wikipedia.org", "docs.python.org"],
  "web_search_options": {
    "search_context_size": "medium"
  }
}

```

### [​](https://docs.perplexity.ai/guides/prompt-guide\#tips-for-different-query-types)  Tips for Different Query Types

| Query Type | Best Practices |
| --- | --- |
| **Factual Research** | • Use specific questions • Use search domain filters for academic sources • Consider “high” search context size |
| **Creative Content** | • Provide detailed style guidelines in system prompt • Specify tone, voice, and audience |
| **Technical Questions** | • Include relevant technical context • Specify preferred programming language/framework • Use domain filters for documentation sites |
| **Analysis & Insights** | • Request step-by-step reasoning • Ask for specific metrics or criteria |

Was this page helpful?

YesNo

[OpenAI Compatibility\\
\\
Previous](https://docs.perplexity.ai/guides/chat-completions-guide) [Structured Outputs Guide\\
\\
Next](https://docs.perplexity.ai/guides/structured-outputs)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.