[Skip to main content](https://docs.perplexity.ai/guides/file-attachments#content-area)

[Perplexity home page![light logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=78a7baffae224c1a8db2616f1547ff5d)![dark logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=d20039b09af08a25f5bf6c497f549e2e)](https://docs.perplexity.ai/getting-started/overview)

[Docs](https://docs.perplexity.ai/getting-started/overview) [Examples](https://docs.perplexity.ai/cookbook) [API Reference](https://docs.perplexity.ai/api-reference/search-post)

Search...

Navigation

Working with Attachments

File Attachments with Sonar

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

  - [Image Attachments with Sonar](https://docs.perplexity.ai/guides/image-attachments)
  - [File Attachments with Sonar](https://docs.perplexity.ai/guides/file-attachments)
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

- [Overview](https://docs.perplexity.ai/guides/file-attachments#overview)
- [Supported Features](https://docs.perplexity.ai/guides/file-attachments#supported-features)
- [Basic Usage](https://docs.perplexity.ai/guides/file-attachments#basic-usage)
- [Simple Document Analysis](https://docs.perplexity.ai/guides/file-attachments#simple-document-analysis)
- [Using a Public URL](https://docs.perplexity.ai/guides/file-attachments#using-a-public-url)
- [Using Base64 Encoded Bytes](https://docs.perplexity.ai/guides/file-attachments#using-base64-encoded-bytes)
- [Advanced Analysis with Web Search](https://docs.perplexity.ai/guides/file-attachments#advanced-analysis-with-web-search)
- [File Requirements](https://docs.perplexity.ai/guides/file-attachments#file-requirements)
- [Common Use Cases](https://docs.perplexity.ai/guides/file-attachments#common-use-cases)
- [Academic Research](https://docs.perplexity.ai/guides/file-attachments#academic-research)
- [Legal Documents](https://docs.perplexity.ai/guides/file-attachments#legal-documents)
- [Financial Reports](https://docs.perplexity.ai/guides/file-attachments#financial-reports)
- [Technical Documentation](https://docs.perplexity.ai/guides/file-attachments#technical-documentation)
- [Best Practices](https://docs.perplexity.ai/guides/file-attachments#best-practices)
- [Error Handling](https://docs.perplexity.ai/guides/file-attachments#error-handling)
- [Common Issues](https://docs.perplexity.ai/guides/file-attachments#common-issues)
- [Pricing](https://docs.perplexity.ai/guides/file-attachments#pricing)

## [​](https://docs.perplexity.ai/guides/file-attachments\#overview)  Overview

Sonar models support document analysis through file uploads. You can provide files either as URLs to publicly accessible documents or as base64 encoded bytes. Ask questions about document content, get summaries, extract information, and perform detailed analysis of uploaded files in multiple formats including PDF, DOC, DOCX, TXT, and RTF.

**SDK Installation Required**: Install the official SDK first - `pip install perplexityai` for Python or `npm install @perplexity-ai/perplexity_ai` for TypeScript/JavaScript.

Document files can be provided as:

- A public URL pointing to the file
- Base64 encoded bytes (without any prefix)

Supported formats: PDF, DOC, DOCX, TXT, RTF.

The maximum file size is 50MB. Files larger than this limit will not be processed.

## [​](https://docs.perplexity.ai/guides/file-attachments\#supported-features)  Supported Features

- **Document Summarization**: Get concise summaries of document content
- **Question Answering**: Ask specific questions about the document
- **Content Extraction**: Extract key information, data, and insights
- **Multi-language Support**: Analyze documents in various languages
- **Large Document Handling**: Process lengthy documents efficiently
- **Multiple Formats**: Support for PDF, DOC, DOCX, TXT, and RTF files

## [​](https://docs.perplexity.ai/guides/file-attachments\#basic-usage)  Basic Usage

### [​](https://docs.perplexity.ai/guides/file-attachments\#simple-document-analysis)  Simple Document Analysis

#### [​](https://docs.perplexity.ai/guides/file-attachments\#using-a-public-url)  Using a Public URL

cURL

Python

JavaScript

Go

Copy

Ask AI

```
curl -X POST "https://api.perplexity.ai/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      {\
        "content": [\
          {\
            "type": "text",\
            "text": "Summarize this document"\
          },\
          {\
            "type": "file_url",\
            "file_url": {\
              "url": "https://example.com/document.pdf"\
            },\
            "file_name": "document.pdf"\
          }\
        ],\
        "role": "user"\
      }\
    ],
    "model": "sonar-pro"
  }'

```

#### [​](https://docs.perplexity.ai/guides/file-attachments\#using-base64-encoded-bytes)  Using Base64 Encoded Bytes

cURL

Python

JavaScript

Copy

Ask AI

```
curl -X POST "https://api.perplexity.ai/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      {\
        "content": [\
          {\
            "type": "text",\
            "text": "Summarize this document"\
          },\
          {\
            "type": "file_url",\
            "file_url": {\
              "url": "JVBERi0xLjQKJeLjz9MKNCAwIG9iago..."\
            },\
            "file_name": "report.pdf"\
          }\
        ],\
        "role": "user"\
      }\
    ],
    "model": "sonar-pro"
  }'

```

### [​](https://docs.perplexity.ai/guides/file-attachments\#advanced-analysis-with-web-search)  Advanced Analysis with Web Search

cURL

Python

JavaScript

Copy

Ask AI

```
curl -X POST "https://api.perplexity.ai/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      {\
        "content": [\
          {\
            "type": "text",\
            "text": "What are the key findings in this research paper? Provide additional context from recent studies."\
          },\
          {\
            "type": "file_url",\
            "file_url": {\
              "url": "https://example.com/research-paper.pdf"\
            },\
            "file_name": "research-paper.pdf"\
          }\
        ],\
        "role": "user"\
      }\
    ],
    "model": "sonar-pro",
    "web_search_options": {"search_type": "pro"}
  }'

```

## [​](https://docs.perplexity.ai/guides/file-attachments\#file-requirements)  File Requirements

## Format Support

- PDF files (.pdf extension)
- Word documents (.doc, .docx extensions)
- Text files (.txt extension)
- Rich Text Format (.rtf extension)
- Text-based documents (not scanned images)
- Base64 encoded file bytes
- Password-protected files (if publicly accessible)

## Size Limits

- Maximum file size: 50MB
- Recommended: Under 50MB for optimal performance
- Maximum processing time: 60 seconds
- Large files may take longer to analyze

## [​](https://docs.perplexity.ai/guides/file-attachments\#common-use-cases)  Common Use Cases

### [​](https://docs.perplexity.ai/guides/file-attachments\#academic-research)  Academic Research

Copy

Ask AI

```
question = "What methodology was used in this study and what were the main conclusions?"

```

### [​](https://docs.perplexity.ai/guides/file-attachments\#legal-documents)  Legal Documents

Copy

Ask AI

```
question = "Extract the key terms and conditions from this contract"

```

### [​](https://docs.perplexity.ai/guides/file-attachments\#financial-reports)  Financial Reports

Copy

Ask AI

```
question = "What are the revenue trends and key financial metrics mentioned?"

```

### [​](https://docs.perplexity.ai/guides/file-attachments\#technical-documentation)  Technical Documentation

Copy

Ask AI

```
question = "Explain the implementation details and provide a step-by-step guide"

```

## [​](https://docs.perplexity.ai/guides/file-attachments\#best-practices)  Best Practices

Optimize Your Questions

- Be specific about what information you need
- Ask one focused question per request for best results
- Use follow-up questions to dive deeper into specific sections

Prepare Your Documents

- Ensure documents are text-based, not scanned images
- For URLs: Use publicly accessible URLs (Google Drive, Dropbox, etc.)
- For URLs: Verify the URL returns the document directly, not a preview page
- For base64: Encode the entire file content properly
- For base64: Provide only the base64 string without any prefix (no `data:` URI scheme)

Handle Large Documents

- Break down complex questions into smaller parts
- Consider processing large documents in sections
- Use streaming for real-time responses on lengthy analyses

## [​](https://docs.perplexity.ai/guides/file-attachments\#error-handling)  Error Handling

### [​](https://docs.perplexity.ai/guides/file-attachments\#common-issues)  Common Issues

| Error | Cause | Solution |
| --- | --- | --- |
| `Invalid URL` | URL not accessible or invalid base64 | Verify URL returns file directly or check base64 encoding |
| `File too large` | File exceeds 50MB limit | Compress or split the document |
| `Processing timeout` | Document too complex | Simplify question or use smaller sections |
| `Invalid base64` | Malformed base64 string | Ensure proper base64 encoding without prefix |

## [​](https://docs.perplexity.ai/guides/file-attachments\#pricing)  Pricing

PDF analysis follows standard Sonar pricing based on:

- Input tokens (document content + question)
- Output tokens (AI response)
- Web search usage (if enabled)

Large documents consume more input tokens. Consider the document size when estimating costs.

Was this page helpful?

YesNo

[Image Attachments with Sonar\\
\\
Previous](https://docs.perplexity.ai/guides/image-attachments) [Integrating MCP with Perplexity's Sonar API\\
\\
Next](https://docs.perplexity.ai/guides/mcp-server)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.