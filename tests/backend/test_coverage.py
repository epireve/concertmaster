"""
Test Coverage Analysis and Reporting
Utilities for measuring and reporting test coverage
"""

import pytest
import coverage
import subprocess
import os
import json
from pathlib import Path
from typing import Dict, List, Any
import xml.etree.ElementTree as ET


class CoverageAnalyzer:
    """Analyze and report test coverage"""
    
    def __init__(self, source_dir: str = "backend/src", tests_dir: str = "tests/backend"):
        self.source_dir = Path(source_dir)
        self.tests_dir = Path(tests_dir)
        self.coverage_dir = Path("tests/backend/coverage_html")
        self.coverage_file = Path("tests/backend/.coverage")
        
    def setup_coverage(self) -> coverage.Coverage:
        """Set up coverage measurement"""
        cov = coverage.Coverage(
            source=[str(self.source_dir)],
            omit=[
                "*/tests/*",
                "*/test_*",
                "*/__pycache__/*",
                "*/migrations/*",
                "*/venv/*",
                "*/.venv/*"
            ],
            config_file=None,
        )
        return cov
    
    def run_coverage_analysis(self) -> Dict[str, Any]:
        """Run comprehensive coverage analysis"""
        cov = self.setup_coverage()
        
        # Start coverage
        cov.start()
        
        try:
            # Run tests (this would be done externally, but we can simulate)
            result = subprocess.run([
                "python", "-m", "pytest", 
                str(self.tests_dir),
                "--cov=" + str(self.source_dir),
                "--cov-report=html:" + str(self.coverage_dir),
                "--cov-report=xml:tests/backend/coverage.xml",
                "--cov-report=json:tests/backend/coverage.json",
                "--cov-report=term-missing",
                "-v"
            ], capture_output=True, text=True, cwd=os.getcwd())
            
            return {
                "return_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "success": result.returncode == 0
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "success": False
            }
        finally:
            cov.stop()
    
    def parse_coverage_xml(self, xml_file: str = "tests/backend/coverage.xml") -> Dict[str, Any]:
        """Parse XML coverage report"""
        xml_path = Path(xml_file)
        
        if not xml_path.exists():
            return {"error": f"Coverage XML file not found: {xml_file}"}
        
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            
            # Extract overall coverage
            coverage_elem = root.find(".")
            overall_coverage = {
                "line_rate": float(coverage_elem.get("line-rate", 0)) * 100,
                "branch_rate": float(coverage_elem.get("branch-rate", 0)) * 100,
                "lines_covered": int(coverage_elem.get("lines-covered", 0)),
                "lines_valid": int(coverage_elem.get("lines-valid", 0)),
                "branches_covered": int(coverage_elem.get("branches-covered", 0)),
                "branches_valid": int(coverage_elem.get("branches-valid", 0)),
            }
            
            # Extract package/module coverage
            packages = {}
            for package in root.findall(".//package"):
                package_name = package.get("name", "unknown")
                packages[package_name] = {
                    "line_rate": float(package.get("line-rate", 0)) * 100,
                    "branch_rate": float(package.get("branch-rate", 0)) * 100,
                    "classes": {}
                }
                
                # Extract class coverage within package
                for class_elem in package.findall(".//class"):
                    class_name = class_elem.get("name", "unknown")
                    packages[package_name]["classes"][class_name] = {
                        "line_rate": float(class_elem.get("line-rate", 0)) * 100,
                        "branch_rate": float(class_elem.get("branch-rate", 0)) * 100,
                        "filename": class_elem.get("filename", "")
                    }
            
            return {
                "overall": overall_coverage,
                "packages": packages,
                "timestamp": xml_path.stat().st_mtime
            }
            
        except Exception as e:
            return {"error": f"Error parsing XML coverage: {str(e)}"}
    
    def parse_coverage_json(self, json_file: str = "tests/backend/coverage.json") -> Dict[str, Any]:
        """Parse JSON coverage report"""
        json_path = Path(json_file)
        
        if not json_path.exists():
            return {"error": f"Coverage JSON file not found: {json_file}"}
        
        try:
            with open(json_path, 'r') as f:
                coverage_data = json.load(f)
            
            return coverage_data
            
        except Exception as e:
            return {"error": f"Error parsing JSON coverage: {str(e)}"}
    
    def generate_coverage_summary(self) -> Dict[str, Any]:
        """Generate comprehensive coverage summary"""
        xml_data = self.parse_coverage_xml()
        json_data = self.parse_coverage_json()
        
        if "error" in xml_data:
            return xml_data
        
        summary = {
            "overall_metrics": xml_data["overall"],
            "file_coverage": {},
            "uncovered_lines": {},
            "quality_gates": {},
            "recommendations": []
        }
        
        # Extract file-level details from JSON if available
        if "files" in json_data:
            for filename, file_data in json_data["files"].items():
                relative_path = Path(filename).relative_to(Path.cwd()) if Path(filename).is_absolute() else filename
                
                summary["file_coverage"][str(relative_path)] = {
                    "line_coverage": file_data["summary"]["percent_covered"],
                    "missing_lines": file_data["missing_lines"],
                    "excluded_lines": file_data.get("excluded_lines", []),
                    "covered_lines": file_data["executed_lines"]
                }
                
                if file_data["missing_lines"]:
                    summary["uncovered_lines"][str(relative_path)] = file_data["missing_lines"]
        
        # Quality gates assessment
        overall = summary["overall_metrics"]
        quality_gates = {
            "line_coverage_80": overall["line_rate"] >= 80.0,
            "line_coverage_90": overall["line_rate"] >= 90.0,
            "branch_coverage_75": overall["branch_rate"] >= 75.0,
            "no_files_below_70": True,  # Will be calculated below
        }
        
        # Check individual file coverage
        low_coverage_files = []
        for filepath, file_coverage in summary["file_coverage"].items():
            if file_coverage["line_coverage"] < 70.0:
                low_coverage_files.append({
                    "file": filepath,
                    "coverage": file_coverage["line_coverage"]
                })
        
        if low_coverage_files:
            quality_gates["no_files_below_70"] = False
            summary["recommendations"].append({
                "type": "low_coverage_files",
                "message": f"{len(low_coverage_files)} files have coverage below 70%",
                "files": low_coverage_files
            })
        
        summary["quality_gates"] = quality_gates
        
        # Generate recommendations
        if overall["line_rate"] < 80.0:
            summary["recommendations"].append({
                "type": "overall_coverage",
                "message": f"Overall line coverage is {overall['line_rate']:.1f}%. Target: 80%+",
                "priority": "high"
            })
        
        if overall["branch_rate"] < 75.0:
            summary["recommendations"].append({
                "type": "branch_coverage",
                "message": f"Branch coverage is {overall['branch_rate']:.1f}%. Target: 75%+",
                "priority": "medium"
            })
        
        return summary
    
    def identify_critical_gaps(self) -> List[Dict[str, Any]]:
        """Identify critical coverage gaps"""
        coverage_data = self.parse_coverage_json()
        
        if "error" in coverage_data or "files" not in coverage_data:
            return []
        
        critical_gaps = []
        
        for filename, file_data in coverage_data["files"].items():
            if file_data["summary"]["percent_covered"] < 50.0:
                # Very low coverage
                critical_gaps.append({
                    "type": "very_low_coverage",
                    "file": filename,
                    "coverage": file_data["summary"]["percent_covered"],
                    "missing_lines": len(file_data["missing_lines"]),
                    "priority": "critical"
                })
            
            elif len(file_data["missing_lines"]) > 50:
                # Many uncovered lines
                critical_gaps.append({
                    "type": "many_uncovered_lines",
                    "file": filename,
                    "missing_lines": len(file_data["missing_lines"]),
                    "priority": "high"
                })
        
        # Sort by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        critical_gaps.sort(key=lambda x: priority_order.get(x["priority"], 4))
        
        return critical_gaps
    
    def generate_coverage_badge_data(self) -> Dict[str, str]:
        """Generate data for coverage badges"""
        summary = self.generate_coverage_summary()
        
        if "error" in summary:
            return {"error": summary["error"]}
        
        overall = summary["overall_metrics"]
        line_coverage = overall["line_rate"]
        
        # Determine badge color based on coverage
        if line_coverage >= 90:
            color = "brightgreen"
        elif line_coverage >= 80:
            color = "green"
        elif line_coverage >= 70:
            color = "yellowgreen"
        elif line_coverage >= 60:
            color = "yellow"
        elif line_coverage >= 50:
            color = "orange"
        else:
            color = "red"
        
        return {
            "schemaVersion": 1,
            "label": "coverage",
            "message": f"{line_coverage:.1f}%",
            "color": color
        }
    
    def generate_coverage_report(self, output_file: str = "tests/backend/coverage_report.json"):
        """Generate comprehensive coverage report"""
        summary = self.generate_coverage_summary()
        critical_gaps = self.identify_critical_gaps()
        badge_data = self.generate_coverage_badge_data()
        
        report = {
            "generated_at": str(Path().cwd()),
            "summary": summary,
            "critical_gaps": critical_gaps,
            "badge_data": badge_data,
            "quality_assessment": {
                "overall_grade": self._calculate_coverage_grade(summary),
                "improvement_areas": self._identify_improvement_areas(summary),
                "next_targets": self._suggest_next_targets(summary)
            }
        }
        
        # Write report to file
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        return report
    
    def _calculate_coverage_grade(self, summary: Dict[str, Any]) -> str:
        """Calculate overall coverage grade"""
        if "error" in summary:
            return "Unknown"
        
        line_rate = summary["overall_metrics"]["line_rate"]
        
        if line_rate >= 95:
            return "A+"
        elif line_rate >= 90:
            return "A"
        elif line_rate >= 85:
            return "B+"
        elif line_rate >= 80:
            return "B"
        elif line_rate >= 75:
            return "C+"
        elif line_rate >= 70:
            return "C"
        elif line_rate >= 65:
            return "D+"
        elif line_rate >= 60:
            return "D"
        else:
            return "F"
    
    def _identify_improvement_areas(self, summary: Dict[str, Any]) -> List[str]:
        """Identify specific areas for improvement"""
        if "error" in summary:
            return ["Coverage analysis failed"]
        
        areas = []
        overall = summary["overall_metrics"]
        
        if overall["line_rate"] < 80:
            areas.append("Overall line coverage below 80%")
        
        if overall["branch_rate"] < 75:
            areas.append("Branch coverage below 75%")
        
        # Check for files with no coverage
        uncovered_files = [
            filepath for filepath, coverage in summary["file_coverage"].items()
            if coverage["line_coverage"] == 0
        ]
        
        if uncovered_files:
            areas.append(f"{len(uncovered_files)} files with no test coverage")
        
        return areas
    
    def _suggest_next_targets(self, summary: Dict[str, Any]) -> List[str]:
        """Suggest next coverage targets"""
        if "error" in summary:
            return []
        
        targets = []
        overall = summary["overall_metrics"]
        current_coverage = overall["line_rate"]
        
        # Suggest incremental improvements
        if current_coverage < 70:
            targets.append("Reach 70% line coverage")
        elif current_coverage < 80:
            targets.append("Reach 80% line coverage")
        elif current_coverage < 90:
            targets.append("Reach 90% line coverage")
        else:
            targets.append("Maintain 90%+ coverage")
        
        # Suggest branch coverage improvements
        if overall["branch_rate"] < 75:
            targets.append("Improve branch coverage to 75%")
        
        return targets


