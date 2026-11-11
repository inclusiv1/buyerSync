import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from services.homeharvest.bootstrap import adapter_health_url, existing_adapter_is_healthy, load_adapter_environment
from services.homeharvest.server import RequestError, parse_search


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self, _limit):
        return self.payload


class BootstrapTest(unittest.TestCase):
    def test_loads_adapter_binding_from_project_env_without_overriding_process(self):
        with TemporaryDirectory() as directory:
            Path(directory, ".env").write_text(
                'HOMEHARVEST_HOST="0.0.0.0"\nHOMEHARVEST_PORT=4311\nJWT_SECRET="ignored"\n',
                encoding="utf-8",
            )
            with patch("services.homeharvest.bootstrap.PROJECT_ROOT", Path(directory)):
                with patch.dict(os.environ, {"HOMEHARVEST_HOST": "127.0.0.1"}, clear=True):
                    load_adapter_environment()
                    self.assertEqual(os.environ["HOMEHARVEST_HOST"], "127.0.0.1")
                    self.assertEqual(os.environ["HOMEHARVEST_PORT"], "4311")
                    self.assertNotIn("JWT_SECRET", os.environ)

    @patch.dict("os.environ", {"HOMEHARVEST_HOST": "127.0.0.2", "HOMEHARVEST_PORT": "4321"})
    def test_builds_health_url_from_adapter_binding(self):
        self.assertEqual(adapter_health_url(), "http://127.0.0.2:4321/health")

    @patch("services.homeharvest.bootstrap.urlopen")
    def test_recognizes_compatible_existing_adapter(self, request):
        request.return_value = FakeResponse(b'{"status":"ok","service":"homeharvest"}')

        self.assertTrue(existing_adapter_is_healthy())

    @patch("services.homeharvest.bootstrap.urlopen", side_effect=OSError("not listening"))
    def test_treats_unavailable_adapter_as_unhealthy(self, _request):
        self.assertFalse(existing_adapter_is_healthy())


class ParseSearchTest(unittest.TestCase):
    def test_maps_copilot_contract_to_homeharvest(self):
        arguments, property_type = parse_search({
            "location": "Marietta, GA",
            "listing_type": "for_sale",
            "limit": 10,
            "min_price": 200000,
            "max_price": 700000,
            "min_beds": 3,
            "min_baths": 2,
            "property_type": "single_family",
        })

        self.assertEqual(arguments, {
            "location": "Marietta, GA",
            "listing_type": "for_sale",
            "limit": 10,
            "price_min": 200000,
            "price_max": 700000,
            "beds_min": 3,
            "baths_min": 2,
        })
        self.assertEqual(property_type, "single_family")

    def test_maps_additional_zillow_criteria_to_homeharvest(self):
        arguments, property_type = parse_search({
            "location": "Marietta, GA",
            "max_beds": 4,
            "min_sqft": 1200,
            "max_sqft": 2400,
            "lot_size_min": 5000,
            "lot_size_max": 12000,
            "year_built_min": 1990,
            "year_built_max": 2020,
            "days_old": 30,
            "foreclosure": True,
            "property_type": "single_family",
        })

        self.assertEqual(arguments, {
            "location": "Marietta, GA",
            "listing_type": "for_sale",
            "limit": 10,
            "beds_max": 4,
            "sqft_min": 1200,
            "sqft_max": 2400,
            "lot_size_min": 5000,
            "lot_size_max": 12000,
            "year_built_min": 1990,
            "year_built_max": 2020,
            "past_days": 30,
            "foreclosure": True,
        })
        self.assertEqual(property_type, "single_family")

    def test_rejects_unknown_fields(self):
        with self.assertRaisesRegex(RequestError, "Unknown fields"):
            parse_search({"location": "30339", "groupId": "another-group"})

    def test_rejects_invalid_bounds(self):
        with self.assertRaisesRegex(RequestError, "min_price cannot exceed max_price"):
            parse_search({"location": "30339", "min_price": 900000, "max_price": 500000})


if __name__ == "__main__":
    unittest.main()