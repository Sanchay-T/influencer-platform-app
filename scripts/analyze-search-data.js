/**
 * Search Data Analysis Script
 * 
 * Analyzes logged API data to identify patterns, inconsistencies,
 * and opportunities for streamlining across all 6 search endpoints.
 * 
 * Usage: node scripts/analyze-search-data.js
 */

const fs = require('fs');
const path = require('path');

/**
 * Load all log files from a directory
 */
function loadLogFiles(directory) {
  const dirPath = path.join(process.cwd(), 'logs', 'api-analysis', directory);
  
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️ Directory ${directory} does not exist`);
    return [];
  }
  
  const files = fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      try {
        const filePath = path.join(dirPath, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          filename: file,
          path: filePath,
          data: content
        };
      } catch (error) {
        console.error(`❌ Error reading ${file}:`, error.message);
        return null;
      }
    })
    .filter(Boolean);
  
  return files;
}

/**
 * Extract data structure information from an object
 */
function analyzeDataStructure(obj, path = '') {
  if (!obj || typeof obj !== 'object') {
    return {
      type: typeof obj,
      path,
      value: obj
    };
  }
  
  const structure = {
    type: Array.isArray(obj) ? 'array' : 'object',
    path,
    properties: {}
  };
  
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      structure.arrayItemStructure = analyzeDataStructure(obj[0], `${path}[0]`);
      structure.arrayLength = obj.length;
    }
  } else {
    for (const key in obj) {
      const value = obj[key];
      const keyPath = path ? `${path}.${key}` : key;
      structure.properties[key] = analyzeDataStructure(value, keyPath);
    }
  }
  
  return structure;
}

/**
 * Compare data structures between different search types
 */
function compareDataStructures(structures) {
  const comparison = {
    commonFields: {},
    uniqueFields: {},
    typeConflicts: {},
    coverage: {}
  };
  
  const allFields = new Set();
  const fieldsBySearch = {};
  
  // Collect all fields from all search types
  Object.entries(structures).forEach(([searchKey, structure]) => {
    fieldsBySearch[searchKey] = new Set();
    
    function extractFields(obj, prefix = '') {
      if (obj.properties) {
        Object.keys(obj.properties).forEach(key => {
          const fieldPath = prefix ? `${prefix}.${key}` : key;
          allFields.add(fieldPath);
          fieldsBySearch[searchKey].add(fieldPath);
          
          if (obj.properties[key].properties) {
            extractFields(obj.properties[key], fieldPath);
          }
        });
      }
    }
    
    extractFields(structure);
  });
  
  // Analyze field coverage
  allFields.forEach(field => {
    const searchesWithField = Object.keys(fieldsBySearch).filter(
      searchKey => fieldsBySearch[searchKey].has(field)
    );
    
    comparison.coverage[field] = {
      count: searchesWithField.length,
      searches: searchesWithField,
      percentage: (searchesWithField.length / Object.keys(structures).length) * 100
    };
    
    if (searchesWithField.length === Object.keys(structures).length) {
      comparison.commonFields[field] = searchesWithField;
    } else if (searchesWithField.length === 1) {
      comparison.uniqueFields[field] = searchesWithField[0];
    }
  });
  
  return comparison;
}

/**
 * Analyze data quality metrics
 */
function analyzeDataQuality(transformedLogs) {
  const qualityAnalysis = {
    bySearchType: {},
    overall: {
      totalSessions: 0,
      averageResults: 0,
      qualityScores: {}
    }
  };
  
  transformedLogs.forEach(log => {
    const searchKey = log.data.searchKey;
    const quality = log.data.dataQuality || {};
    
    if (!qualityAnalysis.bySearchType[searchKey]) {
      qualityAnalysis.bySearchType[searchKey] = {
        sessions: 0,
        totalResults: 0,
        qualityMetrics: {
          hasImages: 0,
          hasBios: 0,
          hasEmails: 0,
          hasEngagement: 0
        }
      };
    }
    
    const analysis = qualityAnalysis.bySearchType[searchKey];
    analysis.sessions++;
    analysis.totalResults += quality.totalResults || 0;
    
    // Track quality metrics
    if (quality.hasImages) analysis.qualityMetrics.hasImages++;
    if (quality.hasBios) analysis.qualityMetrics.hasBios++;
    if (quality.hasEmails) analysis.qualityMetrics.hasEmails++;
    if (quality.hasEngagement) analysis.qualityMetrics.hasEngagement++;
  });
  
  // Calculate percentages and overall metrics
  Object.entries(qualityAnalysis.bySearchType).forEach(([searchKey, analysis]) => {
    const sessions = analysis.sessions;
    
    analysis.averageResults = analysis.totalResults / sessions;
    analysis.qualityPercentages = {
      hasImages: (analysis.qualityMetrics.hasImages / sessions) * 100,
      hasBios: (analysis.qualityMetrics.hasBios / sessions) * 100,
      hasEmails: (analysis.qualityMetrics.hasEmails / sessions) * 100,
      hasEngagement: (analysis.qualityMetrics.hasEngagement / sessions) * 100
    };
    
    qualityAnalysis.overall.totalSessions += sessions;
  });
  
  return qualityAnalysis;
}

/**
 * Generate streamlining recommendations
 */
function generateRecommendations(structureComparison, qualityAnalysis) {
  const recommendations = {
    dataUnification: [],
    qualityImprovements: [],
    structuralChanges: [],
    priorityActions: []
  };
  
  // Analyze field coverage for unification opportunities
  Object.entries(structureComparison.coverage).forEach(([field, coverage]) => {
    if (coverage.percentage >= 50 && coverage.percentage < 100) {
      recommendations.dataUnification.push({
        field,
        currentCoverage: coverage.percentage,
        missingFrom: Object.keys(qualityAnalysis.bySearchType).filter(
          searchKey => !coverage.searches.includes(searchKey)
        ),
        action: `Standardize ${field} across all search types`
      });
    }
  });
  
  // Quality improvements based on analysis
  Object.entries(qualityAnalysis.bySearchType).forEach(([searchKey, analysis]) => {
    const percentages = analysis.qualityPercentages;
    
    if (percentages.hasImages < 80) {
      recommendations.qualityImprovements.push({
        searchType: searchKey,
        issue: 'Low image availability',
        currentRate: percentages.hasImages,
        action: 'Implement image proxy and fallback system'
      });
    }
    
    if (percentages.hasBios < 50) {
      recommendations.qualityImprovements.push({
        searchType: searchKey,
        issue: 'Low bio data availability',
        currentRate: percentages.hasBios,
        action: 'Implement enhanced profile fetching'
      });
    }
    
    if (percentages.hasEmails < 30) {
      recommendations.qualityImprovements.push({
        searchType: searchKey,
        issue: 'Low email extraction rate',
        currentRate: percentages.hasEmails,
        action: 'Extend email extraction system'
      });
    }
  });
  
  // Structural change recommendations
  const uniqueFieldCount = Object.keys(structureComparison.uniqueFields).length;
  if (uniqueFieldCount > 10) {
    recommendations.structuralChanges.push({
      issue: `${uniqueFieldCount} unique fields across search types`,
      action: 'Consider unified data structure with optional fields'
    });
  }
  
  // Priority actions
  if (recommendations.dataUnification.length > 0) {
    recommendations.priorityActions.push({
      priority: 'High',
      action: 'Standardize common data fields',
      impact: 'Enables unified components and consistent user experience'
    });
  }
  
  if (recommendations.qualityImprovements.length > 0) {
    recommendations.priorityActions.push({
      priority: 'Medium',
      action: 'Improve data quality across platforms',
      impact: 'Better user value and lead generation'
    });
  }
  
  return recommendations;
}

/**
 * Generate comprehensive analysis report
 */
function generateAnalysisReport(analysis) {
  const timestamp = new Date().toISOString();
  const reportFile = `data-analysis-report-${timestamp.replace(/[:.]/g, '-')}.json`;
  const reportPath = path.join(process.cwd(), 'logs', 'api-analysis', 'analysis', reportFile);
  
  const report = {
    timestamp,
    summary: {
      totalLogFiles: analysis.logCounts,
      searchTypesAnalyzed: Object.keys(analysis.dataStructures).length,
      qualityMetrics: analysis.qualityAnalysis.overall
    },
    dataStructures: analysis.dataStructures,
    structureComparison: analysis.structureComparison,
    qualityAnalysis: analysis.qualityAnalysis,
    recommendations: analysis.recommendations,
    metadata: {
      generatedBy: 'analyze-search-data.js',
      version: '1.0.0'
    }
  };
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Analysis report saved: ${reportFile}`);
    return reportPath;
  } catch (error) {
    console.error(`❌ Failed to save analysis report:`, error.message);
    return null;
  }
}

