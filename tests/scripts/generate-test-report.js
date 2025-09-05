#!/usr/bin/env node
/**
 * Test Report Generator for Phase 4 Review System
 * Consolidates test results from all test suites and generates comprehensive reports
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

class TestReportGenerator {
  constructor() {
    this.reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        coverage: {
          overall: 0,
          backend: 0,
          frontend: 0,
          integration: 0
        },
        qualityGates: {
          coverage: false,
          security: false,
          accessibility: false,
          performance: false
        }
      },
      suites: {
        backend: null,
        frontend: null,
        integration: null,
        e2e: null,
        performance: null,
        security: null,
        accessibility: null
      },
      trends: [],
      recommendations: []
    };
  }

  async generateReport(resultsDirectory) {
    console.log('🔍 Generating comprehensive test report...');
    const startTime = performance.now();

    try {
      // Parse all test results
      await this.parseTestResults(resultsDirectory);
      
      // Calculate metrics and summaries
      await this.calculateMetrics();
      
      // Generate quality recommendations
      await this.generateRecommendations();
      
      // Create report files
      await this.createReportFiles(resultsDirectory);
      
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Test report generated successfully in ${duration}s`);
      console.log(`📊 Total tests: ${this.reportData.summary.totalTests}`);
      console.log(`✓ Passed: ${this.reportData.summary.passed}`);
      console.log(`✗ Failed: ${this.reportData.summary.failed}`);
      console.log(`⏭ Skipped: ${this.reportData.summary.skipped}`);
      console.log(`📈 Overall coverage: ${this.reportData.summary.coverage.overall}%`);

    } catch (error) {
      console.error('❌ Error generating test report:', error);
      process.exit(1);
    }
  }

  async parseTestResults(resultsDir) {
    console.log('📊 Parsing test results from all suites...');

    const suitePromises = [
      this.parseBackendResults(resultsDir),
      this.parseFrontendResults(resultsDir),
      this.parseIntegrationResults(resultsDir),
      this.parseE2EResults(resultsDir),
      this.parsePerformanceResults(resultsDir),
      this.parseSecurityResults(resultsDir),
      this.parseAccessibilityResults(resultsDir)
    ];

    await Promise.all(suitePromises);
  }

  async parseBackendResults(resultsDir) {
    try {
      const backendResults = await this.findAndParseFile(resultsDir, 'backend-unit.xml', 'junit');
      const coverageData = await this.findAndParseFile(resultsDir, 'backend-coverage.xml', 'coverage');
      
      this.reportData.suites.backend = {
        name: 'Backend Unit Tests',
        status: backendResults?.failures === 0 ? 'passed' : 'failed',
        tests: backendResults?.tests || 0,
        passed: (backendResults?.tests || 0) - (backendResults?.failures || 0),
        failed: backendResults?.failures || 0,
        skipped: backendResults?.skipped || 0,
        duration: backendResults?.time || 0,
        coverage: this.extractCoveragePercentage(coverageData),
        details: backendResults?.testcases || [],
        coverageDetails: coverageData
      };

      console.log(`  ✓ Backend tests: ${this.reportData.suites.backend.tests} tests, ${this.reportData.suites.backend.coverage}% coverage`);
    } catch (error) {
      console.log(`  ⚠ Backend results not found or invalid: ${error.message}`);
      this.reportData.suites.backend = this.createEmptySuite('Backend Unit Tests');
    }
  }

  async parseFrontendResults(resultsDir) {
    try {
      const frontendResults = await this.findAndParseFile(resultsDir, 'frontend-unit.xml', 'junit');
      const coverageData = await this.findAndParseFile(resultsDir, 'lcov.info', 'lcov');
      
      this.reportData.suites.frontend = {
        name: 'Frontend Unit Tests',
        status: frontendResults?.failures === 0 ? 'passed' : 'failed',
        tests: frontendResults?.tests || 0,
        passed: (frontendResults?.tests || 0) - (frontendResults?.failures || 0),
        failed: frontendResults?.failures || 0,
        skipped: frontendResults?.skipped || 0,
        duration: frontendResults?.time || 0,
        coverage: this.extractLcovCoverage(coverageData),
        details: frontendResults?.testcases || [],
        coverageDetails: coverageData
      };

      console.log(`  ✓ Frontend tests: ${this.reportData.suites.frontend.tests} tests, ${this.reportData.suites.frontend.coverage}% coverage`);
    } catch (error) {
      console.log(`  ⚠ Frontend results not found or invalid: ${error.message}`);
      this.reportData.suites.frontend = this.createEmptySuite('Frontend Unit Tests');
    }
  }

  async parseIntegrationResults(resultsDir) {
    try {
      const integrationResults = await this.findAndParseFile(resultsDir, 'integration.xml', 'junit');
      
      this.reportData.suites.integration = {
        name: 'Integration Tests',
        status: integrationResults?.failures === 0 ? 'passed' : 'failed',
        tests: integrationResults?.tests || 0,
        passed: (integrationResults?.tests || 0) - (integrationResults?.failures || 0),
        failed: integrationResults?.failures || 0,
        skipped: integrationResults?.skipped || 0,
        duration: integrationResults?.time || 0,
        coverage: 0, // Integration tests don't typically provide coverage
        details: integrationResults?.testcases || []
      };

      console.log(`  ✓ Integration tests: ${this.reportData.suites.integration.tests} tests`);
    } catch (error) {
      console.log(`  ⚠ Integration results not found or invalid: ${error.message}`);
      this.reportData.suites.integration = this.createEmptySuite('Integration Tests');
    }
  }

  async parseE2EResults(resultsDir) {
    try {
      const e2eFiles = await this.findFiles(resultsDir, 'playwright-junit.xml');
      let totalTests = 0, totalPassed = 0, totalFailed = 0, totalDuration = 0;
      const allDetails = [];

      for (const file of e2eFiles) {
        const results = await this.parseJUnitXML(await fs.readFile(file, 'utf8'));
        totalTests += results.tests || 0;
        totalFailed += results.failures || 0;
        totalPassed += (results.tests || 0) - (results.failures || 0);
        totalDuration += results.time || 0;
        allDetails.push(...(results.testcases || []));
      }

      this.reportData.suites.e2e = {
        name: 'End-to-End Tests',
        status: totalFailed === 0 ? 'passed' : 'failed',
        tests: totalTests,
        passed: totalPassed,
        failed: totalFailed,
        skipped: 0,
        duration: totalDuration,
        coverage: 0,
        details: allDetails,
        browsers: ['chromium', 'firefox', 'webkit'],
        shards: 4
      };

      console.log(`  ✓ E2E tests: ${totalTests} tests across ${e2eFiles.length} browser/shard combinations`);
    } catch (error) {
      console.log(`  ⚠ E2E results not found or invalid: ${error.message}`);
      this.reportData.suites.e2e = this.createEmptySuite('End-to-End Tests');
    }
  }

  async parsePerformanceResults(resultsDir) {
    try {
      const perfData = await this.findAndParseFile(resultsDir, 'performance-results.json', 'json');
      
      if (perfData && perfData.results) {
        const results = perfData.results;
        this.reportData.suites.performance = {
          name: 'Performance Tests',
          status: results.passed ? 'passed' : 'failed',
          metrics: {
            pageLoadTime: results.pageLoadTime || 0,
            apiResponseTime: results.apiResponseTime || 0,
            throughput: results.throughput || 0,
            errorRate: results.errorRate || 0,
            memoryUsage: results.memoryUsage || 0
          },
          benchmarks: results.benchmarks || [],
          thresholds: results.thresholds || {},
          passed: results.passed || false
        };
        
        console.log(`  ✓ Performance tests: ${results.benchmarks?.length || 0} benchmarks`);
      } else {
        throw new Error('Invalid performance data structure');
      }
    } catch (error) {
      console.log(`  ⚠ Performance results not found or invalid: ${error.message}`);
      this.reportData.suites.performance = {
        name: 'Performance Tests',
        status: 'not_run',
        metrics: {},
        benchmarks: [],
        passed: false
      };
    }
  }

  async parseSecurityResults(resultsDir) {
    try {
      const securityData = await this.findAndParseFile(resultsDir, 'security-results.json', 'json');
      
      if (securityData) {
        this.reportData.suites.security = {
          name: 'Security Tests',
          status: securityData.vulnerabilities?.critical === 0 && securityData.vulnerabilities?.high === 0 ? 'passed' : 'failed',
          vulnerabilities: securityData.vulnerabilities || {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
          },
          tests: securityData.tests || [],
          dependencyIssues: securityData.dependencyIssues || [],
          codeIssues: securityData.codeIssues || [],
          passed: (securityData.vulnerabilities?.critical || 0) === 0 && (securityData.vulnerabilities?.high || 0) === 0
        };
        
        console.log(`  ✓ Security tests: ${securityData.vulnerabilities?.critical || 0} critical, ${securityData.vulnerabilities?.high || 0} high issues`);
      } else {
        throw new Error('Invalid security data structure');
      }
    } catch (error) {
      console.log(`  ⚠ Security results not found or invalid: ${error.message}`);
      this.reportData.suites.security = {
        name: 'Security Tests',
        status: 'not_run',
        vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        tests: [],
        passed: false
      };
    }
  }

  async parseAccessibilityResults(resultsDir) {
    try {
      const a11yData = await this.findAndParseFile(resultsDir, 'accessibility-results.json', 'json');
      
      if (a11yData) {
        this.reportData.suites.accessibility = {
          name: 'Accessibility Tests',
          status: a11yData.violations?.length === 0 ? 'passed' : 'failed',
          violations: a11yData.violations || [],
          passed: (a11yData.violations?.length || 0) === 0,
          wcagLevel: a11yData.wcagLevel || 'AA',
          pages: a11yData.pages || [],
          score: a11yData.score || 0
        };
        
        console.log(`  ✓ Accessibility tests: ${a11yData.violations?.length || 0} violations found`);
      } else {
        throw new Error('Invalid accessibility data structure');
      }
    } catch (error) {
      console.log(`  ⚠ Accessibility results not found or invalid: ${error.message}`);
      this.reportData.suites.accessibility = {
        name: 'Accessibility Tests',
        status: 'not_run',
        violations: [],
        passed: false,
        score: 0
      };
    }
  }

  async calculateMetrics() {
    console.log('📊 Calculating overall metrics...');
    
    // Calculate test totals
    Object.values(this.reportData.suites).forEach(suite => {
      if (suite && suite.tests) {
        this.reportData.summary.totalTests += suite.tests;
        this.reportData.summary.passed += suite.passed || 0;
        this.reportData.summary.failed += suite.failed || 0;
        this.reportData.summary.skipped += suite.skipped || 0;
        this.reportData.summary.duration += suite.duration || 0;
      }
    });

    // Calculate coverage
    const coverageData = [
      { name: 'backend', value: this.reportData.suites.backend?.coverage || 0 },
      { name: 'frontend', value: this.reportData.suites.frontend?.coverage || 0 },
      { name: 'integration', value: this.reportData.suites.integration?.coverage || 0 }
    ].filter(c => c.value > 0);

    if (coverageData.length > 0) {
      this.reportData.summary.coverage.overall = 
        coverageData.reduce((sum, c) => sum + c.value, 0) / coverageData.length;
      
      coverageData.forEach(c => {
        this.reportData.summary.coverage[c.name] = c.value;
      });
    }

    // Evaluate quality gates
    this.reportData.summary.qualityGates = {
      coverage: this.reportData.summary.coverage.overall >= 85,
      security: this.reportData.suites.security?.passed || false,
      accessibility: this.reportData.suites.accessibility?.passed || false,
      performance: this.reportData.suites.performance?.passed || false
    };

    console.log('  ✓ Metrics calculated successfully');
  }

  async generateRecommendations() {
    console.log('💡 Generating quality recommendations...');
    
    const recommendations = [];

    // Coverage recommendations
    if (this.reportData.summary.coverage.overall < 90) {
      recommendations.push({
        category: 'coverage',
        priority: 'high',
        title: 'Improve Test Coverage',
        description: `Overall test coverage is ${this.reportData.summary.coverage.overall.toFixed(1)}%. Target is 90%.`,
        actions: [
          'Add unit tests for uncovered functions',
          'Increase integration test scenarios',
          'Review and remove dead code'
        ]
      });
    }

    // Security recommendations
    if (this.reportData.suites.security?.vulnerabilities?.critical > 0) {
      recommendations.push({
        category: 'security',
        priority: 'critical',
        title: 'Critical Security Vulnerabilities',
        description: `Found ${this.reportData.suites.security.vulnerabilities.critical} critical security issues.`,
        actions: [
          'Update vulnerable dependencies immediately',
          'Review and fix identified code vulnerabilities',
          'Run security audit in production environment'
        ]
      });
    }

    // Performance recommendations
    if (this.reportData.suites.performance?.metrics?.pageLoadTime > 3000) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        title: 'Page Load Performance',
        description: `Page load time is ${this.reportData.suites.performance.metrics.pageLoadTime}ms. Target is <3000ms.`,
        actions: [
          'Optimize bundle size and implement code splitting',
          'Implement lazy loading for non-critical resources',
          'Review and optimize database queries'
        ]
      });
    }

    // Test reliability recommendations
    const failureRate = this.reportData.summary.totalTests > 0 ? 
      (this.reportData.summary.failed / this.reportData.summary.totalTests) * 100 : 0;
    
    if (failureRate > 5) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        title: 'Test Reliability Issues',
        description: `Test failure rate is ${failureRate.toFixed(1)}%. Target is <5%.`,
        actions: [
          'Investigate and fix flaky tests',
          'Improve test data setup and teardown',
          'Add better error handling in test scenarios'
        ]
      });
    }

    // Accessibility recommendations
    if (this.reportData.suites.accessibility?.violations?.length > 0) {
      recommendations.push({
        category: 'accessibility',
        priority: 'medium',
        title: 'Accessibility Compliance',
        description: `Found ${this.reportData.suites.accessibility.violations.length} accessibility violations.`,
        actions: [
          'Fix identified WCAG violations',
          'Add proper ARIA labels and roles',
          'Test with screen readers and keyboard navigation'
        ]
      });
    }

    this.reportData.recommendations = recommendations;
    console.log(`  ✓ Generated ${recommendations.length} recommendations`);
  }

  async createReportFiles(resultsDir) {
    console.log('📝 Creating report files...');
    
    const reportsDir = path.join(resultsDir, '../reports/consolidated');
    await fs.mkdir(reportsDir, { recursive: true });

    // JSON summary
    await fs.writeFile(
      path.join(reportsDir, 'summary.json'),
      JSON.stringify(this.reportData, null, 2)
    );

    // HTML report
    const htmlReport = await this.generateHTMLReport();
    await fs.writeFile(
      path.join(reportsDir, 'index.html'),
      htmlReport
    );

    // Markdown report
    const markdownReport = await this.generateMarkdownReport();
    await fs.writeFile(
      path.join(reportsDir, 'README.md'),
      markdownReport
    );

    // CSV for data analysis
    const csvReport = await this.generateCSVReport();
    await fs.writeFile(
      path.join(reportsDir, 'metrics.csv'),
      csvReport
    );

    console.log(`  ✓ Reports saved to ${reportsDir}`);
  }

  async generateHTMLReport() {
    const totalTests = this.reportData.summary.totalTests;
    const passRate = totalTests > 0 ? ((this.reportData.summary.passed / totalTests) * 100).toFixed(1) : 0;
    const overallStatus = this.reportData.summary.failed === 0 ? 'PASSED' : 'FAILED';
    const statusColor = overallStatus === 'PASSED' ? '#10b981' : '#ef4444';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phase 4 Review System - Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2rem; }
        .header .meta { margin-top: 10px; opacity: 0.9; }
        .status { display: inline-block; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 0.9rem; }
        .status.passed { background: #10b981; }
        .status.failed { background: #ef4444; }
        .summary { padding: 30px; border-bottom: 1px solid #e5e7eb; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
        .metric-value { font-size: 2rem; font-weight: bold; color: #1f2937; }
        .metric-label { font-size: 0.9rem; color: #6b7280; margin-top: 5px; }
        .suites { padding: 30px; }
        .suite { margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .suite-header { padding: 15px 20px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .suite-name { font-weight: 600; font-size: 1.1rem; }
        .suite-status { padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 500; }
        .suite-status.passed { background: #d1fae5; color: #065f46; }
        .suite-status.failed { background: #fee2e2; color: #991b1b; }
        .suite-status.not_run { background: #f3f4f6; color: #374151; }
        .suite-details { padding: 20px; }
        .suite-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px; }
        .suite-stat { text-align: center; }
        .suite-stat-value { font-size: 1.5rem; font-weight: bold; }
        .suite-stat-label { font-size: 0.8rem; color: #6b7280; }
        .recommendations { padding: 30px; background: #fffbeb; }
        .recommendation { margin-bottom: 20px; padding: 15px; border-left: 4px solid #f59e0b; background: white; border-radius: 0 4px 4px 0; }
        .recommendation.critical { border-left-color: #ef4444; }
        .recommendation.high { border-left-color: #f59e0b; }
        .recommendation.medium { border-left-color: #3b82f6; }
        .recommendation-title { font-weight: 600; margin-bottom: 8px; }
        .recommendation-actions { margin-top: 10px; }
        .recommendation-actions li { margin-bottom: 4px; }
        .footer { padding: 20px; text-align: center; color: #6b7280; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Phase 4 Review System</h1>
            <div class="meta">
                Test Report Generated: ${new Date(this.reportData.timestamp).toLocaleString()}
            </div>
        </div>

        <div class="summary">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Test Summary</h2>
                <span class="status ${overallStatus.toLowerCase()}" style="background: ${statusColor};">
                    ${overallStatus} (${passRate}% Pass Rate)
                </span>
            </div>
            
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">${totalTests}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #10b981;">${this.reportData.summary.passed}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #ef4444;">${this.reportData.summary.failed}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.reportData.summary.coverage.overall.toFixed(1)}%</div>
                    <div class="metric-label">Coverage</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${(this.reportData.summary.duration / 1000).toFixed(1)}s</div>
                    <div class="metric-label">Duration</div>
                </div>
            </div>
        </div>

        <div class="suites">
            <h2>Test Suites</h2>
            ${Object.values(this.reportData.suites).map(suite => {
              if (!suite) return '';
              return `
                <div class="suite">
                    <div class="suite-header">
                        <span class="suite-name">${suite.name}</span>
                        <span class="suite-status ${suite.status}">${suite.status.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <div class="suite-details">
                        ${suite.tests ? `
                        <div class="suite-stats">
                            <div class="suite-stat">
                                <div class="suite-stat-value">${suite.tests}</div>
                                <div class="suite-stat-label">Tests</div>
                            </div>
                            <div class="suite-stat">
                                <div class="suite-stat-value" style="color: #10b981;">${suite.passed || 0}</div>
                                <div class="suite-stat-label">Passed</div>
                            </div>
                            <div class="suite-stat">
                                <div class="suite-stat-value" style="color: #ef4444;">${suite.failed || 0}</div>
                                <div class="suite-stat-label">Failed</div>
                            </div>
                            ${suite.coverage ? `
                            <div class="suite-stat">
                                <div class="suite-stat-value">${suite.coverage.toFixed(1)}%</div>
                                <div class="suite-stat-label">Coverage</div>
                            </div>
                            ` : ''}
                            <div class="suite-stat">
                                <div class="suite-stat-value">${(suite.duration / 1000).toFixed(1)}s</div>
                                <div class="suite-stat-label">Duration</div>
                            </div>
                        </div>
                        ` : ''}
                        ${suite.metrics ? `
                        <div class="suite-stats">
                            ${Object.entries(suite.metrics).map(([key, value]) => `
                            <div class="suite-stat">
                                <div class="suite-stat-value">${typeof value === 'number' ? value.toFixed(2) : value}</div>
                                <div class="suite-stat-label">${key.replace(/([A-Z])/g, ' $1').toLowerCase()}</div>
                            </div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
              `;
            }).join('')}
        </div>

        ${this.reportData.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Quality Recommendations</h2>
            ${this.reportData.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <div class="recommendation-title">${rec.title}</div>
                    <div>${rec.description}</div>
                    <div class="recommendation-actions">
                        <strong>Recommended Actions:</strong>
                        <ul>
                            ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="footer">
            Generated by Phase 4 Review System Test Suite
        </div>
    </div>
</body>
</html>`;
  }

  async generateMarkdownReport() {
    const totalTests = this.reportData.summary.totalTests;
    const passRate = totalTests > 0 ? ((this.reportData.summary.passed / totalTests) * 100).toFixed(1) : 0;
    const overallStatus = this.reportData.summary.failed === 0 ? '✅ PASSED' : '❌ FAILED';

    return `# Phase 4 Review System - Test Report

**Generated:** ${new Date(this.reportData.timestamp).toLocaleString()}  
**Status:** ${overallStatus} (${passRate}% Pass Rate)

## Summary

| Metric | Value |
|--------|--------|
| Total Tests | ${totalTests} |
| Passed | ${this.reportData.summary.passed} |
| Failed | ${this.reportData.summary.failed} |
| Skipped | ${this.reportData.summary.skipped} |
| Overall Coverage | ${this.reportData.summary.coverage.overall.toFixed(1)}% |
| Duration | ${(this.reportData.summary.duration / 1000).toFixed(1)}s |

## Test Suites

${Object.values(this.reportData.suites).map(suite => {
  if (!suite) return '';
  const statusEmoji = suite.status === 'passed' ? '✅' : suite.status === 'failed' ? '❌' : '⚪';
  return `### ${statusEmoji} ${suite.name}

- **Status:** ${suite.status.replace('_', ' ').toUpperCase()}
${suite.tests ? `- **Tests:** ${suite.tests} (${suite.passed} passed, ${suite.failed} failed)` : ''}
${suite.coverage ? `- **Coverage:** ${suite.coverage.toFixed(1)}%` : ''}
${suite.duration ? `- **Duration:** ${(suite.duration / 1000).toFixed(1)}s` : ''}
${suite.metrics ? `- **Metrics:** ${Object.entries(suite.metrics).map(([k, v]) => `${k}: ${v}`).join(', ')}` : ''}
`;
}).join('\n')}

## Quality Gates

| Gate | Status | Threshold |
|------|---------|-----------|
| Coverage | ${this.reportData.summary.qualityGates.coverage ? '✅' : '❌'} | ≥85% |
| Security | ${this.reportData.summary.qualityGates.security ? '✅' : '❌'} | No critical/high vulnerabilities |
| Accessibility | ${this.reportData.summary.qualityGates.accessibility ? '✅' : '❌'} | No violations |
| Performance | ${this.reportData.summary.qualityGates.performance ? '✅' : '❌'} | Meets benchmarks |

${this.reportData.recommendations.length > 0 ? `
## Recommendations

${this.reportData.recommendations.map((rec, index) => `
### ${index + 1}. ${rec.title} (${rec.priority.toUpperCase()} Priority)

${rec.description}

**Actions:**
${rec.actions.map(action => `- ${action}`).join('\n')}
`).join('\n')}
` : ''}

---
*Report generated by Phase 4 Review System Test Suite*`;
  }

  async generateCSVReport() {
    const rows = [
      ['Metric', 'Value', 'Category', 'Timestamp']
    ];

    // Add summary metrics
    rows.push(['Total Tests', this.reportData.summary.totalTests, 'Summary', this.reportData.timestamp]);
    rows.push(['Passed Tests', this.reportData.summary.passed, 'Summary', this.reportData.timestamp]);
    rows.push(['Failed Tests', this.reportData.summary.failed, 'Summary', this.reportData.timestamp]);
    rows.push(['Overall Coverage', this.reportData.summary.coverage.overall.toFixed(2), 'Coverage', this.reportData.timestamp]);
    rows.push(['Duration (seconds)', (this.reportData.summary.duration / 1000).toFixed(2), 'Performance', this.reportData.timestamp]);

    // Add suite-specific metrics
    Object.values(this.reportData.suites).forEach(suite => {
      if (suite && suite.name) {
        rows.push([`${suite.name} - Tests`, suite.tests || 0, 'Suite', this.reportData.timestamp]);
        rows.push([`${suite.name} - Passed`, suite.passed || 0, 'Suite', this.reportData.timestamp]);
        rows.push([`${suite.name} - Failed`, suite.failed || 0, 'Suite', this.reportData.timestamp]);
        if (suite.coverage) {
          rows.push([`${suite.name} - Coverage`, suite.coverage.toFixed(2), 'Coverage', this.reportData.timestamp]);
        }
      }
    });

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  // Helper methods
  async findAndParseFile(dir, filename, type) {
    const files = await this.findFiles(dir, filename);
    if (files.length === 0) {
      throw new Error(`File ${filename} not found`);
    }

    const content = await fs.readFile(files[0], 'utf8');
    
    switch (type) {
      case 'junit':
        return await this.parseJUnitXML(content);
      case 'json':
        return JSON.parse(content);
      case 'coverage':
        return await this.parseCoverageXML(content);
      case 'lcov':
        return content;
      default:
        return content;
    }
  }

  async findFiles(dir, pattern) {
    const files = [];
    
    async function search(currentDir) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            await search(fullPath);
          } else if (entry.name.includes(pattern)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    }
    
    await search(dir);
    return files;
  }

  async parseJUnitXML(xmlContent) {
    // Simple XML parsing for JUnit format
    const testsuiteMatch = xmlContent.match(/<testsuite[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*skipped="(\d+)"[^>]*time="([^"]*)"[^>]*>/);
    
    if (!testsuiteMatch) {
      throw new Error('Invalid JUnit XML format');
    }

    return {
      tests: parseInt(testsuiteMatch[1]),
      failures: parseInt(testsuiteMatch[2]),
      skipped: parseInt(testsuiteMatch[3]),
      time: parseFloat(testsuiteMatch[4]) * 1000 // Convert to milliseconds
    };
  }

  async parseCoverageXML(xmlContent) {
    // Simple coverage XML parsing
    const lineRateMatch = xmlContent.match(/line-rate="([^"]*)"/);
    return {
      lineRate: lineRateMatch ? parseFloat(lineRateMatch[1]) * 100 : 0
    };
  }

  extractCoveragePercentage(coverageData) {
    if (!coverageData) return 0;
    return coverageData.lineRate || 0;
  }

  extractLcovCoverage(lcovContent) {
    if (!lcovContent) return 0;
    
    const lines = lcovContent.split('\n');
    let totalLines = 0;
    let coveredLines = 0;

    for (const line of lines) {
      if (line.startsWith('LH:')) {
        coveredLines += parseInt(line.split(':')[1]);
      }
      if (line.startsWith('LF:')) {
        totalLines += parseInt(line.split(':')[1]);
      }
    }

    return totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
  }

  createEmptySuite(name) {
    return {
      name,
      status: 'not_run',
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      coverage: 0,
      details: []
    };
  }
}

// Main execution
if (require.main === module) {
  const resultsDir = process.argv[2] || './test-results';
  const generator = new TestReportGenerator();
  
  generator.generateReport(resultsDir).catch(error => {
    console.error('Failed to generate test report:', error);
    process.exit(1);
  });
}

module.exports = TestReportGenerator;