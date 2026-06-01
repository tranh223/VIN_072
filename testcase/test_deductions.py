"""Test deductions logic in calculate_tax. Run with: python -m tests.test_deductions"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.sub_agent.tax_agent import calculate_tax

def test_no_deductions():
    r = calculate_tax(revenue_raw=100_000_000, industry='goods', period_months=1)
    assert r['net_revenue'] == 100_000_000, f"Expected 100M net, got {r['net_revenue']}"
    assert r['total_deductions'] == 0, f"Expected 0 deductions, got {r['total_deductions']}"
    assert r['deduction_exceeds_revenue'] == False
    print("  PASS: no_deductions")

def test_with_deductions():
    r = calculate_tax(revenue_raw=100_000_000, industry='goods', period_months=1,
        deductions={'refunds': 5_000_000, 'trade_discounts': 2_000_000,
                    'payment_discounts': 1_000_000, 'promotions': 500_000})
    assert r['total_deductions'] == 8_500_000, f"Expected 8.5M deductions, got {r['total_deductions']}"
    assert r['net_revenue'] == 91_500_000, f"Expected 91.5M net, got {r['net_revenue']}"
    assert r['deduction_exceeds_revenue'] == False
    print("  PASS: with_deductions")

def test_deductions_exceed_revenue():
    r = calculate_tax(revenue_raw=10_000_000, industry='goods', period_months=1,
        deductions={'refunds': 15_000_000})
    assert r['net_revenue'] == 0, f"Expected 0 net, got {r['net_revenue']}"
    assert r['deduction_exceeds_revenue'] == True
    assert r['total_deductions'] == 15_000_000
    print("  PASS: deductions_exceed_revenue")

def test_empty_deductions():
    r = calculate_tax(revenue_raw=50_000_000, industry='services', period_months=1, deductions={})
    assert r['net_revenue'] == 50_000_000
    assert r['total_deductions'] == 0
    assert r['deduction_exceeds_revenue'] == False
    print("  PASS: empty_deductions")

def test_none_deductions():
    r = calculate_tax(revenue_raw=50_000_000, industry='services', period_months=1, deductions=None)
    assert r['net_revenue'] == 50_000_000
    assert r['total_deductions'] == 0
    print("  PASS: none_deductions")

if __name__ == '__main__':
    print("Testing deductions...")
    test_no_deductions()
    test_with_deductions()
    test_deductions_exceed_revenue()
    test_empty_deductions()
    test_none_deductions()
    print("\nAll tests PASSED!")