/**
 * Print analysis summary to console
 */
function printAnalysisSummary(analysis) {
  console.log(`\n📊 SEARCH DATA ANALYSIS SUMMARY`);
  console.log(`==================================================`);
  
  console.log(`\n📁 Log Files Analyzed:`);
  Object.entries(analysis.logCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} files`);
  });
  
  console.log(`\n🔍 Search Types Found:`);
  Object.keys(analysis.dataStructures).forEach(searchKey => {
    console.log(`  - ${searchKey}`);
  });
  
  console.log(`\n📋 Structure Analysis:`);
  console.log(`  Common fields: ${Object.keys(analysis.structureComparison.commonFields).length}`);
  console.log(`  Unique fields: ${Object.keys(analysis.structureComparison.uniqueFields).length}`);
  
  console.log(`\n📈 Quality Analysis:`);
  Object.entries(analysis.qualityAnalysis.bySearchType).forEach(([searchKey, data]) => {
    console.log(`  ${searchKey}: ${data.sessions} sessions, avg ${data.averageResults.toFixed(1)} results`);
  });
  
  console.log(`\n🎯 Recommendations:`);
  console.log(`  Data unification: ${analysis.recommendations.dataUnification.length} items`);
  console.log(`  Quality improvements: ${analysis.recommendations.qualityImprovements.length} items`);
  console.log(`  Priority actions: ${analysis.recommendations.priorityActions.length} items`);
  
  if (analysis.recommendations.priorityActions.length > 0) {
    console.log(`\n🔥 Top Priority Actions:`);
    analysis.recommendations.priorityActions.forEach(action => {
      console.log(`  ${action.priority}: ${action.action}`);
    });
  }
}

/**
 * Main analysis function
 */
async function analyzeAllSearchData() {
  console.log(`🔬 Search Data Analysis Starting...`);
  console.log(`📅 ${new Date().toISOString()}`);
  
  // Load all log files
  const requests = loadLogFiles('requests');
  const rawResponses = loadLogFiles('raw-responses');
  const transformed = loadLogFiles('transformed');
  const summaries = loadLogFiles('analysis');
  
  const logCounts = {
    requests: requests.length,
    rawResponses: rawResponses.length,
    transformed: transformed.length,
    summaries: summaries.length
  };
  
  console.log(`\n📊 Loaded ${logCounts.requests + logCounts.rawResponses + logCounts.transformed + logCounts.summaries} total log files`);
  
  if (transformed.length === 0) {
    console.log(`⚠️ No transformed data found. Run some searches first.`);
    return;
  }
  
  // Analyze data structures
  console.log(`\n🔍 Analyzing data structures...`);
  const dataStructures = {};
  
  transformed.forEach(log => {
    const searchKey = log.data.searchKey;
    if (!dataStructures[searchKey] && log.data.transformedData) {
      dataStructures[searchKey] = analyzeDataStructure(log.data.transformedData);
    }
  });
  
  // Compare structures
  console.log(`🔄 Comparing data structures...`);
  const structureComparison = compareDataStructures(dataStructures);
  
  // Analyze quality
  console.log(`📈 Analyzing data quality...`);
  const qualityAnalysis = analyzeDataQuality(transformed);
  
  // Generate recommendations
  console.log(`💡 Generating recommendations...`);
  const recommendations = generateRecommendations(structureComparison, qualityAnalysis);
  
  const analysis = {
    logCounts,
    dataStructures,
    structureComparison,
    qualityAnalysis,
    recommendations
  };
  
  // Generate report
  const reportPath = generateAnalysisReport(analysis);
  
  // Print summary
  printAnalysisSummary(analysis);
  
  console.log(`\n✅ Analysis complete!`);
  if (reportPath) {
    console.log(`📂 Detailed report: ${path.basename(reportPath)}`);
  }
  
  return analysis;
}

// Run if called directly
if (require.main === module) {
  analyzeAllSearchData().catch(error => {
    console.error(`💥 Analysis failed:`, error.message);
    process.exit(1);
  });
}

module.exports = {
  analyzeAllSearchData,
  analyzeDataStructure,
  compareDataStructures,
  analyzeDataQuality,
  generateRecommendations
};