@pytest.mark.coverage
class TestCoverageRequirements:
    """Test coverage requirements and quality gates"""
    
    def test_minimum_coverage_requirements(self):
        """Test that minimum coverage requirements are met"""
        analyzer = CoverageAnalyzer()
        summary = analyzer.generate_coverage_summary()
        
        if "error" in summary:
            pytest.skip(f"Coverage analysis failed: {summary['error']}")
        
        overall = summary["overall_metrics"]
        
        # Minimum coverage requirements
        assert overall["line_rate"] >= 70.0, f"Line coverage {overall['line_rate']:.1f}% below minimum 70%"
        
        # Warn if below recommended levels
        if overall["line_rate"] < 80.0:
            pytest.warn(UserWarning(f"Line coverage {overall['line_rate']:.1f}% below recommended 80%"))
        
        if overall["branch_rate"] < 75.0:
            pytest.warn(UserWarning(f"Branch coverage {overall['branch_rate']:.1f}% below recommended 75%"))
    
    def test_no_critical_coverage_gaps(self):
        """Test that there are no critical coverage gaps"""
        analyzer = CoverageAnalyzer()
        critical_gaps = analyzer.identify_critical_gaps()
        
        # Check for critical gaps
        critical_count = len([gap for gap in critical_gaps if gap["priority"] == "critical"])
        
        assert critical_count == 0, f"Found {critical_count} critical coverage gaps: {critical_gaps[:3]}"
        
        # Warn about high-priority gaps
        high_priority_count = len([gap for gap in critical_gaps if gap["priority"] == "high"])
        if high_priority_count > 0:
            pytest.warn(UserWarning(f"Found {high_priority_count} high-priority coverage gaps"))
    
    def test_coverage_report_generation(self):
        """Test that coverage reports can be generated"""
        analyzer = CoverageAnalyzer()
        
        try:
            report = analyzer.generate_coverage_report()
            
            # Verify report structure
            assert "summary" in report
            assert "critical_gaps" in report
            assert "quality_assessment" in report
            
            # Verify badge data is valid
            badge_data = report["badge_data"]
            if "error" not in badge_data:
                assert "label" in badge_data
                assert "message" in badge_data
                assert "color" in badge_data
            
        except Exception as e:
            pytest.fail(f"Coverage report generation failed: {str(e)}")
    
    def test_coverage_trend_analysis(self):
        """Test coverage trend analysis (if historical data exists)"""
        # This would compare current coverage with historical data
        # For now, this is a placeholder for future implementation
        
        analyzer = CoverageAnalyzer()
        current_summary = analyzer.generate_coverage_summary()
        
        if "error" in current_summary:
            pytest.skip("Current coverage data not available")
        
        # In a real implementation, this would:
        # 1. Load historical coverage data
        # 2. Compare trends
        # 3. Alert on significant decreases
        # 4. Celebrate improvements
        
        # For now, just verify current data is reasonable
        overall = current_summary["overall_metrics"]
        
        assert 0 <= overall["line_rate"] <= 100, "Line coverage percentage out of range"
        assert 0 <= overall["branch_rate"] <= 100, "Branch coverage percentage out of range"
    
    def test_file_coverage_distribution(self):
        """Test that coverage is reasonably distributed across files"""
        analyzer = CoverageAnalyzer()
        summary = analyzer.generate_coverage_summary()
        
        if "error" in summary or not summary["file_coverage"]:
            pytest.skip("File coverage data not available")
        
        file_coverages = [
            coverage["line_coverage"] 
            for coverage in summary["file_coverage"].values()
        ]
        
        if not file_coverages:
            pytest.skip("No file coverage data available")
        
        # Check distribution
        uncovered_files = len([c for c in file_coverages if c == 0])
        fully_covered_files = len([c for c in file_coverages if c == 100])
        
        total_files = len(file_coverages)
        
        # Warn if too many files are completely uncovered
        if uncovered_files / total_files > 0.2:  # More than 20%
            pytest.warn(UserWarning(
                f"{uncovered_files}/{total_files} files ({uncovered_files/total_files*100:.1f}%) "
                "have no test coverage"
            ))
        
        # Celebrate if many files are fully covered
        if fully_covered_files / total_files > 0.5:  # More than 50%
            print(f"✅ {fully_covered_files}/{total_files} files ({fully_covered_files/total_files*100:.1f}%) "
                  "have 100% test coverage!")


if __name__ == "__main__":
    # Command-line interface for coverage analysis
    import sys
    
    analyzer = CoverageAnalyzer()
    
    if len(sys.argv) > 1 and sys.argv[1] == "report":
        print("Generating coverage report...")
        report = analyzer.generate_coverage_report()
        
        if "error" in report.get("summary", {}):
            print(f"❌ Error: {report['summary']['error']}")
            sys.exit(1)
        
        summary = report["summary"]
        overall = summary["overall_metrics"]
        
        print(f"\n📊 Coverage Report")
        print(f"==================")
        print(f"Line Coverage: {overall['line_rate']:.1f}%")
        print(f"Branch Coverage: {overall['branch_rate']:.1f}%")
        print(f"Grade: {report['quality_assessment']['overall_grade']}")
        
        if report["critical_gaps"]:
            print(f"\n⚠️ Critical Gaps: {len(report['critical_gaps'])}")
            for gap in report["critical_gaps"][:3]:  # Show first 3
                print(f"  - {gap['file']}: {gap['coverage']:.1f}% coverage")
        
        print(f"\n✅ Report saved to: tests/backend/coverage_report.json")
        
    else:
        print("Usage: python test_coverage.py [report]")
        print("  report: Generate comprehensive coverage report")