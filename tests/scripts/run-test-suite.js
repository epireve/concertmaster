#!/usr/bin/env node

/**
 * Comprehensive Test Suite Runner
 * Orchestrates all test types with reporting and analysis
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestSuiteRunner {
  constructor() {
    this.testRoot = path.resolve(__dirname, '../');
    this.projectRoot = path.resolve(__dirname, '../../');
    this.results = {
      unit: null,
      integration: null,
      performance: null,
      e2e: null,
      coverage: null,
      startTime: new Date(),
      endTime: null
    };
  }

  async runAllTests(options = {}) {
    console.log('🚀 Starting Comprehensive Test Suite\\n');
    
    const {
      unit = true,
      integration = true,
      performance = true,
      e2e = true,
      coverage = true,
      bail = false,
      parallel = true
    } = options;

    try {
      // Run unit tests
      if (unit) {
        console.log('📝 Running Unit Tests...');
        this.results.unit = await this.runUnitTests();
        if (bail && !this.results.unit.success) {
          throw new Error('Unit tests failed');
        }
      }

      // Run integration tests
      if (integration) {
        console.log('\\n🔗 Running Integration Tests...');
        this.results.integration = await this.runIntegrationTests();
        if (bail && !this.results.integration.success) {
          throw new Error('Integration tests failed');
        }
      }

      // Run performance tests
      if (performance) {
        console.log('\\n⚡ Running Performance Tests...');
        this.results.performance = await this.runPerformanceTests();
        if (bail && !this.results.performance.success) {
          throw new Error('Performance tests failed');
        }
      }

      // Run E2E tests
      if (e2e) {
        console.log('\\n🌐 Running E2E Tests...');
        this.results.e2e = await this.runE2ETests();
        if (bail && !this.results.e2e.success) {
          throw new Error('E2E tests failed');
        }
      }

      // Generate coverage report
      if (coverage) {
        console.log('\\n📊 Generating Coverage Report...');
        this.results.coverage = await this.generateCoverageReport();
      }

      this.results.endTime = new Date();
      
      // Generate comprehensive report
      await this.generateFinalReport();
      
      console.log('\\n✅ All tests completed successfully!');
      
      return this.results;

    } catch (error) {
      console.error(`\\n❌ Test suite failed: ${error.message}`);
      this.results.endTime = new Date();
      await this.generateFinalReport();
      process.exit(1);
    }
  }

  async runUnitTests() {
    try {
      const startTime = Date.now();
      
      execSync('npm run test:unit', {
        cwd: this.testRoot,
        stdio: 'inherit'
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        duration,
        type: 'unit',
        command: 'npm run test:unit'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'unit',
        command: 'npm run test:unit'
      };
    }
  }

  async runIntegrationTests() {
    try {
      const startTime = Date.now();
      
      execSync('npm run test:integration', {
        cwd: this.testRoot,
        stdio: 'inherit'
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        duration,
        type: 'integration',
        command: 'npm run test:integration'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'integration',
        command: 'npm run test:integration'
      };
    }
  }

  async runPerformanceTests() {
    try {
      const startTime = Date.now();
      
      execSync('npm run test:performance', {
        cwd: this.testRoot,
        stdio: 'inherit'
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        duration,
        type: 'performance',
        command: 'npm run test:performance'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'performance',
        command: 'npm run test:performance'
      };
    }
  }

  async runE2ETests() {
    try {
      const startTime = Date.now();
      
      execSync('npm run test:e2e', {
        cwd: this.testRoot,
        stdio: 'inherit'
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        duration,
        type: 'e2e',
        command: 'npm run test:e2e'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'e2e',
        command: 'npm run test:e2e'
      };
    }
  }

  async generateCoverageReport() {
    try {
      const startTime = Date.now();
      
      // Run coverage analysis
      execSync('node scripts/test-coverage-analysis.js', {
        cwd: this.testRoot,
        stdio: 'inherit'
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        duration,
        type: 'coverage',
        command: 'node scripts/test-coverage-analysis.js'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'coverage',
        command: 'node scripts/test-coverage-analysis.js'
      };
    }
  }

  async generateFinalReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.results.endTime ? 
        (this.results.endTime - this.results.startTime) : 
        (new Date() - this.results.startTime),
      results: this.results,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    };

    // Save detailed report
    const reportPath = path.join(this.testRoot, 'reports', 'test-suite-results.json');
    this.ensureDirectoryExists(path.dirname(reportPath));
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const mdReportPath = path.join(this.testRoot, 'reports', 'test-suite-results.md');
    fs.writeFileSync(mdReportPath, markdownReport);

    console.log(`\\n📋 Test report generated:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  Markdown: ${mdReportPath}`);

    // Print summary to console
    this.printSummary(report.summary);
  }

  generateSummary() {
    const summary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      testTypes: {}
    };

    ['unit', 'integration', 'performance', 'e2e'].forEach(type => {
      const result = this.results[type];
      if (result) {
        summary.testTypes[type] = {
          success: result.success,
          duration: result.duration || 0
        };
        
        if (result.success) {
          summary.passed++;
        } else {
          summary.failed++;
        }
        summary.totalTests++;
      }
    });

    return summary;
  }

  generateRecommendations() {
    const recommendations = [];

    // Check for failed test types
    ['unit', 'integration', 'performance', 'e2e'].forEach(type => {
      const result = this.results[type];
      if (result && !result.success) {
        recommendations.push({
          priority: 'high',
          type: 'test-failure',
          message: `${type} tests failed and need immediate attention`,
          action: `Review ${type} test failures and fix underlying issues`
        });
      }
    });

    // Performance recommendations
    if (this.results.performance && this.results.performance.success && 
        this.results.performance.duration > 30000) { // >30 seconds
      recommendations.push({
        priority: 'medium',
        type: 'performance',
        message: 'Performance tests are taking too long',
        action: 'Optimize performance test setup or consider parallel execution'
      });
    }

    // E2E test recommendations
    if (this.results.e2e && this.results.e2e.success && 
        this.results.e2e.duration > 300000) { // >5 minutes
      recommendations.push({
        priority: 'medium',
        type: 'e2e-performance',
        message: 'E2E tests are taking too long',
        action: 'Consider running E2E tests in parallel or optimizing test data setup'
      });
    }

    return recommendations;
  }

  generateMarkdownReport(report) {
    let markdown = '# Test Suite Results\\n\\n';
    markdown += `**Generated:** ${report.timestamp}\\n`;
    markdown += `**Total Duration:** ${this.formatDuration(report.duration)}\\n\\n`;

    // Summary table
    markdown += '## Summary\\n\\n';
    markdown += '| Test Type | Status | Duration |\\n';
    markdown += '|-----------|--------|----------|\\n';

    ['unit', 'integration', 'performance', 'e2e', 'coverage'].forEach(type => {
      const result = this.results[type];
      if (result) {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        const duration = result.duration ? this.formatDuration(result.duration) : 'N/A';
        markdown += `| ${type.charAt(0).toUpperCase() + type.slice(1)} | ${status} | ${duration} |\\n`;
      }
    });

    // Detailed results
    markdown += '\\n## Detailed Results\\n\\n';

    ['unit', 'integration', 'performance', 'e2e', 'coverage'].forEach(type => {
      const result = this.results[type];
      if (result) {
        markdown += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Tests\\n\\n`;
        markdown += `- **Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\\n`;
        markdown += `- **Command:** \`${result.command}\`\\n`;
        if (result.duration) {
          markdown += `- **Duration:** ${this.formatDuration(result.duration)}\\n`;
        }
        if (result.error) {
          markdown += `- **Error:** ${result.error}\\n`;
        }
        markdown += '\\n';
      }
    });

    // Recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      markdown += '## Recommendations\\n\\n';

      ['high', 'medium', 'low'].forEach(priority => {
        const priorityRecs = report.recommendations.filter(r => r.priority === priority);
        if (priorityRecs.length > 0) {
          markdown += `### ${priority.toUpperCase()} Priority\\n\\n`;
          priorityRecs.forEach((rec, index) => {
            markdown += `${index + 1}. **${rec.message}**\\n`;
            markdown += `   - Action: ${rec.action}\\n\\n`;
          });
        }
      });
    }

    return markdown;
  }

  printSummary(summary) {
    console.log('\\n📊 **Test Suite Summary:**\\n');
    
    Object.entries(summary.testTypes).forEach(([type, result]) => {
      const status = result.success ? '✅' : '❌';
      const duration = this.formatDuration(result.duration);
      console.log(`${status} ${type.padEnd(12)} ${duration}`);
    });

    console.log(`\\nTotal: ${summary.passed} passed, ${summary.failed} failed`);
  }

  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  args.forEach(arg => {
    if (arg === '--no-unit') options.unit = false;
    if (arg === '--no-integration') options.integration = false;
    if (arg === '--no-performance') options.performance = false;
    if (arg === '--no-e2e') options.e2e = false;
    if (arg === '--no-coverage') options.coverage = false;
    if (arg === '--bail') options.bail = true;
    if (arg === '--no-parallel') options.parallel = false;
  });

  const runner = new TestSuiteRunner();
  runner.runAllTests(options).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = TestSuiteRunner;