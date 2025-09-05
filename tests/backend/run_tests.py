"""
Comprehensive Test Runner for ConcertMaster Backend
Orchestrates all test suites with reporting and coverage analysis
"""

#!/usr/bin/env python3

import argparse
import subprocess
import sys
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import time
from datetime import datetime


class TestRunner:
    """Comprehensive test runner for backend testing"""
    
    def __init__(self, root_dir: str = None):
        self.root_dir = Path(root_dir) if root_dir else Path(__file__).parent.parent.parent
        self.backend_dir = self.root_dir / "backend"
        self.tests_dir = self.root_dir / "tests" / "backend"
        self.reports_dir = self.tests_dir / "reports"
        
        # Ensure directories exist
        self.reports_dir.mkdir(parents=True, exist_ok=True)
    
    def run_test_suite(
        self, 
        test_type: str = "all",
        markers: Optional[str] = None,
        coverage: bool = True,
        parallel: bool = False,
        verbose: bool = False
    ) -> Dict[str, Any]:
        """Run specified test suite with options"""
        
        start_time = time.time()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Build pytest command
        cmd = ["python", "-m", "pytest"]
        
        # Add test directory or specific test files
        if test_type == "all":
            cmd.append(str(self.tests_dir))
        elif test_type == "unit":
            cmd.extend(["-m", "unit"])
        elif test_type == "integration":
            cmd.extend(["-m", "integration"])
        elif test_type == "api":
            cmd.extend(["-m", "api"])
        elif test_type == "database":
            cmd.extend(["-m", "database"])
        elif test_type == "celery":
            cmd.extend(["-m", "celery"])
        elif test_type == "performance":
            cmd.extend(["-m", "performance"])
        else:
            # Specific test file
            cmd.append(str(self.tests_dir / f"test_{test_type}.py"))
        
        # Add markers if specified
        if markers:
            cmd.extend(["-m", markers])
        
        # Add coverage options
        if coverage:
            cmd.extend([
                f"--cov={self.backend_dir / 'src'}",
                f"--cov-report=html:{self.reports_dir / f'coverage_html_{timestamp}'}",
                f"--cov-report=xml:{self.reports_dir / f'coverage_{timestamp}.xml'}",
                f"--cov-report=json:{self.reports_dir / f'coverage_{timestamp}.json'}",
                "--cov-report=term-missing",
                "--cov-fail-under=70"
            ])
        
        # Add parallel execution
        if parallel:
            cmd.extend(["-n", "auto"])
        
        # Add verbosity
        if verbose:
            cmd.append("-v")
        else:
            cmd.append("-q")
        
        # Add JUnit XML report
        cmd.extend([
            f"--junitxml={self.reports_dir / f'junit_{test_type}_{timestamp}.xml'}"
        ])
        
        # Add additional options
        cmd.extend([
            "--tb=short",
            "--strict-markers",
            "--strict-config"
        ])
        
        print(f"🚀 Running {test_type} tests...")
        print(f"📁 Command: {' '.join(cmd)}")
        
        # Run tests
        try:
            result = subprocess.run(
                cmd,
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=1800  # 30 minutes timeout
            )
            
            duration = time.time() - start_time
            
            # Parse results
            test_result = {
                "test_type": test_type,
                "timestamp": timestamp,
                "duration": duration,
                "return_code": result.returncode,
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "command": " ".join(cmd)
            }
            
            # Save detailed results
            result_file = self.reports_dir / f"test_result_{test_type}_{timestamp}.json"
            with open(result_file, 'w') as f:
                json.dump(test_result, f, indent=2)
            
            # Print summary
            self._print_test_summary(test_result)
            
            return test_result
            
        except subprocess.TimeoutExpired:
            return {
                "test_type": test_type,
                "timestamp": timestamp,
                "duration": time.time() - start_time,
                "success": False,
                "error": "Test execution timed out after 30 minutes"
            }
        
        except Exception as e:
            return {
                "test_type": test_type,
                "timestamp": timestamp,
                "duration": time.time() - start_time,
                "success": False,
                "error": str(e)
            }
    
    def run_comprehensive_suite(self) -> Dict[str, Any]:
        """Run comprehensive test suite covering all aspects"""
        print("🧪 Starting Comprehensive Test Suite")
        print("=" * 50)
        
        test_suites = [
            ("unit", "Unit tests with mocking"),
            ("database", "Database integration tests"),
            ("api", "API endpoint tests"),
            ("celery", "Background task tests"),
            ("integration", "Integration tests"),
            ("error_handling", "Error handling tests")
        ]
        
        results = {}
        overall_success = True
        total_duration = 0
        
        for test_type, description in test_suites:
            print(f"\n📋 {description}...")
            
            result = self.run_test_suite(
                test_type=test_type,
                coverage=True,
                parallel=False,  # Avoid conflicts
                verbose=True
            )
            
            results[test_type] = result
            total_duration += result["duration"]
            
            if not result["success"]:
                overall_success = False
                print(f"❌ {test_type} tests failed!")
            else:
                print(f"✅ {test_type} tests passed!")
        
        # Generate comprehensive report
        comprehensive_result = {
            "overall_success": overall_success,
            "total_duration": total_duration,
            "test_results": results,
            "summary": self._generate_comprehensive_summary(results),
            "timestamp": datetime.now().isoformat()
        }
        
        # Save comprehensive report
        report_file = self.reports_dir / f"comprehensive_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(comprehensive_result, f, indent=2)
        
        # Print final summary
        self._print_comprehensive_summary(comprehensive_result)
        
        return comprehensive_result
    
    def run_ci_pipeline(self) -> Dict[str, Any]:
        """Run tests suitable for CI/CD pipeline"""
        print("🔄 Running CI Pipeline Tests")
        print("=" * 30)
        
        # Fast, essential tests for CI
        ci_suites = [
            ("unit", {"markers": "not slow"}),
            ("api", {"markers": "not slow"}),
            ("database", {"markers": "not slow"}),
        ]
        
        results = {}
        overall_success = True
        
        for test_type, options in ci_suites:
            result = self.run_test_suite(
                test_type=test_type,
                coverage=True,
                parallel=True,  # Speed up CI
                verbose=False,  # Reduce output
                **options
            )
            
            results[test_type] = result
            
            if not result["success"]:
                overall_success = False
        
        ci_result = {
            "pipeline": "ci",
            "overall_success": overall_success,
            "test_results": results,
            "timestamp": datetime.now().isoformat()
        }
        
        return ci_result
    
    def run_quality_gates(self) -> Dict[str, Any]:
        """Run quality gate checks"""
        print("🚪 Running Quality Gates")
        print("=" * 25)
        
        quality_checks = {
            "coverage": self._check_coverage_quality_gate(),
            "security": self._check_security_quality_gate(),
            "performance": self._check_performance_quality_gate(),
            "style": self._check_style_quality_gate()
        }
        
        overall_quality = all(check["passed"] for check in quality_checks.values())
        
        quality_result = {
            "overall_quality": overall_quality,
            "quality_checks": quality_checks,
            "timestamp": datetime.now().isoformat()
        }
        
        # Print quality gate results
        for gate_name, check in quality_checks.items():
            status = "✅" if check["passed"] else "❌"
            print(f"{status} {gate_name.title()}: {check['message']}")
        
        return quality_result
    
    def _check_coverage_quality_gate(self) -> Dict[str, Any]:
        """Check coverage quality gate"""
        try:
            from test_coverage import CoverageAnalyzer
            
            analyzer = CoverageAnalyzer()
            summary = analyzer.generate_coverage_summary()
            
            if "error" in summary:
                return {
                    "passed": False,
                    "message": f"Coverage analysis failed: {summary['error']}",
                    "details": summary
                }
            
            line_coverage = summary["overall_metrics"]["line_rate"]
            branch_coverage = summary["overall_metrics"]["branch_rate"]
            
            # Quality gate thresholds
            line_threshold = 70.0
            branch_threshold = 60.0
            
            passed = line_coverage >= line_threshold and branch_coverage >= branch_threshold
            
            return {
                "passed": passed,
                "message": f"Line: {line_coverage:.1f}% (≥{line_threshold}%), Branch: {branch_coverage:.1f}% (≥{branch_threshold}%)",
                "details": {
                    "line_coverage": line_coverage,
                    "branch_coverage": branch_coverage,
                    "line_threshold": line_threshold,
                    "branch_threshold": branch_threshold
                }
            }
            
        except Exception as e:
            return {
                "passed": False,
                "message": f"Coverage check failed: {str(e)}",
                "details": {"error": str(e)}
            }
    
    def _check_security_quality_gate(self) -> Dict[str, Any]:
        """Check security quality gate"""
        try:
            # Run security tests
            result = subprocess.run([
                "python", "-m", "pytest",
                str(self.tests_dir),
                "-m", "security",
                "-q"
            ], capture_output=True, text=True, cwd=self.root_dir)
            
            passed = result.returncode == 0
            
            return {
                "passed": passed,
                "message": "Security tests passed" if passed else "Security tests failed",
                "details": {
                    "return_code": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            }
            
        except Exception as e:
            return {
                "passed": False,
                "message": f"Security check failed: {str(e)}",
                "details": {"error": str(e)}
            }
    
    def _check_performance_quality_gate(self) -> Dict[str, Any]:
        """Check performance quality gate"""
        try:
            # Run performance tests
            result = subprocess.run([
                "python", "-m", "pytest",
                str(self.tests_dir),
                "-m", "performance",
                "--tb=no",
                "-q"
            ], capture_output=True, text=True, cwd=self.root_dir)
            
            passed = result.returncode == 0
            
            return {
                "passed": passed,
                "message": "Performance tests passed" if passed else "Performance tests failed",
                "details": {
                    "return_code": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            }
            
        except Exception as e:
            return {
                "passed": False,
                "message": f"Performance check failed: {str(e)}",
                "details": {"error": str(e)}
            }
    
    def _check_style_quality_gate(self) -> Dict[str, Any]:
        """Check code style quality gate"""
        try:
            # Check if backend source exists
            src_dir = self.backend_dir / "src"
            if not src_dir.exists():
                return {
                    "passed": False,
                    "message": "Backend source directory not found",
                    "details": {"src_dir": str(src_dir)}
                }
            
            # For now, just check if Python files are syntactically valid
            python_files = list(src_dir.rglob("*.py"))
            
            if not python_files:
                return {
                    "passed": False,
                    "message": "No Python files found in source directory",
                    "details": {"src_dir": str(src_dir)}
                }
            
            # Basic syntax check
            syntax_errors = []
            for py_file in python_files[:10]:  # Check first 10 files
                try:
                    with open(py_file, 'r') as f:
                        compile(f.read(), py_file, 'exec')
                except SyntaxError as e:
                    syntax_errors.append({"file": str(py_file), "error": str(e)})
            
            passed = len(syntax_errors) == 0
            
            return {
                "passed": passed,
                "message": f"Syntax check passed for {len(python_files)} files" if passed else f"Found {len(syntax_errors)} syntax errors",
                "details": {
                    "files_checked": len(python_files),
                    "syntax_errors": syntax_errors
                }
            }
            
        except Exception as e:
            return {
                "passed": False,
                "message": f"Style check failed: {str(e)}",
                "details": {"error": str(e)}
            }
    
    def _print_test_summary(self, result: Dict[str, Any]):
        """Print test execution summary"""
        test_type = result["test_type"]
        duration = result["duration"]
        success = result["success"]
        
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"\n{status} {test_type.upper()} tests in {duration:.2f}s")
        
        if not success:
            print(f"Error output:")
            if result.get("stderr"):
                print(result["stderr"][:500])  # First 500 chars
    
    def _generate_comprehensive_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary of comprehensive test run"""
        total_tests = len(results)
        passed_tests = sum(1 for r in results.values() if r["success"])
        failed_tests = total_tests - passed_tests
        
        return {
            "total_suites": total_tests,
            "passed_suites": passed_tests,
            "failed_suites": failed_tests,
            "success_rate": (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
            "failed_suite_names": [name for name, result in results.items() if not result["success"]]
        }
    
    def _print_comprehensive_summary(self, result: Dict[str, Any]):
        """Print comprehensive test summary"""
        print(f"\n🏁 COMPREHENSIVE TEST RESULTS")
        print("=" * 40)
        
        summary = result["summary"]
        overall_success = result["overall_success"]
        total_duration = result["total_duration"]
        
        status = "✅ ALL PASSED" if overall_success else "❌ SOME FAILED"
        print(f"{status}")
        print(f"📊 {summary['passed_suites']}/{summary['total_suites']} test suites passed")
        print(f"⏱️ Total duration: {total_duration:.2f}s")
        print(f"📈 Success rate: {summary['success_rate']:.1f}%")
        
        if summary["failed_suite_names"]:
            print(f"❌ Failed suites: {', '.join(summary['failed_suite_names'])}")
        
        print(f"\n📁 Reports saved to: {self.reports_dir}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="ConcertMaster Backend Test Runner")
    parser.add_argument("--type", choices=["all", "unit", "integration", "api", "database", "celery", "performance", "comprehensive", "ci"], default="all", help="Test type to run")
    parser.add_argument("--no-coverage", action="store_true", help="Disable coverage reporting")
    parser.add_argument("--parallel", action="store_true", help="Run tests in parallel")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--markers", help="Pytest markers to include")
    parser.add_argument("--quality-gates", action="store_true", help="Run quality gate checks")
    
    args = parser.parse_args()
    
    runner = TestRunner()
    
    if args.quality_gates:
        result = runner.run_quality_gates()
        sys.exit(0 if result["overall_quality"] else 1)
    
    elif args.type == "comprehensive":
        result = runner.run_comprehensive_suite()
        sys.exit(0 if result["overall_success"] else 1)
    
    elif args.type == "ci":
        result = runner.run_ci_pipeline()
        sys.exit(0 if result["overall_success"] else 1)
    
    else:
        result = runner.run_test_suite(
            test_type=args.type,
            markers=args.markers,
            coverage=not args.no_coverage,
            parallel=args.parallel,
            verbose=args.verbose
        )
        sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()