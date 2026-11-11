from __future__ import annotations

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from typing import Any
from urllib.parse import urlparse


MAX_BODY_BYTES = 64 * 1024
ALLOWED_FIELDS = {
    "location",
    "listing_type",
    "limit",
    "min_price",
    "max_price",
    "min_beds",
    "max_beds",
    "min_baths",
    "min_sqft",
    "max_sqft",
    "lot_size_min",
    "lot_size_max",
    "year_built_min",
    "year_built_max",
    "days_old",
    "foreclosure",
    "property_type",
}


class RequestError(ValueError):
    pass


def optional_number(payload: dict[str, Any], name: str, *, integer: bool = False) -> int | float | None:
    value = payload.get(name)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        raise RequestError(f"{name} must be a non-negative number")
    if integer and not float(value).is_integer():
        raise RequestError(f"{name} must be an integer")
    return int(value) if integer else value


def optional_bool(payload: dict[str, Any], name: str) -> bool | None:
    value = payload.get(name)
    if value is None:
        return None
    if not isinstance(value, bool):
        raise RequestError(f"{name} must be a boolean")
    return value


def parse_search(payload: Any) -> tuple[dict[str, Any], str | None]:
    if not isinstance(payload, dict):
        raise RequestError("Request body must be a JSON object")
    unknown = set(payload) - ALLOWED_FIELDS
    if unknown:
        raise RequestError(f"Unknown fields: {', '.join(sorted(unknown))}")

    location = payload.get("location")
    if not isinstance(location, str) or not 2 <= len(location.strip()) <= 300:
        raise RequestError("location must contain 2 to 300 characters")
    listing_type = payload.get("listing_type", "for_sale")
    if listing_type != "for_sale":
        raise RequestError("Only for_sale searches are supported")

    limit = optional_number(payload, "limit", integer=True) or 10
    if not 1 <= limit <= 25:
        raise RequestError("limit must be between 1 and 25")
    min_price = optional_number(payload, "min_price", integer=True)
    max_price = optional_number(payload, "max_price", integer=True)
    if min_price is not None and max_price is not None and min_price > max_price:
        raise RequestError("min_price cannot exceed max_price")

    property_type = payload.get("property_type")
    if property_type is not None and (not isinstance(property_type, str) or not property_type.strip()):
        raise RequestError("property_type must be a non-empty string")

    arguments = {
        "location": location.strip(),
        "listing_type": listing_type,
        "limit": limit,
        "price_min": min_price,
        "price_max": max_price,
        "beds_min": optional_number(payload, "min_beds", integer=True),
        "beds_max": optional_number(payload, "max_beds", integer=True),
        "baths_min": optional_number(payload, "min_baths"),
        "sqft_min": optional_number(payload, "min_sqft", integer=True),
        "sqft_max": optional_number(payload, "max_sqft", integer=True),
        "lot_size_min": optional_number(payload, "lot_size_min"),
        "lot_size_max": optional_number(payload, "lot_size_max"),
        "year_built_min": optional_number(payload, "year_built_min", integer=True),
        "year_built_max": optional_number(payload, "year_built_max", integer=True),
        "past_days": optional_number(payload, "days_old", integer=True),
        "foreclosure": optional_bool(payload, "foreclosure"),
    }
    return {key: value for key, value in arguments.items() if value is not None}, property_type.strip() if property_type else None


def search(payload: Any) -> list[dict[str, Any]]:
    arguments, property_type = parse_search(payload)
    from homeharvest import scrape_property

    properties = scrape_property(**arguments)
    if property_type:
        expected = property_type.casefold()
        for column in ("property_type", "style"):
            if column in properties.columns:
                properties = properties[properties[column].fillna("").astype(str).str.casefold() == expected]
                break
    return json.loads(properties.to_json(orient="records", date_format="iso"))


class Handler(BaseHTTPRequestHandler):
    server_version = "BuyerSyncHomeHarvest/1.0"

    def send_json(self, status: HTTPStatus, payload: Any) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/health":
            self.send_json(HTTPStatus.OK, {"status": "ok", "service": "homeharvest"})
            return
        self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/search":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY_BYTES:
                raise RequestError("Request body size is invalid")
            payload = json.loads(self.rfile.read(length))
            self.send_json(HTTPStatus.OK, {"listings": search(payload)})
        except (json.JSONDecodeError, RequestError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:
            print(f"HomeHarvest search failed: {type(error).__name__}: {error}", flush=True)
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "Listing provider request failed"})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"HomeHarvest adapter: {format % args}", flush=True)


if __name__ == "__main__":
    host = os.environ.get("HOMEHARVEST_HOST", "127.0.0.1")
    port = int(os.environ.get("HOMEHARVEST_PORT", "4310"))
    print(f"HomeHarvest adapter listening on http://{host}:{port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()