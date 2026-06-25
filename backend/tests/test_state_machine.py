"""
Unit tests for the pure bag state machine (models/state_machine.py).

Run from the backend/ directory:
    python3 -m unittest tests.test_state_machine
"""
import os
import sys
import unittest

# Make backend/ importable when run directly or via discover.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models import state_machine as sm  # noqa: E402
from models.state_machine import decide, normalize_status, InvalidTransition  # noqa: E402


def scan_ctx(prev=None, visited=None, duration=0.0, threshold=20.0):
    return {
        'prev_checkpoint': prev,
        'visited':         visited or [],
        'duration_mins':   duration,
        'stall_threshold': threshold,
    }


class HappyPathScans(unittest.TestCase):
    def test_first_scan_check_in_registers(self):
        status, anomalies = decide(None, 'check_in', scan_ctx())
        self.assertEqual(status, 'REGISTERED')
        self.assertEqual(anomalies, [])

    def test_full_happy_sequence(self):
        steps = [
            ('REGISTERED', 'security', 'check_in',  ['check_in'],                                  'SCREENED'),
            ('SCREENED',   'sorting',  'security',  ['check_in', 'security'],                       'SORTED'),
            ('SORTED',     'loading',  'sorting',   ['check_in', 'security', 'sorting'],            'LOADED'),
            ('LOADED',     'arrival',  'loading',   ['check_in', 'security', 'sorting', 'loading'], 'ARRIVED'),
        ]
        for current, cp, prev, visited, expected in steps:
            status, anomalies = decide(current, cp, scan_ctx(prev=prev, visited=visited))
            self.assertEqual(status, expected, f'{current} + {cp}')
            self.assertEqual(anomalies, [], f'{current} + {cp} should be clean')

    def test_idempotent_rescan_stays_put(self):
        status, anomalies = decide('SCREENED', 'security',
                                   scan_ctx(prev='security', visited=['check_in', 'security']))
        self.assertEqual(status, 'SCREENED')
        self.assertEqual(anomalies, [])


class ExceptionScans(unittest.TestCase):
    def test_security_bypass_flags(self):
        status, anomalies = decide('REGISTERED', 'sorting',
                                   scan_ctx(prev='check_in', visited=['check_in']))
        self.assertEqual(status, 'FLAGGED')
        types = [a['type'] for a in anomalies]
        self.assertIn('SECURITY_BYPASS', types)
        bypass = next(a for a in anomalies if a['type'] == 'SECURITY_BYPASS')
        self.assertEqual(bypass['checkpoint'], 'sorting')

    def test_security_bypass_and_wrong_route_both_detected(self):
        # check_in -> loading: skips security AND skips sorting → both anomalies.
        status, anomalies = decide('REGISTERED', 'loading',
                                   scan_ctx(prev='check_in', visited=['check_in']))
        self.assertEqual(status, 'FLAGGED')
        types = [a['type'] for a in anomalies]
        self.assertIn('SECURITY_BYPASS', types)
        self.assertIn('WRONG_ROUTE', types)

    def test_wrong_route_when_security_done(self):
        status, anomalies = decide('SCREENED', 'loading',
                                   scan_ctx(prev='security', visited=['check_in', 'security']))
        self.assertEqual(status, 'MISROUTED')
        types = [a['type'] for a in anomalies]
        self.assertIn('WRONG_ROUTE', types)

    def test_backward_scan_is_wrong_route(self):
        status, anomalies = decide('SORTED', 'security',
                                   scan_ctx(prev='sorting', visited=['check_in', 'security', 'sorting']))
        self.assertEqual(status, 'MISROUTED')
        types = [a['type'] for a in anomalies]
        self.assertIn('WRONG_ROUTE', types)

    def test_stall_flags_regardless_of_sequence(self):
        status, anomalies = decide('SCREENED', 'sorting',
                                   scan_ctx(prev='security', visited=['check_in', 'security'],
                                            duration=25.0, threshold=20.0))
        self.assertEqual(status, 'FLAGGED')
        types = [a['type'] for a in anomalies]
        self.assertIn('STALL', types)

    def test_stall_and_security_bypass_both_detected(self):
        # Bag stalled at sorting AND never went through security.
        status, anomalies = decide('REGISTERED', 'sorting',
                                   scan_ctx(prev='check_in', visited=['check_in'],
                                            duration=25.0, threshold=20.0))
        self.assertEqual(status, 'FLAGGED')
        types = [a['type'] for a in anomalies]
        self.assertIn('STALL', types)
        self.assertIn('SECURITY_BYPASS', types)

    def test_scan_on_claimed_bag_rejected(self):
        with self.assertRaises(InvalidTransition):
            decide('CLAIMED', 'arrival', scan_ctx(prev='arrival'))

    def test_scan_on_arrived_bag_rejected(self):
        with self.assertRaises(InvalidTransition):
            decide('ARRIVED', 'check_in', scan_ctx())


