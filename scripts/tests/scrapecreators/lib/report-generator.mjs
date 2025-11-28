/**
 * Markdown Report Generator
 * Utilities for generating structured Markdown reports
 */

import fs from 'fs';
import path from 'path';

export class MarkdownReportGenerator {
  constructor(title, description) {
    this.title = title;
    this.description = description;
    this.sections = [];
  }

  addSection(title, content) {
    this.sections.push({ title, content });
  }

  addTable(title, headers, rows) {
    let tableContent = `### ${title}\n\n`;

    // Headers
    tableContent += '| ' + headers.join(' | ') + ' |\n';
    tableContent += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    // Rows
    rows.forEach(row => {
      tableContent += '| ' + row.join(' | ') + ' |\n';
    });

    this.sections.push({ content: tableContent });
  }

  addCodeBlock(language, code) {
    this.sections.push({
      content: `\`\`\`${language}\n${code}\n\`\`\``,
    });
  }

  addList(items, ordered = false) {
    const prefix = ordered ? '1.' : '-';
    const listContent = items.map((item, i) => {
      const number = ordered ? `${i + 1}.` : prefix;
      return `${number} ${item}`;
    }).join('\n');

    this.sections.push({ content: listContent });
  }

  generate() {
    let markdown = `# ${this.title}\n\n`;
    markdown += `${this.description}\n\n`;
    markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
    markdown += '---\n\n';

    this.sections.forEach(section => {
      if (section.title) {
        markdown += `## ${section.title}\n\n`;
      }
      markdown += `${section.content}\n\n`;
    });

    return markdown;
  }

  save(filePath) {
    const markdown = this.generate();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, markdown, 'utf-8');
    return filePath;
  }
}

/**
 * Generate a stats summary table
 */
export function generateStatsTable(stats) {
  const headers = ['Metric', 'Value'];
  const rows = [
    ['Total Requests', stats.total],
    ['Successful', `${stats.successful} (${stats.successRate}%)`],
    ['Failed', stats.failed],
    ['Avg Timing', `${stats.timing.avg}ms`],
    ['Min Timing', `${stats.timing.min}ms`],
    ['Max Timing', `${stats.timing.max}ms`],
    ['Median Timing', `${stats.timing.median}ms`],
    ['Total Reels', stats.reels.total],
    ['Avg Reels/Request', stats.reels.avgPerRequest],
    ['Credits Remaining', stats.creditsRemaining],
  ];
  return { headers, rows };
}

/**
 * Generate a results detail table
 */
export function generateResultsTable(results, maxRows = 20) {
  const headers = ['Keyword', 'Status', 'Reels', 'Timing (ms)', 'Error'];
  const rows = results.slice(0, maxRows).map(r => [
    r.keyword,
    r.success ? '✓ Success' : '✗ Failed',
    r.reels?.length || 0,
    r.timing ? r.timing.toFixed(2) : 'N/A',
    r.error || '-',
  ]);

  if (results.length > maxRows) {
    rows.push(['...', `(${results.length - maxRows} more rows)`, '', '', '']);
  }

  return { headers, rows };
}

/**
 * Generate comparison table
 */
export function generateComparisonTable(comparisons) {
  const headers = ['Metric', ...comparisons.map(c => c.label)];

  const metrics = [
    { key: 'total', label: 'Total Requests' },
    { key: 'successRate', label: 'Success Rate' },
    { key: 'avgTiming', label: 'Avg Timing (ms)' },
    { key: 'totalReels', label: 'Total Reels' },
    { key: 'uniqueCreators', label: 'Unique Creators' },
    { key: 'duplicationRate', label: 'Duplication Rate' },
  ];

  const rows = metrics.map(metric => {
    const row = [metric.label];
    comparisons.forEach(comp => {
      const value = comp.data[metric.key];
      row.push(value !== undefined ? value : 'N/A');
    });
    return row;
  });

  return { headers, rows };
}
