import unittest
import counters

class CounterTests(unittest.TestCase):
    def test_current_total_is_separate_from_recoverable_and_max(self):
        self.assertEqual(counters.parse('2 Hit Combo\n44 Damage (16)\nMax Combo Damage 99'), (44, 2))
        self.assertEqual(counters.parse('Total Damage: 75\n11 Hits'), (75, 11))

    def test_no_damage_value_is_invented_from_health_or_a_maximum(self):
        self.assertEqual(counters.parse('HEALTH 156 (16)\nMax Combo Damage 99'), (None, None))

if __name__ == '__main__':
    unittest.main()