class OperatorActions(unittest.TestCase):
    def test_hold_and_release(self):
        held, _ = decide('SCREENED', 'hold', {})
        self.assertEqual(held, 'HELD')
        released, _ = decide('HELD', 'release', {})
        self.assertEqual(released, 'SCREENED')

    def test_claim_only_from_lost(self):
        claimed, _ = decide('LOST', 'claim', {})
        self.assertEqual(claimed, 'CLAIMED')
        with self.assertRaises(InvalidTransition):
            decide('ARRIVED', 'claim', {})
        with self.assertRaises(InvalidTransition):
            decide('REGISTERED', 'claim', {})

    def test_reroute_recovers_misrouted(self):
        status, _ = decide('MISROUTED', 'reroute', {})
        self.assertEqual(status, 'SORTED')

    def test_report_lost_and_found(self):
        lost, _ = decide('LOADED', 'report_lost', {})
        self.assertEqual(lost, 'LOST')
        found, _ = decide('LOST', 'found', {})
        self.assertEqual(found, 'SCREENED')

    def test_illegal_action_raises(self):
        with self.assertRaises(InvalidTransition):
            decide('REGISTERED', 'release', {})

    def test_unknown_trigger_raises_value_error(self):
        with self.assertRaises(ValueError):
            decide('REGISTERED', 'teleport', {})


class LegacyNormalisation(unittest.TestCase):
    def test_arrived_maps_to_ARRIVED(self):
        self.assertEqual(normalize_status('arrived'), 'ARRIVED')

    def test_in_transit_derives_from_checkpoint(self):
        self.assertEqual(normalize_status('in_transit', 'security'), 'SCREENED')
        self.assertEqual(normalize_status('in_transit', 'sorting'), 'SORTED')

    def test_in_transit_without_checkpoint_defaults_registered(self):
        self.assertEqual(normalize_status('in_transit'), 'REGISTERED')

    def test_fsm_state_passes_through(self):
        self.assertEqual(normalize_status('FLAGGED'), 'FLAGGED')

    def test_unknown_value_never_crashes(self):
        self.assertEqual(normalize_status('garbage', 'loading'), 'LOADED')
        self.assertEqual(normalize_status('garbage'), 'REGISTERED')

    def test_none_passes_through(self):
        self.assertIsNone(normalize_status(None))


class ModuleShape(unittest.TestCase):
    def test_states_and_actions_exported(self):
        self.assertIn('REGISTERED', sm.STATES)
        self.assertIn('CLAIMED', sm.STATES)
        self.assertEqual(set(sm.ACTIONS),
                         {'hold', 'release', 'reroute', 'claim', 'report_lost', 'found'})

    def test_resolution_transitions_close_the_loop(self):
        self.assertEqual(sm.RESOLUTION_TRANSITIONS['FLAGGED'], 'SCREENED')
        self.assertEqual(sm.RESOLUTION_TRANSITIONS['MISROUTED'], 'SORTED')


if __name__ == '__main__':
    unittest.main()
