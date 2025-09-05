#!/usr/bin/env node

/**
 * Test Coverage Analysis Script
 * Analyzes test coverage and generates comprehensive reports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TestCoverageAnalyzer {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../');
    this.testRoot = path.resolve(__dirname, '../');
    this.frontendSrc = path.resolve(this.projectRoot, 'frontend/src');
    this.coverageDir = path.resolve(this.testRoot, 'coverage');
    
    this.coverageThresholds = {
      global: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90
      },
      components: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85
      }
    };
  }

  async analyzeCoverage() {
    console.log('🔍 Starting Test Coverage Analysis...\n');
    
    try {
      // Run tests with coverage
      console.log('📊 Running tests with coverage collection...');
      this.runTestsWithCoverage();
      
      // Analyze coverage data
      const coverageData = this.loadCoverageData();
      const analysis = this.analyzeCoverageData(coverageData);
      
      // Generate reports
      this.generateCoverageReport(analysis);
      this.generateMissingTestsReport(analysis);
      this.generateRecommendations(analysis);
      
      // Check thresholds
      this.checkCoverageThresholds(analysis);
      
      console.log('✅ Test coverage analysis completed!\n');
      
    } catch (error) {
      console.error('❌ Test coverage analysis failed:', error.message);
      process.exit(1);
    }
  }

  runTestsWithCoverage() {
    try {
      execSync('npm run test:coverage', {
        cwd: this.testRoot,
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error(`Failed to run tests with coverage: ${error.message}`);
    }
  }

  loadCoverageData() {
    const coverageFile = path.join(this.coverageDir, 'coverage-summary.json');
    
    if (!fs.existsSync(coverageFile)) {
      throw new Error('Coverage data not found. Ensure tests ran successfully.');
    }
    
    return JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
  }

  analyzeCoverageData(coverageData) {
    const analysis = {
      total: coverageData.total,
      files: [],
      uncoveredFiles: [],
      componentsByType: {},
      criticalGaps: [],
      recommendations: []
    };

    // Analyze each file
    Object.entries(coverageData).forEach(([filePath, coverage]) => {
      if (filePath === 'total') return;
      
      const relativePath = path.relative(this.frontendSrc, filePath);
      const fileAnalysis = {
        path: relativePath,
        fullPath: filePath,
        coverage,
        type: this.getFileType(relativePath),
        criticality: this.getFileCriticality(relativePath),
        issues: this.identifyIssues(coverage, relativePath)
      };

      analysis.files.push(fileAnalysis);
      
      // Group by type
      if (!analysis.componentsByType[fileAnalysis.type]) {
        analysis.componentsByType[fileAnalysis.type] = [];
      }
      analysis.componentsByType[fileAnalysis.type].push(fileAnalysis);
      
      // Identify critical gaps
      if (fileAnalysis.criticality === 'high' && this.isBelowThreshold(coverage)) {
        analysis.criticalGaps.push(fileAnalysis);
      }
    });

    // Find uncovered files
    analysis.uncoveredFiles = this.findUncoveredFiles();
    
    return analysis;
  }

  getFileType(filePath) {
    if (filePath.includes('/components/workflow/')) return 'workflow-component';
    if (filePath.includes('/components/forms/')) return 'form-component';
    if (filePath.includes('/components/shared/')) return 'shared-component';
    if (filePath.includes('/store/')) return 'state-management';
    if (filePath.includes('/types/')) return 'type-definitions';
    if (filePath.includes('/utils/')) return 'utilities';
    if (filePath.includes('/hooks/')) return 'react-hooks';
    if (filePath.includes('/services/')) return 'services';
    if (filePath.endsWith('.tsx')) return 'react-component';
    if (filePath.endsWith('.ts')) return 'typescript-module';
    return 'other';
  }

  getFileCriticality(filePath) {
    // Core workflow components are critical
    if (filePath.includes('WorkflowCanvas') || 
        filePath.includes('workflowStore') ||
        filePath.includes('FormBuilder')) {
      return 'high';
    }
    
    // Shared components are important
    if (filePath.includes('/shared/') || filePath.includes('/types/')) {
      return 'medium';
    }
    
    return 'low';
  }

  identifyIssues(coverage, filePath) {
    const issues = [];
    
    if (coverage.lines.pct < 80) {
      issues.push({
        type: 'low-line-coverage',
        severity: 'high',
        message: `Line coverage ${coverage.lines.pct}% is below 80%`
      });
    }
    
    if (coverage.branches.pct < 75) {
      issues.push({
        type: 'low-branch-coverage',
        severity: 'high',
        message: `Branch coverage ${coverage.branches.pct}% is below 75%`
      });
    }
    
    if (coverage.functions.pct < 85) {
      issues.push({
        type: 'low-function-coverage',
        severity: 'medium',
        message: `Function coverage ${coverage.functions.pct}% is below 85%`
      });
    }
    
    // Identify specific patterns that need tests
    if (filePath.includes('Canvas') && coverage.branches.pct < 70) {
      issues.push({
        type: 'complex-component-undertested',
        severity: 'critical',
        message: 'Complex interactive components need comprehensive branch testing'
      });
    }
    
    return issues;
  }

  isBelowThreshold(coverage) {
    return coverage.lines.pct < this.coverageThresholds.global.lines ||
           coverage.branches.pct < this.coverageThresholds.global.branches ||
           coverage.functions.pct < this.coverageThresholds.global.functions;
  }

  findUncoveredFiles() {
    const uncovered = [];
    const sourceFiles = this.getAllSourceFiles();
    
    sourceFiles.forEach(file => {
      const relativePath = path.relative(this.projectRoot, file);
      const testFile = this.findTestFile(file);
      
      if (!testFile) {
        uncovered.push({
          path: relativePath,
          type: this.getFileType(relativePath),
          criticality: this.getFileCriticality(relativePath),
          suggestedTestPath: this.suggestTestPath(file)
        });
      }
    });
    
    return uncovered;
  }

  getAllSourceFiles() {
    const files = [];
    
    function walkDir(dir) {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            walkDir(fullPath);
          }
        } else if (entry.match(/\\.(ts|tsx)$/) && !entry.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    }
    
    walkDir(this.frontendSrc);
    return files;
  }

  findTestFile(sourceFile) {
    const relativePath = path.relative(this.frontendSrc, sourceFile);
    const possibleTestPaths = [
      path.join(this.testRoot, 'unit', relativePath.replace(/\\.(ts|tsx)$/, '.test.$1')),
      path.join(this.testRoot, 'integration', relativePath.replace(/\\.(ts|tsx)$/, '.test.$1')),
      path.join(this.testRoot, 'unit', 'components', path.basename(relativePath).replace(/\\.(ts|tsx)$/, '.test.$1'))
    ];
    
    return possibleTestPaths.find(testPath => fs.existsSync(testPath));
  }

  suggestTestPath(sourceFile) {
    const relativePath = path.relative(this.frontendSrc, sourceFile);
    const fileType = this.getFileType(relativePath);
    
    let testDir = 'unit';
    if (fileType.includes('component')) {
      testDir = 'unit/components';
    } else if (fileType === 'state-management') {
      testDir = 'unit/store';
    } else if (fileType === 'utilities') {
      testDir = 'unit/utils';
    }
    
    const testFileName = path.basename(relativePath).replace(/\\.(ts|tsx)$/, '.test.$1');
    return path.join(this.testRoot, testDir, testFileName);
  }

  generateCoverageReport(analysis) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: analysis.files.length,
        uncoveredFiles: analysis.uncoveredFiles.length,
        overallCoverage: analysis.total,
        criticalGaps: analysis.criticalGaps.length
      },
      byType: this.generateTypeReport(analysis.componentsByType),
      criticalIssues: analysis.criticalGaps.map(gap => ({
        file: gap.path,
        type: gap.type,
        criticality: gap.criticality,
        coverage: gap.coverage,
        issues: gap.issues
      })),
      recommendations: this.generateTestingRecommendations(analysis)
    };

    const reportPath = path.join(this.testRoot, 'reports', 'coverage-analysis.json');
    this.ensureDirectoryExists(path.dirname(reportPath));
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📈 Coverage report generated: ${reportPath}`);
    this.printSummary(report);
  }

  generateTypeReport(componentsByType) {
    const typeReport = {};
    
    Object.entries(componentsByType).forEach(([type, files]) => {
      const totalLines = files.reduce((sum, file) => sum + file.coverage.lines.total, 0);
      const coveredLines = files.reduce((sum, file) => sum + file.coverage.lines.covered, 0);
      const totalBranches = files.reduce((sum, file) => sum + file.coverage.branches.total, 0);
      const coveredBranches = files.reduce((sum, file) => sum + file.coverage.branches.covered, 0);
      
      typeReport[type] = {
        fileCount: files.length,
        linesCoverage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        branchCoverage: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        avgCoverage: files.reduce((sum, file) => sum + file.coverage.lines.pct, 0) / files.length,
        needsAttention: files.filter(file => this.isBelowThreshold(file.coverage)).length
      };
    });
    
    return typeReport;
  }

  generateMissingTestsReport(analysis) {
    const missingTests = analysis.uncoveredFiles
      .filter(file => file.criticality === 'high' || file.criticality === 'medium')
      .sort((a, b) => {
        const criticalityOrder = { high: 3, medium: 2, low: 1 };
        return criticalityOrder[b.criticality] - criticalityOrder[a.criticality];
      });

    const reportPath = path.join(this.testRoot, 'reports', 'missing-tests.md');
    this.ensureDirectoryExists(path.dirname(reportPath));
    
    let content = '# Missing Test Files Report\\n\\n';
    content += `Generated: ${new Date().toISOString()}\\n\\n`;
    content += `## Summary\\n\\n`;
    content += `- Total uncovered files: ${analysis.uncoveredFiles.length}\\n`;
    content += `- High priority: ${missingTests.filter(f => f.criticality === 'high').length}\\n`;
    content += `- Medium priority: ${missingTests.filter(f => f.criticality === 'medium').length}\\n\\n`;
    
    if (missingTests.length > 0) {
      content += '## Files Needing Tests\\n\\n';
      
      ['high', 'medium', 'low'].forEach(priority => {
        const filesOfPriority = missingTests.filter(f => f.criticality === priority);
        if (filesOfPriority.length === 0) return;
        
        content += `### ${priority.toUpperCase()} Priority\\n\\n`;
        
        filesOfPriority.forEach(file => {
          content += `- **${file.path}** (${file.type})\\n`;
          content += `  - Suggested test: \`${file.suggestedTestPath}\`\\n\\n`;
        });
      });
    }
    
    fs.writeFileSync(reportPath, content);
    console.log(`📋 Missing tests report generated: ${reportPath}`);
  }

  generateTestingRecommendations(analysis) {
    const recommendations = [];

    // Critical components needing immediate attention
    analysis.criticalGaps.forEach(gap => {
      recommendations.push({
        priority: 'high',
        type: 'coverage-improvement',
        file: gap.path,
        action: `Improve test coverage for critical ${gap.type}`,
        details: gap.issues.map(issue => issue.message).join(', ')
      });
    });

    // Component type specific recommendations
    Object.entries(analysis.componentsByType).forEach(([type, files]) => {
      const lowCoverageFiles = files.filter(file => this.isBelowThreshold(file.coverage));
      
      if (lowCoverageFiles.length > files.length * 0.3) { // If >30% of files have low coverage
        recommendations.push({
          priority: 'medium',
          type: 'systematic-improvement',
          category: type,
          action: `Systematic test improvement needed for ${type} files`,
          details: `${lowCoverageFiles.length} of ${files.length} files need attention`
        });
      }
    });

    // Missing E2E tests for complex workflows
    const complexComponents = analysis.files.filter(file => 
      file.path.includes('Canvas') || file.path.includes('Builder')
    );
    
    if (complexComponents.some(comp => this.isBelowThreshold(comp.coverage))) {
      recommendations.push({
        priority: 'high',
        type: 'e2e-testing',
        action: 'Add comprehensive E2E tests for visual builder workflows',
        details: 'Complex interactive components need end-to-end testing coverage'
      });
    }

    return recommendations;
  }

  generateRecommendations(analysis) {
    const recommendationsPath = path.join(this.testRoot, 'reports', 'testing-recommendations.md');
    this.ensureDirectoryExists(path.dirname(recommendationsPath));
    
    let content = '# Testing Recommendations\\n\\n';
    content += `Generated: ${new Date().toISOString()}\\n\\n`;
    
    const recommendations = this.generateTestingRecommendations(analysis);
    
    if (recommendations.length === 0) {
      content += '✅ **Great job!** All coverage thresholds are met and no immediate actions are needed.\\n';
    } else {
      content += '## Immediate Actions Needed\\n\\n';
      
      ['high', 'medium', 'low'].forEach(priority => {
        const priorityRecs = recommendations.filter(r => r.priority === priority);
        if (priorityRecs.length === 0) return;
        
        content += `### ${priority.toUpperCase()} Priority\\n\\n`;
        
        priorityRecs.forEach((rec, index) => {
          content += `${index + 1}. **${rec.action}**\\n`;
          if (rec.file) content += `   - File: \`${rec.file}\`\\n`;
          if (rec.category) content += `   - Category: ${rec.category}\\n`;
          content += `   - Details: ${rec.details}\\n\\n`;
        });
      });
      
      content += '## Implementation Guidelines\\n\\n';
      content += '### For Component Tests\\n';
      content += '- Focus on user interactions and edge cases\\n';
      content += '- Test error handling and loading states\\n';
      content += '- Verify accessibility features\\n\\n';
      
      content += '### For Integration Tests\\n';
      content += '- Test component interactions\\n';
      content += '- Verify data flow between components\\n';
      content += '- Test state management integration\\n\\n';
      
      content += '### For E2E Tests\\n';
      content += '- Test complete user workflows\\n';
      content += '- Verify cross-browser compatibility\\n';
      content += '- Test performance under load\\n';
    }
    
    fs.writeFileSync(recommendationsPath, content);
    console.log(`💡 Testing recommendations generated: ${recommendationsPath}`);
  }

  checkCoverageThresholds(analysis) {
    const total = analysis.total;
    const passed = [];
    const failed = [];

    Object.entries(this.coverageThresholds.global).forEach(([metric, threshold]) => {
      if (total[metric].pct >= threshold) {
        passed.push(`${metric}: ${total[metric].pct}% >= ${threshold}%`);
      } else {
        failed.push(`${metric}: ${total[metric].pct}% < ${threshold}%`);
      }
    });

    console.log('\\n🎯 Coverage Threshold Check:\\n');
    
    if (passed.length > 0) {
      console.log('✅ **PASSED:**');
      passed.forEach(pass => console.log(`  ${pass}`));
    }
    
    if (failed.length > 0) {
      console.log('\\n❌ **FAILED:**');
      failed.forEach(fail => console.log(`  ${fail}`));
      
      console.log('\\n⚠️  Some coverage thresholds were not met. See recommendations for improvement.');
    } else {
      console.log('\\n🎉 All coverage thresholds met!');
    }
  }

  printSummary(report) {
    console.log('\\n📊 **Coverage Summary:**\\n');
    console.log(`Total Files: ${report.summary.totalFiles}`);
    console.log(`Uncovered Files: ${report.summary.uncoveredFiles}`);
    console.log(`Critical Gaps: ${report.summary.criticalGaps}`);
    console.log(`Lines: ${report.summary.overallCoverage.lines.pct}%`);
    console.log(`Branches: ${report.summary.overallCoverage.branches.pct}%`);
    console.log(`Functions: ${report.summary.overallCoverage.functions.pct}%`);
    console.log(`Statements: ${report.summary.overallCoverage.statements.pct}%`);
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Run the analyzer if called directly
if (require.main === module) {
  const analyzer = new TestCoverageAnalyzer();
  analyzer.analyzeCoverage().catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
}

module.exports = TestCoverageAnalyzer;